---
tags:
  - bizing
  - domain
  - generated
  - bizes
---

# Bizes Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/bizes.ts`
- Schema file: `packages/db/src/schema/bizes.ts`
- Mount path: `/bizes`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Biz routes.

These endpoints manage tenant roots and enforce that membership is established
immediately when a user creates a new biz.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes`
- `POST` `/api/v1/bizes`
- `GET` `/api/v1/bizes/public`
- `GET` `/api/v1/bizes/:bizId/audit/events`
- `POST` `/api/v1/bizes/:bizId/data-export-requests`
- `POST` `/api/v1/bizes/:bizId/onboarding/welcome-email`
- `GET` `/api/v1/bizes/:bizId`
- `PATCH` `/api/v1/bizes/:bizId`
- `DELETE` `/api/v1/bizes/:bizId`

## Tables

- `bizes`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
