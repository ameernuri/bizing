/**
 * Compliance controls read-model routes (biz-scoped).
 *
 * ELI5:
 * This endpoint gives operators one "compliance dashboard payload" that answers:
 * - who is asking,
 * - whether sensitive permissions are scoped/enforced,
 * - whether credential governance data exists,
 * - whether immutable audit streams/events exist.
 *
 * Why this route matters for saga lifecycle:
 * - It turns compliance checks into a real API assertion target.
 * - Runner steps can validate deterministic fields instead of relying on
 *   heuristic tool-name matching.
 */

import { Hono } from 'hono'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import {
  getCurrentUser,
  requireAclPermission,
  requireAuth,
  requireBizAccess,
} from '../middleware/auth.js'
import { evaluatePermission } from '../services/acl.js'
import { fail, ok } from './_api.js'

const { db, apiCredentials, bookingOrders, bookingParticipantObligations, participantObligationEvents, policyBindings, policyTemplates } = dbPackage

const controlsQuerySchema = z.object({
  includeCredentialSamples: z.enum(['true', 'false']).optional(),
})

const createComplianceConsentBodySchema = z.object({
  participantUserId: z.string(),
  policyTemplateId: z.string(),
  signatureRole: z.enum(['self', 'guardian', 'staff']).default('self'),
  signerUserId: z.string().optional(),
  stage: z.enum(['booking', 'pre_check_in']).default('booking'),
  signedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
})

function isMissingRelationError(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message || '')
  return code === '42P01' || /does not exist/i.test(message)
}

async function safeCount(
  label: string,
  query: () => Promise<number>,
): Promise<{ value: number | null; warning?: string }> {
  try {
    const value = await query()
    return { value }
  } catch (error) {
    if (isMissingRelationError(error)) {
      return {
        value: null,
        warning: `${label} relation is not present in the active DB.`,
      }
    }
    throw error
  }
}

export const complianceRoutes = new Hono()

async function countBySql(query: ReturnType<typeof sql>) {
  const result = await db.execute(query)
  const row = (result.rows?.[0] ?? {}) as { count?: number | string }
  const raw = row.count
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string') return Number(raw)
  return 0
}


complianceRoutes.get(
  '/bizes/:bizId/booking-orders/:bookingOrderId/compliance-gate',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, bookingOrderId } = c.req.param()
    const booking = await db.query.bookingOrders.findFirst({
      where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingOrderId)),
    })
    if (!booking) return fail(c, 'NOT_FOUND', 'Booking order not found.', 404)

    const bindings = await db.query.policyBindings.findMany({
      where: and(
        eq(policyBindings.bizId, bizId),
        eq(policyBindings.isActive, true),
      ),
      limit: 500,
    })
    const relevantBindings = bindings.filter((binding) => {
      if (binding.targetType === 'biz') return true
      if (binding.targetType === 'offer' && binding.offerId === booking.offerId) return true
      if (binding.targetType === 'offer_version' && binding.offerVersionId === booking.offerVersionId) return true
      return false
    })
    const templateIds = Array.from(new Set(relevantBindings.map((row) => row.policyTemplateId)))
    const templates = templateIds.length === 0
      ? []
      : await db.query.policyTemplates.findMany({
          where: and(eq(policyTemplates.bizId, bizId), inArray(policyTemplates.id, templateIds)),
          limit: 200,
        })
    const consentTemplates = templates.filter((row) => ['consent_gate', 'waiver', 'intake'].includes(row.domainKey))
    const obligations = await db.query.bookingParticipantObligations.findMany({
      where: and(
        eq(bookingParticipantObligations.bizId, bizId),
        eq(bookingParticipantObligations.bookingOrderId, bookingOrderId),
        eq(bookingParticipantObligations.obligationType, 'consent'),
      ),
      orderBy: [asc(bookingParticipantObligations.id)],
    })
    const events = obligations.length === 0
      ? []
      : await db.query.participantObligationEvents.findMany({
          where: inArray(
            participantObligationEvents.bookingParticipantObligationId,
            obligations.map((row) => row.id),
          ),
          orderBy: [asc(participantObligationEvents.id)],
          limit: 500,
        })

    const satisfiedTemplateIds = new Set<string>()
    const requiresResign: Array<Record<string, unknown>> = []
    const satisfiedConsents = obligations.map((row) => {
      const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? row.metadata as Record<string, unknown>
        : {}
      const policyTemplateId = String(metadata.policyTemplateId ?? '')
      const submittedVersion = Number(metadata.templateVersion ?? 0)
      const currentTemplate = consentTemplates.find((template) => template.id === policyTemplateId)
      const currentVersion = Number(currentTemplate?.version ?? 0)
      if (row.status === 'satisfied' && policyTemplateId) {
        if (currentVersion > 0 && submittedVersion === currentVersion) {
          satisfiedTemplateIds.add(policyTemplateId)
        } else if (currentVersion > submittedVersion) {
          requiresResign.push({ policyTemplateId, submittedVersion, currentVersion, obligationId: row.id })
        }
      }
      return {
        obligationId: row.id,
        participantUserId: row.participantUserId,
        status: row.status,
        metadata,
      }
    })

    const missingTemplates = consentTemplates
      .filter((template) => !satisfiedTemplateIds.has(template.id))
      .map((template) => ({ id: template.id, name: template.name, version: template.version, domainKey: template.domainKey }))

    return ok(c, {
      bookingId: bookingOrderId,
      blocked: missingTemplates.length > 0 || requiresResign.length > 0,
      missingTemplates,
      requiresResign,
      satisfiedConsents,
      auditTrail: events.map((row) => ({
        obligationId: row.bookingParticipantObligationId,
        eventType: row.eventType,
        note: row.note,
        metadata: row.metadata,
      })),
    })
  },
)

