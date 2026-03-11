---
tags:
  - bizing
  - domain
  - generated
  - group-accounts
---

# Group Accounts Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/group-accounts.ts`
- Schema file: `packages/db/src/schema/group_accounts.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Group account routes.

ELI5:
A group account is one shared container for people who act together.

Examples:
- a parent managing bookings for a child,
- a family sharing credits or memberships,
- a company contact booking for employees.

Why this exists:
- the schema already had `group_accounts` and `group_account_members`
- the API needed a clean surface so real UIs, plugins, and sagas can use
  those rows directly instead of hiding the relationship inside loose JSON
- guardian/minor and household scenarios become much easier to prove when
  the relationship is explicit and queryable

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/group-accounts`
- `POST` `/api/v1/bizes/:bizId/group-accounts`
- `PATCH` `/api/v1/bizes/:bizId/group-accounts/:groupAccountId`
- `GET` `/api/v1/bizes/:bizId/group-accounts/:groupAccountId/members`
- `POST` `/api/v1/bizes/:bizId/group-accounts/:groupAccountId/members`

## Tables

- `group_accounts`
- `group_account_members`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
