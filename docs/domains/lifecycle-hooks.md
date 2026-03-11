---
tags:
  - bizing
  - domain
  - generated
  - lifecycle-hooks
---

# Lifecycle Hooks Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/lifecycle-hooks.ts`
- Schema file: `packages/db/src/schema/extensions.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Lifecycle event + webhook delivery routes.

ELI5:
A lifecycle event is the "something happened" fact.
A lifecycle-event subscription is the "tell me when that happens" rule.
A delivery row is one concrete attempt/result of sending that event to one listener.

Why this route exists:
- webhook-heavy use cases need a canonical API surface,
- retry/debug dashboards need explicit delivery rows,
- sagas should validate hook behavior through normal endpoints.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/lifecycle-events`
- `POST` `/api/v1/bizes/:bizId/lifecycle-events`
- `GET` `/api/v1/bizes/:bizId/lifecycle-event-subscriptions`
- `POST` `/api/v1/bizes/:bizId/lifecycle-event-subscriptions`
- `PATCH` `/api/v1/bizes/:bizId/lifecycle-event-subscriptions/:subscriptionId`
- `GET` `/api/v1/bizes/:bizId/lifecycle-hook-contracts`
- `POST` `/api/v1/bizes/:bizId/lifecycle-hook-contracts`
- `GET` `/api/v1/bizes/:bizId/lifecycle-hook-contracts/:contractId/versions`
- `POST` `/api/v1/bizes/:bizId/lifecycle-hook-contracts/:contractId/versions`
- `GET` `/api/v1/bizes/:bizId/automation-hook-bindings`
- `POST` `/api/v1/bizes/:bizId/automation-hook-bindings`
- `PATCH` `/api/v1/bizes/:bizId/automation-hook-bindings/:bindingId`
- `GET` `/api/v1/bizes/:bizId/automation-hook-runs`
- `GET` `/api/v1/bizes/:bizId/lifecycle-hook-invocations`
- `GET` `/api/v1/bizes/:bizId/lifecycle-hook-invocations/:invocationId/effects`
- `GET` `/api/v1/bizes/:bizId/automation-hook-catalog`
- `POST` `/api/v1/bizes/:bizId/automation-hooks/execute`
- `GET` `/api/v1/bizes/:bizId/lifecycle-event-deliveries`
- `POST` `/api/v1/bizes/:bizId/lifecycle-event-deliveries`
- `PATCH` `/api/v1/bizes/:bizId/lifecycle-event-deliveries/:deliveryId`
- `POST` `/api/v1/bizes/:bizId/lifecycle-event-subscriptions/:subscriptionId/test`
- `POST` `/api/v1/bizes/:bizId/lifecycle-event-deliveries/:deliveryId/retry`
- `GET` `/api/v1/bizes/:bizId/lifecycle-event-deliveries/worker-health`
- `POST` `/api/v1/bizes/:bizId/lifecycle-event-deliveries/process`
- `POST` `/api/v1/lifecycle-event-deliveries/process-all`

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
