---
tags:
  - bizing
  - domain
  - generated
  - subject-subscriptions
---

# Subject Subscriptions Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/subject-subscriptions.ts`
- Schema file: `packages/db/src/schema/social_graph.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Subject-subscription routes (biz-scoped).

ELI5:
- A "subject subscription" means "this identity wants updates about that subject".
- Subject can be anything in the shared `subjects` registry (offer, resource,
  custom plugin entity, etc.).
- These endpoints provide first-class API support for:
  - subscriber identity linkage,
  - lifecycle status (active/muted/unsubscribed),
  - delivery mode/channel preferences,
  - delivery throttling controls,
  - tenant-safe target binding.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/subject-subscriptions`
- `POST` `/api/v1/bizes/:bizId/subject-subscriptions`
- `PATCH` `/api/v1/bizes/:bizId/subject-subscriptions/:subscriptionId`

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
