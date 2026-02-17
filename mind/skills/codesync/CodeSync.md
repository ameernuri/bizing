---
date: 2026-02-14
tags:
  - skill
  - codesync
  - workflow
  - git
  - commit
---

# 💻 CodeSync Skill

> Quality gate before committing code

---

## ⚠️ CRITICAL RULES

### 1. NEVER COMMIT TO MAIN

**ALWAYS work on a feature branch. ALWAYS create a PR. NO EXCEPTIONS.**

```
Your workflow:
1. Create branch: git checkout -b feat/description
2. Do the work
3. Run CodeSync checks
4. Commit to branch
5. Push branch
6. Create PR
7. Merge via PR (not direct commit)
```

**Never this:**
❌ `git commit` on main
❌ `git push origin main`
❌ Direct commits to main branch

**Always this:**
✅ `git checkout -b feat/description`
✅ `git commit` on feature branch
✅ `git push origin feat/description`
✅ Create PR via GitHub

---

### 2. NEVER AUTO-COMMIT EVERY CHANGE

**DO NOT commit and create a PR for every single small change.**

**Batch related work together:**
- Multiple related files → One commit
- Small fixes → Batch into larger commits  
- Documentation updates → Group logically
- Wait for user to say "codesync" or "commit"

**Never this:**
❌ Auto-commit after every file edit
❌ Create PR for each tiny change
❌ Commit without explicit user approval
❌ "I'll just commit this real quick"

**Always this:**
✅ Make multiple changes, then ask "Ready to commit?"
✅ Wait for explicit "codesync" or "commit approved"
✅ Batch related changes into single commits
✅ Get approval before each commit/PR

**Examples of what to BATCH:**
- Skill documentation updates (do 3-4, then commit once)
- Canvas file + related docs (one PR)
- Multiple bug fixes (group by theme)
- Config changes + documentation (together)

**When to ask for approval:**
- After completing a logical chunk of work
- When user explicitly says "codesync"
- Before creating any PR
- Never assume, always ask

---

## What Is CodeSync?

**CRITICAL: Tests MUST pass BEFORE committing.**

```
1. Run tests → 2. Verify pass → 3. Ask approval → 4. Commit
                ↑
                |
        MUST happen FIRST
```

**Never commit and then run tests. Always test FIRST, then commit.**

---

## What Is CodeSync?

**CodeSync** ensures code quality before any commit. All checks must pass. After all checks pass, we commit on a branch and do a PR

---

## The Process

```
Type Check → Unit Tests → E2E Tests → ASK APPROVAL → Create Branch → Commit → Push → Create PR
```

---

## Step-by-Step

### Step 0: Create Feature Branch (CRITICAL)

**NEVER work on main. Create a branch FIRST.**

```bash
# Check current branch
git branch --show-current

# If on main, create and switch to feature branch
git checkout -b feat/description

# Example:
git checkout -b feat/daydreamer-v2-enhancements
git checkout -b fix/mind-mapper-wiki-links
git checkout -b docs/update-synopsis-skill
```

**Branch naming:**
- `feat/description` — New features
- `fix/description` — Bug fixes
- `docs/description` — Documentation
- `refactor/description` — Code restructuring

---

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

### Step 4: Verify Results

**IMPORTANT:** You MUST see and verify the test results BEFORE asking for approval.

```
✅ API Tests: 13 passed
✅ Admin Tests: 36 passed
✅ Total: 49 tests passed
```

**Only proceed if ALL tests pass.**

---

### Step 5: Ask for Approval

Show user what will be committed:

```
Files to commit:
- apps/api/src/services/llm.ts (modified)
- mind/INDEX.md (modified)
- mind/memory/RAM.md (new)

Commit message: "feat: description"

Tests: ✅ All passed (13 API + 36 Admin = 49 tests)

Approve commit and do a PR? (yes/no)
```

**Wait for explicit approval:** "yes" or "approve commit and do a PR"

---

### Step 6: Commit (On Feature Branch, NEVER Main)

**VERIFY: You are on a feature branch, NOT main.**

```bash
# Check branch
git branch --show-current

# Should show: feat/description, NOT main
```

**If on main, STOP and create branch:**
```bash
git checkout -b feat/description
git add [files]
git commit -m "type: description"
```

**Types:**
- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation
- `refactor:` — Code restructuring
- `test:` — Tests only

**Example:**
```bash
git add scripts/daydreamer.mjs mind/skills/
git commit -m "feat: Add Daydreamer v2.0 with insights and dream journal"
```

---

### Step 7: Push Branch

```bash
git push -u origin feat/description
```

**NOT to main:**
❌ `git push origin main`  
✅ `git push origin feat/description`

---

### Step 8: Create PR

```bash
gh pr create --title "type: description" --body "summary"
```

**Or via GitHub web interface.**

**PR Requirements:**
- Clear title
- Description of changes
- Reference to tests passing
- Link to related issues (if any)

**Wait for:**
- Code review (if required)
- CI checks to pass
- Approval to merge

---

### Step 9: Merge via PR

**NEVER merge directly. Always use PR.**

```bash
# After PR is approved
gh pr merge
```

**Or merge via GitHub web interface.**

---

## Critical Rules

| Never | Always |
|-------|--------|
| ❌ Run tests AFTER commit | ✅ Run tests BEFORE commit |
| ❌ Commit without asking | ✅ Ask "Approve commit and do a PR?" |
| ❌ Commit to main | ✅ Commit to feature branch |
| ❌ Push to main | ✅ Push to feature branch |
| ❌ Merge directly | ✅ Create PR and merge via PR |
| ❌ Commit with failing tests | ✅ All tests pass first |
| ❌ Assume tests passed | ✅ See and verify test results |
| ❌ Mix unrelated changes | ✅ One feature per commit |

---

## The CodeSync Checklist

Before asking for approval:

- [ ] Type check passed
- [ ] Unit tests passed (see results)
- [ ] E2E tests passed (see results)
- [ ] All test files shown to user
- [ ] On feature branch (NOT main)
- [ ] Explicit approval received
- [ ] Commit message formatted correctly

---

## If Tests Fail

**STOP. Do not commit.**

1. Fix the issues
2. Run CodeSync again
3. Only commit when all pass

---

## Why Test Before Commit?

1. **Catch issues early** — Find bugs before they reach the branch
2. **Prevent broken builds** — Don't break CI/CD
3. **Maintain quality** — Every commit should be shippable
4. **Build trust** — Tests passing = ready for review

---

## Why Never Commit to Main?

1. **Code review** — PRs require review before merging
2. **CI/CD protection** — Automated checks run on PRs
3. **Rollback safety** — Can revert PR if issues found
4. **Collaboration** — Team can see and discuss changes
5. **History clarity** — Feature branches show related commits

---

## Triggers

User says any of:
- **"codesync"**
- **"commit approved"**
- **"commit"** (ask for approval first)

→ Run all checks → Verify results → Ask for approval → Create branch → Commit → Push → Create PR

---

## Related

- [[mind/INDEX]] — Entry point (mentions CodeSync)
- [[mind/skills/mindsync/MindSync|MindSync Skill]] — Update mind after code changes
- [[mind/skills/ram/Ram|Ram Skill]] — Working memory
- [[mind/skills/creating-files|Creating Files Skill]] — File creation guidelines

---

*CodeSync: Test → Verify → Ask → Branch → Commit → Push → PR → Merge*
