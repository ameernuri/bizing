import type { Context } from 'hono'
import type { AuthSource, CurrentUser } from '../middleware/auth.js'
import { getCurrentAuthCredentialId, getCurrentAuthSource, getCurrentUser } from '../middleware/auth.js'
import { persistCanonicalAction } from './action-runtime.js'
import { syncWorkItemFromCrudMutation } from './work-items.js'

type CrudOperation = 'create' | 'update' | 'delete'

type CrudActionInput = {
  c: Context
  bizId?: string | null
  tableKey: string
  operation: CrudOperation
  id?: string
  data?: Record<string, unknown>
  patch?: Record<string, unknown>
  subjectType?: string
  subjectId?: string
  displayName?: string
  metadata?: Record<string, unknown>
  actorOverride?: CurrentUser
  authSourceOverride?: AuthSource
}

type CrudActionSuccess = {
  ok: true
  httpStatus: number
  row: Record<string, unknown> | null
  actionRequest: unknown
  workItem: unknown | null
}

type CrudActionFailure = {
  ok: false
  httpStatus: number
  code: string
  message: string
  details?: unknown
  actionRequest?: unknown
  failure?: unknown
}

/**
 * Route-to-action bridge for generic CRUD adapters.
 *
 * ELI5:
 * Route handlers can keep their friendly endpoint shapes, but when they mutate
 * state they should still pass through the canonical action engine. This helper
 * does that translation in one place:
 * - reads the current authenticated actor from request context
 * - builds the `crud.*` action payload
 * - executes through `persistCanonicalAction`
 * - returns a route-friendly success/failure object
 */
export async function executeCrudRouteAction(input: CrudActionInput): Promise<CrudActionSuccess | CrudActionFailure> {
  const user = input.actorOverride ?? getCurrentUser(input.c)
  if (!user) {
    return {
      ok: false,
      httpStatus: 401,
      code: 'UNAUTHORIZED',
      message: 'Authentication required.',
    }
  }

  const bizId = input.bizId ?? null

  const actionResult = await persistCanonicalAction({
    bizId: bizId as string,
    intentMode: 'execute',
    input: {
      actionKey: `crud.${input.operation}`,
      actionFamily: 'crud',
      targetSubjectType: input.subjectType ?? 'record',
      targetSubjectId: input.subjectId ?? input.id,
      payload: {
        tableKey: input.tableKey,
        operation: input.operation,
        id: input.id,
        data: input.data,
        patch: input.patch,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        displayName: input.displayName,
      },
      metadata: input.metadata ?? {},
    },
    context: {
      bizId: bizId as string,
      user,
      authSource: input.authSourceOverride ?? getCurrentAuthSource(input.c) ?? 'session',
      authCredentialId: getCurrentAuthCredentialId(input.c),
      requestId: input.c.get('requestId'),
      accessMode: 'biz',
    },
  })

  const actionRequest = (actionResult.actionRequest ?? {}) as Record<string, unknown>
  const outputPayload = (actionRequest.outputPayload ?? {}) as Record<string, unknown>
  const row = (outputPayload.row ?? null) as Record<string, unknown> | null

  if (actionResult.failure) {
    const failure = actionResult.failure as Record<string, unknown>
    return {
      ok: false,
      httpStatus: actionResult.httpStatus,
      code: String(failure.failureCode ?? 'ACTION_EXECUTION_FAILED'),
      message: String(failure.failureMessage ?? actionRequest.statusReason ?? 'Action execution failed.'),
      details: failure.diagnostics,
      actionRequest: actionResult.actionRequest,
      failure: actionResult.failure,
    }
  }

  let workItem: unknown | null = null
  try {
    if (bizId) {
      workItem = await syncWorkItemFromCrudMutation({
        bizId,
        tableKey: input.tableKey,
        operation: input.operation,
        row,
        id: input.id ?? row?.id?.toString?.() ?? undefined,
        actorUserId: user.id,
      })
    }
  } catch (error) {
    /**
     * Work-item sync is a projection side effect and must never block
     * canonical writes from route adapters.
     */
    console.warn('[action-route-bridge] work-item sync failed', {
      tableKey: input.tableKey,
      operation: input.operation,
      bizId,
      error,
    })
  }

  return {
    ok: true,
    httpStatus: actionResult.httpStatus,
    row,
    actionRequest: actionResult.actionRequest,
    workItem,
  }
}
