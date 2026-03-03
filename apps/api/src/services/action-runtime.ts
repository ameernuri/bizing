import crypto from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import { and, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import type { AuthSource, CurrentUser } from '../middleware/auth.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { createBookingLifecycleMessage } from './booking-lifecycle-messages.js'

const {
  db: baseDb,
  actionRequests,
  actionIdempotencyKeys,
  actionExecutions,
  actionFailures,
  debugSnapshots,
  bookingOrders,
  offers,
  offerVersions,
  resources,
  serviceGroups,
  services,
  serviceProducts,
  calendars,
  calendarOverlays,
  availabilityRules,
  members,
  users,
  subjects,
  domainEvents,
  projections,
  projectionDocuments,
  sellables,
  sellableServiceProducts,
  sellableOfferVersions,
} = dbPackage

type ActionDbExecutor = typeof baseDb

const actionDbContext = new AsyncLocalStorage<ActionDbExecutor>()

const db: ActionDbExecutor = new Proxy(baseDb as object, {
  get(_target, propertyKey, _receiver) {
    const active = actionDbContext.getStore() ?? baseDb
    const value = Reflect.get(active as object, propertyKey)
    return typeof value === 'function' ? (value as Function).bind(active) : value
  },
}) as ActionDbExecutor

/**
 * Generic action envelope accepted by the canonical actions API.
 *
 * ELI5:
 * The caller does not hit "random route X that mutates random table Y".
 * The caller says:
 * - what action they want,
 * - which object they are aiming at,
 * - which payload they are providing,
 * - whether they want a preview or the real write.
 *
 * This shape is intentionally stable. It is the contract humans, external
 * installations, internal UI flows, and agents can all grow around.
 */
export const canonicalActionBodySchema = z.object({
  actionKey: z.string().min(1).max(160),
  actionFamily: z.string().min(1).max(80).optional(),
  targetSubjectType: z.string().min(1).max(80).optional(),
  targetSubjectId: z.string().min(1).max(140).optional(),
  sourceInstallationRef: z.string().min(1).max(160).optional(),
  idempotencyKey: z.string().min(1).max(200).optional(),
  payload: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).default({}),
})

const bookingCreatePayloadSchema = z.object({
  offerId: z.string().min(1),
  offerVersionId: z.string().min(1),
  customerUserId: z.string().optional(),
  customerGroupAccountId: z.string().optional(),
  status: z
    .enum([
      'draft',
      'quoted',
      'awaiting_payment',
      'confirmed',
      'checked_in',
      'in_progress',
      'completed',
      'cancelled',
      'expired',
      'failed',
    ])
    .default('draft'),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  subtotalMinor: z.number().int().min(0).default(0),
  taxMinor: z.number().int().min(0).default(0),
  feeMinor: z.number().int().min(0).default(0),
  discountMinor: z.number().int().min(0).default(0),
  totalMinor: z.number().int().min(0).optional(),
  requestedStartAt: z.string().datetime().optional(),
  requestedEndAt: z.string().datetime().optional(),
  confirmedStartAt: z.string().datetime().optional(),
  confirmedEndAt: z.string().datetime().optional(),
  pricingSnapshot: z.record(z.unknown()).optional(),
  policySnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const bookingCancelPayloadSchema = z.object({
  bookingOrderId: z.string().min(1),
  reason: z.string().max(500).optional(),
})

const offerPublishPayloadSchema = z.object({
  offerId: z.string().min(1),
  offerVersionId: z.string().min(1).optional(),
  offerStatus: z.enum(['draft', 'active', 'inactive', 'archived']).default('active').optional(),
  publishOffer: z.boolean().default(true).optional(),
  offerVersionStatus: z.enum(['draft', 'published', 'superseded', 'retired']).default('published').optional(),
})

const offerCreatePayloadSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(140).regex(/^[a-z0-9-]+$/),
  description: z.string().max(4000).optional(),
  executionMode: z
    .enum(['slot', 'queue', 'request', 'auction', 'async', 'route_trip', 'open_access', 'itinerary'])
    .default('slot'),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('draft'),
  isPublished: z.boolean().default(false),
  timezone: z.string().min(1).max(50).default('UTC'),
  metadata: z.record(z.unknown()).optional(),
})

const offerUpdatePayloadSchema = offerCreatePayloadSchema.partial().extend({
  offerId: z.string().min(1),
})

const offerArchivePayloadSchema = z.object({
  offerId: z.string().min(1),
})

const serviceGroupCreatePayloadSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  statusConfigValueId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const serviceGroupUpdatePayloadSchema = serviceGroupCreatePayloadSchema.partial().extend({
  serviceGroupId: z.string().min(1),
})

const serviceGroupArchivePayloadSchema = z.object({
  serviceGroupId: z.string().min(1),
})

const serviceCreatePayloadSchema = z.object({
  serviceGroupId: z.string().min(1),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional(),
  type: z.enum(['appointment', 'class', 'rental', 'multi_day', 'call']).default('appointment'),
  typeConfigValueId: z.string().optional(),
  visibility: z.enum(['public', 'private', 'internal']).default('public'),
  visibilityConfigValueId: z.string().optional(),
  minAdvanceBookingHours: z.number().int().min(0).nullable().optional(),
  maxAdvanceBookingDays: z.number().int().min(0).nullable().optional(),
  bookingCutoffMinutes: z.number().int().min(0).nullable().optional(),
  requiresApproval: z.boolean().default(false),
  allowWaitlist: z.boolean().default(true),
  allowOverbooking: z.boolean().default(false),
  minCancellationNoticeHours: z.number().int().min(0).nullable().optional(),
  minRescheduleNoticeHours: z.number().int().min(0).nullable().optional(),
  bookingPolicy: z.record(z.unknown()).optional(),
  cancellationPolicy: z.record(z.unknown()).optional(),
  depositPolicy: z.record(z.unknown()).optional(),
  eligibilityPolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  isSelfBookable: z.boolean().optional(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  statusConfigValueId: z.string().optional(),
})

const serviceUpdatePayloadSchema = serviceCreatePayloadSchema.partial().extend({
  serviceId: z.string().min(1),
})

const serviceArchivePayloadSchema = z.object({
  serviceId: z.string().min(1),
})

const serviceProductPublishPayloadSchema = z.object({
  serviceProductId: z.string().min(1),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active').optional(),
  isPublished: z.boolean().default(true).optional(),
})

const memberOffboardPayloadSchema = z.object({
  memberId: z.string().min(1),
  reason: z.string().min(1).max(500),
  checklist: z
    .array(
      z.object({
        key: z.string().min(1).max(120),
        label: z.string().min(1).max(220).optional(),
        completed: z.boolean(),
      }),
    )
    .min(1),
  metadata: z.record(z.unknown()).optional(),
})

const calendarBlockPayloadSchema = z.object({
  calendarId: z.string().min(1),
  name: z.string().min(1).max(180),
  description: z.string().max(600).optional(),
  kind: z.enum(['base', 'blackout', 'seasonal', 'maintenance', 'emergency', 'promo']).default('blackout').optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  priority: z.number().int().min(0).default(100).optional(),
  metadata: z.record(z.unknown()).optional(),
  ruleMetadata: z.record(z.unknown()).optional(),
})

const resourceCreatePayloadSchema = z.object({
  locationId: z.string().min(1),
  type: z.enum(['host', 'company_host', 'asset', 'venue']),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).optional(),
  timezone: z.string().min(1).max(50).default('UTC'),
  statusDefinitionId: z.string().optional(),
  hostUserId: z.string().optional(),
  groupAccountId: z.string().optional(),
  assetId: z.string().optional(),
  venueId: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  allowSimultaneousBookings: z.boolean().default(false),
  maxSimultaneousBookings: z.number().int().positive().optional(),
  bufferBeforeMinutes: z.number().int().min(0).default(0),
  bufferAfterMinutes: z.number().int().min(0).default(0),
  metadata: z.record(z.unknown()).optional(),
})

const resourceUpdatePayloadSchema = resourceCreatePayloadSchema
  .partial()
  .omit({ type: true })
  .extend({
    resourceId: z.string().min(1),
  })

const resourceDeletePayloadSchema = z.object({
  resourceId: z.string().min(1),
})

const serviceProductCreatePayloadSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  description: z.string().max(4000).optional(),
  kind: z.enum(['booking', 'rental', 'hybrid']).default('booking'),
  kindConfigValueId: z.string().optional(),
  durationMode: z.enum(['fixed', 'flexible', 'multi_day']).default('fixed'),
  durationModeConfigValueId: z.string().optional(),
  defaultDurationMinutes: z.number().int().positive().default(60),
  minDurationMinutes: z.number().int().positive().nullable().optional(),
  maxDurationMinutes: z.number().int().positive().nullable().optional(),
  durationStepMinutes: z.number().int().positive().default(15),
  timezone: z.string().min(1).max(50).default('UTC'),
  basePriceAmountMinorUnits: z.number().int().min(0).default(0),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  pricingPolicy: z.record(z.unknown()).optional(),
  availabilityPolicy: z.record(z.unknown()).optional(),
  isPublished: z.boolean().default(false),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('draft'),
  statusConfigValueId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const serviceProductUpdatePayloadSchema = serviceProductCreatePayloadSchema.partial().extend({
  serviceProductId: z.string().min(1),
})

const serviceProductArchivePayloadSchema = z.object({
  serviceProductId: z.string().min(1),
})

const calendarCreatePayloadSchema = z.object({
  name: z.string().min(1).max(200),
  timezone: z.string().min(1).max(50).default('UTC'),
  slotDurationMin: z.number().int().positive().default(30),
  slotIntervalMin: z.number().int().positive().default(15),
  preBufferMin: z.number().int().min(0).default(0),
  postBufferMin: z.number().int().min(0).default(0),
  minAdvanceBookingHours: z.number().int().min(0).default(0),
  maxAdvanceBookingDays: z.number().int().min(0).default(365),
  defaultMode: z.enum(['available_by_default', 'unavailable_by_default']).default('available_by_default'),
  ruleEvaluationOrder: z
    .enum(['priority_asc', 'priority_desc', 'specificity_then_priority'])
    .default('specificity_then_priority'),
  conflictResolutionMode: z
    .enum(['priority_wins', 'unavailable_wins', 'available_wins', 'most_restrictive_wins'])
    .default('unavailable_wins'),
  enforceStrictNonOverlap: z.boolean().default(false),
  emitTimelineFacts: z.boolean().default(true),
  status: z.enum(['active', 'inactive']).default('active'),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const calendarUpdatePayloadSchema = calendarCreatePayloadSchema.partial().extend({
  calendarId: z.string().min(1),
})

const calendarArchivePayloadSchema = z.object({
  calendarId: z.string().min(1),
})

/**
 * Generic CUD payload used by the adapter/DSL bridge.
 *
 * ELI5:
 * This lets routes and tools say:
 * - which table export they want (`tableKey`)
 * - which write operation (`create` / `update` / `delete`)
 * - what row data they want to write
 *
 * It gives us one reusable action-core bridge for long-tail domains while we
 * keep adding richer per-domain typed adapters.
 */
const genericCrudPayloadSchema = z
  .object({
    tableKey: z.string().min(1).max(120),
    operation: z.enum(['create', 'update', 'delete']).optional(),
    id: z.string().optional(),
    data: z.record(z.unknown()).optional(),
    patch: z.record(z.unknown()).optional(),
    subjectType: z.string().min(1).max(80).optional(),
    subjectId: z.string().min(1).max(140).optional(),
    displayName: z.string().min(1).max(255).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .superRefine((input, ctx) => {
    const operation = input.operation
    if (operation === 'create' && !input.data) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['data'],
        message: 'data is required for create operation.',
      })
    }
    if (operation === 'update') {
      if (!input.id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['id'],
          message: 'id is required for update operation.',
        })
      }
      if (!input.patch) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['patch'],
          message: 'patch is required for update operation.',
        })
      }
    }
    if (operation === 'delete' && !input.id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['id'],
        message: 'id is required for delete operation.',
      })
    }
  })

type CrudOperation = 'create' | 'update' | 'delete'

function resolveCrudOperation(actionKey: string, payloadOperation: string | undefined): CrudOperation {
  if (payloadOperation === 'create' || payloadOperation === 'update' || payloadOperation === 'delete') {
    return payloadOperation
  }
  const inferred = actionKey.match(/^crud\.(create|update|delete)(?:\.|$)/)?.[1]
  if (inferred === 'create' || inferred === 'update' || inferred === 'delete') {
    return inferred
  }
  throw {
    family: 'validation',
    code: 'CRUD_OPERATION_REQUIRED',
    message:
      'CRUD operation is required. Provide payload.operation or use action keys like crud.create / crud.update / crud.delete.',
    retryable: false,
  }
}

function resolveCrudTable(tableKey: string) {
  const aliasMap: Record<string, string> = {
    entitlementMemberships: 'memberships',
  }
  const resolvedTableKey = aliasMap[tableKey] ?? tableKey
  const raw = (dbPackage as Record<string, unknown>)[resolvedTableKey]
  if (!raw || typeof raw !== 'object') {
    throw {
      family: 'validation',
      code: 'CRUD_TABLE_KEY_NOT_FOUND',
      message: `Table export key '${tableKey}' was not found in @bizing/db exports.`,
      retryable: false,
    }
  }
  const table = raw as Record<string, unknown>
  if (!('id' in table)) {
    throw {
      family: 'validation',
      code: 'CRUD_TABLE_MISSING_ID_COLUMN',
      message: `Table '${tableKey}' does not expose an 'id' column; generic CRUD adapter cannot target it safely.`,
      retryable: false,
    }
  }
  return table as Record<string, any>
}

function defaultSubjectTypeFromTableKey(tableKey: string) {
  return tableKey
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/__+/g, '_')
    .toLowerCase()
}

export type CanonicalActionInput = z.infer<typeof canonicalActionBodySchema>

type CanonicalSubjectDescriptor = {
  subjectType: string
  subjectId: string
  displayName: string
  category: string
}

type CanonicalEventDescriptor = {
  eventKey: string
  eventFamily: string
  summary: string
  payload: Record<string, unknown>
}

function asLifecycleStatus(
  status: string | null | undefined,
): 'draft' | 'active' | 'inactive' | 'archived' {
  if (status === 'published' || status === 'active') return 'active'
  if (status === 'inactive' || status === 'superseded') return 'inactive'
  if (status === 'archived' || status === 'retired') return 'archived'
  return 'draft'
}

/**
 * Guarantees that every service product has one canonical commercial root.
 *
 * ELI5:
 * `service_products` tells us how the time-based thing behaves.
 * `sellables` gives the same thing one shared commercial identity so pricing,
 * reporting, checkout, debugging, and future plugins all point to the same
 * stable id.
 */
