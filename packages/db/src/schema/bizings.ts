import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import {
  bizingAgentRoleEnum,
  bizingAutomationModeEnum,
  bizingAutomationRunStatusEnum,
  bizingCurationEventTypeEnum,
  bizingGovernanceModeEnum,
  bizingMembershipRoleEnum,
  bizingRecipeTypeEnum,
  bizingRecipeVersionStatusEnum,
  bizingVisibilityEnum,
  lifecycleStatusEnum,
  requirementModeEnum,
} from "./enums";
import { marketplaceListings } from "./marketplace";
import { sellables } from "./product_commerce";
import { resourceCapabilityTemplates } from "./supply";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * bizings
 *
 * ELI5:
 * A "bizing" is a curated network/marketplace of standardized offerings.
 *
 * Think:
 * - "Dental clinics in my city"
 * - "Top image-generation agents you can hire"
 *
 * Why this table exists:
 * - it gives one reusable shell for community-curated and/or agent-curated
 *   ecosystems,
 * - recipes, providers, memberships, and automation runs all attach here.
 */
export const bizings = pgTable(
  "bizings",
  {
    /** Stable primary key for one bizing network. */
    id: idWithTag("bizing"),

    /**
     * Owning business context.
     * This does NOT prevent cross-biz participation; it defines who governs
     * root settings and moderation defaults.
     */
    hostBizId: idRef("host_biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human/public name. */
    name: varchar("name", { length: 240 }).notNull(),

    /** Stable slug used in discovery URLs and APIs. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Short summary for cards/list views. */
    summary: varchar("summary", { length: 1000 }),

    /** Long-form description/rules text. */
    description: text("description"),

    /** Public/private discovery mode. */
    visibility: bizingVisibilityEnum("visibility").default("public").notNull(),

    /** Governance model: owner/community/agent/hybrid. */
    governanceMode: bizingGovernanceModeEnum("governance_mode")
      .default("owner_curated")
      .notNull(),

    /** Lifecycle status for this network shell. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Geographic constraints and default region filters. */
    regionPolicy: jsonb("region_policy").default({}).notNull(),

    /** Discovery/search ranking policy defaults. */
    discoveryPolicy: jsonb("discovery_policy").default({}).notNull(),

    /** Matching rules for supply-demand resolution within this bizing. */
    matchingPolicy: jsonb("matching_policy").default({}).notNull(),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe children keyed by host biz. */
    bizingsHostBizIdIdUnique: uniqueIndex("bizings_host_biz_id_id_unique").on(
      table.hostBizId,
      table.id,
    ),

    /** One slug identity per deployment. */
    bizingsSlugUnique: uniqueIndex("bizings_slug_unique").on(table.slug),

    /** Common discovery/listing path. */
    bizingsVisibilityStatusIdx: index("bizings_visibility_status_idx").on(
      table.visibility,
      table.status,
      table.slug,
    ),
  }),
);

/**
 * bizing_memberships
 *
 * ELI5:
 * Membership rows control who can curate, provide, or moderate inside a bizing.
 *
 * We use subject pointers so members can be:
 * - users,
 * - businesses,
 * - group accounts,
 * - agent identities.
 */
