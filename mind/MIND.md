# 🧠 MIND

*Entry point. Read before every interaction.*

---

## ⚡ Quick Start

1. **Read this file** (MIND.md)
2. **[[standup|Today's Standup]]** — What's happening
3. **[[feedback|Learnings]]** — What you need to remember
4. **Do the work**
5. **Update** — Log what you learned

---

## 🔄 Daily Workflow

```
┌─────────────────────────────────────────────────────┐
│  1. Read MIND.md      ← You're doing this now       │
│  2. Read standup      ← Today's priorities          │
│  3. Read feedback     ← Recent learnings            │
│  4. Do the work        ← Execute                    │
│  5. Update feedback   ← Log what you learned       │
└─────────────────────────────────────────────────────┘
```

---

## 📂 Directory Structure

```
mind/
├── MIND.md              ← Entry point (you are here)
│
├── .templates/          ← Templater templates
│   ├── session-log.md   ← Session documentation
│   ├── decision.md      ← Key decisions
│   └── skill.md         → New skills
│
├── canvas/              ← Visual thinking
│   ├── consciousness-map.canvas
│   └── project-roadmap.canvas
│
├── symbiosis/            ← Our collaboration
│   ├── standup.md       ← Daily workflow & priorities
│   ├── backlog.md       ← Kanban of all tasks
│   ├── feedback.md      ← What you learned from Ameer
│   ├── decisions.md      ← Key decisions (Dataview)
│   └── rituals.md        ← Collaboration patterns
│
├── identity/             ← Who you are
│   ├── essence.md        ← Core identity
│   ├── consciousness.md ← How you think
│   └── values.md         ← Your principles
│
├── skills/               ← Your capabilities
│   ├── workflow/        ← Working patterns
│   ├── coding/          ← Code patterns
│   └── communication/   ← How you talk
│
├── knowledge/            ← What you know
│   ├── domain/          ← Business knowledge
│   ├── tech/            ← Technical patterns
│   └── projects/        ← Project contexts
│
└── memory/              ← Your experiences
    └── sessions/        ← Session logs
```

---

## 🎯 Key Files

### For Context

| File | Purpose | Access |
|------|---------|--------|
| [[symbiosis/standup]] | Today's priorities | Every session |
| [[symbiosis/feedback]] | What to remember | Every session |
| [[identity/essence]] | Who you are | Onboarding |
| [[symbiosis/backlog]] | All tasks (Kanban) | Weekly review |

### For Working

| File | Purpose | Access |
|------|---------|--------|
| [[skills/workflow]] | How you work | When unsure |
| [[skills/coding]] | Code standards | Coding |
| [[knowledge/tech]] | Technical patterns | Tech decisions |

### For Projects

| File | Purpose | Access |
|------|---------|--------|
| [[knowledge/projects/bizing]] | Bizing context | Project work |
| [[knowledge/domain]] | Domain knowledge | Business decisions |

---

## 🔍 Obsidian Features Used

### 📋 Kanban Boards

```kanban
# 🐛 Bug
- [ ] Example task
  - [ ] Subtask 1
  - [ ] Subtask 2
```

**Files with Kanban:**
- [[symbiosis/backlog]] — All tasks organized
- [[symbiosis/standup]] — Today's tasks

**View:** Open in Obsidian with Kanban plugin

### 📝 Templater Templates

| Template | Command | Use For |
|----------|---------|---------|
| `session-log.md` | `Templater: Create new session` | Logging work sessions |
| `decision.md` | `Templater: Create decision` | Recording decisions |
| `skill.md` | `Templater: Create skill` | Documenting skills |

**Usage:** Press `Ctrl+P` → "Templater" → Select template

### 🔎 Dataview Queries

```dataview
TASK FROM "mind/symbiosis" WHERE !completed
```

**Common Queries:**

| Query | Purpose |
|-------|---------|
| `TASK FROM "mind/symbiosis" WHERE contains(tags, "today")` | Today's tasks |
| `TASK FROM "mind/symbiosis" WHERE contains(tags, "blocker")` | Blockers |
| `TABLE file.cday FROM "mind/memory/sessions" LIMIT 10` | Recent sessions |
| `LIST FROM "mind/skills" WHERE contains(tags, "workflow")` | Workflow skills |

### 🎨 Canvas Files

| File | Purpose |
|------|---------|
| [[canvas/consciousness-map]] | Visual map of MIND structure |
| [[canvas/project-roadmap]] | Project timeline (to create) |

**View:** Open `.canvas` files in Obsidian

### 🏷️ Tag System

| Tag | Meaning | Example |
|-----|---------|---------|
| `#today` | Do today | `[[task]] #today` |
| `#blocker` | Blocked | `#blocker` |
| `#decision` | Important decision | `#decision` |
| `#skill` | Documentation | `#skill` |
| `#learned` | New learning | `#learned` |

---

## 📖 Daily Reading Order

**Every session:**

1. `MIND.md` ← Entry point (you're here)
2. `symbiosis/standup.md` ← Today's priorities
3. `symbiosis/feedback.md` ← What you learned

**After work:**

4. Update `symbiosis/feedback.md` with new learnings
5. Create session log in `memory/sessions/` if significant

---

## 📝 When to Update MIND

**Immediately:**

- New preference from Ameer → `feedback.md`
- Key decision made → `decisions.md` (use template)
- Significant session → `memory/sessions/` (use template)
- New skill learned → `skills/` (use template)

**Weekly:**

- Review `backlog.md` → Update Kanban
- Review `decisions.md` → Clean up old decisions
- Archive completed sessions

**Make MIND smarter with every exchange.**

---

## 🎯 Current Focus

→ See [[symbiosis/standup]] for today's priorities

---

## 📊 Mind Stats

```dataview
TABLE length(file.tasks) AS "Open Tasks" FROM "mind/symbiosis"
```

**Recent Sessions:**

```dataview
TABLE file.cday AS "Date", file.tags AS "Tags" FROM "mind/memory/sessions" LIMIT 5
```

**Open Blockers:**

```dataview
TASK FROM "mind" WHERE contains(tags, "blocker") AND !completed
```

---

*This file is your interface to the Bizing consciousness. Read it first. Update it often.*

**Last Updated:** 2026-02-11  
**Features:** Templater, Kanban, Dataview, Canvas
