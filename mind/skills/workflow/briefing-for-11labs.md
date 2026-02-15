---
date: 2026-02-11
tags: 
  - skill
  - workflow
  - 11labs
  - tts
  - briefing
---

# 🎓 Creating Brief.txt for 11labs Reader

> How to create audio briefs for Ameer's phone

---

## When to Create

**Every session end:**
- Summarize what was done
- Note blockers
- List next steps
- Keep it brief (under 2 min reading)

---

## Format Template

```markdown
# 📋 Brief.txt

## Bizing Status — [DATE]

---

### 🎯 Current Focus

**Primary:** [Main goal]
- [Detail]
- [Detail]

**Secondary:** [Secondary goal]

---

### 🐛 Blocker

[Any blockers]

---

### ✅ Recent Progress

- [What was completed]
- [What was fixed]
- [What was added]

---

### 📅 Next Steps

1. [Next action]
2. [Next action]
3. [Next action]

---

*Brief generated [DATE]*
```

---

## Content Guidelines

### What to Include

- Current status of Bizing
- Blocker (if any)
- What was accomplished
- What's next

### What to Exclude

- Too much technical detail
- Long code snippets
- Meeting notes
- Full session logs

### Tone

- Brief and actionable
- Clear priorities
- Forward-looking

---

## Example Brief

```
# 📋 Brief.txt

## Bizing Status — 2026-02-11

Kimi API is still not working. The API key is invalid. We set up dotenv
correctly and fixed the quotes issue in the .env file. Need to generate
a fresh key from the Kimi portal.

We created MIND entry point with Obsidian features. Kanban boards are
working now. Templates are ready for session logging and decisions.

Next: Generate fresh Kimi API key
  - update .env
  - restart server
  - test chat.
```

---

## File Location

**Place in:** `mind/brief.txt`

**For 11labs:**
- 11labs Reader reads this file
- Ameer listens on phone
- Brief and scannable format

---

## Before Sending

1. Check spelling
2. Keep under 2 min read time
3. Focus on priorities
4. Include clear next steps

---

## Related

- [[mind/skills/memory|Memory]] — Session logging
- [[mind/skills/workflow/index|Workflow Skills]]
