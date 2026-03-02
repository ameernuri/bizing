---
tags:
  - bizing
  - domain
  - generated
  - workflows
---

# Workflows Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/workflows.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/workflows.ts`

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

- `POST` `/bizes/:bizId/review-queues`
- `GET` `/bizes/:bizId/review-queues`
- `GET` `/bizes/:bizId/review-queue-items`
- `POST` `/bizes/:bizId/review-queue-items`
- `GET` `/bizes/:bizId/review-queue-items/:reviewQueueItemId`
- `GET` `/bizes/:bizId/workflows`
- `GET` `/bizes/:bizId/workflows/:workflowInstanceId`
- `GET` `/bizes/:bizId/workflows/:workflowInstanceId/steps`
- `GET` `/bizes/:bizId/workflows/:workflowInstanceId/decisions`
- `GET` `/bizes/:bizId/async-deliverables`
- `GET` `/bizes/:bizId/async-deliverables/:asyncDeliverableId`

## Tables

- `review_queues`
- `review_queue_items`
- `workflow_instances`
- `workflow_steps`
- `workflow_decisions`
- `async_deliverables`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
