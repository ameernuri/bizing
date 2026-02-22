import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  varchar,
  text,
} from "drizzle-orm/pg-core";
import { id, idRef, withAuditRefs } from "./_common";
import {
  lifecycleStatusEnum,
  serviceTypeEnum,
  serviceVisibilityEnum,
} from "./enums";
import { bizConfigValues } from "./biz_configs";
import { bizes } from "./bizes";
import { users } from "./users";

/**
 * service_groups
 *
 * Top-level service organization bucket (for UI, permissions, lifecycle, and
 * multi-location rollout). Every service must belong to exactly one group.
 */
export const serviceGroups = pgTable(
  "service_groups",
  {
    id,
    /** Tenant boundary for group ownership and filtering. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    /** Human-facing group name shown in admin/service catalogs. */
    name: varchar("name", { length: 255 }).notNull(),
    /** Stable key for routes/imports; unique per biz. */
    slug: varchar("slug", { length: 120 }).notNull(),
    /** Optional group description/help text. */
    description: text("description"),
    /** Lifecycle state for group visibility and management. */
    status: lifecycleStatusEnum("status").default("active").notNull(),
    /**
     * Optional biz-config dictionary value for tenant-specific status wording.
     * Engine logic can still use `status` while UI/workflows use this FK.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),
    /** Extension payload for non-indexed custom fields. */
    metadata: jsonb("metadata").default({}),
    /** Full audit timestamps + actor references. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    serviceGroupsBizIdIdUnique: uniqueIndex("service_groups_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    serviceGroupsBizSlugUnique: uniqueIndex(
      "service_groups_biz_slug_unique",
    ).on(table.bizId, table.slug),
    serviceGroupsBizStatusIdx: index("service_groups_biz_status_idx").on(
      table.bizId,
      table.status,
    ),
    serviceGroupsBizStatusConfigIdx: index(
      "service_groups_biz_status_config_idx",
    ).on(table.bizId, table.statusConfigValueId),
    /** Tenant-safe FK to optional configurable status dictionary value. */
    serviceGroupsBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "service_groups_biz_status_config_fk",
    }),
  }),
);

/**
 * services
 *
 * Core service template catalog that powers the "what can be booked" layer.
 *
 * This table is intentionally lightweight and non-commercial.
 * Commercial sellable configuration belongs in `service_products`.
 *
 * Relationship map:
 * - Referenced by service-product composition tables to define service intent.
 * - Referenced by canonical `calendar_bindings` when service-level calendars
 *   are used for availability control.
 * - Referenced by ranking/intelligence and policy modules for service-specific
 *   assignment and forecasting behavior.
 * - Location rollout is modeled generically in `subject_location_bindings`
 *   (subject_type=`service`) instead of a dedicated per-domain join table.
 */
