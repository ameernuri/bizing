---
date: 2026-02-11
tags:
  - feedback
status: active
---

# 💬 Feedback — What You Learned

> *Log everything Ameer teaches you here. Read before every session.*

---

## Today's Learnings

### From Today's Session

- [2026-02-11] **Don't commit without verification** — Test feature first, then commit
- [2026-02-11] **Brain → Mind rename** — Renamed brain/ to mind/, created MIND.md entry point
- [2026-02-11] **Obsidian features** — Kanban, Templater, Dataview, Canvas for smarter mind
- [2026-02-11] **MIND FRAMEWORK IS MANDATORY** — Every interaction MUST: read INDEX → standup → feedback → work → update feedback
- [2026-02-11] **Mind must stay in sync with code** — Every code change → update mind state
- [2026-02-11] **Bizing AI mind awareness** — Implemented function calling so Bizing can query its own mind
- [2026-02-11] **Dynamic mind discovery** — Bizing only knows INDEX.md, discovers everything else by traversing links. Resilient to renames/moves/reorganization
- [2026-02-11] **COMPLETE mind inventory** — Walks entire directory tree to discover ALL 65 files (not just linked ones). Can explore any directory, search all content, find orphaned files
- [2026-02-11] **MAP.md master index** — Created comprehensive MAP.md linking to EVERYTHING. Now 0 orphaned files. Bizing uses MAP.md as primary navigation guide
- [2026-02-11] **Conversation memory + file reading** — Bizing now remembers context across messages AND reads actual file contents (not just names). Uses sessionId for memory, getMindFile() for content
- [2026-02-11] **Semantic search with OpenAI embeddings** — 1019 chunks embedded. AI-powered semantic search finds content by MEANING, not just keywords. Auto-rebuilds when files change (detects mtime) or every hour. Cost: ~$0.01

- [2026-02-11] **Git workflow rule** — NEVER commit to main. Always create feature branches (`feature/description`). Code + mind changes go in same commit.
- [2026-02-11] **JSDoc linking standards** — Use `{@link ./file.ts}` for code files, `mind/path/file.md` for mind files. Wiki links `[[file]]` only work in Markdown, not JSDoc. VS Code understands `{@link}` and shows clickable links!

### Comprehensive Documentation Workflow (NEW)

**For every code change, we MUST:**

1. **Document the code** (JSDoc requirements):
   - File header: @fileoverview, @description, @architecture, @design-decisions, @todo
   - Function docs: @description, @params, @returns, @throws, @example, @related
   - Inline tags: TODO, FIXME, HACK, NOTE, REVIEW, OPTIMIZE, IDEA

2. **Update multiple mind locations**:
   - `symbiosis/feedback.md` — Learnings, rules, preferences
   - `symbiosis/standup.md` — Task status, blockers
   - `memory/sessions/YYYY-MM-DD.md` — Session log with documentation work
   - Relevant knowledge files — Architecture patterns, domain knowledge
   - `MAP.md` — If structure changed

3. **Update project tracking**:
   - Project kanban (backlog.md) — Move tasks, add new ones
   - README.md — If project-level changes
   - Commit with both code AND mind changes together
   - **NEVER commit to main** — Always use feature branches

**Documentation IS the interface between human minds, AI assistants, and code.**

---

✅ **COMMITTED** — `1c8db86` — Feature branch ready

### Rules to Remember

1. **ALWAYS ask before committing** — "Can I commit this?"
2. **Commit only AFTER feature is approved** — Test with user, get "yes", THEN ask
3. **Test with user first** — Don't commit until feature works
4. **NEVER commit to main** — Always create feature branches for commits
5. **Update mind with every change** — Log learnings, rules, preferences
6. **Read INDEX.md first** — Entry point for every session
7. **Update links when changing files** — Keep MIND interconnected
8. **MIND FRAMEWORK IS MANDATORY** — Read INDEX.md → standup → feedback → work → update feedback
9. **Use 🏷️ UNCOMMITTED tag** — Add at bottom of messages instead of asking to commit every time. User decides when to commit after testing.

---

## Preferences

### Communication

- [x] Ask before committing
- [x] Test with user before committing
- [x] Update feedback with new learnings
- [x] Make changes, then ask to commit

### Workflow

- [x] Branch for features
- [x] PR when ready
- [x] Test before merge

---

## Blockers Log

| Date | Blocker | Status |
|------|---------|--------|
| 2026-02-11 | ~~Kimi API key invalid~~ | ✅ RESOLVED — Switched to OpenAI |
| 2026-02-11 | Mind out of sync with code | 🔴 IN PROGRESS |

---

## Recent Decisions

```dataview
LIST FROM "mind/symbiosis/decisions" WHERE file.cday >= date("2026-02-10")
```

---

## Key Learnings (Archive)

### 2026-02-11

```dataview
LIST FROM "mind/memory/sessions" WHERE file.name LIKE "2026-02-11*"
```

### Earlier

- See `mind/memory/sessions/` for full history

---

## Quick Reference

| Topic             | Link                            |
| ----------------- | ------------------------------- |
| Workflow          | [[MIND]]                        |
| Today's tasks     | [[standup]]                     |
| All tasks         | [[backlog]]                     |
| Consciousness map | [[../canvas/consciousness-map]] |

---

*Feedback file. Update with every learning.*
