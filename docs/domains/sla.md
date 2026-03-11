---
tags:
  - bizing
  - domain
  - generated
  - sla
---

# Sla Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/sla.ts`
- Schema file: `packages/db/src/schema/sla.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

SLA and service-recovery routes.

ELI5:
SLA rows define the promise.
Breach rows say when the promise was missed.
Compensation rows say what the business did about it.

This route exists so operators, reporting, and saga coverage all read the
same first-class SLA contract instead of burying service-recovery logic in
random booking metadata.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/sla-policies`
- `POST` `/api/v1/bizes/:bizId/sla-policies`
- `GET` `/api/v1/bizes/:bizId/sla-breach-events`
- `POST` `/api/v1/bizes/:bizId/sla-breach-events`
- `PATCH` `/api/v1/bizes/:bizId/sla-breach-events/:breachId`
- `POST` `/api/v1/bizes/:bizId/sla-breach-events/:breachId/compensations`
- `GET` `/api/v1/bizes/:bizId/sla-overview`

## Tables

- `sla_policies`
- `sla_breach_events`
- `sla_compensation_events`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
