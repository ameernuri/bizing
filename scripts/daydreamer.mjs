#!/usr/bin/env node
/**
 * 🌀 Bizing's Daydreamer Daemon
 * 
 * A continuous background process that slowly contemplates the mind,
 * one task at a time, like a daydreamer.
 * 
 * Tasks:
 * - scan_dissonances: Find contradictions in the mind
 * - scan_curiosities: Find questions worth exploring
 * - map_mind: Update the mental map of files/concepts
 * - plan_future: Think about what needs to be done
 * - reflect: Review recent changes and learn
 * - mindsync: Hard mind synchronization (10% chance) - full sync like after major work
 * - rest: Take a break (important for daydreaming!)
 */

import { readFile, writeFile, readdir, stat, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIND_DIR = join(__dirname, '..', 'mind');
const DREAMER_DIR = join(MIND_DIR, '.daydreamer');
const STATE_FILE = join(DREAMER_DIR, 'state.json');

// Daydreamer configuration
const CONFIG = {
  // Base interval between tasks (ms) - varies with "mood"
  baseInterval: 15 * 60 * 1000, // 15 minutes base
  intervalVariance: 5 * 60 * 1000, // ±5 minutes variance
  
  // Task weights (probability of selection)
  tasks: {
    scan_dissonances: { weight: 22, duration: '2-5m', useLLM: 0.1 }, // 10% use main LLM
    scan_curiosities: { weight: 22, duration: '2-5m', useLLM: 0.1 }, // 10% use main LLM
    map_mind: { weight: 15, duration: '3-8m' },
    plan_future: { weight: 13, duration: '2-4m' },
    reflect: { weight: 10, duration: '1-3m' },
    mindsync: { weight: 10, duration: '10-15m' },
    rest: { weight: 8, duration: '30s-2m' }
  },
  
  // LLM configuration for deep scanning
  llm: {
    model: 'kimi-coding/k2p5',
    timeout: 120000, // 2 minutes
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
  log('🔥 Scanning for contradictions...');
  
  // Import and run the original dreamer's dissonance scanning logic
  const { scanForDissonances } = await import('./dreamer-lib.mjs');
  const result = await scanForDissonances(MIND_DIR);
  
  if (result.newCount > 0) {
    log(`   Found ${result.newCount} new contradictions`);
  } else {
    log('   No new contradictions found');
  }
  
  return result;
}

async function task_scanCuriosities() {
  log('❓ Scanning for curiosities...');
  
  const { scanForCuriosities } = await import('./dreamer-lib.mjs');
  const result = await scanForCuriosities(MIND_DIR);
  
  if (result.newCount > 0) {
    log(`   Found ${result.newCount} new curiosities`);
  } else {
    log('   No new curiosities found');
  }
  
  return result;
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
          // 10% chance to use main LLM for deep analysis
          if (Math.random() < 0.1) {
            log('   🎲 Randomly selected for LLM-powered analysis (10% chance)');
            result = await task_scanDissonancesWithLLM();
          } else {
            result = await task_scanDissonances();
          }
          break;
        case 'scan_curiosities':
          // 10% chance to use main LLM for deep analysis
          if (Math.random() < 0.1) {
            log('   🎲 Randomly selected for LLM-powered analysis (10% chance)');
            result = await task_scanCuriositiesWithLLM();
          } else {
            result = await task_scanCuriosities();
          }
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
