/**
 * Leave / PTO routes.
 *
 * ELI5:
 * Timekeeping alone is not enough. Workforce systems also need to answer:
 * - how much leave does this worker have?
 * - what policy gives them that leave?
 * - what requests were approved or denied?
 * - what balance events changed the number?
 */

import { Hono } from 'hono'
import { and, asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { fail, ok } from './_api.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'

const { db, leavePolicies, leaveBalances, leaveRequests, leaveEvents } = dbPackage

const createPolicyBodySchema = z.object({
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('draft'),
  locationId: z.string().optional().nullable(),
  resourceType: z.enum(['host', 'company_host']).optional().nullable(),
  unit: z.enum(['hours', 'days']).default('hours'),
  accrualPeriod: z.enum(['per_hour_worked', 'weekly', 'biweekly', 'monthly', 'yearly', 'manual']).default('monthly'),
  accrualRate: z.union([z.number(), z.string()]).default(0),
  annualAllowance: z.union([z.number(), z.string()]).default(0),
  carryoverMax: z.union([z.number(), z.string()]).optional().nullable(),
  allowNegativeBalance: z.boolean().default(false),
  minNoticeMinutes: z.number().int().min(0).default(0),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createBalanceBodySchema = z.object({
  leavePolicyId: z.string().min(1),
  resourceId: z.string().min(1),
  balanceAmount: z.union([z.number(), z.string()]).default(0),
  reservedAmount: z.union([z.number(), z.string()]).default(0),
  usedAmount: z.union([z.number(), z.string()]).default(0),
  asOfAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const createRequestBodySchema = z.object({
  leavePolicyId: z.string().min(1),
  resourceId: z.string().min(1),
  requesterUserId: z.string().optional().nullable(),
  approverUserId: z.string().optional().nullable(),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).default('pending'),
  unit: z.enum(['hours', 'days']),
  quantityRequested: z.union([z.number(), z.string()]),
  quantityApproved: z.union([z.number(), z.string()]).optional().nullable(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  reason: z.string().optional(),
  decisionReason: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})
const patchRequestBodySchema = createRequestBodySchema.partial()

const createEventBodySchema = z.object({
  leavePolicyId: z.string().min(1),
  resourceId: z.string().min(1),
  leaveRequestId: z.string().optional().nullable(),
  eventType: z.enum(['grant', 'accrual', 'adjustment', 'request_approved', 'request_reversed', 'carryover', 'expiry']),
  amountDelta: z.union([z.number(), z.string()]),
  resultingBalance: z.union([z.number(), z.string()]).optional().nullable(),
  actorUserId: z.string().optional().nullable(),
  note: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const leaveRoutes = new Hono()

async function createLeaveRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'leave' },
  })
  if (!delegated.ok) return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  return delegated.row as T
}

async function updateLeaveRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'leave' },
  })
  if (!delegated.ok) {
    if (delegated.code === 'CRUD_TARGET_NOT_FOUND') return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
    return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  }
  if (!delegated.row) return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
  return delegated.row as T
}

leaveRoutes.get('/bizes/:bizId/leave-policies', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.leavePolicies.findMany({ where: eq(leavePolicies.bizId, bizId), orderBy: [asc(leavePolicies.name)] })
  return ok(c, rows)
})

leaveRoutes.post('/bizes/:bizId/leave-policies', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createPolicyBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const created = await createLeaveRow<typeof leavePolicies.$inferSelect>({
    c,
    bizId,
    tableKey: 'leavePolicies',
    subjectType: 'leave_policy',
    displayName: parsed.data.name,
    data: {
    bizId,
    name: sanitizePlainText(parsed.data.name),
    slug: sanitizePlainText(parsed.data.slug),
    status: parsed.data.status,
    locationId: parsed.data.locationId ?? null,
    resourceType: parsed.data.resourceType ?? null,
    unit: parsed.data.unit,
    accrualPeriod: parsed.data.accrualPeriod,
    accrualRate: String(parsed.data.accrualRate),
    annualAllowance: String(parsed.data.annualAllowance),
    carryoverMax: parsed.data.carryoverMax === undefined || parsed.data.carryoverMax === null ? null : String(parsed.data.carryoverMax),
    allowNegativeBalance: parsed.data.allowNegativeBalance,
    minNoticeMinutes: parsed.data.minNoticeMinutes,
    policy: sanitizeUnknown(parsed.data.policy ?? {}),
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (created instanceof Response) return created
  return ok(c, created, 201)
})

leaveRoutes.get('/bizes/:bizId/leave-balances', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.leaveBalances.findMany({ where: eq(leaveBalances.bizId, bizId), orderBy: [desc(leaveBalances.asOfAt)] })
  return ok(c, rows)
})

leaveRoutes.post('/bizes/:bizId/leave-balances', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createBalanceBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const existing = await db.query.leaveBalances.findFirst({
    where: and(eq(leaveBalances.bizId, bizId), eq(leaveBalances.leavePolicyId, parsed.data.leavePolicyId), eq(leaveBalances.resourceId, parsed.data.resourceId)),
  })
  const payload = {
    leavePolicyId: parsed.data.leavePolicyId,
    resourceId: parsed.data.resourceId,
    balanceAmount: String(parsed.data.balanceAmount),
    reservedAmount: String(parsed.data.reservedAmount),
    usedAmount: String(parsed.data.usedAmount),
    asOfAt: parsed.data.asOfAt ? new Date(parsed.data.asOfAt) : new Date(),
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
  }
  const created = existing
    ? await updateLeaveRow<typeof leaveBalances.$inferSelect>({
      c,
      bizId,
      tableKey: 'leaveBalances',
      subjectType: 'leave_balance',
      id: existing.id,
      patch: payload,
      notFoundMessage: 'Leave balance not found.',
    })
    : await createLeaveRow<typeof leaveBalances.$inferSelect>({
      c,
      bizId,
      tableKey: 'leaveBalances',
      subjectType: 'leave_balance',
      displayName: parsed.data.resourceId,
      data: { bizId, ...payload },
    })
  if (created instanceof Response) return created
  return ok(c, created, 201)
})

