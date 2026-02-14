---
date: 2026-02-13
tags: skill, memory, sessions, logging, workflow
---

# 📝 Memory Skill

> Capture work sessions to long-term memory

## What Is This?

The **Memory Skill** ensures important work is recorded in `mind/memory/sessions/`.

---

## Trigger: When to Log

**ALWAYS create a session log after:**
- ✅ CodeSync commit (after PR created)
- ✅ Major feature completion
- ✅ Architecture decisions
- ✅ Research findings documented
- ✅ Bug fixes with learnings
- ✅ Workflow changes
- ✅ User says: "log this" or "create session"

**NEED:** If work took >30 min or has learnings/decisions, LOG IT.

---

## The Process

### Step 1: Determine Session Type

| Type | When | Example |
|------|------|---------|
| **CodeSync** | After commit + PR | RAM system implementation |
| **Research** | After findings documented | CRM comparison research |
| **Bugfix** | After fix + tests pass | Embedding crash fixed |
| **Decision** | After architecture choice | Move standup → RAM |
| **Violation** | After fixing process | Commit without approval |

### Step 2: Create File

**Path:** `mind/memory/sessions/YYYY-MM-DD-brief-description.md`

**Filename rules:**
- Lowercase, hyphen-separated
- Brief but descriptive
- Include date prefix

Examples:
- `2026-02-13-ram-system-implementation.md`
- `2026-02-13-codesync-mindsync-skills.md`
- `2026-02-12-embedding-crash-fix.md`

### Step 3: Write Content

**Template:**

```markdown
---
date: YYYY-MM-DD
tags: session, type, topic
type: codesync|research|bugfix|decision|violation
---

# Session: Brief Title

## Summary
One paragraph: What we did and why.

## Work Done
- [ ] Task 1 — Status
- [ ] Task 2 — Status
- [ ] Task 3 — Status

## Key Decisions
- **Decision 1** — Rationale
- **Decision 2** — Rationale

## Learnings
- Learning 1
- Learning 2

## Files Changed
- [[path/to/file|File]] — What changed

## Output/Deliverables
- What was produced
- Links to PRs, docs, etc.

## Next Steps
- [ ] Action item 1
- [ ] Action item 2
```

### Step 4: Update INDEX

Add session to `mind/memory/sessions/index.md`:

```markdown
## Recent Sessions

- [[2026-02-13-ram-system|Feb 13]] — RAM system, CodeSync skills
- [[2026-02-12-embedding-fix|Feb 12]] — Embedding crash fixed
```

### Step 5: Update RAM

Add to `mind/memory/RAM.md` under Recent Completed:

```markdown
- [2026-02-13 20:15 PST] [[memory/sessions/2026-02-13-ram-system|RAM system implemented]]
```

---

## Example Sessions

### CodeSync Session

```markdown
---
date: 2026-02-13
tags: session, codesync, skills
type: codesync
---

# Session: RAM System + CodeSync/MindSync Skills

## Summary
Implemented RAM working memory system and created CodeSync/MindSync skills for quality-gated workflow.

## Work Done
- [x] Created RAM.md with timestamped entries
- [x] Created CodeSync skill (quality gate)
- [x] Created MindSync skill (mind updates)
- [x] Updated INDEX.md with skill links
- [x] Deleted 7 redundant files

## Key Decisions
- **RAM replaces standup** — Working memory with stale-item archival
- **"Approve commit and do a PR"** — New approval trigger phrase

## Learnings
- CodeSync needs explicit trigger phrases to avoid accidental commits
- Feature branches keep main clean

## Files Changed
- [[mind/memory/RAM]] — New working memory
- [[mind/skills/codesync/SKILL.md]] — New skill
- [[mind/skills/mindsync/SKILL.md]] — New skill
- [[mind/INDEX]] — Reorganized with wikilinks

## Output
- PR #15: https://github.com/ameernuri/bizing/pull/15

## Next Steps
- [ ] Create session logging skill (meta!)
```

---

## Quick Checklist

- [ ] File created at `memory/sessions/YYYY-MM-DD-description.md`
- [ ] YAML frontmatter with date, tags, type
- [ ] All file references use [[wikilinks]]
- [ ] Added to `memory/sessions/index.md`
- [ ] Added to `memory/RAM.md` under Recent Completed
- [ ] PR/issue linked if applicable

---

## Related

- [[mind/memory/RAM]] — Working memory (check before logging)
- [[mind/skills/codesync]] — Triggers session after commit
- [[mind/skills/mindsync]] — Updates mind after session
- [[mind/skills/ram/Ram]] — Manages working memory

---

*Log it or lose it. Every significant work gets a session.*
