---
tags:
  - bizing
  - domain
  - generated
  - growth
---

# Growth Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/growth.ts`
- Schema file: `packages/db/src/schema/growth.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Growth backbone routes.

ELI5:
This domain unifies three capabilities under one extensible contract:
1) localization resources + resolved locale values,
2) experimentation (A/B + multi-variant assignments and metrics),
3) marketing activation runs (publish/sync bridges).

Why this exists:
- keeps growth logic API-first and auditable,
- keeps workflows and plugins integrated through domain events,
- avoids one-off endpoint logic spread across unrelated route modules.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/growth/localization/resources`
- `POST` `/api/v1/bizes/:bizId/growth/localization/resources`
- `GET` `/api/v1/bizes/:bizId/growth/localization/resources/:resourceId/values`
- `POST` `/api/v1/bizes/:bizId/growth/localization/resources/:resourceId/values`
- `POST` `/api/v1/bizes/:bizId/growth/localization/resolve`
- `GET` `/api/v1/bizes/:bizId/growth/experiments`
- `POST` `/api/v1/bizes/:bizId/growth/experiments`
- `GET` `/api/v1/bizes/:bizId/growth/experiments/:experimentId/variants`
- `POST` `/api/v1/bizes/:bizId/growth/experiments/:experimentId/variants`
- `GET` `/api/v1/bizes/:bizId/growth/experiments/:experimentId/assignments`
- `POST` `/api/v1/bizes/:bizId/growth/experiments/:experimentId/assignments`
- `GET` `/api/v1/bizes/:bizId/growth/experiments/:experimentId/measurements`
- `POST` `/api/v1/bizes/:bizId/growth/experiments/:experimentId/measurements`
- `GET` `/api/v1/bizes/:bizId/growth/experiments/:experimentId/summary`
- `GET` `/api/v1/bizes/:bizId/growth/marketing-activations`
- `POST` `/api/v1/bizes/:bizId/growth/marketing-activations`
- `GET` `/api/v1/bizes/:bizId/growth/marketing-activations/:activationId/runs`
- `POST` `/api/v1/bizes/:bizId/growth/marketing-activations/:activationId/runs`
- `GET` `/api/v1/bizes/:bizId/growth/marketing-activation-runs/:runId/items`

## Tables

- `growth_localization_resources`
- `growth_localization_values`
- `growth_experiments`
- `growth_experiment_variants`
- `growth_experiment_assignments`
- `growth_experiment_measurements`
- `growth_marketing_activations`
- `growth_marketing_activation_runs`
- `growth_marketing_activation_run_items`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
