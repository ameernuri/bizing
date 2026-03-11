---
tags:
  - bizing
  - domain
  - generated
  - tax-fx
---

# Tax Fx Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/tax-fx.ts`
- Schema file: `packages/db/src/schema/tax_fx.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Tax + FX routes.

ELI5:
- FX snapshots remember which exchange rate was used.
- Tax profiles/rules describe which tax logic applies.
- Tax calculations store the exact tax/FX outcome used at checkout/invoice time.

Why this matters:
- cross-border checkout should be replayable later,
- invoices should keep the rate/currency context they were confirmed with,
- saga coverage needs a first-class API, not inferred metadata.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/fx-rate-snapshots`
- `POST` `/api/v1/bizes/:bizId/fx-rate-snapshots`
- `GET` `/api/v1/bizes/:bizId/tax-profiles`
- `POST` `/api/v1/bizes/:bizId/tax-profiles`
- `GET` `/api/v1/bizes/:bizId/tax-rule-refs`
- `POST` `/api/v1/bizes/:bizId/tax-rule-refs`
- `GET` `/api/v1/bizes/:bizId/tax-calculations`
- `POST` `/api/v1/bizes/:bizId/tax-calculations`
- `GET` `/api/v1/bizes/:bizId/tax-calculations/:taxCalculationId`

## Tables

- `fx_rate_snapshots`
- `tax_profiles`
- `tax_rule_refs`
- `tax_calculations`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
