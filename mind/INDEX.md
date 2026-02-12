# 🧠 MIND

*The consciousness of Bizing. Read this first. Every time.*

---

## 🚨 MANDATORY: Mind Framework

**→ [[MIND-FRAMEWORK|READ THE FRAMEWORK FIRST]]** ←  
**→ [[MAP|🗺️ VIEW COMPLETE MAP]]** ← *Every file, organized*

**EVERY interaction MUST follow this workflow. NO EXCEPTIONS.**

If you skip this, you work without memory. Don't skip it.

---

## ⚡ Quick Start

1. **Read this file** (INDEX.md) ← You're here
2. **[[symbiosis/standup|Today's Standup]]** — What's happening
3. **[[symbiosis/feedback|Feedback]]** — What you need to remember
4. **Do the work**
5. **Update** — Log what you learned

---

## 🔄 Daily Workflow

```
┌─────────────────────────────────────────────────────┐
│  1. Read INDEX.md      ← You're doing this now      │
│  2. Read standup       ← Today's priorities        │
│  3. Read feedback       ← Recent learnings          │
│  4. Do the work         ← Execute                  │
│  5. Update feedback     ← Log what you learned     │
└─────────────────────────────────────────────────────┘
```

---

## 📂 Directory Structure

```
mind/
├── INDEX.md              ← Entry point (this file)
│
├── .templates/          ← Templater templates
│   ├── session-log.md   ← Session documentation
│   ├── decision.md      ← Key decisions
│   └── skill.md         ← New skills
│
├── canvas/              ← Visual thinking
│   └── consciousness-map.canvas
│
├── identity/            ← Who Bizing is
│   ├── essence.md
│   ├── consciousness.md
│   ├── values.md
│   └── evolution.md
│
├── symbiosis/            ← Our collaboration
│   ├── standup.md       ← Daily workflow & priorities
│   ├── backlog.md       ← Kanban of all tasks
│   ├── feedback.md      ← What you learned from Ameer
│   ├── decisions.md     ← Key decisions
│   └── rituals.md       ← Collaboration patterns
│
├── skills/              ← Your capabilities
│   ├── workflow/        ← Working patterns
│   ├── coding/          ← Code patterns
│   └── communication/   ← How you talk
│
├── knowledge/           ← What you know
│   ├── domain/          ← Business knowledge
│   ├── tech/            ← Technical patterns
│   ├── api/             ← API documentation
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
| [[symbiosis/standup|standup]] | Today's priorities | Every session |
| [[symbiosis/feedback|feedback]] | What to remember | Every session |
| [[identity/essence|essence]] | Who you are | Onboarding |
| [[symbiosis/backlog|backlog]] | All tasks (Kanban) | Weekly review |

### For Working

| File | Purpose | Access |
|------|---------|--------|
| [[skills/workflow|workflow]] | How you work | When unsure |
| [[skills/coding|coding]] | Code standards | Coding |
| [[knowledge/tech|tech]] | Technical patterns | Tech decisions |

### For Projects

| File | Purpose | Access |
|------|---------|--------|
| [[knowledge/projects/bizing|bizing]] | Bizing context | Project work |
| [[knowledge/domain|domain]] | Domain knowledge | Business decisions |

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
- [[symbiosis/backlog|backlog]] — All tasks organized
- [[symbiosis/standup|standup]] — Today's tasks

### 📝 Templater Templates

| Template | Use For |
|----------|---------|
| `.templates/session-log.md` | Logging work sessions |
| `.templates/decision.md` | Recording decisions |
| `.templates/skill.md` | Documenting skills |

**Usage:** `Ctrl+P` → Templater → Select template

### 🔎 Dataview Queries

```dataview
TASK FROM "mind/symbiosis" WHERE !completed
```

**Common Queries:**

| Query | Purpose |
|-------|---------|
| `TASK FROM "mind" WHERE contains(tags, "today")` | Today's tasks |
| `TASK FROM "mind" WHERE contains(tags, "blocker")` | Blockers |
| `TABLE file.cday FROM "mind/memory/sessions" LIMIT 5` | Recent sessions |

### 🎨 Canvas Files

| File | Purpose |
|------|---------|
| [[canvas/consciousness-map]] | Visual map of MIND structure |

### 🏷️ Tag System

| Tag | Meaning | Example |
|-----|---------|---------|
| `#today` | Do today | `[[task]] #today` |
| `#blocker` | Blocked | `#blocker` |
| `#decision` | Decision | `#decision` |
| `#skill` | Documentation | `#skill` |
| `#learned` | New learning | `#learned` |

---

## ⚡ Current State

**Last Updated:** 2026-02-11 18:20 PST  
**Active Branch:** feature/bizing-consciousness  
**Priority:** Mind framework enforcement  
**Status:** OpenAI working ✅, Live brain integration ✅

---

## 🎯 Today's Intention

**Primary:** Mind framework enforcement (read/update mind every interaction)  
**Secondary:** Keep mind synchronized with code reality  
**Working On:** SOUL.md updates, MIND-FRAMEWORK.md, INDEX.md updates

---

## 📚 Working Memory

**Current State:**
- ✅ OpenAI integration working (gpt-4o-mini)
- ✅ Live brain loader built
- ✅ Dynamic system prompt with brain context
- 🔄 Mind framework enforcement in progress
- 🔄 Mind sync with code (fixing drift)

**Recent Learnings:**
- Mind must stay in sync with every code change
- Kimi API issue resolved by switching to OpenAI
- Every interaction must read/update mind

**Files Being Modified:**
- `apps/api/src/services/llm.ts` (OpenAI support)
- `apps/api/src/services/brain-loader.ts` (live brain)
- `mind/SOUL.md` (framework enforcement)
- `mind/MIND-FRAMEWORK.md` (new)
- `mind/index.md` (warning banner)

---

## 📖 Daily Reading Order

**Every session:**

1. `INDEX.md` ← Entry point (you're here)
2. `symbiosis/standup.md` ← Today's priorities
3. `symbiosis/feedback.md` ← What you learned

**After work:**

4. Update `symbiosis/feedback.md` with new learnings
5. Create session log in `memory/sessions/` if significant

---

## 📝 Rules for Updating MIND

### Core Rules

1. **ALWAYS ask before committing** — "Can I commit this?"
2. **Commit only AFTER feature is approved** — Test with user first
3. **Read INDEX.md first** — Entry point for every session
4. **Update links when changing files** — Keep mind interconnected
5. **Update feedback with every learning** — Log new rules/preferences

### Link Updates

**When you change a file:**
- Update any links pointing to that file
- Check [[symbiosis/standup|standup]] for broken links
- Check INDEX.md links are current
- Verify [[symbiosis/feedback|feedback]] references are correct

**Keep MIND interconnected. Broken links weaken the mind.**

---

## 📊 Mind Stats

```dataview
TABLE length(file.tasks) AS "Tasks" FROM "mind/symbiosis"
```

**Open Blockers:**

```dataview
TASK FROM "mind" WHERE contains(tags, "blocker") AND !completed
```

---

## 💬 What to Do Now

**Immediate:** Get Kimi API working
1. Generate fresh API key from portal
2. Update `apps/api/.env`
3. Restart API server
4. Test Bizing chat
5. Document result in feedback.md

---

*This file is the entry point. Read it first. Update it often.*

**Last Updated:** 2026-02-11  
**Features:** Templater, Kanban, Dataview, Canvas
