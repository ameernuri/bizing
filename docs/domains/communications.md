---
tags:
  - bizing
  - domain
  - generated
  - communications
---

# Communications Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/communications.ts`
- Schema file: `packages/db/src/schema/communications.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Communications routes.

ELI5:
This module answers three related questions:
1. What messages did we send?
2. Are we allowed to contact this person on this channel/purpose?
3. When should we stay quiet unless the message is urgent?

Keeping these as first-class routes matters because notification-heavy use
cases should be provable through the API, not inferred from loose metadata.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/outbound-messages`
- `POST` `/api/v1/bizes/:bizId/outbound-messages`
- `GET` `/api/v1/bizes/:bizId/outbound-messages/:messageId`
- `POST` `/api/v1/bizes/:bizId/outbound-messages/:messageId/events`
- `GET` `/api/v1/bizes/:bizId/communication-consents`
- `POST` `/api/v1/bizes/:bizId/communication-consents`
- `PATCH` `/api/v1/bizes/:bizId/communication-consents/:consentId`
- `GET` `/api/v1/bizes/:bizId/quiet-hour-policies`
- `POST` `/api/v1/bizes/:bizId/quiet-hour-policies`
- `PATCH` `/api/v1/bizes/:bizId/quiet-hour-policies/:policyId`
- `GET` `/api/v1/bizes/:bizId/message-templates`
- `POST` `/api/v1/bizes/:bizId/message-templates`
- `PATCH` `/api/v1/bizes/:bizId/message-templates/:templateId`
- `GET` `/api/v1/bizes/:bizId/message-template-bindings`
- `POST` `/api/v1/bizes/:bizId/message-template-bindings`
- `GET` `/api/v1/bizes/:bizId/marketing-campaigns`
- `POST` `/api/v1/bizes/:bizId/marketing-campaigns`
- `PATCH` `/api/v1/bizes/:bizId/marketing-campaigns/:campaignId`
- `GET` `/api/v1/bizes/:bizId/marketing-campaign-steps`
- `POST` `/api/v1/bizes/:bizId/marketing-campaign-steps`
- `GET` `/api/v1/bizes/:bizId/marketing-campaign-enrollments`
- `POST` `/api/v1/bizes/:bizId/marketing-campaign-enrollments`

## Tables

- `communication_consents`
- `quiet_hour_policies`
- `message_templates`
- `marketing_campaigns`
- `marketing_campaign_steps`
- `marketing_campaign_enrollments`
- `message_template_bindings`
- `outbound_messages`
- `outbound_message_events`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
