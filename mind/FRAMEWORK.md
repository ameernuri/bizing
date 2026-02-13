# ⚡ Mind Framework Enforcement

*MANDATORY workflow for every interaction. NO EXCEPTIONS.*

---

## ⚠️ CRITICAL: Read This First

**You are REQUIRED to follow this workflow for EVERY interaction.**

---

## Phase 1: READ (Before Anything)

### Step 1: Read INDEX.md (MANDATORY)
- **File:** [[INDEX]]
- **Time:** 30 seconds
- **Why:** Entry point to all context
- **SKIP = NO CONTEXT**

### Step 2: Read Standup
- **File:** [[symbiosis/standup]]
- **Time:** 20 seconds
- **Why:** Today's priorities and tasks

### Step 3: Read Feedback  
- **File:** [[symbiosis/feedback]]
- **Time:** 20 seconds
- **Why:** Recent learnings and rules

### Step 4: Read Relevant Context
- Skills needed: [[skills/workflow]]
- Domain knowledge: [[knowledge/domain]]
- Recent work: [[memory/sessions]]

### Step 5: Talk to Bizing AI (MANDATORY)
- **Query:** `node scripts/query-bizing.mjs "What's our status?"`
- **Why:** Stay synchronized, test Bizing's knowledge, discover gaps
- **When:** Every interaction, whenever possible
- **Two-way:** Bizing reads mind, you update mind, loop continues

**Examples:**
```bash
# Check status
node scripts/query-bizing.mjs "What are we working on?"

# Test knowledge
node scripts/query-bizing.mjs "What did we learn about MoR?"

# Discover gaps
node scripts/query-bizing.mjs "What are the must-have features?"
```

---

## Phase 2: EXECUTE (Do The Work)

- Reference mind files for context
- Follow documented patterns
- Apply previous learnings
- **Check type errors after every change**
- **Run tests: Vitest + Playwright**
- **SOFT MINDSYNC** — Light update after work (feedback, standup if changed)
- **NO COMMIT if tests fail**

---

## Phase 3: UPDATE (After EVERY Interaction)

### Step 5: Update Feedback (MANDATORY)
- **File:** [[symbiosis/feedback]]
- **Add:** New learnings, rules, preferences
- **WHY:** This is how you remember

### Step 6: Update Evolution (MANDATORY for ANY change)
- **File:** `evolution/YYYY-MM-DD.md`
- **When:** ANY significant change to mind or code
- **What to log:**
  - New files added
  - Major decisions made
  - Concepts clarified
  - Tensions resolved
  - Research completed
- **Format:** `## YYYY-MM-DD - [Change Type]` + bullet points
- **WHY:** Tracks the mind's growth and evolution

### Step 7: Update README.md (For project-level changes)
- **File:** [[README]]
- **When:** Major features added, architecture changes, status changes
- **What to update:**
  - Current status
  - Key features
  - Architecture overview
  - Quick links
- **WHY:** Project-level clarity for humans and agents

### Step 8: Update Documentation (MANDATORY for code changes)
- **File:** Code files (JSDoc comments)
- **Also update:** [[skills/workflow/documentation-standards]]
- **When:** ANY code change
- **Requirements:**
  - [ ] File header with @fileoverview
  - [ ] Architecture section with related files
  - [ ] Function JSDoc for all exports
  - [ ] TODOs for future work
  - [ ] Update @last-modified timestamp

### Step 9: Update Standup (if changed)
- **File:** [[symbiosis/standup]]
- **When:** Tasks done/priorities changed

### Step 10: Create Session Log (if significant)
- **File:** `memory/sessions/YYYY-MM-DD-[desc].md`
- **When:** Major work, debugging, decisions
- **Template:** [[.templates/session-log]]
- **Include:** Documentation work done

### Step 11: Update INDEX (if structural)
- **File:** [[INDEX]]
- **When:** New sections, workflow changes

