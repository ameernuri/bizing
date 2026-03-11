---
tags:
  - bizing
  - domain
  - generated
  - workflows
---

# Workflows Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/workflows.ts`
- Schema file: `packages/db/src/schema/workflows.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Workflow + review runtime routes.

ELI5:
The action backbone answers:
- what someone tried to do
- what event happened

These routes answer the next layer:
- what long-running process started because of that
- what inbox/review item was created
- what step the workflow is currently on
- what deliverable/output is waiting later

This is intentionally read-first for now. We want humans and agents to be
able to inspect process state before we add mutation-heavy intervention APIs.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/workflow-definitions`
- `POST` `/api/v1/bizes/:bizId/workflow-definitions`
- `GET` `/api/v1/bizes/:bizId/workflow-definitions/:workflowDefinitionId/versions`
- `POST` `/api/v1/bizes/:bizId/workflow-definitions/:workflowDefinitionId/versions`
- `GET` `/api/v1/bizes/:bizId/workflow-definition-triggers`
- `POST` `/api/v1/bizes/:bizId/workflow-definition-triggers`
- `GET` `/api/v1/bizes/:bizId/workflow-trigger-invocations`
- `POST` `/api/v1/bizes/:bizId/workflow-triggers/dispatch`
- `POST` `/api/v1/bizes/:bizId/review-queues`
- `GET` `/api/v1/bizes/:bizId/review-queues`
- `GET` `/api/v1/bizes/:bizId/review-queue-items`
- `POST` `/api/v1/bizes/:bizId/review-queue-items`
- `GET` `/api/v1/bizes/:bizId/review-queue-items/:reviewQueueItemId`
- `GET` `/api/v1/bizes/:bizId/workflows`
- `GET` `/api/v1/bizes/:bizId/workflows/:workflowInstanceId`
- `GET` `/api/v1/bizes/:bizId/workflows/:workflowInstanceId/steps`
- `GET` `/api/v1/bizes/:bizId/workflows/:workflowInstanceId/decisions`
- `GET` `/api/v1/bizes/:bizId/async-deliverables`
- `GET` `/api/v1/bizes/:bizId/async-deliverables/:asyncDeliverableId`

## Tables

- `workflow_definitions`
- `workflow_definition_versions`
- `workflow_definition_triggers`
- `review_queues`
- `review_queue_items`
- `workflow_instances`
- `workflow_trigger_invocations`
- `workflow_steps`
- `workflow_decisions`
- `async_deliverables`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
