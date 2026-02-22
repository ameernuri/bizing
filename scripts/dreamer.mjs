#!/usr/bin/env node
/**
 * Dreamer — Autonomous Mind Scanner
 * 
 * Finds CONTRADICTIONS: When File A says X but File B says Y (opposite)
 * Finds CURIOSITIES: Questions worth exploring
 * 
 * Tracks scanned file pairs to avoid re-scanning the same pairs.
 */

import { readFileSync, existsSync, readdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const BIZING_ROOT = join(__filename, '../..')
const MIND_DIR = join(BIZING_ROOT, 'mind')
const DISSONANCE_FILE = join(MIND_DIR, 'DISSONANCE.md')
const CURIOSITIES_FILE = join(MIND_DIR, 'CURIOSITIES.md')
const MAP_FILE = join(MIND_DIR, 'MAP.md')
const MEMORY_SESSIONS_DIR = join(MIND_DIR, 'memory/sessions')
const TRACKED_PAIRS_FILE = join(MIND_DIR, '.dreamer/tracked-pairs.json')

const TODAY = new Date().toISOString().split('T')[0]
const TIMESTAMP = new Date().toLocaleString('en-US', { 
  timeZone: 'America/Los_Angeles', 
  hour: '2-digit', 
  minute: '2-digit', 
  timeZoneName: 'short' 
})

// Track scanned file pairs
function getTrackedPairs() {
  try {
    if (existsSync(TRACKED_PAIRS_FILE)) {
      return JSON.parse(readFileSync(TRACKED_PAIRS_FILE, 'utf-8'))
    }
  } catch (e) {}
  return { pairs: [], lastScan: null }
}

function saveTrackedPairs(pairs) {
  const dir = dirname(TRACKED_PAIRS_FILE)
  if (!existsSync(dir)) return
  writeFileSync(TRACKED_PAIRS_FILE, JSON.stringify({ pairs, lastScan: TODAY }, null, 2))
}

function isPairTracked(fileA, fileB, tracked) {
  return tracked.pairs.some(p => 
    (p.a === fileA && p.b === fileB) || (p.a === fileB && p.b === fileA)
  )
}

function markPairTracked(fileA, fileB, tracked) {
  const pairKey = [fileA, fileB].sort().join('|')
  if (!tracked.pairs.includes(pairKey)) {
    tracked.pairs.push(pairKey)
  }
}

// Ask Ollama
function askOllama(prompt) {
  try {
    const r = spawnSync('bash', ['-lc', `printf '%s\\n' "${prompt.replace(/"/g, '\\"')}" | ollama run llama3.1:8b`], { 
      encoding: 'utf-8', 
      timeout: 120000 
    })
    return r.stdout?.replace(/\x1B\[[0-9;]*[mG]/g, '').replace(/\n+/g, '\n').trim() || null
  } catch (e) { 
    return null 
  }
}

// Read all mind files
function readMindFiles() {
  const files = []
  function traverse(dir) {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        traverse(path)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try { 
          files.push({ 
            path: path.replace(MIND_DIR + '/', ''), 
            content: readFileSync(path, 'utf-8'),
            name: entry.name.replace('.md', '')
          }) 
        } catch (e) {}
      }
    }
  }
  traverse(MIND_DIR)
  return files
}

// Read existing
function readDissonances() {
  if (!existsSync(DISSONANCE_FILE)) return []
  
  const content = readFileSync(DISSONANCE_FILE, 'utf-8')
  const items = []
  let current = null
  
  const lines = content.split('\n')
  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (current) items.push(current)
      current = { topic: line.replace('### ', '').trim() }
    }
    if (current) {
      if (line.includes('**[[') && line.includes(']] says:**')) {
        current.sourceA = line.match(/\*\*(.+?)\*\*/)?.[1] || ''
      }
      if (line.startsWith('> "')) {
        if (!current.quoteA) current.quoteA = line.replace('> "', '').replace('"', '')
        else current.quoteB = line.replace('> "', '').replace('"', '')
      }
      if (line.startsWith('**The Contradiction:**')) {
        current.explanation = line.replace('**The Contradiction:**', '').trim()
      }
      if (line.startsWith('**Resolution:**')) {
        current.resolution = line.replace('**Resolution:**', '').trim()
      }
    }
  }
  if (current) items.push(current)
  return items
}

function readCuriosities() {
  if (!existsSync(CURIOSITIES_FILE)) return []
  
  const content = readFileSync(CURIOSITIES_FILE, 'utf-8')
  const items = []
  let current = null
  
  const lines = content.split('\n')
  for (const line of lines) {
    if (line.startsWith('- **')) {
      if (current) items.push(current)
      current = { question: line.replace('- **', '').replace('**', '').trim() }
    }
    if (current) {
      if (line.includes('Source: [[')) {
        current.source = line.match(/Source: \[\[(.+?)\]\]/)?.[1] || ''
      }
      if (line.includes('Why:')) {
        current.why = line.replace('Why:', '').trim()
      }
    }
  }
  if (current) items.push(current)
  return items
}

