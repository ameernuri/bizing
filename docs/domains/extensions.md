---
tags:
  - bizing
  - domain
  - generated
  - extensions
---

# Extensions Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/extensions.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/extensions.ts`

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

- `GET` `/extensions/catalog`
- `POST` `/extensions/catalog`
- `POST` `/bizes/:bizId/extensions/catalog`
- `GET` `/bizes/:bizId/extensions/installs`
- `POST` `/bizes/:bizId/extensions/installs`
- `PATCH` `/bizes/:bizId/extensions/installs/:installId`
- `GET` `/bizes/:bizId/extensions/installs/:installId`
- `POST` `/bizes/:bizId/extensions/catalog/:extensionDefinitionId/permissions`
- `GET` `/bizes/:bizId/extensions/installs/:installId/permissions`
- `POST` `/bizes/:bizId/extensions/installs/:installId/permission-grants`
- `PATCH` `/bizes/:bizId/extensions/installs/:installId/permission-grants/:grantId`
- `GET` `/bizes/:bizId/extensions/installs/:installId/state-documents`
- `POST` `/bizes/:bizId/extensions/installs/:installId/state-documents`
- `PATCH` `/bizes/:bizId/extensions/installs/:installId/state-documents/:documentId`
- `GET` `/bizes/:bizId/extensions/installs/:installId/projection-checkpoints`
- `POST` `/bizes/:bizId/extensions/installs/:installId/projection-checkpoints`

## Tables

- `extension_definitions`
- `biz_extension_installs`
- `extension_permission_definitions`
- `biz_extension_permission_grants`
- `extension_state_documents`
- `lifecycle_event_subscriptions`
- `lifecycle_event_deliveries`
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
