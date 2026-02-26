# Saga API Contract (v0)

All endpoints are under `/api/v1/sagas`.

## Documentation

- `GET /sagas/docs`

## Specs

- `GET /sagas/specs`
- `POST /sagas/specs/generate`
- `POST /sagas/specs/sync`
- `GET /sagas/specs/:sagaKey`

## Runs

- `POST /sagas/runs`
- `GET /sagas/runs`
- `GET /sagas/runs/:runId`
- `GET /sagas/runs/:runId/coverage`
- `POST /sagas/runs/:runId/archive`
- `POST /sagas/runs/archive`

## Step reporting

- `POST /sagas/runs/:runId/steps/:stepKey/result`

## Evidence artifacts

- `POST /sagas/runs/:runId/snapshots`
- `POST /sagas/runs/:runId/traces`
- `POST /sagas/runs/:runId/report`
- `GET /sagas/runs/:runId/artifacts/:artifactId/content`

### Snapshot payload

Preferred (`snapshot.v1`):

- `stepKey?`
- `screenKey?` (auto-generated if omitted)
- `title?`
- `status?`
- `route?`
- `format` (`json` or `yaml`)
- `rawData?` (optional deep-inspection payload shown in Data tab)
- `view`:
  - `title?`
  - `subtitle?`
  - `blocks[]` where block type is one of:
    - `alert`
    - `stats`
    - `key_value`
    - `table`
    - `list`
    - `actions`
    - `form`
    - `calendar`
    - `raw_json`

Backward-compatible:

- `data` legacy payload still accepted and normalized server-side into `snapshot.v1`.

## Test-mode helpers

- `GET /sagas/runs/:runId/test-mode`
- `GET /sagas/test-mode/next`
