/**
 * Commitment + escrow routes.
 *
 * ELI5:
 * - A commitment contract is the agreement.
 * - Obligations are the things that must happen.
 * - Milestones say when money can release.
 * - Secured-balance accounts/ledger rows hold the audit truth of held money.
 * - Claims model disputes, damage, and settlement outcomes.
 *
 * Why this matters:
 * - escrow and damage/dispute flows should be first-class,
 * - saga coverage should prove the real contract lifecycle through the API,
 * - funds release should be traceable without bespoke per-vertical tables.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { getCurrentUser, requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok } from './_api.js'

const {
  db,
  commitmentContracts,
  commitmentObligations,
  commitmentMilestones,
  commitmentMilestoneObligations,
  securedBalanceAccounts,
  securedBalanceLedgerEntries,
  securedBalanceAllocations,
  commitmentClaims,
  commitmentClaimEvents,
} = dbPackage

const contractBodySchema = z.object({
  contractType: z.enum(['escrow', 'retainage', 'service_commitment', 'payment_assurance', 'custom']),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'cancelled', 'defaulted', 'disputed']).default('draft'),
  title: z.string().min(1).max(220),
  description: z.string().max(8000).optional(),
  anchorSubjectType: z.string().min(1).max(80),
  anchorSubjectId: z.string().min(1).max(140),
  counterpartySubjectType: z.string().max(80).optional(),
  counterpartySubjectId: z.string().max(140).optional(),
  offerVersionId: z.string().optional(),
  bookingOrderId: z.string().optional(),
  arInvoiceId: z.string().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  committedAmountMinor: z.number().int().min(0).default(0),
  releasedAmountMinor: z.number().int().min(0).default(0),
  forfeitedAmountMinor: z.number().int().min(0).default(0),
  startedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  cancelledAt: z.string().datetime().optional(),
  policySnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const obligationBodySchema = z.object({
  obligationType: z.enum(['payment', 'service_delivery', 'evidence_submission', 'inspection_pass', 'approval', 'custom']),
  status: z.enum(['pending', 'in_progress', 'satisfied', 'waived', 'breached', 'cancelled', 'expired']).default('pending'),
  title: z.string().min(1).max(220),
  description: z.string().max(8000).optional(),
  obligorSubjectType: z.string().max(80).optional(),
  obligorSubjectId: z.string().max(140).optional(),
  beneficiarySubjectType: z.string().max(80).optional(),
  beneficiarySubjectId: z.string().max(140).optional(),
  requiredAmountMinor: z.number().int().min(0).optional(),
  satisfiedAmountMinor: z.number().int().min(0).default(0),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  dueAt: z.string().datetime().optional(),
  satisfiedAt: z.string().datetime().optional(),
  breachedAt: z.string().datetime().optional(),
  waivedAt: z.string().datetime().optional(),
  cancelledAt: z.string().datetime().optional(),
  sourceSubjectType: z.string().max(80).optional(),
  sourceSubjectId: z.string().max(140).optional(),
  sortOrder: z.number().int().min(0).default(100),
  evidencePolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const milestoneBodySchema = z.object({
  code: z.string().min(1).max(100),
  title: z.string().min(1).max(220),
  description: z.string().max(8000).optional(),
  status: z.enum(['pending', 'ready', 'released', 'skipped', 'cancelled']).default('pending'),
  evaluationMode: z.enum(['all', 'any', 'threshold']).default('all'),
  minSatisfiedCount: z.number().int().positive().optional(),
  releaseMode: z.enum(['manual', 'automatic']).default('manual'),
  releaseAmountMinor: z.number().int().min(0),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  dueAt: z.string().datetime().optional(),
  readyAt: z.string().datetime().optional(),
  releasedAt: z.string().datetime().optional(),
  cancelledAt: z.string().datetime().optional(),
  releasedByUserId: z.string().optional(),
  sortOrder: z.number().int().min(0).default(100),
  policySnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const milestoneLinkBodySchema = z.object({
  commitmentObligationId: z.string().min(1),
  isRequired: z.boolean().default(true),
  weight: z.number().int().positive().default(1),
  sortOrder: z.number().int().min(0).default(100),
  metadata: z.record(z.unknown()).optional(),
})

const accountBodySchema = z.object({
  accountType: z.enum(['escrow', 'retainage', 'deposit', 'assurance', 'custom']),
  status: z.enum(['open', 'locked', 'releasing', 'frozen', 'closed']).default('open'),
  title: z.string().min(1).max(220),
  description: z.string().max(8000).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  balanceMinor: z.number().int().min(0).default(0),
  heldMinor: z.number().int().min(0).default(0),
  releasedMinor: z.number().int().min(0).default(0),
  forfeitedMinor: z.number().int().min(0).default(0),
  ownerSubjectType: z.string().min(1).max(80),
  ownerSubjectId: z.string().min(1).max(140),
  counterpartySubjectType: z.string().max(80).optional(),
  counterpartySubjectId: z.string().max(140).optional(),
  openedAt: z.string().datetime().optional(),
  closedAt: z.string().datetime().optional(),
  policySnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const ledgerEntryBodySchema = z.object({
  entryType: z.enum(['fund', 'hold', 'release', 'refund', 'forfeit', 'adjustment', 'transfer_in', 'transfer_out']),
  status: z.enum(['pending', 'posted', 'reversed', 'failed']).default('posted'),
  occurredAt: z.string().datetime().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  balanceDeltaMinor: z.number().int().default(0),
  heldDeltaMinor: z.number().int().default(0),
  commitmentContractId: z.string().optional(),
  commitmentMilestoneId: z.string().optional(),
  commitmentObligationId: z.string().optional(),
  paymentTransactionId: z.string().optional(),
  arInvoiceId: z.string().optional(),
  bookingOrderId: z.string().optional(),
  bookingOrderLineId: z.string().optional(),
  sourceSubjectType: z.string().max(80).optional(),
  sourceSubjectId: z.string().max(140).optional(),
  idempotencyKey: z.string().max(200).optional(),
  reasonCode: z.string().max(120).optional(),
  notes: z.string().max(8000).optional(),
  metadata: z.record(z.unknown()).optional(),
}).superRefine((value, ctx) => {
  if (value.balanceDeltaMinor === 0 && value.heldDeltaMinor === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'At least one delta must be non-zero.' })
  }
})

const allocationBodySchema = z.object({
  allocationType: z.enum(['obligation_settlement', 'milestone_release', 'refund', 'forfeit', 'adjustment']),
  allocatedAmountMinor: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  commitmentObligationId: z.string().optional(),
  commitmentMilestoneId: z.string().optional(),
  bookingOrderLineId: z.string().optional(),
  arInvoiceId: z.string().optional(),
  paymentTransactionLineAllocationId: z.string().optional(),
  targetSubjectType: z.string().max(80).optional(),
  targetSubjectId: z.string().max(140).optional(),
  occurredAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const claimBodySchema = z.object({
  claimType: z.enum(['non_delivery', 'quality_issue', 'damage', 'billing_dispute', 'fraud', 'sla_breach', 'custom']),
  status: z.enum(['open', 'in_review', 'escalated', 'resolved', 'rejected', 'cancelled', 'closed']).default('open'),
  resolutionType: z.enum(['release_funds', 'refund', 'forfeit', 'partial_settlement', 'rework_required', 'no_action', 'other']).optional(),
  title: z.string().min(1).max(220),
  description: z.string().max(8000).optional(),
  raisedBySubjectType: z.string().min(1).max(80),
  raisedBySubjectId: z.string().min(1).max(140),
  againstSubjectType: z.string().max(80).optional(),
  againstSubjectId: z.string().max(140).optional(),
  disputedAmountMinor: z.number().int().min(0).optional(),
  settledAmountMinor: z.number().int().min(0).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  openedAt: z.string().datetime().optional(),
  resolvedAt: z.string().datetime().optional(),
  closedAt: z.string().datetime().optional(),
  policySnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const claimPatchSchema = claimBodySchema.partial()

const claimEventBodySchema = z.object({
  eventType: z.enum(['opened', 'note', 'evidence_added', 'amount_updated', 'escalated', 'resolution_proposed', 'resolved', 'reopened', 'closed']),
  occurredAt: z.string().datetime().optional(),
  actorSubjectType: z.string().max(80).optional(),
  actorSubjectId: z.string().max(140).optional(),
  note: z.string().max(8000).optional(),
  metadata: z.record(z.unknown()).optional(),
})

async function createCommitmentRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'commitments' },
  })
  if (!delegated.ok) {
    return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  }
  return delegated.row as T
}

async function updateCommitmentRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'commitments' },
  })
  if (!delegated.ok) {
    if (delegated.code === 'CRUD_TARGET_NOT_FOUND') return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
    return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  }
  if (!delegated.row) return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
  return delegated.row as T
}

export const commitmentRoutes = new Hono()

commitmentRoutes.get('/bizes/:bizId/commitment-contracts', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.commitmentContracts.findMany({
    where: eq(commitmentContracts.bizId, bizId),
    orderBy: [desc(commitmentContracts.startedAt)],
  })
  return ok(c, rows)
})

commitmentRoutes.post('/bizes/:bizId/commitment-contracts', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = contractBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

  const createdOrResponse = await createCommitmentRow<typeof commitmentContracts.$inferSelect>({
    c,
    bizId,
    tableKey: 'commitmentContracts',
    subjectType: 'commitment_contract',
    displayName: parsed.data.title,
    data: {
      bizId,
      contractType: parsed.data.contractType,
      status: parsed.data.status,
      title: sanitizePlainText(parsed.data.title),
      description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
      anchorSubjectType: parsed.data.anchorSubjectType,
      anchorSubjectId: parsed.data.anchorSubjectId,
      counterpartySubjectType: parsed.data.counterpartySubjectType ?? null,
      counterpartySubjectId: parsed.data.counterpartySubjectId ?? null,
      offerVersionId: parsed.data.offerVersionId ?? null,
      bookingOrderId: parsed.data.bookingOrderId ?? null,
      arInvoiceId: parsed.data.arInvoiceId ?? null,
      currency: parsed.data.currency,
      committedAmountMinor: parsed.data.committedAmountMinor,
      releasedAmountMinor: parsed.data.releasedAmountMinor,
      forfeitedAmountMinor: parsed.data.forfeitedAmountMinor,
      startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : null,
      cancelledAt: parsed.data.cancelledAt ? new Date(parsed.data.cancelledAt) : null,
      policySnapshot: sanitizeUnknown(parsed.data.policySnapshot ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (createdOrResponse instanceof Response) return createdOrResponse
  const created = createdOrResponse
  return ok(c, created, 201)
})

commitmentRoutes.get('/bizes/:bizId/commitment-contracts/:contractId/obligations', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, contractId } = c.req.param()
  const rows = await db.query.commitmentObligations.findMany({
    where: and(eq(commitmentObligations.bizId, bizId), eq(commitmentObligations.commitmentContractId, contractId)),
    orderBy: [asc(commitmentObligations.sortOrder)],
  })
  return ok(c, rows)
})

commitmentRoutes.post('/bizes/:bizId/commitment-contracts/:contractId/obligations', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, contractId } = c.req.param()
  const parsed = obligationBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

  const createdOrResponse = await createCommitmentRow<typeof commitmentObligations.$inferSelect>({
    c,
    bizId,
    tableKey: 'commitmentObligations',
    subjectType: 'commitment_obligation',
    displayName: parsed.data.title,
    data: {
      bizId,
      commitmentContractId: contractId,
      obligationType: parsed.data.obligationType,
      status: parsed.data.status,
      title: sanitizePlainText(parsed.data.title),
      description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
      obligorSubjectType: parsed.data.obligorSubjectType ?? null,
      obligorSubjectId: parsed.data.obligorSubjectId ?? null,
      beneficiarySubjectType: parsed.data.beneficiarySubjectType ?? null,
      beneficiarySubjectId: parsed.data.beneficiarySubjectId ?? null,
      requiredAmountMinor: parsed.data.requiredAmountMinor ?? null,
      satisfiedAmountMinor: parsed.data.satisfiedAmountMinor,
      currency: parsed.data.currency,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      satisfiedAt: parsed.data.satisfiedAt ? new Date(parsed.data.satisfiedAt) : null,
      breachedAt: parsed.data.breachedAt ? new Date(parsed.data.breachedAt) : null,
      waivedAt: parsed.data.waivedAt ? new Date(parsed.data.waivedAt) : null,
      cancelledAt: parsed.data.cancelledAt ? new Date(parsed.data.cancelledAt) : null,
      sourceSubjectType: parsed.data.sourceSubjectType ?? null,
      sourceSubjectId: parsed.data.sourceSubjectId ?? null,
      sortOrder: parsed.data.sortOrder,
      evidencePolicy: sanitizeUnknown(parsed.data.evidencePolicy ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (createdOrResponse instanceof Response) return createdOrResponse
  const created = createdOrResponse
  return ok(c, created, 201)
})

commitmentRoutes.patch('/bizes/:bizId/commitment-contracts/:contractId/obligations/:obligationId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, contractId, obligationId } = c.req.param()
  const parsed = obligationBodySchema.partial().safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const existing = await db.query.commitmentObligations.findFirst({
    where: and(
      eq(commitmentObligations.bizId, bizId),
      eq(commitmentObligations.commitmentContractId, contractId),
      eq(commitmentObligations.id, obligationId),
    ),
    columns: { id: true },
  })
  if (!existing) return fail(c, 'NOT_FOUND', 'Commitment obligation not found.', 404)

  const updatedOrResponse = await updateCommitmentRow<typeof commitmentObligations.$inferSelect>({
    c,
    bizId,
    tableKey: 'commitmentObligations',
    subjectType: 'commitment_obligation',
    id: obligationId,
    notFoundMessage: 'Commitment obligation not found.',
    patch: {
      ...('status' in parsed.data ? { status: parsed.data.status } : {}),
      ...('title' in parsed.data ? { title: parsed.data.title ? sanitizePlainText(parsed.data.title) : undefined } : {}),
      ...('description' in parsed.data ? { description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null } : {}),
      ...('requiredAmountMinor' in parsed.data ? { requiredAmountMinor: parsed.data.requiredAmountMinor ?? null } : {}),
      ...('satisfiedAmountMinor' in parsed.data ? { satisfiedAmountMinor: parsed.data.satisfiedAmountMinor } : {}),
      ...('dueAt' in parsed.data ? { dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null } : {}),
      ...('satisfiedAt' in parsed.data ? { satisfiedAt: parsed.data.satisfiedAt ? new Date(parsed.data.satisfiedAt) : null } : {}),
      ...('breachedAt' in parsed.data ? { breachedAt: parsed.data.breachedAt ? new Date(parsed.data.breachedAt) : null } : {}),
      ...('waivedAt' in parsed.data ? { waivedAt: parsed.data.waivedAt ? new Date(parsed.data.waivedAt) : null } : {}),
      ...('cancelledAt' in parsed.data ? { cancelledAt: parsed.data.cancelledAt ? new Date(parsed.data.cancelledAt) : null } : {}),
      ...('metadata' in parsed.data ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
    },
  })
  if (updatedOrResponse instanceof Response) return updatedOrResponse
  const updated = updatedOrResponse
  return ok(c, updated)
})

commitmentRoutes.get('/bizes/:bizId/commitment-contracts/:contractId/milestones', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, contractId } = c.req.param()
  const rows = await db.query.commitmentMilestones.findMany({
    where: and(eq(commitmentMilestones.bizId, bizId), eq(commitmentMilestones.commitmentContractId, contractId)),
    orderBy: [asc(commitmentMilestones.sortOrder)],
  })
  return ok(c, rows)
})

commitmentRoutes.post('/bizes/:bizId/commitment-contracts/:contractId/milestones', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, contractId } = c.req.param()
  const parsed = milestoneBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

  const createdOrResponse = await createCommitmentRow<typeof commitmentMilestones.$inferSelect>({
    c,
    bizId,
    tableKey: 'commitmentMilestones',
    subjectType: 'commitment_milestone',
    displayName: parsed.data.title,
    data: {
      bizId,
      commitmentContractId: contractId,
      code: sanitizePlainText(parsed.data.code),
      title: sanitizePlainText(parsed.data.title),
      description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
      status: parsed.data.status,
      evaluationMode: parsed.data.evaluationMode,
      minSatisfiedCount: parsed.data.minSatisfiedCount ?? null,
      releaseMode: parsed.data.releaseMode,
      releaseAmountMinor: parsed.data.releaseAmountMinor,
      currency: parsed.data.currency,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      readyAt: parsed.data.readyAt ? new Date(parsed.data.readyAt) : null,
      releasedAt: parsed.data.releasedAt ? new Date(parsed.data.releasedAt) : null,
      cancelledAt: parsed.data.cancelledAt ? new Date(parsed.data.cancelledAt) : null,
      releasedByUserId: parsed.data.releasedByUserId ?? null,
      sortOrder: parsed.data.sortOrder,
      policySnapshot: sanitizeUnknown(parsed.data.policySnapshot ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (createdOrResponse instanceof Response) return createdOrResponse
  const created = createdOrResponse
  return ok(c, created, 201)
})

commitmentRoutes.patch('/bizes/:bizId/commitment-contracts/:contractId/milestones/:milestoneId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, contractId, milestoneId } = c.req.param()
  const parsed = milestoneBodySchema.partial().safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const existing = await db.query.commitmentMilestones.findFirst({
    where: and(
      eq(commitmentMilestones.bizId, bizId),
      eq(commitmentMilestones.commitmentContractId, contractId),
      eq(commitmentMilestones.id, milestoneId),
    ),
    columns: { id: true },
  })
  if (!existing) return fail(c, 'NOT_FOUND', 'Commitment milestone not found.', 404)

  const updatedOrResponse = await updateCommitmentRow<typeof commitmentMilestones.$inferSelect>({
    c,
    bizId,
    tableKey: 'commitmentMilestones',
    subjectType: 'commitment_milestone',
    id: milestoneId,
    notFoundMessage: 'Commitment milestone not found.',
    patch: {
      ...('status' in parsed.data ? { status: parsed.data.status } : {}),
      ...('readyAt' in parsed.data ? { readyAt: parsed.data.readyAt ? new Date(parsed.data.readyAt) : null } : {}),
      ...('releasedAt' in parsed.data ? { releasedAt: parsed.data.releasedAt ? new Date(parsed.data.releasedAt) : null } : {}),
      ...('cancelledAt' in parsed.data ? { cancelledAt: parsed.data.cancelledAt ? new Date(parsed.data.cancelledAt) : null } : {}),
      ...('releasedByUserId' in parsed.data ? { releasedByUserId: parsed.data.releasedByUserId ?? null } : {}),
      ...('metadata' in parsed.data ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
    },
  })
  if (updatedOrResponse instanceof Response) return updatedOrResponse
  const updated = updatedOrResponse
  return ok(c, updated)
})

commitmentRoutes.get('/bizes/:bizId/commitment-contracts/:contractId/milestones/:milestoneId/obligations', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, milestoneId } = c.req.param()
  const rows = await db.query.commitmentMilestoneObligations.findMany({
    where: and(eq(commitmentMilestoneObligations.bizId, bizId), eq(commitmentMilestoneObligations.commitmentMilestoneId, milestoneId)),
    orderBy: [asc(commitmentMilestoneObligations.sortOrder)],
  })
  return ok(c, rows)
})

commitmentRoutes.post('/bizes/:bizId/commitment-contracts/:contractId/milestones/:milestoneId/obligations', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, contractId, milestoneId } = c.req.param()
  const parsed = milestoneLinkBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

  const createdOrResponse = await createCommitmentRow<typeof commitmentMilestoneObligations.$inferSelect>({
    c,
    bizId,
    tableKey: 'commitmentMilestoneObligations',
    subjectType: 'commitment_milestone_obligation',
    data: {
      bizId,
      commitmentContractId: contractId,
      commitmentMilestoneId: milestoneId,
      commitmentObligationId: parsed.data.commitmentObligationId,
      isRequired: parsed.data.isRequired,
      weight: parsed.data.weight,
      sortOrder: parsed.data.sortOrder,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (createdOrResponse instanceof Response) return createdOrResponse
  const created = createdOrResponse
  return ok(c, created, 201)
})

commitmentRoutes.get('/bizes/:bizId/secured-balance-accounts', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const commitmentContractId = c.req.query('commitmentContractId')
  const rows = await db.query.securedBalanceAccounts.findMany({
    where: and(eq(securedBalanceAccounts.bizId, bizId), commitmentContractId ? eq(securedBalanceAccounts.commitmentContractId, commitmentContractId) : undefined),
    orderBy: [desc(securedBalanceAccounts.openedAt)],
  })
  return ok(c, rows)
})

commitmentRoutes.post('/bizes/:bizId/secured-balance-accounts', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = accountBodySchema.extend({ commitmentContractId: z.string().optional() }).safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

  const createdOrResponse = await createCommitmentRow<typeof securedBalanceAccounts.$inferSelect>({
    c,
    bizId,
    tableKey: 'securedBalanceAccounts',
    subjectType: 'secured_balance_account',
    displayName: parsed.data.title,
    data: {
      bizId,
      commitmentContractId: parsed.data.commitmentContractId ?? null,
      accountType: parsed.data.accountType,
      status: parsed.data.status,
      title: sanitizePlainText(parsed.data.title),
      description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
      currency: parsed.data.currency,
      balanceMinor: parsed.data.balanceMinor,
      heldMinor: parsed.data.heldMinor,
      releasedMinor: parsed.data.releasedMinor,
      forfeitedMinor: parsed.data.forfeitedMinor,
      ownerSubjectType: parsed.data.ownerSubjectType,
      ownerSubjectId: parsed.data.ownerSubjectId,
      counterpartySubjectType: parsed.data.counterpartySubjectType ?? null,
      counterpartySubjectId: parsed.data.counterpartySubjectId ?? null,
      openedAt: parsed.data.openedAt ? new Date(parsed.data.openedAt) : new Date(),
      closedAt: parsed.data.closedAt ? new Date(parsed.data.closedAt) : null,
      policySnapshot: sanitizeUnknown(parsed.data.policySnapshot ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (createdOrResponse instanceof Response) return createdOrResponse
  const created = createdOrResponse
  return ok(c, created, 201)
})

commitmentRoutes.get('/bizes/:bizId/secured-balance-accounts/:accountId/ledger-entries', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, accountId } = c.req.param()
  const rows = await db.query.securedBalanceLedgerEntries.findMany({
    where: and(eq(securedBalanceLedgerEntries.bizId, bizId), eq(securedBalanceLedgerEntries.securedBalanceAccountId, accountId)),
    orderBy: [asc(securedBalanceLedgerEntries.occurredAt)],
  })
  return ok(c, rows)
})

commitmentRoutes.post('/bizes/:bizId/secured-balance-accounts/:accountId/ledger-entries', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, accountId } = c.req.param()
  const parsed = ledgerEntryBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

  const account = await db.query.securedBalanceAccounts.findFirst({
    where: and(eq(securedBalanceAccounts.bizId, bizId), eq(securedBalanceAccounts.id, accountId)),
  })
  if (!account) return fail(c, 'NOT_FOUND', 'Secured-balance account not found.', 404)

  const createdOrResponse = await createCommitmentRow<typeof securedBalanceLedgerEntries.$inferSelect>({
    c,
    bizId,
    tableKey: 'securedBalanceLedgerEntries',
    subjectType: 'secured_balance_ledger_entry',
    data: {
      bizId,
      securedBalanceAccountId: accountId,
      entryType: parsed.data.entryType,
      status: parsed.data.status,
      occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
      currency: parsed.data.currency,
      balanceDeltaMinor: parsed.data.balanceDeltaMinor,
      heldDeltaMinor: parsed.data.heldDeltaMinor,
      commitmentContractId: parsed.data.commitmentContractId ?? null,
      commitmentMilestoneId: parsed.data.commitmentMilestoneId ?? null,
      commitmentObligationId: parsed.data.commitmentObligationId ?? null,
      paymentTransactionId: parsed.data.paymentTransactionId ?? null,
      arInvoiceId: parsed.data.arInvoiceId ?? null,
      bookingOrderId: parsed.data.bookingOrderId ?? null,
      bookingOrderLineId: parsed.data.bookingOrderLineId ?? null,
      sourceSubjectType: parsed.data.sourceSubjectType ?? null,
      sourceSubjectId: parsed.data.sourceSubjectId ?? null,
      idempotencyKey: parsed.data.idempotencyKey ?? null,
      reasonCode: parsed.data.reasonCode ?? null,
      notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes) : null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (createdOrResponse instanceof Response) return createdOrResponse
  const created = createdOrResponse

  const nextStatus = parsed.data.metadata && (parsed.data.metadata.nextAccountStatus === 'frozen' || parsed.data.metadata.nextAccountStatus === 'releasing')
    ? parsed.data.metadata.nextAccountStatus as 'frozen' | 'releasing'
    : undefined
  const accountUpdateOrResponse = await updateCommitmentRow<typeof securedBalanceAccounts.$inferSelect>({
    c,
    bizId,
    tableKey: 'securedBalanceAccounts',
    subjectType: 'secured_balance_account',
    id: accountId,
    notFoundMessage: 'Secured-balance account not found.',
    patch: {
      balanceMinor: account.balanceMinor + parsed.data.balanceDeltaMinor,
      heldMinor: account.heldMinor + parsed.data.heldDeltaMinor,
      releasedMinor: account.releasedMinor + (parsed.data.entryType === 'release' ? Math.max(parsed.data.balanceDeltaMinor * -1, 0) : 0),
      forfeitedMinor: account.forfeitedMinor + (parsed.data.entryType === 'forfeit' ? Math.max(parsed.data.balanceDeltaMinor * -1, 0) : 0),
      status: nextStatus,
    },
  })
  if (accountUpdateOrResponse instanceof Response) return accountUpdateOrResponse

  return ok(c, created, 201)
})

commitmentRoutes.get('/bizes/:bizId/secured-balance-ledger-entries/:entryId/allocations', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, entryId } = c.req.param()
  const rows = await db.query.securedBalanceAllocations.findMany({
    where: and(eq(securedBalanceAllocations.bizId, bizId), eq(securedBalanceAllocations.securedBalanceLedgerEntryId, entryId)),
    orderBy: [asc(securedBalanceAllocations.occurredAt)],
  })
  return ok(c, rows)
})

commitmentRoutes.post('/bizes/:bizId/secured-balance-ledger-entries/:entryId/allocations', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, entryId } = c.req.param()
  const parsed = allocationBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

  const createdOrResponse = await createCommitmentRow<typeof securedBalanceAllocations.$inferSelect>({
    c,
    bizId,
    tableKey: 'securedBalanceAllocations',
    subjectType: 'secured_balance_allocation',
    data: {
      bizId,
      securedBalanceLedgerEntryId: entryId,
      allocationType: parsed.data.allocationType,
      allocatedAmountMinor: parsed.data.allocatedAmountMinor,
      currency: parsed.data.currency,
      commitmentObligationId: parsed.data.commitmentObligationId ?? null,
      commitmentMilestoneId: parsed.data.commitmentMilestoneId ?? null,
      bookingOrderLineId: parsed.data.bookingOrderLineId ?? null,
      arInvoiceId: parsed.data.arInvoiceId ?? null,
      paymentTransactionLineAllocationId: parsed.data.paymentTransactionLineAllocationId ?? null,
      targetSubjectType: parsed.data.targetSubjectType ?? null,
      targetSubjectId: parsed.data.targetSubjectId ?? null,
      occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (createdOrResponse instanceof Response) return createdOrResponse
  const created = createdOrResponse
  return ok(c, created, 201)
})

commitmentRoutes.get('/bizes/:bizId/commitment-contracts/:contractId/claims', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, contractId } = c.req.param()
  const rows = await db.query.commitmentClaims.findMany({
    where: and(eq(commitmentClaims.bizId, bizId), eq(commitmentClaims.commitmentContractId, contractId)),
    orderBy: [desc(commitmentClaims.openedAt)],
  })
  return ok(c, rows)
})

commitmentRoutes.post('/bizes/:bizId/commitment-contracts/:contractId/claims', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, contractId } = c.req.param()
  const parsed = claimBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

  const createdOrResponse = await createCommitmentRow<typeof commitmentClaims.$inferSelect>({
    c,
    bizId,
    tableKey: 'commitmentClaims',
    subjectType: 'commitment_claim',
    displayName: parsed.data.title,
    data: {
      bizId,
      commitmentContractId: contractId,
      claimType: parsed.data.claimType,
      status: parsed.data.status,
      resolutionType: parsed.data.resolutionType ?? null,
      title: sanitizePlainText(parsed.data.title),
      description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
      raisedBySubjectType: parsed.data.raisedBySubjectType,
      raisedBySubjectId: parsed.data.raisedBySubjectId,
      againstSubjectType: parsed.data.againstSubjectType ?? null,
      againstSubjectId: parsed.data.againstSubjectId ?? null,
      disputedAmountMinor: parsed.data.disputedAmountMinor ?? null,
      settledAmountMinor: parsed.data.settledAmountMinor ?? null,
      currency: parsed.data.currency,
      openedAt: parsed.data.openedAt ? new Date(parsed.data.openedAt) : new Date(),
      resolvedAt: parsed.data.resolvedAt ? new Date(parsed.data.resolvedAt) : null,
      closedAt: parsed.data.closedAt ? new Date(parsed.data.closedAt) : null,
      policySnapshot: sanitizeUnknown(parsed.data.policySnapshot ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (createdOrResponse instanceof Response) return createdOrResponse
  const created = createdOrResponse

  const openedEventOrResponse = await createCommitmentRow<typeof commitmentClaimEvents.$inferSelect>({
    c,
    bizId,
    tableKey: 'commitmentClaimEvents',
    subjectType: 'commitment_claim_event',
    data: {
      bizId,
      commitmentClaimId: created.id,
      eventType: 'opened',
      occurredAt: new Date(),
      actorUserId: getCurrentUser(c)?.id ?? null,
      note: 'Claim opened through API.',
      payload: { source: 'commitments.create_claim' },
      metadata: { source: 'commitments.create_claim' },
    },
  })
  if (openedEventOrResponse instanceof Response) return openedEventOrResponse

  return ok(c, created, 201)
})

commitmentRoutes.patch('/bizes/:bizId/commitment-contracts/:contractId/claims/:claimId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, contractId, claimId } = c.req.param()
  const parsed = claimPatchSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const existing = await db.query.commitmentClaims.findFirst({
    where: and(
      eq(commitmentClaims.bizId, bizId),
      eq(commitmentClaims.commitmentContractId, contractId),
      eq(commitmentClaims.id, claimId),
    ),
    columns: { id: true },
  })
  if (!existing) return fail(c, 'NOT_FOUND', 'Commitment claim not found.', 404)

  const updatedOrResponse = await updateCommitmentRow<typeof commitmentClaims.$inferSelect>({
    c,
    bizId,
    tableKey: 'commitmentClaims',
    subjectType: 'commitment_claim',
    id: claimId,
    notFoundMessage: 'Commitment claim not found.',
    patch: {
      ...('status' in parsed.data ? { status: parsed.data.status } : {}),
      ...('resolutionType' in parsed.data ? { resolutionType: parsed.data.resolutionType ?? null } : {}),
      ...('settledAmountMinor' in parsed.data ? { settledAmountMinor: parsed.data.settledAmountMinor ?? null } : {}),
      ...('resolvedAt' in parsed.data ? { resolvedAt: parsed.data.resolvedAt ? new Date(parsed.data.resolvedAt) : null } : {}),
      ...('closedAt' in parsed.data ? { closedAt: parsed.data.closedAt ? new Date(parsed.data.closedAt) : null } : {}),
      ...('metadata' in parsed.data ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
    },
  })
  if (updatedOrResponse instanceof Response) return updatedOrResponse
  const updated = updatedOrResponse
  return ok(c, updated)
})

commitmentRoutes.get('/bizes/:bizId/commitment-contracts/:contractId/claims/:claimId/events', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, claimId } = c.req.param()
  const rows = await db.query.commitmentClaimEvents.findMany({
    where: and(eq(commitmentClaimEvents.bizId, bizId), eq(commitmentClaimEvents.commitmentClaimId, claimId)),
    orderBy: [asc(commitmentClaimEvents.occurredAt)],
  })
  return ok(c, rows)
})

commitmentRoutes.post('/bizes/:bizId/commitment-contracts/:contractId/claims/:claimId/events', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, claimId } = c.req.param()
  const parsed = claimEventBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

  const createdOrResponse = await createCommitmentRow<typeof commitmentClaimEvents.$inferSelect>({
    c,
    bizId,
    tableKey: 'commitmentClaimEvents',
    subjectType: 'commitment_claim_event',
    data: {
      bizId,
      commitmentClaimId: claimId,
      eventType: parsed.data.eventType,
      occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
      actorUserId: getCurrentUser(c)?.id ?? null,
      actorSubjectType: parsed.data.actorSubjectType ?? null,
      actorSubjectId: parsed.data.actorSubjectId ?? null,
      note: parsed.data.note ? sanitizePlainText(parsed.data.note) : null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (createdOrResponse instanceof Response) return createdOrResponse
  const created = createdOrResponse
  return ok(c, created, 201)
})
