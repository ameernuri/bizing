/**
 * Auth + ACL management routes.
 *
 * This module intentionally groups:
 * - identity context endpoints (`/auth/me`, active biz switching),
 * - org admin endpoints (members + invitations),
 * - ACL config endpoints (roles, permissions, assignments, mappings).
 *
 * Reason:
 * The same admins usually manage all of these concerns together during setup.
 */

import { Hono, type Context } from 'hono'
import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm'
import dbPackage from '@bizing/db'
import { z } from 'zod'
import {
  buildScopeRef,
  ensureAclBootstrap,
  evaluatePermission,
  inferScopeType,
  listEffectivePermissionKeys,
} from '../services/acl.js'
import { recordRequestAuthEvent } from '../services/auth-observability.js'
import {
  getCurrentAuthCredentialId,
  getCurrentAuthScopes,
  getCurrentAuthSource,
  getCurrentUser,
  requireAclPermission,
  requireAuth,
  requireBizAccess,
  requirePlatformAdmin,
} from '../middleware/auth.js'
import { appendAuditEvent, createOperationalAlert } from '../lib/audit-log.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok } from './_api.js'

const {
  db,
  authzMembershipRoleMappings,
  authzPermissionDefinitions,
  authzRoleAssignments,
  authzRoleDefinitions,
  authzRolePermissions,
  bizes,
  invitations,
  members,
  sessions,
  users,
} = dbPackage

const switchActiveBizBodySchema = z.object({
  bizId: z.string().min(1),
})

const createMemberBodySchema = z.object({
  userId: z.string().optional(),
  email: z.string().email().optional(),
  role: z.string().min(1).max(60).default('staff'),
}).refine((input) => Boolean(input.userId || input.email), {
  message: 'Provide userId or email.',
})

const updateMemberBodySchema = z.object({
  role: z.string().min(1).max(60),
})

const bulkDeleteMembersBodySchema = z.object({
  memberIds: z.array(z.string().min(1)).min(1),
  confirmationText: z.string().min(1).max(120),
  reason: z.string().min(1).max(500),
})

const offboardMemberBodySchema = z.object({
  reason: z.string().min(1).max(500),
  checklist: z
    .array(
      z.object({
        key: z.string().min(1).max(120),
        label: z.string().min(1).max(220).optional(),
        completed: z.boolean(),
      }),
    )
    .min(1),
  metadata: z.record(z.unknown()).optional(),
})

const createInvitationBodySchema = z.object({
  email: z.string().email(),
  role: z.string().min(1).max(60).default('staff'),
  expiresAt: z.string().datetime().optional(),
})

