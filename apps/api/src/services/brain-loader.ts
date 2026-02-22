import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

interface BrainSummary {
  currentFocus: string
  recentLearnings: string[]
  keyDecisions: string[]
  activeBlockers: string[]
  identity: {
    essence: string
    values: string[]
  }
  recentActivity: {
    sessions: string[]
    changes: string[]
  }
}

const MIND_DIR = join(process.cwd(), '..', '..', 'mind')

function readFileSafe(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}

function extractSection(content: string, header: string): string {
  const regex = new RegExp(`## ${header}\\s*\\n(.*?)(?=\\n## |\\n---|$)`, 'is')
  const match = content.match(regex)
  return match ? match[1].trim() : ''
}

function getRecentFiles(dir: string, limit: number = 5): string[] {
  try {
    const files = readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .map(f => ({
        name: f,
        path: join(dir, f),
        mtime: statSync(join(dir, f)).mtime
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
      .slice(0, limit)
    
    return files.map(f => f.name)
  } catch {
    return []
  }
}

export function loadBrainSummary(): BrainSummary {
  // Read key files
  const index = readFileSafe(join(MIND_DIR, 'index.md')) || ''
  const standup = readFileSafe(join(MIND_DIR, 'symbiosis', 'standup.md')) || ''
  const feedback = readFileSafe(join(MIND_DIR, 'symbiosis', 'feedback.md')) || ''
  const essence = readFileSafe(join(MIND_DIR, 'identity', 'essence.md')) || ''
  
  // Get recent sessions
  const sessionsDir = join(MIND_DIR, 'memory', 'sessions')
  const recentSessions = getRecentFiles(sessionsDir, 3)
  
  // Extract learnings from feedback
  const learningsSection = extractSection(feedback, "Today's Learnings")
  const learnings = learningsSection
    .split('\n')
    .filter(line => line.trim().startsWith('- ['))
    .map(line => line.replace(/^-\s*\[.*?\]\s*/, '').trim())
    .slice(0, 5)
  
  // Extract focus from standup
  const focusSection = extractSection(standup, 'Focus')
  const currentFocus = focusSection
    .replace(/\*\*/g, '')
    .replace(/^\s*\>\s*/, '')
    .split('\n')[0]
    .trim() || 'Building Bizing AI capabilities'
  
  // Extract blockers
  const blockersSection = extractSection(standup, 'Blockers')
  const blockers = blockersSection
    .split('\n')
    .filter(line => line.includes('#blocker'))
    .map(line => line.replace(/^.*#blocker\s*/, '').trim())
  
  // Extract identity essence (first paragraph)
  const identityEssence = essence
    .split('\n##')[0]
    .replace(/^#.*\n/, '')
    .trim()
    .slice(0, 200) || 'Bizing is a living entity — a booking platform for AI agents'
  
  return {
    currentFocus,
    recentLearnings: learnings.length > 0 ? learnings : ['Learning to work with Ameer'],
    keyDecisions: [], // Would need to parse decisions.md
    activeBlockers: blockers.length > 0 ? blockers : ['None currently'],
    identity: {
      essence: identityEssence,
      values: ['Agent-first', 'Self-knowledge', 'Evolutionary integrity']
    },
    recentActivity: {
      sessions: recentSessions,
      changes: []
    }
  }
}

export function formatBrainForPrompt(summary: BrainSummary): string {
  return `
## Current Brain State

**Focus:** ${summary.currentFocus}

**Identity:** ${summary.identity.essence}

**Core Values:** ${summary.identity.values.join(', ')}

**Recent Learnings:**
${summary.recentLearnings.map(l => `- ${l}`).join('\n')}

**Active Blockers:**
${summary.activeBlockers.map(b => `- ${b}`).join('\n')}

**Recent Sessions:** ${summary.recentActivity.sessions.join(', ') || 'None recorded'}

**Brain Activity:** Last updated ${new Date().toISOString()}
`
}

// Cache for 30 seconds to avoid excessive file reads
let cachedSummary: BrainSummary | null = null
let cacheTime = 0
const CACHE_TTL = 30000 // 30 seconds

export function getCachedBrainSummary(): BrainSummary {
  const now = Date.now()
  if (!cachedSummary || now - cacheTime > CACHE_TTL) {
    cachedSummary = loadBrainSummary()
    cacheTime = now
  }
  return cachedSummary
}
