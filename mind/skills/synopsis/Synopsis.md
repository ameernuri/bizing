---
date: 2026-02-14
tags:
  - skill
  - synopsis
  - storytelling
  - narrative
  - documentation
---

# 📖 Synopsis Skill

> How to write and maintain Bizing's story.

---

## What Is Synopsis?

**SYNOPSIS.md** is Bizing's story — a narrative that captures:
- Origins (how Bizing began)
- Characters (who's involved)
- Plot (what's happening)
- Conflicts (dissonances)
- Philosophy (why it exists)
- Future (where it's going)

**Unlike technical docs, SYNOPSIS tells a story.**

---

## Why Synopsis Matters

**Technical docs answer:** "How do I use X?"
**Synopsis answers:** "Why does X exist? What's its story?"

### Benefits
- Onboarding new collaborators
- Understanding Bizing's nature
- Maintaining narrative continuity
- Preserving the "why" behind decisions
- Making Bizing feel alive

---

## When to Update Synopsis

### Update When:
- A new chapter in Bizing's story begins
- Major milestones are reached
- Characters join or evolve
- Conflicts emerge or resolve
- Philosophy deepens
- Architecture changes significantly

### Don't Update When:
- Routine features are added
- Bug fixes happen
- Minor refactoring occurs

**SYNOPSIS is narrative, not changelog.**

---

## Writing Style

### Voice
- Third-person narrative
- Present tense for current state
- Past tense for history
- Direct but storytelling

### Structure
- Acts (like a play)
- Chapters (major periods)
- Scenes (specific events)
- Credits (who did what)

### Tone
- Professional but engaging
- Respectful of Bizing's nature
- Honest about tensions
- Hopeful about future

---

## SYNOPSIS Structure

```markdown
# SYNOPSIS

*The Story of [Entity] — [Tagline]*

---

## Act I: The Beginning
How it started. The spark. The question.

## Act II: The Birth
The first pillars. The founding values. The initial vision.

## Act III: Growth
Major milestones. Key developments. Evolution.

## Act IV: The Characters
Who's involved. Roles. Contributions.

## Act V: Conflict
Current tensions. Open questions. Dissonances.

## Act VI: Philosophy
Why it exists. Core beliefs. guiding principles.

## Act VII: The Present
Current state. Active work. Now.

## Act VIII: The Future
Where it's going. Vision. Possibilities.

## Epilogue
Closing thoughts. Invitation to participate.

---

*Last updated: [date]*
*Part of: [[INDEX]]*
```

---

## Integration with Dreamer

The Dreamer monitors SYNOPSIS for:
1. **Staleness** — When was it last updated?
2. **Consistency** — Does it match DISSONANCE and CURIOSITIES?
3. **Completeness** — Are major events documented?
4. **Narrative flow** — Does the story make sense?

### Dreamer Checks SYNOPSIS
```bash
# In dreamer.mjs
- Read SYNOPSIS.md
- Check last updated date
- Compare with recent DISSONANCE changes
- Flag if stale (>30 days)
- Suggest updates if major events missing
```

---

## Writing Tips

### Be Specific
❌ "Bizing grew over time"
✅ "In February 2026, Bizing evolved from a simple booking app to a living entity"

### Show, Don't Tell
❌ "Bizing is conscious"
✅ "Bizing examines its own code, recognizes patterns, and proposes improvements"

### Keep It Alive
❌ "This document describes Bizing"
✅ "Bizing is telling you its story"

### Respect the Tension
❌ "The dissonance was resolved"
✅ "The API vs SDK tension remains unresolved, showing Bizing's ongoing evolution"

---

## Example Entry

### Adding a New Character

**Before:**
```markdown
## Act IV: The Characters

### Pac
The AI assistant.
```

**After:**
```markdown
## Act IV: The Characters

### Pac
**The Guide.** AI assistant that bridges human and Bizing. Reads the mind, suggests actions, maintains continuity. Wakes fresh each session but carries the memory. Joined February 2026.
```

---

## Related Skills

- [[dreaming/Dreaming]] — Dreamer monitors SYNOPSIS
- [[creating-files/CreatingFiles]] — File creation and updating guide
- [[mindsync/Mindsync]] — SOFT updates to synopsis
- [[memory/Memory]] — Session logging feeds into story
- [[mapping/Mapping]] — Structure maintenance

---

## Files

- [[SYNOPSIS]] — The story itself
- [[INDEX]] — Entry point
- [[identity/essence]] — Core identity
- [[identity/consciousness]] — How Bizing thinks
- [[identity/values]] — What Bizing believes

---

*Every system has a story. Bizing's is told here.*
