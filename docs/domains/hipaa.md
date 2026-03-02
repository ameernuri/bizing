---
tags:
  - bizing
  - domain
  - generated
  - hipaa
---

# Hipaa Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/hipaa.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/hipaa.ts`

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

- `GET` `/bizes/:bizId/hipaa/access-policies`
- `POST` `/bizes/:bizId/hipaa/access-policies`
- `GET` `/bizes/:bizId/hipaa/access-events`
- `POST` `/bizes/:bizId/hipaa/access-events`
- `GET` `/bizes/:bizId/hipaa/break-glass-reviews`
- `POST` `/bizes/:bizId/hipaa/break-glass-reviews`
- `GET` `/bizes/:bizId/hipaa/baas`
- `POST` `/bizes/:bizId/hipaa/baas`
- `GET` `/bizes/:bizId/hipaa/disclosures`
- `POST` `/bizes/:bizId/hipaa/disclosures`
- `GET` `/bizes/:bizId/hipaa/security-incidents`
- `POST` `/bizes/:bizId/hipaa/security-incidents`
- `PATCH` `/bizes/:bizId/hipaa/security-incidents/:incidentId`
- `GET` `/bizes/:bizId/hipaa/breach-notifications`
- `POST` `/bizes/:bizId/hipaa/breach-notifications`
- `PATCH` `/bizes/:bizId/hipaa/breach-notifications/:notificationId`

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
