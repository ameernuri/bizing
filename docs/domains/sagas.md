---
tags:
  - bizing
  - domain
  - generated
  - sagas
---

# Sagas Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/sagas.ts`
- Schema file: `packages/db/src/schema/sagas.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

_No top JSDoc comment found._

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/ooda/sagas/docs`
- `GET` `/api/v1/ooda/sagas/llm/health`
- `POST` `/api/v1/ooda/sagas/library/sync-docs`
- `POST` `/api/v1/ooda/sagas/library/reset-reseed`
- `POST` `/api/v1/ooda/sagas/schema-coverage/import`
- `POST` `/api/v1/ooda/sagas/schema-coverage/reports`
- `POST` `/api/v1/ooda/sagas/uc-coverage/rebuild`
- `GET` `/api/v1/ooda/sagas/library/overview`
- `GET` `/api/v1/ooda/sagas/use-cases`
- `POST` `/api/v1/ooda/sagas/use-cases`
- `GET` `/api/v1/ooda/sagas/use-cases/:ucKey`
- `PATCH` `/api/v1/ooda/sagas/use-cases/:ucKey`
- `POST` `/api/v1/ooda/sagas/use-cases/:ucKey/versions`
- `DELETE` `/api/v1/ooda/sagas/use-cases/:ucKey`
- `GET` `/api/v1/ooda/sagas/personas`
- `POST` `/api/v1/ooda/sagas/personas`
- `GET` `/api/v1/ooda/sagas/personas/:personaKey`
- `PATCH` `/api/v1/ooda/sagas/personas/:personaKey`
- `POST` `/api/v1/ooda/sagas/personas/:personaKey/versions`
- `DELETE` `/api/v1/ooda/sagas/personas/:personaKey`
- `GET` `/api/v1/ooda/sagas/library/related`
- `GET` `/api/v1/ooda/sagas/definitions/:sagaKey/links`
- `GET` `/api/v1/ooda/sagas/run-assessments/reports`
- `GET` `/api/v1/ooda/sagas/run-assessments/reports/:reportId`
- `GET` `/api/v1/ooda/sagas/schema-coverage/reports`
- `GET` `/api/v1/ooda/sagas/schema-coverage/reports/:reportId`
- `GET` `/api/v1/ooda/sagas/uc-coverage/reports`
- `GET` `/api/v1/ooda/sagas/uc-coverage/reports/:reportId`
- `GET` `/api/v1/ooda/sagas/coverage/reports`
- `GET` `/api/v1/ooda/sagas/coverage/reports/:reportId`
- `GET` `/api/v1/ooda/sagas/specs`
- `POST` `/api/v1/ooda/sagas/specs`
- `POST` `/api/v1/ooda/sagas/specs/generate`
- `POST` `/api/v1/ooda/sagas/specs/depth/reclassify`
- `POST` `/api/v1/ooda/sagas/specs/sync`
- `PUT` `/api/v1/ooda/sagas/specs/:sagaKey`
- `POST` `/api/v1/ooda/sagas/specs/:sagaKey/revisions`
- `GET` `/api/v1/ooda/sagas/specs/:sagaKey/revisions`
- `DELETE` `/api/v1/ooda/sagas/specs/:sagaKey`
- `GET` `/api/v1/ooda/sagas/specs/:sagaKey`
- `POST` `/api/v1/ooda/sagas/runs`
- `GET` `/api/v1/ooda/sagas/runs`
- `GET` `/api/v1/ooda/sagas/runs/:runId`
- `POST` `/api/v1/ooda/sagas/runs/:runId/refresh`
- `POST` `/api/v1/ooda/sagas/runs/:runId/execute`
- `GET` `/api/v1/ooda/sagas/runs/:runId/clock`
- `POST` `/api/v1/ooda/sagas/runs/:runId/clock/advance`
- `GET` `/api/v1/ooda/sagas/runs/:runId/scheduler/jobs`
- `POST` `/api/v1/ooda/sagas/runs/:runId/scheduler/jobs`
- `PATCH` `/api/v1/ooda/sagas/runs/:runId/scheduler/jobs/:jobId`
- `GET` `/api/v1/ooda/sagas/runs/:runId/actors`
- `GET` `/api/v1/ooda/sagas/runs/:runId/messages`
- `POST` `/api/v1/ooda/sagas/runs/:runId/messages`
- `GET` `/api/v1/ooda/sagas/runs/:runId/coverage`
- `POST` `/api/v1/ooda/sagas/runs/:runId/archive`
- `POST` `/api/v1/ooda/sagas/runs/archive`
- `POST` `/api/v1/ooda/sagas/runs/:runId/steps/:stepKey/result`
- `POST` `/api/v1/ooda/sagas/runs/:runId/steps/:stepKey/exploratory-evaluate`
- `POST` `/api/v1/ooda/sagas/runs/:runId/snapshots`
- `POST` `/api/v1/ooda/sagas/runs/:runId/report`
- `POST` `/api/v1/ooda/sagas/runs/:runId/traces`
- `GET` `/api/v1/ooda/sagas/runs/:runId/artifacts/:artifactId/content`
- `GET` `/api/v1/ooda/sagas/runs/:runId/test-mode`
- `GET` `/api/v1/ooda/sagas/test-mode/next`

## Tables

- `saga_definitions`
- `saga_runs`
- `saga_run_simulation_clocks`
- `saga_run_scheduler_jobs`
- `saga_definition_revisions`
- `saga_run_steps`
- `saga_run_artifacts`
- `saga_run_actor_profiles`
- `saga_run_actor_messages`
- `saga_use_cases`
- `saga_use_case_versions`
- `saga_personas`
- `saga_persona_versions`
- `saga_definition_links`
- `saga_coverage_reports`
- `saga_coverage_items`
- `saga_tags`
- `saga_tag_bindings`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
