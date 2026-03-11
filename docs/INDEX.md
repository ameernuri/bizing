---
tags:
  - bizing
  - docs
  - code
  - source-of-truth
---

# Bizing Code Docs Index

This folder is the canonical engineering documentation hub for the Bizing codebase.

Use this as the first stop before changing API, schema, saga infrastructure, auth, or integrations.

## Canonical Docs

- [[API]]: API architecture, route surfaces, auth model, and agent-facing execution paths.
- [[SCHEMA_BIBLE]]: DB schema map and where to find canonical schema definitions.
- [[UX_PRINCIPLES]]: canonical UI/copy direction for customer and biz-owner surfaces.
- [[SKILLS]]: where skills live and how to apply them in engineering workflows.
- [[DOC_SYNC]]: Required workflow for keeping code docs + mind memory in sync after each code change.
- [[CHANGE_NOTES]]: Concise engineering notes log tied to meaningful changes.
- `docs/domains/*.md`: generated per-domain route/schema maps from source code.
- App-local product architecture can live beside the app when it is
  implementation-specific and not a global platform contract
  (for example `apps/canvascii/ARCHITECTURE.md`).

## Source Files (Code)

- API routes: `/Users/ameer/bizing/code/apps/api/src/routes`
- API services: `/Users/ameer/bizing/code/apps/api/src/services`
- DB schema: `/Users/ameer/bizing/code/packages/db/src/schema`
- Saga specs/workspace: `/Users/ameer/bizing/code/testing/sagas`
- Codex history import utility: `/Users/ameer/bizing/code/scripts/import-codex-history.mjs`

## Source Files (Mind)

- Mind entry: `/Users/ameer/bizing/mind/INDEX.md`
- Working memory: `/Users/ameer/bizing/mind/memory/RAM.md`
- Durable memory: `/Users/ameer/bizing/mind/MEMORY.md`
- Codex project history snapshot: `/Users/ameer/bizing/mind/memory/codex-project-history.md`
- Body bridge: `/Users/ameer/bizing/mind/workspace/body/INDEX.md`

## Mind Links

- [Mind INDEX](/Users/ameer/bizing/mind/INDEX.md)
- [Mind RAM](/Users/ameer/bizing/mind/memory/RAM.md)
- [Mind MEMORY](/Users/ameer/bizing/mind/MEMORY.md)
- [Mind Body Bridge](/Users/ameer/bizing/mind/workspace/body/INDEX.md)

## Operating Rule

Any code change that affects behavior must be reflected in docs.

Minimum required updates per meaningful change:
1. Update one canonical code doc in this folder.
2. Add one concise item to [[CHANGE_NOTES]].
3. Update mind context (`RAM` and/or today's memory file) with what changed and why.
4. Re-generate domain docs if route/schema behavior changed:
   - `bun run docs:generate:domains`

If docs are not updated, the change is incomplete.
