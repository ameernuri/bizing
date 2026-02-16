---
date: 2026-02-15
tags: 
  - skill
  - curiosity
  - questions
  - gaps
  - knowledge
  - quality
---

# ❓ Curiosity Skill

> *Find and record quality questions worth exploring.*

---

## What Is Curiosity?

**Curiosity** captures substantial questions and knowledge gaps that deserve exploration.

**Curiosity IS:**
- ✅ Questions that could lead to insights
- ✅ Knowledge gaps with context
- ✅ Speculative ideas worth developing
- ✅ Open questions from research

**Curiosity is NOT:**
- ❌ Section headers ("What is X?")
- ❌ Single words or fragments
- ❌ Tensions (conflicts between approaches)
- ❌ Tasks to complete
- ❌ Already answered questions

---

## Where to Record

**Folder:** `mind/curiosities/`

**Format:** Individual markdown files

**Naming:** `YYYY-MM-DD-[descriptive-title].md`

---

## Quality Standards

### ✅ Quality Curiosity Checklist

| Criterion | Description |
|-----------|-------------|
| **Substantial** | At least 30 characters, not just a heading |
| **Contextual** | Includes where/why it was found |
| **Explorable** | Could lead to research or discussion |
| **Specific** | Not vague or overly broad |
| **Valuable** | Exploring it would add value |

### ❌ Bad Examples (Don't Create)

```
❌ "What is Bizing?"  (Just a heading)
❌ "Why 6.9%?"  (Fragment, no context)
❌ "TODO: fix this"  (Task, not curiosity)
❌ "What if..."  (Incomplete thought)
```

### ✅ Good Examples (Do Create)

```
✅ "How might Bizing's self-identification as a living entity 
     influence its approach to personalization and user experience?"

✅ "What is the optimal chunk size for embeddings given Ollama's 
     4096 token context limit and overhead considerations?"

✅ "Should AI agents have their own isolated data storage to address 
     GDPR data minimization requirements?"
```

---

## How to Add Curiosity

### Manual Creation

Create file: `mind/curiosities/2026-02-15-optimal-embedding-chunk-size.md`

```markdown
# What is the optimal chunk size for embeddings?

**Status:** Open  
**Created:** 2026-02-15  
**Type:** Exploration Question

## Source

[[knowledge/tech/embeddings.md]]

## The Question

What is the optimal chunk size for embeddings given Ollama's 
4096 token context limit and overhead considerations?

## Context

Currently using 2000 characters per chunk, but Ollama crashes 
with 8000 characters. Need to find the sweet spot between:
- Context completeness (larger chunks)
- Token limit compliance (smaller chunks)
- Processing efficiency

## Why Explore This?

- Affects embedding quality and search accuracy
- Impacts system stability
- Could improve performance significantly

## Next Steps

- [ ] Test various chunk sizes (1000, 1500, 2000, 2500)
- [ ] Measure embedding quality
- [ ] Document optimal setting

## Tags

#curiosity #embeddings #performance #ollama
```

### Components

| Component | Required | Description |
|-----------|----------|-------------|
| **Title** | Yes | Clear, descriptive question |
| **Source** | Yes | File(s) that prompted this |
| **The Question** | Yes | Full question with context |
| **Context** | Yes | Background and why it matters |
| **Why Explore** | Recommended | Potential value of exploring |
| **Next Steps** | Optional | Actionable follow-ups |

---

## Automated Detection (Dreamer)

The **Daydreamer** daemon automatically finds curiosities using these patterns:

### Pattern 1: Substantial Questions

Looks for questions that:
- Start with question words (how, what, why, when, where, who, which)
- Are 30-200 characters long
- Have substantial context

```javascript
// Matches:
"How might Bizing's approach to personalization differ from traditional AI?"

// Doesn't match:
"What is this?"  (Too short)
```

### Pattern 2: Speculative Statements

Looks for hypotheses worth exploring:
- "Imagine if..."
- "Consider how..."
- "Perhaps we could..."

```javascript
// Matches:
"Imagine if AI agents could negotiate their own service fees"

// Doesn't match:
"Maybe fix this"  (Too vague, task-like)
```

### Pattern 3: Knowledge Gaps

Identifies explicit gaps:
- TODO/FIXME with context
- "Not yet implemented"
- "Future work"
- Uncertainty markers

```javascript
// Good gap:
"TODO: Implement retry logic for failed embedding requests 
 (see issue #123 for context)"

// Bad gap:
"TODO: fix"  (No context)
```

### Pattern 4: Incomplete Documentation

Detects stubs and placeholders:
- "Section to be written"
- "Content coming soon"
- Empty sections marked for completion

---

## Curiosities vs Other Concepts

| | Curiosity | Dissonance | Task | Evolution |
|---|-----------|------------|------|-----------|
| **What** | Question | Conflict | Action | Major change |
| **Type** | "How does X work?" | "X contradicts Y" | "Do X" | "Implemented Y" |
| **Where** | `curiosities/` | `dissonance/` | Feature space | `evolution/` |
| **Action** | Research | Resolve | Execute | Document |

---

## Review and Resolution

### Weekly Review

1. Browse `mind/curiosities/` folder
2. For each curiosity, ask:
   - Is this still relevant?
   - Has it been answered?
   - Should it become a task?
   - Is it becoming a tension?

### Resolution Options

| Status | Action |
|--------|--------|
| **Answered** | Update with answer, move to knowledge base, or delete |
| **Becoming tension** | Move to `dissonance/` |
| **Ready to implement** | Convert to task/feature |
| **No longer relevant** | Delete |
| **Needs more thought** | Keep open, add notes |

---

## Integration with Workflow

### When Daydreamer Finds Curiosity

1. Daydreamer scans files using quality patterns
2. Creates file in `mind/curiosities/YYYY-MM-DD-[title].md`
3. Includes context and source
4. Adds to tracked pairs (won't duplicate)

### When You Find Curiosity

1. Create file manually following template
2. Link to source files
3. Add context explaining why it matters
4. Tag appropriately

---

## Related Skills

- [[mind/skills/dreaming|Dreaming]] — Daydreamer daemon that finds curiosities
- [[mind/skills/dissonance|Dissonance]] — For conflicts, not questions
- [[mind/skills/evolution|Evolution]] — For major mind changes
- [[mind/skills/knowledge|Knowledge]] — For answers to curiosities

---

*Quality curiosities lead to quality knowledge.*
