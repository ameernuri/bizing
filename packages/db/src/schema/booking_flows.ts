import { index, uniqueIndex } from 'drizzle-orm/pg-core'
import { boolean, date, integer, jsonb, pgTable, time, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { createdAt, deletedAt, id, idRef, updatedAt } from './_common'
import { reservationHoldReasonEnum, reservationStatusEnum, waitlistModeEnum, waitlistStatusEnum } from './enums'
import { bookings } from './bookings'
import { calendars } from './scheduling'
import { groupAccounts } from './group_accounts'
import { locations } from './locations'
import { bizes } from './bizes'
import { services } from './services'
import { users } from './users'

/**
 * reservations
 *
 * Temporary holds used before booking confirmation.
 *
 * This table is the concurrency hinge for:
 * - checkout holds
 * - cooldown holds
 * - waitlist offer holds
 *
 * Relationship map:
 * - May start from a booking draft and later convert to confirmed booking.
 * - `waitlist_entries.offered_reservation_id` points here for waitlist offers.
 */
export const reservations = pgTable('reservations', {
  id: id,

  /** Tenant boundary for hold queries and cleanup jobs. */
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),

  /** Optional pre-existing booking draft linked to this hold. */
  bookingId: idRef('booking_id').references(() => bookings.id),

  /** Catalog/schedule pointers used during slot locking. */
  serviceId: idRef('service_id').references(() => services.id),
  calendarId: idRef('calendar_id').references(() => calendars.id),
  locationId: idRef('location_id').references(() => locations.id),

  /** Requesting identity (individual or group account). */
  userId: idRef('user_id').references(() => users.id),
  groupAccountId: idRef('group_account_id').references(() => groupAccounts.id),

  /** Exact held interval in tenant-aware timestamptz values. */
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),

  status: reservationStatusEnum('status').default('active').notNull(),
  holdReason: reservationHoldReasonEnum('hold_reason').default('checkout').notNull(),

  /** Expiry strategy consumed by reservation worker jobs. */
  onExpiry: varchar('on_expiry', { length: 50 }).default('release_slot').notNull(),

  /** Hard expiration timestamp for automatic cleanup/release. */
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

  /** Filled when hold successfully becomes a real booking. */
  convertedToBookingId: idRef('converted_to_booking_id').references(() => bookings.id),

  extensionCount: integer('extension_count').default(0).notNull(),
  maxExtensions: integer('max_extensions').default(0).notNull(),

  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
  deletedAt: deletedAt,
}, (table) => ({
  reservationsOrgStatusIdx: index('reservations_org_status_idx').on(table.bizId, table.status, table.expiresAt),
  reservationsBookingUnique: uniqueIndex('reservations_booking_unique').on(table.bookingId),
}))

/**
 * waitlist_entries
 *
 * Supports both queue and race waitlist patterns.
 *
 * Queue mode: `position` + priority
 * Race mode: parallel offers, first claim wins
 *
 * Relationship map:
 * - Can generate `reservations` offers.
 * - Can convert into `bookings` upon acceptance.
 */
export const waitlistEntries = pgTable('waitlist_entries', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  serviceId: idRef('service_id').references(() => services.id).notNull(),
  locationId: idRef('location_id').references(() => locations.id),
  userId: idRef('user_id').references(() => users.id),
  groupAccountId: idRef('group_account_id').references(() => groupAccounts.id),

  mode: waitlistModeEnum('mode').default('queue').notNull(),
  status: waitlistStatusEnum('status').default('waiting').notNull(),

  priorityTier: integer('priority_tier').default(0).notNull(),
  position: integer('position'),

  autoAccept: boolean('auto_accept').default(false).notNull(),

  /** Optional waitlist join fee model. */
  joinedFeeAmount: integer('joined_fee_amount').default(0).notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),

  /** Preferred window constraints for slot matching. */
  preferredDate: date('preferred_date'),
  preferredStartTime: time('preferred_start_time'),
  preferredEndTime: time('preferred_end_time'),

  /** Offer lifecycle timestamps + reservation linkage. */
  offeredAt: timestamp('offered_at', { withTimezone: true }),
  offerExpiresAt: timestamp('offer_expires_at', { withTimezone: true }),
  offeredReservationId: idRef('offered_reservation_id').references(() => reservations.id),

  /** Set when entry is converted into a confirmed booking. */
  convertedBookingId: idRef('converted_booking_id').references(() => bookings.id),

  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
  deletedAt: deletedAt,
}, (table) => ({
  waitlistEntriesOrgServiceIdx: index('waitlist_entries_org_service_idx').on(table.bizId, table.serviceId, table.status),
  waitlistEntriesOfferIdx: index('waitlist_entries_offer_idx').on(table.offerExpiresAt),
}))

