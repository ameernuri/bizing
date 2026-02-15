import { readFileSync, existsSync, mkdirSync, statSync } from 'fs'
import { join } from 'path'
import { getCachedMindMap } from './mind-map.js'

const MIND_DIR = join(process.cwd(), '..', '..', 'mind')
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'

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

interface EmbeddingProvider {
  name: string
  generate(texts: string[]): Promise<number[][]>
  generateQuery(text: string): Promise<number[]>
  available(): Promise<boolean>
}

// Simple in-memory store
let chunkStore: MindChunk[] = []
let embeddingsReady = false
let lastBuildTime = 0
const REBUILD_INTERVAL = 60 * 60 * 1000 // 1 hour

// Provider configuration
const PRIMARY_PROVIDER = 'nomic' // nomic-embed-text (local)
const FALLBACK_PROVIDER = 'openai' // text-embedding-3-small

// Local Nomic embedding provider
const nomicProvider: EmbeddingProvider = {
  name: 'nomic-embed-text',
  
  async generate(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = []
    
    // Nomic processes one at a time (batch not well supported)
    for (const text of texts) {
      const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'nomic-embed-text',
          prompt: text.slice(0, 2000) // Limit to 2000 chars for safety
        })
      })

      if (!response.ok) {
        throw new Error(`Ollama embeddings error: ${await response.text()}`)
      }

      const data = await response.json() as { embedding: number[] }
      embeddings.push(data.embedding)
    }
    
    return embeddings
  },

  async generateQuery(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'nomic-embed-text',
          prompt: text.slice(0, 2000) // Limit to 2000 chars
        })
      })

      if (!response.ok) {
        throw new Error(`Ollama embeddings error: ${await response.text()}`)
      }

      const data = await response.json() as { embedding: number[] }
      return data.embedding
    } catch (error) {
      console.error('[embeddings] Nomic query failed, using empty embedding:', error)
      return new Array(768).fill(0) // Return zero vector as fallback
    }
  },

  async available(): Promise<boolean> {
    try {
      const response = await fetch(`${OLLAMA_URL}/api/tags`, { 
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      })
      if (!response.ok) return false
      
      const data = await response.json() as { models: { name: string }[] }
      return data.models?.some(m => m.name.includes('nomic-embed-text')) ?? false
    } catch {
      return false
    }
  }
}

// OpenAI embedding provider (fallback)
const openaiProvider: EmbeddingProvider = {
  name: 'text-embedding-3-small',
  
  async generate(texts: string[]): Promise<number[][]> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not set')
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: texts.map(t => t.slice(0, 8000))
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI embeddings error: ${await response.text()}`)
    }

    const data = await response.json() as {
      data: { embedding: number[]; index: number }[]
    }
    
    // Sort by index to maintain order
    return data.data.sort((a, b) => a.index - b.index).map(d => d.embedding)
  },

  async generateQuery(text: string): Promise<number[]> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not set')
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI embeddings error: ${await response.text()}`)
    }

    const data = await response.json() as { data: { embedding: number[] }[] }
    return data.data[0].embedding
  },

  async available(): Promise<boolean> {
    return !!process.env.OPENAI_API_KEY
  }
}

// Provider registry
const providers: Record<string, EmbeddingProvider> = {
  nomic: nomicProvider,
  openai: openaiProvider
}

// Get active provider with fallback
async function getProvider(): Promise<EmbeddingProvider> {
  // Try primary first
  const primary = providers[PRIMARY_PROVIDER]
  if (await primary.available()) {
    return primary
  }

  // Fall back to OpenAI
  console.log(`[embeddings] ${PRIMARY_PROVIDER} unavailable, falling back to ${FALLBACK_PROVIDER}`)
  const fallback = providers[FALLBACK_PROVIDER]
  if (await fallback.available()) {
    return fallback
  }

  throw new Error('No embedding provider available. Check Ollama is running or OPENAI_API_KEY is set.')
}

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

