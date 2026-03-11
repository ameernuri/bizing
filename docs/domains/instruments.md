---
tags:
  - bizing
  - domain
  - generated
  - instruments
---

# Instruments Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/instruments.ts`
- Schema file: `packages/db/src/schema/instruments.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Instrument API.

ELI5:
"Instrument" is the one reusable system for:
- intake forms,
- waivers,
- checklists,
- surveys,
- quizzes/assessments.

Why this route family exists:
- the schema already unified these concepts into one canonical backbone
- the API still needed a first-class surface so sagas and real UIs can use
  that backbone without inventing ad-hoc tables or one-off endpoints
- this route keeps definition management, binding, runtime execution, and
  submission history in one coherent place

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/instruments`
- `POST` `/api/v1/bizes/:bizId/instruments`
- `GET` `/api/v1/bizes/:bizId/instruments/:instrumentId`
- `PATCH` `/api/v1/bizes/:bizId/instruments/:instrumentId`
- `GET` `/api/v1/bizes/:bizId/instruments/:instrumentId/items`
- `POST` `/api/v1/bizes/:bizId/instruments/:instrumentId/items`
- `GET` `/api/v1/bizes/:bizId/instrument-bindings`
- `POST` `/api/v1/bizes/:bizId/instrument-bindings`
- `GET` `/api/v1/bizes/:bizId/instrument-runs`
- `POST` `/api/v1/bizes/:bizId/instrument-runs`
- `GET` `/api/v1/bizes/:bizId/instrument-runs/:instrumentRunId`
- `GET` `/api/v1/bizes/:bizId/instrument-runs/:instrumentRunId/events`
- `GET` `/api/v1/bizes/:bizId/instrument-runs/:instrumentRunId/responses`
- `POST` `/api/v1/bizes/:bizId/instrument-runs/:instrumentRunId/responses`
- `POST` `/api/v1/bizes/:bizId/instrument-runs/:instrumentRunId/submit`
- `POST` `/api/v1/bizes/:bizId/instrument-runs/:instrumentRunId/evaluate`
- `GET` `/api/v1/public/bizes/:bizId/instrument-runs/:instrumentRunId`
- `POST` `/api/v1/public/bizes/:bizId/instrument-runs/:instrumentRunId/responses`
- `POST` `/api/v1/public/bizes/:bizId/instrument-runs/:instrumentRunId/submit`

## Tables

- `instruments`
- `instrument_items`
- `instrument_bindings`
- `instrument_runs`
- `instrument_responses`
- `instrument_events`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
