---
tags:
  - bizing
  - domain
  - generated
  - service-products
---

# Service Products Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/service-products.ts`
- Schema file: `packages/db/src/schema/service_products.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Service-product routes (biz-scoped).

ELI5:
- `services` = "what kind of work is this?"
- `service_products` = "how do we sell/schedule that work?"
- `service_product_services` = links a sellable service-product to one or
  many service intents (direct service or service group).

This route module exposes first-class API control for those models.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/service-products`
- `POST` `/api/v1/bizes/:bizId/service-products`
- `GET` `/api/v1/bizes/:bizId/service-products/:serviceProductId`
- `PATCH` `/api/v1/bizes/:bizId/service-products/:serviceProductId`
- `DELETE` `/api/v1/bizes/:bizId/service-products/:serviceProductId`
- `GET` `/api/v1/bizes/:bizId/service-products/:serviceProductId/services`
- `POST` `/api/v1/bizes/:bizId/service-products/:serviceProductId/services`
- `DELETE` `/api/v1/bizes/:bizId/service-products/:serviceProductId/services/:bindingId`

## Tables

- `service_products`
- `service_product_requirement_groups`
- `service_product_services`
- `service_product_requirement_selectors`
- `service_product_seat_types`
- `service_product_seat_type_requirements`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
