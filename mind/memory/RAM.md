---
date: 2026-02-15
tags:
  - ram
  - working-memory
  - active
---

# 🧠 RAM — Working Memory

> Active context. What matters RIGHT NOW. Read this first.

---

## 🎯 Active Focus

**Primary:** [2026-02-15 11:15 PST] Session Workflow
- [[mind/skills/workflow/SessionWorkflow]] — Automatic session workflow created
- [[scripts/workflows/session-start.sh]] — Session start script
- [[scripts/workflows/pre-commit.sh]] — Pre-commit script

**Secondary:** Dreamer Auto-Scan (every 15 min)
- Runs autonomously, finds contradictions + curiosities

---

## 🚨 Critical

- **TEST BEFORE COMMIT** — Always run tests BEFORE committing
  - [[mind/skills/codesync/CodeSync|CodeSync Skill]]
  - Use: `source scripts/workflows/pre-commit.sh`

---

## 🔄 Session Workflow (START HERE)

At the **start of every session**, run:

```bash
cd ~/projects/bizing
source scripts/workflows/session-start.sh
```

This automatically:
1. Reads RAM → Active context
2. Reads INDEX → Entry point
3. Reads feedback → Learnings

**Then do work.**

**Before committing**, run:

```bash
source scripts/workflows/pre-commit.sh
```

This automatically:
1. Runs tests
2. Shows results
3. Asks for approval
4. Only commits if approved

---

## 📌 Quick Links

| File | Purpose |
|------|---------|
| [[skills/workflow/SessionWorkflow]] | Complete workflow documentation |
| [[scripts/workflows/session-start.sh]] | Session start script |
| [[scripts/workflows/pre-commit.sh]] | Pre-commit script |
| [[INDEX]] | Entry point |
| [[SYNOPSIS]] | Bizing's story |
| [[DISSONANCE]] | Active contradictions |
| [[CURIOSITIES]] | Open questions |
| [[Skills]] | All skills |

---

*RAM = Working Memory. Session Workflow: Automatic. Reliable. Cascading.*
