import { Hono } from 'hono'
import { and, desc, eq, sql } from 'drizzle-orm'
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
import { fail, ok, parseJsonBody, parsePositiveInt, parseQuery } from './_api.js'
import { executeWorkCommand } from '../services/work-command-runtime.js'
import { ensureBuiltinWorkCommands } from '../services/work-items.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'

const { db, workCommands, workCommandRuns, actionRequests } = dbPackage

const lifecycleStatusSchema = z.enum(['active', 'inactive', 'archived'])
const workCommandKindSchema = z.enum(['action', 'workflow', 'navigation', 'automation', 'custom'])
const workCommandTargetScopeSchema = z.enum(['global', 'biz', 'subject', 'work_item', 'selection'])

const listCommandsQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  status: lifecycleStatusSchema.optional(),
  commandKind: workCommandKindSchema.optional(),
  targetScope: workCommandTargetScopeSchema.optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
  seedBuiltins: z.enum(['true', 'false']).optional(),
})

const createCommandBodySchema = z.object({
  commandKey: z.string().trim().min(2).max(120),
  title: z.string().trim().min(1).max(180),
  description: z.string().max(4000).optional().nullable(),
  status: lifecycleStatusSchema.optional(),
  commandKind: workCommandKindSchema,
  targetScope: workCommandTargetScopeSchema,
  actionKey: z.string().trim().min(2).max(160).optional().nullable(),
  workflowDefinitionId: z.string().optional().nullable(),
  defaultPayload: z.record(z.unknown()).optional(),
  guardPolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const updateCommandBodySchema = createCommandBodySchema.partial().extend({
  commandKey: z.string().trim().min(2).max(120).optional(),
  title: z.string().trim().min(1).max(180).optional(),
  commandKind: workCommandKindSchema.optional(),
  targetScope: workCommandTargetScopeSchema.optional(),
})

const executeCommandBodySchema = z
  .object({
    commandId: z.string().optional(),
    commandKey: z.string().optional(),
    workItemId: z.string().optional().nullable(),
    runtimePayload: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.commandId && !value.commandKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either commandId or commandKey is required.',
        path: ['commandId'],
      })
    }
  })

const listRunsQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  status: z.enum(['pending', 'running', 'succeeded', 'failed', 'cancelled']).optional(),
  workCommandId: z.string().optional(),
  workItemId: z.string().optional(),
})

export const commandRoutes = new Hono()

commandRoutes.get(
  '/bizes/:bizId/commands',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = parseQuery(c, listCommandsQuerySchema)
    if (!parsed.ok) return parsed.response

    const page = parsePositiveInt(parsed.data.page, 1)
    const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 25), 200)

    if (parsed.data.seedBuiltins !== 'false') {
      const user = getCurrentUser(c)
      await ensureBuiltinWorkCommands({ bizId, actorUserId: user?.id ?? null })
    }

    const includeInactive = parsed.data.includeInactive === 'true'
    const where = and(
      eq(workCommands.bizId, bizId),
      includeInactive ? undefined : eq(workCommands.status, 'active'),
      parsed.data.status ? eq(workCommands.status, parsed.data.status) : undefined,
      parsed.data.commandKind ? eq(workCommands.commandKind, parsed.data.commandKind) : undefined,
      parsed.data.targetScope ? eq(workCommands.targetScope, parsed.data.targetScope) : undefined,
    )

    const [rows, countRows] = await Promise.all([
      db.query.workCommands.findMany({
        where,
        orderBy: [desc(workCommands.updatedAt), desc(workCommands.createdAt)],
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(workCommands)
        .where(where),
    ])

    const total = countRows[0]?.count ?? 0

    return ok(c, rows, 200, {
      pagination: {
        page,
        perPage,
        total,
        hasMore: page * perPage < total,
      },
    })
  },
)

commandRoutes.post(
  '/bizes/:bizId/commands/seed-builtins',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const user = getCurrentUser(c)

    await ensureBuiltinWorkCommands({
      bizId,
      actorUserId: user?.id ?? null,
    })

    return ok(c, {
      seeded: true,
    })
  },
)

commandRoutes.post(
  '/bizes/:bizId/commands',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = await parseJsonBody(c, createCommandBodySchema)
    if (!parsed.ok) return parsed.response

    const user = getCurrentUser(c)
    if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

    const [created] = await db
      .insert(workCommands)
      .values({
        bizId,
        commandKey: parsed.data.commandKey,
        title: sanitizePlainText(parsed.data.title),
        description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
        status: parsed.data.status ?? 'active',
        commandKind: parsed.data.commandKind,
        targetScope: parsed.data.targetScope,
        actionKey: parsed.data.actionKey ?? null,
        workflowDefinitionId: parsed.data.workflowDefinitionId ?? null,
        defaultPayload: sanitizeUnknown(parsed.data.defaultPayload ?? {}) as Record<string, unknown>,
        guardPolicy: sanitizeUnknown(parsed.data.guardPolicy ?? {}) as Record<string, unknown>,
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}) as Record<string, unknown>,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning()

    return ok(c, created, 201)
  },
)

