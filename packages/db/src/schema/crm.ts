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
import { bizConfigValues } from "./biz_configs";
import { outboundMessages } from "./communications";
import { lifecycleStatusEnum } from "./enums";
import { groupAccounts } from "./group_accounts";
import { locations } from "./locations";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * crm_contacts
 *
 * ELI5:
 * This is the shared "person/account contact card" backbone for CRM.
 *
 * Why this table exists:
 * - without this, lead/opportunity/conversation tables each repeat their own
 *   user/group/email/phone ownership shapes,
 * - with this table, contact identity is defined once and reused everywhere.
 *
 * Contact shape:
 * - `user`: points to one platform user
 * - `group_account`: points to one shared/group account
 * - `external`: non-auth contact with external ref + profile fields
 *
 * This keeps schema fungible while preserving strong relational integrity.
 */
export const crmContacts = pgTable(
  "crm_contacts",
  {
    /** Stable primary key for one CRM contact card. */
    id: idWithTag("crm_contact"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Contact lifecycle state. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Contact shape discriminator. */
    contactType: varchar("contact_type", { length: 40 }).notNull(),

    /** Pointer when `contact_type='user'`. */
    userId: idRef("user_id").references(() => users.id),

    /** Pointer when `contact_type='group_account'`. */
    groupAccountId: idRef("group_account_id").references(() => groupAccounts.id),

    /** External stable ref when `contact_type='external'`. */
    externalContactRef: varchar("external_contact_ref", { length: 220 }),

    /** Human display name for this contact. */
    displayName: varchar("display_name", { length: 220 }),

    /** Primary email for messaging/routing. */
    email: varchar("email", { length: 320 }),

    /** Primary phone for messaging/routing. */
    phone: varchar("phone", { length: 80 }),

    /** Optional source class (ads/import/manual/api/etc.). */
    sourceType: varchar("source_type", { length: 80 }),

    /** Optional source identifier from provider/import pipeline. */
    sourceRef: varchar("source_ref", { length: 220 }),

    /** Optional structured profile payload. */
    profile: jsonb("profile").default({}).notNull(),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    crmContactsBizIdIdUnique: uniqueIndex("crm_contacts_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe references from CRM entities. */

    /** One CRM contact card per user in one tenant. */
    crmContactsBizUserUnique: uniqueIndex("crm_contacts_biz_user_unique")
      .on(table.bizId, table.userId)
      .where(sql`"user_id" IS NOT NULL`),

    /** One CRM contact card per group-account in one tenant. */
    crmContactsBizGroupUnique: uniqueIndex("crm_contacts_biz_group_unique")
      .on(table.bizId, table.groupAccountId)
      .where(sql`"group_account_id" IS NOT NULL`),

    /** External contact dedupe aid. */
    crmContactsBizExternalUnique: uniqueIndex("crm_contacts_biz_external_unique")
      .on(table.bizId, table.externalContactRef)
      .where(sql`"external_contact_ref" IS NOT NULL`),

    /** Source-based dedupe aid when source refs are available. */
    crmContactsBizSourceUnique: uniqueIndex("crm_contacts_biz_source_unique")
      .on(table.bizId, table.sourceType, table.sourceRef)
      .where(sql`"source_type" IS NOT NULL AND "source_ref" IS NOT NULL`),

    /** Contact lookup path by display fields. */
    crmContactsBizStatusDisplayIdx: index("crm_contacts_biz_status_display_idx").on(
      table.bizId,
      table.status,
      table.displayName,
      table.email,
    ),
    /** Tenant-safe FK to optional group-account contact anchor. */
    crmContactsBizGroupAccountFk: foreignKey({
      columns: [table.bizId, table.groupAccountId],
      foreignColumns: [groupAccounts.bizId, groupAccounts.id],
      name: "crm_contacts_biz_group_account_fk",
    }),

    /** Contact type vocabulary remains extensible. */
    crmContactsTypeCheck: check(
      "crm_contacts_type_check",
      sql`
      "contact_type" IN ('user', 'group_account', 'external')
      OR "contact_type" LIKE 'custom_%'
      `,
    ),

    /** Contact payload must match contact type exactly. */
    crmContactsShapeCheck: check(
      "crm_contacts_shape_check",
      sql`
      (
        "contact_type" = 'user'
        AND "user_id" IS NOT NULL
        AND "group_account_id" IS NULL
      ) OR (
        "contact_type" = 'group_account'
        AND "user_id" IS NULL
        AND "group_account_id" IS NOT NULL
      ) OR (
        "contact_type" = 'external'
        AND "user_id" IS NULL
        AND "group_account_id" IS NULL
        AND "external_contact_ref" IS NOT NULL
      ) OR (
        "contact_type" LIKE 'custom_%'
      )
      `,
    ),
  }),
);

/**
 * crm_contact_channels
 *
 * ELI5:
 * This table stores reusable contact endpoints for one CRM contact card.
 *
 * Why this matters:
 * - avoids repeating raw email/phone handles across every messaging table,
 * - gives one normalization point for verification/opt-out state,
 * - lets many domains (CRM inbox, gift delivery, campaigns) reference the
 *   same canonical channel endpoint.
 */
export const crmContactChannels = pgTable(
  "crm_contact_channels",
  {
    /** Stable primary key for one contact endpoint row. */
    id: idWithTag("crm_contact_channel"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent CRM contact that owns this endpoint. */
    crmContactId: idRef("crm_contact_id")
      .references(() => crmContacts.id)
      .notNull(),

    /**
     * Endpoint channel type.
     * Keep extensible so plugins can introduce channel families.
     */
    channelType: varchar("channel_type", { length: 40 }).notNull(),

    /** Actual destination address/identifier for this channel. */
    channelAddress: varchar("channel_address", { length: 500 }).notNull(),

    /** Lifecycle state of endpoint usability. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Optional user-facing label ("work email", "primary phone"). */
    label: varchar("label", { length: 120 }),

    /** Primary endpoint marker per channel type for this contact. */
    isPrimary: boolean("is_primary").default(false).notNull(),

    /** Last verification timestamp. */
    verifiedAt: timestamp("verified_at", { withTimezone: true }),

    /** Opt-out timestamp when this endpoint should no longer be used. */
    optedOutAt: timestamp("opted_out_at", { withTimezone: true }),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key used by downstream composite FKs. */
    crmContactChannelsBizIdIdUnique: uniqueIndex(
      "crm_contact_channels_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Composite key that includes contact id for strict channel->contact linkage. */
    crmContactChannelsBizIdIdContactUnique: uniqueIndex(
      "crm_contact_channels_biz_id_id_contact_unique",
    ).on(table.bizId, table.id, table.crmContactId),

    /** De-duplicate same endpoint per contact+channel in one tenant. */
    crmContactChannelsEndpointUnique: uniqueIndex(
      "crm_contact_channels_endpoint_unique",
    )
      .on(table.bizId, table.crmContactId, table.channelType, table.channelAddress)
      .where(sql`"deleted_at" IS NULL`),

    /** One active primary endpoint per contact per channel type. */
    crmContactChannelsPrimaryUnique: uniqueIndex(
      "crm_contact_channels_primary_unique",
    )
      .on(table.bizId, table.crmContactId, table.channelType)
      .where(sql`"is_primary" = true AND "status" = 'active' AND "deleted_at" IS NULL`),

    /** Endpoint lookup path by contact. */
    crmContactChannelsBizContactStatusIdx: index(
      "crm_contact_channels_biz_contact_status_idx",
    ).on(table.bizId, table.crmContactId, table.status, table.channelType),

    /** Tenant-safe FK to contact. */
    crmContactChannelsBizContactFk: foreignKey({
      columns: [table.bizId, table.crmContactId],
      foreignColumns: [crmContacts.bizId, crmContacts.id],
      name: "crm_contact_channels_biz_contact_fk",
    }),

    /** Channel vocabulary remains extensible. */
    crmContactChannelsTypeCheck: check(
      "crm_contact_channels_type_check",
      sql`
      "channel_type" IN ('email', 'sms', 'phone', 'push', 'whatsapp', 'in_app')
      OR "channel_type" LIKE 'custom_%'
      `,
    ),

    /** Address and timestamp sanity checks. */
    crmContactChannelsBoundsCheck: check(
      "crm_contact_channels_bounds_check",
      sql`
      length("channel_address") > 0
      AND ("opted_out_at" IS NULL OR "verified_at" IS NULL OR "opted_out_at" >= "verified_at")
      `,
    ),
  }),
);

/**
 * crm_pipelines
 *
 * ELI5:
 * One pipeline is one board definition for staged business flow.
 *
 * Common uses:
 * - lead qualification board
 * - opportunity/deal board
 * - custom pipeline per workflow extension
 */
export const crmPipelines = pgTable(
  "crm_pipelines",
  {
    /** Stable primary key for one pipeline definition. */
    id: idWithTag("crm_pipeline"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human pipeline name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable machine slug for API/import routing. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Lifecycle state for this pipeline definition. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /**
     * Pipeline model type.
     * Examples: lead, opportunity, custom_*
     */
    pipelineType: varchar("pipeline_type", { length: 40 })
      .default("opportunity")
      .notNull(),

    /** Whether this pipeline is the default for its type. */
    isDefault: boolean("is_default").default(false).notNull(),

    /** Optional long description/instructions for operators. */
    description: text("description"),

    /** Extensible pipeline policy payload. */
    policy: jsonb("policy").default({}).notNull(),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    crmPipelinesBizIdIdUnique: uniqueIndex("crm_pipelines_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe stage/opportunity/lead references. */

    /** One slug per tenant. */
    crmPipelinesBizSlugUnique: uniqueIndex("crm_pipelines_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),

    /** At most one active default pipeline per type. */
    crmPipelinesDefaultPerTypeUnique: uniqueIndex(
      "crm_pipelines_default_per_type_unique",
    )
      .on(table.bizId, table.pipelineType)
      .where(sql`"is_default" = true AND "status" = 'active' AND "deleted_at" IS NULL`),

    /** Board listing path. */
    crmPipelinesBizTypeStatusIdx: index("crm_pipelines_biz_type_status_idx").on(
      table.bizId,
      table.pipelineType,
      table.status,
    ),

    /** Pipeline type vocabulary remains extensible. */
    crmPipelinesTypeCheck: check(
      "crm_pipelines_type_check",
      sql`
      "pipeline_type" IN ('lead', 'opportunity')
      OR "pipeline_type" LIKE 'custom_%'
      `,
    ),
  }),
);

/**
 * crm_pipeline_stages
 *
 * ELI5:
 * Stages are the columns inside one CRM pipeline board.
 */
export const crmPipelineStages = pgTable(
  "crm_pipeline_stages",
  {
    /** Stable primary key for one stage definition. */
    id: idWithTag("crm_stage"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent pipeline. */
    crmPipelineId: idRef("crm_pipeline_id")
      .references(() => crmPipelines.id)
      .notNull(),

    /** Stage label shown in boards. */
    name: varchar("name", { length: 180 }).notNull(),

    /** Stable stage slug unique within one pipeline. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Lifecycle state for stage definition. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Board ordering position. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Marks a terminal "won" stage. */
    isClosedWon: boolean("is_closed_won").default(false).notNull(),

    /** Marks a terminal "lost" stage. */
    isClosedLost: boolean("is_closed_lost").default(false).notNull(),

    /**
     * Default probability hint in basis points for forecasting.
     * 10000 = 100%.
     */
    defaultProbabilityBps: integer("default_probability_bps").default(0).notNull(),

    /** Optional stage policy payload (SLA gates, required fields, etc.). */
    stagePolicy: jsonb("stage_policy").default({}).notNull(),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe FK from lead/opportunity rows. */
    crmPipelineStagesBizIdIdUnique: uniqueIndex(
      "crm_pipeline_stages_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One stage slug per pipeline. */
    crmPipelineStagesSlugUnique: uniqueIndex("crm_pipeline_stages_slug_unique").on(
      table.crmPipelineId,
      table.slug,
    ),

    /** One stage position per pipeline. */
    crmPipelineStagesSortUnique: uniqueIndex("crm_pipeline_stages_sort_unique").on(
      table.crmPipelineId,
      table.sortOrder,
    ),

    /** Stage board render path. */
    crmPipelineStagesBizPipelineSortIdx: index(
      "crm_pipeline_stages_biz_pipeline_sort_idx",
    ).on(table.bizId, table.crmPipelineId, table.sortOrder),

    /** Tenant-safe FK to pipeline. */
    crmPipelineStagesBizPipelineFk: foreignKey({
      columns: [table.bizId, table.crmPipelineId],
      foreignColumns: [crmPipelines.bizId, crmPipelines.id],
      name: "crm_pipeline_stages_biz_pipeline_fk",
    }),

    /** Stage bounds and exclusivity checks. */
    crmPipelineStagesBoundsCheck: check(
      "crm_pipeline_stages_bounds_check",
      sql`
      "sort_order" >= 0
      AND "default_probability_bps" BETWEEN 0 AND 10000
      AND NOT ("is_closed_won" = true AND "is_closed_lost" = true)
      `,
    ),
  }),
);

/**
 * crm_leads
 *
 * ELI5:
 * One row = one lead lifecycle card tied to one reusable CRM contact.
 *
 * Why this table exists:
 * - queue/workflow can process lead-like objects,
 * - this table adds a dedicated lead lifecycle identity for CRM analytics,
 *   ownership, scoring, and conversion tracking.
 */
export const crmLeads = pgTable(
  "crm_leads",
  {
    /** Stable lead id. */
    id: idWithTag("crm_lead"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Current lead lifecycle status. */
    status: varchar("status", { length: 40 }).default("new").notNull(),
    /** Optional configurable dictionary value for lead-status wording. */
    statusConfigValueId: idRef("status_config_value_id"),

    /** Optional source type (ads, referral, manual, api, etc.). */
    sourceType: varchar("source_type", { length: 80 }),

    /** Optional source reference id (provider lead id, webhook id, etc.). */
    sourceRef: varchar("source_ref", { length: 220 }),

    /**
     * Shared contact identity for this lead.
     * This keeps contact shape centralized in `crm_contacts`.
     */
    crmContactId: idRef("crm_contact_id")
      .references(() => crmContacts.id)
      .notNull(),

    /** Optional location scope tied to this lead. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Pipeline used for this lead board flow. */
    crmPipelineId: idRef("crm_pipeline_id").references(() => crmPipelines.id),

    /** Current stage in the selected pipeline. */
    crmPipelineStageId: idRef("crm_pipeline_stage_id").references(
      () => crmPipelineStages.id,
    ),

    /** Owner user handling this lead. */
    ownerUserId: idRef("owner_user_id").references(() => users.id),

    /** Qualification/relevance score in basis points. */
    scoreBps: integer("score_bps").default(0).notNull(),

    /** Priority scalar for inbox and assignment ordering. */
    priority: integer("priority").default(100).notNull(),

    /** When lead became qualified. */
    qualifiedAt: timestamp("qualified_at", { withTimezone: true }),

    /** When lead was converted into customer/opportunity flow. */
    convertedAt: timestamp("converted_at", { withTimezone: true }),

    /** When lead was explicitly marked lost. */
    lostAt: timestamp("lost_at", { withTimezone: true }),

    /** Optional plain-language notes. */
    notes: text("notes"),

    /** Lead attributes payload (custom fields snapshot, ad params, etc.). */
    attributes: jsonb("attributes").default({}).notNull(),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    crmLeadsBizIdIdUnique: uniqueIndex("crm_leads_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe event/opportunity references. */

    /** Source dedupe aid when provider lead refs are available. */
    crmLeadsSourceUnique: uniqueIndex("crm_leads_source_unique")
      .on(table.bizId, table.sourceType, table.sourceRef)
      .where(sql`"source_type" IS NOT NULL AND "source_ref" IS NOT NULL`),

    /** Lead board path by status/priority. */
    crmLeadsBizStatusPriorityIdx: index("crm_leads_biz_status_priority_idx").on(
      table.bizId,
      table.status,
      table.priority,
      table.scoreBps,
    ),
    /** Configurable lifecycle board path. */
    crmLeadsBizStatusConfigPriorityIdx: index(
      "crm_leads_biz_status_config_priority_idx",
    ).on(table.bizId, table.statusConfigValueId, table.priority, table.scoreBps),

    /** Contact timeline/history path. */
    crmLeadsBizContactStatusIdx: index("crm_leads_biz_contact_status_idx").on(
      table.bizId,
      table.crmContactId,
      table.status,
    ),

    /** Owner inbox path. */
    crmLeadsBizOwnerStatusIdx: index("crm_leads_biz_owner_status_idx").on(
      table.bizId,
      table.ownerUserId,
      table.status,
    ),

    /** Tenant-safe FK to selected pipeline. */
    crmLeadsBizPipelineFk: foreignKey({
      columns: [table.bizId, table.crmPipelineId],
      foreignColumns: [crmPipelines.bizId, crmPipelines.id],
      name: "crm_leads_biz_pipeline_fk",
    }),

    /** Tenant-safe FK to selected pipeline stage. */
    crmLeadsBizStageFk: foreignKey({
      columns: [table.bizId, table.crmPipelineStageId],
      foreignColumns: [crmPipelineStages.bizId, crmPipelineStages.id],
      name: "crm_leads_biz_stage_fk",
    }),

    /** Tenant-safe FK to optional location scope. */
    crmLeadsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "crm_leads_biz_location_fk",
    }),

    /** Tenant-safe FK to shared CRM contact. */
    crmLeadsBizContactFk: foreignKey({
      columns: [table.bizId, table.crmContactId],
      foreignColumns: [crmContacts.bizId, crmContacts.id],
      name: "crm_leads_biz_contact_fk",
    }),
    /** Tenant-safe FK to optional configured status dictionary value. */
    crmLeadsBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "crm_leads_biz_status_config_fk",
    }),

    /** Lead status vocabulary remains extensible. */
    crmLeadsStatusCheck: check(
      "crm_leads_status_check",
      sql`
      "status" IN ('new', 'contacted', 'qualified', 'unqualified', 'nurturing', 'converted', 'lost')
      OR "status" LIKE 'custom_%'
      `,
    ),

    /** Score/priority bounds and pipeline-stage pair checks. */
    crmLeadsBoundsCheck: check(
      "crm_leads_bounds_check",
      sql`
      "score_bps" BETWEEN 0 AND 10000
      AND "priority" >= 0
      AND (
        ("crm_pipeline_id" IS NULL AND "crm_pipeline_stage_id" IS NULL)
        OR ("crm_pipeline_id" IS NOT NULL AND "crm_pipeline_stage_id" IS NOT NULL)
      )
      `,
    ),

    /** Converted/lost status should carry expected timeline fields. */
    crmLeadsStatusShapeCheck: check(
      "crm_leads_status_shape_check",
      sql`
      ("status" <> 'converted' OR "converted_at" IS NOT NULL)
      AND ("status" <> 'lost' OR "lost_at" IS NOT NULL)
      `,
    ),
  }),
);

/**
 * crm_lead_events
 *
 * ELI5:
 * Immutable-ish timeline of lead lifecycle events.
 */
export const crmLeadEvents = pgTable(
  "crm_lead_events",
  {
    /** Stable event id. */
    id: idWithTag("crm_lead_event"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent lead. */
    crmLeadId: idRef("crm_lead_id")
      .references(() => crmLeads.id)
      .notNull(),

    /** Event type key. */
    eventType: varchar("event_type", { length: 80 }).notNull(),

    /** Optional previous status snapshot. */
    fromStatus: varchar("from_status", { length: 40 }),

    /** Optional new status snapshot. */
    toStatus: varchar("to_status", { length: 40 }),

    /** Optional actor user who triggered the event. */
    actorUserId: idRef("actor_user_id").references(() => users.id),

    /** Event timestamp. */
    happenedAt: timestamp("happened_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional human-readable note. */
    note: text("note"),

    /** Event payload snapshot. */
    payload: jsonb("payload").default({}).notNull(),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    crmLeadEventsBizIdIdUnique: uniqueIndex("crm_lead_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Timeline path per lead. */
    crmLeadEventsBizLeadHappenedIdx: index("crm_lead_events_biz_lead_happened_idx").on(
      table.bizId,
      table.crmLeadId,
      table.happenedAt,
    ),

    /** Event analytics path. */
    crmLeadEventsBizTypeHappenedIdx: index("crm_lead_events_biz_type_happened_idx").on(
      table.bizId,
      table.eventType,
      table.happenedAt,
    ),

    /** Tenant-safe FK to lead. */
    crmLeadEventsBizLeadFk: foreignKey({
      columns: [table.bizId, table.crmLeadId],
      foreignColumns: [crmLeads.bizId, crmLeads.id],
      name: "crm_lead_events_biz_lead_fk",
    }),
  }),
);

/**
 * crm_opportunities
 *
 * ELI5:
 * One row is one commercial opportunity/deal moving through a pipeline.
 */
export const crmOpportunities = pgTable(
  "crm_opportunities",
  {
    /** Stable opportunity id. */
    id: idWithTag("crm_opportunity"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Current opportunity status. */
    status: varchar("status", { length: 40 }).default("open").notNull(),
    /** Optional configurable dictionary value for opportunity-status wording. */
    statusConfigValueId: idRef("status_config_value_id"),

    /** Parent pipeline. */
    crmPipelineId: idRef("crm_pipeline_id")
      .references(() => crmPipelines.id)
      .notNull(),

    /** Current stage in pipeline. */
    crmPipelineStageId: idRef("crm_pipeline_stage_id")
      .references(() => crmPipelineStages.id)
      .notNull(),

    /** Opportunity title shown in board cards. */
    title: varchar("title", { length: 260 }).notNull(),

    /** Optional long description. */
    description: text("description"),

    /** Optional primary originating lead. */
    primaryCrmLeadId: idRef("primary_crm_lead_id").references(() => crmLeads.id),

    /** Opportunity owner user. */
    ownerUserId: idRef("owner_user_id").references(() => users.id),

    /**
     * Shared contact identity for this opportunity.
     * Optional because some opportunities can be opened before a contact card
     * is fully identified/resolved.
     */
    crmContactId: idRef("crm_contact_id").references(() => crmContacts.id),

    /** Forecast/target amount in minor units. */
    estimatedAmountMinor: integer("estimated_amount_minor").default(0).notNull(),

    /** Committed amount (after stronger confidence/approval). */
    committedAmountMinor: integer("committed_amount_minor").default(0).notNull(),

    /** Weighted amount used for forecast rollups. */
    weightedAmountMinor: integer("weighted_amount_minor").default(0).notNull(),

    /** Currency for money columns. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Probability in basis points (0..10000). */
    probabilityBps: integer("probability_bps").default(0).notNull(),

    /** Optional expected close timestamp. */
    expectedCloseAt: timestamp("expected_close_at", { withTimezone: true }),

    /** Won timestamp. */
    wonAt: timestamp("won_at", { withTimezone: true }),

    /** Lost timestamp. */
    lostAt: timestamp("lost_at", { withTimezone: true }),

    /** Optional reason code for lost/closed outcomes. */
    closedReasonCode: varchar("closed_reason_code", { length: 120 }),

    /** Optional source class (lead/manual/import/channel/etc.). */
    sourceType: varchar("source_type", { length: 80 }),

    /** Optional source reference id. */
    sourceRef: varchar("source_ref", { length: 220 }),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    crmOpportunitiesBizIdIdUnique: uniqueIndex("crm_opportunities_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe stage-event/conversation links. */

    /** Board listing path. */
    crmOpportunitiesBizStageStatusIdx: index(
      "crm_opportunities_biz_stage_status_idx",
    ).on(table.bizId, table.crmPipelineStageId, table.status, table.probabilityBps),
    /** Configurable lifecycle board path. */
    crmOpportunitiesBizStatusConfigStageIdx: index(
      "crm_opportunities_biz_status_config_stage_idx",
    ).on(table.bizId, table.statusConfigValueId, table.crmPipelineStageId, table.probabilityBps),

    /** Owner inbox path. */
    crmOpportunitiesBizOwnerStatusIdx: index(
      "crm_opportunities_biz_owner_status_idx",
    ).on(table.bizId, table.ownerUserId, table.status),

    /** Forecast timeline path. */
    crmOpportunitiesBizExpectedCloseIdx: index(
      "crm_opportunities_biz_expected_close_idx",
    ).on(table.bizId, table.expectedCloseAt, table.status),

    /** Contact history/forecast path. */
    crmOpportunitiesBizContactStatusIdx: index(
      "crm_opportunities_biz_contact_status_idx",
    ).on(table.bizId, table.crmContactId, table.status, table.expectedCloseAt),

    /** Tenant-safe FK to pipeline. */
    crmOpportunitiesBizPipelineFk: foreignKey({
      columns: [table.bizId, table.crmPipelineId],
      foreignColumns: [crmPipelines.bizId, crmPipelines.id],
      name: "crm_opportunities_biz_pipeline_fk",
    }),

    /** Tenant-safe FK to stage. */
    crmOpportunitiesBizStageFk: foreignKey({
      columns: [table.bizId, table.crmPipelineStageId],
      foreignColumns: [crmPipelineStages.bizId, crmPipelineStages.id],
      name: "crm_opportunities_biz_stage_fk",
    }),

    /** Tenant-safe FK to optional primary lead. */
    crmOpportunitiesBizLeadFk: foreignKey({
      columns: [table.bizId, table.primaryCrmLeadId],
      foreignColumns: [crmLeads.bizId, crmLeads.id],
      name: "crm_opportunities_biz_lead_fk",
    }),

    /** Tenant-safe FK to shared CRM contact. */
    crmOpportunitiesBizContactFk: foreignKey({
      columns: [table.bizId, table.crmContactId],
      foreignColumns: [crmContacts.bizId, crmContacts.id],
      name: "crm_opportunities_biz_contact_fk",
    }),
    /** Tenant-safe FK to optional configured status dictionary value. */
    crmOpportunitiesBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "crm_opportunities_biz_status_config_fk",
    }),

    /** Opportunity status vocabulary remains extensible. */
    crmOpportunitiesStatusCheck: check(
      "crm_opportunities_status_check",
      sql`
      "status" IN ('open', 'won', 'lost', 'stalled', 'abandoned')
      OR "status" LIKE 'custom_%'
      `,
    ),

    /** Core forecasting and money invariants. */
    crmOpportunitiesBoundsCheck: check(
      "crm_opportunities_bounds_check",
      sql`
      "estimated_amount_minor" >= 0
      AND "committed_amount_minor" >= 0
      AND "weighted_amount_minor" >= 0
      AND "probability_bps" BETWEEN 0 AND 10000
      AND "weighted_amount_minor" <= "estimated_amount_minor"
      `,
    ),

    /** Won/lost statuses should carry expected close timestamps. */
    crmOpportunitiesStatusShapeCheck: check(
      "crm_opportunities_status_shape_check",
      sql`
      ("status" <> 'won' OR "won_at" IS NOT NULL)
      AND ("status" <> 'lost' OR "lost_at" IS NOT NULL)
      `,
    ),

    /** Currency shape should remain uppercase ISO-like. */
    crmOpportunitiesCurrencyFormatCheck: check(
      "crm_opportunities_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * crm_opportunity_stage_events
 *
 * ELI5:
 * Timeline ledger for opportunity movement and stage transitions.
 */
export const crmOpportunityStageEvents = pgTable(
  "crm_opportunity_stage_events",
  {
    /** Stable stage-event id. */
    id: idWithTag("crm_opp_stage_event"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent opportunity. */
    crmOpportunityId: idRef("crm_opportunity_id")
      .references(() => crmOpportunities.id)
      .notNull(),

    /** Optional prior stage id. */
    fromCrmPipelineStageId: idRef("from_crm_pipeline_stage_id").references(
      () => crmPipelineStages.id,
    ),

    /** Optional new stage id. */
    toCrmPipelineStageId: idRef("to_crm_pipeline_stage_id").references(
      () => crmPipelineStages.id,
    ),

    /** Event type key. */
    eventType: varchar("event_type", { length: 60 }).default("moved").notNull(),

    /** Optional actor user. */
    actorUserId: idRef("actor_user_id").references(() => users.id),

    /** Event timestamp. */
    happenedAt: timestamp("happened_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional note. */
    note: text("note"),

    /** Event payload snapshot. */
    payload: jsonb("payload").default({}).notNull(),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    crmOpportunityStageEventsBizIdIdUnique: uniqueIndex("crm_opportunity_stage_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Opportunity timeline query path. */
    crmOpportunityStageEventsBizOpportunityHappenedIdx: index(
      "crm_opportunity_stage_events_biz_opportunity_happened_idx",
    ).on(table.bizId, table.crmOpportunityId, table.happenedAt),

    /** Event analytics path. */
    crmOpportunityStageEventsBizTypeHappenedIdx: index(
      "crm_opportunity_stage_events_biz_type_happened_idx",
    ).on(table.bizId, table.eventType, table.happenedAt),

    /** Tenant-safe FK to opportunity. */
    crmOpportunityStageEventsBizOpportunityFk: foreignKey({
      columns: [table.bizId, table.crmOpportunityId],
      foreignColumns: [crmOpportunities.bizId, crmOpportunities.id],
      name: "crm_opportunity_stage_events_biz_opportunity_fk",
    }),

    /** Event type vocabulary remains extensible. */
    crmOpportunityStageEventsTypeCheck: check(
      "crm_opportunity_stage_events_type_check",
      sql`
      "event_type" IN ('created', 'moved', 'reopened', 'closed_won', 'closed_lost')
      OR "event_type" LIKE 'custom_%'
      `,
    ),

    /** Stage transitions should not point to same stage. */
    crmOpportunityStageEventsStageTransitionCheck: check(
      "crm_opportunity_stage_events_stage_transition_check",
      sql`
      "from_crm_pipeline_stage_id" IS NULL
      OR "to_crm_pipeline_stage_id" IS NULL
      OR "from_crm_pipeline_stage_id" <> "to_crm_pipeline_stage_id"
      `,
    ),
  }),
);

/**
 * crm_conversations
 *
 * ELI5:
 * One conversation thread groups inbound/outbound messages for CRM inbox use.
 *
 * Why this table exists:
 * - outbound message tables exist, but thread-level inbox state was missing,
 * - this provides assignment, SLA, ownership, and thread lifecycle context.
 */
export const crmConversations = pgTable(
  "crm_conversations",
  {
    /** Stable conversation id. */
    id: idWithTag("crm_conversation"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Conversation lifecycle state. */
    status: varchar("status", { length: 40 }).default("open").notNull(),
    /** Optional configurable dictionary value for conversation-status wording. */
    statusConfigValueId: idRef("status_config_value_id"),

    /** Channel class for this thread. */
    channelType: varchar("channel_type", { length: 40 }).default("email").notNull(),

    /** Optional human topic/subject. */
    topic: varchar("topic", { length: 260 }),

    /** Optional lead context. */
    crmLeadId: idRef("crm_lead_id").references(() => crmLeads.id),

    /** Optional opportunity context. */
    crmOpportunityId: idRef("crm_opportunity_id").references(() => crmOpportunities.id),

    /** Optional shared contact identity for this thread. */
    crmContactId: idRef("crm_contact_id").references(() => crmContacts.id),

    /** Optional owner user (team or queue owner). */
    ownerUserId: idRef("owner_user_id").references(() => users.id),

    /** Optional current assignee user for inbox triage. */
    assignedUserId: idRef("assigned_user_id").references(() => users.id),

    /** Priority scalar for queue sorting. */
    priority: integer("priority").default(100).notNull(),

    /** First inbound timestamp in this thread. */
    firstInboundAt: timestamp("first_inbound_at", { withTimezone: true }),

    /** Last message timestamp for sorting and SLA. */
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),

    /** Next action reminder timestamp for follow-up workflows. */
    nextActionAt: timestamp("next_action_at", { withTimezone: true }),

    /** Closed timestamp when status reaches closed/archived. */
    closedAt: timestamp("closed_at", { withTimezone: true }),

    /** External thread id from provider channel. */
    externalThreadRef: varchar("external_thread_ref", { length: 240 }),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    crmConversationsBizIdIdUnique: uniqueIndex("crm_conversations_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe participant/message references. */

    /** External thread dedupe path. */
    crmConversationsExternalThreadUnique: uniqueIndex(
      "crm_conversations_external_thread_unique",
    )
      .on(table.bizId, table.channelType, table.externalThreadRef)
      .where(sql`"external_thread_ref" IS NOT NULL`),

    /** Inbox listing path by status and recency. */
    crmConversationsBizStatusRecencyIdx: index(
      "crm_conversations_biz_status_recency_idx",
    ).on(table.bizId, table.status, table.lastMessageAt, table.priority),
    /** Configurable lifecycle inbox listing path. */
    crmConversationsBizStatusConfigRecencyIdx: index(
      "crm_conversations_biz_status_config_recency_idx",
    ).on(table.bizId, table.statusConfigValueId, table.lastMessageAt, table.priority),

    /** Assignee inbox path. */
    crmConversationsBizAssigneeStatusIdx: index(
      "crm_conversations_biz_assignee_status_idx",
    ).on(table.bizId, table.assignedUserId, table.status, table.lastMessageAt),

    /** Contact-centric thread history path. */
    crmConversationsBizContactStatusIdx: index(
      "crm_conversations_biz_contact_status_idx",
    ).on(table.bizId, table.crmContactId, table.status, table.lastMessageAt),

    /** Tenant-safe FK to optional lead context. */
    crmConversationsBizLeadFk: foreignKey({
      columns: [table.bizId, table.crmLeadId],
      foreignColumns: [crmLeads.bizId, crmLeads.id],
      name: "crm_conversations_biz_lead_fk",
    }),

    /** Tenant-safe FK to optional opportunity context. */
    crmConversationsBizOpportunityFk: foreignKey({
      columns: [table.bizId, table.crmOpportunityId],
      foreignColumns: [crmOpportunities.bizId, crmOpportunities.id],
      name: "crm_conversations_biz_opportunity_fk",
    }),

    /** Tenant-safe FK to optional shared CRM contact. */
    crmConversationsBizContactFk: foreignKey({
      columns: [table.bizId, table.crmContactId],
      foreignColumns: [crmContacts.bizId, crmContacts.id],
      name: "crm_conversations_biz_contact_fk",
    }),
    /** Tenant-safe FK to optional configured status dictionary value. */
    crmConversationsBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "crm_conversations_biz_status_config_fk",
    }),

    /** Status and channel vocabularies remain extensible. */
    crmConversationsVocabularyCheck: check(
      "crm_conversations_vocabulary_check",
      sql`
      ("status" IN ('open', 'pending', 'closed', 'snoozed', 'archived') OR "status" LIKE 'custom_%')
      AND ("channel_type" IN ('email', 'sms', 'chat', 'phone', 'social', 'in_app') OR "channel_type" LIKE 'custom_%')
      `,
    ),

    /** Conversation anchor and timing bounds. */
    crmConversationsBoundsCheck: check(
      "crm_conversations_bounds_check",
      sql`
      "priority" >= 0
      AND (
        ("crm_lead_id" IS NOT NULL)::int
        + ("crm_opportunity_id" IS NOT NULL)::int
        + ("crm_contact_id" IS NOT NULL)::int
      ) >= 1
      AND ("closed_at" IS NULL OR "last_message_at" IS NULL OR "closed_at" >= "last_message_at")
      `,
    ),
  }),
);

/**
 * crm_conversation_participants
 *
 * ELI5:
 * Participant rows define who is in a conversation thread.
 */
export const crmConversationParticipants = pgTable(
  "crm_conversation_participants",
  {
    /** Stable participant id. */
    id: idWithTag("crm_participant"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent conversation. */
    crmConversationId: idRef("crm_conversation_id")
      .references(() => crmConversations.id)
      .notNull(),

    /**
     * Participant anchor as shared CRM contact.
     * Preferred path for humans/customers/agents.
     */
    participantCrmContactId: idRef("participant_crm_contact_id").references(
      () => crmContacts.id,
    ),

    /**
     * Optional participant anchor as generic subject.
     * Use this when participant is not modeled as CRM contact yet
     * (for example plugin/system actors).
     */
    participantSubjectType: varchar("participant_subject_type", { length: 80 }),
    participantSubjectId: varchar("participant_subject_id", { length: 140 }),

    /** Optional display name snapshot. */
    displayName: varchar("display_name", { length: 220 }),

    /** Role in thread. */
    role: varchar("role", { length: 40 }).default("customer").notNull(),

    /** Membership lifecycle. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Join timestamp. */
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional leave timestamp. */
    leftAt: timestamp("left_at", { withTimezone: true }),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    crmConversationParticipantsBizIdIdUnique: uniqueIndex("crm_conversation_participants_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /**
     * One active logical participant row per CRM-contact anchor in one conversation.
     *
     * Kept separate from subject-path uniqueness to avoid NULL-related gaps in
     * combined unique indexes.
     */
    crmConversationParticipantsActiveContactUnique: uniqueIndex(
      "crm_conversation_participants_active_contact_unique",
    )
      .on(table.bizId, table.crmConversationId, table.participantCrmContactId)
      .where(
        sql`"participant_crm_contact_id" IS NOT NULL AND "deleted_at" IS NULL`,
      ),

    /**
     * One active logical participant row per subject anchor in one conversation.
     *
     * Together with the contact-path unique index, this enforces deterministic
     * participation identity for both anchor styles.
     */
    crmConversationParticipantsActiveSubjectUnique: uniqueIndex(
      "crm_conversation_participants_active_subject_unique",
    )
      .on(
        table.bizId,
        table.crmConversationId,
        table.participantSubjectType,
        table.participantSubjectId,
      )
      .where(
        sql`"participant_subject_type" IS NOT NULL AND "participant_subject_id" IS NOT NULL AND "deleted_at" IS NULL`,
      ),

    /** Participant listing path per conversation. */
    crmConversationParticipantsBizConversationStatusIdx: index(
      "crm_conversation_participants_biz_conversation_status_idx",
    ).on(table.bizId, table.crmConversationId, table.status, table.joinedAt),

    /** Reverse lookup path by CRM contact anchor. */
    crmConversationParticipantsBizContactIdx: index(
      "crm_conversation_participants_biz_contact_idx",
    ).on(table.bizId, table.participantCrmContactId, table.status),

    /** Reverse lookup path by subject anchor. */
    crmConversationParticipantsBizSubjectIdx: index(
      "crm_conversation_participants_biz_subject_idx",
    ).on(
      table.bizId,
      table.participantSubjectType,
      table.participantSubjectId,
      table.status,
    ),

    /** Tenant-safe FK to parent conversation. */
    crmConversationParticipantsBizConversationFk: foreignKey({
      columns: [table.bizId, table.crmConversationId],
      foreignColumns: [crmConversations.bizId, crmConversations.id],
      name: "crm_conversation_participants_biz_conversation_fk",
    }),

    /** Tenant-safe FK to optional CRM contact anchor. */
    crmConversationParticipantsBizContactFk: foreignKey({
      columns: [table.bizId, table.participantCrmContactId],
      foreignColumns: [crmContacts.bizId, crmContacts.id],
      name: "crm_conversation_participants_biz_contact_fk",
    }),

    /** Tenant-safe FK to optional subject anchor. */
    crmConversationParticipantsBizSubjectFk: foreignKey({
      columns: [table.bizId, table.participantSubjectType, table.participantSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "crm_conversation_participants_biz_subject_fk",
    }),

    /** Role vocabulary remains extensible. */
    crmConversationParticipantsRoleCheck: check(
      "crm_conversation_participants_role_check",
      sql`
      "role" IN ('customer', 'agent', 'observer', 'system')
      OR "role" LIKE 'custom_%'
      `,
    ),

    /** Subject anchor must be fully null or fully populated. */
    crmConversationParticipantsSubjectPairCheck: check(
      "crm_conversation_participants_subject_pair_check",
      sql`
      (
        "participant_subject_type" IS NULL
        AND "participant_subject_id" IS NULL
      ) OR (
        "participant_subject_type" IS NOT NULL
        AND "participant_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Exactly one participant anchor is required for deterministic semantics. */
    crmConversationParticipantsAnchorShapeCheck: check(
      "crm_conversation_participants_anchor_shape_check",
      sql`
      (
        ("participant_crm_contact_id" IS NOT NULL)::int
        + ("participant_subject_type" IS NOT NULL)::int
      ) = 1
      `,
    ),

    /** Timeline bounds. */
    crmConversationParticipantsTimelineCheck: check(
      "crm_conversation_participants_timeline_check",
      sql`"left_at" IS NULL OR "left_at" >= "joined_at"`,
    ),
  }),
);

/**
 * crm_conversation_messages
 *
 * ELI5:
 * Message timeline inside one conversation thread.
 *
 * Supports:
 * - inbound message capture,
 * - outbound message linkage,
 * - system note/events in same timeline.
 */
export const crmConversationMessages = pgTable(
  "crm_conversation_messages",
  {
    /** Stable message id. */
    id: idWithTag("crm_message"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent conversation. */
    crmConversationId: idRef("crm_conversation_id")
      .references(() => crmConversations.id)
      .notNull(),

    /** Message direction in thread flow. */
    direction: varchar("direction", { length: 40 }).default("inbound").notNull(),

    /** Sender anchor as shared CRM contact when available. */
    senderCrmContactId: idRef("sender_crm_contact_id").references(() => crmContacts.id),

    /** Optional sender anchor as generic subject. */
    senderSubjectType: varchar("sender_subject_type", { length: 80 }),
    senderSubjectId: varchar("sender_subject_id", { length: 140 }),

    /** Optional sender display name snapshot. */
    senderDisplayName: varchar("sender_display_name", { length: 220 }),

    /** Message body text. */
    body: text("body"),

    /** Structured payload for rich content/channel metadata. */
    payload: jsonb("payload").default({}).notNull(),

    /** Message delivery/state marker. */
    status: varchar("status", { length: 40 }).default("received").notNull(),
    /** Optional configurable dictionary value for message-status wording. */
    statusConfigValueId: idRef("status_config_value_id"),

    /** Message timestamp. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional outbound message linkage for outbound paths. */
    outboundMessageId: idRef("outbound_message_id").references(() => outboundMessages.id),

    /** Provider message ref for inbound/outbound reconciliation. */
    providerMessageRef: varchar("provider_message_ref", { length: 220 }),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    crmConversationMessagesBizIdIdUnique: uniqueIndex("crm_conversation_messages_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Message timeline path per conversation. */
    crmConversationMessagesBizConversationOccurredIdx: index(
      "crm_conversation_messages_biz_conversation_occurred_idx",
    ).on(table.bizId, table.crmConversationId, table.occurredAt),

    /** Message state queue path. */
    crmConversationMessagesBizStatusOccurredIdx: index(
      "crm_conversation_messages_biz_status_occurred_idx",
    ).on(table.bizId, table.status, table.occurredAt),
    /** Configurable lifecycle message queue path. */
    crmConversationMessagesBizStatusConfigOccurredIdx: index(
      "crm_conversation_messages_biz_status_config_occurred_idx",
    ).on(table.bizId, table.statusConfigValueId, table.occurredAt),

    /** Sender lookup path by CRM contact anchor. */
    crmConversationMessagesBizSenderContactIdx: index(
      "crm_conversation_messages_biz_sender_contact_idx",
    ).on(table.bizId, table.senderCrmContactId, table.occurredAt),

    /** Sender lookup path by subject anchor. */
    crmConversationMessagesBizSenderSubjectIdx: index(
      "crm_conversation_messages_biz_sender_subject_idx",
    ).on(table.bizId, table.senderSubjectType, table.senderSubjectId, table.occurredAt),

    /** Provider dedupe path when provider refs exist. */
    crmConversationMessagesProviderRefUnique: uniqueIndex(
      "crm_conversation_messages_provider_ref_unique",
    )
      .on(table.bizId, table.providerMessageRef)
      .where(sql`"provider_message_ref" IS NOT NULL`),

    /** Tenant-safe FK to parent conversation. */
    crmConversationMessagesBizConversationFk: foreignKey({
      columns: [table.bizId, table.crmConversationId],
      foreignColumns: [crmConversations.bizId, crmConversations.id],
      name: "crm_conversation_messages_biz_conversation_fk",
    }),

    /** Tenant-safe FK to optional outbound message row. */
    crmConversationMessagesBizOutboundMessageFk: foreignKey({
      columns: [table.bizId, table.outboundMessageId],
      foreignColumns: [outboundMessages.bizId, outboundMessages.id],
      name: "crm_conversation_messages_biz_outbound_message_fk",
    }),

    /** Tenant-safe FK to optional sender CRM contact. */
    crmConversationMessagesBizSenderContactFk: foreignKey({
      columns: [table.bizId, table.senderCrmContactId],
      foreignColumns: [crmContacts.bizId, crmContacts.id],
      name: "crm_conversation_messages_biz_sender_contact_fk",
    }),

    /** Tenant-safe FK to optional sender subject anchor. */
    crmConversationMessagesBizSenderSubjectFk: foreignKey({
      columns: [table.bizId, table.senderSubjectType, table.senderSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "crm_conversation_messages_biz_sender_subject_fk",
    }),
    /** Tenant-safe FK to optional configured status dictionary value. */
    crmConversationMessagesBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "crm_conversation_messages_biz_status_config_fk",
    }),

    /** Direction vocabulary remains extensible. */
    crmConversationMessagesDirectionCheck: check(
      "crm_conversation_messages_direction_check",
      sql`
      "direction" IN ('inbound', 'outbound', 'system')
      OR "direction" LIKE 'custom_%'
      `,
    ),

    /** Status vocabulary remains extensible. */
    crmConversationMessagesVocabularyCheck: check(
      "crm_conversation_messages_vocabulary_check",
      sql`
      "status" IN ('queued', 'sent', 'delivered', 'failed', 'received', 'read')
      OR "status" LIKE 'custom_%'
      `,
    ),

    /** Subject sender anchor must be fully null or fully populated. */
    crmConversationMessagesSenderSubjectPairCheck: check(
      "crm_conversation_messages_sender_subject_pair_check",
      sql`
      (
        "sender_subject_type" IS NULL
        AND "sender_subject_id" IS NULL
      ) OR (
        "sender_subject_type" IS NOT NULL
        AND "sender_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Non-system messages require exactly one sender anchor. */
    crmConversationMessagesSenderAnchorCheck: check(
      "crm_conversation_messages_sender_anchor_check",
      sql`
      (
        "direction" = 'system'
        AND (
          ("sender_crm_contact_id" IS NOT NULL)::int
          + ("sender_subject_type" IS NOT NULL)::int
        ) <= 1
      ) OR (
        "direction" <> 'system'
        AND (
          ("sender_crm_contact_id" IS NOT NULL)::int
          + ("sender_subject_type" IS NOT NULL)::int
        ) = 1
      )
      `,
    ),

    /** Message should not be empty. */
    crmConversationMessagesContentCheck: check(
      "crm_conversation_messages_content_check",
      sql`
      "body" IS NOT NULL
      OR "provider_message_ref" IS NOT NULL
      OR "outbound_message_id" IS NOT NULL
      `,
    ),
  }),
);

/**
 * crm_merge_candidates
 *
 * ELI5:
 * Candidate duplicates detected by matching/scoring logic.
 *
 * We model candidates using canonical `subjects` references so this system can
 * dedupe users, accounts, and future plugin-defined entities consistently.
 */
export const crmMergeCandidates = pgTable(
  "crm_merge_candidates",
  {
    /** Stable merge-candidate id. */
    id: idWithTag("crm_merge_candidate"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Left subject key in canonical ordering. */
    leftSubjectType: varchar("left_subject_type", { length: 80 }).notNull(),
    leftSubjectId: varchar("left_subject_id", { length: 140 }).notNull(),

    /** Right subject key in canonical ordering. */
    rightSubjectType: varchar("right_subject_type", { length: 80 }).notNull(),
    rightSubjectId: varchar("right_subject_id", { length: 140 }).notNull(),

    /** Candidate workflow status. */
    status: varchar("status", { length: 40 }).default("open").notNull(),
    /** Optional configurable dictionary value for merge-candidate status wording. */
    statusConfigValueId: idRef("status_config_value_id"),

    /** Similarity confidence in basis points. */
    similarityScoreBps: integer("similarity_score_bps").default(0).notNull(),

    /** Rule key that generated this candidate. */
    ruleKey: varchar("rule_key", { length: 140 }),

    /** Detection timestamp. */
    detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull(),

    /** Rich evidence payload (matching fields/features). */
    evidence: jsonb("evidence").default({}).notNull(),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    crmMergeCandidatesBizIdIdUnique: uniqueIndex("crm_merge_candidates_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One active candidate row per normalized subject pair. */
    crmMergeCandidatesPairUnique: uniqueIndex("crm_merge_candidates_pair_unique")
      .on(
        table.bizId,
        table.leftSubjectType,
        table.leftSubjectId,
        table.rightSubjectType,
        table.rightSubjectId,
      )
      .where(sql`"deleted_at" IS NULL`),

    /** Candidate queue path. */
    crmMergeCandidatesBizStatusDetectedIdx: index(
      "crm_merge_candidates_biz_status_detected_idx",
    ).on(table.bizId, table.status, table.detectedAt),
    /** Configurable lifecycle queue path for merge-review operations. */
    crmMergeCandidatesBizStatusConfigDetectedIdx: index(
      "crm_merge_candidates_biz_status_config_detected_idx",
    ).on(table.bizId, table.statusConfigValueId, table.detectedAt),

    /** Tenant-safe FK to left subject. */
    crmMergeCandidatesLeftSubjectFk: foreignKey({
      columns: [table.bizId, table.leftSubjectType, table.leftSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "crm_merge_candidates_left_subject_fk",
    }),

    /** Tenant-safe FK to right subject. */
    crmMergeCandidatesRightSubjectFk: foreignKey({
      columns: [table.bizId, table.rightSubjectType, table.rightSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "crm_merge_candidates_right_subject_fk",
    }),
    /** Tenant-safe FK to optional configured status dictionary value. */
    crmMergeCandidatesBizStatusConfigFk: foreignKey({
      columns: [table.bizId, table.statusConfigValueId],
      foreignColumns: [bizConfigValues.bizId, bizConfigValues.id],
      name: "crm_merge_candidates_biz_status_config_fk",
    }),

    /** Candidate status vocabulary remains extensible. */
    crmMergeCandidatesStatusCheck: check(
      "crm_merge_candidates_status_check",
      sql`
      "status" IN ('open', 'reviewing', 'merged', 'rejected', 'ignored')
      OR "status" LIKE 'custom_%'
      `,
    ),

    /** Pair ordering + score bounds keep dedupe deterministic. */
    crmMergeCandidatesBoundsCheck: check(
      "crm_merge_candidates_bounds_check",
      sql`
      "similarity_score_bps" BETWEEN 0 AND 10000
      AND (
        "left_subject_type" < "right_subject_type"
        OR (
          "left_subject_type" = "right_subject_type"
          AND "left_subject_id" < "right_subject_id"
        )
      )
      `,
    ),
  }),
);

/**
 * crm_merge_decisions
 *
 * ELI5:
 * Final decision rows for merge candidates.
 *
 * If decision is `merge`, winner/loser subjects are recorded explicitly so
 * redirect and lineage tables can be generated deterministically.
 */
export const crmMergeDecisions = pgTable(
  "crm_merge_decisions",
  {
    /** Stable merge-decision id. */
    id: idWithTag("crm_merge_decision"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent merge candidate. */
    crmMergeCandidateId: idRef("crm_merge_candidate_id")
      .references(() => crmMergeCandidates.id)
      .notNull(),

    /** Decision type. */
    decisionType: varchar("decision_type", { length: 40 }).notNull(),

    /** User who made the decision. */
    decidedByUserId: idRef("decided_by_user_id").references(() => users.id),

    /** Decision timestamp. */
    decidedAt: timestamp("decided_at", { withTimezone: true }).defaultNow().notNull(),

    /** Winner subject type when decision_type=merge. */
    winnerSubjectType: varchar("winner_subject_type", { length: 80 }),

    /** Winner subject id when decision_type=merge. */
    winnerSubjectId: varchar("winner_subject_id", { length: 140 }),

    /** Loser subject type when decision_type=merge. */
    loserSubjectType: varchar("loser_subject_type", { length: 80 }),

    /** Loser subject id when decision_type=merge. */
    loserSubjectId: varchar("loser_subject_id", { length: 140 }),

    /** Optional decision note. */
    decisionNote: text("decision_note"),

    /** Optional field-level conflict resolution payload. */
    fieldResolution: jsonb("field_resolution").default({}).notNull(),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    crmMergeDecisionsBizIdIdUnique: uniqueIndex("crm_merge_decisions_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One active decision row per candidate. */
    crmMergeDecisionsCandidateUnique: uniqueIndex(
      "crm_merge_decisions_candidate_unique",
    )
      .on(table.crmMergeCandidateId)
      .where(sql`"deleted_at" IS NULL`),

    /** Decision queue/audit path. */
    crmMergeDecisionsBizTypeDecidedIdx: index(
      "crm_merge_decisions_biz_type_decided_idx",
    ).on(table.bizId, table.decisionType, table.decidedAt),

    /** Tenant-safe FK to candidate. */
    crmMergeDecisionsBizCandidateFk: foreignKey({
      columns: [table.bizId, table.crmMergeCandidateId],
      foreignColumns: [crmMergeCandidates.bizId, crmMergeCandidates.id],
      name: "crm_merge_decisions_biz_candidate_fk",
    }),

    /** Tenant-safe FK to winner subject. */
    crmMergeDecisionsWinnerSubjectFk: foreignKey({
      columns: [table.bizId, table.winnerSubjectType, table.winnerSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "crm_merge_decisions_winner_subject_fk",
    }),

    /** Tenant-safe FK to loser subject. */
    crmMergeDecisionsLoserSubjectFk: foreignKey({
      columns: [table.bizId, table.loserSubjectType, table.loserSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "crm_merge_decisions_loser_subject_fk",
    }),

    /** Decision vocabulary remains extensible. */
    crmMergeDecisionsTypeCheck: check(
      "crm_merge_decisions_type_check",
      sql`
      "decision_type" IN ('merge', 'reject', 'defer')
      OR "decision_type" LIKE 'custom_%'
      `,
    ),

    /** Merge decisions require explicit winner/loser payloads. */
    crmMergeDecisionsShapeCheck: check(
      "crm_merge_decisions_shape_check",
      sql`
      (
        "decision_type" = 'merge'
        AND "winner_subject_type" IS NOT NULL
        AND "winner_subject_id" IS NOT NULL
        AND "loser_subject_type" IS NOT NULL
        AND "loser_subject_id" IS NOT NULL
        AND (
          "winner_subject_type" <> "loser_subject_type"
          OR "winner_subject_id" <> "loser_subject_id"
        )
      ) OR (
        "decision_type" <> 'merge'
        AND "winner_subject_type" IS NULL
        AND "winner_subject_id" IS NULL
        AND "loser_subject_type" IS NULL
        AND "loser_subject_id" IS NULL
      )
      `,
    ),
  }),
);

/**
 * crm_subject_redirects
 *
 * ELI5:
 * Redirect map from old/collapsed subject ids to survivor subject ids.
 *
 * This lets read APIs resolve historical references safely after merges.
 */
export const crmSubjectRedirects = pgTable(
  "crm_subject_redirects",
  {
    /** Stable redirect id. */
    id: idWithTag("crm_redirect"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Subject namespace for both from/to ids. */
    subjectType: varchar("subject_type", { length: 80 }).notNull(),

    /** Old/deprecated subject id. */
    fromSubjectId: varchar("from_subject_id", { length: 140 }).notNull(),

    /** Survivor/active subject id. */
    toSubjectId: varchar("to_subject_id", { length: 140 }).notNull(),

    /** Redirect lifecycle state. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Optional source merge decision that created this redirect. */
    crmMergeDecisionId: idRef("crm_merge_decision_id").references(
      () => crmMergeDecisions.id,
    ),

    /** Optional reason code for diagnostics. */
    reasonCode: varchar("reason_code", { length: 120 }),

    /** Effective-from timestamp. */
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Optional effective-to timestamp. */
    effectiveTo: timestamp("effective_to", { withTimezone: true }),

    /** Extensible metadata payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    crmSubjectRedirectsBizIdIdUnique: uniqueIndex("crm_subject_redirects_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One active redirect per legacy subject key. */
    crmSubjectRedirectsActiveUnique: uniqueIndex("crm_subject_redirects_active_unique")
      .on(table.bizId, table.subjectType, table.fromSubjectId)
      .where(sql`"status" = 'active' AND "deleted_at" IS NULL`),

    /** Reverse lookup path by survivor subject. */
    crmSubjectRedirectsBizToSubjectIdx: index(
      "crm_subject_redirects_biz_to_subject_idx",
    ).on(table.bizId, table.subjectType, table.toSubjectId, table.status),

    /** Tenant-safe FK to old subject key. */
    crmSubjectRedirectsFromSubjectFk: foreignKey({
      columns: [table.bizId, table.subjectType, table.fromSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "crm_subject_redirects_from_subject_fk",
    }),

    /** Tenant-safe FK to survivor subject key. */
    crmSubjectRedirectsToSubjectFk: foreignKey({
      columns: [table.bizId, table.subjectType, table.toSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "crm_subject_redirects_to_subject_fk",
    }),

    /** Tenant-safe FK to optional merge decision source. */
    crmSubjectRedirectsBizMergeDecisionFk: foreignKey({
      columns: [table.bizId, table.crmMergeDecisionId],
      foreignColumns: [crmMergeDecisions.bizId, crmMergeDecisions.id],
      name: "crm_subject_redirects_biz_merge_decision_fk",
    }),

    /** Prevent self-redirect and invalid windows. */
    crmSubjectRedirectsBoundsCheck: check(
      "crm_subject_redirects_bounds_check",
      sql`
      "from_subject_id" <> "to_subject_id"
      AND ("effective_to" IS NULL OR "effective_to" > "effective_from")
      `,
    ),
  }),
);

export type CrmPipeline = typeof crmPipelines.$inferSelect;
export type NewCrmPipeline = typeof crmPipelines.$inferInsert;

export type CrmContact = typeof crmContacts.$inferSelect;
export type NewCrmContact = typeof crmContacts.$inferInsert;

export type CrmPipelineStage = typeof crmPipelineStages.$inferSelect;
export type NewCrmPipelineStage = typeof crmPipelineStages.$inferInsert;

export type CrmLead = typeof crmLeads.$inferSelect;
export type NewCrmLead = typeof crmLeads.$inferInsert;

export type CrmLeadEvent = typeof crmLeadEvents.$inferSelect;
export type NewCrmLeadEvent = typeof crmLeadEvents.$inferInsert;

export type CrmOpportunity = typeof crmOpportunities.$inferSelect;
export type NewCrmOpportunity = typeof crmOpportunities.$inferInsert;

export type CrmOpportunityStageEvent = typeof crmOpportunityStageEvents.$inferSelect;
export type NewCrmOpportunityStageEvent = typeof crmOpportunityStageEvents.$inferInsert;

export type CrmConversation = typeof crmConversations.$inferSelect;
export type NewCrmConversation = typeof crmConversations.$inferInsert;

export type CrmConversationParticipant = typeof crmConversationParticipants.$inferSelect;
export type NewCrmConversationParticipant = typeof crmConversationParticipants.$inferInsert;

export type CrmConversationMessage = typeof crmConversationMessages.$inferSelect;
export type NewCrmConversationMessage = typeof crmConversationMessages.$inferInsert;

export type CrmMergeCandidate = typeof crmMergeCandidates.$inferSelect;
export type NewCrmMergeCandidate = typeof crmMergeCandidates.$inferInsert;

export type CrmMergeDecision = typeof crmMergeDecisions.$inferSelect;
export type NewCrmMergeDecision = typeof crmMergeDecisions.$inferInsert;

export type CrmSubjectRedirect = typeof crmSubjectRedirects.$inferSelect;
export type NewCrmSubjectRedirect = typeof crmSubjectRedirects.$inferInsert;
