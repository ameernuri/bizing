import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { groupAccounts } from "./group_accounts";
import { locations } from "./locations";
import { resources } from "./resources";
import { users } from "./users";
import {
  bookingOrderLineTypeEnum,
  fulfillmentAssignmentEventTypeEnum,
  fulfillmentAssignmentConflictPolicyEnum,
  bookingOrderStatusEnum,
  fulfillmentAssignmentStatusEnum,
  fulfillmentCheckpointStatusEnum,
  fulfillmentCheckpointTypeEnum,
  fulfillmentDependencyTypeEnum,
  fulfillmentUnitKindEnum,
  fulfillmentUnitStatusEnum,
  standingReservationContractStatusEnum,
  standingReservationExceptionActionEnum,
  standingReservationOccurrenceStatusEnum,
} from "./enums";
import {
  offerComponentSeatTypes,
  offerComponents,
  offerVersions,
  offers,
} from "./offers";
import { calendarBindings } from "./time_availability";
import { bizConfigValues } from "./biz_configs";

/**
 * standing_reservation_contracts
 *
 * ELI5:
 * This is a "repeat this booking pattern every week/month" contract.
 *
 * Why this exists:
 * - recurring reservations are common (therapy every Tuesday, tutoring every
 *   Thursday, recurring room bookings, recurring vehicle rentals),
 * - generating these from ad-hoc app rules is fragile and hard to audit,
 * - this table stores one durable recurring commitment with clear lifecycle.
 *
 * Relationship map:
 * - points to immutable sellable context (`offer` + `offer_version`)
 * - points to exactly one customer anchor (user OR group account)
 * - generates `standing_reservation_occurrences`
 * - those occurrences can later create real `booking_orders`
 */
export const standingReservationContracts = pgTable(
  "standing_reservation_contracts",
  {
    /** Stable primary key for one recurring commitment. */
    id: idWithTag("standing_contract"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Offer shell for quick commerce navigation and reporting.
     * We keep this alongside offer_version for simpler API reads.
     */
    offerId: idRef("offer_id")
      .references(() => offers.id)
      .notNull(),

    /**
     * Immutable sellable version this recurring contract is based on.
     * Contract behavior should stay explainable even if future versions change.
     */
    offerVersionId: idRef("offer_version_id")
      .references(() => offerVersions.id)
      .notNull(),

    /** Optional default location used when generating occurrences/orders. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Optional direct customer user anchor (individual recurring plan). */
    customerUserId: idRef("customer_user_id").references(() => users.id),

    /**
     * Optional group-account customer anchor (family/company recurring plan).
     * Exactly one of customer_user_id / customer_group_account_id is required.
     */
    customerGroupAccountId: idRef("customer_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Human-readable recurring-plan name for admin/operator screens. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Optional long description/notes of this recurring agreement. */
    description: text("description"),

    /** Contract lifecycle state (draft/active/paused/completed/etc). */
    status: standingReservationContractStatusEnum("status")
      .default("draft")
      .notNull(),

    /**
     * Optional configurable dictionary value for tenant-facing contract status wording.
     * Canonical status still drives deterministic engine behavior.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /**
     * Timezone used to interpret recurrence semantics.
     * Keeps weekly/monthly local-time logic stable across DST boundaries.
     */
    timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),

    /**
     * First anchor start instant of the series.
     * Recurrence engines expand from this anchor + recurrence_rule.
     */
    anchorStartAt: timestamp("anchor_start_at", { withTimezone: true }).notNull(),

    /**
     * Default occurrence duration in minutes when no override is present.
     * Useful for predictable generation and conflict preview.
     */
    defaultDurationMin: integer("default_duration_min").default(60).notNull(),

    /**
     * Recurrence expression in RRULE style.
     * Example: `FREQ=WEEKLY;BYDAY=TU;INTERVAL=1`.
     */
    recurrenceRule: varchar("recurrence_rule", { length: 500 }).notNull(),

    /** Local effective start date for this contract's generation window. */
    effectiveStartDate: date("effective_start_date").notNull(),

    /** Local effective end date; null means open-ended until cancelled/completed. */
    effectiveEndDate: date("effective_end_date"),

    /** If true, scheduler can auto-create booking orders for generated occurrences. */
    autoCreateOrders: boolean("auto_create_orders").default(true).notNull(),

    /**
     * Max days ahead to pre-generate occurrences.
     * Prevents infinite/huge generation loops for long-running contracts.
     */
    maxGeneratedAheadDays: integer("max_generated_ahead_days")
      .default(60)
      .notNull(),

    /** Optional pointer for next expected occurrence timestamp (engine helper). */
    nextPlannedOccurrenceAt: timestamp("next_planned_occurrence_at", {
      withTimezone: true,
    }),

    /** Last timestamp when the generator produced occurrences for this contract. */
    lastOccurrenceGeneratedAt: timestamp("last_occurrence_generated_at", {
      withTimezone: true,
    }),

    /** Pause start timestamp when contract is temporarily suspended. */
    pausedAt: timestamp("paused_at", { withTimezone: true }),

    /** Planned resume timestamp when pause window is known upfront. */
    resumeAt: timestamp("resume_at", { withTimezone: true }),

    /**
     * Immutable contract policy snapshot for explainability.
     * Example: cancellation semantics, skip rules, bill-on-skip policy.
     */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Extension payload for non-indexed recurring-plan details. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe child references. */
    standingReservationContractsBizIdIdUnique: uniqueIndex(
      "standing_reservation_contracts_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Common ops path: contract board by lifecycle and next upcoming occurrence. */
    standingReservationContractsBizStatusNextIdx: index(
      "standing_reservation_contracts_biz_status_next_idx",
    ).on(table.bizId, table.status, table.nextPlannedOccurrenceAt),

    /** Common customer history path for recurring commitments. */
    standingReservationContractsBizCustomerIdx: index(
      "standing_reservation_contracts_biz_customer_idx",
    ).on(table.bizId, table.customerUserId, table.customerGroupAccountId),

    /** Useful filter path by sellable anchor. */
    standingReservationContractsBizOfferVersionIdx: index(
      "standing_reservation_contracts_biz_offer_version_idx",
    ).on(table.bizId, table.offerVersionId),

    standingReservationContractsBizStatusConfigIdx: index(
      "standing_reservation_contracts_biz_status_config_idx",
    ).on(table.bizId, table.statusConfigValueId),

    /** Tenant-safe FK to offer shell. */
    standingReservationContractsBizOfferFk: foreignKey({
      columns: [table.bizId, table.offerId],
      foreignColumns: [offers.bizId, offers.id],
      name: "standing_reservation_contracts_biz_offer_fk",
    }),

    /** Tenant-safe FK to offer version. */
    standingReservationContractsBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "standing_reservation_contracts_biz_offer_version_fk",
    }),

    /** Tenant-safe FK to optional default location. */
    standingReservationContractsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "standing_reservation_contracts_biz_location_fk",
    }),

    /** Tenant-safe FK to optional configurable status wording. */
    standingReservationContractsBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "standing_reservation_contracts_biz_status_config_fk",
    }),

    /**
     * Exactly one customer anchor must be present.
     * This keeps recurring ownership unambiguous.
     */
    standingReservationContractsCustomerShapeCheck: check(
      "standing_reservation_contracts_customer_shape_check",
      sql`
      (
        ("customer_user_id" IS NOT NULL)::int
        + ("customer_group_account_id" IS NOT NULL)::int
      ) = 1
      `,
    ),

    /** Duration and generation horizon must be positive/non-negative. */
    standingReservationContractsBoundsCheck: check(
      "standing_reservation_contracts_bounds_check",
      sql`"default_duration_min" > 0 AND "max_generated_ahead_days" >= 0`,
    ),

    /** Effective date range must be ordered when end date exists. */
    standingReservationContractsDateRangeCheck: check(
      "standing_reservation_contracts_date_range_check",
      sql`"effective_end_date" IS NULL OR "effective_end_date" >= "effective_start_date"`,
    ),

    /** Resume cannot be before pause when both timestamps are present. */
    standingReservationContractsPauseWindowCheck: check(
      "standing_reservation_contracts_pause_window_check",
      sql`"paused_at" IS NULL OR "resume_at" IS NULL OR "resume_at" > "paused_at"`,
    ),
  }),
);

