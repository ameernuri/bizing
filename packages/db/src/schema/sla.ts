import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { arInvoices } from "./ar";
import { bizes } from "./bizes";
import { bookingOrders, fulfillmentUnits } from "./fulfillment";
import { lifecycleStatusEnum, slaBreachStatusEnum, slaBreachTargetTypeEnum, slaCompensationStatusEnum, slaCompensationTypeEnum, slaMetricKindEnum, slaPolicyScopeTypeEnum } from "./enums";
import { locations } from "./locations";
import { offerVersions } from "./offers";
import { queueEntries, queues } from "./queue";
import { resources } from "./resources";
import { serviceProducts } from "./service_products";
import { subjects } from "./subjects";
import { users } from "./users";
import { workRuns } from "./work_management";

/**
 * sla_policies
 *
 * ELI5:
 * A policy row says "for this scope, target should happen within X minutes".
 *
 * Example:
 * - Queue at Location A must start service within 10 minutes.
 * - Fulfillment completion for Service Product B must happen in 120 minutes.
 *
 * Why this table exists:
 * - Keeps SLA targets configurable and explicit.
 * - Lets breach detection be deterministic and auditable.
 */
export const slaPolicies = pgTable(
  "sla_policies",
  {
    /** Stable primary key. */
    id: idWithTag("sla_policy"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human policy name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable key for APIs/imports. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Policy lifecycle state. */
    status: lifecycleStatusEnum("status").default("draft").notNull(),

    /** What kind of SLA metric this policy enforces. */
    metricKind: slaMetricKindEnum("metric_kind").notNull(),

    /** Scope target class where policy applies. */
    scopeType: slaPolicyScopeTypeEnum("scope_type").default("biz").notNull(),

    /** Optional typed scope anchors. */
    locationId: idRef("location_id").references(() => locations.id),
    resourceId: idRef("resource_id").references(() => resources.id),
    offerVersionId: idRef("offer_version_id").references(() => offerVersions.id),
    serviceProductId: idRef("service_product_id").references(
      () => serviceProducts.id,
    ),
    queueId: idRef("queue_id").references(() => queues.id),

    /** Optional custom-subject scope anchor for extensible domains. */
    scopeRefType: varchar("scope_ref_type", { length: 80 }),
    scopeRefId: idRef("scope_ref_id"),

    /** SLA target and grace window in minutes. */
    targetDurationMin: integer("target_duration_min").notNull(),
    graceDurationMin: integer("grace_duration_min").default(0).notNull(),

    /** Optional severity for operational triage (1 low .. 5 critical). */
    severityLevel: integer("severity_level").default(2).notNull(),

    /** Optional flag: evaluate metric only during business-operating windows. */
    businessHoursOnly: boolean("business_hours_only").default(false).notNull(),

    /** Evaluator knobs (sampling, pause rules, exclusion windows). */
    evaluationPolicy: jsonb("evaluation_policy").default({}).notNull(),

    /** Default compensation behavior used when a breach occurs. */
    compensationPolicy: jsonb("compensation_policy").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    slaPoliciesBizIdIdUnique: uniqueIndex("sla_policies_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key for tenant-safe child references. */

    /** One slug per tenant. */
    slaPoliciesBizSlugUnique: uniqueIndex("sla_policies_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),

    /** Common admin listing path. */
    slaPoliciesBizStatusScopeIdx: index("sla_policies_biz_status_scope_idx").on(
      table.bizId,
      table.status,
      table.scopeType,
    ),

    /** Custom-subject lookup path for extensible scopes. */
    slaPoliciesBizScopeRefIdx: index("sla_policies_biz_scope_ref_idx").on(
      table.bizId,
      table.scopeRefType,
      table.scopeRefId,
    ),
    /** Tenant-safe FK for location-scoped policy targets. */
    slaPoliciesBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "sla_policies_biz_location_fk",
    }),
    /** Tenant-safe FK for resource-scoped policy targets. */
    slaPoliciesBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "sla_policies_biz_resource_fk",
    }),
    /** Tenant-safe FK for offer-version scoped policy targets. */
    slaPoliciesBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "sla_policies_biz_offer_version_fk",
    }),
    /** Tenant-safe FK for service-product scoped policy targets. */
    slaPoliciesBizServiceProductFk: foreignKey({
      columns: [table.bizId, table.serviceProductId],
      foreignColumns: [serviceProducts.bizId, serviceProducts.id],
      name: "sla_policies_biz_service_product_fk",
    }),
    /** Tenant-safe FK for queue-scoped policy targets. */
    slaPoliciesBizQueueFk: foreignKey({
      columns: [table.bizId, table.queueId],
      foreignColumns: [queues.bizId, queues.id],
      name: "sla_policies_biz_queue_fk",
    }),

    /** Tenant-safe FK for custom subject scope references. */
    slaPoliciesBizScopeRefSubjectFk: foreignKey({
      columns: [table.bizId, table.scopeRefType, table.scopeRefId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "sla_policies_biz_scope_ref_subject_fk",
    }),

    /** Scope selector payload must match scope_type exactly. */
    slaPoliciesScopeShapeCheck: check(
      "sla_policies_scope_shape_check",
      sql`
      (
        "scope_type" = 'biz'
        AND "location_id" IS NULL
        AND "resource_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "service_product_id" IS NULL
        AND "queue_id" IS NULL
        AND "scope_ref_type" IS NULL
        AND "scope_ref_id" IS NULL
      ) OR (
        "scope_type" = 'location'
        AND "location_id" IS NOT NULL
        AND "resource_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "service_product_id" IS NULL
        AND "queue_id" IS NULL
        AND "scope_ref_type" IS NULL
        AND "scope_ref_id" IS NULL
      ) OR (
        "scope_type" = 'resource'
        AND "location_id" IS NULL
        AND "resource_id" IS NOT NULL
        AND "offer_version_id" IS NULL
        AND "service_product_id" IS NULL
        AND "queue_id" IS NULL
        AND "scope_ref_type" IS NULL
        AND "scope_ref_id" IS NULL
      ) OR (
        "scope_type" = 'offer_version'
        AND "location_id" IS NULL
        AND "resource_id" IS NULL
        AND "offer_version_id" IS NOT NULL
        AND "service_product_id" IS NULL
        AND "queue_id" IS NULL
        AND "scope_ref_type" IS NULL
        AND "scope_ref_id" IS NULL
      ) OR (
        "scope_type" = 'service_product'
        AND "location_id" IS NULL
        AND "resource_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "service_product_id" IS NOT NULL
        AND "queue_id" IS NULL
        AND "scope_ref_type" IS NULL
        AND "scope_ref_id" IS NULL
      ) OR (
        "scope_type" = 'queue'
        AND "location_id" IS NULL
        AND "resource_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "service_product_id" IS NULL
        AND "queue_id" IS NOT NULL
        AND "scope_ref_type" IS NULL
        AND "scope_ref_id" IS NULL
      ) OR (
        "scope_type" = 'custom_subject'
        AND "location_id" IS NULL
        AND "resource_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "service_product_id" IS NULL
        AND "queue_id" IS NULL
        AND "scope_ref_type" IS NOT NULL
        AND "scope_ref_id" IS NOT NULL
      )
      `,
    ),

    /** Numeric sanity checks. */
    slaPoliciesNumericBoundsCheck: check(
      "sla_policies_numeric_bounds_check",
      sql`
      "target_duration_min" > 0
      AND "grace_duration_min" >= 0
      AND "severity_level" >= 1
      AND "severity_level" <= 5
      `,
    ),
  }),
);

