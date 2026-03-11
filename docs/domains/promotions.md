---
tags:
  - bizing
  - domain
  - generated
  - promotions
---

# Promotions Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/promotions.ts`
- Schema file: `packages/db/src/schema/promotions.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Promotion and discount routes.

ELI5:
A promotion is the reusable rulebook for "how do we discount this?"
A discount code is one concrete redeemable code that points at that rulebook.
A redemption is one historical "this discount was actually used" fact.

Why this route exists:
- the schema already has a clean promotions backbone,
- sagas and future UI need a real API contract instead of direct DB reads,
- operators need to manage campaigns, codes, and usage through one place.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/discount-campaigns`
- `POST` `/api/v1/bizes/:bizId/discount-campaigns`
- `PATCH` `/api/v1/bizes/:bizId/discount-campaigns/:campaignId`
- `GET` `/api/v1/bizes/:bizId/discount-codes`
- `POST` `/api/v1/bizes/:bizId/discount-codes`
- `POST` `/api/v1/bizes/:bizId/discount-campaigns/:campaignId/generate-codes`
- `PATCH` `/api/v1/bizes/:bizId/discount-codes/:codeId`
- `GET` `/api/v1/bizes/:bizId/discount-redemptions`
- `POST` `/api/v1/bizes/:bizId/discount-redemptions`
- `GET` `/api/v1/bizes/:bizId/discount-campaigns/:campaignId/performance`

## Tables

- `discount_campaigns`
- `discount_codes`
- `discount_redemptions`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
