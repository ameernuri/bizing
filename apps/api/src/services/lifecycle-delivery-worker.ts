import { and, asc, eq, isNull, lte } from 'drizzle-orm'
import dbPackage from '@bizing/db'

const {
  db,
  domainEvents,
  lifecycleEventSubscriptions,
  lifecycleEventDeliveries,
} = dbPackage

type DeliveryAttemptResult = {
  outcome: 'published' | 'failed' | 'dead_letter'
  httpStatus: number | null
  errorCode: string | null
  errorMessage: string | null
  responsePayload: Record<string, unknown> | null
  nextAttemptAt: Date | null
}

export type LifecycleWorkerBizStats = {
  bizId: string
  claimed: number
  published: number
  failed: number
  deadLettered: number
  skipped: number
}

export type LifecycleWorkerRunSummary = {
  startedAt: string
  endedAt: string
  durationMs: number
  bizCount: number
  claimed: number
  published: number
  failed: number
  deadLettered: number
  skipped: number
  byBiz: LifecycleWorkerBizStats[]
}

type WorkerHealthState = {
  running: boolean
  startedAt: string | null
  lastRunAt: string | null
  lastError: string | null
  lastSummary: LifecycleWorkerRunSummary | null
}

const workerHealth: WorkerHealthState = {
  running: false,
  startedAt: null,
  lastRunAt: null,
  lastError: null,
  lastSummary: null,
}

function readRetryPolicy(subscription: typeof lifecycleEventSubscriptions.$inferSelect) {
  const policy = (subscription.retryPolicy ?? {}) as Record<string, unknown>
  const baseMinutesRaw = policy.baseMinutes
  const strategyRaw = policy.strategy
  const maxBackoffRaw = policy.maxBackoffMinutes
  const baseMinutes =
    typeof baseMinutesRaw === 'number' && Number.isFinite(baseMinutesRaw)
      ? Math.max(1, Math.floor(baseMinutesRaw))
      : 1
  const strategy =
    strategyRaw === 'linear' || strategyRaw === 'fixed' || strategyRaw === 'exponential'
      ? strategyRaw
      : 'exponential'
  const maxBackoffMinutes =
    typeof maxBackoffRaw === 'number' && Number.isFinite(maxBackoffRaw)
      ? Math.max(baseMinutes, Math.floor(maxBackoffRaw))
      : null
  return { strategy, baseMinutes, maxBackoffMinutes }
}

