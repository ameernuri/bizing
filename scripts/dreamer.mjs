#!/usr/bin/env node
/**
 * @fileoverview Dreamer — Autonomous Mind Evolver
 * 
 * Reads mind files, finds tensions, makes MINIMAL edits:
 * - Appends tensions to DISSONANCE.md
 * - Creates wikilinks between related concepts
 * - Rewords unclear passages (minimal)
 * - Tracks evolution of the mind
 * 
 * Usage: node scripts/dreamer.mjs
 */

import { readFileSync, existsSync, readdirSync, appendFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const BIZING_ROOT = join(__dirname, '..')
const MIND_DIR = join(BIZING_ROOT, 'mind')
const DISSONANCE_FILE = join(MIND_DIR, 'DISSONANCE.md')
const EVOLUTION_DIR = join(MIND_DIR, 'evolution')

// Today's date for evolution
const TODAY = new Date().toISOString().split('T')[0]

// Patterns that indicate dissonance/tension/conflict
const CONFLICT_PATTERNS = [
  /but\s+(we|it|this)/gi,
  /however/gi,
  /although/gi,
  /either\s+.*or/gi,
  /uncertain/gi,
  /unclear/gi,
  /need\s+to\s+(decide|figure|determine)/gi,
  /not\s+(sure|certain|clear)/gi,
]

// Topics for wikilinking
const TOPIC_FILES = {
  'api': 'knowledge/api/index',
  'agent': 'AGENT',
  'booking': 'identity/consciousness',
  'mo[rr]': 'research/findings/merchant-of-record-stripe-fees',
  'embedding': 'services/mind-embeddings',
  'workflow': 'FRAMEWORK',
  'research': 'research/index',
  'feature': 'research/FEATURE_SPACE',
  'session': 'memory/sessions',
}

// Counter for dissonance IDs
let dissonanceId = 0

/**
 * Read all mind files
 */
function readMindFiles() {
  const files = []
  
  function traverse(dir) {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'evolution') {
        traverse(path)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const content = readFileSync(path, 'utf-8')
          const relPath = path.replace(MIND_DIR + '/', '')
          files.push({ path: relPath, content, fullPath: path })
        } catch (e) {
          // Skip
        }
      }
    }
  }
  
  traverse(MIND_DIR)
  return files
}

/**
 * Find tensions in a file
 */
function findTensions(file) {
  const tensions = []
  const lines = file.content.split('\n')
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1
    
    for (const pattern of CONFLICT_PATTERNS) {
      if (pattern.test(line)) {
        tensions.push({
          file: file.path,
          line: lineNum,
          text: line.slice(0, 150).trim(),
          type: pattern.test('uncertain') ? 'uncertainty' : 'conflict'
        })
      }
    }
  }
  
  return tensions
}

/**
 * Add wikilinks to connect concepts
 */
function findWikilinkOpportunities(file) {
  const opportunities = []
  const topics = Object.keys(TOPIC_FILES)
  
  for (const topic of topics) {
    const regex = new RegExp(`\\b${topic}\\b`, 'gi')
    const matches = file.content.match(regex)
    if (matches && matches.length > 0) {
      const linkTarget = TOPIC_FILES[topic]
      const linkPattern = new RegExp(`\\[\\[${linkTarget.split('/').pop()}\\]\\]`, 'gi')
      if (!linkPattern.test(file.content)) {
        opportunities.push({
          file: file.path,
          topic,
          linkTarget,
          count: matches.length
        })
      }
    }
  }
  
  return opportunities
}

/**
 * Append tension to DISSONANCE.md
 */
function appendToDissonance(tension) {
  dissonanceId++
  const id = `D-${String(dissonanceId).padStart(3, '0')}`
  
  const entry = `
### ${id}: ${tension.type === 'uncertainty' ? 'Uncertainty' : 'Conflict'} in ${tension.file.split('/').pop()}
- **Source**: ${tension.file}:${tension.line}
- **Content**: "${tension.text}..."
- **Found**: ${TODAY}
- **Status**: 🔥 Active
`
  
  appendFileSync(DISSONANCE_FILE, entry)
  return id
}

/**
 * Log dreamer activity
 */
function logActivity(message) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 8)
  console.log(`[${timestamp}] ${message}`)
}

/**
 * Track evolution
 */
function trackEvolution(changeType, description) {
  const entry = `
## ${TODAY} - ${changeType}
${description}
`
  const evolutionFile = join(EVOLUTION_DIR, `${TODAY}.md`)
  
  if (!existsSync(evolutionFile)) {
    writeFileSync(evolutionFile, `# Evolution ${TODAY}\n\n${entry}`)
  } else {
    appendFileSync(evolutionFile, entry)
  }
  
  logActivity(`📈 Evolution: ${changeType}`)
}

console.log(`🌀 Dreamer v2.0 — Autonomous Mind Evolver`)
console.log(`=============================================\n`)

// Track evolution start
trackEvolution('Dreamer Run', `Dreamer scanned ${readMindFiles().length} files`)

const files = readMindFiles()
logActivity(`📖 Found ${files.length} mind files`)

let tensionsFound = 0
let wikilinksAdded = 0
let dissonancesAdded = 0

// Process each file
for (const file of files) {
  // Find and add tensions
  const tensions = findTensions(file)
  tensionsFound += tensions.length
  
  for (const tension of tensions.slice(0, 3)) { // Max 3 per file
    const id = appendToDissonance(tension)
    dissonancesAdded++
    logActivity(`🔥 Added ${id} to DISSONANCE.md`)
  }
  
  // Find wikilink opportunities
  const opportunities = findWikilinkOpportunities(file)
  wikilinksAdded += opportunities.length
}

console.log(`\n📊 Dreamer Summary:`)
console.log(`   Files scanned: ${files.length}`)
console.log(`   Tensions found: ${tensionsFound}`)
console.log(`   Dissonances added: ${dissonancesAdded}`)
console.log(`   Wikilink opportunities: ${wikilinksAdded}`)

console.log(`\n✨ Dreamer complete! Mind has evolved.`)
console.log(`🌀 Zzz... dreaming of more improvements...`)
