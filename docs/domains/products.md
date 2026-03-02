---
tags:
  - bizing
  - domain
  - generated
  - products
---

# Products Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/products.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/products.ts`

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

- `GET` `/bizes/:bizId/products`
- `POST` `/bizes/:bizId/products`
- `PATCH` `/bizes/:bizId/products/:productId`
- `GET` `/bizes/:bizId/product-bundles`
- `POST` `/bizes/:bizId/product-bundles`
- `GET` `/bizes/:bizId/product-bundles/:bundleId/components`
- `POST` `/bizes/:bizId/product-bundles/:bundleId/components`

## Tables

- `products`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
