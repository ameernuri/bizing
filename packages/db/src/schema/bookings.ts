import { sql } from "drizzle-orm";
import { index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  decimal,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, deletedAt, id, idRef, updatedAt } from "./_common";
import { assets } from "./assets";
import { bookables } from "./bookables";
import {
  bookingAssignmentStatusEnum,
  bookingParticipantStatusEnum,
  bookingSegmentModeEnum,
  bookingSourceEnum,
  bookingStatusEnum,
  feeStatusEnum,
  feeTriggerEnum,
  feeTypeEnum,
  noteVisibilityEnum,
  paymentStatusEnum,
} from "./enums";
import { groupAccounts, groupAccountMembers } from "./group_accounts";
import { locations } from "./locations";
import { bizes } from "./bizes";
import { products } from "./products";
import { calendars } from "./scheduling";
import { services } from "./services";
import { users } from "./users";
import { venues } from "./venues";

/**
 * bookings
 *
 * Core transactional entity.
 *
 * Design intent:
 * - supports simple bookings (customer + time + price)
 * - scales to complex bookings (group accounts, multi-resource, follow-ups, fees)
 * - remains API-safe under retries (`idempotency_key` + event logs)
 */
export const bookings = pgTable(
  "bookings",
  {
    id: id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional location/calendar context for faster route/search filtering. */
    locationId: idRef("location_id").references(() => locations.id),
    calendarId: idRef("calendar_id").references(() => calendars.id),

    /** Service and optional directly referenced concrete resources. */
    serviceId: idRef("service_id").references(() => services.id),
    assetId: idRef("asset_id").references(() => assets.id),
    venueId: idRef("venue_id").references(() => venues.id),

    /** Who receives service and who initiated creation. */
    customerId: idRef("customer_id").references(() => users.id),
    groupAccountId: idRef("group_account_id").references(
      () => groupAccounts.id,
    ),
    bookedByUserId: idRef("booked_by_user_id").references(() => users.id),

    /** Snapshot contact fields for guest/imported booking flows. */
    customerName: varchar("customer_name", { length: 255 }),
    customerEmail: varchar("customer_email", { length: 255 }),
    customerPhone: varchar("customer_phone", { length: 50 }),

    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),
    durationMinutes: integer("duration_minutes").default(0).notNull(),

    /** Booking + payment lifecycle states. */
    status: bookingStatusEnum("status").default("draft").notNull(),
    paymentStatus: paymentStatusEnum("payment_status")
      .default("unpaid")
      .notNull(),

    participantCount: integer("participant_count").default(1).notNull(),
    maxParticipants: integer("max_participants"),

    /** Notes split by audience for safer UI rendering. */
    notes: varchar("notes", { length: 2000 }),
    customerNotes: varchar("customer_notes", { length: 2000 }),
    internalNotes: varchar("internal_notes", { length: 2000 }),

    /** Legacy decimal plus canonical integer money fields. */
    price: decimal("price", { precision: 10, scale: 2 }).default(sql`0`),
    subtotalAmount: integer("subtotal_amount").default(0).notNull(),
    feesAmount: integer("fees_amount").default(0).notNull(),
    discountsAmount: integer("discounts_amount").default(0).notNull(),
    taxAmount: integer("tax_amount").default(0).notNull(),
    totalAmount: integer("total_amount").default(0).notNull(),
    depositAmount: integer("deposit_amount").default(0).notNull(),
    paidAmount: integer("paid_amount").default(0).notNull(),
    refundedAmount: integer("refunded_amount").default(0).notNull(),
    balanceAmount: integer("balance_amount").default(0).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Immutable pricing evidence used for invoice/audit reconstruction. */
    pricingSnapshot: jsonb("pricing_snapshot").default({}),

    /** Booking channel origin. */
    source: bookingSourceEnum("source").default("web"),

    /** Idempotency guard for create endpoint retries. */
    idempotencyKey: varchar("idempotency_key", { length: 255 }),

    /** Public-safe code for support lookups and customer communications. */
    confirmationCode: varchar("confirmation_code", { length: 64 }),

    /** Operational markers used in no-show/arrival/callout-fee scenarios. */
    isWalkIn: boolean("is_walk_in").default(false).notNull(),
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    noShowAt: timestamp("no_show_at", { withTimezone: true }),

    /** Cancellation trail. */
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByUserId: idRef("cancelled_by_user_id").references(() => users.id),
    cancellationReason: varchar("cancellation_reason", { length: 500 }),

    metadata: jsonb("metadata").default({}),

    createdAt: createdAt,
    updatedAt: updatedAt,
    deletedAt: deletedAt,
  },
  (table) => ({
    bookingsOrgStartIdx: index("bookings_org_start_idx").on(
      table.bizId,
      table.startTime,
    ),
    bookingsOrgStatusIdx: index("bookings_org_status_idx").on(
      table.bizId,
      table.status,
    ),
    bookingsServiceIdx: index("bookings_service_idx").on(table.serviceId),
    bookingsCustomerIdx: index("bookings_customer_idx").on(table.customerId),
    bookingsConfirmationUnique: uniqueIndex("bookings_confirmation_unique").on(
      table.bizId,
      table.confirmationCode,
    ),
    bookingsIdempotencyUnique: uniqueIndex("bookings_idempotency_unique").on(
      table.bizId,
      table.idempotencyKey,
    ),
  }),
);

