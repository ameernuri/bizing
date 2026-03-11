---
tags:
  - bizing
  - domain
  - generated
  - bookings
---

# Bookings Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/bookings.ts`
- Schema file: `packages/db/src/schema/offers.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Booking order routes (biz-scoped).

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/public/bizes/:bizId/booking-orders`
- `POST` `/api/v1/public/bizes/:bizId/booking-orders`
- `GET` `/api/v1/bizes/:bizId/booking-orders`
- `POST` `/api/v1/bizes/:bizId/booking-orders`
- `GET` `/api/v1/bizes/:bizId/booking-orders/:bookingOrderId`
- `GET` `/api/v1/bizes/:bizId/booking-orders/:bookingOrderId/line-execution`
- `GET` `/api/v1/bizes/:bizId/booking-orders/:bookingOrderId/lines`
- `PATCH` `/api/v1/bizes/:bizId/booking-orders/:bookingOrderId`
- `PATCH` `/api/v1/bizes/:bizId/booking-orders/:bookingOrderId/status`
- `DELETE` `/api/v1/bizes/:bizId/booking-orders/:bookingOrderId`

## Tables

- `offers`
- `offer_versions`
- `offer_version_admission_modes`
- `offer_components`
- `offer_component_selectors`
- `offer_component_seat_types`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
