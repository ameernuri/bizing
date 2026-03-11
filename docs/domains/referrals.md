---
tags:
  - bizing
  - domain
  - generated
  - referrals
---

# Referrals Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/referrals.ts`
- Schema file: `packages/db/src/schema/referral_attribution.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Referral and attribution routes.

ELI5:
A referral program is the reusable incentive plan.
A referral link is one shareable URL/code.
A click is one "someone tapped the link" fact.
An attribution is one "this booking counts because of that link" decision.
A reward grant is one "pay the referrer/referee this value" fact.

Why this route exists:
- referrals should be provable through the API,
- growth/reporting sagas need deterministic reads and writes here,
- future customer UI needs one canonical referral contract.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/referral-programs`
- `POST` `/api/v1/bizes/:bizId/referral-programs`
- `PATCH` `/api/v1/bizes/:bizId/referral-programs/:programId`
- `GET` `/api/v1/bizes/:bizId/referral-links`
- `POST` `/api/v1/bizes/:bizId/referral-links`
- `GET` `/api/v1/bizes/:bizId/referral-link-clicks`
- `POST` `/api/v1/bizes/:bizId/referral-link-clicks`
- `GET` `/api/v1/bizes/:bizId/referral-attributions`
- `POST` `/api/v1/bizes/:bizId/referral-attributions`
- `GET` `/api/v1/bizes/:bizId/referral-events`
- `POST` `/api/v1/bizes/:bizId/referral-events`
- `GET` `/api/v1/bizes/:bizId/reward-grants`
- `POST` `/api/v1/bizes/:bizId/reward-grants`
- `GET` `/api/v1/bizes/:bizId/referral-payout-statements`
- `GET` `/api/v1/bizes/:bizId/referral-leaderboard`
- `GET` `/api/v1/bizes/:bizId/referral-status`

## Tables

- `referral_links`
- `referral_link_clicks`
- `referral_attributions`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
