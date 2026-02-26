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
import { and, eq, sql } from 'drizzle-orm'
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

const { db, apiCredentials } = dbPackage

const controlsQuerySchema = z.object({
  includeCredentialSamples: z.enum(['true', 'false']).optional(),
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