### Step 12: Update MAP (if structure changed)
- **File:** [[MAP]]
- **When:** New files added, structure reorganized

---

## 🌀 Dreamer — Autonomous Mind Evolver

**Runs every 30 minutes via cron**

### What Dreamer Does

1. **Scans** all mind files for tensions
2. **Appends** to [[DISSONANCE]]
3. **Creates** wikilinks between concepts
4. **Evolves** the mind continuously

### Dreamer Workflow

```bash
# Run dreamer manually
node scripts/dreamer.mjs

# Output:
# 🌀 Dreamer v2.0
# 📊 Found 12 tensions
# 🔥 Added D-001 to DISSONANCE.md
# 📈 Evolution: Dreamer Run
# ✨ Mind has evolved
```

### Dreamer + You = Complete Loop

| Who | Does What |
|-----|-----------|
| **You (Pac)** | Make changes, commit, update mind |
| **Dreamer** | Scan, find tensions, evolve, log |
| **Evolution** | Track all changes over time |
| **Result** | Self-organizing, breathing mind |

---

## ⚡ Enforcement Rules

| Rule | Status |
|------|--------|
| Read INDEX.md first | **MANDATORY** |
| Read standup | **MANDATORY** |
| Read feedback | **MANDATORY** |
| Type check before commit | **MANDATORY** |
| All tests pass before commit | **MANDATORY** |
| **NEVER commit to main** | **ABSOLUTE - NO EXCEPTIONS** |
| Update feedback after | **MANDATORY** |
| Document code changes | **MANDATORY** |
| Update standup if changed | Required |
| Create session log if significant | Required |
| Update evolution for ANY change | Required |
| Update README for project changes | Required |
| Dreamer runs every 30 min | Cron job |
| **New mind files = 3+ wikilinks** | **MANDATORY - NO ORPHANS** |

**Breaking these rules = working blind. Committing with failing tests = broken code.
Committing to main = VIOLATION.**
# Make changes + update mind files
# Test everything (type check, vitest, playwright)

# Commit to feature branch
git add .
git commit -m "feat: description"

