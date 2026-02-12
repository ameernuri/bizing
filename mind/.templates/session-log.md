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
