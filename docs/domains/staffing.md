---
tags:
  - bizing
  - domain
  - generated
  - staffing
---

# Staffing Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/staffing.ts`
- Schema file: `packages/db/src/schema/time_availability.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Staffing and substitution routes.

ELI5:
The schema already had a strong staffing backbone:
- capability templates describe what a person/resource can do,
- capability assignments attach those skills/certifications to resources,
- staffing demands describe "we need someone here at this time",
- staffing responses track accepts/declines/claims,
- staffing assignments track the final posted person.

This route file turns that backbone into API proof surfaces so sagas, agents,
and eventually product UI can validate internal staffing and replacement
workflows without writing directly to the database.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/resource-capability-templates`
- `POST` `/api/v1/bizes/:bizId/resource-capability-templates`
- `GET` `/api/v1/bizes/:bizId/resource-capability-assignments`
- `POST` `/api/v1/bizes/:bizId/resource-capability-assignments`
- `GET` `/api/v1/bizes/:bizId/staffing-demands`
- `POST` `/api/v1/bizes/:bizId/staffing-demands`
- `GET` `/api/v1/bizes/:bizId/staffing-demands/:demandId`
- `GET` `/api/v1/bizes/:bizId/staffing-demands/:demandId/candidates`
- `POST` `/api/v1/bizes/:bizId/staffing-demands/:demandId/dispatch`
- `GET` `/api/v1/bizes/:bizId/staffing-demands/:demandId/responses`
- `PATCH` `/api/v1/bizes/:bizId/staffing-responses/:responseId`
- `POST` `/api/v1/bizes/:bizId/staffing-demands/:demandId/assignments`
- `GET` `/api/v1/bizes/:bizId/staffing-demands/:demandId/assignments`
- `GET` `/api/v1/bizes/:bizId/staffing-demands/:demandId/history`

## Tables

- `calendars`
- `calendar_bindings`
- `availability_rule_templates`
- `availability_rule_template_items`
- `calendar_rule_template_bindings`
- `calendar_rule_template_binding_exclusion_dates`
- `calendar_overlays`
- `availability_rules`
- `availability_rule_exclusion_dates`
- `availability_gates`
- `availability_dependency_rules`
- `availability_dependency_rule_targets`
- `capacity_pools`
- `capacity_pool_members`
- `capacity_hold_policies`
- `capacity_hold_demand_alerts`
- `capacity_holds`
- `capacity_hold_events`
- `calendar_revisions`
- `calendar_timeline_events`
- `calendar_owner_timeline_events`
- `availability_resolution_runs`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