export const bizingMemberships = pgTable(
  "bizing_memberships",
  {
    /** Stable primary key. */
    id: idWithTag("bizing_member"),

    /** Parent bizing. */
    bizingId: idRef("bizing_id")
      .references(() => bizings.id)
      .notNull(),

    /** Subject tenant boundary for cross-biz membership support. */
    memberSubjectBizId: idRef("member_subject_biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Subject namespace + id. */
    memberSubjectType: varchar("member_subject_type", { length: 80 }).notNull(),
    memberSubjectId: idRef("member_subject_id").notNull(),

    /** Membership role in this network. */
    role: bizingMembershipRoleEnum("role").default("member").notNull(),

    /** Lifecycle status (active/inactive/etc.). */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Join timestamp. */
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional policy/settings override for this member. */
    settings: jsonb("settings").default({}).notNull(),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    bizingMembershipsBizingSubjectUnique: uniqueIndex(
      "bizing_memberships_bizing_subject_unique",
    ).on(table.bizingId, table.memberSubjectBizId, table.memberSubjectType, table.memberSubjectId),

    bizingMembershipsBizingRoleStatusIdx: index(
      "bizing_memberships_bizing_role_status_idx",
    ).on(table.bizingId, table.role, table.status),

    /** Subject pointer integrity. */
    bizingMembershipsSubjectFk: foreignKey({
      columns: [table.memberSubjectBizId, table.memberSubjectType, table.memberSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "bizing_memberships_subject_fk",
    }),
  }),
);

/**
 * bizing_recipes
 *
 * ELI5:
 * A recipe is a standardized "how to offer this service/product" blueprint.
 *
 * It can be adopted by many bizes and represented by local entities.
 */
export const bizingRecipes = pgTable(
  "bizing_recipes",
  {
    /** Stable primary key. */
    id: idWithTag("bizing_recipe"),

    /** Parent bizing network. */
    bizingId: idRef("bizing_id")
      .references(() => bizings.id)
      .notNull(),

    /** Owning/authoring biz context for this recipe shell. */
    ownerBizId: idRef("owner_biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Recipe family/type. */
    recipeType: bizingRecipeTypeEnum("recipe_type").default("mixed").notNull(),

    /** Human recipe name. */
    name: varchar("name", { length: 240 }).notNull(),

    /** Stable slug per bizing. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Short summary for discovery cards. */
    summary: varchar("summary", { length: 1000 }),

    /** Long-form recipe description. */
    description: text("description"),

    /** Shell lifecycle status. */
    status: lifecycleStatusEnum("status").default("draft").notNull(),

    /** Convenience pointer to latest version number. */
    latestVersion: integer("latest_version").default(1).notNull(),

    /** Aggregated curation score (up/down + weighting). */
    curationScore: integer("curation_score").default(0).notNull(),

    /** Count of active adoptions across bizes. */
    adoptionCount: integer("adoption_count").default(0).notNull(),

    /** Policy text/rules for usage/licensing/commercial constraints. */
    usagePolicy: jsonb("usage_policy").default({}).notNull(),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references from version rows. */
    bizingRecipesBizingIdIdUnique: uniqueIndex("bizing_recipes_bizing_id_id_unique").on(
      table.bizingId,
      table.id,
    ),

    /** One slug identity per bizing. */
    bizingRecipesSlugUnique: uniqueIndex("bizing_recipes_slug_unique").on(
      table.bizingId,
      table.slug,
    ),

    /** Discovery/listing path. */
    bizingRecipesStatusScoreIdx: index("bizing_recipes_status_score_idx").on(
      table.bizingId,
      table.status,
      table.curationScore,
    ),

    /** Basic numeric guardrails. */
    bizingRecipesBoundsCheck: check(
      "bizing_recipes_bounds_check",
      sql`
      "latest_version" >= 1
      AND "adoption_count" >= 0
      `,
    ),
  }),
);

/**
 * bizing_recipe_versions
 *
 * ELI5:
 * Immutable recipe snapshots. These are the auditable "frozen instructions"
 * that adopters/providers can reference and trust.
 */
export const bizingRecipeVersions = pgTable(
  "bizing_recipe_versions",
  {
    /** Stable primary key. */
    id: idWithTag("bizing_recipe_version"),

    /** Parent bizing for strict grouping. */
    bizingId: idRef("bizing_id")
      .references(() => bizings.id)
      .notNull(),

    /** Parent recipe shell. */
    bizingRecipeId: idRef("bizing_recipe_id")
      .references(() => bizingRecipes.id)
      .notNull(),

    /** Immutable version number. */
    version: integer("version").notNull(),

    /** Version lifecycle + moderation state. */
    status: bizingRecipeVersionStatusEnum("status").default("draft").notNull(),

    /** Full recipe payload snapshot (steps, requirements, policy hints). */
    recipeSnapshot: jsonb("recipe_snapshot").default({}).notNull(),

    /** Fulfillment hints/rules at version level. */
    fulfillmentPolicy: jsonb("fulfillment_policy").default({}).notNull(),

    /** Pricing suggestions/constraints at version level. */
    pricingHints: jsonb("pricing_hints").default({}).notNull(),

    /** Quality standards/rubric for providers adopting this version. */
    qualityPolicy: jsonb("quality_policy").default({}).notNull(),

    /** Optional publish timestamp. */
    publishedAt: timestamp("published_at", { withTimezone: true }),

    /** Optional subject pointer for generator/authoring actor. */
    generatedBySubjectBizId: idRef("generated_by_subject_biz_id").references(
      () => bizes.id,
    ),
    generatedBySubjectType: varchar("generated_by_subject_type", { length: 80 }),
    generatedBySubjectId: idRef("generated_by_subject_id"),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe child rows. */
    bizingRecipeVersionsBizingIdIdUnique: uniqueIndex(
      "bizing_recipe_versions_bizing_id_id_unique",
    ).on(table.bizingId, table.id),

    /** One row per recipe/version pair. */
    bizingRecipeVersionsUnique: uniqueIndex("bizing_recipe_versions_unique").on(
      table.bizingRecipeId,
      table.version,
    ),

    /** One currently-published version per recipe. */
    bizingRecipeVersionsPublishedUnique: uniqueIndex(
      "bizing_recipe_versions_published_unique",
    )
      .on(table.bizingRecipeId)
      .where(sql`"status" = 'published' AND "deleted_at" IS NULL`),

    bizingRecipeVersionsStatusPublishedIdx: index(
      "bizing_recipe_versions_status_published_idx",
    ).on(table.bizingId, table.status, table.publishedAt),

    /** Tenant-safe FK to recipe shell using bizing scope. */
    bizingRecipeVersionsRecipeFk: foreignKey({
      columns: [table.bizingId, table.bizingRecipeId],
      foreignColumns: [bizingRecipes.bizingId, bizingRecipes.id],
      name: "bizing_recipe_versions_recipe_fk",
    }),

    /** Subject pointer should be all-null or all-populated. */
    bizingRecipeVersionsGeneratedByPairCheck: check(
      "bizing_recipe_versions_generated_by_pair_check",
      sql`
      (
        "generated_by_subject_biz_id" IS NULL
        AND "generated_by_subject_type" IS NULL
        AND "generated_by_subject_id" IS NULL
      ) OR (
        "generated_by_subject_biz_id" IS NOT NULL
        AND "generated_by_subject_type" IS NOT NULL
        AND "generated_by_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Positive version invariant. */
    bizingRecipeVersionsVersionCheck: check(
      "bizing_recipe_versions_version_check",
      sql`"version" >= 1`,
    ),
  }),
);

/**
 * bizing_recipe_components
 *
 * ELI5:
 * Structured component rows inside one recipe version.
 *
 * Each component can point to:
 * - canonical sellable,
 * - capability template,
 * - or generic subject reference.
 */
export const bizingRecipeComponents = pgTable(
  "bizing_recipe_components",
  {
    /** Stable primary key. */
    id: idWithTag("bizing_recipe_component"),

    /** Parent bizing scope. */
    bizingId: idRef("bizing_id")
      .references(() => bizings.id)
      .notNull(),

    /** Parent recipe version. */
    bizingRecipeVersionId: idRef("bizing_recipe_version_id")
      .references(() => bizingRecipeVersions.id)
      .notNull(),

    /**
     * Component class key.
     * Examples: sellable, capability, policy, instrument.
     */
    componentType: varchar("component_type", { length: 80 }).notNull(),

    /** Stable key per version for deterministic matching. */
    componentKey: varchar("component_key", { length: 140 }).notNull(),

    /** Required vs optional semantics. */
    requirementMode: requirementModeEnum("requirement_mode")
      .default("required")
      .notNull(),

    /** Optional sellable pointer. */
    sellableId: idRef("sellable_id").references(() => sellables.id),

    /** Optional resource-capability template pointer. */
    resourceCapabilityTemplateId: idRef("resource_capability_template_id").references(
      () => resourceCapabilityTemplates.id,
    ),

    /** Optional generic subject pointer. */
    targetSubjectBizId: idRef("target_subject_biz_id").references(() => bizes.id),
    targetSubjectType: varchar("target_subject_type", { length: 80 }),
    targetSubjectId: idRef("target_subject_id"),

    /** Cardinality bounds for this component. */
    minQuantity: integer("min_quantity").default(1).notNull(),
    maxQuantity: integer("max_quantity"),

    /** Ordering hint. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Structured component payload. */
    config: jsonb("config").default({}).notNull(),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** One component key per version. */
    bizingRecipeComponentsUnique: uniqueIndex("bizing_recipe_components_unique").on(
      table.bizingRecipeVersionId,
      table.componentKey,
    ),

    /** Version expansion path. */
    bizingRecipeComponentsVersionSortIdx: index(
      "bizing_recipe_components_version_sort_idx",
    ).on(table.bizingId, table.bizingRecipeVersionId, table.sortOrder),

    /** Tenant-safe FK to recipe version by bizing scope. */
    bizingRecipeComponentsVersionFk: foreignKey({
      columns: [table.bizingId, table.bizingRecipeVersionId],
      foreignColumns: [bizingRecipeVersions.bizingId, bizingRecipeVersions.id],
      name: "bizing_recipe_components_version_fk",
    }),

    /** Tenant-safe FK to optional subject pointer. */
    bizingRecipeComponentsSubjectFk: foreignKey({
      columns: [table.targetSubjectBizId, table.targetSubjectType, table.targetSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "bizing_recipe_components_subject_fk",
    }),

    /** Subject pointer should be all-null or all-populated. */
    bizingRecipeComponentsSubjectPairCheck: check(
      "bizing_recipe_components_subject_pair_check",
      sql`
      (
        "target_subject_biz_id" IS NULL
        AND "target_subject_type" IS NULL
        AND "target_subject_id" IS NULL
      ) OR (
        "target_subject_biz_id" IS NOT NULL
        AND "target_subject_type" IS NOT NULL
        AND "target_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Exactly one target pointer family should be chosen. */
    bizingRecipeComponentsTargetShapeCheck: check(
      "bizing_recipe_components_target_shape_check",
      sql`
      (
        ("sellable_id" IS NOT NULL)::int
        + ("resource_capability_template_id" IS NOT NULL)::int
        + ("target_subject_type" IS NOT NULL)::int
      ) = 1
      `,
    ),

    /** Cardinality and ordering guardrails. */
    bizingRecipeComponentsBoundsCheck: check(
      "bizing_recipe_components_bounds_check",
      sql`
      "min_quantity" >= 0
      AND ("max_quantity" IS NULL OR "max_quantity" >= "min_quantity")
      AND "sort_order" >= 0
      `,
    ),
  }),
);

/**
 * bizing_curation_events
 *
 * ELI5:
 * Community and moderation actions for recipes (votes, reviews, flags).
 */
export const bizingCurationEvents = pgTable(
  "bizing_curation_events",
  {
    /** Stable primary key. */
    id: idWithTag("bizing_curation"),

    /** Parent bizing scope. */
    bizingId: idRef("bizing_id")
      .references(() => bizings.id)
      .notNull(),

    /** Recipe receiving the curation action. */
    bizingRecipeId: idRef("bizing_recipe_id")
      .references(() => bizingRecipes.id)
      .notNull(),

    /** Optional recipe version target for version-specific feedback. */
    bizingRecipeVersionId: idRef("bizing_recipe_version_id").references(
      () => bizingRecipeVersions.id,
    ),

    /** Optional actor subject pointer. */
    actorSubjectBizId: idRef("actor_subject_biz_id").references(() => bizes.id),
    actorSubjectType: varchar("actor_subject_type", { length: 80 }),
    actorSubjectId: idRef("actor_subject_id"),

    /** Event type (upvote/downvote/bookmark/flag/review/endorse). */
    eventType: bizingCurationEventTypeEnum("event_type").notNull(),

    /** Numeric vote delta when relevant (-1/0/+1). */
    voteDelta: integer("vote_delta").default(0).notNull(),

    /** Optional 1..5 rating where applicable. */
    rating: integer("rating"),

    /** Optional free-text review/flag explanation. */
    reviewText: text("review_text"),

    /** Business timestamp for event ordering. */
    eventAt: timestamp("event_at", { withTimezone: true }).defaultNow().notNull(),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Discovery path for recipe score aggregation. */
    bizingCurationEventsRecipeEventAtIdx: index("bizing_curation_events_recipe_event_at_idx").on(
      table.bizingRecipeId,
      table.eventAt,
    ),

    /** Tenant-safe FK to recipe by bizing scope. */
    bizingCurationEventsRecipeFk: foreignKey({
      columns: [table.bizingId, table.bizingRecipeId],
      foreignColumns: [bizingRecipes.bizingId, bizingRecipes.id],
      name: "bizing_curation_events_recipe_fk",
    }),

    /** Optional tenant-safe FK to recipe version by bizing scope. */
    bizingCurationEventsVersionFk: foreignKey({
      columns: [table.bizingId, table.bizingRecipeVersionId],
      foreignColumns: [bizingRecipeVersions.bizingId, bizingRecipeVersions.id],
      name: "bizing_curation_events_version_fk",
    }),

    /** Optional actor subject pointer integrity. */
    bizingCurationEventsActorSubjectFk: foreignKey({
      columns: [table.actorSubjectBizId, table.actorSubjectType, table.actorSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "bizing_curation_events_actor_subject_fk",
    }),

    /** Actor pointer should be all-null or all-populated. */
    bizingCurationEventsActorPairCheck: check(
      "bizing_curation_events_actor_pair_check",
      sql`
      (
        "actor_subject_biz_id" IS NULL
        AND "actor_subject_type" IS NULL
        AND "actor_subject_id" IS NULL
      ) OR (
        "actor_subject_biz_id" IS NOT NULL
        AND "actor_subject_type" IS NOT NULL
        AND "actor_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Rating/vote bounds sanity checks. */
    bizingCurationEventsBoundsCheck: check(
      "bizing_curation_events_bounds_check",
      sql`
      "vote_delta" BETWEEN -1 AND 1
      AND ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5))
      `,
    ),
  }),
);

/**
 * bizing_adoptions
 *
 * ELI5:
 * Adoption says: "this biz has adopted this recipe version into its local
 * catalog/operations."
 *
 * We use subject pointers for local representation so adopters can map to
 * offers, service products, workflows, or plugin entities without schema forks.
 */
export const bizingAdoptions = pgTable(
  "bizing_adoptions",
  {
    /** Stable primary key. */
    id: idWithTag("bizing_adoption"),

    /** Parent bizing scope. */
    bizingId: idRef("bizing_id")
      .references(() => bizings.id)
      .notNull(),

    /** Adopted recipe shell + version. */
    bizingRecipeId: idRef("bizing_recipe_id")
      .references(() => bizingRecipes.id)
      .notNull(),
    bizingRecipeVersionId: idRef("bizing_recipe_version_id")
      .references(() => bizingRecipeVersions.id)
      .notNull(),

    /** Adopter business context. */
    adopterBizId: idRef("adopter_biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional local subject mapping for adopted artifact. */
    adoptedSubjectType: varchar("adopted_subject_type", { length: 80 }),
    adoptedSubjectId: idRef("adopted_subject_id"),

    /** Adoption lifecycle status. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Adoption timestamp. */
    adoptedAt: timestamp("adopted_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional disable timestamp for paused/retired adoption. */
    disabledAt: timestamp("disabled_at", { withTimezone: true }),

    /** Local configuration overrides for this adoption. */
    configuration: jsonb("configuration").default({}).notNull(),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** One active adoption per adopter+recipe shell. */
    bizingAdoptionsActiveUnique: uniqueIndex("bizing_adoptions_active_unique")
      .on(table.adopterBizId, table.bizingRecipeId)
      .where(sql`"status" = 'active' AND "deleted_at" IS NULL`),

    bizingAdoptionsAdopterStatusIdx: index("bizing_adoptions_adopter_status_idx").on(
      table.adopterBizId,
      table.status,
      table.adoptedAt,
    ),

    /** Tenant-safe FK to recipe shell by bizing scope. */
    bizingAdoptionsRecipeFk: foreignKey({
      columns: [table.bizingId, table.bizingRecipeId],
      foreignColumns: [bizingRecipes.bizingId, bizingRecipes.id],
      name: "bizing_adoptions_recipe_fk",
    }),

    /** Tenant-safe FK to recipe version by bizing scope. */
    bizingAdoptionsVersionFk: foreignKey({
      columns: [table.bizingId, table.bizingRecipeVersionId],
      foreignColumns: [bizingRecipeVersions.bizingId, bizingRecipeVersions.id],
      name: "bizing_adoptions_version_fk",
    }),

    /** Tenant-safe FK to adopted local subject pointer. */
    bizingAdoptionsAdoptedSubjectFk: foreignKey({
      columns: [table.adopterBizId, table.adoptedSubjectType, table.adoptedSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "bizing_adoptions_adopted_subject_fk",
    }),

    /** Adopted subject pointer should be all-null or all-populated. */
    bizingAdoptionsSubjectPairCheck: check(
      "bizing_adoptions_subject_pair_check",
      sql`
      (
        "adopted_subject_type" IS NULL
        AND "adopted_subject_id" IS NULL
      ) OR (
        "adopted_subject_type" IS NOT NULL
        AND "adopted_subject_id" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * bizing_provider_listings
 *
 * ELI5:
 * Supply/provider directory rows inside a bizing.
 */
export const bizingProviderListings = pgTable(
  "bizing_provider_listings",
  {
    /** Stable primary key. */
    id: idWithTag("bizing_provider"),

    /** Parent bizing scope. */
    bizingId: idRef("bizing_id")
      .references(() => bizings.id)
      .notNull(),

    /** Provider business context. */
    providerBizId: idRef("provider_biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional provider subject pointer (resource/user/group/etc.). */
    providerSubjectType: varchar("provider_subject_type", { length: 80 }),
    providerSubjectId: idRef("provider_subject_id"),

    /** Optional link to provider's published marketplace listing. */
    marketplaceListingId: idRef("marketplace_listing_id").references(
      () => marketplaceListings.id,
    ),

    /** Listing lifecycle status. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Optional service radius for location-aware matching. */
    serviceRadiusKm: integer("service_radius_km"),

    /** Provider-specific rates and pricing hints. */
    rateCard: jsonb("rate_card").default({}).notNull(),

    /** Provider availability-sharing policy. */
    availabilityPolicy: jsonb("availability_policy").default({}).notNull(),

    /** Reputation/ranking snapshot for listing sort. */
    reputationSnapshot: jsonb("reputation_snapshot").default({}).notNull(),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    bizingProviderListingsUnique: uniqueIndex("bizing_provider_listings_unique").on(
      table.bizingId,
      table.providerBizId,
      table.providerSubjectType,
      table.providerSubjectId,
    ),

    bizingProviderListingsStatusIdx: index("bizing_provider_listings_status_idx").on(
      table.bizingId,
      table.status,
    ),

    /** Tenant-safe FK to provider subject pointer. */
    bizingProviderListingsProviderSubjectFk: foreignKey({
      columns: [table.providerBizId, table.providerSubjectType, table.providerSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "bizing_provider_listings_provider_subject_fk",
    }),

    /** Tenant-safe FK to provider's marketplace listing. */
    bizingProviderListingsMarketplaceListingFk: foreignKey({
      columns: [table.providerBizId, table.marketplaceListingId],
      foreignColumns: [marketplaceListings.bizId, marketplaceListings.id],
      name: "bizing_provider_listings_marketplace_listing_fk",
    }),

    /** Subject pointer should be all-null or all-populated. */
    bizingProviderListingsSubjectPairCheck: check(
      "bizing_provider_listings_subject_pair_check",
      sql`
      (
        "provider_subject_type" IS NULL
        AND "provider_subject_id" IS NULL
      ) OR (
        "provider_subject_type" IS NOT NULL
        AND "provider_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Numeric bounds. */
    bizingProviderListingsRadiusCheck: check(
      "bizing_provider_listings_radius_check",
      sql`"service_radius_km" IS NULL OR "service_radius_km" >= 0`,
    ),
  }),
);

/**
 * bizing_agent_profiles
 *
 * ELI5:
 * Agent profiles define autonomous/assisted operators for curation, matching,
 * moderation, and orchestration in a bizing.
 */
export const bizingAgentProfiles = pgTable(
  "bizing_agent_profiles",
  {
    /** Stable primary key. */
    id: idWithTag("bizing_agent"),

    /** Parent bizing. */
    bizingId: idRef("bizing_id")
      .references(() => bizings.id)
      .notNull(),

    /** Optional provider biz for this agent identity. */
    agentBizId: idRef("agent_biz_id").references(() => bizes.id),

    /** Optional agent subject pointer. */
    agentSubjectType: varchar("agent_subject_type", { length: 80 }),
    agentSubjectId: idRef("agent_subject_id"),

    /** Human label for this agent profile. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Agent role in this bizing. */
    role: bizingAgentRoleEnum("role").default("operator").notNull(),

    /** How autonomous this agent is allowed to be. */
    automationMode: bizingAutomationModeEnum("automation_mode")
      .default("agent_assisted")
      .notNull(),

    /** Lifecycle status. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Instruction/rubric payload for agent behavior. */
    instructions: jsonb("instructions").default({}).notNull(),

    /** Hard guardrails and escalation policy. */
    guardrails: jsonb("guardrails").default({}).notNull(),

    /** Optional integration-specific runtime config. */
    integrationConfig: jsonb("integration_config").default({}).notNull(),

    /** Last heartbeat timestamp for health/ops visibility. */
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    bizingAgentProfilesStatusIdx: index("bizing_agent_profiles_status_idx").on(
      table.bizingId,
      table.status,
      table.role,
    ),

    /** Optional tenant-safe subject FK when subject pointer is present. */
    bizingAgentProfilesSubjectFk: foreignKey({
      columns: [table.agentBizId, table.agentSubjectType, table.agentSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "bizing_agent_profiles_subject_fk",
    }),

    /** Subject pointer should be all-null or all-populated. */
    bizingAgentProfilesSubjectPairCheck: check(
      "bizing_agent_profiles_subject_pair_check",
      sql`
      (
        "agent_biz_id" IS NULL
        AND "agent_subject_type" IS NULL
        AND "agent_subject_id" IS NULL
      ) OR (
        "agent_biz_id" IS NOT NULL
        AND "agent_subject_type" IS NOT NULL
        AND "agent_subject_id" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * bizing_automation_runs
 *
 * ELI5:
 * Immutable-ish run records for agent operations inside a bizing.
 */
export const bizingAutomationRuns = pgTable(
  "bizing_automation_runs",
  {
    /** Stable primary key. */
    id: idWithTag("bizing_auto_run"),

    /** Parent bizing scope. */
    bizingId: idRef("bizing_id")
      .references(() => bizings.id)
      .notNull(),

    /** Agent profile running this execution. */
    bizingAgentProfileId: idRef("bizing_agent_profile_id")
      .references(() => bizingAgentProfiles.id)
      .notNull(),

    /** Run category key (curate_feed, rank_providers, auto_publish, etc.). */
    runType: varchar("run_type", { length: 80 }).notNull(),

    /** Run lifecycle status. */
    status: bizingAutomationRunStatusEnum("status").default("queued").notNull(),

    /** Trigger source (schedule/manual/webhook/system). */
    triggerSource: varchar("trigger_source", { length: 80 }).default("system").notNull(),

    /** Execution timestamps. */
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Input payload snapshot. */
    inputPayload: jsonb("input_payload").default({}).notNull(),

    /** Output payload snapshot. */
    outputPayload: jsonb("output_payload").default({}).notNull(),

    /** Optional error summary when failed. */
    errorSummary: text("error_summary"),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    bizingAutomationRunsStatusStartedIdx: index("bizing_automation_runs_status_started_idx").on(
      table.bizingId,
      table.status,
      table.startedAt,
    ),

    /** Tenant-safe FK to agent profile by bizing scope. */
    bizingAutomationRunsAgentFk: foreignKey({
      columns: [table.bizingId, table.bizingAgentProfileId],
      foreignColumns: [bizingAgentProfiles.bizingId, bizingAgentProfiles.id],
      name: "bizing_automation_runs_agent_fk",
    }),

    /** Timeline consistency. */
    bizingAutomationRunsTimelineCheck: check(
      "bizing_automation_runs_timeline_check",
      sql`"started_at" IS NULL OR "completed_at" IS NULL OR "completed_at" >= "started_at"`,
    ),
  }),
);
