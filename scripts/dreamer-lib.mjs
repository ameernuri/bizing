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
  // Improved contradiction detection - looks for actual conflicting statements
  const contentA = fileA.content.toLowerCase()
  const contentB = fileB.content.toLowerCase()
  
  // Split into paragraphs for context
  const paragraphsA = contentA.split('\n\n').filter(p => p.trim().length > 50)
  const paragraphsB = contentB.split('\n\n').filter(p => p.trim().length > 50)
  
  // Look for substantive contradictions (not just word matches)
  const contradictionPatterns = [
    {
      // Direct rule conflicts: "always do X" vs "never do X"
      pattern: /(?:^|\n)(?:>|\s*-\s*|\*\s*|\d+\.\s*)(?:always|must|required|mandatory).{10,100}/i,
      oppositePattern: /(?:^|\n)(?:>|\s*-\s*|\*\s*|\d+\.\s*)(?:never|must not|forbidden|prohibited).{10,100}/i,
      description: (matchA, matchB) => `Rule conflict: "${matchA.substring(0, 60)}..." vs "${matchB.substring(0, 60)}..."`
    },
    {
      // Definition conflicts about what something IS
      pattern: /(?:bizing|system|agent|mind)\s+(?:is|are)\s+(?:not\s+)?[a-z\s]{10,80}(?:\.|,|;)/i,
      check: (matchA, matchB) => {
        // Both files define the same thing differently
        const subjectA = matchA.match(/^(\w+)/i)?.[0]
        const subjectB = matchB.match(/^(\w+)/i)?.[0]
        const negA = matchA.includes(' is not ') || matchA.includes(' are not ')
        const negB = matchB.includes(' is not ') || matchB.includes(' are not ')
        return subjectA && subjectB && subjectA === subjectB && negA !== negB
      },
      description: (matchA, matchB) => `Definition conflict: "${matchA.substring(0, 70)}..." contradicts "${matchB.substring(0, 70)}..."`
    },
    {
      // Workflow conflicts: "do X first" vs "do Y first"
      pattern: /(?:first|start with|begin by)\s+.{10,60}(?:then|before|after)/i,
      oppositePattern: /(?:first|start with|begin by)\s+.{10,60}(?:then|before|after)/i,
      check: (matchA, matchB) => {
        // Extract the "first" actions
        const firstA = matchA.match(/(?:first|start with|begin by)\s+(.{10,40}?)(?:then|before|after|\.)/i)?.[1]
        const firstB = matchB.match(/(?:first|start with|begin by)\s+(.{10,40}?)(?:then|before|after|\.)/i)?.[1]
        return firstA && firstB && firstA !== firstB && 
               !firstA.includes(firstB) && !firstB.includes(firstA)
      },
      description: (matchA, matchB) => `Workflow conflict: Different first steps required`
    },
    {
      // Priority conflicts: "X is critical" vs "X is optional"
      pattern: /(?:critical|essential|required|mandatory|must)/i,
      oppositePattern: /(?:optional|unnecessary|not required|can skip)/i,
      check: (matchA, matchB) => {
        // Check if they're talking about the same subject
        const wordsA = matchA.split(/\s+/).slice(0, 10)
        const wordsB = matchB.split(/\s+/).slice(0, 10)
        const commonWords = wordsA.filter(w => wordsB.includes(w) && w.length > 4)
        return commonWords.length >= 2
      },
      description: (matchA, matchB) => `Priority conflict: Same subject has conflicting importance levels`
    }
  ]
  
  // Check each pattern
  for (const { pattern, oppositePattern, check, description } of contradictionPatterns) {
    for (const paraA of paragraphsA.slice(0, 20)) { // Limit to first 20 substantial paragraphs
      if (!pattern.test(paraA)) continue
      
      const matchA = paraA.match(pattern)?.[0]
      if (!matchA) continue
      
      for (const paraB of paragraphsB.slice(0, 20)) {
        const matchB = oppositePattern ? paraB.match(oppositePattern)?.[0] : paraB.match(pattern)?.[0]
        if (!matchB) continue
        
        // Run custom check if provided, or basic validation
        const isValidContradiction = check ? check(matchA, matchB) : true
        
        if (isValidContradiction) {
          return description(matchA, matchB)
        }
      }
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
      const questionKey = typeof q === 'string' ? q : q.question
      if (!isPairTracked(file.path, questionKey, tracked)) {
        markPairTracked(file.path, questionKey, tracked)
        const curiosity = {
          source: file.path,
          question: q,
          type: 'question',
          foundAt: new Date().toISOString(),
          context: typeof q === 'object' ? q.context : 'From daydreaming'
        }
        newCuriosities.push(curiosity)
        writeCuriosityFile(curiositiesDir, curiosity)
      }
    }
    
    for (const g of gaps) {
      const gapKey = typeof g === 'string' ? g : g.question
      if (!isPairTracked(file.path, gapKey, tracked)) {
        markPairTracked(file.path, gapKey, tracked)
        const curiosity = {
          source: file.path,
          question: g,
          type: 'gap',
          foundAt: new Date().toISOString(),
          context: typeof g === 'object' ? g.context : 'From daydreaming'
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
  const paragraphs = content.split('\n\n').filter(p => p.trim().length > 30)
  
  // Pattern 1: Explicit questions with context (substantial)
  const questionPatterns = [
    // Questions that start with question words and are substantial
    /(?:^|\n)(?:#{1,3}\s*)?(?:how|what|why|when|where|who|which)\s+(?:might|would|could|should|is|are|does|do|can|will)\s+[^?]{15,150}[?]/i,
    // Questions about implications or effects
    /(?:^|\n)(?:#{1,3}\s*)?(?:what\s+if|how\s+does|why\s+is|what\s+would|what\s+about)\s+[^?]{15,150}[?]/i
  ]
  
  for (const paragraph of paragraphs.slice(0, 30)) {
    for (const pattern of questionPatterns) {
      const matches = paragraph.match(new RegExp(pattern, 'gi')) || []
      for (const match of matches) {
        const trimmed = match.trim()
        // Only include if it's a substantial question (not just "What is this?")
        if (trimmed.length > 30 && trimmed.length < 200) {
          // Extract context: sentence before and after
          const paraContext = paragraph.split(trimmed)[0]?.split('.').slice(-2).join('.').trim()
          if (paraContext && paraContext.length > 20) {
            questions.push({
              question: trimmed,
              context: `Context: "${paraContext.substring(0, 100)}..."`
            })
          } else {
            questions.push({
              question: trimmed,
              context: "From a section exploring concepts and possibilities"
            })
          }
        }
      }
    }
  }
  
  // Pattern 2: Hypotheses and speculative statements (not questions but worth exploring)
  const hypothesisPattern = /(?:imagine|consider|explore|perhaps|maybe|possibly)\s+(?:if|that|how|what)\s+.{20,150}[.]/i
  for (const paragraph of paragraphs.slice(0, 20)) {
    const matches = paragraph.match(hypothesisPattern) || []
    for (const match of matches) {
      const trimmed = match.trim()
      if (trimmed.length > 30 && trimmed.length < 180) {
        questions.push({
          question: `Exploration: "${trimmed.substring(0, 100)}${trimmed.length > 100 ? '...' : ''}"`,
          context: "A speculative idea worth developing into a concrete question"
        })
      }
    }
  }
  
  // Limit to avoid spam but keep quality
  return questions.slice(0, 5)
}

function findKnowledgeGaps(content) {
  const gaps = []
  const paragraphs = content.split('\n\n').filter(p => p.trim().length > 40)
  
  // Pattern 1: Explicit gaps with context
  const gapPatterns = [
    // "TODO: " or similar markers with substantial content
    {
      pattern: /(?:todo|fixme|hack|temp|temporary|placeholder)[\s:](?:\s*[-\*]?\s*)(.{10,120})/i,
      explanation: (match) => `Implementation needed: "${match[1].trim()}"`
    },
    // "Not yet" or "needs" statements
    {
      pattern: /(?:not yet|needs?|missing|lacks?|without)\s+(.{10,100})/i,
      explanation: (match) => `Gap identified: "${match[1].trim()}"`
    },
    // Future work or next steps
    {
      pattern: /(?:future|next|upcoming|planned|roadmap)[\s:]\s*(?:[-\*]?\s*)(.{10,120})/i,
      explanation: (match) => `Future work: "${match[1].trim()}"`
    },
    // Uncertainty markers
    {
      pattern: /(?:uncertain|unclear|unknown|undecided|not sure)\s+(?:about|if|whether|how)\s+(.{10,100})/i,
      explanation: (match) => `Uncertainty: "${match[1].trim()}"`
    }
  ]
  
  for (const paragraph of paragraphs.slice(0, 25)) {
    for (const { pattern, explanation } of gapPatterns) {
      const matches = paragraph.match(new RegExp(pattern, 'gi')) || []
      for (const matchText of matches) {
        const match = matchText.match(pattern)
        if (match) {
          const desc = explanation(match)
          // Get surrounding context
          const contextMatch = paragraph.match(/[^.]*(?:this|that|these|those|here|there)[^.]*[.]/i)
          const context = contextMatch ? contextMatch[0].substring(0, 80) : paragraph.substring(0, 80)
          
          gaps.push({
            question: desc,
            context: `Found in: "${context}..."`
          })
        }
      }
    }
  }
  
  // Pattern 2: Incomplete sections or stubs
  const stubPattern = /(?:section|part|area|aspect)\s+(?:to be|will be|should be)\s+(?:written|defined|documented|completed)/i
  for (const paragraph of paragraphs.slice(0, 15)) {
    if (stubPattern.test(paragraph)) {
      const topicMatch = paragraph.match(/(?:about|for|on)\s+(.{5,50})/i)
      const topic = topicMatch ? topicMatch[1] : 'this topic'
      gaps.push({
        question: `Incomplete documentation: Section about ${topic}`,
        context: "Content stub found that needs completion"
      })
    }
  }
  
  return gaps.slice(0, 5)
}

function writeCuriosityFile(curiositiesDir, curiosity) {
  const date = new Date().toISOString().split('T')[0]
  
  // Handle both old format (string) and new format (object with question/context)
  const questionText = typeof curiosity.question === 'string' ? curiosity.question : curiosity.question.question
  const contextText = curiosity.context || curiosity.question?.context || 'From daydreaming through the mind'
  
  const title = questionText.substring(0, 70)
  const sanitizedTitle = sanitizeFilename(title)
  const filename = `${date}-${sanitizedTitle}.md`
  const filepath = join(curiositiesDir, filename)
  
  // Check if file already exists (avoid duplicates)
  if (existsSync(filepath)) {
    return
  }
  
  const content = `# ${title}${questionText.length > 70 ? '...' : ''}

**Status:** Open  
**Created:** ${date}  
**Type:** ${curiosity.type === 'gap' ? 'Knowledge Gap' : 'Exploration Question'}

## Source

[[${curiosity.source}]]

## The Question

${questionText}

## Context

${contextText}

## Why Explore This?

This ${curiosity.type === 'gap' ? 'gap' : 'question'} was discovered while daydreaming through the mind. Exploring it may lead to:
- New insights about how Bizing works
- Better understanding of the knowledge structure
- Opportunities for improvement or clarification

## Related Ideas

*Consider linking to related files or concepts as they emerge*

## Next Steps

- [ ] Investigate this further
- [ ] Link to related concepts
- [ ] Develop into a concrete proposal or solution

## Tags

#curiosity #${curiosity.type} #auto-detected #exploration
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
