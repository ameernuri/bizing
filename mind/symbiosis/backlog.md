---
date: 2026-02-11
tags: kanban, backlog
---

# 📦 Backlog

> *All tasks organized by status. Move cards as work progresses.*

## 🚨 Urgent

```kanban
# 🐛 Bug
- [ ] Kimi API key invalid
  - [ ] Generate fresh key from portal
  - [ ] Test authentication
  - [ ] Document result
```

## 📌 High

```kanban
# ✨ Feature
- [ ] MIND.md entry point
  - [x] Create MIND.md
  - [x] Update SOUL.md
  - [ ] Add Dataview queries
  - [ ] Create templates

# 🔧 Infrastructure
- [ ] Obsidian setup
  - [ ] Install Templater
  - [ ] Install Kanban
  - [ ] Install Dataview
  - [ ] Configure templates
```

## 📝 Medium

```kanban
# 📚 Documentation
- [ ] Document dotenv lesson
- [ ] Document Kimi API debugging
- [ ] Update skills index

# 🎨 Visual
- [ ] Create consciousness canvas
- [ ] Create project roadmap canvas
```

## 📅 Low

```kanban
# 🧹 Cleanup
- [ ] Archive old sessions
- [ ] Clean up unused skills
- [ ] Review and prune decisions

# 🔮 Exploration
- [ ] Research AI agents integration
- [ ] Explore voice interface
- [ ] Experiment with automation
```

---

## Stats

```dataview
TABLE length(file.tasks) AS "Total Tasks" FROM "mind/symbiosis/backlog.md" FLATTEN file.tasks
```

## Recently Completed

```dataview
TASK FROM "mind/symbiosis/backlog.md" WHERE completed LIMIT 5
```

---

*Backlog auto-updates with Kanban plugin.*
