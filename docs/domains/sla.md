---
tags:
  - bizing
  - domain
  - generated
  - sla
---

# Sla Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/sla.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/sla.ts`

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

- `GET` `/bizes/:bizId/sla-policies`
- `POST` `/bizes/:bizId/sla-policies`
- `GET` `/bizes/:bizId/sla-breach-events`
- `POST` `/bizes/:bizId/sla-breach-events`
- `PATCH` `/bizes/:bizId/sla-breach-events/:breachId`
- `POST` `/bizes/:bizId/sla-breach-events/:breachId/compensations`
- `GET` `/bizes/:bizId/sla-overview`

## Tables

- `sla_policies`
- `sla_breach_events`
- `sla_compensation_events`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