function fileExists(path) {
  return existsSync(join(MIND_DIR, path))
}

// Update files - APPEND, don't replace
function updateDissonance(newCons) {
  const existing = readDissonances()
  
  const uniqueNew = newCons.filter(nc => {
    return !existing.some(ec => 
      ec.topic.toLowerCase() === nc.topic.toLowerCase() ||
      (ec.sourceA && nc.fileA && ec.sourceA.includes(nc.fileA) && ec.sourceB && nc.fileB && ec.sourceB.includes(nc.fileB))
    )
  })
  
  if (uniqueNew.length === 0) return 0
  
  let md = existsSync(DISSONANCE_FILE) ? readFileSync(DISSONANCE_FILE, 'utf-8') : ''
  
  if (!md.includes('## Active Contradictions')) {
    md = `# Cognitive Dissonance

> Real conflicts where different files say different things. #dissonance #conflict

---

## What Is This File?

**COGNITIVE DISSONANCE** = when File A and File B **contradict** each other.

---

## Active Contradictions

`
  }
  
  for (const c of uniqueNew) {
    const fileALink = fileExists(c.fileA) ? `[[${c.fileA}]]` : c.fileA
    const fileBLink = fileExists(c.fileB) ? `[[${c.fileB}]]` : c.fileB
    md += `### ${c.topic}

**${fileALink} says:**
> "${c.quoteA || 'X'}"

**${fileBLink} says:**
> "${c.quoteB || 'Y'}"

**The Contradiction:** ${c.explanation}

**Resolution:** ${c.resolution || 'TBD'}

`
  }
  
  md += `---
*When resolved, update source files with resolution comments, then delete from here.*
`
  
  writeFileSync(DISSONANCE_FILE, md)
  return uniqueNew.length
}

function updateCuriosities(newCs) {
  const existing = readCuriosities()
  
  const uniqueNew = newCs.filter(nc => {
    return !existing.some(ec => 
      ec.question.toLowerCase() === nc.question.toLowerCase() ||
      (ec.source && nc.source && ec.source.includes(nc.source))
    )
  })
  
  if (uniqueNew.length === 0) return 0
  
  let md = existsSync(CURIOSITIES_FILE) ? readFileSync(CURIOSITIES_FILE, 'utf-8') : ''
  
  if (!md.includes('## Questions')) {
    md = `# Curiosities

> Questions worth exploring. #curiosity #questions

---

## Questions

`
  }
  
  for (const c of uniqueNew) {
    const sourceLink = fileExists(c.source) ? `[[${c.source}]]` : c.source
    md += `- **${c.question}**

  Source: ${sourceLink}
  Why: ${c.why}

`
  }
  
  md += `---
*When answered, delete from this file.*
`
  
  writeFileSync(CURIOSITIES_FILE, md)
  return uniqueNew.length
}

function updateMAP(cons, cs) {
  if (!existsSync(MAP_FILE)) return
  
  let content = readFileSync(MAP_FILE, 'utf-8')
  const section = `## 🧠 Mind Health

**→ [[mind/DISSONANCE|Cognitive Dissonance]]** — ${cons.length} contradictions #dissonance
**→ [[mind/CURIOSITIES|Curiosities]]** — ${cs.length} questions #curiosity

`
  
  if (content.includes('## 🧠 Mind Health')) {
    const i = content.indexOf('## 🧠 Mind Health')
    const j = content.indexOf('## ', i + 10)
    content = content.slice(0, i) + section + content.slice(j)
  }
  
  writeFileSync(MAP_FILE, content)
}

function createSessionLog(cons, cs) {
  const file = join(MEMORY_SESSIONS_DIR, `${TODAY}-dreamer.md`)
  const log = `---
date: ${TODAY}
tags:
  - session
  - dreamer
type: dreamer
---

# Dreamer Scan — ${TODAY}

**Contradictions:** ${cons.length}
${cons.map(c => `- ${c.topic}: ${c.fileA} vs ${c.fileB}`).join('\n') || 'None'}

**Curiosities:** ${cs.length}
${cs.map(c => `- ${c.question.slice(0, 50)}...`).join('\n') || 'None'}

---
*Dreamer: ${TODAY} ${TIMESTAMP}*
`
  writeFileSync(file, log)
}

// MAIN
console.log('🌀 Dreamer Loop...\n')

const files = readMindFiles()
console.log(`📖 Scanned ${files.length} files`)

const tracked = getTrackedPairs()
console.log(`📖 Tracked ${tracked.pairs.length} file pairs`)

const existingD = readDissonances()
const existingC = readCuriosities()
console.log(`📖 Read ${existingD.length} contradictions, ${existingC.length} curiosities\n`)

// Get file list
const fileList = files.slice(0, 15).map(f => {
  const content = f.content.slice(0, 200).replace(/\n+/g, ' ')
  return `- ${f.path}: ${content}...`
}).join('\n')

