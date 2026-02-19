import { sql } from "drizzle-orm";
import { index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  decimal,
  integer,
  jsonb,
  pgTable,
  varchar,
  text,
} from "drizzle-orm/pg-core";
import { id, idRef, withAuditRefs } from "./_common";
import {
  durationModeEnum,
  lifecycleStatusEnum,
  serviceTypeEnum,
} from "./enums";
import { bizes } from "./bizes";
import { locations } from "./locations";
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
    /** Extension payload for non-indexed custom fields. */
    metadata: jsonb("metadata").default({}),
    /** Full audit timestamps + actor references. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    serviceGroupsBizSlugUnique: uniqueIndex("service_groups_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),
    serviceGroupsBizStatusIdx: index("service_groups_biz_status_idx").on(
      table.bizId,
      table.status,
    ),
  }),
);

/**
 * service_group_locations
 *
 * Join table for where a service group is offered.
 */
export const serviceGroupLocations = pgTable(
  "service_group_locations",
  {
    id,
    /** Tenant boundary for scoped joins and query filtering. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    /** Parent group being rolled out to locations. */
    serviceGroupId: idRef("service_group_id")
      .references(() => serviceGroups.id)
      .notNull(),
    /** Location where the group is considered available. */
    locationId: idRef("location_id")
      .references(() => locations.id)
      .notNull(),
    /** Full audit timestamps + actor references. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    serviceGroupLocationsUnique: uniqueIndex("service_group_locations_unique").on(
      table.serviceGroupId,
      table.locationId,
    ),
    serviceGroupLocationsBizLocationIdx: index(
      "service_group_locations_biz_location_idx",
    ).on(table.bizId, table.locationId),
  }),
);

/**
 * services
 *
 * Core service template catalog that powers the "what can be booked" layer.
 *
 * This table is intentionally rich so simple and advanced setup can use one model:
 * - simple: fixed duration + base price
 * - advanced: variable duration + policies + required resource types
 *
 * Relationship map:
 * - Referenced by `bookings.service_id` as the commercial + operational anchor.
 * - Referenced by `pricing_rules.service_id` and `fee_policies.service_id` for
 *   service-specific pricing behavior.
 * - Referenced by `availability_rules.service_id` when only some services are
 *   available in specific windows.
 * - Referenced by `order_items.service_id` for invoice line attribution.
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

    /** Fixed, flexible, or multi-day duration strategy. */
    durationMode: durationModeEnum("duration_mode").default("fixed").notNull(),

    /** Canonical duration for fixed-mode services. */
    durationMinutes: integer("duration_minutes").default(60).notNull(),

    /** Lower bound for variable-duration booking flows. */
    minDurationMinutes: integer("min_duration_minutes"),

    /** Upper bound for variable-duration booking flows. */
    maxDurationMinutes: integer("max_duration_minutes"),

    /** Step size (granularity) when selecting variable durations. */
    durationStepMinutes: integer("duration_step_minutes").default(15).notNull(),

    /** Provider/resource prep time inserted before the appointment. */
    bufferBeforeMinutes: integer("buffer_before_minutes").default(0).notNull(),

    /** Cleanup/turnover time inserted after the appointment. */
    bufferAfterMinutes: integer("buffer_after_minutes").default(0).notNull(),

    /** Legacy decimal retained for compatibility. */
    price: decimal("price", { precision: 10, scale: 2 }).default(sql`0`),

    /** Canonical minor-unit base price for deterministic math. */
    basePriceAmount: integer("base_price_amount").default(0).notNull(),

    /** Settlement/display currency inherited by pricing and billing layers. */
    currency: varchar("currency", { length: 3 }).default("USD"),

    /** Minimum attendees/units allowed for one booking. */
    capacityMin: integer("capacity_min").default(1).notNull(),

    /** Maximum attendees/units allowed for one booking. */
    capacityMax: integer("capacity_max").default(1).notNull(),

    /** Visibility gate for catalog publication and channel exposure. */
    visibility: varchar("visibility", { length: 20 })
      .default("public")
      .notNull(),

    /** Booking rules such as lead time, approval, and slot constraints. */
    bookingPolicy: jsonb("booking_policy").default({}),

    /** Customer/host cancellation windows and penalties. */
    cancellationPolicy: jsonb("cancellation_policy").default({}),

    /** Deposit requirement model used pre-confirmation. */
    depositPolicy: jsonb("deposit_policy").default({}),

    /** Eligibility predicates (membership, age, prerequisites, etc.). */
    eligibilityPolicy: jsonb("eligibility_policy").default({}),

    /** Resource planning hints used by assignment API. */
    requiredBookableTypes: jsonb("required_bookable_types").default([]),

    /** Nice-to-have resources; booking can proceed without them. */
    optionalBookableTypes: jsonb("optional_bookable_types").default([]),

    /** Extension bucket for non-indexed service attributes. */
    metadata: jsonb("metadata").default({}),

    /** Legacy enable flag preserved for backward compatibility. */
    isActive: boolean("is_active").default(true),

    /** Controls if service appears in customer-facing self-serve booking. */
    isOnlineBookable: boolean("is_online_bookable").default(true),

    /** Canonical lifecycle for internal/admin operations. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Full audit timestamps + actor references. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
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
    servicesBizGroupIdx: index("services_biz_group_idx").on(
      table.bizId,
      table.serviceGroupId,
    ),
  }),
);

/**
 * service_locations
 *
 * Join table for where an individual service is offered.
 * This enables per-service rollout to one or many locations.
 */
export const serviceLocations = pgTable(
  "service_locations",
  {
    id,
    /** Tenant boundary for scoped joins and query filtering. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    /** Service being made available at one or more locations. */
    serviceId: idRef("service_id")
      .references(() => services.id)
      .notNull(),
    /** Location where this service can be booked. */
    locationId: idRef("location_id")
      .references(() => locations.id)
      .notNull(),
    /** Full audit timestamps + actor references. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    serviceLocationsUnique: uniqueIndex("service_locations_unique").on(
      table.serviceId,
      table.locationId,
    ),
    serviceLocationsBizLocationIdx: index("service_locations_biz_location_idx").on(
      table.bizId,
      table.locationId,
    ),
  }),
);

export type ServiceGroup = typeof serviceGroups.$inferSelect;
export type NewServiceGroup = typeof serviceGroups.$inferInsert;

export type ServiceGroupLocation = typeof serviceGroupLocations.$inferSelect;
export type NewServiceGroupLocation = typeof serviceGroupLocations.$inferInsert;

export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;

export type ServiceLocation = typeof serviceLocations.$inferSelect;
export type NewServiceLocation = typeof serviceLocations.$inferInsert;
