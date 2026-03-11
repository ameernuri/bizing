---
tags:
  - bizing
  - domain
  - generated
  - seating
---

# Seating Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/seating.ts`
- Schema file: `packages/db/src/schema/seating.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Seating routes.

ELI5:
These routes expose the seat-map backbone directly:
- a seat map is the drawing/rules for a seatable space,
- seats are the actual selectable spots,
- holds are temporary "someone is paying right now" locks,
- reservations are committed seat claims.

Why this matters:
- ticketing and reserved-capacity use cases need concrete seat APIs,
- the saga runner should validate seat flows by calling the API, not by
  inferring state from raw tables,
- this route family stays generic enough for theaters, classrooms, buses,
  boats, custom subjects, and any future seatable layout.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/seat-maps`
- `POST` `/api/v1/bizes/:bizId/seat-maps`
- `GET` `/api/v1/bizes/:bizId/seat-maps/:seatMapId`
- `GET` `/api/v1/bizes/:bizId/seat-maps/:seatMapId/seats`
- `POST` `/api/v1/bizes/:bizId/seat-maps/:seatMapId/seats`
- `GET` `/api/v1/bizes/:bizId/seat-maps/:seatMapId/holds`
- `POST` `/api/v1/bizes/:bizId/seat-maps/:seatMapId/holds`
- `PATCH` `/api/v1/bizes/:bizId/seat-holds/:seatHoldId`
- `POST` `/api/v1/bizes/:bizId/seat-maps/:seatMapId/holds/expire`
- `GET` `/api/v1/bizes/:bizId/seat-maps/:seatMapId/reservations`
- `POST` `/api/v1/bizes/:bizId/seat-maps/:seatMapId/reservations`

## Tables

- `seat_maps`
- `seat_map_seats`
- `seat_holds`
- `seat_reservations`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
