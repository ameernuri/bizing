---
tags:
  - bizing
  - domain
  - generated
  - compensation
---

# Compensation Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/compensation.ts`
- Schema file: `packages/db/src/schema/compensation.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

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

- `GET` `/api/v1/bizes/:bizId/compensation-plan-rules`
- `POST` `/api/v1/bizes/:bizId/compensation-role-templates`
- `POST` `/api/v1/bizes/:bizId/compensation-plans`
- `POST` `/api/v1/bizes/:bizId/compensation-plan-versions`
- `POST` `/api/v1/bizes/:bizId/compensation-plan-rules`
- `POST` `/api/v1/bizes/:bizId/compensation/resolve/fulfillment-units/:fulfillmentUnitId`
- `GET` `/api/v1/bizes/:bizId/compensation-ledger-entries`
- `POST` `/api/v1/bizes/:bizId/compensation-ledger-entries`
- `POST` `/api/v1/bizes/:bizId/compensation-ledger-entries/:entryId/reverse`
- `GET` `/api/v1/bizes/:bizId/compensation-pay-runs`
- `POST` `/api/v1/bizes/:bizId/compensation-pay-runs`
- `POST` `/api/v1/bizes/:bizId/compensation-pay-runs/:payRunId/build`
- `GET` `/api/v1/bizes/:bizId/compensation-pay-runs/:payRunId`
- `GET` `/api/v1/bizes/:bizId/payroll-exports/preview`

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
