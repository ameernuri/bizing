import { index, uniqueIndex } from 'drizzle-orm/pg-core'
import { boolean, date, integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { createdAt, id, idRef, updatedAt } from './_common'
import { idempotencyStatusEnum, outboxStatusEnum } from './enums'
import { bookings } from './bookings'
import { bizes } from './bizes'
import { users } from './users'

/**
 * idempotency_keys
 *
 * API retry safety register.
 * Prevents duplicate booking/payment writes during network retries.
 *
 * Typical usage:
 * - API writes row in `processing`.
 * - command executes exactly once.
 * - cached response is stored and status becomes `completed`.
 */
export const idempotencyKeys = pgTable('idempotency_keys', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),

  /** Usually endpoint or command name (e.g., `bookings.create`). */
  scope: varchar('scope', { length: 100 }).notNull(),

  /** Caller-provided idempotency key. */
  key: varchar('key', { length: 255 }).notNull(),

  /** Deterministic hash to reject key reuse with different payloads. */
  requestHash: varchar('request_hash', { length: 128 }),

  /** Cached response for safe replay under retries. */
  responseCode: integer('response_code'),
  responseBody: jsonb('response_body'),

  status: idempotencyStatusEnum('status').default('processing').notNull(),
  lockedAt: timestamp('locked_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),

  createdAt: createdAt,
  updatedAt: updatedAt,
}, (table) => ({
  idempotencyKeysUnique: uniqueIndex('idempotency_keys_unique').on(table.bizId, table.scope, table.key),
  idempotencyKeysStatusIdx: index('idempotency_keys_status_idx').on(table.status, table.expiresAt),
}))

/**
 * audit_events
 *
 * Immutable compliance/audit stream for critical entity mutations.
 *
 * Relationship map:
 * - Can point to any entity via (`entity_type`, `entity_id`).
 * - Optional direct booking link for booking-centric investigations.
 */
export const auditEvents = pgTable('audit_events', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  actorUserId: idRef('actor_user_id').references(() => users.id),
  actorAuthUserId: varchar('actor_auth_user_id', { length: 255 }),
  actorType: varchar('actor_type', { length: 50 }).default('user').notNull(),

  /** Generic action taxonomy (`booking.cancelled`, `payment.refunded`, etc.). */
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: idRef('entity_id'),
  bookingId: idRef('booking_id').references(() => bookings.id),

  beforeData: jsonb('before_data'),
  afterData: jsonb('after_data'),
  reason: varchar('reason', { length: 500 }),

  /** Traceability fields from API gateway/request context. */
  requestId: varchar('request_id', { length: 120 }),
  source: varchar('source', { length: 50 }).default('api').notNull(),
  ipAddress: varchar('ip_address', { length: 64 }),
  userAgent: varchar('user_agent', { length: 512 }),

  metadata: jsonb('metadata').default({}),
  createdAt: createdAt,
}, (table) => ({
  auditEventsOrgEntityIdx: index('audit_events_org_entity_idx').on(table.bizId, table.entityType, table.entityId),
  auditEventsOrgCreatedIdx: index('audit_events_org_created_idx').on(table.bizId, table.createdAt),
  auditEventsBookingIdx: index('audit_events_booking_idx').on(table.bookingId),
}))

/**
 * outbox_events
 *
 * Reliable async integration queue (webhooks, notifications, downstream sync).
 *
 * Ensures side effects happen exactly once even when API transactions retry.
 */
export const outboxEvents = pgTable('outbox_events', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  /** Aggregate identifies the business object that emitted the event. */
  aggregateType: varchar('aggregate_type', { length: 100 }).notNull(),
  aggregateId: idRef('aggregate_id'),
  eventType: varchar('event_type', { length: 120 }).notNull(),
  payload: jsonb('payload').notNull(),

  status: outboxStatusEnum('status').default('pending').notNull(),
  /** Retry controls for worker backoff and dead-letter logic. */
  attempts: integer('attempts').default(0).notNull(),
  maxAttempts: integer('max_attempts').default(10).notNull(),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
  lastError: varchar('last_error', { length: 2000 }),
  publishedAt: timestamp('published_at', { withTimezone: true }),

  createdAt: createdAt,
  updatedAt: updatedAt,
}, (table) => ({
  outboxEventsStatusIdx: index('outbox_events_status_idx').on(table.status, table.nextAttemptAt),
  outboxEventsAggregateIdx: index('outbox_events_aggregate_idx').on(table.aggregateType, table.aggregateId),
}))

/** Consent/e-sign evidence used by regulated booking flows. */
export const consentRecords = pgTable('consent_records', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  userId: idRef('user_id').references(() => users.id),
  bookingId: idRef('booking_id').references(() => bookings.id),
  /** Legal document type/version pair accepted by user/guardian. */
  consentType: varchar('consent_type', { length: 100 }).notNull(),
  consentVersion: varchar('consent_version', { length: 100 }).notNull(),
  granted: boolean('granted').default(true).notNull(),
  grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  signerType: varchar('signer_type', { length: 50 }).default('self').notNull(),
  signerName: varchar('signer_name', { length: 255 }),
  signerRelation: varchar('signer_relation', { length: 100 }),
  /** Evidence payload (signature artifact, device info, IP, etc.). */
  evidence: jsonb('evidence').default({}),
  metadata: jsonb('metadata').default({}),
  createdAt: createdAt,
  updatedAt: updatedAt,
}, (table) => ({
  consentRecordsOrgIdx: index('consent_records_org_idx').on(table.bizId, table.userId, table.consentType),
  consentRecordsBookingIdx: index('consent_records_booking_idx').on(table.bookingId),
}))

