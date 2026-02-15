---
date: 2026-02-13
tags: 
  - skill
  - workflow
  - dotenv
  - environment
---

# Environment Variables with dotenv

> Loading .env files in Node.js applications

---

## The Problem

Node.js doesn't automatically load `.env` files.

**This won't work:**
```bash
# .env
API_KEY=secret123

# server.ts
console.log(process.env.API_KEY) // undefined!
```

---

## The Solution

Use `dotenv` package:

### 1. Install
```bash
pnpm add dotenv
```

### 2. Import at the very top
```typescript
import 'dotenv/config'
// Must be first import!

import { other } from './modules'
```

### 3. Use environment variables
```typescript
const apiKey = process.env.API_KEY
console.log(apiKey) // 'secret123'
```

---

## Important: No Quotes!

**Wrong:**
```bash
API_KEY="secret123"  # Value includes quotes!
```

**Right:**
```bash
API_KEY=secret123    # Clean value
```

dotenv includes quotes as part of the value!

---

## Verification

Test it's working:
```bash
node -e "require('dotenv/config'); console.log(process.env.API_KEY)"
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| `undefined` | Import dotenv/config at top |
| Quotes in value | Remove quotes from .env |
| Server restart needed | dotenv only loads on startup |
| Wrong path | .env must be in project root or specify path |

---

## Related

- [[mind/skills/obsidian/editing-files|Editing Files]]
- [[mind/skills/memory|Memory]]
- [[mind/skills/workflow/index|Workflow Skills]]

