import { index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  varchar,
} from "drizzle-orm/pg-core";
import {
  id,
  idRef,
  withAuditRefs,
} from "./_common";
import {
  bookableTypeEnum,
  lifecycleStatusEnum,
} from "./enums";
import { assets } from "./assets";
import { groupAccounts } from "./group_accounts";
import { locations } from "./locations";
import { bizes } from "./bizes";
import { services } from "./services";
import { users } from "./users";
import { venues } from "./venues";

/**
 * bookable_status_definitions
 *
 * Biz/location configurable status dictionary for bookables.
 *
 * Why this exists:
 * - Allows each biz (or branch) to define meaningful lifecycle states.
 * - Replaces hardcoded status assumptions in operational workflows.
 * - Supports future status-policy controls (visibility/assignment/dispatch).
 */
export const bookableStatusDefinitions = pgTable(
  "bookable_status_definitions",
  {
    id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    /** Optional branch-level override; null means biz-wide. */
    locationId: idRef("location_id").references(() => locations.id),
    /** Human readable label for admin and operations UI. */
    name: varchar("name", { length: 100 }).notNull(),
    /** Stable API/filter key (example: `active`, `on_break`, `offline`). */
    slug: varchar("slug", { length: 100 }).notNull(),
    description: varchar("description", { length: 600 }),
    /**
     * If false, this status should normally be excluded from slot finding.
     */
    isBookable: boolean("is_bookable").default(true).notNull(),
    /** UI ordering hint. */
    sortOrder: integer("sort_order").default(100).notNull(),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    bookableStatusDefinitionsBizLocationSlugUnique: uniqueIndex(
      "bookable_status_definitions_biz_location_slug_unique",
    ).on(table.bizId, table.locationId, table.slug),
    bookableStatusDefinitionsBizBookableIdx: index(
      "bookable_status_definitions_biz_bookable_idx",
    ).on(table.bizId, table.isBookable),
  }),
);

/**
 * bookables
 *
 * Polymorphic resource catalog used by scheduling + assignment.
 *
 * This is the central abstraction that lets one booking assign:
 * - a person (host)
 * - a company host (dispatch model)
 * - an asset (equipment)
 * - a venue (space)
 * - a service (for service-as-resource workflows)
 *
 * Why pointers to other tables are optional:
 * - we keep one shared table for fast filtering
 * - profile detail is split into specialized tables per type
 */
export const bookables = pgTable(
  "bookables",
  {
    id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    locationId: idRef("location_id")
      .references(() => locations.id)
      .notNull(),

    /** Discriminator used by API + assignment rules. */
    type: bookableTypeEnum("type").notNull(),

    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: varchar("description", { length: 1000 }),

    /** Default timezone for this bookable's schedule rendering. */
    timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),
    /**
     * FK to the configured status definition.
     * Nullable to support migration/backfill windows safely.
     */
    statusDefinitionId: idRef("status_definition_id").references(
      () => bookableStatusDefinitions.id,
    ),
    /** Link when this bookable is an individual host. */
    hostUserId: idRef("host_user_id").references(() => users.id),

    /** Link when this bookable is a host group backed by a group account. */
    companyGroupAccountId: idRef("company_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Link when this bookable represents existing asset/venue entities. */
    serviceId: idRef("service_id").references(() => services.id),
    assetId: idRef("asset_id").references(() => assets.id),
    venueId: idRef("venue_id").references(() => venues.id),

    /** Optional capacity used for class/group constraints. */
    capacity: integer("capacity"),

    /** Venue/resource-level overlap policy. */
    allowSimultaneousBookings: boolean("allow_simultaneous_bookings")
      .default(false)
      .notNull(),
    maxSimultaneousBookings: integer("max_simultaneous_bookings"),

    metadata: jsonb("metadata").default({}),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    bookablesOrgSlugUnique: uniqueIndex("bookables_org_slug_unique").on(
      table.bizId,
      table.slug,
    ),
    bookablesOrgTypeIdx: index("bookables_org_type_idx").on(
      table.bizId,
      table.type,
    ),
    bookablesOrgStatusDefinitionIdx: index(
      "bookables_org_status_definition_idx",
    ).on(table.bizId, table.statusDefinitionId),
  }),
);

/**
 * host_users
 *
 * Human-host extension profile.
 * Keeps HR/scheduling specific fields out of the generic `bookables` table.
 */
