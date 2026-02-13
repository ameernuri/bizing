# 🧠 INDEX — Bizing Mind Entry Point

> **START HERE. Every interaction begins with this file.**

---

## 🚨 MANDATORY WORKFLOW

```
┌─────────────────────────────────────────────────────┐
│  1. Read INDEX.md          ← You're doing this    │
│  2. Read standup.md        ← Today's priorities   │
│  3. Read feedback.md       ← Recent learnings      │
│  4. Do the work            ← Execute              │
│  5. Update mind            ← Log what you learned │
└─────────────────────────────────────────────────────┘
```

**Every interaction. No exceptions.**

---

## 🎯 What Is Bizing?

**Bizing** = A booking platform that enables AI agents to build startups.

**The Goal:** AI agents describe a startup → Bizing builds it.

**Tech Stack:** Hono API, Next.js Admin, Drizzle ORM, Better Auth

---

## 🔄 The Three Syncs

### MindSync — Keep Knowledge Synchronized

| Level | When | What |
|-------|------|------|
| **SOFT** | Every change | Update `feedback.md`, `standup.md` |
| **HARD** | Major events / "mindsync" | Comprehensive update: feedback, standup, session log |

### TeamSync — Everyone Talks to Everyone

```
Ameer ↔ Mind Files
    ↕
Bizing AI ↔ Pac
```

**The Four Entities:**
1. **Ameer** — Human, creates/updates mind files
2. **Bizing AI** — Reads mind, answers questions
3. **Pac** — AI Assistant, queries Bizing via CLI
4. **Dreamer** — Autonomous evolver, finds conflicts

### CodeSync — Quality Gate Before Commit

```
1. Type Check:     tsc --noEmit          → Zero errors
2. Unit Tests:    vitest run            → All pass
3. E2E Tests:     playwright test        → All pass
IF ALL PASS → Commit → Push → Create PR
IF ANY FAIL → DO NOT COMMIT
```

---

## 🧠 Dreamer — What It Does

**The Dreamer** is an autonomous mind evolver.

**Its Job:**
1. **Find REAL conflicts** — Two files say opposite things
2. **Add to DISSONANCE.md** — Document the tension clearly
3. **Update MAP.md** — Keep every file mapped

**NOT its job:**
- Log "Dreamer Run" messages
- Find text patterns like "but/however"
- Create meaningless entries

**Real conflict example:**
- `API.md` says "Agents use HTTP API"
- `SDK.md` says "Agents embed SDK"
- → Dreamer flags: D-01 API vs SDK conflict

---

## 📋 Dissonances — What They Are

A **dissonance** is when the mind contradicts itself.

**Format:**
```
| ID   | Tension                 | Source          | Status     |
|------|-------------------------|-----------------|------------|
| D-01 | API vs SDK for agents  | API-First, SDK  | Unresolved |
```

**Categories:**
- **Unresolved** — Active conflict needing decision
- **In Progress** — Being researched
- **Resolved** — Decision made (move to history)

---

## 📂 Mind Structure

```
mind/
├── INDEX.md              ← Entry point (YOU ARE HERE)
│
├── SYMBIOSIS/
│   ├── standup.md        ← Today's priorities
│   └── feedback.md       ← Learnings, rules
│
├── MAP.md               ← Complete file index
│
├── DISSONANCE.md        ← Conflicting ideas
│
├── EVOLUTION.md         ← Major mind changes (not run logs!)
│
├── memory/sessions/     ← Session logs
│
└── RESEARCH/findings/   → Research results
```

---

## 📖 Daily Reading Order

**Every session:**

1. `INDEX.md` ← You're here
2. `symbiosis/standup.md` ← Today's priorities
3. `symbiosis/feedback.md` ← What you learned

**After work:**

4. Update `symbiosis/feedback.md` with new learnings
5. Create session log in `memory/sessions/YYYY-MM-DD.md` if significant

---

## 🔧 Core Functions (For Bizing)

| Function | Purpose |
|----------|---------|
| `getMindFile(path)` | READ actual file content |
| `searchCatalog(query)` | Find files by keyword |
| `semanticSearch(query)` | Find by meaning |

**RULE:** READ files, don't summarize. Answer from actual content.

---

## ⚡ Quick Reference

| Term | Meaning |
|------|---------|
| **INDEX.md** | Entry point. Read first. |
| **standup.md** | Today's priorities |
| **feedback.md** | Recent learnings |
| **MAP.md** | Complete file index |
| **DISSONANCE.md** | Conflicts in the mind |
| **EVOLUTION.md** | Major changes (not run logs!) |
| **MindSync** | Keep knowledge updated |
| **TeamSync** | Everyone communicates |
| **CodeSync** | Test before commit |

---

## 🚨 Critical Rules

1. **READ INDEX first** — Every interaction
2. **Update feedback** — Log every learning
3. **Find REAL conflicts** — Don't create noise
4. **Log meaningful evolution** — Not "Dreamer Run"
5. **CodeSync before commit** — Test first

---

*Read this file first. Every time.*

**Last Updated:** 2026-02-12