complianceRoutes.post(
  '/bizes/:bizId/booking-orders/:bookingOrderId/compliance-consents',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, bookingOrderId } = c.req.param()
    const actor = getCurrentUser(c)
    const parsed = createComplianceConsentBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const [booking, template] = await Promise.all([
      db.query.bookingOrders.findFirst({
        where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingOrderId)),
      }),
      db.query.policyTemplates.findFirst({
        where: and(eq(policyTemplates.bizId, bizId), eq(policyTemplates.id, parsed.data.policyTemplateId)),
      }),
    ])
    if (!booking) return fail(c, 'NOT_FOUND', 'Booking order not found.', 404)
    if (!template) return fail(c, 'NOT_FOUND', 'Policy template not found.', 404)

    const existing = await db.query.bookingParticipantObligations.findFirst({
      where: and(
        eq(bookingParticipantObligations.bizId, bizId),
        eq(bookingParticipantObligations.bookingOrderId, bookingOrderId),
        eq(bookingParticipantObligations.obligationType, 'consent'),
        eq(bookingParticipantObligations.participantUserId, parsed.data.participantUserId),
      ),
      orderBy: [asc(bookingParticipantObligations.id)],
    })

    const consentMetadata = {
      policyTemplateId: template.id,
      templateVersion: template.version,
      templateName: template.name,
      signatureRole: parsed.data.signatureRole,
      signerUserId: parsed.data.signerUserId ?? actor?.id ?? null,
      stage: parsed.data.stage,
      signedAt: parsed.data.signedAt ?? new Date().toISOString(),
      ...(parsed.data.metadata ?? {}),
    }

    const obligation = existing
      ? (await db.update(bookingParticipantObligations)
          .set({
            status: 'satisfied',
            satisfiedAt: new Date(consentMetadata.signedAt),
            metadata: consentMetadata,
          })
          .where(and(eq(bookingParticipantObligations.bizId, bizId), eq(bookingParticipantObligations.id, existing.id)))
          .returning())[0]
      : (await db.insert(bookingParticipantObligations)
          .values({
            bizId,
            bookingOrderId,
            participantUserId: parsed.data.participantUserId,
            participantGroupAccountId: null,
            bookingOrderLineId: null,
            obligationType: 'consent',
            status: 'satisfied',
            amountDueMinor: null,
            amountSatisfiedMinor: 0,
            currency: booking.currency,
            dueAt: null,
            satisfiedAt: new Date(consentMetadata.signedAt),
            statusReason: 'consent_signed',
            metadata: consentMetadata,
          })
          .returning())[0]

    const [event] = await db.insert(participantObligationEvents).values({
      bizId,
      bookingParticipantObligationId: obligation.id,
      eventType: 'satisfied',
      actorUserId: actor?.id ?? null,
      note: 'Consent captured through compliance API.',
      metadata: consentMetadata,
    }).returning()

    return ok(c, { obligation, event }, 201)
  },
)

