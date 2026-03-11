---
tags:
  - bizing
  - domain
  - generated
  - receivables
---

# Receivables Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/receivables.ts`
- Schema file: `packages/db/src/schema/receivables.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

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

- `GET` `/api/v1/bizes/:bizId/billing-accounts`
- `POST` `/api/v1/bizes/:bizId/billing-accounts`
- `GET` `/api/v1/bizes/:bizId/purchase-orders`
- `POST` `/api/v1/bizes/:bizId/purchase-orders`
- `GET` `/api/v1/bizes/:bizId/ar-invoices`
- `POST` `/api/v1/bizes/:bizId/ar-invoices`
- `GET` `/api/v1/bizes/:bizId/ar-invoices/:invoiceId`
- `PATCH` `/api/v1/bizes/:bizId/ar-invoices/:invoiceId`
- `POST` `/api/v1/bizes/:bizId/ar-invoices/:invoiceId/events`
- `GET` `/api/v1/bizes/:bizId/installment-plans`
- `POST` `/api/v1/bizes/:bizId/installment-plans`
- `GET` `/api/v1/bizes/:bizId/installment-plans/:planId/items`
- `POST` `/api/v1/bizes/:bizId/installment-plans/:planId/items`
- `GET` `/api/v1/bizes/:bizId/billing-account-autopay-rules`
- `POST` `/api/v1/bizes/:bizId/billing-account-autopay-rules`
- `GET` `/api/v1/bizes/:bizId/autocollection-attempts`
- `POST` `/api/v1/bizes/:bizId/autocollection-attempts`

## Tables

- `installment_plans`
- `installment_schedule_items`
- `billing_account_autopay_rules`
- `autocollection_attempts`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
