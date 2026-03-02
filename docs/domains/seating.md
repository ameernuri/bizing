---
tags:
  - bizing
  - domain
  - generated
  - seating
---

# Seating Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/seating.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/seating.ts`

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

- `GET` `/bizes/:bizId/seat-maps`
- `POST` `/bizes/:bizId/seat-maps`
- `GET` `/bizes/:bizId/seat-maps/:seatMapId`
- `GET` `/bizes/:bizId/seat-maps/:seatMapId/seats`
- `POST` `/bizes/:bizId/seat-maps/:seatMapId/seats`
- `GET` `/bizes/:bizId/seat-maps/:seatMapId/holds`
- `POST` `/bizes/:bizId/seat-maps/:seatMapId/holds`
- `PATCH` `/bizes/:bizId/seat-holds/:seatHoldId`
- `POST` `/bizes/:bizId/seat-maps/:seatMapId/holds/expire`
- `GET` `/bizes/:bizId/seat-maps/:seatMapId/reservations`
- `POST` `/bizes/:bizId/seat-maps/:seatMapId/reservations`

## Tables

- `seat_maps`
- `seat_map_seats`
- `seat_holds`
- `seat_reservations`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
