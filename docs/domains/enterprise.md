---
tags:
  - bizing
  - domain
  - generated
  - enterprise
---

# Enterprise Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/enterprise.ts`
- Schema file: `packages/db/src/schema/enterprise.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Enterprise / franchise routes.

ELI5:
These routes expose the reusable parent-child business network model.
The same API can represent a franchise network, a corporate portfolio,
a regional operating group, or a shared-service structure.

Why this route exists:
- enterprise/franchise use cases need deterministic APIs,
- the schema already models scopes, relationships, rollups, and
  intercompany accounting lanes,
- sagas should validate those ideas through normal API reads/writes.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/enterprise/relationship-templates`
- `POST` `/api/v1/bizes/:bizId/enterprise/relationship-templates`
- `GET` `/api/v1/bizes/:bizId/enterprise/relationships`
- `POST` `/api/v1/bizes/:bizId/enterprise/relationships`
- `GET` `/api/v1/bizes/:bizId/enterprise/scopes`
- `POST` `/api/v1/bizes/:bizId/enterprise/scopes`
- `GET` `/api/v1/bizes/:bizId/enterprise/intercompany-accounts`
- `POST` `/api/v1/bizes/:bizId/enterprise/intercompany-accounts`
- `GET` `/api/v1/bizes/:bizId/enterprise/intercompany-entries`
- `POST` `/api/v1/bizes/:bizId/enterprise/intercompany-entries`
- `GET` `/api/v1/bizes/:bizId/enterprise/contract-pack-templates`
- `POST` `/api/v1/bizes/:bizId/enterprise/contract-pack-templates`
- `GET` `/api/v1/bizes/:bizId/enterprise/contract-pack-versions`
- `POST` `/api/v1/bizes/:bizId/enterprise/contract-pack-versions`
- `GET` `/api/v1/bizes/:bizId/enterprise/contract-pack-bindings`
- `POST` `/api/v1/bizes/:bizId/enterprise/contract-pack-bindings`
- `GET` `/api/v1/bizes/:bizId/enterprise/admin-delegations`
- `POST` `/api/v1/bizes/:bizId/enterprise/admin-delegations`
- `PATCH` `/api/v1/bizes/:bizId/enterprise/admin-delegations/:delegationId`
- `GET` `/api/v1/bizes/:bizId/enterprise/approval-authority-limits`
- `POST` `/api/v1/bizes/:bizId/enterprise/approval-authority-limits`
- `PATCH` `/api/v1/bizes/:bizId/enterprise/approval-authority-limits/:limitId`
- `GET` `/api/v1/bizes/:bizId/enterprise/identity-providers`
- `POST` `/api/v1/bizes/:bizId/enterprise/identity-providers`
- `GET` `/api/v1/bizes/:bizId/enterprise/scim-sync-states`
- `POST` `/api/v1/bizes/:bizId/enterprise/scim-sync-states`
- `PATCH` `/api/v1/bizes/:bizId/enterprise/scim-sync-states/:syncStateId`
- `GET` `/api/v1/bizes/:bizId/enterprise/directory-links`
- `POST` `/api/v1/bizes/:bizId/enterprise/directory-links`
- `PATCH` `/api/v1/bizes/:bizId/enterprise/directory-links/:directoryLinkId`
- `GET` `/api/v1/bizes/:bizId/enterprise/intercompany-settlement-runs`
- `POST` `/api/v1/bizes/:bizId/enterprise/intercompany-settlement-runs`
- `PATCH` `/api/v1/bizes/:bizId/enterprise/intercompany-settlement-runs/:settlementRunId`
- `GET` `/api/v1/bizes/:bizId/enterprise/change-rollout-runs`
- `POST` `/api/v1/bizes/:bizId/enterprise/change-rollout-runs`
- `GET` `/api/v1/bizes/:bizId/enterprise/change-rollout-targets`
- `POST` `/api/v1/bizes/:bizId/enterprise/change-rollout-targets`
- `PATCH` `/api/v1/bizes/:bizId/enterprise/change-rollout-targets/:rolloutTargetId`
- `GET` `/api/v1/bizes/:bizId/enterprise/change-rollout-results`
- `POST` `/api/v1/bizes/:bizId/enterprise/change-rollout-results`
- `GET` `/api/v1/bizes/:bizId/enterprise/revenue-daily`
- `POST` `/api/v1/bizes/:bizId/enterprise/revenue-daily`

## Tables

- `enterprise_relationship_templates`
- `enterprise_relationships`
- `enterprise_scopes`
- `enterprise_inheritance_strategies`
- `enterprise_inheritance_resolutions`
- `enterprise_admin_delegations`
- `enterprise_approval_authority_limits`
- `enterprise_intercompany_accounts`
- `enterprise_intercompany_settlement_runs`
- `enterprise_intercompany_entries`
- `enterprise_contract_pack_templates`
- `enterprise_contract_pack_versions`
- `enterprise_contract_pack_bindings`
- `enterprise_identity_providers`
- `enterprise_scim_sync_states`
- `enterprise_external_directory_links`
- `fact_enterprise_revenue_daily`
- `fact_enterprise_utilization_daily`
- `fact_enterprise_compliance_daily`
- `enterprise_change_rollout_runs`
- `enterprise_change_rollout_targets`
- `enterprise_change_rollout_results`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
