---
tags:
  - bizing
  - domain
  - generated
  - sellables
---

# Sellables Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/sellables.ts`
- Schema file: `packages/db/src/schema/product_commerce.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Sellable routes.

ELI5:
A sellable is the common commercial face for things we can sell.
Products, service products, offer versions, and direct resource rates all
plug into this one root so pricing/reporting APIs do not need to guess where
commerce started.

Why this route exists:
- lets operators and agents discover the canonical commercial id,
- keeps pricing, checkout, tax, invoice, and reporting flows keyed to one
  stable entity instead of many ad-hoc source ids,
- gives sagas and debugging a clean way to prove which sellable a scenario
  is talking about.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/sellables`
- `GET` `/api/v1/bizes/:bizId/sellables/:sellableId`

## Tables

- `sellables`
- `sellable_products`
- `sellable_service_products`
- `sellable_offer_versions`
- `sellable_resource_rates`
- `product_bundles`
- `product_bundle_components`
- `booking_order_line_sellables`
- `inventory_locations`
- `inventory_items`
- `inventory_reservations`
- `physical_fulfillments`
- `physical_fulfillment_items`
- `inventory_movements`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
