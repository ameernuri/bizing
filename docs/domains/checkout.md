---
tags:
  - bizing
  - domain
  - generated
  - checkout
---

# Checkout Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/checkout.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/checkout.ts`

## Route Intent (top JSDoc)

Checkout session and recovery routes.

ELI5:
A checkout session is the "shopping cart story" before a purchase is fully
done. We keep it because:
- we need to know what the customer almost bought,
- we need abandoned-cart recovery to be traceable,
- we want recovery links and messages to be first-class, not guessed from
  logs.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/bizes/:bizId/checkout-sessions`
- `POST` `/bizes/:bizId/checkout-sessions`
- `GET` `/bizes/:bizId/checkout-sessions/:checkoutSessionId`
- `POST` `/bizes/:bizId/checkout-sessions/:checkoutSessionId/items`
- `POST` `/bizes/:bizId/checkout-sessions/:checkoutSessionId/events`
- `GET` `/bizes/:bizId/checkout-sessions/:checkoutSessionId/recovery-links`
- `POST` `/bizes/:bizId/checkout-sessions/:checkoutSessionId/recovery-links`
- `POST` `/public/bizes/:bizId/checkout-recovery/resolve`
- `POST` `/public/bizes/:bizId/checkout-recovery/consume`

## Tables

- `checkout_sessions`
- `checkout_session_items`
- `checkout_session_events`
- `checkout_recovery_links`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
