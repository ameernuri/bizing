---
tags:
  - bizing
  - domain
  - generated
  - leave
---

# Leave Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/leave.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/leave.ts`

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

- `GET` `/bizes/:bizId/leave-policies`
- `POST` `/bizes/:bizId/leave-policies`
- `GET` `/bizes/:bizId/leave-balances`
- `POST` `/bizes/:bizId/leave-balances`
- `GET` `/bizes/:bizId/leave-requests`
- `POST` `/bizes/:bizId/leave-requests`
- `PATCH` `/bizes/:bizId/leave-requests/:leaveRequestId`
- `GET` `/bizes/:bizId/leave-events`
- `POST` `/bizes/:bizId/leave-events`

## Tables

- `leave_policies`
- `leave_balances`
- `leave_requests`
- `leave_events`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
