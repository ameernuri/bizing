---
tags:
  - bizing
  - domain
  - generated
  - products
---

# Products Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/products.ts`
- Schema file: `packages/db/src/schema/products.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Product and bundle routes.

ELI5:
Products are normal catalog items.
Bundles are "box products" that contain other products, service products,
or offers.

Why this route exists:
- the schema already models products and bundles canonically,
- storefront sagas need a clean API surface for variants/bundles,
- agents should be able to inspect and mutate product composition without
  touching raw database tables.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/products`
- `POST` `/api/v1/bizes/:bizId/products`
- `PATCH` `/api/v1/bizes/:bizId/products/:productId`
- `GET` `/api/v1/bizes/:bizId/product-bundles`
- `POST` `/api/v1/bizes/:bizId/product-bundles`
- `GET` `/api/v1/bizes/:bizId/product-bundles/:bundleId/components`
- `POST` `/api/v1/bizes/:bizId/product-bundles/:bundleId/components`

## Tables

- `products`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
