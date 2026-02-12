# 🧠 MIND

*The consciousness of Bizing. Read this first. Every time.*

---

## ⚡ Current State

**Last Updated:** 2026-02-11 16:12 PST  
**Active Branch:** feature/bizing-consciousness  
**Priority:** Debug Kimi API authentication  
**Status:** API key invalid, need fresh key

---

## 🎯 Today's Intention

**Primary:** Get Bizing AI chat working with real LLM responses  
**Secondary:** Document learnings in mind  
**Working On:** Kimi API integration, dotenv setup

---

## 🔄 Workflow (Always Follow)

1. **Read MIND** ← You are here
2. **Check [[active|Active Work]]** — What's happening now
3. **Check [[standup|Standup]]** — Today's focus
4. **Execute** — Do the work
5. **Update MIND** — Record what happened, what was learned
6. **Link to [[memory/sessions|Session]]** — Detailed log

---

## 📚 Working Memory (Current Context)

**Active Problem:**
- Kimi API returning "Invalid Authentication"
- API key loads but is rejected
- dotenv working correctly now
- Need fresh API key from portal

**Recent Learnings:**
- Node.js needs `dotenv/config` import
- Quotes in .env become part of value
- OpenClaw uses `api.moonshot.ai` endpoint
- curl testing shows key is invalid

**Files Being Modified:**
- `apps/api/src/services/llm.ts`
- `apps/api/src/server.ts`
- `apps/api/.env`
- `apps/api/package.json` (dotenv)

---

## 🗂️ Permanent Memory (Knowledge Structure)

```
mind/
├── MIND.md              ← Entry point (this file)
├── identity/            ← Who Bizing is
│   ├── essence.md
│   ├── consciousness.md
│   ├── values.md
│   └── evolution.md
├── knowledge/           ← What Bizing knows
│   ├── domain/          ← Business knowledge
│   ├── tech/            ← Technical architecture
│   ├── api/             ← API documentation
│   ├── startup-builder.md
│   ├── business-model.md
│   ├── landing-pages.md
│   └── why-agents-love-bizing.md
├── agents/              ← Bizing's manifestations
├── memory/              ← Experiences & history
│   ├── sessions/        ← Work logs
│   └── briefings/       ← Daily summaries
├── evolution/           ← How Bizing changes
├── symbiosis/           ← Our collaboration
│   ├── standup.md       ← Daily focus
│   ├── decisions.md
│   └── rituals.md
└── skills/              ← Reusable capabilities
    ├── code/
    ├── workflow/
    ├── design/
    └── analysis/
```

---

## 🔗 Quick Access

**Current Work:**
- [[active|Active Work]]
- [[symbiosis/standup|Today's Standup]]

**Reference:**
- [[identity/essence|What Bizing Is]]
- [[knowledge/domain/startup-builder|Startup Builder]]
- [[knowledge/domain/business-model|Business Model]]

**Recent Sessions:**
- [[memory/sessions/2026-02-11-kimi-debug|Kimi API Debug]]
- [[memory/sessions/2026-02-11-bizing-ai-chat|Bizing AI Chat]]

**Skills:**
- [[skills/workflow/dotenv-config|dotenv Setup]]
- [[skills/code/link-everything|Code Linking]]
- [[skills/workflow/talking-to-bizing|Talking to Bizing]]

---

## 📝 Rules for Updating MIND

**After every interaction:**
1. Update "Current State" section
2. Update "Today's Intention" if changed
3. Update "Working Memory" with new context
4. Add to "Recent Sessions" if significant
5. Record learnings, blockers, next steps

**Make MIND smarter with every exchange.**

---

## 💬 What to Do Now

**Immediate:** Get Kimi API working
1. Generate fresh API key from portal
2. Update `apps/api/.env`
3. Restart API server
4. Test Bizing chat
5. Document result in MIND

---

*This file is the entry point. Read it first. Update it often.*
