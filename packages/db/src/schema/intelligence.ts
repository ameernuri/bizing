import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { locations } from "./locations";
import { auctions } from "./marketplace";
import { resources } from "./resources";
import { services } from "./services";
import { users } from "./users";
import { fulfillmentAssignments, fulfillmentUnits } from "./fulfillment";
import {
  fairnessWindowUnitEnum,
  offerComponentTargetTypeEnum,
  overtimeForecastStatusEnum,
  overtimePolicyScopeEnum,
  overtimePolicyStatusEnum,
  rankingEventTypeEnum,
  rankingModelStatusEnum,
  resourceTypeEnum,
  staffingAssignmentStatusEnum,
  staffingDemandStatusEnum,
  staffingDemandTypeEnum,
  staffingFillModeEnum,
  staffingRequirementModeEnum,
  staffingResponseModeEnum,
  staffingResponseStatusEnum,
  staffingSelectorMatchModeEnum,
  staffingSelectorTypeEnum,
} from "./enums";
import { resourceCapabilityTemplates } from "./supply";
import { subjects } from "./subjects";

/**
 * ranking_profiles
 *
 * ELI5:
 * Ranking profile defines the rules for favorability scoring.
 * Different businesses can run different ranking models.
 */
export const rankingProfiles = pgTable(
  "ranking_profiles",
  {
    /** Stable primary key. */
    id: idWithTag("ranking_profile"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Profile name shown in admin. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Stable profile slug. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Profile lifecycle status. */
    status: rankingModelStatusEnum("status").default("draft").notNull(),

    /** Optional location scoping. Null means biz-wide profile. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Optional service scoping. Null means all services. */
    serviceId: idRef("service_id").references(() => services.id),

    /** Weight model payload for event contribution calculation. */
    weights: jsonb("weights").default({}).notNull(),

    /** Additional policy knobs (cooldowns, score floors/ceilings, etc.). */
    policy: jsonb("policy").default({}),

    /** Default profile marker for scoring calls with no explicit profile id. */
    isDefault: boolean("is_default").default(false).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    rankingProfilesBizIdIdUnique: uniqueIndex("ranking_profiles_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe score/event FKs. */

    /** Unique slug per tenant. */
    rankingProfilesBizSlugUnique: uniqueIndex("ranking_profiles_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),

    /** One default profile per tenant. */
    rankingProfilesDefaultUnique: uniqueIndex("ranking_profiles_default_unique")
      .on(table.bizId)
      .where(sql`"is_default" = true AND "deleted_at" IS NULL`),

    /** Common listing path by state/scope. */
    rankingProfilesBizStatusIdx: index("ranking_profiles_biz_status_idx").on(
      table.bizId,
      table.status,
      table.locationId,
      table.serviceId,
    ),

    /** Tenant-safe FK to location. */
    rankingProfilesBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "ranking_profiles_biz_location_fk",
    }),

    /** Tenant-safe FK to service. */
    rankingProfilesBizServiceFk: foreignKey({
      columns: [table.bizId, table.serviceId],
      foreignColumns: [services.bizId, services.id],
      name: "ranking_profiles_biz_service_fk",
    }),
  }),
);

/**
 * ranking_scores
 *
 * ELI5:
 * Materialized favorability score per resource per profile.
 */
export const rankingScores = pgTable(
  "ranking_scores",
  {
    /** Stable primary key. */
    id: idWithTag("ranking_score"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Ranking profile used. */
    rankingProfileId: idRef("ranking_profile_id")
      .references(() => rankingProfiles.id)
      .notNull(),

    /** Resource being scored. */
    resourceId: idRef("resource_id")
      .references(() => resources.id)
      .notNull(),

    /** Current normalized score (0..10000 for precision). */
    score: integer("score").default(0).notNull(),

    /** Optional percentile rank value (0..10000). */
    percentile: integer("percentile"),

    /** Override marker when admin sets score manually. */
    isManualOverride: boolean("is_manual_override").default(false).notNull(),

    /** Last score recomputation timestamp. */
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),

    /** Event contribution breakdown. */
    componentBreakdown: jsonb("component_breakdown").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    rankingScoresBizIdIdUnique: uniqueIndex("ranking_scores_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One score row per profile+resource. */
    rankingScoresProfileResourceUnique: uniqueIndex(
      "ranking_scores_profile_resource_unique",
    ).on(table.rankingProfileId, table.resourceId),

    /** Common assignment ranking query path. */
    rankingScoresBizProfileScoreIdx: index("ranking_scores_biz_profile_score_idx").on(
      table.bizId,
      table.rankingProfileId,
      table.score,
    ),

    /** Tenant-safe FK to profile. */
    rankingScoresBizProfileFk: foreignKey({
      columns: [table.bizId, table.rankingProfileId],
      foreignColumns: [rankingProfiles.bizId, rankingProfiles.id],
      name: "ranking_scores_biz_profile_fk",
    }),

    /** Tenant-safe FK to resource. */
    rankingScoresBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "ranking_scores_biz_resource_fk",
    }),

    /** Score bounds for deterministic sorting semantics. */
    rankingScoresBoundsCheck: check(
      "ranking_scores_bounds_check",
      sql`
      "score" >= 0
      AND ("percentile" IS NULL OR ("percentile" >= 0 AND "percentile" <= 10000))
      `,
    ),
  }),
);

/**
 * ranking_events
 *
 * ELI5:
 * Append-style events that influence ranking scores.
 */
