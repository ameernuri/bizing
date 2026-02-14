---
date: 2026-02-11
tags: skill, obsidian, kanban
---

# 🎓 Kanban Formatting

*How to format Kanban boards in Obsidian (Obsidian Kanban Plugin).*

---

## Required Frontmatter

```yaml
---
kanban-plugin: board
---
```

## Column Format

```markdown
## Column Name

- [ ] Task 1
- [ ] Task 2
```

## With Tags

```markdown
## Urgent

- [ ] #bug Fix authentication error
- [ ] #critical Deploy to production

## High

- [ ] #feature Add new dashboard
- [ ] #documentation Update README
```

## With Checklists

```markdown
## Todo

- [ ] #critical Deploy to production
  - Run tests
  - Build artifacts
  - Verify deployment
```

## Tags Reference

| Tag | Meaning |
|-----|---------|
| `#bug` | Bug fix |
| `#feature` | New feature |
| `#documentation` | Docs work |
| `#infrastructure` | DevOps/System |
| `#visual` | UI/Design |
| `#cleanup` | Maintenance |
| `#explore` | Research |
| `#critical` | Urgent/Important |
| `#blocker` | Blocker |

## Complete Example

```yaml
---
kanban-plugin: board
---

## Urgent

- [ ] #bug Fix login error
  - Identify root cause
  - Implement fix
  - Test thoroughly

## High

- [ ] #feature User profile page
  - Design mockup
  - Implement UI
  - Add validation

- [ ] #documentation Update API docs
  - Review endpoints
  - Add examples
  - Fix typos

## Medium

- [ ] #cleanup Remove unused code
  - Identify dead code
  - Test removal
  - Commit changes

## Low

- [ ] #explore Try new library
  - Research alternatives
  - Create POC
  - Evaluate performance
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| Kanban not rendering | Add `kanban-plugin: board` to frontmatter |
| Empty columns showing | Remove empty `[]()` lines |
| Tags not styling | Use `#tag` format at start of line |
| Nested checklists not working | Use `- ` for nested items |

---

## Related

- [[mind/skills/workflow/index|Skills Index]]
- [[../workflow|Obsidian Workflow]]
