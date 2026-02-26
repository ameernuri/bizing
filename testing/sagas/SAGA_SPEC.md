# Saga Spec Contract (`saga.v0`)

Saga specs are JSON files in `testing/sagas/specs/*.json`.

Each file describes one full lifecycle simulation (owner setup -> customer usage -> abuse attempts -> reporting evidence).

## Required top-level fields

- `schemaVersion`: must be `"saga.v0"`
- `sagaKey`: stable machine key
- `title`
- `description`
- `actors[]`
- `phases[]`

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

## Minimal example

```json
{
  "schemaVersion": "saga.v0",
  "sagaKey": "uc-1-solo-consultant-sarah",
  "title": "UC-1 • The Solo Consultant • Sarah",
  "description": "End-to-end lifecycle simulation.",
  "tags": ["uc-derived", "lifecycle"],
  "defaults": {
    "runMode": "dry_run",
    "continueOnFailure": false
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
