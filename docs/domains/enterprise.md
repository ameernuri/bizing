---
tags:
  - bizing
  - domain
  - generated
  - enterprise
---

# Enterprise Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/enterprise.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/enterprise.ts`

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

- `GET` `/bizes/:bizId/enterprise/relationship-templates`
- `POST` `/bizes/:bizId/enterprise/relationship-templates`
- `GET` `/bizes/:bizId/enterprise/relationships`
- `POST` `/bizes/:bizId/enterprise/relationships`
- `GET` `/bizes/:bizId/enterprise/scopes`
- `POST` `/bizes/:bizId/enterprise/scopes`
- `GET` `/bizes/:bizId/enterprise/intercompany-accounts`
- `POST` `/bizes/:bizId/enterprise/intercompany-accounts`
- `GET` `/bizes/:bizId/enterprise/intercompany-entries`
- `POST` `/bizes/:bizId/enterprise/intercompany-entries`
- `GET` `/bizes/:bizId/enterprise/contract-pack-templates`
- `POST` `/bizes/:bizId/enterprise/contract-pack-templates`
- `GET` `/bizes/:bizId/enterprise/contract-pack-versions`
- `POST` `/bizes/:bizId/enterprise/contract-pack-versions`
- `GET` `/bizes/:bizId/enterprise/contract-pack-bindings`
- `POST` `/bizes/:bizId/enterprise/contract-pack-bindings`
- `GET` `/bizes/:bizId/enterprise/admin-delegations`
- `POST` `/bizes/:bizId/enterprise/admin-delegations`
- `PATCH` `/bizes/:bizId/enterprise/admin-delegations/:delegationId`
- `GET` `/bizes/:bizId/enterprise/approval-authority-limits`
- `POST` `/bizes/:bizId/enterprise/approval-authority-limits`
- `PATCH` `/bizes/:bizId/enterprise/approval-authority-limits/:limitId`
- `GET` `/bizes/:bizId/enterprise/identity-providers`
- `POST` `/bizes/:bizId/enterprise/identity-providers`
- `GET` `/bizes/:bizId/enterprise/scim-sync-states`
- `POST` `/bizes/:bizId/enterprise/scim-sync-states`
- `PATCH` `/bizes/:bizId/enterprise/scim-sync-states/:syncStateId`
- `GET` `/bizes/:bizId/enterprise/directory-links`
- `POST` `/bizes/:bizId/enterprise/directory-links`
- `PATCH` `/bizes/:bizId/enterprise/directory-links/:directoryLinkId`
- `GET` `/bizes/:bizId/enterprise/intercompany-settlement-runs`
- `POST` `/bizes/:bizId/enterprise/intercompany-settlement-runs`
- `PATCH` `/bizes/:bizId/enterprise/intercompany-settlement-runs/:settlementRunId`
- `GET` `/bizes/:bizId/enterprise/change-rollout-runs`
- `POST` `/bizes/:bizId/enterprise/change-rollout-runs`
- `GET` `/bizes/:bizId/enterprise/change-rollout-targets`
- `POST` `/bizes/:bizId/enterprise/change-rollout-targets`
- `PATCH` `/bizes/:bizId/enterprise/change-rollout-targets/:rolloutTargetId`
- `GET` `/bizes/:bizId/enterprise/change-rollout-results`
- `POST` `/bizes/:bizId/enterprise/change-rollout-results`
- `GET` `/bizes/:bizId/enterprise/revenue-daily`
- `POST` `/bizes/:bizId/enterprise/revenue-daily`

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
