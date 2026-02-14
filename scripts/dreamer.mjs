#!/usr/bin/env node
/**
 * @fileoverview Dreamer — Autonomous Mind Evolver
 * 
 * Finds REAL conflicts by checking KNOWN dissonance topics.
 * 
 * Does NOT:
 * - Find text patterns like "but", "however"
 * - Create duplicates
 * - Compare files to themselves
 * - Log "Dreamer Run" messages
 * 
 * Usage: node scripts/dreamer.mjs
 */

import { readFileSync, existsSync, readdirSync, appendFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const BIZING_ROOT = join(__dirname, '..')
const MIND_DIR = join(BIZING_ROOT, 'mind')
const DISSONANCE_FILE = join(MIND_DIR, 'DISSONANCE.md')
const EVOLUTION_FILE = join(MIND_DIR, 'EVOLUTION.md')

const TODAY = new Date().toISOString().split('T')[0]

// Known conflicts to check for
const CONFLICT_TOPICS = {
  'API vs SDK for agents': {
    keywords: ['api', 'sdk'],
    patterns: [
      { file: 'api-first-design', text: 'api' },
      { file: 'FEATURE_SPACE', text: 'sdk' },
    ]
  },
  'Calendar build vs integrate': {
    keywords: ['calendar', 'integrate'],
    patterns: [
      { file: 'FEATURE_SPACE', text: 'build' },
      { file: 'FEATURE_SPACE', text: 'google calendar' },
    ]
  },
  'Agent data ownership': {
    keywords: ['data ownership', 'gdpr'],
    patterns: [
      { file: 'research', text: 'bizing' },
      { file: 'research', text: 'agent' },
    ]
  }
}

/**
 * Read all mind files
 */
function readMindFiles() {
  const files = []
  
  function traverse(dir) {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory() && 
          !entry.name.startsWith('.') && 
          entry.name !== 'node_modules' && 
          entry.name !== 'evolution') {
        traverse(path)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const content = readFileSync(path, 'utf-8')
          const relPath = path.replace(MIND_DIR + '/', '')
          files.push({ path: relPath, content })
        } catch (e) {}
      }
    }
  }
  
  traverse(MIND_DIR)
  return files
}

/**
 * Check if conflict already exists
 */
function conflictExists(conflictName) {
  if (!existsSync(DISSONANCE_FILE)) return false
  const content = readFileSync(DISSONANCE_FILE, 'utf-8')
  return content.includes(`### D-`) && content.includes(conflictName)
}

/**
 * Find files matching pattern
 */
function findFiles(files, patterns) {
  const matches = []
  for (const file of files) {
    for (const p of patterns) {
      if (file.path.toLowerCase().includes(p.file.toLowerCase())) {
        // Check if file contains the keyword
        if (file.content.toLowerCase().includes(p.text.toLowerCase())) {
          matches.push(file.path)
        }
      }
    }
  }
  return [...new Set(matches)]
}

/**
 * Add real conflict
 */
function addConflict(conflictName, sources) {
  if (conflictExists(conflictName)) {
    console.log(`⚠️  ${conflictName} already exists, skipping`)
    return false
  }
  
  const id = `D-${String(Date.now() % 1000).padStart(3, '0')}`
  
  const entry = `
### ${id}: ${conflictName}
- **Sources**: ${sources.join(', ')}
- **Found**: ${TODAY}
- **Status**: 🔥 Active

`
  
  appendFileSync(DISSONANCE_FILE, entry)
  console.log(`🔥 ${id}: ${conflictName}`)
  return true
}

/**
 * Log evolution
 */
function logEvolution(message) {
  const entry = `\n## ${TODAY} — ${message}\n`
  appendFileSync(EVOLUTION_FILE, entry)
  console.log(`📈 Evolution: ${message}`)
}

console.log(`🌀 Dreamer — Checking for real conflicts...\n`)

const files = readMindFiles()
console.log(`📖 Scanned ${files.length} files\n`)

let conflictsAdded = 0

// Check each known conflict
for (const [conflictName, config] of Object.entries(CONFLICT_TOPICS)) {
  const sources = findFiles(files, config.patterns)
  
  if (sources.length >= 2) {
    if (addConflict(conflictName, sources)) {
      conflictsAdded++
    }
  } else {
    console.log(`⚠️  ${conflictName}: Only found ${sources.length} sources`)
  }
}

if (conflictsAdded > 0) {
  logEvolution(`${conflictsAdded} new conflict(s) added to DISSONANCE.md`)
} else {
  console.log(`✅ No new conflicts found`)
}

console.log(`\n✨ Dreamer complete!`)
