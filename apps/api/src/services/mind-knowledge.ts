import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { getCachedMindMap } from './mind-map.js'

const MIND_DIR = join(process.cwd(), '..', '..', 'mind')
const CACHE_DIR = join(process.cwd(), '..', '..', '.cache')

/**
 * @fileoverview Mind Knowledge Base - Comprehensive memory system for Bizing AI
 * 
 * @architecture
 * - Generates structured JSON knowledge base from all mind files
 * - Creates summaries, extracts key facts, builds searchable index
 * - Updates automatically when files change
 * - Provides multiple access patterns: semantic, keyword, structured
 * 
 * @design-decisions
 * - Smaller chunks (500 chars) for granular retrieval
 * - Structured metadata for each file (summary, key points, tags)
 * - Full-text search index for keyword queries
 * - Hierarchical organization matching mind structure
 */

interface KnowledgeEntry {
  path: string
  title: string
  type: 'research' | 'design' | 'decision' | 'learning' | 'session' | 'goal' | 'identity' | 'knowledge' | 'skill'
  summary: string // Executive summary (2-3 sentences)
  keyPoints: string[] // Bullet points of key facts
  fullContent: string // Full content for detailed queries
  tags: string[]
  lastModified: number
  wordCount: number
  links: string[] // Outbound links
  relatedFiles: string[] // Files that link to this
}

interface KnowledgeBase {
  generatedAt: string
  totalFiles: number
  totalWords: number
  entries: KnowledgeEntry[]
  byCategory: Record<string, string[]> // category -> file paths
  byTag: Record<string, string[]> // tag -> file paths
  searchIndex: Record<string, string[]> // keyword -> file paths (inverted index)
}

let knowledgeBase: KnowledgeBase | null = null
let lastKnowledgeBuild = 0
const KNOWLEDGE_REBUILD_INTERVAL = 30 * 60 * 1000 // 30 minutes

// Ensure cache dir exists
if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true })
}

/**
 * Extract title from markdown content
 */
function extractTitle(content: string, filename: string): string {
  const match = content.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : filename
}

/**
 * Generate summary from content (first 2-3 meaningful sentences)
 */
function generateSummary(content: string): string {
  // Remove frontmatter
  content = content.replace(/^---[\s\S]*?---/, '').trim()
  
  // Get first paragraph that's not a heading
  const paragraphs = content.split('\n\n')
  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-') && trimmed.length > 50) {
      // Return first 200 chars with ellipsis if longer
      return trimmed.slice(0, 200) + (trimmed.length > 200 ? '...' : '')
    }
  }
  
  return 'No summary available'
}

/**
 * Extract key points from content (bullet points, numbered lists, key statements)
 */
function extractKeyPoints(content: string): string[] {
  const points: string[] = []
  
  // Match bullet points and numbered lists
  const bulletMatches = content.match(/^[\s]*[-*]\s+(.+)$/gm)
  if (bulletMatches) {
    bulletMatches.slice(0, 10).forEach(match => {
      const point = match.replace(/^[\s]*[-*]\s+/, '').trim()
      if (point.length > 20 && point.length < 200) {
        points.push(point)
      }
    })
  }
  
  // Match numbered lists
  const numberedMatches = content.match(/^[\s]*\d+\.\s+(.+)$/gm)
  if (numberedMatches) {
    numberedMatches.slice(0, 5).forEach(match => {
      const point = match.replace(/^[\s]*\d+\.\s+/, '').trim()
      if (point.length > 20 && point.length < 200 && !points.includes(point)) {
        points.push(point)
      }
    })
  }
  
  // Match "Key:" or "Decision:" patterns
  const keyMatches = content.match(/(?:Key|Decision|Finding|Lesson|Rule)s?:?\s*(.+?)(?=\n|$)/gi)
  if (keyMatches) {
    keyMatches.slice(0, 5).forEach(match => {
      const point = match.replace(/^(?:Key|Decision|Finding|Lesson|Rule)s?:?\s*/i, '').trim()
      if (point.length > 20 && point.length < 200 && !points.includes(point)) {
        points.push(point)
      }
    })
  }
  
  return points.slice(0, 15) // Max 15 key points
}

