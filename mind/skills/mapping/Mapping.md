---
date: 2026-02-14
tags: 
  - skill
  - mapping
  - map
  - navigation
  - structure
---

# 🗺️ Mapping Skill

> *How to maintain the mind's structure and navigation.*

---

## What Is Mapping?

**Mapping** ensures the mind is:
- **Navigable** — Easy to find anything
- **Connected** — Related files are linked
- **Organized** — Clear logical structure
- **Complete** — No orphaned files

---

## The MAP.md File

**Location:** `mind/MAP.md`

**Purpose:** Complete index of the Bizing mind
  - organized logically.

**Structure:**
```
1. Entry Points (INDEX
  - README
  - FRAMEWORK)
2. Identity (who we are)
3. Symbiosis (human + AI)
4. Knowledge (domain + technical)
5. Agents & Interfaces
6. Skills (how we work)
7. Research
8. Operations
9. Memory
10. Design
11. Start Here
12. Workspace
13. Evolution & Archive
14. Daily
15. Templates
```

---

## Mapping Principles

### 1. Every File Has a Home

Every file should appear in MAP.md exactly once.

**If you add a file:**
- Add it to the appropriate section in MAP.md
- Use wikilinks: `[[path/to/file|Readable Name]]`
- Add brief description

**If you remove a file:**
- Remove from MAP.md
- Check for orphaned links

### 2. Related Files Are Linked

**When files relate:**
- Link in both directions
- Add to relevant sections
- Use descriptive link text

**Example:**
```markdown
**→ [[research/findings/api-first-design|API-First Design]]** — OpenAPI patterns
  - contract testing
```

### 3. No Orphaned Files

**Orphaned file:** A file not linked from MAP.md or any indexed file.

**To find orphans:**
```bash
# List all MD files
find mind -name "*.md" -type f | wc -l

# Compare with MAP.md links
# Manual check needed
```

**Fix orphans:**
- Add to appropriate MAP.md section
- Or remove if truly unused

### 4. Consistent Structure

**MAP.md sections follow pattern:**

```markdown
## Section Name

**→ [[path/hub|Hub]]** — Section description

### Subsection:
**→ [[path/file|File Name]]** — Brief description

- [[path/another|Another]] — Description
```

---

## How to Update MAP.md

### Adding a New File

**Step 1:** Place file in appropriate location

**Step 2:** Add to MAP.md

```markdown
**→ [[path/to/new-file|New File]]** — Brief description
```

**Step 3:** Link from related files

```markdown
Related: [[path/to/new-file]]
```

### Linking Existing Files

**From MAP.md:**
```markdown
**→ [[path/to/file|Readable Name]]** — What it is
```

**From other files:**
```markdown
See [[path/to/file]] for details.
```

### Updating Section Organization

**When reorganizing:**
1. Move file in filesystem
2. Update MAP.md links
3. Update all internal wikilinks
4. Run MindSync

---

## Mapping Checklist

When adding new content
  - verify:

- [ ] File added to MAP.md
- [ ] Correct section
- [ ] Wikilink format: `[[path|name]]`
- [ ] Brief description included
- [ ] Related files linked
- [ ] No broken links
- [ ] Consistent with other entries

---

## Integration with Other Skills

### Dreaming Skill
Follow [[mind/skills/dreaming]]:
- Dreamer finds missing links
- Add discovered links to MAP.md
- Improve structure based on findings

### Editing Files Skill
Follow [[mind/skills/obsidian/editing-files]]:
- Consistent frontmatter
- Proper wikilinks
- Clear file names

### Memory Skill
Follow [[mind/skills/memory]]:
- Session logs appear in memory/sessions/
- Indexed in MAP.md under "Memory"

### MindSync Skill
Follow [[mind/skills/mindsync]]:
- MAP.md updates after major changes
- Structure evolves with mind

---

## Example: Adding a New Research Finding

**File:** `mind/research/findings/new-discovery.md`

**MAP.md addition:**
```markdown
### Completed Findings:

**→ [[research/findings/new-discovery|New Discovery]]** — Brief description
```

**From related file:**
```markdown
See also: [[research/findings/new-discovery]]
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't find file | Check MAP.md sections |
| Orphaned file | Add to MAP.md or remove |
| Broken link | Update wikilink |
| Duplicate entries | Remove one
  - keep best |
| Outdated link | Update link text |

---

## Related Skills

- [[mind/skills/obsidian/editing-files]] — File formatting
- [[mind/skills/dreaming]] — Find missing links
- [[mind/skills/memory]] — Session logging
- [[mind/skills/mindsync]] — Structure updates
- [[mind/MAP]] — The actual map file

---

*Map the mind
  - navigate reality.*
