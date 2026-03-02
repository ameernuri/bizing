---
tags:
  - bizing
  - domain
  - generated
  - crm
---

# Crm Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/crm.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/crm.ts`

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

- `GET` `/bizes/:bizId/crm/pipelines`
- `POST` `/bizes/:bizId/crm/pipelines`
- `GET` `/bizes/:bizId/crm/pipelines/:pipelineId/stages`
- `POST` `/bizes/:bizId/crm/pipelines/:pipelineId/stages`
- `GET` `/bizes/:bizId/crm/contacts`
- `POST` `/bizes/:bizId/crm/contacts`
- `GET` `/bizes/:bizId/crm/leads`
- `POST` `/bizes/:bizId/crm/leads`
- `PATCH` `/bizes/:bizId/crm/leads/:leadId`
- `POST` `/bizes/:bizId/crm/lead-intake`
- `GET` `/bizes/:bizId/crm/opportunities`
- `POST` `/bizes/:bizId/crm/opportunities`
- `GET` `/bizes/:bizId/crm/contacts/:contactId/summary`

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
