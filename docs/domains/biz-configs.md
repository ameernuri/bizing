---
tags:
  - bizing
  - domain
  - generated
  - biz-configs
---

# Biz Configs Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/biz-configs.ts`
- Schema file: `packages/db/src/schema/biz_configs.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Biz-config routes.

ELI5:
These routes let a biz define its own reusable dictionaries instead of
hardcoding every status or checklist value in the database forever.

Think of them as "boxes of options":
- one box for offer statuses
- one box for queue-entry statuses
- one box for checklist item types

Why this matters:
- different businesses want different words
- one location may want a slightly different vocabulary than another
- workflows still need stable internal codes, so values can also map to a
  `systemCode`

This is intentionally generic so the same backbone can power:
- statuses
- labels
- enum-like choices
- future plugin-defined dictionaries

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/config-sets`
- `POST` `/api/v1/bizes/:bizId/config-sets`
- `PATCH` `/api/v1/bizes/:bizId/config-sets/:setId`
- `GET` `/api/v1/bizes/:bizId/config-sets/:setId/values`
- `GET` `/api/v1/bizes/:bizId/config-values/:valueId/localizations`
- `POST` `/api/v1/bizes/:bizId/config-values/:valueId/localizations`
- `POST` `/api/v1/bizes/:bizId/config-sets/:setId/values`
- `PATCH` `/api/v1/bizes/:bizId/config-values/:valueId`
- `POST` `/api/v1/bizes/:bizId/config-values/:valueId/retire`
- `GET` `/api/v1/bizes/:bizId/config-bindings`
- `GET` `/api/v1/bizes/:bizId/config-bindings/resolve`
- `POST` `/api/v1/bizes/:bizId/config-bindings`
- `PATCH` `/api/v1/bizes/:bizId/config-bindings/:bindingId`
- `POST` `/api/v1/bizes/:bizId/config-packs/seed`
- `GET` `/api/v1/bizes/:bizId/config-packs`
- `POST` `/api/v1/bizes/:bizId/config-packs/:packKey/revert`
- `POST` `/api/v1/bizes/:bizId/config-packs/preview`
- `POST` `/api/v1/bizes/:bizId/config-packs/apply`

## Tables

- `biz_config_sets`
- `biz_config_values`
- `biz_config_value_localizations`
- `biz_config_bindings`
- `biz_config_promotion_runs`
- `biz_config_promotion_run_items`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
