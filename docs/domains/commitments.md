---
tags:
  - bizing
  - domain
  - generated
  - commitments
---

# Commitments Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/commitments.ts`
- Schema file: `packages/db/src/schema/commitments.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Commitment + escrow routes.

ELI5:
- A commitment contract is the agreement.
- Obligations are the things that must happen.
- Milestones say when money can release.
- Secured-balance accounts/ledger rows hold the audit truth of held money.
- Claims model disputes, damage, and settlement outcomes.

Why this matters:
- escrow and damage/dispute flows should be first-class,
- saga coverage should prove the real contract lifecycle through the API,
- funds release should be traceable without bespoke per-vertical tables.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/commitment-contracts`
- `POST` `/api/v1/bizes/:bizId/commitment-contracts`
- `GET` `/api/v1/bizes/:bizId/commitment-contracts/:contractId/obligations`
- `POST` `/api/v1/bizes/:bizId/commitment-contracts/:contractId/obligations`
- `PATCH` `/api/v1/bizes/:bizId/commitment-contracts/:contractId/obligations/:obligationId`
- `GET` `/api/v1/bizes/:bizId/commitment-contracts/:contractId/milestones`
- `POST` `/api/v1/bizes/:bizId/commitment-contracts/:contractId/milestones`
- `PATCH` `/api/v1/bizes/:bizId/commitment-contracts/:contractId/milestones/:milestoneId`
- `GET` `/api/v1/bizes/:bizId/commitment-contracts/:contractId/milestones/:milestoneId/obligations`
- `POST` `/api/v1/bizes/:bizId/commitment-contracts/:contractId/milestones/:milestoneId/obligations`
- `GET` `/api/v1/bizes/:bizId/secured-balance-accounts`
- `POST` `/api/v1/bizes/:bizId/secured-balance-accounts`
- `GET` `/api/v1/bizes/:bizId/secured-balance-accounts/:accountId/ledger-entries`
- `POST` `/api/v1/bizes/:bizId/secured-balance-accounts/:accountId/ledger-entries`
- `GET` `/api/v1/bizes/:bizId/secured-balance-ledger-entries/:entryId/allocations`
- `POST` `/api/v1/bizes/:bizId/secured-balance-ledger-entries/:entryId/allocations`
- `GET` `/api/v1/bizes/:bizId/commitment-contracts/:contractId/claims`
- `POST` `/api/v1/bizes/:bizId/commitment-contracts/:contractId/claims`
- `PATCH` `/api/v1/bizes/:bizId/commitment-contracts/:contractId/claims/:claimId`
- `GET` `/api/v1/bizes/:bizId/commitment-contracts/:contractId/claims/:claimId/events`
- `POST` `/api/v1/bizes/:bizId/commitment-contracts/:contractId/claims/:claimId/events`

## Tables

- `commitment_contracts`
- `commitment_obligations`
- `commitment_milestones`
- `commitment_milestone_obligations`
- `secured_balance_accounts`
- `secured_balance_ledger_entries`
- `secured_balance_allocations`
- `commitment_claims`
- `commitment_claim_events`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