const createAclRoleBodySchema = z.object({
  roleKey: z.string().min(1).max(140),
  name: z.string().min(1).max(220),
  description: z.string().max(1000).optional(),
  scopeType: z.enum(['biz', 'location', 'resource', 'subject']).default('biz'),
  locationId: z.string().optional(),
  resourceId: z.string().optional(),
  scopeSubjectType: z.string().max(80).optional(),
  scopeSubjectId: z.string().max(140).optional(),
  isDefault: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const updateAclRoleBodySchema = z.object({
  name: z.string().min(1).max(220).optional(),
  description: z.string().max(1000).optional().nullable(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).optional(),
  isDefault: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const upsertRolePermissionsBodySchema = z.object({
  permissions: z
    .array(
      z.object({
        permissionKey: z.string().min(1).max(180),
        effect: z.enum(['allow', 'deny']).default('allow'),
        priority: z.number().int().min(0).default(100),
        isActive: z.boolean().default(true),
      }),
    )
    .min(1),
})

const createAclAssignmentBodySchema = z.object({
  userId: z.string().min(1),
  roleDefinitionId: z.string().min(1),
  scopeType: z.enum(['biz', 'location', 'resource', 'subject']).default('biz'),
  locationId: z.string().optional(),
  resourceId: z.string().optional(),
  scopeSubjectType: z.string().max(80).optional(),
  scopeSubjectId: z.string().max(140).optional(),
  effectiveTo: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createPlatformAclRoleBodySchema = z.object({
  roleKey: z.string().min(1).max(140),
  name: z.string().min(1).max(220),
  description: z.string().max(1000).optional(),
  isDefault: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createPlatformAclAssignmentBodySchema = z.object({
  userId: z.string().min(1),
  roleDefinitionId: z.string().min(1),
  effectiveTo: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
})

function auditActorTypeFromSource(source: string | null | undefined) {
  if (source === 'api_key') return 'api_key' as const
  if (source === 'integration') return 'integration' as const
  if (source === 'system') return 'system' as const
  return 'user' as const
}

async function emitAdminActionTrace(c: Context, input: {
  bizId: string
  streamKey: string
  streamType: string
  entityType: string
  entityId: string
  eventType: 'create' | 'update' | 'delete' | 'state_transition' | 'custom'
  reasonCode: string
  note: string
  beforeState?: Record<string, unknown> | null
  afterState?: Record<string, unknown> | null
  diff?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}) {
  const actor = getCurrentUser(c)
  const auditEvent = await appendAuditEvent({
    bizId: input.bizId,
    streamKey: input.streamKey,
    streamType: input.streamType,
    entityType: input.entityType,
    entityId: input.entityId,
    eventType: input.eventType,
    actorType: auditActorTypeFromSource(getCurrentAuthSource(c)),
    actorUserId: actor?.id ?? null,
    actorRef: getCurrentAuthCredentialId(c) ?? null,
    reasonCode: input.reasonCode,
    note: input.note,
    requestRef: c.get('requestId') ?? null,
    sourceIp: c.req.header('x-forwarded-for') ?? null,
    userAgent: c.req.header('user-agent') ?? null,
    beforeState: input.beforeState ?? null,
    afterState: input.afterState ?? null,
    diff: input.diff ?? null,
    metadata: input.metadata ?? {},
  })

  await createOperationalAlert({
    bizId: input.bizId,
    recipientUserId: actor?.id ?? null,
    recipientRef: actor?.email ?? 'ops@bizing.local',
    subject: 'Admin action logged',
    body: input.note,
    metadata: {
      source: 'admin_action',
      auditEventId: auditEvent.id,
      entityType: input.entityType,
      entityId: input.entityId,
      reasonCode: input.reasonCode,
    },
  })

  return auditEvent
}

function emitAuthzEvent(
  c: Context,
  input: Parameters<typeof recordRequestAuthEvent>[1],
) {
  void recordRequestAuthEvent(c.req.raw.headers, {
    ...input,
    httpMethod: input.httpMethod ?? c.req.method,
    httpPath: input.httpPath ?? c.req.path,
    requestId: input.requestId ?? c.get('requestId'),
  }).catch(() => undefined)
}

const replaceMembershipMappingsBodySchema = z.object({
  mappings: z.array(
    z.object({
      membershipRole: z.string().min(1).max(60),
      roleDefinitionId: z.string().min(1),
      isActive: z.boolean().default(true),
      priority: z.number().int().min(0).default(100),
    }),
  ),
})

function nowPlusDays(days: number) {
  const now = new Date()
  now.setDate(now.getDate() + days)
  return now
}

function buildScopedPayload(params: {
  bizId: string
  scopeType: 'biz' | 'location' | 'resource' | 'subject'
  locationId?: string
  resourceId?: string
  scopeSubjectType?: string
  scopeSubjectId?: string
}) {
  const scope = {
    bizId: params.bizId,
    locationId: params.scopeType === 'location' ? (params.locationId ?? null) : null,
    resourceId: params.scopeType === 'resource' ? (params.resourceId ?? null) : null,
    subjectType: params.scopeType === 'subject' ? (params.scopeSubjectType ?? null) : null,
    subjectId: params.scopeType === 'subject' ? (params.scopeSubjectId ?? null) : null,
  }

  const resolvedScopeType = inferScopeType(scope)
  const scopeRef = buildScopeRef(scope)
  return { scope, scopeRef, resolvedScopeType }
}

export const authzRoutes = new Hono()

/**
 * Bootstrap ACL defaults (permission dictionary + default role bundles).
 * Platform admins can call this explicitly after fresh DB initialization.
 */
authzRoutes.post('/acl/bootstrap', requireAuth, requirePlatformAdmin, async (c) => {
  await ensureAclBootstrap()
  return ok(c, { bootstrapped: true })
})

/**
 * Return current auth context and effective permissions for active biz scope.
 */
authzRoutes.get('/auth/me', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  const session = c.get('session')
  const authSource = getCurrentAuthSource(c) ?? 'session'
  const authScopes = getCurrentAuthScopes(c) ?? ['*']
  const authCredentialId = getCurrentAuthCredentialId(c) ?? null
  if (!user || !session) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  await ensureAclBootstrap()

  const membershipRows = await db
    .select({
      id: bizes.id,
      name: bizes.name,
      slug: bizes.slug,
      membershipId: members.id,
      membershipRole: members.role,
      membershipCreatedAt: members.createdAt,
    })
    .from(members)
    .innerJoin(bizes, eq(bizes.id, members.organizationId))
    .where(eq(members.userId, user.id))
    .orderBy(asc(bizes.name))

  const activeBizId = session.activeOrganizationId ?? membershipRows[0]?.id ?? null
  const permissionKeys = await listEffectivePermissionKeys({
    userId: user.id,
    platformRole: user.role ?? null,
    scope: activeBizId ? { bizId: activeBizId } : {},
  })

  return ok(c, {
    user,
    session,
    auth: {
      source: authSource,
      scopes: authScopes,
      credentialId: authCredentialId,
    },
    memberships: membershipRows,
    activeBizId,
    permissionKeys,
  })
})

/**
 * Switch active biz for the current session.
 */
authzRoutes.patch('/auth/active-biz', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  const session = c.get('session')
  if (!user || !session) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const body = await c.req.json().catch(() => null)
  const parsed = switchActiveBizBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const membership = await db.query.members.findFirst({
    where: and(eq(members.userId, user.id), eq(members.organizationId, parsed.data.bizId)),
  })
  if (!membership) {
    return fail(c, 'FORBIDDEN', 'You are not a member of this biz.', 403)
  }

  const decision = await evaluatePermission({
    userId: user.id,
    platformRole: user.role ?? null,
    permissionKey: 'auth.switch_active_biz',
    scope: { bizId: parsed.data.bizId },
  })
  if (!decision.allowed) {
    return fail(c, 'FORBIDDEN', 'Permission denied to switch active biz.', 403, decision)
  }

  const [updated] = await db
    .update(sessions)
    .set({
      activeOrganizationId: parsed.data.bizId,
      updatedAt: new Date(),
    })
    .where(and(eq(sessions.id, session.id), eq(sessions.userId, user.id)))
    .returning({
      id: sessions.id,
      activeOrganizationId: sessions.activeOrganizationId,
    })

  if (!updated) {
    return fail(c, 'NOT_FOUND', 'Session not found.', 404)
  }

  emitAuthzEvent(c, {
    authSource: 'session',
    eventType: 'active_biz_switched',
    decision: 'issued',
    ownerUserId: user.id,
    bizId: parsed.data.bizId,
    sessionId: session.id,
    actorUserId: user.id,
    eventData: {
      previousActiveBizId: session.activeOrganizationId ?? null,
      nextActiveBizId: parsed.data.bizId,
    },
  })

  return ok(c, updated)
})

/**
 * List biz members with basic user profile info.
 */
authzRoutes.get(
  '/bizes/:bizId/members',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('members.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')

    const rows = await db
      .select({
        memberId: members.id,
        userId: users.id,
        email: users.email,
        name: users.name,
        role: members.role,
        joinedAt: members.createdAt,
      })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(eq(members.organizationId, bizId))
      .orderBy(asc(users.name))

    return ok(c, rows)
  },
)

authzRoutes.post(
  '/bizes/:bizId/members',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('members.manage', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')

    const body = await c.req.json().catch(() => null)
    const parsed = createMemberBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    let targetUserId = parsed.data.userId
    if (!targetUserId && parsed.data.email) {
      const userRow = await db.query.users.findFirst({
        where: eq(users.email, parsed.data.email),
      })
      if (!userRow) {
        return fail(c, 'NOT_FOUND', 'User not found for email.', 404)
      }
      targetUserId = userRow.id
    }

    if (!targetUserId) {
      return fail(c, 'BAD_REQUEST', 'Unable to resolve user for membership.', 400)
    }

    const existing = await db.query.members.findFirst({
      where: and(eq(members.organizationId, bizId), eq(members.userId, targetUserId)),
    })
    if (existing) return fail(c, 'CONFLICT', 'User is already a member of this biz.', 409)

    const [created] = await db
      .insert(members)
      .values({
        id: `member_${crypto.randomUUID().replace(/-/g, '')}`,
        organizationId: bizId,
        userId: targetUserId,
        role: parsed.data.role,
        createdAt: new Date(),
      })
      .returning()

    await emitAdminActionTrace(c, {
      bizId,
      streamKey: `member:${created.id}`,
      streamType: 'member',
      entityType: 'member',
      entityId: created.id,
      eventType: 'create',
      reasonCode: 'member_added',
      note: `Member ${created.id} was added to biz ${bizId}.`,
      afterState: {
        memberId: created.id,
        userId: created.userId,
        role: created.role,
      },
    })

    return ok(c, created, 201)
  },
)

/**
 * Bulk delete must be declared before the generic `:memberId` routes so the
 * static `bulk-delete` path is not mistaken for a member id by the router.
 */
authzRoutes.post(
  '/bizes/:bizId/members/bulk-delete',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('members.manage', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = bulkDeleteMembersBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const expectedConfirmation = `DELETE ${parsed.data.memberIds.length} MEMBERS`
    if (parsed.data.confirmationText !== expectedConfirmation) {
      return fail(c, 'CONFIRMATION_REQUIRED', 'Bulk delete requires exact confirmation text.', 400, {
        expectedConfirmation,
      })
    }

    const existingRows = await db
      .select({
        id: members.id,
        userId: members.userId,
        role: members.role,
      })
      .from(members)
      .where(and(eq(members.organizationId, bizId), inArray(members.id, parsed.data.memberIds)))

    if (existingRows.length !== parsed.data.memberIds.length) {
      return fail(c, 'NOT_FOUND', 'One or more members were not found for bulk delete.', 404, {
        expectedCount: parsed.data.memberIds.length,
        foundCount: existingRows.length,
      })
    }

    const removedRows = await db
      .delete(members)
      .where(and(eq(members.organizationId, bizId), inArray(members.id, parsed.data.memberIds)))
      .returning({ id: members.id })

    const batchId = `bulk_member_delete_${crypto.randomUUID().replace(/-/g, '')}`
    await emitAdminActionTrace(c, {
      bizId,
      streamKey: `tenant:${bizId}`,
      streamType: 'tenant',
      entityType: 'bulk_member_delete',
      entityId: batchId,
      eventType: 'delete',
      reasonCode: 'bulk_member_delete',
      note: sanitizePlainText(parsed.data.reason),
      beforeState: {
        members: existingRows,
      },
      afterState: {
        removedMemberIds: removedRows.map((row) => row.id),
      },
      metadata: {
        memberIds: parsed.data.memberIds,
        deletedCount: removedRows.length,
        confirmationText: parsed.data.confirmationText,
      },
    })

    return ok(c, {
      batchId,
      deletedCount: removedRows.length,
      memberIds: removedRows.map((row) => row.id),
      reason: parsed.data.reason,
    })
  },
)

/**
 * Offboarding also comes before generic `:memberId` handlers to keep the
 * lifecycle endpoint unambiguous and easy to reason about.
 */

authzRoutes.patch(
  '/bizes/:bizId/members/:memberId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('members.manage', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, memberId } = c.req.param()
    const body = await c.req.json().catch(() => null)
    const parsed = updateMemberBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const existing = await db.query.members.findFirst({
      where: and(eq(members.organizationId, bizId), eq(members.id, memberId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Member not found.', 404)

    const [updated] = await db
      .update(members)
      .set({ role: parsed.data.role })
      .where(and(eq(members.organizationId, bizId), eq(members.id, memberId)))
      .returning()

    if (!updated) return fail(c, 'NOT_FOUND', 'Member not found.', 404)

    await emitAdminActionTrace(c, {
      bizId,
      streamKey: `member:${updated.id}`,
      streamType: 'member',
      entityType: 'member',
      entityId: updated.id,
      eventType: 'update',
      reasonCode: 'member_role_updated',
      note: `Member ${updated.id} role was updated from ${existing.role} to ${updated.role}.`,
      beforeState: {
        memberId: existing.id,
        userId: existing.userId,
        role: existing.role,
      },
      afterState: {
        memberId: updated.id,
        userId: updated.userId,
        role: updated.role,
      },
      diff: {
        role: {
          before: existing.role,
          after: updated.role,
        },
      },
    })

    return ok(c, updated)
  },
)

authzRoutes.delete(
  '/bizes/:bizId/members/:memberId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('members.manage', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, memberId } = c.req.param()

    const existing = await db.query.members.findFirst({
      where: and(eq(members.organizationId, bizId), eq(members.id, memberId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Member not found.', 404)

    const [removed] = await db
      .delete(members)
      .where(and(eq(members.organizationId, bizId), eq(members.id, memberId)))
      .returning({ id: members.id })

    if (!removed) return fail(c, 'NOT_FOUND', 'Member not found.', 404)

    await emitAdminActionTrace(c, {
      bizId,
      streamKey: `member:${memberId}`,
      streamType: 'member',
      entityType: 'member',
      entityId: memberId,
      eventType: 'delete',
      reasonCode: 'member_removed',
      note: `Member ${memberId} was removed from biz ${bizId}.`,
      beforeState: {
        memberId: existing.id,
        userId: existing.userId,
        role: existing.role,
      },
      afterState: {
        removed: true,
      },
    })

    return ok(c, removed)
  },
)

authzRoutes.post(
  '/bizes/:bizId/members/bulk-delete',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('members.manage', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = bulkDeleteMembersBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const expectedConfirmation = `DELETE ${parsed.data.memberIds.length} MEMBERS`
    if (parsed.data.confirmationText !== expectedConfirmation) {
      return fail(c, 'CONFIRMATION_REQUIRED', 'Bulk delete requires exact confirmation text.', 400, {
        expectedConfirmation,
      })
    }

    const existingRows = await db
      .select({
        id: members.id,
        userId: members.userId,
        role: members.role,
      })
      .from(members)
      .where(and(eq(members.organizationId, bizId), inArray(members.id, parsed.data.memberIds)))

    if (existingRows.length !== parsed.data.memberIds.length) {
      return fail(c, 'NOT_FOUND', 'One or more members were not found for bulk delete.', 404, {
        expectedCount: parsed.data.memberIds.length,
        foundCount: existingRows.length,
      })
    }

    const removedRows = await db
      .delete(members)
      .where(and(eq(members.organizationId, bizId), inArray(members.id, parsed.data.memberIds)))
      .returning({ id: members.id })

    const batchId = `bulk_member_delete_${crypto.randomUUID().replace(/-/g, '')}`
    await emitAdminActionTrace(c, {
      bizId,
      streamKey: `tenant:${bizId}`,
      streamType: 'tenant',
      entityType: 'bulk_member_delete',
      entityId: batchId,
      eventType: 'delete',
      reasonCode: 'bulk_member_delete',
      note: sanitizePlainText(parsed.data.reason),
      beforeState: {
        members: existingRows,
      },
      afterState: {
        removedMemberIds: removedRows.map((row) => row.id),
      },
      metadata: {
        memberIds: parsed.data.memberIds,
        deletedCount: removedRows.length,
        confirmationText: parsed.data.confirmationText,
      },
    })

    return ok(c, {
      batchId,
      deletedCount: removedRows.length,
      memberIds: removedRows.map((row) => row.id),
      reason: parsed.data.reason,
    })
  },
)

authzRoutes.post(
  '/bizes/:bizId/members/:memberId/offboard',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('members.manage', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, memberId } = c.req.param()
    const parsed = offboardMemberBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    if (parsed.data.checklist.some((item) => !item.completed)) {
      return fail(c, 'CHECKLIST_INCOMPLETE', 'All offboarding checklist items must be completed.', 409, {
        checklist: parsed.data.checklist,
      })
    }

    const existing = await db.query.members.findFirst({
      where: and(eq(members.organizationId, bizId), eq(members.id, memberId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Member not found.', 404)

    const [removed] = await db
      .delete(members)
      .where(and(eq(members.organizationId, bizId), eq(members.id, memberId)))
      .returning({ id: members.id })

    if (!removed) return fail(c, 'NOT_FOUND', 'Member not found.', 404)

    await emitAdminActionTrace(c, {
      bizId,
      streamKey: `member:${memberId}`,
      streamType: 'member',
      entityType: 'member_offboarding',
      entityId: memberId,
      eventType: 'state_transition',
      reasonCode: 'member_offboarded',
      note: sanitizePlainText(parsed.data.reason),
      beforeState: {
        memberId: existing.id,
        userId: existing.userId,
        role: existing.role,
      },
      afterState: {
        revoked: true,
        checklistCompleted: true,
      },
      metadata: {
        checklist: parsed.data.checklist,
        ...(sanitizeUnknown(parsed.data.metadata ?? {}) as Record<string, unknown>),
      },
    })

    return ok(c, {
      memberId,
      revoked: true,
      checklistCompleted: true,
      reason: parsed.data.reason,
    })
  },
)

authzRoutes.get(
  '/bizes/:bizId/invitations',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('invitations.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.invitations.findMany({
      where: eq(invitations.organizationId, bizId),
      orderBy: [desc(invitations.createdAt)],
    })
    return ok(c, rows)
  },
)

authzRoutes.post(
  '/bizes/:bizId/invitations',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('invitations.manage', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const user = getCurrentUser(c)
    if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

    const body = await c.req.json().catch(() => null)
    const parsed = createInvitationBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const [created] = await db
      .insert(invitations)
      .values({
        id: `invite_${crypto.randomUUID().replace(/-/g, '')}`,
        organizationId: bizId,
        email: parsed.data.email,
        role: parsed.data.role,
        status: 'pending',
        inviterId: user.id,
        createdAt: new Date(),
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : nowPlusDays(7),
      })
      .returning()

    return ok(c, created, 201)
  },
)

authzRoutes.delete(
  '/bizes/:bizId/invitations/:invitationId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('invitations.manage', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, invitationId } = c.req.param()

    const [removed] = await db
      .delete(invitations)
      .where(and(eq(invitations.organizationId, bizId), eq(invitations.id, invitationId)))
      .returning({ id: invitations.id })

    if (!removed) return fail(c, 'NOT_FOUND', 'Invitation not found.', 404)
    return ok(c, removed)
  },
)

/**
 * ACL: list permission dictionary.
 */
authzRoutes.get(
  '/bizes/:bizId/acl/permissions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('acl.read', { bizIdParam: 'bizId' }),
  async (_c) => {
    await ensureAclBootstrap()
    const rows = await db.query.authzPermissionDefinitions.findMany({
      orderBy: [asc(authzPermissionDefinitions.moduleKey), asc(authzPermissionDefinitions.permissionKey)],
    })
    return ok(_c, rows)
  },
)

/**
 * ACL: list role definitions available for this biz.
 */
authzRoutes.get(
  '/bizes/:bizId/acl/roles',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('acl.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')

    const rows = await db.query.authzRoleDefinitions.findMany({
      where: or(eq(authzRoleDefinitions.bizId, bizId), sql`"biz_id" IS NULL`),
      orderBy: [asc(authzRoleDefinitions.scopeType), asc(authzRoleDefinitions.roleKey)],
    })
    return ok(c, rows)
  },
)

authzRoutes.post(
  '/bizes/:bizId/acl/roles',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('acl.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const body = await c.req.json().catch(() => null)
    const parsed = createAclRoleBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const scoped = buildScopedPayload({
      bizId,
      scopeType: parsed.data.scopeType,
      locationId: parsed.data.locationId,
      resourceId: parsed.data.resourceId,
      scopeSubjectType: parsed.data.scopeSubjectType,
      scopeSubjectId: parsed.data.scopeSubjectId,
    })

    if (scoped.resolvedScopeType !== parsed.data.scopeType) {
      return fail(c, 'VALIDATION_ERROR', 'Scope payload does not match scopeType.', 400)
    }

    const duplicate = await db.query.authzRoleDefinitions.findFirst({
      where: and(eq(authzRoleDefinitions.scopeRef, scoped.scopeRef), eq(authzRoleDefinitions.roleKey, parsed.data.roleKey)),
    })
    if (duplicate) {
      return fail(c, 'CONFLICT', 'Role key already exists for this scope.', 409)
    }

    const [created] = await db
      .insert(authzRoleDefinitions)
      .values({
        bizId,
        scopeType: parsed.data.scopeType,
        scopeRef: scoped.scopeRef,
        locationId: scoped.scope.locationId,
        resourceId: scoped.scope.resourceId,
        scopeSubjectType: scoped.scope.subjectType,
        scopeSubjectId: scoped.scope.subjectId,
        roleKey: parsed.data.roleKey,
        name: parsed.data.name,
        description: parsed.data.description,
        status: 'active',
        isDefault: parsed.data.isDefault ?? false,
        metadata: parsed.data.metadata ?? {},
      })
      .returning()

    return ok(c, created, 201)
  },
)

authzRoutes.patch(
  '/bizes/:bizId/acl/roles/:roleId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('acl.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, roleId } = c.req.param()
    const body = await c.req.json().catch(() => null)
    const parsed = updateAclRoleBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const [updated] = await db
      .update(authzRoleDefinitions)
      .set({
        ...parsed.data,
        description: parsed.data.description === null ? null : parsed.data.description,
      })
      .where(and(eq(authzRoleDefinitions.id, roleId), eq(authzRoleDefinitions.bizId, bizId)))
      .returning()

    if (!updated) return fail(c, 'NOT_FOUND', 'Role not found in this biz.', 404)
    return ok(c, updated)
  },
)

authzRoutes.get(
  '/bizes/:bizId/acl/roles/:roleId/permissions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('acl.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, roleId } = c.req.param()

    const role = await db.query.authzRoleDefinitions.findFirst({
      where: and(eq(authzRoleDefinitions.id, roleId), or(eq(authzRoleDefinitions.bizId, bizId), sql`"biz_id" IS NULL`)),
    })
    if (!role) return fail(c, 'NOT_FOUND', 'Role not found.', 404)

    const rows = await db
      .select({
        id: authzRolePermissions.id,
        effect: authzRolePermissions.effect,
        priority: authzRolePermissions.priority,
        isActive: authzRolePermissions.isActive,
        permissionKey: authzPermissionDefinitions.permissionKey,
        permissionName: authzPermissionDefinitions.name,
      })
      .from(authzRolePermissions)
      .innerJoin(
        authzPermissionDefinitions,
        eq(authzPermissionDefinitions.id, authzRolePermissions.permissionDefinitionId),
      )
      .where(eq(authzRolePermissions.roleDefinitionId, roleId))
      .orderBy(asc(authzPermissionDefinitions.permissionKey))

    return ok(c, rows)
  },
)

authzRoutes.put(
  '/bizes/:bizId/acl/roles/:roleId/permissions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('acl.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, roleId } = c.req.param()
    const body = await c.req.json().catch(() => null)
    const parsed = upsertRolePermissionsBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const role = await db.query.authzRoleDefinitions.findFirst({
      where: and(eq(authzRoleDefinitions.id, roleId), eq(authzRoleDefinitions.bizId, bizId)),
    })
    if (!role) return fail(c, 'NOT_FOUND', 'Role not found in this biz.', 404)

    const permissionKeys = Array.from(
      new Set(parsed.data.permissions.map((permission) => permission.permissionKey)),
    )
    const permissionRows = await db.query.authzPermissionDefinitions.findMany({
      where: inArray(authzPermissionDefinitions.permissionKey, permissionKeys),
    })
    const permissionIdByKey = new Map(permissionRows.map((row) => [row.permissionKey, row.id]))

    for (const row of parsed.data.permissions) {
      const permissionId = permissionIdByKey.get(row.permissionKey)
      if (!permissionId) continue

      await db
        .insert(authzRolePermissions)
        .values({
          roleDefinitionId: roleId,
          permissionDefinitionId: permissionId,
          effect: row.effect,
          priority: row.priority,
          isActive: row.isActive,
        })
        .onConflictDoUpdate({
          target: [authzRolePermissions.roleDefinitionId, authzRolePermissions.permissionDefinitionId],
          set: {
            effect: row.effect,
            priority: row.priority,
            isActive: row.isActive,
          },
        })
    }

    return ok(c, { updatedCount: parsed.data.permissions.length })
  },
)

authzRoutes.get(
  '/bizes/:bizId/acl/assignments',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('acl.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.authzRoleAssignments.findMany({
      where: eq(authzRoleAssignments.bizId, bizId),
      orderBy: [desc(authzRoleAssignments.effectiveFrom)],
    })
    return ok(c, rows)
  },
)

authzRoutes.post(
  '/bizes/:bizId/acl/assignments',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('acl.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const body = await c.req.json().catch(() => null)
    const parsed = createAclAssignmentBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const scoped = buildScopedPayload({
      bizId,
      scopeType: parsed.data.scopeType,
      locationId: parsed.data.locationId,
      resourceId: parsed.data.resourceId,
      scopeSubjectType: parsed.data.scopeSubjectType,
      scopeSubjectId: parsed.data.scopeSubjectId,
    })
    if (scoped.resolvedScopeType !== parsed.data.scopeType) {
      return fail(c, 'VALIDATION_ERROR', 'Scope payload does not match scopeType.', 400)
    }

    const role = await db.query.authzRoleDefinitions.findFirst({
      where: and(
        eq(authzRoleDefinitions.id, parsed.data.roleDefinitionId),
        or(eq(authzRoleDefinitions.bizId, bizId), sql`"biz_id" IS NULL`),
      ),
    })
    if (!role) {
      return fail(c, 'NOT_FOUND', 'Role definition not found for this biz context.', 404)
    }

    const [created] = await db
      .insert(authzRoleAssignments)
      .values({
        userId: parsed.data.userId,
        bizId,
        roleDefinitionId: parsed.data.roleDefinitionId,
        scopeType: parsed.data.scopeType,
        scopeRef: scoped.scopeRef,
        locationId: scoped.scope.locationId,
        resourceId: scoped.scope.resourceId,
        scopeSubjectType: scoped.scope.subjectType,
        scopeSubjectId: scoped.scope.subjectId,
        status: 'active',
        effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null,
        metadata: parsed.data.metadata ?? {},
      })
      .onConflictDoUpdate({
        target: [
          authzRoleAssignments.userId,
          authzRoleAssignments.roleDefinitionId,
          authzRoleAssignments.scopeRef,
        ],
        set: {
          status: 'active',
          locationId: scoped.scope.locationId,
          resourceId: scoped.scope.resourceId,
          scopeSubjectType: scoped.scope.subjectType,
          scopeSubjectId: scoped.scope.subjectId,
          effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null,
          metadata: parsed.data.metadata ?? {},
        },
      })
      .returning()

    return ok(c, created, 201)
  },
)

authzRoutes.delete(
  '/bizes/:bizId/acl/assignments/:assignmentId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('acl.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, assignmentId } = c.req.param()
    const [updated] = await db
      .update(authzRoleAssignments)
      .set({
        status: 'inactive',
        effectiveTo: new Date(),
      })
      .where(and(eq(authzRoleAssignments.bizId, bizId), eq(authzRoleAssignments.id, assignmentId)))
      .returning({ id: authzRoleAssignments.id, status: authzRoleAssignments.status })

    if (!updated) return fail(c, 'NOT_FOUND', 'Assignment not found.', 404)
    return ok(c, updated)
  },
)

