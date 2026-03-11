import { and, desc, eq, sql } from 'drizzle-orm'
import dbPackage from '@bizing/db'
import { sanitizeUnknown } from '../lib/sanitize.js'
import type { AuthSource, CurrentUser } from '../middleware/auth.js'
import { persistCanonicalAction } from './action-runtime.js'
import { buildCommandPayload, ensureBuiltinWorkCommands } from './work-items.js'

const { db, workCommands, workCommandRuns, workItems, workItemEvents, actionRequests } = dbPackage

type CommandSelector =
  | {
      commandId: string
      commandKey?: never
    }
  | {
      commandId?: never
      commandKey: string
    }

type CommandExecutionInput = {
  bizId: string
  actor: CurrentUser
  authSource?: AuthSource | null
  authCredentialId?: string | null
  requestId?: string
  selector: CommandSelector
  workItemId?: string | null
  runtimePayload?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

type RecommendationInput = {
  bizId: string
  query?: string | null
  workItemId?: string | null
  limit?: number
  actorUserId?: string | null
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : null))
    .filter((entry): entry is string => Boolean(entry))
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
}

function scoreCommandMatch(input: {
  command: typeof workCommands.$inferSelect
  queryTokens: string[]
  workItem?: typeof workItems.$inferSelect | null
}) {
  const guardPolicy = asRecord(input.command.guardPolicy)
  const requiresWorkItemId = guardPolicy.requiresWorkItemId === true
  const allowedStatuses = asStringList(guardPolicy.allowedStatuses)

  if (requiresWorkItemId && !input.workItem) {
    return {
      score: -1000,
      reason: 'Requires a work item target.',
    }
  }

  if (allowedStatuses.length > 0 && input.workItem && !allowedStatuses.includes(input.workItem.status)) {
    return {
      score: -1000,
      reason: `Not allowed for status ${input.workItem.status}.`,
    }
  }

  let score = 10
  const haystack = [
    input.command.commandKey,
    input.command.title,
    input.command.description ?? '',
    JSON.stringify(input.command.defaultPayload ?? {}),
  ]
    .join(' ')
    .toLowerCase()

  for (const token of input.queryTokens) {
    if (haystack.includes(token)) score += 8
  }

  if (input.workItem) {
    if (input.command.targetScope === 'work_item') score += 6
    if (input.command.commandKey.includes('work_item.')) score += 4
  }

  if (asRecord(input.command.metadata).builtin === true) {
    score += 2
  }

  return {
    score,
    reason: 'Matched command intent and guard policy.',
  }
}

function commandFamily(actionKey: string) {
  const first = actionKey.split('.')[0]?.trim()
  return first && first.length > 0 ? first : 'general'
}

async function markCommandRun(input: {
  runId: string
  status: 'running' | 'succeeded' | 'failed' | 'cancelled'
  actionRequestId?: string | null
  outputPayload?: Record<string, unknown>
  errorPayload?: Record<string, unknown>
  actorUserId: string
}) {
  const [updated] = await db
    .update(workCommandRuns)
    .set({
      status: input.status,
      actionRequestId: input.actionRequestId ?? null,
      outputPayload: sanitizeUnknown(input.outputPayload ?? {}) as Record<string, unknown>,
      errorPayload: sanitizeUnknown(input.errorPayload ?? {}) as Record<string, unknown>,
      completedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
    })
    .where(eq(workCommandRuns.id, input.runId))
    .returning()

  return updated
}

async function appendWorkItemCommandEvent(input: {
  bizId: string
  workItemId: string | null
  eventType: 'command_run_started' | 'command_run_finished'
  actorUserId: string
  payload?: Record<string, unknown>
  note?: string
}) {
  if (!input.workItemId) return

  await db.insert(workItemEvents).values({
    bizId: input.bizId,
    workItemId: input.workItemId,
    eventType: input.eventType,
    actorType: 'user',
    actorUserId: input.actorUserId,
    note: input.note ?? null,
    payload: sanitizeUnknown(input.payload ?? {}) as Record<string, unknown>,
  })
}

