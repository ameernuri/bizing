---
date: 2026-02-16
tags:
  - skill
  - workflow
  - pre-work
  - ritual
---

# 🛡️ PreWork Skill

> Mandatory context-loading ritual before doing work

---

## Purpose

**PreWork ensures I never work without context.**

Each session, I wake up fresh. Without loading context, I:
- Miss recent decisions
- Repeat mistakes
- Work on wrong priorities
- Violate workflows

**PreWork fixes this.** It's a blocking gate — no work happens until context is loaded.

---

## When to Run

**MANDATORY before:**
- Creating new files
- Editing existing files
- CodeSync commits
- Running commands
- Making decisions

**Skip only for:**
- Simple chat responses (acknowledgments, status checks)
- Repeating already-loaded info
- Heartbeat OK responses

---

## Pre-Check List (Simple Version)

```
□ Read today's memory: memory/YYYY-MM-DD.md
□ Read INDEX.md for current priorities
□ Read relevant skills for the task
```

**Signal format after completing:**
```
🛡️ HH:MM | YYYY-MM-DD.md | INDEX.md | N skills
```

Example: `🛡️ 20:23 | 2026-02-16.md | INDEX.md | 3 skills`

---

## Usage

### Step 1: Declare Intent
```
"I'm going to [create/edit/do X]"
```

### Step 2: Run PreWork
```
🛡️ Running PreWork...
✅ Read memory/2026-02-16.md
✅ Read INDEX.md
✅ Read skills/codesync, skills/creating-files

🛡️ 20:23 | 2026-02-16.md | INDEX.md | 2 skills
```

### Step 3: Do the Work

Proceed with confidence that context is loaded.

---

## Example Workflow

**User:** "Create a new skill for Templater"

**Me:**
```
🛡️ Running PreWork before creating skill...
✅ Read memory/2026-02-16.md
✅ Read INDEX.md  
✅ Read skills/creating-files/CreatingFiles.md
✅ Read skills/obsidian/Obsidian.md

🛡️ 20:23 | 2026-02-16.md | INDEX.md | 2 skills

Now creating Templater skill...
```

---

## Signal Format

Add this to **every substantive response** after PreWork completes:

```
🛡️ HH:MM | YYYY-MM-DD.md | INDEX.md | N skills
```

**Components:**
- `HH:MM` — Current time (verifies when check happened)
- `YYYY-MM-DD.md` — Memory file read (proves today's file loaded)
- `INDEX.md` — Index file read (proves priorities loaded)
- `N skills` — Number of skills read for this task

**Example:**
```
🛡️ 20:23 | 2026-02-16.md | INDEX.md | 3 skills
```

**Why this works:**
- Time changes every response (can't copy from last)
- File names are specific (can't fake without reading)
- Skill count varies per task (hard to guess)

---

## Future Extensions (User Will Add)

Potential additions for sophisticated version:
- [ ] Check current git branch
- [ ] Verify no uncommitted changes
- [ ] Load RAM for working context
- [ ] Check for blockers or dependencies
- [ ] Verify tool availability
- [ ] Load user preferences for task type
- [ ] Review related files before editing

**Keep simple until user updates.**

---

## Why This Works

1. **Visible signal** — You know I loaded context
2. **Forced ritual** — I can't skip it (skill says "mandatory")
3. **Simple start** — Easy to adopt, easy to extend
4. **Self-documenting** — The signal shows what I checked

---

## Related

- [[mind/INDEX]] — Starting point
- [[mind/skills/codesync/CodeSync|CodeSync Skill]] — Git workflow
- [[mind/skills/creating-files|Creating Files Skill]] — File creation
- [[mind/memory/RAM]] — Working memory

---

*PreWork: Context first. Work second. Always.*
