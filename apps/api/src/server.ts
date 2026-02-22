import 'dotenv/config'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { desc, eq, sql } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { OpenAPIHono, z } from '@hono/zod-openapi'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import dbPackage from '@bizing/db'
import { auth } from './auth.js'
import { chatWithLLM, createBizingSystemPrompt } from './services/llm.js'
import { getCompactMindState, getMindFile } from './services/mind-api.js'
import { getCachedMindMap, searchMindDynamic, getMindStructure, listAllFiles, exploreDirectory } from './services/mind-map.js'
import { semanticSearch, buildAndCacheEmbeddings, getEmbeddingStats, isEmbeddingsReady, testProviders } from './services/mind-embeddings.js'
import { searchKnowledgeBase, getKnowledgeEntry, getEntriesByType, getKnowledgeStats } from './services/mind-knowledge.js'
import { getFileCatalog, searchCatalog, getCatalogStats } from './services/mind-catalog.js'
import {
  executePseudoApiRequest,
  getSchemaCatalog,
  resolveTableName,
  runScenarios,
  serializeCatalog,
  translateNaturalLanguageRequest,
} from './agent-contract/index.js'

const { db, bookingOrders, offers, users } = dbPackage

// ============================================
// Constants
// ============================================

const MIND_DIR = join(process.cwd(), '..', '..', 'mind')

type SchemaRelationshipType = '1:N' | '1:1' | 'N:1'

interface SchemaGraphColumn {
  name: string
  type: string
  nullable: boolean
  primaryKey: boolean
}

interface SchemaGraphRelationship {
  type: SchemaRelationshipType
  to: string
  field: string
  description: string
}

interface SchemaGraphEntity {
  name: string
  tableName: string
  columns: SchemaGraphColumn[]
  relationships: SchemaGraphRelationship[]
}

interface SchemaGraphNode {
  id: string
  type: 'entityNode'
  position: { x: number; y: number }
  data: { entity: SchemaGraphEntity }
}

interface SchemaGraphEdge {
  id: string
  source: string
  target: string
  sourceHandle: string
  targetHandle: string
  label: string
  type: 'smoothstep'
  animated: boolean
}

interface SchemaGraphSummary {
  totalEntities: number
  totalColumns: number
  totalRelationships: number
  totalPrimaryKeys: number
}

interface SchemaGraphResponse {
  entities: SchemaGraphEntity[]
  nodes: SchemaGraphNode[]
  edges: SchemaGraphEdge[]
  summary: SchemaGraphSummary
}

let schemaGraphCache: SchemaGraphResponse | null = null

function toEntityName(tableName: string): string {
  return tableName
    .split('_')
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(' ')
}

function readTableConfig(value: unknown): ReturnType<typeof getTableConfig> | null {
  try {
    return getTableConfig(value as never)
  } catch {
    return null
  }
}

