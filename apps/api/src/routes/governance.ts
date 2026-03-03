/**
 * Governance incident routes.
 *
 * ELI5:
 * A policy breach is "the rule was broken".
 * A consequence is "what happened because of that breach".
 *
 * These routes expose the normalized incident ledger directly so sagas can
 * prove immutable evidence, consequence lifecycle, and financial traceability.
 */

import { Hono } from 'hono'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { fail, ok } from './_api.js'

const { db, policyBreachEvents, policyConsequenceEvents } = dbPackage

const createBreachBodySchema = z.object({
  policyTemplateId: z.string().min(1),
  policyRuleId: z.string().optional(),
  policyBindingId: z.string().optional(),
  status: z.enum(['open', 'acknowledged', 'in_review', 'resolved', 'waived', 'dismissed']).default('open'),
  detectionSource: z.enum(['auto_engine', 'manual_review', 'external_import', 'plugin']).default('auto_engine'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  targetSubjectType: z.string().min(1).max(80),
  targetSubjectId: z.string().min(1).max(140),
  occurredAt: z.string().datetime().optional(),
  breachCode: z.string().max(120).optional(),
  summary: z.string().optional(),
  measuredValue: z.number().int().optional(),
  thresholdValue: z.number().int().optional(),
  evidence: z.record(z.unknown()).optional(),
  contextSnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createConsequenceBodySchema = z.object({
  policyBreachEventId: z.string().min(1),
  consequenceType: z.enum(['warning', 'cooldown', 'suspension', 'queue_review', 'workflow_trigger', 'compensation_adjustment', 'payment_adjustment', 'credit', 'debit', 'custom']),
  status: z.enum(['planned', 'applied', 'failed', 'reverted', 'cancelled']).default('planned'),
  amountMinor: z.number().int().optional(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()).default('USD'),
  compensationLedgerEntryId: z.string().optional(),
  paymentTransactionId: z.string().optional(),
  settlementEntryId: z.string().optional(),
  workflowInstanceId: z.string().optional(),
  reviewQueueItemId: z.string().optional(),
  details: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const governanceRoutes = new Hono()

async function createGovernanceRow<T extends Record<string, unknown>>(input: {
  c: Parameters<typeof fail>[0]
  bizId: string
  tableKey: string
  subjectType: string
  data: Record<string, unknown>
  displayName?: string
}) {
  const delegated = await executeCrudRouteAction({
    c: input.c,
    bizId: input.bizId,
    tableKey: input.tableKey,
    operation: 'create',
    subjectType: input.subjectType,
    displayName: input.displayName,
    data: input.data,
    metadata: { routeFamily: 'governance' },
  })
  if (!delegated.ok) return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  return delegated.row as T
}

async function updateGovernanceRow<T extends Record<string, unknown>>(input: {
  c: Parameters<typeof fail>[0]
  bizId: string
  tableKey: string
  subjectType: string
  id: string
  patch: Record<string, unknown>
  notFoundMessage: string
}) {
  const delegated = await executeCrudRouteAction({
    c: input.c,
    bizId: input.bizId,
    tableKey: input.tableKey,
    operation: 'update',
    id: input.id,
    subjectType: input.subjectType,
    subjectId: input.id,
    patch: input.patch,
    metadata: { routeFamily: 'governance' },
  })
  if (!delegated.ok) {
    if (delegated.code === 'CRUD_TARGET_NOT_FOUND') return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
    return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  }
  if (!delegated.row) return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
  return delegated.row as T
}

governanceRoutes.get('/bizes/:bizId/policy-breach-events', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.policyBreachEvents.findMany({
    where: eq(policyBreachEvents.bizId, bizId),
    orderBy: [asc(policyBreachEvents.occurredAt)],
  })
  return ok(c, rows)
})

governanceRoutes.post('/bizes/:bizId/policy-breach-events', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createBreachBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const row = await createGovernanceRow<typeof policyBreachEvents.$inferSelect>({
    c,
    bizId,
    tableKey: 'policyBreachEvents',
    subjectType: 'policy_breach_event',
    displayName: parsed.data.breachCode ?? parsed.data.targetSubjectType,
    data: {
    bizId,
    policyTemplateId: parsed.data.policyTemplateId,
    policyRuleId: parsed.data.policyRuleId ?? null,
    policyBindingId: parsed.data.policyBindingId ?? null,
    status: parsed.data.status,
    detectionSource: parsed.data.detectionSource,
    severity: parsed.data.severity,
    targetSubjectType: parsed.data.targetSubjectType,
    targetSubjectId: parsed.data.targetSubjectId,
    occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
    acknowledgedAt: parsed.data.status === 'acknowledged' || parsed.data.status === 'in_review' ? new Date() : null,
    resolvedAt: parsed.data.status === 'resolved' ? new Date() : null,
    waivedAt: parsed.data.status === 'waived' ? new Date() : null,
    dismissedAt: parsed.data.status === 'dismissed' ? new Date() : null,
    breachCode: parsed.data.breachCode ?? null,
    summary: parsed.data.summary ?? null,
    measuredValue: parsed.data.measuredValue ?? null,
    thresholdValue: parsed.data.thresholdValue ?? null,
    evidence: parsed.data.evidence ?? {},
    contextSnapshot: parsed.data.contextSnapshot ?? {},
    metadata: parsed.data.metadata ?? {},
    },
  })
  if (row instanceof Response) return row
  return ok(c, row, 201)
})

governanceRoutes.get('/bizes/:bizId/policy-consequence-events', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const policyBreachEventId = c.req.query('policyBreachEventId')
  const rows = await db.query.policyConsequenceEvents.findMany({
    where: and(eq(policyConsequenceEvents.bizId, bizId), policyBreachEventId ? eq(policyConsequenceEvents.policyBreachEventId, policyBreachEventId) : undefined),
    orderBy: [asc(policyConsequenceEvents.plannedAt)],
  })
  return ok(c, rows)
})

governanceRoutes.post('/bizes/:bizId/policy-consequence-events', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createConsequenceBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const now = new Date()
  const row = await createGovernanceRow<typeof policyConsequenceEvents.$inferSelect>({
    c,
    bizId,
    tableKey: 'policyConsequenceEvents',
    subjectType: 'policy_consequence_event',
    displayName: parsed.data.consequenceType,
    data: {
    bizId,
    policyBreachEventId: parsed.data.policyBreachEventId,
    consequenceType: parsed.data.consequenceType,
    status: parsed.data.status,
    plannedAt: now,
    appliedAt: parsed.data.status === 'applied' ? now : null,
    failedAt: parsed.data.status === 'failed' ? now : null,
    revertedAt: parsed.data.status === 'reverted' ? now : null,
    cancelledAt: parsed.data.status === 'cancelled' ? now : null,
    amountMinor: parsed.data.amountMinor ?? null,
    currency: parsed.data.currency,
    compensationLedgerEntryId: parsed.data.compensationLedgerEntryId ?? null,
    paymentTransactionId: parsed.data.paymentTransactionId ?? null,
    settlementEntryId: parsed.data.settlementEntryId ?? null,
    workflowInstanceId: parsed.data.workflowInstanceId ?? null,
    reviewQueueItemId: parsed.data.reviewQueueItemId ?? null,
    details: parsed.data.details ?? {},
    metadata: parsed.data.metadata ?? {},
    },
  })
  if (row instanceof Response) return row
  return ok(c, row, 201)
})

governanceRoutes.patch('/bizes/:bizId/policy-consequence-events/:consequenceId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, consequenceId } = c.req.param()
  const parsed = createConsequenceBodySchema.partial().safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const now = new Date()
  const row = await updateGovernanceRow<typeof policyConsequenceEvents.$inferSelect>({
    c,
    bizId,
    tableKey: 'policyConsequenceEvents',
    subjectType: 'policy_consequence_event',
    id: consequenceId,
    notFoundMessage: 'Policy consequence event not found.',
    patch: {
    status: parsed.data.status,
    appliedAt: parsed.data.status === 'applied' ? now : undefined,
    failedAt: parsed.data.status === 'failed' ? now : undefined,
    revertedAt: parsed.data.status === 'reverted' ? now : undefined,
    cancelledAt: parsed.data.status === 'cancelled' ? now : undefined,
    amountMinor: parsed.data.amountMinor,
    currency: parsed.data.currency,
    compensationLedgerEntryId: parsed.data.compensationLedgerEntryId,
    paymentTransactionId: parsed.data.paymentTransactionId,
    settlementEntryId: parsed.data.settlementEntryId,
    workflowInstanceId: parsed.data.workflowInstanceId,
    reviewQueueItemId: parsed.data.reviewQueueItemId,
    details: parsed.data.details,
    metadata: parsed.data.metadata,
    },
  })
  if (row instanceof Response) return row
  if (!row) return fail(c, 'NOT_FOUND', 'Policy consequence event not found.', 404)
  return ok(c, row)
})
