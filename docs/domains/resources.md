---
tags:
  - bizing
  - domain
  - generated
  - resources
---

# Resources Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/resources.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/resources.ts`

## Route Intent (top JSDoc)

Resource routes (biz-scoped).

Resources are supply-side bookables (host/company_host/asset/venue).

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `requestId`
- `GET` `/bizes/:bizId/resources`
- `POST` `/bizes/:bizId/resources`
- `GET` `/bizes/:bizId/resources/:resourceId`
- `PATCH` `/bizes/:bizId/resources/:resourceId`
- `DELETE` `/bizes/:bizId/resources/:resourceId`

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
