import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
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
import { fail, ok, parseJsonBody } from './_api.js'
import { executeWorkCommand, recommendWorkCommands } from '../services/work-command-runtime.js'
import { canonicalActionBodySchema, persistCanonicalAction } from '../services/action-runtime.js'

const { db, workItems } = dbPackage

const recommendAiActionsBodySchema = z.object({
  query: z.string().max(2000).optional(),
  workItemId: z.string().optional().nullable(),
  limit: z.number().int().min(1).max(30).optional(),
})

const executeAiActionBodySchema = z
  .object({
    mode: z.enum(['command', 'action']).default('command'),
    commandId: z.string().optional(),
    commandKey: z.string().optional(),
    workItemId: z.string().optional().nullable(),
    runtimePayload: z.record(z.unknown()).optional(),
    action: canonicalActionBodySchema.optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'command' && !value.commandId && !value.commandKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['commandId'],
        message: 'Either commandId or commandKey is required when mode=command.',
      })
    }
    if (value.mode === 'action' && !value.action) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['action'],
        message: 'action is required when mode=action.',
      })
    }
  })

export const aiActionRoutes = new Hono()

aiActionRoutes.post(
  '/bizes/:bizId/ai-actions/recommend',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = await parseJsonBody(c, recommendAiActionsBodySchema)
    if (!parsed.ok) return parsed.response

    const user = getCurrentUser(c)

    const result = await recommendWorkCommands({
      bizId,
      query: parsed.data.query ?? null,
      workItemId: parsed.data.workItemId ?? null,
      limit: parsed.data.limit,
      actorUserId: user?.id ?? null,
    })

    return ok(c, {
      query: parsed.data.query ?? null,
      workItem: result.workItem,
      recommendations: result.recommendations.map((item) => ({
        score: item.score,
        reason: item.reason,
        command: item.command,
      })),
    })
  },
)

aiActionRoutes.post(
  '/bizes/:bizId/ai-actions/execute',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('actions.execute', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = await parseJsonBody(c, executeAiActionBodySchema)
    if (!parsed.ok) return parsed.response

    const user = getCurrentUser(c)
    if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

    if (parsed.data.mode === 'command') {
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

      return ok(c, {
        mode: 'command',
        ...result,
      })
    }

    const workItem = parsed.data.workItemId
      ? await db.query.workItems.findFirst({
          where: and(eq(workItems.bizId, bizId), eq(workItems.id, parsed.data.workItemId)),
        })
      : null

    if (parsed.data.workItemId && !workItem) {
      return fail(c, 'WORK_ITEM_NOT_FOUND', 'Work item not found.', 404)
    }

    const actionBody = parsed.data.action as z.infer<typeof canonicalActionBodySchema>

    const result = await persistCanonicalAction({
      bizId,
      intentMode: 'execute',
      input: {
        ...actionBody,
        targetSubjectType: actionBody.targetSubjectType ?? (workItem ? 'work_item' : 'biz'),
        targetSubjectId: actionBody.targetSubjectId ?? (workItem?.id ?? bizId),
        metadata: {
          ...(actionBody.metadata ?? {}),
          ...(parsed.data.metadata ?? {}),
          source: 'ai-actions.execute',
          attachedWorkItemId: workItem?.id ?? null,
        },
      },
      context: {
        bizId,
        user,
        authSource: getCurrentAuthSource(c),
        authCredentialId: getCurrentAuthCredentialId(c),
        requestId: c.get('requestId'),
        accessMode: 'biz',
      },
    }).catch((error) => {
      if (error?.code === 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD') return error
      throw error
    })

    if ('code' in result && result.code === 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD') {
      return fail(c, result.code, result.message, result.httpStatus ?? 409)
    }

    if (result.failure) {
      return fail(c, 'ACTION_EXECUTION_FAILED', 'AI action execution failed.', result.httpStatus, {
        actionRequest: result.actionRequest,
        failure: result.failure,
      })
    }

    return ok(c, {
      mode: 'action',
      result,
    })
  },
)
