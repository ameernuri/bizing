---
date: 2026-02-13
tags:
  - skill
  - editing
  - obsidian
  - workflow
---

# 📝 Editing Files Skill

> How to create, edit, and maintain mind files effectively

---

## Creating New Files

### Step 1: Choose Location

| Directory | For |
|-----------|-----|
| `mind/memory/sessions/` | Work session logs |
| `mind/skills/` | How-to guides |
| `mind/research/findings/` | Research results |
| `mind/workspace/` | Active planning |
| `mind/evolution/` | Major changes |

### Step 2: Add Frontmatter

Every file needs YAML frontmatter:

```yaml
---
date: 2026-02-13
tags:
  - skill
  - editing
  - workflow
status: active
---
```

### Step 3: Use Wikilinks

* Link to everything mentioned
* Make sure you link to the .md files as much as possible, not the folders

```markdown
# Session: Database Migration

Updated [[mind/knowledge/tech/database-schema]] with new tables.
Followed [[mind/skills/CodeSync]] for quality gates.

See also: [[mind/memory/sessions/2026-02-12-prev-session]]
```

---

## Editing Existing Files

### Surgical Edits

Edit only what needs changing:

```markdown
## ✅ Recent Completed

- [2026-02-13 10:00 PST] **Task completed** — Description
```

Don't rewrite entire sections unless necessary.

### Adding to Lists

Use consistent formatting:

```markdown
## Recent Sessions

- [[./2026-02-13-session-name|Feb 13]] — What happened
```

---

## Formatting Rules

### Headers

```markdown
## Section Name

### Subsection
```

### Bullet Points

```markdown
- First item
- Second item
  - Indented sub-item
```

### Wikilinks

```markdown
- [[path/to/file|Link Text]]
- [[path/to/file]] (uses filename as text)
```

### Tags

Tags go in frontmatter as array:

```yaml
---
date: 2026-02-13
tags:
  - session
  - database
  - migration
status: active
---
```

---

## File Naming

### Sessions

`memory/sessions/YYYY-MM-DD-description.md`

Example:
- `memory/sessions/2026-02-13-database-migration.md`

### Skills

`skills/category/DescriptiveName.md`

Example:
- `skills/CodeSync.md`
- `skills/Memory.md`
- `skills/Dreaming.md`

### Research

`research/findings/topic.md`

Example:
- `research/findings/api-first-design.md`

---

## Quick Reference

### Common Tags

| Tag | Use For |
|-----|---------|
| `session` | Work session logs |
| `skill` | How-to guides |
| `research` | Research documents |
| `workflow` | Process documents |
| `dissonance` | Tension documents |
| `curiosity` | Question documents |

---

## Related Skills

- [[skills/obsidian/templater]] — Auto-generate files
- [[skills/obsidian/dataview]] — Query files
- [[skills/memory]] — Session logging

---

*Edit with purpose. Link everything.*
