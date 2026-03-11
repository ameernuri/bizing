---
tags:
  - bizing
  - domain
  - generated
  - booking-participants
---

# Booking Participants Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/booking-participants.ts`
- Schema file: `packages/db/src/schema/participant_obligations.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Booking participant obligations routes.

ELI5:
A booking can involve more than one person. Each person may owe something:
money, identity verification, a document, attendance confirmation, etc.

Why this route matters:
- group bookings, split payments, identity checks, and compliance intake all
  reuse this one canonical participant-obligation model,
- saga validators need real API CRUD over participant state,
- keeping this separate from the booking header prevents one booking row from
  becoming a giant unstructured blob.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/booking-orders/:bookingOrderId/participants`
- `POST` `/api/v1/bizes/:bizId/booking-orders/:bookingOrderId/participants`
- `PATCH` `/api/v1/bizes/:bizId/booking-orders/:bookingOrderId/participants/:obligationId`
- `POST` `/api/v1/bizes/:bizId/booking-orders/:bookingOrderId/participants/:obligationId/events`

## Tables

- `booking_participant_obligations`
- `participant_obligation_events`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
