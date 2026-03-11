---
tags:
  - bizing
  - domain
  - generated
  - demand-pricing
---

# Demand Pricing Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/demand-pricing.ts`
- Schema file: `packages/db/src/schema/demand_pricing.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Demand pricing routes (biz-scoped).

ELI5:
This module lets a biz configure "when demand is high, adjust price like this"
rules as first-class data. It avoids stuffing surge logic into ad-hoc metadata.

Why this matters:
- Saga coverage can assert a real API capability for demand pricing.
- Policies are reusable and queryable by APIs, agents, and future workers.
- Validation is deterministic, so rows are always understandable.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/demand-pricing/policies`
- `POST` `/api/v1/bizes/:bizId/demand-pricing/policies`

## Tables

- `demand_signal_definitions`
- `demand_signal_observations`
- `demand_pricing_policies`
- `demand_pricing_policy_signals`
- `demand_pricing_policy_tiers`
- `demand_pricing_evaluations`
- `demand_pricing_applications`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
