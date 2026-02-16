/**
 * Dreamer Library - Core scanning functions for Bizing's mind
 * Used by both dreamer.mjs and daydreamer.mjs
 */

import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

// ============ CONFIGURATION ============

const TODAY = new Date().toISOString().split('T')[0]

// ============ FILE UTILITIES ============

export function readMindFiles(mindDir) {
  const files = []
  
  function traverse(dir, relative = '') {
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const path = join(dir, entry.name)
        const relPath = join(relative, entry.name)
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          traverse(path, relPath)
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          try {
            files.push({
              path: relPath,
              content: readFileSync(path, 'utf-8'),
              name: entry.name.replace('.md', '')
            })
          } catch (e) {}
        }
      }
    } catch (e) {
      // Directory might not exist
    }
  }
  
  traverse(mindDir)
  return files
}

export function getTrackedPairs(trackedPairsFile) {
  try {
    if (existsSync(trackedPairsFile)) {
      const data = JSON.parse(readFileSync(trackedPairsFile, 'utf-8'))
      // Ensure pairs is an array
      if (!Array.isArray(data.pairs)) {
        return { pairs: [], lastScan: null }
      }
      return data
    }
  } catch (e) {}
  return { pairs: [], lastScan: null }
}

export function saveTrackedPairs(trackedPairsFile, pairs) {
  const dir = dirname(trackedPairsFile)
  try {
    mkdirSync(dir, { recursive: true })
  } catch (e) {}
  
  writeFileSync(trackedPairsFile, JSON.stringify({ 
    pairs: Array.isArray(pairs) ? pairs : [], 
    lastScan: TODAY 
  }, null, 2))
}

export function isPairTracked(fileA, fileB, tracked) {
  if (!Array.isArray(tracked.pairs)) return false
  const pairKey = [fileA, fileB].sort().join('|')
  return tracked.pairs.includes(pairKey)
}

export function markPairTracked(fileA, fileB, tracked) {
  const pairKey = [fileA, fileB].sort().join('|')
  if (!tracked.pairs.includes(pairKey)) {
    tracked.pairs.push(pairKey)
  }
}

// ============ DISSONANCE SCANNING ============

export async function scanForDissonances(mindDir) {
  const files = readMindFiles(mindDir)
  const dissonanceDir = join(mindDir, 'dissonance')
  const trackedPairsFile = join(mindDir, '.daydreamer', 'dissonance-pairs.json')
  
  // Ensure dissonance directory exists
  try {
    mkdirSync(dissonanceDir, { recursive: true })
  } catch (e) {}
  
  const tracked = getTrackedPairs(trackedPairsFile)
  const newDissonances = []
  let pairsChecked = 0
  
  // Check a sample of file pairs (not all, to save time)
  const sampleSize = Math.min(50, files.length)
  const sampleFiles = files.slice(0, sampleSize)
  
  for (let i = 0; i < sampleFiles.length; i++) {
    for (let j = i + 1; j < sampleFiles.length; j++) {
      const fileA = sampleFiles[i]
      const fileB = sampleFiles[j]
      
      if (isPairTracked(fileA.path, fileB.path, tracked)) continue
      
      pairsChecked++
      markPairTracked(fileA.path, fileB.path, tracked)
      
      // Simple heuristic: look for opposite keywords
      const contradiction = findContradiction(fileA, fileB)
      if (contradiction) {
        const dissonance = {
          files: [fileA.path, fileB.path],
          description: contradiction,
          foundAt: new Date().toISOString()
        }
        newDissonances.push(dissonance)
        
        // Write individual file
        writeDissonanceFile(dissonanceDir, dissonance)
      }
      
      // Limit checks per run
      if (pairsChecked >= 100) break
    }
    if (pairsChecked >= 100) break
  }
  
  // Save tracked pairs
  saveTrackedPairs(trackedPairsFile, tracked.pairs)
  
  return {
    newCount: newDissonances.length,
    pairsChecked,
    dissonances: newDissonances
  }
}

function findContradiction(fileA, fileB) {
  // Simple contradiction detection
  const contentA = fileA.content.toLowerCase()
  const contentB = fileB.content.toLowerCase()
  
  // Check for opposing concepts
  const opposites = [
    ['always', 'never'],
    ['must', 'must not'],
    ['is', 'is not'],
    ['can', 'cannot'],
    ['should', 'should not'],
    ['important', 'unimportant'],
    ['always', 'sometimes'],
    ['true', 'false']
  ]
  
  for (const [wordA, wordB] of opposites) {
    const hasA = contentA.includes(wordA) && contentB.includes(wordB)
    const hasB = contentA.includes(wordB) && contentB.includes(wordA)
    
    if (hasA || hasB) {
      return `Opposing concepts: "${wordA}" vs "${wordB}"`
    }
  }
  
  return null
}

function sanitizeFilename(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50)
}

function writeDissonanceFile(dissonanceDir, dissonance) {
  const date = new Date().toISOString().split('T')[0]
  const title = dissonance.description.split(':')[0] || 'contradiction-found'
  const sanitizedTitle = sanitizeFilename(title)
  const filename = `${date}-${sanitizedTitle}.md`
  const filepath = join(dissonanceDir, filename)
  
  // Check if file already exists (avoid duplicates)
  if (existsSync(filepath)) {
    return
  }
  
  const content = `# ${title}

**Status:** Active  
**Created:** ${date}

## Contradiction

**[[${dissonance.files[0]}]]** and **[[${dissonance.files[1]}]]**

## The Conflict

${dissonance.description}

## Resolution

*To be determined*

## Tags

#dissonance #auto-detected
`
  
  writeFileSync(filepath, content)
}