export async function recommendWorkCommands(input: RecommendationInput) {
  const limit = Math.max(1, Math.min(input.limit ?? 12, 50))

  await ensureBuiltinWorkCommands({
    bizId: input.bizId,
    actorUserId: input.actorUserId ?? null,
  })

  const [commands, workItem] = await Promise.all([
    db.query.workCommands.findMany({
      where: and(eq(workCommands.bizId, input.bizId), eq(workCommands.status, 'active')),
      orderBy: [desc(workCommands.updatedAt), desc(workCommands.createdAt)],
      limit: 300,
    }),
    input.workItemId
      ? db.query.workItems.findFirst({
          where: and(eq(workItems.bizId, input.bizId), eq(workItems.id, input.workItemId)),
        })
      : Promise.resolve(null),
  ])

  const queryTokens = tokenize(
    [input.query ?? '', workItem?.title ?? '', workItem?.summary ?? ''].join(' ').trim(),
  )

  const ranked = commands
    .map((command) => {
      const scoreResult = scoreCommandMatch({
        command,
        queryTokens,
        workItem,
      })
      return {
        command,
        score: scoreResult.score,
        reason: scoreResult.reason,
      }
    })
    .filter((item) => item.score > -100)
    .sort((a, b) => b.score - a.score || a.command.commandKey.localeCompare(b.command.commandKey))
    .slice(0, limit)

  return {
    workItem,
    recommendations: ranked,
  }
}

