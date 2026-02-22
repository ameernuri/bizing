import { readFileSync, readdirSync, statSync } from 'fs'
import { join, dirname, relative } from 'path'

const MIND_DIR = join(process.cwd(), '..', '..', 'mind')

interface MindNode {
  path: string
  title: string
  description?: string
  links: string[]
  backLinks: string[]
  type: 'entry' | 'directory' | 'file'
  size: number
  lastModified?: Date
}

interface MindMap {
  entryPoint: string
  nodes: Map<string, MindNode>
  directories: string[]
  allFiles: string[] // ALL files found, not just linked
}

function readFileSafe(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}

// Extract wiki-style links [[path|title]] or [[path]]
function extractLinks(content: string): string[] {
  const links: string[] = []

  // Wiki links: [[path]] or [[path|title]]
  const wikiLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
  let match
  while ((match = wikiLinkRegex.exec(content)) !== null) {
    links.push(match[1].trim())
  }

  // Markdown links: [title](path)
  const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  while ((match = mdLinkRegex.exec(content)) !== null) {
    const link = match[2].trim()
    if (!link.startsWith('http') && !link.startsWith('#')) {
      links.push(link.replace(/\.md$/, ''))
    }
  }

  return [...new Set(links)]
}

// Extract title from markdown file
function extractTitle(content: string): string {
  const titleMatch = content.match(/^#\s+(.+)$/m)
  return titleMatch ? titleMatch[1].trim() : 'Untitled'
}

// Extract description
function extractDescription(content: string): string | undefined {
  const lines = content.split('\n')
  let foundTitle = false

  for (const line of lines) {
    if (line.startsWith('# ')) {
      foundTitle = true
      continue
    }
    if (foundTitle && line.trim() && !line.startsWith('#')) {
      return line.trim().slice(0, 200)
    }
  }
  return undefined
}

// WALK ENTIRE DIRECTORY TREE - discover ALL files
function walkDirectory(dir: string, files: string[] = [], baseDir: string = MIND_DIR): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    const relativePath = relative(baseDir, fullPath)
    
    if (entry.isDirectory()) {
      // Skip hidden dirs and common non-content dirs
      if (entry.name.startsWith('.') && entry.name !== '.templates') continue
      walkDirectory(fullPath, files, baseDir)
    } else if (entry.name.endsWith('.md')) {
      // Store path without .md extension for consistency
      files.push(relativePath.replace(/\.md$/, ''))
    }
  }
  
  return files
}

