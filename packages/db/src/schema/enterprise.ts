import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  date,
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
  enterpriseContractPackBindingModeEnum,
  enterpriseDelegationStatusEnum,
  enterpriseDirectoryLinkStatusEnum,
  enterpriseIdentityProviderTypeEnum,
  enterpriseResolutionStatusEnum,
  enterpriseRolloutStatusEnum,
  enterpriseRolloutTargetStatusEnum,
  enterpriseScimSyncStatusEnum,
  enterpriseScopeTypeEnum,
  intercompanyAccountTypeEnum,
  intercompanyEntryStatusEnum,
  intercompanyEntryTypeEnum,
  intercompanySettlementRunStatusEnum,
  lifecycleStatusEnum,
} from "./enums";
import { locations } from "./locations";
import { crossBizOrders } from "./marketplace";
import { paymentTransactions } from "./payments";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * enterprise_relationship_templates
 *
 * ELI5:
 * This table defines the "relationship language" an enterprise network uses
 * between bizes (for example parent_of, franchise_of, managed_by, region_of).
 *
 * Why this exists:
 * - keeps hierarchy semantics configurable instead of hardcoding one org tree,
 * - supports many enterprise topologies (holding company, franchise, region,
 *   shared-service hubs) without schema rewrites,
 * - allows policy/reporting layers to reference stable relationship keys.
 */
export const enterpriseRelationshipTemplates = pgTable(
  "enterprise_relationship_templates",
  {
    id: idWithTag("ent_rel_tpl"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human-facing name for admins. */
    name: varchar("name", { length: 160 }).notNull(),
    /** Stable machine slug used by APIs/imports/policy engines. */
    slug: varchar("slug", { length: 120 }).notNull(),
    /**
     * Stable relationship key.
     * Example: parent_of, franchise_of, managed_by, belongs_to_region.
     */
    relationshipTypeKey: varchar("relationship_type_key", { length: 120 }).notNull(),
    /**
     * Optional inverse type key used by read models/UI helpers.
     * Example: parent_of <-> child_of
     */
    inverseRelationshipTypeKey: varchar("inverse_relationship_type_key", {
      length: 120,
    }),
    description: text("description"),

    /**
     * If true, relationship is treated as symmetric by higher-level engines.
     * The DB still stores one directed edge row in `enterprise_relationships`.
     */
    isSymmetric: boolean("is_symmetric").default(false).notNull(),

    /** If false, graph resolvers should reject cycle creation. */
    allowsCycles: boolean("allows_cycles").default(false).notNull(),

    status: lifecycleStatusEnum("status").default("active").notNull(),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    enterpriseRelationshipTemplatesBizIdIdUnique: uniqueIndex(
      "enterprise_relationship_templates_biz_id_id_unique",
    ).on(table.bizId, table.id),

    enterpriseRelationshipTemplatesBizSlugUnique: uniqueIndex(
      "enterprise_relationship_templates_biz_slug_unique",
    ).on(table.bizId, table.slug),

    enterpriseRelationshipTemplatesBizTypeKeyUnique: uniqueIndex(
      "enterprise_relationship_templates_biz_type_key_unique",
    ).on(table.bizId, table.relationshipTypeKey),

    enterpriseRelationshipTemplatesBizStatusIdx: index(
      "enterprise_relationship_templates_biz_status_idx",
    ).on(table.bizId, table.status),

    enterpriseRelationshipTemplatesKeyShapeCheck: check(
      "enterprise_relationship_templates_key_shape_check",
      sql`
      length("slug") > 0
      AND length("relationship_type_key") > 0
      AND (
        "inverse_relationship_type_key" IS NULL
        OR length("inverse_relationship_type_key") > 0
      )
      `,
    ),
  }),
);

/**
 * enterprise_relationships
 *
 * ELI5:
 * One row is one typed edge between two bizes in an enterprise graph.
 *
 * Example:
 * - "North Region manages Biz A"
 * - "Biz A is franchise of Parent Biz"
 *
 * This is intentionally graph-shaped so enterprise topology can evolve without
 * forcing one rigid parent_id column model.
 */
export const enterpriseRelationships = pgTable(
  "enterprise_relationships",
  {
    id: idWithTag("ent_rel"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    relationshipTemplateId: idRef("relationship_template_id")
      .references(() => enterpriseRelationshipTemplates.id)
      .notNull(),

    /** Edge source biz. */
    fromBizId: idRef("from_biz_id")
      .references(() => bizes.id)
      .notNull(),
    /** Edge destination biz. */
    toBizId: idRef("to_biz_id")
      .references(() => bizes.id)
      .notNull(),

    status: lifecycleStatusEnum("status").default("active").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .defaultNow()
      .notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),

    /** Tie-break hint when multiple edges are valid for one resolver. */
    priority: integer("priority").default(100).notNull(),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    enterpriseRelationshipsBizIdIdUnique: uniqueIndex(
      "enterprise_relationships_biz_id_id_unique",
    ).on(table.bizId, table.id),

    enterpriseRelationshipsActiveEdgeUnique: uniqueIndex(
      "enterprise_relationships_active_edge_unique",
    )
      .on(
        table.bizId,
        table.relationshipTemplateId,
        table.fromBizId,
        table.toBizId,
      )
      .where(sql`"deleted_at" IS NULL`),

    enterpriseRelationshipsBizFromStatusIdx: index(
      "enterprise_relationships_biz_from_status_idx",
    ).on(table.bizId, table.fromBizId, table.status),

    enterpriseRelationshipsBizToStatusIdx: index(
      "enterprise_relationships_biz_to_status_idx",
    ).on(table.bizId, table.toBizId, table.status),

    enterpriseRelationshipsBizTemplateFk: foreignKey({
      columns: [table.bizId, table.relationshipTemplateId],
      foreignColumns: [enterpriseRelationshipTemplates.bizId, enterpriseRelationshipTemplates.id],
      name: "enterprise_relationships_biz_template_fk",
    }),

    enterpriseRelationshipsWindowCheck: check(
      "enterprise_relationships_window_check",
      sql`
      "from_biz_id" <> "to_biz_id"
      AND "priority" >= 0
      AND (
        "effective_to" IS NULL
        OR "effective_to" > "effective_from"
      )
      `,
    ),
  }),
);

/**
 * enterprise_scopes
 *
 * ELI5:
 * This is the one shared "where does this apply?" table for enterprise logic.
 *
 * Why this exists:
 * - keeps scope semantics in one place instead of copying `scope_type`,
 *   `scope_key`, and `target_*` columns across many tables,
 * - gives every enterprise feature the same scope identity primitive,
 * - reduces bugs where two tables describe the "same scope" differently.
 *
 * Scope examples:
 * - network: whole enterprise network (`scope_key='network'`)
 * - biz: one biz (`scope_key='biz:<biz_id>'`)
 * - location: one location (`scope_key='location:<biz_id>:<location_id>'`)
 * - subject: one subject row (`scope_key='subject:<biz_id>:<type>:<id>'`)
 */
