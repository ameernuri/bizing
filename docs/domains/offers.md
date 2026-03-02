---
tags:
  - bizing
  - domain
  - generated
  - offers
---

# Offers Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/offers.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/offers.ts`

## Route Intent (top JSDoc)

Offer + offer version routes (biz-scoped).

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `requestId`
- `GET` `/public/bizes/:bizId/offers`
- `GET` `/public/bizes/:bizId/offers/:offerId/availability`
- `GET` `/public/bizes/:bizId/offers/:offerId/walk-up`
- `GET` `/bizes/:bizId/offers`
- `POST` `/bizes/:bizId/offers`
- `PATCH` `/bizes/:bizId/offers/:offerId/versions/:offerVersionId`
- `GET` `/bizes/:bizId/offers/:offerId`
- `PATCH` `/bizes/:bizId/offers/:offerId`
- `DELETE` `/bizes/:bizId/offers/:offerId`
- `GET` `/bizes/:bizId/offers/:offerId/versions`
- `GET` `/bizes/:bizId/offers/:offerId/versions/:offerVersionId/admission-modes`
- `POST` `/bizes/:bizId/offers/:offerId/versions/:offerVersionId/admission-modes`
- `POST` `/bizes/:bizId/offers/:offerId/versions`

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