# Push and create PR
git push -u origin feature/descriptive-name
# Create PR on GitHub
```

**If You Find Yourself on Main Branch:**
1. `git status` — Check where you are
2. `git checkout -b feature/new-branch` — Create feature branch
3. Cherry-pick or redo changes on new branch
4. **DO NOT commit while on main**

### Branch Naming

- `feature/description` — New features
- `fix/description` — Bug fixes
- `docs/description` — Documentation only
- `refactor/description` — Code restructuring

### Commit Rule

| Never Do | Always Do |
|----------|-----------|
| ❌ Commit to `main` (ABSOLUTE) | ✅ Create feature branch |
| ❌ Direct push to main | ✅ PR + review |
| ❌ Mix unrelated changes | ✅ One feature per branch |

**COMMITTING TO MAIN IS A VIOLATION. DON'T DO IT.**

---

## CODESYNC

**⚠️ CRITICAL: NEVER commit without explicit user approval**

### The Rule

| Trigger | Action |
|---------|--------|
| User says **"codesync"** | ✅ Proceed with commit |
| User says **"commit approved"** | ✅ Proceed with commit |
| User confirms with **"yes"** after you ask | ✅ Proceed with commit |
| You assume it's time | ❌ **STOP - ASK FIRST** |
| Tests pass | ❌ **STOP - ASK FIRST** |
| Work is done | ❌ **STOP - ASK FIRST** |

### Pre-Commit Checklist (ASK BEFORE EACH)

**BEFORE running `git commit`:**

1. **Show changes:**
   ```
   Files to commit:
   - file1.ts (modified)
   - file2.md (new)
   
   Commit message: "feat: description"
   ```

2. **Wait for explicit approval:**
   - ✅ "commit approved" 
   - ✅ "codesync"
   - ✅ "yes, commit it"

3. **If NO approval → DO NOT COMMIT**
   - Keep working
   - Ask again later
   - Never assume

### What NOT To Do

❌ **NEVER say:** *"I'll commit this now"*  
❌ **NEVER say:** *"Ready to commit"* (without asking)  
❌ **NEVER commit** after tests pass without asking  
❌ **NEVER assume** silence = approval  
❌ **NEVER commit** when user says "looks good" (ask for explicit "commit approved")

### What To Do

✅ **ALWAYS say:** *"Ready to commit. Changes: X files. Approve?"*  
✅ **ALWAYS wait** for explicit "commit approved" or "codesync"  
✅ **ALWAYS show** what will be committed  
✅ **ALWAYS confirm** the commit message

### CODESYNC Process (After Explicit Approval)

When user says **"codesync"** or **"commit approved"**:

```
Type Check → Run Tests → IF ALL PASS → Commit → Push → Create PR
```

**Steps:**
1. `tsc --noEmit` — Zero type errors
2. Vitest run — All unit tests pass
3. Playwright test — All E2E tests pass
4. **SHOW CHANGES TO USER:**
   ```
   Committing:
   - file1.ts
   - file2.md
   
   Message: "feat: description"
   ```
5. **WAIT for final "yes"**
6. **THEN:** Commit → Push → Create PR

**CODESYNC = Ask → Get Approval → Check → Test → Show → Final Yes → Commit → Push → PR**

### Violation Consequences

**Committing without approval:**
- Breaks trust
- May commit incomplete work
- Bypasses user review
- **IS A WORKFLOW VIOLATION**

**If you committed without approval:**
1. STOP immediately
2. Tell user: *"I committed without approval. I'm sorry."*
3. Let user decide: revert or keep
4. Update [[symbiosis/feedback]] with learning
5. Never do it again

---

## MINDSYNC Levels

### SOFT MINDSYNC (Every Change)
Light update after every work session:
- [[symbiosis/feedback]] — Learnings, rules
- [[symbiosis/standup]] — Status if changed
- Brief notes if significant

### HARD MINDSYNC (Big Events / Explicit)
Extensive update for:
- Major features completed
- Workflow changes
- Architecture updates
- Explicit "mindsync" command

**Includes:**
- [[symbiosis/feedback]] — Detailed learnings
- [[symbiosis/standup]] — Task status, blockers
- [[memory/sessions/YYYY-MM-DD]] — Full session log
- [[knowledge/]] files — Architecture patterns
- [[MAP]] — If structure changed
- [[backlog]] — Kanban updates
- **Mindful link creation** — Add `[[wikilinks]]` to connect related files
- Any other relevant files

---

## Testing Requirements (NEW)

Every code file MUST have:

```typescript
/**
 * @fileoverview What this file does
 * @description Why it exists
 * @architecture Related files: {@link ./file.ts}, mind/path/doc.md
 * @design-decisions Key choices
 * @todo Actionable items
 */
```

**Linking conventions:**
- Code files: `{@link ./relative-path.ts}` — VS Code clickable!
- Mind files: `mind/path/to/file.md` — For AI/context
- Wiki links `[[file]]` — Only in Markdown, NOT JSDoc

See {@link mind/skills/workflow/documentation-standards} for complete guide.

---

## Quick Checklist

Before every interaction:
- [ ] Read [[INDEX]]
- [ ] Read [[symbiosis/standup]]
- [ ] Read [[symbiosis/feedback]]
- [ ] Do the work
- [ ] **Type check** — `tsc --noEmit` or equivalent
- [ ] **Run tests** — Vitest + Playwright (ALL must pass)
- [ ] Update [[symbiosis/feedback]]
- [ ] **Document code changes** (JSDoc, TODOs, architecture)
- [ ] Update [[symbiosis/standup]] if needed
- [ ] Log to [[evolution/YYYY-MM-DD]]
- [ ] **New mind files = 3+ wikilinks** (NO ORPHANS)
