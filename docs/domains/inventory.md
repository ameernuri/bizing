---
tags:
  - bizing
  - domain
  - generated
  - inventory
---

# Inventory Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/inventory.ts`
- Schema file: `packages/db/src/schema/inventory_procurement.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Inventory procurement + replenishment routes.

ELI5:
This route family gives one API surface for:
- supplier lifecycle,
- replenishment planning runs and suggestion decisions,
- procurement order lifecycle.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/supply-partners`
- `POST` `/api/v1/bizes/:bizId/supply-partners`
- `PATCH` `/api/v1/bizes/:bizId/supply-partners/:supplyPartnerId`
- `GET` `/api/v1/bizes/:bizId/inventory-replenishment-runs`
- `POST` `/api/v1/bizes/:bizId/inventory-replenishment-runs`
- `PATCH` `/api/v1/bizes/:bizId/inventory-replenishment-runs/:runId`
- `GET` `/api/v1/bizes/:bizId/inventory-replenishment-suggestions`
- `PATCH` `/api/v1/bizes/:bizId/inventory-replenishment-suggestions/:suggestionId/decision`
- `GET` `/api/v1/bizes/:bizId/inventory-procurement-orders`
- `POST` `/api/v1/bizes/:bizId/inventory-procurement-orders`
- `PATCH` `/api/v1/bizes/:bizId/inventory-procurement-orders/:orderId`

## Tables

- `supply_partners`
- `supply_partner_catalog_items`
- `inventory_replenishment_policies`
- `inventory_replenishment_runs`
- `inventory_procurement_orders`
- `inventory_procurement_order_lines`
- `inventory_replenishment_suggestions`
- `inventory_receipt_batches`
- `inventory_receipt_items`
- `inventory_lot_units`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
