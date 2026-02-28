---
tags:
  - bizing
  - docs
  - workflow
  - sync
---

# Documentation Sync Protocol

This is the canonical process for keeping code docs and mind memory aligned.

## Why

Bizing treats `code` as the body and `mind` as the memory/strategy layer.
Both must stay aligned or agent behavior drifts.

## Required After Every Meaningful Code Change

1. Code comments/JSDoc
- Update comments in changed files when behavior is non-obvious.

2. Code docs
- Update at least one canonical file in `/Users/ameer/bizing/code/docs`:
  - `API.md` for endpoint/contract changes
  - `SCHEMA_BIBLE.md` for data model changes
  - `INDEX.md` when doc map changes

3. Change log note
- Append one concise entry to `docs/CHANGE_NOTES.md`:
  - date
  - what changed
  - why
  - where (file paths)

4. Mind update
- Update `/Users/ameer/bizing/mind/memory/RAM.md` for active impact.
- Add/update `/Users/ameer/bizing/mind/memory/YYYY-MM-DD.md` for durable session trace.
- Update `/Users/ameer/bizing/mind/MEMORY.md` only for durable, long-lived decisions.
- Run `bun run docs:sync:mind` to mirror canonical docs into the mind vault.

## Definition of Done

A change is done only when both are true:
- behavior is implemented in code
- behavior is explained in docs + mind

Also required:
- relevant skills were applied when available
- bridge notes remain navigable in `mind/workspace/body/*`

## Fast Checklist

- [ ] Implementation complete
- [ ] Tests/typecheck run (if applicable)
- [ ] `docs/API.md` or `docs/SCHEMA_BIBLE.md` updated
- [ ] `docs/CHANGE_NOTES.md` entry added
- [ ] mind `RAM`/daily memory updated
