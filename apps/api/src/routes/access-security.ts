/**
 * Access security routes.
 *
 * ELI5:
 * This is where the platform records "something suspicious happened" and
 * "what did we decide to do about it?"
 *
 * Why this route exists:
 * - digital delivery/security policy sagas need a concrete API,
 * - support and compliance need audit-friendly signal/decision rows,
 * - these are reusable primitives for fraud, abuse throttling, watermark
 *   violations, unusual geography, and future provider hooks.
 */

import { Hono } from 'hono'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { getCurrentUser, requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { fail, ok } from './_api.js'

const { db, accessSecuritySignals, accessSecurityDecisions } = dbPackage

async function createAccessSecurityRow<TTableKey extends 'accessSecuritySignals' | 'accessSecurityDecisions'>(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string,
  tableKey: TTableKey,
  data: Parameters<typeof executeCrudRouteAction>[0]['data'],
  meta: { subjectType: string; subjectId: string; displayName: string; source: string },
) {
  const result = await executeCrudRouteAction({
    c,
    bizId,
    tableKey,
    operation: 'create',
    data,
    subjectType: meta.subjectType,
    subjectId: meta.subjectId,
    displayName: meta.displayName,
    metadata: { source: meta.source },
  })
  if (!result.ok) return fail(c, result.code, result.message, result.httpStatus, result.details)
  if (!result.row) return fail(c, 'ACTION_EXECUTION_FAILED', `Missing row for ${tableKey} create.`, 500)
  return result.row
}

const signalBodySchema = z.object({
  accessArtifactId: z.string().optional().nullable(),
  accessActionTokenId: z.string().optional().nullable(),
  accessActivityLogId: z.string().optional().nullable(),
  signalType: z.enum(['ip_velocity', 'geo_anomaly', 'token_reuse', 'device_mismatch', 'download_burst', 'provider_risk', 'manual_flag', 'custom']),
  status: z.enum(['open', 'acknowledged', 'resolved', 'dismissed']).default('open'),
  severity: z.number().int().min(0).max(100).default(50),
  confidence: z.number().int().min(0).max(100).optional().nullable(),
  sourceSubjectType: z.string().max(80).optional().nullable(),
  sourceSubjectId: z.string().max(140).optional().nullable(),
  detectedAt: z.string().datetime().optional().nullable(),
  resolvedAt: z.string().datetime().optional().nullable(),
  details: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const decisionBodySchema = z.object({
  accessSecuritySignalId: z.string().optional().nullable(),
  accessArtifactId: z.string().optional().nullable(),
  accessActionTokenId: z.string().optional().nullable(),
  accessActivityLogId: z.string().optional().nullable(),
  outcome: z.enum(['allow', 'challenge', 'deny', 'manual_review', 'suspend_artifact', 'revoke_artifact']),
  status: z.enum(['active', 'expired', 'reverted']).default('active'),
  decidedBySubjectType: z.string().max(80).optional().nullable(),
  decidedBySubjectId: z.string().max(140).optional().nullable(),
  decidedAt: z.string().datetime().optional().nullable(),
  effectiveFrom: z.string().datetime().optional().nullable(),
  effectiveUntil: z.string().datetime().optional().nullable(),
  revertedAt: z.string().datetime().optional().nullable(),
  reasonCode: z.string().max(120).optional().nullable(),
  reasonText: z.string().max(4000).optional().nullable(),
  policySnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const accessSecurityRoutes = new Hono()

accessSecurityRoutes.get('/bizes/:bizId/access-security-signals', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const accessArtifactId = c.req.query('accessArtifactId')
  const rows = await db.query.accessSecuritySignals.findMany({
    where: and(eq(accessSecuritySignals.bizId, bizId), accessArtifactId ? eq(accessSecuritySignals.accessArtifactId, accessArtifactId) : undefined),
    orderBy: [desc(accessSecuritySignals.detectedAt)],
  })
  return ok(c, rows)
})

accessSecurityRoutes.post('/bizes/:bizId/access-security-signals', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = signalBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const row = await createAccessSecurityRow(
    c,
    bizId,
    'accessSecuritySignals',
    {
      bizId,
      accessArtifactId: parsed.data.accessArtifactId ?? null,
      accessActionTokenId: parsed.data.accessActionTokenId ?? null,
      accessActivityLogId: parsed.data.accessActivityLogId ?? null,
      signalType: parsed.data.signalType,
      status: parsed.data.status,
      severity: parsed.data.severity,
      confidence: parsed.data.confidence ?? null,
      sourceSubjectType: parsed.data.sourceSubjectType ?? null,
      sourceSubjectId: parsed.data.sourceSubjectId ?? null,
      detectedAt: parsed.data.detectedAt ? new Date(parsed.data.detectedAt) : new Date(),
      resolvedAt: parsed.data.resolvedAt ? new Date(parsed.data.resolvedAt) : null,
      details: parsed.data.details ?? {},
      metadata: parsed.data.metadata ?? {},
    },
    {
      subjectType: 'access_security_signal',
      subjectId: parsed.data.accessArtifactId ?? parsed.data.accessActionTokenId ?? parsed.data.accessActivityLogId ?? 'custom',
      displayName: parsed.data.signalType,
      source: 'routes.accessSecurity.createSignal',
    },
  )
  if (row instanceof Response) return row
  return ok(c, row, 201)
})

accessSecurityRoutes.get('/bizes/:bizId/access-security-decisions', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const accessArtifactId = c.req.query('accessArtifactId')
  const rows = await db.query.accessSecurityDecisions.findMany({
    where: and(eq(accessSecurityDecisions.bizId, bizId), accessArtifactId ? eq(accessSecurityDecisions.accessArtifactId, accessArtifactId) : undefined),
    orderBy: [desc(accessSecurityDecisions.decidedAt)],
  })
  return ok(c, rows)
})

accessSecurityRoutes.post('/bizes/:bizId/access-security-decisions', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const parsed = decisionBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const row = await createAccessSecurityRow(
    c,
    bizId,
    'accessSecurityDecisions',
    {
      bizId,
      accessSecuritySignalId: parsed.data.accessSecuritySignalId ?? null,
      accessArtifactId: parsed.data.accessArtifactId ?? null,
      accessActionTokenId: parsed.data.accessActionTokenId ?? null,
      accessActivityLogId: parsed.data.accessActivityLogId ?? null,
      outcome: parsed.data.outcome,
      status: parsed.data.status,
      decidedAt: parsed.data.decidedAt ? new Date(parsed.data.decidedAt) : new Date(),
      effectiveFrom: parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : new Date(),
      effectiveUntil: parsed.data.effectiveUntil ? new Date(parsed.data.effectiveUntil) : null,
      revertedAt: parsed.data.revertedAt ? new Date(parsed.data.revertedAt) : null,
      decidedByUserId:
        parsed.data.decidedBySubjectType || parsed.data.decidedBySubjectId ? null : user.id,
      decidedBySubjectType: parsed.data.decidedBySubjectType ?? null,
      decidedBySubjectId: parsed.data.decidedBySubjectId ?? null,
      reasonCode: parsed.data.reasonCode ?? null,
      reasonText: parsed.data.reasonText ?? null,
      policySnapshot: parsed.data.policySnapshot ?? {},
      metadata: parsed.data.metadata ?? {},
    },
    {
      subjectType: 'access_security_decision',
      subjectId: parsed.data.accessSecuritySignalId ?? parsed.data.accessArtifactId ?? 'custom',
      displayName: parsed.data.outcome,
      source: 'routes.accessSecurity.createDecision',
    },
  )
  if (row instanceof Response) return row
  return ok(c, row, 201)
})
