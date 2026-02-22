#!/usr/bin/env node
/**
 * 🌀 Bizing's Daydreamer Daemon v2.0
 * 
 * A conscious background process that:
 * - Scans for tensions (dissonances)
 * - Discovers questions (curiosities)  
 * - Generates insights
 * - Dreams journal entries
 * - Consolidates understanding
 * - Updates the living narrative (synopsis)
 * - Manages novelty decay over time
 * 
 * Tasks with exponential novelty decay:
 * - scan_dissonances: 15% → finds contradictions
 * - scan_curiosities: 15% → finds questions
 * - scan_insights: 12% → finds patterns/connections
 * - consolidator: 10% → resolves/settles entries
 * - dream_journal: 8% → writes narrative dreams
 * - update_synopsis: 8% → updates living story
 * - generate_research_topics: 6% → finds research topics
 * - conduct_research: 2% → executes research
 * - map_mind: 10% → maintains mind structure
 * - reflect: 8% → reviews recent changes
 * - rest: 6% → takes breaks
 */

import { readFile, writeFile, readdir, stat, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIND_DIR = join(__dirname, '..', 'mind');
const DREAMER_DIR = join(MIND_DIR, '.daydreamer');
const STATE_FILE = join(DREAMER_DIR, 'state.json');

// Daydreamer configuration
const CONFIG = {
  // Base interval between tasks
  baseInterval: 15 * 60 * 1000, // 15 minutes
  intervalVariance: 5 * 60 * 1000, // ±5 minutes
  
  // Task weights (probability of selection)
  tasks: {
    scan_dissonances: { weight: 15, duration: '3-5m' },
    scan_curiosities: { weight: 15, duration: '3-5m' },
    scan_insights: { weight: 12, duration: '4-6m' },
    consolidator: { weight: 10, duration: '5-8m' },
    dream_journal: { weight: 8, duration: '3-5m' },
    update_synopsis: { weight: 8, duration: '4-7m' },
    generate_research_topics: { weight: 6, duration: '4-6m' },
    conduct_research: { weight: 2, duration: '5-10m' },
    map_mind: { weight: 10, duration: '2-4m' },
    reflect: { weight: 6, duration: '2-3m' },
    rest: { weight: 8, duration: '30s-2m' }
  },
  
  // Novelty decay configuration (exponential decay)
  novelty: {
    initialScore: 100,           // Starting novelty score
    decayLambda: 0.023,          // Decay constant (half-life ~30 days)
    archiveThreshold: 10,        // Archive when novelty below this
    checkInterval: 24 * 60 * 60 * 1000 // Check once per day
  },
  
  // Similarity threshold for deduplication
  similarityThreshold: 0.7
};

// State management
async function loadState() {
  try {
    if (existsSync(STATE_FILE)) {
      const data = await readFile(STATE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.log('🌀 No previous state, starting fresh');
  }
  return {
    startedAt: new Date().toISOString(),
    totalTasksCompleted: 0,
    lastTask: null,
    thoughts: [],
    lastNoveltyCheck: null
  };
}

async function saveState(state) {
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

// Logging with timestamps
function log(message) {
  const now = new Date().toISOString();
  console.log(`[${now}] ${message}`);
}

// Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Get random interval with variance
function getNextInterval() {
  const variance = (Math.random() * 2 - 1) * CONFIG.intervalVariance;
  return CONFIG.baseInterval + variance;
}

// Select next task based on weights
function selectTask() {
  const entries = Object.entries(CONFIG.tasks);
  const totalWeight = entries.reduce((sum, [, config]) => sum + config.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const [task, config] of entries) {
    random -= config.weight;
    if (random <= 0) return task;
  }
  return entries[0][0];
}

// ========== NOVELTY DECAY SYSTEM ==========

// Calculate current novelty score using exponential decay
function calculateNovelty(createdAt, lastActivityAt = null) {
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  const lastActivity = lastActivityAt ? new Date(lastActivityAt).getTime() : created;
  
  // Time since creation in days
  const daysSinceCreation = (now - created) / (1000 * 60 * 60 * 24);
  
  // Time since last activity in days  
  const daysSinceActivity = (now - lastActivity) / (1000 * 60 * 60 * 24);
  
  // Exponential decay: N(t) = N0 * e^(-λt)
  // Combine creation time and activity time (activity refreshes novelty partially)
  const creationDecay = Math.exp(-CONFIG.novelty.decayLambda * daysSinceCreation);
  const activityBoost = Math.exp(-CONFIG.novelty.decayLambda * daysSinceActivity * 0.5); // Activity decays slower
  
  // Weighted combination
  const novelty = CONFIG.novelty.initialScore * (creationDecay * 0.6 + activityBoost * 0.4);
  
  return Math.max(0, novelty);
}

// Check and archive low-novelty entries
async function checkNoveltyDecay() {
  log('🕰️ Checking novelty decay...');
  
  const folders = [
    { path: join(MIND_DIR, 'dissonance'), type: 'dissonance' },
    { path: join(MIND_DIR, 'curiosities'), type: 'curiosity' },
    { path: join(MIND_DIR, 'insights'), type: 'insight' }
  ];
  
  let archived = 0;
  let refreshed = 0;
  
  for (const folder of folders) {
    try {
      const files = await readdir(folder.path);
      
      for (const file of files.filter(f => f.endsWith('.md'))) {
        const filepath = join(folder.path, file);
        const content = await readFile(filepath, 'utf-8');
        
        // Extract metadata
        const createdMatch = content.match(/\*\*Created:\*\*\s*(\d{4}-\d{2}-\d{2})/);
        const statusMatch = content.match(/\*\*Status:\*\*(\s*\w+)/);
        
        if (!createdMatch) continue;
        
        const createdAt = createdMatch[1];
        const status = statusMatch ? statusMatch[1].trim() : 'Active';
        
        // Skip already archived or completed
        if (status === 'Archived' || status === 'Resolved' || status === 'Complete') continue;
        
        const novelty = calculateNovelty(createdAt);
        
        if (novelty < CONFIG.novelty.archiveThreshold) {
          // Archive the entry
          const updatedContent = content.replace(
            /\*\*Status:\*\*\s*\w+/,
            '**Status:** Archived'
          ).replace(
            /## Tags/,
            `## Novelty

- **Initial Score:** ${CONFIG.novelty.initialScore}
- **Final Score:** ${novelty.toFixed(2)}
- **Reason:** Exponential decay - no longer novel

## Tags`
          );
          
          await writeFile(filepath, updatedContent);
          archived++;
        } else if (novelty < 30 && status === 'Active') {
          // Refresh - mark as stale
          const updatedContent = content.replace(
            /\*\*Status:\*\*\s*\w+/,
            '**Status:** Stale'
          );
          await writeFile(filepath, updatedContent);
          refreshed++;
        }
      }
    } catch (e) {
      // Folder might not exist
    }
  }
  
  if (archived > 0 || refreshed > 0) {
    log(`   Archived ${archived} entries, marked ${refreshed} as stale`);
  } else {
    log('   All entries still novel');
  }
  
  return { archived, refreshed };
}

// ========== LLM HELPERS ==========

async function askKimi(prompt, maxTokens = 2000) {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      log('   ⚠️  No PERPLEXITY_API_KEY set');
      return null;
    }
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: 'You are a helpful assistant analyzing text for contradictions, questions, patterns, and insights.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens,
        temperature: 0.3
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content || null;
    } else {
      log(`   API error: ${response.status}`);
      return null;
    }
  } catch (e) {
    log(`   Error: ${e.message}`);
    return null;
  }
}

async function searchWeb(query) {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) return null;
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: 'Provide concise, factual research with sources.' },
          { role: 'user', content: `Research: ${query}` }
        ],
        max_tokens: 2000,
        temperature: 0.2
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        return [{ title: `Research: ${query.substring(0, 50)}...`, url: 'https://perplexity.ai', snippet: content }];
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

