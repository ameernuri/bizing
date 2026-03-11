---
tags:
  - bizing
  - domain
  - generated
  - sellable-variants
---

# Sellable Variants Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/sellable-variants.ts`
- Schema file: `packages/db/src/schema/sellable_variants.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Sellable variant routes.

ELI5:
A sellable is the "thing we sell". Variants let one sellable family expose
choices like:
- Basic / Pro / Team
- 30 min / 60 min
- English / Spanish

Why this route exists:
- the schema already has a canonical variant backbone,
- sagas and storefronts need to manage that backbone through the API,
- this keeps "variants" as a first-class commercial idea instead of hiding
  them inside random metadata blobs.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/sellables/:sellableId/variant-dimensions`
- `POST` `/api/v1/bizes/:bizId/sellables/:sellableId/variant-dimensions`
- `GET` `/api/v1/bizes/:bizId/sellables/:sellableId/variant-dimensions/:dimensionId/values`
- `POST` `/api/v1/bizes/:bizId/sellables/:sellableId/variant-dimensions/:dimensionId/values`
- `GET` `/api/v1/bizes/:bizId/sellables/:sellableId/variants`
- `POST` `/api/v1/bizes/:bizId/sellables/:sellableId/variants`
- `GET` `/api/v1/bizes/:bizId/sellable-variants/:variantId/selections`
- `POST` `/api/v1/bizes/:bizId/sellable-variants/:variantId/selections`

## Tables

- `sellable_variant_dimensions`
- `sellable_variant_dimension_values`
- `sellable_variants`
- `sellable_variant_selections`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
