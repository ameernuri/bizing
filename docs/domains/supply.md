---
tags:
  - bizing
  - domain
  - generated
  - supply
---

# Supply Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/supply.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/supply.ts`

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

- `GET` `/bizes/:bizId/resource-usage-counters`
- `POST` `/bizes/:bizId/resource-usage-counters`
- `POST` `/bizes/:bizId/resource-usage-counters/:counterId/increment`
- `GET` `/bizes/:bizId/resource-maintenance-policies`
- `POST` `/bizes/:bizId/resource-maintenance-policies`
- `GET` `/bizes/:bizId/resource-maintenance-work-orders`
- `POST` `/bizes/:bizId/resource-maintenance-work-orders`
- `PATCH` `/bizes/:bizId/resource-maintenance-work-orders/:workOrderId`
- `GET` `/bizes/:bizId/resource-condition-reports`
- `POST` `/bizes/:bizId/resource-condition-reports`
- `GET` `/bizes/:bizId/production-batches`
- `POST` `/bizes/:bizId/production-batches`
- `PATCH` `/bizes/:bizId/production-batches/:batchId`
- `GET` `/bizes/:bizId/production-batches/:batchId/reservations`
- `POST` `/bizes/:bizId/production-batches/:batchId/reservations`
- `PATCH` `/bizes/:bizId/production-batches/:batchId/reservations/:reservationId`

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
