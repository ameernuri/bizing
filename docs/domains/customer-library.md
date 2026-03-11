---
tags:
  - bizing
  - domain
  - generated
  - customer-library
---

# Customer Library Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/customer-library.ts`
- Schema file: `packages/db/src/schema/access_library.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Customer library routes.

ELI5:
Customers do not care which table something came from.
They ask one simple question:
"What do I own, what is still usable, and when does it expire?"

The canonical answer lives in `access_library_items`.
That table is a rebuildable read model:
- source truth still lives in normalized artifact/membership/grant/event rows,
- library items are the fast, portal-friendly snapshot,
- rebuilding it should always produce the same answer from the same source facts.

Why this route matters for the larger platform:
- customer portal pages need a very fast owner-centric query path,
- support/agents need one read contract instead of joining many domains,
- saga/compliance/debug flows need to prove "what the user saw" deterministically.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/me/library`
- `GET` `/api/v1/bizes/:bizId/customer-library/items`
- `POST` `/api/v1/bizes/:bizId/customer-library/rebuild`

## Tables

- `access_library_items`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
