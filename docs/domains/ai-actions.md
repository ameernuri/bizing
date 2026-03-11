---
tags:
  - bizing
  - domain
  - generated
  - ai-actions
---

# Ai Actions Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/ai-actions.ts`
- Schema file: `packages/db/src/schema/action_backbone.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

_No top JSDoc comment found._

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `POST` `/api/v1/bizes/:bizId/ai-actions/recommend`
- `POST` `/api/v1/bizes/:bizId/ai-actions/execute`

## Tables

- `action_requests`
- `action_idempotency_keys`
- `action_executions`
- `action_related_entities`
- `action_failures`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