export async function ensureCanonicalSellableForServiceProduct(input: {
  bizId: string
  serviceProductId: string
  name: string
  slug: string
  currency: string
  status: string | null | undefined
  actionRequestId?: string | null
}) {
  const existingBridge = await db.query.sellableServiceProducts.findFirst({
    where: and(
      eq(sellableServiceProducts.bizId, input.bizId),
      eq(sellableServiceProducts.serviceProductId, input.serviceProductId),
    ),
  })

  if (existingBridge) {
    const [updated] = await db
      .update(sellables)
      .set({
        displayName: input.name,
        slug: input.slug,
        currency: input.currency,
        status: asLifecycleStatus(input.status),
        actionRequestId: input.actionRequestId ?? undefined,
      })
      .where(and(eq(sellables.bizId, input.bizId), eq(sellables.id, existingBridge.sellableId)))
      .returning()
    return updated ?? null
  }

  const [sellable] = await db
    .insert(sellables)
    .values({
      bizId: input.bizId,
      kind: 'service_product',
      displayName: input.name,
      slug: input.slug,
      currency: input.currency,
      status: asLifecycleStatus(input.status),
      actionRequestId: input.actionRequestId ?? null,
    })
    .returning()

  await db.insert(sellableServiceProducts).values({
    bizId: input.bizId,
    sellableId: sellable.id,
    serviceProductId: input.serviceProductId,
  })

  return sellable
}

/**
 * Guarantees that every offer version has one canonical commercial root.
 *
 * ELI5:
 * An offer version is the frozen recipe customers actually buy against. This
 * helper makes that version discoverable through the shared `sellables` root
 * so the API can answer "what commercial thing is this?" without special
 * casing offer versions forever.
 */
export async function ensureCanonicalSellableForOfferVersion(input: {
  bizId: string
  offerVersionId: string
  displayName: string
  slug: string
  currency: string
  status: string | null | undefined
  actionRequestId?: string | null
}) {
  const existingBridge = await db.query.sellableOfferVersions.findFirst({
    where: and(
      eq(sellableOfferVersions.bizId, input.bizId),
      eq(sellableOfferVersions.offerVersionId, input.offerVersionId),
    ),
  })

  if (existingBridge) {
    const [updated] = await db
      .update(sellables)
      .set({
        displayName: input.displayName,
        slug: input.slug,
        currency: input.currency,
        status: asLifecycleStatus(input.status),
        actionRequestId: input.actionRequestId ?? undefined,
      })
      .where(and(eq(sellables.bizId, input.bizId), eq(sellables.id, existingBridge.sellableId)))
      .returning()
    return updated ?? null
  }

  const [sellable] = await db
    .insert(sellables)
    .values({
      bizId: input.bizId,
      kind: 'offer_version',
      displayName: input.displayName,
      slug: input.slug,
      currency: input.currency,
      status: asLifecycleStatus(input.status),
      actionRequestId: input.actionRequestId ?? null,
    })
    .returning()

  await db.insert(sellableOfferVersions).values({
    bizId: input.bizId,
    sellableId: sellable.id,
    offerVersionId: input.offerVersionId,
  })

  return sellable
}

type ActionPreviewResult = {
  summary: string
  effectSummary: Record<string, unknown>
  normalizedPayload: Record<string, unknown>
}

type ActionExecuteResult = ActionPreviewResult & {
  outputPayload: Record<string, unknown>
  subject: CanonicalSubjectDescriptor
  event: CanonicalEventDescriptor
}

type ActionContext = {
  bizId: string
  user: CurrentUser
  authSource: AuthSource | undefined
  authCredentialId?: string
  requestId?: string
  accessMode: 'biz' | 'public'
}

type ActionRuntimeResult = {
  reused: boolean
  httpStatus: number
  actionRequest: unknown
  latestExecution: unknown
  failure?: unknown
  domainEvent?: unknown
  projectionDocument?: unknown
}

function stableNormalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stableNormalize(entry))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, inner]) => [key, stableNormalize(inner)]),
    )
  }
  return value
}

function hashPayload(value: unknown) {
  return crypto.createHash('sha256').update(JSON.stringify(stableNormalize(value))).digest('hex')
}

function computeBookingTotal(input: {
  subtotalMinor: number
  taxMinor: number
  feeMinor: number
  discountMinor: number
}) {
  return input.subtotalMinor + input.taxMinor + input.feeMinor - input.discountMinor
}

function normalizeBizId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function looksLikeTemporalString(value: string): boolean {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
  }
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value))
}

/**
 * Coerce timestamp-like string payload values into Date objects.
 *
 * ELI5:
 * Generic CRUD payloads often come from JSON or sanitize passes where dates are
 * plain strings. Drizzle timestamp columns expect Date objects in this runtime.
 * This helper keeps generic CRUD writes resilient by converting obvious
 * timestamp fields before insert/update.
 */
function coerceTemporalPayload(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    if (
      typeof value === 'string' &&
      /(At|Date|Timestamp|From|To|For|Until|Since|Start|End|On|Source)$/i.test(key) &&
      looksLikeTemporalString(value)
    ) {
      out[key] = new Date(value)
      continue
    }
    out[key] = value
  }
  return out
}

function payloadTypeSummary(record: Record<string, unknown>) {
  const summary: Record<string, string> = {}
  for (const [key, value] of Object.entries(record)) {
    if (value instanceof Date) {
      summary[key] = 'Date'
      continue
    }
    if (Array.isArray(value)) {
      summary[key] = 'array'
      continue
    }
    summary[key] = value === null ? 'null' : typeof value
  }
  return summary
}

/**
 * Resolve the tenant id that should own success artifacts for an action.
 *
 * ELI5:
 * - Most actions already know their biz id up front.
 * - Some bootstrap actions (like creating a biz) do not.
 * - For those, we infer the biz id from the action result so canonical
 *   subjects/events/projections can still be recorded under the right tenant.
 */
function resolveEffectiveActionBizId(
  explicitBizId: string | null | undefined,
  input: CanonicalActionInput,
  result: ActionExecuteResult,
): string | null {
  const direct = normalizeBizId(explicitBizId)
  if (direct) return direct

  const payload = (input.payload ?? {}) as Record<string, unknown>
  const output = (result.outputPayload ?? {}) as Record<string, unknown>
  const row =
    output.row && typeof output.row === 'object' ? (output.row as Record<string, unknown>) : null

  const rowBizId = normalizeBizId(row?.bizId)
  if (rowBizId) return rowBizId

  const outputBizId = normalizeBizId(output.bizId)
  if (outputBizId) return outputBizId

  const isBizCrudCreate =
    input.actionKey.startsWith('crud.') &&
    payload.tableKey === 'bizes' &&
    (payload.operation === 'create' || input.actionKey === 'crud.create')

  if (isBizCrudCreate) {
    const createdBizId = normalizeBizId(row?.id ?? output.id ?? result.subject.subjectId)
    if (createdBizId) return createdBizId
  }

  const subjectBizId =
    result.subject.subjectType === 'biz' || result.subject.subjectType === 'bizes'
      ? normalizeBizId(result.subject.subjectId)
      : null
  if (subjectBizId) return subjectBizId

  return null
}

/**
 * Maps canonical business actions to the permission that actually governs them.
 *
 * ELI5:
 * `actions.execute` only says "this caller may use the action API".
 * This function answers the second question:
 * "may they execute this specific business action?"
 */
export function permissionForActionKey(actionKey: string) {
  if (actionKey.startsWith('crud.')) {
    return 'actions.execute'
  }
  switch (actionKey) {
    case 'booking.create':
      return 'booking_orders.create'
    case 'booking.cancel':
      return 'booking_orders.cancel'
    case 'offer.create':
      return 'offers.create'
    case 'offer.update':
      return 'offers.update'
    case 'offer.archive':
      return 'offers.archive'
    case 'offer.publish':
      return 'offers.update'
    case 'service_group.create':
      return 'services.create'
    case 'service_group.update':
      return 'services.update'
    case 'service_group.archive':
      return 'services.archive'
    case 'service.create':
      return 'services.create'
    case 'service.update':
      return 'services.update'
    case 'service.archive':
      return 'services.archive'
    case 'resource.create':
      return 'resources.create'
    case 'resource.update':
      return 'resources.update'
    case 'resource.delete':
      return 'resources.archive'
    case 'service_product.create':
      return 'service_products.create'
    case 'service_product.update':
      return 'service_products.update'
    case 'service_product.archive':
      return 'service_products.archive'
    case 'service_product.publish':
      return 'service_products.update'
    case 'member.offboard':
      return 'members.manage'
    case 'calendar.create':
      return 'calendars.write'
    case 'calendar.update':
      return 'calendars.write'
    case 'calendar.archive':
      return 'calendars.write'
    case 'calendar.block':
      return 'calendars.write'
    default:
      return null
  }
}

/**
 * Public action allowlist.
 *
 * ELI5:
 * Some actions are safe to expose to customer-facing/public surfaces.
 * Most are not. This allowlist is the explicit gate.
 */
export function isPublicActionKey(actionKey: string) {
  if (actionKey.startsWith('crud.')) return false
  return actionKey === 'booking.create'
}

function actorTypeFromAuthSource(authSource: AuthSource | undefined) {
  switch (authSource) {
    case 'api_key':
      return 'api_key'
    case 'access_token':
      return 'integration'
    default:
      return 'user'
  }
}

function actorRefFromContext(context: ActionContext) {
  if (context.authCredentialId) return context.authCredentialId
  return context.user.id
}

function actorNamespaceFromContext(context: ActionContext) {
  const source = context.authSource ?? 'session'
  const identity = context.authCredentialId ?? context.user.id
  return `${source}:${identity}`
}

async function loadIdempotentReplay(params: {
  bizId: string
  actionKey: string
  actorNamespace: string
  idempotencyKey: string
  requestHash: string
  executor?: ActionDbExecutor
}) {
  const executor = params.executor ?? db
  const existing = await executor.query.actionIdempotencyKeys.findFirst({
    where: and(
      eq(actionIdempotencyKeys.bizId, params.bizId),
      eq(actionIdempotencyKeys.actionKey, params.actionKey),
      eq(actionIdempotencyKeys.actorNamespace, params.actorNamespace),
      eq(actionIdempotencyKeys.idempotencyKey, params.idempotencyKey),
    ),
  })
  if (!existing) return null
  if (existing.requestHash !== params.requestHash) {
    return { type: 'hash_mismatch' as const, existing }
  }
  const actionRequest = await executor.query.actionRequests.findFirst({
    where: eq(actionRequests.id, existing.actionRequestId),
  })
  const latestExecution = await executor.query.actionExecutions.findFirst({
    where: eq(actionExecutions.actionRequestId, existing.actionRequestId),
    orderBy: desc(actionExecutions.startedAt),
  })
  const failure = await executor.query.actionFailures.findFirst({
    where: eq(actionFailures.actionRequestId, existing.actionRequestId),
    orderBy: desc(actionFailures.failedAt),
  })
  const domainEvent = await executor.query.domainEvents.findFirst({
    where: eq(domainEvents.actionRequestId, existing.actionRequestId),
    orderBy: desc(domainEvents.occurredAt),
  })
  return { type: 'replay' as const, actionRequest, latestExecution, failure, domainEvent }
}

async function resolveRecipientEmail(userId: string | null | undefined, fallbackEmail: string | undefined) {
  if (!userId) return fallbackEmail ?? `user-unknown@local.invalid`
  const userRow = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { email: true },
  })
  return userRow?.email ?? fallbackEmail ?? `user-${userId}@local.invalid`
}

async function ensureSubjectRegistered(params: {
  bizId: string
  subject: CanonicalSubjectDescriptor
  metadata?: Record<string, unknown>
  executor?: ActionDbExecutor
}) {
  const executor = params.executor ?? db
  const where = and(
    eq(subjects.bizId, params.bizId),
    eq(subjects.subjectType, params.subject.subjectType),
    eq(subjects.subjectId, params.subject.subjectId),
  )
  let row = await executor.query.subjects.findFirst({ where })
  if (row) return row

  await executor
    .insert(subjects)
    .values({
      bizId: params.bizId,
      subjectType: params.subject.subjectType,
      subjectId: params.subject.subjectId,
      displayName: params.subject.displayName,
      category: params.subject.category,
      status: 'active',
      isLinkable: true,
      metadata: sanitizeUnknown({
        source: 'canonical-actions',
        ...(params.metadata ?? {}),
      }),
    })
    .onConflictDoNothing()

  row = await executor.query.subjects.findFirst({ where })
  if (!row) {
    throw {
      family: 'internal',
      code: 'SUBJECT_REGISTRATION_FAILED',
      message: 'Action succeeded but canonical subject registration failed.',
      retryable: true,
    }
  }
  return row
}

async function ensureActionProjection(bizId: string, executor: ActionDbExecutor = db) {
  let projection = await executor.query.projections.findFirst({
    where: and(eq(projections.bizId, bizId), eq(projections.projectionKey, 'action_activity')),
  })
  if (projection) return projection

  await executor
    .insert(projections)
    .values({
      bizId,
      projectionKey: 'action_activity',
      projectionFamily: 'actions',
      status: 'active',
      freshnessPolicy: {
        mode: 'inline_write',
        owner: 'canonical-action-runtime',
      },
      metadata: {
        description: 'Action activity projection generated inline by the canonical action runtime.',
      },
    })
    .onConflictDoNothing()

  projection = await executor.query.projections.findFirst({
    where: and(eq(projections.bizId, bizId), eq(projections.projectionKey, 'action_activity')),
  })
  if (!projection) {
    throw {
      family: 'internal',
      code: 'PROJECTION_REGISTRATION_FAILED',
      message: 'Action succeeded but projection registration failed.',
      retryable: true,
    }
  }
  return projection
}