export const enterpriseScopes = pgTable(
  "enterprise_scopes",
  {
    id: idWithTag("ent_scope"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Canonical scope shape. */
    scopeType: enterpriseScopeTypeEnum("scope_type").notNull(),

    /**
     * Deterministic scope identity string used by APIs and idempotent writes.
     * This keeps one stable key no matter which module uses the scope.
     */
    scopeKey: varchar("scope_key", { length: 260 }).notNull(),

    /** Populated when scope_type is `biz`/`location`/`subject`. */
    targetBizId: idRef("target_biz_id").references(() => bizes.id),
    /**
     * Populated only when scope_type is `location`.
     *
     * Note:
     * - this intentionally does not use direct `.references(() => locations.id)`.
     * - tenant-safe integrity is enforced by the composite FK
     *   `(target_biz_id, target_location_id) -> locations(biz_id, id)` below.
     * This avoids ambiguous cross-tenant pointer semantics.
     */
    targetLocationId: idRef("target_location_id"),
    /** Populated only when scope_type is `subject`. */
    targetSubjectType: varchar("target_subject_type", { length: 80 }),
    /** Populated only when scope_type is `subject`. */
    targetSubjectId: varchar("target_subject_id", { length: 140 }),

    status: lifecycleStatusEnum("status").default("active").notNull(),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    enterpriseScopesBizIdIdUnique: uniqueIndex("enterprise_scopes_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    enterpriseScopesBizScopeKeyUnique: uniqueIndex(
      "enterprise_scopes_biz_scope_key_unique",
    )
      .on(table.bizId, table.scopeKey)
      .where(sql`"deleted_at" IS NULL`),

    enterpriseScopesBizCanonicalUnique: uniqueIndex(
      "enterprise_scopes_biz_canonical_unique",
    )
      .on(
        table.bizId,
        table.scopeType,
        table.targetBizId,
        table.targetLocationId,
        table.targetSubjectType,
        table.targetSubjectId,
      )
      .where(sql`"deleted_at" IS NULL`),

    enterpriseScopesBizScopeTypeStatusIdx: index(
      "enterprise_scopes_biz_scope_type_status_idx",
    ).on(table.bizId, table.scopeType, table.status),

    enterpriseScopesTargetLocationFk: foreignKey({
      columns: [table.targetBizId, table.targetLocationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "enterprise_scopes_target_location_fk",
    }),

    enterpriseScopesTargetSubjectFk: foreignKey({
      columns: [table.targetBizId, table.targetSubjectType, table.targetSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "enterprise_scopes_target_subject_fk",
    }),

    enterpriseScopesShapeCheck: check(
      "enterprise_scopes_shape_check",
      sql`
      length("scope_key") > 0
      AND (
        ("scope_type" = 'network'
          AND "target_biz_id" IS NULL
          AND "target_location_id" IS NULL
          AND "target_subject_type" IS NULL
          AND "target_subject_id" IS NULL
        ) OR
        ("scope_type" = 'biz'
          AND "target_biz_id" IS NOT NULL
          AND "target_location_id" IS NULL
          AND "target_subject_type" IS NULL
          AND "target_subject_id" IS NULL
        ) OR
        ("scope_type" = 'location'
          AND "target_biz_id" IS NOT NULL
          AND "target_location_id" IS NOT NULL
          AND "target_subject_type" IS NULL
          AND "target_subject_id" IS NULL
        ) OR
        ("scope_type" = 'subject'
          AND "target_biz_id" IS NOT NULL
          AND "target_location_id" IS NULL
          AND "target_subject_type" IS NOT NULL
          AND "target_subject_id" IS NOT NULL
        )
      )
      `,
    ),
  }),
);

/**
 * enterprise_inheritance_strategies
 *
 * ELI5:
 * This table says how enterprise overrides should be resolved for a domain.
 *
 * Example:
 * - For pricing: network default -> regional override -> location override.
 * - For policy: network strict baseline + local additive merges.
 *
 * Why this exists:
 * - keeps inheritance behavior data-driven instead of hardcoded branch logic.
 */
export const enterpriseInheritanceStrategies = pgTable(
  "enterprise_inheritance_strategies",
  {
    id: idWithTag("ent_inherit_strategy"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),

    /**
     * Domain key for where this strategy is used.
     * Examples: pricing, policy, config_dictionary, contract_pack.
     */
    inheritanceDomain: varchar("inheritance_domain", { length: 100 }).notNull(),

    /**
     * Strategy algorithm key.
     * Supported built-ins stay intentionally small; custom modes can be added
     * with `custom_*` keys by plugins/runtime.
     */
    resolutionMode: varchar("resolution_mode", { length: 80 })
      .default("override_last")
      .notNull(),

    /**
     * Ordered precedence document.
     * Typical default: ["network","biz","location","subject"].
     */
    precedence: jsonb("precedence")
      .default(sql`'["network","biz","location","subject"]'::jsonb`)
      .notNull(),

    status: lifecycleStatusEnum("status").default("active").notNull(),
    description: text("description"),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    enterpriseInheritanceStrategiesBizIdIdUnique: uniqueIndex(
      "enterprise_inheritance_strategies_biz_id_id_unique",
    ).on(table.bizId, table.id),

    enterpriseInheritanceStrategiesBizSlugUnique: uniqueIndex(
      "enterprise_inheritance_strategies_biz_slug_unique",
    ).on(table.bizId, table.slug),

    enterpriseInheritanceStrategiesBizDomainStatusIdx: index(
      "enterprise_inheritance_strategies_biz_domain_status_idx",
    ).on(table.bizId, table.inheritanceDomain, table.status),

    enterpriseInheritanceStrategiesModeCheck: check(
      "enterprise_inheritance_strategies_mode_check",
      sql`
      "resolution_mode" IN ('override_last', 'override_first', 'merge', 'first_match')
      OR "resolution_mode" LIKE 'custom_%'
      `,
    ),
  }),
);

/**
 * enterprise_inheritance_resolutions
 *
 * ELI5:
 * This is a materialized "answer row" for inheritance resolution.
 *
 * Why this exists:
 * - keeps runtime APIs fast and deterministic,
 * - records exactly which merged/overridden output was active,
 * - allows replay/rebuild when strategies change.
 */
export const enterpriseInheritanceResolutions = pgTable(
  "enterprise_inheritance_resolutions",
  {
    id: idWithTag("ent_inherit_resolution"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    strategyId: idRef("strategy_id")
      .references(() => enterpriseInheritanceStrategies.id)
      .notNull(),
    /**
     * Scope pointer to `enterprise_scopes`.
     * One reusable scope row can be referenced by many enterprise modules.
     */
    scopeId: idRef("scope_id")
      .references(() => enterpriseScopes.id)
      .notNull(),

    /** Domain-specific key resolved by this row (for example offer_status). */
    domainKey: varchar("domain_key", { length: 140 }).notNull(),

    resolutionStatus: enterpriseResolutionStatusEnum("resolution_status")
      .default("ready")
      .notNull(),

    /** Monotonic revision counter for same strategy+scope+domain key. */
    resolvedVersion: integer("resolved_version").default(1).notNull(),
    resolutionHash: varchar("resolution_hash", { length: 180 }),

    /** Effective resolved output document used by runtime reads. */
    resolvedDocument: jsonb("resolved_document").default({}).notNull(),

    /** Optional source context snapshot for explainability/replay. */
    sourceSnapshot: jsonb("source_snapshot").default({}).notNull(),

    resolvedAt: timestamp("resolved_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    enterpriseInheritanceResolutionsBizIdIdUnique: uniqueIndex(
      "enterprise_inheritance_resolutions_biz_id_id_unique",
    ).on(table.bizId, table.id),

    enterpriseInheritanceResolutionsScopeUnique: uniqueIndex(
      "enterprise_inheritance_resolutions_scope_unique",
    )
      .on(table.bizId, table.strategyId, table.scopeId, table.domainKey)
      .where(sql`"deleted_at" IS NULL`),

    enterpriseInheritanceResolutionsBizScopeDomainStatusIdx: index(
      "enterprise_inheritance_resolutions_biz_scope_domain_status_idx",
    ).on(
      table.bizId,
      table.scopeId,
      table.domainKey,
      table.resolutionStatus,
      table.resolvedAt,
    ),

    enterpriseInheritanceResolutionsBizStrategyFk: foreignKey({
      columns: [table.bizId, table.strategyId],
      foreignColumns: [enterpriseInheritanceStrategies.bizId, enterpriseInheritanceStrategies.id],
      name: "enterprise_inheritance_resolutions_biz_strategy_fk",
    }),

    enterpriseInheritanceResolutionsBizScopeFk: foreignKey({
      columns: [table.bizId, table.scopeId],
      foreignColumns: [enterpriseScopes.bizId, enterpriseScopes.id],
      name: "enterprise_inheritance_resolutions_biz_scope_fk",
    }),

    enterpriseInheritanceResolutionsShapeCheck: check(
      "enterprise_inheritance_resolutions_shape_check",
      sql`
      length("domain_key") > 0
      AND "resolved_version" > 0
      `,
    ),
  }),
);

/**
 * enterprise_admin_delegations
 *
 * ELI5:
 * One row grants one user delegated enterprise authority from another user.
 *
 * This keeps delegated administration normalized and auditable, so enterprise
 * orgs can safely split responsibilities across regional teams.
 */
export const enterpriseAdminDelegations = pgTable(
  "enterprise_admin_delegations",
  {
    id: idWithTag("ent_delegate"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    delegatorUserId: idRef("delegator_user_id")
      .references(() => users.id)
      .notNull(),
    delegateUserId: idRef("delegate_user_id")
      .references(() => users.id)
      .notNull(),

    /**
     * Action family being delegated.
     * Supports custom enterprise actions with `custom_*`.
     */
    delegationAction: varchar("delegation_action", { length: 100 }).notNull(),

    /**
     * Scope of delegated power, normalized through `enterprise_scopes`.
     */
    scopeId: idRef("scope_id")
      .references(() => enterpriseScopes.id)
      .notNull(),

    status: enterpriseDelegationStatusEnum("status").default("active").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .defaultNow()
      .notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),

    /** If true, delegate may create nested delegations. */
    canSubdelegate: boolean("can_subdelegate").default(false).notNull(),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    enterpriseAdminDelegationsBizIdIdUnique: uniqueIndex(
      "enterprise_admin_delegations_biz_id_id_unique",
    ).on(table.bizId, table.id),

    enterpriseAdminDelegationsActiveUnique: uniqueIndex(
      "enterprise_admin_delegations_active_unique",
    )
      .on(
        table.bizId,
        table.delegatorUserId,
        table.delegateUserId,
        table.delegationAction,
        table.scopeId,
      )
      .where(sql`"status" = 'active' AND "deleted_at" IS NULL`),

    enterpriseAdminDelegationsBizDelegateStatusIdx: index(
      "enterprise_admin_delegations_biz_delegate_status_idx",
    ).on(table.bizId, table.delegateUserId, table.status),

    enterpriseAdminDelegationsBizScopeFk: foreignKey({
      columns: [table.bizId, table.scopeId],
      foreignColumns: [enterpriseScopes.bizId, enterpriseScopes.id],
      name: "enterprise_admin_delegations_biz_scope_fk",
    }),

    enterpriseAdminDelegationsActionCheck: check(
      "enterprise_admin_delegations_action_check",
      sql`
      length("delegation_action") > 0
      `,
    ),

    enterpriseAdminDelegationsShapeCheck: check(
      "enterprise_admin_delegations_shape_check",
      sql`
      "delegator_user_id" <> "delegate_user_id"
      AND (
        "effective_to" IS NULL
        OR "effective_to" > "effective_from"
      )
      `,
    ),
  }),
);

