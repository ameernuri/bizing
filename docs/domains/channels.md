---
tags:
  - bizing
  - domain
  - generated
  - channels
---

# Channels Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/channels.ts`
- Schema file: `packages/db/src/schema/channels.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Channel integration routes (biz-scoped).

ELI5:
- Channel account: one external connector account (Google/ClassPass/custom).
- Sync state: last known sync cursor + health for an object type.
- Entity link: mapping between local object and external provider object id.

Why these routes exist:
- Saga lifecycle checks must verify external integration setup through API,
  not by writing metadata directly.
- These endpoints provide the minimal canonical integration backbone needed by
  current use-cases while staying generic for future connectors.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/channel-accounts`
- `POST` `/api/v1/bizes/:bizId/channel-accounts`
- `GET` `/api/v1/bizes/:bizId/channel-sync-states`
- `POST` `/api/v1/bizes/:bizId/channel-sync-states`
- `GET` `/api/v1/bizes/:bizId/channel-entity-links`
- `POST` `/api/v1/bizes/:bizId/channel-entity-links`
- `POST` `/api/v1/bizes/:bizId/channel-accounts/:channelAccountId/external-bookings`
- `POST` `/api/v1/bizes/:bizId/channel-accounts/:channelAccountId/external-bookings/:bookingOrderId/attendance`
- `GET` `/api/v1/bizes/:bizId/channel-accounts/:channelAccountId/reconciliation`
- `GET` `/api/v1/bizes/:bizId/channel-accounts/:channelAccountId/capacity-allocation`
- `POST` `/api/v1/bizes/:bizId/channel-accounts/:channelAccountId/social-booking-links`
- `GET` `/api/v1/public/bizes/:bizId/social-booking-links`
- `GET` `/api/v1/bizes/:bizId/channel-insights`

## Tables

- `channel_accounts`
- `channel_sync_states`
- `channel_entity_links`
- `channel_sync_jobs`
- `channel_sync_items`
- `channel_webhook_events`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
