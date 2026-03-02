---
tags:
  - bizing
  - domain
  - generated
  - instruments
---

# Instruments Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/instruments.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/instruments.ts`

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

- `GET` `/bizes/:bizId/instruments`
- `POST` `/bizes/:bizId/instruments`
- `GET` `/bizes/:bizId/instruments/:instrumentId`
- `PATCH` `/bizes/:bizId/instruments/:instrumentId`
- `GET` `/bizes/:bizId/instruments/:instrumentId/items`
- `POST` `/bizes/:bizId/instruments/:instrumentId/items`
- `GET` `/bizes/:bizId/instrument-bindings`
- `POST` `/bizes/:bizId/instrument-bindings`
- `GET` `/bizes/:bizId/instrument-runs`
- `POST` `/bizes/:bizId/instrument-runs`
- `GET` `user`
- `GET` `user`
- `GET` `/bizes/:bizId/instrument-runs/:instrumentRunId`
- `GET` `/bizes/:bizId/instrument-runs/:instrumentRunId/events`
- `GET` `/bizes/:bizId/instrument-runs/:instrumentRunId/responses`
- `POST` `/bizes/:bizId/instrument-runs/:instrumentRunId/responses`
- `GET` `user`
- `POST` `/bizes/:bizId/instrument-runs/:instrumentRunId/submit`
- `GET` `user`
- `POST` `/bizes/:bizId/instrument-runs/:instrumentRunId/evaluate`
- `GET` `user`
- `GET` `/public/bizes/:bizId/instrument-runs/:instrumentRunId`
- `GET` `user`
- `POST` `/public/bizes/:bizId/instrument-runs/:instrumentRunId/responses`
- `GET` `user`
- `POST` `/public/bizes/:bizId/instrument-runs/:instrumentRunId/submit`
- `GET` `user`

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
