import { EventEmitter } from 'node:events'

/**
 * Canonical saga runtime event shape.
 *
 * ELI5:
 * Whenever a run/step/artifact changes, we emit one small event so realtime
 * clients (dashboard, bots) can update without polling.
 */
export type SagaRuntimeEvent = {
  eventType:
    | 'run.created'
    | 'run.updated'
    | 'run.completed'
    | 'run.archived'
    | 'step.updated'
    | 'artifact.created'
  runId: string
  sagaKey?: string
  bizId?: string | null
  requestedByUserId?: string | null
  stepKey?: string
  status?: string
  artifactType?: string
  timestamp: string
  payload?: Record<string, unknown>
}

const emitter = new EventEmitter()
const EVENT_NAME = 'saga.runtime.event'

export function publishSagaRuntimeEvent(event: Omit<SagaRuntimeEvent, 'timestamp'>) {
  emitter.emit(EVENT_NAME, {
    ...event,
    timestamp: new Date().toISOString(),
  } satisfies SagaRuntimeEvent)
}

export function onSagaRuntimeEvent(listener: (event: SagaRuntimeEvent) => void) {
  emitter.on(EVENT_NAME, listener)
  return () => emitter.off(EVENT_NAME, listener)
}

