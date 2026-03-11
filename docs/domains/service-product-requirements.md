---
tags:
  - bizing
  - domain
  - generated
  - service-product-requirements
---

# Service Product Requirements Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/service-product-requirements.ts`
- Schema file: `packages/db/src/schema/service_products.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Service-product requirement routes.

ELI5:
A service product can say "to sell/book this, I need these kinds of
resources". Example:
- one host with GP capability
- one asset that is a training car
- one venue in location X

Why this route matters:
equipment/service matching should be modeled through first-class selectors,
not hidden in free-form metadata.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/service-products/:serviceProductId/requirement-groups`
- `POST` `/api/v1/bizes/:bizId/service-products/:serviceProductId/requirement-groups`
- `GET` `/api/v1/bizes/:bizId/service-products/:serviceProductId/requirement-groups/:groupId/selectors`
- `POST` `/api/v1/bizes/:bizId/service-products/:serviceProductId/requirement-groups/:groupId/selectors`

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
