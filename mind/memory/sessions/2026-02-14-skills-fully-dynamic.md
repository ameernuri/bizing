---
date: 2026-02-14
tags: 
  - session
  - dreamer
  - curiosity
  - mapping
  - skills
type: skill-creation
---

# Session: Skills + Dreamer Fully Dynamic

## Summary
Made Dreamer fully dynamic (no hardcoded values)
  - created Curiosity and Mapping skills
  - updated INDEX.md.

## Work Done
- [x] Dreamer script — All hardcoded values removed
- [x] Curiosity skill — Questions and knowledge gaps
- [x] Mapping skill — Mind structure and MAP.md
- [x] INDEX updated — All new skills linked

## Changes Made

### Dreamer Script
**Before:** Hardcoded tension types (api/sdk
  - build/integrate
  - data/gdpr)
**After:** Fully dynamic detection

**Removed:**
- `if (tension.types.api && tension.types.sdk)` checks
- Predefined context strings
- Hardcoded question templates

**Now:**
- Context extracted from actual file content
- Types detected dynamically from file content
- Questions generated based on word and file count

### Curiosity Skill
**File:** `mind/skills/Curiosity//.md`

**Purpose:** Record questions
  - gaps
  - things to explore

**Contents:**
- When to add curiosities
- How to format
- Examples
- Curiosities vs Tensions
- Weekly review process

### Mapping Skill
**File:** `mind/skills/Mapping//.md`

**Purpose:** Maintain mind structure and navigation

**Contents:**
- MAP.md structure
- Mapping principles
- How to update MAP.md
- Integration with other skills

### INDEX.md Updates
**Added to Core Workflow:**
- [[mind/skills/curiosity]]
- [[mind/skills/mapping]]

**Updated:**
- Dreamer section → links to Dreaming skill
- Dissonances section → links to Curiosity
  - Mapping

## Files Changed
- [[scripts/dreamer.mjs]] — Fully dynamic
- [[mind/skills/Curiosity//.md]] — New skill
- [[mind/skills/Mapping//.md]] — New skill
- [[mind/INDEX]] — All skills linked
- [[mind/symbiosis/feedback]] — Added learnings
- [[mind/memory/RAM]] — Added entries

## Before vs After

### Dreamer Detection
**Before:**
```javascript
if (tension.types.api && tension.types.sdk) {
  context = 'The mind contains API and SDK...'
  question = 'Which one has precedence?'
}
```

**After:**
```javascript
const context = extractContext(tension.files)
const question = generateQuestion(tension.word
  - types
  - count)
```

### INDEX Structure
**Before:**
```
Core Workflow:
- Dreaming
- Evolution
- Memory
- CodeSync
```

**After:**
```
Core Workflow:
- Dreaming
- Evolution
- Curiosity  ← NEW
- Mapping   ← NEW
- Memory
- CodeSync
```

## Output
- Dreamer now 100% dynamic
- No hardcoded values anywhere
- Curiosity questions captured
- Mind structure maintained
- All skills documented

---

*Session: 2026-02-14 17:45 PST*
