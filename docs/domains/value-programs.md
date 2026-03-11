---
tags:
  - bizing
  - domain
  - generated
  - value-programs
---

# Value Programs Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/value-programs.ts`
- Schema file: `packages/db/src/schema/value_programs.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Value program (loyalty / credits / points) routes.

ELI5:
This route family exposes:
- program + account configuration,
- immutable ledger posting,
- transfer workflow decisions,
- programmable rule and evaluation records.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/value-programs`
- `POST` `/api/v1/bizes/:bizId/value-programs`
- `PATCH` `/api/v1/bizes/:bizId/value-programs/:valueProgramId`
- `GET` `/api/v1/bizes/:bizId/value-accounts`
- `POST` `/api/v1/bizes/:bizId/value-accounts`
- `PATCH` `/api/v1/bizes/:bizId/value-accounts/:valueAccountId`
- `GET` `/api/v1/bizes/:bizId/value-accounts/:valueAccountId/ledger-entries`
- `POST` `/api/v1/bizes/:bizId/value-accounts/:valueAccountId/ledger-entries`
- `GET` `/api/v1/bizes/:bizId/value-transfers`
- `POST` `/api/v1/bizes/:bizId/value-transfers`
- `PATCH` `/api/v1/bizes/:bizId/value-transfers/:valueTransferId/decision`
- `GET` `/api/v1/bizes/:bizId/value-rules`
- `POST` `/api/v1/bizes/:bizId/value-rules`
- `PATCH` `/api/v1/bizes/:bizId/value-rules/:valueRuleId`
- `GET` `/api/v1/bizes/:bizId/value-rule-evaluations`
- `POST` `/api/v1/bizes/:bizId/value-rule-evaluations`

## Tables

- `value_programs`
- `value_program_tiers`
- `value_program_accounts`
- `value_transfers`
- `value_ledger_entries`
- `value_rules`
- `value_rule_evaluations`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
