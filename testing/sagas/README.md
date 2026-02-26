# Saga Testing Workspace

This directory is the canonical, in-repo home for lifecycle testing specs and evidence.

## Why this exists

The goal is to answer one question repeatedly and objectively:

`Does the current schema + API support real business lifecycle use-cases end-to-end?`

Everything here is designed for:
- humans steering product quality
- agents executing realistic scenarios
- fast iteration loops (generate -> run -> report -> improve -> rerun)

## Directory layout

- `specs/`: JSON saga definitions (source-of-truth for lifecycle scenarios)
- `runs/<runId>/`: per-run artifacts (snapshots, traces, attachments)
- `reports/`: run-level markdown reports
- `docs/`: optional generated helper docs for saga tooling
- `SAGA_SPEC.md`: spec contract and authoring guidance
- `AGENT_WORKFLOW.md`: exact execution loop for testing agents

## Standard loop

1. Generate or edit saga specs.
2. Sync specs into DB definitions:
   - `POST /api/v1/sagas/specs/sync`
3. Create run:
   - `POST /api/v1/sagas/runs`
   - Optional cleanup/archive:
     - `POST /api/v1/sagas/runs/:runId/archive`
     - `POST /api/v1/sagas/runs/archive`
4. Execute steps with agent via the agents endpoint:
   - `GET /api/v1/sagas/test-mode/next`
   - step result: `POST /api/v1/sagas/runs/:runId/steps/:stepKey/result`
5. Attach evidence:
   - snapshots: `POST /api/v1/sagas/runs/:runId/snapshots`
   - traces: `POST /api/v1/sagas/runs/:runId/traces`
   - final report: `POST /api/v1/sagas/runs/:runId/report`
6. Review run in UI:
   - `/sagas`
7. Improve schema/API and rerun with new run id.

## Sagas UI (Debug UX)

The `/sagas` screen is optimized for run debugging:

- Recent runs panel uses an independent scroll area so long run lists do not block detail inspection.
- Step detail opens in a dialog, including instruction, expected result, failure, and structured payload snapshots.
- Artifact viewing opens in a dialog (instead of inline), with better focus for debugging.
- Snapshots render as low-fi UI approximations from `snapshot.v1` blocks
  (alerts, forms, tables, lists, calendars) so you can inspect what users saw.
- Artifact titles are normalized to avoid confusing `undefined snapshot` labels.

## Snapshot standard

- Preferred artifact payload uses `view.blocks` (`snapshot.v1`).
- Block model is designed for "UI screenshot intent", not raw DB-ish payload dumps.
- Legacy `data` payloads are accepted, but API auto-normalizes them and results
  are less expressive than explicit block-based snapshots.

## Generator commands

Generate specs from comprehensive UCs + tester personas:

```bash
bun run --cwd /Users/ameer/bizing/code/apps/api sagas:generate
```

Generate subset:

```bash
bun run --cwd /Users/ameer/bizing/code/apps/api sagas:generate -- --uc=UC-1,UC-2 --limit=2
```

Rerun all saga specs with the API-only auto-runner:

```bash
bun run --cwd /Users/ameer/bizing/code/apps/api sagas:rerun
```

Rerun a single saga:

```bash
SAGA_KEY=uc-1-the-solo-entrepreneur-sarah bun run --cwd /Users/ameer/bizing/code/apps/api sagas:rerun
```

Optional limit (first N active saga specs):

```bash
SAGA_LIMIT=25 bun run --cwd /Users/ameer/bizing/code/apps/api sagas:rerun
```

Strict CI behavior (non-zero exit if any run fails):

```bash
SAGA_STRICT_EXIT=1 bun run --cwd /Users/ameer/bizing/code/apps/api sagas:rerun
```

## Interpreting rerun outcomes

- `passed`: step behavior matched expectations.
- `blocked`: scenario asked for capability not implemented yet (this is a product/API gap, not runner flakiness).
- `failed`: implemented behavior exists but did not satisfy the expected result.

Important:

- `No executor mapping` indicates runner drift and should be treated as infrastructure bug.
- `blocked` with an explicit missing primitive indicates honest coverage reporting.
- default rerun exit code is `0` (agent-friendly); set `SAGA_STRICT_EXIT=1` for hard-fail pipelines.
