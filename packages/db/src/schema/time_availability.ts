import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  time,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { groupAccounts } from "./group_accounts";
import { locations } from "./locations";
import { sellables } from "./product_commerce";
import { products } from "./products";
import { resources } from "./resources";
import { serviceProducts } from "./service_products";
import { services } from "./services";
import { subjects } from "./subjects";
import { users } from "./users";
import {
  availabilityDependencyEnforcementModeEnum,
  availabilityDependencyEvaluationModeEnum,
  availabilityDependencyTargetTypeEnum,
  availabilityDefaultModeEnum,
  availabilityGateSignalTypeEnum,
  availabilityResolutionStatusEnum,
  availabilityRuleActionEnum,
  availabilityRuleFrequencyEnum,
  availabilityRuleModeEnum,
  calendarConflictResolutionModeEnum,
  calendarOverlayKindEnum,
  calendarOwnerTypeEnum,
  calendarRuleEvaluationOrderEnum,
  calendarStatusEnum,
  calendarTemplateMergeModeEnum,
  calendarTimelineEventSourceTypeEnum,
  calendarTimelineStateEnum,
  calendarTimelineVisibilityEnum,
  capacityHoldEventTypeEnum,
  capacityHoldStatusEnum,
  capacityHoldTargetTypeEnum,
  capacityHoldDemandAlertSeverityEnum,
  capacityHoldDemandAlertStatusEnum,
  capacityHoldEffectModeEnum,
  capacityHoldOwnerTypeEnum,
  capacityHoldPolicyTargetTypeEnum,
  capacityPoolMemberTypeEnum,
  capacityPoolStatusEnum,
  lifecycleStatusEnum,
} from "./enums";
import { offerVersions, offers } from "./offers";

/**
 * calendars
 *
 * ELI5:
 * A calendar stores "how time behaves" (slot size, lead time, default mode).
 * Owners are attached through `calendar_bindings` so one design can work for
 * resources, services, service products, offers, offer versions, and locations.
 * Queue/trip modules link to bindings from their own tables to avoid cyclic
 * schema dependencies in this canonical module.
 *
 * Why decouple owner from calendar row:
 * - supports independent calendar lifecycle,
 * - avoids sparse polymorphic owner columns in core table,
 * - supports sharing one calendar across multiple owners when needed.
 */
export const calendars = pgTable(
  "calendars",
  {
    /** Stable primary key for this calendar configuration object. */
    id: idWithTag("calendar"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human calendar name (Default, Peak Season, Emergency Fallback...). */
    name: varchar("name", { length: 200 }).notNull(),

    /** Rendering timezone for this calendar's local-time rules. */
    timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),

    /** Default slot duration when caller does not provide custom duration. */
    slotDurationMin: integer("slot_duration_min").default(30).notNull(),

    /** Slot start interval stepping (e.g., every 15 minutes). */
    slotIntervalMin: integer("slot_interval_min").default(15).notNull(),

    /** Prep buffer in minutes before each appointment/slot. */
    preBufferMin: integer("pre_buffer_min").default(0).notNull(),

    /** Cleanup buffer in minutes after each appointment/slot. */
    postBufferMin: integer("post_buffer_min").default(0).notNull(),

    /** Minimum hours in advance a booking can be made. */
    minAdvanceBookingHours: integer("min_advance_booking_hours")
      .default(0)
      .notNull(),

    /** Maximum days in advance a booking can be made. */
    maxAdvanceBookingDays: integer("max_advance_booking_days")
      .default(365)
      .notNull(),

    /** Baseline behavior when no availability rule matches. */
    defaultMode: availabilityDefaultModeEnum("default_mode")
      .default("available_by_default")
      .notNull(),

    /**
     * Deterministic sorting strategy used by resolver engines before applying
     * conflict resolution logic.
     */
    ruleEvaluationOrder: calendarRuleEvaluationOrderEnum("rule_evaluation_order")
      .default("specificity_then_priority")
      .notNull(),

    /**
     * Tie-break strategy when two active rules disagree on the same interval.
     *
     * This keeps conflict semantics explicit and tenant-configurable.
     */
    conflictResolutionMode: calendarConflictResolutionModeEnum("conflict_resolution_mode")
      .default("unavailable_wins")
      .notNull(),

    /**
     * If true, scheduling engines should treat overlap prevention as strict
     * policy and fail conflicting writes rather than auto-resolving.
     */
    enforceStrictNonOverlap: boolean("enforce_strict_non_overlap")
      .default(false)
      .notNull(),

    /**
     * Enables writing normalized timeline facts for this calendar.
     *
     * Turn off only when a tenant intentionally disables read-model projection.
     */
    emitTimelineFacts: boolean("emit_timeline_facts").default(true).notNull(),

    /** Operational on/off switch for this calendar object. */
    status: calendarStatusEnum("status").default("active").notNull(),

    /** Calendar-level policy payload (visibility/cascading/hold behavior). */
    policy: jsonb("policy").default({}),

    /** Extension bucket for future scheduler settings. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    calendarsBizIdIdUnique: uniqueIndex("calendars_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key used by tenant-safe child tables. */

    /** Helps find active calendars quickly in admin/operator tooling. */
    calendarsBizStatusIdx: index("calendars_biz_status_idx").on(
      table.bizId,
      table.status,
    ),

    /** Useful filter path for policy-aware scheduler configuration screens. */
    calendarsBizPolicyModeIdx: index("calendars_biz_policy_mode_idx").on(
      table.bizId,
      table.ruleEvaluationOrder,
      table.conflictResolutionMode,
      table.enforceStrictNonOverlap,
      table.emitTimelineFacts,
    ),

    /** Slot and interval must be positive to avoid infinite-loop slot builders. */
    calendarsSlotPositiveCheck: check(
      "calendars_slot_positive_check",
      sql`"slot_duration_min" > 0 AND "slot_interval_min" > 0`,
    ),

    /** Buffers cannot be negative. */
    calendarsBufferNonNegativeCheck: check(
      "calendars_buffer_non_negative_check",
      sql`"pre_buffer_min" >= 0 AND "post_buffer_min" >= 0`,
    ),

    /** Booking horizon values must be non-negative. */
    calendarsHorizonNonNegativeCheck: check(
      "calendars_horizon_non_negative_check",
      sql`"min_advance_booking_hours" >= 0 AND "max_advance_booking_days" >= 0`,
    ),

    /**
     * Booking horizon should always be wide enough to include lead-time.
     *
     * Example:
     * - min lead = 72h
     * - max horizon = 1 day (24h) -> invalid
     */
    calendarsHorizonConsistencyCheck: check(
      "calendars_horizon_consistency_check",
      sql`("max_advance_booking_days" * 24) >= "min_advance_booking_hours"`,
    ),
  }),
);

/**
 * calendar_bindings
 *
 * ELI5:
 * This table says "who uses which calendar".
 * It keeps owner mapping explicit and extensible.
 * Owners can be:
 * - a biz (global company calendar),
 * - a user (host/client personal calendar context),
 * - or operational entities (resource/service/location/offer/...).
 *
 * Design choice:
 * - one active primary binding per owner is enforced,
 * - an owner can still have historical/inactive bindings.
 */
export const calendarBindings = pgTable(
  "calendar_bindings",
  {
    /** Stable primary key for mapping row. */
    id: idWithTag("calendar_binding"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Target calendar used by this owner. */
    calendarId: idRef("calendar_id")
      .references(() => calendars.id)
      .notNull(),

    /** Owner discriminator. */
    ownerType: calendarOwnerTypeEnum("owner_type").notNull(),

    /** Owner payload for resources. */
    resourceId: idRef("resource_id").references(() => resources.id),

    /** Owner payload for services. */
    serviceId: idRef("service_id").references(() => services.id),

    /** Owner payload for service products. */
    serviceProductId: idRef("service_product_id").references(
      () => serviceProducts.id,
    ),

    /** Owner payload for offer shells. */
    offerId: idRef("offer_id").references(() => offers.id),

    /** Owner payload for offer versions. */
    offerVersionId: idRef("offer_version_id").references(() => offerVersions.id),

    /** Owner payload for locations. */
    locationId: idRef("location_id").references(() => locations.id),

    /**
     * Owner payload for user-owned calendar views.
     *
     * Why this exists:
     * - hosts often need personal calendars for conflict checks,
     * - clients can share personal availability for booking suggestions.
     *
     * A user owner is intentionally separate from `resource`:
     * - `resource` is supply-side operational identity in one biz.
     * - `user` is person identity that can span multiple biz memberships.
     */
    ownerUserId: idRef("owner_user_id").references(() => users.id),

    /**
     * Extensibility owner kind for plugin/custom domain bindings.
     *
     * ELI5:
     * - built-in owners (resource/service/offer...) use typed FK columns above.
     * - custom owners can use this string + ref id pair without schema changes.
     */
    ownerRefType: varchar("owner_ref_type", { length: 80 }),

    /**
     * Canonical id of the custom owner target when `owner_type=custom_subject`.
     * This is not FK-constrained by design so external/plugin modules can bind.
     */
    ownerRefId: idRef("owner_ref_id"),
    /**
     * Canonical owner key for generic owner-scoped queries.
     *
     * ELI5:
     * This gives us one deterministic string identity for all owner types so
     * APIs/plugins can query "show me this owner's calendar timeline" without
     * branching by every typed FK column.
     *
     * Format:
     * - biz: `biz`
     * - user: `user:{owner_user_id}`
     * - resource: `resource:{resource_id}`
     * - service: `service:{service_id}`
     * - service_product: `service_product:{service_product_id}`
     * - offer: `offer:{offer_id}`
     * - offer_version: `offer_version:{offer_version_id}`
     * - location: `location:{location_id}`
     * - custom_subject: `custom_subject:{owner_ref_type}:{owner_ref_id}`
     */
    ownerRefKey: varchar("owner_ref_key", { length: 320 }).notNull(),

    /**
     * Marks which binding is the active/default calendar for this owner.
     * Only one active primary binding is allowed per owner.
     */
    isPrimary: boolean("is_primary").default(true).notNull(),

    /** Toggle to retire/disable a mapping without deleting it. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Extension payload for binding-specific options. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    calendarBindingsBizIdIdUnique: uniqueIndex("calendar_bindings_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /**
     * Composite key for tenant-safe cross-module references.
     *
     * Why this exists:
     * - other modules (like calendar sharing grants) can reference one binding
     *   with `(biz_id, id)` and keep tenant boundaries enforced by FK.
     */

    /**
     * Composite key that includes owner user id.
     *
     * Why this exists:
     * - calendar-sharing source rows can prove "this binding belongs to user U"
     *   by FK on `(source_biz_id, calendar_binding_id, owner_user_id)`.
     * - non-user bindings carry `owner_user_id = NULL`, so they cannot satisfy
     *   that FK and therefore cannot be linked as user-owned share sources.
     */
    calendarBindingsBizIdIdOwnerUserUnique: uniqueIndex(
      "calendar_bindings_biz_id_id_owner_user_unique",
    ).on(table.bizId, table.id, table.ownerUserId),

    /** Fast lookup path for "get calendar by owner" queries. */
    calendarBindingsBizOwnerTypeIdx: index("calendar_bindings_biz_owner_type_idx").on(
      table.bizId,
      table.ownerType,
    ),

    /** Common path for backtracking owner list from calendar. */
    calendarBindingsBizCalendarIdx: index("calendar_bindings_biz_calendar_idx").on(
      table.bizId,
      table.calendarId,
    ),
    /** Common lookup path for extensible custom-subject owners. */
    calendarBindingsBizOwnerRefIdx: index("calendar_bindings_biz_owner_ref_idx").on(
      table.bizId,
      table.ownerRefType,
      table.ownerRefId,
    ),
    /** Fast owner lookup path independent of typed FK columns. */
    calendarBindingsBizOwnerRefKeyIdx: index("calendar_bindings_biz_owner_ref_key_idx").on(
      table.bizId,
      table.ownerRefKey,
    ),
    /** Common lookup path for user-owned calendar bindings inside one biz. */
    calendarBindingsBizOwnerUserIdx: index("calendar_bindings_biz_owner_user_idx").on(
      table.bizId,
      table.ownerUserId,
    ),

    /** Tenant-safe FK to calendar. */
    calendarBindingsBizCalendarFk: foreignKey({
      columns: [table.bizId, table.calendarId],
      foreignColumns: [calendars.bizId, calendars.id],
      name: "calendar_bindings_biz_calendar_fk",
    }),

    /** Tenant-safe FK for resource owners. */
    calendarBindingsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "calendar_bindings_biz_resource_fk",
    }),

    /** Tenant-safe FK for service owners. */
    calendarBindingsBizServiceFk: foreignKey({
      columns: [table.bizId, table.serviceId],
      foreignColumns: [services.bizId, services.id],
      name: "calendar_bindings_biz_service_fk",
    }),

    /** Tenant-safe FK for service-product owners. */
    calendarBindingsBizServiceProductFk: foreignKey({
      columns: [table.bizId, table.serviceProductId],
      foreignColumns: [serviceProducts.bizId, serviceProducts.id],
      name: "calendar_bindings_biz_service_product_fk",
    }),

    /** Tenant-safe FK for offer owners. */
    calendarBindingsBizOfferFk: foreignKey({
      columns: [table.bizId, table.offerId],
      foreignColumns: [offers.bizId, offers.id],
      name: "calendar_bindings_biz_offer_fk",
    }),

    /** Tenant-safe FK for offer-version owners. */
    calendarBindingsBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "calendar_bindings_biz_offer_version_fk",
    }),

    /** Tenant-safe FK for location owners. */
    calendarBindingsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "calendar_bindings_biz_location_fk",
    }),

    /**
     * Tenant-safe FK for extensible custom subjects.
     *
     * This provides referential safety for plugin/custom owner refs while
     * preserving generic `type + id` extensibility.
     */
    calendarBindingsBizOwnerRefSubjectFk: foreignKey({
      columns: [table.bizId, table.ownerRefType, table.ownerRefId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "calendar_bindings_biz_owner_ref_subject_fk",
    }),

    /**
     * Owner payload shape check.
     * Exactly one owner payload must be set according to `owner_type`.
     */
    calendarBindingsOwnerShapeCheck: check(
      "calendar_bindings_owner_shape_check",
      sql`
      (
        "owner_type" = 'biz'
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "location_id" IS NULL
        AND "owner_user_id" IS NULL
        AND "owner_ref_type" IS NULL
        AND "owner_ref_id" IS NULL
        AND "owner_ref_key" = 'biz'
      ) OR (
        "owner_type" = 'user'
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "location_id" IS NULL
        AND "owner_user_id" IS NOT NULL
        AND "owner_ref_type" IS NULL
        AND "owner_ref_id" IS NULL
        AND "owner_ref_key" IS NOT NULL
      ) OR (
        "owner_type" = 'resource'
        AND "resource_id" IS NOT NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "location_id" IS NULL
        AND "owner_user_id" IS NULL
        AND "owner_ref_type" IS NULL
        AND "owner_ref_id" IS NULL
        AND "owner_ref_key" IS NOT NULL
      ) OR (
        "owner_type" = 'service'
        AND "resource_id" IS NULL
        AND "service_id" IS NOT NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "location_id" IS NULL
        AND "owner_user_id" IS NULL
        AND "owner_ref_type" IS NULL
        AND "owner_ref_id" IS NULL
        AND "owner_ref_key" IS NOT NULL
      ) OR (
        "owner_type" = 'service_product'
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NOT NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "location_id" IS NULL
        AND "owner_user_id" IS NULL
        AND "owner_ref_type" IS NULL
        AND "owner_ref_id" IS NULL
        AND "owner_ref_key" IS NOT NULL
      ) OR (
        "owner_type" = 'offer'
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NOT NULL
        AND "offer_version_id" IS NULL
        AND "location_id" IS NULL
        AND "owner_user_id" IS NULL
        AND "owner_ref_type" IS NULL
        AND "owner_ref_id" IS NULL
        AND "owner_ref_key" IS NOT NULL
      ) OR (
        "owner_type" = 'offer_version'
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NOT NULL
        AND "location_id" IS NULL
        AND "owner_user_id" IS NULL
        AND "owner_ref_type" IS NULL
        AND "owner_ref_id" IS NULL
        AND "owner_ref_key" IS NOT NULL
      ) OR (
        "owner_type" = 'location'
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "location_id" IS NOT NULL
        AND "owner_user_id" IS NULL
        AND "owner_ref_type" IS NULL
        AND "owner_ref_id" IS NULL
        AND "owner_ref_key" IS NOT NULL
      ) OR (
        "owner_type" = 'custom_subject'
        AND "resource_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "location_id" IS NULL
        AND "owner_user_id" IS NULL
        AND "owner_ref_type" IS NOT NULL
        AND "owner_ref_id" IS NOT NULL
        AND "owner_ref_key" IS NOT NULL
      )
      `,
    ),

    /** Canonical owner key must match the selected owner payload exactly. */
    calendarBindingsOwnerRefKeyShapeCheck: check(
      "calendar_bindings_owner_ref_key_shape_check",
      sql`
      (
        "owner_type" = 'biz'
        AND "owner_ref_key" = 'biz'
      ) OR (
        "owner_type" = 'user'
        AND "owner_ref_key" = ('user:' || "owner_user_id")
      ) OR (
        "owner_type" = 'resource'
        AND "owner_ref_key" = ('resource:' || "resource_id")
      ) OR (
        "owner_type" = 'service'
        AND "owner_ref_key" = ('service:' || "service_id")
      ) OR (
        "owner_type" = 'service_product'
        AND "owner_ref_key" = ('service_product:' || "service_product_id")
      ) OR (
        "owner_type" = 'offer'
        AND "owner_ref_key" = ('offer:' || "offer_id")
      ) OR (
        "owner_type" = 'offer_version'
        AND "owner_ref_key" = ('offer_version:' || "offer_version_id")
      ) OR (
        "owner_type" = 'location'
        AND "owner_ref_key" = ('location:' || "location_id")
      ) OR (
        "owner_type" = 'custom_subject'
        AND "owner_ref_key" = ('custom_subject:' || "owner_ref_type" || ':' || "owner_ref_id")
      )
      `,
    ),

    /**
     * One active primary binding for the biz-level owner.
     *
     * ELI5:
     * A biz can have many historical calendars, but only one "main" active
     * biz calendar at a time.
     */
    calendarBindingsPrimaryPerBizUnique: uniqueIndex(
      "calendar_bindings_primary_per_biz_unique",
    )
      .on(table.bizId)
      .where(
        sql`"owner_type" = 'biz' AND "is_primary" = true AND "is_active" = true AND "deleted_at" IS NULL`,
      ),

    /** One active primary binding per user within one biz. */
    calendarBindingsPrimaryPerUserUnique: uniqueIndex(
      "calendar_bindings_primary_per_user_unique",
    )
      .on(table.bizId, table.ownerUserId)
      .where(
        sql`"owner_type" = 'user' AND "is_primary" = true AND "is_active" = true AND "deleted_at" IS NULL`,
      ),

    /** One active primary binding per resource. */
    calendarBindingsPrimaryPerResourceUnique: uniqueIndex(
      "calendar_bindings_primary_per_resource_unique",
    )
      .on(table.bizId, table.resourceId)
      .where(
        sql`"owner_type" = 'resource' AND "is_primary" = true AND "is_active" = true AND "deleted_at" IS NULL`,
      ),

    /** One active primary binding per service. */
    calendarBindingsPrimaryPerServiceUnique: uniqueIndex(
      "calendar_bindings_primary_per_service_unique",
    )
      .on(table.bizId, table.serviceId)
      .where(
        sql`"owner_type" = 'service' AND "is_primary" = true AND "is_active" = true AND "deleted_at" IS NULL`,
      ),

    /** One active primary binding per service product. */
    calendarBindingsPrimaryPerServiceProductUnique: uniqueIndex(
      "calendar_bindings_primary_per_service_product_unique",
    )
      .on(table.bizId, table.serviceProductId)
      .where(
        sql`"owner_type" = 'service_product' AND "is_primary" = true AND "is_active" = true AND "deleted_at" IS NULL`,
      ),

    /** One active primary binding per offer. */
    calendarBindingsPrimaryPerOfferUnique: uniqueIndex(
      "calendar_bindings_primary_per_offer_unique",
    )
      .on(table.bizId, table.offerId)
      .where(
        sql`"owner_type" = 'offer' AND "is_primary" = true AND "is_active" = true AND "deleted_at" IS NULL`,
      ),

    /** One active primary binding per offer version. */
    calendarBindingsPrimaryPerOfferVersionUnique: uniqueIndex(
      "calendar_bindings_primary_per_offer_version_unique",
    )
      .on(table.bizId, table.offerVersionId)
      .where(
        sql`"owner_type" = 'offer_version' AND "is_primary" = true AND "is_active" = true AND "deleted_at" IS NULL`,
      ),

    /** One active primary binding per location. */
    calendarBindingsPrimaryPerLocationUnique: uniqueIndex(
      "calendar_bindings_primary_per_location_unique",
    )
      .on(table.bizId, table.locationId)
      .where(
        sql`"owner_type" = 'location' AND "is_primary" = true AND "is_active" = true AND "deleted_at" IS NULL`,
      ),
    /** One active primary binding per extensible custom subject. */
    calendarBindingsPrimaryPerCustomSubjectUnique: uniqueIndex(
      "calendar_bindings_primary_per_custom_subject_unique",
    )
      .on(table.bizId, table.ownerRefType, table.ownerRefId)
      .where(
        sql`"owner_type" = 'custom_subject' AND "is_primary" = true AND "is_active" = true AND "deleted_at" IS NULL`,
      ),

  }),
);

