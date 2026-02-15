---
date: 2026-02-13
tags: 
  - skill
  - obsidian
  - kanban
  - workflow
---

# 🎓 Kanban Skill

> How to use Obsidian Kanban plugin for visual task management

---

## What Is Kanban?

**Kanban** is a visual workflow management method. In Obsidian
  - the [[Kanban plugin]] turns markdown files into draggable boards.

---

## Creating a Kanban Board

### Step 1: Add Frontmatter

Every kanban file needs this at the top:

```yaml
---
kanban-plugin: board
date: 2026-02-13
tags: 
  - kanban
  - project
---
```

### Step 2: Create Columns

Use `##` for column headers:

```markdown
## Backlog

## In Progress

## Review

## Done
```

### Step 3: Add Tasks

Use `- [ ]` for tasks:

```markdown
## Backlog

- [ ] #feature User authentication system
- [ ] #bug Fix navigation overflow

## In Progress

- [ ] #feature Dashboard widgets [[dashboard-design]]
  - Need to finalize widget layouts
  - @ameer approved v2 mockups
```

---

## Task Format

### Basic Task
```markdown
- [ ] #tag Task description
```

### With Metadata
```markdown
- [ ] #feature User profiles
  - Assigned: @ameer
  - Due: 2026-02-20
  - Related: [[user-system]] [[auth-flow]]
```

### With Checklist
```markdown
- [ ] #feature Payment integration
  - [ ] Research Stripe vs PayPal
  - [ ] Set up test account
  - [ ] Implement checkout flow
  - [ ] Test with sandbox
```

---

## Using Tags

Tags help filter and organize:

| Tag | Use For |
|-----|---------|
| `#bug` | Bug fixes |
| `#feature` | New features |
| `#docs` | Documentation |
| `#research` | Research tasks |
| `#urgent` | High priority |
| `#blocked` | Waiting on something |
| `#quick` | Under 30 min tasks |
| `#cleanup` | Maintenance |
| `#explore` | Research/spikes |
| `#critical` | Urgent/Important |
| `#infrastructure` | DevOps/System |
| `#visual` | UI/Design |

---

## Linking Files

Use [[wikilinks]] to connect related content:

```markdown
## In Progress

- [ ] #feature Booking calendar [[mind/research/findings/booking-domain-model]]
  - Reference the research findings
  - Check [[mind/skills/codesync]] before committing
```

---

## Dataview Integration

Query kanban tasks across files:

```dataview
TASK
FROM "mind/workspace"
WHERE !completed
SORT priority DESC
```

Or show by tag:

```dataview
TASK
WHERE contains(tags
  - "#urgent")
```

---

## Best Practices

### Column Order
1. **Backlog** — Everything that might happen
2. **To Do** — Committed to this sprint/week
3. **In Progress** — Currently working on
4. **Review** — Done
  - needs review
5. **Done** — Complete

### Task Size
- Keep tasks actionable (can complete in 1-3 days)
- Break large tasks into sub-tasks
- Use checklists for multi-step tasks

### Regular Review
- Daily: Check "In Progress" and "To Do"
- Weekly: Groom "Backlog"
  - move tasks between columns
- Monthly: Archive completed items

---

## Common Issues

| Issue | Solution |
|-------|----------|
| Kanban not rendering | Add `kanban-plugin: board` to frontmatter |
| Empty columns showing | Remove empty `[]()` lines |
| Tags not styling | Use `#tag` format at start of line |
| Nested checklists not working | Use `- ` for nested items |

---

## Example: Feature Development Board

```markdown
---
kanban-plugin: board
date: 2026-02-13
tags: 
  - kanban
  - features
---

# Feature Development

## Backlog

- [ ] #feature Multi-currency support
- [ ] #feature Dark mode toggle
- [ ] #feature Calendar sync with Outlook

## To Do

- [ ] #feature User profiles [[mind/research/findings/user-profiles]]
- [ ] #bug Mobile navigation broken on iOS

## In Progress

- [ ] #feature Booking system v1
  - [ ] Database schema
  - [ ] API endpoints
  - [ ] Frontend UI
  - Related: [[mind/workspace/feature-space]]

## Review

- [ ] #docs API documentation update
  - @ameer needs to review

## Done

- [x] #feature User authentication
- [x] #feature Basic dashboard
```

---

## Obsidian Kanban Plugin Tips

- **Drag cards** between columns
- **Click dates** to open calendar
- **Right-click** cards for options
- **Archive** completed columns periodically
- **Use templates** for recurring kanban structures

---

## Related

- [[mind/skills/obsidian/dataview]] — Query kanban data
- [[mind/skills/obsidian/templater]] — Auto-generate kanban cards
- [[mind/skills/obsidian/editing-files]] — File editing skills
- [[mind/workspace/feature-space]] — Example kanban board
- [[mind/INDEX]] — Main kanban for daily work

---

*Kanban: Visualize work
  - limit WIP
  - maximize flow.*