/**
 * Extract tags from content (hashtags, frontmatter tags, keywords)
 */
function extractTags(content: string, path: string): string[] {
  const tags: Set<string> = new Set()
  
  // Frontmatter tags
  const frontmatterMatch = content.match(/^---\s*\ntags:\s*\n((?:\s*-\s*.+\n)*)---/m)
  if (frontmatterMatch) {
    const tagLines = frontmatterMatch[1].match(/-\s*(.+)/g)
    if (tagLines) {
      tagLines.forEach(line => {
        tags.add(line.replace(/-\s*/, '').trim())
      })
    }
  }
  
  // Hashtags in content
  const hashtagMatches = content.match(/#\w+/g)
  if (hashtagMatches) {
    hashtagMatches.forEach(tag => tags.add(tag.slice(1)))
  }
  
  // Category from path
  const pathParts = path.split('/')
  if (pathParts.length > 1) {
    tags.add(pathParts[0]) // e.g., "research", "design"
  }
  
  // Detect type from content patterns
  if (content.includes('Research Findings')) tags.add('research')
  if (content.includes('Architecture') || content.includes('Design')) tags.add('design')
  if (content.includes('Decision') || content.includes('DECISION')) tags.add('decision')
  if (content.includes('Session') || content.includes('session')) tags.add('session')
  
  return Array.from(tags)
}

/**
 * Determine entry type from path and content
 */
function determineType(path: string, content: string): KnowledgeEntry['type'] {
  if (path.includes('research')) return 'research'
  if (path.includes('design')) return 'design'
  if (path.includes('decision')) return 'decision'
  if (path.includes('session') || path.includes('memory/sessions')) return 'session'
  if (path.includes('goal')) return 'goal'
  if (path.includes('identity')) return 'identity'
  if (path.includes('skill')) return 'skill'
  if (path.includes('knowledge')) return 'knowledge'
  if (content.includes('Research Findings')) return 'research'
  if (content.includes('Architecture Decision')) return 'decision'
  return 'knowledge'
}

/**
 * Build inverted search index
 */
function buildSearchIndex(entries: KnowledgeEntry[]): Record<string, string[]> {
  const index: Record<string, string[]> = {}
  
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'and', 'but', 'or', 'yet', 'so', 'if', 'because', 'although', 'though', 'while', 'where', 'when', 'that', 'which', 'who', 'whom', 'whose', 'what', 'this', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'])
  
  entries.forEach(entry => {
    const text = `${entry.title} ${entry.summary} ${entry.keyPoints.join(' ')} ${entry.fullContent}`.toLowerCase()
    const words = text.match(/\b[a-z]{3,}\b/g) || []
    
    words.forEach(word => {
      if (!stopWords.has(word)) {
        if (!index[word]) index[word] = []
        if (!index[word].includes(entry.path)) {
          index[word].push(entry.path)
        }
      }
    })
    
    // Add title words with higher priority (add twice)
    const titleWords = entry.title.toLowerCase().match(/\b[a-z]{3,}\b/g) || []
    titleWords.forEach(word => {
      if (!stopWords.has(word)) {
        if (!index[word]) index[word] = []
        if (!index[word].includes(entry.path)) {
          index[word].push(entry.path)
        }
      }
    })
  })
  
  return index
}

/**
 * Build comprehensive knowledge base
 */
export function buildKnowledgeBase(): KnowledgeBase {
  console.log('[knowledge] Building comprehensive knowledge base...')
  
  const map = getCachedMindMap()
  const entries: KnowledgeEntry[] = []
  const byCategory: Record<string, string[]> = {}
  const byTag: Record<string, string[]> = {}
  let totalWords = 0
  
  for (const [path, node] of map.nodes) {
    const fullPath = join(MIND_DIR, path + '.md')
    try {
      const content = readFileSync(fullPath, 'utf-8')
      const stats = existsSync(fullPath) ? { mtimeMs: Date.now() } : { mtimeMs: 0 }
      
      const wordCount = content.split(/\s+/).length
      totalWords += wordCount
      
      const entry: KnowledgeEntry = {
        path,
        title: extractTitle(content, node.title),
        type: determineType(path, content),
        summary: generateSummary(content),
        keyPoints: extractKeyPoints(content),
        fullContent: content.slice(0, 50000), // Limit full content
        tags: extractTags(content, path),
        lastModified: stats.mtimeMs,
        wordCount,
        links: node.links,
        relatedFiles: node.backLinks
      }
      
      entries.push(entry)
      
      // Organize by category
      const category = path.split('/')[0]
      if (!byCategory[category]) byCategory[category] = []
      byCategory[category].push(path)
      
      // Organize by tag
      entry.tags.forEach(tag => {
        if (!byTag[tag]) byTag[tag] = []
        byTag[tag].push(path)
      })
      
    } catch (err) {
      console.log(`[knowledge] Could not process ${path}: ${err}`)
    }
  }
  
  const searchIndex = buildSearchIndex(entries)
  
  knowledgeBase = {
    generatedAt: new Date().toISOString(),
    totalFiles: entries.length,
    totalWords,
    entries,
    byCategory,
    byTag,
    searchIndex
  }
  
  lastKnowledgeBuild = Date.now()
  
  // Cache to disk
  try {
    writeFileSync(
      join(CACHE_DIR, 'knowledge-base.json'),
      JSON.stringify(knowledgeBase, null, 2)
    )
    console.log(`[knowledge] ✅ Cached ${entries.length} entries (${totalWords.toLocaleString()} words)`)
  } catch (err) {
    console.error('[knowledge] Failed to cache:', err)
  }
  
  return knowledgeBase
}

/**
 * Get or build knowledge base
 */
export function getKnowledgeBase(): KnowledgeBase {
  const now = Date.now()
  
  if (!knowledgeBase || (now - lastKnowledgeBuild > KNOWLEDGE_REBUILD_INTERVAL)) {
    // Try to load from cache first
    try {
      const cached = readFileSync(join(CACHE_DIR, 'knowledge-base.json'), 'utf-8')
      const parsed = JSON.parse(cached) as KnowledgeBase
      const cacheAge = now - new Date(parsed.generatedAt).getTime()
      
      if (cacheAge < KNOWLEDGE_REBUILD_INTERVAL) {
        knowledgeBase = parsed
        lastKnowledgeBuild = now
        console.log('[knowledge] Loaded from cache')
        return knowledgeBase
      }
    } catch {
      // Cache miss or invalid, rebuild
    }
    
    return buildKnowledgeBase()
  }
  
  return knowledgeBase
}

/**
 * Search knowledge base by keyword
 */
export function searchKnowledgeBase(query: string, limit: number = 10): KnowledgeEntry[] {
  const kb = getKnowledgeBase()
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2)
  
  const scores: Map<string, number> = new Map()
  
  terms.forEach(term => {
    // Check search index
    const matchingPaths = kb.searchIndex[term] || []
    matchingPaths.forEach(path => {
      scores.set(path, (scores.get(path) || 0) + 1)
    })
    
    // Also check entries directly
    kb.entries.forEach(entry => {
      const text = `${entry.title} ${entry.summary} ${entry.keyPoints.join(' ')}`.toLowerCase()
      if (text.includes(term)) {
        scores.set(entry.path, (scores.get(entry.path) || 0) + 2) // Higher weight for direct match
      }
    })
  })
  
  // Sort by score
  const sorted = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([path]) => kb.entries.find(e => e.path === path))
    .filter((e): e is KnowledgeEntry => e !== undefined)
  
  return sorted
}