/**
 * recurring_booking_rules
 *
 * Template rules for recurring bookings.
 * Uses an RRULE string to keep recurrence logic explicit and API-compatible.
 *
 * Relationship map:
 * - Parent table for generated `recurring_booking_occurrences`.
 * - Occurrences may later link to concrete `bookings`.
 */
export const recurringBookingRules = pgTable('recurring_booking_rules', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  serviceId: idRef('service_id').references(() => services.id).notNull(),
  locationId: idRef('location_id').references(() => locations.id),
  userId: idRef('user_id').references(() => users.id).notNull(),
  groupAccountId: idRef('group_account_id').references(() => groupAccounts.id),

  timezone: varchar('timezone', { length: 50 }).default('UTC').notNull(),
  rrule: varchar('rrule', { length: 500 }).notNull(),

  /** Active date window where recurrence expansion is permitted. */
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  maxOccurrences: integer('max_occurrences'),

  /** Dates to skip (holidays, personal blocks, etc.). */
  exceptions: jsonb('exceptions').default([]),
  defaultStartTime: time('default_start_time'),
  durationMinutes: integer('duration_minutes'),

  /** Optional participant/resource defaults for generated bookings. */
  participantConfig: jsonb('participant_config').default({}),
  assignmentStrategy: jsonb('assignment_strategy').default({}),

  status: varchar('status', { length: 30 }).default('active').notNull(),
  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
  deletedAt: deletedAt,
}, (table) => ({
  recurringRulesOrgStatusIdx: index('recurring_rules_org_status_idx').on(table.bizId, table.status),
  recurringRulesUserIdx: index('recurring_rules_user_idx').on(table.userId, table.startDate),
}))

/**
 * recurring_booking_occurrences
 *
 * Materialized occurrence instances generated from recurring rules.
 *
 * Keeps generated calendar instances queryable and mutable independently.
 */
export const recurringBookingOccurrences = pgTable('recurring_booking_occurrences', {
  id: id,
  bizId: idRef('biz_id').references(() => bizes.id).notNull(),
  recurringRuleId: idRef('recurring_rule_id').references(() => recurringBookingRules.id).notNull(),
  bookingId: idRef('booking_id').references(() => bookings.id),

  /** Occurrence date key used for dedupe and operational indexing. */
  occurrenceDate: date('occurrence_date').notNull(),
  startTime: timestamp('start_time', { withTimezone: true }),
  endTime: timestamp('end_time', { withTimezone: true }),

  status: varchar('status', { length: 30 }).default('scheduled').notNull(),
  metadata: jsonb('metadata').default({}),

  createdAt: createdAt,
  updatedAt: updatedAt,
}, (table) => ({
  recurringOccurrencesUnique: uniqueIndex('recurring_occurrences_unique').on(table.recurringRuleId, table.occurrenceDate),
  recurringOccurrencesOrgIdx: index('recurring_occurrences_org_idx').on(table.bizId, table.occurrenceDate),
}))

export type Reservation = typeof reservations.$inferSelect
export type NewReservation = typeof reservations.$inferInsert

export type WaitlistEntry = typeof waitlistEntries.$inferSelect
export type NewWaitlistEntry = typeof waitlistEntries.$inferInsert

export type RecurringBookingRule = typeof recurringBookingRules.$inferSelect
export type NewRecurringBookingRule = typeof recurringBookingRules.$inferInsert

export type RecurringBookingOccurrence = typeof recurringBookingOccurrences.$inferSelect
export type NewRecurringBookingOccurrence = typeof recurringBookingOccurrences.$inferInsert
