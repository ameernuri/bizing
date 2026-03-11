---
tags:
  - bizing
  - domain
  - generated
  - entitlements
---

# Entitlements Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/entitlements.ts`
- Schema file: `packages/db/src/schema/entitlements.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

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

- `GET` `/api/v1/bizes/:bizId/membership-plans`
- `POST` `/api/v1/bizes/:bizId/membership-plans`
- `PATCH` `/api/v1/bizes/:bizId/membership-plans/:membershipPlanId`
- `GET` `/api/v1/bizes/:bizId/memberships`
- `POST` `/api/v1/bizes/:bizId/memberships`
- `GET` `/api/v1/bizes/:bizId/memberships/:membershipId`
- `PATCH` `/api/v1/bizes/:bizId/memberships/:membershipId`
- `GET` `/api/v1/bizes/:bizId/entitlement-wallets`
- `POST` `/api/v1/bizes/:bizId/entitlement-wallets`
- `GET` `/api/v1/bizes/:bizId/entitlement-wallets/:walletId`
- `POST` `/api/v1/bizes/:bizId/entitlement-grants`
- `POST` `/api/v1/bizes/:bizId/entitlement-transfers`
- `POST` `/api/v1/bizes/:bizId/entitlement-wallets/:walletId/consume`
- `GET` `/api/v1/bizes/:bizId/entitlement-wallets/:walletId/ledger`
- `POST` `/api/v1/bizes/:bizId/gift-wallets`
- `GET` `/api/v1/bizes/:bizId/gift-wallets/:walletId`
- `POST` `/api/v1/public/bizes/:bizId/gift-wallets/redeem`
- `POST` `/api/v1/bizes/:bizId/gift-wallets/:walletId/transfer`
- `POST` `/api/v1/bizes/:bizId/gift-wallets/:walletId/revoke`
- `POST` `/api/v1/bizes/:bizId/gift-wallets/:walletId/extend`
- `POST` `/api/v1/bizes/:bizId/rollover-runs`

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
