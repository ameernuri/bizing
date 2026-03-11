import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { boolean } from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { lifecycleStatusEnum } from "./enums";
import { users } from "./users";
import { marketingAudienceSegments } from "./marketing_performance";
import { channelAccounts } from "./channels";
import { marketingCampaigns, messageTemplates } from "./communications";

/**
 * growth_localization_resources
 *
 * ELI5:
 * One row defines one translatable slot in the platform.
 *
 * Example slots:
 * - message_template:mt_123:subject
 * - marketing_campaign:mkt_456:headline
 * - offer_version:offer_v_789:display_name
 *
 * Why this exists:
 * - keeps localization first-class and auditable,
 * - avoids scattering locale strings across arbitrary metadata blobs,
 * - gives plugins/workflows one generic localization backbone.
 */
export const growthLocalizationResources = pgTable(
  "growth_localization_resources",
  {
    /** Stable primary key for one localization resource slot. */
    id: idWithTag("growth_i18n_res"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Stable machine key for API/workflow/plugin references. */
    key: varchar("key", { length: 160 }).notNull(),

    /** Human-readable label for operator UIs. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Subject class this translatable slot belongs to. */
    targetType: varchar("target_type", { length: 120 }).notNull(),

    /** Subject identifier this slot belongs to. */
    targetRefId: varchar("target_ref_id", { length: 160 }).notNull(),

    /** Concrete translatable field on the target payload. */
    fieldKey: varchar("field_key", { length: 160 }).notNull(),

    /** Default locale used when no requested locale value exists. */
    defaultLocale: varchar("default_locale", { length: 35 }).default("en-US").notNull(),

    /** Resource lifecycle status. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /**
     * Optional pointer for clients that cache "active" locale value versions.
     *
     * ELI5:
     * Value rows hold versions per locale. This value gives consumers one
     * monotonic counter to invalidate stale caches quickly.
     */
    currentVersion: integer("current_version").default(1).notNull(),

    /** Extensible payload for rendering and ownership metadata. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    growthLocalizationResourcesBizIdIdUnique: uniqueIndex(
      "growth_localization_resources_biz_id_id_unique",
    ).on(table.bizId, table.id),

    growthLocalizationResourcesBizKeyUnique: uniqueIndex(
      "growth_localization_resources_biz_key_unique",
    ).on(table.bizId, table.key),

    growthLocalizationResourcesBizTargetFieldUnique: uniqueIndex(
      "growth_localization_resources_biz_target_field_unique",
    ).on(table.bizId, table.targetType, table.targetRefId, table.fieldKey),

    growthLocalizationResourcesBizStatusLocaleIdx: index(
      "growth_localization_resources_biz_status_locale_idx",
    ).on(table.bizId, table.status, table.defaultLocale),

    growthLocalizationResourcesDefaultLocaleFormatCheck: check(
      "growth_localization_resources_default_locale_format_check",
      sql`"default_locale" ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'`,
    ),

    growthLocalizationResourcesCurrentVersionCheck: check(
      "growth_localization_resources_current_version_check",
      sql`"current_version" >= 1`,
    ),
  }),
);

/**
 * growth_localization_values
 *
 * ELI5:
 * One row is one localized value revision for one resource + locale.
 *
 * This table supports:
 * - manual edits,
 * - imported packs,
 * - machine translation drafts,
 * - workflow/plugin generated variants.
 */
export const growthLocalizationValues = pgTable(
  "growth_localization_values",
  {
    /** Stable primary key for one localized value revision. */
    id: idWithTag("growth_i18n_val"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent localization resource slot. */
    growthLocalizationResourceId: idRef("growth_localization_resource_id")
      .references(() => growthLocalizationResources.id)
      .notNull(),

    /** Locale tag (BCP-47-ish). */
    locale: varchar("locale", { length: 35 }).notNull(),

    /** Revision number within one (resource, locale) stream. */
    version: integer("version").default(1).notNull(),

    /** True when this row is the active resolution candidate for locale. */
    isCurrent: boolean("is_current").default(true).notNull(),

    /** Machine-generated marker (translation model/agent automation). */
    isMachineGenerated: boolean("is_machine_generated").default(false).notNull(),

    /** Value source classification. */
    sourceType: varchar("source_type", { length: 40 }).default("manual").notNull(),

    /** Plain-text/markdown localized payload. */
    contentText: text("content_text"),

    /** Structured localized payload when text alone is insufficient. */
    contentJson: jsonb("content_json"),

    /** Optional quality score (0-100). */
    qualityScore: integer("quality_score"),

    /** Revision lifecycle status. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    growthLocalizationValuesBizIdIdUnique: uniqueIndex(
      "growth_localization_values_biz_id_id_unique",
    ).on(table.bizId, table.id),

    growthLocalizationValuesResourceLocaleVersionUnique: uniqueIndex(
      "growth_localization_values_resource_locale_version_unique",
    ).on(table.growthLocalizationResourceId, table.locale, table.version),

    growthLocalizationValuesResourceLocaleCurrentUnique: uniqueIndex(
      "growth_localization_values_resource_locale_current_unique",
    )
      .on(table.growthLocalizationResourceId, table.locale)
      .where(sql`"is_current" = true AND "deleted_at" IS NULL`),

    growthLocalizationValuesBizLocaleStatusIdx: index(
      "growth_localization_values_biz_locale_status_idx",
    ).on(table.bizId, table.locale, table.status, table.isCurrent),

    growthLocalizationValuesBizResourceFk: foreignKey({
      columns: [table.bizId, table.growthLocalizationResourceId],
      foreignColumns: [growthLocalizationResources.bizId, growthLocalizationResources.id],
      name: "growth_localization_values_biz_resource_fk",
    }),

    growthLocalizationValuesLocaleFormatCheck: check(
      "growth_localization_values_locale_format_check",
      sql`"locale" ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'`,
    ),

    growthLocalizationValuesVersionCheck: check(
      "growth_localization_values_version_check",
      sql`"version" >= 1`,
    ),

    growthLocalizationValuesSourceTypeCheck: check(
      "growth_localization_values_source_type_check",
      sql`
      "source_type" IN ('manual', 'import', 'machine_translation', 'workflow', 'system')
      OR "source_type" LIKE 'custom_%'
      `,
    ),

    growthLocalizationValuesQualityScoreCheck: check(
      "growth_localization_values_quality_score_check",
      sql`"quality_score" IS NULL OR ("quality_score" >= 0 AND "quality_score" <= 100)`,
    ),

    growthLocalizationValuesPayloadShapeCheck: check(
      "growth_localization_values_payload_shape_check",
      sql`"content_text" IS NOT NULL OR "content_json" IS NOT NULL`,
    ),
  }),
);

/**
 * growth_experiments
 *
 * ELI5:
 * One row defines one A/B or multi-variant experiment plan.
 */
export const growthExperiments = pgTable(
  "growth_experiments",
  {
    /** Stable primary key for one experiment. */
    id: idWithTag("growth_experiment"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Stable machine key for external integrations/workflows. */
    key: varchar("key", { length: 160 }).notNull(),

    /** Human-readable experiment name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Experiment lifecycle status. */
    status: varchar("status", { length: 40 }).default("draft").notNull(),

    /** Product/marketing hypothesis under test. */
    hypothesis: text("hypothesis"),

    /** Primary optimization objective. */
    objectiveType: varchar("objective_type", { length: 80 })
      .default("conversion_rate")
      .notNull(),

    /** Assignment identity unit (subject/session/user/custom). */
    assignmentUnitType: varchar("assignment_unit_type", { length: 60 })
      .default("subject")
      .notNull(),

    /** Assignment algorithm strategy. */
    assignmentStrategy: varchar("assignment_strategy", { length: 60 })
      .default("weighted_hash")
      .notNull(),

    /** Optional audience segment scope. */
    marketingAudienceSegmentId: idRef("marketing_audience_segment_id").references(
      () => marketingAudienceSegments.id,
    ),

    /** Optional target object type this experiment affects. */
    targetType: varchar("target_type", { length: 120 }),

    /** Optional target object id this experiment affects. */
    targetRefId: varchar("target_ref_id", { length: 160 }),

    /** Optional start timestamp. */
    startsAt: timestamp("starts_at", { withTimezone: true }),

    /** Optional end timestamp. */
    endsAt: timestamp("ends_at", { withTimezone: true }),

    /** Optional selected winner variant id (soft pointer). */
    winnerGrowthExperimentVariantId: idRef("winner_growth_experiment_variant_id"),

    /** Extensible payload for guardrails, metric config, rollout policy, etc. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    growthExperimentsBizIdIdUnique: uniqueIndex("growth_experiments_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    growthExperimentsBizKeyUnique: uniqueIndex("growth_experiments_biz_key_unique").on(
      table.bizId,
      table.key,
    ),

    growthExperimentsBizStatusWindowIdx: index("growth_experiments_biz_status_window_idx").on(
      table.bizId,
      table.status,
      table.startsAt,
      table.endsAt,
    ),

    growthExperimentsBizObjectiveIdx: index("growth_experiments_biz_objective_idx").on(
      table.bizId,
      table.objectiveType,
      table.assignmentStrategy,
    ),

    growthExperimentsBizAudienceSegmentFk: foreignKey({
      columns: [table.bizId, table.marketingAudienceSegmentId],
      foreignColumns: [marketingAudienceSegments.bizId, marketingAudienceSegments.id],
      name: "growth_experiments_biz_audience_segment_fk",
    }),

    growthExperimentsStatusCheck: check(
      "growth_experiments_status_check",
      sql`
      "status" IN ('draft', 'active', 'paused', 'completed', 'archived')
      OR "status" LIKE 'custom_%'
      `,
    ),

    growthExperimentsAssignmentUnitTypeCheck: check(
      "growth_experiments_assignment_unit_type_check",
      sql`
      "assignment_unit_type" IN ('subject', 'session', 'user', 'group_account', 'custom_subject')
      OR "assignment_unit_type" LIKE 'custom_%'
      `,
    ),

    growthExperimentsAssignmentStrategyCheck: check(
      "growth_experiments_assignment_strategy_check",
      sql`
      "assignment_strategy" IN ('weighted_hash', 'manual', 'rule', 'sticky_random')
      OR "assignment_strategy" LIKE 'custom_%'
      `,
    ),

    growthExperimentsWindowCheck: check(
      "growth_experiments_window_check",
      sql`"starts_at" IS NULL OR "ends_at" IS NULL OR "ends_at" > "starts_at"`,
    ),
  }),
);

/**
 * growth_experiment_variants
 *
 * ELI5:
 * Variants are the concrete A/B options under one experiment.
 */
export const growthExperimentVariants = pgTable(
  "growth_experiment_variants",
  {
    /** Stable primary key for one variant row. */
    id: idWithTag("growth_variant"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent experiment. */
    growthExperimentId: idRef("growth_experiment_id")
      .references(() => growthExperiments.id)
      .notNull(),

    /** Stable variant key inside one experiment namespace. */
    variantKey: varchar("variant_key", { length: 120 }).notNull(),

    /** Human-readable variant name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Variant lifecycle status. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Control-group marker. */
    isControl: boolean("is_control").default(false).notNull(),

    /** Allocation weight in basis points (0..10000). */
    allocationBps: integer("allocation_bps").default(0).notNull(),

    /** Experiment treatment payload. */
    treatment: jsonb("treatment").default({}).notNull(),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    growthExperimentVariantsBizIdIdUnique: uniqueIndex(
      "growth_experiment_variants_biz_id_id_unique",
    ).on(table.bizId, table.id),

    growthExperimentVariantsUnique: uniqueIndex("growth_experiment_variants_unique").on(
      table.growthExperimentId,
      table.variantKey,
    ),

    growthExperimentVariantsBizExperimentStatusIdx: index(
      "growth_experiment_variants_biz_experiment_status_idx",
    ).on(table.bizId, table.growthExperimentId, table.status, table.allocationBps),

    growthExperimentVariantsBizExperimentFk: foreignKey({
      columns: [table.bizId, table.growthExperimentId],
      foreignColumns: [growthExperiments.bizId, growthExperiments.id],
      name: "growth_experiment_variants_biz_experiment_fk",
    }),

    growthExperimentVariantsAllocationCheck: check(
      "growth_experiment_variants_allocation_check",
      sql`"allocation_bps" >= 0 AND "allocation_bps" <= 10000`,
    ),
  }),
);

/**
 * growth_experiment_assignments
 *
 * ELI5:
 * One row stores a deterministic assignment of one subject to one variant.
 */
export const growthExperimentAssignments = pgTable(
  "growth_experiment_assignments",
  {
    /** Stable primary key. */
    id: idWithTag("growth_assignment"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent experiment. */
    growthExperimentId: idRef("growth_experiment_id")
      .references(() => growthExperiments.id)
      .notNull(),

    /** Assigned variant. */
    growthExperimentVariantId: idRef("growth_experiment_variant_id")
      .references(() => growthExperimentVariants.id)
      .notNull(),

    /** Subject class for this assignment. */
    subjectType: varchar("subject_type", { length: 80 }).notNull(),

    /** Subject identifier for this assignment. */
    subjectRefId: varchar("subject_ref_id", { length: 160 }).notNull(),

    /** Optional assignment fingerprint for session/device sticky allocation. */
    assignmentKey: varchar("assignment_key", { length: 180 }),

    /** Assignment lifecycle. */
    status: varchar("status", { length: 40 }).default("assigned").notNull(),

    /** Assignment timestamp. */
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),

    /** Exposure timestamp (first seen/rendered). */
    exposedAt: timestamp("exposed_at", { withTimezone: true }),

    /** Conversion timestamp when conversion event is recorded. */
    convertedAt: timestamp("converted_at", { withTimezone: true }),

    /** Optional conversion event key. */
    conversionEventKey: varchar("conversion_event_key", { length: 180 }),

    /** Optional conversion value in minor units. */
    conversionValueMinor: integer("conversion_value_minor"),

    /** Currency for conversion value. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Assignment source classification. */
    sourceType: varchar("source_type", { length: 40 }).default("api").notNull(),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    growthExperimentAssignmentsBizIdIdUnique: uniqueIndex(
      "growth_experiment_assignments_biz_id_id_unique",
    ).on(table.bizId, table.id),

    growthExperimentAssignmentsUnique: uniqueIndex(
      "growth_experiment_assignments_unique",
    ).on(table.bizId, table.growthExperimentId, table.subjectType, table.subjectRefId),

    growthExperimentAssignmentsBizVariantStatusIdx: index(
      "growth_experiment_assignments_biz_variant_status_idx",
    ).on(table.bizId, table.growthExperimentVariantId, table.status, table.assignedAt),

    growthExperimentAssignmentsBizExperimentFk: foreignKey({
      columns: [table.bizId, table.growthExperimentId],
      foreignColumns: [growthExperiments.bizId, growthExperiments.id],
      name: "growth_experiment_assignments_biz_experiment_fk",
    }),

    growthExperimentAssignmentsBizVariantFk: foreignKey({
      columns: [table.bizId, table.growthExperimentVariantId],
      foreignColumns: [growthExperimentVariants.bizId, growthExperimentVariants.id],
      name: "growth_experiment_assignments_biz_variant_fk",
    }),

    growthExperimentAssignmentsStatusCheck: check(
      "growth_experiment_assignments_status_check",
      sql`
      "status" IN ('assigned', 'exposed', 'converted', 'excluded', 'failed')
      OR "status" LIKE 'custom_%'
      `,
    ),

    growthExperimentAssignmentsSourceTypeCheck: check(
      "growth_experiment_assignments_source_type_check",
      sql`
      "source_type" IN ('api', 'workflow', 'system', 'import')
      OR "source_type" LIKE 'custom_%'
      `,
    ),

    growthExperimentAssignmentsTimelineCheck: check(
      "growth_experiment_assignments_timeline_check",
      sql`
      ("exposed_at" IS NULL OR "exposed_at" >= "assigned_at")
      AND ("converted_at" IS NULL OR "converted_at" >= COALESCE("exposed_at", "assigned_at"))
      `,
    ),

    growthExperimentAssignmentsConversionValueCheck: check(
      "growth_experiment_assignments_conversion_value_check",
      sql`"conversion_value_minor" IS NULL OR "conversion_value_minor" >= 0`,
    ),

    growthExperimentAssignmentsCurrencyCheck: check(
      "growth_experiment_assignments_currency_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * growth_experiment_measurements
 *
 * ELI5:
 * One row is one observed metric datapoint linked to experiment execution.
 */
export const growthExperimentMeasurements = pgTable(
  "growth_experiment_measurements",
  {
    /** Stable primary key. */
    id: idWithTag("growth_metric"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent experiment. */
    growthExperimentId: idRef("growth_experiment_id")
      .references(() => growthExperiments.id)
      .notNull(),

    /** Optional linked variant. */
    growthExperimentVariantId: idRef("growth_experiment_variant_id").references(
      () => growthExperimentVariants.id,
    ),

    /** Optional linked assignment. */
    growthExperimentAssignmentId: idRef("growth_experiment_assignment_id").references(
      () => growthExperimentAssignments.id,
    ),

    /** Metric identifier (ctr, booking_rate, revenue_per_subject, etc.). */
    metricKey: varchar("metric_key", { length: 120 }).notNull(),

    /** Observed metric value. */
    metricValue: numeric("metric_value", { precision: 18, scale: 6 }).notNull(),

    /** Optional metric unit (ratio, usd_minor, count, seconds, etc.). */
    metricUnit: varchar("metric_unit", { length: 40 }),

    /** Observation timestamp. */
    observedAt: timestamp("observed_at", { withTimezone: true }).defaultNow().notNull(),

    /** Source classification. */
    sourceType: varchar("source_type", { length: 40 }).default("api").notNull(),

    /** Optional upstream source event reference. */
    eventRef: varchar("event_ref", { length: 180 }),

    /** Optional source payload. */
    payload: jsonb("payload").default({}).notNull(),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    growthExperimentMeasurementsBizIdIdUnique: uniqueIndex(
      "growth_experiment_measurements_biz_id_id_unique",
    ).on(table.bizId, table.id),

    growthExperimentMeasurementsBizExperimentMetricIdx: index(
      "growth_experiment_measurements_biz_experiment_metric_idx",
    ).on(table.bizId, table.growthExperimentId, table.metricKey, table.observedAt),

    growthExperimentMeasurementsBizVariantMetricIdx: index(
      "growth_experiment_measurements_biz_variant_metric_idx",
    ).on(table.bizId, table.growthExperimentVariantId, table.metricKey, table.observedAt),

    growthExperimentMeasurementsBizExperimentFk: foreignKey({
      columns: [table.bizId, table.growthExperimentId],
      foreignColumns: [growthExperiments.bizId, growthExperiments.id],
      name: "growth_experiment_measurements_biz_experiment_fk",
    }),

    growthExperimentMeasurementsBizVariantFk: foreignKey({
      columns: [table.bizId, table.growthExperimentVariantId],
      foreignColumns: [growthExperimentVariants.bizId, growthExperimentVariants.id],
      name: "growth_experiment_measurements_biz_variant_fk",
    }),

    growthExperimentMeasurementsBizAssignmentFk: foreignKey({
      columns: [table.bizId, table.growthExperimentAssignmentId],
      foreignColumns: [growthExperimentAssignments.bizId, growthExperimentAssignments.id],
      name: "growth_experiment_measurements_biz_assignment_fk",
    }),

    growthExperimentMeasurementsSourceTypeCheck: check(
      "growth_experiment_measurements_source_type_check",
      sql`
      "source_type" IN ('api', 'workflow', 'system', 'import')
      OR "source_type" LIKE 'custom_%'
      `,
    ),
  }),
);

/**
 * growth_marketing_activations
 *
 * ELI5:
 * One row defines one publish/sync bridge between internal growth objects
 * and an external marketing destination.
 */
export const growthMarketingActivations = pgTable(
  "growth_marketing_activations",
  {
    /** Stable primary key. */
    id: idWithTag("growth_activation"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Stable machine key. */
    key: varchar("key", { length: 160 }).notNull(),

    /** Human-readable activation name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Activation lifecycle status. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Provider key (google_ads, meta_ads, tiktok_ads, custom_partner, etc.). */
    provider: varchar("provider", { length: 80 }).notNull(),

    /** Optional connected channel account pointer. */
    channelAccountId: idRef("channel_account_id").references(() => channelAccounts.id),

    /** Source type for this activation contract. */
    sourceType: varchar("source_type", { length: 40 }).default("experiment_variant").notNull(),

    /** Optional source experiment pointer. */
    growthExperimentId: idRef("growth_experiment_id").references(() => growthExperiments.id),

    /** Optional source experiment variant pointer. */
    growthExperimentVariantId: idRef("growth_experiment_variant_id").references(
      () => growthExperimentVariants.id,
    ),

    /** Optional source campaign pointer. */
    marketingCampaignId: idRef("marketing_campaign_id").references(() => marketingCampaigns.id),

    /** Optional source message template pointer. */
    messageTemplateId: idRef("message_template_id").references(() => messageTemplates.id),

    /** Optional source audience segment pointer. */
    marketingAudienceSegmentId: idRef("marketing_audience_segment_id").references(
      () => marketingAudienceSegments.id,
    ),

    /** Destination-side identifier (campaign id/list id/audience id). */
    destinationRef: varchar("destination_ref", { length: 220 }),

    /** Data movement mode. */
    syncMode: varchar("sync_mode", { length: 40 }).default("push").notNull(),

    /** Publish/sync policy payload. */
    publishPolicy: jsonb("publish_policy").default({}).notNull(),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    growthMarketingActivationsBizIdIdUnique: uniqueIndex(
      "growth_marketing_activations_biz_id_id_unique",
    ).on(table.bizId, table.id),

    growthMarketingActivationsBizKeyUnique: uniqueIndex(
      "growth_marketing_activations_biz_key_unique",
    ).on(table.bizId, table.key),

    growthMarketingActivationsBizStatusProviderIdx: index(
      "growth_marketing_activations_biz_status_provider_idx",
    ).on(table.bizId, table.status, table.provider, table.sourceType),

    growthMarketingActivationsBizChannelAccountFk: foreignKey({
      columns: [table.bizId, table.channelAccountId],
      foreignColumns: [channelAccounts.bizId, channelAccounts.id],
      name: "growth_marketing_activations_biz_channel_account_fk",
    }),

    growthMarketingActivationsBizExperimentFk: foreignKey({
      columns: [table.bizId, table.growthExperimentId],
      foreignColumns: [growthExperiments.bizId, growthExperiments.id],
      name: "growth_marketing_activations_biz_experiment_fk",
    }),

    growthMarketingActivationsBizVariantFk: foreignKey({
      columns: [table.bizId, table.growthExperimentVariantId],
      foreignColumns: [growthExperimentVariants.bizId, growthExperimentVariants.id],
      name: "growth_marketing_activations_biz_variant_fk",
    }),

    growthMarketingActivationsBizCampaignFk: foreignKey({
      columns: [table.bizId, table.marketingCampaignId],
      foreignColumns: [marketingCampaigns.bizId, marketingCampaigns.id],
      name: "growth_marketing_activations_biz_campaign_fk",
    }),

    growthMarketingActivationsBizTemplateFk: foreignKey({
      columns: [table.bizId, table.messageTemplateId],
      foreignColumns: [messageTemplates.bizId, messageTemplates.id],
      name: "growth_marketing_activations_biz_template_fk",
    }),

    growthMarketingActivationsBizAudienceSegmentFk: foreignKey({
      columns: [table.bizId, table.marketingAudienceSegmentId],
      foreignColumns: [marketingAudienceSegments.bizId, marketingAudienceSegments.id],
      name: "growth_marketing_activations_biz_audience_segment_fk",
    }),

    growthMarketingActivationsSourceTypeCheck: check(
      "growth_marketing_activations_source_type_check",
      sql`
      "source_type" IN ('experiment', 'experiment_variant', 'campaign', 'template', 'audience_segment', 'custom')
      OR "source_type" LIKE 'custom_%'
      `,
    ),

    growthMarketingActivationsSyncModeCheck: check(
      "growth_marketing_activations_sync_mode_check",
      sql`
      "sync_mode" IN ('push', 'pull', 'bidirectional')
      OR "sync_mode" LIKE 'custom_%'
      `,
    ),

    growthMarketingActivationsSourceShapeCheck: check(
      "growth_marketing_activations_source_shape_check",
      sql`
      (
        ("growth_experiment_id" IS NOT NULL)::int
        + ("growth_experiment_variant_id" IS NOT NULL)::int
        + ("marketing_campaign_id" IS NOT NULL)::int
        + ("message_template_id" IS NOT NULL)::int
        + ("marketing_audience_segment_id" IS NOT NULL)::int
      ) >= 1
      `,
    ),
  }),
);

/**
 * growth_marketing_activation_runs
 *
 * ELI5:
 * One row is one publish/sync execution for one activation contract.
 */
export const growthMarketingActivationRuns = pgTable(
  "growth_marketing_activation_runs",
  {
    /** Stable primary key. */
    id: idWithTag("growth_activation_run"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent activation contract. */
    growthMarketingActivationId: idRef("growth_marketing_activation_id")
      .references(() => growthMarketingActivations.id)
      .notNull(),

    /** Run lifecycle status. */
    status: varchar("status", { length: 40 }).default("queued").notNull(),

    /** Trigger source for this run. */
    triggerSource: varchar("trigger_source", { length: 40 }).default("manual").notNull(),

    /** Optional trigger reference id (workflow run, hook invocation, schedule id, etc.). */
    triggerRefId: varchar("trigger_ref_id", { length: 160 }),

    /** Optional initiating user. */
    initiatedByUserId: idRef("initiated_by_user_id").references(() => users.id),

    /** Start timestamp. */
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),

    /** Completion timestamp. */
    finishedAt: timestamp("finished_at", { withTimezone: true }),

    /** Input payload captured at run start. */
    inputPayload: jsonb("input_payload").default({}).notNull(),

    /** Output payload captured at run completion. */
    outputPayload: jsonb("output_payload").default({}).notNull(),

    /** Failure classification code. */
    errorCode: varchar("error_code", { length: 120 }),

    /** Failure description. */
    errorMessage: text("error_message"),

    /** Output counters for reporting. */
    publishedCount: integer("published_count").default(0).notNull(),
    syncedCount: integer("synced_count").default(0).notNull(),
    failedCount: integer("failed_count").default(0).notNull(),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    growthMarketingActivationRunsBizIdIdUnique: uniqueIndex(
      "growth_marketing_activation_runs_biz_id_id_unique",
    ).on(table.bizId, table.id),

    growthMarketingActivationRunsBizActivationStatusIdx: index(
      "growth_marketing_activation_runs_biz_activation_status_idx",
    ).on(table.bizId, table.growthMarketingActivationId, table.status, table.startedAt),

    growthMarketingActivationRunsBizActivationFk: foreignKey({
      columns: [table.bizId, table.growthMarketingActivationId],
      foreignColumns: [growthMarketingActivations.bizId, growthMarketingActivations.id],
      name: "growth_marketing_activation_runs_biz_activation_fk",
    }),

    growthMarketingActivationRunsStatusCheck: check(
      "growth_marketing_activation_runs_status_check",
      sql`
      "status" IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'partial')
      OR "status" LIKE 'custom_%'
      `,
    ),

    growthMarketingActivationRunsTriggerSourceCheck: check(
      "growth_marketing_activation_runs_trigger_source_check",
      sql`
      "trigger_source" IN ('manual', 'workflow', 'lifecycle_hook', 'schedule', 'system', 'api')
      OR "trigger_source" LIKE 'custom_%'
      `,
    ),

    growthMarketingActivationRunsCountsCheck: check(
      "growth_marketing_activation_runs_counts_check",
      sql`
      "published_count" >= 0
      AND "synced_count" >= 0
      AND "failed_count" >= 0
      `,
    ),

    growthMarketingActivationRunsWindowCheck: check(
      "growth_marketing_activation_runs_window_check",
      sql`"finished_at" IS NULL OR "finished_at" >= "started_at"`,
    ),
  }),
);

/**
 * growth_marketing_activation_run_items
 *
 * ELI5:
 * One row is one item-level publish/sync outcome within an activation run.
 */
export const growthMarketingActivationRunItems = pgTable(
  "growth_marketing_activation_run_items",
  {
    /** Stable primary key. */
    id: idWithTag("growth_activation_item"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent activation run. */
    growthMarketingActivationRunId: idRef("growth_marketing_activation_run_id")
      .references(() => growthMarketingActivationRuns.id)
      .notNull(),

    /** Item class (creative, audience_member, conversion, etc.). */
    itemType: varchar("item_type", { length: 80 }).notNull(),

    /** Optional local item ref id. */
    itemRefId: varchar("item_ref_id", { length: 180 }),

    /** Optional provider-side item ref id. */
    externalRef: varchar("external_ref", { length: 220 }),

    /** Item-level execution status. */
    status: varchar("status", { length: 40 }).default("planned").notNull(),

    /** Item-level error code. */
    errorCode: varchar("error_code", { length: 120 }),

    /** Item-level error message. */
    errorMessage: text("error_message"),

    /** Item payload. */
    payload: jsonb("payload").default({}).notNull(),

    /** Extensible payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    growthMarketingActivationRunItemsBizIdIdUnique: uniqueIndex(
      "growth_marketing_activation_run_items_biz_id_id_unique",
    ).on(table.bizId, table.id),

    growthMarketingActivationRunItemsBizRunStatusIdx: index(
      "growth_marketing_activation_run_items_biz_run_status_idx",
    ).on(table.bizId, table.growthMarketingActivationRunId, table.status, table.itemType),

    growthMarketingActivationRunItemsBizRunFk: foreignKey({
      columns: [table.bizId, table.growthMarketingActivationRunId],
      foreignColumns: [growthMarketingActivationRuns.bizId, growthMarketingActivationRuns.id],
      name: "growth_marketing_activation_run_items_biz_run_fk",
    }),

    growthMarketingActivationRunItemsStatusCheck: check(
      "growth_marketing_activation_run_items_status_check",
      sql`
      "status" IN ('planned', 'published', 'synced', 'failed', 'skipped')
      OR "status" LIKE 'custom_%'
      `,
    ),
  }),
);

export type GrowthLocalizationResource = typeof growthLocalizationResources.$inferSelect;
export type NewGrowthLocalizationResource = typeof growthLocalizationResources.$inferInsert;
export type GrowthLocalizationValue = typeof growthLocalizationValues.$inferSelect;
export type NewGrowthLocalizationValue = typeof growthLocalizationValues.$inferInsert;
export type GrowthExperiment = typeof growthExperiments.$inferSelect;
export type NewGrowthExperiment = typeof growthExperiments.$inferInsert;
export type GrowthExperimentVariant = typeof growthExperimentVariants.$inferSelect;
export type NewGrowthExperimentVariant = typeof growthExperimentVariants.$inferInsert;
export type GrowthExperimentAssignment = typeof growthExperimentAssignments.$inferSelect;
export type NewGrowthExperimentAssignment = typeof growthExperimentAssignments.$inferInsert;
export type GrowthExperimentMeasurement = typeof growthExperimentMeasurements.$inferSelect;
export type NewGrowthExperimentMeasurement = typeof growthExperimentMeasurements.$inferInsert;
export type GrowthMarketingActivation = typeof growthMarketingActivations.$inferSelect;
export type NewGrowthMarketingActivation = typeof growthMarketingActivations.$inferInsert;
export type GrowthMarketingActivationRun = typeof growthMarketingActivationRuns.$inferSelect;
export type NewGrowthMarketingActivationRun = typeof growthMarketingActivationRuns.$inferInsert;
export type GrowthMarketingActivationRunItem = typeof growthMarketingActivationRunItems.$inferSelect;
export type NewGrowthMarketingActivationRunItem = typeof growthMarketingActivationRunItems.$inferInsert;
