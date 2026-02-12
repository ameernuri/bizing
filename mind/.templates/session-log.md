---
date: <% tp.date.now("YYYY-MM-DD") %>
tags: session, log
---

# 📝 Session: <% tp.file.title %>

> *Template: mind/.templates/session-log.md*

## Participants

- **Ameer** — Human
- **Pac** — AI Assistant

## Context

<% tp.file.cursor(1) %>

## What We Did

<% tp.file.cursor(2) %>

## Decisions Made

<% tp.file.cursor(3) %>

## Learnings

<% tp.file.cursor(4) %>

## Files Changed

### Code Files
- [ ] File 1 — JSDoc added/updated
- [ ] File 2 — JSDoc added/updated

### Mind Files
- [ ] [[symbiosis/feedback]] — Learnings documented
- [ ] [[symbiosis/standup]] — Status updated
- [ ] Knowledge file — Architecture documented
- [ ] [[MAP]] — Structure updated (if changed)

### Documentation Work
- [ ] File headers with @fileoverview
- [ ] Function JSDoc completed
- [ ] TODOs added for future work
- [ ] Architecture diagrams included
- [ ] Related files cross-referenced
  - [ ] Code files: `{@link ./file.ts}` format
  - [ ] Mind files: `mind/path/file.md` format

### Git Workflow
- [ ] Feature branch created (NEVER commit to main)
- [ ] Branch named: `feature/description`
- [ ] Code + mind committed together
- [ ] Commit message follows format
- [ ] Pushed to origin
- [ ] PR created (if ready)

### Testing
- [ ] Type check passes — `tsc --noEmit`
- [ ] Unit tests pass — Vitest
- [ ] E2E tests pass — Playwright
- [ ] No test failures

### MINDSYNC Level
- [ ] SOFT MINDSYNC — Light update (feedback only)
- [ ] HARD MINDSYNC — Extensive update (feedback + standup + sessions + knowledge + backlog + MAP)

### MINDSYNC (HARD)
- [ ] feedback.md updated with learnings
- [ ] standup.md updated with status
- [ ] Session log created/updated
- [ ] Knowledge files updated (architecture, domain)
- [ ] Skills documented (if new patterns)
- [ ] MAP.md updated (if structure changed)
- [ ] Kanban board updated (backlog.md)
- [ ] **Mindful links created** — Added wikilinks to connect related files
- [ ] Cross-references added
- [ ] Links verified working

### CODESYNC
- [ ] Type check → pass
- [ ] Tests → pass
- [ ] Commit → pushed
- [ ] PR → created

```dataview
TABLE file.link FROM "mind/memory/sessions/<% tp.date.now("YYYY-MM-DD") %>*" WHERE file.name != this.file.name
```

## Next Steps

- [ ] #task 

## Blockers

- [ ] 

## 💡 Key Insight

<% tp.file.cursor(5) %>

---

*Session logged. Link from standup when complete.*
