---
tags:
  - bizing
  - domain
  - generated
  - work-items
---

# Work Items Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/work-items.ts`
- Schema file: `packages/db/src/schema/work_items.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Unified work-item routes.

ELI5:
This is the cross-surface operational inbox for humans and agents.
Source domains stay canonical; these routes expose one prioritized queue.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/work-items`
- `GET` `/api/v1/bizes/:bizId/work-items/:workItemId`
- `POST` `/api/v1/bizes/:bizId/work-items`
- `PATCH` `/api/v1/bizes/:bizId/work-items/:workItemId`
- `POST` `/api/v1/bizes/:bizId/work-items/sync`
- `GET` `/api/v1/bizes/:bizId/work-items/continuity/feed`

## Tables

- `work_items`
- `work_item_events`
- `work_item_links`
- `work_commands`
- `work_command_runs`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