/**
 * sla_breach_events
 *
 * ELI5:
 * One row says "this concrete thing missed SLA policy by this amount."
 *
 * This is the canonical breach ledger used for support, payouts, and reporting.
 */
export const slaBreachEvents = pgTable(
  "sla_breach_events",
  {
    id: idWithTag("sla_breach"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional source policy (kept nullable for ad-hoc/manual breach rows). */
    slaPolicyId: idRef("sla_policy_id").references(() => slaPolicies.id),

    /** Target class that breached SLA. */
    targetType: slaBreachTargetTypeEnum("target_type").notNull(),

    /** Optional typed anchors for deterministic joins. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),
    fulfillmentUnitId: idRef("fulfillment_unit_id").references(
      () => fulfillmentUnits.id,
    ),
    queueEntryId: idRef("queue_entry_id").references(() => queueEntries.id),
    workRunId: idRef("work_run_id").references(() => workRuns.id),
    resourceId: idRef("resource_id").references(() => resources.id),

    /** Optional custom-subject target anchor for extensible domains. */
    targetRefType: varchar("target_ref_type", { length: 80 }),
    targetRefId: idRef("target_ref_id"),

    status: slaBreachStatusEnum("status").default("open").notNull(),

    /** Clock fields for SLA interval analysis. */
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    breachedAt: timestamp("breached_at", { withTimezone: true }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),

    /** Snapshot values copied from policy/evaluator for replayability. */
    targetDurationMin: integer("target_duration_min").notNull(),
    graceDurationMin: integer("grace_duration_min").default(0).notNull(),
    measuredDurationMin: integer("measured_duration_min").notNull(),

    severityLevel: integer("severity_level").default(2).notNull(),
    isAutoDetected: boolean("is_auto_detected").default(true).notNull(),

    /** Breach classifier details and evaluator context. */
    details: jsonb("details").default({}).notNull(),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    slaBreachEventsBizIdIdUnique: uniqueIndex("sla_breach_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    slaBreachEventsBizStatusBreachedIdx: index(
      "sla_breach_events_biz_status_breached_idx",
    ).on(table.bizId, table.status, table.breachedAt),

    slaBreachEventsBizPolicyBreachedIdx: index(
      "sla_breach_events_biz_policy_breached_idx",
    ).on(table.bizId, table.slaPolicyId, table.breachedAt),

    slaBreachEventsBizTargetRefIdx: index("sla_breach_events_biz_target_ref_idx").on(
      table.bizId,
      table.targetRefType,
      table.targetRefId,
    ),
    slaBreachEventsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "sla_breach_events_biz_booking_order_fk",
    }),
    slaBreachEventsBizFulfillmentUnitFk: foreignKey({
      columns: [table.bizId, table.fulfillmentUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "sla_breach_events_biz_fulfillment_unit_fk",
    }),
    slaBreachEventsBizQueueEntryFk: foreignKey({
      columns: [table.bizId, table.queueEntryId],
      foreignColumns: [queueEntries.bizId, queueEntries.id],
      name: "sla_breach_events_biz_queue_entry_fk",
    }),
    slaBreachEventsBizWorkRunFk: foreignKey({
      columns: [table.bizId, table.workRunId],
      foreignColumns: [workRuns.bizId, workRuns.id],
      name: "sla_breach_events_biz_work_run_fk",
    }),
    slaBreachEventsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "sla_breach_events_biz_resource_fk",
    }),

    slaBreachEventsBizPolicyFk: foreignKey({
      columns: [table.bizId, table.slaPolicyId],
      foreignColumns: [slaPolicies.bizId, slaPolicies.id],
      name: "sla_breach_events_biz_policy_fk",
    }),

    slaBreachEventsBizTargetRefSubjectFk: foreignKey({
      columns: [table.bizId, table.targetRefType, table.targetRefId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "sla_breach_events_biz_target_ref_subject_fk",
    }),

    /** Target payload must match target_type exactly. */
    slaBreachEventsTargetShapeCheck: check(
      "sla_breach_events_target_shape_check",
      sql`
      (
        "target_type" = 'booking_order'
        AND "booking_order_id" IS NOT NULL
        AND "fulfillment_unit_id" IS NULL
        AND "queue_entry_id" IS NULL
        AND "work_run_id" IS NULL
        AND "resource_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'fulfillment_unit'
        AND "booking_order_id" IS NULL
        AND "fulfillment_unit_id" IS NOT NULL
        AND "queue_entry_id" IS NULL
        AND "work_run_id" IS NULL
        AND "resource_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'queue_entry'
        AND "booking_order_id" IS NULL
        AND "fulfillment_unit_id" IS NULL
        AND "queue_entry_id" IS NOT NULL
        AND "work_run_id" IS NULL
        AND "resource_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'work_run'
        AND "booking_order_id" IS NULL
        AND "fulfillment_unit_id" IS NULL
        AND "queue_entry_id" IS NULL
        AND "work_run_id" IS NOT NULL
        AND "resource_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'resource'
        AND "booking_order_id" IS NULL
        AND "fulfillment_unit_id" IS NULL
        AND "queue_entry_id" IS NULL
        AND "work_run_id" IS NULL
        AND "resource_id" IS NOT NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'custom_subject'
        AND "booking_order_id" IS NULL
        AND "fulfillment_unit_id" IS NULL
        AND "queue_entry_id" IS NULL
        AND "work_run_id" IS NULL
        AND "resource_id" IS NULL
        AND "target_ref_type" IS NOT NULL
        AND "target_ref_id" IS NOT NULL
      )
      `,
    ),

    /** Timeline and duration sanity checks. */
    slaBreachEventsTimelineAndDurationCheck: check(
      "sla_breach_events_timeline_and_duration_check",
      sql`
      "breached_at" >= "started_at"
      AND ("resolved_at" IS NULL OR "resolved_at" >= "breached_at")
      AND "target_duration_min" > 0
      AND "grace_duration_min" >= 0
      AND "measured_duration_min" >= 0
      AND "severity_level" >= 1
      AND "severity_level" <= 5
      `,
    ),
  }),
);