/**
 * standing_reservation_exceptions
 *
 * ELI5:
 * Exceptions are one-off override rules layered on top of a standing contract.
 *
 * Typical examples:
 * - skip one holiday occurrence
 * - move one occurrence to a different time
 * - pause recurring generation for a vacation window
 */
export const standingReservationExceptions = pgTable(
  "standing_reservation_exceptions",
  {
    /** Stable primary key for one override directive. */
    id: idWithTag("standing_exception"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent recurring contract receiving this override. */
    standingReservationContractId: idRef("standing_reservation_contract_id")
      .references(() => standingReservationContracts.id)
      .notNull(),

    /** Action type describing how recurrence behavior should be altered. */
    action: standingReservationExceptionActionEnum("action").notNull(),

    /**
     * Optional deterministic occurrence key this exception targets.
     * Useful when recurrence rules produce explicit series keys.
     */
    targetOccurrenceKey: varchar("target_occurrence_key", { length: 120 }),

    /** Optional local date target when key-based targeting is not available. */
    targetLocalDate: date("target_local_date"),

    /** Override/pause window start timestamp (action-dependent). */
    overrideStartAt: timestamp("override_start_at", { withTimezone: true }),

    /** Override/pause window end timestamp (action-dependent). */
    overrideEndAt: timestamp("override_end_at", { withTimezone: true }),

    /** Optional location override for rescheduled occurrence generation. */
    overrideLocationId: idRef("override_location_id").references(
      () => locations.id,
    ),

    /** Optional sellable override for rescheduled occurrence generation. */
    overrideOfferVersionId: idRef("override_offer_version_id").references(
      () => offerVersions.id,
    ),

    /** Human-readable reason/note for operators and audits. */
    reason: text("reason"),

    /** Active toggle so historical exception rows can be retired safely. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Extension payload for advanced override semantics. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe references. */
    standingReservationExceptionsBizIdIdUnique: uniqueIndex(
      "standing_reservation_exceptions_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Common expansion path for recurrence-engine override loading. */
    standingReservationExceptionsBizContractActionIdx: index(
      "standing_reservation_exceptions_biz_contract_action_idx",
    ).on(table.bizId, table.standingReservationContractId, table.action, table.isActive),

    /** Efficient lookup path for date-targeted exceptions. */
    standingReservationExceptionsBizContractDateIdx: index(
      "standing_reservation_exceptions_biz_contract_date_idx",
    ).on(table.bizId, table.standingReservationContractId, table.targetLocalDate),

    /** Tenant-safe FK to parent contract. */
    standingReservationExceptionsBizContractFk: foreignKey({
      columns: [table.bizId, table.standingReservationContractId],
      foreignColumns: [standingReservationContracts.bizId, standingReservationContracts.id],
      name: "standing_reservation_exceptions_biz_contract_fk",
    }),

    /** Tenant-safe FK to optional override location. */
    standingReservationExceptionsBizLocationFk: foreignKey({
      columns: [table.bizId, table.overrideLocationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "standing_reservation_exceptions_biz_location_fk",
    }),

    /** Tenant-safe FK to optional override offer version. */
    standingReservationExceptionsBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.overrideOfferVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "standing_reservation_exceptions_biz_offer_version_fk",
    }),

    /**
     * Global override window ordering.
     * Specific action shapes are validated separately below.
     */
    standingReservationExceptionsWindowCheck: check(
      "standing_reservation_exceptions_window_check",
      sql`"override_start_at" IS NULL OR "override_end_at" IS NULL OR "override_end_at" > "override_start_at"`,
    ),

    /**
     * Action-specific payload shape contract.
     *
     * This prevents partially-valid exception rows that are ambiguous at runtime.
     */
    standingReservationExceptionsActionShapeCheck: check(
      "standing_reservation_exceptions_action_shape_check",
      sql`
      (
        "action" IN ('skip_occurrence', 'cancel_occurrence')
        AND ("target_occurrence_key" IS NOT NULL OR "target_local_date" IS NOT NULL)
        AND "override_start_at" IS NULL
        AND "override_end_at" IS NULL
        AND "override_location_id" IS NULL
        AND "override_offer_version_id" IS NULL
      ) OR (
        "action" = 'reschedule_occurrence'
        AND ("target_occurrence_key" IS NOT NULL OR "target_local_date" IS NOT NULL)
        AND "override_start_at" IS NOT NULL
        AND "override_end_at" IS NOT NULL
      ) OR (
        "action" = 'pause_window'
        AND "target_occurrence_key" IS NULL
        AND "target_local_date" IS NULL
        AND "override_start_at" IS NOT NULL
        AND "override_end_at" IS NOT NULL
        AND "override_location_id" IS NULL
        AND "override_offer_version_id" IS NULL
      )
      `,
    ),
  }),
);

