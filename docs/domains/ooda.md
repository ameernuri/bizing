---
tags:
  - bizing
  - domain
  - generated
  - ooda
---

# Ooda Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/ooda.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/ooda.ts`

## Route Intent (top JSDoc)

_No top JSDoc comment found._

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/ooda/overview`
- `GET` `/ooda/loops`
- `POST` `/ooda/loops`
- `GET` `/ooda/loops/:loopId`
- `PATCH` `/ooda/loops/:loopId`
- `DELETE` `/ooda/loops/:loopId`
- `GET` `/ooda/loops/:loopId/links`
- `POST` `/ooda/loops/:loopId/links`
- `DELETE` `/ooda/loops/:loopId/links/:linkId`
- `GET` `/ooda/loops/:loopId/entries`
- `POST` `/ooda/loops/:loopId/entries`
- `PATCH` `/ooda/loops/:loopId/entries/:entryId`
- `GET` `/ooda/loops/:loopId/actions`
- `POST` `/ooda/loops/:loopId/actions`
- `PATCH` `/ooda/loops/:loopId/actions/:actionId`
- `POST` `/ooda/loops/:loopId/saga-runs`
- `POST` `/ooda/generate/draft`

## Tables

- `ooda_loops`
- `ooda_loop_links`
- `ooda_loop_entries`
- `ooda_loop_actions`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
