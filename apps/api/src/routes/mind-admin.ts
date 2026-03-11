/**
 * Mind admin routes.
 *
 * ELI5:
 * This is a privileged inspection surface for platform operators. Keeping it
 * modular avoids mixing app-runtime endpoints with mind-internal tooling.
 */

import { Hono } from 'hono'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { requireAuth, requirePlatformAdmin } from '../middleware/auth.js'
import { getCompactMindState, getMindFile } from '../services/mind-api.js'
import { exploreDirectory, getCachedMindMap, getMindStructure, listAllFiles, searchMindDynamic } from '../services/mind-map.js'
import { buildAndCacheEmbeddings, getEmbeddingStats, semanticSearch, testProviders } from '../services/mind-embeddings.js'
import { getEntriesByType, getKnowledgeEntry, getKnowledgeStats, searchKnowledgeBase } from '../services/mind-knowledge.js'
import { getCatalogStats, getFileCatalog, searchCatalog } from '../services/mind-catalog.js'

const MIND_DIR = join(process.cwd(), '..', '..', 'mind')

export const mindAdminRoutes = new Hono()

mindAdminRoutes.get('/mind/state', requireAuth, requirePlatformAdmin, (c) => {
  return c.json(getCompactMindState())
})

mindAdminRoutes.get('/mind/file/:path{.+}', requireAuth, requirePlatformAdmin, (c) => {
  const filePath = c.req.param('path')
  return c.json(getMindFile(filePath))
})

mindAdminRoutes.get('/mind/map', requireAuth, requirePlatformAdmin, (c) => {
  const map = getCachedMindMap()
  return c.json({
    entryPoint: map.entryPoint,
    totalFiles: map.nodes.size,
    directories: map.directories,
    files: Array.from(map.nodes.entries()).map(([filePath, node]) => ({
      path: filePath,
      title: node.title,
      type: node.type,
      links: node.links.length,
      backLinks: node.backLinks.length,
    })),
  })
})

mindAdminRoutes.get('/mind/search', requireAuth, requirePlatformAdmin, (c) => {
  const query = c.req.query('q')
  if (!query) return c.json({ error: 'Missing query' }, 400)
  return c.json(searchMindDynamic(query))
})

mindAdminRoutes.get('/mind/structure', requireAuth, requirePlatformAdmin, (c) => {
  return c.json(getMindStructure())
})

mindAdminRoutes.get('/mind/files', requireAuth, requirePlatformAdmin, (c) => {
  return c.json(listAllFiles())
})

mindAdminRoutes.get('/mind/explore/:path{.*}', requireAuth, requirePlatformAdmin, (c) => {
  const targetPath = c.req.param('path') || ''
  return c.json(exploreDirectory(targetPath))
})

mindAdminRoutes.get('/mind/embeddings/status', requireAuth, requirePlatformAdmin, async (c) => {
  const stats = getEmbeddingStats()
  const providers = await testProviders()
  return c.json({ ...stats, providers })
})

mindAdminRoutes.post('/mind/embeddings/build', requireAuth, requirePlatformAdmin, async (c) => {
  try {
    await buildAndCacheEmbeddings()
    return c.json({ success: true, stats: getEmbeddingStats() })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return c.json({ success: false, error: errorMessage }, 500)
  }
})

mindAdminRoutes.get('/mind/semantic-search', requireAuth, requirePlatformAdmin, async (c) => {
  const query = c.req.query('q')
  const topK = Number.parseInt(c.req.query('limit') || '5', 10)
  if (!query) return c.json({ error: 'Missing query' }, 400)

  try {
    const results = await semanticSearch(query, topK)
    return c.json({ query, results, count: results.length })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return c.json({ error: errorMessage }, 500)
  }
})

mindAdminRoutes.get('/mind/knowledge/stats', requireAuth, requirePlatformAdmin, (c) => {
  return c.json(getKnowledgeStats())
})

mindAdminRoutes.get('/mind/knowledge/search', requireAuth, requirePlatformAdmin, (c) => {
  const query = c.req.query('q')
  const limit = Number.parseInt(c.req.query('limit') || '10', 10)
  if (!query) return c.json({ error: 'Missing query' }, 400)

  const results = searchKnowledgeBase(query, limit)
  return c.json({
    query,
    count: results.length,
    results: results.map((entry) => ({
      path: entry.path,
      title: entry.title,
      type: entry.type,
      summary: entry.summary,
      keyPoints: entry.keyPoints.slice(0, 5),
      tags: entry.tags,
    })),
  })
})

mindAdminRoutes.get('/mind/knowledge/entry/:path{.+}', requireAuth, requirePlatformAdmin, (c) => {
  const filePath = c.req.param('path')
  const entry = getKnowledgeEntry(filePath)
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
    fullContentPreview: entry.fullContent.slice(0, 5000),
  })
})

mindAdminRoutes.get('/mind/knowledge/by-type/:type', requireAuth, requirePlatformAdmin, (c) => {
  const type = c.req.param('type') as
    | 'research'
    | 'design'
    | 'decision'
    | 'session'
    | 'learning'
    | 'goal'
    | 'identity'
    | 'skill'
    | 'knowledge'
  const validTypes = ['research', 'design', 'decision', 'session', 'learning', 'goal', 'identity', 'skill', 'knowledge']

  if (!validTypes.includes(type)) {
    return c.json({ error: 'Invalid type', validTypes }, 400)
  }

  const entries = getEntriesByType(type)
  return c.json({
    type,
    count: entries.length,
    entries: entries.map((entry) => ({
      path: entry.path,
      title: entry.title,
      summary: entry.summary.slice(0, 200),
      keyPointsCount: entry.keyPoints.length,
    })),
  })
})