export const hostUsers = pgTable(
  "host_users",
  {
    id,
    /** Tenant boundary for host profile ownership and filtering. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    /** One-to-one pointer to the polymorphic bookable row. */
    bookableId: idRef("bookable_id")
      .references(() => bookables.id)
      .notNull(),
    /** Optional direct link to canonical user account. */
    userId: idRef("user_id").references(() => users.id),

    /** Optional contact email used by dispatch/admin workflows. */
    email: varchar("email", { length: 255 }),
    /** Optional contact phone used by dispatch/admin workflows. */
    phone: varchar("phone", { length: 50 }),
    /** Host biography/profile summary for customer-facing surfaces. */
    bio: varchar("bio", { length: 1500 }),

    /** Language list for matching and customer preferences. */
    languages: jsonb("languages").default([]),

    /** For mobile services dispatch. */
    travelRadiusMiles: integer("travel_radius_miles"),

    /** Workload guardrails used by scheduling service. */
    maxDailyBookings: integer("max_daily_bookings"),
    minRestBetweenBookingsMin: integer("min_rest_between_bookings_min")
      .default(0)
      .notNull(),

    /** Commission/hourly preferences, normalized later if needed. */
    paymentProfile: jsonb("payment_profile").default({}),

    /** Optional quality metrics for ranking/favorability flows. */
    rating: integer("rating"),
    reviewCount: integer("review_count").default(0).notNull(),

    /** Lifecycle status for profile visibility/eligibility. */
    status: lifecycleStatusEnum("status").default("active").notNull(),
    /** Extension payload for non-indexed custom fields. */
    metadata: jsonb("metadata").default({}),

    /** Full audit timestamps + actor references. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    hostUsersBookableUnique: uniqueIndex("host_users_bookable_unique").on(
      table.bookableId,
    ),
    hostUsersOrgStatusIdx: index("host_users_org_status_idx").on(
      table.bizId,
      table.status,
    ),
  }),
);

/**
 * host_specialty_templates
 *
 * Biz-wide configurable dictionary of host specialties.
 *
 * Purpose:
 * - Lets each biz define its own specialty vocabulary once.
 * - Prevents freeform specialty strings from drifting over time.
 * - Enables consistent filtering/reporting across hosts and bookings.
 */
export const hostSpecialtyTemplates = pgTable(
  "host_specialty_templates",
  {
    id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    /** Human label shown in admin setup and host editors. */
    name: varchar("name", { length: 120 }).notNull(),
    /** Stable API/import key, unique per biz. */
    slug: varchar("slug", { length: 120 }).notNull(),
    description: varchar("description", { length: 600 }),
    status: lifecycleStatusEnum("status").default("active").notNull(),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    hostSpecialtyTemplatesBizSlugUnique: uniqueIndex(
      "host_specialty_templates_biz_slug_unique",
    ).on(table.bizId, table.slug),
    hostSpecialtyTemplatesBizStatusIdx: index(
      "host_specialty_templates_biz_status_idx",
    ).on(table.bizId, table.status),
  }),
);

/**
 * host_user_specialties
 *
 * FK join table linking host profiles to biz-defined specialty templates.
 */
export const hostUserSpecialties = pgTable(
  "host_user_specialties",
  {
    id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    hostUserId: idRef("host_user_id")
      .references(() => hostUsers.id)
      .notNull(),
    specialtyTemplateId: idRef("specialty_template_id")
      .references(() => hostSpecialtyTemplates.id)
      .notNull(),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    hostUserSpecialtiesUnique: uniqueIndex(
      "host_user_specialties_unique",
    ).on(table.hostUserId, table.specialtyTemplateId),
    hostUserSpecialtiesBizTemplateIdx: index(
      "host_user_specialties_biz_template_idx",
    ).on(table.bizId, table.specialtyTemplateId),
    hostUserSpecialtiesBizHostIdx: index(
      "host_user_specialties_biz_host_idx",
    ).on(table.bizId, table.hostUserId),
  }),
);

/**
 * host_groups
 *
 * Company-as-host dispatch model (e.g., plumbing company).
 *
 * Connects booking demand to a group-account-backed operating team.
 */