/**
 * booking_orders
 *
 * ELI5:
 * This is the contract root for one customer purchase intent.
 * One order can produce many fulfillment units (steps/legs/tasks).
 *
 * Why this split matters:
 * - order = commercial contract and money context,
 * - units = operational execution graph.
 */
export const bookingOrders = pgTable(
  "booking_orders",
  {
    /** Stable primary key for one booking contract. */
    id: idWithTag("booking_order"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Offer shell referenced for quick analytics/navigation. */
    offerId: idRef("offer_id")
      .references(() => offers.id)
      .notNull(),

    /** Immutable offer version snapshot used for this order. */
    offerVersionId: idRef("offer_version_id")
      .references(() => offerVersions.id)
      .notNull(),

    /** Optional direct customer user record. */
    customerUserId: idRef("customer_user_id").references(() => users.id),

    /**
     * Optional group account for household/company bookings.
     * Useful when one account books on behalf of many participants.
     */
    customerGroupAccountId: idRef("customer_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Commercial lifecycle status. */
    status: bookingOrderStatusEnum("status").default("draft").notNull(),
    /**
     * Optional biz-config dictionary value for booking-order status wording.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Settlement currency for this order. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Subtotal in minor units before tax/fees/discounts. */
    subtotalMinor: integer("subtotal_minor").default(0).notNull(),

    /** Tax amount in minor units. */
    taxMinor: integer("tax_minor").default(0).notNull(),

    /** Fee amount in minor units (callout fees, booking fees, etc.). */
    feeMinor: integer("fee_minor").default(0).notNull(),

    /** Discount amount in minor units. */
    discountMinor: integer("discount_minor").default(0).notNull(),

    /** Final total in minor units. */
    totalMinor: integer("total_minor").default(0).notNull(),

    /** Requested start (customer intent before final assignment). */
    requestedStartAt: timestamp("requested_start_at", { withTimezone: true }),

    /** Requested end (customer intent). */
    requestedEndAt: timestamp("requested_end_at", { withTimezone: true }),

    /** Confirmed start after allocation/approval. */
    confirmedStartAt: timestamp("confirmed_start_at", { withTimezone: true }),

    /** Confirmed end after allocation/approval. */
    confirmedEndAt: timestamp("confirmed_end_at", { withTimezone: true }),

    /**
     * Pricing snapshot copied at purchase to make invoices/explanations stable.
     * Should mirror relevant offer_version pricing config at the time of order.
     */
    pricingSnapshot: jsonb("pricing_snapshot").default({}).notNull(),

    /**
     * Policy snapshot used for cancellation/refund/approval semantics.
     * Also keeps behavior deterministic if offer policy changes later.
     */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Additional non-indexed business attributes. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    bookingOrdersBizIdIdUnique: uniqueIndex("booking_orders_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key for tenant-safe child FKs. */

    /** Common list path for operations dashboards. */
    bookingOrdersBizStatusIdx: index("booking_orders_biz_status_idx").on(
      table.bizId,
      table.status,
      table.confirmedStartAt,
    ),
    bookingOrdersBizStatusConfigIdx: index("booking_orders_biz_status_config_idx").on(
      table.bizId,
      table.statusConfigValueId,
    ),

    /** Common list path for customer history views. */
    bookingOrdersBizCustomerIdx: index("booking_orders_biz_customer_idx").on(
      table.bizId,
      table.customerUserId,
      table.confirmedStartAt,
    ),

    /** Tenant-safe FK to offer shell. */
    bookingOrdersBizOfferFk: foreignKey({
      columns: [table.bizId, table.offerId],
      foreignColumns: [offers.bizId, offers.id],
      name: "booking_orders_biz_offer_fk",
    }),

    /** Tenant-safe FK to offer version. */
    bookingOrdersBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "booking_orders_biz_offer_version_fk",
    }),
    /** Tenant-safe FK to optional configurable booking-order status. */
    bookingOrdersBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "booking_orders_biz_status_config_fk",
    }),

    /** Time windows must be ordered if set. */
    bookingOrdersRequestedWindowCheck: check(
      "booking_orders_requested_window_check",
      sql`"requested_start_at" IS NULL OR "requested_end_at" IS NULL OR "requested_end_at" > "requested_start_at"`,
    ),

    /** Confirmed windows must be ordered if set. */
    bookingOrdersConfirmedWindowCheck: check(
      "booking_orders_confirmed_window_check",
      sql`"confirmed_start_at" IS NULL OR "confirmed_end_at" IS NULL OR "confirmed_end_at" > "confirmed_start_at"`,
    ),

    /** Monetary fields should be non-negative except discounts. */
    bookingOrdersMoneyBoundsCheck: check(
      "booking_orders_money_bounds_check",
      sql`
      "subtotal_minor" >= 0
      AND "tax_minor" >= 0
      AND "fee_minor" >= 0
      AND "discount_minor" >= 0
      `,
    ),

    /**
     * Prevent over-discounting the order below zero.
     *
     * This keeps invoice math sane and avoids negative totals caused purely by
     * discount fields. Refund behavior should be modeled with refund rows, not
     * by making order totals negative.
     */
    bookingOrdersDiscountCapCheck: check(
      "booking_orders_discount_cap_check",
      sql`"discount_minor" <= ("subtotal_minor" + "tax_minor" + "fee_minor")`,
    ),

    /** Total must reconcile deterministically from component amounts. */
    bookingOrdersMoneyReconciliationCheck: check(
      "booking_orders_money_reconciliation_check",
      sql`"total_minor" = ("subtotal_minor" + "tax_minor" + "fee_minor" - "discount_minor")`,
    ),

    /** Currency should always be uppercase ISO-4217 format. */
    bookingOrdersCurrencyFormatCheck: check(
      "booking_orders_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * booking_order_lines
 *
 * ELI5:
 * Order lines are the itemized money rows that sum to order totals.
 * They are useful for invoices, auditing, and refunds.
 */
export const bookingOrderLines = pgTable(
  "booking_order_lines",
  {
    /** Stable primary key. */
    id: idWithTag("booking_line"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent order. */
    bookingOrderId: idRef("booking_order_id")
      .references(() => bookingOrders.id)
      .notNull(),

    /** Line classification for pricing and accounting behavior. */
    lineType: bookingOrderLineTypeEnum("line_type").notNull(),

    /** Human line label used in receipts/admin UIs. */
    label: varchar("label", { length: 240 }).notNull(),

    /** Optional long description for invoice details. */
    description: text("description"),

    /** Optional link back to an offer component source. */
    offerComponentId: idRef("offer_component_id").references(() => offerComponents.id),

    /** Optional link back to seat class source. */
    seatTypeId: idRef("seat_type_id").references(() => offerComponentSeatTypes.id),

    /** Quantity for this line. */
    quantity: integer("quantity").default(1).notNull(),

    /** Unit amount in minor units. */
    unitAmountMinor: integer("unit_amount_minor").notNull(),

    /** Extended line total in minor units. */
    lineTotalMinor: integer("line_total_minor").notNull(),

    /** Extra structured pricing context for explainability. */
    pricingDetail: jsonb("pricing_detail").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe downstream references. */
    bookingOrderLinesBizIdIdUnique: uniqueIndex(
      "booking_order_lines_biz_id_id_unique",
    ).on(table.bizId, table.id),
    /**
     * Composite unique key proving that one line id belongs to one specific
     * order within one tenant.
     *
     * Why this exists:
     * payment allocation tables need a strict FK that guarantees
     * (`biz_id`, `booking_order_id`, `booking_order_line_id`) is a real pair,
     * so we can enforce "this exact payment amount paid this exact line".
     */
    bookingOrderLinesBizOrderIdIdUnique: uniqueIndex(
      "booking_order_lines_biz_order_id_id_unique",
    ).on(table.bizId, table.bookingOrderId, table.id),

    /** Common path for order invoice rendering. */
    bookingOrderLinesBizOrderIdx: index("booking_order_lines_biz_order_idx").on(
      table.bizId,
      table.bookingOrderId,
    ),

    /** Tenant-safe FK to order. */
    bookingOrderLinesBizOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "booking_order_lines_biz_order_fk",
    }),

    /** Tenant-safe FK to component source. */
    bookingOrderLinesBizComponentFk: foreignKey({
      columns: [table.bizId, table.offerComponentId],
      foreignColumns: [offerComponents.bizId, offerComponents.id],
      name: "booking_order_lines_biz_component_fk",
    }),

    /** Tenant-safe FK to seat source. */
    bookingOrderLinesBizSeatTypeFk: foreignKey({
      columns: [table.bizId, table.seatTypeId],
      foreignColumns: [offerComponentSeatTypes.bizId, offerComponentSeatTypes.id],
      name: "booking_order_lines_biz_seat_type_fk",
    }),

    /** Quantity must be positive. */
    bookingOrderLinesQuantityPositiveCheck: check(
      "booking_order_lines_quantity_positive_check",
      sql`"quantity" > 0`,
    ),

    /** Line total reconciliation check. */
    bookingOrderLinesLineTotalCheck: check(
      "booking_order_lines_line_total_check",
      sql`"line_total_minor" = ("quantity" * "unit_amount_minor")`,
    ),

    /**
     * Enforce sign semantics by line type.
     *
     * - commercial positive lines stay non-negative
     * - discount/refund adjustment lines stay non-positive
     */
    bookingOrderLinesLineTypeSignCheck: check(
      "booking_order_lines_line_type_sign_check",
     sql`
      (
        "line_type" IN ('offer_base', 'seat', 'addon', 'fee', 'tip', 'tax')
        AND "unit_amount_minor" >= 0
        AND "line_total_minor" >= 0
      ) OR (
        "line_type" IN ('discount', 'refund_adjustment')
        AND "unit_amount_minor" <= 0
        AND "line_total_minor" <= 0
      )
      `,
    ),
  }),
);