/**
 * enterprise_approval_authority_limits
 *
 * ELI5:
 * One row describes how much authority one user has for one approval action.
 *
 * Example:
 * - "Regional manager can approve discounts up to $5,000 per decision and
 *   $20,000 per day."
 */
export const enterpriseApprovalAuthorityLimits = pgTable(
  "enterprise_approval_authority_limits",
  {
    id: idWithTag("ent_limit"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    userId: idRef("user_id")
      .references(() => users.id)
      .notNull(),

    actionType: varchar("action_type", { length: 100 }).notNull(),
    /**
     * Scope of approval authority, reused from `enterprise_scopes`.
     */
    scopeId: idRef("scope_id")
      .references(() => enterpriseScopes.id)
      .notNull(),

    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    perApprovalLimitMinor: integer("per_approval_limit_minor"),
    dailyLimitMinor: integer("daily_limit_minor"),
    monthlyLimitMinor: integer("monthly_limit_minor"),
    requiresSecondApprover: boolean("requires_second_approver")
      .default(false)
      .notNull(),

    status: lifecycleStatusEnum("status").default("active").notNull(),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    enterpriseApprovalAuthorityLimitsBizIdIdUnique: uniqueIndex(
      "enterprise_approval_authority_limits_biz_id_id_unique",
    ).on(table.bizId, table.id),

    enterpriseApprovalAuthorityLimitsActiveUnique: uniqueIndex(
      "enterprise_approval_authority_limits_active_unique",
    )
      .on(table.bizId, table.userId, table.actionType, table.scopeId)
      .where(sql`"deleted_at" IS NULL`),

    enterpriseApprovalAuthorityLimitsBizUserStatusIdx: index(
      "enterprise_approval_authority_limits_biz_user_status_idx",
    ).on(table.bizId, table.userId, table.status),

    enterpriseApprovalAuthorityLimitsBizScopeFk: foreignKey({
      columns: [table.bizId, table.scopeId],
      foreignColumns: [enterpriseScopes.bizId, enterpriseScopes.id],
      name: "enterprise_approval_authority_limits_biz_scope_fk",
    }),

    enterpriseApprovalAuthorityLimitsActionCheck: check(
      "enterprise_approval_authority_limits_action_check",
      sql`
      length("action_type") > 0
      `,
    ),

    enterpriseApprovalAuthorityLimitsShapeCheck: check(
      "enterprise_approval_authority_limits_shape_check",
      sql`
      "currency" ~ '^[A-Z]{3}$'
      AND (
        "per_approval_limit_minor" IS NULL
        OR "per_approval_limit_minor" >= 0
      )
      AND (
        "daily_limit_minor" IS NULL
        OR "daily_limit_minor" >= 0
      )
      AND (
        "monthly_limit_minor" IS NULL
        OR "monthly_limit_minor" >= 0
      )
      `,
    ),
  }),
);

