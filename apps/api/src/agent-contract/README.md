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

- `POST /api/v1/agent/lifecycle/run`
  - Input: phase-based lifecycle pack with assertions + captures.
  - Output: per-step verdicts, phase summaries, issue classification.
  - Execution safety: each step runs behind a SQL savepoint so expected failing
    steps (for example overlap guard checks) do not corrupt the rest of the run.

- `GET /api/v1/agent/testing/catalog`
  - Lists discoverable test packs from `mind/workspace`.

- `POST /api/v1/agent/testing/run-loop`
  - Runs mixed suites (lifecycle + scenario + api_journey) and returns one consolidated fitness report.

- `POST /api/v1/agent/testing/run-default`
  - Runs the workspace default loop config (`agent-fitness-loop-v0.json`) for one-command agent execution.

- `GET /api/v1/agent/testing/openapi.json`
  - Minimal OpenAPI descriptor for Code Mode / UTCP HTTP manual discovery.

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
curl -X POST http://localhost:6129/api/v1/agent/simulate \
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

## Lifecycle runner (phase-based end-to-end simulation)

When you need to answer:
"Would this schema support the full product lifecycle if real API/UI existed?"
use `/api/v1/agent/lifecycle/run`.

### What lifecycle runner adds on top of scenario runner

- **Phases**: group steps by journey stage (setup, publish, browse, booking, edge cases).
- **Assertions**: verify expected success/failure, row counts, and path-level checks.
- **Captures**: save values from responses and reuse them in later steps.
- **Templates**: dynamic token interpolation in prompts/requests:
  - `{{id:biz}}` -> stable generated id for this run
  - `{{nowIso}}` -> current timestamp
  - `{{nowPlusMinutes:30}}` -> timestamp offset
  - `{{someCapturedVar}}` -> captured variable reference

### Minimal lifecycle payload shape

```json
{
  "defaults": {
    "dryRun": true,
    "scope": { "bizId": "{{id:biz}}" },
    "continueOnFailure": true
  },
  "variables": {
    "ownerUserId": "{{id:user}}"
  },
  "phases": [
    {
      "name": "Setup",
      "steps": [
        {
          "name": "Create business",
          "prompt": "insert into bizes id = {{id:biz}} name = Demo Biz slug = demo-biz-{{id:slug}} status = active timezone = America/Los_Angeles",
          "expect": { "success": true }
        }
      ]
    }
  ]
}
```

### Lifecycle output highlights

- `summary`: total/passed/failed steps.
- `phaseSummaries`: rollup per phase.
- `issues`: compact actionable failures with classification:
  - `scenario_contract`
  - `schema_constraint`
  - `expectation_mismatch`
  - `execution_error`
- `variables`: final capture/template variable bag for debugging and replay.

## Important limitation (intentional)

Translator is currently heuristic and deterministic. This is intentional to keep
behavior reproducible. If needed later, we can add an optional LLM-backed
translation mode that still validates against the same canonical schemas.
