---
tags:
  - bizing
  - domain
  - generated
  - custom-fields
---

# Custom Fields Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/custom-fields.ts`
- Schema file: `packages/db/src/schema/extensions.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Custom field routes.

ELI5:
A custom field is "the business made up its own extra question/data point."

Examples:
- pet breed on a grooming booking
- preferred instructor on a customer profile
- internal color code on a service product

Why this route family exists:
- the schema already had generic custom-field tables
- without routes, those tables are just hidden capability
- this API makes custom fields first-class and reusable across many target
  types without baking industry-specific columns into core tables

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/custom-field-definitions`
- `POST` `/api/v1/bizes/:bizId/custom-field-definitions`
- `GET` `/api/v1/bizes/:bizId/custom-field-definitions/:definitionId/options`
- `POST` `/api/v1/bizes/:bizId/custom-field-definitions/:definitionId/options`
- `GET` `/api/v1/bizes/:bizId/custom-field-values`
- `POST` `/api/v1/bizes/:bizId/custom-field-values`

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
