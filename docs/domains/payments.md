---
tags:
  - bizing
  - domain
  - generated
  - payments
---

# Payments Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/payments.ts`
- Schema file: `packages/db/src/schema/payments.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Payments routes (biz + customer booking surfaces).

ELI5:
- Public route lets a customer pay for their own booking using split tender.
- Biz routes let operators/auditors inspect payment intent state and the
  immutable transaction trail that proves "who paid what and how".

Design intent:
- No direct DB access by agents or UI clients.
- Money flows are persisted through first-class payment tables:
  payment_intents -> payment_intent_tenders -> payment_*_line_allocations
  plus immutable payment_transactions.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `POST` `/api/v1/public/bizes/:bizId/booking-orders/:bookingOrderId/payments/stripe/payment-intents`
- `POST` `/api/v1/public/payments/stripe/webhook`
- `POST` `/api/v1/public/bizes/:bizId/booking-orders/:bookingOrderId/payments/advanced`
- `POST` `/api/v1/bizes/:bizId/payment-intents/:paymentIntentId/refunds`
- `GET` `/api/v1/bizes/:bizId/payment-intents`
- `GET` `/api/v1/bizes/:bizId/payment-intents/:paymentIntentId`

## Tables

- `payment_processor_accounts`
- `payment_methods`
- `payment_intents`
- `payment_intent_events`
- `payment_intent_tenders`
- `payment_intent_line_allocations`
- `payment_transactions`
- `payment_transaction_line_allocations`
- `payment_disputes`
- `settlement_batches`
- `settlement_entries`
- `payouts`
- `payout_ledger_entries`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
