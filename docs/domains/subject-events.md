---
tags:
  - bizing
  - domain
  - generated
  - subject-events
---

# Subject Events Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/subject-events.ts`
- Schema file: `packages/db/src/schema/social_graph.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Subject event and delivery routes.

ELI5:
A "subject event" is one immutable fact like:
- offer slots opened,
- queue threshold crossed,
- product restocked,
- custom plugin warning emitted.

A "delivery" row is the follow-up story for one subscriber/channel pair:
- queued,
- retried,
- delivered,
- seen,
- failed.

Why this route exists:
- the schema already has a proper event stream and delivery timeline,
- automation/saga/debug flows need API-level proof surfaces,
- subject events are designed to be generic so future domains can publish
  facts without inventing ad-hoc logging tables.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/subject-events`
- `POST` `/api/v1/bizes/:bizId/subject-events`
- `GET` `/api/v1/bizes/:bizId/subject-events/:subjectEventId`
- `GET` `/api/v1/bizes/:bizId/subject-event-deliveries`
- `POST` `/api/v1/bizes/:bizId/subject-event-deliveries`
- `PATCH` `/api/v1/bizes/:bizId/subject-event-deliveries/:deliveryId`

## Tables

- `graph_identities`
- `graph_identity_policies`
- `graph_relationships`
- `graph_relationship_events`
- `graph_audience_segments`
- `graph_audience_segment_members`
- `graph_feed_items`
- `graph_feed_item_links`
- `graph_feed_item_deliveries`
- `graph_subject_subscriptions`
- `graph_identity_notification_endpoints`
- `graph_subject_events`
- `graph_subject_event_deliveries`
- `graph_feed_item_audience_rules`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
