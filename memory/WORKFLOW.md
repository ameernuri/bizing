# Workflow

> How work happens. Updated 2026-02-08.

## When in Doubt, Ask

If there are multiple unrelated uncommitted changes:
- Ask how to handle them
- If changes are in the same category, commit together
- If changes are unrelated, ask for guidance

## Feedback Loop

```
Make Change → Type Check → Test → Update Memory → Commit → Push
     ↑                                              |
     └──────────────────────────────────────────────┘
```

1. Make targeted changes
2. Run type check (`pnpm tsc --noEmit` in package dir)
3. Verify behavior (dev server, browser, curl)
4. Update memory (decisions, rules, processes)
5. Commit with clear message
6. Push and create PR
7. Wait for review before merge

## Packages

| Package | Location | Command |
|---------|----------|---------|
| API | `apps/api/` | `cd apps/api && pnpm tsc --noEmit` |
| Admin | `apps/admin/` | `cd apps/admin && pnpm tsc --noEmit` |
| DB | `packages/db/` | `cd packages/db && pnpm tsc --noEmit` |

Run type check per package. API and Admin must be clean before commit.

## Git Process

1. **Branch**: `feature/[name]` from main
2. **Change**: Surgical edits only (see [Rules](./RULES.md))
3. **Check**: `cd apps/[name] && pnpm tsc --noEmit`
4. **Commit**: Clear message with context
5. **Push**: Create PR
6. **Review**: Owner merges after approval
7. **No self-merge** without approval

## Updating Memory

Update memory when:
- New decisions are made
- Rules or processes change
- Technical context is established
- Problems are solved

Memory files:
- [Rules](./RULES.md) - Coding standards
- [Workflow](./WORKFLOW.md) - Workflow process
- Domain-specific docs (vision, features, schema)

## Development Servers

```bash
# API (port 6129 - browser-safe)
cd apps/api && node src/server.ts

# Admin (port 9000)
cd apps/admin && pnpm dev
```

## Testing Changes

- **API changes**: `curl http://localhost:6129/[endpoint]`
- **Admin changes**: http://localhost:9000
- **Schema visualizer**: http://localhost:9000/schema
- **API docs**: http://localhost:6129/reference

## Coding Standards

See [Rules](./RULES.md) for:
- Shadcn component usage
- Minimal styling approach
- Dark/light mode implementation
- Type safety requirements
- Import patterns

## Creating a Pull Request

After pushing your branch:

```bash
# Create PR using gh CLI
gh pr create --title "[type]: description" \
  --body "## Summary
Brief description of changes

## Changes
- List of changes made

## Testing
- How changes were tested

## Checklist
- [ ] Type check passes
- [ ] Tests pass
- [ ] Memory updated"

# View PR status
gh pr list
gh pr view [number]
```

## Emergency

Something breaks:

```bash
git log --oneline -5
git revert [commit-hash]
git push origin [branch]
```

## Memory Management

See [_INIT.md](./_INIT.md) for:
- Memory file inventory
- How to update memory
- Linking conventions

---

## Critical Rules (2026-02-08)

**Working safely on a big project:**

1. **Work on a branch** - never touch main directly
2. **Never commit without asking** - always ask for confirmation first
3. **Never push to main** - only push when explicitly approved
4. **Never build features I wasn't asked to build**
5. **Ask for clarification** - when there's ambiguity, don't guess
6. **Make small, surgical changes** - not批量 updates

If I violate any of these, I'm failing.

See [Rules](./RULES.md) for coding standards.

## Distillation

See [DISTILLATION.md](./DISTILLATION.md) for distilled lessons learned with links to detailed entries.

## Project Context

- [Vision](./VISION.md) - Product direction
- [Features](./FEATURE_SPACE.md) - Feature backlog
- [Schema](./SCHEMA_DESIGN.md) - Database design
- [Coding Standards](./RULES.md) - How to write code
- [Getting Started](./START.md) - Onboarding guide
- [Development](./DEVELOPMENT.md) - Dev setup
- [Architecture](./MONOREPO_SETUP.md) - Project structure
