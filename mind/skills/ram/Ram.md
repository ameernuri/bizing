---
date: 2026-02-13
tags: skill, ram, working-memory, workflow
---

# 🧠 RAM Skill — Working Memory Management

> How to use and maintain the [[mind/memory/RAM|mind's working memory]]

---

## What Is RAM?

[[mind/memory/RAM|RAM]] is the **Working Memory** for the [[Bizing]] [[mind/INDEX|mind]]

- **Active context** — what's important right now
- **Recent activity** — what happened recently... no specific time frames 
- **Current focus** — what we're working on
- **Stale items removed** → archived to [[memory/sessions|long-term memory]] or forgotten/purged

Think of it like a computer's [[mind/skills/ram/Ram]]: fast, active, limited space. When full, move to disk ([[memory/sessions|long-term memory]]) or forget.

---

## Structure

```
[[mind/memory/RAM|RAM.md]]
├── Active Focus      ← What we're working on right now
└── Urgencies         ← Urgent items that need attention
├── Recent Completed  ← max 10-20 recently completed items
├── In Progress       ← Currently doing
├── Blockers          ← What's blocking us, what are we stuck on
├── Recent Learnings  ← Key insights (last 24h)
└── Next Actions      ← Immediate todos
```

Every item has a **timestamp**: [YYYY-MM-DD HH:MM PST]

---

## Rules

### 1. Add with Timestamp

Every entry gets a timestamp:
```
- [2026-02-13 17:57 PST] Moving [[symbiosis/standup|standup]] → [[mind/memory/RAM|RAM]] system
```

### 2. Remove When Stale

Keep each item category max 10-20 items → consider forgetting or saving to [[memory|memory]]

Before removing, ask: "Does this need [[memory|long-term memory]]?"

**If yes →** Create a [[memory/sessions|memory session]] using the [[mind/skills/session-logging|session logging skill]]
**If no →** Purge the item

### 3. Keep It Tight

[[mind/memory/RAM|RAM]] should fit on one screen. If it's getting long, archive old items.

### 4. Check RAM Every Session

Part of the [[mind/INDEX|workflow]]:
1. Read [[mind/INDEX]]
2. Read [[mind/memory/RAM]] ← Current context
3. Read [[symbiosis/feedback]] ← Learnings
4. Do work
5. Update [[mind/memory/RAM]] and [[symbiosis/feedback]]

---

## Workflow: Adding to RAM

### New Focus Item
```markdown
## 🎯 Active Focus

**Primary:** [2026-02-13 10:00 PST] Building [[mind/research/findings/booking-domain-model|booking engine schema]]
- Task 1
- Task 2
```

### Completed Work
```markdown
## ✅ Recent Completed

- [2026-02-13 09:30 PST] Fixed [[embedding]] crash in [[apps/api/src/services/mind-embeddings.ts|mind-embeddings.ts]]
- [2026-02-13 09:45 PST] Updated [[system prompt]] in [[apps/api/src/services/llm.ts|llm.ts]]
```

### Learning
```markdown
## 💡 Recent Learnings

- [2026-02-13 14:00 PST] Chunk size of 2000 chars prevents [[Ollama]] crashes
```

---

## Workflow: Archiving from RAM

### Step 1: Check if Stale

Item is >48h old? Time to evaluate.

### Step 2: Decide Fate

**Is this significant work?**
- Yes → Create [[memory/sessions|session log]]
- No → Delete

### Step 3: Create Session Log (if significant)

Create file: [[mind/memory/sessions/2026-02-13-embedding-crash-fix|mind/memory/sessions/2026-02-13-embedding-crash-fix.md]]

```markdown
---
date: 2026-02-13
tags: session, log, bugfix
---

# Session: Fixed Embedding Crash

## What We Did
- Reduced chunk size from 8000 → 2000 chars in [[apps/api/src/services/mind-embeddings.ts|mind-embeddings.ts]]
- Added resilient error handling
- Tests passing

## Key Learning
[[Ollama]] context limit is ~4096 tokens. 8000 chars ≈ 1500 tokens, but with overhead it crashes. 2000 chars is safe.

## Files Changed
- [[apps/api/src/services/mind-embeddings.ts|apps/api/src/services/mind-embeddings.ts]]
```

### Step 4: Remove from RAM

Delete the item from [[mind/memory/RAM|RAM.md]].

---

## Examples

### Good RAM Entry
```markdown
- [2026-02-13 17:57 PST] Moving [[symbiosis/standup|standup]] → [[mind/memory/RAM|RAM]] system
  - Created [[mind/memory/RAM|RAM.md]]
  - Creating [[mind/skills/ram|RAM skill]]
  - Updating all references
```

### Archive-Worthy Entry
```markdown
## ✅ Recent Completed

- [2026-02-12 22:30 PST] Deep [[mind/memory/sessions/2026-02-12-deep-mind-reorg|mind reorganization]] complete
  - [[mind/INDEX|INDEX.md]] single entry point
  - [[Dreamer]] fixed
  - [[DISSONANCE]] cleaned
  - 7 redundant files deleted
```

→ **Archive to:** [[mind/memory/sessions/2026-02-12-deep-mind-reorg|mind/memory/sessions/2026-02-12-deep-mind-reorg.md]]

### Delete-Worthy Entry
```markdown
- [2026-02-13 09:00 PST] Checked email
```

→ **Delete** (not significant enough for [[memory|long-term memory]])

---

## Integration

**Related Files:**
- [[mind/memory/RAM]] — Working memory (this is where you read/write)
- [[symbiosis/feedback]] — Learnings and rules (update after work)
- [[memory/sessions]] — Long-term memory (archive significant work here)
- [[mind/INDEX]] — Entry point (read first)
- [[mind/skills/memory|Memory Skill]] — How to create session logs

**Workflow:**
```
Read [[mind/INDEX]] → Read [[mind/memory/RAM]] → Read [[symbiosis/feedback]] → Work → Update [[mind/memory/RAM]] + [[symbiosis/feedback]]
```

---

## Quick Checklist

- [ ] Every entry has timestamp
- [ ] Items >48h old evaluated for archiving
- [ ] Significant work → [[memory/sessions|memory/sessions/]]
- [ ] Trivial items → deleted
- [ ] [[mind/memory/RAM|RAM]] stays compact (one screen)
- [ ] Every mention [[wikilinked|wikilinked]] to source files

---

*[[mind/memory/RAM|RAM]] = Working memory. Active context. Stale → [[memory/sessions|archive]].*
