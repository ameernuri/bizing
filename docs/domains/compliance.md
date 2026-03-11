---
tags:
  - bizing
  - domain
  - generated
  - compliance
---

# Compliance Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/compliance.ts`
- Schema file: `packages/db/src/schema/compliance_programs.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Compliance controls read-model routes (biz-scoped).

ELI5:
This endpoint gives operators one "compliance dashboard payload" that answers:
- who is asking,
- whether sensitive permissions are scoped/enforced,
- whether credential governance data exists,
- whether immutable audit streams/events exist.

Why this route matters for saga lifecycle:
- It turns compliance checks into a real API assertion target.
- Runner steps can validate deterministic fields instead of relying on
  heuristic tool-name matching.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/booking-orders/:bookingOrderId/compliance-gate`
- `POST` `/api/v1/bizes/:bizId/booking-orders/:bookingOrderId/compliance-consents`
- `GET` `/api/v1/bizes/:bizId/compliance/controls`

## Tables

- `compliance_program_enrollments`
- `compliance_control_implementations`
- `compliance_control_evidence`
- `compliance_control_checks`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
