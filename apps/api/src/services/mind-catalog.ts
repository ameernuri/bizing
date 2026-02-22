import { readFileSync, existsSync, mkdirSync, statSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { getCachedMindMap } from './mind-map.js'

const MIND_DIR = join(process.cwd(), '..', '..', 'mind')
const CACHE_DIR = join(process.cwd(), '..', '..', '.cache')

interface FileCatalogEntry {
  path: string
  title: string
  snippet: string
  wordCount: number
  lastModified: number
}

interface FileCatalog {
  generatedAt: string
  totalFiles: number
  entries: FileCatalogEntry[]
}

let catalog: FileCatalog | null = null
let lastCatalogBuild = 0
const CATALOG_REBUILD_INTERVAL = 5 * 60 * 1000 // 5 minutes

// Get file modification time
function getFileMtime(path: string): number {
  try {
    const fullPath = join(MIND_DIR, path + '.md')
    return statSync(fullPath).mtimeMs
  } catch {
    return 0
  }
}

// Extract title from content (first # line or filename)
function extractTitle(content: string, filename: string): string {
  const match = content.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : filename
}

// Extract snippet (first 200 chars of content, no frontmatter)
function extractSnippet(content: string): string {
  // Remove frontmatter
  const noFrontmatter = content.replace(/^---[\s\S]*?---/, '').trim()
  // Get first 200 chars, clean up
  return noFrontmatter.slice(0, 200).replace(/\n/g, ' ').trim() + '...'
}

// Build lightweight file catalog
export function buildFileCatalog(): FileCatalog {
  console.log('[catalog] Building file catalog...')
  
  const map = getCachedMindMap()
  const entries: FileCatalogEntry[] = []
  
  for (const [path, node] of map.nodes) {
    const fullPath = join(MIND_DIR, path + '.md')
    try {
      const mtime = getFileMtime(path)
      const content = readFileSync(fullPath, 'utf-8')
      const wordCount = content.split(/\s+/).length
      
      entries.push({
        path,
        title: extractTitle(content, node.title),
        snippet: extractSnippet(content),
        wordCount,
        lastModified: mtime
      })
    } catch (err) {
      console.log(`[catalog] Could not read ${path}: ${err}`)
    }
  }
  
  catalog = {
    generatedAt: new Date().toISOString(),
    totalFiles: entries.length,
    entries
  }
  
  lastCatalogBuild = Date.now()
  console.log(`[catalog] ✅ Built catalog with ${entries.length} files`)
  
  return catalog
}

// Get or build catalog
export function getFileCatalog(): FileCatalog {
  const now = Date.now()
  
  if (!catalog || (now - lastCatalogBuild > CATALOG_REBUILD_INTERVAL)) {
    return buildFileCatalog()
  }
  
  return catalog
}

// Search catalog by keyword (simple substring match)
export function searchCatalog(query: string, limit: number = 10): FileCatalogEntry[] {
  const cat = getFileCatalog()
  const lowerQuery = query.toLowerCase()
  
  return cat.entries
    .filter(entry => 
      entry.path.toLowerCase().includes(lowerQuery) ||
      entry.title.toLowerCase().includes(lowerQuery) ||
      entry.snippet.toLowerCase().includes(lowerQuery)
    )
    .slice(0, limit)
}

// Get catalog stats
export function getCatalogStats(): {
  ready: boolean
  totalFiles: number
  generatedAt: string | null
} {
  const cat = getFileCatalog()
  return {
    ready: true,
    totalFiles: cat.totalFiles,
    generatedAt: cat.generatedAt
  }
}