authzRoutes.get(
  '/bizes/:bizId/acl/membership-mappings',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('acl.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.authzMembershipRoleMappings.findMany({
      where: or(eq(authzMembershipRoleMappings.bizId, bizId), sql`"biz_id" IS NULL`),
      orderBy: [asc(authzMembershipRoleMappings.membershipRole), asc(authzMembershipRoleMappings.priority)],
    })
    return ok(c, rows)
  },
)

authzRoutes.put(
  '/bizes/:bizId/acl/membership-mappings',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('acl.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const body = await c.req.json().catch(() => null)
    const parsed = replaceMembershipMappingsBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    await db.transaction(async (tx) => {
      await tx.delete(authzMembershipRoleMappings).where(eq(authzMembershipRoleMappings.bizId, bizId))
      if (parsed.data.mappings.length === 0) return

      await tx.insert(authzMembershipRoleMappings).values(
        parsed.data.mappings.map((mapping) => ({
          bizId,
          membershipRole: mapping.membershipRole,
          roleDefinitionId: mapping.roleDefinitionId,
          isActive: mapping.isActive,
          priority: mapping.priority,
        })),
      )
    })

    return ok(c, { updatedCount: parsed.data.mappings.length })
  },
)

/**
 * ACL: inspect effective permissions for one user in one biz scope.
 *
 * Optional query params:
 * - locationId
 * - resourceId
 * - subjectType
 * - subjectId
 */