leaveRoutes.get('/bizes/:bizId/leave-requests', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.leaveRequests.findMany({ where: eq(leaveRequests.bizId, bizId), orderBy: [desc(leaveRequests.startAt)] })
  return ok(c, rows)
})

leaveRoutes.post('/bizes/:bizId/leave-requests', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createRequestBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const created = await createLeaveRow<typeof leaveRequests.$inferSelect>({
    c,
    bizId,
    tableKey: 'leaveRequests',
    subjectType: 'leave_request',
    displayName: parsed.data.resourceId,
    data: {
    bizId,
    leavePolicyId: parsed.data.leavePolicyId,
    resourceId: parsed.data.resourceId,
    requesterUserId: parsed.data.requesterUserId ?? null,
    approverUserId: parsed.data.approverUserId ?? null,
    status: parsed.data.status,
    unit: parsed.data.unit,
    quantityRequested: String(parsed.data.quantityRequested),
    quantityApproved: parsed.data.quantityApproved === undefined || parsed.data.quantityApproved === null ? null : String(parsed.data.quantityApproved),
    startAt: new Date(parsed.data.startAt),
    endAt: new Date(parsed.data.endAt),
    reason: parsed.data.reason ? sanitizePlainText(parsed.data.reason) : null,
    decisionReason: parsed.data.decisionReason ? sanitizePlainText(parsed.data.decisionReason) : null,
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (created instanceof Response) return created
  return ok(c, created, 201)
})

leaveRoutes.patch('/bizes/:bizId/leave-requests/:leaveRequestId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, leaveRequestId } = c.req.param()
  const parsed = patchRequestBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const created = await updateLeaveRow<typeof leaveRequests.$inferSelect>({
    c,
    bizId,
    tableKey: 'leaveRequests',
    subjectType: 'leave_request',
    id: leaveRequestId,
    patch: {
    leavePolicyId: parsed.data.leavePolicyId ?? undefined,
    resourceId: parsed.data.resourceId ?? undefined,
    requesterUserId: parsed.data.requesterUserId ?? undefined,
    approverUserId: parsed.data.approverUserId ?? undefined,
    status: parsed.data.status ?? undefined,
    unit: parsed.data.unit ?? undefined,
    quantityRequested: parsed.data.quantityRequested === undefined ? undefined : String(parsed.data.quantityRequested),
    quantityApproved: parsed.data.quantityApproved === undefined ? undefined : parsed.data.quantityApproved === null ? null : String(parsed.data.quantityApproved),
    startAt: parsed.data.startAt === undefined ? undefined : new Date(parsed.data.startAt),
    endAt: parsed.data.endAt === undefined ? undefined : new Date(parsed.data.endAt),
    reason: parsed.data.reason === undefined ? undefined : parsed.data.reason ? sanitizePlainText(parsed.data.reason) : null,
    decisionReason: parsed.data.decisionReason === undefined ? undefined : parsed.data.decisionReason ? sanitizePlainText(parsed.data.decisionReason) : null,
    metadata: parsed.data.metadata ? sanitizeUnknown(parsed.data.metadata) : undefined,
    },
    notFoundMessage: 'Leave request not found.',
  })
  if (created instanceof Response) return created
  if (!created) return fail(c, 'NOT_FOUND', 'Leave request not found.', 404)
  return ok(c, created)
})

leaveRoutes.get('/bizes/:bizId/leave-events', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.leaveEvents.findMany({ where: eq(leaveEvents.bizId, bizId), orderBy: [desc(leaveEvents.occurredAt)] })
  return ok(c, rows)
})

leaveRoutes.post('/bizes/:bizId/leave-events', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createEventBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const created = await createLeaveRow<typeof leaveEvents.$inferSelect>({
    c,
    bizId,
    tableKey: 'leaveEvents',
    subjectType: 'leave_event',
    displayName: parsed.data.eventType,
    data: {
    bizId,
    leavePolicyId: parsed.data.leavePolicyId,
    resourceId: parsed.data.resourceId,
    leaveRequestId: parsed.data.leaveRequestId ?? null,
    eventType: parsed.data.eventType,
    amountDelta: String(parsed.data.amountDelta),
    resultingBalance: parsed.data.resultingBalance === undefined || parsed.data.resultingBalance === null ? null : String(parsed.data.resultingBalance),
    actorUserId: parsed.data.actorUserId ?? null,
    note: parsed.data.note ? sanitizePlainText(parsed.data.note) : null,
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (created instanceof Response) return created
  return ok(c, created, 201)
})
