---
tags:
  - bizing
  - domain
  - generated
  - sellable-pricing
---

# Sellable Pricing Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/sellable-pricing.ts`
- Schema file: `packages/db/src/schema/sellable_pricing.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Sellable pricing routes.

ELI5:
A sellable can be free, fixed, flexible, tiered, metered, or externally
quoted. These routes expose that generic pricing backbone directly so
products and offers do not need separate pricing subsystems.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/sellable-pricing-modes`
- `POST` `/api/v1/bizes/:bizId/sellable-pricing-modes`
- `POST` `/api/v1/bizes/:bizId/sellable-pricing-thresholds`
- `POST` `/api/v1/bizes/:bizId/sellable-pricing-overrides`

## Tables

- `sellable_pricing_modes`
- `sellable_pricing_thresholds`
- `sellable_pricing_overrides`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
