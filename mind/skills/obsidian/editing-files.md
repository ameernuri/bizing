---
date: 2026-02-13
tags: skill, editing, obsidian, workflow
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
tags: tag1, tag2, category
status: active|archived|draft
---
```

### Step 3: Use Wikilinks

Link to everything mentioned:

```markdown
# Session: Database Migration

Updated [[mind/knowledge/tech/database-schema]] with new tables.
Followed [[mind/skills/codesync]] for quality gates.

See also: [[mind/memory/sessions/2026-02-12-prev-session]]
```

---

## Editing Existing Files

### Surgical Edits

Edit only what needs changing:

```markdown
## ✅ Recent Completed

- [2026-02-13 14:30 PST] Fixed [[bug-123]] in [[auth-system]]
- [2026-02-13 15:00 PST] Updated [[docs]] with new examples
```

### Adding Sections

Use consistent headers:

```markdown
## 🎯 New Section

Content here with [[links]] and #tags

### Subsection

More details...
```

### Updating Checklists

```markdown
- [x] Completed task
- [ ] Pending task [[related-file]]
- [ ] Another task #urgent
```

---

## Linking Strategy

### Every Mention Gets a Link

```markdown
❌ Bad: Check the INDEX for details.
✅ Good: Check [[mind/INDEX]] for details.

❌ Bad: We use CodeSync for commits.
✅ Good: We use [[mind/skills/codesync|CodeSync]] for commits.
```

### Link Types

| Pattern | Example |
|---------|---------|
| File | `[[mind/INDEX]]` |
| With display | `[[mind/skills/ram|RAM Skill]]` |
| Heading | `[[mind/INDEX#Skills]]` |
| Block | `[[mind/INDEX#^block-id]]` |

### Creating Missing Links

If a file doesn't exist yet:

```markdown
Planning to work on [[mind/skills/new-skill|New Skill]] — will create later.
```

Click the link in Obsidian to create it.

---

## Using Tags

### Tag Conventions

| Tag | Use |
|-----|-----|
| `#kanban` | Kanban boards |
| `#skill` | How-to guides |
| `#session` | Work logs |
| `#research` | Research findings |
| `#decision` | Decision records |
| `#active` | Currently relevant |
| `#archived` | No longer current |
| `#urgent` | Needs attention |
| `#blocked` | Can't proceed |

### Tag Placement

```markdown
---
tags: session, backend, database
---

# Session Title

Working on #database migration for #backend services.
```

---

## Dataview Queries

Query files by tags or links:

### All Active Sessions
```dataview
LIST
FROM "mind/memory/sessions"
WHERE contains(tags, "#active")
SORT date DESC
```

### Files Linking to INDEX
```dataview
LIST
WHERE contains(file.outlinks, [[mind/INDEX]])
```

### Recent Skills
```dataview
LIST
FROM "mind/skills"
WHERE date > date(today) - dur(7 days)
SORT date DESC
```

---

## File Organization

### Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Sessions | `YYYY-MM-DD-description.md` | `2026-02-13-ram-system.md` |
| Skills | `SKILL.md` or `skill-name.md` | `codesync/SKILL.md` |
| Research | `topic-name.md` | `booking-domain-model.md` |
| Daily | `YYYY-MM-DD.md` | `2026-02-13.md` |

### Directory Structure

```
mind/
├── INDEX.md              # Entry point
├── RAM.md                # Working memory
├── MAP.md                # Complete index
├── DISSONANCE.md         # Unresolved questions
├──
├── identity/             # Who Bizing is
├── knowledge/            # What Bizing knows
│   ├── domain/          # Business knowledge
│   └── tech/            # Technical knowledge
├── memory/              # Experiences
│   ├── sessions/        # Work logs
│   └── briefings/       # Summaries
├── skills/              # How-to guides
│   ├── codesync/        # Commit workflow
│   ├── mindsync/        # Update workflow
│   └── obsidian/        # Obsidian tips
├── research/            # Research
│   └── findings/        # Completed research
├── workspace/           # Active planning
│   └── feature-space.md # Feature kanban
└── evolution/           # Major changes
```

---

## Templater Integration

Auto-populate new files:

### Session Template
```markdown
---
date: <% tp.date.now("YYYY-MM-DD") %>
tags: session
type: <%* tR += await tp.system.suggester(["codesync", "research", "bugfix"], ["codesync", "research", "bugfix"]) %>
---

# Session: <% tp.file.title %>

## Summary

## Work Done

## Key Decisions

## Learnings

## Files Changed

## Output

## Next Steps
```

---

## Common Patterns

### Decision Record
```markdown
---
date: 2026-02-13
tags: decision, architecture
---

# Decision: Use PostgreSQL for primary database

## Context
[[problem-statement]]

## Decision
Use [[PostgreSQL]] over [[MySQL]]

## Consequences
- ✅ Better JSON support
- ✅ More robust
- ❌ Slightly more complex setup

## Related
- [[mind/decisions/database-migration]]
```

### Research Finding
```markdown
---
date: 2026-02-13
tags: research, findings, topic
---

# Research: Topic Name

## Summary

## Key Findings

## Implementation Notes

## References
- [[source-1]]
- [[source-2]]
```

---

## Link Maintenance

### Finding Orphaned Files

```dataview
LIST
WHERE length(file.inlinks) = 0
AND file.path != "mind/INDEX"
AND file.path != "mind/MAP"
```

### Updating Broken Links

When renaming files, Obsidian updates links automatically. For manual updates:

1. Search for old filename: `[[old-name]]`
2. Replace with new name: `[[new-name]]`
3. Check backlinks in [[mind/MAP]]

---

## Best Practices

### Always Include
- [ ] YAML frontmatter with date
- [ ] At least 3 [[wikilinks]]
- [ ] Relevant #tags
- [ ] Link back to [[mind/INDEX]]

### Never Do
- [ ] Leave files unlinked (orphaned)
- [ ] Use absolute paths
- [ ] Forget to tag
- [ ] Commit without HARD MindSync

### Regular Maintenance
- Weekly: Archive stale items in [[mind/memory/RAM]]
- Monthly: Review orphaned files
- Quarterly: Update [[mind/MAP]] structure

---

## Related

- [[mind/skills/obsidian/kanban]] — Visual task boards
- [[mind/skills/obsidian/dataview]] — Query your mind
- [[mind/skills/obsidian/templater]] — Auto-generate files
- [[mind/INDEX]] — Main entry point

---

*Good files are well-linked, well-tagged, and well-maintained.*