/**
 * availability_rule_templates
 *
 * ELI5:
 * A template is a reusable rule pack that can be attached to many calendars.
 *
 * Why this matters:
 * - avoids copying the same weekly-hours rules to every host/resource calendar,
 * - keeps schedule governance centralized and easier to evolve safely.
 */
export const availabilityRuleTemplates = pgTable(
  "availability_rule_templates",
  {
    /** Stable primary key for one reusable template definition. */
    id: idWithTag("availability_rule_template"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Optional location scope.
     * Null means template is biz-wide; non-null means location-scoped template.
     */
    locationId: idRef("location_id").references(() => locations.id),

    /** Human-readable template label. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Stable key used by APIs/import/export. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Optional operator-facing context and intent notes. */
    description: varchar("description", { length: 800 }),

    /** Lifecycle state of this template definition. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Default evaluation priority for template rows when bound to calendars. */
    priority: integer("priority").default(100).notNull(),

    /** Template-level policy knobs (e.g. audience, rollout hints). */
    policy: jsonb("policy").default({}),

    /** Extension payload for future vertical-specific metadata. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key used by tenant-safe binding/item tables. */
    availabilityRuleTemplatesBizIdIdUnique: uniqueIndex(
      "availability_rule_templates_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Stable slug per scope. */
    availabilityRuleTemplatesBizScopeSlugUnique: uniqueIndex(
      "availability_rule_templates_biz_scope_slug_unique",
    ).on(table.bizId, table.locationId, table.slug),

    /** Common listing path for template catalogs. */
    availabilityRuleTemplatesBizStatusActiveIdx: index(
      "availability_rule_templates_biz_status_active_idx",
    ).on(table.bizId, table.status, table.priority),

    /** Tenant-safe FK to optional location scope. */
    availabilityRuleTemplatesBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "availability_rule_templates_biz_location_fk",
    }),

    /** Priority must be non-negative. */
    availabilityRuleTemplatesPriorityCheck: check(
      "availability_rule_templates_priority_check",
      sql`"priority" >= 0`,
    ),
  }),
);

/**
 * availability_rule_template_items
 *
 * ELI5:
 * These are the actual rule rows inside one template.
 *
 * Each row mirrors `availability_rules` semantics but is detached from any
 * specific calendar until bound through `calendar_rule_template_bindings`.
 */