authzRoutes.get(
  '/bizes/:bizId/acl/effective/:userId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('acl.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const userId = c.req.param('userId')
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    })
    if (!targetUser) return fail(c, 'NOT_FOUND', 'User not found.', 404)

    const locationId = c.req.query('locationId') ?? null
    const resourceId = c.req.query('resourceId') ?? null
    const subjectType = c.req.query('subjectType') ?? null
    const subjectId = c.req.query('subjectId') ?? null

    const permissionKeys = await listEffectivePermissionKeys({
      userId,
      platformRole: targetUser.role,
      scope: {
        bizId,
        locationId,
        resourceId,
        subjectType,
        subjectId,
      },
    })

    return ok(c, {
      userId,
      bizId,
      scope: {
        locationId,
        resourceId,
        subjectType,
        subjectId,
      },
      permissionKeys,
    })
  },
)

/**
 * Platform ACL routes.
 *
 * These control bizing-level (global) role templates and assignments.
 * Biz-level ACL remains under `/bizes/:bizId/acl/*`.
 */
authzRoutes.get(
  '/platform/acl/roles',
  requireAuth,
  requireAclPermission('acl.read'),
  async (c) => {
    const rows = await db.query.authzRoleDefinitions.findMany({
      where: and(eq(authzRoleDefinitions.scopeType, 'platform'), sql`"biz_id" IS NULL`),
      orderBy: [asc(authzRoleDefinitions.roleKey)],
    })
    return ok(c, rows)
  },
)

