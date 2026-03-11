---
tags:
  - bizing
  - domain
  - generated
  - calendar-sharing
---

# Calendar Sharing Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/calendar-sharing.ts`
- Schema file: `packages/db/src/schema/calendar_sync.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Calendar sharing / external calendar routes.

ELI5:
A user owns their calendars. They can connect external providers once, pick
which feeds matter, and then grant each biz a different visibility contract.

These routes turn that schema into API proof surfaces for:
- one user sharing one or many calendar sources with a biz,
- time-boxed/revocable grants,
- free/busy vs detailed visibility,
- optional write-back permission for busy blocks.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/users/me/calendar-sync-connections`
- `POST` `/api/v1/users/me/calendar-sync-connections`
- `GET` `/api/v1/users/me/external-calendars`
- `POST` `/api/v1/users/me/external-calendars`
- `POST` `/api/v1/users/me/external-calendar-events`
- `GET` `/api/v1/users/me/calendar-access-grants`
- `POST` `/api/v1/users/me/calendar-access-grants`
- `PATCH` `/api/v1/users/me/calendar-access-grants/:grantId`
- `GET` `/api/v1/users/me/calendar-access-grant-sources`
- `POST` `/api/v1/users/me/calendar-access-grant-sources`
- `GET` `/api/v1/bizes/:bizId/calendar-access-grants`

## Tables

- `calendar_sync_connections`
- `external_calendars`
- `calendar_access_grants`
- `calendar_access_grant_sources`
- `external_calendar_events`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
