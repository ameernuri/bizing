---
date: 2026-02-13
tags: 
  - skill
  - mindsync
  - workflow
  - update
---

# 🧠 MindSync Skill

> Keep Bizing's mind synchronized with reality

---

## ⚠️ CodeSync vs MindSync

**These are SEPARATE processes. Both required.**

| CodeSync | MindSync |
|----------|----------|
| Commits **code** changes | Updates **mind** content |
| `git commit` on feature branch | Edit `.md` files directly |
| Branch → PR → Merge to main | Content stays in mind/ |
| Tests must pass | No tests (documentation) |
| Preserves code history | Documents decisions/context |

**Order:**
1. **CodeSync** → Commit code changes (on feature branch, via PR)
2. **MindSync** → Update mind files to reflect those changes

---

## What Is MindSync?

**MindSync** updates the mind files after code work. Documents:
- What was done
- Why it was done
- What was learned
- How things changed

---

## Two Levels

### SOFT MindSync — Every Change

**Trigger:** After CodeSync completes (code committed to repo)

**What to update:**
1. [[mind/memory/RAM]] — Add completed items with timestamps
2. [[symbiosis/feedback]] — Log new learnings (rules, insights)
3. [[mind/memory/sessions/index|Session index]] — Add entry if significant work

**Time:** 2-3 minutes

---

### HARD MindSync — Major Events

**Trigger:**
- Major features completed (after CodeSync)
- Workflow changes
- Architecture updates
- User says: "mindsync"

**What to update:**
1. [[mind/memory/RAM]] — Comprehensive update
2. [[symbiosis/feedback]] — Detailed learnings
3. [[mind/memory/sessions/YYYY-MM-DD-description|Session log]] — Full work log
4. [[mind/evolution/YYYY-MM-DD]] — Major changes
5. [[mind/MAP]] — If structure changed
6. **Regenerate embeddings** — Rebuild knowledge base for Bizing AI
7. Any other relevant files

**Time:** 10-15 minutes

---

## SOFT MindSync Workflow

### Step 1: Update RAM

Add to [[mind/memory/RAM]]:

```markdown
## ✅ Recent Completed

- [2026-02-13 14:30 PST] Fixed embedding crash in [[apps/api/src/services/mind-embeddings.ts]]
```

### Step 2: Update Feedback

Add to [[symbiosis/feedback]]:

```markdown
- [2026-02-13] **Embedding crash fixed** — Ollama context limit at 8000 chars
  - reduced to 2000
```

### Step 3: Update Session Index (if significant)

If the work is significant enough to remember:

Add to [[mind/memory/sessions/index]]:

```markdown
## Recent Sessions

- [[./2026-02-13-description|Feb 13]] — Brief description
```

---

## HARD MindSync Workflow

### Step 1: Create Session Log

File: `mind/memory/sessions/2026-02-13-embedding-crash-fix.md`

```markdown
---
date: 2026-02-13
tags: 
  - session
  - log
  - bugfix
---

# Session: Fixed Embedding Crash

## Summary
Reduced chunk size from 8000 → 2000 chars to prevent Ollama crashes.

## What We Did
1. Identified root cause: Ollama context limit
2. Reduced chunk size in [[apps/api/src/services/mind-embeddings.ts]]
3. Added resilient error handling
4. All tests passing

## Key Learning
Ollama has ~4096 token context. 8000 chars ≈ 1500 tokens but with overhead it crashes. 2000 chars is safe.

## Files Changed
- [[apps/api/src/services/mind-embeddings.ts]]

## Next Steps
- Monitor for future embedding issues
- Consider other local model options
```

### Step 2: Update Evolution

Add to [[mind/evolution/2026-02-13]]:

```markdown
## 2026-02-13 — Embedding Crash Fixed

- Reduced chunk size 8000→2000 chars
- Added resilient error handling
- Server continues without embeddings on failure
```

### Step 3: Update RAM

Add completed items with timestamps.

### Step 4: Update Feedback

Add key learnings.

### Step 5: Regenerate Embeddings

Rebuild Bizing AI's knowledge base so it has the latest mind content:

```bash
curl -X POST http://localhost:6129/api/v1/admin/rebuild-knowledge
```

Or trigger via Bizing API. This ensures Bizing AI can search and retrieve the updated content.

**Why:** Embeddings are cached. After major mind changes they must be rebuilt or Bizing AI will have stale knowledge.

### Step 6: Restart Server (if cache stale)

If Bizing AI still shows old information after rebuilding:

```bash
# Kill and restart the dev server
pkill -f "tsx.*server"
cd ~/projects/bizing/apps/api && pnpm dev
```

**Why:** The knowledge base is cached in memory. Deleting the cache file doesn't clear the in-memory cache. Server restart forces a fresh rebuild from disk.

---

## When to MindSync

| Situation | Level | Updates |
|-----------|-------|---------|
| Bug fix | SOFT | RAM + feedback (+ session index if notable) |
| Small feature | SOFT | RAM + feedback (+ session index if notable) |
| Major feature | HARD | All files + full session log |
| Workflow change | HARD | All files + full session log |
| Architecture change | HARD | All files + full session log + evolution |

---

## Quick Checklist

**SOFT:**
- [ ] RAM updated with timestamps
- [ ] Feedback updated with learnings
- [ ] Session index updated (if significant)

**HARD:**
- [ ] Session log created
- [ ] RAM updated
- [ ] Feedback updated
- [ ] Evolution updated (if major)
- [ ] MAP updated (if structure changed)
- [ ] **Embeddings regenerated** (knowledge base rebuilt)

---

## Related

- [[mind/skills/codesync/CodeSync|CodeSync Skill]] — Commit code changes (separate from MindSync)
- [[mind/INDEX]] — Entry point (mentions MindSync)
- [[mind/memory/RAM]] — Working memory
- [[symbiosis/feedback]] — Learnings

---

*MindSync: Update the mind. Every change. No exceptions. (After CodeSync completes)*
