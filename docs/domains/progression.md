---
tags:
  - bizing
  - domain
  - generated
  - progression
---

# Progression Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/progression.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/progression.ts`

## Route Intent (top JSDoc)

Progression / prerequisite routes.

ELI5:
A requirement set is a reusable unlock rulebook.
Nodes are the individual checks.
Edges connect those checks into a graph.
Evaluations record "did this learner/subject pass the gate?"

Why this route exists:
- course gating, onboarding checklists, and unlock flows all need the same
  canonical graph model,
- the schema already has progression tables,
- sagas need an API surface for prerequisite and unlock proofs.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/bizes/:bizId/requirement-sets`
- `POST` `/bizes/:bizId/requirement-sets`
- `GET` `/bizes/:bizId/requirement-sets/:requirementSetId/nodes`
- `POST` `/bizes/:bizId/requirement-nodes`
- `POST` `/bizes/:bizId/requirement-edges`
- `GET` `/bizes/:bizId/requirement-evaluations`
- `POST` `/bizes/:bizId/requirement-evaluations`
- `POST` `/bizes/:bizId/requirement-evidence-links`

## Tables

- `requirement_sets`
- `requirement_nodes`
- `requirement_edges`
- `requirement_evaluations`
- `requirement_evidence_links`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