/**
 * fulfillment_units
 *
 * ELI5:
 * A fulfillment unit is one atomic "thing that has to happen".
 *
 * Examples:
 * - one treatment step,
 * - one rental leg,
 * - one transport segment,
 * - one async review task.
 *
 * Complex bookings become graphs of these units instead of one overloaded row.
 */
export const fulfillmentUnits = pgTable(
  "fulfillment_units",
  {
    /** Stable primary key for this unit. */
    id: idWithTag("fulfillment_unit"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent order this unit belongs to. */
    bookingOrderId: idRef("booking_order_id")
      .references(() => bookingOrders.id)
      .notNull(),

    /** Optional source component from offer version graph. */
    offerComponentId: idRef("offer_component_id").references(() => offerComponents.id),

    /** Unit shape classification for downstream execution logic. */
    kind: fulfillmentUnitKindEnum("kind").default("service_task").notNull(),

    /** Operational lifecycle status. */
    status: fulfillmentUnitStatusEnum("status").default("planned").notNull(),
    /**
     * Optional biz-config dictionary value for fulfillment-unit status wording.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Optional human/system code for quick references. */
    code: varchar("code", { length: 140 }),

    /** Planned start used for scheduling and conflict checks. */
    plannedStartAt: timestamp("planned_start_at", { withTimezone: true }),

    /** Planned end used for scheduling and conflict checks. */
    plannedEndAt: timestamp("planned_end_at", { withTimezone: true }),

    /** Actual start recorded at execution time. */
    actualStartAt: timestamp("actual_start_at", { withTimezone: true }),

    /** Actual end recorded at execution time. */
    actualEndAt: timestamp("actual_end_at", { withTimezone: true }),

    /** Optional location anchor for this unit. */
    locationId: idRef("location_id").references(() => locations.id),

    /**
     * Optional calendar binding that governed slot selection for this unit.
     * Useful for debugging why this unit landed in this exact window.
     */
    calendarBindingId: idRef("calendar_binding_id").references(
      () => calendarBindings.id,
    ),

    /** Optional pointer to queue entry id for queue-mode units. */
    queueEntryId: varchar("queue_entry_id", { length: 64 }),

    /** Optional pointer to transport trip id for route-trip units. */
    transportTripId: varchar("transport_trip_id", { length: 64 }),

    /** Assignment strategy snapshot used by allocator/dispatch engine. */
    assignmentPolicy: jsonb("assignment_policy").default({}).notNull(),

    /** Extension payload for domain-specific execution data. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    fulfillmentUnitsBizIdIdUnique: uniqueIndex("fulfillment_units_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique target for tenant-safe dependency/assignment FKs. */

    /** Common operational view path for one order. */
    fulfillmentUnitsBizOrderIdx: index("fulfillment_units_biz_order_idx").on(
      table.bizId,
      table.bookingOrderId,
      table.plannedStartAt,
    ),

    /** Common dispatch view path by status/time. */
    fulfillmentUnitsBizStatusIdx: index("fulfillment_units_biz_status_idx").on(
      table.bizId,
      table.status,
      table.plannedStartAt,
    ),
    fulfillmentUnitsBizStatusConfigIdx: index(
      "fulfillment_units_biz_status_config_idx",
    ).on(table.bizId, table.statusConfigValueId),

    /** Tenant-safe FK to order root. */
    fulfillmentUnitsBizOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "fulfillment_units_biz_order_fk",
    }),

    /** Tenant-safe FK to optional offer component. */
    fulfillmentUnitsBizComponentFk: foreignKey({
      columns: [table.bizId, table.offerComponentId],
      foreignColumns: [offerComponents.bizId, offerComponents.id],
      name: "fulfillment_units_biz_component_fk",
    }),

    /** Tenant-safe FK to optional location. */
    fulfillmentUnitsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "fulfillment_units_biz_location_fk",
    }),

    /** Tenant-safe FK to optional calendar binding. */
    fulfillmentUnitsBizCalendarBindingFk: foreignKey({
      columns: [table.bizId, table.calendarBindingId],
      foreignColumns: [calendarBindings.bizId, calendarBindings.id],
      name: "fulfillment_units_biz_calendar_binding_fk",
    }),
    /** Tenant-safe FK to optional configurable fulfillment-unit status. */
    fulfillmentUnitsBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "fulfillment_units_biz_status_config_fk",
    }),

    /** Planned and actual windows must be ordered if set. */
    fulfillmentUnitsPlannedWindowCheck: check(
      "fulfillment_units_planned_window_check",
      sql`"planned_start_at" IS NULL OR "planned_end_at" IS NULL OR "planned_end_at" > "planned_start_at"`,
    ),

    /** Planned and actual windows must be ordered if set. */
    fulfillmentUnitsActualWindowCheck: check(
      "fulfillment_units_actual_window_check",
      sql`"actual_start_at" IS NULL OR "actual_end_at" IS NULL OR "actual_end_at" >= "actual_start_at"`,
    ),
  }),
);

