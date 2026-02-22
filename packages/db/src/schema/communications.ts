import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  time,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { groupAccounts } from "./group_accounts";
import { users } from "./users";
import {
  communicationChannelEnum,
  communicationConsentSourceEnum,
  communicationConsentStatusEnum,
  communicationPurposeEnum,
  customFieldTargetTypeEnum,
  lifecycleStatusEnum,
  marketingCampaignStatusEnum,
  marketingCampaignStepTypeEnum,
  marketingEnrollmentStatusEnum,
  messageDeliveryStatusEnum,
  messageEventTypeEnum,
} from "./enums";
import { bizExtensionInstalls, lifecycleEvents } from "./extensions";

/**
 * communication_consents
 *
 * ELI5:
 * This table answers:
 * "Are we allowed to contact this subject on this channel for this purpose?"
 *
 * Why first-class:
 * - legal/compliance requires explicit consent history context,
 * - reminder and marketing flows need a deterministic allow/deny source.
 */
export const communicationConsents = pgTable(
  "communication_consents",
  {
    /** Stable primary key. */
    id: idWithTag("comm_consent"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Subject class receiving communication.
     * Common values: user, group_account, booking_order, custom.
     */
    subjectType: customFieldTargetTypeEnum("subject_type").notNull(),

    /**
     * Canonical subject id (always required) for generic routing.
     * For `subject_type=user` this should match `subject_user_id`.
     */
    subjectRefId: varchar("subject_ref_id", { length: 140 }).notNull(),

    /** Optional convenience FK for user subjects. */
    subjectUserId: idRef("subject_user_id").references(() => users.id),

    /** Optional convenience FK for group-account subjects. */
    subjectGroupAccountId: idRef("subject_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Channel being consented/revoked. */
    channel: communicationChannelEnum("channel").notNull(),

    /** Purpose category (transactional/marketing/etc.). */
    purpose: communicationPurposeEnum("purpose").notNull(),

    /** Current consent state. */
    status: communicationConsentStatusEnum("status")
      .default("opted_in")
      .notNull(),

    /** Source of this state transition for audit/legal context. */
    source: communicationConsentSourceEnum("source")
      .default("user_action")
      .notNull(),

    /** Optional legal basis or policy reference key. */
    legalBasis: varchar("legal_basis", { length: 180 }),

    /** When this consent state was captured. */
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Optional expiration for time-limited consents. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Optional explicit revoke timestamp. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),

    /** Extension payload (double-opt-in metadata, evidence refs, etc.). */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    communicationConsentsBizIdIdUnique: uniqueIndex("communication_consents_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One current consent row per subject/channel/purpose tuple. */
    communicationConsentsSubjectUnique: uniqueIndex(
      "communication_consents_subject_unique",
    ).on(table.bizId, table.subjectType, table.subjectRefId, table.channel, table.purpose),

    /** Fast eligibility check path for outbound sends. */
    communicationConsentsBizChannelPurposeStatusIdx: index(
      "communication_consents_biz_channel_purpose_status_idx",
    ).on(table.bizId, table.channel, table.purpose, table.status),

    /** Subject-shape check keeps convenience FKs deterministic. */
    communicationConsentsSubjectShapeCheck: check(
      "communication_consents_subject_shape_check",
      sql`
      (
        "subject_type" = 'user'
        AND "subject_user_id" IS NOT NULL
      ) OR (
        "subject_type" = 'group_account'
        AND "subject_group_account_id" IS NOT NULL
      ) OR (
        "subject_type" <> 'user'
        AND "subject_type" <> 'group_account'
      )
      `,
    ),
  }),
);

/**
 * quiet_hour_policies
 *
 * ELI5:
 * Quiet-hour policy says when the system should avoid sending messages.
 *
 * Supports:
 * - tenant default quiet hours,
 * - per-user or per-group overrides,
 * - channel-specific restrictions.
 */
export const quietHourPolicies = pgTable(
  "quiet_hour_policies",
  {
    /** Stable primary key. */
    id: idWithTag("quiet_policy"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human policy label in admin tooling. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Policy lifecycle state. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Optional channel scope. Null means applies to all channels. */
    channel: communicationChannelEnum("channel"),

    /** Local timezone used to evaluate quiet window boundaries. */
    timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),

    /** Quiet period start in local wall-clock time. */
    quietStartLocal: time("quiet_start_local").notNull(),

    /** Quiet period end in local wall-clock time. */
    quietEndLocal: time("quiet_end_local").notNull(),

    /**
     * Optional target scope type.
     * Null means this is tenant-default policy.
     */
    targetType: customFieldTargetTypeEnum("target_type"),

    /** Optional scoped target id for non-user/group targets. */
    targetRefId: varchar("target_ref_id", { length: 140 }),

    /** Optional user-specific policy scope. */
    targetUserId: idRef("target_user_id").references(() => users.id),

    /** Optional group-account-specific policy scope. */
    targetGroupAccountId: idRef("target_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Allows transactional messages to bypass quiet hours. */
    allowTransactionalBypass: boolean("allow_transactional_bypass")
      .default(true)
      .notNull(),

    /** Allows emergency-class messages to bypass quiet hours. */
    allowEmergencyBypass: boolean("allow_emergency_bypass")
      .default(true)
      .notNull(),

    /** Extension payload for richer delivery preferences. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    quietHourPoliciesBizIdIdUnique: uniqueIndex("quiet_hour_policies_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common policy resolution path. */
    quietHourPoliciesBizStatusChannelIdx: index(
      "quiet_hour_policies_biz_status_channel_idx",
    ).on(table.bizId, table.status, table.channel),

    /** Tenant-default policy uniqueness (one active row recommended by app). */
    quietHourPoliciesBizDefaultUnique: uniqueIndex(
      "quiet_hour_policies_biz_default_unique",
    )
      .on(table.bizId)
      .where(sql`"target_type" IS NULL`),

    /** Target-shape consistency check. */
    quietHourPoliciesTargetShapeCheck: check(
      "quiet_hour_policies_target_shape_check",
      sql`
      (
        "target_type" IS NULL
        AND "target_ref_id" IS NULL
        AND "target_user_id" IS NULL
        AND "target_group_account_id" IS NULL
      ) OR (
        "target_type" = 'user'
        AND "target_user_id" IS NOT NULL
      ) OR (
        "target_type" = 'group_account'
        AND "target_group_account_id" IS NOT NULL
      ) OR (
        "target_type" IS NOT NULL
        AND "target_type" <> 'user'
        AND "target_type" <> 'group_account'
        AND "target_ref_id" IS NOT NULL
      )
      `,
    ),

    /** Start/end cannot be equal (would imply full-day silence ambiguity). */
    quietHourPoliciesWindowCheck: check(
      "quiet_hour_policies_window_check",
      sql`"quiet_start_local" <> "quiet_end_local"`,
    ),
  }),
);

/**
 * message_templates
 *
 * ELI5:
 * Reusable template versions for SMS/email/push/postal/voice content.
 *
 * This provides one normalized template system for:
 * - transactional reminders
 * - legal notices
 * - marketing drips
 */
export const messageTemplates = pgTable(
  "message_templates",
  {
    /** Stable primary key for one immutable template version. */
    id: idWithTag("message_template"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional extension owner when template is plugin-managed. */
    bizExtensionInstallId: idRef("biz_extension_install_id").references(
      () => bizExtensionInstalls.id,
    ),

    /** Channel this template renders for. */
    channel: communicationChannelEnum("channel").notNull(),

    /** Purpose category for policy/consent routing. */
    purpose: communicationPurposeEnum("purpose").notNull(),

    /** Human template name for admin UI. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable machine slug grouped across versions. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Immutable version number within one slug+channel. */
    version: integer("version").default(1).notNull(),

    /** Template lifecycle. */
    status: lifecycleStatusEnum("status").default("draft").notNull(),

    /** Marks this as currently selected default template for slug+channel. */
    isCurrent: boolean("is_current").default(false).notNull(),

    /** Optional locale key (e.g., en-US, fr-FR). */
    locale: varchar("locale", { length: 20 }).default("en-US").notNull(),

    /** Optional subject line template (email/postal use cases). */
    subjectTemplate: varchar("subject_template", { length: 600 }),

    /** Main body template (text/markdown/html depending on channel policy). */
    bodyTemplate: text("body_template").notNull(),

    /** Optional structured rendering payload for rich channels. */
    structuredTemplate: jsonb("structured_template").default({}).notNull(),

    /** Declared template variables and typing hints. */
    variableSchema: jsonb("variable_schema").default({}).notNull(),

    /** Rendering policy (link shortening, fallback rules, etc.). */
    renderPolicy: jsonb("render_policy").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    messageTemplatesBizIdIdUnique: uniqueIndex("message_templates_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe children. */

    /** One immutable version per (channel, slug, version). */
    messageTemplatesBizChannelSlugVersionUnique: uniqueIndex(
      "message_templates_biz_channel_slug_version_unique",
    ).on(table.bizId, table.channel, table.slug, table.version),

    /** One current template per (channel, slug). */
    messageTemplatesBizChannelSlugCurrentUnique: uniqueIndex(
      "message_templates_biz_channel_slug_current_unique",
    )
      .on(table.bizId, table.channel, table.slug)
      .where(sql`"is_current" = true`),

    /** Common picker path. */
    messageTemplatesBizChannelPurposeStatusIdx: index(
      "message_templates_biz_channel_purpose_status_idx",
    ).on(table.bizId, table.channel, table.purpose, table.status),

    /** Tenant-safe FK to optional extension owner. */
    messageTemplatesBizInstallFk: foreignKey({
      columns: [table.bizId, table.bizExtensionInstallId],
      foreignColumns: [bizExtensionInstalls.bizId, bizExtensionInstalls.id],
      name: "message_templates_biz_install_fk",
    }),

    /** Version must stay positive. */
    messageTemplatesVersionCheck: check(
      "message_templates_version_check",
      sql`"version" >= 1`,
    ),
  }),
);

/**
 * marketing_campaigns
 *
 * ELI5:
 * A campaign is a reusable automated journey definition.
 * It contains steps that decide when and what messages to send.
 */
export const marketingCampaigns = pgTable(
  "marketing_campaigns",
  {
    /** Stable primary key. */
    id: idWithTag("mkt_campaign"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional extension owner for campaign templates. */
    bizExtensionInstallId: idRef("biz_extension_install_id").references(
      () => bizExtensionInstalls.id,
    ),

    /** Human campaign name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable machine slug for APIs and workflows. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Campaign lifecycle. */
    status: marketingCampaignStatusEnum("status").default("draft").notNull(),

    /** Optional description for operators. */
    description: text("description"),

    /** Optional campaign start time. */
    startsAt: timestamp("starts_at", { withTimezone: true }),

    /** Optional campaign end time. */
    endsAt: timestamp("ends_at", { withTimezone: true }),

    /** Entry criteria policy payload. */
    entryPolicy: jsonb("entry_policy").default({}).notNull(),

    /** Exit criteria policy payload. */
    exitPolicy: jsonb("exit_policy").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe children. */
    marketingCampaignsBizIdIdUnique: uniqueIndex(
      "marketing_campaigns_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Stable slug uniqueness in tenant. */
    marketingCampaignsBizSlugUnique: uniqueIndex(
      "marketing_campaigns_biz_slug_unique",
    ).on(table.bizId, table.slug),

    /** Common campaign board path. */
    marketingCampaignsBizStatusStartsIdx: index(
      "marketing_campaigns_biz_status_starts_idx",
    ).on(table.bizId, table.status, table.startsAt),

    /** Tenant-safe FK to optional extension owner. */
    marketingCampaignsBizInstallFk: foreignKey({
      columns: [table.bizId, table.bizExtensionInstallId],
      foreignColumns: [bizExtensionInstalls.bizId, bizExtensionInstalls.id],
      name: "marketing_campaigns_biz_install_fk",
    }),

    /** Time window ordering check. */
    marketingCampaignsWindowCheck: check(
      "marketing_campaigns_window_check",
      sql`"starts_at" IS NULL OR "ends_at" IS NULL OR "ends_at" > "starts_at"`,
    ),
  }),
);

/**
 * marketing_campaign_steps
 *
 * ELI5:
 * One row is one node in the campaign graph.
 *
 * Step types:
 * - delay: wait N minutes then move to next
 * - message: render/send a template
 * - condition: evaluate branch and route to true/false path
 * - exit: terminal node
 */
export const marketingCampaignSteps = pgTable(
  "marketing_campaign_steps",
  {
    /** Stable primary key. */
    id: idWithTag("mkt_step"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent campaign. */
    marketingCampaignId: idRef("marketing_campaign_id")
      .references(() => marketingCampaigns.id)
      .notNull(),

    /** Stable step key for graph references. */
    stepKey: varchar("step_key", { length: 120 }).notNull(),

    /** Step type discriminator. */
    stepType: marketingCampaignStepTypeEnum("step_type").notNull(),

    /** Optional human label for operators. */
    name: varchar("name", { length: 220 }),

    /** Ordering hint for graph editors. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Optional channel override for message steps. */
    channel: communicationChannelEnum("channel"),

    /** Message template used by `step_type=message`. */
    messageTemplateId: idRef("message_template_id").references(
      () => messageTemplates.id,
    ),

    /** Delay duration for `step_type=delay`. */
    delayMinutes: integer("delay_minutes"),

    /** Condition expression payload for branching steps. */
    conditionExpr: jsonb("condition_expr").default({}),

    /** Next step for linear transitions. */
    nextStepKey: varchar("next_step_key", { length: 120 }),

    /** Branch target for condition=true. */
    onTrueStepKey: varchar("on_true_step_key", { length: 120 }),

    /** Branch target for condition=false. */
    onFalseStepKey: varchar("on_false_step_key", { length: 120 }),

    /** Step lifecycle. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references to this campaign-step row. */
    marketingCampaignStepsBizIdIdUnique: uniqueIndex(
      "marketing_campaign_steps_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One key per campaign. */
    marketingCampaignStepsUnique: uniqueIndex(
      "marketing_campaign_steps_unique",
    ).on(table.marketingCampaignId, table.stepKey),

    /** Common campaign graph load path. */
    marketingCampaignStepsBizCampaignSortIdx: index(
      "marketing_campaign_steps_biz_campaign_sort_idx",
    ).on(table.bizId, table.marketingCampaignId, table.sortOrder),

    /** Tenant-safe FK to campaign. */
    marketingCampaignStepsBizCampaignFk: foreignKey({
      columns: [table.bizId, table.marketingCampaignId],
      foreignColumns: [marketingCampaigns.bizId, marketingCampaigns.id],
      name: "marketing_campaign_steps_biz_campaign_fk",
    }),

    /** Tenant-safe FK to optional message template. */
    marketingCampaignStepsBizTemplateFk: foreignKey({
      columns: [table.bizId, table.messageTemplateId],
      foreignColumns: [messageTemplates.bizId, messageTemplates.id],
      name: "marketing_campaign_steps_biz_template_fk",
    }),

    /** Generic numeric bounds. */
    marketingCampaignStepsNumericBoundsCheck: check(
      "marketing_campaign_steps_numeric_bounds_check",
      sql`
      "sort_order" >= 0
      AND ("delay_minutes" IS NULL OR "delay_minutes" >= 0)
      `,
    ),

    /** Step payload shape by type. */
    marketingCampaignStepsShapeCheck: check(
      "marketing_campaign_steps_shape_check",
      sql`
      (
        "step_type" = 'delay'
        AND "delay_minutes" IS NOT NULL
        AND "message_template_id" IS NULL
      ) OR (
        "step_type" = 'message'
        AND "delay_minutes" IS NULL
        AND "message_template_id" IS NOT NULL
      ) OR (
        "step_type" = 'condition'
        AND "delay_minutes" IS NULL
        AND "message_template_id" IS NULL
        AND ("on_true_step_key" IS NOT NULL OR "on_false_step_key" IS NOT NULL)
      ) OR (
        "step_type" = 'exit'
        AND "delay_minutes" IS NULL
        AND "message_template_id" IS NULL
      )
      `,
    ),
  }),
);

/**
 * marketing_campaign_enrollments
 *
 * ELI5:
 * One row tracks one subject currently/previously running through one campaign.
 */
export const marketingCampaignEnrollments = pgTable(
  "marketing_campaign_enrollments",
  {
    /** Stable primary key. */
    id: idWithTag("mkt_enrollment"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent campaign. */
    marketingCampaignId: idRef("marketing_campaign_id")
      .references(() => marketingCampaigns.id)
      .notNull(),

    /** Subject class enrolled in this campaign. */
    subjectType: customFieldTargetTypeEnum("subject_type").notNull(),

    /** Canonical subject id in string form. */
    subjectRefId: varchar("subject_ref_id", { length: 140 }).notNull(),

    /** Optional convenience FK to user subject. */
    subjectUserId: idRef("subject_user_id").references(() => users.id),

    /** Optional convenience FK to group-account subject. */
    subjectGroupAccountId: idRef("subject_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Enrollment lifecycle state. */
    status: marketingEnrollmentStatusEnum("status").default("active").notNull(),

    /** Current step key pointer for runtime orchestration. */
    currentStepKey: varchar("current_step_key", { length: 120 }),

    /** Enrollment start timestamp. */
    enteredAt: timestamp("entered_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Last time step/condition evaluation happened. */
    lastEvaluatedAt: timestamp("last_evaluated_at", { withTimezone: true }),

    /** Exit timestamp when enrollment terminates. */
    exitedAt: timestamp("exited_at", { withTimezone: true }),

    /** Optional reason for exit/failure. */
    exitReason: varchar("exit_reason", { length: 240 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    marketingCampaignEnrollmentsBizIdIdUnique: uniqueIndex("marketing_campaign_enrollments_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Prevent duplicate concurrent enrollment identity rows per campaign. */
    marketingCampaignEnrollmentsUnique: uniqueIndex(
      "marketing_campaign_enrollments_unique",
    ).on(table.bizId, table.marketingCampaignId, table.subjectType, table.subjectRefId),

    /** Runtime execution queue path. */
    marketingCampaignEnrollmentsBizStatusEvalIdx: index(
      "marketing_campaign_enrollments_biz_status_eval_idx",
    ).on(table.bizId, table.status, table.lastEvaluatedAt),

    /** Tenant-safe FK to campaign. */
    marketingCampaignEnrollmentsBizCampaignFk: foreignKey({
      columns: [table.bizId, table.marketingCampaignId],
      foreignColumns: [marketingCampaigns.bizId, marketingCampaigns.id],
      name: "marketing_campaign_enrollments_biz_campaign_fk",
    }),
  }),
);

/**
 * message_template_bindings
 *
 * ELI5:
 * Binding rules connect lifecycle events to message templates.
 *
 * This gives one declarative place to say:
 * - "when booking.confirmed, send template X"
 * - "only for target type user and when condition Y is true"
 */
export const messageTemplateBindings = pgTable(
  "message_template_bindings",
  {
    /** Stable primary key. */
    id: idWithTag("message_binding"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Template to render when rule matches. */
    messageTemplateId: idRef("message_template_id")
      .references(() => messageTemplates.id)
      .notNull(),

    /** Lifecycle event topic/pattern this binding listens for. */
    eventPattern: varchar("event_pattern", { length: 200 }).notNull(),

    /** Optional target class filter. */
    targetType: customFieldTargetTypeEnum("target_type"),

    /** Rule ordering (lower runs first). */
    priority: integer("priority").default(100).notNull(),

    /** Runtime enable/disable switch. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Condition payload evaluated before send creation. */
    conditionExpr: jsonb("condition_expr").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    messageTemplateBindingsBizIdIdUnique: uniqueIndex("message_template_bindings_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common event resolver query path. */
    messageTemplateBindingsBizPatternActivePriorityIdx: index(
      "message_template_bindings_biz_pattern_active_priority_idx",
    ).on(table.bizId, table.eventPattern, table.isActive, table.priority),

    /** Tenant-safe FK to message template. */
    messageTemplateBindingsBizTemplateFk: foreignKey({
      columns: [table.bizId, table.messageTemplateId],
      foreignColumns: [messageTemplates.bizId, messageTemplates.id],
      name: "message_template_bindings_biz_template_fk",
    }),

    /** Priority must be non-negative. */
    messageTemplateBindingsPriorityCheck: check(
      "message_template_bindings_priority_check",
      sql`"priority" >= 0`,
    ),
  }),
);

/**
 * outbound_messages
 *
 * ELI5:
 * One row tracks one concrete send attempt (SMS/email/push/etc.).
 *
 * This gives unified telemetry for:
 * - reminders,
 * - marketing sequences,
 * - legal notices,
 * - fallback delivery logic.
 */
export const outboundMessages = pgTable(
  "outbound_messages",
  {
    /** Stable primary key. */
    id: idWithTag("outbound_msg"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional source template used to render this message. */
    messageTemplateId: idRef("message_template_id").references(
      () => messageTemplates.id,
    ),

    /** Optional source lifecycle event that triggered this message. */
    lifecycleEventId: idRef("lifecycle_event_id").references(
      () => lifecycleEvents.id,
    ),

    /** Optional source campaign for journey sends. */
    marketingCampaignId: idRef("marketing_campaign_id").references(
      () => marketingCampaigns.id,
    ),

    /** Optional source campaign step for journey sends. */
    marketingCampaignStepId: idRef("marketing_campaign_step_id").references(
      () => marketingCampaignSteps.id,
    ),

    /** Channel used for this send. */
    channel: communicationChannelEnum("channel").notNull(),

    /** Purpose classification for policy/compliance filtering. */
    purpose: communicationPurposeEnum("purpose").notNull(),

    /** Optional convenience FK to user recipient. */
    recipientUserId: idRef("recipient_user_id").references(() => users.id),

    /** Optional convenience FK to group-account recipient. */
    recipientGroupAccountId: idRef("recipient_group_account_id").references(
      () => groupAccounts.id,
    ),

    /**
     * Canonical recipient address/endpoint.
     * Examples: phone number, email, push token, postal address key.
     */
    recipientRef: varchar("recipient_ref", { length: 500 }).notNull(),

    /** Delivery status state machine. */
    status: messageDeliveryStatusEnum("status").default("queued").notNull(),

    /** Scheduled send time. */
    scheduledFor: timestamp("scheduled_for", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Provider handoff timestamp. */
    sentAt: timestamp("sent_at", { withTimezone: true }),

    /** Provider-delivered timestamp (when available). */
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),

    /** Failure timestamp (if terminal/error state). */
    failedAt: timestamp("failed_at", { withTimezone: true }),

    /** Provider/integration key used to send this message. */
    providerKey: varchar("provider_key", { length: 120 }),

    /** Provider message id/reference for webhook reconciliation. */
    providerMessageRef: varchar("provider_message_ref", { length: 240 }),

    /** Normalized last error code. */
    errorCode: varchar("error_code", { length: 120 }),

    /** Human-readable error summary. */
    errorMessage: varchar("error_message", { length: 2000 }),

    /** Rendered content and send payload snapshot. */
    payload: jsonb("payload").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    outboundMessagesBizIdIdUnique: uniqueIndex("outbound_messages_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe child event logs. */

    /** Provider idempotency/reconciliation path. */
    outboundMessagesProviderRefUnique: uniqueIndex(
      "outbound_messages_provider_ref_unique",
    )
      .on(table.bizId, table.providerKey, table.providerMessageRef)
      .where(sql`"provider_message_ref" IS NOT NULL`),

    /** Scheduler worker query path. */
    outboundMessagesBizStatusScheduleIdx: index(
      "outbound_messages_biz_status_schedule_idx",
    ).on(table.bizId, table.status, table.scheduledFor),

    /** Recipient timeline path. */
    outboundMessagesBizRecipientIdx: index(
      "outbound_messages_biz_recipient_idx",
    ).on(table.bizId, table.recipientUserId, table.channel, table.scheduledFor),

    /** Tenant-safe FK to message template. */
    outboundMessagesBizTemplateFk: foreignKey({
      columns: [table.bizId, table.messageTemplateId],
      foreignColumns: [messageTemplates.bizId, messageTemplates.id],
      name: "outbound_messages_biz_template_fk",
    }),

    /** Tenant-safe FK to lifecycle event. */
    outboundMessagesBizLifecycleEventFk: foreignKey({
      columns: [table.bizId, table.lifecycleEventId],
      foreignColumns: [lifecycleEvents.bizId, lifecycleEvents.id],
      name: "outbound_messages_biz_lifecycle_event_fk",
    }),

    /** Tenant-safe FK to campaign. */
    outboundMessagesBizCampaignFk: foreignKey({
      columns: [table.bizId, table.marketingCampaignId],
      foreignColumns: [marketingCampaigns.bizId, marketingCampaigns.id],
      name: "outbound_messages_biz_campaign_fk",
    }),

    /** Tenant-safe FK to campaign step. */
    outboundMessagesBizCampaignStepFk: foreignKey({
      columns: [table.bizId, table.marketingCampaignStepId],
      foreignColumns: [marketingCampaignSteps.bizId, marketingCampaignSteps.id],
      name: "outbound_messages_biz_campaign_step_fk",
    }),

    /** Core timestamp ordering sanity checks. */
    outboundMessagesWindowCheck: check(
      "outbound_messages_window_check",
      sql`
      ("sent_at" IS NULL OR "sent_at" >= "scheduled_for")
      AND ("delivered_at" IS NULL OR "sent_at" IS NULL OR "delivered_at" >= "sent_at")
      AND ("failed_at" IS NULL OR "sent_at" IS NULL OR "failed_at" >= "sent_at")
      `,
    ),
  }),
);

/**
 * outbound_message_events
 *
 * ELI5:
 * Append-style event timeline for one outbound message.
 *
 * This tracks provider callbacks and state transitions like:
 * - sent
 * - delivered
 * - opened/clicked
 * - bounced/failed/unsubscribed
 */
export const outboundMessageEvents = pgTable(
  "outbound_message_events",
  {
    /** Stable primary key. */
    id: idWithTag("outbound_msg_event"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent outbound message. */
    outboundMessageId: idRef("outbound_message_id")
      .references(() => outboundMessages.id)
      .notNull(),

    /** Event classification. */
    eventType: messageEventTypeEnum("event_type").notNull(),

    /** Event occurrence timestamp. */
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Optional provider-native event id for dedupe. */
    providerEventRef: varchar("provider_event_ref", { length: 240 }),

    /** Event payload snapshot from provider/system. */
    payload: jsonb("payload").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    outboundMessageEventsBizIdIdUnique: uniqueIndex("outbound_message_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Provider event dedupe when provided. */
    outboundMessageEventsProviderRefUnique: uniqueIndex(
      "outbound_message_events_provider_ref_unique",
    )
      .on(table.bizId, table.providerEventRef)
      .where(sql`"provider_event_ref" IS NOT NULL`),

    /** Timeline query path. */
    outboundMessageEventsBizMessageOccurredIdx: index(
      "outbound_message_events_biz_message_occurred_idx",
    ).on(table.bizId, table.outboundMessageId, table.occurredAt),

    /** Tenant-safe FK to parent message. */
    outboundMessageEventsBizMessageFk: foreignKey({
      columns: [table.bizId, table.outboundMessageId],
      foreignColumns: [outboundMessages.bizId, outboundMessages.id],
      name: "outbound_message_events_biz_message_fk",
    }),
  }),
);

export type CommunicationConsent = typeof communicationConsents.$inferSelect;
export type NewCommunicationConsent = typeof communicationConsents.$inferInsert;

export type QuietHourPolicy = typeof quietHourPolicies.$inferSelect;
export type NewQuietHourPolicy = typeof quietHourPolicies.$inferInsert;

export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type NewMessageTemplate = typeof messageTemplates.$inferInsert;

export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;
export type NewMarketingCampaign = typeof marketingCampaigns.$inferInsert;

export type MarketingCampaignStep = typeof marketingCampaignSteps.$inferSelect;
export type NewMarketingCampaignStep = typeof marketingCampaignSteps.$inferInsert;

export type MarketingCampaignEnrollment =
  typeof marketingCampaignEnrollments.$inferSelect;
export type NewMarketingCampaignEnrollment =
  typeof marketingCampaignEnrollments.$inferInsert;

export type MessageTemplateBinding = typeof messageTemplateBindings.$inferSelect;
export type NewMessageTemplateBinding =
  typeof messageTemplateBindings.$inferInsert;

export type OutboundMessage = typeof outboundMessages.$inferSelect;
export type NewOutboundMessage = typeof outboundMessages.$inferInsert;

export type OutboundMessageEvent = typeof outboundMessageEvents.$inferSelect;
export type NewOutboundMessageEvent = typeof outboundMessageEvents.$inferInsert;
