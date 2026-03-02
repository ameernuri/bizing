---
tags:
  - bizing
  - domain
  - generated
  - compensation
---

# Compensation Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/compensation.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/compensation.ts`

## Route Intent (top JSDoc)

Compensation routes

Why this module exists:
- role templates, plans, rules, and ledger entries already exist in schema,
- sagas need real APIs to prove role-based payouts and commissions,
- payout logic should be traceable through immutable ledger rows, not
  hidden in transient calculator code.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/bizes/:bizId/compensation-plan-rules`
- `POST` `/bizes/:bizId/compensation-role-templates`
- `POST` `/bizes/:bizId/compensation-plans`
- `POST` `/bizes/:bizId/compensation-plan-versions`
- `POST` `/bizes/:bizId/compensation-plan-rules`
- `POST` `/bizes/:bizId/compensation/resolve/fulfillment-units/:fulfillmentUnitId`
- `GET` `/bizes/:bizId/compensation-ledger-entries`
- `POST` `/bizes/:bizId/compensation-ledger-entries`
- `POST` `/bizes/:bizId/compensation-ledger-entries/:entryId/reverse`
- `GET` `/bizes/:bizId/compensation-pay-runs`
- `POST` `/bizes/:bizId/compensation-pay-runs`
- `POST` `/bizes/:bizId/compensation-pay-runs/:payRunId/build`
- `GET` `/bizes/:bizId/compensation-pay-runs/:payRunId`
- `GET` `/bizes/:bizId/payroll-exports/preview`

## Tables

- `compensation_role_templates`
- `compensation_plans`
- `compensation_plan_versions`
- `compensation_plan_rules`
- `compensation_assignment_roles`
- `compensation_ledger_entries`
- `compensation_pay_runs`
- `compensation_pay_run_items`
- `compensation_pay_run_item_entries`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