export const rankingEvents = pgTable(
  "ranking_events",
  {
    /** Stable primary key. */
    id: idWithTag("ranking_event"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Profile this event applies to. */
    rankingProfileId: idRef("ranking_profile_id")
      .references(() => rankingProfiles.id)
      .notNull(),

    /** Resource affected by event. */
    resourceId: idRef("resource_id")
      .references(() => resources.id)
      .notNull(),

    /** Event type. */
    eventType: rankingEventTypeEnum("event_type").notNull(),

    /** Signed contribution delta in score points. */
    scoreDelta: integer("score_delta").notNull(),

    /** Event timestamp. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional source reference id (booking, review, etc.). */
    sourceRef: varchar("source_ref", { length: 200 }),

    /** Structured event context payload. */
    details: jsonb("details").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    rankingEventsBizIdIdUnique: uniqueIndex("ranking_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Timeline path for recompute workers. */
    rankingEventsBizProfileOccurredIdx: index("ranking_events_biz_profile_occurred_idx").on(
      table.bizId,
      table.rankingProfileId,
      table.occurredAt,
    ),

    /** Tenant-safe FK to profile. */
    rankingEventsBizProfileFk: foreignKey({
      columns: [table.bizId, table.rankingProfileId],
      foreignColumns: [rankingProfiles.bizId, rankingProfiles.id],
      name: "ranking_events_biz_profile_fk",
    }),

    /** Tenant-safe FK to resource. */
    rankingEventsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "ranking_events_biz_resource_fk",
    }),
  }),
);

/**
 * overtime_policies
 *
 * ELI5:
 * Policy rows describe overtime thresholds and mitigation strategy scope.
 */
export const overtimePolicies = pgTable(
  "overtime_policies",
  {
    /** Stable primary key. */
    id: idWithTag("overtime_policy"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Policy name. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Scope discriminator. */
    scope: overtimePolicyScopeEnum("scope").notNull(),

    /** Optional location scope payload. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Optional resource-type scope payload. */
    resourceType: offerComponentTargetTypeEnum("resource_type"),

    /** Optional direct resource scope payload. */
    resourceId: idRef("resource_id").references(() => resources.id),

    /** Policy lifecycle state. */
    status: overtimePolicyStatusEnum("status").default("active").notNull(),

    /** Daily threshold in minutes before overtime starts. */
    dailyThresholdMin: integer("daily_threshold_min").default(480).notNull(),

    /** Weekly threshold in minutes before overtime starts. */
    weeklyThresholdMin: integer("weekly_threshold_min").default(2400).notNull(),

    /** Cost multiplier in basis points after threshold. */
    overtimeRateBps: integer("overtime_rate_bps").default(15000).notNull(),

    /** Mitigation strategy settings (suggestion rules, hard-block flags). */
    mitigationPolicy: jsonb("mitigation_policy").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    overtimePoliciesBizIdIdUnique: uniqueIndex("overtime_policies_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique target for forecast rows. */

    /** Common policy listing path. */
    overtimePoliciesBizStatusScopeIdx: index("overtime_policies_biz_status_scope_idx").on(
      table.bizId,
      table.status,
      table.scope,
    ),

    /** Tenant-safe FK to location. */
    overtimePoliciesBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "overtime_policies_biz_location_fk",
    }),

    /** Tenant-safe FK to resource. */
    overtimePoliciesBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "overtime_policies_biz_resource_fk",
    }),

    /** Scope payload shape invariant. */
    overtimePoliciesScopeShapeCheck: check(
      "overtime_policies_scope_shape_check",
      sql`
      (
        "scope" = 'biz'
        AND "location_id" IS NULL
        AND "resource_type" IS NULL
        AND "resource_id" IS NULL
      ) OR (
        "scope" = 'location'
        AND "location_id" IS NOT NULL
        AND "resource_type" IS NULL
        AND "resource_id" IS NULL
      ) OR (
        "scope" = 'resource_type'
        AND "location_id" IS NULL
        AND "resource_type" IS NOT NULL
        AND "resource_id" IS NULL
      ) OR (
        "scope" = 'resource'
        AND "location_id" IS NULL
        AND "resource_type" IS NULL
        AND "resource_id" IS NOT NULL
      )
      `,
    ),

    /** Threshold and multiplier sanity checks. */
    overtimePoliciesValuesCheck: check(
      "overtime_policies_values_check",
      sql`
      "daily_threshold_min" > 0
      AND "weekly_threshold_min" > 0
      AND "overtime_rate_bps" >= 10000
      `,
    ),
  }),
);

/**
 * overtime_forecasts
 *
 * ELI5:
 * Forecast rows store projected overtime risk for one resource+date.
 */
export const overtimeForecasts = pgTable(
  "overtime_forecasts",
  {
    /** Stable primary key. */
    id: idWithTag("overtime_forecast"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Policy used for this forecast. */
    overtimePolicyId: idRef("overtime_policy_id")
      .references(() => overtimePolicies.id)
      .notNull(),

    /** Resource being evaluated. */
    resourceId: idRef("resource_id")
      .references(() => resources.id)
      .notNull(),

    /** Forecast date. */
    forecastDate: date("forecast_date").notNull(),

    /** Forecast status. */
    status: overtimeForecastStatusEnum("status").default("projected").notNull(),

    /** Scheduled minutes for this resource on forecast date. */
    scheduledMinutes: integer("scheduled_minutes").default(0).notNull(),

    /** Projected overtime minutes beyond threshold. */
    projectedOvertimeMinutes: integer("projected_overtime_minutes")
      .default(0)
      .notNull(),

    /** Estimated overtime cost in minor units. */
    projectedOvertimeCostMinor: integer("projected_overtime_cost_minor")
      .default(0)
      .notNull(),

    /** Suggested mitigation summary. */
    mitigationSuggestion: varchar("mitigation_suggestion", { length: 600 }),

    /** Structured forecast feature payload for explainability. */
    featureSnapshot: jsonb("feature_snapshot").default({}),

    /** Forecast generation timestamp. */
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    overtimeForecastsBizIdIdUnique: uniqueIndex("overtime_forecasts_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One forecast row per policy+resource+date. */
    overtimeForecastsUnique: uniqueIndex("overtime_forecasts_unique").on(
      table.overtimePolicyId,
      table.resourceId,
      table.forecastDate,
    ),

    /** Common risk-board query path. */
    overtimeForecastsBizDateStatusIdx: index("overtime_forecasts_biz_date_status_idx").on(
      table.bizId,
      table.forecastDate,
      table.status,
    ),

    /** Tenant-safe FK to policy. */
    overtimeForecastsBizPolicyFk: foreignKey({
      columns: [table.bizId, table.overtimePolicyId],
      foreignColumns: [overtimePolicies.bizId, overtimePolicies.id],
      name: "overtime_forecasts_biz_policy_fk",
    }),

    /** Tenant-safe FK to resource. */
    overtimeForecastsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "overtime_forecasts_biz_resource_fk",
    }),

    /** Forecast values must be non-negative. */
    overtimeForecastsValuesCheck: check(
      "overtime_forecasts_values_check",
      sql`
      "scheduled_minutes" >= 0
      AND "projected_overtime_minutes" >= 0
      AND "projected_overtime_cost_minor" >= 0
      `,
    ),
  }),
);

