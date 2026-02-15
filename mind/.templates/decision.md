---
date: <% tp.date.now("YYYY-MM-DD") %>
tags: 
  - decision
  - important
status: proposed
---

# 📋 Decision: <% tp.file.title %>

> *Template: mind/.templates/decision.md*

## Status

- [ ] Proposed ← You are here
- [ ] Reviewed
- [ ] Approved
- [ ] Implemented

## Context

<% tp.file.cursor(1) %>

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| | | |
| | | |

## Decision

<% tp.file.cursor(2) %>

## Reasoning

<% tp.file.cursor(3) %>

## Impact

<% tp.file.cursor(4) %>

## Related

```dataview
LIST FROM [[mind]] WHERE contains(file.outlinks
  - this.file.link) AND file.name != this.file.name
```

## Implementation

<% tp.file.cursor(5) %>

---

*Decision made. Log in standup when implemented.*
