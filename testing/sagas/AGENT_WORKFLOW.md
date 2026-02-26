# Agent Workflow (Saga Test Mode)

This document is the practical playbook for agents running lifecycle tests.

## 1) Discover available saga specs

Use agents tool endpoint:

- `bizing.sagas.specs.list`

Optional refresh from disk:
- pass `sync=true`

## 2) Create or resume a run

Two options:

1. Explicit create:
   - tool: `bizing.sagas.runs.create`
   - params: `{ "sagaKey": "<key>", "mode": "dry_run" }`
2. Test-mode auto:
   - tool: `bizing.sagas.testMode.next`
   - params: `{ "sagaKey": "<key>" }`
   - if no pending/running run exists, API creates one automatically.

## 3) Execute steps in loop

Repeat until no pending steps:

1. Get next step:
   - `bizing.sagas.testMode.next` with `runId`
2. Read `nextStep.instruction` and perform actions using normal API tools.
3. Submit step result:
   - `bizing.sagas.steps.reportResult`
   - status: `passed | failed | blocked | skipped`
4. Attach evidence:
   - snapshot: `bizing.sagas.artifacts.addSnapshot`
   - include only real data returned by API.
   - preferred format is `snapshot.v1` using `view.blocks` to represent
     what the user actually saw (form fields, list rows, calendar events, alerts).
5. Read coverage verdict:
   - `bizing.sagas.runs.coverage`
   - use this as final source of truth (`full | partial | gap`).

## 4) Submit final report

When lifecycle is complete:

- tool: `bizing.sagas.artifacts.submitReport`
- payload:
  - `markdown`: full findings
  - `summary`: compact machine-readable metrics (optional)

Reports are stored in:

- `testing/sagas/reports/<runId>.md`

## 5) Inspect in UI

Open:

- `/sagas`

You can inspect:
- run status and success rates
- per-step outcomes
- snapshots and report artifacts

## Snapshot payload shape (`snapshot.v1`)

Preferred payload for `bizing.sagas.artifacts.addSnapshot`:

```json
{
  "runId": "saga_run_xxx",
  "stepKey": "customer-book-primary",
  "screenKey": "customer_booking_confirmation",
  "title": "Customer booking confirmation",
  "status": "passed",
  "route": "/offers/career-coaching/confirmation",
  "view": {
    "title": "Booking confirmation",
    "subtitle": "Your booking is confirmed",
    "blocks": [
      {
        "type": "alert",
        "title": "Booking confirmed",
        "message": "Receipt emailed to customer",
        "tone": "success"
      },
      {
        "type": "key_value",
        "title": "Booking details",
        "items": [
          { "label": "Booking ID", "value": "booking_order_xxx" },
          { "label": "Starts", "value": "2026-02-24T17:00:00Z" },
          { "label": "Total", "value": "$150.00" }
        ]
      },
      {
        "type": "list",
        "title": "Visible actions",
        "items": [
          { "primary": "Download receipt" },
          { "primary": "Reschedule" },
          { "primary": "Cancel" }
        ]
      }
    ]
  },
  "rawData": {
    "request": { "offerVersionId": "offer_version_xxx" },
    "response": { "bookingOrderId": "booking_order_xxx", "status": "confirmed" },
    "apiCalls": [
      { "method": "POST", "path": "/api/v1/bizes/:id/booking-orders", "status": 201 }
    ]
  }
}
```

Supported block types:

- `alert`
- `stats`
- `key_value`
- `table`
- `list`
- `actions`
- `form`
- `calendar`
- `raw_json`

Legacy fallback:

- You may still send `data` for backward compatibility.
- API normalizes legacy payloads into `snapshot.v1` automatically.
- Use `view.blocks` whenever possible for better visual output in `/sagas`.
- Include `rawData` whenever possible for deep JSON inspection in the `Data` tab.

## Report checklist

Every final report should include:

1. Scenario id (`sagaKey`) and `runId`
2. Pass/fail summary by phase
3. Hard failures (with stepKey + reason)
4. Security/ACL findings
5. Data consistency findings
6. Suggested schema/API changes
7. Coverage verdict (`full | partial | gap`) and why
