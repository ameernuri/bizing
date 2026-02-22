# Schema Style Guide (v0)

This file defines the default rules for all schema modules in `/packages/db/src/schema`.

## 1) Tenant Boundaries

- Rule: every business-domain table should include `biz_id` as `bizId: idRef("biz_id")`.
- Exception: global/root tables (`bizes`, `users`, Better Auth root tables).
- Why: keeps data isolation explicit and enables tenant-safe composite foreign keys.

## 2) Lifecycle Controls

- Rule: use one lifecycle control per table.
- Prefer:
  - `status` enum for state machines and workflow entities.
  - `is_active` only for lightweight toggle dictionaries/policies.
- Do not use both `status` and `is_active` in the same table.

## 3) Audit Columns

- Rule: use helpers from `_common.ts` instead of hand-writing audit columns.
- Default for business tables:
  - `...withAuditRefs(() => users.id)`
- Rationale:
  - consistent `created_at/updated_at/deleted_at`
  - consistent actor columns (`created_by/updated_by/deleted_by`)

## 4) Foreign Keys

- Rule: prefer tenant-safe composite FKs for tenant-scoped relations.
- Pattern:
  - parent has unique `(biz_id, id)`
  - child FK uses `[bizId, parentId] -> [parent.bizId, parent.id]`
- Why: avoids accidental cross-tenant joins.

## 5) Classification Fields

- Rule: avoid unconstrained free-text classifiers for core behavior (`type`, `visibility`, `status`).
- Prefer `pgEnum` or dictionary template tables.
- Free-text is acceptable only for non-critical labels/notes.

## 6) Documentation

- Rule: every table has a JSDoc header explaining:
  - what it is
  - why it exists
  - how it connects to adjacent tables
- Rule: critical invariants must be documented next to `check()` and unique indexes.

## 7) Polymorphism

- Rule: polymorphic ownership/selection must enforce exact shape with `check()` constraints.
- Why: prevents partially-filled rows and ambiguous runtime resolution.

## 8) Operational Scripts

- `bun run db:guard`: schema guard checks (notes, lifecycle duplication, tenant-boundary warnings).
- `bun run db:migrate`: apply migrations.
- `bun run db:seed`: seed local demo data.

---

If a new use case conflicts with these rules, add the use case to the backlog and evolve this guide explicitly instead of ad-hoc exceptions.
