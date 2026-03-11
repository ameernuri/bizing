---
tags:
  - bizing
  - domain
  - generated
  - notification-endpoints
---

# Notification Endpoints Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/notification-endpoints.ts`
- Schema file: `packages/db/src/schema/social_graph.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Notification endpoint routes.

ELI5:
A "notification endpoint" is one place where a user can be reached.
Examples:
- in-app inbox,
- email address,
- phone number for SMS,
- push token,
- webhook destination.

Why this route exists:
- the schema already has a first-class endpoint registry,
- subscription and event-delivery flows need a real API surface,
- sagas should prove endpoint ownership/defaulting/lifecycle behavior
  through HTTP, not by reading tables directly.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/users/me/notification-endpoints`
- `POST` `/api/v1/users/me/notification-endpoints`
- `PATCH` `/api/v1/users/me/notification-endpoints/:endpointId`

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
