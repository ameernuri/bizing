---
tags:
  - bizing
  - domain
  - generated
  - hipaa
---

# Hipaa Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/hipaa.ts`
- Schema file: `packages/db/src/schema/hipaa.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

HIPAA / PHI control routes.

ELI5:
These routes expose the healthcare/compliance backbone in a normal API shape.
They let the platform:
- define "minimum necessary" PHI access policies,
- log allowed/denied PHI access attempts,
- record break-glass reviews,
- manage BAAs and disclosure history,
- track security incidents and breach-notification tasks.

Why this exists:
The schema already models these compliance facts. Without API routes, the
sagas and future product UIs cannot validate or operate them directly.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/hipaa/access-policies`
- `POST` `/api/v1/bizes/:bizId/hipaa/access-policies`
- `GET` `/api/v1/bizes/:bizId/hipaa/access-events`
- `POST` `/api/v1/bizes/:bizId/hipaa/access-events`
- `GET` `/api/v1/bizes/:bizId/hipaa/break-glass-reviews`
- `POST` `/api/v1/bizes/:bizId/hipaa/break-glass-reviews`
- `GET` `/api/v1/bizes/:bizId/hipaa/baas`
- `POST` `/api/v1/bizes/:bizId/hipaa/baas`
- `GET` `/api/v1/bizes/:bizId/hipaa/disclosures`
- `POST` `/api/v1/bizes/:bizId/hipaa/disclosures`
- `GET` `/api/v1/bizes/:bizId/hipaa/security-incidents`
- `POST` `/api/v1/bizes/:bizId/hipaa/security-incidents`
- `PATCH` `/api/v1/bizes/:bizId/hipaa/security-incidents/:incidentId`
- `GET` `/api/v1/bizes/:bizId/hipaa/breach-notifications`
- `POST` `/api/v1/bizes/:bizId/hipaa/breach-notifications`
- `PATCH` `/api/v1/bizes/:bizId/hipaa/breach-notifications/:notificationId`

## Tables

- `business_associate_agreements`
- `hipaa_authorizations`
- `phi_access_policies`
- `phi_access_events`
- `security_incidents`
- `break_glass_reviews`
- `phi_disclosure_events`
- `breach_notifications`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
