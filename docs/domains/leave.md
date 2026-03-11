---
tags:
  - bizing
  - domain
  - generated
  - leave
---

# Leave Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/leave.ts`
- Schema file: `packages/db/src/schema/leave.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Leave / PTO routes.

ELI5:
Timekeeping alone is not enough. Workforce systems also need to answer:
- how much leave does this worker have?
- what policy gives them that leave?
- what requests were approved or denied?
- what balance events changed the number?

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/leave-policies`
- `POST` `/api/v1/bizes/:bizId/leave-policies`
- `GET` `/api/v1/bizes/:bizId/leave-balances`
- `POST` `/api/v1/bizes/:bizId/leave-balances`
- `GET` `/api/v1/bizes/:bizId/leave-requests`
- `POST` `/api/v1/bizes/:bizId/leave-requests`
- `PATCH` `/api/v1/bizes/:bizId/leave-requests/:leaveRequestId`
- `GET` `/api/v1/bizes/:bizId/leave-events`
- `POST` `/api/v1/bizes/:bizId/leave-events`

## Tables

- `leave_policies`
- `leave_balances`
- `leave_requests`
- `leave_events`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
