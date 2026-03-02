---
tags:
  - bizing
  - domain
  - generated
  - fulfillment
---

# Fulfillment Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/fulfillment.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/fulfillment.ts`

## Route Intent (top JSDoc)

Fulfillment routes

Why this module exists:
- one booking can require multiple real assignments (lead + assistant),
- schedulers need a canonical way to ask "is this slot feasible if all of
  these resources must be free at the same time?",
- saga validation needs first-class APIs for multi-person execution rather
  than burying assignment intent in JSON metadata.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `POST` `/bizes/:bizId/fulfillment-units`
- `GET` `/bizes/:bizId/fulfillment-units/:fulfillmentUnitId/assignments`
- `POST` `/bizes/:bizId/fulfillment-units/:fulfillmentUnitId/assignments`
- `PATCH` `/bizes/:bizId/fulfillment-assignments/:fulfillmentAssignmentId`
- `POST` `/bizes/:bizId/fulfillment/slot-feasibility`

## Tables

- `standing_reservation_contracts`
- `standing_reservation_exceptions`
- `booking_orders`
- `booking_order_lines`
- `fulfillment_units`
- `standing_reservation_occurrences`
- `fulfillment_dependencies`
- `fulfillment_assignments`
- `fulfillment_assignment_events`
- `fulfillment_checkpoints`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