/**
 * enterprise_intercompany_accounts
 *
 * ELI5:
 * One row defines one accounting lane between two bizes for one purpose/currency.
 *
 * Example:
 * - royalty lane between franchise and parent
 * - management-fee lane between region HQ and local branch
 */
export const enterpriseIntercompanyAccounts = pgTable(
  "enterprise_intercompany_accounts",
  {
    id: idWithTag("ent_ic_acct"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    sourceBizId: idRef("source_biz_id")
      .references(() => bizes.id)
      .notNull(),
    counterpartyBizId: idRef("counterparty_biz_id")
      .references(() => bizes.id)
      .notNull(),

    accountType: intercompanyAccountTypeEnum("account_type").notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    status: lifecycleStatusEnum("status").default("active").notNull(),

    externalAccountRef: varchar("external_account_ref", { length: 140 }),
    description: text("description"),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    enterpriseIntercompanyAccountsBizIdIdUnique: uniqueIndex(
      "enterprise_intercompany_accounts_biz_id_id_unique",
    ).on(table.bizId, table.id),

    enterpriseIntercompanyAccountsActiveLaneUnique: uniqueIndex(
      "enterprise_intercompany_accounts_active_lane_unique",
    )
      .on(
        table.bizId,
        table.sourceBizId,
        table.counterpartyBizId,
        table.accountType,
        table.currency,
      )
      .where(sql`"deleted_at" IS NULL`),

    enterpriseIntercompanyAccountsBizSourceCounterpartyIdx: index(
      "enterprise_intercompany_accounts_biz_source_counterparty_idx",
    ).on(table.bizId, table.sourceBizId, table.counterpartyBizId, table.status),

    enterpriseIntercompanyAccountsShapeCheck: check(
      "enterprise_intercompany_accounts_shape_check",
      sql`
      "source_biz_id" <> "counterparty_biz_id"
      AND "currency" ~ '^[A-Z]{3}$'
      `,
    ),
  }),
);

/**
 * enterprise_intercompany_settlement_runs
 *
 * ELI5:
 * Batch run that settles posted intercompany entries for one lane and window.
 */
export const enterpriseIntercompanySettlementRuns = pgTable(
  "enterprise_intercompany_settlement_runs",
  {
    id: idWithTag("ent_ic_settle_run"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    intercompanyAccountId: idRef("intercompany_account_id")
      .references(() => enterpriseIntercompanyAccounts.id)
      .notNull(),

    status: intercompanySettlementRunStatusEnum("status")
      .default("draft")
      .notNull(),
    windowStartDate: date("window_start_date").notNull(),
    windowEndDate: date("window_end_date").notNull(),

    expectedTotalMinor: integer("expected_total_minor").default(0).notNull(),
    postedTotalMinor: integer("posted_total_minor").default(0).notNull(),
    differenceMinor: integer("difference_minor").default(0).notNull(),

    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    errorSummary: varchar("error_summary", { length: 2000 }),

    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    enterpriseIntercompanySettlementRunsBizIdIdUnique: uniqueIndex(
      "enterprise_intercompany_settlement_runs_biz_id_id_unique",
    ).on(table.bizId, table.id),

    enterpriseIntercompanySettlementRunsBizAccountWindowUnique: uniqueIndex(
      "enterprise_intercompany_settlement_runs_biz_account_window_unique",
    ).on(
      table.bizId,
      table.intercompanyAccountId,
      table.windowStartDate,
      table.windowEndDate,
    ),

    enterpriseIntercompanySettlementRunsBizStatusStartedIdx: index(
      "enterprise_intercompany_settlement_runs_biz_status_started_idx",
    ).on(table.bizId, table.status, table.startedAt),

    enterpriseIntercompanySettlementRunsBizAccountFk: foreignKey({
      columns: [table.bizId, table.intercompanyAccountId],
      foreignColumns: [enterpriseIntercompanyAccounts.bizId, enterpriseIntercompanyAccounts.id],
      name: "enterprise_intercompany_settlement_runs_biz_account_fk",
    }),

    enterpriseIntercompanySettlementRunsWindowCheck: check(
      "enterprise_intercompany_settlement_runs_window_check",
      sql`
      "window_end_date" >= "window_start_date"
      AND "expected_total_minor" >= 0
      AND "posted_total_minor" >= 0
      AND "difference_minor" = ("expected_total_minor" - "posted_total_minor")
      AND ("finished_at" IS NULL OR "finished_at" >= "started_at")
      `,
    ),
  }),
);

/**
 * enterprise_intercompany_entries
 *
 * ELI5:
 * Immutable-ish ledger movements recorded on an intercompany lane.
 *
 * These rows are the accounting-grade timeline for enterprise transfers,
 * royalties, management fees, and settlement adjustments.
 */
