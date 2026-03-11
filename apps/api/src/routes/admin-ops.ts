/**
 * Admin ops routes.
 *
 * ELI5:
 * These routes give the business a small, explicit control surface for
 * sensitive admin actions that should be easy to audit later:
 * - read immutable audit history,
 * - request a data export,
 * - keep these actions queryable through the API instead of hidden in logs.
 */

import { Hono } from 'hono'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import {
  getCurrentAuthCredentialId,
  getCurrentAuthSource,
  getCurrentUser,
  requireAclPermission,
  requireAuth,
  requireBizAccess,
} from '../middleware/auth.js'
import { appendAuditEvent, createOperationalAlert } from '../lib/audit-log.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import {
  bulkDeleteMembersBodySchema,
  expectedBulkDeleteConfirmation,
  offboardMemberBodySchema,
} from '../contracts/member-admin.js'
import { fail, ok, parseJsonBody, parseQuery } from './_api.js'

const {
  db,
  auditEvents,
  auditStreams,
  members,
} = dbPackage

const listAuditEventsQuerySchema = z.object({
  entityType: z.string().max(120).optional(),
  entityId: z.string().max(140).optional(),
  eventType: z
    .enum(['create', 'update', 'delete', 'read', 'state_transition', 'policy_decision', 'payment_event', 'custom'])
    .optional(),
  streamType: z.string().max(120).optional(),
  page: z.string().optional(),
  perPage: z.string().optional(),
})

const createDataExportRequestBodySchema = z.object({
  exportType: z.string().min(1).max(120),
  format: z.enum(['json', 'csv', 'zip']).default('json'),
  scopeType: z.enum(['biz', 'location', 'subject', 'custom']).default('biz'),
  scopeRefId: z.string().max(140).optional(),
  reason: z.string().min(1).max(500),
  metadata: z.record(z.unknown()).optional(),
})

function pagination(input: { page?: string; perPage?: string }) {
  const page = Math.max(1, Number.parseInt(input.page ?? '1', 10) || 1)
  const perPage = Math.min(100, Math.max(1, Number.parseInt(input.perPage ?? '20', 10) || 20))
  return { page, perPage, offset: (page - 1) * perPage }
}

function auditActorTypeFromSource(source: string | null | undefined) {
  if (source === 'api_key') return 'api_key' as const
  if (source === 'integration') return 'integration' as const
  if (source === 'system') return 'system' as const
  return 'user' as const
}

export const adminOpsRoutes = new Hono()

adminOpsRoutes.get(
  '/bizes/:bizId/audit/events',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = parseQuery(c, listAuditEventsQuerySchema)
    if (!parsed.ok) {
      return parsed.response
    }

    const { page, perPage, offset } = pagination(parsed.data)
    const rows = await db
      .select({
        id: auditEvents.id,
        eventType: auditEvents.eventType,
        occurredAt: auditEvents.occurredAt,
        entityType: auditEvents.entityType,
        entityId: auditEvents.entityId,
        reasonCode: auditEvents.reasonCode,
        note: auditEvents.note,
        metadata: auditEvents.metadata,
        beforeState: auditEvents.beforeState,
        afterState: auditEvents.afterState,
        diff: auditEvents.diff,
        streamKey: auditStreams.streamKey,
        streamType: auditStreams.streamType,
      })
      .from(auditEvents)
      .innerJoin(auditStreams, eq(auditStreams.id, auditEvents.streamId))
      .where(
        and(
          eq(auditEvents.bizId, bizId),
          parsed.data.entityType ? eq(auditEvents.entityType, parsed.data.entityType) : undefined,
          parsed.data.entityId ? eq(auditEvents.entityId, parsed.data.entityId) : undefined,
          parsed.data.eventType ? eq(auditEvents.eventType, parsed.data.eventType) : undefined,
          parsed.data.streamType ? eq(auditStreams.streamType, parsed.data.streamType) : undefined,
        ),
      )
      .orderBy(desc(auditEvents.occurredAt))
      .limit(perPage)
      .offset(offset)

    return ok(c, {
      items: rows,
      page,
      perPage,
    })
  },
)

