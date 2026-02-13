# 🌀 DREAMER

*Autonomous Mind Evolver — Scans mind, finds tensions, evolves continuously*

---

## What It Actually Does (v2.0)

1. **Scans** all mind/*.md files
2. **Finds** tensions/conflicts/uncertainties  
3. **Appends** to [[DISSONANCE]] automatically
4. **Logs** evolution to [[evolution/YYYY-MM-DD]]
5. **Runs** every 30 minutes (cron job)

**Real Script:** `scripts/dreamer.mjs`

## Usage

```bash
# Run manually
node scripts/dreamer.mjs

# Or via cron (every 30 min)
*/30 * * * * cd ~/projects/bizing && node scripts/dreamer.mjs
```

## Actual Output

```
🌀 Dreamer v2.0 — Autonomous Mind Evolver
=============================================
[03:41:21] 📈 Evolution: Dreamer Run
[03:41:21] 📖 Found 87 mind files
[03:41:21] 🔥 Added D-001 to DISSONANCE.md
[03:41:21] 🔥 Added D-002 to DISSONANCE.md
...
📊 Summary:
   Files scanned: 87
   Tensions found: 17
   Dissonances added: 12
   Wikilink opportunities: 269
✨ Mind has evolved.
🌀 Zzz... dreaming of more improvements...
```

## What It Finds

| Pattern | Example |
|---------|---------|
| Conflicts | "but", "however", "although" |
| Tensions | API vs SDK, local vs cloud |
| Questions | "need to decide", "unclear" |
| Uncertainty | "not sure", "uncertain" |
| Orphans | Files with < 3 wikilinks |

## Files Changed

| File | What Dreamer Does |
|------|-------------------|
| [[DISSONANCE]] | Appends new tensions (D-001, D-002, etc.) |
| [[evolution/YYYY-MM-DD]] | Logs "Dreamer Run" entry |
| Console | Shows summary, tensions, suggestions |

## No Edit Loop Protection

Dreamer:
- ✅ Appends to DISSONANCE (adds only)
- ✅ Logs evolution (adds only)
- ✅ Never removes content
- ✅ Never edits existing text
- ✅ Safe to run repeatedly

## Key Principles

1. **Curiosity over certainty** — Flag uncertainty, don't guess
2. **Minimal edits** — Only append, never modify
3. **Safe automation** — No infinite loops, no chaos
4. **Human in loop** — Review DISSONANCE, resolve tensions

## Integration with Team

| Who | Role |
|-----|------|
| **Dreamer** | Scans, finds, appends, logs |
| **Bizing AI** | Reads mind, answers queries, uses knowledge |
| **Pac** | Queries Bizing, updates mind, commits changes |
| **Ameer** | Resolves tensions, answers questions, guides |

## TEAMSYNC Loop

```
Dreamer → Scans → Appends tensions → Logs evolution
    ↓
Pac → Queries Bizing → Discovers gaps → Updates mind
    ↓
Bizing → Reads updated mind → Responds accurately
    ↓
Ameer → Reviews DISSONANCE → Resolves → Mind evolves
    ↓
Back to Dreamer...
```

## When to Run

- **Cron:** Every 30 minutes automatically
- **Manual:** Before deep work, check tensions
- **After changes:** Let Dreamer find new tensions

## Files

- **Script:** `scripts/dreamer.mjs` — Node.js evolver
- **Output:** `mind/DISSONANCE.md` — Tension database
- **Evolution:** `mind/evolution/YYYY-MM-DD.md` — Change log
- **Docs:** `mind/DREAMER.md` — This file

---

*Dreamer evolves the mind while we sleep. Curiosity never stops.*
