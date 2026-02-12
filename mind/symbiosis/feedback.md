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

---

✅ **COMMITTED** — `1c8db86` — Feature branch ready

### Rules to Remember

1. **ALWAYS ask before committing** — "Can I commit this?"
2. **Commit only AFTER feature is approved** — Test with user, get "yes", THEN ask
3. **Test with user first** — Don't commit until feature works
4. **Update mind with every change** — Log learnings, rules, preferences
5. **Read INDEX.md first** — Entry point for every session
6. **Update links when changing files** — Keep MIND interconnected
7. **MIND FRAMEWORK IS MANDATORY** — Read INDEX.md → standup → feedback → work → update feedback
8. **Use 🏷️ UNCOMMITTED tag** — Add at bottom of messages instead of asking to commit every time. User decides when to commit after testing.

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
