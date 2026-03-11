---
tags:
  - bizing
  - domain
  - generated
  - knowledge
---

# Knowledge Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/knowledge.ts`
- Schema file: `packages/db/src/schema/knowledge.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Canonical knowledge-plane routes.

Why this route family exists:
- gives Codex/OpenClaw/Bizing agents one shared memory API
- stores ingest history, chunk/embedding state, retrieval traces, and
  agent checkpoints in one auditable place
- enables "are both agents in sync?" checks with deterministic cursor rows

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/knowledge/stats`
- `GET` `/api/v1/knowledge/sources`
- `POST` `/api/v1/knowledge/sources`
- `PATCH` `/api/v1/knowledge/sources/:sourceId`
- `GET` `/api/v1/knowledge/documents`
- `GET` `/api/v1/knowledge/documents/:documentId`
- `POST` `/api/v1/knowledge/documents`
- `POST` `/api/v1/knowledge/documents/:documentId/rechunk`
- `GET` `/api/v1/knowledge/chunks`
- `POST` `/api/v1/knowledge/chunks/:chunkId/embed`
- `POST` `/api/v1/knowledge/query`
- `POST` `/api/v1/knowledge/edges`
- `POST` `/api/v1/knowledge/sources/:sourceId/ingest-files`
- `GET` `/api/v1/knowledge/agent-runs`
- `POST` `/api/v1/knowledge/agent-runs`
- `GET` `/api/v1/knowledge/checkpoints`
- `GET` `/api/v1/knowledge/events`
- `GET` `/api/v1/knowledge/retrieval-traces`
- `GET` `/api/v1/knowledge/sync-status`
- `PUT` `/api/v1/knowledge/checkpoints/:agentKind/:agentName`

## Tables

- `knowledge_sources`
- `knowledge_documents`
- `knowledge_chunks`
- `knowledge_embeddings`
- `knowledge_edges`
- `knowledge_agent_runs`
- `knowledge_retrieval_traces`
- `knowledge_events`
- `knowledge_checkpoints`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