adminOpsRoutes.post(
  '/bizes/:bizId/data-export-requests',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = await parseJsonBody(c, createDataExportRequestBodySchema)
    if (!parsed.ok) {
      return parsed.response
    }

    const actor = getCurrentUser(c)
    const requestId = `export_req_${crypto.randomUUID().replace(/-/g, '')}`
    const auditEvent = await appendAuditEvent({
      bizId,
      streamKey: `tenant:${bizId}`,
      streamType: 'tenant',
      entityType: 'data_export_request',
      entityId: requestId,
      eventType: 'create',
      actorType: auditActorTypeFromSource(getCurrentAuthSource(c)),
      actorUserId: actor?.id ?? null,
      actorRef: getCurrentAuthCredentialId(c) ?? null,
      reasonCode: 'data_export_request',
      note: sanitizePlainText(parsed.data.reason),
      requestRef: c.get('requestId') ?? null,
      sourceIp: c.req.header('x-forwarded-for') ?? null,
      userAgent: c.req.header('user-agent') ?? null,
      afterState: {
        exportType: parsed.data.exportType,
        format: parsed.data.format,
        scopeType: parsed.data.scopeType,
        scopeRefId: parsed.data.scopeRefId ?? null,
      },
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}) as Record<string, unknown>,
    })

    await createOperationalAlert({
      bizId,
      recipientUserId: actor?.id ?? null,
      recipientRef: actor?.email ?? 'ops@bizing.local',
      subject: 'Data export requested',
      body: `Data export request ${requestId} was logged.`,
      metadata: {
        source: 'data_export_request',
        requestId,
        auditEventId: auditEvent.id,
        exportType: parsed.data.exportType,
      },
    })

    return ok(c, {
      id: requestId,
      exportType: parsed.data.exportType,
      format: parsed.data.format,
      scopeType: parsed.data.scopeType,
      scopeRefId: parsed.data.scopeRefId ?? null,
      reason: parsed.data.reason,
      auditEventId: auditEvent.id,
    }, 201)
  },
)

adminOpsRoutes.post(
  '/bizes/:bizId/members/bulk-delete',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('members.manage', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = await parseJsonBody(c, bulkDeleteMembersBodySchema)
    if (!parsed.ok) {
      return parsed.response
    }

    const expectedConfirmation = expectedBulkDeleteConfirmation(parsed.data.memberIds.length)
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
    await appendAuditEvent({
      bizId,
      streamKey: `tenant:${bizId}`,
      streamType: 'tenant',
      entityType: 'bulk_member_delete',
      entityId: batchId,
      eventType: 'delete',
      actorType: auditActorTypeFromSource(getCurrentAuthSource(c)),
      actorUserId: getCurrentUser(c)?.id ?? null,
      actorRef: getCurrentAuthCredentialId(c) ?? null,
      reasonCode: 'bulk_member_delete',
      note: sanitizePlainText(parsed.data.reason),
      requestRef: c.get('requestId') ?? null,
      sourceIp: c.req.header('x-forwarded-for') ?? null,
      userAgent: c.req.header('user-agent') ?? null,
      beforeState: { members: existingRows },
      afterState: { removedMemberIds: removedRows.map((row) => row.id) },
      metadata: {
        memberIds: parsed.data.memberIds,
        deletedCount: removedRows.length,
        confirmationText: parsed.data.confirmationText,
      },
    })

    await createOperationalAlert({
      bizId,
      recipientUserId: getCurrentUser(c)?.id ?? null,
      recipientRef: getCurrentUser(c)?.email ?? 'ops@bizing.local',
      subject: 'Bulk member delete executed',
      body: `Bulk member delete ${batchId} removed ${removedRows.length} members.`,
      metadata: {
        source: 'bulk_member_delete',
        batchId,
        deletedCount: removedRows.length,
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

adminOpsRoutes.post(
  '/bizes/:bizId/members/:memberId/offboard',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('members.manage', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, memberId } = c.req.param()
    const parsed = await parseJsonBody(c, offboardMemberBodySchema)
    if (!parsed.ok) {
      return parsed.response
    }

    if (parsed.data.checklist.some((item) => !item.completed)) {
      return fail(c, 'CHECKLIST_INCOMPLETE', 'All offboarding checklist items must be completed.', 409, {
        checklist: parsed.data.checklist,
      })
    }

    const existing = await db.query.members.findFirst({
      where: and(eq(members.organizationId, bizId), eq(members.id, memberId)),
    })
    if (!existing) {
      return fail(c, 'NOT_FOUND', 'Member not found.', 404)
    }

    const [removed] = await db
      .delete(members)
      .where(and(eq(members.organizationId, bizId), eq(members.id, memberId)))
      .returning({ id: members.id })

    if (!removed) {
      return fail(c, 'NOT_FOUND', 'Member not found.', 404)
    }

    await appendAuditEvent({
      bizId,
      streamKey: `member:${memberId}`,
      streamType: 'member',
      entityType: 'member_offboarding',
      entityId: memberId,
      eventType: 'state_transition',
      actorType: auditActorTypeFromSource(getCurrentAuthSource(c)),
      actorUserId: getCurrentUser(c)?.id ?? null,
      actorRef: getCurrentAuthCredentialId(c) ?? null,
      reasonCode: 'member_offboarded',
      note: sanitizePlainText(parsed.data.reason),
      requestRef: c.get('requestId') ?? null,
      sourceIp: c.req.header('x-forwarded-for') ?? null,
      userAgent: c.req.header('user-agent') ?? null,
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

    await createOperationalAlert({
      bizId,
      recipientUserId: getCurrentUser(c)?.id ?? null,
      recipientRef: getCurrentUser(c)?.email ?? 'ops@bizing.local',
      subject: 'Member offboarded',
      body: `Member ${memberId} was offboarded.`,
      metadata: {
        source: 'member_offboarded',
        memberId,
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
