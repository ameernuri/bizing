---
tags:
  - bizing
  - domain
  - generated
  - reporting
---

# Reporting Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/reporting.ts`
- Schema file: `packages/db/src/schema/reporting.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Projection checkpoint routes.

ELI5:
A projection checkpoint is the platform's bookmark for a read model.
It answers:
- what projection are we talking about?
- what scope does it belong to?
- how healthy is it?
- how far behind is it?
- what event cursor did it last apply?

These routes expose that control-plane directly so sagas and operators can
prove replay/recovery behavior through the API instead of inferring it from
hidden worker state.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/projection-checkpoints`
- `POST` `/api/v1/bizes/:bizId/projection-checkpoints`
- `GET` `/api/v1/bizes/:bizId/reporting/coverage-lanes/summary`
- `POST` `/api/v1/bizes/:bizId/projection-checkpoints/:checkpointId/replay`

## Tables

- `fact_refresh_runs`
- `fact_revenue_daily`
- `fact_revenue_monthly`
- `fact_sellable_daily`
- `fact_resource_utilization_daily`
- `projection_checkpoints`
- `fact_operational_daily`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
