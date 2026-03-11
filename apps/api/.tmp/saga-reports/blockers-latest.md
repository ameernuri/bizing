# Saga Blocker Report

- generatedAt: `2026-03-05T04:59:09.016Z`
- total: 476
- passed: 467
- failed: 9
- durationMs: 860230
- totalFailedRuns: 9
- totalFailures: 10

## By Domain
- general: 10

## Top Blockers
### general | runtime | no-endpoint
- count: 3
- sagas: hole-34-inventory-replenishment-procurement-deep, hole-34-inventory-replenishment-procurement-medium, hole-34-inventory-replenishment-procurement-shallow
- steps: inventory-adversary-cross-scope-denied
- example: API failure for GET /api/v1/bizes/3AVmAtfwJb46QxMIMnNkR9qUfJ2/inventory-procurement-orders: {"success":false,"error":{"code":"FORBIDDEN","message":"You are not a member of this biz."},"meta":{"requestId":"7cfbc1bc-95f9-405f-9a0f-cb4a387488d7","timestamp":"2026-03-05T04:46:12.825Z"}}
- example: API failure for GET /api/v1/bizes/3AVmBB01PxzJ9wWaZnqhxJnpExL/inventory-procurement-orders: {"success":false,"error":{"code":"FORBIDDEN","message":"You are not a member of this biz."},"meta":{"requestId":"fb294272-7b1c-427e-a8cd-c629b8efece7","timestamp":"2026-03-05T04:46:14.544Z"}}
- example: API failure for GET /api/v1/bizes/3AVmBAKdpZTcho9yCtiQIB8t0Rx/inventory-procurement-orders: {"success":false,"error":{"code":"FORBIDDEN","message":"You are not a member of this biz."},"meta":{"requestId":"b40ddf2b-e4c8-404e-bcc7-9067ae04a53e","timestamp":"2026-03-05T04:46:14.841Z"}}

### general | runtime | no-endpoint
- count: 3
- sagas: hole-35-value-ledger-transfer-traceability-medium, hole-35-value-ledger-transfer-traceability-deep, hole-35-value-ledger-transfer-traceability-shallow
- steps: value-adversary-cross-scope-denied
- example: API failure for GET /api/v1/bizes/3AVmB8gKbXpYOEXVdjEgYQru2jC/value-transfers: {"success":false,"error":{"code":"FORBIDDEN","message":"You are not a member of this biz."},"meta":{"requestId":"1210dc6f-6fab-4501-b190-32aafda27e98","timestamp":"2026-03-05T04:46:15.456Z"}}
- example: API failure for GET /api/v1/bizes/3AVmB7jvo2e48jUddSiX9chARqz/value-transfers: {"success":false,"error":{"code":"FORBIDDEN","message":"You are not a member of this biz."},"meta":{"requestId":"b2c6b10b-8ad1-474b-a41d-d02c733af595","timestamp":"2026-03-05T04:46:15.641Z"}}
- example: API failure for GET /api/v1/bizes/3AVmBPWBvnZ49PuIFPxoLJ1Sybr/value-transfers: {"success":false,"error":{"code":"FORBIDDEN","message":"You are not a member of this biz."},"meta":{"requestId":"26b41b83-7658-4c89-a7fb-02e0f242fb64","timestamp":"2026-03-05T04:46:17.360Z"}}

### general | runtime | no-endpoint
- count: 3
- sagas: hole-36-workforce-hire-performance-lifecycle-deep, hole-36-workforce-hire-performance-lifecycle-medium, hole-36-workforce-hire-performance-lifecycle-shallow
- steps: workforce-adversary-cross-scope-denied
- example: API failure for GET /api/v1/bizes/3AVmBWUfzxCixNQ5Idu89WH2OvV/workforce-requisitions: {"success":false,"error":{"code":"FORBIDDEN","message":"You are not a member of this biz."},"meta":{"requestId":"67398ac0-c28e-48e5-bc44-00ee617dc3bc","timestamp":"2026-03-05T04:46:17.842Z"}}
- example: API failure for GET /api/v1/bizes/3AVmBVcexJDJK8ntoAVBgQ6QfxC/workforce-requisitions: {"success":false,"error":{"code":"FORBIDDEN","message":"You are not a member of this biz."},"meta":{"requestId":"95e90396-90fa-412f-950c-14f46f2794ce","timestamp":"2026-03-05T04:46:18.203Z"}}
- example: API failure for GET /api/v1/bizes/3AVmBYa8DRzbSAN4D9FYY3mRFi8/workforce-requisitions: {"success":false,"error":{"code":"FORBIDDEN","message":"You are not a member of this biz."},"meta":{"requestId":"acb50c50-639c-4684-8f17-1fee51304e70","timestamp":"2026-03-05T04:46:18.347Z"}}

### general | runtime | no-endpoint
- count: 1
- sagas: hole-35-value-ledger-transfer-traceability-deep
- steps: value-owner-idempotent-transfer-decision
- example: API failure for PATCH /api/v1/bizes/3AVmB7jvo2e48jUddSiX9chARqz/value-transfers/value_transfer_3AVmBDxdq55BZbKwjs4Z4ggGLJc/decision: {"success":false,"error":{"code":"CONFLICT","message":"Transfer is already completed."},"meta":{"requestId":"feb81c67-913b-42a5-bde0-fc66d791873d","timestamp":"2026-03-05T04:46:15.319Z"}}