commandRoutes.patch(
  '/bizes/:bizId/commands/:workCommandId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, workCommandId } = c.req.param()
    const parsed = await parseJsonBody(c, updateCommandBodySchema)
    if (!parsed.ok) return parsed.response

    const user = getCurrentUser(c)
    if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

    const existing = await db.query.workCommands.findFirst({
      where: and(eq(workCommands.bizId, bizId), eq(workCommands.id, workCommandId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Command not found.', 404)

    const [updated] = await db
      .update(workCommands)
      .set({
        commandKey: parsed.data.commandKey ?? existing.commandKey,
        title: parsed.data.title ? sanitizePlainText(parsed.data.title) : existing.title,
        description:
          parsed.data.description === undefined
            ? existing.description
            : parsed.data.description === null
              ? null
              : sanitizePlainText(parsed.data.description),
        status: parsed.data.status ?? existing.status,
        commandKind: parsed.data.commandKind ?? existing.commandKind,
        targetScope: parsed.data.targetScope ?? existing.targetScope,
        actionKey: parsed.data.actionKey === undefined ? existing.actionKey : parsed.data.actionKey,
        workflowDefinitionId:
          parsed.data.workflowDefinitionId === undefined
            ? existing.workflowDefinitionId
            : parsed.data.workflowDefinitionId,
        defaultPayload:
          parsed.data.defaultPayload === undefined
            ? existing.defaultPayload
            : (sanitizeUnknown(parsed.data.defaultPayload) as Record<string, unknown>),
        guardPolicy:
          parsed.data.guardPolicy === undefined
            ? existing.guardPolicy
            : (sanitizeUnknown(parsed.data.guardPolicy) as Record<string, unknown>),
        metadata:
          parsed.data.metadata === undefined
            ? existing.metadata
            : (sanitizeUnknown({
                ...((existing.metadata as Record<string, unknown>) ?? {}),
                ...(parsed.data.metadata ?? {}),
              }) as Record<string, unknown>),
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(workCommands.id, existing.id))
      .returning()

    return ok(c, updated)
  },
)

commandRoutes.post(
  '/bizes/:bizId/commands/execute',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('actions.execute', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = await parseJsonBody(c, executeCommandBodySchema)
    if (!parsed.ok) return parsed.response

    const user = getCurrentUser(c)
    if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

    const result = await executeWorkCommand({
      bizId,
      actor: user,
      authSource: getCurrentAuthSource(c),
      authCredentialId: getCurrentAuthCredentialId(c),
      requestId: c.get('requestId'),
      selector: parsed.data.commandId
        ? { commandId: parsed.data.commandId }
        : { commandKey: parsed.data.commandKey as string },
      workItemId: parsed.data.workItemId ?? null,
      runtimePayload: parsed.data.runtimePayload,
      metadata: parsed.data.metadata,
    })

    if (!result.ok) {
      return fail(c, result.code, result.message, result.httpStatus, {
        run: result.run ?? null,
        command: result.command ?? null,
        workItem: result.workItem ?? null,
        details: result.details ?? null,
      })
    }

    return ok(c, result)
  },
)

commandRoutes.get(
  '/bizes/:bizId/commands/runs',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = parseQuery(c, listRunsQuerySchema)
    if (!parsed.ok) return parsed.response

    const page = parsePositiveInt(parsed.data.page, 1)
    const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 25), 200)

    const where = and(
      eq(workCommandRuns.bizId, bizId),
      parsed.data.status ? eq(workCommandRuns.status, parsed.data.status) : undefined,
      parsed.data.workCommandId ? eq(workCommandRuns.workCommandId, parsed.data.workCommandId) : undefined,
      parsed.data.workItemId ? eq(workCommandRuns.workItemId, parsed.data.workItemId) : undefined,
    )

    const [rows, countRows] = await Promise.all([
      db.query.workCommandRuns.findMany({
        where,
        orderBy: [desc(workCommandRuns.startedAt)],
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(workCommandRuns)
        .where(where),
    ])

    const total = countRows[0]?.count ?? 0

    return ok(c, rows, 200, {
      pagination: {
        page,
        perPage,
        total,
        hasMore: page * perPage < total,
      },
    })
  },
)

commandRoutes.get(
  '/bizes/:bizId/commands/runs/:runId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, runId } = c.req.param()

    const run = await db.query.workCommandRuns.findFirst({
      where: and(eq(workCommandRuns.bizId, bizId), eq(workCommandRuns.id, runId)),
    })
    if (!run) return fail(c, 'NOT_FOUND', 'Command run not found.', 404)

    const [command, actionRequest] = await Promise.all([
      db.query.workCommands.findFirst({
        where: and(eq(workCommands.bizId, bizId), eq(workCommands.id, run.workCommandId)),
      }),
      run.actionRequestId
        ? db.query.actionRequests.findFirst({
            where: and(eq(actionRequests.bizId, bizId), eq(actionRequests.id, run.actionRequestId)),
          })
        : Promise.resolve(null),
    ])

    return ok(c, {
      run,
      command,
      actionRequest,
    })
  },
)
