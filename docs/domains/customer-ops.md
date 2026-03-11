---
tags:
  - bizing
  - domain
  - generated
  - customer-ops
---

# Customer Ops Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/customer-ops.ts`
- Schema file: `packages/db/src/schema/customer_ops.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Customer Operations routes.

ELI5:
This route family is the "customer operating system" API:
- CRM activities and tasks
- support cases and case events
- lifecycle marketing journeys
- customer autopilot playbooks

Design intent:
- keep sales/support/marketing cohesive around one customer profile anchor
- keep writes on canonical action runtime rails via the CRUD route bridge
- keep reads simple for humans and agents

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/customer-profiles`
- `POST` `/api/v1/bizes/:bizId/customer-profiles`
- `GET` `/api/v1/bizes/:bizId/customer-profiles/:profileId`
- `PATCH` `/api/v1/bizes/:bizId/customer-profiles/:profileId`
- `GET` `/api/v1/bizes/:bizId/customer-profiles/:profileId/identities`
- `POST` `/api/v1/bizes/:bizId/customer-profiles/:profileId/identities`
- `GET` `/api/v1/bizes/:bizId/customer-profiles/:profileId/crm-links`
- `POST` `/api/v1/bizes/:bizId/customer-profiles/:profileId/crm-links`
- `GET` `/api/v1/bizes/:bizId/customer-profiles/:profileId/timeline`
- `POST` `/api/v1/bizes/:bizId/customer-profiles/:profileId/timeline`
- `GET` `/api/v1/bizes/:bizId/support-cases`
- `POST` `/api/v1/bizes/:bizId/support-cases`
- `GET` `/api/v1/bizes/:bizId/support-cases/:caseId`
- `PATCH` `/api/v1/bizes/:bizId/support-cases/:caseId`
- `GET` `/api/v1/bizes/:bizId/support-cases/:caseId/events`
- `POST` `/api/v1/bizes/:bizId/support-cases/:caseId/events`
- `POST` `/api/v1/bizes/:bizId/support-cases/:caseId/participants`
- `POST` `/api/v1/bizes/:bizId/support-cases/:caseId/links`
- `GET` `/api/v1/bizes/:bizId/support-cases/:caseId/participants`
- `GET` `/api/v1/bizes/:bizId/support-cases/:caseId/links`
- `GET` `/api/v1/bizes/:bizId/customer-profile-merges`
- `POST` `/api/v1/bizes/:bizId/customer-profile-merges`
- `GET` `/api/v1/bizes/:bizId/customer-journeys`
- `POST` `/api/v1/bizes/:bizId/customer-journeys`
- `PATCH` `/api/v1/bizes/:bizId/customer-journeys/:journeyId`
- `GET` `/api/v1/bizes/:bizId/customer-journeys/:journeyId/steps`
- `POST` `/api/v1/bizes/:bizId/customer-journeys/:journeyId/steps`
- `GET` `/api/v1/bizes/:bizId/customer-journey-enrollments`
- `POST` `/api/v1/bizes/:bizId/customer-journey-enrollments`
- `PATCH` `/api/v1/bizes/:bizId/customer-journey-enrollments/:enrollmentId`
- `POST` `/api/v1/bizes/:bizId/customer-journey-enrollment-events`
- `GET` `/api/v1/bizes/:bizId/crm-activities`
- `POST` `/api/v1/bizes/:bizId/crm-activities`
- `GET` `/api/v1/bizes/:bizId/crm-tasks`
- `POST` `/api/v1/bizes/:bizId/crm-tasks`
- `PATCH` `/api/v1/bizes/:bizId/crm-tasks/:taskId`
- `GET` `/api/v1/bizes/:bizId/customer-playbooks`
- `POST` `/api/v1/bizes/:bizId/customer-playbooks`
- `PATCH` `/api/v1/bizes/:bizId/customer-playbooks/:playbookId`
- `POST` `/api/v1/bizes/:bizId/customer-playbook-bindings`
- `GET` `/api/v1/bizes/:bizId/customer-playbook-runs`
- `POST` `/api/v1/bizes/:bizId/customer-playbook-runs`

## Tables

- `customer_profile_crm_links`
- `customer_timeline_events`
- `crm_activities`
- `crm_tasks`
- `support_cases`
- `support_case_participants`
- `support_case_events`
- `support_case_links`
- `customer_journeys`
- `customer_journey_steps`
- `customer_journey_enrollments`
- `customer_journey_events`
- `customer_playbooks`
- `customer_playbook_bindings`
- `customer_playbook_runs`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