export const enterpriseIntercompanyEntries = pgTable(
  "enterprise_intercompany_entries",
  {
    id: idWithTag("ent_ic_entry"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    intercompanyAccountId: idRef("intercompany_account_id")
      .references(() => enterpriseIntercompanyAccounts.id)
      .notNull(),
    settlementRunId: idRef("settlement_run_id").references(
      () => enterpriseIntercompanySettlementRuns.id,
    ),

    entryType: intercompanyEntryTypeEnum("entry_type").notNull(),
    status: intercompanyEntryStatusEnum("status").default("pending").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    description: text("description"),
    referenceKey: varchar("reference_key", { length: 160 }),

    /** Optional anchor to cross-biz commerce event. */
    sourceCrossBizOrderId: idRef("source_cross_biz_order_id").references(
      () => crossBizOrders.id,
    ),

    /** Optional anchor to payment transaction event. */
    sourcePaymentTransactionId: idRef("source_payment_transaction_id").references(
      () => paymentTransactions.id,
    ),

    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    enterpriseIntercompanyEntriesBizIdIdUnique: uniqueIndex(
      "enterprise_intercompany_entries_biz_id_id_unique",
    ).on(table.bizId, table.id),

    enterpriseIntercompanyEntriesBizAccountOccurredIdx: index(
      "enterprise_intercompany_entries_biz_account_occurred_idx",
    ).on(table.bizId, table.intercompanyAccountId, table.occurredAt),

    enterpriseIntercompanyEntriesBizStatusOccurredIdx: index(
      "enterprise_intercompany_entries_biz_status_occurred_idx",
    ).on(table.bizId, table.status, table.occurredAt),

    enterpriseIntercompanyEntriesBizReferenceKeyUnique: uniqueIndex(
      "enterprise_intercompany_entries_biz_reference_key_unique",
    )
      .on(table.bizId, table.referenceKey)
      .where(sql`"reference_key" IS NOT NULL`),

    enterpriseIntercompanyEntriesBizAccountFk: foreignKey({
      columns: [table.bizId, table.intercompanyAccountId],
      foreignColumns: [enterpriseIntercompanyAccounts.bizId, enterpriseIntercompanyAccounts.id],
      name: "enterprise_intercompany_entries_biz_account_fk",
    }),

    enterpriseIntercompanyEntriesBizSettlementRunFk: foreignKey({
      columns: [table.bizId, table.settlementRunId],
      foreignColumns: [enterpriseIntercompanySettlementRuns.bizId, enterpriseIntercompanySettlementRuns.id],
      name: "enterprise_intercompany_entries_biz_settlement_run_fk",
    }),

    enterpriseIntercompanyEntriesBizCrossBizOrderFk: foreignKey({
      columns: [table.bizId, table.sourceCrossBizOrderId],
      foreignColumns: [crossBizOrders.bizId, crossBizOrders.id],
      name: "enterprise_intercompany_entries_biz_cross_biz_order_fk",
    }),

    enterpriseIntercompanyEntriesBizPaymentTransactionFk: foreignKey({
      columns: [table.bizId, table.sourcePaymentTransactionId],
      foreignColumns: [paymentTransactions.bizId, paymentTransactions.id],
      name: "enterprise_intercompany_entries_biz_payment_transaction_fk",
    }),

    enterpriseIntercompanyEntriesShapeCheck: check(
      "enterprise_intercompany_entries_shape_check",
      sql`
      "amount_minor" > 0
      AND "currency" ~ '^[A-Z]{3}$'
      AND (
        "settlement_run_id" IS NULL
        OR "status" IN ('posted', 'reversed', 'voided')
      )
      `,
    ),
  }),
);

/**
 * enterprise_contract_pack_templates
 *
 * ELI5:
 * Reusable contract/rule bundle shell for enterprise rollouts.
 *
 * A pack can represent standardized operational/commercial/legal bundles that
 * many bizes should share with controlled overrides.
 */
export const enterpriseContractPackTemplates = pgTable(
  "enterprise_contract_pack_templates",
  {
    id: idWithTag("ent_pack_tpl"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),

    /** Classification key (ops, finance, legal, compliance, custom, etc.). */
    domainKey: varchar("domain_key", { length: 80 }).default("operations").notNull(),

    description: text("description"),
    status: lifecycleStatusEnum("status").default("active").notNull(),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    enterpriseContractPackTemplatesBizIdIdUnique: uniqueIndex(
      "enterprise_contract_pack_templates_biz_id_id_unique",
    ).on(table.bizId, table.id),

    enterpriseContractPackTemplatesBizSlugUnique: uniqueIndex(
      "enterprise_contract_pack_templates_biz_slug_unique",
    ).on(table.bizId, table.slug),

    enterpriseContractPackTemplatesBizDomainStatusIdx: index(
      "enterprise_contract_pack_templates_biz_domain_status_idx",
    ).on(table.bizId, table.domainKey, table.status),

    enterpriseContractPackTemplatesShapeCheck: check(
      "enterprise_contract_pack_templates_shape_check",
      sql`length("slug") > 0 AND length("domain_key") > 0`,
    ),
  }),
);

/**
 * enterprise_contract_pack_versions
 *
 * ELI5:
 * Immutable-ish version rows for one contract pack template.
 *
 * Each version stores one bundled definition document that can be bound to
 * enterprise scopes with explicit rollout and audit trails.
 */
export const enterpriseContractPackVersions = pgTable(
  "enterprise_contract_pack_versions",
  {
    id: idWithTag("ent_pack_ver"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    contractPackTemplateId: idRef("contract_pack_template_id")
      .references(() => enterpriseContractPackTemplates.id)
      .notNull(),

    versionNumber: integer("version_number").notNull(),
    status: lifecycleStatusEnum("status").default("draft").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),

    /**
     * Pack payload document.
     *
     * Typical contents:
     * - policy template refs
     * - config set refs
     * - override envelopes
     * - legal/contract metadata
     */
    definition: jsonb("definition").default({}).notNull(),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    enterpriseContractPackVersionsBizIdIdUnique: uniqueIndex(
      "enterprise_contract_pack_versions_biz_id_id_unique",
    ).on(table.bizId, table.id),

    enterpriseContractPackVersionsTemplateVersionUnique: uniqueIndex(
      "enterprise_contract_pack_versions_template_version_unique",
    ).on(table.contractPackTemplateId, table.versionNumber),

    enterpriseContractPackVersionsBizTemplateStatusIdx: index(
      "enterprise_contract_pack_versions_biz_template_status_idx",
    ).on(table.bizId, table.contractPackTemplateId, table.status, table.versionNumber),

    enterpriseContractPackVersionsBizTemplateFk: foreignKey({
      columns: [table.bizId, table.contractPackTemplateId],
      foreignColumns: [enterpriseContractPackTemplates.bizId, enterpriseContractPackTemplates.id],
      name: "enterprise_contract_pack_versions_biz_template_fk",
    }),

    enterpriseContractPackVersionsWindowCheck: check(
      "enterprise_contract_pack_versions_window_check",
      sql`
      "version_number" > 0
      AND (
        "effective_from" IS NULL
        OR "effective_to" IS NULL
        OR "effective_to" > "effective_from"
      )
      `,
    ),
  }),
);

/**
 * enterprise_contract_pack_bindings
 *
 * ELI5:
 * Attaches one contract-pack version to one enterprise scope.
 *
 * This enables controlled rollout like:
 * - required globally,
 * - recommended regionally,
 * - optional for specific subjects.
 */