async function recordSuccessArtifacts(params: {
  bizId: string
  actionRequestId: string
  actionExecutionId: string
  input: CanonicalActionInput
  result: ActionExecuteResult
  context: ActionContext
  executor?: ActionDbExecutor
}) {
  const executor = params.executor ?? db
  const subject = await ensureSubjectRegistered({
    bizId: params.bizId,
    subject: params.result.subject,
    metadata: {
      actionRequestId: params.actionRequestId,
      actionKey: params.input.actionKey,
    },
    executor,
  })

  const [domainEvent] = await executor
    .insert(domainEvents)
    .values({
      bizId: params.bizId,
      eventKey: params.result.event.eventKey,
      eventFamily: params.result.event.eventFamily,
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      actionRequestId: params.actionRequestId,
      actionExecutionId: params.actionExecutionId,
      correlationId: params.context.requestId ?? params.actionRequestId,
      actorType: actorTypeFromAuthSource(params.context.authSource),
      actorUserId: params.context.user.id,
      actorRef: actorRefFromContext(params.context),
      payload: sanitizeUnknown(params.result.event.payload),
      summary: params.result.event.summary,
      metadata: sanitizeUnknown({
        accessMode: params.context.accessMode,
        sourceInstallationRef: params.input.sourceInstallationRef ?? null,
      }),
    })
    .returning()

  const projection = await ensureActionProjection(params.bizId, executor)
  await executor
    .insert(projectionDocuments)
    .values({
      bizId: params.bizId,
      projectionId: projection.id,
      documentKey: `action_request:${params.actionRequestId}`,
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      status: 'current',
      versionNumber: 1,
      renderedData: sanitizeUnknown({
        actionKey: params.input.actionKey,
        actionFamily: params.input.actionFamily,
        actionRequestId: params.actionRequestId,
        actionExecutionId: params.actionExecutionId,
        subject: params.result.subject,
        event: {
          id: domainEvent.id,
          key: domainEvent.eventKey,
          family: domainEvent.eventFamily,
          summary: domainEvent.summary,
          occurredAt: domainEvent.occurredAt,
        },
        resultSummary: params.result.summary,
        outputPayload: params.result.outputPayload,
      }),
      metadata: sanitizeUnknown({
        actionRequestId: params.actionRequestId,
        actionExecutionId: params.actionExecutionId,
        eventId: domainEvent.id,
      }),
    })
    .onConflictDoNothing()

  const projectionDocument = await executor.query.projectionDocuments.findFirst({
    where: and(
      eq(projectionDocuments.projectionId, projection.id),
      eq(projectionDocuments.documentKey, `action_request:${params.actionRequestId}`),
    ),
  })

  return { domainEvent, projectionDocument }
}

async function previewBookingCreate(context: ActionContext, payload: Record<string, unknown>): Promise<ActionPreviewResult> {
  const parsed = bookingCreatePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_BOOKING_CREATE_PAYLOAD',
      message: 'Payload does not match booking.create contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }

  const [offer, offerVersion] = await Promise.all([
    db.query.offers.findFirst({
      where: and(eq(offers.bizId, context.bizId), eq(offers.id, parsed.data.offerId)),
    }),
    db.query.offerVersions.findFirst({
      where: and(
        eq(offerVersions.bizId, context.bizId),
        eq(offerVersions.id, parsed.data.offerVersionId),
      ),
    }),
  ])

  if (!offer) {
    throw {
      family: 'validation',
      code: 'OFFER_NOT_FOUND',
      message: 'The requested offer does not exist in this biz.',
      retryable: false,
    }
  }
  if (!offerVersion) {
    throw {
      family: 'validation',
      code: 'OFFER_VERSION_NOT_FOUND',
      message: 'The requested offer version does not exist in this biz.',
      retryable: false,
    }
  }
  if (context.accessMode === 'public') {
    if (!offer.isPublished || offer.status !== 'active') {
      throw {
        family: 'validation',
        code: 'NOT_BOOKABLE',
        message: 'Offer is not publicly bookable.',
        retryable: false,
      }
    }
    if (offerVersion.status !== 'published') {
      throw {
        family: 'validation',
        code: 'NOT_BOOKABLE',
        message: 'Offer version is not published.',
        retryable: false,
      }
    }
  }

  const totalMinor =
    parsed.data.totalMinor ??
    computeBookingTotal({
      subtotalMinor: parsed.data.subtotalMinor,
      taxMinor: parsed.data.taxMinor,
      feeMinor: parsed.data.feeMinor,
      discountMinor: parsed.data.discountMinor,
    })

  return {
    summary: `Preview booking.create for offer ${offer.id}.`,
    normalizedPayload: {
      ...parsed.data,
      totalMinor,
      customerUserId: parsed.data.customerUserId ?? context.user.id,
    },
    effectSummary: {
      willCreate: 'booking_order',
      offerId: offer.id,
      offerVersionId: offerVersion.id,
      computedTotalMinor: totalMinor,
      requestedWindow: {
        requestedStartAt: parsed.data.requestedStartAt ?? null,
        requestedEndAt: parsed.data.requestedEndAt ?? null,
      },
      accessMode: context.accessMode,
    },
  }
}

async function executeBookingCreate(
  context: ActionContext,
  actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewBookingCreate(context, payload)
  const normalized = bookingCreatePayloadSchema.parse(preview.normalizedPayload)

  const [created] = await db
    .insert(bookingOrders)
    .values({
      bizId: context.bizId,
      offerId: normalized.offerId,
      offerVersionId: normalized.offerVersionId,
      customerUserId: normalized.customerUserId ?? context.user.id,
      customerGroupAccountId: normalized.customerGroupAccountId,
      status: normalized.status,
      currency: normalized.currency,
      subtotalMinor: normalized.subtotalMinor,
      taxMinor: normalized.taxMinor,
      feeMinor: normalized.feeMinor,
      discountMinor: normalized.discountMinor,
      totalMinor: normalized.totalMinor ?? computeBookingTotal(normalized),
      requestedStartAt: normalized.requestedStartAt ? new Date(normalized.requestedStartAt) : null,
      requestedEndAt: normalized.requestedEndAt ? new Date(normalized.requestedEndAt) : null,
      confirmedStartAt: normalized.confirmedStartAt ? new Date(normalized.confirmedStartAt) : null,
      confirmedEndAt: normalized.confirmedEndAt ? new Date(normalized.confirmedEndAt) : null,
      actionRequestId,
      pricingSnapshot: sanitizeUnknown(normalized.pricingSnapshot ?? {}),
      policySnapshot: sanitizeUnknown(normalized.policySnapshot ?? {}),
      metadata: sanitizeUnknown(normalized.metadata ?? {}),
    })
    .returning()

  const recipientUserId = normalized.customerUserId ?? context.user.id
  const recipientRef = await resolveRecipientEmail(recipientUserId, context.user.email)
  await createBookingLifecycleMessage({
    bizId: context.bizId,
    recipientUserId,
    recipientRef,
    bookingOrderId: created.id,
    subject: 'Booking confirmed',
    body: `Your booking ${created.id} is confirmed.`,
    templateSlug: 'booking-confirmed',
    eventType: 'booking.confirmed',
  })

  return {
    ...preview,
    outputPayload: {
      bookingOrderId: created.id,
      status: created.status,
      totalMinor: created.totalMinor,
    },
    subject: {
      subjectType: 'booking_order',
      subjectId: created.id,
      displayName: `Booking ${created.id}`,
      category: 'booking_order',
    },
    event: {
      eventKey: 'booking.created',
      eventFamily: 'booking',
      summary: `Booking ${created.id} was created.`,
      payload: {
        bookingOrderId: created.id,
        offerId: created.offerId,
        offerVersionId: created.offerVersionId,
        status: created.status,
        totalMinor: created.totalMinor,
      },
    },
  }
}

async function previewBookingCancel(context: ActionContext, payload: Record<string, unknown>): Promise<ActionPreviewResult> {
  const parsed = bookingCancelPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_BOOKING_CANCEL_PAYLOAD',
      message: 'Payload does not match booking.cancel contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }

  const booking = await db.query.bookingOrders.findFirst({
    where: and(eq(bookingOrders.bizId, context.bizId), eq(bookingOrders.id, parsed.data.bookingOrderId)),
  })
  if (!booking) {
    throw {
      family: 'validation',
      code: 'BOOKING_NOT_FOUND',
      message: 'The booking to cancel does not exist in this biz.',
      retryable: false,
    }
  }

  return {
    summary: `Preview booking.cancel for booking ${booking.id}.`,
    normalizedPayload: parsed.data,
    effectSummary: {
      willUpdate: 'booking_order',
      bookingOrderId: booking.id,
      nextStatus: 'cancelled',
      currentStatus: booking.status,
      reason: parsed.data.reason ?? null,
    },
  }
}

async function executeBookingCancel(
  context: ActionContext,
  actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewBookingCancel(context, payload)
  const normalized = bookingCancelPayloadSchema.parse(preview.normalizedPayload)
  const existing = await db.query.bookingOrders.findFirst({
    where: and(eq(bookingOrders.bizId, context.bizId), eq(bookingOrders.id, normalized.bookingOrderId)),
  })
  if (!existing) {
    throw {
      family: 'validation',
      code: 'BOOKING_NOT_FOUND',
      message: 'The booking to cancel does not exist in this biz.',
      retryable: false,
    }
  }

  const nextMetadata = sanitizeUnknown({
    ...(existing.metadata && typeof existing.metadata === 'object' ? (existing.metadata as Record<string, unknown>) : {}),
    cancellationReason: normalized.reason ?? null,
  })

  const [updated] = await db
    .update(bookingOrders)
    .set({
      status: 'cancelled',
      actionRequestId,
      metadata: nextMetadata,
    })
    .where(and(eq(bookingOrders.bizId, context.bizId), eq(bookingOrders.id, existing.id)))
    .returning()

  const recipientRef = await resolveRecipientEmail(existing.customerUserId ?? null, context.user.email)
  await createBookingLifecycleMessage({
    bizId: context.bizId,
    recipientUserId: existing.customerUserId ?? null,
    recipientRef,
    bookingOrderId: updated.id,
    subject: 'Booking cancelled',
    body: `Your booking ${updated.id} has been cancelled.`,
    templateSlug: 'booking-cancelled',
    eventType: 'booking.cancelled',
  })

  return {
    ...preview,
    outputPayload: {
      bookingOrderId: updated.id,
      status: updated.status,
      cancellationReason: normalized.reason ?? null,
    },
    subject: {
      subjectType: 'booking_order',
      subjectId: updated.id,
      displayName: `Booking ${updated.id}`,
      category: 'booking_order',
    },
    event: {
      eventKey: 'booking.cancelled',
      eventFamily: 'booking',
      summary: `Booking ${updated.id} was cancelled.`,
      payload: {
        bookingOrderId: updated.id,
        status: updated.status,
        cancellationReason: normalized.reason ?? null,
      },
    },
  }
}

async function previewOfferPublish(context: ActionContext, payload: Record<string, unknown>): Promise<ActionPreviewResult> {
  const parsed = offerPublishPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_OFFER_PUBLISH_PAYLOAD',
      message: 'Payload does not match offer.publish contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }

  const offer = await db.query.offers.findFirst({
    where: and(eq(offers.bizId, context.bizId), eq(offers.id, parsed.data.offerId)),
  })
  if (!offer) {
    throw {
      family: 'validation',
      code: 'OFFER_NOT_FOUND',
      message: 'The offer to publish does not exist in this biz.',
      retryable: false,
    }
  }

  const version = parsed.data.offerVersionId
    ? await db.query.offerVersions.findFirst({
        where: and(
          eq(offerVersions.bizId, context.bizId),
          eq(offerVersions.offerId, offer.id),
          eq(offerVersions.id, parsed.data.offerVersionId),
        ),
      })
    : null

  if (parsed.data.offerVersionId && !version) {
    throw {
      family: 'validation',
      code: 'OFFER_VERSION_NOT_FOUND',
      message: 'The selected offer version does not exist for this offer.',
      retryable: false,
    }
  }

  return {
    summary: `Preview offer.publish for offer ${offer.id}.`,
    normalizedPayload: parsed.data,
    effectSummary: {
      willUpdate: 'offer',
      offerId: offer.id,
      nextOfferStatus: parsed.data.offerStatus ?? 'active',
      nextIsPublished: parsed.data.publishOffer ?? true,
      offerVersionId: version?.id ?? null,
      nextOfferVersionStatus: version ? parsed.data.offerVersionStatus ?? 'published' : null,
    },
  }
}

async function executeOfferPublish(
  context: ActionContext,
  actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewOfferPublish(context, payload)
  const normalized = offerPublishPayloadSchema.parse(preview.normalizedPayload)

  const [updatedOffer] = await db
    .update(offers)
    .set({
      status: normalized.offerStatus ?? 'active',
      isPublished: normalized.publishOffer ?? true,
      actionRequestId,
    })
    .where(and(eq(offers.bizId, context.bizId), eq(offers.id, normalized.offerId)))
    .returning()

  let updatedVersion: { id: string; status: string } | null = null
  if (normalized.offerVersionId) {
    ;[updatedVersion] = await db
      .update(offerVersions)
      .set({
        status: normalized.offerVersionStatus ?? 'published',
        actionRequestId,
      })
      .where(
        and(
          eq(offerVersions.bizId, context.bizId),
          eq(offerVersions.offerId, normalized.offerId),
          eq(offerVersions.id, normalized.offerVersionId),
        ),
      )
      .returning({ id: offerVersions.id, status: offerVersions.status })
  }

  return {
    ...preview,
    outputPayload: {
      offerId: updatedOffer.id,
      isPublished: updatedOffer.isPublished,
      status: updatedOffer.status,
      offerVersionId: updatedVersion?.id ?? null,
      offerVersionStatus: updatedVersion?.status ?? null,
    },
    subject: {
      subjectType: 'offer',
      subjectId: updatedOffer.id,
      displayName: (updatedOffer as { name?: string | null }).name ?? `Offer ${updatedOffer.id}`,
      category: 'offer',
    },
    event: {
      eventKey: 'offer.published',
      eventFamily: 'offer',
      summary: `Offer ${updatedOffer.id} was published.`,
      payload: {
        offerId: updatedOffer.id,
        status: updatedOffer.status,
        isPublished: updatedOffer.isPublished,
        offerVersionId: updatedVersion?.id ?? null,
      },
    },
  }
}

