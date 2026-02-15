---
date: 2026-02-15
tags:
  - skill
  - workflow
  - session
  - startup
  - cascade
---

# 🔄 Session Workflow Skill

> Automatic workflow that runs at the start of every session

---

## The Session Workflow

Every new context/session starts with this cascade:

```
┌─────────────────────────────────────┐
│     1. SESSION START                │
│     source scripts/workflows/        │
│     session-start.sh                 │
│                                      │
│     → Reads RAM                      │
│     → Reads INDEX                    │
│     → Reads feedback                 │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│     2. DO WORK                      │
│     Answer queries, make changes     │
│                                      │
│     → Follow skills                 │
│     → Use tools                     │
│     → Talk to Bizing when needed     │
│       `node scripts/query-bizing.mjs`│
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│     3. UPDATE CONTEXT               │
│     Update RAM if context changed    │
│                                      │
│     → Active Focus updated?         │
│     → New blockers?                │
│     → New learnings?                │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│     4. PRE-COMMIT (if changes)      │
│     source scripts/workflows/        │
│     pre-commit.sh                   │
│                                      │
│     → Run tests                     │
│     → Get approval                  │
│     → Commit + Push                 │
└─────────────────────────────────────┘
```

---

## Session Start

At the **start of every new session/context**:

```bash
cd ~/projects/bizing
source scripts/workflows/session-start.sh
```

This automatically:
1. Reads `RAM.md` — Active context
2. Reads `INDEX.md` — Entry point
3. Reads `feedback.md` — Learnings

**Output:**
```
🧠 Session Start Workflow
==========================
📖 Reading RAM...
[RAM content]

📖 Reading INDEX...
[INDEX content]

📖 Reading Feedback...
[Feedback content]

✅ Session context loaded

Next: Do work, then update RAM if context changed
```

---

## During Work

While working:

- Follow relevant skills
- Use editing-files skill for documentation
- Use creating-files skill for new files
- Use dreaming skill for mind scans

---

## Before Committing

Before any commit:

```bash
cd ~/projects/bizing
source scripts/workflows/pre-commit.sh
```

This automatically:
1. Runs API tests
2. Runs Admin tests
3. Shows results
4. Asks for approval

**Output:**
```
🔒 Pre-Commit Workflow
=====================

1️⃣ Running tests...

API Tests:
✓ vitest run (13 tests passed)

Admin Tests:
✓ vitest run (36 tests passed)

✅ All tests passed

3️⃣ About to commit changes.

Git status:
 M mind/RAM.md
 M scripts/dreamer.mjs

Approve commit and do a PR? (yes/no): yes

✅ Commit approved

Next: Run 'git add -A && git commit -m "..." && git push'
```

---

## Why This Works

### Cascade Effect

1. **Automatic** — No decision to make, just run the script
2. **Reliable** — Same workflow every time
3. **Context-aware** — RAM tells you what's active
4. **Quality-gated** — Tests must pass, approval required

### Before vs After

**Before:**
```
Work → Work → Work → Commit (oops forgot tests)
```

**After:**
```
Session Start → Do Work → Pre-Commit → Tests → Approval → Commit
```

---

## Files

| File | Purpose |
|------|---------|
| `scripts/workflows/session-start.sh` | Session startup script |
| `scripts/workflows/pre-commit.sh` | Pre-commit quality gate |
| `mind/memory/RAM.md` | Active context (read at start) |
| `mind/INDEX.md` | Entry point (read at start) |
| `mind/symbiosis/feedback.md` | Learnings (read at start) |

---

## Quick Reference

### Start a Session
```bash
cd ~/projects/bizing
source scripts/workflows/session-start.sh
```

### Before Committing
```bash
cd ~/projects/bizing
source scripts/workflows/pre-commit.sh
```

### Every Interaction
1. Read RAM → Understand context
2. Do work → Follow skills
3. Update RAM → If context changed

---

## Related Skills

- [[skills/ram/Ram]] — Working memory (what goes in RAM)
- [[skills/creating-files/CreatingFiles]] — File creation
- [[skills/dreaming/Dreaming]] — Mind scanning
- [[skills/codesync/CodeSync]] — Commit workflow

---

*Session Workflow: Automatic, Reliable, Cascading.*

---

## 🚨 Enforcement

### Git Pre-Commit Hook

A git hook automatically runs tests BEFORE any commit:

```bash
# .git/hooks/pre-commit
# Runs automatically before any git commit
```

**This means:**
- You CANNOT commit without running tests
- The hook blocks commits if tests fail
- No bypassing allowed

### How Bypassing Happens

**WRONG:**
```bash
git add -A && git commit -m "..."  # BYPASSES workflow
```

**RIGHT:**
```bash
source scripts/workflows/pre-commit.sh  # Tests → Approval → Commit
```

### Session Enforcement

At the **start of every session**, you MUST:
1. Run `source scripts/workflows/session-start.sh`
2. Read RAM, INDEX, feedback
3. THEN do work

**No exceptions. No bypassing.**

---

## Why This Works

| Method | What It Does |
|--------|---------------|
| `session-start.sh` | Loads context automatically |
| `pre-commit.sh` | Tests + approval required |
| Git hook | Blocks commits without tests |

**Together:** Reliabile, cascading, un-bypassable workflow

---

*Session Workflow: Automatic. Reliable. Enforced.*
