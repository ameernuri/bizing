---
date: 2026-02-14
tags: 
  - skill
  - curiosity
  - questions
  - gaps
  - knowledge
---

# ❓ Curiosity Skill

> *Records questions
  - knowledge gaps
  - and things we want to explore.*

---

## What Is Curiosity?

**Curiosity** captures:
- Questions we want answered
- Knowledge gaps in the mind
- Things to investigate
- Open questions from research
- Unresolved mysteries

**Curiosity is NOT:**
- ❌ Tensions (conflicts between approaches)
- ❌ Tasks to complete
- ❌ Bugs to fix
- ❌ Features to build

---

## Where to Record

**File:** `mind/CURIOSITIES.md`

**Format:** Simple bullet points with context

```markdown
# CURIOSITIES

> *Questions we want answered
  - gaps we want to fill.*

---

- **What is the optimal chunk size for embeddings?**
  Context: Current chunk size is 2000
  - but unsure if optimal
  Sources: [[mind-embeddings.ts]]

- **Should agents have their own data storage?**
  Context: GDPR concerns with shared storage
  Sources: [[research/AI_AGENTS_CRM]]
```

---

## When to Add Curiosity

### ✅ Add When:

- Research raises questions
- User asks "what about X?"
- Finding conflicting information
- Noting gaps in knowledge
- Marking things to investigate

### ❌ Don't Add When:

- It's a tension (use DISSONANCE)
- It's a task (use feature space)
- It's a bug (use issue tracker)
- We have the answer

---

## How to Add Curiosity

### Manual Addition

```markdown
# CURIOSITIES

> *Questions we want answered
  - gaps we want to fill.*

---

- **Your question here**
  Context: Brief explanation of why we're curious
  Sources:
  - [[path/to/file]]
  - [[path/to/another]]
```

### Components

| Component | Required | Description |
|-----------|----------|-------------|
| **Question** | Yes | What we want to know |
| **Context** | No | Why we're curious |
| **Sources** | No | Files that prompted the question |

---

## Example Curiosities

```markdown
# CURIOSITIES

> *Questions we want answered
  - gaps we want to fill.*

---

- **What is the optimal booking flow for multi-staff businesses??**
  Context: Need to support multiple staff members with different schedules
  Sources:
  - [[research/booking-domain-model]]
  - [[research/business-types]]

- **How should AI agents store conversation history?**
  Context: GDPR requires data minimization
  Sources:
  - [[research/AI_AGENTS_CRM]]
  - [[research/GDPR_DATA]]
```

---

## Integrating with Dreamer

The **Dreamer** automatically adds curiosities when:
- Single source found on a topic
- Questions detected in file content
- Knowledge gaps identified

**Dreamer adds to CURIOSITIES:**
```markdown
- **Should we explore {topic} further?**
  Context: Single source found
  - might need more research
  Sources:
  - [[path/to/file]]
```

---

## Curiosities vs Tensions

| | Curiosity | Tension |
|---|-----------|---------|
| **What** | Question | Conflict |
| **Type** | "What is X?" | "X vs Y" |
| **Example** | "How do embeddings work?" | "API vs SDK" |
| **Where** | CURIOSITIES.md | DISSONANCE.md |
| **Action** | Research | Decide |

---

## Reviewing Curiosities

**Weekly review:**
1. Read CURIOSITIES.md
2. Answer answered questions
3. Remove resolved items
4. Prioritize remaining

**Resolution:**
- If answered → Move to knowledge base or remove
- If becoming tension → Move to DISSONANCE.md
- If no longer relevant → Remove

---

## Related Skills

- [[mind/skills/dreaming]] — Dreamer scans mind (finds curiosities)
- [[mind/skills/evolution]] — Major mind alterations
- [[mind/DISSONANCE]] — Where tensions go
- [[mind/CURIOSITIES]] — Where questions go

---

*Curiosity: The first step to wisdom.*
