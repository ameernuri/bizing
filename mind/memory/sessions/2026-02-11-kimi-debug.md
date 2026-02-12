## 2026-02-11 — Debugging Kimi API Integration

**Topics:**
- Integrating Kimi API for Bizing AI chat
- Debugging "Invalid Authentication" errors
- Setting up dotenv for environment variables

**What We Did:**

1. **Added LLM Service** (`apps/api/src/services/llm.ts`)
   - Kimi API integration with fetch
   - Base URL: `api.moonshot.ai` (matching OpenClaw)
   - System prompt with full Bizing context

2. **Added dotenv** (`apps/api/src/server.ts`)
   - Installed `dotenv` package
   - Added `import 'dotenv/config'`
   - Required for loading .env in Node.js

3. **Debugged API Key Issues**
   - Found quotes in .env: `"key"` vs `key`
   - Fixed by removing quotes
   - Still getting "Invalid Authentication"
   - Key appears valid but API rejects it

**Lessons Learned:**

- Node.js doesn't auto-load .env files — need dotenv
- dotenv treats quotes as part of the value
- API keys can be rejected for various reasons:
  - Wrong portal (subscription vs metered)
  - Expired key
  - Different endpoint requirements
  - Key not activated

**Current Status:**
- Code structure complete
- dotenv working
- API key loading
- **Blocked:** Key authentication failing

**Next Steps:**
1. Generate fresh API key from Kimi portal
2. Delete old keys
3. Test with new key
4. Verify Bizing AI responds

**Files Changed:**
- `apps/api/src/services/llm.ts` — LLM integration
- `apps/api/src/server.ts` — dotenv import, chat endpoint
- `apps/api/package.json` — dotenv dependency
- `apps/api/.env` — API key configuration

---

*Session: 2026-02-11*
