---
tags:
  - bizing
  - domain
  - generated
  - ooda
---

# Ooda Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/ooda.ts`
- Schema file: `packages/db/src/schema/ooda.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

_No top JSDoc comment found._

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/ooda/asciip/files`
- `GET` `/api/v1/ooda/asciip/file`
- `POST` `/api/v1/ooda/asciip/file`
- `PUT` `/api/v1/ooda/asciip/file`
- `PATCH` `/api/v1/ooda/asciip/file`
- `DELETE` `/api/v1/ooda/asciip/file`
- `GET` `/api/v1/ooda/overview`
- `GET` `/api/v1/ooda/loops`
- `POST` `/api/v1/ooda/loops`
- `GET` `/api/v1/ooda/loops/:loopId`
- `GET` `/api/v1/ooda/loops/:loopId/blockers`
- `PATCH` `/api/v1/ooda/loops/:loopId`
- `DELETE` `/api/v1/ooda/loops/:loopId`
- `GET` `/api/v1/ooda/loops/:loopId/links`
- `POST` `/api/v1/ooda/loops/:loopId/links`
- `DELETE` `/api/v1/ooda/loops/:loopId/links/:linkId`
- `GET` `/api/v1/ooda/loops/:loopId/entries`
- `POST` `/api/v1/ooda/loops/:loopId/entries`
- `PATCH` `/api/v1/ooda/loops/:loopId/entries/:entryId`
- `GET` `/api/v1/ooda/loops/:loopId/actions`
- `POST` `/api/v1/ooda/loops/:loopId/actions`
- `PATCH` `/api/v1/ooda/loops/:loopId/actions/:actionId`
- `POST` `/api/v1/ooda/loops/:loopId/saga-runs`
- `POST` `/api/v1/ooda/generate/draft`

## Tables

- `ooda_loops`
- `ooda_loop_links`
- `ooda_loop_entries`
- `ooda_loop_actions`
- `ooda_asciip_documents`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
