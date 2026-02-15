---
date: 2026-02-14
tags:
  - skill
  - files
  - creating
  - updating
  - workflow
  - documentation
---

# 📁 Creating & Updating Files Skill

> Complete guide to creating and updating Bizing mind files.

---

## The Golden Rules

1. **Every file needs frontmatter** — date, tags, status
2. **Link everything** — Use wikilinks for all references
3. **One source of truth** — Don't duplicate information
4. **Atomic changes** — One logical change per file
5. **Timestamp everything** — Know when things happened

---

## Part 1: Creating New Files

### Step 1: Choose the Right Location

| Directory | Purpose | Example |
|-----------|---------|---------|
| `mind/memory/sessions/` | Work session logs | `2026-02-14-synopsis.md` |
| `mind/skills/` | How-to guides | `Synopsis.md` |
| `mind/research/findings/` | Research results | `api-first-design.md` |
| `mind/workspace/` | Active planning | `feature-space.md` |
| `mind/evolution/` | Major changes | `2026-02-major-reorg.md` |
| `mind/identity/` | Core identity | `essence.md`, `values.md` |
| `mind/knowledge/` | Domain knowledge | `domain/business-model.md` |
| `mind/skills/category/` | Skills by category | `dreaming/Dreaming.md` |

### Step 2: Add Frontmatter

**Required frontmatter:**

```yaml
---
date: 2026-02-14
tags:
  - tag1
  - tag2
  - tag3
status: active
---
```

**Optional fields:**
```yaml
---
date: 2026-02-14
tags:
  - session
  - dreamer
type: session
---
```

### Step 3: Use the Correct Naming Convention

| File Type | Pattern | Example |
|-----------|---------|---------|
| Session | `YYYY-MM-DD-description.md` | `2026-02-14-synopsis.md` |
| Skill | `Category/DescriptiveName.md` | `dreaming/Dreaming.md` |
| Research | `research/findings/topic.md` | `api-first-design.md` |
| Identity | `identity/name.md` | `essence.md` |
| Knowledge | `knowledge/domain/topic.md` | `business-model.md` |

### Step 4: Link Everything

**Always link to:**
- Related files (`[[path/to/file]]`)
- Skills (`[[skills/category/Skill]]`)
- Memory (`[[memory/sessions/date]]`)
- Knowledge (`[[knowledge/domain/topic]]`)

**Example:**
```markdown
# Session: Synopsis Creation

Created [[SYNOPSIS]] to capture Bizing's story.

Followed [[skills/creating-files]] for guidelines.
Updated [[INDEX]] to include new skill.
Logged to [[memory/sessions/2026-02-14-synopsis]].
```

---

## Part 2: Updating Existing Files

### The Surgical Edit Principle

**Edit only what changed:**

```markdown
## ✅ Recent Completed (Last 48h)

### Feb 14, 2026
- [2026-02-14 20:00 PST] **New Entry** — What was added
```

**Don't rewrite entire sections unless necessary.**

### Adding New Entries

**To lists:**
```markdown
- [[./2026-02-14-new-session|Feb 14]] — What happened
```

**To RAM (Active Context Only):**
```markdown
- [2026-02-14 20:00 PST] **Active Task** — What we're working on NOW
```

RAM = Working Memory. Only add if it's important RIGHT NOW.

**To tables:**
```markdown
| New Row | Data | Here |
```

### Updating References

When renaming files:
1. Rename the file
2. Search for all references: `grep -r "old-name" mind/`
3. Update each reference
4. Update INDEX.md if applicable

### Maintaining Consistency

**When you update a file:**
- Check if frontmatter is correct
- Verify all wikilinks work
- Ensure tags are relevant
- Add timestamp if required

---

## Part 3: File Formatting Standards

### Headers

```markdown
# H1: Main Title

## H2: Section

### H3: Subsection
```

### Bullet Points

```markdown
- First item
- Second item
  - Indented sub-item
- Third item
```

### Tables

```markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data     | Data     | Data     |
```

### Wikilinks

```markdown
- [[path/to/file|Link Text]]
- [[path/to/file]] (uses filename)
- [[./relative/path|Local Link]]
```

### Code Blocks

```markdown
```yaml
---
date: 2026-02-14
tags:
  - tag1
  - tag2
---
```
```

---

## Part 4: Tag System

### Frontmatter Tags (Required)

```yaml
---
date: 2026-02-14
tags:
  - tag1
  - tag2
  - tag3
---
```

