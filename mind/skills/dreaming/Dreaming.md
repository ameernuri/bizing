---
date: 2026-02-15
tags:
  - skill
  - dreaming
  - dreamer
  - daydreamer
  - daemon
  - contradiction
  - curiosity
---

# 💤 Dreaming Skill

> How the Daydreamer daemon scans the mind for quality contradictions and curiosities.

---

## What Is Dreaming?

The **Daydreamer** is an autonomous daemon that runs continuously, slowly contemplating the mind one task at a time.

### Tasks

| Task | Weight | Description |
|------|--------|-------------|
| **scan_dissonances** | 22% | Find real contradictions (not word-level opposites) |
| **scan_curiosities** | 22% | Find substantial questions worth exploring |
| **map_mind** | 15% | Update mental map of files/concepts |
| **plan_future** | 13% | Think about what needs attention |
| **reflect** | 10% | Review recent changes |
| **mindsync** | 10% | Full mind synchronization |
| **rest** | 8% | Take a break |

### Schedule

- **Interval:** ~15 minutes between tasks (±5 min variance)
- **Runs:** Continuously in background
- **PID:** Tracked in `/tmp/bizing-daydreamer.pid`

---

## Quality Standards

The Daydreamer follows strict quality standards from the Curiosity and Dissonance skills:

### For Curiosities

✅ **DO find:**
- Substantial questions (30-200 chars)
- Questions with context
- Speculative ideas worth developing
- Knowledge gaps with explanations

❌ **DON'T find:**
- Section headers ("What is X?")
- Single words or fragments
- Questions already answered

See: [[mind/skills/curiosity|Curiosity Skill]]

### For Dissonances

✅ **DO find:**
- Rule conflicts ("always X" vs "never X")
- Definition conflicts (same term, different meanings)
- Workflow conflicts (different first steps)
- Priority conflicts (critical vs optional)

❌ **DON'T find:**
- Word-level opposites without context
- Different valid approaches

See: [[mind/skills/dissonance|Dissonance Skill]]

---

## The Daydreamer Loop

### Step 1: Select Task

Randomly select next task based on weights:
```javascript
const task = selectTask() // scan_dissonances, scan_curiosities, etc.
```

### Step 2: Execute Task

#### Scan Dissonances

1. Read sample of files (30-50)
2. Check file pairs for contextual contradictions:
   - Rule conflicts
   - Definition conflicts
   - Workflow conflicts
   - Priority conflicts
3. Only save if both sides have substance (>50 chars)
4. Write to `mind/dissonance/YYYY-MM-DD-[title].md`

#### Scan Curiosities

1. Read sample of files (30)
2. Look for:
   - Substantial questions with context
   - Speculative statements
   - Knowledge gaps (TODO, future work, uncertainty)
   - Incomplete documentation
3. Only save if substantial (30+ chars) with context
4. Write to `mind/curiosities/YYYY-MM-DD-[title].md`

### Step 3: Update State

- Increment task counter
- Save tracked pairs (avoid duplicates)
- Log completion

### Step 4: Rest

- Calculate next interval (~15 min ± variance)
- Sleep until next task

---

## Where Results Go

### Dissonances → `mind/dissonance/`

Individual files with:
- Status (Active/Resolved)
- Files in conflict
- Actual quotes showing contradiction
- Why it matters
- Resolution options

### Curiosities → `mind/curiosities/`

Individual files with:
- Status (Open)
- Source file(s)
- The question
- Context
- Why explore this
- Next steps

### State → `mind/.daydreamer/`

- `state.json` — Task history and stats
- `dissonance-pairs.json` — Tracked file pairs
- `curiosity-pairs.json` — Tracked file pairs
- `mind-map.json` — Latest mind map

---

## Managing the Daydreamer

### Check Status

```bash
~/projects/bizing/scripts/daydreamer-daemon.sh status
```

### View Logs

```bash
~/projects/bizing/scripts/daydreamer-daemon.sh log
tail -f /tmp/bizing-daydreamer.log
```

### Restart

```bash
~/projects/bizing/scripts/daydreamer-daemon.sh restart
```

### Stop

```bash
~/projects/bizing/scripts/daydreamer-daemon.sh stop
```

---

## Key Concepts

### Contradiction vs Curiosity

| Contradiction | Curiosity |
|--------------|-----------|
| File A says X, File B says Y (opposite) | A question worth exploring |
| → `mind/dissonance/` | → `mind/curiosities/` |
| Must explain HOW they contradict | Must explain WHY it's interesting |
| Real conflict | Gap in knowledge |

### Real vs False Dissonance

**Real:** "Always deploy Fridays" vs "Never deploy Fridays"

**False:** File A uses "is", File B uses "is not" (word-level only)

### Substantial vs Fragment

**Substantial:** "How might Bizing's approach to personalization differ from traditional AI?"

**Fragment:** "What is this?" (just a heading)

---

## Example Output

```
🌀 Daydreamer Loop...

📖 Scanned 131 files
📖 Tracked 3 file pairs
📖 Read 0 contradictions, 13 curiosities

🎯 Found 0 NEW contradictions
🎯 Found 0 NEW curiosities
✅ No new found

✨ Daydream complete!

⏳ Next daydream at 10:33:30 PM (16m)
```

---

## Integration with Other Skills

- **Finds:** [[mind/skills/curiosity|Curiosities]] — Questions worth exploring
- **Finds:** [[mind/skills/dissonance|Dissonances]] — Contradictions to resolve
- **Creates:** [[mind/skills/evolution|Evolution entries]] — Logs major changes
- **Updates:** [[mind/skills/mapping|MAP.md]] — Mind structure
- **Does:** [[mind/skills/mindsync|MindSync]] — 10% of the time

---

## Related Skills

- [[mind/skills/curiosity|Curiosity Skill]] — Quality standards for questions
- [[mind/skills/dissonance|Dissonance Skill]] — Quality standards for contradictions
- [[mind/skills/evolution|Evolution Skill]] — Recording major changes
- [[mind/skills/mapping|Mapping Skill]] — Maintaining mind structure
- [[mind/skills/mindsync|Mindsync Skill]] — Full mind synchronization

---

*The Daydreamer never sleeps, only rests between dreams.*
