---
date: 2026-02-15
tags: 
  - skill
  - dissonance
  - contradiction
  - conflict
  - tension
  - quality
---

# 🔥 Dissonance Skill

> *Find and record real contradictions in the mind.*

---

## What Is Dissonance?

**Dissonance** (cognitive dissonance) is when two files or ideas **contradict** each other.

**Real Dissonance IS:**
- ✅ One file says "always do X" and another says "never do X"
- ✅ Different definitions of the same concept
- ✅ Conflicting first steps in workflows
- ✅ Opposing priority levels for the same thing

**Dissonance is NOT:**
- ❌ Different opinions (valid alternative approaches)
- ❌ One file mentions X, another doesn't (that's a gap, not conflict)
- ❌ Word-level opposites without context ("is" vs "is not")
- ❌ Questions or curiosities

---

## Where to Record

**Folder:** `mind/dissonance/`

**Format:** Individual markdown files

**Naming:** `YYYY-MM-DD-[descriptive-title].md`

---

## Quality Standards

### ✅ Real Dissonance Checklist

| Criterion | Description |
|-----------|-------------|
| **Substantive** | Both sides have real content (not just words) |
| **Same Subject** | Talking about the same thing/concept |
| **Mutually Exclusive** | Can't both be true simultaneously |
| **Contextual** | Includes actual quotes or specific references |
| **Resolvable** | Can be resolved by decision or clarification |

### ❌ Bad Examples (Don't Create)

```
❌ "File A says 'is' and File B says 'is not'"  
   (Word-level only, no context)

❌ "File A mentions REST, File B mentions GraphQL"
   (Different approaches, not necessarily contradictory)

❌ "File A likes blue, File B likes red"
   (Preferences, not contradictions)
```

### ✅ Good Examples (Do Create)

```
✅ "File A says 'always commit to main' but File B workflow 
     shows commits happening on feature branches"

✅ "File A defines Bizing as 'software platform' while 
     File B defines it as 'living entity'"

✅ "File A requires pre-commit checks for 'major changes only' 
     while File B requires them for 'all commits'"
```

---

## Types of Real Dissonance

### Type 1: Rule Conflicts

One file mandates something, another prohibits it.

```markdown
**[[workflow.md]] says:**
> "Always deploy on Fridays"

**[[incident-response.md]] says:**
> "Never deploy on Fridays (change freeze)"

**Conflict:** Both can't be true. Need to decide which rule applies when.
```

### Type 2: Definition Conflicts

Same term defined differently.

```markdown
**[[identity.md]] says:**
> "Bizing is a software platform"

**[[essence.md]] says:**> "Bizing is a living entity, not software"

**Conflict:** Mutually exclusive definitions. Need to clarify or harmonize.
```

### Type 3: Workflow Conflicts

Different starting points or sequences.

```markdown
**[[setup-guide.md]] says:**
> "First, install the CLI, then configure the API"

**[[quickstart.md]] says:**
> "First, configure the API, then install the CLI"

**Conflict:** Order matters. One must be correct (or both wrong).
```

### Type 4: Priority Conflicts

Same subject, opposite importance levels.

```markdown
**[[architecture.md]] says:**
> "Security is critical — must be reviewed for every change"

**[[rapid-prototyping.md]] says:**
> "Security can be deferred during prototyping"

**Conflict:** When does security review apply? Need clear boundaries.
```

---

## How to Add Dissonance

### Manual Creation

Create file: `mind/dissonance/2026-02-15-deploy-friday-conflict.md`

```markdown
# Deploy on Friday vs Friday Change Freeze

**Status:** Active  
**Created:** 2026-02-15  
**Severity:** High (affects deployments)

## Files in Conflict

**[[workflow.md]]** and **[[incident-response.md]]**

## The Contradiction

**[[workflow.md]] says:**
> "Always deploy on Fridays to finish the week"

**[[incident-response.md]] says:**
> "Never deploy on Fridays — maintain change freeze over weekends"

## Why This Matters

- Deployment practices are inconsistent
- New team members get conflicting guidance
- Could lead to incidents or missed deadlines

## Resolution Options

1. **Option A:** Always allow Friday deploys (update incident-response)
2. **Option B:** Never allow Friday deploys (update workflow)  
3. **Option C:** Context-dependent (define when each applies)

## Proposed Resolution

**Option C:** Context-dependent
- Normal feature deploys: No Fridays
- Hotfixes/security patches: Friday deploys allowed with approval
- Update both files with clear criteria

## Tags

#dissonance #workflow #deployment #process
```

### Components