/**
 * standing_reservation_occurrences
 *
 * ELI5:
 * One row = one concrete planned/generated instance of a standing contract.
 *
 * Why this table exists:
 * - separates "recurring intention" from "concrete scheduled occurrence",
 * - gives APIs a stable item to confirm/skip/cancel/reschedule,
 * - allows deterministic linkage to real booking order rows.
 */
export const standingReservationOccurrences = pgTable(
  "standing_reservation_occurrences",
  {
    /** Stable primary key for one generated occurrence. */
    id: idWithTag("standing_occurrence"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent recurring contract this occurrence came from. */
    standingReservationContractId: idRef("standing_reservation_contract_id")
      .references(() => standingReservationContracts.id)
      .notNull(),

    /**
     * Deterministic key per contract occurrence.
     * Example: "2026-03-03T09:00:00-05:00#1".
     */
    occurrenceKey: varchar("occurrence_key", { length: 120 }).notNull(),

    /** Local calendar date for UI grouping and recurrence debugging. */
    occurrenceLocalDate: date("occurrence_local_date").notNull(),

    /** Planned concrete start of this occurrence instance. */
    plannedStartAt: timestamp("planned_start_at", { withTimezone: true }).notNull(),

    /** Planned concrete end of this occurrence instance. */
    plannedEndAt: timestamp("planned_end_at", { withTimezone: true }).notNull(),

    /** Current lifecycle state of this occurrence instance. */
    status: standingReservationOccurrenceStatusEnum("status")
      .default("planned")
      .notNull(),

    /**
     * Optional configurable dictionary value for tenant-facing occurrence status wording.
     * Canonical status remains the deterministic engine truth.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /**
     * Optional linked booking order created from this occurrence.
     * Null means it has not been converted to a real commercial order yet.
     */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Timestamp when this occurrence row was generated/materialized. */
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Timestamp when converted into booking order state. */
    bookedAt: timestamp("booked_at", { withTimezone: true }),

    /** Timestamp when execution completed successfully. */
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),

    /** Timestamp when occurrence was cancelled. */
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    /** Timestamp when occurrence was intentionally skipped. */
    skippedAt: timestamp("skipped_at", { withTimezone: true }),

    /** Optional reason for skip decisions. */
    skipReason: text("skip_reason"),

    /** Optional diagnostic text for failed-generation/failed-booking cases. */
    failureReason: text("failure_reason"),

    /** Extension payload for recurrence engine diagnostics and context. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe references. */
    standingReservationOccurrencesBizIdIdUnique: uniqueIndex(
      "standing_reservation_occurrences_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Unique occurrence key per contract for deterministic idempotent generation. */
    standingReservationOccurrencesContractKeyUnique: uniqueIndex(
      "standing_reservation_occurrences_contract_key_unique",
    ).on(table.bizId, table.standingReservationContractId, table.occurrenceKey),

    /** One booking order can map to at most one standing occurrence. */
    standingReservationOccurrencesBookingOrderUnique: uniqueIndex(
      "standing_reservation_occurrences_booking_order_unique",
    )
      .on(table.bizId, table.bookingOrderId)
      .where(sql`"booking_order_id" IS NOT NULL`),

    /** Common planner path by contract and occurrence time. */
    standingReservationOccurrencesBizContractStartIdx: index(
      "standing_reservation_occurrences_biz_contract_start_idx",
    ).on(table.bizId, table.standingReservationContractId, table.plannedStartAt),

    /** Common operations board path by occurrence status/time. */
    standingReservationOccurrencesBizStatusStartIdx: index(
      "standing_reservation_occurrences_biz_status_start_idx",
    ).on(table.bizId, table.status, table.plannedStartAt),

    standingReservationOccurrencesBizStatusConfigIdx: index(
      "standing_reservation_occurrences_biz_status_config_idx",
    ).on(table.bizId, table.statusConfigValueId),

    /** Tenant-safe FK to parent recurring contract. */
    standingReservationOccurrencesBizContractFk: foreignKey({
      columns: [table.bizId, table.standingReservationContractId],
      foreignColumns: [standingReservationContracts.bizId, standingReservationContracts.id],
      name: "standing_reservation_occurrences_biz_contract_fk",
    }),

    /** Tenant-safe FK to optional linked booking order. */
    standingReservationOccurrencesBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "standing_reservation_occurrences_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to optional configurable occurrence status wording. */
    standingReservationOccurrencesBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "standing_reservation_occurrences_biz_status_config_fk",
    }),

    /** Planned window must be time-ordered for deterministic overlap logic. */
    standingReservationOccurrencesWindowCheck: check(
      "standing_reservation_occurrences_window_check",
      sql`"planned_end_at" > "planned_start_at"`,
    ),

    /** Outcome timestamps should never precede row generation timestamp. */
    standingReservationOccurrencesTimelineCheck: check(
      "standing_reservation_occurrences_timeline_check",
      sql`
      ("booked_at" IS NULL OR "booked_at" >= "generated_at")
      AND ("fulfilled_at" IS NULL OR "fulfilled_at" >= "generated_at")
      AND ("cancelled_at" IS NULL OR "cancelled_at" >= "generated_at")
      AND ("skipped_at" IS NULL OR "skipped_at" >= "generated_at")
      `,
    ),

    /**
     * Status-specific payload shape for deterministic API behavior.
     */
    standingReservationOccurrencesStatusShapeCheck: check(
      "standing_reservation_occurrences_status_shape_check",
      sql`
      (
        "status" = 'booked'
        AND "booking_order_id" IS NOT NULL
        AND "booked_at" IS NOT NULL
      ) OR (
        "status" = 'fulfilled'
        AND "booking_order_id" IS NOT NULL
        AND "booked_at" IS NOT NULL
        AND "fulfilled_at" IS NOT NULL
      ) OR (
        "status" = 'skipped'
        AND "booking_order_id" IS NULL
        AND "skipped_at" IS NOT NULL
        AND "skip_reason" IS NOT NULL
      ) OR (
        "status" = 'cancelled'
        AND "cancelled_at" IS NOT NULL
      ) OR (
        "status" IN ('planned', 'generated', 'failed')
      )
      `,
    ),
  }),
);

