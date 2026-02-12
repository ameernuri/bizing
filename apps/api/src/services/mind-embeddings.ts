import { readFileSync, existsSync, mkdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { getCachedMindMap } from './mind-map.js'

const MIND_DIR = join(process.cwd(), '..', '..', 'mind')
const CACHE_DIR = join(process.cwd(), '..', '..', '.cache')

// Ensure cache dir exists
if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true })
}

interface MindChunk {
  id: string
  path: string
  title: string
  content: string
  embedding?: number[]
  lastModified?: number
}

interface SearchResult {
  path: string
  title: string
  content: string
  similarity: number
}

// Simple in-memory store
let chunkStore: MindChunk[] = []
let embeddingsReady = false
let lastBuildTime = 0
const REBUILD_INTERVAL = 60 * 60 * 1000 // 1 hour
let rebuildTimer: NodeJS.Timeout | null = null

// Track file modification times
function getFileMtime(path: string): number {
  try {
    const fullPath = join(MIND_DIR, path + '.md')
    return statSync(fullPath).mtimeMs
  } catch {
    return 0
  }
}

// Check if any files have changed
export function haveFilesChanged(): boolean {
  if (chunkStore.length === 0) return true

  for (const chunk of chunkStore) {
    const currentMtime = getFileMtime(chunk.path)
    if (currentMtime > (chunk.lastModified || 0)) {
      return true
    }
  }
  return false
}

// Chunk a file by headers
function chunkFile(filePath: string, content: string, mtime: number): MindChunk[] {
  const chunks: MindChunk[] = []
  const lines = content.split('\n')
  let currentChunk: { title: string; content: string[] } | null = null
  let fileTitle = 'Untitled'

  const titleMatch = content.match(/^#\s+(.+)$/m)
  if (titleMatch) fileTitle = titleMatch[1].trim()

  for (const line of lines) {
    if (line.match(/^#{2,3}\s+/)) {
      if (currentChunk && currentChunk.content.length > 0) {
        chunks.push({
          id: `${filePath}#${chunks.length}`,
          path: filePath,
          title: currentChunk.title,
          content: currentChunk.content.join('\n').trim(),
          lastModified: mtime
        })
      }
      currentChunk = {
        title: line.replace(/^#+\s+/, '').trim(),
        content: [line]
      }
    } else if (currentChunk) {
      currentChunk.content.push(line)
    }
  }

  if (currentChunk && currentChunk.content.length > 0) {
    chunks.push({
      id: `${filePath}#${chunks.length}`,
      path: filePath,
      title: currentChunk.title,
      content: currentChunk.content.join('\n').trim(),
      lastModified: mtime
    })
  }

  if (chunks.length === 0) {
    chunks.push({
      id: `${filePath}#0`,
      path: filePath,
      title: fileTitle,
      content: content.slice(0, 8000),
      lastModified: mtime
    })
  }

  return chunks
}

// Build chunks from all mind files
export function buildChunks(): MindChunk[] {
  const map = getCachedMindMap()
  const chunks: MindChunk[] = []

  for (const [path, node] of map.nodes) {
    const fullPath = join(MIND_DIR, path + '.md')
    try {
      const mtime = getFileMtime(path)
      const content = readFileSync(fullPath, 'utf-8')
      const fileChunks = chunkFile(path, content, mtime)
      chunks.push(...fileChunks)
    } catch (err) {
      console.log(`[embeddings] Could not read ${path}: ${err}`)
    }
  }

  return chunks
}

// Generate embeddings via OpenAI
export async function generateEmbeddings(chunks: MindChunk[]): Promise<MindChunk[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set')
  }

  const model = 'text-embedding-3-small'
  const batchSize = 100 // OpenAI allows up to 2048, but let's be safe

  console.log(`[embeddings] Generating embeddings for ${chunks.length} chunks...`)

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input: batch.map(c => c.content.slice(0, 8000)) // Max 8K tokens per chunk
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI embeddings error: ${error}`)
    }

    const data = await response.json() as {
      data: { embedding: number[]; index: number }[]
    }

    // Attach embeddings to chunks
    for (const item of data.data) {
      batch[item.index].embedding = item.embedding
    }

    console.log(`[embeddings] Processed ${Math.min(i + batchSize, chunks.length)}/${chunks.length}`)
  }

  return chunks
}

// Cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Semantic search with auto-rebuild if stale
export async function semanticSearch(query: string, topK: number = 5): Promise<SearchResult[]> {
  // Check if we need to rebuild
  const now = Date.now()
  const needsRebuild = !embeddingsReady ||
                       chunkStore.length === 0 ||
                       (now - lastBuildTime > REBUILD_INTERVAL) ||
                       haveFilesChanged()

  if (needsRebuild) {
    console.log('[embeddings] Data stale or missing, rebuilding...')
    await buildAndCacheEmbeddings()
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set')
  }

  // Generate query embedding
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: query
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI embeddings error: ${error}`)
  }

  const data = await response.json() as {
    data: { embedding: number[] }[]
  }

  const queryEmbedding = data.data[0].embedding

  // Find most similar chunks
  const scored = chunkStore
    .filter(chunk => chunk.embedding)
    .map(chunk => ({
      path: chunk.path,
      title: chunk.title,
      content: chunk.content.slice(0, 500) + (chunk.content.length > 500 ? '...' : ''),
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding!)
    }))
    .sort((a, b) => b.similarity - a.similarity)

  return scored.slice(0, topK)
}

// Build and cache embeddings
export async function buildAndCacheEmbeddings(): Promise<void> {
  const chunks = buildChunks()
  console.log(`[embeddings] Built ${chunks.length} chunks`)

  const withEmbeddings = await generateEmbeddings(chunks)
  chunkStore = withEmbeddings
  embeddingsReady = true
  lastBuildTime = Date.now()

  console.log(`[embeddings] Ready! ${chunkStore.length} chunks with embeddings`)
}

// Check if ready
export function isEmbeddingsReady(): boolean {
  return embeddingsReady
}

// Get stats
export function getEmbeddingStats(): {
  ready: boolean
  chunkCount: number
  filesCovered: number
  lastBuild: string | null
  stale: boolean
} {
  const files = new Set(chunkStore.map(c => c.path))
  const now = Date.now()
  const isStale = !embeddingsReady ||
                  (now - lastBuildTime > REBUILD_INTERVAL) ||
                  haveFilesChanged()

  return {
    ready: embeddingsReady,
    chunkCount: chunkStore.length,
    filesCovered: files.size,
    lastBuild: lastBuildTime ? new Date(lastBuildTime).toISOString() : null,
    stale: isStale
  }
}
