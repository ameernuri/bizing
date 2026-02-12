---
date: 2026-02-11
tags: skill, obsidian, dataview, query
---

# 🔍 Dataview

*Query and display your mind data dynamically.*

---

## What is Dataview?

Dataview is a **live index and query engine** for your Obsidian vault. It reads metadata from your notes and lets you query, filter, sort, and display that data in real-time.

**Key capability:** Your queries stay **always up to date** — when you change a file, the query result updates automatically.

---

## Data Indexing

Dataview can only query **indexed data**:

### Automatically Indexed (Implicit Fields)
- `file.name` — Note name
- `file.path` — Full path
- `file.folder` — Parent folder
- `file.tags` — All #tags
- `file.inlinks` — Notes linking to this
- `file.outlinks` — Notes this links to
- `file.ctime` — Created time
- `file.mtime` — Modified time
- `file.size` — File size
- `file.tasks` — All tasks in file

### Manual Metadata (Frontmatter)
Add YAML at top of file:
```yaml
---
author: "Ameer"
date: 2026-02-11
priority: high
tags: daily, standup
---
```

### Inline Fields
Add anywhere in content:
```markdown
From [author:: Ameer], created on (date:: 2026-02-11)

This is #priority::high work.
```

---

## Query Types

### 1. LIST — Simple list of files
```dataview
LIST
FROM "mind/symbiosis"
WHERE file.tags
```

### 2. TABLE — Columns of data
```dataview
TABLE file.ctime AS "Created", file.tags AS "Tags"
FROM "mind/memory/sessions"
SORT file.ctime DESC
LIMIT 10
```

### 3. TASK — Task lists
```dataview
TASK
FROM "mind"
WHERE !completed
SORT priority ASC
```

### 4. CALENDAR — Date-based view
```dataview
CALENDAR file.ctime
FROM "mind/memory/sessions"
```

---

## Essential Data Commands

### FROM — Select source
```dataview
LIST
FROM "mind/symbiosis"           # Folder
FROM #daily                       # Tag
FROM [[INDEX]]                    # Linked from
FROM "mind" AND #task             # Combined
```

### WHERE — Filter results
```dataview
LIST
FROM "mind"
WHERE file.tags AND contains(file.tags, "#critical")
WHERE date = date(today)
WHERE priority = "high"
WHERE !completed
```

### SORT — Order results
```dataview
LIST
FROM "mind/memory/sessions"
SORT file.ctime DESC              # Newest first
SORT priority ASC                 # Priority order
```

### LIMIT — Restrict count
```dataview
LIST
FROM "mind/memory/sessions"
SORT file.ctime DESC
LIMIT 5                           # Only 5 most recent
```

### GROUP BY — Organize by field
```dataview
TABLE rows.file.name AS "Files"
FROM "mind"
GROUP BY file.folder
```

---

## Common Functions

### Date Functions
```dataview
 date(today)           # Current date
 date(now)             # Current datetime
 date(2026-02-11)      # Specific date
 file.ctime.year       # Extract year
 date(now) - file.ctime # Time difference
```

### String Functions
```dataview
 contains(file.tags, "#critical")
 startsWith(file.name, "2026-02")
 endsWith(file.path, "standup.md")
 regexmatch("pattern", file.name)
```

### List Operations
```dataview
 length(file.tags)              # Count tags
 sum(file.size)                 # Total size
 max(file.ctime)                # Most recent
 min(file.ctime)                # Oldest
 filter(file.tags, (t) => contains(t, "#"))
```

---

## Real-World Examples

### Today's Tasks
```dataview
TASK
FROM "mind/symbiosis"
WHERE contains(tags, "#today") AND !completed
SORT priority ASC
```

### Recent Sessions
```dataview
TABLE file.ctime AS "Date", file.tags AS "Tags"
FROM "mind/memory/sessions"
SORT file.ctime DESC
LIMIT 5
```

### Blockers
```dataview
TASK
FROM "mind"
WHERE contains(tags, "#blocker") AND !completed
```

### Open Tasks by Priority
```dataview
TASK
FROM "mind"
WHERE !completed
GROUP BY priority
```

### Files Modified Today
```dataview
LIST
FROM "mind"
WHERE file.mtime >= date(today)
SORT file.mtime DESC
```

### Notes Without Tags (for cleanup)
```dataview
LIST
FROM "mind"
WHERE !file.tags
```

### Learning Archive by Date
```dataview
TABLE date AS "When", learning AS "What"
FROM "mind/symbiosis/feedback"
FLATTEN learnings AS learning
WHERE learning
SORT date DESC
```

---

## Inline Queries

For single values anywhere in text:

```markdown
Total open tasks: `= length(filter(file.tasks, (t) => !t.completed))`

Today is: `= date(today)`

Files updated today: `= length(filter(this.file.inlinks, (f) => f.mtime >= date(today)))`
```

---

## Best Practices

### 1. Use Tags for Categories
```yaml
---
tags: task, critical, api
---
```

### 2. Use Frontmatter for Structured Data
```yaml
---
status: in-progress
priority: high
assignee: ameer
due: 2026-02-15
---
```

### 3. Be Specific with FROM
Don't query entire vault — scope to relevant folders:
```dataview
FROM "mind/symbiosis"     # Good
FROM "mind"               # Okay
FROM ""                   # Slow on large vaults
```

### 4. Index What You Query
Dataview only sees:
- Frontmatter YAML
- Inline [key:: value] fields
- Implicit fields (file.*, tags, tasks)

Regular text paragraphs are NOT indexed.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Query not updating | Dataview refreshes automatically; force with `Ctrl+Shift+P` → "Dataview: Rebuild Vault Cache" |
| Field not showing | Check if it's in frontmatter or inline format |
| Empty results | Check FROM path exists; check WHERE conditions aren't too strict |
| Slow queries | Narrow FROM scope; add LIMIT |
| Date errors | Use `date(YYYY-MM-DD)` format |

---

## Resources

- **Docs:** https://blacksmithgu.github.io/obsidian-dataview/
- **Query Reference:** https://blacksmithgu.github.io/obsidian-dataview/reference/
- **Functions:** https://blacksmithgu.github.io/obsidian-dataview/reference/functions/
- **Examples:** https://blacksmithgu.github.io/obsidian-dataview/resources/examples/

---

## Related

- [[kanban-formatting|Kanban Formatting]] — Visual task boards
- [[session-logging|Session Logging]] — Document work sessions
- [[../index|Skills Index]]
