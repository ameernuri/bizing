---
date: 2026-02-13
tags: 
  - skill
  - codesync
  - workflow
  - git
  - commit
---

# 💻 CodeSync Skill

> Quality gate before committing code

## What Is CodeSync?

**CodeSync** ensures code quality before any commit. All checks must pass.

---

## The Main Rule

**ALWAYS ask before committing.** Never commit without explicit approval.

---

## The Process

```
Type Check → Unit Tests → E2E Tests
IF ALL PASS → Commit → Push → Create PR
IF ANY FAIL → DO NOT COMMIT → Fix issues → Retry
```

---

## Step-by-Step

### Step 1: Type Check

```bash
cd ~/projects/bizing
pnpm tsc --noEmit
```

**Must show:** No errors (empty output = success)

---

### Step 2: Unit Tests

```bash
cd ~/projects/bizing/apps/api
pnpm vitest run --exclude 'tests/e2e/**'
```

**Must show:** All tests passing

Example:
```
Test Files  2 passed (2)
Tests       13 passed (13)
```

---

### Step 3: E2E Tests

```bash
cd ~/projects/bizing/apps/api
pnpm playwright test
```

**Must show:** All tests passing

Example:
```
40 passed (15s)
```

---

### Step 4: Ask for Approval

Show user what will be committed:

```
Files to commit:
- apps/api/src/services/llm.ts (modified)
- mind/INDEX.md (modified)
- mind/memory/RAM.md (new)

Commit message: "feat: description"

Approve commit and do a PR? (yes/no)
```

**Wait for explicit:** "yes"
  - "commit approved"
  - "approve commit and do a PR"
  - or "codesync"

---

### Step 5: Commit

```bash
git add [files]
git commit -m "type: description"
```

**Types:**
- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation
- `refactor:` — Code restructuring
- `test:` — Tests only

---

### Step 6: Push

```bash
git push -u origin feature/description
```

---

### Step 7: Create PR

```bash
gh pr create --title "type: description" --body "summary"
```

---

## Critical Rules

| Never | Always |
|-------|--------|
| ❌ Commit without asking | ✅ Ask "Approve commit and do a PR?" |
| ❌ Commit to main | ✅ Feature branch only |
| ❌ Commit with failing tests | ✅ All tests pass first |
| ❌ Mix unrelated changes | ✅ One feature per commit |

---

## If Tests Fail

**STOP. Do not commit.**

1. Fix the issues
2. Run CodeSync again
3. Only commit when all pass

---

## Triggers

User says any of:
- **"codesync"**
- **"commit approved"**
- **"commit"** (ask for approval first)

→ Run all checks → Ask for approval → Commit if approved

---

## Related

- [[mind/INDEX]] — Entry point (mentions CodeSync)
- [[mind/skills/mindsync|MindSync Skill]] — Update mind after code changes
- [[mind/skills/ram/Ram|RAM Skill]] — Working memory

---

*CodeSync: Check → Test → Ask → Commit → Push → PR*
