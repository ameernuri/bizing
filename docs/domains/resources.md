---
tags:
  - bizing
  - domain
  - generated
  - resources
---

# Resources Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/resources.ts`
- Schema file: `packages/db/src/schema/resources.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Resource routes (biz-scoped).

Resources are supply-side bookables (host/company_host/asset/venue).

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/resources`
- `POST` `/api/v1/bizes/:bizId/resources`
- `GET` `/api/v1/bizes/:bizId/resources/:resourceId`
- `PATCH` `/api/v1/bizes/:bizId/resources/:resourceId`
- `DELETE` `/api/v1/bizes/:bizId/resources/:resourceId`

## Tables

- `resource_status_definitions`
- `resources`
- `host_users`
- `host_groups`
- `host_group_members`
- `resource_service_capabilities`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
