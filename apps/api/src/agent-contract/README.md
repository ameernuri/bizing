# Agent Contract Layer (Pre-REST Schema Testing)

This module gives Bizing a **stable, strict testing contract** for AI agents before
final REST API design is complete.

## Why this exists

- We want to test schema coverage deeply across use cases.
- We do not want to lock into REST endpoint shapes yet.
- We still need deterministic, auditable request behavior.

So this layer uses:
1. Natural language translation (`translate`) into canonical command JSON.
2. Canonical command execution (`execute`) against real database tables.
3. Dry-run mode by default (transaction rollback safety).
4. Scenario runner for LLM-generated use-case batches.

## Route summary

- `GET /api/v1/agent/schema`
  - Returns runtime schema catalog (table/column metadata).
  - Optional query param: `table=<alias_or_table_name>` for focused metadata.

- `POST /api/v1/agent/translate`
  - Input: natural language sentence + optional scope.
  - Output: canonical pseudo request.

- `POST /api/v1/agent/execute`
  - Input: canonical pseudo request.
  - Output: execution result + SQL trace.

- `POST /api/v1/agent/simulate`
  - Input: natural language sentence + optional scope.
  - Internally does translate + execute with forced dry-run.

- `POST /api/v1/agent/scenarios/run`
  - Input: list of scenarios (prompt-based and/or direct request-based).
  - Output: per-scenario translation/execution results.

## Canonical request envelope

```json
{
  "requestId": "optional",
  "idempotencyKey": "optional",
  "dryRun": true,
  "scope": {
    "bizId": "biz_...",
    "locationId": "optional",
    "actorUserId": "optional"
  },
  "command": {
    "kind": "query | mutate | batch",
    "...": "see types.ts"
  }
}
```

## Safety model

- Table and column identifiers are resolved through introspected schema catalog.
- Unknown tables/columns are rejected.
- Tenant-scoped tables require `scope.bizId`.
- Tenant filter (`biz_id = scope.bizId`) is auto-applied when missing.
- Dry-run requests execute and then rollback all writes.

## Example: natural language -> simulate

```bash
curl -X POST http://localhost:6131/api/v1/agent/simulate \
  -H 'content-type: application/json' \
  -d '{
    "input": "list booking orders where status = confirmed limit 5",
    "scope": { "bizId": "biz_123" }
  }'
```

## Example: scenario runner

```json
{
  "defaults": {
    "dryRun": true,
    "scope": { "bizId": "biz_123" }
  },
  "scenarios": [
    {
      "name": "List recent booking orders",
      "prompt": "list booking orders limit 3"
    },
    {
      "name": "Update one order status",
      "prompt": "update booking orders set status = confirmed where id = bo_123"
    }
  ]
}
```

## Important limitation (intentional)

Translator is currently heuristic and deterministic. This is intentional to keep
behavior reproducible. If needed later, we can add an optional LLM-backed
translation mode that still validates against the same canonical schemas.