// ============ CURIOSITY SCANNING ============

export async function scanForCuriosities(mindDir) {
  const files = readMindFiles(mindDir)
  const curiositiesDir = join(mindDir, 'curiosities')
  const trackedPairsFile = join(mindDir, '.daydreamer', 'curiosity-pairs.json')
  
  // Ensure curiosities directory exists
  try {
    mkdirSync(curiositiesDir, { recursive: true })
  } catch (e) {}
  
  const tracked = getTrackedPairs(trackedPairsFile)
  const newCuriosities = []
  
  // Sample files to check
  const sampleFiles = files.slice(0, 30)
  
  for (const file of sampleFiles) {
    // Look for question patterns and incomplete thoughts
    const questions = extractQuestions(file.content)
    const gaps = findKnowledgeGaps(file.content)
    
    for (const q of questions) {
      if (!isPairTracked(file.path, q, tracked)) {
        markPairTracked(file.path, q, tracked)
        const curiosity = {
          source: file.path,
          question: q,
          type: 'question',
          foundAt: new Date().toISOString()
        }
        newCuriosities.push(curiosity)
        writeCuriosityFile(curiositiesDir, curiosity)
      }
    }
    
    for (const g of gaps) {
      if (!isPairTracked(file.path, g, tracked)) {
        markPairTracked(file.path, g, tracked)
        const curiosity = {
          source: file.path,
          question: g,
          type: 'gap',
          foundAt: new Date().toISOString()
        }
        newCuriosities.push(curiosity)
        writeCuriosityFile(curiositiesDir, curiosity)
      }
    }
  }
  
  saveTrackedPairs(trackedPairsFile, tracked.pairs)
  
  return {
    newCount: newCuriosities.length,
    curiosities: newCuriosities
  }
}

function extractQuestions(content) {
  const questions = []
  const lines = content.split('\n')
  
  for (const line of lines) {
    // Match explicit questions
    if (line.trim().endsWith('?')) {
      questions.push(line.trim())
    }
    // Match "How might..." patterns
    if (line.match(/how might|what if|why does|can we/i)) {
      questions.push(line.trim())
    }
  }
  
  // Limit to avoid spam
  return questions.slice(0, 3)
}

function findKnowledgeGaps(content) {
  const gaps = []
  
  // Look for "TODO", "FIXME", "not yet", etc.
  const patterns = [
    /todo[:\s]/i,
    /fixme[:\s]/i,
    /not yet[:\s]/i,
    /need to[:\s]/i,
    /should[:\s]/i
  ]
  
  const lines = content.split('\n')
  for (const line of lines) {
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        gaps.push(line.trim())
        break
      }
    }
  }
  
  return gaps.slice(0, 3)
}

function writeCuriosityFile(curiositiesDir, curiosity) {
  const date = new Date().toISOString().split('T')[0]
  const title = curiosity.question.substring(0, 80)
  const sanitizedTitle = sanitizeFilename(title)
  const filename = `${date}-${sanitizedTitle}.md`
  const filepath = join(curiositiesDir, filename)
  
  // Check if file already exists (avoid duplicates)
  if (existsSync(filepath)) {
    return
  }
  
  const content = `# ${title}${curiosity.question.length > 80 ? '...' : ''}

**Status:** Open  
**Created:** ${date}

## Source

[[${curiosity.source}]]

## Question

${curiosity.question}

## Why This Matters

*Auto-generated curiosity from daydreaming*

## Tags

#curiosity #${curiosity.type} #auto-detected
`
  
  writeFileSync(filepath, content)
}

// ============ MIND MAPPING ============

export async function mapMind(mindDir) {
  const files = readMindFiles(mindDir)
  
  const map = {
    generatedAt: new Date().toISOString(),
    totalFiles: files.length,
    categories: {},
    keyConcepts: [],
    connections: []
  }
  
  // Categorize files
  for (const file of files) {
    const category = file.path.split('/')[0] || 'uncategorized'
    map.categories[category] = (map.categories[category] || 0) + 1
  }
  
  // Extract key concepts from filenames
  for (const file of files) {
    const concepts = file.name
      .replace(/\.md$/, '')
      .split(/[-_]/)
      .filter(w => w.length > 3)
      .map(w => w.toLowerCase())
    
    for (const concept of concepts) {
      if (!map.keyConcepts.includes(concept)) {
        map.keyConcepts.push(concept)
      }
    }
  }
  
  // Limit concepts
  map.keyConcepts = map.keyConcepts.slice(0, 50)
  
  return map
}

// ============ STATUS ============

export async function getDreamerStatus(mindDir) {
  const stateFile = join(mindDir, '.daydreamer', 'state.json')
  
  try {
    const state = JSON.parse(readFileSync(stateFile, 'utf-8'))
    return state
  } catch (e) {
    return {
      totalTasksCompleted: 0,
      lastTask: null,
      startedAt: null
    }
  }
}
