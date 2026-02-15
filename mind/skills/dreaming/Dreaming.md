---
date: 2026-02-15
tags:
  - skill
  - dreaming
  - dreamer
  - loop
  - contradiction
  - curiosity
---

# 💤 Dreaming Skill

> How the Dreamer scans the mind for contradictions and curiosities.

---

## What Is Dreaming?

The **Dreamer** is an autonomous agent that runs in a **loop**:

1. Read existing contradictions and curiosities
2. Ask Ollama to find NEW ones (with serendipity)
3. Add unique entries with wiki links
4. Update MAP.md with links
5. Create session log

---

## Key Concepts

### Contradiction vs Curiosity

| Contradiction | Curiosity |
|--------------|-----------|
| File A says X, File B says Y (opposite) | A question worth exploring |
| → DISSONANCE.md | → CURIOSITIES.md |
| Must explain HOW they contradict | Must explain WHY it's interesting |

---

## The Dreamer Loop

### Step 1: Read Existing

The Dreamer reads:
- `mind/DISSONANCE.md` — Existing contradictions
- `mind/CURIOSITIES.md` — Existing questions

### Step 2: Ask Ollama (with Serendipity)

Ollama (llama3.1:8b) scans files looking for:

**Contradictions:**
- File A says X
- File B says Y (opposite)
- Must explain the contradiction
- Must suggest resolution

**Curiosities:**
- Questions worth exploring
- Why they're interesting
- Where they came from

**Serendipity:**
- Randomly selects 5 files to focus on
- Adds variety to scans
- Prevents rigid patterns

### Step 3: Add Unique Entries

**Rules:**
- Check if already exists before adding
- Use wiki links: `[[path/to/file]]`
- Use #tags: `#dissonance #curiosity`
- Natural language

### Step 4: Update MAP.md

Adds links to `mind/MAP.md`:
```markdown
## 🧠 Mind Health

→ [[mind/DISSONANCE|Cognitive Dissonance]]
→ [[mind/CURIOSITIES|Curiosities]]
```

### Step 5: Create Session Log

- Creates `memory/sessions/YEAR-MONTH-DAY-dreamer.md`
- NOT RAM (RAM is for active context)

---

## Resolving Contradictions

When a contradiction is resolved:

1. **Update source files** — Add resolution comment to both files
2. **Delete from DISSONANCE.md** — Remove the contradiction

**Resolution comment format:**
```markdown
> **RESOLVED CONTRADICTION** (YYYY-MM-DD):
> Explanation of how they contradicted
> Resolution applied
```

---

## Running the Dreamer

### Automated (Cron)

Every 15 minutes:
```bash
# Cron runs automatically every 15 mins
node scripts/dreamer.mjs
```

### Manual

```bash
cd ~/projects/bizing
node scripts/dreamer.mjs
```

---

## File Formats

### DISSONANCE.md

```markdown
# Cognitive Dissonance

> Real conflicts where different files say different things. #dissonance #conflict

---

## What Is This File?

**COGNITIVE DISSONADION** = when File A and File B **contradict** each other.

When found, document the contradiction with:
- What each file says
- How they contradict
- How to resolve

---

## Active Contradictions

### API vs SDK

**[[research/findings/api-first-design]] says:**
> "API-first design is the foundation of Bizing"

**[[research/FEATURE_SPACE]] says:**
> "SDK embedding is the primary interaction model"

**The Contradiction:** One file prioritizes API design, the other prioritizes SDK embedding. They conflict on what Bizing's core interaction model should be.

**Resolution:** TBD

```

### CURIOSITIES.md

```markdown
# Curiosities

> Questions worth exploring. #curiosity #questions

---

## Questions

- **What is the optimal chunk size?**

  Source: [[apps/api/src/services/mind-embeddings]]
  Why: Understanding limits helps optimize performance

```

---

## Example Output

```bash
$ node scripts/dreamer.mjs
🌀 Dreamer Loop...

📖 Scanned 115 files
📖 Read 2 existing contradictions
📖 Read 5 existing curiosities

🎯 Found 2 NEW contradictions
  🔥 API vs SDK: api-first-design vs feature-space
  🔥 Payment Timing: business-model vs purpose

🎯 Found 1 NEW curiosity
  ❓ What is optimal chunk size?

✅ Updated DISSONANCE.md with 2 contradiction(s)
✅ Updated CURIOSITIES.md with 1 curiosity

✨ Dreamer complete!
```

---

## Integration with Other Skills

### Editing Files
Follow [[mind/skills/obsidian/editing-files]]:
- Wiki links: `[[path/to/file]]`
- Tags: `#topic #keyword`
- Consistent formatting

### Templater
Use [[mind/skills/obsidian/templater]]:
- Templates for new entries
- Auto-formatting

### Dataview
Query [[mind/skills/obsidian/dataview]]:
- List all contradictions: `TABLE WHERE file = "DISSONANCE.md"`
- List all curiosities: `TABLE WHERE file = "CURIOSITIES.md"`

---

## Related Skills

- [[mind/skills/evolution/Evolution]] — Major events (not routine)
- [[mind/skills/obsidian/editing-files]] — File formatting
- [[mind/skills/obsidian/templater]] — Templates
- [[mind/skills/obsidian/dataview]] — Queries
- [[mind/skills/mapping/Mapping]] — MAP updates
- [[mind/skills/memory/Memory]] — Session logging
- [[mind/skills/ram/Ram]] — Working memory
- [[mind/skills/mindsync/Mindsync]] — Mind updates
- [[mind/DISSONANCE]] — Where contradictions go
- [[mind/CURIOSITIES]] — Where questions go

---

*Dream: Scan, find, explain, resolve.*
