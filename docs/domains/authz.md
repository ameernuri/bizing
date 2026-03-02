---
tags:
  - bizing
  - domain
  - generated
  - authz
---

# Authz Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/authz.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/authz.ts`

## Route Intent (top JSDoc)

Auth + ACL management routes.

This module intentionally groups:
- identity context endpoints (`/auth/me`, active biz switching),
- org admin endpoints (members + invitations),
- ACL config endpoints (roles, permissions, assignments, mappings).

Reason:
The same admins usually manage all of these concerns together during setup.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `requestId`
- `GET` `requestId`
- `POST` `/acl/bootstrap`
- `GET` `/auth/me`
- `GET` `session`
- `PATCH` `/auth/active-biz`
- `GET` `session`
- `GET` `/bizes/:bizId/members`
- `POST` `/bizes/:bizId/members`
- `POST` `/bizes/:bizId/members/bulk-delete`
- `PATCH` `/bizes/:bizId/members/:memberId`
- `DELETE` `/bizes/:bizId/members/:memberId`
- `POST` `/bizes/:bizId/members/bulk-delete`
- `POST` `/bizes/:bizId/members/:memberId/offboard`
- `GET` `/bizes/:bizId/invitations`
- `POST` `/bizes/:bizId/invitations`
- `DELETE` `/bizes/:bizId/invitations/:invitationId`
- `GET` `/bizes/:bizId/acl/permissions`
- `GET` `/bizes/:bizId/acl/roles`
- `POST` `/bizes/:bizId/acl/roles`
- `PATCH` `/bizes/:bizId/acl/roles/:roleId`
- `GET` `/bizes/:bizId/acl/roles/:roleId/permissions`
- `PUT` `/bizes/:bizId/acl/roles/:roleId/permissions`
- `GET` `/bizes/:bizId/acl/assignments`
- `POST` `/bizes/:bizId/acl/assignments`
- `DELETE` `/bizes/:bizId/acl/assignments/:assignmentId`
- `GET` `/bizes/:bizId/acl/membership-mappings`
- `PUT` `/bizes/:bizId/acl/membership-mappings`
- `GET` `/bizes/:bizId/acl/effective/:userId`
- `GET` `/platform/acl/roles`
- `GET` `/platform/acl/permissions`
- `GET` `/platform/acl/membership-mappings`
- `PUT` `/platform/acl/membership-mappings`
- `POST` `/platform/acl/roles`
- `PATCH` `/platform/acl/roles/:roleId`
- `GET` `/platform/acl/roles/:roleId/permissions`
- `PUT` `/platform/acl/roles/:roleId/permissions`
- `GET` `/platform/acl/assignments`
- `POST` `/platform/acl/assignments`
- `DELETE` `/platform/acl/assignments/:assignmentId`
- `GET` `/acl/effective/:userId`

## Tables

- `authz_permission_definitions`
- `authz_role_definitions`
- `authz_role_permissions`
- `authz_membership_role_mappings`
- `authz_role_assignments`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
