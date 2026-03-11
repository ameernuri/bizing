---
tags:
  - bizing
  - domain
  - generated
  - coverage-lanes
---

# Coverage Lanes Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/coverage-lanes.ts`
- Schema file: `packages/db/src/schema/coverage_lanes.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

_No top JSDoc comment found._

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/coverage-lanes`
- `GET` `/api/v1/bizes/:bizId/coverage-lane-alerts`
- `POST` `/api/v1/bizes/:bizId/coverage-lanes/evaluate-alerts`
- `POST` `/api/v1/bizes/:bizId/coverage-lanes`
- `GET` `/api/v1/bizes/:bizId/coverage-lanes/:laneId`
- `PATCH` `/api/v1/bizes/:bizId/coverage-lanes/:laneId`
- `GET` `/api/v1/bizes/:bizId/coverage-lanes/:laneId/memberships`
- `POST` `/api/v1/bizes/:bizId/coverage-lanes/:laneId/memberships`
- `PATCH` `/api/v1/bizes/:bizId/coverage-lane-memberships/:membershipId`
- `POST` `/api/v1/bizes/:bizId/coverage-lanes/:laneId/on-call-shifts`
- `GET` `/api/v1/bizes/:bizId/coverage-lanes/:laneId/shift-templates`
- `POST` `/api/v1/bizes/:bizId/coverage-lanes/:laneId/shift-templates`
- `PATCH` `/api/v1/bizes/:bizId/coverage-shift-templates/:templateId`
- `POST` `/api/v1/bizes/:bizId/coverage-shift-templates/:templateId/publish`
- `GET` `/api/v1/bizes/:bizId/coverage-lanes/:laneId/coverage`

## Tables

- `coverage_lanes`
- `coverage_lane_memberships`
- `coverage_lane_shift_templates`
- `coverage_lane_alerts`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
