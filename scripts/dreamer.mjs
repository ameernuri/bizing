#!/usr/bin/env node
/**
 * @fileoverview Dreamer — Autonomous Mind Scanner with Loop
 */

import { readFileSync, existsSync, readdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const BIZING_ROOT = join(__dirname, '..')
const MIND_DIR = join(BIZING_ROOT, 'mind')
const DISSONANCE_FILE = join(MIND_DIR, 'DISSONANCE.md')
const CURIOSITIES_FILE = join(MIND_DIR, 'CURIOSITIES.md')
const MAP_FILE = join(MIND_DIR, 'MAP.md')
const RAM_FILE = join(MIND_DIR, 'memory/RAM.md')
const MEMORY_SESSIONS_DIR = join(MIND_DIR, 'memory/sessions')

const TODAY = new Date().toISOString().split('T')[0]
const TIMESTAMP = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })

// Skip words that are too short or common
const SKIP_WORDS = new Set(['api', 'sdk', 'tension', 'cognitive', 'dissonance', 'ideas', 'unresolved', 'questions', 'tensions', 'updated', 'answer', 'decisions', 'conflicts', 'write', 'active', 'scope', 'bizing', 'merchant', 'record', 'happens', 'agent', 'commits', 'index', 'entry', 'point', 'start', 'every', 'workflow', 'remove', 'surgical', 'there', 'business', 'platform', 'businesses', 'services', 'identity', 'living', 'project', 'means', 'itself', 'works', 'evolving', 'consciousness', 'complete', 'organized', 'context', 'purpose', 'current', 'focus', 'tasks', 'readme', 'vision', 'quick', 'framework', 'rules', 'entity', 'nature', 'booking', 'definition', 'major', 'element', 'picture', 'enables', 'selling', 'primary', 'supports', 'commerce', 'experience', 'cases', 'provider', 'consultant', 'trainer', 'therapist', 'coach', 'sells', 'access', 'multi', 'thinks', 'everything', 'architecture', 'process', 'knowledge', 'customer', 'changes', 'existing', 'understanding', 'capabilities', 'symbiosis', 'capability', 'evolution', 'document', 'reference', 'values', 'features', 'systems', 'documentation', 'patterns', 'connected', 'categories', 'startup', 'domain', 'completed', 'template', 'before', 'review', 'development', 'quality', 'platforms', 'overview', 'working', 'important', 'sessions', 'standup', 'structure', 'skills', 'research', 'different', 'feedback', 'server', 'covers', 'solutions', 'management', 'requirements', 'design', 'comprehensive', 'february'])

function readMindFiles() {
  const files = []
  function traverse(dir) {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        traverse(path)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try { files.push({ path: path.replace(MIND_DIR + '/', ''), content: readFileSync(path, 'utf-8') }) } catch (e) {}
      }
    }
  }
  traverse(MIND_DIR)
  return files
}

function askOllama(q) {
  try {
    const r = spawnSync('bash', ['-c', `echo "${q.replace(/"/g, '\\"')}" | ollama run llama3.1:8b 2>/dev/null`], { encoding: 'utf-8', timeout: 180000 })
    return r.stdout?.replace(/[\x1B\x9B].*?[mG]/g, '').replace(/\n+/g, '\n').trim() || null
  } catch (e) { return null }
}

function readDissonances() {
  if (!existsSync(DISSONANCE_FILE)) return []
  const content = readFileSync(DISSONANCE_FILE, 'utf-8')
  const topics = []
  const lines = content.split('\n')
  let current = ''
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current) topics.push(current)
      current = line.replace('## ', '').trim()
    }
  }
  if (current) topics.push(current)
  return topics
}

function readCuriosities() {
  if (!existsSync(CURIOSITIES_FILE)) return []
  const content = readFileSync(CURIOSITIES_FILE, 'utf-8')
  const questions = []
  const lines = content.split('\n')
  for (const line of lines) {
    if (line.startsWith('- **')) {
      questions.push(line.replace('- **', '').replace('**', '').trim())
    }
  }
  return questions
}