export const enterpriseContractPackBindings = pgTable(
  "enterprise_contract_pack_bindings",
  {
    id: idWithTag("ent_pack_bind"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    contractPackVersionId: idRef("contract_pack_version_id")
      .references(() => enterpriseContractPackVersions.id)
      .notNull(),

    bindingMode: enterpriseContractPackBindingModeEnum("binding_mode")
      .default("required")
      .notNull(),

    /**
     * Binding target scope (network/biz/location/subject) from `enterprise_scopes`.
     */
    scopeId: idRef("scope_id")
      .references(() => enterpriseScopes.id)
      .notNull(),

    /** Marks inherited vs explicitly assigned bind rows. */
    isInherited: boolean("is_inherited").default(false).notNull(),
    priority: integer("priority").default(100).notNull(),

    status: lifecycleStatusEnum("status").default("active").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    enterpriseContractPackBindingsBizIdIdUnique: uniqueIndex(
      "enterprise_contract_pack_bindings_biz_id_id_unique",
    ).on(table.bizId, table.id),

    enterpriseContractPackBindingsActiveUnique: uniqueIndex(
      "enterprise_contract_pack_bindings_active_unique",
    )
      .on(table.bizId, table.contractPackVersionId, table.scopeId)
      .where(sql`"deleted_at" IS NULL`),

    enterpriseContractPackBindingsBizScopeStatusIdx: index(
      "enterprise_contract_pack_bindings_biz_scope_status_idx",
    ).on(table.bizId, table.scopeId, table.status, table.priority),

    enterpriseContractPackBindingsBizPackVersionFk: foreignKey({
      columns: [table.bizId, table.contractPackVersionId],
      foreignColumns: [enterpriseContractPackVersions.bizId, enterpriseContractPackVersions.id],
      name: "enterprise_contract_pack_bindings_biz_pack_version_fk",
    }),

    enterpriseContractPackBindingsBizScopeFk: foreignKey({
      columns: [table.bizId, table.scopeId],
      foreignColumns: [enterpriseScopes.bizId, enterpriseScopes.id],
      name: "enterprise_contract_pack_bindings_biz_scope_fk",
    }),

    enterpriseContractPackBindingsShapeCheck: check(
      "enterprise_contract_pack_bindings_shape_check",
      sql`
      "priority" >= 0
      AND (
        "effective_from" IS NULL
        OR "effective_to" IS NULL
        OR "effective_to" > "effective_from"
      )
      `,
    ),
  }),
);

/**
 * enterprise_identity_providers
 *
 * ELI5:
 * One row describes one enterprise identity provider integration.
 *
 * This is the control-plane anchor for SSO and directory sync.
 */
export const enterpriseIdentityProviders = pgTable(
  "enterprise_identity_providers",
  {
    id: idWithTag("ent_idp"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    providerType: enterpriseIdentityProviderTypeEnum("provider_type").notNull(),
    status: lifecycleStatusEnum("status").default("active").notNull(),

    issuerUrl: varchar("issuer_url", { length: 500 }),
    authorizationUrl: varchar("authorization_url", { length: 500 }),
    tokenUrl: varchar("token_url", { length: 500 }),
    jwksUrl: varchar("jwks_url", { length: 500 }),
    ssoEntryPointUrl: varchar("sso_entry_point_url", { length: 500 }),
    scimBaseUrl: varchar("scim_base_url", { length: 500 }),
    audience: varchar("audience", { length: 255 }),
    clientId: varchar("client_id", { length: 255 }),

    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    enterpriseIdentityProvidersBizIdIdUnique: uniqueIndex(
      "enterprise_identity_providers_biz_id_id_unique",
    ).on(table.bizId, table.id),

    enterpriseIdentityProvidersBizSlugUnique: uniqueIndex(
      "enterprise_identity_providers_biz_slug_unique",
    ).on(table.bizId, table.slug),

    enterpriseIdentityProvidersBizStatusTypeIdx: index(
      "enterprise_identity_providers_biz_status_type_idx",
    ).on(table.bizId, table.status, table.providerType),

    enterpriseIdentityProvidersShapeCheck: check(
      "enterprise_identity_providers_shape_check",
      sql`length("slug") > 0`,
    ),
  }),
);

/**
 * enterprise_scim_sync_states
 *
 * ELI5:
 * One row logs one SCIM sync run state for observability and replay.
 */
