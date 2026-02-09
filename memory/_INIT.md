# Project Memory

> How to manage and update project memory. Updated 2026-02-08.

## Files

| File | Purpose |
|------|---------|
| `WORKFLOW.md` | How work happens |
| `RULES.md` | Coding standards |
| `VISION.md` | Product direction |
| `FEATURE_SPACE.md` | Feature backlog |
| `SCHEMA_DESIGN.md` | Database design |
| `DEVELOPMENT.md` | Dev setup guide |
| `START.md` | Getting started |
| `MONOREPO_SETUP.md` | Architecture |

## Memory Management

**When to update memory:**
- Workflow changes → Update [WORKFLOW.md](./WORKFLOW.md)
- Coding standards change → Update [RULES.md](./RULES.md)
- New decisions → Add to relevant doc
- Process changes → Update relevant file
- JSDoc standards → Update [RULES.md](./RULES.md)

**To update memory:**
1. Read [_INIT.md](./_INIT.md) for context
2. Read relevant file(s)
3. Make edits
4. Update links if files move/rename
5. Verify changes make sense

## Memory Lifecycle

Memory is updated as part of the development workflow:

```
Make Change → Type Check → Test → Update Memory → Commit → Push
```

Memory updates include:
- New rules or process changes
- Technical decisions and context
- Problem solutions
- Coding standards updates

## JSDoc Standards

All code requires descriptive JSDoc comments. See [RULES.md](./RULES.md) for:
- Required documentation patterns
- Function documentation examples
- Why JSDoc matters

Memory files themselves should be well-documented with headers and structure.

## Commands

```bash
# Read workflow
cat memory/WORKFLOW.md

# Edit rules
vim memory/RULES.md

# Add new doc
vim memory/[TOPIC].md
```

## Linking

Use relative paths:
- Same dir: `./FILENAME.md`
- Parent dir: `../`

## Reading Before Work

Before starting work:
1. Read [WORKFLOW.md](./WORKFLOW.md)
2. Read [RULES.md](./RULES.md)
3. Check related docs for context

## Related

- [OpenClaw Memory](../.openclaw/workspace/memory/) - Agent context
- Git history - Previous decisions
