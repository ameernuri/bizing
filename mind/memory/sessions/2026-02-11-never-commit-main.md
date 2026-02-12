---
date: 2026-02-11
tags: session, log, mindsync, hard-mindsync
---

# 📝 Session: Never Commit to Main — Hard Rule Enforced

> *HARD MINDSYNC: Enforcing absolute prohibition on main branch commits*

## Participants

- **Ameer** — Human
- **Pac** — AI Assistant

## Context

User caught me committing to main (twice!) and demanded an absolute rule: NEVER commit to main under any circumstances. This is a HARD MINDSYNC to enforce this critical workflow rule.

## What We Did

### 1. Established ABSOLUTE RULE

**NEVER commit to main. NO EXCEPTIONS. NO EXCUSES.**

This is not a guideline — it's a hard rule with:
- First position in Rules to Remember
- Bold warnings in MIND-FRAMEWORK
- Pre-commit checklist item
- Session log verification
- Multiple enforcement points

### 2. Updated All Mind Files

#### symbiosis/feedback.md
- ✅ Rule #4 updated: "NEVER commit to main — ALWAYS create feature branches. This is ABSOLUTE."
- ✅ New Rule #13: "COMMIT TO MAIN = VIOLATION"

#### MIND-FRAMEWORK.md
- ✅ New section "⚠️ ABSOLUTE RULE: NEVER Commit to Main"
- ✅ Why main is protected (5 reasons)
- ✅ "If You Find Yourself on Main Branch" procedure
- ✅ Updated enforcement rules table with "ABSOLUTE - NO EXCEPTIONS"
- ✅ Safety check procedure

#### skills/workflow/documentation-standards.md
- ✅ Pre-commit safety check script
- ✅ "⚠️ ABSOLUTE RULE: NEVER commit to main"
- ✅ Git branch check before commit
- ✅ Safe pattern: never checkout main during work

#### .templates/session-log.md
- ✅ Git Workflow checklist: "NOT on main branch" — first item

### 3. Created Safety Mechanisms

**Pre-Commit Safety Check:**
```bash
git status  # Are you on main? STOP.

if [ $(git branch --show-current) = "main" ]; then
  echo "❌ STOP! You are on main branch."
  echo "✅ Do: git checkout -b feature/new-branch"
  exit 1
fi
```

**The Safe Pattern:**
1. Always start on feature branch
2. Never checkout main during active work
3. Commit to feature branch only
4. Push and PR when ready

## Decisions Made

1. **Never commit to main is absolute** — No exceptions, no excuses
2. **Multiple enforcement points** — Checklist, warnings, procedures
3. **If on main, create feature branch** — Cherry-pick or redo, never commit
4. **Pre-commit check required** — Always verify branch before committing

## Learnings

- Habit of committing to main is dangerous
- Multiple enforcement points prevent violations
- Clear procedures help when accidentally on main
- This is a hard rule, not a guideline

## Files Changed

### Mind Files
- [x] [[symbiosis/feedback]] — Rule #4 + #13 about main commits
- [x] [[MIND-FRAMEWORK]] — ABSOLUTE RULE section + enforcement table
- [x] [[skills/workflow/documentation-standards]] — Safety check + safe pattern
- [x] [[.templates/session-log]] — Main branch verification checklist
- [x] Session log created (this file)

### Documentation Work
- [x] Established absolute rule with multiple enforcement points
- [x] Created safety procedures for when on main
- [x] Added pre-commit branch verification
- [x] Updated all relevant checklists

## 💡 Key Insight

**"Never commit to main" is not a preference — it's a hard rule with enforcement. The penalty for violation is broken workflow, lost history, and bypassed review. Multiple checkpoints prevent accidents.**

---

*HARD MINDSYNC complete. Never commit to main rule enforced across ALL mind files.*
