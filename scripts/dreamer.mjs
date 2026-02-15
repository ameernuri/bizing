#!/usr/bin/env node
/**
 * Dreamer — Autonomous Mind Scanner
 * 
 * Finds CONTRADICTIONS: When File A says X but File B says Y (opposite)
 * Finds CURIOSITIES: Questions worth exploring
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
const MEMORY_SESSIONS_DIR = join(MIND_DIR, 'memory/sessions')

const TODAY = new Date().toISOString().split('T')[0]
const TIMESTAMP = new Date().toLocaleString('en-US', { 
  timeZone: 'America/Los_Angeles', 
  hour: '2-digit', 
  minute: '2-digit', 
  timeZoneName: 'short' 
})

// Ask Ollama
function askOllama(prompt) {
  try {
    const r = spawnSync('bash', ['-lc', `printf '%s\\n' "${prompt.replace(/"/g, '\\"')}" | ollama run llama3.1:8b`], { 
      encoding: 'utf-8', 
      timeout: 120000 
    })
    return r.stdout?.replace(/\x1B\[[0-9;]*[mG]/g, '').replace(/\n+/g, '\n').trim() || null
  } catch (e) { 
    console.log('Ollama error:', e.message)
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
        try { files.push({ path: path.replace(MIND_DIR + '/', ''), content: readFileSync(path, 'utf-8') }) } catch (e) {}
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
  const topics = []
  for (const line of content.split('\n')) {
    if (line.startsWith('### ')) topics.push(line.replace('### ', '').trim())
  }
  return topics
}

function readCuriosities() {
  if (!existsSync(CURIOSITIES_FILE)) return []
  const content = readFileSync(CURIOSITIES_FILE, 'utf-8')
  const qs = []
  for (const line of content.split('\n')) {
    if (line.startsWith('- **')) qs.push(line.replace('- **', '').replace('**', '').trim())
  }
  return qs
}

function fileExists(path) {
  return existsSync(join(MIND_DIR, path))
}

// Update files
function updateDissonance(cons) {
  if (cons.length === 0) return 0
  let md = `# Cognitive Dissonance

> Real conflicts where different files say different things. #dissonance #conflict

---

## What Is This File?

**COGNITIVE DISSONANCE** = when File A and File B **contradict** each other.

---

## Active Contradictions

`
  for (const c of cons) {
    const a = fileExists(c.fileA) ? `[[${c.fileA}]]` : c.fileA
    const b = fileExists(c.fileB) ? `[[${c.fileB}]]` : c.fileB
    md += `### ${c.topic}

**${a} says:**
> "${c.quoteA || 'X'}"

**${b} says:**
> "${c.quoteB || 'Y'}"

**The Contradiction:** ${c.explanation}

**Resolution:** ${c.resolution || 'TBD'}

`
  }
  md += `---
*When resolved, update source files with resolution, then delete from here.*
`
  writeFileSync(DISSONANCE_FILE, md)
  return cons.length
}

function updateCuriosities(cs) {
  if (cs.length === 0) return 0
  let md = `# Curiosities

> Questions worth exploring. #curiosity #questions

---

## Questions

`
  for (const c of cs) {
    const s = fileExists(c.source) ? `[[${c.source}]]` : c.source
    md += `- **${c.question}**

  Source: ${s}
  Why: ${c.why}

`
  }
  md += `---
*When answered, delete from this file.*
`
  writeFileSync(CURIOSITIES_FILE, md)
  return cs.length
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

const existingD = readDissonances()
const existingC = readCuriosities()
console.log(`📖 Read ${existingD.length} contradictions, ${existingC.length} curiosities\n`)

// Get file list for Ollama
const fileList = files.slice(0, 20).map(f => `- ${f.path}: ${f.content.slice(0, 150)}...`).join('\n')

// Ask for contradictions
const dQ = `You are scanning a mind for CONTRADICTIONS.

A CONTRADICTION is when File A says X but File B says Y (opposite).

EXISTING: ${existingD.join(' | ') || 'NONE'}

FILES:
${fileList}

Find 1-2 NEW contradictions. Output:
CONTRADICTION: <name>
FILE_A: <path>
FILE_B: <path>
QUOTE_A: <what file A says>
QUOTE_B: <what file B says (opposite)>
EXPLANATION: <how they contradict>
RESOLUTION: <how to resolve>

Or output "NONE" if none found.`

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
      if (c.topic && c.fileA && c.fileB && c.explanation) {
        const exists = existingD.some(e => e.toLowerCase().includes(c.topic.toLowerCase()))
        if (!exists) newD.push({...c})
      }
      c = {}
    }
  }
}

// Ask for curiosities
const cQ = `You are scanning a mind for CURIOSITIES (questions worth exploring, NOT contradictions).

EXISTING: ${existingC.join(' | ') || 'NONE'}

FILES:
${fileList}

Find 1-2 NEW questions. Output:
QUESTION: <question>
SOURCE: <path that sparked this>
WHY: <why interesting>

Or output "NONE" if none found.`

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
      if (q.question && q.source) {
        const exists = existingC.some(e => e.toLowerCase().includes(q.question.toLowerCase()))
        if (!exists) newC.push({...q})
      }
      q = {}
    }
  }
}

console.log(`🎯 Found ${newD.length} NEW contradictions`)
for (const d of newD) console.log(`  🔥 ${d.topic}: ${d.fileA} vs ${d.fileB}`)

console.log(`\n🎯 Found ${newC.length} NEW curiosities`)
for (const c of newC) console.log(`  ❓ ${c.question.slice(0, 50)}...`)

const dAdded = updateDissonance(newD)
const cAdded = updateCuriosities(newC)
updateMAP(newD, newC)

if (dAdded > 0) console.log(`\n✅ Updated DISSONANCE.md with ${dAdded}`)
if (cAdded > 0) console.log(`✅ Updated CURIOSITIES.md with ${cAdded}`)

if (dAdded === 0 && cAdded === 0) console.log('\n✅ No new found')

createSessionLog(newD, newC)
console.log('\n✨ Dreamer complete!')
