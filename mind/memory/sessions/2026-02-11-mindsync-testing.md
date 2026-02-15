---
date: 2026-02-11
tags: 
  - session
  - log
  - mindsync
---

# 📝 Session: Testing Requirements & MINDSYNC Definition

> *MINDSYNC: Extensive mind updating across ALL relevant files*

## Participants

- **Ameer** — Human
- **Pac** — AI Assistant

## Context

User defined critical testing requirements and the MINDSYNC command for extensive mind updating workflow.

## What We Did

### 1. Defined Testing Requirements

**Golden Rule:** NO COMMIT OR PUSH if tests fail.

**Required Checks:**
- Type checking — `tsc --noEmit` — Zero errors
- Unit tests — Vitest — All tests pass
- E2E tests — Playwright — All tests pass

**Why:**
- Type errors → Runtime crashes
- Test failures → Broken features
- Committing failures → Broken main branch

### 2. Defined MINDSYNC / BRAINSYNC

**Command:** When user says "mindsync" or "brainsync"

**Standard (Every Instruction):**
- Update [[symbiosis/feedback]]
- Update relevant knowledge files

**Explicit MINDSYNC (Comprehensive):**
- [[symbiosis/feedback]] — Learnings
  - rules
- [[symbiosis/standup]] — Task status
- [[memory/sessions/]] — Session logs
- [[knowledge/]] — Architecture
  - domain
- [[skills/]] — Workflow patterns
- [[MAP]] — Structure updates
- [[backlog]] — Kanban board
- [[mind/memory/sessions/index]] — Entry point
- Any other relevant files

### 3. Updated ALL Mind Files (MINDSYNC)

**Files Modified:**

#### symbiosis/feedback.md
- Added testing requirements learning
- Added MINDSYNC definition
- Updated comprehensive workflow section
- Added testing to Rules to Remember (#5)

#### MIND-FRAMEWORK.md  
- Added testing to Phase 2 (EXECUTE)
- Updated enforcement rules table
- Added type check and tests as MANDATORY
- Added MINDSYNC / BRAINSYNC section
- Updated quick checklist with testing

#### skills/workflow/documentation-standards.md
- Added Testing Requirements section
- Added pre-commit checklist with tests
- Added Test-Driven Workflow (Red-Green-Refactor)
- Added MINDSYNC section with definition
- Added MINDSYNC checklist

#### .templates/session-log.md
- Added Testing checklist section
- Type check
  - Vitest
  - Playwright checkboxes

#### symbiosis/backlog.md
- Added testing infrastructure task
- Vitest
  - Playwright
  - pre-commit hooks

## Decisions Made

1. **Testing is mandatory** — No commits with failing tests
  - ever
2. **Type checking is mandatory** — Zero type errors required
3. **MINDSYNC = Extensive mind updating** — Across ALL relevant files
4. **Default mindsync** — Every instruction gets basic update
5. **Explicit mindsync** — Comprehensive update when requested

## Learnings

- MINDSYNC ensures comprehensive context preservation
- Testing requirements prevent broken code in main
- Multiple mind locations keep knowledge organized
- Checklists ensure nothing is forgotten

## Files Changed

### Code Files
- N/A (mind-only update)

### Mind Files
- [x] [[symbiosis/feedback]] — Testing + MINDSYNC documented
- [x] [[symbiosis/standup]] — N/A (no status change)
- [x] [[MIND-FRAMEWORK]] — Testing + MINDSYNC sections added
- [x] [[skills/workflow/documentation-standards]] — Testing + MINDSYNC docs
- [x] [[.templates/session-log]] — Testing checklist added
- [x] [[symbiosis/backlog]] — Testing infrastructure task
- [x] Session log created (this file)

### Documentation Work
- [x] Testing requirements documented
- [x] MINDSYNC defined and documented
- [x] Pre-commit checklist updated
- [x] Cross-references added

### Git Workflow
- [x] Feature branch: N/A (mind-only update)
- [x] Mind files committed together

### Testing
- [x] Type check — N/A (markdown only)
- [x] Unit tests — N/A
- [x] E2E tests — N/A

## Next Steps

- [ ] Set up Vitest configuration
- [ ] Set up Playwright configuration  
- [ ] Add type check to pre-commit hook
- [ ] Add test run to pre-commit hook
- [ ] Document testing patterns in knowledge/

## 💡 Key Insight

**MINDSYNC transforms sporadic updates into systematic knowledge preservation. Testing requirements transform "hope it works" into "know it works".**

---

*MINDSYNC complete. All mind files updated with testing requirements and MINDSYNC definition.*