/**
 * incident_batches + incident_booking_actions
 *
 * Batch incident orchestration for emergency closures/mass rescheduling.
 *
 * Model:
 * - one incident batch defines context and policy.
 * - many incident booking actions track per-booking resolution work.
 */
export const incidentBatches = pgTable('incident_batches', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  incidentType: varchar('incident_type', { length: 100 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: varchar('description', { length: 2000 }),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  /** Decision policy used by automation/manual triage workers. */
  triagePolicy: jsonb('triage_policy').default({}),
  status: varchar('status', { length: 30 }).default('open').notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: createdAt,
  updatedAt: updatedAt,
}, (table) => ({
  incidentBatchesOrgStatusIdx: index('incident_batches_org_status_idx').on(table.bizId, table.status),
}))

export const incidentBookingActions = pgTable('incident_booking_actions', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  incidentBatchId: idRef('incident_batch_id').references(() => incidentBatches.id).notNull(),
  bookingId: idRef('booking_id').references(() => bookings.id).notNull(),
  /** Target booking action for incident resolution workflow. */
  actionType: varchar('action_type', { length: 100 }).notNull(),
  actionStatus: varchar('action_status', { length: 30 }).default('pending').notNull(),
  scheduledForDate: date('scheduled_for_date'),
  details: jsonb('details').default({}),
  createdAt: createdAt,
  updatedAt: updatedAt,
}, (table) => ({
  incidentBookingActionsOrgIdx: index('incident_booking_actions_org_idx').on(table.bizId, table.incidentBatchId),
  incidentBookingActionsBookingIdx: index('incident_booking_actions_booking_idx').on(table.bookingId),
}))

/**
 * external_channels + external_sync_events
 *
 * Generic partner/channel sync registry (OTAs, marketplaces, internal channels).
 *
 * Keeps external integration state auditable and retryable without coupling the
 * core booking tables to partner-specific schemas.
 */
export const externalChannels = pgTable('external_channels', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  /** Channel transport/category (`marketplace`, `calendar`, etc.). */
  channelType: varchar('channel_type', { length: 50 }).notNull(),
  status: varchar('status', { length: 30 }).default('active').notNull(),
  credentialsRef: varchar('credentials_ref', { length: 255 }),
  config: jsonb('config').default({}),
  createdAt: createdAt,
  updatedAt: updatedAt,
}, (table) => ({
  externalChannelsOrgNameUnique: uniqueIndex('external_channels_org_name_unique').on(table.bizId, table.name),
  externalChannelsOrgStatusIdx: index('external_channels_org_status_idx').on(table.bizId, table.status),
}))

export const externalSyncEvents = pgTable('external_sync_events', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  channelId: idRef('channel_id').references(() => externalChannels.id).notNull(),
  bookingId: idRef('booking_id').references(() => bookings.id),
  /** Direction tells if this was inbound pull or outbound push. */
  direction: varchar('direction', { length: 20 }).notNull(),
  eventType: varchar('event_type', { length: 120 }).notNull(),
  payload: jsonb('payload').notNull(),
  syncStatus: varchar('sync_status', { length: 30 }).default('pending').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  lastError: varchar('last_error', { length: 2000 }),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
  createdAt: createdAt,
  updatedAt: updatedAt,
}, (table) => ({
  externalSyncEventsOrgStatusIdx: index('external_sync_events_org_status_idx').on(table.bizId, table.syncStatus, table.nextRetryAt),
  externalSyncEventsBookingIdx: index('external_sync_events_booking_idx').on(table.bookingId),
}))

export type IdempotencyKey = typeof idempotencyKeys.$inferSelect
export type NewIdempotencyKey = typeof idempotencyKeys.$inferInsert

export type AuditEvent = typeof auditEvents.$inferSelect
export type NewAuditEvent = typeof auditEvents.$inferInsert

export type OutboxEvent = typeof outboxEvents.$inferSelect
export type NewOutboxEvent = typeof outboxEvents.$inferInsert

export type ConsentRecord = typeof consentRecords.$inferSelect
export type NewConsentRecord = typeof consentRecords.$inferInsert

export type IncidentBatch = typeof incidentBatches.$inferSelect
export type NewIncidentBatch = typeof incidentBatches.$inferInsert

export type IncidentBookingAction = typeof incidentBookingActions.$inferSelect
export type NewIncidentBookingAction = typeof incidentBookingActions.$inferInsert

export type ExternalChannel = typeof externalChannels.$inferSelect
export type NewExternalChannel = typeof externalChannels.$inferInsert

export type ExternalSyncEvent = typeof externalSyncEvents.$inferSelect
export type NewExternalSyncEvent = typeof externalSyncEvents.$inferInsert
