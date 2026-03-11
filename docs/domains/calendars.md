---
tags:
  - bizing
  - domain
  - generated
  - calendars
---

# Calendars Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/calendars.ts`
- Schema file: `packages/db/src/schema/time_availability.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Calendar + availability routes (biz-scoped).

Why this route module matters:
- Calendars are the time-control backbone for resources, services, offers,
  service-products, locations, and user-level sharing flows.
- Availability rules and bindings need explicit API support so agents can
  configure scenarios directly without SQL.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/calendars`
- `POST` `/api/v1/bizes/:bizId/calendars`
- `GET` `/api/v1/bizes/:bizId/calendars/:calendarId`
- `PATCH` `/api/v1/bizes/:bizId/calendars/:calendarId`
- `DELETE` `/api/v1/bizes/:bizId/calendars/:calendarId`
- `GET` `/api/v1/bizes/:bizId/calendars/:calendarId/timeline`
- `GET` `/api/v1/bizes/:bizId/calendar-bindings`
- `POST` `/api/v1/bizes/:bizId/calendar-bindings`
- `PATCH` `/api/v1/bizes/:bizId/calendar-bindings/:bindingId`
- `DELETE` `/api/v1/bizes/:bizId/calendar-bindings/:bindingId`
- `GET` `/api/v1/bizes/:bizId/calendars/:calendarId/availability-rules`
- `POST` `/api/v1/bizes/:bizId/calendars/:calendarId/availability-rules`
- `PATCH` `/api/v1/bizes/:bizId/calendars/:calendarId/availability-rules/:ruleId`
- `DELETE` `/api/v1/bizes/:bizId/calendars/:calendarId/availability-rules/:ruleId`
- `GET` `/api/v1/bizes/:bizId/calendars/:calendarId/capacity-holds`
- `POST` `/api/v1/bizes/:bizId/calendars/:calendarId/capacity-holds`
- `PATCH` `/api/v1/bizes/:bizId/calendars/:calendarId/capacity-holds/:holdId`
- `GET` `/api/v1/bizes/:bizId/calendars/:calendarId/dependency-rules`
- `POST` `/api/v1/bizes/:bizId/calendars/:calendarId/dependency-rules`

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
