# Saga Spec Contract (`saga.v1`)

Saga specs are JSON files in `testing/sagas/specs/*.json`.

Each file describes one full lifecycle simulation (owner setup -> customer usage -> abuse attempts -> reporting evidence).

## Required top-level fields

- `schemaVersion`: canonical value is `"saga.v1"`
- `sagaKey`: stable machine key
- `title`
- `description`
- `simulation`
- `actors[]`
- `phases[]`

## Simulation model (new in v1)

`simulation` defines how the runtime handles time and waits.

- `clock`
  - `mode`: `virtual` or `realtime` (default `virtual`)
  - `startAt`: optional initial timestamp for the run clock
  - `timezone`: display hint for timeline rendering
  - `autoAdvance`: whether runner can advance virtual time automatically
- `scheduler`
  - `mode`: `deterministic` or `realtime`
  - `defaultPollMs`: fallback polling interval for condition waits
  - `defaultTimeoutMs`: fallback timeout for condition waits
  - `maxTicksPerStep`: safety cap for wait loops

ELI5:
- virtual clock means "jump time instantly" so tests stay fast.
- scheduler means "track delayed/conditional waits as real job rows" so they are debuggable.

## Phase model

Each phase contains ordered steps:

- `phaseKey`
- `order`
- `title`
- `description`
- `steps[]`

## Step model

Each step must explain exactly what an agent should do:

- `stepKey`
- `order`
- `title`
- `actorKey`
- `intent`
- `instruction`
- `expectedResult`
- `toolHints[]` (optional)
- `assertions[]` (optional)
- `evidenceRequired[]` (optional)
- `delay` (optional)

## Delay model

`delay.mode` is one of:
- `none`
- `fixed`
- `until_condition`

`fixed` requires:
- `delayMs`

`until_condition` requires:
- `conditionKey`
- optional `timeoutMs`
- optional `pollMs`

Runtime behavior:
- waits are executed through scheduler jobs and run clock advancement
- no wall-clock sleeping is required in virtual mode

## Minimal example

```json
{
  "schemaVersion": "saga.v1",
  "sagaKey": "uc-1-solo-consultant-sarah",
  "title": "UC-1 • The Solo Consultant • Sarah",
  "description": "End-to-end lifecycle simulation.",
  "tags": ["uc-derived", "lifecycle"],
  "defaults": {
    "runMode": "dry_run",
    "continueOnFailure": false
  },
  "simulation": {
    "clock": {
      "mode": "virtual",
      "timezone": "UTC",
      "autoAdvance": true
    },
    "scheduler": {
      "mode": "deterministic",
      "defaultPollMs": 1000,
      "defaultTimeoutMs": 30000,
      "maxTicksPerStep": 500
    }
  },
  "source": {
    "useCaseRef": "UC-1",
    "personaRef": "P-1"
  },
  "objectives": [
    "Validate owner setup to customer booking lifecycle."
  ],
  "actors": [
    {
      "actorKey": "biz_owner",
      "name": "The Solo Entrepreneur (Sarah)",
      "role": "owner"
    }
  ],
  "phases": [
    {
      "phaseKey": "owner-onboarding",
      "order": 1,
      "title": "Owner Onboarding",
      "description": "Owner signs up and creates biz.",
      "steps": [
        {
          "stepKey": "owner-create-biz",
          "order": 1,
          "title": "Create biz",
          "actorKey": "biz_owner",
          "intent": "Create tenant root",
          "instruction": "Create biz using API tool.",
          "expectedResult": "Biz created with captured id."
        }
      ]
    }
  ],
  "metadata": {}
}
```

## Authoring rules

- Keep instructions natural-language and explicit.
- Always include at least one security/abuse step.
- Require snapshots for major lifecycle milestones.
- Snapshots should represent user-visible screens (not raw backend blobs).
- Do not use fake/placeholder output in evidence; use API-returned real data.
- Keep `sagaKey` stable once used in reports/run history.

## Snapshot guideline

When a step requires snapshot evidence, capture the outcome in UI terms:

- `alert` for success/error feedback user sees
- `form` for values + validation state
- `list`/`table` for rows visible on listing screens
- `calendar` for schedule/availability state
- `key_value` for detail pages (booking confirmation, profile details, etc.)

Use the API endpoint:

- `POST /api/v1/sagas/runs/:runId/snapshots`

Preferred payload uses the `snapshot.v1` `view.blocks` model.