/**
 * sla_compensation_events
 *
 * ELI5:
 * If a breach should produce a customer or finance adjustment, that adjustment
 * is captured here as an explicit event.
 */
export const slaCompensationEvents = pgTable(
  "sla_compensation_events",
  {
    id: idWithTag("sla_comp"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    slaBreachEventId: idRef("sla_breach_event_id")
      .references(() => slaBreachEvents.id)
      .notNull(),

    type: slaCompensationTypeEnum("type").notNull(),
    status: slaCompensationStatusEnum("status").default("pending").notNull(),

    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Optional financial anchors where compensation was applied. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),
    arInvoiceId: idRef("ar_invoice_id").references(() => arInvoices.id),

    appliedAt: timestamp("applied_at", { withTimezone: true }),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    note: varchar("note", { length: 1000 }),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    slaCompensationEventsBizIdIdUnique: uniqueIndex("sla_compensation_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    slaCompensationEventsBizBreachStatusIdx: index(
      "sla_compensation_events_biz_breach_status_idx",
    ).on(table.bizId, table.slaBreachEventId, table.status),

    slaCompensationEventsBizAppliedIdx: index("sla_compensation_events_biz_applied_idx").on(
      table.bizId,
      table.appliedAt,
    ),

    slaCompensationEventsBizBreachFk: foreignKey({
      columns: [table.bizId, table.slaBreachEventId],
      foreignColumns: [slaBreachEvents.bizId, slaBreachEvents.id],
      name: "sla_compensation_events_biz_breach_fk",
    }),

    slaCompensationEventsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "sla_compensation_events_biz_booking_order_fk",
    }),

    slaCompensationEventsBizArInvoiceFk: foreignKey({
      columns: [table.bizId, table.arInvoiceId],
      foreignColumns: [arInvoices.bizId, arInvoices.id],
      name: "sla_compensation_events_biz_ar_invoice_fk",
    }),

    /** Non-zero amount and timeline ordering. */
    slaCompensationEventsAmountTimelineCheck: check(
      "sla_compensation_events_amount_timeline_check",
      sql`
      "amount_minor" > 0
      AND ("applied_at" IS NULL OR "reversed_at" IS NULL OR "reversed_at" >= "applied_at")
      `,
    ),

    /**
     * Credit/refund/gift compensation should link to a financial anchor.
     * Internal or custom adjustments may be bookkeeping-only.
     */
    slaCompensationEventsAnchorShapeCheck: check(
      "sla_compensation_events_anchor_shape_check",
      sql`
      (
        "type" IN ('credit', 'refund', 'gift_value')
        AND ("booking_order_id" IS NOT NULL OR "ar_invoice_id" IS NOT NULL)
      ) OR (
        "type" IN ('internal_adjustment', 'custom')
      )
      `,
    ),

    slaCompensationEventsCurrencyFormatCheck: check(
      "sla_compensation_events_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);
