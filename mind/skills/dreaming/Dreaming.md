---
date: 2026-02-14
tags:
  - skill
  - dreaming
  - dreamer
  - loop
  - dissonance
  - curiosity
---

# 💤 Dreaming Skill

> How the Dreamer scans the mind using a loop.

---

## What Is Dreaming?

The **Dreamer** is an autonomous agent that runs in a **loop**:

1. Read existing dissonances and curiosities
2. Ask Ollama to find NEW ones
3. Add unique entries with wiki links and #tags
4. Update SYNOPSIS.md with narrative #story
5. Update MAP.md with links
6. Create session log (NOT RAM)

---

## The Dreamer Loop

### Step 1: Read Existing

The Dreamer reads:
- `mind/DISSONANCE.md` — Existing tensions
- `mind/CURIOSITIES.md` — Existing questions

### Step 2: Ask Ollama

Ollama (llama3.1:8b) scans files looking for:
- **Dissonances:** When File A and File B contradict
- **Curiosities:** Questions worth exploring
- **Narrative gaps:** Missing story elements

### Step 4: Add Unique Entries

**Rules:**
- Check if already exists before adding
- Use wiki links: `[[path/to/file]]`
- Use #tags: `#dissonance #conflict`
- Natural language

### Step 5: Update SYNOPSIS

Updates `mind/SYNOPSIS.md`:
```markdown
## 🧠 Mind Health

→ [[mind/DISSONANCE|Cognitive Dissonance]]
→ [[mind/CURIOSITIES|Curiosities]]
```

### Step 5: Update RAM + Log

- RAM entry with timestamp
- Session log in `memory/sessions/`

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

## Active Conflicts

### API vs SDK

**Sources:**
- [[research/findings/api-first-design]]
- [[research/FEATURE_SPACE]]

**Question:** Which approach should take precedence?

```

### CURIOSITIES.md

```markdown
# Curiosities

> Questions worth exploring. #curiosity #questions #gaps

---

## Questions

- **What is the optimal chunk size?**

  Source: [[apps/api/src/services/mind-embeddings]]

```

### Session Log

```markdown
---
date: 2026-02-14
tags:
  - session
  - dreamer
type: dreamer
---

# Dreamer Scan — 2026-02-14

Found 3 tensions.

---
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
- List all dissonances: `TABLE WHERE file = "DISSONANCE.md"`
- List all curiosities: `TABLE WHERE file = "CURIOSITIES.md"`

### Synopsis
Follow [[mind/skills/synopsis/Synopsis]]:
- Update SYNOPSIS.md with new chapters
- Check narrative consistency
- Flag stale entries

### Mapping
Follow [[mind/skills/mapping/Mapping]]:
- Update MAP.md with new links
- Maintain structure

---

## Example Output

```bash
$ node scripts/dreamer.mjs
🌀 Dreamer Loop...

📖 Read 2 existing dissonances
📖 Read 5 existing curiosities
📖 Scanned 108 files

🤖 Finding NEW dissonances...
🎯 Found 2 NEW dissonances
🔥 API vs SDK
🔥 MoR Liability

🤖 Finding NEW curiosities...
🎯 Found 1 NEW curiosity
❓ What is optimal chunk size?

✅ Updated DISSONANCE.md with 2 dissonance(s)
✅ Updated CURIOSITIES.md with 1 curiosity
📝 RAM updated

✨ Dreamer complete!
```

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
- [[mind/skills/synopsis/Synopsis]] — Story maintenance
- [[mind/DISSONANCE]] — Where tensions go
- [[mind/CURIOSITIES]] — Where questions go

---

*Dream: Scan, find, link, repeat.*