/**
 * fulfillment_dependencies
 *
 * ELI5:
 * Dependency rows are graph edges saying how two units relate.
 * Example: Unit B must follow Unit A with at least 30-minute gap.
 */
export const fulfillmentDependencies = pgTable(
  "fulfillment_dependencies",
  {
    /** Stable primary key for dependency edge. */
    id: idWithTag("fulfillment_dependency"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Upstream unit in the dependency relation. */
    predecessorUnitId: idRef("predecessor_unit_id")
      .references(() => fulfillmentUnits.id)
      .notNull(),

    /** Downstream unit constrained by predecessor. */
    successorUnitId: idRef("successor_unit_id")
      .references(() => fulfillmentUnits.id)
      .notNull(),

    /** Dependency semantics. */
    dependencyType: fulfillmentDependencyTypeEnum("dependency_type").notNull(),

    /** Optional min gap in minutes when dependency type uses gap semantics. */
    minGapMin: integer("min_gap_min"),

    /** Optional max gap in minutes when dependency type uses gap semantics. */
    maxGapMin: integer("max_gap_min"),

    /** If true, downstream should be blocked when dependency is unsatisfied. */
    hardBlock: boolean("hard_block").default(true).notNull(),

    /** Extra relation metadata. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    fulfillmentDependenciesBizIdIdUnique: uniqueIndex("fulfillment_dependencies_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Prevent duplicate identical edges. */
    fulfillmentDependenciesUnique: uniqueIndex("fulfillment_dependencies_unique").on(
      table.predecessorUnitId,
      table.successorUnitId,
      table.dependencyType,
    ),

    /** Common graph expansion path. */
    fulfillmentDependenciesBizPredecessorIdx: index(
      "fulfillment_dependencies_biz_predecessor_idx",
    ).on(table.bizId, table.predecessorUnitId),

    /** Common reverse graph path. */
    fulfillmentDependenciesBizSuccessorIdx: index(
      "fulfillment_dependencies_biz_successor_idx",
    ).on(table.bizId, table.successorUnitId),

    /** Tenant-safe FK for predecessor. */
    fulfillmentDependenciesBizPredecessorFk: foreignKey({
      columns: [table.bizId, table.predecessorUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "fulfillment_dependencies_biz_predecessor_fk",
    }),

    /** Tenant-safe FK for successor. */
    fulfillmentDependenciesBizSuccessorFk: foreignKey({
      columns: [table.bizId, table.successorUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "fulfillment_dependencies_biz_successor_fk",
    }),

    /** Self loops are forbidden; a unit cannot depend on itself. */
    fulfillmentDependenciesNoSelfLoopCheck: check(
      "fulfillment_dependencies_no_self_loop_check",
      sql`"predecessor_unit_id" <> "successor_unit_id"`,
    ),

    /** Gap values must be non-negative and ordered when set. */
    fulfillmentDependenciesGapBoundsCheck: check(
      "fulfillment_dependencies_gap_bounds_check",
      sql`
      ("min_gap_min" IS NULL OR "min_gap_min" >= 0)
      AND ("max_gap_min" IS NULL OR "max_gap_min" >= 0)
      AND ("min_gap_min" IS NULL OR "max_gap_min" IS NULL OR "max_gap_min" >= "min_gap_min")
      `,
    ),
  }),
);

/**
 * fulfillment_assignments
 *
 * ELI5:
 * Assignment rows connect real resources to units over time.
 * One unit can have multiple assignments (lead + assistant + room + equipment).
 */
export const fulfillmentAssignments = pgTable(
  "fulfillment_assignments",
  {
    /** Stable primary key. */
    id: idWithTag("fulfillment_assignment"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Unit being staffed/equipped. */
    fulfillmentUnitId: idRef("fulfillment_unit_id")
      .references(() => fulfillmentUnits.id)
      .notNull(),

    /** Resource assigned to this unit. */
    resourceId: idRef("resource_id")
      .references(() => resources.id)
      .notNull(),

    /** Assignment lifecycle status. */
    status: fulfillmentAssignmentStatusEnum("status")
      .default("proposed")
      .notNull(),
    /**
     * Optional biz-config dictionary value for assignment status wording.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /**
     * Overlap-conflict policy used by DB-level exclusion enforcement.
     *
     * ELI5:
     * - `enforce_no_overlap`: this assignment cannot overlap another active one
     *   for the same resource.
     * - `allow_overlap`: overlap is intentionally allowed.
     *
     * Important:
     * - this is assignment-level control. It does not auto-copy from
     *   `resources.allow_simultaneous_bookings`; API/workflows should set it
     *   explicitly when creating assignments.
     */
    conflictPolicy: fulfillmentAssignmentConflictPolicyEnum("conflict_policy")
      .default("enforce_no_overlap")
      .notNull(),

    /** Optional role label within this unit (lead, assistant, room, etc.). */
    roleLabel: varchar("role_label", { length: 120 }),

    /** Optional assignment window start. */
    startsAt: timestamp("starts_at", { withTimezone: true }),

    /** Optional assignment window end. */
    endsAt: timestamp("ends_at", { withTimezone: true }),

    /** Whether this assignment is the primary actor for its role. */
    isPrimary: boolean("is_primary").default(false).notNull(),

    /**
     * Compensation split in basis points for this assignment, if applicable.
     * Example: 7000 = 70%.
     */
    compensationSplitBps: integer("compensation_split_bps"),

    /** User that made the assignment decision. */
    assignedByUserId: idRef("assigned_by_user_id").references(() => users.id),

    /** Time assignment was created/confirmed operationally. */
    assignedAt: timestamp("assigned_at", { withTimezone: true }),

    /** Extra assignment details for routing/matching audit. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe downstream references. */
    fulfillmentAssignmentsBizIdIdUnique: uniqueIndex(
      "fulfillment_assignments_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Common dispatch list path. */
    fulfillmentAssignmentsBizUnitIdx: index(
      "fulfillment_assignments_biz_unit_idx",
    ).on(table.bizId, table.fulfillmentUnitId, table.status),

    /** Common resource workload lookup path. */
    fulfillmentAssignmentsBizResourceIdx: index(
      "fulfillment_assignments_biz_resource_idx",
    ).on(table.bizId, table.resourceId, table.startsAt),

    /** Common path for conflict checks and dispatch filtering. */
    fulfillmentAssignmentsBizResourcePolicyStatusIdx: index(
      "fulfillment_assignments_biz_resource_policy_status_idx",
    ).on(table.bizId, table.resourceId, table.conflictPolicy, table.status, table.startsAt),

    /**
     * Queue/dispatch board index for assignment lifecycle views.
     *
     * ELI5:
     * Dispatch UIs commonly list assignments by "status + soonest start".
     * This index makes that exact path efficient without depending on
     * resource-specific filters.
     */
    fulfillmentAssignmentsBizStatusStartIdx: index(
      "fulfillment_assignments_biz_status_start_idx",
    ).on(table.bizId, table.status, table.startsAt),
    fulfillmentAssignmentsBizStatusConfigIdx: index(
      "fulfillment_assignments_biz_status_config_idx",
    ).on(table.bizId, table.statusConfigValueId),

    /** Tenant-safe FK to unit. */
    fulfillmentAssignmentsBizUnitFk: foreignKey({
      columns: [table.bizId, table.fulfillmentUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "fulfillment_assignments_biz_unit_fk",
    }),

    /** Tenant-safe FK to resource. */
    fulfillmentAssignmentsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "fulfillment_assignments_biz_resource_fk",
    }),
    /** Tenant-safe FK to optional configurable assignment status. */
    fulfillmentAssignmentsBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "fulfillment_assignments_biz_status_config_fk",
    }),

    /** Assignment windows must be ordered if present. */
    fulfillmentAssignmentsWindowCheck: check(
      "fulfillment_assignments_window_check",
      sql`"starts_at" IS NULL OR "ends_at" IS NULL OR "ends_at" > "starts_at"`,
    ),

    /**
     * Active allocation states must carry explicit time windows.
     *
     * This prevents half-defined rows from bypassing overlap safety checks.
     */
    fulfillmentAssignmentsActiveWindowRequiredCheck: check(
      "fulfillment_assignments_active_window_required_check",
      sql`
      "status" NOT IN ('reserved', 'confirmed', 'in_progress')
      OR ("starts_at" IS NOT NULL AND "ends_at" IS NOT NULL)
      `,
    ),

    /** Compensation splits must be valid basis points if present. */
    fulfillmentAssignmentsCompensationSplitCheck: check(
      "fulfillment_assignments_compensation_split_check",
      sql`"compensation_split_bps" IS NULL OR ("compensation_split_bps" >= 0 AND "compensation_split_bps" <= 10000)`,
    ),
  }),
);

