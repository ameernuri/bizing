---
tags:
  - bizing
  - domain
  - generated
  - supply
---

# Supply Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/supply.ts`
- Schema file: `packages/db/src/schema/supply.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Supply operations routes.

ELI5:
Resources like vehicles, rooms, chairs, scanners, and machines need their
own operational facts:
- usage counters,
- maintenance rules,
- work orders,
- condition/failure reports.

These routes expose those facts directly so sagas can prove equipment-heavy
use cases through the API.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/resource-usage-counters`
- `POST` `/api/v1/bizes/:bizId/resource-usage-counters`
- `POST` `/api/v1/bizes/:bizId/resource-usage-counters/:counterId/increment`
- `GET` `/api/v1/bizes/:bizId/resource-maintenance-policies`
- `POST` `/api/v1/bizes/:bizId/resource-maintenance-policies`
- `GET` `/api/v1/bizes/:bizId/resource-maintenance-work-orders`
- `POST` `/api/v1/bizes/:bizId/resource-maintenance-work-orders`
- `PATCH` `/api/v1/bizes/:bizId/resource-maintenance-work-orders/:workOrderId`
- `GET` `/api/v1/bizes/:bizId/resource-condition-reports`
- `POST` `/api/v1/bizes/:bizId/resource-condition-reports`
- `GET` `/api/v1/bizes/:bizId/production-batches`
- `POST` `/api/v1/bizes/:bizId/production-batches`
- `PATCH` `/api/v1/bizes/:bizId/production-batches/:batchId`
- `GET` `/api/v1/bizes/:bizId/production-batches/:batchId/reservations`
- `POST` `/api/v1/bizes/:bizId/production-batches/:batchId/reservations`
- `PATCH` `/api/v1/bizes/:bizId/production-batches/:batchId/reservations/:reservationId`

## Tables

- `resource_capability_templates`
- `resource_capability_assignments`
- `resource_usage_counters`
- `resource_maintenance_policies`
- `resource_maintenance_work_orders`
- `resource_condition_reports`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
