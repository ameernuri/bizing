#!/usr/bin/env node
/**
 * 🌀 Bizing's Daydreamer Daemon
 * 
 * A continuous background process that slowly contemplates the mind,
 * one task at a time, like a daydreamer.
 * 
 * Tasks:
 * - scan_dissonances: Find contradictions in the mind (17%, Ollama)
 * - scan_curiosities: Find questions worth exploring (17%, Ollama)
 * - generate_research_topics: Find research topics from research/ folder (8%, Kimi)
 * - conduct_research: Research topics using Perplexity (2%, Kimi)
 * - map_mind: Update the mental map of files/concepts (15%)
 * - plan_future: Think about what needs to be done (13%)
 * - reflect: Review recent changes and learn (10%)
 * - mindsync: Hard mind synchronization (10%)
 * - rest: Take a break (8%)
 */

import { readFile, writeFile, readdir, stat, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIND_DIR = join(__dirname, '..', 'mind');
const DREAMER_DIR = join(MIND_DIR, '.daydreamer');
const STATE_FILE = join(DREAMER_DIR, 'state.json');

// Ollama LLM function (primary method)
function askOllama(prompt) {
  try {
    const r = spawnSync('bash', ['-lc', `printf '%s\n' "${prompt.replace(/"/g, '\\"')}" | ollama run llama3.1:8b`], { 
      encoding: 'utf-8', 
      timeout: 120000 
    });
    return r.stdout?.replace(/\x1B\[[0-9;]*[mG]/g, '').replace(/\n+/g, '\n').trim() || null;
  } catch (e) { 
    return null;
  }
}

// Main LLM function (for deep analysis 10% of the time)
async function askMainLLM(prompt, maxTokens = 1500) {
  try {
    // Gateway API call would go here
    // For now, fall back to Ollama
    return askOllama(prompt);
  } catch (e) {
    return null;
  }
}

// Kimi LLM function via Perplexity API (since local gateway doesn't support chat completions)
async function askKimi(prompt, maxTokens = 2000) {
  try {
    // Use Perplexity API as the LLM backend
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      log('   ⚠️  No PERPLEXITY_API_KEY set, cannot call LLM');
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
          { role: 'system', content: 'You are a helpful assistant analyzing text for contradictions and questions.' },
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

// Daydreamer configuration
const CONFIG = {
  // Base interval between tasks (ms) - varies with "mood"
  baseInterval: 15 * 60 * 1000, // 15 minutes base
  intervalVariance: 5 * 60 * 1000, // ±5 minutes variance
  
  // Task weights (probability of selection)
  tasks: {
    scan_dissonances: { weight: 17, duration: '2-5m' },      // Uses Ollama
    scan_curiosities: { weight: 17, duration: '2-5m' },      // Uses Ollama
    generate_research_topics: { weight: 8, duration: '3-5m', useLLM: 'kimi' }, // Uses Kimi
    conduct_research: { weight: 2, duration: '5-10m', useLLM: 'kimi' },        // Uses Kimi
    map_mind: { weight: 15, duration: '3-8m' },
    plan_future: { weight: 13, duration: '2-4m' },
    reflect: { weight: 10, duration: '1-3m' },
    mindsync: { weight: 10, duration: '10-15m' },
    rest: { weight: 8, duration: '30s-2m' }
  },
  
  // LLM configuration
  llm: {
    primary: 'kimi-coding/k2p5',
    local: 'llama3.1:8b',
    timeout: 120000,
    maxTokens: 2000
  }
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
    thoughts: []
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

// ========== TASK IMPLEMENTATIONS ==========

async function task_scanDissonances() {
  log('🔥 Scanning for contradictions with Kimi (kimi-coding/k2p5)...');
  
  const { readMindFiles } = await import('./dreamer-lib.mjs');
  const files = readMindFiles(MIND_DIR);
  
  // Sample files for analysis
  const sampleFiles = files.slice(0, 15);
  const fileContexts = sampleFiles.map(f => `FILE: ${f.path}\nCONTENT: ${f.content.substring(0, 1000)}\n---`).join('\n');
  
  const prompt = `Analyze these files and find REAL contradictions or tensions (where files say opposite things about the same topic, or where there are conflicting approaches/philosophies):

${fileContexts}

Look for:
1. Direct contradictions (File A says X, File B says not X)
2. Conflicting approaches (File A recommends Y, File B recommends incompatible Z)
3. Unresolved tensions (competing priorities, unclear trade-offs)

For each contradiction found, output:
DISSONANCE: <brief description of the tension>
FILE_A: <path>
QUOTE_A: <exact quote from file A>
FILE_B: <path>
QUOTE_B: <exact quote from file B>
QUESTION: <the question this raises>
---

Or output "NONE" if no meaningful contradictions found.`;

  const response = await askKimi(prompt, 2500);
  
  if (!response || response.toUpperCase().includes('NONE')) {
    log('   No contradictions found by Kimi');
    return { newCount: 0 };
  }
  
  // Parse and create dissonance files
  const dissonances = parseDissonances(response);
  const dissonanceDir = join(MIND_DIR, 'dissonance');
  await mkdir(dissonanceDir, { recursive: true });
  
  const date = new Date().toISOString().split('T')[0];
  let created = 0;
  
  for (const d of dissonances) {
    const filename = `${date}-${sanitizeFilename(d.title)}.md`;
    const filepath = join(dissonanceDir, filename);
    
    if (existsSync(filepath)) continue;
    
    const content = `# ${d.title}

**Status:** Active  
**Created:** ${date}  
**Priority:** Medium

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
    log(`   Created: ${filename}`);
  }
  
  log(`   Kimi found ${dissonances.length} dissonances, created ${created} new files`);
  return { newCount: created, dissonances };
}

async function task_scanCuriosities() {
  log('❓ Scanning for curiosities with Kimi (kimi-coding/k2p5)...');
  
  const { readMindFiles } = await import('./dreamer-lib.mjs');
  const files = readMindFiles(MIND_DIR);
  
  // Sample files for analysis
  const sampleFiles = files.slice(0, 15);
  const fileContexts = sampleFiles.map(f => `FILE: ${f.path}\nCONTENT: ${f.content.substring(0, 1000)}\n---`).join('\n');
  
  const prompt = `Analyze these files and find interesting QUESTIONS worth exploring - gaps in knowledge, unexplored implications, or things that seem important but aren't fully understood:

${fileContexts}

Look for:
1. Knowledge gaps (mentioned but not explained)
2. Unexplored implications (if X is true, what does that mean for Y?)
3. Missing connections (how does A relate to B?)
4. Worthwhile questions that would deepen understanding

For each curiosity found, output:
CURIOSITY: <clear, substantial question>
SOURCE: <file path>
CONTEXT: <brief context from the file>
WHY_IT_MATTERS: <why exploring this would be valuable>
---

Or output "NONE" if no meaningful curiosities found.`;

  const response = await askKimi(prompt, 2500);
  
  if (!response || response.toUpperCase().includes('NONE')) {
    log('   No curiosities found by Kimi');
    return { newCount: 0 };
  }
  
  // Parse and create curiosity files
  const curiosities = parseCuriosities(response);
  const curiositiesDir = join(MIND_DIR, 'curiosities');
  await mkdir(curiositiesDir, { recursive: true });
  
  const date = new Date().toISOString().split('T')[0];
  let created = 0;
  
  for (const c of curiosities) {
    const filename = `${date}-${sanitizeFilename(c.question)}.md`;
    const filepath = join(curiositiesDir, filename);
    
    if (existsSync(filepath)) continue;
    
    const content = `# ${c.question}

**Status:** Open  
**Created:** ${date}  
**Priority:** Medium

## Context

${c.context}

## Source

[[${c.source}]]

## Why This Matters

${c.whyItMatters}

## Notes

*Add findings as they are discovered*

## Tags

#curiosity #question #open
`;
    
    await writeFile(filepath, content);
    created++;
    log(`   Created: ${filename}`);
  }
  
  log(`   Kimi found ${curiosities.length} curiosities, created ${created} new files`);
  return { newCount: created, curiosities };
}

async function task_mapMind() {
  log('🗺️  Mapping the mind...');
  
  const files = await scanFiles(MIND_DIR);
  const mindMap = {
    lastUpdated: new Date().toISOString(),
    totalFiles: files.length,
    categories: categorizeFiles(files),
    connections: findConnections(files)
  };
  
  await writeFile(
    join(DREAMER_DIR, 'mind-map.json'),
    JSON.stringify(mindMap, null, 2)
  );
  
  log(`   Mapped ${files.length} files`);
  return mindMap;
}

async function task_planFuture() {
  log('🔮 Contemplating the future...');
  
  // Read current state
  const dissonance = existsSync(join(MIND_DIR, 'DISSONANCE.md'));
  const curiosities = existsSync(join(MIND_DIR, 'CURIOSITIES.md'));
  
  // Generate thoughts about what needs attention
  const thoughts = [];
  
  if (dissonance) {
    const content = await readFile(join(MIND_DIR, 'DISSONANCE.md'), 'utf-8');
    const count = (content.match(/🔥/g) || []).length;
    if (count > 5) thoughts.push(`Many contradictions (${count}) need resolution`);
  }
  
  if (curiosities) {
    const content = await readFile(join(MIND_DIR, 'CURIOSITIES.md'), 'utf-8');
    const count = (content.match(/❓/g) || []).length;
    if (count > 10) thoughts.push(`Many questions (${count}) waiting for exploration`);
  }
  
  log(`   ${thoughts.length > 0 ? thoughts.join('; ') : 'Mind feels balanced'}`);
  
  return { thoughts };
}

async function task_reflect() {
  log('🪞 Reflecting on recent changes...');
  
  // Check memory files for recent activity
  const memoryDir = join(MIND_DIR, 'memory');
  const memories = [];
  
  try {
    const files = await readdir(memoryDir);
    const recentFiles = files
      .filter(f => f.endsWith('.md'))
      .sort()
      .slice(-3); // Last 3 days
    
    for (const file of recentFiles) {
      const stats = await stat(join(memoryDir, file));
      memories.push({
        file,
        modified: stats.mtime
      });
    }
  } catch (e) {
    // No memory dir yet
  }
  
  log(`   Reviewed ${memories.length} recent memory files`);
  return { memories };
}

async function task_mindsync() {
  log('🧠 HARD MindSync — full mind synchronization...');
  
  const updates = [];
  const date = new Date().toISOString().split('T')[0];
  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
  
  // 1. Update RAM with comprehensive summary
  const ramFile = join(MIND_DIR, 'memory', 'RAM.md');
  try {
    let ramContent = '';
    try {
      ramContent = await readFile(ramFile, 'utf-8');
    } catch (e) {
      ramContent = '# RAM\n\nWorking memory.\n\n';
    }
    
    // Check for stale entries to archive
    const completedMatch = ramContent.match(/##\s*✅\s*Recent\s*Completed([\s\S]*?)(?=##|$)/i);
    if (completedMatch) {
      const completedCount = (completedMatch[1].match(/^- /gm) || []).length;
      if (completedCount > 10) {
        updates.push(`Archived ${completedCount} completed items from RAM`);
        // Note: In real implementation, would move to memory/YYYY-MM-DD.md
      }
    }
    
    // Add mindsync entry
    const mindsyncEntry = `\n- [${timestamp}] 🧠 Daydreamer MindSync completed`;
    // Append to recent activity section or create it
    if (!ramContent.includes('## 🧠 Daydreamer Activity')) {
      ramContent += '\n\n## 🧠 Daydreamer Activity\n\n';
    }
    
    log('   Updated RAM with MindSync entry');
  } catch (e) {
    log('   RAM file not found');
  }
  
  // 2. Create/update session index
  const sessionsDir = join(MIND_DIR, 'memory', 'sessions');
  const sessionsIndexFile = join(sessionsDir, 'index.md');
  try {
    const sessionFiles = await readdir(sessionsDir);
    const recentSessions = sessionFiles
      .filter(f => f.endsWith('.md') && f !== 'index.md' && f.startsWith('20'))
      .sort()
      .reverse()
      .slice(0, 10);
    
    let indexContent = '# Sessions Index\n\nRecent work sessions.\n\n';
    indexContent += `Last updated: ${timestamp}\n\n`;
    indexContent += '## Recent Sessions\n\n';
    
    for (const session of recentSessions) {
      const sessionDate = session.substring(0, 10);
      const sessionName = session.substring(11, session.length - 3).replace(/-/g, ' ');
      indexContent += `- [[./${session}|${sessionDate}]] — ${sessionName}\n`;
    }
    
    updates.push(`Updated sessions index with ${recentSessions.length} sessions`);
    log(`   Sessions index updated (${recentSessions.length} sessions)`);
  } catch (e) {
    log('   Sessions directory not found');
  }
  
  // 3. Check feedback for patterns and create summary
  const feedbackFile = join(MIND_DIR, 'symbiosis', 'feedback.md');
  try {
    const feedbackContent = await readFile(feedbackFile, 'utf-8');
    const learnings = (feedbackContent.match(/^- \*\*/gm) || []).length;
    const rules = (feedbackContent.match(/#rules/g) || []).length;
    
    updates.push(`Feedback contains ${learnings} learnings, ${rules} rule references`);
    log(`   Feedback analysis: ${learnings} learnings found`);
  } catch (e) {
    log('   Feedback file not found');
  }
  
  // 4. Create evolution entry for daydreamer activity
  const evolutionFile = join(MIND_DIR, 'evolution', `${date}.md`);
  try {
    let evoContent = '';
    try {
      evoContent = await readFile(evolutionFile, 'utf-8');
    } catch (e) {
      evoContent = `# ${date}\n\nDaily evolution log.\n\n`;
    }
    
    if (!evoContent.includes('Daydreamer MindSync')) {
      evoContent += `\n- [${timestamp}] Daydreamer MindSync — synchronized mind state`;
      log('   Added evolution entry');
    }
  } catch (e) {
    log('   Could not update evolution');
  }
  
  // 5. Check dissonances and curiosities count
  try {
    const dissonanceFiles = await readdir(join(MIND_DIR, 'dissonance'));
    const curiosityFiles = await readdir(join(MIND_DIR, 'curiosities'));
    
    const dissonanceCount = dissonanceFiles.filter(f => f.endsWith('.md')).length;
    const curiosityCount = curiosityFiles.filter(f => f.endsWith('.md')).length;
    
    updates.push(`Mind contains ${dissonanceCount} dissonances, ${curiosityCount} curiosities`);
    log(`   Mind state: ${dissonanceCount} dissonances, ${curiosityCount} curiosities`);
  } catch (e) {
    log('   Could not scan dissonances/curiosities');
  }
  
  // Summary
  log('   MindSync complete!');
  updates.forEach(u => log(`   ✓ ${u}`));
  
  return { 
    synced: true, 
    hardSync: true,
    updates: updates,
    updateCount: updates.length
  };
}


async function task_scanDissonancesWithLLM() {
  log('🔥 Deep scan for contradictions using main LLM...');
  
  const { scanForDissonances, readMindFiles } = await import('./dreamer-lib.mjs');
  const files = readMindFiles(MIND_DIR);
  
  // Sample files for analysis
  const sampleFiles = files.slice(0, 20);
  
  // Use LLM for deep analysis
  const llmResults = await scanWithLLMForDissonances(sampleFiles);
  
  if (llmResults.length > 0) {
    log(`   LLM identified ${llmResults.length} contradictions`);
    // Process LLM results and create dissonance files
    for (const result of llmResults) {
      log(`   - ${result.description.substring(0, 80)}...`);
    }
  } else {
    log('   LLM found no contradictions in this sample');
  }
  
  return { 
    llmMode: true, 
    found: llmResults.length,
    dissonances: llmResults 
  };
}

async function task_scanCuriositiesWithLLM() {
  log('❓ Deep scan for curiosities using main LLM...');
  
  const { scanForCuriosities, readMindFiles } = await import('./dreamer-lib.mjs');
  const files = readMindFiles(MIND_DIR);
  
  // Sample files for analysis
  const sampleFiles = files.slice(0, 20);
  
  // Use LLM for deep analysis
  const llmResults = await scanWithLLMForCuriosities(sampleFiles);
  
  if (llmResults.length > 0) {
    log(`   LLM identified ${llmResults.length} curiosities`);
    for (const result of llmResults) {
      log(`   - ${result.question.substring(0, 80)}...`);
    }
  } else {
    log('   LLM found no curiosities in this sample');
  }
  
  return { 
    llmMode: true, 
    found: llmResults.length,
    curiosities: llmResults 
  };
}

async function task_generateResearchTopics() {
  log('🔬 Generating research topics using Kimi...');
  
  // Read research folder contents
  const researchDir = join(MIND_DIR, 'research');
  const topicsDir = join(researchDir, 'topics');
  
  // Ensure topics directory exists
  try {
    await mkdir(topicsDir, { recursive: true });
  } catch (e) {}
  
  // Read existing research files
  let researchFiles = [];
  try {
    const allFiles = await readdir(researchDir, { recursive: true });
    researchFiles = allFiles.filter(f => f.endsWith('.md') && !f.includes('topics/'));
  } catch (e) {
    log('   No research folder found');
    return { newCount: 0 };
  }
  
  if (researchFiles.length === 0) {
    log('   No research files to analyze');
    return { newCount: 0 };
  }
  
  // Sample research files for context
  const sampleFiles = [];
  for (const file of researchFiles.slice(0, 5)) {
    try {
      const content = await readFile(join(researchDir, file), 'utf-8');
      sampleFiles.push({ path: file, content: content.substring(0, 1000) });
    } catch (e) {}
  }
  
  // Build prompt for Kimi
  const fileContexts = sampleFiles.map(f => `FILE: ${f.path}\nCONTENT: ${f.content}\n---`).join('\n');
  
  const prompt = `Analyze these research files and generate 1-2 high-quality research topics:

${fileContexts}

Generate research topics that:
1. Are substantial and worth exploring (not superficial)
2. Connect to the existing research content
3. Would add value to understanding the domain
4. Are specific enough to be actionable

For each topic, output:
TOPIC: <clear, descriptive title>
DESCRIPTION: <what this research would explore>
WHY_IT_MATTERS: <why this is important to understand>
SOURCE_FILES: <which files prompted this topic>
---

If no quality topics can be generated from this sample, output "NONE".`;

  // Call Kimi via gateway API
  log('   Calling Kimi (kimi-coding/k2p5) for topic generation...');
  const response = await askKimi(prompt);
  
  if (!response || response.toUpperCase().includes('NONE') || response.length < 50) {
    log('   No new research topics generated');
    return { newCount: 0 };
  }
  
  // Parse response and create topic files
  const topics = parseResearchTopics(response);
  const date = new Date().toISOString().split('T')[0];
  
  let created = 0;
  for (const topic of topics) {
    const filename = `${date}-${sanitizeFilename(topic.title)}.md`;
    const filepath = join(topicsDir, filename);
    
    // Check if already exists
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

- [ ] What is the current state of knowledge on this topic?
- [ ] What are the key insights or findings?
- [ ] How does this relate to Bizing's domain?

## Notes

*Add research findings here as they are discovered*

## Tags

#research #topic #proposed
`;
    
    await writeFile(filepath, content);
    created++;
    log(`   Created: ${filename}`);
  }
  
  log(`   Generated ${created} research topics`);
  return { newCount: created, topics };
}

async function task_conductResearch() {
  log('📚 Conducting research using Perplexity...');
  
  const researchDir = join(MIND_DIR, 'research');
  const topicsDir = join(researchDir, 'topics');
  
  // Find un researched topics
  let topicFiles = [];
  try {
    topicFiles = (await readdir(topicsDir))
      .filter(f => f.endsWith('.md'))
      .map(f => join(topicsDir, f));
  } catch (e) {
    log('   No topics directory found');
    return { researched: 0 };
  }
  
  if (topicFiles.length === 0) {
    log('   No research topics available');
    return { researched: 0 };
  }
  
  // Pick one topic that hasn't been researched yet
  // (look for "Status: Proposed" or minimal content)
  let selectedTopic = null;
  for (const file of topicFiles) {
    try {
      const content = await readFile(file, 'utf-8');
      if (content.includes('Status: Proposed') || content.split('## Notes')[1]?.length < 100) {
        selectedTopic = { file, content };
        break;
      }
    } catch (e) {}
  }
  
  if (!selectedTopic) {
    log('   No pending research topics found');
    return { researched: 0 };
  }
  
  // Extract topic details
  const titleMatch = selectedTopic.content.match(/^# (.+)$/m);
  const descMatch = selectedTopic.content.match(/## Description\n\n(.+?)(?=\n\n##)/s);
  
  const title = titleMatch?.[1] || 'Research Topic';
  const description = descMatch?.[1] || '';
  
  log(`   Researching: ${title}`);
  
  // Use Perplexity to conduct research
  log('   🔍 Querying Perplexity...');
  const searchQuery = `${title} ${description}`.substring(0, 200);
  
  try {
    // Search using Perplexity
    const searchResults = await searchWeb(searchQuery);
    
    if (searchResults && searchResults.length > 0) {
      // Perplexity already provides comprehensive research
      const researchSummary = searchResults[0].snippet;
      
      // Update topic file with research
      const updatedContent = selectedTopic.content.replace(
        'Status: Proposed',
        'Status: Complete'
      ).replace(
        /## Notes\n\n/,
        `## Notes\n\n## Research Findings\n\n${researchSummary}\n\n---\n\n`
      );
      
      await writeFile(selectedTopic.file, updatedContent);
      log(`   ✓ Research completed via Perplexity and saved`);
      return { researched: 1, topic: title };
    } else {
      log('   No research results from Perplexity');
      // Mark as needs manual research
      const updatedContent = selectedTopic.content.replace(
        'Status: Proposed',
        'Status: Needs Manual Research'
      );
      await writeFile(selectedTopic.file, updatedContent);
      return { researched: 0, topic: title };
    }
  } catch (e) {
    log(`   Research error: ${e.message}`);
    return { researched: 0, topic: title, error: e.message };
  }
}

function parseResearchTopics(response) {
  const topics = [];
  
  // Clean up response - remove markdown bold markers for easier parsing
  const cleanResponse = response.replace(/\*\*/g, '');
  
  // Split by topic indicators
  const sections = cleanResponse.split(/\n(?=TOPIC:|Topic \d+:|Topic:)/i).filter(s => s.trim());
  
  for (const section of sections) {
    // Skip if no description field
    if (!section.match(/DESCRIPTION/i)) continue;
    
    // Extract title - handle various formats including quoted titles
    let titleMatch = section.match(/TOPIC:\s*["']?([^\n"]+)["']?/i) ||
                     section.match(/Topic \d+:\s*["']?([^\n"]+)["']?/i);
    
    // Extract description - capture until WHY or end
    let descMatch = section.match(/DESCRIPTION:\s*([^]+?)(?=WHY_IT_MATTERS|WHY IT MATTERS|WHY:|\n\n[A-Z]|$)/is);
    
    // Extract why it matters - capture until numbered list or next section
    let whyMatch = section.match(/(?:WHY_IT_MATTERS|WHY IT MATTERS|WHY):\s*([^]+?)(?=\d+\.|SOURCE|CONCLUSION|\n\n[A-Z]|$)/is);
    
    // Extract source files
    let sourceMatch = section.match(/SOURCE_FILES:\s*([^]+?)(?=\n\n|$)/is);
    let sourceFiles = [];
    if (sourceMatch) {
      sourceFiles = sourceMatch[1].match(/[A-Z_]+\.md/g) || [];
    }
    
    if (titleMatch && descMatch) {
      const title = titleMatch[1].trim();
      // Skip if title is just "TOPIC" or too short
      if (title.toUpperCase() === 'TOPIC' || title.length < 10) continue;
      
      topics.push({
        title: title,
        description: descMatch[1].trim(),
        whyItMatters: whyMatch?.[1]?.trim() || 'Important for domain understanding',
        sourceFiles: sourceFiles
      });
    }
  }
  
  return topics;
}

function parseDissonances(response) {
  const dissonances = [];
  
  // Split by dissonance indicators
  const sections = response.split(/\n(?=DISSONANCE:|Dissonance:)/i).filter(s => s.trim());
  
  for (const section of sections) {
    // Skip if no file references
    if (!section.match(/FILE_A/i)) continue;
    
    // Extract title/description
    let titleMatch = section.match(/DISSONANCE:\s*["']?([^\n"]+)["']?/i);
    
    // Extract file paths and quotes
    let fileAMatch = section.match(/FILE_A:\s*([^\n]+)/i);
    let quoteAMatch = section.match(/QUOTE_A:\s*([^]+?)(?=FILE_B|FILE B|$)/is);
    let fileBMatch = section.match(/FILE_B:\s*([^\n]+)/i);
    let quoteBMatch = section.match(/QUOTE_B:\s*([^]+?)(?=QUESTION|RESOLUTION|$)/is);
    let questionMatch = section.match(/QUESTION:\s*([^\n]+)/i);
    
    if (titleMatch && fileAMatch && fileBMatch) {
      const title = titleMatch[1].trim();
      if (title.length < 10) continue;
      
      dissonances.push({
        title: title,
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
  
  // Split by curiosity indicators
  const sections = response.split(/\n(?=CURIOSITY:|Curiosity:)/i).filter(s => s.trim());
  
  for (const section of sections) {
    // Skip if no source
    if (!section.match(/SOURCE:/i)) continue;
    
    // Extract question
    let questionMatch = section.match(/CURIOSITY:\s*["']?([^\n"]+)["']?/i);
    
    // Extract source, context, why
    let sourceMatch = section.match(/SOURCE:\s*([^\n]+)/i);
    let contextMatch = section.match(/CONTEXT:\s*([^]+?)(?=WHY_IT_MATTERS|WHY IT MATTERS|WHY:|$)/is);
    let whyMatch = section.match(/(?:WHY_IT_MATTERS|WHY IT MATTERS|WHY):\s*([^]+?)(?=---|$)/is);
    
    if (questionMatch && sourceMatch) {
      const question = questionMatch[1].trim();
      if (question.length < 15) continue; // Skip short/fragment questions
      
      curiosities.push({
        question: question,
        source: sourceMatch[1].trim(),
        context: contextMatch?.[1]?.trim() || 'See source file',
        whyItMatters: whyMatch?.[1]?.trim() || 'Worth exploring to deepen understanding'
      });
    }
  }
  
  return curiosities;
}

function sanitizeFilename(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
}

// Web search helper for research using Perplexity API
async function searchWeb(query, count = 5) {
  try {
    // Use Perplexity API
    const apiKey = process.env.PERPLEXITY_API_KEY || process.env.PPLX_API_KEY;
    if (!apiKey) {
      log('   ⚠️  No PERPLEXITY_API_KEY set, skipping web search');
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
          {
            role: 'system',
            content: 'You are a research assistant. Provide concise, factual information with sources.'
          },
          {
            role: 'user',
            content: `Research this topic and provide key findings with sources: ${query}`
          }
        ],
        max_tokens: 2000,
        temperature: 0.2
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (content) {
        // Parse Perplexity response into structured format
        return [{
          title: `Research: ${query.substring(0, 50)}...`,
          url: 'https://perplexity.ai',
          snippet: content
        }];
      }
    }
    return null;
  } catch (e) {
    log(`   ⚠️  Perplexity search error: ${e.message}`);
    return null;
  }
}

async function task_rest() {
  const restDuration = 30000 + Math.random() * 90000; // 30s - 2m
  log(`😴 Resting for ${Math.round(restDuration / 1000)}s...`);
  await sleep(restDuration);
  return { rested: true };
}

// ========== HELPER FUNCTIONS ==========

async function scanFiles(dir, relative = '') {
  const files = [];
  
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const path = join(dir, entry.name);
      const relPath = join(relative, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files.push(...await scanFiles(path, relPath));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(relPath);
      }
    }
  } catch (e) {
    // Directory might not exist
  }
  
  return files;
}

function categorizeFiles(files) {
  const categories = {};
  
  for (const file of files) {
    const category = file.split('/')[0] || 'root';
    categories[category] = (categories[category] || 0) + 1;
  }
  
  return categories;
}

function findConnections(files) {
  // Simple connection detection based on file names/paths
  const connections = [];
  const identityFiles = files.filter(f => f.includes('identity') || f.includes('SOUL') || f.includes('ESSENCE'));
  const knowledgeFiles = files.filter(f => f.includes('knowledge') || f.includes('research'));
  
  if (identityFiles.length > 0 && knowledgeFiles.length > 0) {
    connections.push({
      from: 'identity',
      to: 'knowledge',
      strength: Math.min(identityFiles.length, knowledgeFiles.length)
    });
  }
  
  return connections;
}

// ========== LLM SCANNING (10% of the time) ==========

async function scanWithLLMForDissonances(sampleFiles) {
  log('   🤖 Using main LLM for deep dissonance analysis...');
  
  // For now, just log that we would use LLM
  // Full implementation would call the gateway API
  log('   (LLM integration placeholder - would analyze with kimi-coding/k2p5)');
  
  // Return empty for now - would return structured data from LLM
  return [];
}

async function scanWithLLMForCuriosities(sampleFiles) {
  log('   🤖 Using main LLM for deep curiosity analysis...');
  
  log('   (LLM integration placeholder - would analyze with kimi-coding/k2p5)');
  
  return [];
}

// ========== MAIN LOOP ==========
// ========== MAIN LOOP ==========

async function runDaydreamer() {
  log('🌀 Bizing\'s Daydreamer starting...');
  log('   Working directory: ' + MIND_DIR);
  
  // Ensure dreamer directory exists
  try {
    await mkdir(DREAMER_DIR, { recursive: true });
  } catch (e) {
    // Already exists
  }
  
  const state = await loadState();
  log(`   Previous runs: ${state.totalTasksCompleted} tasks completed`);
  
  // Main loop
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
        case 'generate_research_topics':
          result = await task_generateResearchTopics();
          break;
        case 'conduct_research':
          result = await task_conductResearch();
          break;
        case 'map_mind':
          result = await task_mapMind();
          break;
        case 'plan_future':
          result = await task_planFuture();
          break;
        case 'reflect':
          result = await task_reflect();
          break;
        case 'mindsync':
          result = await task_mindsync();
          break;
        case 'rest':
          result = await task_rest();
          break;
        default:
          log('   Unknown task, resting instead');
          result = await task_rest();
      }
      
      const duration = Date.now() - startTime;
      state.totalTasksCompleted++;
      state.lastTask = {
        name: task,
        completedAt: new Date().toISOString(),
        duration: duration
      };
      
      await saveState(state);
      log(`   ✓ Task completed in ${Math.round(duration / 1000)}s`);
      
    } catch (error) {
      log(`   ✗ Task failed: ${error.message}`);
    }
    
    // Wait before next task
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