function buildSchemaGraph(): SchemaGraphResponse {
  if (schemaGraphCache) {
    return schemaGraphCache
  }

  const byTableName = new Map<string, ReturnType<typeof getTableConfig>>()
  const fullSchema = ((db as unknown as { _: { fullSchema?: Record<string, unknown> } })._?.fullSchema ??
    {}) as Record<string, unknown>
  for (const value of Object.values(fullSchema)) {
    const config = readTableConfig(value)
    if (!config || !config.name || byTableName.has(config.name)) {
      continue
    }
    byTableName.set(config.name, config)
  }

  const tableNames = Array.from(byTableName.keys()).sort((a, b) => a.localeCompare(b))
  const outgoing = new Map<string, SchemaGraphRelationship[]>()
  const incoming = new Map<string, SchemaGraphRelationship[]>()
  const edges: SchemaGraphEdge[] = []

  for (const tableName of tableNames) {
    const config = byTableName.get(tableName)
    if (!config) continue

    config.foreignKeys.forEach((foreignKey, fkIndex) => {
      const reference = foreignKey.reference()
      const foreignTable = readTableConfig(reference.foreignTable)
      if (!foreignTable) return

      const localColumnNames = reference.columns.map((column) => column.name)
      const foreignColumnNames = reference.foreignColumns.map((column) => column.name)
      const localFields = localColumnNames.join(', ')
      const foreignFields = foreignColumnNames.join(', ')
      const outgoingRelationship: SchemaGraphRelationship = {
        type: 'N:1',
        to: toEntityName(foreignTable.name),
        field: localFields,
        description: `${tableName}.${localFields} → ${foreignTable.name}.${foreignFields}`,
      }
      const incomingRelationship: SchemaGraphRelationship = {
        type: '1:N',
        to: toEntityName(tableName),
        field: foreignFields,
        description: `Referenced by ${tableName}.${localFields}`,
      }

      outgoing.set(tableName, [...(outgoing.get(tableName) ?? []), outgoingRelationship])
      incoming.set(foreignTable.name, [
        ...(incoming.get(foreignTable.name) ?? []),
        incomingRelationship,
      ])

      const edgeIdSeed =
        reference.name ??
        `${tableName}_${foreignTable.name}_${localColumnNames.join('_')}_${fkIndex}`
      edges.push({
        id: `fk_${edgeIdSeed}`.replace(/[^a-zA-Z0-9_:.-]/g, '_'),
        source: tableName,
        target: foreignTable.name,
        sourceHandle: 'source-1',
        targetHandle: 'target-1',
        label: 'N:1',
        type: 'smoothstep',
        animated: false,
      })
    })
  }

  const entities: SchemaGraphEntity[] = tableNames.map((tableName) => {
    const config = byTableName.get(tableName)!
    const columns: SchemaGraphColumn[] = config.columns.map((column) => ({
      name: column.name,
      type: typeof column.getSQLType === 'function' ? column.getSQLType() : column.columnType,
      nullable: !column.notNull,
      primaryKey: column.primary,
    }))

    return {
      name: toEntityName(tableName),
      tableName,
      columns,
      relationships: [...(outgoing.get(tableName) ?? []), ...(incoming.get(tableName) ?? [])],
    }
  })

  const columnsPerRow = Math.max(1, Math.ceil(Math.sqrt(entities.length)))
  const nodes: SchemaGraphNode[] = entities.map((entity, index) => {
    const row = Math.floor(index / columnsPerRow)
    const col = index % columnsPerRow
    return {
      id: entity.tableName,
      type: 'entityNode',
      position: {
        x: 60 + col * 360,
        y: 60 + row * 240,
      },
      data: { entity },
    }
  })

  const summary: SchemaGraphSummary = {
    totalEntities: entities.length,
    totalColumns: entities.reduce((sum, entity) => sum + entity.columns.length, 0),
    totalRelationships: edges.length,
    totalPrimaryKeys: entities.reduce(
      (sum, entity) => sum + entity.columns.filter((column) => column.primaryKey).length,
      0,
    ),
  }

  schemaGraphCache = {
    entities,
    nodes,
    edges,
    summary,
  }

  log(
    `Schema graph cached: ${summary.totalEntities} entities, ${summary.totalColumns} columns, ${summary.totalRelationships} relationships`,
  )
  return schemaGraphCache
}

// ============================================
// Logger
// ============================================

function log(message: string) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  console.log(`[${timestamp}] ${message}`)
}

// ============================================
// API Routes
// ============================================

const app = new OpenAPIHono()

// CORS
app.use('/*', cors())

// Better Auth endpoint handler
app.on(['GET', 'POST'], '/api/auth/*', async (c) => {
  return auth.handler(c.req.raw)
})

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  })
})

// ============================================
// Products Routes
// ============================================

app.get('/api/v1/products', (c) => {
  return c.json({
    data: [
      { id: '1', name: 'E-Book', price: 29.99, type: 'digital' },
      { id: '2', name: 'Consultation', price: 100, type: 'service' },
      { id: '3', name: 'Premium Course', price: 199, type: 'subscription' },
    ],
  })
})

// ============================================
// Stats Routes
// ============================================

app.get('/api/v1/stats', (c) => {
  return c.json({
    totalRevenue: 12500,
    totalBookings: 156,
    totalCustomers: 89,
    pendingOrders: 12,
  })
})

// ============================================
// Bookings Routes
// ============================================

