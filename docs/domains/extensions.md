---
tags:
  - bizing
  - domain
  - generated
  - extensions
---

# Extensions Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/extensions.ts`
- Schema file: `packages/db/src/schema/extensions.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Extension catalog and tenant-install routes.

ELI5:
- `extension_definitions` is the app-store catalog entry.
- `biz_extension_installs` is one biz saying "we installed that app".
- `extension_state_documents` is the app's per-biz saved state.

Why this route exists:
- saga coverage needs a real API surface to prove plugin/extension state,
- tenant isolation should be demonstrated through normal biz-scoped reads,
- future extension UIs and agents should reuse one canonical contract.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/extensions/catalog`
- `POST` `/api/v1/extensions/catalog`
- `POST` `/api/v1/bizes/:bizId/extensions/catalog`
- `GET` `/api/v1/bizes/:bizId/extensions/installs`
- `POST` `/api/v1/bizes/:bizId/extensions/installs`
- `PATCH` `/api/v1/bizes/:bizId/extensions/installs/:installId`
- `GET` `/api/v1/bizes/:bizId/extensions/installs/:installId`
- `POST` `/api/v1/bizes/:bizId/extensions/catalog/:extensionDefinitionId/permissions`
- `GET` `/api/v1/bizes/:bizId/extensions/installs/:installId/permissions`
- `POST` `/api/v1/bizes/:bizId/extensions/installs/:installId/permission-grants`
- `PATCH` `/api/v1/bizes/:bizId/extensions/installs/:installId/permission-grants/:grantId`
- `GET` `/api/v1/bizes/:bizId/extensions/installs/:installId/state-documents`
- `POST` `/api/v1/bizes/:bizId/extensions/installs/:installId/state-documents`
- `PATCH` `/api/v1/bizes/:bizId/extensions/installs/:installId/state-documents/:documentId`
- `GET` `/api/v1/bizes/:bizId/extensions/installs/:installId/projection-checkpoints`
- `POST` `/api/v1/bizes/:bizId/extensions/installs/:installId/projection-checkpoints`

## Tables

- `extension_definitions`
- `biz_extension_installs`
- `extension_permission_definitions`
- `biz_extension_permission_grants`
- `extension_state_documents`
- `lifecycle_event_subscriptions`
- `lifecycle_event_deliveries`
- `lifecycle_hook_contracts`
- `lifecycle_hook_contract_versions`
- `lifecycle_hook_invocations`
- `automation_hook_bindings`
- `automation_hook_runs`
- `lifecycle_hook_effect_events`
- `idempotency_keys`
- `extension_service_connections`
- `extension_service_object_links`
- `extension_service_sync_jobs`
- `extension_service_sync_items`
- `extension_webhook_ingress_events`
- `extension_api_call_runs`
- `custom_field_definitions`
- `custom_field_definition_options`
- `custom_field_values`
- `extension_instances`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