export async function executeWorkCommand(input: CommandExecutionInput) {
  const commandId = 'commandId' in input.selector ? input.selector.commandId : undefined
  const commandKey = 'commandKey' in input.selector ? input.selector.commandKey : undefined

  const command = commandId
    ? await db.query.workCommands.findFirst({
        where: and(
          eq(workCommands.bizId, input.bizId),
          eq(workCommands.id, commandId),
          eq(workCommands.status, 'active'),
        ),
      })
    : await db.query.workCommands.findFirst({
        where: and(
          eq(workCommands.bizId, input.bizId),
          eq(workCommands.commandKey, commandKey as string),
          eq(workCommands.status, 'active'),
        ),
      })

  if (!command) {
    return {
      ok: false as const,
      code: 'NOT_FOUND',
      httpStatus: 404,
      message: 'Work command not found.',
    }
  }

  const workItem = input.workItemId
    ? await db.query.workItems.findFirst({
        where: and(eq(workItems.bizId, input.bizId), eq(workItems.id, input.workItemId)),
      })
    : null

  if (input.workItemId && !workItem) {
    return {
      ok: false as const,
      code: 'WORK_ITEM_NOT_FOUND',
      httpStatus: 404,
      message: 'Work item not found.',
    }
  }

  const guardPolicy = asRecord(command.guardPolicy)
  const requiresWorkItemId = guardPolicy.requiresWorkItemId === true
  if (requiresWorkItemId && !workItem) {
    return {
      ok: false as const,
      code: 'WORK_ITEM_REQUIRED',
      httpStatus: 400,
      message: 'This command requires a work item target.',
    }
  }

  const allowedStatuses = asStringList(guardPolicy.allowedStatuses)
  if (allowedStatuses.length > 0 && workItem && !allowedStatuses.includes(workItem.status)) {
    return {
      ok: false as const,
      code: 'WORK_ITEM_STATUS_BLOCKED',
      httpStatus: 409,
      message: `Command cannot run for work item status ${workItem.status}.`,
      details: {
        allowedStatuses,
        currentStatus: workItem.status,
      },
    }
  }

  const payload = buildCommandPayload({
    commandDefaultPayload: command.defaultPayload,
    runtimePayload: input.runtimePayload,
    workItemId: workItem?.id ?? null,
  })

  const [run] = await db
    .insert(workCommandRuns)
    .values({
      bizId: input.bizId,
      workCommandId: command.id,
      workItemId: workItem?.id ?? null,
      status: 'running',
      requestedByUserId: input.actor.id,
      inputPayload: payload,
      outputPayload: {},
      errorPayload: {},
      startedAt: new Date(),
      metadata: sanitizeUnknown(input.metadata ?? {}) as Record<string, unknown>,
      createdBy: input.actor.id,
      updatedBy: input.actor.id,
    })
    .returning()

  await appendWorkItemCommandEvent({
    bizId: input.bizId,
    workItemId: workItem?.id ?? null,
    eventType: 'command_run_started',
    actorUserId: input.actor.id,
    payload: {
      workCommandId: command.id,
      workCommandRunId: run.id,
      commandKey: command.commandKey,
    },
  })

  if (command.commandKind !== 'action') {
    const updated = await markCommandRun({
      runId: run.id,
      status: 'failed',
      actorUserId: input.actor.id,
      errorPayload: {
        code: 'COMMAND_KIND_UNSUPPORTED',
        message: `Only action commands are executable in v0. Received kind ${command.commandKind}.`,
      },
    })

    await appendWorkItemCommandEvent({
      bizId: input.bizId,
      workItemId: workItem?.id ?? null,
      eventType: 'command_run_finished',
      actorUserId: input.actor.id,
      payload: {
        workCommandId: command.id,
        workCommandRunId: run.id,
        status: 'failed',
      },
      note: `Command run failed: unsupported kind ${command.commandKind}`,
    })

    return {
      ok: false as const,
      code: 'COMMAND_KIND_UNSUPPORTED',
      httpStatus: 400,
      message: `Only action commands are executable in v0. Received kind ${command.commandKind}.`,
      command,
      workItem,
      run: updated,
    }
  }

  if (!command.actionKey) {
    const updated = await markCommandRun({
      runId: run.id,
      status: 'failed',
      actorUserId: input.actor.id,
      errorPayload: {
        code: 'ACTION_KEY_REQUIRED',
        message: 'Action command is missing actionKey.',
      },
    })

    await appendWorkItemCommandEvent({
      bizId: input.bizId,
      workItemId: workItem?.id ?? null,
      eventType: 'command_run_finished',
      actorUserId: input.actor.id,
      payload: {
        workCommandId: command.id,
        workCommandRunId: run.id,
        status: 'failed',
      },
      note: 'Command run failed: missing actionKey.',
    })

    return {
      ok: false as const,
      code: 'ACTION_KEY_REQUIRED',
      httpStatus: 500,
      message: 'Action command is missing actionKey.',
      command,
      workItem,
      run: updated,
    }
  }

  const result = await persistCanonicalAction({
    bizId: input.bizId,
    intentMode: 'execute',
    input: {
      actionKey: command.actionKey,
      actionFamily: commandFamily(command.actionKey),
      targetSubjectType: workItem ? 'work_item' : 'biz',
      targetSubjectId: workItem?.id ?? input.bizId,
      payload,
      metadata: {
        source: 'work-command-runtime',
        workCommandId: command.id,
        workCommandRunId: run.id,
      },
    },
    context: {
      bizId: input.bizId,
      user: input.actor,
      authSource: input.authSource ?? 'session',
      authCredentialId: input.authCredentialId ?? undefined,
      requestId: input.requestId,
      accessMode: 'biz',
    },
  }).catch((error) => {
    if (error?.code === 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD') return error
    throw error
  })

  if ('code' in result && result.code === 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD') {
    const updated = await markCommandRun({
      runId: run.id,
      status: 'failed',
      actorUserId: input.actor.id,
      errorPayload: {
        code: result.code,
        message: result.message,
      },
    })

    await appendWorkItemCommandEvent({
      bizId: input.bizId,
      workItemId: workItem?.id ?? null,
      eventType: 'command_run_finished',
      actorUserId: input.actor.id,
      payload: {
        workCommandId: command.id,
        workCommandRunId: run.id,
        status: 'failed',
      },
      note: `Command run failed: ${result.code}`,
    })

    return {
      ok: false as const,
      code: result.code,
      httpStatus: result.httpStatus ?? 409,
      message: result.message,
      command,
      workItem,
      run: updated,
    }
  }

  const actionRequest = (result.actionRequest ?? null) as { id?: string } | null

  if (result.failure) {
    const updated = await markCommandRun({
      runId: run.id,
      status: 'failed',
      actorUserId: input.actor.id,
      actionRequestId: actionRequest?.id ?? null,
      errorPayload: sanitizeUnknown(result.failure as Record<string, unknown>) as Record<string, unknown>,
      outputPayload: {
        actionRequest,
      },
    })

    await appendWorkItemCommandEvent({
      bizId: input.bizId,
      workItemId: workItem?.id ?? null,
      eventType: 'command_run_finished',
      actorUserId: input.actor.id,
      payload: {
        workCommandId: command.id,
        workCommandRunId: run.id,
        status: 'failed',
        actionRequestId: actionRequest?.id ?? null,
      },
      note: 'Command run finished with failure.',
    })

    return {
      ok: false as const,
      code: 'ACTION_EXECUTION_FAILED',
      httpStatus: result.httpStatus,
      message: 'Command action execution failed.',
      command,
      workItem,
      run: updated,
      actionResult: result,
    }
  }

  const [executionCountRow] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(actionRequests)
    .where(eq(actionRequests.id, actionRequest?.id ?? ''))

  const updated = await markCommandRun({
    runId: run.id,
    status: 'succeeded',
    actorUserId: input.actor.id,
    actionRequestId: actionRequest?.id ?? null,
    outputPayload: {
      actionRequest,
      idempotencyReused: result.reused,
      actionRequestFound: (executionCountRow?.count ?? 0) > 0,
    },
  })

  await appendWorkItemCommandEvent({
    bizId: input.bizId,
    workItemId: workItem?.id ?? null,
    eventType: 'command_run_finished',
    actorUserId: input.actor.id,
    payload: {
      workCommandId: command.id,
      workCommandRunId: run.id,
      status: 'succeeded',
      actionRequestId: actionRequest?.id ?? null,
    },
    note: 'Command run succeeded.',
  })

  return {
    ok: true as const,
    httpStatus: 200,
    command,
    workItem,
    run: updated,
    actionResult: result,
  }
}