async function previewResourceCreate(
  _context: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionPreviewResult> {
  const parsed = resourceCreatePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_RESOURCE_CREATE_PAYLOAD',
      message: 'Payload does not match resource.create contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }

  return {
    summary: `Preview resource.create for ${parsed.data.type} ${parsed.data.slug}.`,
    normalizedPayload: parsed.data,
    effectSummary: {
      willCreate: 'resource',
      resourceType: parsed.data.type,
      slug: parsed.data.slug,
      locationId: parsed.data.locationId,
    },
  }
}

async function executeResourceCreate(
  context: ActionContext,
  _actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewResourceCreate(context, payload)
  const normalized = resourceCreatePayloadSchema.parse(preview.normalizedPayload)

  const [created] = await db
    .insert(resources)
    .values({
      bizId: context.bizId,
      locationId: normalized.locationId,
      type: normalized.type,
      name: sanitizePlainText(normalized.name),
      slug: normalized.slug,
      description: normalized.description ? sanitizePlainText(normalized.description) : undefined,
      timezone: normalized.timezone,
      statusDefinitionId: normalized.statusDefinitionId,
      hostUserId: normalized.hostUserId,
      groupAccountId: normalized.groupAccountId,
      assetId: normalized.assetId,
      venueId: normalized.venueId,
      capacity: normalized.capacity,
      allowSimultaneousBookings: normalized.allowSimultaneousBookings,
      maxSimultaneousBookings: normalized.maxSimultaneousBookings,
      bufferBeforeMinutes: normalized.bufferBeforeMinutes,
      bufferAfterMinutes: normalized.bufferAfterMinutes,
      metadata: sanitizeUnknown(normalized.metadata ?? {}),
    })
    .returning()

  return {
    ...preview,
    outputPayload: {
      resourceId: created.id,
      type: created.type,
      slug: created.slug,
    },
    subject: {
      subjectType: 'resource',
      subjectId: created.id,
      displayName: created.name,
      category: 'resource',
    },
    event: {
      eventKey: 'resource.created',
      eventFamily: 'resource',
      summary: `Resource ${created.id} was created.`,
      payload: {
        resourceId: created.id,
        type: created.type,
        locationId: created.locationId,
        slug: created.slug,
      },
    },
  }
}

async function previewResourceUpdate(
  context: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionPreviewResult> {
  const parsed = resourceUpdatePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_RESOURCE_UPDATE_PAYLOAD',
      message: 'Payload does not match resource.update contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }

  const existing = await db.query.resources.findFirst({
    where: and(eq(resources.bizId, context.bizId), eq(resources.id, parsed.data.resourceId)),
  })
  if (!existing) {
    throw {
      family: 'validation',
      code: 'RESOURCE_NOT_FOUND',
      message: 'The resource does not exist in this biz.',
      retryable: false,
    }
  }

  return {
    summary: `Preview resource.update for resource ${existing.id}.`,
    normalizedPayload: parsed.data,
    effectSummary: {
      willUpdate: 'resource',
      resourceId: existing.id,
      changedFields: Object.keys(parsed.data).filter((key) => key !== 'resourceId'),
    },
  }
}

async function executeResourceUpdate(
  context: ActionContext,
  _actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewResourceUpdate(context, payload)
  const normalized = resourceUpdatePayloadSchema.parse(preview.normalizedPayload)

  const [updated] = await db
    .update(resources)
    .set({
      locationId: normalized.locationId,
      name: normalized.name ? sanitizePlainText(normalized.name) : undefined,
      slug: normalized.slug,
      description: normalized.description ? sanitizePlainText(normalized.description) : undefined,
      timezone: normalized.timezone,
      statusDefinitionId: normalized.statusDefinitionId,
      hostUserId: normalized.hostUserId,
      groupAccountId: normalized.groupAccountId,
      assetId: normalized.assetId,
      venueId: normalized.venueId,
      capacity: normalized.capacity,
      allowSimultaneousBookings: normalized.allowSimultaneousBookings,
      maxSimultaneousBookings: normalized.maxSimultaneousBookings,
      bufferBeforeMinutes: normalized.bufferBeforeMinutes,
      bufferAfterMinutes: normalized.bufferAfterMinutes,
      metadata: normalized.metadata ? sanitizeUnknown(normalized.metadata) : undefined,
    })
    .where(and(eq(resources.bizId, context.bizId), eq(resources.id, normalized.resourceId)))
    .returning()

  return {
    ...preview,
    outputPayload: {
      resourceId: updated.id,
      type: updated.type,
      slug: updated.slug,
    },
    subject: {
      subjectType: 'resource',
      subjectId: updated.id,
      displayName: updated.name,
      category: 'resource',
    },
    event: {
      eventKey: 'resource.updated',
      eventFamily: 'resource',
      summary: `Resource ${updated.id} was updated.`,
      payload: {
        resourceId: updated.id,
        type: updated.type,
        slug: updated.slug,
      },
    },
  }
}

async function previewResourceDelete(
  context: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionPreviewResult> {
  const parsed = resourceDeletePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_RESOURCE_DELETE_PAYLOAD',
      message: 'Payload does not match resource.delete contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }

  const existing = await db.query.resources.findFirst({
    where: and(eq(resources.bizId, context.bizId), eq(resources.id, parsed.data.resourceId)),
  })
  if (!existing) {
    throw {
      family: 'validation',
      code: 'RESOURCE_NOT_FOUND',
      message: 'The resource does not exist in this biz.',
      retryable: false,
    }
  }

  return {
    summary: `Preview resource.delete for resource ${existing.id}.`,
    normalizedPayload: parsed.data,
    effectSummary: {
      willDelete: 'resource',
      resourceId: existing.id,
      type: existing.type,
    },
  }
}

async function executeResourceDelete(
  context: ActionContext,
  _actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewResourceDelete(context, payload)
  const normalized = resourceDeletePayloadSchema.parse(preview.normalizedPayload)

  const [removed] = await db
    .delete(resources)
    .where(and(eq(resources.bizId, context.bizId), eq(resources.id, normalized.resourceId)))
    .returning()

  if (!removed) {
    throw {
      family: 'validation',
      code: 'RESOURCE_NOT_FOUND',
      message: 'The resource does not exist in this biz.',
      retryable: false,
    }
  }

  return {
    ...preview,
    outputPayload: {
      resourceId: removed.id,
      deleted: true,
      type: removed.type,
    },
    subject: {
      subjectType: 'resource',
      subjectId: removed.id,
      displayName: removed.name,
      category: 'resource',
    },
    event: {
      eventKey: 'resource.deleted',
      eventFamily: 'resource',
      summary: `Resource ${removed.id} was deleted.`,
      payload: {
        resourceId: removed.id,
        type: removed.type,
      },
    },
  }
}

async function previewOfferCreate(
  _context: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionPreviewResult> {
  const parsed = offerCreatePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_OFFER_CREATE_PAYLOAD',
      message: 'Payload does not match offer.create contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }
  return {
    summary: `Preview offer.create for ${parsed.data.slug}.`,
    normalizedPayload: parsed.data,
    effectSummary: {
      willCreate: 'offer',
      slug: parsed.data.slug,
      executionMode: parsed.data.executionMode,
      isPublished: parsed.data.isPublished,
    },
  }
}

async function executeOfferCreate(
  context: ActionContext,
  actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewOfferCreate(context, payload)
  const normalized = offerCreatePayloadSchema.parse(preview.normalizedPayload)
  const [created] = await db
    .insert(offers)
    .values({
      bizId: context.bizId,
      actionRequestId,
      name: normalized.name,
      slug: normalized.slug,
      description: normalized.description,
      executionMode: normalized.executionMode,
      status: normalized.status,
      isPublished: normalized.isPublished,
      timezone: normalized.timezone,
      metadata: sanitizeUnknown(normalized.metadata ?? {}),
    })
    .returning()

  return {
    ...preview,
    outputPayload: {
      offerId: created.id,
      status: created.status,
      isPublished: created.isPublished,
    },
    subject: {
      subjectType: 'offer',
      subjectId: created.id,
      displayName: created.name,
      category: 'offer',
    },
    event: {
      eventKey: 'offer.created',
      eventFamily: 'offer',
      summary: `Offer ${created.id} was created.`,
      payload: {
        offerId: created.id,
        executionMode: created.executionMode,
        status: created.status,
        isPublished: created.isPublished,
      },
    },
  }
}

async function previewOfferUpdate(
  context: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionPreviewResult> {
  const parsed = offerUpdatePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_OFFER_UPDATE_PAYLOAD',
      message: 'Payload does not match offer.update contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }
  const existing = await db.query.offers.findFirst({
    where: and(eq(offers.bizId, context.bizId), eq(offers.id, parsed.data.offerId)),
    columns: { id: true },
  })
  if (!existing) {
    throw {
      family: 'validation',
      code: 'OFFER_NOT_FOUND',
      message: 'The offer does not exist in this biz.',
      retryable: false,
    }
  }
  return {
    summary: `Preview offer.update for ${existing.id}.`,
    normalizedPayload: parsed.data,
    effectSummary: {
      willUpdate: 'offer',
      offerId: existing.id,
      changedFields: Object.keys(parsed.data).filter((key) => key !== 'offerId'),
    },
  }
}

async function executeOfferUpdate(
  context: ActionContext,
  actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewOfferUpdate(context, payload)
  const normalized = offerUpdatePayloadSchema.parse(preview.normalizedPayload)
  const [updated] = await db
    .update(offers)
    .set({
      actionRequestId,
      name: normalized.name,
      slug: normalized.slug,
      description: normalized.description,
      executionMode: normalized.executionMode,
      status: normalized.status,
      isPublished: normalized.isPublished,
      timezone: normalized.timezone,
      metadata: normalized.metadata ? sanitizeUnknown(normalized.metadata) : undefined,
    })
    .where(and(eq(offers.bizId, context.bizId), eq(offers.id, normalized.offerId)))
    .returning()

  return {
    ...preview,
    outputPayload: {
      offerId: updated.id,
      status: updated.status,
      isPublished: updated.isPublished,
    },
    subject: {
      subjectType: 'offer',
      subjectId: updated.id,
      displayName: updated.name,
      category: 'offer',
    },
    event: {
      eventKey: 'offer.updated',
      eventFamily: 'offer',
      summary: `Offer ${updated.id} was updated.`,
      payload: {
        offerId: updated.id,
        status: updated.status,
        isPublished: updated.isPublished,
      },
    },
  }
}

async function previewOfferArchive(
  context: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionPreviewResult> {
  const parsed = offerArchivePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_OFFER_ARCHIVE_PAYLOAD',
      message: 'Payload does not match offer.archive contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }
  const existing = await db.query.offers.findFirst({
    where: and(eq(offers.bizId, context.bizId), eq(offers.id, parsed.data.offerId)),
    columns: { id: true },
  })
  if (!existing) {
    throw {
      family: 'validation',
      code: 'OFFER_NOT_FOUND',
      message: 'The offer does not exist in this biz.',
      retryable: false,
    }
  }
  return {
    summary: `Preview offer.archive for ${existing.id}.`,
    normalizedPayload: parsed.data,
    effectSummary: {
      willUpdate: 'offer',
      offerId: existing.id,
      nextStatus: 'archived',
      nextIsPublished: false,
    },
  }
}

async function executeOfferArchive(
  context: ActionContext,
  actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewOfferArchive(context, payload)
  const normalized = offerArchivePayloadSchema.parse(preview.normalizedPayload)
  const [updated] = await db
    .update(offers)
    .set({
      actionRequestId,
      status: 'archived',
      isPublished: false,
    })
    .where(and(eq(offers.bizId, context.bizId), eq(offers.id, normalized.offerId)))
    .returning()
  return {
    ...preview,
    outputPayload: {
      offerId: updated.id,
      status: updated.status,
      isPublished: updated.isPublished,
    },
    subject: {
      subjectType: 'offer',
      subjectId: updated.id,
      displayName: updated.name,
      category: 'offer',
    },
    event: {
      eventKey: 'offer.archived',
      eventFamily: 'offer',
      summary: `Offer ${updated.id} was archived.`,
      payload: {
        offerId: updated.id,
        status: updated.status,
        isPublished: updated.isPublished,
      },
    },
  }
}

async function previewServiceGroupCreate(
  _context: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionPreviewResult> {
  const parsed = serviceGroupCreatePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_SERVICE_GROUP_CREATE_PAYLOAD',
      message: 'Payload does not match service_group.create contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }
  return {
    summary: `Preview service_group.create for ${parsed.data.slug}.`,
    normalizedPayload: parsed.data,
    effectSummary: {
      willCreate: 'service_group',
      slug: parsed.data.slug,
      status: parsed.data.status,
    },
  }
}

async function executeServiceGroupCreate(
  context: ActionContext,
  _actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewServiceGroupCreate(context, payload)
  const normalized = serviceGroupCreatePayloadSchema.parse(preview.normalizedPayload)
  const [created] = await db
    .insert(serviceGroups)
    .values({
      bizId: context.bizId,
      name: normalized.name,
      slug: normalized.slug,
      description: normalized.description,
      status: normalized.status,
      statusConfigValueId: normalized.statusConfigValueId,
      metadata: sanitizeUnknown(normalized.metadata ?? {}),
    })
    .returning()
  return {
    ...preview,
    outputPayload: {
      serviceGroupId: created.id,
      status: created.status,
    },
    subject: {
      subjectType: 'service_group',
      subjectId: created.id,
      displayName: created.name,
      category: 'service_group',
    },
    event: {
      eventKey: 'service_group.created',
      eventFamily: 'service',
      summary: `Service group ${created.id} was created.`,
      payload: { serviceGroupId: created.id, status: created.status },
    },
  }
}

async function previewServiceGroupUpdate(
  context: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionPreviewResult> {
  const parsed = serviceGroupUpdatePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_SERVICE_GROUP_UPDATE_PAYLOAD',
      message: 'Payload does not match service_group.update contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }
  const existing = await db.query.serviceGroups.findFirst({
    where: and(eq(serviceGroups.bizId, context.bizId), eq(serviceGroups.id, parsed.data.serviceGroupId)),
    columns: { id: true },
  })
  if (!existing) {
    throw {
      family: 'validation',
      code: 'SERVICE_GROUP_NOT_FOUND',
      message: 'The service group does not exist in this biz.',
      retryable: false,
    }
  }
  return {
    summary: `Preview service_group.update for ${existing.id}.`,
    normalizedPayload: parsed.data,
    effectSummary: {
      willUpdate: 'service_group',
      serviceGroupId: existing.id,
      changedFields: Object.keys(parsed.data).filter((key) => key !== 'serviceGroupId'),
    },
  }
}

async function executeServiceGroupUpdate(
  context: ActionContext,
  _actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewServiceGroupUpdate(context, payload)
  const normalized = serviceGroupUpdatePayloadSchema.parse(preview.normalizedPayload)
  const [updated] = await db
    .update(serviceGroups)
    .set({
      name: normalized.name,
      slug: normalized.slug,
      description: normalized.description,
      status: normalized.status,
      statusConfigValueId: normalized.statusConfigValueId,
      metadata: normalized.metadata ? sanitizeUnknown(normalized.metadata) : undefined,
    })
    .where(and(eq(serviceGroups.bizId, context.bizId), eq(serviceGroups.id, normalized.serviceGroupId)))
    .returning()
  return {
    ...preview,
    outputPayload: {
      serviceGroupId: updated.id,
      status: updated.status,
    },
    subject: {
      subjectType: 'service_group',
      subjectId: updated.id,
      displayName: updated.name,
      category: 'service_group',
    },
    event: {
      eventKey: 'service_group.updated',
      eventFamily: 'service',
      summary: `Service group ${updated.id} was updated.`,
      payload: { serviceGroupId: updated.id, status: updated.status },
    },
  }
}

async function previewServiceGroupArchive(
  context: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionPreviewResult> {
  const parsed = serviceGroupArchivePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_SERVICE_GROUP_ARCHIVE_PAYLOAD',
      message: 'Payload does not match service_group.archive contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }
  const existing = await db.query.serviceGroups.findFirst({
    where: and(eq(serviceGroups.bizId, context.bizId), eq(serviceGroups.id, parsed.data.serviceGroupId)),
    columns: { id: true },
  })
  if (!existing) {
    throw {
      family: 'validation',
      code: 'SERVICE_GROUP_NOT_FOUND',
      message: 'The service group does not exist in this biz.',
      retryable: false,
    }
  }
  return {
    summary: `Preview service_group.archive for ${existing.id}.`,
    normalizedPayload: parsed.data,
    effectSummary: {
      willUpdate: 'service_group',
      serviceGroupId: existing.id,
      nextStatus: 'archived',
    },
  }
}

async function executeServiceGroupArchive(
  context: ActionContext,
  _actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewServiceGroupArchive(context, payload)
  const normalized = serviceGroupArchivePayloadSchema.parse(preview.normalizedPayload)
  const [updated] = await db
    .update(serviceGroups)
    .set({ status: 'archived' })
    .where(and(eq(serviceGroups.bizId, context.bizId), eq(serviceGroups.id, normalized.serviceGroupId)))
    .returning()
  return {
    ...preview,
    outputPayload: {
      serviceGroupId: updated.id,
      status: updated.status,
    },
    subject: {
      subjectType: 'service_group',
      subjectId: updated.id,
      displayName: updated.name,
      category: 'service_group',
    },
    event: {
      eventKey: 'service_group.archived',
      eventFamily: 'service',
      summary: `Service group ${updated.id} was archived.`,
      payload: { serviceGroupId: updated.id, status: updated.status },
    },
  }
}

async function previewServiceCreate(
  context: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionPreviewResult> {
  const parsed = serviceCreatePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_SERVICE_CREATE_PAYLOAD',
      message: 'Payload does not match service.create contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }
  const parent = await db.query.serviceGroups.findFirst({
    where: and(eq(serviceGroups.bizId, context.bizId), eq(serviceGroups.id, parsed.data.serviceGroupId)),
    columns: { id: true },
  })
  if (!parent) {
    throw {
      family: 'validation',
      code: 'SERVICE_GROUP_NOT_FOUND',
      message: 'serviceGroupId is not in this biz.',
      retryable: false,
    }
  }
  return {
    summary: `Preview service.create for ${parsed.data.slug}.`,
    normalizedPayload: parsed.data,
    effectSummary: {
      willCreate: 'service',
      serviceGroupId: parsed.data.serviceGroupId,
      slug: parsed.data.slug,
      type: parsed.data.type,
      visibility: parsed.data.visibility,
    },
  }
}

async function executeServiceCreate(
  context: ActionContext,
  _actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewServiceCreate(context, payload)
  const normalized = serviceCreatePayloadSchema.parse(preview.normalizedPayload)
  const [created] = await db
    .insert(services)
    .values({
      bizId: context.bizId,
      serviceGroupId: normalized.serviceGroupId,
      name: normalized.name,
      slug: normalized.slug,
      description: normalized.description,
      type: normalized.type,
      typeConfigValueId: normalized.typeConfigValueId,
      visibility: normalized.visibility,
      visibilityConfigValueId: normalized.visibilityConfigValueId,
      minAdvanceBookingHours: normalized.minAdvanceBookingHours ?? null,
      maxAdvanceBookingDays: normalized.maxAdvanceBookingDays ?? null,
      bookingCutoffMinutes: normalized.bookingCutoffMinutes ?? null,
      requiresApproval: normalized.requiresApproval,
      allowWaitlist: normalized.allowWaitlist,
      allowOverbooking: normalized.allowOverbooking,
      minCancellationNoticeHours: normalized.minCancellationNoticeHours ?? null,
      minRescheduleNoticeHours: normalized.minRescheduleNoticeHours ?? null,
      bookingPolicy: sanitizeUnknown(normalized.bookingPolicy ?? {}),
      cancellationPolicy: sanitizeUnknown(normalized.cancellationPolicy ?? {}),
      depositPolicy: sanitizeUnknown(normalized.depositPolicy ?? {}),
      eligibilityPolicy: sanitizeUnknown(normalized.eligibilityPolicy ?? {}),
      metadata: sanitizeUnknown(normalized.metadata ?? {}),
      isSelfBookable: normalized.isSelfBookable ?? true,
      status: normalized.status,
      statusConfigValueId: normalized.statusConfigValueId,
    })
    .returning()
  return {
    ...preview,
    outputPayload: {
      serviceId: created.id,
      status: created.status,
    },
    subject: {
      subjectType: 'service',
      subjectId: created.id,
      displayName: created.name,
      category: 'service',
    },
    event: {
      eventKey: 'service.created',
      eventFamily: 'service',
      summary: `Service ${created.id} was created.`,
      payload: { serviceId: created.id, status: created.status, visibility: created.visibility },
    },
  }
}

async function previewServiceUpdate(
  context: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionPreviewResult> {
  const parsed = serviceUpdatePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_SERVICE_UPDATE_PAYLOAD',
      message: 'Payload does not match service.update contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }
  const existing = await db.query.services.findFirst({
    where: and(eq(services.bizId, context.bizId), eq(services.id, parsed.data.serviceId)),
    columns: { id: true },
  })
  if (!existing) {
    throw {
      family: 'validation',
      code: 'SERVICE_NOT_FOUND',
      message: 'The service does not exist in this biz.',
      retryable: false,
    }
  }
  return {
    summary: `Preview service.update for ${existing.id}.`,
    normalizedPayload: parsed.data,
    effectSummary: {
      willUpdate: 'service',
      serviceId: existing.id,
      changedFields: Object.keys(parsed.data).filter((key) => key !== 'serviceId'),
    },
  }
}

async function executeServiceUpdate(
  context: ActionContext,
  _actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewServiceUpdate(context, payload)
  const normalized = serviceUpdatePayloadSchema.parse(preview.normalizedPayload)
  const [updated] = await db
    .update(services)
    .set({
      name: normalized.name,
      slug: normalized.slug,
      description: normalized.description,
      type: normalized.type,
      typeConfigValueId: normalized.typeConfigValueId,
      visibility: normalized.visibility,
      visibilityConfigValueId: normalized.visibilityConfigValueId,
      minAdvanceBookingHours: normalized.minAdvanceBookingHours,
      maxAdvanceBookingDays: normalized.maxAdvanceBookingDays,
      bookingCutoffMinutes: normalized.bookingCutoffMinutes,
      requiresApproval: normalized.requiresApproval,
      allowWaitlist: normalized.allowWaitlist,
      allowOverbooking: normalized.allowOverbooking,
      minCancellationNoticeHours: normalized.minCancellationNoticeHours,
      minRescheduleNoticeHours: normalized.minRescheduleNoticeHours,
      bookingPolicy: normalized.bookingPolicy ? sanitizeUnknown(normalized.bookingPolicy) : undefined,
      cancellationPolicy: normalized.cancellationPolicy
        ? sanitizeUnknown(normalized.cancellationPolicy)
        : undefined,
      depositPolicy: normalized.depositPolicy ? sanitizeUnknown(normalized.depositPolicy) : undefined,
      eligibilityPolicy: normalized.eligibilityPolicy
        ? sanitizeUnknown(normalized.eligibilityPolicy)
        : undefined,
      metadata: normalized.metadata ? sanitizeUnknown(normalized.metadata) : undefined,
      isSelfBookable: normalized.isSelfBookable,
      status: normalized.status,
      statusConfigValueId: normalized.statusConfigValueId,
    })
    .where(and(eq(services.bizId, context.bizId), eq(services.id, normalized.serviceId)))
    .returning()
  return {
    ...preview,
    outputPayload: {
      serviceId: updated.id,
      status: updated.status,
    },
    subject: {
      subjectType: 'service',
      subjectId: updated.id,
      displayName: updated.name,
      category: 'service',
    },
    event: {
      eventKey: 'service.updated',
      eventFamily: 'service',
      summary: `Service ${updated.id} was updated.`,
      payload: { serviceId: updated.id, status: updated.status, visibility: updated.visibility },
    },
  }
}

async function previewServiceArchive(
  context: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionPreviewResult> {
  const parsed = serviceArchivePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_SERVICE_ARCHIVE_PAYLOAD',
      message: 'Payload does not match service.archive contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }
  const existing = await db.query.services.findFirst({
    where: and(eq(services.bizId, context.bizId), eq(services.id, parsed.data.serviceId)),
    columns: { id: true },
  })
  if (!existing) {
    throw {
      family: 'validation',
      code: 'SERVICE_NOT_FOUND',
      message: 'The service does not exist in this biz.',
      retryable: false,
    }
  }
  return {
    summary: `Preview service.archive for ${existing.id}.`,
    normalizedPayload: parsed.data,
    effectSummary: {
      willUpdate: 'service',
      serviceId: existing.id,
      nextStatus: 'archived',
    },
  }
}

async function executeServiceArchive(
  context: ActionContext,
  _actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewServiceArchive(context, payload)
  const normalized = serviceArchivePayloadSchema.parse(preview.normalizedPayload)
  const [updated] = await db
    .update(services)
    .set({ status: 'archived' })
    .where(and(eq(services.bizId, context.bizId), eq(services.id, normalized.serviceId)))
    .returning()
  return {
    ...preview,
    outputPayload: {
      serviceId: updated.id,
      status: updated.status,
    },
    subject: {
      subjectType: 'service',
      subjectId: updated.id,
      displayName: updated.name,
      category: 'service',
    },
    event: {
      eventKey: 'service.archived',
      eventFamily: 'service',
      summary: `Service ${updated.id} was archived.`,
      payload: { serviceId: updated.id, status: updated.status },
    },
  }
}

async function previewServiceProductCreate(
  _context: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionPreviewResult> {
  const parsed = serviceProductCreatePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_SERVICE_PRODUCT_CREATE_PAYLOAD',
      message: 'Payload does not match service_product.create contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }

  return {
    summary: `Preview service_product.create for ${parsed.data.slug}.`,
    normalizedPayload: parsed.data,
    effectSummary: {
      willCreate: 'service_product',
      slug: parsed.data.slug,
      kind: parsed.data.kind,
      durationMode: parsed.data.durationMode,
    },
  }
}

async function executeServiceProductCreate(
  context: ActionContext,
  actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewServiceProductCreate(context, payload)
  const normalized = serviceProductCreatePayloadSchema.parse(preview.normalizedPayload)

  const [created] = await db
    .insert(serviceProducts)
    .values({
      bizId: context.bizId,
      actionRequestId,
      productId: normalized.productId,
      name: normalized.name,
      slug: normalized.slug,
      description: normalized.description,
      kind: normalized.kind,
      kindConfigValueId: normalized.kindConfigValueId,
      durationMode: normalized.durationMode,
      durationModeConfigValueId: normalized.durationModeConfigValueId,
      defaultDurationMinutes: normalized.defaultDurationMinutes,
      minDurationMinutes: normalized.minDurationMinutes ?? null,
      maxDurationMinutes: normalized.maxDurationMinutes ?? null,
      durationStepMinutes: normalized.durationStepMinutes,
      timezone: normalized.timezone,
      basePriceAmountMinorUnits: normalized.basePriceAmountMinorUnits,
      currency: normalized.currency,
      pricingPolicy: sanitizeUnknown(normalized.pricingPolicy ?? {}),
      availabilityPolicy: sanitizeUnknown(normalized.availabilityPolicy ?? {}),
      isPublished: normalized.isPublished,
      status: normalized.status,
      statusConfigValueId: normalized.statusConfigValueId,
      metadata: sanitizeUnknown(normalized.metadata ?? {}),
    })
    .returning()

  const sellable = await ensureCanonicalSellableForServiceProduct({
    bizId: context.bizId,
    serviceProductId: created.id,
    name: created.name,
    slug: created.slug,
    currency: created.currency,
    status: created.status,
    actionRequestId,
  })

  return {
    ...preview,
    outputPayload: {
      serviceProductId: created.id,
      sellableId: sellable?.id ?? null,
      status: created.status,
      isPublished: created.isPublished,
    },
    subject: {
      subjectType: 'service_product',
      subjectId: created.id,
      displayName: created.name,
      category: 'service_product',
    },
    event: {
      eventKey: 'service_product.created',
      eventFamily: 'service_product',
      summary: `Service product ${created.id} was created.`,
      payload: {
        serviceProductId: created.id,
        sellableId: sellable?.id ?? null,
        status: created.status,
        isPublished: created.isPublished,
      },
    },
  }
}

async function previewServiceProductUpdate(
  context: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionPreviewResult> {
  const parsed = serviceProductUpdatePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_SERVICE_PRODUCT_UPDATE_PAYLOAD',
      message: 'Payload does not match service_product.update contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }

  const existing = await db.query.serviceProducts.findFirst({
    where: and(eq(serviceProducts.bizId, context.bizId), eq(serviceProducts.id, parsed.data.serviceProductId)),
    columns: { id: true },
  })
  if (!existing) {
    throw {
      family: 'validation',
      code: 'SERVICE_PRODUCT_NOT_FOUND',
      message: 'The service product does not exist in this biz.',
      retryable: false,
    }
  }

  return {
    summary: `Preview service_product.update for ${existing.id}.`,
    normalizedPayload: parsed.data,
    effectSummary: {
      willUpdate: 'service_product',
      serviceProductId: existing.id,
      changedFields: Object.keys(parsed.data).filter((key) => key !== 'serviceProductId'),
    },
  }
}

async function executeServiceProductUpdate(
  context: ActionContext,
  actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewServiceProductUpdate(context, payload)
  const normalized = serviceProductUpdatePayloadSchema.parse(preview.normalizedPayload)

  const [updated] = await db
    .update(serviceProducts)
    .set({
      actionRequestId,
      productId: normalized.productId,
      name: normalized.name,
      slug: normalized.slug,
      description: normalized.description,
      kind: normalized.kind,
      kindConfigValueId: normalized.kindConfigValueId,
      durationMode: normalized.durationMode,
      durationModeConfigValueId: normalized.durationModeConfigValueId,
      defaultDurationMinutes: normalized.defaultDurationMinutes,
      minDurationMinutes: normalized.minDurationMinutes,
      maxDurationMinutes: normalized.maxDurationMinutes,
      durationStepMinutes: normalized.durationStepMinutes,
      timezone: normalized.timezone,
      basePriceAmountMinorUnits: normalized.basePriceAmountMinorUnits,
      currency: normalized.currency,
      pricingPolicy: normalized.pricingPolicy ? sanitizeUnknown(normalized.pricingPolicy) : undefined,
      availabilityPolicy: normalized.availabilityPolicy
        ? sanitizeUnknown(normalized.availabilityPolicy)
        : undefined,
      isPublished: normalized.isPublished,
      status: normalized.status,
      statusConfigValueId: normalized.statusConfigValueId,
      metadata: normalized.metadata ? sanitizeUnknown(normalized.metadata) : undefined,
    })
    .where(and(eq(serviceProducts.bizId, context.bizId), eq(serviceProducts.id, normalized.serviceProductId)))
    .returning()

  return {
    ...preview,
    outputPayload: {
      serviceProductId: updated.id,
      status: updated.status,
      isPublished: updated.isPublished,
    },
    subject: {
      subjectType: 'service_product',
      subjectId: updated.id,
      displayName: updated.name,
      category: 'service_product',
    },
    event: {
      eventKey: 'service_product.updated',
      eventFamily: 'service_product',
      summary: `Service product ${updated.id} was updated.`,
      payload: {
        serviceProductId: updated.id,
        status: updated.status,
        isPublished: updated.isPublished,
      },
    },
  }
}

async function previewServiceProductArchive(
  context: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionPreviewResult> {
  const parsed = serviceProductArchivePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_SERVICE_PRODUCT_ARCHIVE_PAYLOAD',
      message: 'Payload does not match service_product.archive contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }

  const existing = await db.query.serviceProducts.findFirst({
    where: and(eq(serviceProducts.bizId, context.bizId), eq(serviceProducts.id, parsed.data.serviceProductId)),
    columns: { id: true, status: true, isPublished: true },
  })
  if (!existing) {
    throw {
      family: 'validation',
      code: 'SERVICE_PRODUCT_NOT_FOUND',
      message: 'The service product does not exist in this biz.',
      retryable: false,
    }
  }

  return {
    summary: `Preview service_product.archive for ${existing.id}.`,
    normalizedPayload: parsed.data,
    effectSummary: {
      willUpdate: 'service_product',
      serviceProductId: existing.id,
      nextStatus: 'archived',
      nextIsPublished: false,
    },
  }
}

async function executeServiceProductArchive(
  context: ActionContext,
  actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewServiceProductArchive(context, payload)
  const normalized = serviceProductArchivePayloadSchema.parse(preview.normalizedPayload)

  const [updated] = await db
    .update(serviceProducts)
    .set({
      actionRequestId,
      status: 'archived',
      isPublished: false,
    })
    .where(and(eq(serviceProducts.bizId, context.bizId), eq(serviceProducts.id, normalized.serviceProductId)))
    .returning()

  return {
    ...preview,
    outputPayload: {
      serviceProductId: updated.id,
      status: updated.status,
      isPublished: updated.isPublished,
    },
    subject: {
      subjectType: 'service_product',
      subjectId: updated.id,
      displayName: updated.name,
      category: 'service_product',
    },
    event: {
      eventKey: 'service_product.archived',
      eventFamily: 'service_product',
      summary: `Service product ${updated.id} was archived.`,
      payload: {
        serviceProductId: updated.id,
        status: updated.status,
        isPublished: updated.isPublished,
      },
    },
  }
}

async function previewCalendarCreate(
  _context: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionPreviewResult> {
  const parsed = calendarCreatePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_CALENDAR_CREATE_PAYLOAD',
      message: 'Payload does not match calendar.create contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }

  return {
    summary: `Preview calendar.create for ${parsed.data.name}.`,
    normalizedPayload: parsed.data,
    effectSummary: {
      willCreate: 'calendar',
      name: parsed.data.name,
      defaultMode: parsed.data.defaultMode,
      timezone: parsed.data.timezone,
    },
  }
}

async function executeCalendarCreate(
  context: ActionContext,
  _actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewCalendarCreate(context, payload)
  const normalized = calendarCreatePayloadSchema.parse(preview.normalizedPayload)

  const [created] = await db
    .insert(calendars)
    .values({
      bizId: context.bizId,
      name: normalized.name,
      timezone: normalized.timezone,
      slotDurationMin: normalized.slotDurationMin,
      slotIntervalMin: normalized.slotIntervalMin,
      preBufferMin: normalized.preBufferMin,
      postBufferMin: normalized.postBufferMin,
      minAdvanceBookingHours: normalized.minAdvanceBookingHours,
      maxAdvanceBookingDays: normalized.maxAdvanceBookingDays,
      defaultMode: normalized.defaultMode,
      ruleEvaluationOrder: normalized.ruleEvaluationOrder,
      conflictResolutionMode: normalized.conflictResolutionMode,
      enforceStrictNonOverlap: normalized.enforceStrictNonOverlap,
      emitTimelineFacts: normalized.emitTimelineFacts,
      status: normalized.status,
      policy: sanitizeUnknown(normalized.policy ?? {}),
      metadata: sanitizeUnknown(normalized.metadata ?? {}),
    })
    .returning()

  return {
    ...preview,
    outputPayload: {
      calendarId: created.id,
      status: created.status,
    },
    subject: {
      subjectType: 'calendar',
      subjectId: created.id,
      displayName: created.name,
      category: 'calendar',
    },
    event: {
      eventKey: 'calendar.created',
      eventFamily: 'calendar',
      summary: `Calendar ${created.id} was created.`,
      payload: {
        calendarId: created.id,
        status: created.status,
        defaultMode: created.defaultMode,
      },
    },
  }
}

async function previewCalendarUpdate(
  context: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionPreviewResult> {
  const parsed = calendarUpdatePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_CALENDAR_UPDATE_PAYLOAD',
      message: 'Payload does not match calendar.update contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }

  const existing = await db.query.calendars.findFirst({
    where: and(eq(calendars.bizId, context.bizId), eq(calendars.id, parsed.data.calendarId)),
    columns: { id: true },
  })
  if (!existing) {
    throw {
      family: 'validation',
      code: 'CALENDAR_NOT_FOUND',
      message: 'The calendar does not exist in this biz.',
      retryable: false,
    }
  }

  return {
    summary: `Preview calendar.update for ${existing.id}.`,
    normalizedPayload: parsed.data,
    effectSummary: {
      willUpdate: 'calendar',
      calendarId: existing.id,
      changedFields: Object.keys(parsed.data).filter((key) => key !== 'calendarId'),
    },
  }
}

async function executeCalendarUpdate(
  context: ActionContext,
  _actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewCalendarUpdate(context, payload)
  const normalized = calendarUpdatePayloadSchema.parse(preview.normalizedPayload)

  const [updated] = await db
    .update(calendars)
    .set({
      name: normalized.name,
      timezone: normalized.timezone,
      slotDurationMin: normalized.slotDurationMin,
      slotIntervalMin: normalized.slotIntervalMin,
      preBufferMin: normalized.preBufferMin,
      postBufferMin: normalized.postBufferMin,
      minAdvanceBookingHours: normalized.minAdvanceBookingHours,
      maxAdvanceBookingDays: normalized.maxAdvanceBookingDays,
      defaultMode: normalized.defaultMode,
      ruleEvaluationOrder: normalized.ruleEvaluationOrder,
      conflictResolutionMode: normalized.conflictResolutionMode,
      enforceStrictNonOverlap: normalized.enforceStrictNonOverlap,
      emitTimelineFacts: normalized.emitTimelineFacts,
      status: normalized.status,
      policy: normalized.policy ? sanitizeUnknown(normalized.policy) : undefined,
      metadata: normalized.metadata ? sanitizeUnknown(normalized.metadata) : undefined,
    })
    .where(and(eq(calendars.bizId, context.bizId), eq(calendars.id, normalized.calendarId)))
    .returning()

  return {
    ...preview,
    outputPayload: {
      calendarId: updated.id,
      status: updated.status,
    },
    subject: {
      subjectType: 'calendar',
      subjectId: updated.id,
      displayName: updated.name,
      category: 'calendar',
    },
    event: {
      eventKey: 'calendar.updated',
      eventFamily: 'calendar',
      summary: `Calendar ${updated.id} was updated.`,
      payload: {
        calendarId: updated.id,
        status: updated.status,
      },
    },
  }
}

async function previewCalendarArchive(
  context: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionPreviewResult> {
  const parsed = calendarArchivePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_CALENDAR_ARCHIVE_PAYLOAD',
      message: 'Payload does not match calendar.archive contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }

  const existing = await db.query.calendars.findFirst({
    where: and(eq(calendars.bizId, context.bizId), eq(calendars.id, parsed.data.calendarId)),
    columns: { id: true, status: true },
  })
  if (!existing) {
    throw {
      family: 'validation',
      code: 'CALENDAR_NOT_FOUND',
      message: 'The calendar does not exist in this biz.',
      retryable: false,
    }
  }

  return {
    summary: `Preview calendar.archive for ${existing.id}.`,
    normalizedPayload: parsed.data,
    effectSummary: {
      willUpdate: 'calendar',
      calendarId: existing.id,
      nextStatus: 'inactive',
    },
  }
}

async function executeCalendarArchive(
  context: ActionContext,
  _actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewCalendarArchive(context, payload)
  const normalized = calendarArchivePayloadSchema.parse(preview.normalizedPayload)

  const [updated] = await db
    .update(calendars)
    .set({
      status: 'inactive',
    })
    .where(and(eq(calendars.bizId, context.bizId), eq(calendars.id, normalized.calendarId)))
    .returning()

  return {
    ...preview,
    outputPayload: {
      calendarId: updated.id,
      status: updated.status,
    },
    subject: {
      subjectType: 'calendar',
      subjectId: updated.id,
      displayName: updated.name,
      category: 'calendar',
    },
    event: {
      eventKey: 'calendar.archived',
      eventFamily: 'calendar',
      summary: `Calendar ${updated.id} was archived.`,
      payload: {
        calendarId: updated.id,
        status: updated.status,
      },
    },
  }
}

async function previewServiceProductPublish(context: ActionContext, payload: Record<string, unknown>): Promise<ActionPreviewResult> {
  const parsed = serviceProductPublishPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_SERVICE_PRODUCT_PUBLISH_PAYLOAD',
      message: 'Payload does not match service_product.publish contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }

  const serviceProduct = await db.query.serviceProducts.findFirst({
    where: and(eq(serviceProducts.bizId, context.bizId), eq(serviceProducts.id, parsed.data.serviceProductId)),
  })
  if (!serviceProduct) {
    throw {
      family: 'validation',
      code: 'SERVICE_PRODUCT_NOT_FOUND',
      message: 'The service product does not exist in this biz.',
      retryable: false,
    }
  }

  return {
    summary: `Preview service_product.publish for service product ${serviceProduct.id}.`,
    normalizedPayload: parsed.data,
    effectSummary: {
      willUpdate: 'service_product',
      serviceProductId: serviceProduct.id,
      nextStatus: parsed.data.status ?? 'active',
      nextIsPublished: parsed.data.isPublished ?? true,
    },
  }
}

async function executeServiceProductPublish(
  context: ActionContext,
  actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewServiceProductPublish(context, payload)
  const normalized = serviceProductPublishPayloadSchema.parse(preview.normalizedPayload)

  const [updated] = await db
    .update(serviceProducts)
    .set({
      status: normalized.status ?? 'active',
      isPublished: normalized.isPublished ?? true,
      actionRequestId,
    })
    .where(and(eq(serviceProducts.bizId, context.bizId), eq(serviceProducts.id, normalized.serviceProductId)))
    .returning()

  return {
    ...preview,
    outputPayload: {
      serviceProductId: updated.id,
      status: updated.status,
      isPublished: updated.isPublished,
    },
    subject: {
      subjectType: 'service_product',
      subjectId: updated.id,
      displayName: updated.name,
      category: 'service_product',
    },
    event: {
      eventKey: 'service_product.published',
      eventFamily: 'service_product',
      summary: `Service product ${updated.id} was published.`,
      payload: {
        serviceProductId: updated.id,
        status: updated.status,
        isPublished: updated.isPublished,
      },
    },
  }
}

async function previewMemberOffboard(context: ActionContext, payload: Record<string, unknown>): Promise<ActionPreviewResult> {
  const parsed = memberOffboardPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_MEMBER_OFFBOARD_PAYLOAD',
      message: 'Payload does not match member.offboard contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }

  const existing = await db.query.members.findFirst({
    where: and(eq(members.organizationId, context.bizId), eq(members.id, parsed.data.memberId)),
  })
  if (!existing) {
    throw {
      family: 'validation',
      code: 'MEMBER_NOT_FOUND',
      message: 'The member to offboard does not exist in this biz.',
      retryable: false,
    }
  }
  if (parsed.data.checklist.some((item) => !item.completed)) {
    throw {
      family: 'validation',
      code: 'CHECKLIST_INCOMPLETE',
      message: 'All offboarding checklist items must be completed.',
      details: { checklist: parsed.data.checklist },
      retryable: false,
    }
  }

  return {
    summary: `Preview member.offboard for member ${existing.id}.`,
    normalizedPayload: parsed.data,
    effectSummary: {
      willDelete: 'member',
      memberId: existing.id,
      reason: parsed.data.reason,
      checklistLength: parsed.data.checklist.length,
    },
  }
}

async function executeMemberOffboard(
  context: ActionContext,
  _actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewMemberOffboard(context, payload)
  const normalized = memberOffboardPayloadSchema.parse(preview.normalizedPayload)

  const existing = await db.query.members.findFirst({
    where: and(eq(members.organizationId, context.bizId), eq(members.id, normalized.memberId)),
  })
  if (!existing) {
    throw {
      family: 'validation',
      code: 'MEMBER_NOT_FOUND',
      message: 'The member to offboard does not exist in this biz.',
      retryable: false,
    }
  }

  const [removed] = await db
    .delete(members)
    .where(and(eq(members.organizationId, context.bizId), eq(members.id, normalized.memberId)))
    .returning({ id: members.id, userId: members.userId, role: members.role })

  if (!removed) {
    throw {
      family: 'validation',
      code: 'MEMBER_NOT_FOUND',
      message: 'The member to offboard does not exist in this biz.',
      retryable: false,
    }
  }

  return {
    ...preview,
    outputPayload: {
      memberId: removed.id,
      revoked: true,
      checklistCompleted: true,
      role: removed.role,
      userId: removed.userId,
    },
    subject: {
      subjectType: 'member',
      subjectId: removed.id,
      displayName: `Member ${removed.id}`,
      category: 'member',
    },
    event: {
      eventKey: 'member.offboarded',
      eventFamily: 'member',
      summary: `Member ${removed.id} was offboarded.`,
      payload: {
        memberId: removed.id,
        userId: removed.userId,
        role: removed.role,
        reason: normalized.reason,
        checklist: normalized.checklist,
        metadata: normalized.metadata ?? {},
      },
    },
  }
}

async function previewCalendarBlock(context: ActionContext, payload: Record<string, unknown>): Promise<ActionPreviewResult> {
  const parsed = calendarBlockPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw {
      family: 'validation',
      code: 'INVALID_CALENDAR_BLOCK_PAYLOAD',
      message: 'Payload does not match calendar.block contract.',
      details: parsed.error.flatten(),
      retryable: false,
    }
  }

  const calendar = await db.query.calendars.findFirst({
    where: and(eq(calendars.bizId, context.bizId), eq(calendars.id, parsed.data.calendarId)),
  })
  if (!calendar) {
    throw {
      family: 'validation',
      code: 'CALENDAR_NOT_FOUND',
      message: 'The calendar to block does not exist in this biz.',
      retryable: false,
    }
  }

  return {
    summary: `Preview calendar.block for calendar ${calendar.id}.`,
    normalizedPayload: parsed.data,
    effectSummary: {
      willCreate: ['calendar_overlay', 'availability_rule'],
      calendarId: calendar.id,
      kind: parsed.data.kind ?? 'blackout',
      blockWindow: {
        startAt: parsed.data.startAt,
        endAt: parsed.data.endAt,
      },
    },
  }
}

async function executeCalendarBlock(
  context: ActionContext,
  _actionRequestId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewCalendarBlock(context, payload)
  const normalized = calendarBlockPayloadSchema.parse(preview.normalizedPayload)

  const calendar = await db.query.calendars.findFirst({
    where: and(eq(calendars.bizId, context.bizId), eq(calendars.id, normalized.calendarId)),
  })
  if (!calendar) {
    throw {
      family: 'validation',
      code: 'CALENDAR_NOT_FOUND',
      message: 'The calendar to block does not exist in this biz.',
      retryable: false,
    }
  }

  const [overlay] = await db
    .insert(calendarOverlays)
    .values({
      bizId: context.bizId,
      calendarId: normalized.calendarId,
      kind: normalized.kind ?? 'blackout',
      name: normalized.name,
      description: normalized.description ?? null,
      priority: normalized.priority ?? 100,
      effectiveStartAt: new Date(normalized.startAt),
      effectiveEndAt: new Date(normalized.endAt),
      isActive: true,
      metadata: sanitizeUnknown(normalized.metadata ?? {}),
    })
    .returning()

  const [rule] = await db
    .insert(availabilityRules)
    .values({
      bizId: context.bizId,
      calendarId: normalized.calendarId,
      overlayId: overlay.id,
      name: `${normalized.name} block rule`,
      mode: 'timestamp_range',
      frequency: 'none',
      startAt: new Date(normalized.startAt),
      endAt: new Date(normalized.endAt),
      action: 'unavailable',
      priority: normalized.priority ?? 100,
      isActive: true,
      metadata: sanitizeUnknown({
        source: 'calendar.block',
        ...(normalized.ruleMetadata ?? {}),
      }),
    })
    .returning()

  return {
    ...preview,
    outputPayload: {
      calendarId: calendar.id,
      overlayId: overlay.id,
      availabilityRuleId: rule.id,
      kind: overlay.kind,
    },
    subject: {
      subjectType: 'calendar',
      subjectId: calendar.id,
      displayName: calendar.name,
      category: 'calendar',
    },
    event: {
      eventKey: 'calendar.blocked',
      eventFamily: 'calendar',
      summary: `Calendar ${calendar.id} received a blocked window.`,
      payload: {
        calendarId: calendar.id,
        overlayId: overlay.id,
        availabilityRuleId: rule.id,
        kind: overlay.kind,
        startAt: normalized.startAt,
        endAt: normalized.endAt,
      },
    },
  }
}

async function previewGenericCrudAction(context: ActionContext, actionKey: string, payload: Record<string, unknown>) {
  const parsed = genericCrudPayloadSchema.parse(payload)
  const operation = resolveCrudOperation(actionKey, parsed.operation)
  const table = resolveCrudTable(parsed.tableKey)
  const id = parsed.id ?? null
  const subjectType = parsed.subjectType ?? defaultSubjectTypeFromTableKey(parsed.tableKey)
  const subjectId = parsed.subjectId ?? id ?? '__pending__'
  return {
    summary: `Preview ${operation} on ${parsed.tableKey}.`,
    effectSummary: sanitizeUnknown({
      operation,
      tableKey: parsed.tableKey,
      id,
      payloadShape: {
        dataKeys: Object.keys(parsed.data ?? {}),
        patchKeys: Object.keys(parsed.patch ?? {}),
      },
      bizScoped: 'bizId' in table,
    }) as Record<string, unknown>,
    normalizedPayload: sanitizeUnknown({
      ...parsed,
      operation,
      subjectType,
      subjectId,
    }) as Record<string, unknown>,
  } satisfies ActionPreviewResult
}

async function executeGenericCrudAction(
  context: ActionContext,
  _actionRequestId: string,
  actionKey: string,
  payload: Record<string, unknown>,
): Promise<ActionExecuteResult> {
  const preview = await previewGenericCrudAction(context, actionKey, payload)
  const normalized = preview.normalizedPayload as Record<string, unknown>
  const parsed = genericCrudPayloadSchema.parse(normalized)
  const operation = resolveCrudOperation(actionKey, parsed.operation)
  const table = resolveCrudTable(parsed.tableKey)
  const idColumn = table.id as any
  const bizIdColumn = table.bizId as any | undefined
  const deletedAtColumn = table.deletedAt as any | undefined

  if (operation === 'create') {
    const insertPayload = coerceTemporalPayload(
      sanitizeUnknown({
        ...(parsed.data ?? {}),
        ...(bizIdColumn && !(parsed.data && 'bizId' in parsed.data) ? { bizId: context.bizId } : {}),
      }) as Record<string, unknown>,
    )

    /**
     * Some generic tables carry optional subject pointers that are FK-bound.
     * Auto-register lightweight subject shells when pointers are present so
     * CRUD adapters remain deterministic across validator-heavy saga flows.
     */
    const ensureSubjectPair = async (
      subjectTypeValue: unknown,
      subjectIdValue: unknown,
      source: string,
    ) => {
      const subjectType =
        typeof subjectTypeValue === 'string' && subjectTypeValue.length > 0 ? subjectTypeValue : null
      const subjectId =
        typeof subjectIdValue === 'string' && subjectIdValue.length > 0 ? subjectIdValue : null
      if (subjectType && subjectId) {
        await db
          .insert(subjects)
          .values({
            bizId: context.bizId,
            subjectType,
            subjectId,
            displayName: `${subjectType}:${subjectId}`,
            category: subjectType,
            status: 'active',
            isLinkable: true,
            metadata: {
              source,
            },
          })
          .onConflictDoNothing()
      }
    }
    if (parsed.tableKey === 'domainEvents') {
      await ensureSubjectPair(
        insertPayload.subjectType,
        insertPayload.subjectId,
        'action-runtime.generic-domain-events-auto-subject',
      )
    }
    if (parsed.tableKey === 'accessSecurityDecisions') {
      await ensureSubjectPair(
        insertPayload.decidedBySubjectType,
        insertPayload.decidedBySubjectId,
        'action-runtime.generic-access-security-decisions-auto-subject',
      )
    }
    if (parsed.tableKey === 'sessionInteractionArtifacts') {
      await ensureSubjectPair(
        insertPayload.uploadedBySubjectType,
        insertPayload.uploadedBySubjectId,
        'action-runtime.generic-session-artifacts-auto-subject',
      )
    }
    let createdRows: any[]
    try {
      createdRows = (await db.insert(table as any).values(insertPayload as any).returning()) as any[]
    } catch (rawError) {
      throw {
        family: 'internal',
        code: 'CRUD_CREATE_EXECUTION_FAILED',
        message: `Generic CRUD create failed for table '${parsed.tableKey}'.`,
        retryable: false,
        details: {
          tableKey: parsed.tableKey,
          operation,
          payloadTypes: payloadTypeSummary(insertPayload),
          rawError:
            rawError && typeof rawError === 'object'
              ? {
                  message: (rawError as { message?: unknown }).message ?? String(rawError),
                  code: (rawError as { code?: unknown }).code ?? null,
                }
              : { message: String(rawError), code: null },
        },
      }
    }
    const created = createdRows[0]

    const subjectType = parsed.subjectType ?? defaultSubjectTypeFromTableKey(parsed.tableKey)
    const subjectId = parsed.subjectId ?? String((created as { id?: string }).id ?? '')

    return {
      ...preview,
      outputPayload: sanitizeUnknown({
        tableKey: parsed.tableKey,
        operation,
        id: (created as { id?: string }).id ?? null,
        row: created,
      }) as Record<string, unknown>,
      subject: {
        subjectType,
        subjectId,
        displayName: parsed.displayName ?? `${parsed.tableKey} ${(created as { id?: string }).id ?? ''}`,
        category: 'record',
      },
      event: {
        eventKey: `${subjectType}.created`,
        eventFamily: subjectType,
        summary: `Created ${subjectType} ${(created as { id?: string }).id ?? ''}.`,
        payload: sanitizeUnknown({
          tableKey: parsed.tableKey,
          operation,
          id: (created as { id?: string }).id ?? null,
        }) as Record<string, unknown>,
      },
    }
  }

  if (operation === 'update') {
    const patchPayload = coerceTemporalPayload(
      sanitizeUnknown(parsed.patch ?? {}) as Record<string, unknown>,
    )
    const whereClause = bizIdColumn && context.bizId
      ? and(eq(idColumn, parsed.id as string), eq(bizIdColumn, context.bizId))
      : eq(idColumn, parsed.id as string)
    const updatedRows = (await db
      .update(table as any)
      .set(patchPayload as any)
      .where(whereClause as any)
      .returning()) as any[]
    const updated = updatedRows[0]
    if (!updated) {
      throw {
        family: 'validation',
        code: 'CRUD_TARGET_NOT_FOUND',
        message: `No row found for update on ${parsed.tableKey} with id ${parsed.id}.`,
        retryable: false,
      }
    }
    const subjectType = parsed.subjectType ?? defaultSubjectTypeFromTableKey(parsed.tableKey)
    const subjectId = parsed.subjectId ?? String(parsed.id)
    return {
      ...preview,
      outputPayload: sanitizeUnknown({
        tableKey: parsed.tableKey,
        operation,
        id: parsed.id,
        row: updated,
      }) as Record<string, unknown>,
      subject: {
        subjectType,
        subjectId,
        displayName: parsed.displayName ?? `${parsed.tableKey} ${parsed.id}`,
        category: 'record',
      },
      event: {
        eventKey: `${subjectType}.updated`,
        eventFamily: subjectType,
        summary: `Updated ${subjectType} ${parsed.id}.`,
        payload: sanitizeUnknown({
          tableKey: parsed.tableKey,
          operation,
          id: parsed.id,
        }) as Record<string, unknown>,
      },
    }
  }

  const deleteWhere = bizIdColumn && context.bizId
    ? and(eq(idColumn, parsed.id as string), eq(bizIdColumn, context.bizId))
    : eq(idColumn, parsed.id as string)

  let deletedRow: unknown = null
  if (deletedAtColumn) {
    const softDeletedRows = (await db
      .update(table as any)
      .set({
        deletedAt: new Date(),
      } as any)
      .where(deleteWhere as any)
      .returning()) as any[]
    const softDeleted = softDeletedRows[0]
    deletedRow = softDeleted ?? null
  } else {
    const removedRows = (await db.delete(table as any).where(deleteWhere as any).returning()) as any[]
    const removed = removedRows[0]
    deletedRow = removed ?? null
  }

  if (!deletedRow) {
    throw {
      family: 'validation',
      code: 'CRUD_TARGET_NOT_FOUND',
      message: `No row found for delete on ${parsed.tableKey} with id ${parsed.id}.`,
      retryable: false,
    }
  }

  const subjectType = parsed.subjectType ?? defaultSubjectTypeFromTableKey(parsed.tableKey)
  const subjectId = parsed.subjectId ?? String(parsed.id)
  return {
    ...preview,
    outputPayload: sanitizeUnknown({
      tableKey: parsed.tableKey,
      operation,
      id: parsed.id,
      row: deletedRow,
      softDeleted: Boolean(deletedAtColumn),
    }) as Record<string, unknown>,
    subject: {
      subjectType,
      subjectId,
      displayName: parsed.displayName ?? `${parsed.tableKey} ${parsed.id}`,
      category: 'record',
    },
    event: {
      eventKey: `${subjectType}.deleted`,
      eventFamily: subjectType,
      summary: `Deleted ${subjectType} ${parsed.id}.`,
      payload: sanitizeUnknown({
        tableKey: parsed.tableKey,
        operation,
        id: parsed.id,
        softDeleted: Boolean(deletedAtColumn),
      }) as Record<string, unknown>,
    },
  }
}

async function previewAction(context: ActionContext, input: CanonicalActionInput): Promise<ActionPreviewResult> {
  const payload = sanitizeUnknown(input.payload) as Record<string, unknown>
  if (input.actionKey.startsWith('crud.')) {
    return previewGenericCrudAction(context, input.actionKey, payload)
  }
  switch (input.actionKey) {
    case 'booking.create':
      return previewBookingCreate(context, payload)
    case 'booking.cancel':
      return previewBookingCancel(context, payload)
    case 'offer.create':
      return previewOfferCreate(context, payload)
    case 'offer.update':
      return previewOfferUpdate(context, payload)
    case 'offer.archive':
      return previewOfferArchive(context, payload)
    case 'offer.publish':
      return previewOfferPublish(context, payload)
    case 'service_group.create':
      return previewServiceGroupCreate(context, payload)
    case 'service_group.update':
      return previewServiceGroupUpdate(context, payload)
    case 'service_group.archive':
      return previewServiceGroupArchive(context, payload)
    case 'service.create':
      return previewServiceCreate(context, payload)
    case 'service.update':
      return previewServiceUpdate(context, payload)
    case 'service.archive':
      return previewServiceArchive(context, payload)
    case 'resource.create':
      return previewResourceCreate(context, payload)
    case 'resource.update':
      return previewResourceUpdate(context, payload)
    case 'resource.delete':
      return previewResourceDelete(context, payload)
    case 'service_product.create':
      return previewServiceProductCreate(context, payload)
    case 'service_product.update':
      return previewServiceProductUpdate(context, payload)
    case 'service_product.archive':
      return previewServiceProductArchive(context, payload)
    case 'calendar.create':
      return previewCalendarCreate(context, payload)
    case 'calendar.update':
      return previewCalendarUpdate(context, payload)
    case 'calendar.archive':
      return previewCalendarArchive(context, payload)
    case 'service_product.publish':
      return previewServiceProductPublish(context, payload)
    case 'member.offboard':
      return previewMemberOffboard(context, payload)
    case 'calendar.block':
      return previewCalendarBlock(context, payload)
    default:
      throw {
        family: 'validation',
        code: 'UNSUPPORTED_ACTION',
        message: `Action ${input.actionKey} is not supported by the canonical action runtime yet.`,
        retryable: false,
      }
  }
}

async function executeActionAdapter(
  context: ActionContext,
  actionRequestId: string,
  input: CanonicalActionInput,
): Promise<ActionExecuteResult> {
  const payload = sanitizeUnknown(input.payload) as Record<string, unknown>
  if (input.actionKey.startsWith('crud.')) {
    return executeGenericCrudAction(context, actionRequestId, input.actionKey, payload)
  }
  switch (input.actionKey) {
    case 'booking.create':
      return executeBookingCreate(context, actionRequestId, payload)
    case 'booking.cancel':
      return executeBookingCancel(context, actionRequestId, payload)
    case 'offer.create':
      return executeOfferCreate(context, actionRequestId, payload)
    case 'offer.update':
      return executeOfferUpdate(context, actionRequestId, payload)
    case 'offer.archive':
      return executeOfferArchive(context, actionRequestId, payload)
    case 'offer.publish':
      return executeOfferPublish(context, actionRequestId, payload)
    case 'service_group.create':
      return executeServiceGroupCreate(context, actionRequestId, payload)
    case 'service_group.update':
      return executeServiceGroupUpdate(context, actionRequestId, payload)
    case 'service_group.archive':
      return executeServiceGroupArchive(context, actionRequestId, payload)
    case 'service.create':
      return executeServiceCreate(context, actionRequestId, payload)
    case 'service.update':
      return executeServiceUpdate(context, actionRequestId, payload)
    case 'service.archive':
      return executeServiceArchive(context, actionRequestId, payload)
    case 'resource.create':
      return executeResourceCreate(context, actionRequestId, payload)
    case 'resource.update':
      return executeResourceUpdate(context, actionRequestId, payload)
    case 'resource.delete':
      return executeResourceDelete(context, actionRequestId, payload)
    case 'service_product.create':
      return executeServiceProductCreate(context, actionRequestId, payload)
    case 'service_product.update':
      return executeServiceProductUpdate(context, actionRequestId, payload)
    case 'service_product.archive':
      return executeServiceProductArchive(context, actionRequestId, payload)
    case 'calendar.create':
      return executeCalendarCreate(context, actionRequestId, payload)
    case 'calendar.update':
      return executeCalendarUpdate(context, actionRequestId, payload)
    case 'calendar.archive':
      return executeCalendarArchive(context, actionRequestId, payload)
    case 'service_product.publish':
      return executeServiceProductPublish(context, actionRequestId, payload)
    case 'member.offboard':
      return executeMemberOffboard(context, actionRequestId, payload)
    case 'calendar.block':
      return executeCalendarBlock(context, actionRequestId, payload)
    default:
      throw {
        family: 'validation',
        code: 'UNSUPPORTED_ACTION',
        message: `Action ${input.actionKey} is not supported by the canonical action runtime yet.`,
        retryable: false,
      }
  }
}

async function recordFailure(params: {
  bizId: string | null
  actionRequestId: string
  actionExecutionId: string
  input: CanonicalActionInput
  error: {
    family?: string
    code?: string
    message?: string
    details?: unknown
    retryable?: boolean
  }
  context: ActionContext
  executor?: ActionDbExecutor
}) {
  const executor = params.executor ?? db
  const [snapshot] = await executor
    .insert(debugSnapshots)
    .values({
      bizId: params.bizId,
      snapshotFamily: 'action_failure',
      contextRef: params.actionRequestId,
      severity: 'error',
      snapshotData: sanitizeUnknown({
        actionKey: params.input.actionKey,
        actionFamily: params.input.actionFamily,
        payload: params.input.payload,
        error: params.error,
      }),
      metadata: sanitizeUnknown({
        requestId: params.context.requestId ?? null,
        authSource: params.context.authSource ?? 'session',
        accessMode: params.context.accessMode,
      }),
    })
    .returning()

  const [failure] = await executor
    .insert(actionFailures)
    .values({
      bizId: params.bizId,
      actionRequestId: params.actionRequestId,
      actionExecutionId: params.actionExecutionId,
      failureFamily: params.error.family ?? 'internal',
      failureCode: params.error.code ?? 'ACTION_EXECUTION_FAILED',
      failureMessage: params.error.message ?? 'Action execution failed.',
      suggestedResolution:
        params.error.family === 'validation'
          ? 'Fix the request payload or target references and retry.'
          : 'Inspect the attached debug snapshot and execution diagnostics.',
      isRetryable: params.error.retryable === true,
      diagnostics: sanitizeUnknown(params.error.details ?? {}),
      stateSnapshot: sanitizeUnknown({
        actionKey: params.input.actionKey,
        intentMode: 'execute',
      }),
      debugSnapshotId: snapshot.id,
      metadata: sanitizeUnknown({
        requestId: params.context.requestId ?? null,
      }),
    })
    .returning()

  return { failure, snapshot }
}

/**
 * Persist and optionally execute one canonical business action.
 *
 * ELI5:
 * This function is the small action engine sitting in front of important
 * business writes. It records:
 * - the request,
 * - the execution attempt,
 * - idempotency state,
 * - failures and debug snapshots,
 * - success events,
 * - success projections.
 *
 * The point is not only to "do the write".
 * The point is to make the write explainable and safe.
 */
export async function persistCanonicalAction(params: {
  bizId: string | null
  input: CanonicalActionInput
  context: ActionContext
  intentMode: 'dry_run' | 'execute'
}): Promise<ActionRuntimeResult> {
  const requestedBizId = normalizeBizId(params.bizId)
  const input = {
    ...params.input,
    actionFamily: params.input.actionFamily ?? params.input.actionKey.split('.')[0] ?? 'general',
    payload: sanitizeUnknown(params.input.payload ?? {}) as Record<string, unknown>,
    metadata: sanitizeUnknown(params.input.metadata ?? {}) as Record<string, unknown>,
  }

  const requestHash = hashPayload({
    actionKey: input.actionKey,
    actionFamily: input.actionFamily,
    targetSubjectType: input.targetSubjectType ?? null,
    targetSubjectId: input.targetSubjectId ?? null,
    sourceInstallationRef: input.sourceInstallationRef ?? null,
    payload: input.payload,
  })

  const actorNamespace = actorNamespaceFromContext(params.context)

  if (requestedBizId && input.idempotencyKey) {
    const replay = await loadIdempotentReplay({
      bizId: requestedBizId,
      actionKey: input.actionKey,
      actorNamespace,
      idempotencyKey: input.idempotencyKey,
      requestHash,
    })
    if (replay?.type === 'hash_mismatch') {
      throw {
        httpStatus: 409,
        code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD',
        message: 'The idempotency key has already been used with a different payload.',
      }
    }
    if (replay?.type === 'replay') {
      return {
        reused: true,
        httpStatus: 200,
        actionRequest: replay.actionRequest,
        latestExecution: replay.latestExecution,
        failure: replay.failure ?? undefined,
        domainEvent: replay.domainEvent ?? undefined,
      }
    }
  }

  return baseDb.transaction(async (tx) =>
    actionDbContext.run(tx as ActionDbExecutor, async () => {
    const executor = tx as ActionDbExecutor
    const now = new Date()
    const [actionRequest] = await executor
      .insert(actionRequests)
      .values({
        bizId: requestedBizId,
        actionKey: input.actionKey,
        actionFamily: input.actionFamily,
        actorType: actorTypeFromAuthSource(params.context.authSource),
        actorUserId: params.context.user.id,
        actorRef: actorRefFromContext(params.context),
        sourceInstallationRef: input.sourceInstallationRef,
        intentMode: params.intentMode,
        status: 'pending',
        targetSubjectType: null,
        targetSubjectId: null,
        inputPayload: input.payload,
        correlationId: params.context.requestId ?? crypto.randomUUID(),
        requestedAt: now,
        executionStartedAt: now,
        metadata: sanitizeUnknown({
          accessMode: params.context.accessMode,
          ...(input.metadata ?? {}),
        }),
      })
      .returning()

    if (requestedBizId && input.idempotencyKey) {
      await executor.insert(actionIdempotencyKeys).values({
        bizId: requestedBizId,
        actionRequestId: actionRequest.id,
        idempotencyKey: input.idempotencyKey,
        actionKey: input.actionKey,
        actorNamespace,
        requestHash,
        status: 'reserved',
        metadata: sanitizeUnknown({
          requestId: params.context.requestId ?? null,
        }),
      })
    }

    const [execution] = await executor
      .insert(actionExecutions)
      .values({
        bizId: requestedBizId,
        actionRequestId: actionRequest.id,
        attemptNumber: 1,
        phaseKey: params.intentMode === 'dry_run' ? 'preview' : 'execute',
        status: 'running',
        metadata: sanitizeUnknown({
          requestId: params.context.requestId ?? null,
        }),
      })
      .returning()

    try {
      const result =
        params.intentMode === 'dry_run'
          ? await previewAction(params.context, input)
          : await executor.transaction(async (nestedTx) =>
              actionDbContext.run(nestedTx as ActionDbExecutor, async () =>
                executeActionAdapter(params.context, actionRequest.id, input),
              ),
            )

      const requestStatus = params.intentMode === 'dry_run' ? 'previewed' : 'succeeded'
      const executionStatus = params.intentMode === 'dry_run' ? 'previewed' : 'succeeded'

      const effectiveBizId =
        params.intentMode === 'execute'
          ? resolveEffectiveActionBizId(requestedBizId, input, result as ActionExecuteResult)
          : requestedBizId

      let successArtifacts: { domainEvent: unknown; projectionDocument: unknown | null } | null = null
      if (params.intentMode === 'execute' && effectiveBizId) {
        successArtifacts = await recordSuccessArtifacts({
          bizId: effectiveBizId,
          actionRequestId: actionRequest.id,
          actionExecutionId: execution.id,
          input,
          result: result as ActionExecuteResult,
          context: params.context,
          executor,
        })
      }

      const [updatedExecution] = await executor
        .update(actionExecutions)
        .set({
          bizId: effectiveBizId ?? requestedBizId,
          status: executionStatus,
          effectSummary: sanitizeUnknown(result.effectSummary),
          diagnostics: sanitizeUnknown({
            summary: result.summary,
            ...(successArtifacts
              ? {
                  domainEventId: (successArtifacts.domainEvent as { id?: string }).id ?? null,
                  projectionDocumentId: (successArtifacts.projectionDocument as { id?: string } | null)?.id ?? null,
                }
              : {}),
          }),
          completedAt: new Date(),
        })
        .where(eq(actionExecutions.id, execution.id))
        .returning()

      const [updatedRequest] = await executor
        .update(actionRequests)
        .set({
          bizId: effectiveBizId ?? requestedBizId,
          status: requestStatus,
          targetSubjectType:
            params.intentMode === 'execute'
              ? (result as ActionExecuteResult).subject.subjectType
              : input.targetSubjectType ?? null,
          targetSubjectId:
            params.intentMode === 'execute'
              ? (result as ActionExecuteResult).subject.subjectId
              : input.targetSubjectId ?? null,
          previewPayload:
            params.intentMode === 'dry_run'
              ? sanitizeUnknown(result.effectSummary)
              : sql`${actionRequests.previewPayload}`,
          outputPayload:
            params.intentMode === 'execute'
              ? sanitizeUnknown({
                  ...(result as ActionExecuteResult).outputPayload,
                  domainEventId: (successArtifacts?.domainEvent as { id?: string } | undefined)?.id ?? null,
                  projectionDocumentId:
                    (successArtifacts?.projectionDocument as { id?: string } | null | undefined)?.id ?? null,
                })
              : sanitizeUnknown(result.effectSummary),
          statusReason: result.summary,
          completedAt: new Date(),
        })
        .where(eq(actionRequests.id, actionRequest.id))
        .returning()

      if (requestedBizId && input.idempotencyKey) {
        await executor
          .update(actionIdempotencyKeys)
          .set({
            status: requestStatus,
          })
          .where(eq(actionIdempotencyKeys.actionRequestId, actionRequest.id))
      }

      return {
        reused: false,
        httpStatus: params.intentMode === 'dry_run' ? 200 : 201,
        actionRequest: updatedRequest,
        latestExecution: updatedExecution,
        domainEvent: successArtifacts?.domainEvent,
        projectionDocument: successArtifacts?.projectionDocument ?? undefined,
      }
    } catch (rawError) {
      const error =
        rawError && typeof rawError === 'object'
          ? (rawError as {
              family?: string
              code?: string
              message?: string
              details?: unknown
              retryable?: boolean
            })
          : {}

      const { failure } = await recordFailure({
        bizId: requestedBizId,
        actionRequestId: actionRequest.id,
        actionExecutionId: execution.id,
        input,
        error,
        context: params.context,
        executor,
      })

      const [updatedExecution] = await executor
        .update(actionExecutions)
        .set({
          bizId: requestedBizId,
          status: 'failed',
          failureCode: error.code ?? 'ACTION_EXECUTION_FAILED',
          failureMessage: error.message ?? 'Action execution failed.',
          isRetryable: error.retryable === true,
          diagnostics: sanitizeUnknown(error.details ?? {}),
          completedAt: new Date(),
        })
        .where(eq(actionExecutions.id, execution.id))
        .returning()

      const [updatedRequest] = await executor
        .update(actionRequests)
        .set({
          bizId: requestedBizId,
          status: 'failed',
          statusReason: error.message ?? 'Action execution failed.',
          completedAt: new Date(),
        })
        .where(eq(actionRequests.id, actionRequest.id))
        .returning()

      if (requestedBizId && input.idempotencyKey) {
        await executor
          .update(actionIdempotencyKeys)
          .set({
            status: 'failed',
          })
          .where(eq(actionIdempotencyKeys.actionRequestId, actionRequest.id))
      }

      return {
        reused: false,
        httpStatus: error.family === 'validation' ? 400 : 409,
        actionRequest: updatedRequest,
        latestExecution: updatedExecution,
        failure,
      }
    }
    })
  )
}