/**
 * staffing_pools
 *
 * ELI5:
 * A staffing pool is a reusable candidate universe for internal staffing
 * demands (open shifts, replacements, on-call coverage, overtime coverage).
 *
 * Why this evolved from "substitution pools":
 * - replacement is only one staffing use case,
 * - the same candidate-management and fairness primitives also power
 *   first-come claims, invite/accept, and reverse-bid workflows.
 */
export const staffingPools = pgTable(
  "staffing_pools",
  {
    /** Stable primary key. */
    id: idWithTag("staffing_pool"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human pool name. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Stable pool slug for APIs/admin routes. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Optional location scope. Null means multi-location candidate pool. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Resource class this pool primarily covers. */
    targetResourceType: resourceTypeEnum("target_resource_type").notNull(),

    /** Active toggle. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Fairness accounting window size value. */
    fairnessWindowValue: integer("fairness_window_value").default(1).notNull(),

    /** Fairness accounting window unit. */
    fairnessWindowUnit: fairnessWindowUnitEnum("fairness_window_unit")
      .default("week")
      .notNull(),

    /** Candidate selection/tie-break policy configuration. */
    selectionPolicy: jsonb("selection_policy").default({}),

    /** Claim/bidding governance knobs for this pool. */
    claimPolicy: jsonb("claim_policy").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    staffingPoolsBizIdIdUnique: uniqueIndex("staffing_pools_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe downstream references. */

    /** Unique slug per tenant. */
    staffingPoolsBizSlugUnique: uniqueIndex("staffing_pools_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),

    /** Common lookup by type/location. */
    staffingPoolsBizTypeLocationIdx: index(
      "staffing_pools_biz_type_location_idx",
    ).on(table.bizId, table.targetResourceType, table.locationId, table.isActive),

    /** Tenant-safe FK to location. */
    staffingPoolsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "staffing_pools_biz_location_fk",
    }),

    /** Fairness window size must be positive. */
    staffingPoolsWindowCheck: check(
      "staffing_pools_window_check",
      sql`"fairness_window_value" > 0`,
    ),
  }),
);

/**
 * staffing_pool_members
 *
 * ELI5:
 * Candidate resources enrolled in one staffing pool.
 */
export const staffingPoolMembers = pgTable(
  "staffing_pool_members",
  {
    /** Stable primary key. */
    id: idWithTag("staffing_pool_member"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent pool. */
    staffingPoolId: idRef("staffing_pool_id")
      .references(() => staffingPools.id)
      .notNull(),

    /** Candidate resource. */
    resourceId: idRef("resource_id")
      .references(() => resources.id)
      .notNull(),

    /** Optional capability filter narrowing this membership intent. */
    capabilityTemplateId: idRef("capability_template_id").references(
      () => resourceCapabilityTemplates.id,
    ),

    /** Optional priority score for candidate ordering. */
    priorityScore: integer("priority_score").default(100).notNull(),

    /** Optional additional weight for weighted/fair-share selection. */
    weight: integer("weight").default(1).notNull(),

    /** Membership toggle. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Last assignment timestamp used in fairness balancing heuristics. */
    lastAssignedAt: timestamp("last_assigned_at", { withTimezone: true }),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    staffingPoolMembersBizIdIdUnique: uniqueIndex("staffing_pool_members_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Prevent duplicate membership rows for same pool/resource. */
    staffingPoolMembersUnique: uniqueIndex("staffing_pool_members_unique").on(
      table.staffingPoolId,
      table.resourceId,
    ),

    /** Candidate lookup path for staffing engines. */
    staffingPoolMembersBizPoolActiveIdx: index(
      "staffing_pool_members_biz_pool_active_idx",
    ).on(table.bizId, table.staffingPoolId, table.isActive, table.priorityScore),

    /** Tenant-safe FK to pool. */
    staffingPoolMembersBizPoolFk: foreignKey({
      columns: [table.bizId, table.staffingPoolId],
      foreignColumns: [staffingPools.bizId, staffingPools.id],
      name: "staffing_pool_members_biz_pool_fk",
    }),

    /** Tenant-safe FK to resource. */
    staffingPoolMembersBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "staffing_pool_members_biz_resource_fk",
    }),

    /** Tenant-safe FK to capability template. */
    staffingPoolMembersBizCapabilityFk: foreignKey({
      columns: [table.bizId, table.capabilityTemplateId],
      foreignColumns: [resourceCapabilityTemplates.bizId, resourceCapabilityTemplates.id],
      name: "staffing_pool_members_biz_capability_fk",
    }),

    /** Numeric values should be positive. */
    staffingPoolMembersValuesCheck: check(
      "staffing_pool_members_values_check",
      sql`"weight" > 0`,
    ),
  }),
);

/**
 * staffing_demands
 *
 * ELI5:
 * One row = one posted staffing need for a time window.
 *
 * Examples:
 * - "Front desk coverage 8am-12pm (open shift)"
 * - "Replace absent technician for Unit U"
 * - "On-call overtime slot tonight"
 *
 * This is the generalized evolution of substitution requests.
 */
