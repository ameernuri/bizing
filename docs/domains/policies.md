---
tags:
  - bizing
  - domain
  - generated
  - policies
---

# Policies Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/policies.ts`
- Schema file: `packages/db/src/schema/governance.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Policy template/rule/binding routes.

ELI5:
A policy template is a reusable rulebook.
A policy rule is one rule inside that rulebook.
A policy binding says where the rulebook applies.

Why this route matters:
- many advanced use cases are "governance on top of core objects" rather
  than brand new niche tables,
- proctoring, agent safety, hybrid classroom controls, and compliance checks
  can all reuse the same canonical policy backbone,
- saga validators need first-class API endpoints to prove these controls.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/policies/templates`
- `POST` `/api/v1/bizes/:bizId/policies/templates`
- `GET` `/api/v1/bizes/:bizId/policies/templates/:policyTemplateId`
- `PATCH` `/api/v1/bizes/:bizId/policies/templates/:policyTemplateId`
- `GET` `/api/v1/bizes/:bizId/policies/templates/:policyTemplateId/rules`
- `POST` `/api/v1/bizes/:bizId/policies/templates/:policyTemplateId/rules`
- `GET` `/api/v1/bizes/:bizId/policies/bindings`
- `POST` `/api/v1/bizes/:bizId/policies/bindings`

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