function dissonanceExists(topic) {
  return readDissonances().some(e => e.toLowerCase().includes(topic.toLowerCase()))
}

function curiosityExists(question) {
  return readCuriosities().some(e => e.toLowerCase().includes(question.toLowerCase().substring(0, 50)))
}

function fileExists(path) {
  return existsSync(join(MIND_DIR, path))
}

function isValidTopic(topic) {
  // Skip single words and common words
  if (topic.length < 8) return false
  if (SKIP_WORDS.has(topic.toLowerCase())) return false
  return true
}

function updateMAP(newDissonances, newCuriosities) {
  if (!existsSync(MAP_FILE)) return
  
  let content = readFileSync(MAP_FILE, 'utf-8')
  let updated = false
  
  if (newDissonances.length > 0 && !content.includes('[[mind/DISSONANCE]]')) {
    const opsIndex = content.indexOf('## Operations')
    if (opsIndex !== -1) {
      const before = content.slice(0, opsIndex)
      const after = content.slice(opsIndex)
      content = before + '**→ [[mind/DISSONANCE|Cognitive Dissonance]]** — Real conflicts between files #dissonance\n\n' + after
      updated = true
      console.log('📍 Added DISSONANCE link to MAP.md')
    }
  }
  
  if (newCuriosities.length > 0 && !content.includes('[[mind/CURIOSITIES]]')) {
    const opsIndex = content.indexOf('## Operations')
    if (opsIndex !== -1) {
      const before = content.slice(0, opsIndex)
      const after = content.slice(opsIndex)
      content = before + '**→ [[mind/CURIOSITIES|Curiosities]]** — Questions worth exploring #curiosity\n\n' + after
      updated = true
      console.log('📍 Added CURIOSITIES link to MAP.md')
    }
  }
  
  if (updated) {
    writeFileSync(MAP_FILE, content)
  }
}

function updateDissonance(dissonances) {
  if (dissonances.length === 0) return 0
  
  let md = `# Cognitive Dissonance

> Real conflicts where different files say different things. #dissonance #conflict

---

## What Is This File?

**COGNITIVE DISSONANCE** = when File A and File B contradict each other.

#cognitive-dissonance #conflicts

---

## Active Conflicts

`
  for (const d of dissonances) {
    const fileALink = fileExists(d.fileA) ? `[[${d.fileA}]]` : d.fileA
    const fileBLink = fileExists(d.fileB) ? `[[${d.fileB}]]` : d.fileB
    md += `### ${d.topic}

**Sources:**
- ${fileALink}
- ${fileBLink}

**Question:** ${d.question}

`
  }
  
  md += `---

*When resolved, delete from this file.* #tags: dissonance, conflicts, active

`
  
  writeFileSync(DISSONANCE_FILE, md)
  return dissonances.length
}

function updateCuriositiesFile(curiosities) {
  if (curiosities.length === 0) return 0
  
  let md = `# Curiosities

> Questions worth exploring. #curiosity #questions #gaps

---

## Questions

`
  for (const c of curiosities) {
    const sourceLink = fileExists(c.source) ? `[[${c.source}]]` : c.source
    md += `- **${c.question}**

  Source: ${sourceLink}

`
  }
  
  md += `---

*When answered, delete from this file.* #tags: curiosity, questions, exploration

`
  
  writeFileSync(CURIOSITIES_FILE, md)
  return curiosities.length
}

function createSessionLog(dissonances, curiosities) {
  const file = join(MEMORY_SESSIONS_DIR, `${TODAY}-dreamer.md`)
  const log = `---
date: ${TODAY}
tags: session, dreamer
type: dreamer
---

# Dreamer Scan — ${TODAY}

**Dissonances:** ${dissonances.length}
${dissonances.map(d => `- ${d.topic}`).join('\n') || 'None'}

**Curiosities:** ${curiosities.length}
${curiosities.map(c => `- ${c.question.substring(0, 50)}...`).join('\n') || 'None'}

---
*Dreamer session: ${TODAY}*
`
  writeFileSync(file, log)
}

