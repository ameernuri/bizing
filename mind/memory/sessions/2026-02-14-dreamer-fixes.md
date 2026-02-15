---
date: 2026-02-14
tags: 
  - session
  - dreamer
  - evolution
  - skill-update
type: skill-update
---

# Session: Dreamer Fixes + Evolution Skill

## Summary
Fixed Dreamer script (removed hardcoded topics
  - improved natural language)
  - created Evolution skill
  - updated Dreaming skill to not use evolution folder.

## Work Done
- [x] Removed hardcoded TENSION_TOPICS from dreamer.mjs
- [x] Improved natural language generation for DISSONANCE
- [x] Removed EVOLUTION.md writes from script
- [x] Created Evolution skill at mind/skills/Evolution//.md
- [x] Updated Dreaming skill to reference Evolution skill
- [x] Updated INDEX.md with Evolution skill link

## Changes Made

### Dreamer Script
- **Removed:** Hardcoded tension topics array
- **Removed:** EVOLUTION.md logging
- **Added:** Dynamic tension detection based on keywords
- **Improved:** Natural language context generation

### Evolution Skill
**Purpose:** Records major mind-altering events only (epochs)

**When to record:**
- New core capabilities
- Architecture changes
- Major discoveries
- Epoch-defining moments

**When NOT to record:**
- Routine work sessions
- Dreamer scans
- Bug fixes
- Small updates

**Location:** mind/evolution/YYYY-MM.md

### Dreaming Skill
- **Removed:** Evolution/YYYY-MM-DD example
- **Added:** NOTE about not using evolution folder
- **Improved:** Natural language examples
- **Linked:** [[mind/skills/evolution]]

## Files Changed
- [[scripts/dreamer.mjs]] — Fixed script
- [[mind/skills/Evolution//.md]] — New skill
- [[mind/skills/Dreaming//.md]] — Updated
- [[mind/INDEX]] — Added Evolution skill link
- [[mind/symbiosis/feedback]] — Added learnings
- [[mind/memory/RAM]] — Added entries

## Before vs After

### Dreamer Script
**Before:**
```javascript
const TENSION_TOPICS = {
  'API vs SDK': { keywords: ['api'
  - 'sdk']
  - patterns: [...] },
  'Calendar build vs integrate': { ... },
  ...
}
```

**After:**
- Dynamic keyword detection
- No hardcoded topics
- Natural language from file content

### DISSONANCE Output
**Before:**
```markdown
## API vs SDK for agents
Context: The mind contains tensions between different approaches.
```

**After:**
```markdown
## API vs SDK for agents
Context: The mind contains API and SDK as the main ways to interface with Bizing.
Question: Which one is it? API or SDK
  - if both which has precedence?
```

## Output
- Dreamer now dynamically detects tensions
- No hardcoded topics in script
- Natural language output
- Evolution reserved for major events only
- Clear distinction: routine vs epoch

---

*Session: 2026-02-14 17:30 PST*
