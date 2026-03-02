---
tags:
  - bizing
  - domain
  - generated
  - channels
---

# Channels Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/channels.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/channels.ts`

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

- `GET` `/bizes/:bizId/channel-accounts`
- `POST` `/bizes/:bizId/channel-accounts`
- `GET` `/bizes/:bizId/channel-sync-states`
- `POST` `/bizes/:bizId/channel-sync-states`
- `GET` `/bizes/:bizId/channel-entity-links`
- `POST` `/bizes/:bizId/channel-entity-links`
- `POST` `/bizes/:bizId/channel-accounts/:channelAccountId/external-bookings`
- `POST` `/bizes/:bizId/channel-accounts/:channelAccountId/external-bookings/:bookingOrderId/attendance`
- `GET` `/bizes/:bizId/channel-accounts/:channelAccountId/reconciliation`
- `GET` `/bizes/:bizId/channel-accounts/:channelAccountId/capacity-allocation`
- `POST` `/bizes/:bizId/channel-accounts/:channelAccountId/social-booking-links`
- `GET` `/public/bizes/:bizId/social-booking-links`
- `GET` `/bizes/:bizId/channel-insights`

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
