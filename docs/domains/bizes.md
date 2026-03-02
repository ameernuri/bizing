---
tags:
  - bizing
  - domain
  - generated
  - bizes
---

# Bizes Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/bizes.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/bizes.ts`

## Route Intent (top JSDoc)

Biz routes.

These endpoints manage tenant roots and enforce that membership is established
immediately when a user creates a new biz.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/`
- `POST` `/`
- `GET` `/:bizId/audit/events`
- `POST` `/:bizId/data-export-requests`
- `GET` `requestId`
- `GET` `/:bizId`
- `PATCH` `/:bizId`
- `DELETE` `/:bizId`

## Tables

- `bizes`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