### Common Tags by File Type

| Tag | Use For |
|-----|---------|
| `session` | Work session logs |
| `skill` | How-to guides |
| `research` | Research documents |
| `workflow` | Process documents |
| `dissonance` | Tension documents |
| `curiosity` | Question documents |
| `identity` | Core identity files |
| `knowledge` | Domain knowledge |
| `memory` | Memory-related files |
| `evolution` | Major changes |

### Tagging Rules

1. **Minimum 2 tags** for most files
2. **Use lowercase** for consistency
3. **Use hyphens** for multi-word: `working-memory`
4. **No commas** — use array format

---

## Part 5: Common Patterns

### Pattern 1: Creating a Session Log

```markdown
---
date: 2026-02-14
tags:
  - session
  - task-name
type: session
---

# Session: Task Name

## Summary
Brief description of what was done.

## What Changed
- Item 1
- Item 2

## Files
- [[path/to/file1]]
- [[path/to/file2]]

---

*Session: 2026-02-14 20:00 PST*
```

### Pattern 2: Creating a Skill

```markdown
---
date: 2026-02-14
tags:
  - skill
  - category
  - topic
---

# 📖 Skill Name

> One-line description

---

## What Is This?
Description of the skill.

## How To Use
Step-by-step guide.

## Example
```markdown
Code example
```

## Related
- [[skill1]]
- [[skill2]]

---

*Skill: Category/SkillName*
```

### Pattern 3: Updating RAM

```markdown
- [YYYY-MM-DD HH:MM PST] **Task** — Description
```

### Pattern 4: Updating INDEX

```markdown
- [[./YYYY-MM-DD-description|Feb DD]] — What happened
```

---

## Part 6: File Creation Checklist

- [ ] Chose correct location
- [ ] Named correctly (YYYY-MM-DD or DescriptiveName)
- [ ] Added frontmatter (date, tags, status)
- [ ] Used H1 for title
- [ ] Linked to related files
- [ ] Used correct formatting
- [ ] Added to INDEX if applicable
- [ ] Added to RAM if active context
- [ ] Created session log if significant

---

## Part 7: The Update Checklist

When updating a file:

- [ ] Made surgical edit (not wholesale rewrite)
- [ ] Updated timestamp if required
- [ ] Verified wikilinks still work
- [ ] Updated INDEX if structure changed
- [ ] Updated RAM if active focus changed
- [ ] Created session log if significant change

---

## Integration with Other Skills

### Follow [[skills/obsidian/editing-files]]
- Obsidian-specific formatting
- Templater templates
- Dataview queries

### Follow [[skills/memory/Memory]]
- Session logging requirements
- Long-term memory structure

### Follow [[skills/mindsync/Mindsync]]
- When to do SOFT vs HARD updates
- Update procedures

### Follow [[skills/dreaming/Dreaming]]
- How Dreamer scans files
- What Dreamer looks for

### Follow [[skills/mapping/Mapping]]
- MAP.md updates
- Structure maintenance

---

## The Commit Rule

**IMPORTANT: Always use CodeSync for commits.**

Before committing any code or documentation changes:

1. **Run tests FIRST** — `npm test`
2. **Verify results** — See all test output
3. **Ask for approval** — "Approve commit and do a PR?"
4. **Only then commit** — After explicit approval

**NEVER:** Commit without running tests first.

**Related:** [[skills/codesync/CodeSync|CodeSync Skill]]

---

## Quick Reference

### File Locations
```
mind/
├── memory/sessions/  → Session logs
├── skills/          → How-to guides
├── research/        → Research findings
├── workspace/       → Active planning
├── evolution/       → Major changes
├── identity/        → Core identity
├── knowledge/       → Domain knowledge
└── skills/category/ → Skills by type
```

### Frontmatter Template
```yaml
---
date: YYYY-MM-DD
tags:
  - tag1
  - tag2
  - tag3
status: active
---
```

### Linking Template
```markdown
[[path/to/file|Link Text]]
```

---

## Related Skills

- [[skills/obsidian/editing-files]] — Obsidian-specific editing
- [[skills/memory/Memory]] — Session logging
- [[skills/mindsync/Mindsync]] — Mind updates
- [[skills/dreaming/Dreaming]] — Dreamer scanning
- [[skills/mapping/Mapping]] — Structure maintenance
- [[skills/synopsis/Synopsis]] — Narrative documentation

---

*Create with purpose. Update with precision. Link everything.*