export const staffingDemands = pgTable(
  "staffing_demands",
  {
    /** Stable primary key. */
    id: idWithTag("staffing_demand"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional pool used as baseline candidate universe. */
    staffingPoolId: idRef("staffing_pool_id").references(() => staffingPools.id),

    /** Business intent class for this demand. */
    demandType: staffingDemandTypeEnum("demand_type")
      .default("open_shift")
      .notNull(),

    /** Fulfillment strategy for this demand. */
    fillMode: staffingFillModeEnum("fill_mode").default("fcfs_claim").notNull(),

    /** Lifecycle status. */
    status: staffingDemandStatusEnum("status").default("open").notNull(),

    /** Human title shown in internal staffing board UI. */
    title: varchar("title", { length: 220 }).notNull(),

    /** Optional detailed description/instructions. */
    description: varchar("description", { length: 1000 }),

    /** Optional location scope. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Optional preferred resource class for this demand. */
    targetResourceType: resourceTypeEnum("target_resource_type"),

    /** Needed assignment count. */
    requiredCount: integer("required_count").default(1).notNull(),

    /** Already-filled assignment count. */
    filledCount: integer("filled_count").default(0).notNull(),

    /** Demand window start. */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),

    /** Demand window end. */
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

    /** Optional claim window start for FCFS flows. */
    claimOpensAt: timestamp("claim_opens_at", { withTimezone: true }),

    /** Optional claim window end for FCFS flows. */
    claimClosesAt: timestamp("claim_closes_at", { withTimezone: true }),

    /** Optional bid window start for auction fill mode. */
    auctionOpensAt: timestamp("auction_opens_at", { withTimezone: true }),

    /** Optional bid window end for auction fill mode. */
    auctionClosesAt: timestamp("auction_closes_at", { withTimezone: true }),

    /**
     * Optional canonical auction pointer when `fill_mode=auction`.
     *
     * Why this exists:
     * - `staffing_demands` drives internal supply intent and requirements.
     * - `auctions` models the bidding lifecycle and bid ledger.
     * Linking them makes auction staffing fully first-class and traceable.
     */
    auctionId: idRef("auction_id").references(() => auctions.id),

    /** Currency used by optional rate terms and bid values. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Optional baseline hourly rate in minor units. */
    baseRateMinor: integer("base_rate_minor"),

    /** Optional maximum approved hourly rate in minor units. */
    maxRateMinor: integer("max_rate_minor"),

    /** Optional source fulfillment assignment when demand is a replacement. */
    fulfillmentAssignmentId: idRef("fulfillment_assignment_id").references(
      () => fulfillmentAssignments.id,
    ),

    /** Optional source fulfillment unit context. */
    fulfillmentUnitId: idRef("fulfillment_unit_id").references(
      () => fulfillmentUnits.id,
    ),

    /** Optional resource being replaced. */
    fromResourceId: idRef("from_resource_id").references(() => resources.id),

    /** Optional selected resource when resolved to one winner. */
    assignedResourceId: idRef("assigned_resource_id").references(
      () => resources.id,
    ),

    /** Optional requester actor. */
    requestedByUserId: idRef("requested_by_user_id").references(() => users.id),

    /**
     * Optional generic source pointer.
     * Use this for plugin/internal modules that post staffing demand from a
     * domain object not normalized with dedicated FK columns yet.
     */
    sourceType: varchar("source_type", { length: 100 }),
    sourceRefId: varchar("source_ref_id", { length: 140 }),

    /** Matching and award policy payload. */
    policy: jsonb("policy").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    staffingDemandsBizIdIdUnique: uniqueIndex("staffing_demands_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe downstream references. */

    /** Open demand board query path. */
    staffingDemandsBizStatusStartIdx: index("staffing_demands_biz_status_start_idx").on(
      table.bizId,
      table.status,
      table.startsAt,
    ),

    /** Fill strategy + timeline analytics path. */
    staffingDemandsBizFillModeStartIdx: index(
      "staffing_demands_biz_fill_mode_start_idx",
    ).on(table.bizId, table.fillMode, table.startsAt),

    /** Auction-mode board/settlement lookup path. */
    staffingDemandsBizAuctionIdx: index("staffing_demands_biz_auction_idx").on(
      table.bizId,
      table.auctionId,
    ),

    /** One linked demand per auction row (optional). */
    staffingDemandsAuctionUnique: uniqueIndex("staffing_demands_auction_unique")
      .on(table.auctionId)
      .where(sql`"auction_id" IS NOT NULL AND "deleted_at" IS NULL`),

    /** Common replacement lookup path by source assignment. */
    staffingDemandsBizSourceAssignmentIdx: index(
      "staffing_demands_biz_source_assignment_idx",
    ).on(table.bizId, table.fulfillmentAssignmentId),

    /** Tenant-safe FK to optional pool. */
    staffingDemandsBizPoolFk: foreignKey({
      columns: [table.bizId, table.staffingPoolId],
      foreignColumns: [staffingPools.bizId, staffingPools.id],
      name: "staffing_demands_biz_pool_fk",
    }),

    /** Tenant-safe FK to optional location. */
    staffingDemandsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "staffing_demands_biz_location_fk",
    }),

    /** Tenant-safe FK to optional fulfillment assignment source. */
    staffingDemandsBizAssignmentFk: foreignKey({
      columns: [table.bizId, table.fulfillmentAssignmentId],
      foreignColumns: [fulfillmentAssignments.bizId, fulfillmentAssignments.id],
      name: "staffing_demands_biz_assignment_fk",
    }),

    /** Tenant-safe FK to optional linked auction lifecycle. */
    staffingDemandsBizAuctionFk: foreignKey({
      columns: [table.bizId, table.auctionId],
      foreignColumns: [auctions.bizId, auctions.id],
      name: "staffing_demands_biz_auction_fk",
    }),

    /** Tenant-safe FK to optional fulfillment unit source. */
    staffingDemandsBizUnitFk: foreignKey({
      columns: [table.bizId, table.fulfillmentUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "staffing_demands_biz_unit_fk",
    }),

    /** Tenant-safe FK to optional source resource. */
    staffingDemandsBizFromResourceFk: foreignKey({
      columns: [table.bizId, table.fromResourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "staffing_demands_biz_from_resource_fk",
    }),

    /** Tenant-safe FK to optional selected resource. */
    staffingDemandsBizAssignedResourceFk: foreignKey({
      columns: [table.bizId, table.assignedResourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "staffing_demands_biz_assigned_resource_fk",
    }),

    /** Count, window, and rate sanity checks. */
    staffingDemandsBoundsCheck: check(
      "staffing_demands_bounds_check",
      sql`
      "required_count" > 0
      AND "filled_count" >= 0
      AND "filled_count" <= "required_count"
      AND "ends_at" > "starts_at"
      AND ("base_rate_minor" IS NULL OR "base_rate_minor" >= 0)
      AND ("max_rate_minor" IS NULL OR "max_rate_minor" >= 0)
      AND ("base_rate_minor" IS NULL OR "max_rate_minor" IS NULL OR "max_rate_minor" >= "base_rate_minor")
      `,
    ),

    /** Claim and auction windows must be ordered when present. */
    staffingDemandsWindowCheck: check(
      "staffing_demands_window_check",
      sql`
      ("claim_opens_at" IS NULL OR "claim_closes_at" IS NULL OR "claim_closes_at" > "claim_opens_at")
      AND ("auction_opens_at" IS NULL OR "auction_closes_at" IS NULL OR "auction_closes_at" > "auction_opens_at")
      `,
    ),

    /** Source pointer should be fully-null or fully-populated. */
    staffingDemandsSourcePairCheck: check(
      "staffing_demands_source_pair_check",
      sql`
      (
        "source_type" IS NULL
        AND "source_ref_id" IS NULL
      ) OR (
        "source_type" IS NOT NULL
        AND "source_ref_id" IS NOT NULL
      )
      `,
    ),

    /** Fill-mode payload shape guard for auction mode. */
    staffingDemandsFillModeShapeCheck: check(
      "staffing_demands_fill_mode_shape_check",
      sql`
      (
        "fill_mode" = 'auction'
        AND "auction_id" IS NOT NULL
      ) OR (
        "fill_mode" <> 'auction'
        AND "auction_id" IS NULL
      )
      `,
    ),

    /** Source and assigned resources should not be the same row. */
    staffingDemandsResourceDifferenceCheck: check(
      "staffing_demands_resource_difference_check",
      sql`"from_resource_id" IS NULL OR "assigned_resource_id" IS NULL OR "from_resource_id" <> "assigned_resource_id"`,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    staffingDemandsCurrencyFormatCheck: check(
      "staffing_demands_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * staffing_demand_requirements
 *
 * ELI5:
 * Requirement groups define what kind of resources are needed for one demand.
 * Selectors below provide the actual candidate matching rules.
 */
export const staffingDemandRequirements = pgTable(
  "staffing_demand_requirements",
  {
    /** Stable primary key. */
    id: idWithTag("staffing_requirement"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent staffing demand. */
    staffingDemandId: idRef("staffing_demand_id")
      .references(() => staffingDemands.id)
      .notNull(),

    /** Human label for this requirement block. */
    name: varchar("name", { length: 180 }).notNull(),

    /** Stable slug for API payloads/import. */
    slug: varchar("slug", { length: 120 }).notNull(),

    /** Resource class this block applies to. */
    targetResourceType: resourceTypeEnum("target_resource_type").notNull(),

    /** Required vs optional intent. */
    requirementMode: staffingRequirementModeEnum("requirement_mode")
      .default("required")
      .notNull(),

    /** Minimum count required for this block. */
    minQuantity: integer("min_quantity").default(1).notNull(),

    /** Optional maximum count allowed for this block. */
    maxQuantity: integer("max_quantity"),

    /** Selector aggregation mode for this block. */
    selectorMatchMode: staffingSelectorMatchModeEnum("selector_match_mode")
      .default("any")
      .notNull(),

    /** Allows candidate substitution among valid selector matches. */
    allowSubstitution: boolean("allow_substitution").default(true).notNull(),

    /** UI/evaluation ordering hint. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Optional notes for operators. */
    description: varchar("description", { length: 700 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe selector FKs. */
    staffingDemandRequirementsBizIdIdUnique: uniqueIndex(
      "staffing_demand_requirements_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One slug per demand to keep payloads deterministic. */
    staffingDemandRequirementsUnique: uniqueIndex(
      "staffing_demand_requirements_unique",
    ).on(table.staffingDemandId, table.slug),

    /** Common evaluation path by demand + order. */
    staffingDemandRequirementsBizDemandSortIdx: index(
      "staffing_demand_requirements_biz_demand_sort_idx",
    ).on(table.bizId, table.staffingDemandId, table.sortOrder),

    /** Tenant-safe FK to parent demand. */
    staffingDemandRequirementsBizDemandFk: foreignKey({
      columns: [table.bizId, table.staffingDemandId],
      foreignColumns: [staffingDemands.bizId, staffingDemands.id],
      name: "staffing_demand_requirements_biz_demand_fk",
    }),

    /** Quantity and ordering bounds. */
    staffingDemandRequirementsBoundsCheck: check(
      "staffing_demand_requirements_bounds_check",
      sql`
      "min_quantity" >= 0
      AND ("max_quantity" IS NULL OR "max_quantity" >= "min_quantity")
      AND "sort_order" >= 0
      `,
    ),
  }),
);

/**
 * staffing_demand_selectors
 *
 * ELI5:
 * Selector rows describe how candidates are matched for each requirement group.
 *
 * This is intentionally generic and mirrors selector patterns in other domains,
 * so staffing remains extensible without schema forks.
 */
export const staffingDemandSelectors = pgTable(
  "staffing_demand_selectors",
  {
    /** Stable primary key. */
    id: idWithTag("staffing_selector"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent requirement group. */
    staffingDemandRequirementId: idRef("staffing_demand_requirement_id")
      .references(() => staffingDemandRequirements.id)
      .notNull(),

    /** Selector payload shape discriminator. */
    selectorType: staffingSelectorTypeEnum("selector_type").notNull(),

    /** Include/exclude toggle for advanced matching logic. */
    isIncluded: boolean("is_included").default(true).notNull(),

    /** Payload for `selector_type=resource`. */
    resourceId: idRef("resource_id").references(() => resources.id),

    /** Payload for `selector_type=resource_type`. */
    resourceType: resourceTypeEnum("resource_type"),

    /** Payload for `selector_type=capability_template`. */
    capabilityTemplateId: idRef("capability_template_id").references(
      () => resourceCapabilityTemplates.id,
    ),

    /** Payload for `selector_type=location`. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Payload for `selector_type=custom_subject`. */
    subjectType: varchar("subject_type", { length: 80 }),
    subjectId: varchar("subject_id", { length: 140 }),

    /** UI/evaluation order hint. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Optional operator notes. */
    description: varchar("description", { length: 700 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    staffingDemandSelectorsBizIdIdUnique: uniqueIndex("staffing_demand_selectors_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common expansion path from one requirement group. */
    staffingDemandSelectorsBizRequirementSortIdx: index(
      "staffing_demand_selectors_biz_requirement_sort_idx",
    ).on(table.bizId, table.staffingDemandRequirementId, table.sortOrder),

    /** Lookup by selector resource payload. */
    staffingDemandSelectorsBizResourceIdx: index(
      "staffing_demand_selectors_biz_resource_idx",
    ).on(table.bizId, table.resourceId),

    /** Lookup by selector capability payload. */
    staffingDemandSelectorsBizCapabilityIdx: index(
      "staffing_demand_selectors_biz_capability_idx",
    ).on(table.bizId, table.capabilityTemplateId),

    /** Lookup by selector custom subject payload. */
    staffingDemandSelectorsBizSubjectIdx: index(
      "staffing_demand_selectors_biz_subject_idx",
    ).on(table.bizId, table.subjectType, table.subjectId),

    /** Tenant-safe FK to parent requirement group. */
    staffingDemandSelectorsBizRequirementFk: foreignKey({
      columns: [table.bizId, table.staffingDemandRequirementId],
      foreignColumns: [staffingDemandRequirements.bizId, staffingDemandRequirements.id],
      name: "staffing_demand_selectors_biz_requirement_fk",
    }),

    /** Tenant-safe FK to optional resource payload. */
    staffingDemandSelectorsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "staffing_demand_selectors_biz_resource_fk",
    }),

    /** Tenant-safe FK to optional capability payload. */
    staffingDemandSelectorsBizCapabilityFk: foreignKey({
      columns: [table.bizId, table.capabilityTemplateId],
      foreignColumns: [resourceCapabilityTemplates.bizId, resourceCapabilityTemplates.id],
      name: "staffing_demand_selectors_biz_capability_fk",
    }),

    /** Tenant-safe FK to optional location payload. */
    staffingDemandSelectorsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "staffing_demand_selectors_biz_location_fk",
    }),

    /** Tenant-safe FK to optional custom-subject payload. */
    staffingDemandSelectorsBizSubjectFk: foreignKey({
      columns: [table.bizId, table.subjectType, table.subjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "staffing_demand_selectors_biz_subject_fk",
    }),

    /** Subject payload should be fully-null or fully-populated. */
    staffingDemandSelectorsSubjectPairCheck: check(
      "staffing_demand_selectors_subject_pair_check",
      sql`
      (
        "subject_type" IS NULL
        AND "subject_id" IS NULL
      ) OR (
        "subject_type" IS NOT NULL
        AND "subject_id" IS NOT NULL
      )
      `,
    ),

    /** Sort order must be non-negative. */
    staffingDemandSelectorsSortOrderCheck: check(
      "staffing_demand_selectors_sort_order_check",
      sql`"sort_order" >= 0`,
    ),

    /** Selector payload shape must match selector type exactly. */
    staffingDemandSelectorsShapeCheck: check(
      "staffing_demand_selectors_shape_check",
      sql`
      (
        "selector_type" = 'any'
        AND "resource_id" IS NULL
        AND "resource_type" IS NULL
        AND "capability_template_id" IS NULL
        AND "location_id" IS NULL
        AND "subject_type" IS NULL
        AND "subject_id" IS NULL
      ) OR (
        "selector_type" = 'resource'
        AND "resource_id" IS NOT NULL
        AND "resource_type" IS NULL
        AND "capability_template_id" IS NULL
        AND "location_id" IS NULL
        AND "subject_type" IS NULL
        AND "subject_id" IS NULL
      ) OR (
        "selector_type" = 'resource_type'
        AND "resource_id" IS NULL
        AND "resource_type" IS NOT NULL
        AND "capability_template_id" IS NULL
        AND "location_id" IS NULL
        AND "subject_type" IS NULL
        AND "subject_id" IS NULL
      ) OR (
        "selector_type" = 'capability_template'
        AND "resource_id" IS NULL
        AND "resource_type" IS NULL
        AND "capability_template_id" IS NOT NULL
        AND "location_id" IS NULL
        AND "subject_type" IS NULL
        AND "subject_id" IS NULL
      ) OR (
        "selector_type" = 'location'
        AND "resource_id" IS NULL
        AND "resource_type" IS NULL
        AND "capability_template_id" IS NULL
        AND "location_id" IS NOT NULL
        AND "subject_type" IS NULL
        AND "subject_id" IS NULL
      ) OR (
        "selector_type" = 'custom_subject'
        AND "resource_id" IS NULL
        AND "resource_type" IS NULL
        AND "capability_template_id" IS NULL
        AND "location_id" IS NULL
        AND "subject_type" IS NOT NULL
        AND "subject_id" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * staffing_responses
 *
 * ELI5:
 * A response is how a candidate reacts to one staffing demand:
 * - invite accept/decline,
 * - FCFS claim,
 * - bid (reverse-booking internal job-board style).
 */
export const staffingResponses = pgTable(
  "staffing_responses",
  {
    /** Stable primary key. */
    id: idWithTag("staffing_response"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent staffing demand. */
    staffingDemandId: idRef("staffing_demand_id")
      .references(() => staffingDemands.id)
      .notNull(),

    /** Candidate resource that responded. */
    candidateResourceId: idRef("candidate_resource_id")
      .references(() => resources.id)
      .notNull(),

    /** Response mechanism mode. */
    responseMode: staffingResponseModeEnum("response_mode").notNull(),

    /** Response lifecycle status. */
    status: staffingResponseStatusEnum("status").default("pending").notNull(),

    /** Rank at response time (for deterministic tie-breaks). */
    rankOrder: integer("rank_order").default(1).notNull(),

    /** Offer/visibility timestamp. */
    offeredAt: timestamp("offered_at", { withTimezone: true }).defaultNow().notNull(),

    /** Candidate response timestamp. */
    respondedAt: timestamp("responded_at", { withTimezone: true }),

    /** Optional candidate proposed hourly rate (minor units). */
    proposedHourlyRateMinor: integer("proposed_hourly_rate_minor"),

    /** Optional candidate proposed total amount (minor units). */
    proposedTotalMinor: integer("proposed_total_minor"),

    /** Currency for proposal amounts. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Optional response reason/notes. */
    responseReason: varchar("response_reason", { length: 600 }),

    /** Optional actor pointer when response was entered by proxy. */
    respondedByUserId: idRef("responded_by_user_id").references(() => users.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe assignment FKs. */
    staffingResponsesBizIdIdUnique: uniqueIndex(
      "staffing_responses_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Primary board path by demand and response state. */
    staffingResponsesBizDemandStatusIdx: index(
      "staffing_responses_biz_demand_status_idx",
    ).on(table.bizId, table.staffingDemandId, table.status, table.offeredAt),

    /** Candidate response history path. */
    staffingResponsesBizCandidateStatusIdx: index(
      "staffing_responses_biz_candidate_status_idx",
    ).on(table.bizId, table.candidateResourceId, table.status, table.offeredAt),

    /** Prevent duplicate non-bid rows for one candidate in one demand. */
    staffingResponsesUniqueNonBid: uniqueIndex("staffing_responses_unique_non_bid")
      .on(table.staffingDemandId, table.candidateResourceId, table.responseMode)
      .where(sql`"response_mode" <> 'bid' AND "deleted_at" IS NULL`),

    /** Tenant-safe FK to parent demand. */
    staffingResponsesBizDemandFk: foreignKey({
      columns: [table.bizId, table.staffingDemandId],
      foreignColumns: [staffingDemands.bizId, staffingDemands.id],
      name: "staffing_responses_biz_demand_fk",
    }),

    /** Tenant-safe FK to candidate resource. */
    staffingResponsesBizCandidateFk: foreignKey({
      columns: [table.bizId, table.candidateResourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "staffing_responses_biz_candidate_fk",
    }),

    /** Rank and timeline sanity checks. */
    staffingResponsesBoundsAndTimelineCheck: check(
      "staffing_responses_bounds_and_timeline_check",
      sql`
      "rank_order" >= 1
      AND ("responded_at" IS NULL OR "responded_at" >= "offered_at")
      AND ("proposed_hourly_rate_minor" IS NULL OR "proposed_hourly_rate_minor" >= 0)
      AND ("proposed_total_minor" IS NULL OR "proposed_total_minor" >= 0)
      `,
    ),

    /** Keep proposal payload deterministic by response mode. */
    staffingResponsesProposalShapeCheck: check(
      "staffing_responses_proposal_shape_check",
      sql`
      (
        "response_mode" = 'bid'
        AND ("proposed_hourly_rate_minor" IS NOT NULL OR "proposed_total_minor" IS NOT NULL)
      ) OR (
        "response_mode" IN ('invite', 'claim')
        AND "proposed_hourly_rate_minor" IS NULL
        AND "proposed_total_minor" IS NULL
      )
      `,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    staffingResponsesCurrencyFormatCheck: check(
      "staffing_responses_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * staffing_assignments
 *
 * ELI5:
 * One assignment is the concrete "who is posted to this demand window" fact.
 *
 * Why this table exists:
 * - demand/response covers market-style matching lifecycle,
 * - assignment captures final operational staffing truth and timeline,
 * - this row is the clean join point for timesheets and compensation lineage.
 */
export const staffingAssignments = pgTable(
  "staffing_assignments",
  {
    /** Stable primary key. */
    id: idWithTag("staffing_assignment"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent staffing demand. */
    staffingDemandId: idRef("staffing_demand_id")
      .references(() => staffingDemands.id)
      .notNull(),

    /** Assigned resource. */
    resourceId: idRef("resource_id")
      .references(() => resources.id)
      .notNull(),

    /** Optional originating candidate response. */
    staffingResponseId: idRef("staffing_response_id").references(
      () => staffingResponses.id,
    ),

    /** Optional linked fulfillment assignment for execution sync. */
    fulfillmentAssignmentId: idRef("fulfillment_assignment_id").references(
      () => fulfillmentAssignments.id,
    ),

    /** Optional linked fulfillment unit for execution sync. */
    fulfillmentUnitId: idRef("fulfillment_unit_id").references(
      () => fulfillmentUnits.id,
    ),

    /** Staffing assignment lifecycle state. */
    status: staffingAssignmentStatusEnum("status").default("planned").notNull(),

    /** Planned assignment start. */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),

    /** Planned assignment end. */
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

    /** Primary role marker when multiple assignees satisfy one demand. */
    isPrimary: boolean("is_primary").default(false).notNull(),

    /** Optional accepted/contracted hourly rate in minor units. */
    compensationRateMinor: integer("compensation_rate_minor"),

    /** Currency for compensation rate terms. */
    compensationCurrency: varchar("compensation_currency", { length: 3 })
      .default("USD")
      .notNull(),

    /** Optional actor who confirmed this assignment. */
    assignedByUserId: idRef("assigned_by_user_id").references(() => users.id),

    /** Assignment confirmation timestamp. */
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe downstream references. */
    staffingAssignmentsBizIdIdUnique: uniqueIndex(
      "staffing_assignments_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One response can produce at most one assignment. */
    staffingAssignmentsResponseUnique: uniqueIndex("staffing_assignments_response_unique")
      .on(table.staffingResponseId)
      .where(sql`"staffing_response_id" IS NOT NULL`),

    /** Board path by demand and lifecycle status. */
    staffingAssignmentsBizDemandStatusIdx: index(
      "staffing_assignments_biz_demand_status_idx",
    ).on(table.bizId, table.staffingDemandId, table.status, table.startsAt),

    /** Workload path by resource timeline. */
    staffingAssignmentsBizResourceStatusIdx: index(
      "staffing_assignments_biz_resource_status_idx",
    ).on(table.bizId, table.resourceId, table.status, table.startsAt),

    /** Tenant-safe FK to parent demand. */
    staffingAssignmentsBizDemandFk: foreignKey({
      columns: [table.bizId, table.staffingDemandId],
      foreignColumns: [staffingDemands.bizId, staffingDemands.id],
      name: "staffing_assignments_biz_demand_fk",
    }),

    /** Tenant-safe FK to resource. */
    staffingAssignmentsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "staffing_assignments_biz_resource_fk",
    }),

    /** Tenant-safe FK to optional response. */
    staffingAssignmentsBizResponseFk: foreignKey({
      columns: [table.bizId, table.staffingResponseId],
      foreignColumns: [staffingResponses.bizId, staffingResponses.id],
      name: "staffing_assignments_biz_response_fk",
    }),

    /** Tenant-safe FK to optional fulfillment assignment. */
    staffingAssignmentsBizFulfillmentAssignmentFk: foreignKey({
      columns: [table.bizId, table.fulfillmentAssignmentId],
      foreignColumns: [fulfillmentAssignments.bizId, fulfillmentAssignments.id],
      name: "staffing_assignments_biz_fulfillment_assignment_fk",
    }),

    /** Tenant-safe FK to optional fulfillment unit. */
    staffingAssignmentsBizFulfillmentUnitFk: foreignKey({
      columns: [table.bizId, table.fulfillmentUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "staffing_assignments_biz_fulfillment_unit_fk",
    }),

    /** Window and rate bounds checks. */
    staffingAssignmentsBoundsCheck: check(
      "staffing_assignments_bounds_check",
      sql`
      "ends_at" > "starts_at"
      AND ("compensation_rate_minor" IS NULL OR "compensation_rate_minor" >= 0)
      `,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    staffingAssignmentsCurrencyFormatCheck: check(
      "staffing_assignments_currency_format_check",
      sql`"compensation_currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * staffing_fairness_counters
 *
 * ELI5:
 * Aggregated fairness metrics by pool/resource/window.
 * This supports equitable open-shift distribution and replacement load balancing.
 */
export const staffingFairnessCounters = pgTable(
  "staffing_fairness_counters",
  {
    /** Stable primary key. */
    id: idWithTag("staffing_fairness"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Pool scope. */
    staffingPoolId: idRef("staffing_pool_id")
      .references(() => staffingPools.id)
      .notNull(),

    /** Resource scope. */
    resourceId: idRef("resource_id")
      .references(() => resources.id)
      .notNull(),

    /** Fairness window start. */
    windowStartAt: timestamp("window_start_at", { withTimezone: true }).notNull(),

    /** Fairness window end. */
    windowEndAt: timestamp("window_end_at", { withTimezone: true }).notNull(),

    /** Count of times candidate was offered/invited. */
    offeredCount: integer("offered_count").default(0).notNull(),

    /** Count of explicit claim attempts. */
    claimCount: integer("claim_count").default(0).notNull(),

    /** Count of bids submitted. */
    bidCount: integer("bid_count").default(0).notNull(),

    /** Count of accepted responses. */
    acceptedCount: integer("accepted_count").default(0).notNull(),

    /** Count of actual assignments. */
    assignedCount: integer("assigned_count").default(0).notNull(),

    /** Count of declines. */
    declinedCount: integer("declined_count").default(0).notNull(),

    /** Count of expired/no-response outcomes. */
    noResponseCount: integer("no_response_count").default(0).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    staffingFairnessCountersBizIdIdUnique: uniqueIndex("staffing_fairness_counters_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One counter row per pool/resource/window. */
    staffingFairnessCountersUnique: uniqueIndex("staffing_fairness_counters_unique").on(
      table.staffingPoolId,
      table.resourceId,
      table.windowStartAt,
    ),

    /** Query path for fairness dashboards. */
    staffingFairnessCountersBizPoolWindowIdx: index(
      "staffing_fairness_counters_biz_pool_window_idx",
    ).on(table.bizId, table.staffingPoolId, table.windowStartAt),

    /** Tenant-safe FK to pool. */
    staffingFairnessCountersBizPoolFk: foreignKey({
      columns: [table.bizId, table.staffingPoolId],
      foreignColumns: [staffingPools.bizId, staffingPools.id],
      name: "staffing_fairness_counters_biz_pool_fk",
    }),

    /** Tenant-safe FK to resource. */
    staffingFairnessCountersBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "staffing_fairness_counters_biz_resource_fk",
    }),

    /** Window and counters must be sane. */
    staffingFairnessCountersCheck: check(
      "staffing_fairness_counters_check",
      sql`
      "window_end_at" > "window_start_at"
      AND "offered_count" >= 0
      AND "claim_count" >= 0
      AND "bid_count" >= 0
      AND "accepted_count" >= 0
      AND "assigned_count" >= 0
      AND "declined_count" >= 0
      AND "no_response_count" >= 0
      `,
    ),
  }),
);