export const services = pgTable(
  "services",
  {
    id: id,

    /** Tenant boundary for isolation and indexing in all service queries. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Required parent group for lifecycle/visibility/location rollout control.
     */
    serviceGroupId: idRef("service_group_id")
      .references(() => serviceGroups.id)
      .notNull(),

    /** Customer-facing label used in booking surfaces and receipts. */
    name: varchar("name", { length: 255 }).notNull(),

    /** Stable per-org identifier used in URLs and API routes. */
    slug: varchar("slug", { length: 100 }).notNull(),
    /** Optional customer-facing details shown in catalog/UI. */
    description: text("description"),

    /** High-level booking behavior profile. */
    type: serviceTypeEnum("type").default("appointment").notNull(),
    /**
     * Optional biz-config dictionary value for service type.
     * Supports industry-specific type vocabularies without changing engine enum.
     */
    typeConfigValueId: idRef("type_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Visibility gate for catalog publication and channel exposure. */
    visibility: serviceVisibilityEnum("visibility")
      .default("public")
      .notNull(),
    /**
     * Optional biz-config dictionary value for service visibility language.
     * Example: "members_only" label that internally maps to `private`.
     */
    visibilityConfigValueId: idRef("visibility_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /**
     * Minimum booking lead time in hours at service level.
     *
     * Null means "inherit from resolved calendar/offer/service-product policy".
     */
    minAdvanceBookingHours: integer("min_advance_booking_hours"),

    /**
     * Maximum future booking horizon in days at service level.
     *
     * Null means "inherit from resolved calendar/offer/service-product policy".
     */
    maxAdvanceBookingDays: integer("max_advance_booking_days"),

    /**
     * Last-minute booking cutoff in minutes before start time.
     *
     * Example:
     * - value 30 means booking is blocked inside the final 30 minutes.
     * - null means use inherited/default policy.
     */
    bookingCutoffMinutes: integer("booking_cutoff_minutes"),

    /**
     * Whether this service requires explicit approval before confirmation.
     *
     * This is a normalized common control; deeper approval routing still lives
     * in workflow/policy tables.
     */
    requiresApproval: boolean("requires_approval").default(false).notNull(),

    /**
     * Whether queue/waitlist fallback is allowed for this service.
     *
     * This controls eligibility for queue admission paths in hybrid flows.
     */
    allowWaitlist: boolean("allow_waitlist").default(true).notNull(),

    /**
     * Whether overbooking is allowed at service intent level.
     *
     * Capacity math still depends on calendar/capacity models; this flag is the
     * normalized intent-level gate.
     */
    allowOverbooking: boolean("allow_overbooking").default(false).notNull(),

    /**
     * Minimum notice required to cancel, in hours.
     *
     * Null means inherited/default policy.
     */
    minCancellationNoticeHours: integer("min_cancellation_notice_hours"),

    /**
     * Minimum notice required to reschedule, in hours.
     *
     * Null means inherited/default policy.
     */
    minRescheduleNoticeHours: integer("min_reschedule_notice_hours"),

    /**
     * Extended booking policy payload for rare/advanced knobs.
     *
     * Common constraints are normalized in typed columns above.
     */
    bookingPolicy: jsonb("booking_policy").default({}),

    /** Customer/host cancellation windows and penalties. */
    cancellationPolicy: jsonb("cancellation_policy").default({}),

    /** Deposit requirement model used pre-confirmation. */
    depositPolicy: jsonb("deposit_policy").default({}),

    /** Eligibility predicates (membership, age, prerequisites, etc.). */
    eligibilityPolicy: jsonb("eligibility_policy").default({}),

    /** Extension bucket for non-indexed service attributes. */
    metadata: jsonb("metadata").default({}),

    /** Controls if service appears in customer-facing self-serve booking. */
    isSelfBookable: boolean("is_self_bookable").default(true),

    /** Canonical lifecycle for internal/admin operations. */
    status: lifecycleStatusEnum("status").default("active").notNull(),
    /**
     * Optional biz-config dictionary value for tenant-specific service status.
     */
    statusConfigValueId: idRef("status_config_value_id").references(
      () => bizConfigValues.id,
    ),

    /** Full audit timestamps + actor references. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    servicesBizIdIdUnique: uniqueIndex("services_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique target for tenant-safe composite foreign keys. */
    servicesOrgSlugUnique: uniqueIndex("services_org_slug_unique").on(
      table.bizId,
      table.slug,
    ),
    servicesOrgStatusIdx: index("services_org_status_idx").on(
      table.bizId,
      table.status,
    ),
    servicesOrgTypeIdx: index("services_org_type_idx").on(
      table.bizId,
      table.type,
    ),
    servicesBizTypeConfigIdx: index("services_biz_type_config_idx").on(
      table.bizId,
      table.typeConfigValueId,
    ),
    servicesBizVisibilityConfigIdx: index(
      "services_biz_visibility_config_idx",
    ).on(table.bizId, table.visibilityConfigValueId),
    servicesBizStatusConfigIdx: index("services_biz_status_config_idx").on(
      table.bizId,
      table.statusConfigValueId,
    ),
    servicesBizGroupIdx: index("services_biz_group_idx").on(
      table.bizId,
      table.serviceGroupId,
    ),
    /** Optional query path for approval/queue operational filters. */
    servicesBizApprovalWaitlistIdx: index("services_biz_approval_waitlist_idx").on(
      table.bizId,
      table.requiresApproval,
      table.allowWaitlist,
      table.status,
    ),
    /** Enforces service-group membership inside the same biz. */
    servicesBizServiceGroupFk: foreignKey({
      columns: [table.bizId, table.serviceGroupId],
      foreignColumns: [serviceGroups.bizId, serviceGroups.id],
      name: "services_biz_service_group_fk",
    }),
    /** Tenant-safe FK to optional configurable service type value. */
    servicesBizTypeConfigFk: foreignKey({
      columns: [table.bizId, table.typeConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "services_biz_type_config_fk",
    }),
    /** Tenant-safe FK to optional configurable visibility value. */
    servicesBizVisibilityConfigFk: foreignKey({
      columns: [table.bizId, table.visibilityConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "services_biz_visibility_config_fk",
    }),
    /** Tenant-safe FK to optional configurable status value. */
    servicesBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "services_biz_status_config_fk",
    }),
    /** Booking lead/horizon/cutoff and notice values must be non-negative. */
    servicesBookingWindowBoundsCheck: check(
      "services_booking_window_bounds_check",
      sql`
      ("min_advance_booking_hours" IS NULL OR "min_advance_booking_hours" >= 0)
      AND ("max_advance_booking_days" IS NULL OR "max_advance_booking_days" >= 0)
      AND ("booking_cutoff_minutes" IS NULL OR "booking_cutoff_minutes" >= 0)
      AND (
        "min_cancellation_notice_hours" IS NULL
        OR "min_cancellation_notice_hours" >= 0
      )
      AND (
        "min_reschedule_notice_hours" IS NULL
        OR "min_reschedule_notice_hours" >= 0
      )
      `,
    ),
    /** If both horizons exist, max future horizon must be >= minimum lead. */
    servicesLeadVsHorizonCheck: check(
      "services_lead_vs_horizon_check",
      sql`
      "min_advance_booking_hours" IS NULL
      OR "max_advance_booking_days" IS NULL
      OR ("max_advance_booking_days" * 24) >= "min_advance_booking_hours"
      `,
    ),
  }),
);

export type ServiceGroup = typeof serviceGroups.$inferSelect;
export type NewServiceGroup = typeof serviceGroups.$inferInsert;

export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
