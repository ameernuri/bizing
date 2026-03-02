---
tags:
  - bizing
  - domain
  - generated
  - entitlements
---

# Entitlements Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/entitlements.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/entitlements.ts`

## Route Intent (top JSDoc)

Membership + entitlement routes.

ELI5:
This module exposes the "membership and credits wallet" part of the schema.

Why this is first-class instead of hiding everything inside generic metadata:
- subscriptions/memberships need stable ids, lifecycle, and reporting,
- credits/sessions/passes need immutable ledger history,
- saga validation should prove real API support, not hand-wave with JSON blobs.

What this route family covers:
- membership plan templates,
- active customer memberships,
- entitlement wallets (credits, sessions, minutes, etc.),
- grants into wallets,
- consumption from wallets,
- rollover/expiry processing snapshots.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/bizes/:bizId/membership-plans`
- `POST` `/bizes/:bizId/membership-plans`
- `PATCH` `/bizes/:bizId/membership-plans/:membershipPlanId`
- `GET` `/bizes/:bizId/memberships`
- `POST` `/bizes/:bizId/memberships`
- `GET` `/bizes/:bizId/memberships/:membershipId`
- `PATCH` `/bizes/:bizId/memberships/:membershipId`
- `GET` `/bizes/:bizId/entitlement-wallets`
- `POST` `/bizes/:bizId/entitlement-wallets`
- `GET` `/bizes/:bizId/entitlement-wallets/:walletId`
- `POST` `/bizes/:bizId/entitlement-grants`
- `POST` `/bizes/:bizId/entitlement-transfers`
- `GET` `user`
- `GET` `user`
- `POST` `/bizes/:bizId/entitlement-wallets/:walletId/consume`
- `GET` `/bizes/:bizId/entitlement-wallets/:walletId/ledger`
- `POST` `/bizes/:bizId/gift-wallets`
- `GET` `/bizes/:bizId/gift-wallets/:walletId`
- `POST` `/public/bizes/:bizId/gift-wallets/redeem`
- `POST` `/bizes/:bizId/gift-wallets/:walletId/transfer`
- `POST` `/bizes/:bizId/gift-wallets/:walletId/revoke`
- `POST` `/bizes/:bizId/gift-wallets/:walletId/extend`
- `POST` `/bizes/:bizId/rollover-runs`

## Tables

- `membership_plans`
- `memberships`
- `entitlement_wallets`
- `entitlement_grants`
- `entitlement_transfers`
- `entitlement_ledger_entries`
- `rollover_runs`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