authzRoutes.get(
  '/platform/acl/permissions',
  requireAuth,
  requireAclPermission('acl.read'),
  async (c) => {
    await ensureAclBootstrap()
    const rows = await db.query.authzPermissionDefinitions.findMany({
      orderBy: [asc(authzPermissionDefinitions.moduleKey), asc(authzPermissionDefinitions.permissionKey)],
    })
    return ok(c, rows)
  },
)

authzRoutes.get(
  '/platform/acl/membership-mappings',
  requireAuth,
  requireAclPermission('acl.read'),
  async (c) => {
    const rows = await db.query.authzMembershipRoleMappings.findMany({
      where: sql`"biz_id" IS NULL`,
      orderBy: [asc(authzMembershipRoleMappings.membershipRole), asc(authzMembershipRoleMappings.priority)],
    })
    return ok(c, rows)
  },
)

authzRoutes.put(
  '/platform/acl/membership-mappings',
  requireAuth,
  requireAclPermission('acl.write'),
  async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = replaceMembershipMappingsBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    await db.transaction(async (tx) => {
      await tx.delete(authzMembershipRoleMappings).where(sql`"biz_id" IS NULL`)
      if (parsed.data.mappings.length === 0) return

      await tx.insert(authzMembershipRoleMappings).values(
        parsed.data.mappings.map((mapping) => ({
          bizId: null,
          membershipRole: mapping.membershipRole,
          roleDefinitionId: mapping.roleDefinitionId,
          isActive: mapping.isActive,
          priority: mapping.priority,
        })),
      )
    })

    return ok(c, { updatedCount: parsed.data.mappings.length })
  },
)

