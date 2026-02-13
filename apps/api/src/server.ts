import 'dotenv/config'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { v4 as uuidv4 } from 'uuid'
import { OpenAPIHono, z } from '@hono/zod-openapi'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { chatWithLLM, createBizingSystemPrompt } from './services/llm.js'
import { getCompactMindState, getMindFile } from './services/mind-api.js'
import { getCachedMindMap, searchMindDynamic, getMindStructure, listAllFiles, exploreDirectory } from './services/mind-map.js'
import { semanticSearch, buildAndCacheEmbeddings, getEmbeddingStats, isEmbeddingsReady, testProviders } from './services/mind-embeddings.js'
import { searchKnowledgeBase, getKnowledgeEntry, getEntriesByType, getKnowledgeStats } from './services/mind-knowledge.js'

// ============================================
// Constants
// ============================================

const MIND_DIR = join(process.cwd(), '..', '..', 'mind')

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

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  })
})

// ============================================
// Auth Routes
// ============================================

app.post('/api/v1/auth/register', async (c) => {
  const body = await c.req.json()
  return c.json({
    id: 'org_' + uuidv4().slice(0, 8),
    name: body.name,
    email: body.email,
  }, 201)
})

app.post('/api/v1/auth/login', async (c) => {
  const body = await c.req.json()
  return c.json({
    token: 'jwt_' + uuidv4().slice(0, 16),
    user: {
      id: 'user_' + uuidv4().slice(0, 8),
      email: body.email,
      name: 'Test User',
    },
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

app.get('/api/v1/bookings', (c) => {
  return c.json({
    data: [
      {
        id: 'booking_1',
        serviceName: 'Haircut & Style',
        customerName: 'Sarah Johnson',
        date: '2026-02-12',
        status: 'confirmed',
        price: 65,
      },
      {
        id: 'booking_2',
        serviceName: 'Color Treatment',
        customerName: 'Mike Chen',
        date: '2026-02-12',
        status: 'pending',
        price: 120,
      },
      {
        id: 'booking_3',
        serviceName: 'Beard Trim',
        customerName: 'Alex Rivera',
        date: '2026-02-11',
        status: 'completed',
        price: 25,
      },
      {
        id: 'booking_4',
        serviceName: 'Full Service',
        customerName: 'Emma Davis',
        date: '2026-02-13',
        status: 'confirmed',
        price: 150,
      },
      {
        id: 'booking_5',
        serviceName: 'Consultation',
        customerName: 'James Wilson',
        date: '2026-02-10',
        status: 'cancelled',
        price: 0,
      },
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 5,
    },
  })
})

// ============================================
// Schema Routes
// ============================================

app.get('/api/v1/schema/graph', (c) => {
  return c.json({
    entities: [
      {
        name: 'Booking',
        tableName: 'bookings',
        columns: [
          { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
          { name: 'customerId', type: 'uuid', nullable: false, primaryKey: false },
          { name: 'serviceId', type: 'uuid', nullable: false, primaryKey: false },
          { name: 'date', type: 'timestamp', nullable: false, primaryKey: false },
          { name: 'status', type: 'enum', nullable: false, primaryKey: false },
          { name: 'price', type: 'decimal', nullable: false, primaryKey: false },
        ],
        relationships: [
          { type: 'N:1', to: 'Customer', field: 'customerId', description: 'Booking belongs to customer' },
          { type: 'N:1', to: 'Service', field: 'serviceId', description: 'Booking is for a service' },
        ],
      },
      {
        name: 'Customer',
        tableName: 'customers',
        columns: [
          { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
          { name: 'name', type: 'varchar', nullable: false, primaryKey: false },
          { name: 'email', type: 'varchar', nullable: false, primaryKey: false },
          { name: 'phone', type: 'varchar', nullable: true, primaryKey: false },
        ],
        relationships: [
          { type: '1:N', to: 'Booking', field: 'customerId', description: 'Customer has many bookings' },
        ],
      },
      {
        name: 'Service',
        tableName: 'services',
        columns: [
          { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
          { name: 'name', type: 'varchar', nullable: false, primaryKey: false },
          { name: 'description', type: 'text', nullable: true, primaryKey: false },
          { name: 'price', type: 'decimal', nullable: false, primaryKey: false },
          { name: 'duration', type: 'integer', nullable: false, primaryKey: false },
        ],
        relationships: [
          { type: '1:N', to: 'Booking', field: 'serviceId', description: 'Service has many bookings' },
        ],
      },
    ],
    nodes: [
      { 
        id: 'Booking', 
        type: 'entityNode', 
        position: { x: 400, y: 100 }, 
        data: { 
          entity: {
            name: 'Booking',
            tableName: 'bookings',
            columns: [
              { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
              { name: 'customerId', type: 'uuid', nullable: false, primaryKey: false },
              { name: 'serviceId', type: 'uuid', nullable: false, primaryKey: false },
              { name: 'date', type: 'timestamp', nullable: false, primaryKey: false },
              { name: 'status', type: 'enum', nullable: false, primaryKey: false },
              { name: 'price', type: 'decimal', nullable: false, primaryKey: false },
            ],
            relationships: [
              { type: 'N:1', to: 'Customer', field: 'customerId', description: 'Booking belongs to customer' },
              { type: 'N:1', to: 'Service', field: 'serviceId', description: 'Booking is for a service' },
            ],
          }
        } 
      },
      { 
        id: 'Customer', 
        type: 'entityNode', 
        position: { x: 100, y: 100 }, 
        data: { 
          entity: {
            name: 'Customer',
            tableName: 'customers',
            columns: [
              { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
              { name: 'name', type: 'varchar', nullable: false, primaryKey: false },
              { name: 'email', type: 'varchar', nullable: false, primaryKey: false },
              { name: 'phone', type: 'varchar', nullable: true, primaryKey: false },
            ],
            relationships: [
              { type: '1:N', to: 'Booking', field: 'customerId', description: 'Customer has many bookings' },
            ],
          }
        } 
      },
      { 
        id: 'Service', 
        type: 'entityNode', 
        position: { x: 700, y: 100 }, 
        data: { 
          entity: {
            name: 'Service',
            tableName: 'services',
            columns: [
              { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
              { name: 'name', type: 'varchar', nullable: false, primaryKey: false },
              { name: 'description', type: 'text', nullable: true, primaryKey: false },
              { name: 'price', type: 'decimal', nullable: false, primaryKey: false },
              { name: 'duration', type: 'integer', nullable: false, primaryKey: false },
            ],
            relationships: [
              { type: '1:N', to: 'Booking', field: 'serviceId', description: 'Service has many bookings' },
            ],
          }
        } 
      },
    ],
    edges: [
      { id: 'e1', source: 'Booking', sourceHandle: 'source-1', target: 'Customer', targetHandle: 'target-1', label: 'N:1', type: 'smoothstep', animated: true },
      { id: 'e2', source: 'Booking', sourceHandle: 'source-2', target: 'Service', targetHandle: 'target-1', label: 'N:1', type: 'smoothstep', animated: true },
    ],
  })
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
    }, provider) // Pass provider to use specific model

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
      model: provider || process.env.LLM_PROVIDER || 'openai',
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

// Embeddings rebuild on startup (non-blocking)
buildAndCacheEmbeddings().then(() => {
  log('Embeddings built: ' + JSON.stringify(getEmbeddingStats()))
}).catch(err => {
  log('Embeddings build failed (will retry on first search): ' + err.message)
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
  console.log(' 🚀 biz.ing API http://localhost:' + info.port)
  console.log('')
})