// Ask for contradictions - but only find NEW ones from UNTRACKED pairs
const dQ = `You are scanning a mind for CONTRADICTIONS.

EXISTING CONTRADICTIONS (don't repeat):
${existingD.length > 0 ? existingD.map(d => `- ${d.topic}`).join('\n') : 'None'}

FILES:
${fileList}

Find 1-2 NEW contradictions where File A says X but File B says Y (opposite).

Output:
CONTRADICTION: <name>
FILE_A: <path>
FILE_B: <path>
QUOTE_A: <exact quote from FILE_A>
QUOTE_B: <exact quote from FILE_B (opposite)>
EXPLANATION: <how they contradict>
RESOLUTION: <how to resolve>

Or output "NONE" if no new contradictions.

CRITICAL: Must provide exact quotes, not placeholders.`

const dR = askOllama(dQ)
const newD = []

if (dR && !dR.toUpperCase().includes('NONE')) {
  const lines = dR.split('\n')
  let c = {}
  for (const line of lines) {
    if (line.startsWith('CONTRADICTION:')) c.topic = line.replace('CONTRADICTION:', '').trim()
    if (line.startsWith('FILE_A:')) c.fileA = line.replace('FILE_A:', '').trim()
    if (line.startsWith('FILE_B:')) c.fileB = line.replace('FILE_B:', '').trim()
    if (line.startsWith('QUOTE_A:')) c.quoteA = line.replace('QUOTE_A:', '').trim()
    if (line.startsWith('QUOTE_B:')) c.quoteB = line.replace('QUOTE_B:', '').trim()
    if (line.startsWith('EXPLANATION:')) c.explanation = line.replace('EXPLANATION:', '').trim()
    if (line.startsWith('RESOLUTION:')) {
      c.resolution = line.replace('RESOLUTION:', '').trim()
      const isValid = c.topic && c.fileA && c.fileB && c.quoteA && c.quoteB &&
                      c.quoteA.length > 10 && c.quoteB.length > 10 &&
                      !c.quoteA.match(/^[XY]$/) && !c.quoteB.match(/^[XY]$/)
      if (isValid) {
        const exists = existingD.some(e => 
          e.topic.toLowerCase() === c.topic.toLowerCase() ||
          (e.sourceA && c.fileA && e.sourceA.includes(c.fileA) && e.sourceB && c.fileB && e.sourceB.includes(c.fileB))
        )
        // Also check if this pair was already scanned
        const alreadyScanned = isPairTracked(c.fileA, c.fileB, tracked)
        if (!exists && !alreadyScanned) {
          newD.push({...c})
          markPairTracked(c.fileA, c.fileB, tracked)
        }
      }
      c = {}
    }
  }
}

// Ask for curiosities
const cQ = `You are scanning a mind for CURIOSITIES (questions worth exploring).

EXISTING CURIOSITIES (don't repeat):
${existingC.length > 0 ? existingC.map(c => `- ${c.question}`).join('\n') : 'None'}

FILES:
${fileList}

Find 1-2 NEW questions worth exploring.

Output:
QUESTION: <question>
SOURCE: <path that sparked this>
WHY: <why interesting>

Or output "NONE".`

const cR = askOllama(cQ)
const newC = []

if (cR && !cR.toUpperCase().includes('NONE')) {
  const lines = cR.split('\n')
  let q = {}
  for (const line of lines) {
    if (line.startsWith('QUESTION:')) q.question = line.replace('QUESTION:', '').trim()
    if (line.startsWith('SOURCE:')) q.source = line.replace('SOURCE:', '').trim()
    if (line.startsWith('WHY:')) {
      q.why = line.replace('WHY:', '').trim()
      if (q.question && q.source && q.why) {
        const exists = existingC.some(e => 
          e.question.toLowerCase() === q.question.toLowerCase() ||
          (e.source && q.source && e.source.includes(q.source))
        )
        if (!exists) newC.push({...q})
      }
      q = {}
    }
  }
}

console.log(`🎯 Found ${newD.length} NEW contradictions`)
for (const d of newD) {
  console.log(`  🔥 ${d.topic}`)
}

console.log(`\n🎯 Found ${newC.length} NEW curiosities`)
for (const c of newC) {
  console.log(`  ❓ ${c.question.slice(0, 60)}...`)
}

const dAdded = updateDissonance(newD)
const cAdded = updateCuriosities(newC)
updateMAP([...existingD, ...newD], [...existingC, ...newC])
saveTrackedPairs(tracked)

if (dAdded > 0) console.log(`\n✅ Added ${dAdded} contradiction(s) to DISSONANCE.md`)
if (cAdded > 0) console.log(`✅ Added ${cAdded} curiosity/ies to CURIOSITIES.md`)
if (dAdded === 0 && cAdded === 0) console.log('\n✅ No new found')

createSessionLog(newD, newC)
console.log('\n✨ Dreamer complete!')