// Parse MAP.md to get structured directory of all files
function parseMapFile(): { path: string; title: string; category: string }[] {
  const mapContent = readFileSafe(join(MIND_DIR, 'MAP.md'))
  if (!mapContent) return []
  
  const files: { path: string; title: string; category: string }[] = []
  let currentCategory = 'General'
  
  const lines = mapContent.split('\n')
  
  for (const line of lines) {
    // Track categories from headers
    const headerMatch = line.match(/^##\s+(.+)/)
    if (headerMatch) {
      currentCategory = headerMatch[1].trim()
      continue
    }
    
    // Extract wiki links: [[path|title]] or [[path]]
    const wikiLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
    let match
    while ((match = wikiLinkRegex.exec(line)) !== null) {
      const path = match[1].trim()
      const title = match[2]?.trim() || path.split('/').pop() || path
      
      // Skip self-references and non-content links
      if (path === 'INDEX' || path === 'MAP' || path === 'index' || path === 'map') continue
      
      files.push({ path, title, category: currentCategory })
    }
  }
  
  return files
}

// Build complete mind map - uses MAP.md + directory walking
export function buildCompleteMindMap(entryPoint: string = 'INDEX.md'): MindMap {
  const nodes = new Map<string, MindNode>()
  const directories = new Set<string>()
  
  // STEP 1: Get all files from MAP.md (curated list)
  const mapFiles = parseMapFile()
  
  // STEP 2: Walk directory to catch anything MAP.md might miss
  const allFiles = walkDirectory(MIND_DIR)
  
  // Combine: prioritize MAP.md files, add directory-walked files
  const fileSet = new Set<string>()
  
  // Add MAP.md files first
  for (const { path } of mapFiles) {
    fileSet.add(path)
  }
  
  // Add directory-walked files
  for (const filePath of allFiles) {
    fileSet.add(filePath)
  }
  
  // STEP 3: Process each file
  for (const filePath of fileSet) {
    const fullPath = join(MIND_DIR, filePath + '.md')
    const content = readFileSafe(fullPath)
    
    if (!content) continue
    
    const isDirIndex = filePath.endsWith('/index') || filePath === 'index'
    const parentDir = dirname(filePath)
    
    if (isDirIndex && parentDir !== '.') {
      directories.add(parentDir)
    }
    
    const links = extractLinks(content)
    const mapEntry = mapFiles.find(f => f.path === filePath)
    
    const node: MindNode = {
      path: filePath,
      title: extractTitle(content),
      description: extractDescription(content) || (mapEntry ? `Category: ${mapEntry.category}` : undefined),
      links,
      backLinks: [],
      type: filePath === entryPoint.replace('.md', '') ? 'entry' : 
            (isDirIndex ? 'directory' : 'file'),
      size: content.length
    }
    
    nodes.set(filePath, node)
  }
  
  // STEP 4: Build back-links
  for (const [path, node] of nodes) {
    for (const link of node.links) {
      const normalizedLink = link.endsWith('.md') ? link.slice(0, -3) : link
      const target = nodes.get(normalizedLink)
      if (target) {
        target.backLinks.push(path)
      }
    }
  }
  
  return {
    entryPoint,
    nodes,
    directories: Array.from(directories),
    allFiles: Array.from(fileSet)
  }
}

// Legacy: Build from entry point only (linked files)
export function buildMindMap(entryPoint: string = 'INDEX.md'): MindMap {
  return buildCompleteMindMap(entryPoint)
}

// Alias for LLM function calling
export const discoverMindMap = buildMindMap

// Search across ALL mind content
export function searchMindDynamic(query: string, mindMap?: MindMap): {
  path: string
  title: string
  relevance: number
  context: string
}[] {
  const map = mindMap || getCachedMindMap()
  const results: { path: string; title: string; relevance: number; context: string }[] = []
  const queryLower = query.toLowerCase()

  for (const [path, node] of map.nodes) {
    let relevance = 0
    let context = ''

    // Title match
    if (node.title.toLowerCase().includes(queryLower)) {
      relevance += 10
      context = node.title
    }

    // Description match
    if (node.description?.toLowerCase().includes(queryLower)) {
      relevance += 5
      context = node.description
    }

    // Path match
    if (path.toLowerCase().includes(queryLower)) {
      relevance += 3
      context = `Path: ${path}`
    }

    // Link match
    const matchingLinks = node.links.filter(l =>
      l.toLowerCase().includes(queryLower)
    )
    if (matchingLinks.length > 0) {
      relevance += 2
      context = context || `Links to: ${matchingLinks.join(', ')}`
    }

    // Full content search
    if (relevance > 0) {
      const fullPath = join(MIND_DIR, path + '.md')
      const content = readFileSafe(fullPath)
      if (content) {
        const lines = content.split('\n')
        for (const line of lines) {
          if (line.toLowerCase().includes(queryLower)) {
            relevance += 0.5
            if (!context || context.length < 50) {
              context = line.trim().slice(0, 150)
            }
          }
        }
      }
    }

    if (relevance > 0) {
      results.push({
        path,
        title: node.title,
        relevance,
        context: context || 'Found in content'
      })
    }
  }

  return results.sort((a, b) => b.relevance - a.relevance)
}

// Find path from entry to target
export function findPathTo(target: string, mindMap?: MindMap): string[] | null {
  const map = mindMap || getCachedMindMap()
  const visited = new Set<string>()
  const queue: { path: string; route: string[] }[] = [
    { path: map.entryPoint.replace('.md', ''), route: [map.entryPoint.replace('.md', '')] }
  ]

  while (queue.length > 0) {
    const current = queue.shift()!

    if (current.path === target.replace('.md', '')) {
      return current.route
    }

    if (visited.has(current.path)) continue
    visited.add(current.path)

    const node = map.nodes.get(current.path)
    if (node) {
      for (const link of node.links) {
        const normalized = link.endsWith('.md') ? link.slice(0, -3) : link
        if (!visited.has(normalized)) {
          queue.push({
            path: normalized,
            route: [...current.route, normalized]
          })
        }
      }
    }
  }

  return null
}

// Get related files
export function getRelatedFiles(path: string, mindMap?: MindMap): {
  path: string
  title: string
  relationship: 'links-to' | 'linked-from'
}[] {
  const map = mindMap || getCachedMindMap()
  const normalizedPath = path.endsWith('.md') ? path.slice(0, -3) : path
  const node = map.nodes.get(normalizedPath)

  if (!node) return []

  const related: { path: string; title: string; relationship: 'links-to' | 'linked-from' }[] = []

  for (const link of node.links) {
    const normalized = link.endsWith('.md') ? link.slice(0, -3) : link
    const target = map.nodes.get(normalized)
    if (target) {
      related.push({
        path: normalized,
        title: target.title,
        relationship: 'links-to'
      })
    }
  }

  for (const backLink of node.backLinks) {
    const source = map.nodes.get(backLink)
    if (source) {
      related.push({
        path: backLink,
        title: source.title,
        relationship: 'linked-from'
      })
    }
  }

  return related
}

// List ALL files with summaries
export function listAllFiles(mindMap?: MindMap): {
  path: string
  title: string
  description?: string
  type: string
  connections: number
}[] {
  const map = mindMap || getCachedMindMap()
  
  return Array.from(map.nodes.entries()).map(([path, node]) => ({
    path,
    title: node.title,
    description: node.description,
    type: node.type,
    connections: node.links.length + node.backLinks.length
  })).sort((a, b) => a.path.localeCompare(b.path))
}

// Explore a directory
export function exploreDirectory(dirPath: string = ''): {
  files: { path: string; title: string }[]
  subdirs: string[]
} {
  const map = getCachedMindMap()
  const files: { path: string; title: string }[] = []
  const subdirs = new Set<string>()
  
  for (const [path, node] of map.nodes) {
    if (dirPath === '') {
      // Root level files
      if (!path.includes('/')) {
        files.push({ path, title: node.title })
      }
    } else {
      // Files in this directory
      if (path.startsWith(dirPath + '/')) {
        const rest = path.slice(dirPath.length + 1)
        if (rest.includes('/')) {
          subdirs.add(dirPath + '/' + rest.split('/')[0])
        } else {
          files.push({ path, title: node.title })
        }
      }
    }
  }
  
  return { files, subdirs: Array.from(subdirs) }
}

// Cache
let cachedMindMap: MindMap | null = null
let cacheTime = 0
const CACHE_TTL = 60000

export function getCachedMindMap(): MindMap {
  const now = Date.now()
  if (!cachedMindMap || now - cacheTime > CACHE_TTL) {
    cachedMindMap = buildCompleteMindMap('INDEX.md')
    cacheTime = now
    console.log(`[mind-map] Built complete map: ${cachedMindMap.nodes.size} files, ${cachedMindMap.directories.length} directories`)
  }
  return cachedMindMap
}

// Get comprehensive structure
export function getMindStructure(): {
  totalFiles: number
  totalDirectories: number
  entryPoint: string
  deeplyLinked: string[]
  orphanedFiles: string[] // Files with no links in or out
} {
  const map = getCachedMindMap()

  const connections = Array.from(map.nodes.entries())
    .map(([path, node]) => ({
      path,
      connections: node.links.length + node.backLinks.length
    }))
    .sort((a, b) => b.connections - a.connections)
    .slice(0, 5)
    .map(n => n.path)

  const orphanedFiles = Array.from(map.nodes.entries())
    .filter(([_, node]) => node.links.length === 0 && node.backLinks.length === 0)
    .map(([path, _]) => path)

  return {
    totalFiles: map.nodes.size,
    totalDirectories: map.directories.length,
    entryPoint: map.entryPoint,
    deeplyLinked: connections,
    orphanedFiles
  }
}

// Export legacy functions for compatibility
export { getCompactMindState, getMindFile, queryMindTasks, getRecentSessions, getMindLinks } from './mind-api.js'
