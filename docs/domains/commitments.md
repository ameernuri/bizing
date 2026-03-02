---
tags:
  - bizing
  - domain
  - generated
  - commitments
---

# Commitments Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/commitments.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/commitments.ts`

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

- `GET` `/bizes/:bizId/commitment-contracts`
- `POST` `/bizes/:bizId/commitment-contracts`
- `GET` `/bizes/:bizId/commitment-contracts/:contractId/obligations`
- `POST` `/bizes/:bizId/commitment-contracts/:contractId/obligations`
- `PATCH` `/bizes/:bizId/commitment-contracts/:contractId/obligations/:obligationId`
- `GET` `/bizes/:bizId/commitment-contracts/:contractId/milestones`
- `POST` `/bizes/:bizId/commitment-contracts/:contractId/milestones`
- `PATCH` `/bizes/:bizId/commitment-contracts/:contractId/milestones/:milestoneId`
- `GET` `/bizes/:bizId/commitment-contracts/:contractId/milestones/:milestoneId/obligations`
- `POST` `/bizes/:bizId/commitment-contracts/:contractId/milestones/:milestoneId/obligations`
- `GET` `/bizes/:bizId/secured-balance-accounts`
- `POST` `/bizes/:bizId/secured-balance-accounts`
- `GET` `/bizes/:bizId/secured-balance-accounts/:accountId/ledger-entries`
- `POST` `/bizes/:bizId/secured-balance-accounts/:accountId/ledger-entries`
- `GET` `/bizes/:bizId/secured-balance-ledger-entries/:entryId/allocations`
- `POST` `/bizes/:bizId/secured-balance-ledger-entries/:entryId/allocations`
- `GET` `/bizes/:bizId/commitment-contracts/:contractId/claims`
- `POST` `/bizes/:bizId/commitment-contracts/:contractId/claims`
- `PATCH` `/bizes/:bizId/commitment-contracts/:contractId/claims/:claimId`
- `GET` `/bizes/:bizId/commitment-contracts/:contractId/claims/:claimId/events`
- `POST` `/bizes/:bizId/commitment-contracts/:contractId/claims/:claimId/events`

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
