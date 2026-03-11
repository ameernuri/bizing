---
tags:
  - bizing
  - domain
  - generated
  - session-interactions
---

# Session Interactions Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/session-interactions.ts`
- Schema file: `packages/db/src/schema/session_interactions.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Session interaction routes.

ELI5:
This is the API for things people do during a live or virtual session:
- join,
- chat,
- ask a question,
- answer a poll,
- watch replay.

Why this route exists:
- engagement should be a first-class fact, not hidden provider metadata,
- virtual-event sagas need deterministic HTTP proofs,
- follow-up analytics need one canonical event stream.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/session-interactions`
- `POST` `/api/v1/bizes/:bizId/session-interactions`
- `GET` `/api/v1/bizes/:bizId/session-interaction-aggregates`
- `GET` `/api/v1/bizes/:bizId/session-engagement-overview`
- `GET` `/api/v1/bizes/:bizId/session-interaction-artifacts`
- `POST` `/api/v1/bizes/:bizId/session-interaction-artifacts`
- `POST` `/api/v1/bizes/:bizId/session-interaction-aggregates`

## Tables

- `session_interaction_events`
- `session_interaction_aggregates`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
