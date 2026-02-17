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
🛡️ [PreWork OK] memory | index | skills
```

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

🛡️ [PreWork OK] memory | index | skills
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

🛡️ [PreWork OK] memory | index | skills

Now creating Templater skill...
```

---

## Signal Format

Add this to **every substantive response** after PreWork completes:

```
🛡️ [PreWork OK] memory | index | skills
```

Or if specific files checked:
```
🛡️ [PreWork OK] memory/2026-02-16.md | INDEX | CreatingFiles | CodeSync
```

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
