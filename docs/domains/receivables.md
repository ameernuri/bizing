---
tags:
  - bizing
  - domain
  - generated
  - receivables
---

# Receivables Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/receivables.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/receivables.ts`

## Route Intent (top JSDoc)

Receivables routes.

ELI5:
These rows answer the B2B / invoice-style money questions:
- who can buy on terms?
- what PO are they using?
- what invoice was issued and what happened next?

Why this route matters:
booking sagas should prove net-terms, credit limits, PO capture, invoice
aging, and collections through the API, not through ad-hoc booking metadata.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/bizes/:bizId/billing-accounts`
- `POST` `/bizes/:bizId/billing-accounts`
- `GET` `/bizes/:bizId/purchase-orders`
- `POST` `/bizes/:bizId/purchase-orders`
- `GET` `/bizes/:bizId/ar-invoices`
- `POST` `/bizes/:bizId/ar-invoices`
- `GET` `/bizes/:bizId/ar-invoices/:invoiceId`
- `PATCH` `/bizes/:bizId/ar-invoices/:invoiceId`
- `POST` `/bizes/:bizId/ar-invoices/:invoiceId/events`
- `GET` `/bizes/:bizId/installment-plans`
- `POST` `/bizes/:bizId/installment-plans`
- `GET` `/bizes/:bizId/installment-plans/:planId/items`
- `POST` `/bizes/:bizId/installment-plans/:planId/items`
- `GET` `/bizes/:bizId/billing-account-autopay-rules`
- `POST` `/bizes/:bizId/billing-account-autopay-rules`
- `GET` `/bizes/:bizId/autocollection-attempts`
- `POST` `/bizes/:bizId/autocollection-attempts`

## Tables

- `installment_plans`
- `installment_schedule_items`
- `billing_account_autopay_rules`
- `autocollection_attempts`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
