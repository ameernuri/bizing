---
tags:
  - bizing
  - domain
  - generated
  - analytics
---

# Analytics Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/analytics.ts`
- Schema file: `packages/db/src/schema/intelligence.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Analytics report routes.

ELI5:
Owners want more than one hard-coded dashboard tile.
They want saved report definitions, rendered report results, and export jobs.

We build this on top of the canonical projection backbone:
- a projection row is the report definition,
- a projection document row is one rendered/exportable result.

This keeps analytics flexible without creating a separate reporting schema
for every dashboard idea.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/analytics/reports`
- `POST` `/api/v1/bizes/:bizId/analytics/reports`
- `POST` `/api/v1/bizes/:bizId/analytics/reports/:projectionId/render`
- `POST` `/api/v1/bizes/:bizId/analytics/exports`

## Tables

- `ranking_profiles`
- `ranking_scores`
- `ranking_events`
- `overtime_policies`
- `overtime_forecasts`
- `staffing_pools`
- `staffing_pool_members`
- `staffing_demands`
- `staffing_demand_requirements`
- `staffing_demand_selectors`
- `staffing_responses`
- `staffing_assignments`
- `staffing_fairness_counters`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
