---
tags:
  - bizing
  - domain
  - generated
  - auth-machine
---

# Auth Machine Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/auth-machine.ts`
- Schema file: `packages/db/src/schema/auth_observability.ts`
- Mount path: `/`
- Auth class (manifest): `session_only`

## Route Intent (top JSDoc)

Machine authentication routes (API keys + short-lived access tokens).

ELI5:
- Human in browser: cookie session (Better Auth).
- Machine/agent/integration: API key -> exchange -> short token.

Design intent:
- Keep long-lived secrets rare and tightly managed.
- Prefer short-lived bearer tokens for daily API calls.
- Never expose stored hashes/secrets in read APIs.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/auth/api-keys`
- `POST` `/api/v1/auth/api-keys`
- `POST` `/api/v1/auth/api-keys/:apiCredentialId/revoke`
- `POST` `/api/v1/auth/api-keys/:apiCredentialId/rotate`
- `GET` `/api/v1/auth/impersonation/users`
- `POST` `/api/v1/auth/impersonation/users`
- `POST` `/api/v1/auth/impersonation/tokens`
- `POST` `/api/v1/auth/tokens/exchange`
- `POST` `/api/v1/auth/tokens/:tokenId/revoke`
- `GET` `/api/v1/auth/tokens`
- `GET` `/api/v1/auth/events`
- `GET` `/api/v1/auth/principals`

## Tables

- `auth_principals`
- `auth_access_events`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
