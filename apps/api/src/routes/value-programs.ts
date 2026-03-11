/**
 * Value program (loyalty / credits / points) routes.
 *
 * ELI5:
 * This route family exposes:
 * - program + account configuration,
 * - immutable ledger posting,
 * - transfer workflow decisions,
 * - programmable rule and evaluation records.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { getCurrentUser, requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok } from './_api.js'

const {
  db,
  valuePrograms,
  valueProgramAccounts,
  valueTransfers,
  valueLedgerEntries,
  valueRules,
  valueRuleEvaluations,
} = dbPackage

const valueProgramBodySchema = z.object({
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140),
  kind: z.enum(['loyalty', 'cashback', 'referral', 'membership_perk', 'engagement', 'custom']).default('loyalty'),
  accountModel: z.enum(['user', 'group_account', 'subject']).default('user'),
  unitKind: z.enum(['points', 'credits', 'stamps', 'status_score', 'custom']).default('points'),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('draft'),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  maxBalanceUnits: z.number().int().positive().optional().nullable(),
  allowNegativeBalance: z.boolean().default(false),
  allowTransfers: z.boolean().default(false),
  pointsToCurrencyRateBps: z.number().int().min(0).optional().nullable(),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})
const valueProgramPatchSchema = valueProgramBodySchema.partial()

const valueAccountBodySchema = z.object({
  valueProgramId: z.string().min(1),
  accountNumber: z.string().min(1).max(180),
  status: z.enum(['active', 'suspended', 'closed']).default('active'),
  ownerModel: z.enum(['user', 'group_account', 'subject']),
  ownerUserId: z.string().optional().nullable(),
  ownerGroupAccountId: z.string().optional().nullable(),
  ownerSubjectType: z.string().max(80).optional().nullable(),
  ownerSubjectId: z.string().max(140).optional().nullable(),
  currentTierId: z.string().optional().nullable(),
  openedAt: z.string().datetime().optional().nullable(),
  closedAt: z.string().datetime().optional().nullable(),
  lastActivityAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})
const valueAccountPatchSchema = valueAccountBodySchema.partial()

const valueRuleBodySchema = z.object({
  valueProgramId: z.string().min(1),
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('draft'),
  priority: z.number().int().min(0).default(100),
  ruleType: z.string().min(1).max(80).default('earn'),
  triggerType: z.string().min(1).max(80).default('event'),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  maxApplicationsPerAccount: z.number().int().positive().optional().nullable(),
  rule: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})
const valueRulePatchSchema = valueRuleBodySchema.partial()

const valueLedgerPostBodySchema = z.object({
  valueProgramId: z.string().min(1),
  entryType: z.enum([
    'earn',
    'redeem',
    'expire',
    'adjustment',
    'transfer_in',
    'transfer_out',
    'tier_upgrade',
    'tier_downgrade',
    'reversal',
  ]),
  unitsDelta: z.number().int().refine((value) => value !== 0, 'unitsDelta must be non-zero.'),
  occurredAt: z.string().datetime().optional().nullable(),
  effectiveAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  idempotencyKey: z.string().max(180).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  sourceSubjectType: z.string().max(80).optional().nullable(),
  sourceSubjectId: z.string().max(140).optional().nullable(),
  sourceRefType: z.string().max(80).optional().nullable(),
  sourceRefId: z.string().max(140).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const valueTransferBodySchema = z.object({
  valueProgramId: z.string().min(1),
  sourceValueAccountId: z.string().min(1),
  targetValueAccountId: z.string().min(1),
  units: z.number().int().positive(),
  requestedByUserId: z.string().optional().nullable(),
  reason: z.string().max(2000).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const valueTransferDecisionBodySchema = z.object({
  status: z.enum(['approved', 'rejected', 'cancelled', 'completed']),
  autoComplete: z.boolean().default(true),
  notes: z.string().max(4000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const valueRuleEvaluationBodySchema = z.object({
  valueProgramId: z.string().min(1),
  valueRuleId: z.string().min(1),
  valueAccountId: z.string().optional().nullable(),
  status: z.enum(['pending', 'applied', 'skipped', 'failed', 'cancelled']).default('pending'),
  evaluationKey: z.string().min(1).max(180),
  evaluatedAt: z.string().datetime().optional().nullable(),
  appliedAt: z.string().datetime().optional().nullable(),
  unitsDelta: z.number().int().optional().nullable(),
  valueLedgerEntryId: z.string().optional().nullable(),
  sourceSubjectType: z.string().max(80).optional().nullable(),
  sourceSubjectId: z.string().max(140).optional().nullable(),
  details: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

async function createValueRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'value-programs' },
  })
  if (!delegated.ok) {
    return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  }
  return delegated.row as T
}

async function updateValueRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'value-programs' },
  })
  if (!delegated.ok) {
    if (delegated.code === 'CRUD_TARGET_NOT_FOUND') {
      return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
    }
    return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  }
  if (!delegated.row) return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
  return delegated.row as T
}

type TransferCompletionResult = {
  transfer: typeof valueTransfers.$inferSelect
  sourceEntry: typeof valueLedgerEntries.$inferSelect
  targetEntry: typeof valueLedgerEntries.$inferSelect
}

async function completeTransfer(input: {
  bizId: string
  transferId: string
  actorUserId?: string | null
  notes?: string | null
  metadata?: Record<string, unknown>
}): Promise<TransferCompletionResult | { errorCode: string; errorMessage: string; httpStatus: number }> {
  return db.transaction(async (tx) => {
    const transfer = await tx.query.valueTransfers.findFirst({
      where: and(eq(valueTransfers.bizId, input.bizId), eq(valueTransfers.id, input.transferId)),
    })
    if (!transfer) {
      return { errorCode: 'NOT_FOUND', errorMessage: 'Transfer not found.', httpStatus: 404 }
    }
    if (transfer.status === 'completed') {
      return { errorCode: 'CONFLICT', errorMessage: 'Transfer is already completed.', httpStatus: 409 }
    }

    const [sourceAccount, targetAccount, program] = await Promise.all([
      tx.query.valueProgramAccounts.findFirst({
        where: and(eq(valueProgramAccounts.bizId, input.bizId), eq(valueProgramAccounts.id, transfer.sourceValueAccountId)),
      }),
      tx.query.valueProgramAccounts.findFirst({
        where: and(eq(valueProgramAccounts.bizId, input.bizId), eq(valueProgramAccounts.id, transfer.targetValueAccountId)),
      }),
      tx.query.valuePrograms.findFirst({
        where: and(eq(valuePrograms.bizId, input.bizId), eq(valuePrograms.id, transfer.valueProgramId)),
      }),
    ])

    if (!sourceAccount || !targetAccount || !program) {
      return {
        errorCode: 'VALIDATION_ERROR',
        errorMessage: 'Transfer account/program linkage is invalid.',
        httpStatus: 400,
      }
    }
    if (!program.allowTransfers) {
      return {
        errorCode: 'TRANSFERS_DISABLED',
        errorMessage: 'Transfers are not enabled for this value program.',
        httpStatus: 400,
      }
    }
    if (
      sourceAccount.valueProgramId !== transfer.valueProgramId ||
      targetAccount.valueProgramId !== transfer.valueProgramId
    ) {
      return {
        errorCode: 'PROGRAM_MISMATCH',
        errorMessage: 'Transfer accounts must belong to the same value program.',
        httpStatus: 400,
      }
    }

    const nextSourceBalance = sourceAccount.currentBalanceUnits - transfer.units
    if (!program.allowNegativeBalance && nextSourceBalance < 0) {
      return {
        errorCode: 'INSUFFICIENT_BALANCE',
        errorMessage: 'Source account has insufficient balance.',
        httpStatus: 409,
      }
    }
    const nextTargetBalance = targetAccount.currentBalanceUnits + transfer.units

    const now = new Date()

    const [sourceEntry] = await tx
      .insert(valueLedgerEntries)
      .values({
        bizId: input.bizId,
        valueProgramId: transfer.valueProgramId,
        valueAccountId: transfer.sourceValueAccountId,
        valueTransferId: transfer.id,
        entryType: 'transfer_out',
        unitsDelta: -transfer.units,
        balanceAfterUnits: nextSourceBalance,
        occurredAt: now,
        effectiveAt: now,
        description: input.notes ? sanitizePlainText(input.notes) : 'Transfer out',
        metadata: sanitizeUnknown(input.metadata ?? {}),
      })
      .returning()

    const [targetEntry] = await tx
      .insert(valueLedgerEntries)
      .values({
        bizId: input.bizId,
        valueProgramId: transfer.valueProgramId,
        valueAccountId: transfer.targetValueAccountId,
        valueTransferId: transfer.id,
        entryType: 'transfer_in',
        unitsDelta: transfer.units,
        balanceAfterUnits: nextTargetBalance,
        occurredAt: now,
        effectiveAt: now,
        description: input.notes ? sanitizePlainText(input.notes) : 'Transfer in',
        metadata: sanitizeUnknown(input.metadata ?? {}),
      })
      .returning()

    await tx
      .update(valueProgramAccounts)
      .set({
        currentBalanceUnits: nextSourceBalance,
        lastActivityAt: now,
      })
      .where(and(eq(valueProgramAccounts.bizId, input.bizId), eq(valueProgramAccounts.id, sourceAccount.id)))

    await tx
      .update(valueProgramAccounts)
      .set({
        currentBalanceUnits: nextTargetBalance,
        lastActivityAt: now,
      })
      .where(and(eq(valueProgramAccounts.bizId, input.bizId), eq(valueProgramAccounts.id, targetAccount.id)))

    const [updatedTransfer] = await tx
      .update(valueTransfers)
      .set({
        status: 'completed',
        decidedByUserId: input.actorUserId ?? transfer.decidedByUserId ?? null,
        decidedAt: transfer.decidedAt ?? now,
        completedAt: now,
        notes: input.notes ? sanitizePlainText(input.notes) : transfer.notes,
        metadata: sanitizeUnknown(input.metadata ?? transfer.metadata ?? {}),
      })
      .where(and(eq(valueTransfers.bizId, input.bizId), eq(valueTransfers.id, transfer.id)))
      .returning()

    return {
      transfer: updatedTransfer,
      sourceEntry,
      targetEntry,
    }
  })
}

export const valueProgramRoutes = new Hono()

valueProgramRoutes.get(
  '/bizes/:bizId/value-programs',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const status = c.req.query('status')
    const rows = await db.query.valuePrograms.findMany({
      where: and(eq(valuePrograms.bizId, bizId), status ? eq(valuePrograms.status, status as any) : undefined),
      orderBy: [asc(valuePrograms.name)],
    })
    return ok(c, rows)
  },
)

valueProgramRoutes.post(
  '/bizes/:bizId/value-programs',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = valueProgramBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const created = await createValueRow<typeof valuePrograms.$inferSelect>({
      c,
      bizId,
      tableKey: 'valuePrograms',
      subjectType: 'value_program',
      displayName: parsed.data.name,
      data: {
        bizId,
        name: sanitizePlainText(parsed.data.name),
        slug: sanitizePlainText(parsed.data.slug),
        kind: parsed.data.kind,
        accountModel: parsed.data.accountModel,
        unitKind: parsed.data.unitKind,
        status: parsed.data.status,
        currency: parsed.data.currency,
        maxBalanceUnits: parsed.data.maxBalanceUnits ?? null,
        allowNegativeBalance: parsed.data.allowNegativeBalance,
        allowTransfers: parsed.data.allowTransfers,
        pointsToCurrencyRateBps: parsed.data.pointsToCurrencyRateBps ?? null,
        policy: sanitizeUnknown(parsed.data.policy ?? {}),
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)

valueProgramRoutes.patch(
  '/bizes/:bizId/value-programs/:valueProgramId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, valueProgramId } = c.req.param()
    const parsed = valueProgramPatchSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const patch = {
      ...(parsed.data.name !== undefined ? { name: sanitizePlainText(parsed.data.name) } : {}),
      ...(parsed.data.slug !== undefined ? { slug: sanitizePlainText(parsed.data.slug) } : {}),
      ...(parsed.data.kind !== undefined ? { kind: parsed.data.kind } : {}),
      ...(parsed.data.accountModel !== undefined ? { accountModel: parsed.data.accountModel } : {}),
      ...(parsed.data.unitKind !== undefined ? { unitKind: parsed.data.unitKind } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.currency !== undefined ? { currency: parsed.data.currency } : {}),
      ...(parsed.data.maxBalanceUnits !== undefined ? { maxBalanceUnits: parsed.data.maxBalanceUnits ?? null } : {}),
      ...(parsed.data.allowNegativeBalance !== undefined ? { allowNegativeBalance: parsed.data.allowNegativeBalance } : {}),
      ...(parsed.data.allowTransfers !== undefined ? { allowTransfers: parsed.data.allowTransfers } : {}),
      ...(parsed.data.pointsToCurrencyRateBps !== undefined
        ? { pointsToCurrencyRateBps: parsed.data.pointsToCurrencyRateBps ?? null }
        : {}),
      ...(parsed.data.policy !== undefined ? { policy: sanitizeUnknown(parsed.data.policy ?? {}) } : {}),
      ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
    } as Record<string, unknown>
    const updated = await updateValueRow<typeof valuePrograms.$inferSelect>({
      c,
      bizId,
      tableKey: 'valuePrograms',
      subjectType: 'value_program',
      id: valueProgramId,
      patch,
      notFoundMessage: 'Value program not found.',
    })
    if (updated instanceof Response) return updated
    return ok(c, updated)
  },
)

valueProgramRoutes.get(
  '/bizes/:bizId/value-accounts',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const valueProgramId = c.req.query('valueProgramId')
    const ownerUserId = c.req.query('ownerUserId')
    const rows = await db.query.valueProgramAccounts.findMany({
      where: and(
        eq(valueProgramAccounts.bizId, bizId),
        valueProgramId ? eq(valueProgramAccounts.valueProgramId, valueProgramId) : undefined,
        ownerUserId ? eq(valueProgramAccounts.ownerUserId, ownerUserId) : undefined,
      ),
      orderBy: [desc(valueProgramAccounts.lastActivityAt), asc(valueProgramAccounts.accountNumber)],
    })
    return ok(c, rows)
  },
)

valueProgramRoutes.post(
  '/bizes/:bizId/value-accounts',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = valueAccountBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const created = await createValueRow<typeof valueProgramAccounts.$inferSelect>({
      c,
      bizId,
      tableKey: 'valueProgramAccounts',
      subjectType: 'value_account',
      displayName: parsed.data.accountNumber,
      data: {
        bizId,
        valueProgramId: parsed.data.valueProgramId,
        accountNumber: sanitizePlainText(parsed.data.accountNumber),
        status: parsed.data.status,
        ownerModel: parsed.data.ownerModel,
        ownerUserId: parsed.data.ownerUserId ?? null,
        ownerGroupAccountId: parsed.data.ownerGroupAccountId ?? null,
        ownerSubjectType: parsed.data.ownerSubjectType ?? null,
        ownerSubjectId: parsed.data.ownerSubjectId ?? null,
        currentTierId: parsed.data.currentTierId ?? null,
        openedAt: parsed.data.openedAt ? new Date(parsed.data.openedAt) : new Date(),
        closedAt: parsed.data.closedAt ? new Date(parsed.data.closedAt) : null,
        lastActivityAt: parsed.data.lastActivityAt ? new Date(parsed.data.lastActivityAt) : null,
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)

valueProgramRoutes.patch(
  '/bizes/:bizId/value-accounts/:valueAccountId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, valueAccountId } = c.req.param()
    const parsed = valueAccountPatchSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const patch = {
      ...(parsed.data.valueProgramId !== undefined ? { valueProgramId: parsed.data.valueProgramId } : {}),
      ...(parsed.data.accountNumber !== undefined ? { accountNumber: sanitizePlainText(parsed.data.accountNumber) } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.ownerModel !== undefined ? { ownerModel: parsed.data.ownerModel } : {}),
      ...(parsed.data.ownerUserId !== undefined ? { ownerUserId: parsed.data.ownerUserId ?? null } : {}),
      ...(parsed.data.ownerGroupAccountId !== undefined ? { ownerGroupAccountId: parsed.data.ownerGroupAccountId ?? null } : {}),
      ...(parsed.data.ownerSubjectType !== undefined ? { ownerSubjectType: parsed.data.ownerSubjectType ?? null } : {}),
      ...(parsed.data.ownerSubjectId !== undefined ? { ownerSubjectId: parsed.data.ownerSubjectId ?? null } : {}),
      ...(parsed.data.currentTierId !== undefined ? { currentTierId: parsed.data.currentTierId ?? null } : {}),
      ...(parsed.data.openedAt !== undefined ? { openedAt: parsed.data.openedAt ? new Date(parsed.data.openedAt) : null } : {}),
      ...(parsed.data.closedAt !== undefined ? { closedAt: parsed.data.closedAt ? new Date(parsed.data.closedAt) : null } : {}),
      ...(parsed.data.lastActivityAt !== undefined
        ? { lastActivityAt: parsed.data.lastActivityAt ? new Date(parsed.data.lastActivityAt) : null }
        : {}),
      ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
    } as Record<string, unknown>
    const updated = await updateValueRow<typeof valueProgramAccounts.$inferSelect>({
      c,
      bizId,
      tableKey: 'valueProgramAccounts',
      subjectType: 'value_account',
      id: valueAccountId,
      patch,
      notFoundMessage: 'Value account not found.',
    })
    if (updated instanceof Response) return updated
    return ok(c, updated)
  },
)

valueProgramRoutes.get(
  '/bizes/:bizId/value-accounts/:valueAccountId/ledger-entries',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, valueAccountId } = c.req.param()
    const rows = await db.query.valueLedgerEntries.findMany({
      where: and(eq(valueLedgerEntries.bizId, bizId), eq(valueLedgerEntries.valueAccountId, valueAccountId)),
      orderBy: [desc(valueLedgerEntries.occurredAt), desc(valueLedgerEntries.effectiveAt)],
    })
    return ok(c, rows)
  },
)

valueProgramRoutes.post(
  '/bizes/:bizId/value-accounts/:valueAccountId/ledger-entries',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, valueAccountId } = c.req.param()
    const parsed = valueLedgerPostBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const actorUserId = getCurrentUser(c)?.id ?? null

    const posted = await db.transaction(async (tx) => {
      const account = await tx.query.valueProgramAccounts.findFirst({
        where: and(eq(valueProgramAccounts.bizId, bizId), eq(valueProgramAccounts.id, valueAccountId)),
      })
      if (!account) return { errorCode: 'NOT_FOUND', errorMessage: 'Value account not found.', httpStatus: 404 } as const
      if (account.valueProgramId !== parsed.data.valueProgramId) {
        return {
          errorCode: 'PROGRAM_MISMATCH',
          errorMessage: 'Account program does not match request valueProgramId.',
          httpStatus: 400,
        } as const
      }
      const program = await tx.query.valuePrograms.findFirst({
        where: and(eq(valuePrograms.bizId, bizId), eq(valuePrograms.id, parsed.data.valueProgramId)),
      })
      if (!program) return { errorCode: 'NOT_FOUND', errorMessage: 'Value program not found.', httpStatus: 404 } as const

      const nextBalance = account.currentBalanceUnits + parsed.data.unitsDelta
      if (!program.allowNegativeBalance && nextBalance < 0) {
        return {
          errorCode: 'INSUFFICIENT_BALANCE',
          errorMessage: 'Ledger write would move account below zero.',
          httpStatus: 409,
        } as const
      }

      const occurredAt = parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date()
      const effectiveAt = parsed.data.effectiveAt ? new Date(parsed.data.effectiveAt) : occurredAt
      const [createdEntry] = await tx
        .insert(valueLedgerEntries)
        .values({
          bizId,
          valueProgramId: parsed.data.valueProgramId,
          valueAccountId,
          entryType: parsed.data.entryType,
          unitsDelta: parsed.data.unitsDelta,
          balanceAfterUnits: nextBalance,
          idempotencyKey: parsed.data.idempotencyKey ?? null,
          occurredAt,
          effectiveAt,
          expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
          sourceSubjectType: parsed.data.sourceSubjectType ?? null,
          sourceSubjectId: parsed.data.sourceSubjectId ?? null,
          sourceRefType: parsed.data.sourceRefType ?? null,
          sourceRefId: parsed.data.sourceRefId ?? null,
          description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
          metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
        })
        .returning()

      const lifetimeEarnedDelta =
        parsed.data.entryType === 'earn' && parsed.data.unitsDelta > 0 ? parsed.data.unitsDelta : 0
      const lifetimeRedeemedDelta =
        (parsed.data.entryType === 'redeem' || parsed.data.entryType === 'tier_downgrade') &&
        parsed.data.unitsDelta < 0
          ? Math.abs(parsed.data.unitsDelta)
          : 0
      const lifetimeExpiredDelta =
        parsed.data.entryType === 'expire' && parsed.data.unitsDelta < 0 ? Math.abs(parsed.data.unitsDelta) : 0

      await tx
        .update(valueProgramAccounts)
        .set({
          currentBalanceUnits: nextBalance,
          lifetimeEarnedUnits: sql`${valueProgramAccounts.lifetimeEarnedUnits} + ${lifetimeEarnedDelta}`,
          lifetimeRedeemedUnits: sql`${valueProgramAccounts.lifetimeRedeemedUnits} + ${lifetimeRedeemedDelta}`,
          lifetimeExpiredUnits: sql`${valueProgramAccounts.lifetimeExpiredUnits} + ${lifetimeExpiredDelta}`,
          lastActivityAt: occurredAt,
        })
        .where(and(eq(valueProgramAccounts.bizId, bizId), eq(valueProgramAccounts.id, valueAccountId)))

      return { entry: createdEntry } as const
    })

    if ('errorCode' in posted) {
      return fail(c, String(posted.errorCode), String(posted.errorMessage), posted.httpStatus)
    }
    return ok(c, posted.entry, 201)
  },
)

valueProgramRoutes.get(
  '/bizes/:bizId/value-transfers',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const status = c.req.query('status')
    const rows = await db.query.valueTransfers.findMany({
      where: and(eq(valueTransfers.bizId, bizId), status ? eq(valueTransfers.status, status as any) : undefined),
      orderBy: [desc(valueTransfers.requestedAt)],
    })
    return ok(c, rows)
  },
)

valueProgramRoutes.post(
  '/bizes/:bizId/value-transfers',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = valueTransferBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    if (parsed.data.sourceValueAccountId === parsed.data.targetValueAccountId) {
      return fail(c, 'VALIDATION_ERROR', 'Source and target accounts must differ.', 400)
    }
    const created = await createValueRow<typeof valueTransfers.$inferSelect>({
      c,
      bizId,
      tableKey: 'valueTransfers',
      subjectType: 'value_transfer',
      data: {
        bizId,
        valueProgramId: parsed.data.valueProgramId,
        sourceValueAccountId: parsed.data.sourceValueAccountId,
        targetValueAccountId: parsed.data.targetValueAccountId,
        status: 'requested',
        units: parsed.data.units,
        requestedByUserId: parsed.data.requestedByUserId ?? getCurrentUser(c)?.id ?? null,
        requestedAt: new Date(),
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        reason: parsed.data.reason ? sanitizePlainText(parsed.data.reason) : null,
        notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes) : null,
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)

valueProgramRoutes.patch(
  '/bizes/:bizId/value-transfers/:valueTransferId/decision',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, valueTransferId } = c.req.param()
    const parsed = valueTransferDecisionBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const actorUserId = getCurrentUser(c)?.id ?? null

    if (
      (parsed.data.status === 'approved' && parsed.data.autoComplete) ||
      parsed.data.status === 'completed'
    ) {
      const completed = await completeTransfer({
        bizId,
        transferId: valueTransferId,
        actorUserId,
        notes: parsed.data.notes ?? null,
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}) as Record<string, unknown>,
      })
      if ('errorCode' in completed) {
        return fail(c, completed.errorCode, completed.errorMessage, completed.httpStatus)
      }
      return ok(c, completed)
    }

    const updated = await updateValueRow<typeof valueTransfers.$inferSelect>({
      c,
      bizId,
      tableKey: 'valueTransfers',
      subjectType: 'value_transfer',
      id: valueTransferId,
      patch: {
        status: parsed.data.status,
        decidedByUserId: actorUserId,
        decidedAt: new Date(),
        notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes) : null,
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
      notFoundMessage: 'Transfer not found.',
    })
    if (updated instanceof Response) return updated
    return ok(c, updated)
  },
)

valueProgramRoutes.get(
  '/bizes/:bizId/value-rules',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const valueProgramId = c.req.query('valueProgramId')
    const rows = await db.query.valueRules.findMany({
      where: and(
        eq(valueRules.bizId, bizId),
        valueProgramId ? eq(valueRules.valueProgramId, valueProgramId) : undefined,
      ),
      orderBy: [asc(valueRules.priority), asc(valueRules.name)],
    })
    return ok(c, rows)
  },
)

valueProgramRoutes.post(
  '/bizes/:bizId/value-rules',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = valueRuleBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const created = await createValueRow<typeof valueRules.$inferSelect>({
      c,
      bizId,
      tableKey: 'valueRules',
      subjectType: 'value_rule',
      displayName: parsed.data.name,
      data: {
        bizId,
        valueProgramId: parsed.data.valueProgramId,
        name: sanitizePlainText(parsed.data.name),
        slug: sanitizePlainText(parsed.data.slug),
        status: parsed.data.status,
        priority: parsed.data.priority,
        ruleType: sanitizePlainText(parsed.data.ruleType),
        triggerType: sanitizePlainText(parsed.data.triggerType),
        startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        maxApplicationsPerAccount: parsed.data.maxApplicationsPerAccount ?? null,
        rule: sanitizeUnknown(parsed.data.rule ?? {}),
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)

valueProgramRoutes.patch(
  '/bizes/:bizId/value-rules/:valueRuleId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, valueRuleId } = c.req.param()
    const parsed = valueRulePatchSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const patch = {
      ...(parsed.data.valueProgramId !== undefined ? { valueProgramId: parsed.data.valueProgramId } : {}),
      ...(parsed.data.name !== undefined ? { name: sanitizePlainText(parsed.data.name) } : {}),
      ...(parsed.data.slug !== undefined ? { slug: sanitizePlainText(parsed.data.slug) } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
      ...(parsed.data.ruleType !== undefined ? { ruleType: sanitizePlainText(parsed.data.ruleType) } : {}),
      ...(parsed.data.triggerType !== undefined ? { triggerType: sanitizePlainText(parsed.data.triggerType) } : {}),
      ...(parsed.data.startsAt !== undefined ? { startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null } : {}),
      ...(parsed.data.endsAt !== undefined ? { endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null } : {}),
      ...(parsed.data.maxApplicationsPerAccount !== undefined
        ? { maxApplicationsPerAccount: parsed.data.maxApplicationsPerAccount ?? null }
        : {}),
      ...(parsed.data.rule !== undefined ? { rule: sanitizeUnknown(parsed.data.rule ?? {}) } : {}),
      ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
    } as Record<string, unknown>
    const updated = await updateValueRow<typeof valueRules.$inferSelect>({
      c,
      bizId,
      tableKey: 'valueRules',
      subjectType: 'value_rule',
      id: valueRuleId,
      patch,
      notFoundMessage: 'Value rule not found.',
    })
    if (updated instanceof Response) return updated
    return ok(c, updated)
  },
)

valueProgramRoutes.get(
  '/bizes/:bizId/value-rule-evaluations',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const valueRuleId = c.req.query('valueRuleId')
    const valueAccountId = c.req.query('valueAccountId')
    const rows = await db.query.valueRuleEvaluations.findMany({
      where: and(
        eq(valueRuleEvaluations.bizId, bizId),
        valueRuleId ? eq(valueRuleEvaluations.valueRuleId, valueRuleId) : undefined,
        valueAccountId ? eq(valueRuleEvaluations.valueAccountId, valueAccountId) : undefined,
      ),
      orderBy: [desc(valueRuleEvaluations.evaluatedAt), desc(valueRuleEvaluations.appliedAt)],
    })
    return ok(c, rows)
  },
)

valueProgramRoutes.post(
  '/bizes/:bizId/value-rule-evaluations',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = valueRuleEvaluationBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const created = await createValueRow<typeof valueRuleEvaluations.$inferSelect>({
      c,
      bizId,
      tableKey: 'valueRuleEvaluations',
      subjectType: 'value_rule_evaluation',
      data: {
        bizId,
        valueProgramId: parsed.data.valueProgramId,
        valueRuleId: parsed.data.valueRuleId,
        valueAccountId: parsed.data.valueAccountId ?? null,
        status: parsed.data.status,
        evaluationKey: sanitizePlainText(parsed.data.evaluationKey),
        evaluatedAt: parsed.data.evaluatedAt ? new Date(parsed.data.evaluatedAt) : new Date(),
        appliedAt: parsed.data.appliedAt ? new Date(parsed.data.appliedAt) : null,
        unitsDelta: parsed.data.unitsDelta ?? null,
        valueLedgerEntryId: parsed.data.valueLedgerEntryId ?? null,
        sourceSubjectType: parsed.data.sourceSubjectType ?? null,
        sourceSubjectId: parsed.data.sourceSubjectId ?? null,
        details: sanitizeUnknown(parsed.data.details ?? {}),
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)