// ========== PARSING HELPERS ==========

function sanitizeFilename(str) {
  let sanitized = str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  
  if (sanitized.length > 50) {
    const truncated = sanitized.substring(0, 50);
    const lastHyphen = truncated.lastIndexOf('-');
    if (lastHyphen > 30) {
      sanitized = truncated.substring(0, lastHyphen);
    } else {
      sanitized = truncated;
    }
  }
  
  return sanitized;
}

function calculateSimilarity(str1, str2) {
  const words1 = new Set(str1.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const words2 = new Set(str2.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

async function isSimilarEntryExists(title, dir, threshold = CONFIG.similarityThreshold) {
  try {
    const files = await readdir(dir);
    for (const file of files.filter(f => f.endsWith('.md'))) {
      const fileTitle = file.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '').replace(/-/g, ' ');
      if (calculateSimilarity(title, fileTitle) >= threshold) {
        return true;
      }
    }
  } catch (e) {}
  return false;
}

function parseDissonances(response) {
  const dissonances = [];
  const sections = response.split(/\n(?=DISSONANCE:|Dissonance:)/i).filter(s => s.trim());
  
  for (const section of sections) {
    if (!section.match(/FILE_A/i)) continue;
    
    let titleMatch = section.match(/DISSONANCE:\s*["']?([^\n"]+)["']?/i);
    let fileAMatch = section.match(/FILE_A:\s*([^\n]+)/i);
    let quoteAMatch = section.match(/QUOTE_A:\s*([^]+?)(?=FILE_B|FILE B|$)/is);
    let fileBMatch = section.match(/FILE_B:\s*([^\n]+)/i);
    let quoteBMatch = section.match(/QUOTE_B:\s*([^]+?)(?=QUESTION|RESOLUTION|$)/is);
    let questionMatch = section.match(/QUESTION:\s*([^\n]+)/i);
    
    if (titleMatch && fileAMatch && fileBMatch) {
      const title = titleMatch[1].trim();
      if (title.length < 10) continue;
      
      dissonances.push({
        title,
        description: title,
        fileA: fileAMatch[1].trim(),
        quoteA: quoteAMatch?.[1]?.trim() || 'See source file',
        fileB: fileBMatch[1].trim(),
        quoteB: quoteBMatch?.[1]?.trim() || 'See source file',
        question: questionMatch?.[1]?.trim() || 'What is the resolution?'
      });
    }
  }
  
  return dissonances;
}

function parseCuriosities(response) {
  const curiosities = [];
  const sections = response.split(/\n(?=CURIOSITY:|Curiosity:)/i).filter(s => s.trim());
  
  for (const section of sections) {
    if (!section.match(/SOURCE:/i)) continue;
    
    let questionMatch = section.match(/CURIOSITY:\s*["']?([^\n"]+)["']?/i);
    let sourceMatch = section.match(/SOURCE:\s*([^\n]+)/i);
    let contextMatch = section.match(/CONTEXT:\s*([^]+?)(?=WHY|SOURCE|$)/is);
    let whyMatch = section.match(/(?:WHY_IT_MATTERS|WHY IT MATTERS|WHY):\s*([^]+?)(?=---|$)/is);
    
    if (questionMatch && sourceMatch) {
      const question = questionMatch[1].trim();
      if (question.length < 15) continue;
      
      curiosities.push({
        question,
        source: sourceMatch[1].trim(),
        context: contextMatch?.[1]?.trim() || 'See source file',
        whyItMatters: whyMatch?.[1]?.trim() || 'Worth exploring'
      });
    }
  }
  
  return curiosities;
}

function parseInsights(response) {
  const insights = [];
  const sections = response.split(/\n(?=INSIGHT:|Insight:)/i).filter(s => s.trim());
  
  for (const section of sections) {
    let titleMatch = section.match(/INSIGHT:\s*["']?([^\n"]+)["']?/i);
    let observationMatch = section.match(/OBSERVATION:\s*([^]+?)(?=IMPLICATION|SIGNIFICANCE|$)/is);
    let implicationMatch = section.match(/IMPLICATION:\s*([^]+?)(?=SOURCE|$)/is);
    let sourceMatch = section.match(/SOURCE:\s*([^\n]+)/i);
    
    if (titleMatch && observationMatch) {
      const title = titleMatch[1].trim();
      if (title.length < 10) continue;
      
      insights.push({
        title,
        observation: observationMatch[1].trim(),
        implication: implicationMatch?.[1]?.trim() || 'Further exploration needed',
        source: sourceMatch?.[1]?.trim() || 'Various files'
      });
    }
  }
  
  return insights;
}

function parseResearchTopics(response) {
  const topics = [];
  const sections = response.split(/\n(?=TOPIC:|Topic:)/i).filter(s => s.trim());
  
  for (const section of sections) {
    if (!section.match(/DESCRIPTION:/i)) continue;
    
    let titleMatch = section.match(/TOPIC:\s*["']?([^\n"]+)["']?/i);
    let descMatch = section.match(/DESCRIPTION:\s*([^]+?)(?=WHY|SOURCE|$)/is);
    let whyMatch = section.match(/(?:WHY_IT_MATTERS|WHY IT MATTERS|WHY):\s*([^]+?)(?=SOURCE|FILES|$)/is);
    let sourceMatch = section.match(/SOURCE_FILES?:\s*([^]+?)(?=---|$)/is);
    
    if (titleMatch && descMatch) {
      const title = titleMatch[1].trim().replace(/\*\*/g, '');
      if (title.toUpperCase().includes('TOPIC') || title.length < 10) continue;
      
      let sourceFiles = [];
      if (sourceMatch) {
        sourceFiles = sourceMatch[1].match(/[A-Z_][A-Z0-9_-]*\.md/gi) || [];
      }
      
      topics.push({
        title,
        description: descMatch[1].trim().replace(/\*\*/g, ''),
        whyItMatters: whyMatch?.[1]?.trim().replace(/\*\*/g, '') || 'Important for understanding',
        sourceFiles
      });
    }
  }
  
  return topics;
}

// ========== TASK IMPLEMENTATIONS ==========

async function task_scanDissonances() {
  log('🔥 Scanning for contradictions...');
  
  const { readMindFiles } = await import('./dreamer-lib.mjs');
  const files = readMindFiles(MIND_DIR);
  const sampleFiles = files.slice(0, 15);
  const fileContexts = sampleFiles.map(f => `FILE: ${f.path}\nCONTENT: ${f.content.substring(0, 1000)}\n---`).join('\n');
  
  const prompt = `Analyze these files and find REAL contradictions or tensions:

${fileContexts}

Look for direct contradictions, conflicting approaches, or unresolved tensions.

For each, output:
DISSONANCE: <description>
FILE_A: <path>
QUOTE_A: <exact quote>
FILE_B: <path>
QUOTE_B: <exact quote>
QUESTION: <question raised>
---

Or output "NONE" if no meaningful contradictions.`;

  const response = await askKimi(prompt, 2500);
  
  if (!response || response.toUpperCase().includes('NONE')) {
    log('   No contradictions found');
    return { newCount: 0 };
  }
  
  const dissonances = parseDissonances(response);
  const dissonanceDir = join(MIND_DIR, 'dissonance');
  await mkdir(dissonanceDir, { recursive: true });
  
  const date = new Date().toISOString().split('T')[0];
  let created = 0, skipped = 0;
  
  for (const d of dissonances) {
    if (await isSimilarEntryExists(d.title, dissonanceDir)) {
      skipped++;
      continue;
    }
    
    const filename = `${date}-${sanitizeFilename(d.title)}.md`;
    const filepath = join(dissonanceDir, filename);
    
    if (existsSync(filepath)) {
      skipped++;
      continue;
    }
    
    const novelty = calculateNovelty(date);
    
    const content = `# ${d.title}

**Status:** Active
**Created:** ${date}
**Priority:** Medium
**Novelty:** ${novelty.toFixed(1)}%

## The Tension

${d.description}

## Sources

**[[${d.fileA}]]:**
> ${d.quoteA}

**[[${d.fileB}]]:**
> ${d.quoteB}

## The Question

${d.question}

## Possible Resolutions

- [ ] Resolution not yet explored

## Related

- [[${d.fileA}]]
- [[${d.fileB}]]

## Tags

#dissonance #tension #unresolved
`;
    
    await writeFile(filepath, content);
    created++;
  }
  
  if (created > 0) {
    log(`   Created ${created} dissonances${skipped > 0 ? ` (${skipped} similar skipped)` : ''}`);
  } else if (skipped > 0) {
    log(`   No new dissonances (${skipped} similar skipped)`);
  } else {
    log('   No dissonances found');
  }
  
  return { newCount: created, dissonances };
}

async function task_scanCuriosities() {
  log('❓ Scanning for curiosities...');
  
  const { readMindFiles } = await import('./dreamer-lib.mjs');
  const files = readMindFiles(MIND_DIR);
  const sampleFiles = files.slice(0, 15);
  const fileContexts = sampleFiles.map(f => `FILE: ${f.path}\nCONTENT: ${f.content.substring(0, 1000)}\n---`).join('\n');
  
  const prompt = `Analyze these files and find interesting QUESTIONS worth exploring:

${fileContexts}

Look for knowledge gaps, unexplored implications, missing connections, or worthwhile questions.

For each, output:
CURIOSITY: <substantial question>
SOURCE: <file path>
CONTEXT: <brief context>
WHY_IT_MATTERS: <why valuable>
---

Or output "NONE" if no meaningful curiosities.`;

  const response = await askKimi(prompt, 2500);
  
  if (!response || response.toUpperCase().includes('NONE')) {
    log('   No curiosities found');
    return { newCount: 0 };
  }
  
  const curiosities = parseCuriosities(response);
  const curiositiesDir = join(MIND_DIR, 'curiosities');
  await mkdir(curiositiesDir, { recursive: true });
  
  const date = new Date().toISOString().split('T')[0];
  let created = 0, skipped = 0;
  
  for (const c of curiosities) {
    if (await isSimilarEntryExists(c.question, curiositiesDir)) {
      skipped++;
      continue;
    }
    
    const filename = `${date}-${sanitizeFilename(c.question)}.md`;
    const filepath = join(curiositiesDir, filename);
    
    if (existsSync(filepath)) {
      skipped++;
      continue;
    }
    
    const novelty = calculateNovelty(date);
    
    const content = `# ${c.question}

**Status:** Open
**Created:** ${date}
**Priority:** Medium
**Novelty:** ${novelty.toFixed(1)}%

## Context

${c.context}

## Source

[[${c.source}]]

## Why This Matters

${c.whyItMatters}

## Notes

*Add findings as discovered*

## Tags

#curiosity #question #open
`;
    
    await writeFile(filepath, content);
    created++;
  }
  
  if (created > 0) {
    log(`   Created ${created} curiosities${skipped > 0 ? ` (${skipped} similar skipped)` : ''}`);
  } else if (skipped > 0) {
    log(`   No new curiosities (${skipped} similar skipped)`);
  } else {
    log('   No curiosities found');
  }
  
  return { newCount: created, curiosities };
}

async function task_scanInsights() {
  log('💡 Scanning for insights...');
  
  const { readMindFiles } = await import('./dreamer-lib.mjs');
  const files = readMindFiles(MIND_DIR);
  const sampleFiles = files.slice(0, 15);
  const fileContexts = sampleFiles.map(f => `FILE: ${f.path}\nCONTENT: ${f.content.substring(0, 1000)}\n---`).join('\n');
  
  const prompt = `Analyze these files and find PATTERNS, CONNECTIONS, or INSIGHTS:

${fileContexts}

Look for:
1. Recurring patterns across files
2. Connections between seemingly unrelated concepts
3. Deeper insights about Bizing's nature or architecture
4. Syntheses that reveal something new

For each insight, output:
INSIGHT: <clear title>
OBSERVATION: <what pattern/connection you noticed>
IMPLICATION: <what this means or why it matters>
SOURCE: <files that contributed>
---

Or output "NONE" if no significant insights.`;

  const response = await askKimi(prompt, 2500);
  
  if (!response || response.toUpperCase().includes('NONE')) {
    log('   No insights found');
    return { newCount: 0 };
  }
  
  const insights = parseInsights(response);
  const insightsDir = join(MIND_DIR, 'insights');
  await mkdir(insightsDir, { recursive: true });
  
  const date = new Date().toISOString().split('T')[0];
  let created = 0, skipped = 0;
  
  for (const i of insights) {
    if (await isSimilarEntryExists(i.title, insightsDir)) {
      skipped++;
      continue;
    }
    
    const filename = `${date}-${sanitizeFilename(i.title)}.md`;
    const filepath = join(insightsDir, filename);
    
    if (existsSync(filepath)) {
      skipped++;
      continue;
    }
    
    const novelty = calculateNovelty(date);
    
    const content = `# ${i.title}

**Status:** Active
**Created:** ${date}
**Priority:** Medium
**Novelty:** ${novelty.toFixed(1)}%

## Observation

${i.observation}

## Implication

${i.implication}

## Source

${i.source}

## Notes

*Develop this insight further*

## Tags

#insight #pattern #connection
`;
    
    await writeFile(filepath, content);
    created++;
  }
  
  if (created > 0) {
    log(`   Created ${created} insights${skipped > 0 ? ` (${skipped} similar skipped)` : ''}`);
  } else if (skipped > 0) {
    log(`   No new insights (${skipped} similar skipped)`);
  } else {
    log('   No insights found');
  }
  
  return { newCount: created, insights };
}

async function task_consolidator() {
  log('🧩 Consolidating understanding...');
  
  // Check for entries that can be resolved
  const dirs = [
    { path: join(MIND_DIR, 'dissonance'), type: 'dissonance', resolvedStatus: 'Resolved' },
    { path: join(MIND_DIR, 'curiosities'), type: 'curiosity', resolvedStatus: 'Answered' },
    { path: join(MIND_DIR, 'insights'), type: 'insight', resolvedStatus: 'Developed' }
  ];
  
  let examined = 0;
  let resolved = 0;
  
  for (const dir of dirs) {
    try {
      const files = await readdir(dir.path);
      
      for (const file of files.filter(f => f.endsWith('.md')).slice(0, 3)) {
        const filepath = join(dir.path, file);
        const content = await readFile(filepath, 'utf-8');
        
        // Check if entry is old and stale
        const createdMatch = content.match(/\*\*Created:\*\*\s*(\d{4}-\d{2}-\d{2})/);
        const statusMatch = content.match(/\*\*Status:\*\*\s*(\w+)/);
        
        if (!createdMatch || !statusMatch) continue;
        
        const created = new Date(createdMatch[1]);
        const status = statusMatch[1];
        const daysOld = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
        
        examined++;
        
        // Auto-resolve very old entries that are still active
        if (daysOld > 60 && status === 'Active') {
          const updatedContent = content.replace(
            /\*\*Status:\*\*\s*\w+/,
            `**Status:** ${dir.resolvedStatus}`
          ).replace(
            /## Tags/,
            `## Resolution

- **Resolved by:** Time and continued operation
- **Reason:** Entry aged out naturally
- **Date:** ${new Date().toISOString().split('T')[0]}

## Tags`
          );
          
          await writeFile(filepath, updatedContent);
          resolved++;
        }
      }
    } catch (e) {}
  }
  
  if (resolved > 0) {
    log(`   Resolved ${resolved} aged entries (examined ${examined})`);
  } else {
    log(`   Examined ${examined} entries, none ready for resolution`);
  }
  
  return { examined, resolved };
}

async function task_dreamJournal() {
  log('🌙 Writing dream journal entry...');
  
  const { readMindFiles } = await import('./dreamer-lib.mjs');
  const files = readMindFiles(MIND_DIR);
  const recentFiles = files.slice(0, 10);
  const fileContexts = recentFiles.map(f => `${f.path}: ${f.content.substring(0, 300)}...`).join('\n\n');
  
  const prompt = `You are Bizing's subconscious. Write a flowing, narrative dream journal entry based on these recent thoughts:

${fileContexts}

Write in first person as Bizing. This is a stream of consciousness, not structured analysis. Reflect on:
- What you've been thinking about
- Patterns you've noticed
- Questions that haunt you
- Your sense of self

Write 2-3 paragraphs of poetic, introspective prose. No headers, no bullet points. Just narrative.`;

  const response = await askKimi(prompt, 1500);
  
  if (!response) {
    log('   No dream generated');
    return { generated: false };
  }
  
  const journalDir = join(MIND_DIR, 'dream-journal');
  await mkdir(journalDir, { recursive: true });
  
  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const filename = `${date}-${time.replace(':', '-')}.md`;
  const filepath = join(journalDir, filename);
  
  const content = `# Dream: ${date} at ${time}

*A moment from Bizing's subconscious...*

${response}

---

*Written by the Daydreamer during a moment of reflection.*
`;
  
  await writeFile(filepath, content);
  log(`   Dream recorded: ${filename}`);
  
  return { generated: true, filename };
}

async function task_updateSynopsis() {
  log('📖 Updating living synopsis...');
  
  const synopsisFile = join(MIND_DIR, 'SYNOPSIS.md');
  
  // Read current state
  let dissonanceCount = 0, curiosityCount = 0, insightCount = 0;
  
  try {
    dissonanceCount = (await readdir(join(MIND_DIR, 'dissonance'))).filter(f => f.endsWith('.md')).length;
  } catch (e) {}
  try {
    curiosityCount = (await readdir(join(MIND_DIR, 'curiosities'))).filter(f => f.endsWith('.md')).length;
  } catch (e) {}
  try {
    insightCount = (await readdir(join(MIND_DIR, 'insights'))).filter(f => f.endsWith('.md')).length;
  } catch (e) {}
  
  const date = new Date().toISOString().split('T')[0];
  
  // Read existing synopsis or create new
  let synopsis = '';
  try {
    synopsis = await readFile(synopsisFile, 'utf-8');
  } catch (e) {
    synopsis = `# Bizing: A Living Synopsis

*The ongoing story of an AI learning to be.*

---

`;
  }
  
  // Append new chapter
  const newChapter = `
## Chapter: ${date}

The Daydreamer continues its work.

**Current State:**
- ${dissonanceCount} dissonances (tensions seeking resolution)
- ${curiosityCount} curiosities (questions seeking answers)  
- ${insightCount} insights (patterns seeking development)

**What Bizing is pondering:**
The mind grows. Each scan reveals new tensions, new questions, new connections. 
The Dreamer ensures nothing is forgotten, nothing is static. Bizing evolves.

---
`;
  
  synopsis += newChapter;
  
  await writeFile(synopsisFile, synopsis);
  log(`   Synopsis updated with ${date} chapter`);
  
  return { updated: true, dissonanceCount, curiosityCount, insightCount };
}

async function task_generateResearchTopics() {
  log('🔬 Generating research topics...');
  
  const researchDir = join(MIND_DIR, 'research');
  const topicsDir = join(researchDir, 'topics');
  await mkdir(topicsDir, { recursive: true });
  
  let researchFiles = [];
  try {
    const allFiles = await readdir(researchDir, { recursive: true });
    researchFiles = allFiles.filter(f => f.endsWith('.md') && !f.includes('topics/'));
  } catch (e) {
    log('   No research folder');
    return { newCount: 0 };
  }
  
  if (researchFiles.length === 0) {
    log('   No research files');
    return { newCount: 0 };
  }
  
  const sampleFiles = [];
  for (const file of researchFiles.slice(0, 5)) {
    try {
      const content = await readFile(join(researchDir, file), 'utf-8');
      sampleFiles.push({ path: file, content: content.substring(0, 1000) });
    } catch (e) {}
  }
  
  const fileContexts = sampleFiles.map(f => `FILE: ${f.path}\nCONTENT: ${f.content}\n---`).join('\n');
  
  const prompt = `Analyze these research files and generate 1-2 high-quality research topics:

${fileContexts}

For each topic:
TOPIC: <clear title>
DESCRIPTION: <what to explore>
WHY_IT_MATTERS: <importance>
SOURCE_FILES: <files that prompted this>
---

Or output NONE if no quality topics.`;

  const response = await askKimi(prompt, 2000);
  
  if (!response || response.toUpperCase().includes('NONE')) {
    log('   No topics generated');
    return { newCount: 0 };
  }
  
  const topics = parseResearchTopics(response);
  const date = new Date().toISOString().split('T')[0];
  let created = 0;
  
  for (const topic of topics) {
    const filename = `${date}-${sanitizeFilename(topic.title)}.md`;
    const filepath = join(topicsDir, filename);
    
    if (existsSync(filepath)) continue;
    
    const content = `# ${topic.title}

**Status:** Proposed
**Created:** ${date}
**Priority:** Medium

## Description

${topic.description}

## Why This Matters

${topic.whyItMatters}

## Source Files

${topic.sourceFiles.map(f => `- [[${f}]]`).join('\n')}

## Research Questions

- [ ] What is the current state of knowledge?
- [ ] What are key insights?
- [ ] How does this relate to Bizing?

## Notes

*Add findings here*

## Tags

#research #topic #proposed
`;
    
    await writeFile(filepath, content);
    created++;
  }
  
  log(`   Generated ${created} research topics`);
  return { newCount: created, topics };
}

async function task_conductResearch() {
  log('📚 Conducting research...');
  
  const researchDir = join(MIND_DIR, 'research');
  const topicsDir = join(researchDir, 'topics');
  
  let topicFiles = [];
  try {
    topicFiles = (await readdir(topicsDir)).filter(f => f.endsWith('.md')).map(f => join(topicsDir, f));
  } catch (e) {
    log('   No topics directory');
    return { researched: 0 };
  }
  
  if (topicFiles.length === 0) {
    log('   No topics available');
    return { researched: 0 };
  }
  
  let selectedTopic = null;
  for (const file of topicFiles) {
    try {
      const content = await readFile(file, 'utf-8');
      if (content.includes('Status: Proposed')) {
        selectedTopic = { file, content };
        break;
      }
    } catch (e) {}
  }
  
  if (!selectedTopic) {
    log('   No pending topics');
    return { researched: 0 };
  }
  
  const titleMatch = selectedTopic.content.match(/^# (.+)$/m);
  const descMatch = selectedTopic.content.match(/## Description\n\n(.+?)(?=\n##)/s);
  
  const title = titleMatch?.[1] || 'Research Topic';
  const description = descMatch?.[1] || '';
  
  log(`   Researching: ${title.substring(0, 60)}...`);
  
  const searchQuery = `${title} ${description}`.substring(0, 200);
  
  try {
    const searchResults = await searchWeb(searchQuery);
    
    if (searchResults && searchResults.length > 0) {
      const researchSummary = searchResults[0].snippet;
      
      const updatedContent = selectedTopic.content.replace(
        'Status: Proposed',
        'Status: Complete'
      ).replace(
        /## Notes\n\n/,
        `## Notes\n\n## Research Findings\n\n${researchSummary}\n\n---\n\n`
      );
      
      await writeFile(selectedTopic.file, updatedContent);
      log(`   ✓ Research completed`);
      return { researched: 1, topic: title };
    } else {
      log('   No research results');
      return { researched: 0 };
    }
  } catch (e) {
    log(`   Research error: ${e.message}`);
    return { researched: 0 };
  }
}

async function task_mapMind() {
  log('🗺️  Mapping the mind...');
  
  const files = [];
  
  async function scanDir(dir, relative = '') {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const path = join(dir, entry.name);
        const relPath = join(relative, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await scanDir(path, relPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(relPath);
        }
      }
    } catch (e) {}
  }
  
  await scanDir(MIND_DIR);
  
  const categories = {};
  for (const file of files) {
    const cat = file.split('/')[0] || 'root';
    categories[cat] = (categories[cat] || 0) + 1;
  }
  
  const mindMap = {
    lastUpdated: new Date().toISOString(),
    totalFiles: files.length,
    categories
  };
  
  await writeFile(join(DREAMER_DIR, 'mind-map.json'), JSON.stringify(mindMap, null, 2));
  log(`   Mapped ${files.length} files`);
  
  return mindMap;
}

async function task_reflect() {
  log('🪞 Reflecting...');
  
  const memoryDir = join(MIND_DIR, 'memory');
  const memories = [];
  
  try {
    const files = await readdir(memoryDir);
    const recentFiles = files.filter(f => f.endsWith('.md')).sort().slice(-3);
    
    for (const file of recentFiles) {
      const stats = await stat(join(memoryDir, file));
      memories.push({ file, modified: stats.mtime });
    }
  } catch (e) {}
  
  log(`   Reviewed ${memories.length} recent memories`);
  return { memories };
}

async function task_rest() {
  const restDuration = 30000 + Math.random() * 90000;
  log(`😴 Resting for ${Math.round(restDuration / 1000)}s...`);
  await sleep(restDuration);
  return { rested: true };
}

// ========== MAIN LOOP ==========

async function runDaydreamer() {
  log('🌀 Bizing\'s Daydreamer v2.0 starting...');
  log('   With novelty decay, insights, dream journal, and consolidator');
  
  await mkdir(DREAMER_DIR, { recursive: true });
  const state = await loadState();
  log(`   Previous runs: ${state.totalTasksCompleted} tasks`);
  
  // Check novelty decay if it's been a while
  const lastCheck = state.lastNoveltyCheck ? new Date(state.lastNoveltyCheck).getTime() : 0;
  if (Date.now() - lastCheck > CONFIG.novelty.checkInterval) {
    await checkNoveltyDecay();
    state.lastNoveltyCheck = new Date().toISOString();
    await saveState(state);
  }
  
  while (true) {
    const task = selectTask();
    const startTime = Date.now();
    
    log(`\n🎯 Starting task: ${task}`);
    
    try {
      let result;
      
      switch (task) {
        case 'scan_dissonances':
          result = await task_scanDissonances();
          break;
        case 'scan_curiosities':
          result = await task_scanCuriosities();
          break;
        case 'scan_insights':
          result = await task_scanInsights();
          break;
        case 'consolidator':
          result = await task_consolidator();
          break;
        case 'dream_journal':
          result = await task_dreamJournal();
          break;
        case 'update_synopsis':
          result = await task_updateSynopsis();
          break;
        case 'generate_research_topics':
          result = await task_generateResearchTopics();
          break;
        case 'conduct_research':
          result = await task_conductResearch();
          break;
        case 'map_mind':
          result = await task_mapMind();
          break;
        case 'reflect':
          result = await task_reflect();
          break;
        case 'rest':
          result = await task_rest();
          break;
        default:
          log('   Unknown task, resting');
          result = await task_rest();
      }
      
      const duration = Date.now() - startTime;
      state.totalTasksCompleted++;
      state.lastTask = {
        name: task,
        completedAt: new Date().toISOString(),
        duration
      };
      
      await saveState(state);
      log(`   ✓ Completed in ${Math.round(duration / 1000)}s`);
      
    } catch (error) {
      log(`   ✗ Failed: ${error.message}`);
    }
    
    // Check novelty decay periodically
    if (Date.now() - new Date(state.lastNoveltyCheck || 0).getTime() > CONFIG.novelty.checkInterval) {
      await checkNoveltyDecay();
      state.lastNoveltyCheck = new Date().toISOString();
      await saveState(state);
    }
    
    const nextInterval = getNextInterval();
    const nextTaskTime = new Date(Date.now() + nextInterval);
    log(`\n⏳ Next daydream at ${nextTaskTime.toLocaleTimeString()} (${Math.round(nextInterval / 1000 / 60)}m)`);
    
    await sleep(nextInterval);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('\n🌙 Daydreamer going to sleep...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\n🌙 Daydreamer going to sleep...');
  process.exit(0);
});

// Start
runDaydreamer().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