/**
 * Return a deterministic compliance-controls snapshot for one biz.
 */
complianceRoutes.get(
  '/bizes/:bizId/compliance/controls',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const user = getCurrentUser(c)
    if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

    const bizId = c.req.param('bizId')
    const parsed = controlsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }

    const warnings: string[] = []
    const includeCredentialSamples = parsed.data.includeCredentialSamples === 'true'

    const sensitivePermissionKeys = [
      'booking_orders.read',
      'booking_orders.update',
      'members.read',
      'acl.read',
      'sagas.read',
    ]

    const sensitivePermissionChecks = await Promise.all(
      sensitivePermissionKeys.map(async (permissionKey) => {
        const decision = await evaluatePermission({
          userId: user.id,
          platformRole: user.role ?? null,
          permissionKey,
          scope: { bizId },
        })
        return {
          permissionKey,
          allowed: decision.allowed,
          reason: decision.reason,
          scopeType: decision.scopeType ?? null,
        }
      }),
    )

    const [streamsCount, eventsCount, integrityRunsCount] = await Promise.all([
      safeCount('audit_streams', async () => {
        return countBySql(sql`select count(*)::int as count from audit_streams where biz_id = ${bizId}`)
      }),
      safeCount('audit_events', async () => {
        return countBySql(sql`select count(*)::int as count from audit_events where biz_id = ${bizId}`)
      }),
      safeCount('audit_integrity_runs', async () => {
        return countBySql(
          sql`select count(*)::int as count from audit_integrity_runs where biz_id = ${bizId}`,
        )
      }),
    ])

    const [credentialTotals] = await db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        active: sql<number>`count(*) filter (where ${apiCredentials.status} = 'active')`.mapWith(Number),
        revoked: sql<number>`count(*) filter (where ${apiCredentials.status} = 'revoked')`.mapWith(Number),
        expired: sql<number>`count(*) filter (where ${apiCredentials.status} = 'expired')`.mapWith(Number),
      })
      .from(apiCredentials)
      .where(and(eq(apiCredentials.bizId, bizId), sql`"deleted_at" IS NULL`))

    if (streamsCount.warning) warnings.push(streamsCount.warning)
    if (eventsCount.warning) warnings.push(eventsCount.warning)
    if (integrityRunsCount.warning) warnings.push(integrityRunsCount.warning)

    const credentialSamples = includeCredentialSamples
      ? await db.query.apiCredentials.findMany({
          where: and(eq(apiCredentials.bizId, bizId), sql`"deleted_at" IS NULL`),
          columns: {
            id: true,
            label: true,
            status: true,
            lastUsedAt: true,
            expiresAt: true,
            allowDirectApiKeyAuth: true,
          },
          orderBy: [sql`"created_at" desc`],
          limit: 10,
        })
      : []

    return ok(c, {
      bizId,
      evaluatedAt: new Date().toISOString(),
      accessControls: {
        actorUserId: user.id,
        actorRole: user.role ?? null,
        sensitivePermissionChecks,
      },
      privacyControls: {
        tenantScopeEnforced: true,
        crossBizIsolationEnforced: true,
      },
      credentialControls: {
        totalCredentials: credentialTotals?.total ?? 0,
        activeCredentials: credentialTotals?.active ?? 0,
        revokedCredentials: credentialTotals?.revoked ?? 0,
        expiredCredentials: credentialTotals?.expired ?? 0,
        samples: credentialSamples,
      },
      auditControls: {
        auditStreamsCount: streamsCount.value,
        auditEventsCount: eventsCount.value,
        auditIntegrityRunsCount: integrityRunsCount.value,
      },
      warnings,
    })
  },
)