export const availabilityRuleTemplateItems = pgTable(
  "availability_rule_template_items",
  {
    /** Stable primary key for one template rule row. */
    id: idWithTag("availability_rule_template_item"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent template definition. */
    availabilityRuleTemplateId: idRef("availability_rule_template_id")
      .references(() => availabilityRuleTemplates.id)
      .notNull(),

    /** Rule label for admin readability and incident debugging. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Rule window mode. */
    mode: availabilityRuleModeEnum("mode").notNull(),

    /** Recurrence cadence for recurring rules. */
    frequency: availabilityRuleFrequencyEnum("frequency")
      .default("none")
      .notNull(),

    /** Advanced recurrence expression (iCalendar RRULE style). */
    recurrenceRule: varchar("recurrence_rule", { length: 500 }),

    /** Day-of-week selector (0..6) for weekly style logic. */
    dayOfWeek: integer("day_of_week"),

    /** Day-of-month selector (1..31) for monthly style logic. */
    dayOfMonth: integer("day_of_month"),

    /** Local date range start for recurring/date-range windows. */
    startDate: date("start_date"),

    /** Local date range end for recurring/date-range windows. */
    endDate: date("end_date"),

    /** Local time start for recurring/date-range windows. */
    startTime: time("start_time"),

    /** Local time end for recurring/date-range windows. */
    endTime: time("end_time"),

    /** Absolute timestamp start for exact windows. */
    startAt: timestamp("start_at", { withTimezone: true }),

    /** Absolute timestamp end for exact windows. */
    endAt: timestamp("end_at", { withTimezone: true }),

    /** Result applied when this rule matches. */
    action: availabilityRuleActionEnum("action").notNull(),

    /** Optional capacity adjustment when `action = capacity_adjustment`. */
    capacityDelta: integer("capacity_delta"),

    /** Optional pricing payload when `action = special_pricing`. */
    pricingAdjustment: jsonb("pricing_adjustment"),

    /** Lower number means evaluated earlier unless engine chooses other strategy. */
    priority: integer("priority").default(100).notNull(),

    /** Operational toggle for safe staged deployments. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key used by tenant-safe child tables. */
    availabilityRuleTemplateItemsBizIdIdUnique: uniqueIndex(
      "availability_rule_template_items_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Main expansion path for one template definition. */
    availabilityRuleTemplateItemsBizTemplateIdx: index(
      "availability_rule_template_items_biz_template_idx",
    ).on(
      table.bizId,
      table.availabilityRuleTemplateId,
      table.isActive,
      table.priority,
    ),

    /** Common time-window lookup path in template-preview engines. */
    availabilityRuleTemplateItemsBizTemplateModeWindowIdx: index(
      "availability_rule_template_items_biz_tpl_mode_window_idx",
    ).on(
      table.bizId,
      table.availabilityRuleTemplateId,
      table.isActive,
      table.mode,
      table.startAt,
      table.endAt,
    ),

    /** Tenant-safe FK to template parent. */
    availabilityRuleTemplateItemsBizTemplateFk: foreignKey({
      columns: [table.bizId, table.availabilityRuleTemplateId],
      foreignColumns: [availabilityRuleTemplates.bizId, availabilityRuleTemplates.id],
      name: "availability_rule_template_items_biz_template_fk",
    }),

    /** Weekly day bounds. */
    availabilityRuleTemplateItemsDayOfWeekBoundsCheck: check(
      "availability_rule_template_items_day_of_week_bounds_check",
      sql`"day_of_week" IS NULL OR ("day_of_week" >= 0 AND "day_of_week" <= 6)`,
    ),

    /** Monthly day bounds. */
    availabilityRuleTemplateItemsDayOfMonthBoundsCheck: check(
      "availability_rule_template_items_day_of_month_bounds_check",
      sql`"day_of_month" IS NULL OR ("day_of_month" >= 1 AND "day_of_month" <= 31)`,
    ),

    /** Date range ordering. */
    availabilityRuleTemplateItemsDateRangeCheck: check(
      "availability_rule_template_items_date_range_check",
      sql`"start_date" IS NULL OR "end_date" IS NULL OR "end_date" >= "start_date"`,
    ),

    /** Timestamp range ordering. */
    availabilityRuleTemplateItemsTimestampRangeCheck: check(
      "availability_rule_template_items_timestamp_range_check",
      sql`"start_at" IS NULL OR "end_at" IS NULL OR "end_at" > "start_at"`,
    ),

    /** Time range ordering for local windows. */
    availabilityRuleTemplateItemsLocalTimeRangeCheck: check(
      "availability_rule_template_items_local_time_range_check",
      sql`"start_time" IS NULL OR "end_time" IS NULL OR "end_time" > "start_time"`,
    ),

    /** Mode-shape invariant for deterministic evaluation. */
    availabilityRuleTemplateItemsModeShapeCheck: check(
      "availability_rule_template_items_mode_shape_check",
      sql`
      (
        "mode" = 'recurring'
        AND (
          "frequency" IN ('daily', 'weekly', 'monthly', 'yearly', 'recurrence_rule')
        )
        AND "start_at" IS NULL
        AND "end_at" IS NULL
      ) OR (
        "mode" = 'date_range'
        AND "start_date" IS NOT NULL
        AND "end_date" IS NOT NULL
        AND "start_at" IS NULL
        AND "end_at" IS NULL
      ) OR (
        "mode" = 'timestamp_range'
        AND "start_at" IS NOT NULL
        AND "end_at" IS NOT NULL
      )
      `,
    ),

    /** Action payload shape check. */
    availabilityRuleTemplateItemsActionShapeCheck: check(
      "availability_rule_template_items_action_shape_check",
      sql`
      (
        "action" IN ('available', 'unavailable', 'override_hours')
        AND "capacity_delta" IS NULL
      ) OR (
        "action" = 'special_pricing'
        AND "pricing_adjustment" IS NOT NULL
      ) OR (
        "action" = 'capacity_adjustment'
        AND "capacity_delta" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * calendar_rule_template_bindings
 *
 * ELI5:
 * This table attaches reusable templates to concrete calendars.
 *
 * The binding holds merge strategy + effective window so one template can be
 * rolled out safely across many calendars with staged activation.
 */
export const calendarRuleTemplateBindings = pgTable(
  "calendar_rule_template_bindings",
  {
    /** Stable primary key for one binding row. */
    id: idWithTag("calendar_rule_template_binding"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Calendar receiving template-derived rules. */
    calendarId: idRef("calendar_id")
      .references(() => calendars.id)
      .notNull(),

    /** Reusable template being applied. */
    availabilityRuleTemplateId: idRef("availability_rule_template_id")
      .references(() => availabilityRuleTemplates.id)
      .notNull(),

    /** Composition strategy against calendar-local rule rows. */
    mergeMode: calendarTemplateMergeModeEnum("merge_mode")
      .default("append")
      .notNull(),

    /** Binding-level priority in template-merge orchestration. */
    priority: integer("priority").default(100).notNull(),

    /** Optional activation window start. */
    effectiveStartAt: timestamp("effective_start_at", { withTimezone: true }),

    /** Optional activation window end. */
    effectiveEndAt: timestamp("effective_end_at", { withTimezone: true }),

    /** Operational on/off switch for safe rollout and rollback. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Binding-level policy payload (audience/flags/override knobs). */
    policy: jsonb("policy").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key used by tenant-safe exclusion-date table. */
    calendarRuleTemplateBindingsBizIdIdUnique: uniqueIndex(
      "calendar_rule_template_bindings_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Avoid duplicate active bindings for same calendar-template pair. */
    calendarRuleTemplateBindingsActivePairUnique: uniqueIndex(
      "calendar_rule_template_bindings_active_pair_unique",
    )
      .on(table.bizId, table.calendarId, table.availabilityRuleTemplateId)
      .where(sql`"is_active" = true AND "deleted_at" IS NULL`),

    /** Common lookup path for template-expansion in resolver engines. */
    calendarRuleTemplateBindingsBizCalendarActiveIdx: index(
      "calendar_rule_template_bindings_biz_cal_active_idx",
    ).on(
      table.bizId,
      table.calendarId,
      table.isActive,
      table.priority,
      table.effectiveStartAt,
      table.effectiveEndAt,
    ),

    /** Reverse lookup path for template governance dashboards. */
    calendarRuleTemplateBindingsBizTemplateActiveIdx: index(
      "calendar_rule_template_bindings_biz_tpl_active_idx",
    ).on(table.bizId, table.availabilityRuleTemplateId, table.isActive),

    /** Tenant-safe FK to calendar. */
    calendarRuleTemplateBindingsBizCalendarFk: foreignKey({
      columns: [table.bizId, table.calendarId],
      foreignColumns: [calendars.bizId, calendars.id],
      name: "calendar_rule_template_bindings_biz_calendar_fk",
    }),

    /** Tenant-safe FK to template. */
    calendarRuleTemplateBindingsBizTemplateFk: foreignKey({
      columns: [table.bizId, table.availabilityRuleTemplateId],
      foreignColumns: [availabilityRuleTemplates.bizId, availabilityRuleTemplates.id],
      name: "calendar_rule_template_bindings_biz_template_fk",
    }),

    /** Priority must be non-negative. */
    calendarRuleTemplateBindingsPriorityCheck: check(
      "calendar_rule_template_bindings_priority_check",
      sql`"priority" >= 0`,
    ),

    /** Effective window must be ordered when both endpoints are present. */
    calendarRuleTemplateBindingsWindowCheck: check(
      "calendar_rule_template_bindings_window_check",
      sql`"effective_start_at" IS NULL OR "effective_end_at" IS NULL OR "effective_end_at" > "effective_start_at"`,
    ),
  }),
);

/**
 * calendar_rule_template_binding_exclusion_dates
 *
 * ELI5:
 * This table provides rule-template "exception days" without creating many
 * one-off override rows.
 *
 * Example:
 * - base template says Mon-Fri open,
 * - add exclusion date for a holiday closure.
 */
export const calendarRuleTemplateBindingExclusionDates = pgTable(
  "calendar_rule_template_binding_exclusion_dates",
  {
    /** Stable primary key. */
    id: idWithTag("calendar_template_exclusion_date"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Binding receiving this exclusion date. */
    calendarRuleTemplateBindingId: idRef("calendar_rule_template_binding_id")
      .references(() => calendarRuleTemplateBindings.id)
      .notNull(),

    /** Local calendar date to skip template-derived rules. */
    exclusionDate: date("exclusion_date").notNull(),

    /** Optional reason code (holiday, strike, closure, event). */
    reasonCode: varchar("reason_code", { length: 120 }),

    /** Optional human-readable explanation. */
    note: varchar("note", { length: 600 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    calendarRuleTemplateBindingExclusionDatesBizIdIdUnique: uniqueIndex("calendar_rule_template_binding_exclusion_dates_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One exclusion date per binding/day. */
    calendarRuleTemplateBindingExclusionDatesUnique: uniqueIndex(
      "calendar_rule_template_binding_excl_dates_unique",
    ).on(table.bizId, table.calendarRuleTemplateBindingId, table.exclusionDate),

    /** Common expansion path for one binding's exception set. */
    calendarRuleTemplateBindingExclusionDatesBizBindingIdx: index(
      "calendar_rule_template_binding_excl_dates_biz_binding_idx",
    ).on(table.bizId, table.calendarRuleTemplateBindingId, table.exclusionDate),

    /** Tenant-safe FK to binding parent. */
    calendarRuleTemplateBindingExclusionDatesBizBindingFk: foreignKey({
      columns: [table.bizId, table.calendarRuleTemplateBindingId],
      foreignColumns: [calendarRuleTemplateBindings.bizId, calendarRuleTemplateBindings.id],
      name: "calendar_rule_template_binding_excl_dates_biz_binding_fk",
    }),
  }),
);

/**
 * calendar_overlays
 *
 * ELI5:
 * Overlays are named layers on top of a calendar, like transparent sheets.
 * Examples: "base weekly hours", "holiday blackout", "emergency closure".
 *
 * Rules can reference an overlay so the resolution engine can explain exactly
 * which layer changed availability.
 */
export const calendarOverlays = pgTable(
  "calendar_overlays",
  {
    /** Stable primary key. */
    id: idWithTag("calendar_overlay"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent calendar receiving this overlay layer. */
    calendarId: idRef("calendar_id")
      .references(() => calendars.id)
      .notNull(),

    /** Overlay type for runtime interpretation and UI grouping. */
    kind: calendarOverlayKindEnum("kind").notNull(),

    /** Human label for operators/admins. */
    name: varchar("name", { length: 180 }).notNull(),

    /** Optional description for maintenance handoff/debugging context. */
    description: varchar("description", { length: 600 }),

    /** Higher priority overlays can override lower ones during resolution. */
    priority: integer("priority").default(100).notNull(),

    /** Effective start of this layer. */
    effectiveStartAt: timestamp("effective_start_at", { withTimezone: true }),

    /** Effective end of this layer. */
    effectiveEndAt: timestamp("effective_end_at", { withTimezone: true }),

    /** Operational toggle for staged rollout. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Overlay-level policy knobs. */
    policy: jsonb("policy").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique target used by tenant-safe child FKs. */
    calendarOverlaysBizIdIdUnique: uniqueIndex(
      "calendar_overlays_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Common query path for calendar resolution layer loading. */
    calendarOverlaysBizCalendarActiveIdx: index(
      "calendar_overlays_biz_calendar_active_idx",
    ).on(table.bizId, table.calendarId, table.isActive, table.priority),

    /**
     * Window-oriented lookup path for overlays that are active in a time range.
     *
     * Why this exists:
     * Availability engines often ask "which overlay windows intersect X..Y?"
     * for one calendar. This index makes those scans predictable without
     * forcing a full calendar overlay scan.
     */
    calendarOverlaysBizCalendarWindowIdx: index(
      "calendar_overlays_biz_calendar_window_idx",
    ).on(
      table.bizId,
      table.calendarId,
      table.isActive,
      table.effectiveStartAt,
      table.effectiveEndAt,
    ),

    /** Tenant-safe FK to parent calendar. */
    calendarOverlaysBizCalendarFk: foreignKey({
      columns: [table.bizId, table.calendarId],
      foreignColumns: [calendars.bizId, calendars.id],
      name: "calendar_overlays_biz_calendar_fk",
    }),

    /** Overlay window must be time-ordered if both values are present. */
    calendarOverlaysWindowCheck: check(
      "calendar_overlays_window_check",
      sql`"effective_start_at" IS NULL OR "effective_end_at" IS NULL OR "effective_end_at" > "effective_start_at"`,
    ),
  }),
);

/**
 * availability_rules
 *
 * ELI5:
 * Rule rows describe exact "if time matches this pattern, do this action".
 * Multiple rules can exist per calendar and overlays decide layering semantics.
 */
export const availabilityRules = pgTable(
  "availability_rules",
  {
    /** Stable primary key. */
    id: idWithTag("availability_rule"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent calendar this rule belongs to. */
    calendarId: idRef("calendar_id")
      .references(() => calendars.id)
      .notNull(),

    /** Optional overlay layer grouping for this rule. */
    overlayId: idRef("overlay_id").references(() => calendarOverlays.id),

    /** Rule label for debugging/admin readability. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Rule window mode. */
    mode: availabilityRuleModeEnum("mode").notNull(),

    /** Recurrence cadence for recurring rules. */
    frequency: availabilityRuleFrequencyEnum("frequency")
      .default("none")
      .notNull(),

    /** Advanced recurrence expression (iCalendar RRULE style). */
    recurrenceRule: varchar("recurrence_rule", { length: 500 }),

    /** Day-of-week selector (0..6) for weekly style logic. */
    dayOfWeek: integer("day_of_week"),

    /** Day-of-month selector (1..31) for monthly style logic. */
    dayOfMonth: integer("day_of_month"),

    /** Local date range start for recurring/date-range windows. */
    startDate: date("start_date"),

    /** Local date range end for recurring/date-range windows. */
    endDate: date("end_date"),

    /** Local time start for recurring/date-range windows. */
    startTime: time("start_time"),

    /** Local time end for recurring/date-range windows. */
    endTime: time("end_time"),

    /** Absolute timestamp start for exact windows. */
    startAt: timestamp("start_at", { withTimezone: true }),

    /** Absolute timestamp end for exact windows. */
    endAt: timestamp("end_at", { withTimezone: true }),

    /** Result applied when this rule matches. */
    action: availabilityRuleActionEnum("action").notNull(),

    /** Optional capacity adjustment when `action = capacity_adjustment`. */
    capacityDelta: integer("capacity_delta"),

    /** Optional pricing payload when `action = special_pricing`. */
    pricingAdjustment: jsonb("pricing_adjustment"),

    /** Lower number means evaluated earlier unless engine chooses other strategy. */
    priority: integer("priority").default(100).notNull(),

    /** Operational toggle for safe staged deployments. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    availabilityRulesBizIdIdUnique: uniqueIndex("availability_rules_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique target for tenant-safe child foreign keys. */

    /** Common rule-resolution query path. */
    availabilityRulesBizCalendarIdx: index("availability_rules_biz_calendar_idx").on(
      table.bizId,
      table.calendarId,
      table.isActive,
      table.priority,
    ),

    /**
     * Window-oriented lookup path for exact timestamp range rules.
     *
     * Why this exists:
     * Resolution engines often need fast filtering of timestamp-bound rules
     * that intersect a requested interval.
     */
    availabilityRulesBizCalendarModeWindowIdx: index(
      "availability_rules_biz_calendar_mode_window_idx",
    ).on(
      table.bizId,
      table.calendarId,
      table.isActive,
      table.mode,
      table.startAt,
      table.endAt,
    ),

    /**
     * Recurring weekly lookup path.
     *
     * Why this exists:
     * Recurring rule evaluation frequently filters by weekday + local time
     * windows; this index keeps that path predictable at scale.
     */
    availabilityRulesBizCalendarWeeklyIdx: index(
      "availability_rules_biz_calendar_weekly_idx",
    ).on(
      table.bizId,
      table.calendarId,
      table.isActive,
      table.frequency,
      table.dayOfWeek,
      table.startTime,
      table.endTime,
    ),

    /** Tenant-safe FK to calendar. */
    availabilityRulesBizCalendarFk: foreignKey({
      columns: [table.bizId, table.calendarId],
      foreignColumns: [calendars.bizId, calendars.id],
      name: "availability_rules_biz_calendar_fk",
    }),

    /** Tenant-safe FK to optional overlay. */
    availabilityRulesBizOverlayFk: foreignKey({
      columns: [table.bizId, table.overlayId],
      foreignColumns: [calendarOverlays.bizId, calendarOverlays.id],
      name: "availability_rules_biz_overlay_fk",
    }),

    /** Weekly day bounds. */
    availabilityRulesDayOfWeekBoundsCheck: check(
      "availability_rules_day_of_week_bounds_check",
      sql`"day_of_week" IS NULL OR ("day_of_week" >= 0 AND "day_of_week" <= 6)`,
    ),

    /** Monthly day bounds. */
    availabilityRulesDayOfMonthBoundsCheck: check(
      "availability_rules_day_of_month_bounds_check",
      sql`"day_of_month" IS NULL OR ("day_of_month" >= 1 AND "day_of_month" <= 31)`,
    ),

    /** Date range ordering. */
    availabilityRulesDateRangeCheck: check(
      "availability_rules_date_range_check",
      sql`"start_date" IS NULL OR "end_date" IS NULL OR "end_date" >= "start_date"`,
    ),

    /** Timestamp range ordering. */
    availabilityRulesTimestampRangeCheck: check(
      "availability_rules_timestamp_range_check",
      sql`"start_at" IS NULL OR "end_at" IS NULL OR "end_at" > "start_at"`,
    ),

    /** Time range ordering for local windows. */
    availabilityRulesLocalTimeRangeCheck: check(
      "availability_rules_local_time_range_check",
      sql`"start_time" IS NULL OR "end_time" IS NULL OR "end_time" > "start_time"`,
    ),

    /**
     * Mode-shape invariant.
     * Keeps rule payload deterministic so evaluation logic can be simple.
     */
    availabilityRulesModeShapeCheck: check(
      "availability_rules_mode_shape_check",
      sql`
      (
        "mode" = 'recurring'
        AND (
          "frequency" IN ('daily', 'weekly', 'monthly', 'yearly', 'recurrence_rule')
        )
        AND "start_at" IS NULL
        AND "end_at" IS NULL
      ) OR (
        "mode" = 'date_range'
        AND "start_date" IS NOT NULL
        AND "end_date" IS NOT NULL
        AND "start_at" IS NULL
        AND "end_at" IS NULL
      ) OR (
        "mode" = 'timestamp_range'
        AND "start_at" IS NOT NULL
        AND "end_at" IS NOT NULL
      )
      `,
    ),

    /** Action payload shape check. */
    availabilityRulesActionShapeCheck: check(
      "availability_rules_action_shape_check",
      sql`
      (
        "action" IN ('available', 'unavailable', 'override_hours')
        AND "capacity_delta" IS NULL
      ) OR (
        "action" = 'special_pricing'
        AND "pricing_adjustment" IS NOT NULL
      ) OR (
        "action" = 'capacity_adjustment'
        AND "capacity_delta" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * availability_rule_exclusion_dates
 *
 * ELI5:
 * One row says: "skip this recurring rule on this date."
 *
 * Why this exists:
 * - avoids creating many one-off override rules for holidays/closures,
 * - keeps base recurring rules clean and reusable.
 */
export const availabilityRuleExclusionDates = pgTable(
  "availability_rule_exclusion_dates",
  {
    /** Stable primary key. */
    id: idWithTag("availability_rule_exclusion_date"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Recurring/date rule receiving this exclusion date. */
    availabilityRuleId: idRef("availability_rule_id")
      .references(() => availabilityRules.id)
      .notNull(),

    /** Local date where this rule should not apply. */
    exclusionDate: date("exclusion_date").notNull(),

    /** Optional reason code for operations and audit trail readability. */
    reasonCode: varchar("reason_code", { length: 120 }),

    /** Optional human-readable note. */
    note: varchar("note", { length: 600 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    availabilityRuleExclusionDatesBizIdIdUnique: uniqueIndex("availability_rule_exclusion_dates_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One exclusion date per rule/day. */
    availabilityRuleExclusionDatesUnique: uniqueIndex(
      "availability_rule_exclusion_dates_unique",
    ).on(table.bizId, table.availabilityRuleId, table.exclusionDate),

    /** Common expansion path for one rule's exclusion dates. */
    availabilityRuleExclusionDatesBizRuleDateIdx: index(
      "availability_rule_exclusion_dates_biz_rule_date_idx",
    ).on(table.bizId, table.availabilityRuleId, table.exclusionDate),

    /** Tenant-safe FK to parent rule. */
    availabilityRuleExclusionDatesBizRuleFk: foreignKey({
      columns: [table.bizId, table.availabilityRuleId],
      foreignColumns: [availabilityRules.bizId, availabilityRules.id],
      name: "availability_rule_exclusion_dates_biz_rule_fk",
    }),
  }),
);

/**
 * availability_gates
 *
 * ELI5:
 * A gate is a runtime "extra rule layer" that can be opened/closed quickly
 * based on live signals (queue ETA, capacity pressure, manual override, plugin).
 *
 * Why this exists:
 * - weekly/date rules are great for predictable schedules,
 * - live operations need fast temporary controls without hardcoding per industry.
 *
 * Example:
 * A queue ETA predicts service around 2:30 PM. Create one gate that marks
 * 2:00-2:30 PM as unavailable for slot booking on this calendar.
 */
export const availabilityGates = pgTable(
  "availability_gates",
  {
    /** Stable primary key. */
    id: idWithTag("availability_gate"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Calendar affected by this runtime gate. */
    calendarId: idRef("calendar_id")
      .references(() => calendars.id)
      .notNull(),

    /** Human label for operators/support. */
    name: varchar("name", { length: 180 }).notNull(),

    /** Where this gate signal came from. */
    signalType: availabilityGateSignalTypeEnum("signal_type")
      .default("manual")
      .notNull(),

    /** Runtime action applied by this gate. */
    action: availabilityRuleActionEnum("action").notNull(),

    /** Gate lifecycle state. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Evaluation order when multiple active gates overlap. */
    priority: integer("priority").default(100).notNull(),

    /** Effective start time for this gate. */
    windowStartAt: timestamp("window_start_at", { withTimezone: true }).notNull(),

    /** Effective end time for this gate; null means open-ended until closed. */
    windowEndAt: timestamp("window_end_at", { withTimezone: true }),

    /** Optional capacity adjustment payload when `action=capacity_adjustment`. */
    capacityDelta: integer("capacity_delta"),

    /** Optional pricing payload when `action=special_pricing`. */
    pricingAdjustment: jsonb("pricing_adjustment"),

    /**
     * Optional source pointer for traceability.
     *
     * Examples:
     * - queue entry id,
     * - plugin workflow id,
     * - external incident id.
     */
    sourceRefType: varchar("source_ref_type", { length: 80 }),
    sourceRefId: idRef("source_ref_id"),

    /** Optional idempotency key for gate upsert workers. */
    requestKey: varchar("request_key", { length: 140 }),

    /** Signal snapshot used to produce this gate. */
    signalSnapshot: jsonb("signal_snapshot").default({}).notNull(),

    /** Runtime policy details for this gate. */
    policy: jsonb("policy").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe references. */
    availabilityGatesBizIdIdUnique: uniqueIndex(
      "availability_gates_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Optional idempotency dedupe guard. */
    availabilityGatesBizRequestKeyUnique: uniqueIndex(
      "availability_gates_biz_request_key_unique",
    )
      .on(table.bizId, table.requestKey)
      .where(sql`"request_key" IS NOT NULL`),

    /** Main runtime lookup path for one calendar's active gate set. */
    availabilityGatesBizCalendarStatusWindowIdx: index(
      "availability_gates_biz_calendar_status_window_idx",
    ).on(
      table.bizId,
      table.calendarId,
      table.status,
      table.priority,
      table.windowStartAt,
      table.windowEndAt,
    ),

    /** Source-based debugging/reconciliation lookup path. */
    availabilityGatesBizSourceRefIdx: index("availability_gates_biz_source_ref_idx").on(
      table.bizId,
      table.sourceRefType,
      table.sourceRefId,
    ),

    /** Tenant-safe FK to calendar. */
    availabilityGatesBizCalendarFk: foreignKey({
      columns: [table.bizId, table.calendarId],
      foreignColumns: [calendars.bizId, calendars.id],
      name: "availability_gates_biz_calendar_fk",
    }),

    /** Window must be ordered when end value exists. */
    availabilityGatesWindowCheck: check(
      "availability_gates_window_check",
      sql`"window_end_at" IS NULL OR "window_end_at" > "window_start_at"`,
    ),

    /** Priority must be non-negative. */
    availabilityGatesPriorityCheck: check(
      "availability_gates_priority_check",
      sql`"priority" >= 0`,
    ),

    /** Source reference should be fully-null or fully-populated. */
    availabilityGatesSourcePairCheck: check(
      "availability_gates_source_pair_check",
      sql`
      (
        "source_ref_type" IS NULL
        AND "source_ref_id" IS NULL
      ) OR (
        "source_ref_type" IS NOT NULL
        AND "source_ref_id" IS NOT NULL
      )
      `,
    ),

    /** Action payload shape consistency. */
    availabilityGatesActionShapeCheck: check(
      "availability_gates_action_shape_check",
      sql`
      (
        "action" IN ('available', 'unavailable', 'override_hours')
        AND "capacity_delta" IS NULL
        AND "pricing_adjustment" IS NULL
      ) OR (
        "action" = 'special_pricing'
        AND "pricing_adjustment" IS NOT NULL
        AND "capacity_delta" IS NULL
      ) OR (
        "action" = 'capacity_adjustment'
        AND "capacity_delta" IS NOT NULL
        AND "pricing_adjustment" IS NULL
      )
      `,
    ),
  }),
);

/**
 * availability_dependency_rules
 *
 * ELI5:
 * This table defines "who depends on whom" for schedule availability.
 *
 * Example:
 * - dependent calendar: stylist host calendar
 * - required targets: front-desk calendars
 * - rule mode: `all` (every required role must be available)
 * - enforcement: `hard_block` (if dependency fails, stylist is unavailable)
 *
 * Why this table exists:
 * - dependency behavior becomes explicit data, not hidden code branches.
 * - one generic shape works for many industries and plugin domains.
 * - operators can audit and evolve dependency behavior without schema forks.
 */
export const availabilityDependencyRules = pgTable(
  "availability_dependency_rules",
  {
    /** Stable primary key for one dependency policy row. */
    id: idWithTag("availability_dependency_rule"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Calendar whose availability is being constrained by dependency checks.
     *
     * Example:
     * Host calendar can be blocked if a required support calendar is missing.
     */
    dependentCalendarId: idRef("dependent_calendar_id")
      .references(() => calendars.id)
      .notNull(),

    /** Human-friendly rule name used in operations/admin screens. */
    name: varchar("name", { length: 180 }).notNull(),

    /** Optional operator context for handoff/debugging. */
    description: varchar("description", { length: 700 }),

    /** Lifecycle state of this dependency policy row. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /**
     * Enforcement intent when dependencies fail.
     *
     * - hard_block: dependent calendar should be treated unavailable.
     * - soft_gate: dependency failure should bias/gate scheduling.
     * - advisory: informational only; do not enforce hard block.
     */
    enforcementMode: availabilityDependencyEnforcementModeEnum(
      "enforcement_mode",
    )
      .default("hard_block")
      .notNull(),

    /**
     * Aggregation rule across dependency targets.
     *
     * - all: all targets must pass.
     * - any: at least one target must pass.
     * - threshold: explicit count/percent thresholds are used.
     */
    evaluationMode: availabilityDependencyEvaluationModeEnum("evaluation_mode")
      .default("all")
      .notNull(),

    /**
     * Action to apply when dependency check fails.
     *
     * Common value is `unavailable`, but capacity/pricing-oriented reactions are
     * also supported for progressive degradation models.
     */
    failureAction: availabilityRuleActionEnum("failure_action")
      .default("unavailable")
      .notNull(),

    /** Optional delta when `failure_action = capacity_adjustment`. */
    capacityDelta: integer("capacity_delta"),

    /** Optional payload when `failure_action = special_pricing`. */
    pricingAdjustment: jsonb("pricing_adjustment"),

    /**
     * Required dependency coverage before the requested start, in minutes.
     *
     * Example:
     * If set to 15, dependency target must already be available 15 minutes
     * before dependent service start.
     */
    timeOffsetBeforeMin: integer("time_offset_before_min").default(0).notNull(),

    /**
     * Required dependency coverage after the requested end, in minutes.
     *
     * Example:
     * A cleanup support role must remain available for 10 minutes after finish.
     */
    timeOffsetAfterMin: integer("time_offset_after_min").default(0).notNull(),

    /**
     * Threshold minimum satisfied target count when `evaluation_mode=threshold`.
     *
     * Keep null for `all` and `any`.
     */
    minSatisfiedCount: integer("min_satisfied_count"),

    /**
     * Threshold minimum satisfied target percent (1..100) when
     * `evaluation_mode=threshold`.
     *
     * Keep null for `all` and `any`.
     */
    minSatisfiedPercent: integer("min_satisfied_percent"),

    /** Optional effective window start for temporary campaigns/seasons. */
    effectiveStartAt: timestamp("effective_start_at", { withTimezone: true }),

    /** Optional effective window end for temporary campaigns/seasons. */
    effectiveEndAt: timestamp("effective_end_at", { withTimezone: true }),

    /** Optional idempotency key for upsert/reconcile workers. */
    requestKey: varchar("request_key", { length: 140 }),

    /**
     * Extension payload for advanced dependency-evaluation knobs.
     * Keep indexed/query-critical fields in explicit columns.
     */
    policy: jsonb("policy").default({}),

    /** Extra metadata for future module integrations. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe references. */
    availabilityDependencyRulesBizIdIdUnique: uniqueIndex(
      "availability_dependency_rules_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Optional idempotency dedupe path for rule writers. */
    availabilityDependencyRulesBizRequestKeyUnique: uniqueIndex(
      "availability_dependency_rules_biz_request_key_unique",
    )
      .on(table.bizId, table.requestKey)
      .where(sql`"request_key" IS NOT NULL`),

    /** Primary lookup path for active dependency evaluation by calendar. */
    availabilityDependencyRulesBizCalendarStatusIdx: index(
      "availability_dependency_rules_biz_calendar_status_idx",
    ).on(table.bizId, table.dependentCalendarId, table.status, table.evaluationMode),

    /** Time-window filter path for scheduled/seasonal dependency policies. */
    availabilityDependencyRulesBizCalendarWindowIdx: index(
      "availability_dependency_rules_biz_calendar_window_idx",
    ).on(
      table.bizId,
      table.dependentCalendarId,
      table.status,
      table.effectiveStartAt,
      table.effectiveEndAt,
    ),

    /** Tenant-safe FK to dependent calendar. */
    availabilityDependencyRulesBizCalendarFk: foreignKey({
      columns: [table.bizId, table.dependentCalendarId],
      foreignColumns: [calendars.bizId, calendars.id],
      name: "availability_dependency_rules_biz_calendar_fk",
    }),

    /** Numeric offsets and threshold bounds must be sane. */
    availabilityDependencyRulesNumericBoundsCheck: check(
      "availability_dependency_rules_numeric_bounds_check",
      sql`
      "time_offset_before_min" >= 0
      AND "time_offset_after_min" >= 0
      AND ("min_satisfied_count" IS NULL OR "min_satisfied_count" > 0)
      AND ("min_satisfied_percent" IS NULL OR ("min_satisfied_percent" >= 1 AND "min_satisfied_percent" <= 100))
      `,
    ),

    /** Effective window must be ordered when both endpoints are provided. */
    availabilityDependencyRulesWindowCheck: check(
      "availability_dependency_rules_window_check",
      sql`"effective_start_at" IS NULL OR "effective_end_at" IS NULL OR "effective_end_at" > "effective_start_at"`,
    ),

    /**
     * Keeps threshold columns aligned with `evaluation_mode`.
     *
     * Why this matters:
     * Evaluation stays deterministic and easy to reason about in engines.
     */
    availabilityDependencyRulesEvaluationShapeCheck: check(
      "availability_dependency_rules_evaluation_shape_check",
      sql`
      (
        "evaluation_mode" = 'all'
        AND "min_satisfied_count" IS NULL
        AND "min_satisfied_percent" IS NULL
      ) OR (
        "evaluation_mode" = 'any'
        AND "min_satisfied_count" IS NULL
        AND "min_satisfied_percent" IS NULL
      ) OR (
        "evaluation_mode" = 'threshold'
        AND (
          "min_satisfied_count" IS NOT NULL
          OR "min_satisfied_percent" IS NOT NULL
        )
      )
      `,
    ),

    /**
     * Failure-action payload shape check.
     *
     * This mirrors availability-rule semantics so downstream engines can share
     * one interpretation path for action payloads.
     */
    availabilityDependencyRulesFailureActionShapeCheck: check(
      "availability_dependency_rules_failure_action_shape_check",
      sql`
      (
        "failure_action" IN ('available', 'unavailable', 'override_hours')
        AND "capacity_delta" IS NULL
        AND "pricing_adjustment" IS NULL
      ) OR (
        "failure_action" = 'special_pricing'
        AND "pricing_adjustment" IS NOT NULL
        AND "capacity_delta" IS NULL
      ) OR (
        "failure_action" = 'capacity_adjustment'
        AND "capacity_delta" IS NOT NULL
        AND "pricing_adjustment" IS NULL
      )
      `,
    ),
  }),
);

/**
 * availability_dependency_rule_targets
 *
 * ELI5:
 * One dependency rule can depend on many targets.
 *
 * Examples:
 * - calendar target: front-desk calendar
 * - custom-subject target: plugin-defined staffing pool subject
 *
 * This split keeps rule policy (how to evaluate) separate from dependency
 * members (what to evaluate), so it scales to complex compositions.
 */
export const availabilityDependencyRuleTargets = pgTable(
  "availability_dependency_rule_targets",
  {
    /** Stable primary key. */
    id: idWithTag("availability_dependency_target"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent dependency rule. */
    availabilityDependencyRuleId: idRef("availability_dependency_rule_id")
      .references(() => availabilityDependencyRules.id)
      .notNull(),

    /** Target payload discriminator. */
    targetType: availabilityDependencyTargetTypeEnum("target_type").notNull(),

    /**
     * Target payload when `target_type=calendar`.
     * Points to the calendar whose availability is required.
     */
    requiredCalendarId: idRef("required_calendar_id").references(
      () => calendars.id,
    ),

    /**
     * Target payload when `target_type=custom_subject`.
     * Uses the shared subjects registry for plugin/extensible domains.
     */
    requiredSubjectType: varchar("required_subject_type", { length: 80 }),
    requiredSubjectId: varchar("required_subject_id", { length: 140 }),

    /**
     * Optional semantic role key for readability and downstream logic.
     *
     * Examples:
     * - `front_desk`
     * - `supervisor`
     * - `chaperone`
     */
    roleKey: varchar("role_key", { length: 80 }),

    /**
     * Relative target weight used in threshold/fairness style evaluations.
     * Default 1 means equal contribution.
     */
    weight: integer("weight").default(1).notNull(),

    /** UI and evaluation ordering hint. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Extension payload for target-specific options. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe child references. */
    availabilityDependencyRuleTargetsBizIdIdUnique: uniqueIndex(
      "availability_dependency_rule_targets_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Main expansion path for rule evaluation. */
    availabilityDependencyRuleTargetsBizRuleIdx: index(
      "availability_dependency_rule_targets_biz_rule_idx",
    ).on(table.bizId, table.availabilityDependencyRuleId, table.sortOrder),

    /** Useful for reverse lookups from one required calendar. */
    availabilityDependencyRuleTargetsBizCalendarIdx: index(
      "availability_dependency_rule_targets_biz_calendar_idx",
    ).on(table.bizId, table.requiredCalendarId),

    /** Useful for reverse lookups from one required custom subject. */
    availabilityDependencyRuleTargetsBizSubjectIdx: index(
      "availability_dependency_rule_targets_biz_subject_idx",
    ).on(table.bizId, table.requiredSubjectType, table.requiredSubjectId),

    /** Tenant-safe FK to parent dependency rule. */
    availabilityDependencyRuleTargetsBizRuleFk: foreignKey({
      columns: [table.bizId, table.availabilityDependencyRuleId],
      foreignColumns: [availabilityDependencyRules.bizId, availabilityDependencyRules.id],
      name: "availability_dependency_rule_targets_biz_rule_fk",
    }),

    /** Tenant-safe FK to optional calendar target payload. */
    availabilityDependencyRuleTargetsBizCalendarFk: foreignKey({
      columns: [table.bizId, table.requiredCalendarId],
      foreignColumns: [calendars.bizId, calendars.id],
      name: "availability_dependency_rule_targets_biz_calendar_fk",
    }),

    /** Tenant-safe FK to optional custom-subject target payload. */
    availabilityDependencyRuleTargetsBizSubjectFk: foreignKey({
      columns: [table.bizId, table.requiredSubjectType, table.requiredSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "availability_dependency_rule_targets_biz_subject_fk",
    }),

    /** Avoid duplicate calendar targets under one rule. */
    availabilityDependencyRuleTargetsUniqueCalendar: uniqueIndex(
      "availability_dependency_rule_targets_unique_calendar",
    )
      .on(table.availabilityDependencyRuleId, table.requiredCalendarId)
      .where(sql`"target_type" = 'calendar' AND "deleted_at" IS NULL`),

    /** Avoid duplicate custom-subject targets under one rule. */
    availabilityDependencyRuleTargetsUniqueSubject: uniqueIndex(
      "availability_dependency_rule_targets_unique_subject",
    )
      .on(
        table.availabilityDependencyRuleId,
        table.requiredSubjectType,
        table.requiredSubjectId,
      )
      .where(sql`"target_type" = 'custom_subject' AND "deleted_at" IS NULL`),

    /** Weight/sort bounds and role-key sanity checks. */
    availabilityDependencyRuleTargetsNumericAndRoleCheck: check(
      "availability_dependency_rule_targets_numeric_and_role_check",
      sql`
      "weight" > 0
      AND "sort_order" >= 0
      AND ("role_key" IS NULL OR length("role_key") > 0)
      `,
    ),

    /** Subject payload should be fully-null or fully-populated. */
    availabilityDependencyRuleTargetsSubjectPairCheck: check(
      "availability_dependency_rule_targets_subject_pair_check",
      sql`
      (
        "required_subject_type" IS NULL
        AND "required_subject_id" IS NULL
      ) OR (
        "required_subject_type" IS NOT NULL
        AND "required_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Ensures target payload matches target type exactly. */
    availabilityDependencyRuleTargetsShapeCheck: check(
      "availability_dependency_rule_targets_shape_check",
      sql`
      (
        "target_type" = 'calendar'
        AND "required_calendar_id" IS NOT NULL
        AND "required_subject_type" IS NULL
        AND "required_subject_id" IS NULL
      ) OR (
        "target_type" = 'custom_subject'
        AND "required_calendar_id" IS NULL
        AND "required_subject_type" IS NOT NULL
        AND "required_subject_id" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * capacity_pools
 *
 * ELI5:
 * A capacity pool is shared inventory that multiple owners consume together.
 * Example: "all MRI machines together have capacity 12 per hour".
 */
export const capacityPools = pgTable(
  "capacity_pools",
  {
    /** Stable primary key for this pool. */
    id: idWithTag("capacity_pool"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human pool name shown in capacity admin views. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Stable key for APIs/imports. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Operational state of the pool. */
    status: capacityPoolStatusEnum("status").default("active").notNull(),

    /** Nominal total capacity for this pool window. */
    totalCapacity: integer("total_capacity").notNull(),

    /**
     * Extra permitted inventory beyond nominal capacity.
     * Useful for controlled overbooking strategies.
     */
    overbookCapacity: integer("overbook_capacity").default(0).notNull(),

    /** Pool behavior policy (allocation mode, fairness knobs, etc.). */
    policy: jsonb("policy").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    capacityPoolsBizIdIdUnique: uniqueIndex("capacity_pools_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key used by tenant-safe member FKs. */

    /** Unique slug per tenant. */
    capacityPoolsBizSlugUnique: uniqueIndex("capacity_pools_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),

    /** Common operator listing path. */
    capacityPoolsBizStatusIdx: index("capacity_pools_biz_status_idx").on(
      table.bizId,
      table.status,
    ),

    /** Capacity values must be sane. */
    capacityPoolsValueBoundsCheck: check(
      "capacity_pools_value_bounds_check",
      sql`"total_capacity" > 0 AND "overbook_capacity" >= 0`,
    ),
  }),
);

/**
 * capacity_pool_members
 *
 * ELI5:
 * Members connect real entities to a shared pool with optional weights.
 * It allows one pool to include resources, offer versions, or locations.
 */
export const capacityPoolMembers = pgTable(
  "capacity_pool_members",
  {
    /** Stable primary key for membership row. */
    id: idWithTag("capacity_member"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent capacity pool. */
    capacityPoolId: idRef("capacity_pool_id")
      .references(() => capacityPools.id)
      .notNull(),

    /** Member discriminator. */
    memberType: capacityPoolMemberTypeEnum("member_type").notNull(),

    /** Member payload for resources. */
    resourceId: idRef("resource_id").references(() => resources.id),

    /** Member payload for offer versions. */
    offerVersionId: idRef("offer_version_id").references(() => offerVersions.id),

    /** Member payload for locations. */
    locationId: idRef("location_id").references(() => locations.id),

    /**
     * Extensibility member kind for plugin/custom capacity consumers.
     *
     * ELI5:
     * For known members we use typed FK columns.
     * For unknown future member domains we store a stable type string + id.
     */
    memberRefType: varchar("member_ref_type", { length: 80 }),

    /** Canonical id for custom member target when `member_type=custom_subject`. */
    memberRefId: idRef("member_ref_id"),

    /** Weight used by fair-share/proportional allocation engines. */
    capacityWeight: integer("capacity_weight").default(1).notNull(),

    /**
     * Optional hard reservation for this member inside the pool.
     * Useful for guaranteed quota semantics.
     */
    reservedCapacity: integer("reserved_capacity").default(0).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    capacityPoolMembersBizIdIdUnique: uniqueIndex("capacity_pool_members_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common query path for pool expansion. */
    capacityPoolMembersBizPoolIdx: index("capacity_pool_members_biz_pool_idx").on(
      table.bizId,
      table.capacityPoolId,
    ),
    /** Common lookup path for extensible custom-subject members. */
    capacityPoolMembersBizMemberRefIdx: index(
      "capacity_pool_members_biz_member_ref_idx",
    ).on(table.bizId, table.memberRefType, table.memberRefId),

    /** Tenant-safe FK to parent pool. */
    capacityPoolMembersBizPoolFk: foreignKey({
      columns: [table.bizId, table.capacityPoolId],
      foreignColumns: [capacityPools.bizId, capacityPools.id],
      name: "capacity_pool_members_biz_pool_fk",
    }),

    /** Tenant-safe FK for resource members. */
    capacityPoolMembersBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "capacity_pool_members_biz_resource_fk",
    }),

    /** Tenant-safe FK for offer-version members. */
    capacityPoolMembersBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "capacity_pool_members_biz_offer_version_fk",
    }),

    /** Tenant-safe FK for location members. */
    capacityPoolMembersBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "capacity_pool_members_biz_location_fk",
    }),

    /**
     * Tenant-safe FK for extensible custom-subject members.
     *
     * This turns flexible member refs into integrity-checked references.
     */
    capacityPoolMembersBizMemberRefSubjectFk: foreignKey({
      columns: [table.bizId, table.memberRefType, table.memberRefId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "capacity_pool_members_biz_member_ref_subject_fk",
    }),

    /** Membership payload shape check by discriminator. */
    capacityPoolMembersShapeCheck: check(
      "capacity_pool_members_shape_check",
      sql`
      (
        "member_type" = 'resource'
        AND "resource_id" IS NOT NULL
        AND "offer_version_id" IS NULL
        AND "location_id" IS NULL
        AND "member_ref_type" IS NULL
        AND "member_ref_id" IS NULL
      ) OR (
        "member_type" = 'offer_version'
        AND "resource_id" IS NULL
        AND "offer_version_id" IS NOT NULL
        AND "location_id" IS NULL
        AND "member_ref_type" IS NULL
        AND "member_ref_id" IS NULL
      ) OR (
        "member_type" = 'location'
        AND "resource_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "location_id" IS NOT NULL
        AND "member_ref_type" IS NULL
        AND "member_ref_id" IS NULL
      ) OR (
        "member_type" = 'custom_subject'
        AND "resource_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "location_id" IS NULL
        AND "member_ref_type" IS NOT NULL
        AND "member_ref_id" IS NOT NULL
      )
      `,
    ),

    /** Prevent duplicate resource membership rows in one pool. */
    capacityPoolMembersUniqueResource: uniqueIndex(
      "capacity_pool_members_unique_resource",
    )
      .on(table.capacityPoolId, table.resourceId)
      .where(sql`"member_type" = 'resource' AND "deleted_at" IS NULL`),

    /** Prevent duplicate offer-version membership rows in one pool. */
    capacityPoolMembersUniqueOfferVersion: uniqueIndex(
      "capacity_pool_members_unique_offer_version",
    )
      .on(table.capacityPoolId, table.offerVersionId)
      .where(sql`"member_type" = 'offer_version' AND "deleted_at" IS NULL`),

    /** Prevent duplicate location membership rows in one pool. */
    capacityPoolMembersUniqueLocation: uniqueIndex(
      "capacity_pool_members_unique_location",
    )
      .on(table.capacityPoolId, table.locationId)
      .where(sql`"member_type" = 'location' AND "deleted_at" IS NULL`),

    /** Prevent duplicate extensible custom-subject membership rows in one pool. */
    capacityPoolMembersUniqueCustomSubject: uniqueIndex(
      "capacity_pool_members_unique_custom_subject",
    )
      .on(table.capacityPoolId, table.memberRefType, table.memberRefId)
      .where(sql`"member_type" = 'custom_subject' AND "deleted_at" IS NULL`),

    /** Numeric fields must be non-negative and meaningful. */
    capacityPoolMembersNumericBoundsCheck: check(
      "capacity_pool_members_numeric_bounds_check",
      sql`"capacity_weight" > 0 AND "reserved_capacity" >= 0`,
    ),
  }),
);

/**
 * capacity_hold_policies
 *
 * ELI5:
 * This table answers:
 * "How should holds behave for this business area?"
 *
 * Why this exists:
 * - holds are optional and should be configurable by scope,
 * - one biz may want blocking holds for premium inventory, but non-blocking
 *   intent holds for high-velocity discovery funnels,
 * - policy rows keep behavior data-driven instead of hardcoded in API code.
 *
 * Scope model:
 * - one row can target `biz` as default,
 * - or override at location/calendar/resource/service/service_product/offer/
 *   offer_version/product/sellable/capacity_pool/custom_subject.
 *
 * Deterministic resolution contract (API/services should follow this exactly):
 * 1. Candidate set:
 *    - same `biz_id`
 *    - `status='active'`
 *    - `is_enabled=true`
 *    - inside effective window:
 *      `effective_start_at <= now < effective_end_at` (null means unbounded)
 * 2. Scope precedence (most specific -> least specific):
 *    - `custom_subject`
 *    - `offer_version`
 *    - `offer`
 *    - `sellable`
 *    - `product`
 *    - `service_product`
 *    - `service`
 *    - `resource`
 *    - `capacity_pool`
 *    - `calendar`
 *    - `location`
 *    - `biz`
 * 3. Same-scope tie-break:
 *    - lowest `priority` wins (0 is strongest),
 *    - then newest `updated_at`,
 *    - then lexicographically smallest `id` for final deterministic tie-break.
 *
 * Why this matters:
 * - all API nodes/plugins resolve the same effective hold behavior,
 * - replay/debug stays deterministic,
 * - schema remains extensible while runtime behavior stays explicit.
 */
export const capacityHoldPolicies = pgTable(
  "capacity_hold_policies",
  {
    /** Stable primary key. */
    id: idWithTag("capacity_hold_policy"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human-readable policy name for admin UX and audits. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Optional operator description for policy intent/context. */
    description: varchar("description", { length: 1000 }),

    /** Policy lifecycle state. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Scope discriminator that selects which target payload column is used. */
    targetType: capacityHoldPolicyTargetTypeEnum("target_type").notNull(),

    /** Target payload for `target_type=location`. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Target payload for `target_type=calendar`. */
    calendarId: idRef("calendar_id").references(() => calendars.id),

    /** Target payload for `target_type=resource`. */
    resourceId: idRef("resource_id").references(() => resources.id),

    /** Target payload for `target_type=capacity_pool`. */
    capacityPoolId: idRef("capacity_pool_id").references(() => capacityPools.id),

    /** Target payload for `target_type=service`. */
    serviceId: idRef("service_id").references(() => services.id),

    /** Target payload for `target_type=service_product`. */
    serviceProductId: idRef("service_product_id").references(
      () => serviceProducts.id,
    ),

    /** Target payload for `target_type=offer`. */
    offerId: idRef("offer_id").references(() => offers.id),

    /** Target payload for `target_type=offer_version`. */
    offerVersionId: idRef("offer_version_id").references(() => offerVersions.id),

    /** Target payload for `target_type=product`. */
    productId: idRef("product_id").references(() => products.id),

    /** Target payload for `target_type=sellable`. */
    sellableId: idRef("sellable_id").references(() => sellables.id),

    /** Target payload for `target_type=custom_subject`. */
    targetRefType: varchar("target_ref_type", { length: 80 }),
    targetRefId: idRef("target_ref_id"),
    /**
     * Canonical scope key used for generic uniqueness and resolver lookups.
     *
     * Required format by `target_type`:
     * - biz: `biz`
     * - location: `location:{location_id}`
     * - calendar: `calendar:{calendar_id}`
     * - resource: `resource:{resource_id}`
     * - capacity_pool: `capacity_pool:{capacity_pool_id}`
     * - service: `service:{service_id}`
     * - service_product: `service_product:{service_product_id}`
     * - offer: `offer:{offer_id}`
     * - offer_version: `offer_version:{offer_version_id}`
     * - product: `product:{product_id}`
     * - sellable: `sellable:{sellable_id}`
     * - custom_subject: `custom_subject:{target_ref_type}:{target_ref_id}`
     */
    targetRefKey: varchar("target_ref_key", { length: 320 }).notNull(),

    /** Master on/off switch for hold behavior at this scope. */
    isEnabled: boolean("is_enabled").default(true).notNull(),

    /** Whether capacity-reserving holds are allowed at this scope. */
    allowBlockingHolds: boolean("allow_blocking_holds").default(true).notNull(),

    /** Whether non-blocking intent holds are allowed at this scope. */
    allowNonBlockingHolds: boolean("allow_non_blocking_holds")
      .default(false)
      .notNull(),

    /**
     * Default hold mode when caller does not provide explicit mode.
     *
     * `non_blocking` enables demand-capture without reserving capacity.
     */
    defaultEffectMode: capacityHoldEffectModeEnum("default_effect_mode")
      .default("blocking")
      .notNull(),

    /** Minimum hold duration in minutes. */
    minHoldDurationMin: integer("min_hold_duration_min").default(1).notNull(),

    /** Maximum hold duration in minutes. */
    maxHoldDurationMin: integer("max_hold_duration_min").default(30).notNull(),

    /** Default hold duration in minutes when caller omits explicit duration. */
    defaultHoldDurationMin: integer("default_hold_duration_min").default(10).notNull(),

    /**
     * Optional anti-abuse cap: max active holds per owner identity.
     *
     * Applies to all hold effect modes if present.
     */
    maxActiveHoldsPerOwner: integer("max_active_holds_per_owner"),

    /** Optional cap for blocking holds per owner identity. */
    maxActiveBlockingHoldsPerOwner: integer("max_active_blocking_holds_per_owner"),

    /** Optional cap for non-blocking holds per owner identity. */
    maxActiveNonBlockingHoldsPerOwner: integer(
      "max_active_non_blocking_holds_per_owner",
    ),

    /** Optional cool-down in seconds after expiry/cancel before new holds are allowed. */
    cooldownAfterExpirySec: integer("cooldown_after_expiry_sec").default(0).notNull(),

    /**
     * Require owner identity for new holds under this policy.
     *
     * This is a practical anti-abuse control for anonymous hold spam.
     */
    requireOwnerIdentity: boolean("require_owner_identity").default(false).notNull(),

    /**
     * If true, blocking holds should only be allowed when payment intent/preauth
     * has already started according to API workflow.
     */
    requirePaymentIntentForBlockingHold: boolean(
      "require_payment_intent_for_blocking_hold",
    )
      .default(false)
      .notNull(),

    /** Optional preauth threshold in minor units for blocking-hold eligibility. */
    minPreauthAmountMinor: integer("min_preauth_amount_minor"),

    /** Whether hold writes under this policy should emit demand-signal metrics. */
    emitDemandSignals: boolean("emit_demand_signals").default(true).notNull(),

    /** Whether threshold crossings should create "act fast" alerts. */
    emitActFastAlerts: boolean("emit_act_fast_alerts").default(true).notNull(),

    /** Threshold: active non-blocking holds count that should trigger alerting. */
    actFastThresholdCount: integer("act_fast_threshold_count"),

    /** Threshold: unique owners count that should trigger alerting. */
    actFastThresholdUniqueOwners: integer("act_fast_threshold_unique_owners"),

    /**
     * Priority for same-scope resolver precedence.
     *
     * Lower number = stronger precedence.
     * Cross-scope precedence is fixed by the contract in the table-level comment.
     */
    priority: integer("priority").default(100).notNull(),

    /** Optional effective-window start for seasonal campaigns. */
    effectiveStartAt: timestamp("effective_start_at", { withTimezone: true }),

    /** Optional effective-window end for seasonal campaigns. */
    effectiveEndAt: timestamp("effective_end_at", { withTimezone: true }),

    /** Extension policy payload for advanced integrations/plugins. */
    policy: jsonb("policy").default({}),

    /** Notification strategy payload for alert channels/escalation. */
    notificationPolicy: jsonb("notification_policy").default({}),

    /** Anti-abuse strategy payload (rate limits, fingerprinting hints, etc.). */
    antiAbusePolicy: jsonb("anti_abuse_policy").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references from holds and alerts. */
    capacityHoldPoliciesBizIdIdUnique: uniqueIndex(
      "capacity_hold_policies_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Main list/query path for policy resolver and admin views. */
    capacityHoldPoliciesBizStatusTargetPriorityIdx: index(
      "capacity_hold_policies_biz_status_target_priority_idx",
    ).on(table.bizId, table.status, table.targetType, table.priority),

    /** Direct lookup path when resolver already computed canonical scope key. */
    capacityHoldPoliciesBizTargetScopeIdx: index(
      "capacity_hold_policies_biz_target_scope_idx",
    ).on(table.bizId, table.targetType, table.targetRefKey, table.status, table.priority),

    /** Effective-window lookup path for temporal policy resolution. */
    capacityHoldPoliciesBizStatusWindowIdx: index(
      "capacity_hold_policies_biz_status_window_idx",
    ).on(table.bizId, table.status, table.effectiveStartAt, table.effectiveEndAt),

    /**
     * One currently-active policy per canonical scope key.
     *
     * Why partial:
     * - keeps live resolution deterministic,
     * - still allows storing inactive/draft/historical policy rows for the same scope.
     */
    capacityHoldPoliciesTargetUnique: uniqueIndex(
      "capacity_hold_policies_target_unique",
    )
      .on(table.bizId, table.targetType, table.targetRefKey)
      .where(sql`"deleted_at" IS NULL AND "status" = 'active'`),

    /** Tenant-safe typed target FKs. */
    capacityHoldPoliciesBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "capacity_hold_policies_biz_location_fk",
    }),
    capacityHoldPoliciesBizCalendarFk: foreignKey({
      columns: [table.bizId, table.calendarId],
      foreignColumns: [calendars.bizId, calendars.id],
      name: "capacity_hold_policies_biz_calendar_fk",
    }),
    capacityHoldPoliciesBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "capacity_hold_policies_biz_resource_fk",
    }),
    capacityHoldPoliciesBizPoolFk: foreignKey({
      columns: [table.bizId, table.capacityPoolId],
      foreignColumns: [capacityPools.bizId, capacityPools.id],
      name: "capacity_hold_policies_biz_pool_fk",
    }),
    capacityHoldPoliciesBizServiceFk: foreignKey({
      columns: [table.bizId, table.serviceId],
      foreignColumns: [services.bizId, services.id],
      name: "capacity_hold_policies_biz_service_fk",
    }),
    capacityHoldPoliciesBizServiceProductFk: foreignKey({
      columns: [table.bizId, table.serviceProductId],
      foreignColumns: [serviceProducts.bizId, serviceProducts.id],
      name: "capacity_hold_policies_biz_service_product_fk",
    }),
    capacityHoldPoliciesBizOfferFk: foreignKey({
      columns: [table.bizId, table.offerId],
      foreignColumns: [offers.bizId, offers.id],
      name: "capacity_hold_policies_biz_offer_fk",
    }),
    capacityHoldPoliciesBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "capacity_hold_policies_biz_offer_version_fk",
    }),
    capacityHoldPoliciesBizProductFk: foreignKey({
      columns: [table.bizId, table.productId],
      foreignColumns: [products.bizId, products.id],
      name: "capacity_hold_policies_biz_product_fk",
    }),
    capacityHoldPoliciesBizSellableFk: foreignKey({
      columns: [table.bizId, table.sellableId],
      foreignColumns: [sellables.bizId, sellables.id],
      name: "capacity_hold_policies_biz_sellable_fk",
    }),
    capacityHoldPoliciesBizSubjectFk: foreignKey({
      columns: [table.bizId, table.targetRefType, table.targetRefId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "capacity_hold_policies_biz_subject_fk",
    }),

    /** Numeric bounds and duration consistency. */
    capacityHoldPoliciesBoundsCheck: check(
      "capacity_hold_policies_bounds_check",
      sql`
      length("target_ref_key") > 0
      AND
      "min_hold_duration_min" > 0
      AND "max_hold_duration_min" >= "min_hold_duration_min"
      AND "default_hold_duration_min" >= "min_hold_duration_min"
      AND "default_hold_duration_min" <= "max_hold_duration_min"
      AND "cooldown_after_expiry_sec" >= 0
      AND ("max_active_holds_per_owner" IS NULL OR "max_active_holds_per_owner" >= 0)
      AND ("max_active_blocking_holds_per_owner" IS NULL OR "max_active_blocking_holds_per_owner" >= 0)
      AND ("max_active_non_blocking_holds_per_owner" IS NULL OR "max_active_non_blocking_holds_per_owner" >= 0)
      AND ("min_preauth_amount_minor" IS NULL OR "min_preauth_amount_minor" >= 0)
      AND ("act_fast_threshold_count" IS NULL OR "act_fast_threshold_count" > 0)
      AND ("act_fast_threshold_unique_owners" IS NULL OR "act_fast_threshold_unique_owners" > 0)
      AND "priority" >= 0
      `,
    ),

    /** Effective window must be ordered when both sides exist. */
    capacityHoldPoliciesEffectiveWindowCheck: check(
      "capacity_hold_policies_effective_window_check",
      sql`"effective_start_at" IS NULL OR "effective_end_at" IS NULL OR "effective_end_at" > "effective_start_at"`,
    ),

    /** Enabled policies must allow at least one hold mode. */
    capacityHoldPoliciesModeEnablementCheck: check(
      "capacity_hold_policies_mode_enablement_check",
      sql`
      ("is_enabled" = false)
      OR ("allow_blocking_holds" = true OR "allow_non_blocking_holds" = true)
      `,
    ),

    /** Default mode must be allowed by policy mode toggles. */
    capacityHoldPoliciesDefaultModeAllowedCheck: check(
      "capacity_hold_policies_default_mode_allowed_check",
      sql`
      (
        "default_effect_mode" = 'blocking'
        AND "allow_blocking_holds" = true
      ) OR (
        "default_effect_mode" = 'non_blocking'
        AND "allow_non_blocking_holds" = true
      ) OR (
        "default_effect_mode" = 'advisory'
      )
      `,
    ),

    /**
     * If payment-intent requirement is enabled, blocking holds must be allowed.
     * Otherwise the requirement would be impossible to satisfy.
     */
    capacityHoldPoliciesPaymentGuardCheck: check(
      "capacity_hold_policies_payment_guard_check",
      sql`
      "require_payment_intent_for_blocking_hold" = false
      OR "allow_blocking_holds" = true
      `,
    ),

    /** Target payload must match target type exactly. */
    capacityHoldPoliciesTargetShapeCheck: check(
      "capacity_hold_policies_target_shape_check",
      sql`
      (
        "target_type" = 'biz'
        AND "location_id" IS NULL
        AND "calendar_id" IS NULL
        AND "resource_id" IS NULL
        AND "capacity_pool_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "product_id" IS NULL
        AND "sellable_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'location'
        AND "location_id" IS NOT NULL
        AND "calendar_id" IS NULL
        AND "resource_id" IS NULL
        AND "capacity_pool_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "product_id" IS NULL
        AND "sellable_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'calendar'
        AND "location_id" IS NULL
        AND "calendar_id" IS NOT NULL
        AND "resource_id" IS NULL
        AND "capacity_pool_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "product_id" IS NULL
        AND "sellable_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'resource'
        AND "location_id" IS NULL
        AND "calendar_id" IS NULL
        AND "resource_id" IS NOT NULL
        AND "capacity_pool_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "product_id" IS NULL
        AND "sellable_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'capacity_pool'
        AND "location_id" IS NULL
        AND "calendar_id" IS NULL
        AND "resource_id" IS NULL
        AND "capacity_pool_id" IS NOT NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "product_id" IS NULL
        AND "sellable_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'service'
        AND "location_id" IS NULL
        AND "calendar_id" IS NULL
        AND "resource_id" IS NULL
        AND "capacity_pool_id" IS NULL
        AND "service_id" IS NOT NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "product_id" IS NULL
        AND "sellable_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'service_product'
        AND "location_id" IS NULL
        AND "calendar_id" IS NULL
        AND "resource_id" IS NULL
        AND "capacity_pool_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NOT NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "product_id" IS NULL
        AND "sellable_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'offer'
        AND "location_id" IS NULL
        AND "calendar_id" IS NULL
        AND "resource_id" IS NULL
        AND "capacity_pool_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NOT NULL
        AND "offer_version_id" IS NULL
        AND "product_id" IS NULL
        AND "sellable_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'offer_version'
        AND "location_id" IS NULL
        AND "calendar_id" IS NULL
        AND "resource_id" IS NULL
        AND "capacity_pool_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NOT NULL
        AND "product_id" IS NULL
        AND "sellable_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'product'
        AND "location_id" IS NULL
        AND "calendar_id" IS NULL
        AND "resource_id" IS NULL
        AND "capacity_pool_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "product_id" IS NOT NULL
        AND "sellable_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'sellable'
        AND "location_id" IS NULL
        AND "calendar_id" IS NULL
        AND "resource_id" IS NULL
        AND "capacity_pool_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "product_id" IS NULL
        AND "sellable_id" IS NOT NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'custom_subject'
        AND "location_id" IS NULL
        AND "calendar_id" IS NULL
        AND "resource_id" IS NULL
        AND "capacity_pool_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "product_id" IS NULL
        AND "sellable_id" IS NULL
        AND "target_ref_type" IS NOT NULL
        AND "target_ref_id" IS NOT NULL
      )
      `,
    ),

    /** Canonical scope key must match selected target payload exactly. */
    capacityHoldPoliciesTargetRefKeyShapeCheck: check(
      "capacity_hold_policies_target_ref_key_shape_check",
      sql`
      (
        "target_type" = 'biz'
        AND "target_ref_key" = 'biz'
      ) OR (
        "target_type" = 'location'
        AND "target_ref_key" = ('location:' || "location_id")
      ) OR (
        "target_type" = 'calendar'
        AND "target_ref_key" = ('calendar:' || "calendar_id")
      ) OR (
        "target_type" = 'resource'
        AND "target_ref_key" = ('resource:' || "resource_id")
      ) OR (
        "target_type" = 'capacity_pool'
        AND "target_ref_key" = ('capacity_pool:' || "capacity_pool_id")
      ) OR (
        "target_type" = 'service'
        AND "target_ref_key" = ('service:' || "service_id")
      ) OR (
        "target_type" = 'service_product'
        AND "target_ref_key" = ('service_product:' || "service_product_id")
      ) OR (
        "target_type" = 'offer'
        AND "target_ref_key" = ('offer:' || "offer_id")
      ) OR (
        "target_type" = 'offer_version'
        AND "target_ref_key" = ('offer_version:' || "offer_version_id")
      ) OR (
        "target_type" = 'product'
        AND "target_ref_key" = ('product:' || "product_id")
      ) OR (
        "target_type" = 'sellable'
        AND "target_ref_key" = ('sellable:' || "sellable_id")
      ) OR (
        "target_type" = 'custom_subject'
        AND "target_ref_key" = ('custom_subject:' || "target_ref_type" || ':' || "target_ref_id")
      )
      `,
    ),
  }),
);

/**
 * capacity_hold_demand_alerts
 *
 * ELI5:
 * This table stores "demand is heating up" alert rows derived from holds.
 *
 * Why this exists:
 * - non-blocking holds should still be visible as demand pressure,
 * - teams need "act fast" style notifications without forcing hard blocks,
 * - one normalized alert table keeps operators, automation, and plugins aligned.
 */
export const capacityHoldDemandAlerts = pgTable(
  "capacity_hold_demand_alerts",
  {
    /** Stable primary key. */
    id: idWithTag("capacity_hold_alert"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional policy row that triggered this alert. */
    capacityHoldPolicyId: idRef("capacity_hold_policy_id").references(
      () => capacityHoldPolicies.id,
    ),

    /** Scope discriminator for this alert. */
    targetType: capacityHoldPolicyTargetTypeEnum("target_type").notNull(),

    /** Typed target payloads (same shape model as hold policies). */
    locationId: idRef("location_id").references(() => locations.id),
    calendarId: idRef("calendar_id").references(() => calendars.id),
    resourceId: idRef("resource_id").references(() => resources.id),
    capacityPoolId: idRef("capacity_pool_id").references(() => capacityPools.id),
    serviceId: idRef("service_id").references(() => services.id),
    serviceProductId: idRef("service_product_id").references(
      () => serviceProducts.id,
    ),
    offerId: idRef("offer_id").references(() => offers.id),
    offerVersionId: idRef("offer_version_id").references(() => offerVersions.id),
    productId: idRef("product_id").references(() => products.id),
    sellableId: idRef("sellable_id").references(() => sellables.id),
    targetRefType: varchar("target_ref_type", { length: 80 }),
    targetRefId: idRef("target_ref_id"),
    /** Canonical scope key matching `capacity_hold_policies.target_ref_key`. */
    targetRefKey: varchar("target_ref_key", { length: 320 }).notNull(),

    /** Alert lifecycle and urgency level. */
    status: capacityHoldDemandAlertStatusEnum("status").default("open").notNull(),
    severity: capacityHoldDemandAlertSeverityEnum("severity")
      .default("medium")
      .notNull(),

    /** Window where pressure was observed. */
    windowStartAt: timestamp("window_start_at", { withTimezone: true }).notNull(),
    windowEndAt: timestamp("window_end_at", { withTimezone: true }).notNull(),

    /** Aggregated pressure facts used by routing/notification logic. */
    blockingHoldCount: integer("blocking_hold_count").default(0).notNull(),
    nonBlockingHoldCount: integer("non_blocking_hold_count").default(0).notNull(),
    uniqueOwnerCount: integer("unique_owner_count").default(0).notNull(),
    pressureScore: integer("pressure_score").default(0).notNull(),

    /** Optional human summary shown in operator tools. */
    title: varchar("title", { length: 260 }),
    summary: varchar("summary", { length: 1200 }),

    /** Optional idempotency key for alert projection/aggregation workers. */
    requestKey: varchar("request_key", { length: 140 }),

    /** Alert lifecycle timeline markers. */
    firstTriggeredAt: timestamp("first_triggered_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastObservedAt: timestamp("last_observed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true }),

    /** Optional threshold/config snapshot used when alert was emitted. */
    thresholdSnapshot: jsonb("threshold_snapshot").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references. */
    capacityHoldDemandAlertsBizIdIdUnique: uniqueIndex(
      "capacity_hold_demand_alerts_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Optional idempotency dedupe for projection workers. */
    capacityHoldDemandAlertsBizRequestKeyUnique: uniqueIndex(
      "capacity_hold_demand_alerts_biz_request_key_unique",
    )
      .on(table.bizId, table.requestKey)
      .where(sql`"request_key" IS NOT NULL`),

    /** Main operator inbox path. */
    capacityHoldDemandAlertsBizStatusSeverityObservedIdx: index(
      "capacity_hold_demand_alerts_biz_status_severity_observed_idx",
    ).on(table.bizId, table.status, table.severity, table.lastObservedAt),

    /** Scope-focused query path for dashboards. */
    capacityHoldDemandAlertsBizTargetStatusWindowIdx: index(
      "capacity_hold_demand_alerts_biz_target_status_window_idx",
    ).on(
      table.bizId,
      table.targetType,
      table.targetRefKey,
      table.status,
      table.windowStartAt,
      table.windowEndAt,
    ),

    /** Calendar-focused path for operator schedule screens. */
    capacityHoldDemandAlertsBizCalendarStatusWindowIdx: index(
      "capacity_hold_demand_alerts_biz_calendar_status_window_idx",
    ).on(table.bizId, table.calendarId, table.status, table.windowStartAt, table.windowEndAt),

    /** Tenant-safe FK to optional source hold policy. */
    capacityHoldDemandAlertsBizPolicyFk: foreignKey({
      columns: [table.bizId, table.capacityHoldPolicyId],
      foreignColumns: [capacityHoldPolicies.bizId, capacityHoldPolicies.id],
      name: "capacity_hold_demand_alerts_biz_policy_fk",
    }),

    /** Tenant-safe typed target FKs. */
    capacityHoldDemandAlertsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "capacity_hold_demand_alerts_biz_location_fk",
    }),
    capacityHoldDemandAlertsBizCalendarFk: foreignKey({
      columns: [table.bizId, table.calendarId],
      foreignColumns: [calendars.bizId, calendars.id],
      name: "capacity_hold_demand_alerts_biz_calendar_fk",
    }),
    capacityHoldDemandAlertsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "capacity_hold_demand_alerts_biz_resource_fk",
    }),
    capacityHoldDemandAlertsBizPoolFk: foreignKey({
      columns: [table.bizId, table.capacityPoolId],
      foreignColumns: [capacityPools.bizId, capacityPools.id],
      name: "capacity_hold_demand_alerts_biz_pool_fk",
    }),
    capacityHoldDemandAlertsBizServiceFk: foreignKey({
      columns: [table.bizId, table.serviceId],
      foreignColumns: [services.bizId, services.id],
      name: "capacity_hold_demand_alerts_biz_service_fk",
    }),
    capacityHoldDemandAlertsBizServiceProductFk: foreignKey({
      columns: [table.bizId, table.serviceProductId],
      foreignColumns: [serviceProducts.bizId, serviceProducts.id],
      name: "capacity_hold_demand_alerts_biz_service_product_fk",
    }),
    capacityHoldDemandAlertsBizOfferFk: foreignKey({
      columns: [table.bizId, table.offerId],
      foreignColumns: [offers.bizId, offers.id],
      name: "capacity_hold_demand_alerts_biz_offer_fk",
    }),
    capacityHoldDemandAlertsBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "capacity_hold_demand_alerts_biz_offer_version_fk",
    }),
    capacityHoldDemandAlertsBizProductFk: foreignKey({
      columns: [table.bizId, table.productId],
      foreignColumns: [products.bizId, products.id],
      name: "capacity_hold_demand_alerts_biz_product_fk",
    }),
    capacityHoldDemandAlertsBizSellableFk: foreignKey({
      columns: [table.bizId, table.sellableId],
      foreignColumns: [sellables.bizId, sellables.id],
      name: "capacity_hold_demand_alerts_biz_sellable_fk",
    }),
    capacityHoldDemandAlertsBizSubjectFk: foreignKey({
      columns: [table.bizId, table.targetRefType, table.targetRefId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "capacity_hold_demand_alerts_biz_subject_fk",
    }),

    /** Numeric and timeline sanity checks. */
    capacityHoldDemandAlertsBoundsCheck: check(
      "capacity_hold_demand_alerts_bounds_check",
      sql`
      "window_end_at" > "window_start_at"
      AND length("target_ref_key") > 0
      AND "blocking_hold_count" >= 0
      AND "non_blocking_hold_count" >= 0
      AND "unique_owner_count" >= 0
      AND "pressure_score" >= 0
      `,
    ),

    /** Alert timeline ordering checks. */
    capacityHoldDemandAlertsTimelineCheck: check(
      "capacity_hold_demand_alerts_timeline_check",
      sql`
      "last_observed_at" >= "first_triggered_at"
      AND ("acknowledged_at" IS NULL OR "acknowledged_at" >= "first_triggered_at")
      AND ("resolved_at" IS NULL OR "resolved_at" >= "first_triggered_at")
      AND ("expired_at" IS NULL OR "expired_at" >= "first_triggered_at")
      `,
    ),

    /** Target payload must match target type exactly. */
    capacityHoldDemandAlertsTargetShapeCheck: check(
      "capacity_hold_demand_alerts_target_shape_check",
      sql`
      (
        "target_type" = 'biz'
        AND "location_id" IS NULL
        AND "calendar_id" IS NULL
        AND "resource_id" IS NULL
        AND "capacity_pool_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "product_id" IS NULL
        AND "sellable_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'location'
        AND "location_id" IS NOT NULL
        AND "calendar_id" IS NULL
        AND "resource_id" IS NULL
        AND "capacity_pool_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "product_id" IS NULL
        AND "sellable_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'calendar'
        AND "location_id" IS NULL
        AND "calendar_id" IS NOT NULL
        AND "resource_id" IS NULL
        AND "capacity_pool_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "product_id" IS NULL
        AND "sellable_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'resource'
        AND "location_id" IS NULL
        AND "calendar_id" IS NULL
        AND "resource_id" IS NOT NULL
        AND "capacity_pool_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "product_id" IS NULL
        AND "sellable_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'capacity_pool'
        AND "location_id" IS NULL
        AND "calendar_id" IS NULL
        AND "resource_id" IS NULL
        AND "capacity_pool_id" IS NOT NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "product_id" IS NULL
        AND "sellable_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'service'
        AND "location_id" IS NULL
        AND "calendar_id" IS NULL
        AND "resource_id" IS NULL
        AND "capacity_pool_id" IS NULL
        AND "service_id" IS NOT NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "product_id" IS NULL
        AND "sellable_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'service_product'
        AND "location_id" IS NULL
        AND "calendar_id" IS NULL
        AND "resource_id" IS NULL
        AND "capacity_pool_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NOT NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "product_id" IS NULL
        AND "sellable_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'offer'
        AND "location_id" IS NULL
        AND "calendar_id" IS NULL
        AND "resource_id" IS NULL
        AND "capacity_pool_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NOT NULL
        AND "offer_version_id" IS NULL
        AND "product_id" IS NULL
        AND "sellable_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'offer_version'
        AND "location_id" IS NULL
        AND "calendar_id" IS NULL
        AND "resource_id" IS NULL
        AND "capacity_pool_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NOT NULL
        AND "product_id" IS NULL
        AND "sellable_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'product'
        AND "location_id" IS NULL
        AND "calendar_id" IS NULL
        AND "resource_id" IS NULL
        AND "capacity_pool_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "product_id" IS NOT NULL
        AND "sellable_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'sellable'
        AND "location_id" IS NULL
        AND "calendar_id" IS NULL
        AND "resource_id" IS NULL
        AND "capacity_pool_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "product_id" IS NULL
        AND "sellable_id" IS NOT NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'custom_subject'
        AND "location_id" IS NULL
        AND "calendar_id" IS NULL
        AND "resource_id" IS NULL
        AND "capacity_pool_id" IS NULL
        AND "service_id" IS NULL
        AND "service_product_id" IS NULL
        AND "offer_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "product_id" IS NULL
        AND "sellable_id" IS NULL
        AND "target_ref_type" IS NOT NULL
        AND "target_ref_id" IS NOT NULL
      )
      `,
    ),

    /** Canonical scope key must match selected target payload exactly. */
    capacityHoldDemandAlertsTargetRefKeyShapeCheck: check(
      "capacity_hold_demand_alerts_target_ref_key_shape_check",
      sql`
      (
        "target_type" = 'biz'
        AND "target_ref_key" = 'biz'
      ) OR (
        "target_type" = 'location'
        AND "target_ref_key" = ('location:' || "location_id")
      ) OR (
        "target_type" = 'calendar'
        AND "target_ref_key" = ('calendar:' || "calendar_id")
      ) OR (
        "target_type" = 'resource'
        AND "target_ref_key" = ('resource:' || "resource_id")
      ) OR (
        "target_type" = 'capacity_pool'
        AND "target_ref_key" = ('capacity_pool:' || "capacity_pool_id")
      ) OR (
        "target_type" = 'service'
        AND "target_ref_key" = ('service:' || "service_id")
      ) OR (
        "target_type" = 'service_product'
        AND "target_ref_key" = ('service_product:' || "service_product_id")
      ) OR (
        "target_type" = 'offer'
        AND "target_ref_key" = ('offer:' || "offer_id")
      ) OR (
        "target_type" = 'offer_version'
        AND "target_ref_key" = ('offer_version:' || "offer_version_id")
      ) OR (
        "target_type" = 'product'
        AND "target_ref_key" = ('product:' || "product_id")
      ) OR (
        "target_type" = 'sellable'
        AND "target_ref_key" = ('sellable:' || "sellable_id")
      ) OR (
        "target_type" = 'custom_subject'
        AND "target_ref_key" = ('custom_subject:' || "target_ref_type" || ':' || "target_ref_id")
      )
      `,
    ),
  }),
);

/**
 * capacity_holds
 *
 * ELI5:
 * A hold is a temporary reservation of time/capacity to prevent double-selling.
 *
 * Why this exists:
 * - queue and slot flows can run at the same time,
 * - holds let both flows safely reserve scarce capacity before final assignment.
 *
 * Examples:
 * - reserve one barber from 2:20-2:50 while queue offer is pending
 * - reserve two seats in a shared pool during checkout
 * - reserve one offer-version seat while payment is in progress
 *
 * Effective-policy write contract:
 * - writer resolves policy using `capacity_hold_policies` precedence contract,
 * - writer stores resolved policy id in `capacity_hold_policy_id`,
 * - writer snapshots computed behavior into `policy_snapshot`.
 *
 * This keeps reads fast and makes post-incident forensics reproducible even when
 * policy rows change later.
 */
export const capacityHolds = pgTable(
  "capacity_holds",
  {
    /** Stable primary key. */
    id: idWithTag("capacity_hold"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Optional resolved hold-policy row used when this hold was created.
     *
     * Keeping the pointer allows forensic replay of "which policy decided this".
     */
    capacityHoldPolicyId: idRef("capacity_hold_policy_id").references(
      () => capacityHoldPolicies.id,
    ),

    /** Calendar scope where this hold applies. */
    calendarId: idRef("calendar_id")
      .references(() => calendars.id)
      .notNull(),

    /** Target scope discriminator for this hold row. */
    targetType: capacityHoldTargetTypeEnum("target_type").notNull(),

    /** Target payload when `target_type=capacity_pool`. */
    capacityPoolId: idRef("capacity_pool_id").references(() => capacityPools.id),

    /** Target payload when `target_type=resource`. */
    resourceId: idRef("resource_id").references(() => resources.id),

    /** Target payload when `target_type=offer_version`. */
    offerVersionId: idRef("offer_version_id").references(() => offerVersions.id),

    /**
     * Target payload when `target_type=custom_subject`.
     * Kept extensible for plugin-defined capacity consumers.
     */
    targetRefType: varchar("target_ref_type", { length: 80 }),
    targetRefId: idRef("target_ref_id"),
    /**
     * Canonical target key for generic queries and plugin interoperability.
     *
     * Required format by `target_type`:
     * - calendar: `calendar:{calendar_id}`
     * - capacity_pool: `capacity_pool:{capacity_pool_id}`
     * - resource: `resource:{resource_id}`
     * - offer_version: `offer_version:{offer_version_id}`
     * - custom_subject: `custom_subject:{target_ref_type}:{target_ref_id}`
     */
    targetRefKey: varchar("target_ref_key", { length: 320 }).notNull(),

    /**
     * How this hold affects schedulability.
     *
     * - `blocking`: reserves real capacity.
     * - `non_blocking`: demand intent only; no hard capacity subtraction.
     * - `advisory`: informational hold marker.
     */
    effectMode: capacityHoldEffectModeEnum("effect_mode").default("blocking").notNull(),

    /** Hold lifecycle status. */
    status: capacityHoldStatusEnum("status").default("active").notNull(),

    /** Quantity held from the target scope. */
    quantity: integer("quantity").default(1).notNull(),

    /**
     * Relative demand weight contributed by this hold.
     *
     * Useful when non-blocking holds should influence alerts with weighted impact
     * (for example enterprise leads vs anonymous traffic).
     */
    demandWeight: integer("demand_weight").default(1).notNull(),

    /**
     * Whether this hold should feed demand-pressure alerting.
     *
     * This allows silent/system holds without polluting operator demand signals.
     */
    countsTowardDemand: boolean("counts_toward_demand").default(true).notNull(),

    /** Hold owner identity class for anti-abuse caps and analytics. */
    ownerType: capacityHoldOwnerTypeEnum("owner_type"),

    /** Owner payload when `owner_type=user`. */
    ownerUserId: idRef("owner_user_id").references(() => users.id),

    /** Owner payload when `owner_type=group_account`. */
    ownerGroupAccountId: idRef("owner_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Owner payload when `owner_type=subject`. */
    ownerSubjectType: varchar("owner_subject_type", { length: 80 }),
    ownerSubjectId: idRef("owner_subject_id"),

    /**
     * Owner payload when `owner_type=guest_fingerprint`.
     *
     * Store only a one-way hash/fingerprint string, not raw IP/device PII.
     */
    ownerFingerprintHash: varchar("owner_fingerprint_hash", { length: 140 }),

    /**
     * Canonical owner key used for anti-abuse counters and generic owner queries.
     *
     * Examples:
     * - `user:{user_id}`
     * - `group_account:{group_account_id}`
     * - `subject:{subject_type}:{subject_id}`
     * - `guest_fingerprint:{hash}`
     * - `system`
     */
    ownerRefKey: varchar("owner_ref_key", { length: 320 }),

    /** Hold window start. */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),

    /** Hold window end. */
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

    /** Optional expiry for unclaimed holds. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Optional completion markers by terminal state. */
    releasedAt: timestamp("released_at", { withTimezone: true }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    /** Source signal class for this hold. */
    sourceSignalType: availabilityGateSignalTypeEnum("source_signal_type")
      .default("manual")
      .notNull(),

    /** Optional source pointer for reconciliation/debugging. */
    sourceRefType: varchar("source_ref_type", { length: 80 }),
    sourceRefId: idRef("source_ref_id"),

    /** Optional idempotency key for hold upsert workers. */
    requestKey: varchar("request_key", { length: 140 }),

    /** Optional operator/system reason code. */
    reasonCode: varchar("reason_code", { length: 120 }),

    /** Policy/context snapshot used when the hold was created. */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    capacityHoldsBizIdIdUnique: uniqueIndex("capacity_holds_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key for tenant-safe references. */

    /** Optional idempotency dedupe guard. */
    capacityHoldsBizRequestKeyUnique: uniqueIndex(
      "capacity_holds_biz_request_key_unique",
    )
      .on(table.bizId, table.requestKey)
      .where(sql`"request_key" IS NOT NULL`),

    /** Common lookup path by calendar timeline. */
    capacityHoldsBizCalendarStatusWindowIdx: index(
      "capacity_holds_biz_calendar_status_window_idx",
    ).on(table.bizId, table.calendarId, table.status, table.startsAt, table.endsAt),

    /** Common lookup path for shared-pool reservation engines. */
    capacityHoldsBizPoolStatusWindowIdx: index(
      "capacity_holds_biz_pool_status_window_idx",
    ).on(table.bizId, table.capacityPoolId, table.status, table.startsAt, table.endsAt),

    /** Common lookup path for resource-level reservation engines. */
    capacityHoldsBizResourceStatusWindowIdx: index(
      "capacity_holds_biz_resource_status_window_idx",
    ).on(table.bizId, table.resourceId, table.status, table.startsAt, table.endsAt),

    /** Target-key path for generic hold lookups independent of typed columns. */
    capacityHoldsBizTargetStatusWindowIdx: index(
      "capacity_holds_biz_target_status_window_idx",
    ).on(table.bizId, table.targetType, table.targetRefKey, table.status, table.startsAt, table.endsAt),

    /**
     * Demand-scan fast path for alert projection workers.
     *
     * We index only active holds that actually count toward demand so alert
     * projection does not scan irrelevant rows (released/cancelled or silent holds).
     */
    capacityHoldsBizTargetDemandWindowIdx: index(
      "capacity_holds_biz_target_demand_window_idx",
    )
      .on(table.bizId, table.targetType, table.targetRefKey, table.startsAt, table.endsAt)
      .where(sql`"status" = 'active' AND "counts_toward_demand" = true`),

    /** Effect-mode path for mixed blocking vs non-blocking hold orchestration. */
    capacityHoldsBizEffectStatusWindowIdx: index(
      "capacity_holds_biz_effect_status_window_idx",
    ).on(table.bizId, table.effectMode, table.status, table.startsAt, table.endsAt),

    /** Policy-centric path for debugging and rule-level analytics. */
    capacityHoldsBizPolicyStatusWindowIdx: index(
      "capacity_holds_biz_policy_status_window_idx",
    ).on(table.bizId, table.capacityHoldPolicyId, table.status, table.startsAt, table.endsAt),

    /** Owner query path for anti-abuse checks and owner hold dashboards. */
    capacityHoldsBizOwnerStatusWindowIdx: index(
      "capacity_holds_biz_owner_status_window_idx",
    ).on(table.bizId, table.ownerType, table.status, table.startsAt, table.endsAt),

    /** Fast cap-check path using canonical owner key across all owner types. */
    capacityHoldsBizOwnerRefStatusWindowIdx: index(
      "capacity_holds_biz_owner_ref_status_window_idx",
    )
      .on(table.bizId, table.ownerRefKey, table.status, table.startsAt, table.endsAt)
      .where(sql`"owner_ref_key" IS NOT NULL`),

    /** Source-based debugging/reconciliation path. */
    capacityHoldsBizSourceRefIdx: index("capacity_holds_biz_source_ref_idx").on(
      table.bizId,
      table.sourceRefType,
      table.sourceRefId,
    ),

    /** Tenant-safe FK to calendar. */
    capacityHoldsBizCalendarFk: foreignKey({
      columns: [table.bizId, table.calendarId],
      foreignColumns: [calendars.bizId, calendars.id],
      name: "capacity_holds_biz_calendar_fk",
    }),

    /** Tenant-safe FK to optional resolved hold policy row. */
    capacityHoldsBizPolicyFk: foreignKey({
      columns: [table.bizId, table.capacityHoldPolicyId],
      foreignColumns: [capacityHoldPolicies.bizId, capacityHoldPolicies.id],
      name: "capacity_holds_biz_policy_fk",
    }),

    /** Tenant-safe FK to optional pool target. */
    capacityHoldsBizPoolFk: foreignKey({
      columns: [table.bizId, table.capacityPoolId],
      foreignColumns: [capacityPools.bizId, capacityPools.id],
      name: "capacity_holds_biz_pool_fk",
    }),

    /** Tenant-safe FK to optional resource target. */
    capacityHoldsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "capacity_holds_biz_resource_fk",
    }),

    /** Tenant-safe FK to optional offer-version target. */
    capacityHoldsBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "capacity_holds_biz_offer_version_fk",
    }),

    /** Tenant-safe FK for optional group-account owner payload. */
    capacityHoldsBizOwnerGroupAccountFk: foreignKey({
      columns: [table.bizId, table.ownerGroupAccountId],
      foreignColumns: [groupAccounts.bizId, groupAccounts.id],
      name: "capacity_holds_biz_owner_group_account_fk",
    }),

    /** Tenant-safe FK for optional custom-subject owner payload. */
    capacityHoldsBizOwnerSubjectFk: foreignKey({
      columns: [table.bizId, table.ownerSubjectType, table.ownerSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "capacity_holds_biz_owner_subject_fk",
    }),

    /** Window and quantity bounds. */
    capacityHoldsBoundsCheck: check(
      "capacity_holds_bounds_check",
      sql`
      length("target_ref_key") > 0
      AND "quantity" > 0
      AND "demand_weight" > 0
      AND "ends_at" > "starts_at"
      AND ("expires_at" IS NULL OR "expires_at" >= "starts_at")
      `,
    ),

    /**
     * Demand-pipeline shape check:
     * if demand counting is enabled, demand weight must be meaningful.
     */
    capacityHoldsDemandShapeCheck: check(
      "capacity_holds_demand_shape_check",
      sql`
      ("counts_toward_demand" = false)
      OR ("demand_weight" > 0)
      `,
    ),

    /** Source reference should be fully-null or fully-populated. */
    capacityHoldsSourcePairCheck: check(
      "capacity_holds_source_pair_check",
      sql`
      (
        "source_ref_type" IS NULL
        AND "source_ref_id" IS NULL
      ) OR (
        "source_ref_type" IS NOT NULL
        AND "source_ref_id" IS NOT NULL
      )
      `,
    ),

    /** Owner payload must match owner type exactly. */
    capacityHoldsOwnerShapeCheck: check(
      "capacity_holds_owner_shape_check",
      sql`
      (
        "owner_type" IS NULL
        AND "owner_user_id" IS NULL
        AND "owner_group_account_id" IS NULL
        AND "owner_subject_type" IS NULL
        AND "owner_subject_id" IS NULL
        AND "owner_fingerprint_hash" IS NULL
        AND "owner_ref_key" IS NULL
      ) OR (
        "owner_type" = 'user'
        AND "owner_user_id" IS NOT NULL
        AND "owner_group_account_id" IS NULL
        AND "owner_subject_type" IS NULL
        AND "owner_subject_id" IS NULL
        AND "owner_fingerprint_hash" IS NULL
        AND "owner_ref_key" IS NOT NULL
      ) OR (
        "owner_type" = 'group_account'
        AND "owner_user_id" IS NULL
        AND "owner_group_account_id" IS NOT NULL
        AND "owner_subject_type" IS NULL
        AND "owner_subject_id" IS NULL
        AND "owner_fingerprint_hash" IS NULL
        AND "owner_ref_key" IS NOT NULL
      ) OR (
        "owner_type" = 'subject'
        AND "owner_user_id" IS NULL
        AND "owner_group_account_id" IS NULL
        AND "owner_subject_type" IS NOT NULL
        AND "owner_subject_id" IS NOT NULL
        AND "owner_fingerprint_hash" IS NULL
        AND "owner_ref_key" IS NOT NULL
      ) OR (
        "owner_type" = 'guest_fingerprint'
        AND "owner_user_id" IS NULL
        AND "owner_group_account_id" IS NULL
        AND "owner_subject_type" IS NULL
        AND "owner_subject_id" IS NULL
        AND "owner_fingerprint_hash" IS NOT NULL
        AND "owner_ref_key" IS NOT NULL
      ) OR (
        "owner_type" = 'system'
        AND "owner_user_id" IS NULL
        AND "owner_group_account_id" IS NULL
        AND "owner_subject_type" IS NULL
        AND "owner_subject_id" IS NULL
        AND "owner_fingerprint_hash" IS NULL
        AND "owner_ref_key" = 'system'
      )
      `,
    ),

    /** Canonical owner key must match selected owner payload exactly. */
    capacityHoldsOwnerRefKeyShapeCheck: check(
      "capacity_holds_owner_ref_key_shape_check",
      sql`
      (
        "owner_type" IS NULL
        AND "owner_ref_key" IS NULL
      ) OR (
        "owner_type" = 'user'
        AND "owner_ref_key" = ('user:' || "owner_user_id")
      ) OR (
        "owner_type" = 'group_account'
        AND "owner_ref_key" = ('group_account:' || "owner_group_account_id")
      ) OR (
        "owner_type" = 'subject'
        AND "owner_ref_key" = ('subject:' || "owner_subject_type" || ':' || "owner_subject_id")
      ) OR (
        "owner_type" = 'guest_fingerprint'
        AND "owner_ref_key" = ('guest_fingerprint:' || "owner_fingerprint_hash")
      ) OR (
        "owner_type" = 'system'
        AND "owner_ref_key" = 'system'
      )
      `,
    ),

    /** Target payload must match target type exactly. */
    capacityHoldsTargetShapeCheck: check(
      "capacity_holds_target_shape_check",
      sql`
      (
        "target_type" = 'calendar'
        AND "capacity_pool_id" IS NULL
        AND "resource_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'capacity_pool'
        AND "capacity_pool_id" IS NOT NULL
        AND "resource_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'resource'
        AND "capacity_pool_id" IS NULL
        AND "resource_id" IS NOT NULL
        AND "offer_version_id" IS NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'offer_version'
        AND "capacity_pool_id" IS NULL
        AND "resource_id" IS NULL
        AND "offer_version_id" IS NOT NULL
        AND "target_ref_type" IS NULL
        AND "target_ref_id" IS NULL
      ) OR (
        "target_type" = 'custom_subject'
        AND "capacity_pool_id" IS NULL
        AND "resource_id" IS NULL
        AND "offer_version_id" IS NULL
        AND "target_ref_type" IS NOT NULL
        AND "target_ref_id" IS NOT NULL
      )
      `,
    ),

    /** Canonical target key must match selected target payload exactly. */
    capacityHoldsTargetRefKeyShapeCheck: check(
      "capacity_holds_target_ref_key_shape_check",
      sql`
      (
        "target_type" = 'calendar'
        AND "target_ref_key" = ('calendar:' || "calendar_id")
      ) OR (
        "target_type" = 'capacity_pool'
        AND "target_ref_key" = ('capacity_pool:' || "capacity_pool_id")
      ) OR (
        "target_type" = 'resource'
        AND "target_ref_key" = ('resource:' || "resource_id")
      ) OR (
        "target_type" = 'offer_version'
        AND "target_ref_key" = ('offer_version:' || "offer_version_id")
      ) OR (
        "target_type" = 'custom_subject'
        AND "target_ref_key" = ('custom_subject:' || "target_ref_type" || ':' || "target_ref_id")
      )
      `,
    ),

    /** Terminal statuses should carry their matching completion marker. */
    capacityHoldsTerminalStatusShapeCheck: check(
      "capacity_holds_terminal_status_shape_check",
      sql`
      (
        "status" = 'active'
        AND "released_at" IS NULL
        AND "consumed_at" IS NULL
        AND "cancelled_at" IS NULL
      ) OR (
        "status" = 'released'
        AND "released_at" IS NOT NULL
      ) OR (
        "status" = 'consumed'
        AND "consumed_at" IS NOT NULL
      ) OR (
        "status" = 'cancelled'
        AND "cancelled_at" IS NOT NULL
      ) OR (
        "status" = 'expired'
      )
      `,
    ),
  }),
);

/**
 * capacity_hold_events
 *
 * ELI5:
 * `capacity_holds` tells the current hold row state.
 * `capacity_hold_events` tells the immutable story of how that state changed.
 *
 * Why this exists:
 * - support/compliance can answer "who changed this hold and when?",
 * - analytics can reconstruct transition funnels without diffing snapshots,
 * - future automation/plugins can subscribe to deterministic transition facts.
 *
 * Operational rule:
 * treat this table as append-only. Corrections should append compensating events.
 */
export const capacityHoldEvents = pgTable(
  "capacity_hold_events",
  {
    /** Stable primary key for one transition/event row. */
    id: idWithTag("capacity_hold_event"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent hold row this event belongs to. */
    capacityHoldId: idRef("capacity_hold_id").notNull(),

    /** Transition/event category. */
    eventType: capacityHoldEventTypeEnum("event_type").notNull(),

    /** Previous hold status snapshot when known. */
    previousStatus: capacityHoldStatusEnum("previous_status"),

    /** New hold status snapshot when known. */
    nextStatus: capacityHoldStatusEnum("next_status"),

    /** Previous effect-mode snapshot when known. */
    previousEffectMode: capacityHoldEffectModeEnum("previous_effect_mode"),

    /** New effect-mode snapshot when known. */
    nextEffectMode: capacityHoldEffectModeEnum("next_effect_mode"),

    /** Previous quantity snapshot when known. */
    previousQuantity: integer("previous_quantity"),

    /** New quantity snapshot when known. */
    nextQuantity: integer("next_quantity"),

    /**
     * Optional actor identity for user-triggered transitions.
     * System/worker events can keep this null and set actorRef.
     */
    actorUserId: idRef("actor_user_id").references(() => users.id),

    /** Optional non-user actor key (worker id, extension id, webhook key). */
    actorRef: varchar("actor_ref", { length: 200 }),

    /** Optional request-level correlation key. */
    requestKey: varchar("request_key", { length: 140 }),

    /** Optional reason code for business/audit explainability. */
    reasonCode: varchar("reason_code", { length: 120 }),

    /** Business occurrence timestamp for this event. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Deterministic transition context snapshot. */
    details: jsonb("details").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    capacityHoldEventsBizIdIdUnique: uniqueIndex("capacity_hold_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe references. */

    /** Main transition timeline path for one hold. */
    capacityHoldEventsBizHoldOccurredIdx: index(
      "capacity_hold_events_biz_hold_occurred_idx",
    ).on(table.bizId, table.capacityHoldId, table.occurredAt),

    /** Event analytics path by type and status movement. */
    capacityHoldEventsBizTypeOccurredIdx: index(
      "capacity_hold_events_biz_type_occurred_idx",
    ).on(table.bizId, table.eventType, table.nextStatus, table.occurredAt),

    /** Correlation/debug path for request-level traces. */
    capacityHoldEventsBizRequestOccurredIdx: index(
      "capacity_hold_events_biz_request_occurred_idx",
    ).on(table.bizId, table.requestKey, table.occurredAt),

    /** Tenant-safe FK to parent hold row. */
    capacityHoldEventsBizHoldFk: foreignKey({
      columns: [table.bizId, table.capacityHoldId],
      foreignColumns: [capacityHolds.bizId, capacityHolds.id],
      name: "capacity_hold_events_biz_hold_fk",
    }),

    /** Quantity transition snapshots must stay non-negative when present. */
    capacityHoldEventsQuantityBoundsCheck: check(
      "capacity_hold_events_quantity_bounds_check",
      sql`
      ("previous_quantity" IS NULL OR "previous_quantity" >= 0)
      AND ("next_quantity" IS NULL OR "next_quantity" >= 0)
      `,
    ),

    /** Transition events should carry at least one transition dimension. */
    capacityHoldEventsTransitionShapeCheck: check(
      "capacity_hold_events_transition_shape_check",
      sql`
      "event_type" = 'created'
      OR "event_type" = 'updated'
      OR "previous_status" IS NOT NULL
      OR "next_status" IS NOT NULL
      OR "previous_effect_mode" IS NOT NULL
      OR "next_effect_mode" IS NOT NULL
      OR "previous_quantity" IS NOT NULL
      OR "next_quantity" IS NOT NULL
      `,
    ),
  }),
);

/**
 * calendar_revisions
 *
 * ELI5:
 * This is the immutable version log for calendar configuration changes.
 *
 * Why this matters:
 * - lets operators answer "what changed and when?",
 * - supports rollback/replay tooling,
 * - makes calendar behavior easier to debug over time.
 */
export const calendarRevisions = pgTable(
  "calendar_revisions",
  {
    /** Stable primary key for one revision row. */
    id: idWithTag("calendar_revision"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Calendar this revision belongs to. */
    calendarId: idRef("calendar_id").notNull(),

    /** Monotonic revision number (1,2,3...) per calendar. */
    revision: integer("revision").notNull(),

    /**
     * Change class key.
     * Examples: `rules_updated`, `template_binding_updated`, `policy_updated`.
     */
    changeType: varchar("change_type", { length: 120 }).notNull(),

    /** Optional short summary for changelog views. */
    changeSummary: varchar("change_summary", { length: 1000 }),

    /** Optional source pointer that triggered this revision. */
    sourceRefType: varchar("source_ref_type", { length: 80 }),
    sourceRefId: idRef("source_ref_id"),

    /** Optional idempotency key for deterministic revision writers. */
    idempotencyKey: varchar("idempotency_key", { length: 200 }),

    /**
     * Full resolved calendar snapshot at this revision boundary.
     *
     * Keep this immutable so historical replays do not depend on mutable state.
     */
    snapshot: jsonb("snapshot").default({}).notNull(),

    /** Extension payload for domain-specific revision metadata. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    calendarRevisionsBizIdIdUnique: uniqueIndex("calendar_revisions_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key used by tenant-safe external references. */

    /** One revision number per calendar. */
    calendarRevisionsCalendarRevisionUnique: uniqueIndex(
      "calendar_revisions_calendar_revision_unique",
    ).on(table.calendarId, table.revision),

    /** Fast timeline query path by calendar. */
    calendarRevisionsBizCalendarRevisionIdx: index(
      "calendar_revisions_biz_calendar_revision_idx",
    ).on(table.bizId, table.calendarId, table.revision),

    /** Optional dedupe key guard for revision writers. */
    calendarRevisionsBizIdempotencyUnique: uniqueIndex(
      "calendar_revisions_biz_idempotency_unique",
    )
      .on(table.bizId, table.idempotencyKey)
      .where(sql`"idempotency_key" IS NOT NULL`),

    /** Tenant-safe FK to calendar. */
    calendarRevisionsBizCalendarFk: foreignKey({
      columns: [table.bizId, table.calendarId],
      foreignColumns: [calendars.bizId, calendars.id],
      name: "calendar_revisions_biz_calendar_fk",
    }),

    /** Source reference should be fully-null or fully-populated. */
    calendarRevisionsSourcePairCheck: check(
      "calendar_revisions_source_pair_check",
      sql`
      (
        "source_ref_type" IS NULL
        AND "source_ref_id" IS NULL
      ) OR (
        "source_ref_type" IS NOT NULL
        AND "source_ref_id" IS NOT NULL
      )
      `,
    ),

    /** Revision values must start at 1. */
    calendarRevisionsRevisionCheck: check(
      "calendar_revisions_revision_check",
      sql`"revision" >= 1`,
    ),
  }),
);

/**
 * calendar_timeline_events
 *
 * ELI5:
 * One unified read model row per calendar interval fact.
 *
 * This is intentionally a projection-friendly table:
 * - source domains write canonical events here,
 * - calendar UIs query one table for busy/unavailable/history views,
 * - APIs avoid expensive unions across bookings/holds/maintenance/external sync.
 */
export const calendarTimelineEvents = pgTable(
  "calendar_timeline_events",
  {
    /** Stable primary key for one timeline fact row. */
    id: idWithTag("calendar_timeline_event"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Calendar this interval belongs to. */
    calendarId: idRef("calendar_id")
      .references(() => calendars.id)
      .notNull(),

    /** Origin taxonomy of this fact row. */
    sourceType: calendarTimelineEventSourceTypeEnum("source_type").notNull(),

    /** Normalized state used by calendar rendering and conflict engines. */
    state: calendarTimelineStateEnum("state").notNull(),

    /** Detail visibility class for policy-aware consumers. */
    visibility: calendarTimelineVisibilityEnum("visibility")
      .default("private")
      .notNull(),

    /** Optional title for full-detail viewers. */
    title: varchar("title", { length: 260 }),

    /** Optional summary text for masked/full-detail viewers. */
    summary: varchar("summary", { length: 1000 }),

    /** Interval start. */
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),

    /** Interval end. */
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),

    /** All-day indicator for rendering optimization. */
    isAllDay: boolean("is_all_day").default(false).notNull(),

    /** Optional generic pointer to originating source row. */
    sourceRefType: varchar("source_ref_type", { length: 80 }),
    sourceRefId: idRef("source_ref_id"),

    /** Optional correlation id for cross-table trace stitching. */
    correlationId: varchar("correlation_id", { length: 200 }),

    /**
     * Optional dedupe key for idempotent projector writes.
     *
     * Recommended producer convention:
     * `source_type:source_ref_type:source_ref_id:start_at:end_at:binding_id`.
     * This keeps replays/upserts deterministic across retrying workers.
     */
    idempotencyKey: varchar("idempotency_key", { length: 200 }),

    /** Active toggle for correction/supersession without hard delete. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Source payload snapshot used by timeline resolvers/renderers. */
    payload: jsonb("payload").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe references. */
    calendarTimelineEventsBizIdIdUnique: uniqueIndex(
      "calendar_timeline_events_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Optional idempotency dedupe guard for projector workers. */
    calendarTimelineEventsBizIdempotencyUnique: uniqueIndex(
      "calendar_timeline_events_biz_idempotency_unique",
    )
      .on(table.bizId, table.idempotencyKey)
      .where(sql`"idempotency_key" IS NOT NULL`),

    /** Main timeline query path for calendar rendering. */
    calendarTimelineEventsBizCalendarWindowStateIdx: index(
      "calendar_timeline_events_biz_cal_window_state_idx",
    ).on(
      table.bizId,
      table.calendarId,
      table.isActive,
      table.startAt,
      table.endAt,
      table.state,
    ),

    /** Reverse lookup path by source pointer. */
    calendarTimelineEventsBizSourceRefIdx: index(
      "calendar_timeline_events_biz_source_ref_idx",
    ).on(table.bizId, table.sourceType, table.sourceRefType, table.sourceRefId),

    /** Optional duplicate guard for source-anchored rows in same interval. */
    calendarTimelineEventsBizSourceWindowUnique: uniqueIndex(
      "calendar_timeline_events_biz_source_window_unique",
    )
      .on(
        table.bizId,
        table.sourceType,
        table.sourceRefType,
        table.sourceRefId,
        table.startAt,
        table.endAt,
      )
      .where(
        sql`"source_ref_type" IS NOT NULL AND "source_ref_id" IS NOT NULL AND "deleted_at" IS NULL`,
      ),

    /** Tenant-safe FK to calendar. */
    calendarTimelineEventsBizCalendarFk: foreignKey({
      columns: [table.bizId, table.calendarId],
      foreignColumns: [calendars.bizId, calendars.id],
      name: "calendar_timeline_events_biz_calendar_fk",
    }),

    /** Interval order invariant. */
    calendarTimelineEventsWindowCheck: check(
      "calendar_timeline_events_window_check",
      sql`"end_at" > "start_at"`,
    ),

    /** Source reference should be fully-null or fully-populated. */
    calendarTimelineEventsSourcePairCheck: check(
      "calendar_timeline_events_source_pair_check",
      sql`
      (
        "source_ref_type" IS NULL
        AND "source_ref_id" IS NULL
      ) OR (
        "source_ref_type" IS NOT NULL
        AND "source_ref_id" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * calendar_owner_timeline_events
 *
 * ELI5:
 * This is an owner-scoped projection of `calendar_timeline_events`.
 *
 * Why this exists:
 * - one calendar can be shared by many owners (biz/resource/service/user/etc),
 * - API consumers usually ask "show timeline for owner X",
 * - this projection avoids runtime join explosions for those owner-first queries.
 *
 * Projection contract:
 * - source event writers/projectors copy timeline facts into this table per
 *   active owner binding.
 * - canonical source of truth remains `calendar_timeline_events`.
 */
export const calendarOwnerTimelineEvents = pgTable(
  "calendar_owner_timeline_events",
  {
    /** Stable primary key for one owner-scoped timeline projection row. */
    id: idWithTag("calendar_owner_timeline_event"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Source calendar id for this projection row. */
    calendarId: idRef("calendar_id")
      .references(() => calendars.id)
      .notNull(),

    /** Binding this projection row is scoped to. */
    calendarBindingId: idRef("calendar_binding_id").notNull(),

    /** Source canonical timeline fact row. */
    calendarTimelineEventId: idRef("calendar_timeline_event_id").notNull(),

    /** Owner discriminator copied from binding for direct filtering. */
    ownerType: calendarOwnerTypeEnum("owner_type").notNull(),

    /** Optional owner user pointer for user-scoped calendar queries. */
    ownerUserId: idRef("owner_user_id").references(() => users.id),

    /** Optional custom owner type for plugin-defined owners. */
    ownerRefType: varchar("owner_ref_type", { length: 80 }),

    /** Optional custom owner id for plugin-defined owners. */
    ownerRefId: idRef("owner_ref_id"),

    /** Canonical owner key copied from `calendar_bindings.owner_ref_key`. */
    ownerRefKey: varchar("owner_ref_key", { length: 320 }).notNull(),

    /** Canonical source type copied from timeline event. */
    sourceType: calendarTimelineEventSourceTypeEnum("source_type").notNull(),

    /** Canonical state copied from timeline event. */
    state: calendarTimelineStateEnum("state").notNull(),

    /** Visibility copied from timeline event for policy-aware reads. */
    visibility: calendarTimelineVisibilityEnum("visibility")
      .default("private")
      .notNull(),

    /** Interval start copied from timeline event. */
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),

    /** Interval end copied from timeline event. */
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),

    /** Active toggle copied from timeline event for supersession support. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Optional source pointer copied from timeline event for reverse tracing. */
    sourceRefType: varchar("source_ref_type", { length: 80 }),
    sourceRefId: idRef("source_ref_id"),

    /** Optional correlation id for end-to-end trace stitching. */
    correlationId: varchar("correlation_id", { length: 200 }),

    /** Optional dedupe key for idempotent projector writes. */
    idempotencyKey: varchar("idempotency_key", { length: 200 }),

    /** Source payload snapshot for owner-centric renderers. */
    payload: jsonb("payload").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references. */
    calendarOwnerTimelineEventsBizIdIdUnique: uniqueIndex(
      "calendar_owner_timeline_events_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One projection row per binding/event pair. */
    calendarOwnerTimelineEventsBindingEventUnique: uniqueIndex(
      "calendar_owner_timeline_events_binding_event_unique",
    )
      .on(table.bizId, table.calendarBindingId, table.calendarTimelineEventId)
      .where(sql`"deleted_at" IS NULL`),

    /** Idempotent projection guard for retry-safe owner-timeline writers. */
    calendarOwnerTimelineEventsBindingIdempotencyUnique: uniqueIndex(
      "calendar_owner_timeline_events_binding_idempotency_unique",
    )
      .on(table.bizId, table.calendarBindingId, table.idempotencyKey)
      .where(sql`"idempotency_key" IS NOT NULL AND "deleted_at" IS NULL`),

    /** Owner-centric timeline query path (primary API read path). */
    calendarOwnerTimelineEventsOwnerWindowStateIdx: index(
      "calendar_owner_timeline_events_owner_window_state_idx",
    ).on(
      table.bizId,
      table.ownerRefKey,
      table.isActive,
      table.startAt,
      table.endAt,
      table.state,
    ),

    /** Fast path for user-owned calendar views. */
    calendarOwnerTimelineEventsOwnerUserWindowIdx: index(
      "calendar_owner_timeline_events_owner_user_window_idx",
    ).on(table.bizId, table.ownerUserId, table.isActive, table.startAt, table.endAt),

    /** Binding-centric debugging/reconciliation path. */
    calendarOwnerTimelineEventsBindingWindowIdx: index(
      "calendar_owner_timeline_events_binding_window_idx",
    ).on(table.bizId, table.calendarBindingId, table.startAt, table.endAt),

    /** Reverse lookup by source pointer. */
    calendarOwnerTimelineEventsSourceRefIdx: index(
      "calendar_owner_timeline_events_source_ref_idx",
    ).on(table.bizId, table.sourceType, table.sourceRefType, table.sourceRefId),

    /** Tenant-safe FK to calendar. */
    calendarOwnerTimelineEventsBizCalendarFk: foreignKey({
      columns: [table.bizId, table.calendarId],
      foreignColumns: [calendars.bizId, calendars.id],
      name: "calendar_owner_timeline_events_biz_calendar_fk",
    }),

    /** Tenant-safe FK to binding. */
    calendarOwnerTimelineEventsBizBindingFk: foreignKey({
      columns: [table.bizId, table.calendarBindingId],
      foreignColumns: [calendarBindings.bizId, calendarBindings.id],
      name: "calendar_owner_timeline_events_biz_binding_fk",
    }),

    /** Tenant-safe FK to canonical timeline event. */
    calendarOwnerTimelineEventsBizTimelineEventFk: foreignKey({
      columns: [table.bizId, table.calendarTimelineEventId],
      foreignColumns: [calendarTimelineEvents.bizId, calendarTimelineEvents.id],
      name: "calendar_owner_timeline_events_biz_timeline_event_fk",
    }),

    /** Interval order invariant. */
    calendarOwnerTimelineEventsWindowCheck: check(
      "calendar_owner_timeline_events_window_check",
      sql`"end_at" > "start_at"`,
    ),

    /** Source reference should be fully-null or fully-populated. */
    calendarOwnerTimelineEventsSourcePairCheck: check(
      "calendar_owner_timeline_events_source_pair_check",
      sql`
      (
        "source_ref_type" IS NULL
        AND "source_ref_id" IS NULL
      ) OR (
        "source_ref_type" IS NOT NULL
        AND "source_ref_id" IS NOT NULL
      )
      `,
    ),

    /** Custom owner ref pair should be fully-null or fully-populated. */
    calendarOwnerTimelineEventsOwnerRefPairCheck: check(
      "calendar_owner_timeline_events_owner_ref_pair_check",
      sql`
      (
        "owner_ref_type" IS NULL
        AND "owner_ref_id" IS NULL
      ) OR (
        "owner_ref_type" IS NOT NULL
        AND "owner_ref_id" IS NOT NULL
      )
      `,
    ),

    /** Canonical owner key should never be empty. */
    calendarOwnerTimelineEventsOwnerRefKeyCheck: check(
      "calendar_owner_timeline_events_owner_ref_key_check",
      sql`length("owner_ref_key") > 0`,
    ),
  }),
);

/**
 * availability_resolution_runs
 *
 * ELI5:
 * Every "is this available?" evaluation can write one trace row here.
 * It is a debug ledger that explains decisions after the fact.
 *
 * Why it matters:
 * - support can answer "why was this blocked?",
 * - product can inspect policy side effects,
 * - engineers can replay decisions during incident analysis.
 */
export const availabilityResolutionRuns = pgTable(
  "availability_resolution_runs",
  {
    /** Stable primary key for this decision trace. */
    id: idWithTag("availability_run"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Calendar evaluated by this run. */
    calendarId: idRef("calendar_id")
      .references(() => calendars.id)
      .notNull(),

    /** Optional idempotency key for deduped API evaluation calls. */
    requestKey: varchar("request_key", { length: 140 }),

    /** Evaluation window start requested by caller. */
    windowStartAt: timestamp("window_start_at", { withTimezone: true }).notNull(),

    /** Evaluation window end requested by caller. */
    windowEndAt: timestamp("window_end_at", { withTimezone: true }).notNull(),

    /** Resolution outcome classification. */
    status: availabilityResolutionStatusEnum("status").notNull(),

    /** Caller input snapshot used for reproducibility. */
    requestSnapshot: jsonb("request_snapshot").default({}).notNull(),

    /** Rule-by-rule decision trace for debugging/support. */
    decisionTrace: jsonb("decision_trace").default([]).notNull(),

    /** Final normalized availability payload returned to caller. */
    resolvedOutput: jsonb("resolved_output").default({}).notNull(),

    /** Runtime in milliseconds for observability/performance tuning. */
    runtimeMs: integer("runtime_ms"),

    /** Recorded timestamp for this run. */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }).defaultNow().notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    availabilityResolutionRunsBizIdIdUnique: uniqueIndex("availability_resolution_runs_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common path for replaying/debugging one calendar's decisions. */
    availabilityResolutionRunsBizCalendarResolvedIdx: index(
      "availability_resolution_runs_biz_calendar_resolved_idx",
    ).on(table.bizId, table.calendarId, table.resolvedAt),

    /**
     * Query backbone for "show me availability decisions for this calendar
     * window and outcome class" style debugging/analytics queries.
     */
    availabilityResolutionRunsBizCalendarWindowStatusIdx: index(
      "availability_resolution_runs_biz_calendar_window_status_idx",
    ).on(
      table.bizId,
      table.calendarId,
      table.windowStartAt,
      table.windowEndAt,
      table.status,
    ),

    /** Fast lookup for idempotent re-requests. */
    availabilityResolutionRunsBizRequestKeyIdx: index(
      "availability_resolution_runs_biz_request_key_idx",
    ).on(table.bizId, table.requestKey),

    /** Tenant-safe FK to calendar. */
    availabilityResolutionRunsBizCalendarFk: foreignKey({
      columns: [table.bizId, table.calendarId],
      foreignColumns: [calendars.bizId, calendars.id],
      name: "availability_resolution_runs_biz_calendar_fk",
    }),

    /** Evaluation window must be ordered. */
    availabilityResolutionRunsWindowCheck: check(
      "availability_resolution_runs_window_check",
      sql`"window_end_at" > "window_start_at"`,
    ),

    /** Runtime must be non-negative when present. */
    availabilityResolutionRunsRuntimeCheck: check(
      "availability_resolution_runs_runtime_check",
      sql`"runtime_ms" IS NULL OR "runtime_ms" >= 0`,
    ),
  }),
);
