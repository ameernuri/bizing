---
tags:
  - bizing
  - domain
  - generated
  - wishlists
---

# Wishlists Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/wishlists.ts`
- Schema file: `packages/db/src/schema/gifts.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Wishlist / save-for-later routes.

ELI5:
A cart is "I want this right now".
A wishlist is "I want this later, remind me when it matters".

These routes keep that intent first-class so the platform can support:
- save-for-later UX,
- cross-sell reminders,
- availability/price snapshots at save time,
- conversion attribution from wishlist into checkout later.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/wishlists`
- `POST` `/api/v1/bizes/:bizId/wishlists`
- `GET` `/api/v1/bizes/:bizId/wishlists/:wishlistId/items`
- `POST` `/api/v1/bizes/:bizId/wishlists/:wishlistId/items`

## Tables

- `gift_instruments`
- `gift_redemptions`
- `gift_transfers`
- `gift_expiration_events`
- `gift_instrument_ledger_entries`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