authzRoutes.post(
  '/platform/acl/roles',
  requireAuth,
  requireAclPermission('acl.write'),
  async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = createPlatformAclRoleBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const duplicate = await db.query.authzRoleDefinitions.findFirst({
      where: and(eq(authzRoleDefinitions.scopeRef, 'platform'), eq(authzRoleDefinitions.roleKey, parsed.data.roleKey)),
    })
    if (duplicate) return fail(c, 'CONFLICT', 'Platform role key already exists.', 409)

    const [created] = await db
      .insert(authzRoleDefinitions)
      .values({
        scopeType: 'platform',
        scopeRef: 'platform',
        roleKey: parsed.data.roleKey,
        name: parsed.data.name,
        description: parsed.data.description,
        status: 'active',
        isDefault: parsed.data.isDefault ?? false,
        metadata: parsed.data.metadata ?? {},
      })
      .returning()

    return ok(c, created, 201)
  },
)

authzRoutes.patch(
  '/platform/acl/roles/:roleId',
  requireAuth,
  requireAclPermission('acl.write'),
  async (c) => {
    const roleId = c.req.param('roleId')
    const body = await c.req.json().catch(() => null)
    const parsed = updateAclRoleBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const [updated] = await db
      .update(authzRoleDefinitions)
      .set({
        ...parsed.data,
        description: parsed.data.description === null ? null : parsed.data.description,
      })
      .where(
        and(
          eq(authzRoleDefinitions.id, roleId),
          eq(authzRoleDefinitions.scopeType, 'platform'),
          sql`"biz_id" IS NULL`,
        ),
      )
      .returning()

    if (!updated) return fail(c, 'NOT_FOUND', 'Platform role not found.', 404)
    return ok(c, updated)
  },
)

