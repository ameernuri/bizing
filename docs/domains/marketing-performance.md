---
tags:
  - bizing
  - domain
  - generated
  - marketing-performance
---

# Marketing Performance Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/marketing-performance.ts`
- Schema file: `packages/db/src/schema/marketing_performance.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Marketing performance routes.

ELI5:
These routes turn "marketing happened somewhere else" into first-class Bizing
facts:
- who is in an audience,
- what got synced,
- how much we spent,
- what conversion values we pushed back out,
- and simple profitability math built from those facts.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/marketing/audience-segments`
- `POST` `/api/v1/bizes/:bizId/marketing/audience-segments`
- `GET` `/api/v1/bizes/:bizId/marketing/audience-segments/:segmentId/memberships`
- `POST` `/api/v1/bizes/:bizId/marketing/audience-segments/:segmentId/memberships`
- `GET` `/api/v1/bizes/:bizId/marketing/audience-sync-runs`
- `POST` `/api/v1/bizes/:bizId/marketing/audience-sync-runs`
- `GET` `/api/v1/bizes/:bizId/ad-spend-daily-facts`
- `POST` `/api/v1/bizes/:bizId/ad-spend-daily-facts`
- `GET` `/api/v1/bizes/:bizId/offline-conversion-pushes`
- `POST` `/api/v1/bizes/:bizId/offline-conversion-pushes`
- `GET` `/api/v1/bizes/:bizId/marketing/overview`

## Tables

- `marketing_audience_segments`
- `marketing_audience_segment_memberships`
- `marketing_audience_sync_runs`
- `ad_spend_daily_facts`
- `offline_conversion_pushes`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