/**
 * booking_participants
 *
 * Additional attendees/participants tied to a booking.
 * Enables family/group bookings and role-aware check-in.
 */
export const bookingParticipants = pgTable(
  "booking_participants",
  {
    id: id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    bookingId: idRef("booking_id")
      .references(() => bookings.id)
      .notNull(),
    userId: idRef("user_id").references(() => users.id),
    groupAccountMemberId: idRef("group_account_member_id").references(
      () => groupAccountMembers.id,
    ),

    role: varchar("role", { length: 50 }).default("primary").notNull(),
    name: varchar("name", { length: 255 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),

    status: bookingParticipantStatusEnum("status")
      .default("confirmed")
      .notNull(),
    isObserver: boolean("is_observer").default(false).notNull(),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),

    metadata: jsonb("metadata").default({}),

    createdAt: createdAt,
    updatedAt: updatedAt,
    deletedAt: deletedAt,
  },
  (table) => ({
    bookingParticipantsUnique: uniqueIndex("booking_participants_unique").on(
      table.bookingId,
      table.userId,
      table.email,
    ),
    bookingParticipantsOrgIdx: index("booking_participants_org_idx").on(
      table.bizId,
      table.bookingId,
    ),
  }),
);

/**
 * booking_assignments
 *
 * Concrete resource/host assignment rows for one booking.
 * Supports required + backup assignment patterns.
 */
export const bookingAssignments = pgTable(
  "booking_assignments",
  {
    id: id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    bookingId: idRef("booking_id")
      .references(() => bookings.id)
      .notNull(),
    bookableId: idRef("bookable_id")
      .references(() => bookables.id)
      .notNull(),

    role: varchar("role", { length: 50 }).default("primary").notNull(),
    isRequired: boolean("is_required").default(true).notNull(),
    isBackup: boolean("is_backup").default(false).notNull(),
    status: bookingAssignmentStatusEnum("status").default("pending").notNull(),

    /** For company-host dispatch, records selected technician. */
    assignedTechnicianUserId: idRef("assigned_technician_user_id").references(
      () => users.id,
    ),

    compensationAmount: integer("compensation_amount").default(0).notNull(),
    metadata: jsonb("metadata").default({}),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),

    createdAt: createdAt,
    updatedAt: updatedAt,
    deletedAt: deletedAt,
  },
  (table) => ({
    bookingAssignmentsUnique: uniqueIndex("booking_assignments_unique").on(
      table.bookingId,
      table.bookableId,
      table.role,
    ),
    bookingAssignmentsOrgIdx: index("booking_assignments_org_idx").on(
      table.bizId,
      table.bookingId,
    ),
    bookingAssignmentsStatusIdx: index("booking_assignments_status_idx").on(
      table.status,
    ),
  }),
);

/**
 * booking_segments
 *
 * Multi-leg bookings (virtual + in-person, or split-phase visits).
 */
export const bookingSegments = pgTable(
  "booking_segments",
  {
    id: id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    bookingId: idRef("booking_id")
      .references(() => bookings.id)
      .notNull(),

    sequenceNo: integer("sequence_no").notNull(),
    mode: bookingSegmentModeEnum("mode").default("in_person").notNull(),
    locationId: idRef("location_id").references(() => locations.id),

    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),

    /** For virtual segments when generated by meeting host platform. */
    meetingUrl: varchar("meeting_url", { length: 1000 }),

    metadata: jsonb("metadata").default({}),

    createdAt: createdAt,
    updatedAt: updatedAt,
  },
  (table) => ({
    bookingSegmentsUnique: uniqueIndex("booking_segments_unique").on(
      table.bookingId,
      table.sequenceNo,
    ),
    bookingSegmentsOrgIdx: index("booking_segments_org_idx").on(
      table.bizId,
      table.bookingId,
    ),
  }),
);

/** Public/private/system notes attached to a booking timeline. */
export const bookingNotes = pgTable(
  "booking_notes",
  {
    id: id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    bookingId: idRef("booking_id")
      .references(() => bookings.id)
      .notNull(),
    authorUserId: idRef("author_user_id").references(() => users.id),
    visibility: noteVisibilityEnum("visibility").default("private").notNull(),
    body: varchar("body", { length: 5000 }).notNull(),
    metadata: jsonb("metadata").default({}),
    createdAt: createdAt,
  },
  (table) => ({
    bookingNotesOrgIdx: index("booking_notes_org_idx").on(
      table.bizId,
      table.bookingId,
      table.visibility,
    ),
  }),
);

/**
 * booking_fees
 *
 * Materialized fee line-items after evaluating `fee_policies`.
 */
