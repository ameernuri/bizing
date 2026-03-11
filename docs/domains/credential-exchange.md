---
tags:
  - bizing
  - domain
  - generated
  - credential-exchange
---

# Credential Exchange Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/credential-exchange.ts`
- Schema file: `packages/db/src/schema/credential_exchange.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Credential exchange routes.

ELI5:
These routes expose the user's portable credential wallet.
A user can upload one credential once, attach facts/documents/verifications,
and then share it with one or more businesses using explicit grants.

Why this route exists:
- the schema already models portable credentials in a generic way,
- saga validation needs real API surfaces instead of direct DB inspection,
- future UIs and external clients need one clean contract for records,
  sharing, requests, and disclosure history.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/credential-type-definitions`
- `GET` `/api/v1/me/credential-profile`
- `PUT` `/api/v1/me/credential-profile`
- `GET` `/api/v1/me/credentials`
- `POST` `/api/v1/me/credentials`
- `GET` `/api/v1/me/credentials/:recordId`
- `PATCH` `/api/v1/me/credentials/:recordId`
- `POST` `/api/v1/me/credentials/:recordId/documents`
- `POST` `/api/v1/me/credentials/:recordId/facts`
- `POST` `/api/v1/me/credentials/:recordId/verifications`
- `GET` `/api/v1/bizes/:bizId/credential-candidates`
- `GET` `/api/v1/bizes/:bizId/credential-share-grants`
- `POST` `/api/v1/bizes/:bizId/credential-share-grants`
- `PATCH` `/api/v1/bizes/:bizId/credential-share-grants/:grantId`
- `GET` `/api/v1/bizes/:bizId/credential-share-grants/:grantId/selectors`
- `POST` `/api/v1/bizes/:bizId/credential-share-grants/:grantId/selectors`
- `GET` `/api/v1/bizes/:bizId/credential-requests`
- `POST` `/api/v1/bizes/:bizId/credential-requests`
- `PATCH` `/api/v1/bizes/:bizId/credential-requests/:requestId`
- `GET` `/api/v1/bizes/:bizId/credential-requests/:requestId/items`
- `POST` `/api/v1/bizes/:bizId/credential-requests/:requestId/items`
- `GET` `/api/v1/me/credential-disclosure-events`
- `GET` `/api/v1/bizes/:bizId/credential-disclosure-events`
- `POST` `/api/v1/bizes/:bizId/credential-disclosure-events`

## Tables

- `credential_type_definitions`
- `user_credential_profiles`
- `user_credential_records`
- `user_credential_documents`
- `user_credential_facts`
- `user_credential_verifications`
- `biz_credential_share_grants`
- `biz_credential_share_grant_selectors`
- `biz_credential_requests`
- `biz_credential_request_items`
- `credential_disclosure_events`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
