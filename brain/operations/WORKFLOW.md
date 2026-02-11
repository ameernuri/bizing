# Workflow

> How work happens. Updated 2026-02-11.

## Feedback Loop

```
Make Change → Type Check → Test → Update Memory → Commit → Push
     ↑                                              |
     └──────────────────────────────────────────────┘
```

1. Make targeted changes
2. Run type check (`pnpm tsc --noEmit`)
3. Verify behavior (dev server, browser, curl)
4. **Update brain** ([[STATUS]], [[GOALS]], `daily/`)
5. Commit with clear message
6. Push and create PR
7. Wait for review before merge

## Critical Rules

1. **Work on a branch** - never touch main directly
2. **Never commit without asking** - always get confirmation first
3. **Never push to main** - only push when explicitly approved
4. **Never build features I wasn't asked to build**
5. **Ask for clarification** - when there's ambiguity, don't guess
6. **Make small, surgical changes** - not bulk updates

## Type Check Commands

| Package | Command |
|---------|---------|
| API | `cd apps/api && pnpm tsc --noEmit` |
| Admin | `cd apps/admin && pnpm tsc --noEmit` |
| DB | `cd packages/db && pnpm tsc --noEmit` |

**Must be clean before commit.**

## Git Process

1. **Branch**: `feature/[name]` from main
2. **Change**: Surgical edits only (see [[RULES]])
3. **Check**: Type check passes
4. **Update**: [[STATUS]], [[GOALS]], or `daily/`
5. **Commit**: Clear message
6. **Push**: Create PR
7. **Review**: Wait for approval
8. **Merge**: Owner merges only

## Updating the Brain

**Update [[STATUS]] when:**
- Blockers arise
- Progress made on active work
- Issues discovered

**Update [[GOALS]] when:**
- Objectives change
- Goals completed
- New priorities set

**Add to `daily/` when:**
- Significant work done
- Decisions made
- Problems encountered
- Errors/failures

## Development Servers

```bash
# API (port 6129)
cd apps/api && npx tsx src/server.ts

# Admin (port 9000)
cd apps/admin && pnpm dev
```

## Testing Changes

- **API**: `curl http://localhost:6129/health`
- **Admin**: http://localhost:9000
- **API Docs**: http://localhost:6129/reference

## When in Doubt, Ask

Multiple uncommitted changes? Ask how to handle them.
- Same category → commit together
- Different categories → ask for guidance

## Emergency Revert

Something breaks:

```bash
git log --oneline -5
git revert [commit-hash]
git push origin [branch]
```

---

## Related

- [[STATUS]] - Current project state
- [[GOALS]] - Active objectives
- [[RULES]] - Coding standards
- [[00-START/START]] - Setup guide
- [[00-START/_INIT]] - Brain usage guide

---
*Last updated: 2026-02-11*