app.get('/api/v1/bookings', async (c) => {
  const page = Math.max(1, Number(c.req.query('page') || '1'))
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') || '10')))
  const offset = (page - 1) * limit

  try {
    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: bookingOrders.id,
          startTime: bookingOrders.confirmedStartAt,
          status: bookingOrders.status,
          totalMinor: bookingOrders.totalMinor,
          offerName: offers.name,
          customerFirstName: users.firstName,
          customerLastName: users.lastName,
        })
        .from(bookingOrders)
        .leftJoin(offers, eq(bookingOrders.offerId, offers.id))
        .leftJoin(users, eq(bookingOrders.customerUserId, users.id))
        .orderBy(desc(bookingOrders.confirmedStartAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(bookingOrders),
    ])

    const data = rows.map((row) => {
      const fallbackName = [row.customerFirstName, row.customerLastName].filter(Boolean).join(' ').trim()

      return {
        id: row.id,
        serviceName: row.offerName || 'Unknown Offer',
        customerName: fallbackName || 'Unknown Customer',
        date: row.startTime ? row.startTime.toISOString().slice(0, 10) : '',
        status: row.status || 'draft',
        price: Number(row.totalMinor || 0) / 100,
      }
    })

    return c.json({
      data,
      pagination: {
        page,
        limit,
        total: Number(countResult[0]?.count || 0),
      },
    })
  } catch (error) {
    log(`Failed to fetch bookings: ${error instanceof Error ? error.message : String(error)}`)
    return c.json({ error: 'Failed to fetch bookings' }, 500)
  }
})

// ============================================
// Schema Routes
// ============================================

app.get('/api/v1/schema/graph', (c) => {
  try {
    return c.json(buildSchemaGraph())
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log(`Failed to build schema graph: ${message}`)
    return c.json({ error: 'Failed to build schema graph', message }, 500)
  }
})

// ============================================
// Agent Contract Routes (Pre-REST Schema Testing)
// ============================================

app.get('/api/v1/agent/schema', (c) => {
  try {
    const catalog = getSchemaCatalog()
    const tableQuery = c.req.query('table')

    if (!tableQuery) {
      return c.json({
        success: true,
        catalog: serializeCatalog(catalog),
      })
    }

    const resolved = resolveTableName(tableQuery, catalog) ?? tableQuery
    const table = catalog.tables.get(resolved)
    if (!table) {
      return c.json(
        {
          success: false,
          error: {
            code: 'TABLE_NOT_FOUND',
            message: `Unknown table alias/name: ${tableQuery}`,
          },
        },
        404,
      )
    }

    return c.json({
      success: true,
      catalog: {
        generatedAt: catalog.generatedAt,
        summary: {
          tableCount: 1,
          columnCount: table.columns.length,
        },
        table: {
          name: table.name,
          hasBizId: table.hasBizId,
          primaryKeys: table.primaryKeys,
          columns: table.columns,
        },
      },
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'AGENT_SCHEMA_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch schema catalog',
        },
      },
      500,
    )
  }
})

app.post('/api/v1/agent/translate', async (c) => {
  try {
    const body = await c.req.json()
    const result = translateNaturalLanguageRequest(body)
    return c.json(result, result.success ? 200 : 400)
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: error instanceof Error ? error.message : 'Invalid request payload',
        },
      },
      400,
    )
  }
})

app.post('/api/v1/agent/execute', async (c) => {
  try {
    const body = await c.req.json()
    const result = await executePseudoApiRequest(body)
    return c.json(result, result.success ? 200 : 400)
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'AGENT_EXECUTE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to execute pseudo request',
        },
      },
      500,
    )
  }
})

app.post('/api/v1/agent/simulate', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>
    const translation = translateNaturalLanguageRequest({
      ...body,
      dryRun: true,
    })

    if (!translation.success || !translation.pseudoRequest) {
      return c.json(
        {
          success: false,
          translation,
        },
        400,
      )
    }

    const execution = await executePseudoApiRequest({
      ...translation.pseudoRequest,
      dryRun: true,
    })

    return c.json({
      success: execution.success,
      translation,
      execution,
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'AGENT_SIMULATE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to simulate request',
        },
      },
      500,
    )
  }
})

app.post('/api/v1/agent/scenarios/run', async (c) => {
  try {
    const body = await c.req.json()
    const result = await runScenarios(body)
    return c.json(result, result.success ? 200 : 207)
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'AGENT_SCENARIO_RUN_ERROR',
          message: error instanceof Error ? error.message : 'Failed to run scenarios',
        },
      },
      400,
    )
  }
})