/**
 * fulfillment_assignment_events
 *
 * ELI5:
 * `fulfillment_assignments` is the current snapshot.
 * This table is the immutable transition timeline for that snapshot.
 *
 * Why this matters:
 * - staffing/audit views can explain exactly how assignment changed,
 * - conflict and substitution analytics can consume transitions directly,
 * - incident debugging no longer depends on guessing from current row state.
 */
export const fulfillmentAssignmentEvents = pgTable(
  "fulfillment_assignment_events",
  {
    /** Stable primary key for one assignment-event row. */
    id: idWithTag("fulfillment_assignment_event"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent assignment row. */
    fulfillmentAssignmentId: idRef("fulfillment_assignment_id").notNull(),

    /** Transition/event category. */
    eventType: fulfillmentAssignmentEventTypeEnum("event_type").notNull(),

    /** Previous status snapshot when relevant. */
    previousStatus: fulfillmentAssignmentStatusEnum("previous_status"),

    /** New status snapshot when relevant. */
    nextStatus: fulfillmentAssignmentStatusEnum("next_status"),

    /** Previous resource snapshot when reassigned/swapped. */
    previousResourceId: idRef("previous_resource_id"),

    /** New resource snapshot when reassigned/swapped. */
    nextResourceId: idRef("next_resource_id"),

    /** Previous assignment window start snapshot. */
    previousStartsAt: timestamp("previous_starts_at", { withTimezone: true }),

    /** New assignment window start snapshot. */
    nextStartsAt: timestamp("next_starts_at", { withTimezone: true }),

    /** Previous assignment window end snapshot. */
    previousEndsAt: timestamp("previous_ends_at", { withTimezone: true }),

    /** New assignment window end snapshot. */
    nextEndsAt: timestamp("next_ends_at", { withTimezone: true }),

    /** Previous conflict policy snapshot. */
    previousConflictPolicy: fulfillmentAssignmentConflictPolicyEnum(
      "previous_conflict_policy",
    ),

    /** New conflict policy snapshot. */
    nextConflictPolicy: fulfillmentAssignmentConflictPolicyEnum("next_conflict_policy"),

    /** Optional actor user for manual dispatch changes. */
    actorUserId: idRef("actor_user_id").references(() => users.id),

    /** Optional non-user actor ref (worker/integration/api key). */
    actorRef: varchar("actor_ref", { length: 200 }),

    /** Optional request correlation key for trace stitching. */
    requestKey: varchar("request_key", { length: 140 }),

    /** Optional reason code for explainability. */
    reasonCode: varchar("reason_code", { length: 120 }),

    /** Business occurrence timestamp. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Structured transition details snapshot. */
    details: jsonb("details").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references. */
    fulfillmentAssignmentEventsBizIdIdUnique: uniqueIndex(
      "fulfillment_assignment_events_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Primary timeline path for one assignment. */
    fulfillmentAssignmentEventsBizAssignmentOccurredIdx: index(
      "fulfillment_assignment_events_biz_assignment_occurred_idx",
    ).on(table.bizId, table.fulfillmentAssignmentId, table.occurredAt),

    /** Cross-assignment analytics path. */
    fulfillmentAssignmentEventsBizTypeOccurredIdx: index(
      "fulfillment_assignment_events_biz_type_occurred_idx",
    ).on(table.bizId, table.eventType, table.nextStatus, table.occurredAt),

    /** Request-level trace path. */
    fulfillmentAssignmentEventsBizRequestOccurredIdx: index(
      "fulfillment_assignment_events_biz_request_occurred_idx",
    ).on(table.bizId, table.requestKey, table.occurredAt),

    /** Tenant-safe FK to parent assignment row. */
    fulfillmentAssignmentEventsBizAssignmentFk: foreignKey({
      columns: [table.bizId, table.fulfillmentAssignmentId],
      foreignColumns: [fulfillmentAssignments.bizId, fulfillmentAssignments.id],
      name: "fulfillment_assignment_events_biz_assignment_fk",
    }),

    /** Tenant-safe FK to previous resource snapshot when present. */
    fulfillmentAssignmentEventsBizPreviousResourceFk: foreignKey({
      columns: [table.bizId, table.previousResourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "fulfillment_assignment_events_biz_previous_resource_fk",
    }),

    /** Tenant-safe FK to next resource snapshot when present. */
    fulfillmentAssignmentEventsBizNextResourceFk: foreignKey({
      columns: [table.bizId, table.nextResourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "fulfillment_assignment_events_biz_next_resource_fk",
    }),

    /** Snapshot windows must be ordered when both bounds exist. */
    fulfillmentAssignmentEventsWindowBoundsCheck: check(
      "fulfillment_assignment_events_window_bounds_check",
      sql`
      ("previous_starts_at" IS NULL OR "previous_ends_at" IS NULL OR "previous_ends_at" > "previous_starts_at")
      AND ("next_starts_at" IS NULL OR "next_ends_at" IS NULL OR "next_ends_at" > "next_starts_at")
      `,
    ),

    /** Non-create rows should carry at least one transition dimension. */
    fulfillmentAssignmentEventsTransitionShapeCheck: check(
      "fulfillment_assignment_events_transition_shape_check",
      sql`
      "event_type" = 'created'
      OR "previous_status" IS NOT NULL
      OR "next_status" IS NOT NULL
      OR "previous_resource_id" IS NOT NULL
      OR "next_resource_id" IS NOT NULL
      OR "previous_starts_at" IS NOT NULL
      OR "next_starts_at" IS NOT NULL
      OR "previous_ends_at" IS NOT NULL
      OR "next_ends_at" IS NOT NULL
      OR "previous_conflict_policy" IS NOT NULL
      OR "next_conflict_policy" IS NOT NULL
      `,
    ),
  }),
);

/**
 * fulfillment_checkpoints
 *
 * ELI5:
 * Checkpoints are milestone events like arrival, start, completion.
 * They support callout-fee logic, SLA reporting, and auditable execution trails.
 */
export const fulfillmentCheckpoints = pgTable(
  "fulfillment_checkpoints",
  {
    /** Stable primary key. */
    id: idWithTag("checkpoint"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Unit this checkpoint belongs to. */
    fulfillmentUnitId: idRef("fulfillment_unit_id")
      .references(() => fulfillmentUnits.id)
      .notNull(),

    /** Checkpoint category (arrival, check-in, completion, etc.). */
    checkpointType: fulfillmentCheckpointTypeEnum("checkpoint_type").notNull(),

    /** Milestone status. */
    status: fulfillmentCheckpointStatusEnum("status")
      .default("pending")
      .notNull(),
    /**
     * Optional biz-config dictionary value for checkpoint-status wording.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /**
     * Sequence number to support retries/repeated checkpoint type events.
     * Example: two separate pause/resume cycles.
     */
    sequence: integer("sequence").default(1).notNull(),

    /** Expected milestone time for SLA and variance analysis. */
    expectedAt: timestamp("expected_at", { withTimezone: true }),

    /** Actual recorded time when event happened. */
    recordedAt: timestamp("recorded_at", { withTimezone: true }),

    /** Actor who recorded this checkpoint. */
    recordedByUserId: idRef("recorded_by_user_id").references(() => users.id),

    /** Structured evidence payload (geo, notes, attachments refs, etc.). */
    evidence: jsonb("evidence").default({}),

    /** Optional human-readable notes. */
    notes: text("notes"),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    fulfillmentCheckpointsBizIdIdUnique: uniqueIndex("fulfillment_checkpoints_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Prevents duplicate sequence rows for same checkpoint type in one unit. */
    fulfillmentCheckpointsUnique: uniqueIndex("fulfillment_checkpoints_unique").on(
      table.fulfillmentUnitId,
      table.checkpointType,
      table.sequence,
    ),

    /** Common timeline path for one fulfillment unit. */
    fulfillmentCheckpointsBizUnitIdx: index("fulfillment_checkpoints_biz_unit_idx").on(
      table.bizId,
      table.fulfillmentUnitId,
      table.sequence,
    ),
    fulfillmentCheckpointsBizStatusConfigIdx: index(
      "fulfillment_checkpoints_biz_status_config_idx",
    ).on(table.bizId, table.statusConfigValueId),

    /** Tenant-safe FK to unit. */
    fulfillmentCheckpointsBizUnitFk: foreignKey({
      columns: [table.bizId, table.fulfillmentUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "fulfillment_checkpoints_biz_unit_fk",
    }),
    /** Tenant-safe FK to optional configurable checkpoint status. */
    fulfillmentCheckpointsBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "fulfillment_checkpoints_biz_status_config_fk",
    }),

    /** Sequence values must start at 1. */
    fulfillmentCheckpointsSequenceCheck: check(
      "fulfillment_checkpoints_sequence_check",
      sql`"sequence" >= 1`,
    ),

  }),
);