export const bookingFees = pgTable(
  "booking_fees",
  {
    id: id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    bookingId: idRef("booking_id")
      .references(() => bookings.id)
      .notNull(),
    productId: idRef("product_id").references(() => products.id),

    feeType: feeTypeEnum("fee_type").notNull(),
    trigger: feeTriggerEnum("trigger").notNull(),
    status: feeStatusEnum("status").default("applied").notNull(),

    label: varchar("label", { length: 255 }).notNull(),
    amount: integer("amount").default(0).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Used for visit fees that become invoice credit on completed work. */
    creditTowardInvoice: boolean("credit_toward_invoice")
      .default(false)
      .notNull(),

    waivedByUserId: idRef("waived_by_user_id").references(() => users.id),
    waivedReason: varchar("waived_reason", { length: 500 }),

    metadata: jsonb("metadata").default({}),
    createdAt: createdAt,
    updatedAt: updatedAt,
  },
  (table) => ({
    bookingFeesOrgIdx: index("booking_fees_org_idx").on(
      table.bizId,
      table.bookingId,
      table.feeType,
    ),
  }),
);

/**
 * booking_events
 *
 * Domain event stream specific to booking lifecycle operations.
 * Complements global `audit_events` with booking-focused payloads.
 */
export const bookingEvents = pgTable(
  "booking_events",
  {
    id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    bookingId: idRef("booking_id")
      .references(() => bookings.id)
      .notNull(),
    actorUserId: idRef("actor_user_id").references(() => users.id),
    actorAuthUserId: varchar("actor_auth_user_id", { length: 255 }),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    eventPayload: jsonb("event_payload").default({}),
    reason: varchar("reason", { length: 500 }),
    source: varchar("source", { length: 50 }).default("system").notNull(),
    createdAt: createdAt,
  },
  (table) => ({
    bookingEventsOrgIdx: index("booking_events_org_idx").on(
      table.bizId,
      table.bookingId,
      table.createdAt,
    ),
    bookingEventsTypeIdx: index("booking_events_type_idx").on(table.eventType),
  }),
);

/**
 * booking_transfers
 *
 * Transfer token + acceptance flow for transferring attendance ownership.
 */
export const bookingTransfers = pgTable(
  "booking_transfers",
  {
    id: id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    bookingId: idRef("booking_id")
      .references(() => bookings.id)
      .notNull(),
    fromUserId: idRef("from_user_id")
      .references(() => users.id)
      .notNull(),
    toUserId: idRef("to_user_id").references(() => users.id),
    transferToken: varchar("transfer_token", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    status: varchar("status", { length: 30 }).default("pending").notNull(),
    metadata: jsonb("metadata").default({}),
    createdAt: createdAt,
    updatedAt: updatedAt,
  },
  (table) => ({
    bookingTransfersTokenUnique: uniqueIndex(
      "booking_transfers_token_unique",
    ).on(table.transferToken),
    bookingTransfersOrgIdx: index("booking_transfers_org_idx").on(
      table.bizId,
      table.bookingId,
    ),
  }),
);

/**
 * booking_followups
 *
 * Parent-child follow-up requirements used by clinical/post-care flows.
 */
export const bookingFollowups = pgTable(
  "booking_followups",
  {
    id: id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    parentBookingId: idRef("parent_booking_id")
      .references(() => bookings.id)
      .notNull(),
    followupBookingId: idRef("followup_booking_id").references(
      () => bookings.id,
    ),
    requiredByRole: varchar("required_by_role", { length: 50 })
      .default("host")
      .notNull(),
    isMandatory: boolean("is_mandatory").default(true).notNull(),
    dueBy: timestamp("due_by", { withTimezone: true }),
    status: varchar("status", { length: 30 }).default("pending").notNull(),
    metadata: jsonb("metadata").default({}),
    createdAt: createdAt,
    updatedAt: updatedAt,
  },
  (table) => ({
    bookingFollowupsOrgIdx: index("booking_followups_org_idx").on(
      table.bizId,
      table.parentBookingId,
      table.status,
    ),
  }),
);

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;

export type BookingParticipant = typeof bookingParticipants.$inferSelect;
export type NewBookingParticipant = typeof bookingParticipants.$inferInsert;

export type BookingAssignment = typeof bookingAssignments.$inferSelect;
export type NewBookingAssignment = typeof bookingAssignments.$inferInsert;

export type BookingSegment = typeof bookingSegments.$inferSelect;
export type NewBookingSegment = typeof bookingSegments.$inferInsert;

export type BookingNote = typeof bookingNotes.$inferSelect;
export type NewBookingNote = typeof bookingNotes.$inferInsert;

export type BookingFee = typeof bookingFees.$inferSelect;
export type NewBookingFee = typeof bookingFees.$inferInsert;

export type BookingEvent = typeof bookingEvents.$inferSelect;
export type NewBookingEvent = typeof bookingEvents.$inferInsert;

export type BookingTransfer = typeof bookingTransfers.$inferSelect;
export type NewBookingTransfer = typeof bookingTransfers.$inferInsert;

export type BookingFollowup = typeof bookingFollowups.$inferSelect;
export type NewBookingFollowup = typeof bookingFollowups.$inferInsert;
