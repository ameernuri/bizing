---
date: 2026-02-13
tags: skill, obsidian, plugins, workflow
---

# 🎨 Obsidian Skills

> Master the tools that power the Bizing mind

---

## Core Skills

### [[kanban|📋 Kanban]] — Visual Task Management
Create draggable task boards for features, bugs, and work tracking.

### [[dataview|🔍 Dataview]] — Query Your Mind
Search, filter, and display mind data dynamically.

### [[templater|📄 Templater]] — Auto-Generate Files
Create templates for sessions, skills, and decisions.

### [[editing-files|📝 Editing Files]] — File Management
Conventions for frontmatter, wikilinks, and organization.

### [[enhancement-features|🔮 Enhancement Features]] — Advanced Tools
Graph view, Canvas, Daily Notes, community plugins, and more.

---

## Plugin Reference

| Skill | Purpose |
|-------|---------|
| [[kanban]] | Visual boards for tasks |
| [[dataview]] | Query and filter files |
| [[templater]] | Dynamic templates |
| [[editing-files]] | File editing conventions |
| [[enhancement-features]] | Advanced Obsidian features |

---

## Quick Reference

### Kanban
```yaml
---
kanban-plugin: board
---

## Column Name
- [ ] #tag Task description [[link]]
```

### Dataview
```dataview
LIST
FROM "mind/memory/sessions"
WHERE date > date(today) - dur(7 days)
SORT date DESC
```

### Templater
```markdown
<% tp.date.now("YYYY-MM-DD") %>
```

---

## Related

- [[mind/skills/Skills]] — All skills
- [[mind/INDEX]] — Entry point
- [[mind/MAP]] — Complete index

---

*Obsidian is our second brain. Master the tools, master the mind.*
