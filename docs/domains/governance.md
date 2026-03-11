---
tags:
  - bizing
  - domain
  - generated
  - governance
---

# Governance Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/governance.ts`
- Schema file: `packages/db/src/schema/governance.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Governance incident routes.

ELI5:
A policy breach is "the rule was broken".
A consequence is "what happened because of that breach".

These routes expose the normalized incident ledger directly so sagas can
prove immutable evidence, consequence lifecycle, and financial traceability.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/policy-breach-events`
- `POST` `/api/v1/bizes/:bizId/policy-breach-events`
- `GET` `/api/v1/bizes/:bizId/policy-consequence-events`
- `POST` `/api/v1/bizes/:bizId/policy-consequence-events`
- `PATCH` `/api/v1/bizes/:bizId/policy-consequence-events/:consequenceId`

## Tables

- `tenant_compliance_profiles`
- `data_residency_policies`
- `retention_policies`
- `legal_holds`
- `privacy_identity_modes`
- `data_subject_requests`
- `redaction_jobs`
- `policy_templates`
- `policy_rules`
- `policy_bindings`
- `policy_breach_events`
- `policy_consequence_events`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
