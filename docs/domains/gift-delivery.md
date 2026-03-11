---
tags:
  - bizing
  - domain
  - generated
  - gift-delivery
---

# Gift Delivery Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/gift-delivery.ts`
- Schema file: `packages/db/src/schema/gift_delivery.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Gift delivery routes.

ELI5:
Gift instruments hold the value. These routes hold the "when/how/who gets
the gift" story.

Why this exists:
- scheduled gifting is a first-class use case,
- delivery retries and event timelines need to be visible through the API,
- the same model should work for email, SMS, in-app, or future channels.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/gift-instruments`
- `POST` `/api/v1/bizes/:bizId/gift-instruments`
- `GET` `/api/v1/bizes/:bizId/gift-delivery-schedules`
- `POST` `/api/v1/bizes/:bizId/gift-delivery-schedules`
- `PATCH` `/api/v1/bizes/:bizId/gift-delivery-schedules/:scheduleId`
- `GET` `/api/v1/bizes/:bizId/gift-delivery-schedules/:scheduleId/attempts`
- `POST` `/api/v1/bizes/:bizId/gift-delivery-schedules/:scheduleId/attempts`

## Tables

- `gift_delivery_schedules`
- `gift_delivery_attempts`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
