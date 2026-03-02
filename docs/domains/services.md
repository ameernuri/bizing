---
tags:
  - bizing
  - domain
  - generated
  - services
---

# Services Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/services.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/services.ts`

## Route Intent (top JSDoc)

Service catalog routes (biz-scoped).

ELI5:
- `service_groups` organize services into logical buckets ("Hair", "Medical", "Consulting").
- `services` define the operational service intent (duration/approval/visibility/policies).
- commercial packaging is handled by `service_products` in a separate module.

Why this route file exists:
- Gives agents/API clients first-class CRUD over service intent primitives.
- Keeps ACL explicit so each operation can be permissioned by biz admins.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `requestId`
- `GET` `/bizes/:bizId/service-groups`
- `POST` `/bizes/:bizId/service-groups`
- `GET` `/bizes/:bizId/service-groups/:serviceGroupId`
- `PATCH` `/bizes/:bizId/service-groups/:serviceGroupId`
- `DELETE` `/bizes/:bizId/service-groups/:serviceGroupId`
- `GET` `/bizes/:bizId/services`
- `POST` `/bizes/:bizId/services`
- `GET` `/bizes/:bizId/services/:serviceId`
- `PATCH` `/bizes/:bizId/services/:serviceId`
- `DELETE` `/bizes/:bizId/services/:serviceId`

## Tables

- `service_groups`
- `services`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