// ============================================
// Bizing AI Chat with Conversation Memory
// ============================================

// Simple in-memory conversation store (per-session)
const conversations = new Map<string, { role: 'system' | 'user' | 'assistant'; content: string }[]>()
const MAX_HISTORY = 10 // Keep last 10 messages

app.post('/api/v1/bizing/chat', async (c) => {
  const body = await c.req.json()
  const { message, sessionId = 'default', enableFunctions = true, provider } = body

  try {
    log(`Bizing chat request [${sessionId}]: ${message.slice(0, 50)}...`)
    
    // Default to OpenAI for web interface (reliable function calling)
    // Use explicit provider if provided (e.g., 'ollama' for local testing)
    const effectiveProvider = provider || 'openai'
    
    // Get or create conversation history
    let history = conversations.get(sessionId) || []
    
    // If new conversation, start with system prompt
    if (history.length === 0) {
      history = [{
        role: 'system',
        content: createBizingSystemPrompt(),
      }]
    }
    
    // Add user message
    history.push({
      role: 'user',
      content: message,
    })
    
    // Trim history if too long (keep system + last N messages)
    if (history.length > MAX_HISTORY + 1) {
      const systemMsg = history[0]
      history = [systemMsg, ...history.slice(-(MAX_HISTORY))]
    }

    const response = await chatWithLLM({
      messages: history,
      temperature: 0.7,
      maxTokens: 2000,
      enableFunctions,
    }, effectiveProvider) // Use effective provider (defaults to openai)

    // Add assistant response to history
    history.push({
      role: 'assistant',
      content: response,
    })
    
    // Save updated history
    conversations.set(sessionId, history)

    log('Bizing chat response generated successfully')

    return c.json({
      response,
      sessionId,
      messageCount: history.length,
      timestamp: new Date().toISOString(),
      model: effectiveProvider || 'openai',
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    log(`Bizing chat error: ${errorMessage}`)
    
    return c.json({
      response: 'I apologize, but I am having trouble connecting to my knowledge base right now. Please check that my API key is configured correctly.',
      error: errorMessage,
      timestamp: new Date().toISOString(),
      model: 'error',
    }, 500)
  }
})

// ============================================
// Mind API Routes (Dynamic Discovery)
// ============================================

app.get('/api/v1/mind/state', (c) => {
  return c.json(getCompactMindState())
})

app.get('/api/v1/mind/file/:path{.+}', (c) => {
  const path = c.req.param('path')
  return c.json(getMindFile(path))
})

app.get('/api/v1/mind/map', (c) => {
  const map = getCachedMindMap()
  return c.json({
    entryPoint: map.entryPoint,
    totalFiles: map.nodes.size,
    directories: map.directories,
    files: Array.from(map.nodes.entries()).map(([path, node]) => ({
      path,
      title: node.title,
      type: node.type,
      links: node.links.length,
      backLinks: node.backLinks.length
    }))
  })
})

app.get('/api/v1/mind/search', (c) => {
  const query = c.req.query('q')
  if (!query) return c.json({ error: 'Missing query' }, 400)
  return c.json(searchMindDynamic(query))
})

app.get('/api/v1/mind/structure', (c) => {
  return c.json(getMindStructure())
})

app.get('/api/v1/mind/files', (c) => {
  return c.json(listAllFiles())
})

app.get('/api/v1/mind/explore/:path{.*}', (c) => {
  const path = c.req.param('path') || ''
  return c.json(exploreDirectory(path))
})

// Embeddings API
app.get('/api/v1/mind/embeddings/status', async (c) => {
  const stats = getEmbeddingStats()
  const providers = await testProviders()
  return c.json({ ...stats, providers })
})

app.post('/api/v1/mind/embeddings/build', async (c) => {
  try {
    await buildAndCacheEmbeddings()
    return c.json({ success: true, stats: getEmbeddingStats() })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    return c.json({ success: false, error: errorMessage }, 500)
  }
})

app.get('/api/v1/mind/semantic-search', async (c) => {
  const query = c.req.query('q')
  const topK = parseInt(c.req.query('limit') || '5')
  
  if (!query) return c.json({ error: 'Missing query' }, 400)
  
  try {
    const results = await semanticSearch(query, topK)
    return c.json({ query, results, count: results.length })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    return c.json({ error: errorMessage }, 500)
  }
})

// Knowledge Base API
app.get('/api/v1/mind/knowledge/stats', (c) => {
  return c.json(getKnowledgeStats())
})

app.get('/api/v1/mind/knowledge/search', (c) => {
  const query = c.req.query('q')
  const limit = parseInt(c.req.query('limit') || '10')
  
  if (!query) return c.json({ error: 'Missing query' }, 400)
  
  const results = searchKnowledgeBase(query, limit)
  return c.json({ 
    query, 
    count: results.length,
    results: results.map(e => ({
      path: e.path,
      title: e.title,
      type: e.type,
      summary: e.summary,
      keyPoints: e.keyPoints.slice(0, 5),
      tags: e.tags
    }))
  })
})

app.get('/api/v1/mind/knowledge/entry/:path{.+}', (c) => {
  const path = c.req.param('path')
  const entry = getKnowledgeEntry(path)
  
  if (!entry) {
    return c.json({ error: 'Entry not found' }, 404)
  }
  
  return c.json({
    path: entry.path,
    title: entry.title,
    type: entry.type,
    summary: entry.summary,
    keyPoints: entry.keyPoints,
    tags: entry.tags,
    wordCount: entry.wordCount,
    relatedFiles: entry.relatedFiles,
    fullContentPreview: entry.fullContent.slice(0, 5000)
  })
})

app.get('/api/v1/mind/knowledge/by-type/:type', (c) => {
  const type = c.req.param('type') as any
  const validTypes = ['research', 'design', 'decision', 'session', 'learning', 'goal', 'identity', 'skill', 'knowledge']
  
  if (!validTypes.includes(type)) {
    return c.json({ error: 'Invalid type', validTypes }, 400)
  }
  
  const entries = getEntriesByType(type)
  return c.json({
    type,
    count: entries.length,
    entries: entries.map(e => ({
      path: e.path,
      title: e.title,
      summary: e.summary.slice(0, 200),
      keyPointsCount: e.keyPoints.length
    }))
  })
})

// File Catalog API - Lightweight file index
app.get('/api/v1/mind/catalog', (c) => {
  return c.json(getFileCatalog())
})

app.get('/api/v1/mind/catalog/search', (c) => {
  const query = c.req.query('q')
  const limit = parseInt(c.req.query('limit') || '10')
  
  if (!query) return c.json({ error: 'Missing query' }, 400)
  
  const results = searchCatalog(query, limit)
  return c.json({
    query,
    count: results.length,
    results
  })
})

app.get('/api/v1/mind/catalog/stats', (c) => {
  return c.json(getCatalogStats())
})

// DISSONANCE API - Read specific dissonance entries
app.get('/api/v1/mind/dissonance/:id?', (c) => {
  const id = c.req.param('id')
  const dissonancePath = join(MIND_DIR, 'DISSONANCE.md')
  
  if (!existsSync(dissonancePath)) {
    return c.json({ error: 'DISSONANCE.md not found' }, 404)
  }
  
  const content = readFileSync(dissonancePath, 'utf-8')
  
  // If no ID specified, return all dissonance entries
  if (!id) {
    // Extract all D-XXX entries
    const entries: { id: string; title: string; source: string; content: string; status: string }[] = []
    const regex = /### (D-\d+):\s+(.+)\n- \*\*Source\*\*:\s+(.+)\n- \*\*Content\*\*:\s+"(.+)"\n- \*\*Found\*\*:\s+(.+)\n- \*\*Status\*\*:\s+(.+)/g
    
    let match
    while ((match = regex.exec(content)) !== null) {
      entries.push({
        id: match[1],
        title: match[2].trim(),
        source: match[3].trim(),
        content: match[4].slice(0, 200),
        status: match[6].trim()
      })
    }
    
    return c.json({ 
      count: entries.length,
      entries: entries
    })
  }
  
  // Return specific dissonance entry
  const entryRegex = new RegExp(`### ${id}:\\s+(.+)\\n- \\*\\*Source\\*\\*:\\s+(.+)\\n- \\*\\*Content\\*\\*:\\s+"(.+)"\\n- \\*\\*Found\\*\\*:\\s+(.+)\\n- \\*\\*Status\\*\\*:\\s+(.+?)(?=\\n###|\\n##|$)`, 's')
  const match = content.match(entryRegex)
  
  if (!match) {
    return c.json({ error: `Dissonance ${id} not found` }, 404)
  }
  
  return c.json({
    id,
    title: match[1].trim(),
    source: match[2].trim(),
    content: match[3],
    found: match[4].trim(),
    status: match[5].trim()
  })
})

// Get real activity from mind files
app.get('/api/v1/mind/activity', (c) => {
  const activity: {
    id: string
    type: 'change' | 'session' | 'decision' | 'learning' | 'workflow'
    title: string
    description: string
    timestamp: string
  }[] = []
  
  // Get recent sessions
  const sessionsDir = join(MIND_DIR, 'memory', 'sessions')
  try {
    const files = readdirSync(sessionsDir)
      .filter(f => f.endsWith('.md') && !f.includes('index'))
      .sort()
      .reverse()
      .slice(0, 5)
    
    for (const file of files) {
      const content = readFileSync(join(sessionsDir, file), 'utf-8')
      const titleMatch = content.match(/^# 📝 Session: (.+)$/m)
      const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/)
      
      if (titleMatch) {
        activity.push({
          id: file.replace('.md', ''),
          type: 'session',
          title: titleMatch[1],
          description: content.slice(0, 200).replace(/\n/g, ' '),
          timestamp: dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString()
        })
      }
    }
  } catch (e) {
    // No sessions yet
  }
  
  // Get recent learnings from feedback
  const feedbackPath = join(MIND_DIR, 'symbiosis', 'feedback.md')
  if (existsSync(feedbackPath)) {
    const feedback = readFileSync(feedbackPath, 'utf-8')
    const learnings = feedback.match(/\[(\d{4}-\d{2}-\d{2})\]\s+\*\*([^*]+)\*\*/g)
    if (learnings) {
      const recent = learnings.slice(-5).reverse()
      recent.forEach((learning, index) => {
        const match = learning.match(/\[(\d{4}-\d{2}-\d{2})\]\s+\*\*([^*]+)\*\*/)
        if (match) {
          activity.push({
            id: `learning-${match[1]}-${index}`,
            type: 'learning',
            title: match[2],
            description: 'Documented in feedback',
            timestamp: new Date(match[1]).toISOString()
          })
        }
      })
    }
  }
  
  // Get mind structure changes from mind-map
  const map = getCachedMindMap()
  if (map.nodes.size > 0) {
    activity.push({
      id: 'mind-structure',
      type: 'change',
      title: 'Mind Structure',
      description: `Mind contains ${map.nodes.size} files across ${map.directories.length} directories`,
      timestamp: new Date().toISOString()
    })
  }
  
  // Get current focus from mind state
  const mindState = getCompactMindState()
  if (mindState.currentFocus) {
    activity.unshift({
      id: 'current-focus',
      type: 'workflow',
      title: 'Current Focus',
      description: mindState.currentFocus,
      timestamp: new Date().toISOString()
    })
  }
  
  return c.json({
    activity: activity.slice(0, 10),
    mindState: {
      totalFiles: map.nodes.size,
      totalDirectories: map.directories.length,
      currentFocus: mindState.currentFocus,
      topTasks: mindState.topTasks.length
    }
  })
})

// Backward compatibility - redirect brain/activity to mind/activity
app.get('/api/v1/brain/activity', (c) => {
  return c.redirect('/api/v1/mind/activity')
})

// ============================================
// Error Handling
// ============================================

app.onError((err, c) => {
  log(`ERROR: ${err.message}`)
  return c.json({ success: false, error: { message: err.message } }, 500)
})

app.notFound((c) => {
  return c.json({ success: false, error: { code: 'NOT_FOUND' } }, 404)
})

// ============================================
// Server
// ============================================

const PORT = Number(process.env.PORT) || 6129

serve({
  fetch: app.fetch,
  port: PORT
}, (info) => {
  console.log('')
  console.log(' 🚀 bizing API http://localhost:' + info.port)
  console.log('')
})
