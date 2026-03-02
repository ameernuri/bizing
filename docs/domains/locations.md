---
tags:
  - bizing
  - domain
  - generated
  - locations
---

# Locations Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/locations.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/locations.ts`

## Route Intent (top JSDoc)

Location routes (biz-scoped).

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/public/bizes/:bizId/locations`
- `GET` `/bizes/:bizId/locations`
- `POST` `/bizes/:bizId/locations`
- `GET` `/bizes/:bizId/locations/:locationId`
- `PATCH` `/bizes/:bizId/locations/:locationId`
- `DELETE` `/bizes/:bizId/locations/:locationId`

## Tables

- `locations`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