export const hostGroups = pgTable(
  "host_groups",
  {
    id,
    /** Tenant boundary for host-group ownership and filtering. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    /** One-to-one pointer to the polymorphic bookable row. */
    bookableId: idRef("bookable_id")
      .references(() => bookables.id)
      .notNull(),
    /** Group-account identity backing this host group. */
    groupAccountId: idRef("group_account_id")
      .references(() => groupAccounts.id)
      .notNull(),

    /** Optional public or dispatch contact email. */
    email: varchar("email", { length: 255 }),
    /** Optional public or dispatch contact phone. */
    phone: varchar("phone", { length: 50 }),
    /** Optional website for provider/company profile links. */
    website: varchar("website", { length: 500 }),

    /** Determines if dispatch picks technician automatically or manually. */
    dispatchMethod: varchar("dispatch_method", { length: 50 })
      .default("manual")
      .notNull(),

    /** Operating radius for onsite/mobile service dispatch matching. */
    serviceRadiusMiles: integer("service_radius_miles"),
    /** Company-level hours reference for dispatch/scheduling policy checks. */
    businessHours: jsonb("business_hours").default({}),

    /** Lifecycle status for dispatch eligibility and visibility. */
    status: lifecycleStatusEnum("status").default("active").notNull(),
    /** Extension payload for non-indexed custom fields. */
    metadata: jsonb("metadata").default({}),

    /** Full audit timestamps + actor references. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    hostGroupsBookableUnique: uniqueIndex(
      "host_groups_bookable_unique",
    ).on(table.bookableId),
    hostGroupsOrgStatusIdx: index(
      "host_groups_org_status_idx",
    ).on(table.bizId, table.status),
  }),
);

/**
 * host_group_members
 *
 * Generic join table linking company-host profiles to users that can fulfill
 * or coordinate bookings. Replaces the old freeform `technician_pool` JSON.
 *
 * Why generic:
 * - Works for technicians, stylists, therapists, inspectors, guides, etc.
 * - Maintains referential integrity via FK to `users`.
 * - Enables role-based dispatch and filtered assignment queries.
 */
export const hostGroupMembers = pgTable(
  "host_group_members",
  {
    id,
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    hostGroupId: idRef("host_group_id")
      .references(() => hostGroups.id)
      .notNull(),
    userId: idRef("user_id")
      .references(() => users.id)
      .notNull(),
    /**
     * Generic assignment role inside this profile's operating pool.
     * Examples: `member`, `dispatcher`, `lead`, `contractor`.
     */
    role: varchar("role", { length: 50 }).default("member").notNull(),
    /**
     * Whether this user is eligible for automatic dispatch/assignment.
     * Useful when some members are coordinators only.
     */
    isAssignable: boolean("is_assignable").default(true).notNull(),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    hostGroupMembersUnique: uniqueIndex(
      "host_group_members_unique",
    ).on(table.hostGroupId, table.userId),
    hostGroupMembersBizGroupIdx: index(
      "host_group_members_biz_group_idx",
    ).on(table.bizId, table.hostGroupId),
    hostGroupMembersBizUserIdx: index(
      "host_group_members_biz_user_idx",
    ).on(table.bizId, table.userId),
  }),
);

export type Bookable = typeof bookables.$inferSelect;
export type NewBookable = typeof bookables.$inferInsert;

export type BookableStatusDefinition =
  typeof bookableStatusDefinitions.$inferSelect;
export type NewBookableStatusDefinition =
  typeof bookableStatusDefinitions.$inferInsert;

export type HostUser = typeof hostUsers.$inferSelect;
export type NewHostUser = typeof hostUsers.$inferInsert;

export type HostSpecialtyTemplate = typeof hostSpecialtyTemplates.$inferSelect;
export type NewHostSpecialtyTemplate =
  typeof hostSpecialtyTemplates.$inferInsert;

export type HostUserSpecialty = typeof hostUserSpecialties.$inferSelect;
export type NewHostUserSpecialty =
  typeof hostUserSpecialties.$inferInsert;

export type HostGroup = typeof hostGroups.$inferSelect;
export type NewHostGroup = typeof hostGroups.$inferInsert;

export type HostGroupMember = typeof hostGroupMembers.$inferSelect;
export type NewHostGroupMember = typeof hostGroupMembers.$inferInsert;

/** @deprecated Use `hostUsers`. */
export const hostProfiles = hostUsers;
/** @deprecated Use `hostUserSpecialties`. */
export const hostProfileSpecialties = hostUserSpecialties;
/** @deprecated Use `hostGroups`. */
export const companyHostProfiles = hostGroups;
/** @deprecated Use `hostGroupMembers`. */
export const companyHostProfileMembers = hostGroupMembers;

/** @deprecated Use `HostUser`. */
export type HostProfile = HostUser;
/** @deprecated Use `NewHostUser`. */
export type NewHostProfile = NewHostUser;
/** @deprecated Use `HostUserSpecialty`. */
export type HostProfileSpecialty = HostUserSpecialty;
/** @deprecated Use `NewHostUserSpecialty`. */
export type NewHostProfileSpecialty = NewHostUserSpecialty;
/** @deprecated Use `HostGroup`. */
export type CompanyHostProfile = HostGroup;
/** @deprecated Use `NewHostGroup`. */
export type NewCompanyHostProfile = NewHostGroup;
/** @deprecated Use `HostGroupMember`. */
export type CompanyHostProfileMember = HostGroupMember;
/** @deprecated Use `NewHostGroupMember`. */
export type NewCompanyHostProfileMember = NewHostGroupMember;
