---
tags:
  - bizing
  - domain
  - generated
  - crm
---

# Crm Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/crm.ts`
- Schema file: `packages/db/src/schema/crm.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

CRM routes.

ELI5:
These endpoints expose the "people and deals" side of the platform.

Why this file exists:
- use cases talk about CRM sync, leads, and opportunities,
- the schema already has first-class CRM tables,
- but without routes, agents and UI cannot prove that CRM concepts are part
  of the canonical API surface.

Design rule:
- keep these routes generic,
- do not hardcode Salesforce/HubSpot semantics into the schema,
- let integrations push/pull through the same canonical CRM objects.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/crm/pipelines`
- `POST` `/api/v1/bizes/:bizId/crm/pipelines`
- `GET` `/api/v1/bizes/:bizId/crm/pipelines/:pipelineId/stages`
- `POST` `/api/v1/bizes/:bizId/crm/pipelines/:pipelineId/stages`
- `GET` `/api/v1/bizes/:bizId/crm/contacts`
- `POST` `/api/v1/bizes/:bizId/crm/contacts`
- `GET` `/api/v1/bizes/:bizId/crm/leads`
- `POST` `/api/v1/bizes/:bizId/crm/leads`
- `PATCH` `/api/v1/bizes/:bizId/crm/leads/:leadId`
- `POST` `/api/v1/bizes/:bizId/crm/lead-intake`
- `GET` `/api/v1/bizes/:bizId/crm/opportunities`
- `POST` `/api/v1/bizes/:bizId/crm/opportunities`
- `GET` `/api/v1/bizes/:bizId/crm/contacts/:contactId/summary`

## Tables

- `crm_contacts`
- `crm_contact_channels`
- `crm_pipelines`
- `crm_pipeline_stages`
- `crm_leads`
- `crm_lead_events`
- `crm_opportunities`
- `crm_opportunity_stage_events`
- `crm_conversations`
- `crm_conversation_participants`
- `crm_conversation_messages`
- `crm_merge_candidates`
- `crm_merge_decisions`
- `crm_subject_redirects`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
