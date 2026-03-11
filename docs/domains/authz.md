---
tags:
  - bizing
  - domain
  - generated
  - authz
---

# Authz Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/authz.ts`
- Schema file: `packages/db/src/schema/authz.ts`
- Mount path: `/`
- Auth class (manifest): `session_only`

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

- `POST` `/api/v1/acl/bootstrap`
- `GET` `/api/v1/auth/me`
- `PATCH` `/api/v1/auth/active-biz`
- `GET` `/api/v1/bizes/:bizId/members`
- `POST` `/api/v1/bizes/:bizId/members`
- `POST` `/api/v1/bizes/:bizId/members/bulk-delete`
- `PATCH` `/api/v1/bizes/:bizId/members/:memberId`
- `DELETE` `/api/v1/bizes/:bizId/members/:memberId`
- `POST` `/api/v1/bizes/:bizId/members/:memberId/offboard`
- `GET` `/api/v1/bizes/:bizId/invitations`
- `POST` `/api/v1/bizes/:bizId/invitations`
- `DELETE` `/api/v1/bizes/:bizId/invitations/:invitationId`
- `GET` `/api/v1/bizes/:bizId/acl/permissions`
- `GET` `/api/v1/bizes/:bizId/acl/roles`
- `POST` `/api/v1/bizes/:bizId/acl/roles`
- `PATCH` `/api/v1/bizes/:bizId/acl/roles/:roleId`
- `GET` `/api/v1/bizes/:bizId/acl/roles/:roleId/permissions`
- `PUT` `/api/v1/bizes/:bizId/acl/roles/:roleId/permissions`
- `GET` `/api/v1/bizes/:bizId/acl/assignments`
- `POST` `/api/v1/bizes/:bizId/acl/assignments`
- `DELETE` `/api/v1/bizes/:bizId/acl/assignments/:assignmentId`
- `GET` `/api/v1/bizes/:bizId/acl/membership-mappings`
- `PUT` `/api/v1/bizes/:bizId/acl/membership-mappings`
- `GET` `/api/v1/bizes/:bizId/acl/effective/:userId`
- `GET` `/api/v1/platform/acl/roles`
- `GET` `/api/v1/platform/acl/permissions`
- `GET` `/api/v1/platform/acl/membership-mappings`
- `PUT` `/api/v1/platform/acl/membership-mappings`
- `POST` `/api/v1/platform/acl/roles`
- `PATCH` `/api/v1/platform/acl/roles/:roleId`
- `GET` `/api/v1/platform/acl/roles/:roleId/permissions`
- `PUT` `/api/v1/platform/acl/roles/:roleId/permissions`
- `GET` `/api/v1/platform/acl/assignments`
- `POST` `/api/v1/platform/acl/assignments`
- `DELETE` `/api/v1/platform/acl/assignments/:assignmentId`
- `GET` `/api/v1/acl/effective/:userId`

## Tables

- `authz_permission_definitions`
- `authz_role_definitions`
- `authz_role_permissions`
- `authz_membership_role_mappings`
- `authz_role_assignments`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
