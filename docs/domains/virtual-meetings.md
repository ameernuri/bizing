---
tags:
  - bizing
  - domain
  - generated
  - virtual-meetings
---

# Virtual Meetings Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/virtual-meetings.ts`
- Schema file: `packages/db/src/schema/channels.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Virtual meeting routes.

ELI5:
A remote booking often needs a real meeting room with settings like:
- primary join link,
- fallback link,
- waiting room,
- recording mode,
- host-joins-first policy.

Why this route exists:
- those are booking fulfillment details, not random UI text,
- the schema already has generic channel-account and entity-link primitives,
- saga validation needs an API proof surface for "this booking got a unique
  virtual room with the right safety settings and delivery message".

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/booking-orders/:bookingOrderId/virtual-meeting`
- `POST` `/api/v1/bizes/:bizId/booking-orders/:bookingOrderId/virtual-meeting`

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