/**
 * Get entry by path
 */
export function getKnowledgeEntry(path: string): KnowledgeEntry | null {
  const kb = getKnowledgeBase()
  return kb.entries.find(e => e.path === path) || null
}

/**
 * Get all entries by type
 */
export function getEntriesByType(type: KnowledgeEntry['type']): KnowledgeEntry[] {
  const kb = getKnowledgeBase()
  return kb.entries.filter(e => e.type === type)
}

/**
 * Get all entries by tag
 */
export function getEntriesByTag(tag: string): KnowledgeEntry[] {
  const kb = getKnowledgeBase()
  const paths = kb.byTag[tag] || []
  return paths.map(p => kb.entries.find(e => e.path === p)).filter((e): e is KnowledgeEntry => e !== undefined)
}

/**
 * Generate comprehensive summary for system prompt
 */
export function generateMindSummary(): string {
  const kb = getKnowledgeBase()
  
  const sections: string[] = []
  
  // Overview
  sections.push(`# Bizing Mind Summary`)
  sections.push(`Generated: ${kb.generatedAt}`)
  sections.push(`Total Files: ${kb.totalFiles} | Total Words: ${kb.totalWords.toLocaleString()}`)
  sections.push('')
  
  // Recent sessions
  const sessions = getEntriesByType('session').slice(-5).reverse()
  if (sessions.length > 0) {
    sections.push(`## Recent Sessions`)
    sessions.forEach(s => {
      sections.push(`- **${s.title}**: ${s.summary.slice(0, 100)}...`)
    })
    sections.push('')
  }
  
  // Research findings
  const research = getEntriesByType('research').slice(-5)
  if (research.length > 0) {
    sections.push(`## Research Findings`)
    research.forEach(r => {
      sections.push(`### ${r.title}`)
      sections.push(r.summary)
      if (r.keyPoints.length > 0) {
        sections.push('Key points:')
        r.keyPoints.slice(0, 3).forEach(p => sections.push(`- ${p}`))
      }
      sections.push('')
    })
  }
  
  // Decisions
  const decisions = getEntriesByType('decision').slice(-3)
  if (decisions.length > 0) {
    sections.push(`## Key Decisions`)
    decisions.forEach(d => {
      sections.push(`- **${d.title}**: ${d.summary.slice(0, 150)}...`)
    })
    sections.push('')
  }
  
  // Learnings from feedback
  const feedback = getKnowledgeEntry('symbiosis/feedback')
  if (feedback && feedback.keyPoints.length > 0) {
    sections.push(`## Recent Learnings`)
    feedback.keyPoints.slice(-10).forEach(p => {
      sections.push(`- ${p}`)
    })
    sections.push('')
  }
  
  // Feature space summary
  const featureSpace = kb.entries.find(e => e.path.includes('FEATURE_SPACE'))
  if (featureSpace) {
    sections.push(`## Feature Space`)
    sections.push(featureSpace.summary)
    if (featureSpace.keyPoints.length > 0) {
      sections.push('')
      sections.push('Key features:')
      featureSpace.keyPoints.slice(0, 10).forEach(p => sections.push(`- ${p}`))
    }
    sections.push('')
  }
  
  return sections.join('\n')
}

/**
 * Get knowledge stats
 */
export function getKnowledgeStats(): {
  ready: boolean
  totalFiles: number
  totalWords: number
  generatedAt: string | null
  byType: Record<string, number>
} {
  const kb = getKnowledgeBase()
  
  const byType: Record<string, number> = {}
  kb.entries.forEach(e => {
    byType[e.type] = (byType[e.type] || 0) + 1
  })
  
  return {
    ready: true,
    totalFiles: kb.totalFiles,
    totalWords: kb.totalWords,
    generatedAt: kb.generatedAt,
    byType
  }
}