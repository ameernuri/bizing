import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const MIND_DIR = join(process.cwd(), '..', '..', 'mind')

function readFileSafe(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}

export function getCompactMindState(): {
  currentFocus: string
  topTasks: string[]
  blockers: string[]
  recentLearnings: string[]
  projectStatus: string
} {
  const standup = readFileSafe(join(MIND_DIR, 'symbiosis', 'standup.md')) || ''
  const feedback = readFileSafe(join(MIND_DIR, 'symbiosis', 'feedback.md')) || ''
  const index = readFileSafe(join(MIND_DIR, 'INDEX.md')) || ''

  const focusMatch = standup.match(/## Focus\s*\n>\s*\*\*Primary:\*\*\s*(.+)/)
  const currentFocus = focusMatch ? focusMatch[1].trim() : 'Building Bizing AI'

  const todaySection = standup.match(/## Today[\s\S]*?(?=## |\n---|$)/)?.[0] || ''
  const topTasks = todaySection
    .split('\n')
    .filter(line => line.trim().startsWith('- [ ]'))
    .slice(0, 5)
    .map(line => line.replace(/^\s*- \[ \]\s*/, '').trim())

  const blockersSection = standup.match(/## Blockers[\s\S]*?(?=## |\n---|$)/)?.[0] || ''
  const blockers = blockersSection
    .split('\n')
    .filter(line => line.includes('#blocker') || line.includes('🔴'))
    .map(line => line.replace(/.*#blocker\s*/, '').replace(/🔴/, '').trim())
    .filter(b => b && !b.includes('None'))

  const learningsMatch = feedback.match(/### From Today's Session[\s\S]*?(?=### |## |\n---|$)/)
  const recentLearnings = learningsMatch
    ? learningsMatch[0]
        .split('\n')
        .filter(line => line.trim().startsWith('- ['))
        .slice(0, 5)
        .map(line => line.replace(/^\s*- \[.*?\]\s*\*\*.*?\*\*\s*/, '').trim())
    : []

  const statusMatch = index.match(/\*\*Status:\*\*\s*(.+)/)
  const projectStatus = statusMatch ? statusMatch[1].trim() : 'In Progress'

  return {
    currentFocus,
    topTasks: topTasks.length > 0 ? topTasks : ['Building Bizing AI capabilities'],
    blockers: blockers.length > 0 ? blockers : ['None'],
    recentLearnings: recentLearnings.length > 0 ? recentLearnings : ['Learning to work with Ameer'],
    projectStatus
  }
}

export function getMindFile(path: string): { content: string | null; exists: boolean } {
  // Auto-add .md if not present
  const fullPath = path.endsWith('.md') ? join(MIND_DIR, path) : join(MIND_DIR, path + '.md')
  const content = readFileSafe(fullPath)
  return { content, exists: content !== null }
}

export function queryMindTasks(filters?: { tag?: string; completed?: boolean }): any[] {
  const standup = readFileSafe(join(MIND_DIR, 'symbiosis', 'standup.md')) || ''
  const backlog = readFileSafe(join(MIND_DIR, 'symbiosis', 'backlog.md')) || ''
  
  const allContent = standup + '\n' + backlog
  const tasks: any[] = []
  
  const lines = allContent.split('\n')
  let currentColumn = ''
  
  for (const line of lines) {
    if (line.startsWith('## ')) {
      currentColumn = line.replace('## ', '').trim()
      continue
    }
    
    const taskMatch = line.match(/^- \[([ x])\]\s*(.+)/)
    if (taskMatch) {
      const isCompleted = taskMatch[1] === 'x'
      const taskText = taskMatch[2].trim()
      
      if (filters?.completed !== undefined && isCompleted !== filters.completed) continue
      if (filters?.tag && !taskText.includes(`#${filters.tag}`)) continue
      
      tasks.push({
        text: taskText,
        completed: isCompleted,
        column: currentColumn,
        tags: (taskText.match(/#\w+/g) || []).map(t => t.replace('#', ''))
      })
    }
  }
  
  return tasks
}

export function getRecentSessions(limit: number = 5): string[] {
  const sessionsDir = join(MIND_DIR, 'memory', 'sessions')
  try {
    return readdirSync(sessionsDir)
      .filter(f => f.endsWith('.md'))
      .map(f => ({
        name: f,
        mtime: statSync(join(sessionsDir, f)).mtime
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
      .slice(0, limit)
      .map(f => f.name.replace('.md', ''))
  } catch {
    return []
  }
}

export function searchMind(query: string): { file: string; matches: string[] }[] {
  const results: { file: string; matches: string[] }[] = []
  const filesToSearch = [
    'INDEX.md',
    'symbiosis/standup.md',
    'symbiosis/feedback.md',
    'identity/essence.md',
    'GOALS.md'
  ]
  
  for (const file of filesToSearch) {
    const content = readFileSafe(join(MIND_DIR, file))
    if (!content) continue
    
    const lines = content.split('\n')
    const matches: string[] = []
    
    for (const line of lines) {
      if (line.toLowerCase().includes(query.toLowerCase())) {
        matches.push(line.trim())
      }
    }
    
    if (matches.length > 0) {
      results.push({ file, matches: matches.slice(0, 3) })
    }
  }
  
  return results
}

export function getMindLinks(): { path: string; description: string }[] {
  return [
    { path: 'INDEX.md', description: 'Entry point - current state and workflow' },
    { path: 'symbiosis/standup.md', description: 'Daily priorities and tasks' },
    { path: 'symbiosis/feedback.md', description: 'Learnings and rules' },
    { path: 'symbiosis/backlog.md', description: 'All tasks by priority' },
    { path: 'identity/essence.md', description: 'Who Bizing is' },
    { path: 'GOALS.md', description: 'Project goals and objectives' },
    { path: 'skills/workflow/index.md', description: 'Available skills' },
    { path: 'knowledge/domain/startup-builder.md', description: 'Business knowledge' },
    { path: 'memory/sessions/', description: 'Session logs' }
  ]
}
