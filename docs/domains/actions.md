---
tags:
  - bizing
  - domain
  - generated
  - actions
---

# Actions Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/actions.ts`
- Schema file: `packages/db/src/schema/action_backbone.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Canonical actions + projections routes.

ELI5:
These routes are the beginning of the "real API backbone" for the redesign.

Instead of only exposing direct table-shaped endpoints, they expose:
- actions: "what are you trying to do?"
- projections: "what does the platform currently want humans/agents to read?"
- debug snapshots: "what did the platform see when something mattered?"

This keeps the API closer to the schema philosophy:
action -> execution -> failure/debug -> projection

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/actions`
- `GET` `/api/v1/bizes/:bizId/actions/:actionRequestId`
- `POST` `/api/v1/bizes/:bizId/actions/preview`
- `POST` `/api/v1/bizes/:bizId/actions/execute`
- `POST` `/api/v1/public/bizes/:bizId/actions/preview`
- `POST` `/api/v1/public/bizes/:bizId/actions/execute`
- `GET` `/api/v1/bizes/:bizId/projections`
- `GET` `/api/v1/bizes/:bizId/projections/:projectionId/documents`
- `GET` `/api/v1/bizes/:bizId/projection-documents/:documentId`
- `GET` `/api/v1/bizes/:bizId/debug-snapshots`
- `GET` `/api/v1/bizes/:bizId/events`
- `GET` `/api/v1/bizes/:bizId/events/:domainEventId`

## Tables

- `action_requests`
- `action_idempotency_keys`
- `action_executions`
- `action_related_entities`
- `action_failures`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