console.log('🌀 Dreamer Loop...\n')

const existingDissonances = readDissonances()
const existingCuriosities = readCuriosities()
console.log(`📖 Read ${existingDissonances.length} dissonances, ${existingCuriosities.length} curiosities\n`)

const files = readMindFiles()
console.log(`📖 Scanned ${files.length} files\n`)

const fileList = files.slice(0, 20).map(f => f.path).join(', ')

console.log('🤖 Finding NEW dissonances...')
const dissonanceQ = `Find NEW conflicts where File A and File B contradict. EXISTING: ${existingDissonances.join(' | ') || 'None'}

Output (max 3, NEW only, NO single words like "tension", "dissonance", etc.):
TENSION: <name>
FILE_A: <path>
FILE_B: <path>
QUESTION: <how to resolve?>

Or NONE

Files: ${fileList}`

const dissonanceResponse = askOllama(dissonanceQ)
const newDissonances = []

if (dissonanceResponse && !dissonanceResponse.toUpperCase().includes('NONE')) {
  const lines = dissonanceResponse.split('\n')
  let current = {}
  for (const line of lines) {
    if (line.startsWith('TENSION:')) current.topic = line.replace('TENSION:', '').trim()
    if (line.startsWith('FILE_A:')) current.fileA = line.replace('FILE_A:', '').trim()
    if (line.startsWith('FILE_B:')) current.fileB = line.replace('FILE_B:', '').trim()
    if (line.startsWith('QUESTION:')) {
      current.question = line.replace('QUESTION:', '').trim()
      if (current.topic && current.fileA && current.fileB && !dissonanceExists(current.topic) && isValidTopic(current.topic)) {
        newDissonances.push({...current})
      }
      current = {}
    }
  }
}

console.log(`🎯 Found ${newDissonances.length} NEW dissonances\n`)

console.log('🤖 Finding NEW curiosities...')
const curiosityQ = `Find NEW questions worth exploring. EXISTING: ${existingCuriosities.join(' | ') || 'None'}

Output (max 3, NEW only):
QUESTION: <question>
SOURCE: <path>
CONTEXT: <why interesting>

Or NONE

Files: ${fileList}`

const curiosityResponse = askOllama(curiosityQ)
const newCuriosities = []

if (curiosityResponse && !curiosityResponse.toUpperCase().includes('NONE')) {
  const lines = curiosityResponse.split('\n')
  let current = {}
  for (const line of lines) {
    if (line.startsWith('QUESTION:')) current.question = line.replace('QUESTION:', '').trim()
    if (line.startsWith('SOURCE:')) current.source = line.replace('SOURCE:', '').trim()
    if (line.startsWith('CONTEXT:')) {
      current.context = line.replace('CONTEXT:', '').trim()
      if (current.question && current.source && !curiosityExists(current.question)) {
        newCuriosities.push({...current})
      }
      current = {}
    }
  }
}

console.log(`🎯 Found ${newCuriosities.length} NEW curiosities\n`)

const dAdded = updateDissonance(newDissonances)
const cAdded = updateCuriositiesFile(newCuriosities)
updateMAP(newDissonances, newCuriosities)

if (dAdded > 0) {
  console.log(`✅ Updated DISSONANCE.md with ${dAdded} dissonance(s)`)
  newDissonances.forEach(d => console.log(`  🔥 ${d.topic}`))
}

if (cAdded > 0) {
  console.log(`✅ Updated CURIOSITIES.md with ${cAdded} curiosity/ies`)
  newCuriosities.forEach(c => console.log(`  ❓ ${c.question.substring(0, 50)}...`))
}

if (dAdded === 0 && cAdded === 0) {
  console.log('✅ No new dissonances or curiosities found')
}

// RAM is for active context, not automated system logs
// Dreamer findings are logged to session files, not RAM
createSessionLog(newDissonances, newCuriosities)

console.log('\n✨ Dreamer complete!')