mindAdminRoutes.get('/mind/catalog', requireAuth, requirePlatformAdmin, (c) => {
  return c.json(getFileCatalog())
})

mindAdminRoutes.get('/mind/catalog/search', requireAuth, requirePlatformAdmin, (c) => {
  const query = c.req.query('q')
  const limit = Number.parseInt(c.req.query('limit') || '10', 10)
  if (!query) return c.json({ error: 'Missing query' }, 400)

  const results = searchCatalog(query, limit)
  return c.json({
    query,
    count: results.length,
    results,
  })
})

mindAdminRoutes.get('/mind/catalog/stats', requireAuth, requirePlatformAdmin, (c) => {
  return c.json(getCatalogStats())
})

mindAdminRoutes.get('/mind/dissonance/:id?', requireAuth, requirePlatformAdmin, (c) => {
  const id = c.req.param('id')
  const dissonancePath = join(MIND_DIR, 'DISSONANCE.md')
  if (!existsSync(dissonancePath)) {
    return c.json({ error: 'DISSONANCE.md not found' }, 404)
  }

  const content = readFileSync(dissonancePath, 'utf-8')
  if (!id) {
    const entries: { id: string; title: string; source: string; content: string; status: string }[] = []
    const regex =
      /### (D-\d+):\s+(.+)\n- \*\*Source\*\*:\s+(.+)\n- \*\*Content\*\*:\s+"(.+)"\n- \*\*Found\*\*:\s+(.+)\n- \*\*Status\*\*:\s+(.+)/g

    let match
    while ((match = regex.exec(content)) !== null) {
      entries.push({
        id: match[1],
        title: match[2].trim(),
        source: match[3].trim(),
        content: match[4].slice(0, 200),
        status: match[6].trim(),
      })
    }

    return c.json({
      count: entries.length,
      entries,
    })
  }

  const entryRegex = new RegExp(
    `### ${id}:\\s+(.+)\\n- \\*\\*Source\\*\\*:\\s+(.+)\\n- \\*\\*Content\\*\\*:\\s+"(.+)"\\n- \\*\\*Found\\*\\*:\\s+(.+)\\n- \\*\\*Status\\*\\*:\\s+(.+?)(?=\\n###|\\n##|$)`,
    's',
  )
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
    status: match[5].trim(),
  })
})

mindAdminRoutes.get('/mind/activity', requireAuth, requirePlatformAdmin, (c) => {
  const activity: {
    id: string
    type: 'change' | 'session' | 'decision' | 'learning' | 'workflow'
    title: string
    description: string
    timestamp: string
  }[] = []

  const sessionsDir = join(MIND_DIR, 'memory', 'sessions')
  try {
    const files = readdirSync(sessionsDir)
      .filter((file) => file.endsWith('.md') && !file.includes('index'))
      .sort()
      .reverse()
      .slice(0, 5)

    for (const file of files) {
      const content = readFileSync(join(sessionsDir, file), 'utf-8')
      const titleMatch = content.match(/^# 📝 Session: (.+)$/m)
      const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/)
      if (!titleMatch) continue
      activity.push({
        id: file.replace('.md', ''),
        type: 'session',
        title: titleMatch[1],
        description: content.slice(0, 200).replace(/\n/g, ' '),
        timestamp: dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString(),
      })
    }
  } catch {
    // No session files in legacy location.
  }

  const feedbackPath = join(MIND_DIR, 'symbiosis', 'feedback.md')
  if (existsSync(feedbackPath)) {
    const feedback = readFileSync(feedbackPath, 'utf-8')
    const learnings = feedback.match(/\[(\d{4}-\d{2}-\d{2})\]\s+\*\*([^*]+)\*\*/g)
    if (learnings) {
      const recent = learnings.slice(-5).reverse()
      recent.forEach((learning, index) => {
        const match = learning.match(/\[(\d{4}-\d{2}-\d{2})\]\s+\*\*([^*]+)\*\*/)
        if (!match) return
        activity.push({
          id: `learning-${match[1]}-${index}`,
          type: 'learning',
          title: match[2],
          description: 'Documented in feedback',
          timestamp: new Date(match[1]).toISOString(),
        })
      })
    }
  }

  const map = getCachedMindMap()
  if (map.nodes.size > 0) {
    activity.push({
      id: 'mind-structure',
      type: 'change',
      title: 'Mind Structure',
      description: `Mind contains ${map.nodes.size} files across ${map.directories.length} directories`,
      timestamp: new Date().toISOString(),
    })
  }

  const mindState = getCompactMindState()
  if (mindState.currentFocus) {
    activity.unshift({
      id: 'current-focus',
      type: 'workflow',
      title: 'Current Focus',
      description: mindState.currentFocus,
      timestamp: new Date().toISOString(),
    })
  }

  return c.json({
    activity: activity.slice(0, 10),
    mindState: {
      totalFiles: map.nodes.size,
      totalDirectories: map.directories.length,
      currentFocus: mindState.currentFocus,
      topTasks: mindState.topTasks.length,
    },
  })
})

mindAdminRoutes.get('/brain/activity', requireAuth, requirePlatformAdmin, (c) => {
  return c.redirect('/api/v1/mind/activity')
})

