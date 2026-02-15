---
date: 2026-02-11
tags: 
  - session
  - log
  - mindsync
  - hard-mindsync
  - admin
  - dashboard
---

# 📝 Session: Admin Dashboard Fixes — React Keys
  - Markdown
  - Scroll Areas

> *HARD MINDSYNC: Fixed multiple UI issues in admin dashboard*

## Issues Fixed

### 1. Duplicate React Key Error
**Problem:** `Encountered two children with the same key
  - learning-2026-02-11`

**Root Cause:** The mind activity API generated the same ID for multiple learnings on the same date.

**Fix:** Made learning IDs unique by adding index suffix:
```typescript
// Before
id: `learning-${match[1]}`

// After  
id: `learning-${match[1]}-${index}`
```

### 2. Chat Window Layout
**Problem:** Chat didn't scroll properly
  - input wasn't fixed at bottom.

**Fix:** 
- Used `h-[calc(100vh-4rem)]` for full height
- Set `overflow-hidden` on Card with `flex-col`
- Made messages scrollable with `ScrollArea`
- Fixed input at bottom with `shrink-0` and `p-4 border-t`

### 3. Markdown Rendering
**Problem:** Chat responses showed raw markdown.

**Fix:** Added `react-markdown` and wrapped Bizing messages:
```tsx
<ReactMarkdown>{message.content}</ReactMarkdown>
```

### 4. Activity Card Overflow
**Problem:** Cards overflowed and content was hidden.

**Fix:**
- Added `overflow-hidden` to Card containers
- Used `line-clamp-3` for descriptions
- Set `min-w-0` to prevent flex overflow
- Applied `truncate` to titles

## Files Changed

### Code
- `apps/api/src/server.ts` — Fixed duplicate learning IDs
- `apps/admin/src/app/bizing/page.tsx` — Complete rewrite with:
  - `react-markdown` for chat
  - Proper scroll areas
  - Fixed input at bottom
  - Better card layouts

### Dependencies
- `apps/admin/package.json` — Added `react-markdown@10.1.0`

### Mind
- `mind/symbiosis/feedback.md` — Added new learnings

## Learnings

1. **React keys must be unique** — Multiple children with same key = warning
  - potential duplication
2. **Layout requires `overflow-hidden`** — Containers need this to control scrolling
3. **`shrink-0` prevents input squishing** — Fixed height elements need this
4. **`min-w-0` fixes flex overflow** — Default flex min-width breaks truncation
5. **`line-clamp` limits text lines** — Cleaner than manual truncation

---

*Admin dashboard now has proper chat UX with markdown and scrollable activity.*
