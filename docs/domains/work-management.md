---
tags:
  - bizing
  - domain
  - generated
  - work-management
---

# Work Management Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/work-management.ts`
- Schema file: `packages/db/src/schema/work_management.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Work management routes.

ELI5:
Some work is not "a customer booking".
It is a report, checklist, inspection, timesheet, or site log.

These routes expose that operational backbone directly so field/construction/
staffing sagas can prove real work capture without inventing side tables.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/work-templates`
- `POST` `/api/v1/bizes/:bizId/work-templates`
- `GET` `/api/v1/bizes/:bizId/work-runs`
- `POST` `/api/v1/bizes/:bizId/work-runs`
- `GET` `/api/v1/bizes/:bizId/work-runs/:workRunId`
- `POST` `/api/v1/bizes/:bizId/work-entries`
- `POST` `/api/v1/bizes/:bizId/work-artifacts`
- `POST` `/api/v1/bizes/:bizId/work-time-segments`
- `GET` `/api/v1/bizes/:bizId/work-time-segment-allocations`
- `POST` `/api/v1/bizes/:bizId/work-time-segment-allocations`

## Tables

- `work_templates`
- `work_template_steps`
- `work_runs`
- `work_run_steps`
- `work_entries`
- `work_time_segments`
- `work_time_segment_allocations`
- `work_artifacts`
- `work_approvals`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