export const enterpriseScimSyncStates = pgTable(
  "enterprise_scim_sync_states",
  {
    id: idWithTag("ent_scim_sync"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    identityProviderId: idRef("identity_provider_id")
      .references(() => enterpriseIdentityProviders.id)
      .notNull(),

    status: enterpriseScimSyncStatusEnum("status").default("pending").notNull(),
    syncStartedAt: timestamp("sync_started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    syncFinishedAt: timestamp("sync_finished_at", { withTimezone: true }),

    cursor: varchar("cursor", { length: 1000 }),
    importedUsersCount: integer("imported_users_count").default(0).notNull(),
    updatedUsersCount: integer("updated_users_count").default(0).notNull(),
    deactivatedUsersCount: integer("deactivated_users_count").default(0).notNull(),
    errorSummary: varchar("error_summary", { length: 2000 }),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    enterpriseScimSyncStatesBizIdIdUnique: uniqueIndex(
      "enterprise_scim_sync_states_biz_id_id_unique",
    ).on(table.bizId, table.id),

    enterpriseScimSyncStatesBizProviderStartedIdx: index(
      "enterprise_scim_sync_states_biz_provider_started_idx",
    ).on(table.bizId, table.identityProviderId, table.syncStartedAt),

    enterpriseScimSyncStatesBizStatusStartedIdx: index(
      "enterprise_scim_sync_states_biz_status_started_idx",
    ).on(table.bizId, table.status, table.syncStartedAt),

    enterpriseScimSyncStatesBizProviderFk: foreignKey({
      columns: [table.bizId, table.identityProviderId],
      foreignColumns: [enterpriseIdentityProviders.bizId, enterpriseIdentityProviders.id],
      name: "enterprise_scim_sync_states_biz_provider_fk",
    }),

    enterpriseScimSyncStatesShapeCheck: check(
      "enterprise_scim_sync_states_shape_check",
      sql`
      "imported_users_count" >= 0
      AND "updated_users_count" >= 0
      AND "deactivated_users_count" >= 0
      AND (
        "sync_finished_at" IS NULL
        OR "sync_finished_at" >= "sync_started_at"
      )
      `,
    ),
  }),
);

/**
 * enterprise_external_directory_links
 *
 * ELI5:
 * Maps local principals to enterprise external directory identities.
 *
 * Principal shapes:
 * - principal_type='user'    -> user_id populated
 * - principal_type='subject' -> subject reference populated
 * - principal_type='custom_*' -> either shape can be used by extension policy
 */
export const enterpriseExternalDirectoryLinks = pgTable(
  "enterprise_external_directory_links",
  {
    id: idWithTag("ent_dir_link"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    identityProviderId: idRef("identity_provider_id")
      .references(() => enterpriseIdentityProviders.id)
      .notNull(),

    principalType: varchar("principal_type", { length: 60 }).notNull(),
    userId: idRef("user_id").references(() => users.id),
    subjectType: varchar("subject_type", { length: 80 }),
    subjectId: varchar("subject_id", { length: 140 }),

    externalDirectoryId: varchar("external_directory_id", { length: 200 }).notNull(),
    externalParentId: varchar("external_parent_id", { length: 200 }),
    status: enterpriseDirectoryLinkStatusEnum("status").default("active").notNull(),

    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    enterpriseExternalDirectoryLinksBizIdIdUnique: uniqueIndex(
      "enterprise_external_directory_links_biz_id_id_unique",
    ).on(table.bizId, table.id),

    enterpriseExternalDirectoryLinksExternalUnique: uniqueIndex(
      "enterprise_external_directory_links_external_unique",
    )
      .on(table.bizId, table.identityProviderId, table.externalDirectoryId)
      .where(sql`"deleted_at" IS NULL`),

    enterpriseExternalDirectoryLinksPrincipalUnique: uniqueIndex(
      "enterprise_external_directory_links_principal_unique",
    )
      .on(
        table.bizId,
        table.identityProviderId,
        table.principalType,
        table.userId,
        table.subjectType,
        table.subjectId,
      )
      .where(sql`"deleted_at" IS NULL`),

    enterpriseExternalDirectoryLinksBizProviderStatusIdx: index(
      "enterprise_external_directory_links_biz_provider_status_idx",
    ).on(table.bizId, table.identityProviderId, table.status),

    enterpriseExternalDirectoryLinksBizProviderFk: foreignKey({
      columns: [table.bizId, table.identityProviderId],
      foreignColumns: [enterpriseIdentityProviders.bizId, enterpriseIdentityProviders.id],
      name: "enterprise_external_directory_links_biz_provider_fk",
    }),

    enterpriseExternalDirectoryLinksSubjectFk: foreignKey({
      columns: [table.bizId, table.subjectType, table.subjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "enterprise_external_directory_links_subject_fk",
    }),

    enterpriseExternalDirectoryLinksShapeCheck: check(
      "enterprise_external_directory_links_shape_check",
      sql`
      length("external_directory_id") > 0
      AND (
        ("principal_type" = 'user'
          AND "user_id" IS NOT NULL
          AND "subject_type" IS NULL
          AND "subject_id" IS NULL
        ) OR
        ("principal_type" = 'subject'
          AND "user_id" IS NULL
          AND "subject_type" IS NOT NULL
          AND "subject_id" IS NOT NULL
        ) OR
        ("principal_type" LIKE 'custom_%'
          AND (
            "user_id" IS NOT NULL
            OR ("subject_type" IS NOT NULL AND "subject_id" IS NOT NULL)
          )
        )
      )
      `,
    ),
  }),
);

/**
 * fact_enterprise_revenue_daily
 *
 * ELI5:
 * Daily enterprise revenue projection for fast parent-level reporting.
 */
export const factEnterpriseRevenueDaily = pgTable(
  "fact_enterprise_revenue_daily",
  {
    id: idWithTag("fact_ent_rev_day"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    memberBizId: idRef("member_biz_id").references(() => bizes.id),
    factDate: date("fact_date").notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    grossMinor: integer("gross_minor").default(0).notNull(),
    feeMinor: integer("fee_minor").default(0).notNull(),
    refundMinor: integer("refund_minor").default(0).notNull(),
    netMinor: integer("net_minor").default(0).notNull(),
    ordersCount: integer("orders_count").default(0).notNull(),

    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    factEnterpriseRevenueDailyBizIdIdUnique: uniqueIndex("fact_enterprise_revenue_daily_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    factEnterpriseRevenueDailySliceUnique: uniqueIndex(
      "fact_enterprise_revenue_daily_slice_unique",
    ).on(table.bizId, table.memberBizId, table.factDate, table.currency),

    factEnterpriseRevenueDailyBizDateIdx: index(
      "fact_enterprise_revenue_daily_biz_date_idx",
    ).on(table.bizId, table.factDate),

    factEnterpriseRevenueDailyShapeCheck: check(
      "fact_enterprise_revenue_daily_shape_check",
      sql`
      "currency" ~ '^[A-Z]{3}$'
      AND "gross_minor" >= 0
      AND "fee_minor" >= 0
      AND "refund_minor" >= 0
      AND "orders_count" >= 0
      AND "net_minor" = ("gross_minor" + "fee_minor" - "refund_minor")
      `,
    ),
  }),
);

/**
 * fact_enterprise_utilization_daily
 *
 * ELI5:
 * Daily utilization projection at enterprise level.
 */
export const factEnterpriseUtilizationDaily = pgTable(
  "fact_enterprise_utilization_daily",
  {
    id: idWithTag("fact_ent_util_day"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    memberBizId: idRef("member_biz_id").references(() => bizes.id),
    factDate: date("fact_date").notNull(),

    availableMinutes: integer("available_minutes").default(0).notNull(),
    scheduledMinutes: integer("scheduled_minutes").default(0).notNull(),
    blockedMinutes: integer("blocked_minutes").default(0).notNull(),
    /** Utilization in basis points (10000 = 100%). */
    utilizationBps: integer("utilization_bps").default(0).notNull(),

    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    factEnterpriseUtilizationDailyBizIdIdUnique: uniqueIndex("fact_enterprise_utilization_daily_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    factEnterpriseUtilizationDailySliceUnique: uniqueIndex(
      "fact_enterprise_utilization_daily_slice_unique",
    ).on(table.bizId, table.memberBizId, table.factDate),

    factEnterpriseUtilizationDailyBizDateIdx: index(
      "fact_enterprise_utilization_daily_biz_date_idx",
    ).on(table.bizId, table.factDate),

    factEnterpriseUtilizationDailyShapeCheck: check(
      "fact_enterprise_utilization_daily_shape_check",
      sql`
      "available_minutes" >= 0
      AND "scheduled_minutes" >= 0
      AND "blocked_minutes" >= 0
      AND "utilization_bps" >= 0
      AND "utilization_bps" <= 20000
      `,
    ),
  }),
);

/**
 * fact_enterprise_compliance_daily
 *
 * ELI5:
 * Daily compliance/risk projection for enterprise control dashboards.
 */
export const factEnterpriseComplianceDaily = pgTable(
  "fact_enterprise_compliance_daily",
  {
    id: idWithTag("fact_ent_compliance_day"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    memberBizId: idRef("member_biz_id").references(() => bizes.id),
    factDate: date("fact_date").notNull(),

    openIncidentsCount: integer("open_incidents_count").default(0).notNull(),
    openBreachesCount: integer("open_breaches_count").default(0).notNull(),
    overdueReviewCount: integer("overdue_review_count").default(0).notNull(),
    resolvedIncidentsCount: integer("resolved_incidents_count").default(0).notNull(),
    /** Optional normalized score in basis points (10000 = 100). */
    complianceScoreBps: integer("compliance_score_bps"),

    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    factEnterpriseComplianceDailyBizIdIdUnique: uniqueIndex("fact_enterprise_compliance_daily_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    factEnterpriseComplianceDailySliceUnique: uniqueIndex(
      "fact_enterprise_compliance_daily_slice_unique",
    ).on(table.bizId, table.memberBizId, table.factDate),

    factEnterpriseComplianceDailyBizDateIdx: index(
      "fact_enterprise_compliance_daily_biz_date_idx",
    ).on(table.bizId, table.factDate),

    factEnterpriseComplianceDailyShapeCheck: check(
      "fact_enterprise_compliance_daily_shape_check",
      sql`
      "open_incidents_count" >= 0
      AND "open_breaches_count" >= 0
      AND "overdue_review_count" >= 0
      AND "resolved_incidents_count" >= 0
      AND (
        "compliance_score_bps" IS NULL
        OR (
          "compliance_score_bps" >= 0
          AND "compliance_score_bps" <= 10000
        )
      )
      `,
    ),
  }),
);

/**
 * enterprise_change_rollout_runs
 *
 * ELI5:
 * One run tracks staged rollout of a change across enterprise targets.
 *
 * Examples:
 * - publish a new config dictionary version to 200 locations,
 * - bind a new contract pack version across one region,
 * - roll out new policy rules in phases.
 */
export const enterpriseChangeRolloutRuns = pgTable(
  "enterprise_change_rollout_runs",
  {
    id: idWithTag("ent_rollout_run"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 120 }),

    changeType: varchar("change_type", { length: 100 }).notNull(),
    status: enterpriseRolloutStatusEnum("status").default("draft").notNull(),

    sourceRevision: varchar("source_revision", { length: 160 }),
    targetRevision: varchar("target_revision", { length: 160 }),
    requestedByUserId: idRef("requested_by_user_id").references(() => users.id),

    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    errorSummary: varchar("error_summary", { length: 2000 }),

    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    enterpriseChangeRolloutRunsBizIdIdUnique: uniqueIndex(
      "enterprise_change_rollout_runs_biz_id_id_unique",
    ).on(table.bizId, table.id),

    enterpriseChangeRolloutRunsBizSlugUnique: uniqueIndex(
      "enterprise_change_rollout_runs_biz_slug_unique",
    )
      .on(table.bizId, table.slug)
      .where(sql`"slug" IS NOT NULL`),

    enterpriseChangeRolloutRunsBizStatusStartedIdx: index(
      "enterprise_change_rollout_runs_biz_status_started_idx",
    ).on(table.bizId, table.status, table.startedAt),

    enterpriseChangeRolloutRunsShapeCheck: check(
      "enterprise_change_rollout_runs_shape_check",
      sql`
      length("change_type") > 0
      AND ("slug" IS NULL OR length("slug") > 0)
      AND ("finished_at" IS NULL OR "finished_at" >= "started_at")
      `,
    ),
  }),
);