| Component | Required | Description |
|-----------|----------|-------------|
| **Title** | Yes | Clear description of the conflict |
| **Files** | Yes | Which files contradict |
| **Quotes** | Yes | Actual text showing the conflict |
| **Why Matters** | Yes | Impact of the contradiction |
| **Resolution Options** | Recommended | Ways to resolve |
| **Proposed Resolution** | Optional | Suggested fix |

---

## Automated Detection (Dreamer)

The **Daydreamer** daemon finds dissonances using contextual analysis:

### Pattern 1: Rule Conflicts

Looks for:
- "Always/Must/Required" vs "Never/Must not/Forbidden"
- Both in authoritative contexts (paragraphs > 50 chars)
- Same subject matter

```javascript
// Matches:
File A: "Always use HTTPS for API calls" (policy statement)
File B: "HTTP is acceptable for internal APIs" (policy statement)

// Doesn't match:
File A: "This is always true" (passive voice, no rule)
File B: "That is never the case" (passive voice, no rule)
```

### Pattern 2: Definition Conflicts

Looks for:
- "X is [definition]" vs "X is [different definition]"
- Same subject (X)
- One is negative ("is not") while other is positive ("is")

```javascript
// Matches:
File A: "Bizing is a software platform"
File B: "Bizing is not software, it is a living entity"

// Doesn't match:
File A: "Software is useful"
File B: "Bizing is an entity"
(Different subjects)
```

### Pattern 3: Workflow Conflicts

Looks for:
- "First do X" vs "First do Y"
- Both describe the same workflow/process
- X and Y are genuinely different

```javascript
// Matches:
File A: "First, run tests, then deploy"
File B: "First, deploy, then run tests"
(Same process, opposite order)

// Doesn't match:
File A: "First, authenticate"
File B: "First, authorize"
(Different concerns, both might be needed)
```

### Pattern 4: Priority Conflicts

Looks for:
- "X is critical/essential" vs "X is optional/unimportant"
- Talking about same X
- Both in substantive paragraphs

```javascript
// Matches:
File A: "Testing is critical for every commit"
File B: "Testing can be skipped for prototypes"
(Same subject: testing, opposite priorities)

// Doesn't match:
File A: "Unit tests are critical"
File B: "E2E tests are optional"
(Different types of tests)
```

---

## Resolving Dissonance

### Process

1. **Acknowledge** — Confirm it's a real contradiction
2. **Analyze** — Understand why both views exist
3. **Decide** — Choose resolution approach
4. **Update** — Fix source files
5. **Document** — Mark dissonance as resolved

### Resolution Approaches

| Approach | When to Use | Example |
|----------|-------------|---------|
| **Clarify** | Misunderstanding, not real conflict | Update wording to show agreement |
| **Choose** | One is correct, other is wrong | Pick correct approach, update wrong file |
| **Merge** | Both have valid aspects | Combine into unified approach |
| **Context** | Both valid in different contexts | Define when each applies |
| **Defer** | Not urgent, needs more thought | Mark as "under review" |

### Marking as Resolved

```markdown
## Resolution

**RESOLVED** — Context-dependent approach chosen

**Decision:** 
- Normal deploys: No Fridays (follow incident-response)
- Hotfixes: Friday deploys allowed (exception to rule)

**Files Updated:**
- [[workflow.md]] — Added "except hotfixes with approval"
- [[incident-response.md]] — Added "hotfix exception noted"

**Date Resolved:** 2026-02-15
```

---

## Dissonance vs Other Concepts

| | Dissonance | Curiosity | Evolution | Task |
|---|-----------|-----------|-----------|------|
| **What** | Conflict | Question | Change | Action |
| **Type** | "X vs Y" | "How does X work?" | "We changed X" | "Do X" |
| **Where** | `dissonance/` | `curiosities/` | `evolution/` | Feature space |
| **Action** | Resolve | Research | Document | Execute |

---

## Common False Positives

Don't create dissonance for:

1. **Different Approaches** — REST vs GraphQL (valid alternatives)
2. **Evolution Over Time** — Old file says X, new file says Y (that's evolution)
3. **Different Contexts** — Production vs Development (contextual, not conflicting)
4. **Word-level Opposites** — "is" vs "is not" (need semantic conflict)
5. **Questions** — "Should we do X?" vs "We do X" (curiosity vs statement)

---

## Related Skills

- [[mind/skills/curiosity|Curiosity]] — For questions, not conflicts
- [[mind/skills/evolution|Evolution]] — For major changes over time
- [[mind/skills/dreaming|Dreaming]] — Daydreamer finds dissonances
- [[mind/skills/decision|Decision]] — For resolving dissonances

---

*Real dissonance reveals where decisions are needed.*
