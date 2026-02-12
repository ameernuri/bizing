---
date: 2026-02-11
tags: daily, standup
status: active
---

# 🎯 Standup — <% tp.date.now("dddd, MMMM D") %>

> *Read MIND.md first. This is your daily entry point.*

---

## Today's Status

- [x] Read MIND.md
- [x] Review feedback
- [ ] Execute tasks
- [ ] Log learnings

## 🚨 Today's Tasks

```dataview
TASK FROM "mind/symbiosis/standup.md" WHERE contains(tags, "today") AND !completed
```

### High Priority

```kanban
# 🚨 Critical
- [ ] #task Generate fresh Kimi API key
  - [ ] Go to Kimi portal
  - [ ] Delete old key
  - [ ] Create new key
  - [ ] Update .env
  - [ ] Restart server
  - [ ] Test Bizing chat

# 🔧 Infrastructure
- [ ] #task Install Obsidian plugins
  - [ ] Templater
  - [ ] Kanban
  - [ ] Dataview
```

### Medium Priority

```kanban
# 📚 Documentation
- [ ] #task Document dotenv lesson
- [ ] #task Update skills index

# 🎨 Visuals
- [ ] #task Create project canvas
```

### Low Priority

```kanban
# 🧹 Cleanup
- [ ] Archive old sessions
- [ ] Review backlog
```

---

## Blockers

```dataview
TASK FROM "mind" WHERE contains(tags, "blocker") AND !completed
```

> **Current Blocker:** Kimi API key invalid

---

## 🎯 Focus

> **Primary:** Get Kimi API working  
> **Secondary:** Build Obsidian-powered MIND

---

## ✅ Yesterday

```dataview
TASK FROM "mind/memory/sessions/2026-02-11" WHERE completed
```

## 📅 Upcoming

```dataview
TASK FROM "mind/symbiosis/backlog.md" WHERE contains(tags, "high") AND !completed LIMIT 3
```

---

## Quick Links

| Link | Purpose |
|------|---------|
| [[MIND|MIND]] | Entry point |
| [[backlog|Kanban]] | All tasks |
| [[feedback|Learnings]] | What to remember |
| [[../canvas/consciousness-map|Consciousness Map]] | Visual overview |

---

*Standup auto-updates. Mark tasks complete inline.*
