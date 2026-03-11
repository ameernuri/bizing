---
tags:
  - bizing
  - domain
  - generated
  - dispatch
---

# Dispatch Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/dispatch.ts`
- Schema file: `packages/db/src/schema/transportation.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Dispatch/transport read-model routes (biz-scoped).

Why this exists:
- Sagas need a first-class way to validate route/dispatch operational state.
- Agents need one API endpoint that summarizes "what's happening right now"
  without joining many tables client-side.

This is intentionally read-only for now. Mutations can be added later with
the same scope/ACL model.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/dispatch/routes`
- `POST` `/api/v1/bizes/:bizId/dispatch/routes`
- `POST` `/api/v1/bizes/:bizId/dispatch/routes/:routeId/stops`
- `POST` `/api/v1/bizes/:bizId/dispatch/trips`
- `GET` `/api/v1/bizes/:bizId/dispatch/trips/:tripId`
- `POST` `/api/v1/bizes/:bizId/dispatch/tasks`
- `POST` `/api/v1/bizes/:bizId/dispatch/trips/:tripId/eta-events`
- `GET` `/api/v1/bizes/:bizId/dispatch/state`

## Tables

- `fleet_vehicles`
- `transport_routes`
- `transport_route_stops`
- `transport_trips`
- `trip_stop_inventory`
- `trip_manifests`
- `dispatch_tasks`
- `eta_events`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
