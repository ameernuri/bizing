---
tags:
  - bizing
  - domain
  - generated
  - sagas
---

# Sagas Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/sagas.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/sagas.ts`

## Route Intent (top JSDoc)

_No top JSDoc comment found._

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/ooda/sagas/docs`
- `GET` `/ooda/sagas/llm/health`
- `POST` `/ooda/sagas/library/sync-docs`
- `POST` `/ooda/sagas/library/reset-reseed`
- `POST` `/ooda/sagas/schema-coverage/import`
- `POST` `/ooda/sagas/schema-coverage/reports`
- `GET` `/ooda/sagas/library/overview`
- `GET` `/ooda/sagas/use-cases`
- `POST` `/ooda/sagas/use-cases`
- `GET` `/ooda/sagas/use-cases/:ucKey`
- `PATCH` `/ooda/sagas/use-cases/:ucKey`
- `POST` `/ooda/sagas/use-cases/:ucKey/versions`
- `DELETE` `/ooda/sagas/use-cases/:ucKey`
- `GET` `/ooda/sagas/personas`
- `POST` `/ooda/sagas/personas`
- `GET` `/ooda/sagas/personas/:personaKey`
- `PATCH` `/ooda/sagas/personas/:personaKey`
- `POST` `/ooda/sagas/personas/:personaKey/versions`
- `DELETE` `/ooda/sagas/personas/:personaKey`
- `GET` `/ooda/sagas/library/related`
- `GET` `/ooda/sagas/definitions/:sagaKey/links`
- `GET` `/ooda/sagas/run-assessments/reports`
- `GET` `/ooda/sagas/run-assessments/reports/:reportId`
- `GET` `/ooda/sagas/schema-coverage/reports`
- `GET` `/ooda/sagas/schema-coverage/reports/:reportId`
- `GET` `/ooda/sagas/coverage/reports`
- `GET` `/ooda/sagas/coverage/reports/:reportId`
- `GET` `/ooda/sagas/specs`
- `POST` `/ooda/sagas/specs`
- `POST` `/ooda/sagas/specs/generate`
- `POST` `/ooda/sagas/specs/sync`
- `PUT` `/ooda/sagas/specs/:sagaKey`
- `POST` `/ooda/sagas/specs/:sagaKey/revisions`
- `GET` `/ooda/sagas/specs/:sagaKey/revisions`
- `DELETE` `/ooda/sagas/specs/:sagaKey`
- `GET` `/ooda/sagas/specs/:sagaKey`
- `POST` `/ooda/sagas/runs`
- `GET` `/ooda/sagas/runs`
- `GET` `/ooda/sagas/runs/:runId`
- `POST` `/ooda/sagas/runs/:runId/refresh`
- `POST` `/ooda/sagas/runs/:runId/execute`
- `GET` `/ooda/sagas/runs/:runId/clock`
- `POST` `/ooda/sagas/runs/:runId/clock/advance`
- `GET` `/ooda/sagas/runs/:runId/scheduler/jobs`
- `POST` `/ooda/sagas/runs/:runId/scheduler/jobs`
- `PATCH` `/ooda/sagas/runs/:runId/scheduler/jobs/:jobId`
- `GET` `/ooda/sagas/runs/:runId/actors`
- `GET` `/ooda/sagas/runs/:runId/messages`
- `POST` `/ooda/sagas/runs/:runId/messages`
- `GET` `/ooda/sagas/runs/:runId/coverage`
- `POST` `/ooda/sagas/runs/:runId/archive`
- `POST` `/ooda/sagas/runs/archive`
- `POST` `/ooda/sagas/runs/:runId/steps/:stepKey/result`
- `POST` `/ooda/sagas/runs/:runId/steps/:stepKey/exploratory-evaluate`
- `POST` `/ooda/sagas/runs/:runId/snapshots`
- `POST` `/ooda/sagas/runs/:runId/report`
- `POST` `/ooda/sagas/runs/:runId/traces`
- `GET` `/ooda/sagas/runs/:runId/artifacts/:artifactId/content`
- `GET` `/ooda/sagas/runs/:runId/test-mode`
- `GET` `/ooda/sagas/test-mode/next`

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
