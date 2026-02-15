---
date: 2026-02-15
tags:
  - skill
  - talking-to-bizing
  - bizing-ai
  - query
  - workflow
---

# 🎤 Talking to Bizing AI

> How to interact with Bizing AI using local tools

---

## The Script

**Location:** `scripts/query-bizing.mjs`

```bash
cd ~/projects/bizing
node scripts/query-bizing.mjs "Your question here"
node scripts/query-bizing.mjs "Question" --functions  # Enable function calling
node scripts/query-bizing.mjs "Question" --openai   # Use OpenAI instead of Ollama
```

---

## Usage

### Basic Query
```bash
node scripts/query-bizing.mjs "What is the Session Workflow?"
```

### With Function Calling
```bash
node scripts/query-bizing.mjs "Create a new feature" --functions
```

### Using OpenAI
```bash
node scripts/query-bizing.mjs "Analyze this architecture" --openai
```

---

## Requirements

### Bizing Must Be Running

The API must be running on port 6129:

```bash
cd ~/projects/bizing/apps/api
pnpm dev  # Start the server
```

**Check if running:**
```bash
curl http://localhost:6129/api/v1/bizing/health 2>/dev/null || echo "Not running"
```

---

## When to Talk to Bizing

**DO ask Bizing about:**
- Architecture decisions
- Domain knowledge
- Recent changes
- Code patterns
- Feature history

**DON'T ask Bizing about:**
- Current context (read RAM instead)
- Files on disk (use file tools)
- General knowledge

---

## Best Practices

### 1. Be Specific
```
Good: "What does the 6.9% commission model include?"
Bad: "Tell me about pricing"
```

### 2. Reference Context
```
Good: "Looking at the RAM, what's the active focus?"
Bad: "What are we working on?"
```

### 3. Ask for Actions
```
Good: "Create a session log for our conversation"
Bad: "I need something for later"
```

---

## Bizing's Knowledge

Bizing knows:
- Everything in `mind/` directory
- Domain knowledge (`knowledge/`)
- Technical architecture (`knowledge/tech/`)
- Session history (`memory/sessions/`)
- Decisions made (`symbiosis/decisions/`)

Bizing does NOT know:
- What's currently in RAM (read it yourself)
- Recent git commits (use git)
- External knowledge (use web search)

---

## Related Skills

- [[workflow/SessionWorkflow]] — Session workflow
- [[ram/Ram]] — Working memory (read this first)
- [[mindsync/Mindsync]] — Mind updates
- [[creating-files/CreatingFiles]] — File creation

---

*Talk to Bizing when you need context, not for current state.*
