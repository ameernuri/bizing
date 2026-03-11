---
tags:
  - bizing
  - domain
  - generated
  - queue-counters
---

# Queue Counters Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/queue-counters.ts`
- Schema file: `packages/db/src/schema/queue_operations.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Queue counter / dispatch-board routes.

ELI5:
A queue says "people are waiting".
A counter says "this is the place/person serving them".
An assignment says "who is staffing that counter right now".

Why this route exists:
- queue tickets alone do not answer "which window is open?",
- front-desk and clinic flows need first-class counter APIs,
- sagas should validate counter operations through HTTP.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/queue-counters`
- `POST` `/api/v1/bizes/:bizId/queue-counters`
- `PATCH` `/api/v1/bizes/:bizId/queue-counters/:queueCounterId`
- `GET` `/api/v1/bizes/:bizId/queue-counter-assignments`
- `POST` `/api/v1/bizes/:bizId/queue-counter-assignments`
- `PATCH` `/api/v1/bizes/:bizId/queue-counter-assignments/:assignmentId`
- `GET` `/api/v1/bizes/:bizId/queue-ticket-calls`
- `POST` `/api/v1/bizes/:bizId/queue-ticket-calls`
- `PATCH` `/api/v1/bizes/:bizId/queue-ticket-calls/:callId`
- `GET` `/api/v1/bizes/:bizId/queue-counter-analytics`

## Tables

- `queue_counters`
- `queue_counter_assignments`
- `queue_ticket_calls`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