/**
 * enterprise_change_rollout_targets
 *
 * ELI5:
 * One row is one target scope inside one rollout run.
 *
 * This allows deterministic staged execution, retries, and per-target status.
 */
export const enterpriseChangeRolloutTargets = pgTable(
  "enterprise_change_rollout_targets",
  {
    id: idWithTag("ent_rollout_target"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    rolloutRunId: idRef("rollout_run_id")
      .references(() => enterpriseChangeRolloutRuns.id)
      .notNull(),

    /**
     * Target scope for this rollout step.
     */
    scopeId: idRef("scope_id")
      .references(() => enterpriseScopes.id)
      .notNull(),

    targetOrder: integer("target_order").default(100).notNull(),
    status: enterpriseRolloutTargetStatusEnum("status").default("pending").notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    errorSummary: varchar("error_summary", { length: 2000 }),

    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    enterpriseChangeRolloutTargetsBizIdIdUnique: uniqueIndex(
      "enterprise_change_rollout_targets_biz_id_id_unique",
    ).on(table.bizId, table.id),

    enterpriseChangeRolloutTargetsRunScopeUnique: uniqueIndex(
      "enterprise_change_rollout_targets_run_scope_unique",
    )
      .on(table.bizId, table.rolloutRunId, table.scopeId)
      .where(sql`"deleted_at" IS NULL`),

    enterpriseChangeRolloutTargetsBizRunStatusOrderIdx: index(
      "enterprise_change_rollout_targets_biz_run_status_order_idx",
    ).on(table.bizId, table.rolloutRunId, table.status, table.targetOrder),

    enterpriseChangeRolloutTargetsBizRunFk: foreignKey({
      columns: [table.bizId, table.rolloutRunId],
      foreignColumns: [enterpriseChangeRolloutRuns.bizId, enterpriseChangeRolloutRuns.id],
      name: "enterprise_change_rollout_targets_biz_run_fk",
    }),

    enterpriseChangeRolloutTargetsBizScopeFk: foreignKey({
      columns: [table.bizId, table.scopeId],
      foreignColumns: [enterpriseScopes.bizId, enterpriseScopes.id],
      name: "enterprise_change_rollout_targets_biz_scope_fk",
    }),

    enterpriseChangeRolloutTargetsShapeCheck: check(
      "enterprise_change_rollout_targets_shape_check",
      sql`
      "target_order" >= 0
      AND (
        ("status" = 'applied' AND "applied_at" IS NOT NULL)
        OR ("status" <> 'applied')
      )
      `,
    ),
  }),
);

/**
 * enterprise_change_rollout_results
 *
 * ELI5:
 * Fine-grained result trail for each rollout target execution attempt/outcome.
 *
 * This is the troubleshooting and explainability ledger for rollout behavior.
 */
export const enterpriseChangeRolloutResults = pgTable(
  "enterprise_change_rollout_results",
  {
    id: idWithTag("ent_rollout_result"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    rolloutTargetId: idRef("rollout_target_id")
      .references(() => enterpriseChangeRolloutTargets.id)
      .notNull(),

    resultType: varchar("result_type", { length: 80 }).default("applied").notNull(),
    resultCode: varchar("result_code", { length: 120 }),
    message: text("message"),
    beforeSnapshot: jsonb("before_snapshot").default({}),
    afterSnapshot: jsonb("after_snapshot").default({}),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    enterpriseChangeRolloutResultsBizIdIdUnique: uniqueIndex(
      "enterprise_change_rollout_results_biz_id_id_unique",
    ).on(table.bizId, table.id),

    enterpriseChangeRolloutResultsBizTargetIdx: index(
      "enterprise_change_rollout_results_biz_target_idx",
    ).on(table.bizId, table.rolloutTargetId),

    enterpriseChangeRolloutResultsBizTargetFk: foreignKey({
      columns: [table.bizId, table.rolloutTargetId],
      foreignColumns: [enterpriseChangeRolloutTargets.bizId, enterpriseChangeRolloutTargets.id],
      name: "enterprise_change_rollout_results_biz_target_fk",
    }),

    enterpriseChangeRolloutResultsTypeCheck: check(
      "enterprise_change_rollout_results_type_check",
      sql`
      "result_type" IN ('applied', 'skipped', 'failed', 'rolled_back', 'no_change')
      OR "result_type" LIKE 'custom_%'
      `,
    ),
  }),
);
