---
date: <% tp.date.now("YYYY-MM-DD") %>
tags: 
  - skill
  - workflow
---

# 🎓 <% tp.file.title %>

> *Template: mind/.templates/skill.md*

## Overview

<% tp.file.cursor(1) %>

## When to Use

<% tp.file.cursor(2) %>

## How To

### Step 1

<% tp.file.cursor(3) %>

### Step 2

### Step 3

## Examples

### Example 1

```
```

### Example 2

```
```

## Common Issues

| Issue | Solution |
|-------|----------|
| | |

## Related

```dataview
LIST FROM "mind/skills" WHERE file.name != this.file.name
```

---

*Skill documented. Link from relevant contexts.*
