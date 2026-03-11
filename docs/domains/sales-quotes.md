---
tags:
  - bizing
  - domain
  - generated
  - sales-quotes
---

# Sales Quotes Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/sales-quotes.ts`
- Schema file: `packages/db/src/schema/sales_quotes.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Sales quote routes.

ELI5:
A quote is the "here is the offer we are proposing" thread before payment or
booking commitment happens.

This route family exposes:
- quote thread headers,
- immutable-ish revisions,
- line items inside one revision,
- acceptance/rejection decisions with actor trail.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/sales-quotes`
- `POST` `/api/v1/bizes/:bizId/sales-quotes`
- `GET` `/api/v1/bizes/:bizId/sales-quotes/:salesQuoteId/versions`
- `POST` `/api/v1/bizes/:bizId/sales-quotes/:salesQuoteId/versions`
- `GET` `/api/v1/bizes/:bizId/sales-quote-versions/:salesQuoteVersionId/lines`
- `POST` `/api/v1/bizes/:bizId/sales-quote-versions/:salesQuoteVersionId/lines`
- `GET` `/api/v1/bizes/:bizId/sales-quote-versions/:salesQuoteVersionId/acceptances`
- `POST` `/api/v1/bizes/:bizId/sales-quote-versions/:salesQuoteVersionId/acceptances`

## Tables

- `sales_quotes`
- `sales_quote_versions`
- `sales_quote_lines`
- `sales_quote_acceptances`
- `sales_quote_requests`
- `sales_quote_generation_runs`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
