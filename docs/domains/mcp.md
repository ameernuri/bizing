---
tags:
  - bizing
  - domain
  - generated
  - mcp
---

# Mcp Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/mcp.ts`
- Schema file: `packages/db/src/schema/governance.ts`
- Mount path: `/agents`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Agents / MCP-style API adapter.

This surface exists so AI agents can discover and execute API actions using
structured tools, without touching SQL or database internals.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/agents/manifest`
- `GET` `/api/v1/agents/tools`
- `GET` `/api/v1/agents/search`
- `GET` `/api/v1/agents/openapi/catalog`
- `GET` `/api/v1/agents/openapi.json`
- `POST` `/api/v1/agents/execute`

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
