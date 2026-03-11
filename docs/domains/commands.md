---
tags:
  - bizing
  - domain
  - generated
  - commands
---

# Commands Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/commands.ts`
- Schema file: `packages/db/src/schema/work_items.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

_No top JSDoc comment found._

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/commands`
- `POST` `/api/v1/bizes/:bizId/commands/seed-builtins`
- `POST` `/api/v1/bizes/:bizId/commands`
- `PATCH` `/api/v1/bizes/:bizId/commands/:workCommandId`
- `POST` `/api/v1/bizes/:bizId/commands/execute`
- `GET` `/api/v1/bizes/:bizId/commands/runs`
- `GET` `/api/v1/bizes/:bizId/commands/runs/:runId`

## Tables

- `work_items`
- `work_item_events`
- `work_item_links`
- `work_commands`
- `work_command_runs`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
