---
tags:
  - bizing
  - domain
  - generated
  - offers
---

# Offers Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/offers.ts`
- Schema file: `packages/db/src/schema/offers.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Offer + offer version routes (biz-scoped).

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/public/bizes/:bizId/offers`
- `GET` `/api/v1/public/bizes/:bizId/offers/:offerId/availability`
- `GET` `/api/v1/public/bizes/:bizId/offers/:offerId/walk-up`
- `GET` `/api/v1/bizes/:bizId/offers`
- `POST` `/api/v1/bizes/:bizId/offers`
- `PATCH` `/api/v1/bizes/:bizId/offers/:offerId/versions/:offerVersionId`
- `GET` `/api/v1/bizes/:bizId/offers/:offerId`
- `PATCH` `/api/v1/bizes/:bizId/offers/:offerId`
- `DELETE` `/api/v1/bizes/:bizId/offers/:offerId`
- `GET` `/api/v1/bizes/:bizId/offers/:offerId/versions`
- `GET` `/api/v1/bizes/:bizId/offers/:offerId/versions/:offerVersionId/admission-modes`
- `POST` `/api/v1/bizes/:bizId/offers/:offerId/versions/:offerVersionId/admission-modes`
- `POST` `/api/v1/bizes/:bizId/offers/:offerId/versions`

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
