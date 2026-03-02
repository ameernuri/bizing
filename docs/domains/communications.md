---
tags:
  - bizing
  - domain
  - generated
  - communications
---

# Communications Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/communications.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/communications.ts`

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

- `GET` `/bizes/:bizId/outbound-messages`
- `POST` `/bizes/:bizId/outbound-messages`
- `GET` `/bizes/:bizId/outbound-messages/:messageId`
- `POST` `/bizes/:bizId/outbound-messages/:messageId/events`
- `GET` `/bizes/:bizId/communication-consents`
- `POST` `/bizes/:bizId/communication-consents`
- `PATCH` `/bizes/:bizId/communication-consents/:consentId`
- `GET` `/bizes/:bizId/quiet-hour-policies`
- `POST` `/bizes/:bizId/quiet-hour-policies`
- `PATCH` `/bizes/:bizId/quiet-hour-policies/:policyId`
- `GET` `/bizes/:bizId/message-templates`
- `POST` `/bizes/:bizId/message-templates`
- `PATCH` `/bizes/:bizId/message-templates/:templateId`
- `GET` `/bizes/:bizId/message-template-bindings`
- `POST` `/bizes/:bizId/message-template-bindings`
- `GET` `/bizes/:bizId/marketing-campaigns`
- `POST` `/bizes/:bizId/marketing-campaigns`
- `PATCH` `/bizes/:bizId/marketing-campaigns/:campaignId`
- `GET` `/bizes/:bizId/marketing-campaign-steps`
- `POST` `/bizes/:bizId/marketing-campaign-steps`
- `GET` `/bizes/:bizId/marketing-campaign-enrollments`
- `POST` `/bizes/:bizId/marketing-campaign-enrollments`

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
