# 🌀 DREAMER

_Curiosity engine — Scans mind, finds tensions, adds to DISSONANCE.md_

---

## What It Does

1. **Reads** all mind/\*.md files
2. **Scans** for tensions/conflicts/uncertainties
3. **Generates** questions and curiosities
4. **Logs** findings to console
5. **Does NOT** edit or commit

## Usage

```bash
# Run dreamer
node scripts/dreamer.mjs

# Output shows:
# - Files scanned
# - Tensions found
# - Questions generated
# - Suggestions for DISSONANCE.md
```

## What It Finds

| Pattern     | Example                      |
| ----------- | ---------------------------- |
| Conflicts   | "but", "however", "although" |
| Tensions    | API vs SDK, local vs cloud   |
| Questions   | "need to decide", "unclear"  |
| Uncertainty | "not sure", "uncertain"      |

## Output Example

```
🌀 Dreamer v1.0
📖 Read DISSONANCE.md
🔍 Scanned 87 files
📊 Found 12 tensions
🔝 Top 3:
   1. [tension] research/api-first.md:42
   2. [conflict] research/moR.md:15
💡 Suggestions:
   - Add API vs SDK tension to DISSONANCE.md
   - Draft question about MoR liability
```

## Integration

### Start of Session

```
1. node scripts/dreamer.mjs
2. Review tensions
3. Check DISSONANCE.md
```

### During Work

```
Found contradiction?
→ Note it → Add to DISSONANCE.md later
```

### Weekly Review

```
1. Read DISSONANCE.md
2. Prioritize tensions
3. Draft questions for Ameer
4. Resolve when possible
```

## DISSONANCE.md Format

See `mind/DISSONANCE.md` for template.

Sections:

- **Questions/Curiosities** — AI-generated questions
- **Active Tensions** — Unresolved conflicts
- **Resolved** — Clarified tensions

## Key Principles

1. **Curiosity over certainty** — Flag uncertainty, don't guess
2. **Capture tension** — Write it down, don't forget
3. **Evolve to clarity** — Tensions become resolved
4. **No false confidence** — Small model = flag it

## Files

- **Script:** `scripts/dreamer.mjs` — Node.js scanner
- **Data:** `mind/DISSONANCE.md` — Tension database
- **Docs:** `mind/DREAMER.md` — This file

## Progress

| Metric          | Description                |
| --------------- | -------------------------- |
| Tensions Found  | New dissonances discovered |
| Questions Asked | Questions for Ameer        |
| Resolved        | Tensions clarified         |

---

_Dreamer keeps the mind curious, humble, and honest._
