# Agents API Surface

This API exposes an agent-friendly, API-first tool layer.

## Endpoints

- `GET /api/v1/agents/manifest`
- `GET /api/v1/agents/tools` (auth required)
- `GET /api/v1/agents/search?q=<query>` (auth required)
- `POST /api/v1/agents/execute` (auth required)

## Execute payload

```json
{
  "tool": "bizing.bookingOrders.create",
  "params": {
    "bizId": "biz_xxx",
    "offerId": "offer_xxx",
    "offerVersionId": "offer_version_xxx",
    "subtotalMinor": 10000,
    "taxMinor": 0,
    "feeMinor": 0,
    "discountMinor": 0
  },
  "runId": "saga_run_xxx",
  "stepKey": "customer-book-primary"
}
```

`runId` + `stepKey` are optional.  
When provided, the server automatically stores an `api_trace` artifact for that
saga step so pass/fail evidence is server-recorded (not just agent-reported).

## Saga lifecycle testing tools

The tool registry now includes saga lifecycle operations so agents can run
end-to-end business simulations without direct DB access:

- `bizing.sagas.specs.list`
- `bizing.sagas.specs.generate`
- `bizing.sagas.runs.create`
- `bizing.sagas.runs.list`
- `bizing.sagas.runs.archive`
- `bizing.sagas.runs.archiveBulk`
- `bizing.sagas.runs.get`
- `bizing.sagas.runs.coverage`
- `bizing.sagas.steps.reportResult`
- `bizing.sagas.artifacts.addSnapshot`
- `bizing.sagas.artifacts.addApiTrace`
- `bizing.sagas.artifacts.submitReport`
- `bizing.sagas.testMode.next`

`bizing.sagas.artifacts.addSnapshot` supports a `view.blocks` contract
(`snapshot.v1`) so agents can submit simplified screen states (alerts, tables,
forms, lists, calendars, actions) instead of opaque JSON blobs.
Use optional `rawData` for request/response/deep payload inspection in the
admin UI Data tab.

Example test-mode call:

```json
{
  "tool": "bizing.sagas.testMode.next",
  "params": {
    "sagaKey": "uc-1-the-solo-entrepreneur-sarah"
  }
}
```

## Public customer surfaces

These API tools support external customer discovery/booking without internal
biz membership:

- `bizing.public.offers.list`
- `bizing.public.bookingOrders.listMine`
- `bizing.public.bookingOrders.create`

## Security model

- Tools are wrappers over REST endpoints only.
- No SQL or table-level executor is exposed.
- Membership and role checks are enforced by destination routes.
- Saga steps should only be marked `passed` after trace-backed API execution.

## Realtime updates

The API exposes websocket events for live saga dashboard updates:

- `ws://localhost:6129/api/v1/ws/sagas` (session cookie auth)
- Commands:
  - `{"type":"subscribe_list"}`
  - `{"type":"subscribe_run","runId":"saga_run_..."}`

## Hybrid auth model

The API supports both human and machine authentication:

- Human/browser: Better Auth cookie sessions.
- Machine/agent: API keys + short-lived bearer tokens.

Machine credential endpoints:

- `GET /api/v1/auth/api-keys`
- `POST /api/v1/auth/api-keys`
- `POST /api/v1/auth/api-keys/{apiCredentialId}/revoke`
- `POST /api/v1/auth/tokens/exchange`
- `POST /api/v1/auth/tokens/{tokenId}/revoke`

Agent routes accept:

- Cookie session.
- `Authorization: Bearer <access-token>` (short-lived token from exchange).
- `Authorization: ApiKey <api-key>` or `x-api-key` only when key policy allows direct use.