function computeBackoffMinutes(
  subscription: typeof lifecycleEventSubscriptions.$inferSelect,
  attemptCount: number,
) {
  const policy = readRetryPolicy(subscription)
  const attempt = Math.max(1, attemptCount)
  let next: number
  if (policy.strategy === 'fixed') {
    next = policy.baseMinutes
  } else if (policy.strategy === 'linear') {
    next = policy.baseMinutes * attempt
  } else {
    next = policy.baseMinutes * 2 ** Math.max(0, attempt - 1)
  }
  if (policy.maxBackoffMinutes) {
    next = Math.min(next, policy.maxBackoffMinutes)
  }
  return Math.max(1, Math.floor(next))
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

async function claimOneDueDelivery(bizId: string, now: Date) {
  const due = await db.query.lifecycleEventDeliveries.findFirst({
    where: and(
      eq(lifecycleEventDeliveries.bizId, bizId),
      eq(lifecycleEventDeliveries.status, 'pending'),
      lte(lifecycleEventDeliveries.nextAttemptAt, now),
      isNull(lifecycleEventDeliveries.lockedAt),
    ),
    orderBy: [asc(lifecycleEventDeliveries.nextAttemptAt), asc(lifecycleEventDeliveries.id)],
  })
  if (!due) return null

  const [claimed] = await db
    .update(lifecycleEventDeliveries)
    .set({
      status: 'processing',
      lockedAt: now,
      attemptCount: (due.attemptCount ?? 0) + 1,
    })
    .where(
      and(
        eq(lifecycleEventDeliveries.bizId, bizId),
        eq(lifecycleEventDeliveries.id, due.id),
        eq(lifecycleEventDeliveries.status, 'pending'),
        isNull(lifecycleEventDeliveries.lockedAt),
      ),
    )
    .returning()

  return claimed ?? null
}

async function executeDeliveryAttempt(input: {
  delivery: typeof lifecycleEventDeliveries.$inferSelect
  subscription: typeof lifecycleEventSubscriptions.$inferSelect
  event: typeof domainEvents.$inferSelect
  now: Date
}): Promise<DeliveryAttemptResult> {
  const { delivery, subscription, event, now } = input

  if (subscription.status !== 'active') {
    return {
      outcome: 'dead_letter',
      httpStatus: null,
      errorCode: 'SUBSCRIPTION_INACTIVE',
      errorMessage: `Subscription ${subscription.id} is ${subscription.status}.`,
      responsePayload: null,
      nextAttemptAt: null,
    }
  }

  if (subscription.deliveryMode === 'internal_handler') {
    return {
      outcome: 'published',
      httpStatus: 200,
      errorCode: null,
      errorMessage: null,
      responsePayload: {
        deliveryMode: 'internal_handler',
        handlerKey: subscription.internalHandlerKey ?? null,
        processedAt: now.toISOString(),
      },
      nextAttemptAt: null,
    }
  }

  if (!subscription.webhookUrl) {
    return {
      outcome: 'dead_letter',
      httpStatus: null,
      errorCode: 'WEBHOOK_URL_MISSING',
      errorMessage: 'Webhook delivery mode selected but webhookUrl is empty.',
      responsePayload: null,
      nextAttemptAt: null,
    }
  }

  const timeoutMs = Math.max(100, Math.min(subscription.timeoutMs ?? 10000, 300000))
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const payload = {
      eventId: event.id,
      bizId: event.bizId,
      eventKey: event.eventKey,
      eventFamily: event.eventFamily,
      subjectType: event.subjectType,
      subjectId: event.subjectId,
      occurredAt: event.occurredAt.toISOString(),
      payload: event.payload ?? {},
      metadata: event.metadata ?? {},
      deliveryId: delivery.id,
      attemptCount: delivery.attemptCount,
    }

    const response = await fetch(subscription.webhookUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-bizing-delivery-id': delivery.id,
        'x-bizing-event-id': event.id,
        'x-bizing-event-key': event.eventKey,
      },
      body: JSON.stringify(payload),
    })
    const responseText = await response.text().catch(() => '')
    const bodySnippet = responseText.slice(0, 4000)

    if (response.ok) {
      return {
        outcome: 'published',
        httpStatus: response.status,
        errorCode: null,
        errorMessage: null,
        responsePayload: {
          status: response.status,
          ok: true,
          bodySnippet,
        },
        nextAttemptAt: null,
      }
    }

    const hasAttemptsLeft = (delivery.attemptCount ?? 1) < (subscription.maxAttempts ?? 8)
    const nextAttemptAt = hasAttemptsLeft
      ? new Date(now.getTime() + computeBackoffMinutes(subscription, delivery.attemptCount ?? 1) * 60 * 1000)
      : null

    return {
      outcome: hasAttemptsLeft ? 'failed' : 'dead_letter',
      httpStatus: response.status,
      errorCode: `WEBHOOK_HTTP_${response.status}`,
      errorMessage: `Webhook returned status ${response.status}.`,
      responsePayload: {
        status: response.status,
        ok: false,
        bodySnippet,
      },
      nextAttemptAt,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const hasAttemptsLeft = (delivery.attemptCount ?? 1) < (subscription.maxAttempts ?? 8)
    const nextAttemptAt = hasAttemptsLeft
      ? new Date(now.getTime() + computeBackoffMinutes(subscription, delivery.attemptCount ?? 1) * 60 * 1000)
      : null
    return {
      outcome: hasAttemptsLeft ? 'failed' : 'dead_letter',
      httpStatus: null,
      errorCode: 'WEBHOOK_REQUEST_FAILED',
      errorMessage: message,
      responsePayload: {
        ok: false,
        error: message,
      },
      nextAttemptAt,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function finalizeDelivery(
  delivery: typeof lifecycleEventDeliveries.$inferSelect,
  result: DeliveryAttemptResult,
  now: Date,
) {
  const metadata = asRecord(delivery.metadata)
  const mergedMetadata: Record<string, unknown> = {
    ...metadata,
    lastWorkerAttemptAt: now.toISOString(),
    lastOutcome: result.outcome,
  }

  await db
    .update(lifecycleEventDeliveries)
    .set({
      status: result.outcome === 'failed' ? 'pending' : result.outcome,
      lockedAt: null,
      nextAttemptAt: result.nextAttemptAt ?? now,
      publishedAt: result.outcome === 'published' ? now : delivery.publishedAt,
      deadLetteredAt: result.outcome === 'dead_letter' ? now : null,
      httpStatus: result.httpStatus,
      lastErrorCode: result.errorCode,
      lastErrorMessage: result.errorMessage,
      responsePayload: result.responsePayload,
      metadata: mergedMetadata,
    })
    .where(and(eq(lifecycleEventDeliveries.bizId, delivery.bizId), eq(lifecycleEventDeliveries.id, delivery.id)))
}

async function processClaimedDelivery(input: {
  delivery: typeof lifecycleEventDeliveries.$inferSelect
  now: Date
}) {
  const { delivery, now } = input

  const [subscription, event] = await Promise.all([
    db.query.lifecycleEventSubscriptions.findFirst({
      where: and(
        eq(lifecycleEventSubscriptions.bizId, delivery.bizId),
        eq(lifecycleEventSubscriptions.id, delivery.lifecycleEventSubscriptionId),
      ),
    }),
    db.query.domainEvents.findFirst({
      where: and(eq(domainEvents.bizId, delivery.bizId), eq(domainEvents.id, delivery.lifecycleEventId)),
    }),
  ])

  if (!subscription || !event) {
    const missing = !subscription && !event ? 'subscription+event' : !subscription ? 'subscription' : 'event'
    await finalizeDelivery(
      delivery,
      {
        outcome: 'dead_letter',
        httpStatus: null,
        errorCode: 'DELIVERY_DEPENDENCY_MISSING',
        errorMessage: `Cannot process delivery; missing ${missing}.`,
        responsePayload: null,
        nextAttemptAt: null,
      },
      now,
    )
    return 'dead_letter' as const
  }

  const result = await executeDeliveryAttempt({
    delivery,
    subscription,
    event,
    now,
  })
  await finalizeDelivery(delivery, result, now)
  return result.outcome
}

export async function processLifecycleDeliveryQueueForBiz(input: {
  bizId: string
  limit?: number
}): Promise<LifecycleWorkerBizStats> {
  const now = new Date()
  const limit = Math.max(1, Math.min(input.limit ?? 20, 500))
  const stats: LifecycleWorkerBizStats = {
    bizId: input.bizId,
    claimed: 0,
    published: 0,
    failed: 0,
    deadLettered: 0,
    skipped: 0,
  }

  for (let i = 0; i < limit; i += 1) {
    const claimed = await claimOneDueDelivery(input.bizId, now)
    if (!claimed) break
    stats.claimed += 1
    const outcome = await processClaimedDelivery({
      delivery: claimed,
      now: new Date(),
    })
    if (outcome === 'published') stats.published += 1
    else if (outcome === 'failed') stats.failed += 1
    else if (outcome === 'dead_letter') stats.deadLettered += 1
    else stats.skipped += 1
  }

  return stats
}

export async function processLifecycleDeliveryQueueAcrossBizes(input?: {
  maxBizes?: number
  maxPerBiz?: number
}) {
  const now = new Date()
  const maxBizes = Math.max(1, Math.min(input?.maxBizes ?? 25, 500))
  const maxPerBiz = Math.max(1, Math.min(input?.maxPerBiz ?? 20, 500))

  const dueBizRows = await db
    .select({
      bizId: lifecycleEventDeliveries.bizId,
    })
    .from(lifecycleEventDeliveries)
    .where(
      and(
        eq(lifecycleEventDeliveries.status, 'pending'),
        lte(lifecycleEventDeliveries.nextAttemptAt, now),
        isNull(lifecycleEventDeliveries.lockedAt),
      ),
    )
    .groupBy(lifecycleEventDeliveries.bizId)
    .orderBy(asc(lifecycleEventDeliveries.bizId))
    .limit(maxBizes)

  const startedAt = Date.now()
  const byBiz: LifecycleWorkerBizStats[] = []
  for (const row of dueBizRows) {
    byBiz.push(
      await processLifecycleDeliveryQueueForBiz({
        bizId: row.bizId,
        limit: maxPerBiz,
      }),
    )
  }

  const summary: LifecycleWorkerRunSummary = {
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    bizCount: byBiz.length,
    claimed: byBiz.reduce((sum, row) => sum + row.claimed, 0),
    published: byBiz.reduce((sum, row) => sum + row.published, 0),
    failed: byBiz.reduce((sum, row) => sum + row.failed, 0),
    deadLettered: byBiz.reduce((sum, row) => sum + row.deadLettered, 0),
    skipped: byBiz.reduce((sum, row) => sum + row.skipped, 0),
    byBiz,
  }

  workerHealth.lastRunAt = summary.endedAt
  workerHealth.lastSummary = summary
  return summary
}

export function getLifecycleDeliveryWorkerHealth() {
  return {
    ...workerHealth,
  }
}

export function startLifecycleDeliveryWorker() {
  const enabled =
    process.env.LIFECYCLE_DELIVERY_WORKER_ENABLED === undefined
      ? true
      : process.env.LIFECYCLE_DELIVERY_WORKER_ENABLED === '1' ||
        process.env.LIFECYCLE_DELIVERY_WORKER_ENABLED === 'true'
  if (!enabled) return
  if (workerHealth.startedAt) return

  const intervalMs = Math.max(
    1000,
    Number.parseInt(process.env.LIFECYCLE_DELIVERY_WORKER_INTERVAL_MS ?? '5000', 10) || 5000,
  )
  const maxBizes = Math.max(
    1,
    Number.parseInt(process.env.LIFECYCLE_DELIVERY_WORKER_MAX_BIZES ?? '25', 10) || 25,
  )
  const maxPerBiz = Math.max(
    1,
    Number.parseInt(process.env.LIFECYCLE_DELIVERY_WORKER_MAX_PER_BIZ ?? '20', 10) || 20,
  )

  workerHealth.startedAt = new Date().toISOString()
  const tick = async () => {
    if (workerHealth.running) return
    workerHealth.running = true
    workerHealth.lastError = null
    try {
      await processLifecycleDeliveryQueueAcrossBizes({
        maxBizes,
        maxPerBiz,
      })
    } catch (error) {
      workerHealth.lastError = error instanceof Error ? error.message : String(error)
    } finally {
      workerHealth.running = false
    }
  }

  setInterval(() => {
    void tick()
  }, intervalMs)
  void tick()
}