authzRoutes.get(
  '/platform/acl/roles/:roleId/permissions',
  requireAuth,
  requireAclPermission('acl.read'),
  async (c) => {
    const roleId = c.req.param('roleId')

    const role = await db.query.authzRoleDefinitions.findFirst({
      where: and(
        eq(authzRoleDefinitions.id, roleId),
        eq(authzRoleDefinitions.scopeType, 'platform'),
        sql`"biz_id" IS NULL`,
      ),
    })
    if (!role) return fail(c, 'NOT_FOUND', 'Platform role not found.', 404)

    const rows = await db
      .select({
        id: authzRolePermissions.id,
        effect: authzRolePermissions.effect,
        priority: authzRolePermissions.priority,
        isActive: authzRolePermissions.isActive,
        permissionId: authzPermissionDefinitions.id,
        permissionKey: authzPermissionDefinitions.permissionKey,
        permissionName: authzPermissionDefinitions.name,
        permissionModuleKey: authzPermissionDefinitions.moduleKey,
      })
      .from(authzRolePermissions)
      .innerJoin(
        authzPermissionDefinitions,
        eq(authzPermissionDefinitions.id, authzRolePermissions.permissionDefinitionId),
      )
      .where(eq(authzRolePermissions.roleDefinitionId, roleId))
      .orderBy(asc(authzPermissionDefinitions.permissionKey))

    return ok(c, rows)
  },
)

