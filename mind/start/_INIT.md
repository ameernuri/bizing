# 🧠 How to Use This Brain

> The single source of truth for bizing. Updated 2026-02-11.

## Quick Start

**New to the project?** Read in this order:
1. [[README]] - Overview and navigation
2. [[STATUS]] - Current state
3. [[GOALS]] - What we're working toward
4. [[HUMAN]] - Get running locally

## Brain Structure

```
brain/
├── README.md           ← Entry point
├── STATUS.md           ← Current state, blockers, priorities
├── GOALS.md            ← Active objectives
├── 00-START/           ← Onboarding
├── 01-design/          ← Vision, schema, architecture
├── 02-planning/        ← Research, market analysis
├── 03-operations/      ← Workflow, rules, standards
├── 04-archive/         ← Old/reference material
└── daily/              ← Daily notes (YYYY-MM-DD.md)
```

## For Ameer (Human)

**Editing from Obsidian:**
- Open `~/projects/bizing/` as vault root
- Edit any `.md` file
- Use wiki links: `[[STATUS]]` or `[[01-design/VISION]]`
- Daily notes go in `daily/YYYY-MM-DD.md`

**Collaborating with Pac:**
- Edit memory files anytime
- I'll read them when I need context
- I'll update files after we discuss changes

## For Pac (AI)

**When I wake up fresh:**
1. Read [[README]]
2. Read [[STATUS]] 
3. Read [[GOALS]]
4. Check `daily/` for recent context
5. Then read specific files for the task

**When updating memory:**
- Update [[STATUS]] when state changes
- Update [[GOALS]] when objectives change
- Add daily notes for significant events
- Keep links working (Obsidian wiki-style)

## Memory Update Rules

**Update these when:**
| File | When to update |
|------|----------------|
| [[STATUS]] | Blockers, progress, issues |
| [[GOALS]] | New priorities, completed work |
| `daily/` | Daily work, decisions, errors |
| [[03-operations/WORKFLOW]] | Process changes |
| [[03-operations/RULES]] | Coding standard changes |
| [[01-design/SCHEMA_DESIGN]] | Database changes |

## Linking Style

Use Obsidian wiki links:
- `[[STATUS]]` - file in same folder
- `[[01-design/VISION]]` - file in subfolder
- `[[README#Quick Start]]` - link to header

## Collaboration Flow

```
Ameer edits in Obsidian
         ↓
   Pac reads context
         ↓
   We discuss/work
         ↓
   Pac updates memory
         ↓
   Ameer sees in Obsidian
```

## Key Principles

1. **Brain > Brain** - If it's important, write it down
2. **Links everywhere** - Connect related thoughts
3. **Daily notes** - Raw log of what happened
4. **STATUS is truth** - Current state lives there
5. **GOALS guide work** - Know what we're building

---

## Related

- [[STATUS]] - What's happening now
- [[GOALS]] - What we're building
- [[03-operations/WORKFLOW]] - How we work
- [[03-operations/RULES]] - Coding standards

---
*Last updated: 2026-02-11*
