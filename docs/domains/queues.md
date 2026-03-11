---
tags:
  - bizing
  - domain
  - generated
  - queues
---

# Queues Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/queues.ts`
- Schema file: `packages/db/src/schema/queue.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Queue + waitlist routes (biz scoped + public self-join surface).

Why this module exists:
- Queue/waitlist is a first-class fulfillment mode (not a metadata flag).
- Businesses need operational APIs (create/manage queues and entries).
- Customers need public APIs to self-join waitlists without internal member
  access.

Design notes:
- Biz routes are protected by auth + biz membership + ACL permissions.
- Public routes are authenticated customer surfaces (no internal ACL role
  required) and only expose "my queue entries" data.
- Soft-deleted rows are hidden from read paths.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/queues`
- `POST` `/api/v1/bizes/:bizId/queues`
- `GET` `/api/v1/bizes/:bizId/queues/:queueId`
- `GET` `/api/v1/bizes/:bizId/queues/:queueId/display-board`
- `PATCH` `/api/v1/bizes/:bizId/queues/:queueId`
- `DELETE` `/api/v1/bizes/:bizId/queues/:queueId`
- `GET` `/api/v1/bizes/:bizId/queues/:queueId/entries`
- `POST` `/api/v1/bizes/:bizId/queues/:queueId/entries`
- `PATCH` `/api/v1/bizes/:bizId/queues/:queueId/entries/:queueEntryId`
- `POST` `/api/v1/bizes/:bizId/queues/:queueId/entries/:queueEntryId/transfer`
- `POST` `/api/v1/bizes/:bizId/queues/:queueId/entries/:queueEntryId/recall`
- `POST` `/api/v1/bizes/:bizId/queues/:queueId/offer-next`
- `GET` `/api/v1/public/bizes/:bizId/queues`
- `POST` `/api/v1/public/bizes/:bizId/queues/:queueId/entries`
- `GET` `/api/v1/public/bizes/:bizId/queues/:queueId/entries`
- `POST` `/api/v1/public/bizes/:bizId/queues/:queueId/entries/:queueEntryId/respond`

## Tables

- `queues`
- `queue_entries`
- `queue_tickets`
- `queue_events`
- `service_time_observations`
- `wait_time_predictions`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