authzRoutes.put(
  '/platform/acl/roles/:roleId/permissions',
  requireAuth,
  requireAclPermission('acl.write'),
  async (c) => {
    const roleId = c.req.param('roleId')
    const body = await c.req.json().catch(() => null)
    const parsed = upsertRolePermissionsBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const role = await db.query.authzRoleDefinitions.findFirst({
      where: and(
        eq(authzRoleDefinitions.id, roleId),
        eq(authzRoleDefinitions.scopeType, 'platform'),
        sql`"biz_id" IS NULL`,
      ),
    })
    if (!role) return fail(c, 'NOT_FOUND', 'Platform role not found.', 404)

    const permissionKeys = Array.from(
      new Set(parsed.data.permissions.map((permission) => permission.permissionKey)),
    )
    const permissionRows = await db.query.authzPermissionDefinitions.findMany({
      where: inArray(authzPermissionDefinitions.permissionKey, permissionKeys),
    })
    const permissionIdByKey = new Map(permissionRows.map((row) => [row.permissionKey, row.id]))

    for (const row of parsed.data.permissions) {
      const permissionId = permissionIdByKey.get(row.permissionKey)
      if (!permissionId) continue

      await db
        .insert(authzRolePermissions)
        .values({
          roleDefinitionId: roleId,
          permissionDefinitionId: permissionId,
          effect: row.effect,
          priority: row.priority,
          isActive: row.isActive,
        })
        .onConflictDoUpdate({
          target: [authzRolePermissions.roleDefinitionId, authzRolePermissions.permissionDefinitionId],
          set: {
            effect: row.effect,
            priority: row.priority,
            isActive: row.isActive,
          },
        })
    }

    return ok(c, { updatedCount: parsed.data.permissions.length })
  },
)

authzRoutes.get(
  '/platform/acl/assignments',
  requireAuth,
  requireAclPermission('acl.read'),
  async (c) => {
    const rows = await db.query.authzRoleAssignments.findMany({
      where: and(eq(authzRoleAssignments.scopeType, 'platform'), sql`"biz_id" IS NULL`),
      orderBy: [desc(authzRoleAssignments.effectiveFrom)],
    })
    return ok(c, rows)
  },
)

authzRoutes.post(
  '/platform/acl/assignments',
  requireAuth,
  requireAclPermission('acl.write'),
  async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = createPlatformAclAssignmentBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const role = await db.query.authzRoleDefinitions.findFirst({
      where: and(
        eq(authzRoleDefinitions.id, parsed.data.roleDefinitionId),
        eq(authzRoleDefinitions.scopeType, 'platform'),
        sql`"biz_id" IS NULL`,
      ),
    })
    if (!role) {
      return fail(c, 'NOT_FOUND', 'Platform role definition not found.', 404)
    }

    const [created] = await db
      .insert(authzRoleAssignments)
      .values({
        userId: parsed.data.userId,
        bizId: null,
        roleDefinitionId: parsed.data.roleDefinitionId,
        scopeType: 'platform',
        scopeRef: 'platform',
        status: 'active',
        effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null,
        metadata: parsed.data.metadata ?? {},
      })
      .onConflictDoUpdate({
        target: [
          authzRoleAssignments.userId,
          authzRoleAssignments.roleDefinitionId,
          authzRoleAssignments.scopeRef,
        ],
        set: {
          status: 'active',
          effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null,
          metadata: parsed.data.metadata ?? {},
        },
      })
      .returning()

    return ok(c, created, 201)
  },
)

authzRoutes.delete(
  '/platform/acl/assignments/:assignmentId',
  requireAuth,
  requireAclPermission('acl.write'),
  async (c) => {
    const assignmentId = c.req.param('assignmentId')
    const [updated] = await db
      .update(authzRoleAssignments)
      .set({
        status: 'inactive',
        effectiveTo: new Date(),
      })
      .where(
        and(
          eq(authzRoleAssignments.id, assignmentId),
          eq(authzRoleAssignments.scopeType, 'platform'),
          sql`"biz_id" IS NULL`,
        ),
      )
      .returning({ id: authzRoleAssignments.id, status: authzRoleAssignments.status })

    if (!updated) return fail(c, 'NOT_FOUND', 'Platform assignment not found.', 404)
    return ok(c, updated)
  },
)

/**
 * ACL: inspect effective permissions for one user in platform scope.
 *
 * Optional query params:
 * - bizId
 * - locationId
 * - resourceId
 * - subjectType
 * - subjectId
 */
authzRoutes.get('/acl/effective/:userId', requireAuth, requireAclPermission('acl.read'), async (c) => {
  const userId = c.req.param('userId')
  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })
  if (!targetUser) return fail(c, 'NOT_FOUND', 'User not found.', 404)

  const bizId = c.req.query('bizId') ?? null
  const locationId = c.req.query('locationId') ?? null
  const resourceId = c.req.query('resourceId') ?? null
  const subjectType = c.req.query('subjectType') ?? null
  const subjectId = c.req.query('subjectId') ?? null

  const permissionKeys = await listEffectivePermissionKeys({
    userId,
    platformRole: targetUser.role,
    scope: {
      bizId,
      locationId,
      resourceId,
      subjectType,
      subjectId,
    },
  })

  return ok(c, {
    userId,
    scope: {
      bizId,
      locationId,
      resourceId,
      subjectType,
      subjectId,
    },
    permissionKeys,
  })
})