// Chunk a file by headers with size limit
function chunkFile(filePath: string, content: string, mtime: number): MindChunk[] {
  const chunks: MindChunk[] = []
  const MAX_CHUNK_SIZE = 1500 // Safe limit for embeddings
  
  const lines = content.split('\n')
  let currentChunk: { title: string; content: string[] } | null = null
  let fileTitle = 'Untitled'

  const titleMatch = content.match(/^#\s+(.+)$/m)
  if (titleMatch) fileTitle = titleMatch[1].trim()

  for (const line of lines) {
    const lineLength = line.length
    const currentLength = currentChunk?.content.join('\n').length || 0
    
    // Start new chunk on header or if current chunk is too large
    if (line.match(/^#{2,3}\s+/) && currentChunk && currentChunk.content.length > 0) {
      if (currentLength > MAX_CHUNK_SIZE) {
        // Split current chunk
        const contentStr = currentChunk.content.join('\n')
        const splitPoint = contentStr.lastIndexOf('\n\n', MAX_CHUNK_SIZE)
        const split = splitPoint > 0 ? splitPoint : contentStr.lastIndexOf('.', MAX_CHUNK_SIZE)
        
        if (split > 500) {
          chunks.push({
            id: `${filePath}#${chunks.length}`,
            path: filePath,
            title: `${currentChunk.title} (1/2)`,
            content: contentStr.slice(0, split).trim(),
            lastModified: mtime
          })
          currentChunk.content = [contentStr.slice(split).trim()]
        } else {
          chunks.push({
            id: `${filePath}#${chunks.length}`,
            path: filePath,
            title: currentChunk.title,
            content: currentLength > 0 ? currentChunk.content.join('\n').trim() : '',
            lastModified: mtime
          })
          currentChunk = null
        }
      } else {
        chunks.push({
          id: `${filePath}#${chunks.length}`,
          path: filePath,
          title: currentChunk.title,
          content: currentChunk.content.join('\n').trim(),
          lastModified: mtime
        })
        currentChunk = null
      }
    }
    
    if (line.match(/^#{2,3}\s+/)) {
      currentChunk = {
        title: line.replace(/^#+\s+/, '').trim(),
        content: [line]
      }
    } else if (currentChunk) {
      currentChunk.content.push(line)
    }
  }

  // Handle last chunk
  if (currentChunk && currentChunk.content.length > 0) {
    const contentStr = currentChunk.content.join('\n').trim()
    if (contentStr.length > MAX_CHUNK_SIZE) {
      // Split large final chunk
      for (let i = 0; i < contentStr.length; i += MAX_CHUNK_SIZE) {
        chunks.push({
          id: `${filePath}#${chunks.length}`,
          path: filePath,
          title: `${currentChunk.title} (${Math.floor(i / MAX_CHUNK_SIZE) + 1})`,
          content: contentStr.slice(i, i + MAX_CHUNK_SIZE).trim(),
          lastModified: mtime
        })
      }
    } else {
      chunks.push({
        id: `${filePath}#${chunks.length}`,
        path: filePath,
        title: currentChunk.title,
        content: contentStr,
        lastModified: mtime
      })
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

// Generate embeddings with provider selection
export async function generateEmbeddings(chunks: MindChunk[]): Promise<MindChunk[]> {
  const provider = await getProvider()
  console.log(`[embeddings] Using provider: ${provider.name}`)
  console.log(`[embeddings] Generating embeddings for ${chunks.length} chunks...`)

  // Process in batches for efficiency
  const batchSize = provider.name === 'nomic-embed-text' ? 1 : 100
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)
    
    try {
      const embeddings = await provider.generate(batch.map(c => c.content))
      
      for (let j = 0; j < batch.length; j++) {
        batch[j].embedding = embeddings[j]
      }
      
      console.log(`[embeddings] Processed ${Math.min(i + batchSize, chunks.length)}/${chunks.length}`)
    } catch (err) {
      console.error(`[embeddings] Batch failed at ${i}: ${err}`)
      
      // If local fails mid-process, try falling back to OpenAI for remaining
      if (provider.name !== 'text-embedding-3-small') {
        console.log('[embeddings] Falling back to OpenAI for remaining chunks...')
        const openai = openaiProvider
        
        for (let k = 0; k < chunks.length; k++) {
          if (chunks[k].embedding) continue // Already embedded
          
          try {
            const embedding = await openai.generateQuery(chunks[k].content.slice(0, 2000))
            chunks[k].embedding = embedding
            console.log(`[embeddings] Fallback processed ${k + 1}/${chunks.length}`)
          } catch (fallbackErr) {
            console.error(`[embeddings] Fallback failed for chunk ${k}, continuing...`)
            // Continue without embedding for this chunk
          }
        }
      }
      break
    }
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

  const provider = await getProvider()
  const queryEmbedding = await provider.generateQuery(query)

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
  try {
    const chunks = buildChunks()
    console.log(`[embeddings] Built ${chunks.length} chunks from mind files`)

    const provider = await getProvider()
    console.log(`[embeddings] Active provider: ${provider.name}`)

    const withEmbeddings = await generateEmbeddings(chunks)
    chunkStore = withEmbeddings
    embeddingsReady = true
    lastBuildTime = Date.now()

    console.log(`[embeddings] ✅ Ready! ${chunkStore.length} chunks embedded`)
  } catch (error) {
    console.error('[embeddings] ❌ Build failed, continuing without embeddings:', error)
    // Don't crash - continue without embeddings
    embeddingsReady = false
  }
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
  provider: string | null
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
    stale: isStale,
    provider: embeddingsReady ? (chunkStore[0]?.embedding ? 'active' : null) : null
  }
}

// Force provider test
export async function testProviders(): Promise<{
  nomic: boolean
  openai: boolean
  active: string | null
}> {
  const nomicAvailable = await nomicProvider.available()
  const openaiAvailable = await openaiProvider.available()
  
  let active: string | null = null
  if (nomicAvailable) active = 'nomic'
  else if (openaiAvailable) active = 'openai'

  return {
    nomic: nomicAvailable,
    openai: openaiAvailable,
    active
  }
}