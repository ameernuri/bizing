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
import { arInvoices } from "./ar";
import { bizes } from "./bizes";
import { bookingOrderLines, bookingOrders } from "./fulfillment";
import { offerVersions } from "./offers";
import {
  commitmentClaimEventTypeEnum,
  commitmentClaimResolutionTypeEnum,
  commitmentClaimStatusEnum,
  commitmentClaimTypeEnum,
  commitmentContractStatusEnum,
  commitmentContractTypeEnum,
  commitmentMilestoneEvaluationModeEnum,
  commitmentMilestoneReleaseModeEnum,
  commitmentMilestoneStatusEnum,
  commitmentObligationStatusEnum,
  commitmentObligationTypeEnum,
  lifecycleStatusEnum,
  securedBalanceAccountStatusEnum,
  securedBalanceAccountTypeEnum,
  securedBalanceAllocationTypeEnum,
  securedBalanceLedgerEntryStatusEnum,
  securedBalanceLedgerEntryTypeEnum,
} from "./enums";
import { paymentTransactionLineAllocations, paymentTransactions } from "./payments";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * commitment_contracts
 *
 * ELI5:
 * This is the parent agreement row for "money should be held/released when
 * specific conditions are satisfied".
 *
 * Why this table exists:
 * - We need one generic contract primitive that can represent escrow, retainage,
 *   service commitments, or any custom assurance flow.
 * - It should work across industries without hardcoding one vertical workflow.
 *
 * How this connects to the bigger schema:
 * - obligations define condition-level requirements.
 * - milestones define release gates and release amounts.
 * - secured-balance accounts hold and move money tied to this contract.
 * - claims/events model dispute and resolution lifecycle.
 */
export const commitmentContracts = pgTable(
  "commitment_contracts",
  {
    /** Stable primary key for one commitment agreement. */
    id: idWithTag("commitment_contract"),

    /** Tenant boundary for strict isolation. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Contract family (escrow/retainage/service/custom). */
    contractType: commitmentContractTypeEnum("contract_type").notNull(),

    /** Contract lifecycle state. */
    status: commitmentContractStatusEnum("status").default("draft").notNull(),

    /** Human-readable title for operators and reports. */
    title: varchar("title", { length: 220 }).notNull(),

    /** Optional long-form description of agreement purpose. */
    description: text("description"),

    /**
     * Canonical anchor subject this contract is about.
     *
     * Example anchors:
     * - one marketplace order subject,
     * - one project/site subject,
     * - one custom plugin subject.
     */
    anchorSubjectType: varchar("anchor_subject_type", { length: 80 }).notNull(),
    anchorSubjectId: varchar("anchor_subject_id", { length: 140 }).notNull(),

    /**
     * Optional counterparty subject (who the contract is against/with).
     * Pair is fully-null or fully-set.
     */
    counterpartySubjectType: varchar("counterparty_subject_type", { length: 80 }),
    counterpartySubjectId: varchar("counterparty_subject_id", { length: 140 }),

    /** Optional hot-path pointer when contract is tied to one offer version. */
    offerVersionId: idRef("offer_version_id").references(() => offerVersions.id),

    /** Optional hot-path pointer when contract is tied to one booking order. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional hot-path pointer when contract is tied to one AR invoice. */
    arInvoiceId: idRef("ar_invoice_id").references(() => arInvoices.id),

    /** Settlement currency for this agreement. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Total committed amount under this contract in minor units. */
    committedAmountMinor: integer("committed_amount_minor").default(0).notNull(),

    /** Cumulative released amount in minor units. */
    releasedAmountMinor: integer("released_amount_minor").default(0).notNull(),

    /** Cumulative forfeited amount in minor units. */
    forfeitedAmountMinor: integer("forfeited_amount_minor").default(0).notNull(),

    /** Contract activation timestamp. */
    startedAt: timestamp("started_at", { withTimezone: true }),

    /** Optional contract expiration timestamp. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Optional completion timestamp. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Optional cancellation timestamp. */
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    /**
     * Immutable policy snapshot captured at agreement commit time.
     *
     * Keep core query fields explicit in columns and use this for policy
     * details that are not part of relational hot paths.
     */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Extension payload for non-indexed metadata. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe child references. */
    commitmentContractsBizIdIdUnique: uniqueIndex(
      "commitment_contracts_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Main board path by lifecycle and timeline. */
    commitmentContractsBizStatusStartedIdx: index(
      "commitment_contracts_biz_status_started_idx",
    ).on(table.bizId, table.status, table.startedAt),

    /** Reverse lookup path by anchor subject. */
    commitmentContractsBizAnchorSubjectIdx: index(
      "commitment_contracts_biz_anchor_subject_idx",
    ).on(table.bizId, table.anchorSubjectType, table.anchorSubjectId),

    /** Reverse lookup path by counterparty subject. */
    commitmentContractsBizCounterpartySubjectIdx: index(
      "commitment_contracts_biz_counterparty_subject_idx",
    ).on(table.bizId, table.counterpartySubjectType, table.counterpartySubjectId),

    /** Tenant-safe FK for anchor subject. */
    commitmentContractsBizAnchorSubjectFk: foreignKey({
      columns: [table.bizId, table.anchorSubjectType, table.anchorSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "commitment_contracts_biz_anchor_subject_fk",
    }),

    /** Tenant-safe FK for optional counterparty subject. */
    commitmentContractsBizCounterpartySubjectFk: foreignKey({
      columns: [table.bizId, table.counterpartySubjectType, table.counterpartySubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "commitment_contracts_biz_counterparty_subject_fk",
    }),

    /** Tenant-safe FK for optional offer-version pointer. */
    commitmentContractsBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "commitment_contracts_biz_offer_version_fk",
    }),

    /** Tenant-safe FK for optional booking-order pointer. */
    commitmentContractsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "commitment_contracts_biz_booking_order_fk",
    }),

    /** Tenant-safe FK for optional AR-invoice pointer. */
    commitmentContractsBizArInvoiceFk: foreignKey({
      columns: [table.bizId, table.arInvoiceId],
      foreignColumns: [arInvoices.bizId, arInvoices.id],
      name: "commitment_contracts_biz_ar_invoice_fk",
    }),

    /** Counterparty pair should be fully-null or fully-populated. */
    commitmentContractsCounterpartyPairCheck: check(
      "commitment_contracts_counterparty_pair_check",
      sql`
      (
        "counterparty_subject_type" IS NULL
        AND "counterparty_subject_id" IS NULL
      ) OR (
        "counterparty_subject_type" IS NOT NULL
        AND "counterparty_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Amount bounds and reconciliation sanity checks. */
    commitmentContractsAmountBoundsCheck: check(
      "commitment_contracts_amount_bounds_check",
      sql`
      "committed_amount_minor" >= 0
      AND "released_amount_minor" >= 0
      AND "forfeited_amount_minor" >= 0
      AND ("released_amount_minor" + "forfeited_amount_minor") <= "committed_amount_minor"
      `,
    ),

    /** Contract timeline should be ordered when timestamps are present. */
    commitmentContractsTimelineCheck: check(
      "commitment_contracts_timeline_check",
      sql`
      (
        "started_at" IS NULL
        OR "expires_at" IS NULL
        OR "expires_at" > "started_at"
      )
      AND (
        "started_at" IS NULL
        OR "completed_at" IS NULL
        OR "completed_at" >= "started_at"
      )
      AND (
        "started_at" IS NULL
        OR "cancelled_at" IS NULL
        OR "cancelled_at" >= "started_at"
      )
      `,
    ),

    /** Keep status and terminal timestamps aligned. */
    commitmentContractsStatusShapeCheck: check(
      "commitment_contracts_status_shape_check",
      sql`
      (
        "status" = 'completed'
        AND "completed_at" IS NOT NULL
      ) OR (
        "status" = 'cancelled'
        AND "cancelled_at" IS NOT NULL
      ) OR (
        "status" IN ('draft', 'active', 'paused', 'defaulted', 'disputed')
        AND "completed_at" IS NULL
        AND "cancelled_at" IS NULL
      )
      `,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    commitmentContractsCurrencyFormatCheck: check(
      "commitment_contracts_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * commitment_obligations
 *
 * ELI5:
 * One row = one condition that must be satisfied under a contract.
 *
 * Examples:
 * - vendor must deliver service,
 * - buyer must provide evidence,
 * - inspection must pass,
 * - payment tranche must clear.
 */
export const commitmentObligations = pgTable(
  "commitment_obligations",
  {
    /** Stable primary key for one obligation. */
    id: idWithTag("commitment_obligation"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent contract. */
    commitmentContractId: idRef("commitment_contract_id")
      .references(() => commitmentContracts.id)
      .notNull(),

    /** Obligation semantic category. */
    obligationType: commitmentObligationTypeEnum("obligation_type").notNull(),

    /** Obligation lifecycle state. */
    status: commitmentObligationStatusEnum("status").default("pending").notNull(),

    /** Human-readable obligation title. */
    title: varchar("title", { length: 220 }).notNull(),

    /** Optional detailed description. */
    description: text("description"),

    /** Optional subject expected to satisfy this obligation. */
    obligorSubjectType: varchar("obligor_subject_type", { length: 80 }),
    obligorSubjectId: varchar("obligor_subject_id", { length: 140 }),

    /** Optional subject that benefits when obligation is satisfied. */
    beneficiarySubjectType: varchar("beneficiary_subject_type", { length: 80 }),
    beneficiarySubjectId: varchar("beneficiary_subject_id", { length: 140 }),

    /** Optional amount required for money-bearing obligations. */
    requiredAmountMinor: integer("required_amount_minor"),

    /** Amount currently satisfied (if measurable in money). */
    satisfiedAmountMinor: integer("satisfied_amount_minor").default(0),

    /** Currency used when amount fields are present. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Optional due timestamp for SLA/penalty logic. */
    dueAt: timestamp("due_at", { withTimezone: true }),

    /** Satisfaction timestamp when status reaches satisfied. */
    satisfiedAt: timestamp("satisfied_at", { withTimezone: true }),

    /** Breach timestamp when status reaches breached. */
    breachedAt: timestamp("breached_at", { withTimezone: true }),

    /** Waive timestamp when status reaches waived. */
    waivedAt: timestamp("waived_at", { withTimezone: true }),

    /** Cancel timestamp when status reaches cancelled. */
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    /**
     * Optional source pointer for custom/plugin obligation emitters.
     * Pair is fully-null or fully-set.
     */
    sourceSubjectType: varchar("source_subject_type", { length: 80 }),
    sourceSubjectId: varchar("source_subject_id", { length: 140 }),

    /** Ordering hint for deterministic rendering/evaluation. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Evidence/validation policy snapshot for this obligation. */
    evidencePolicy: jsonb("evidence_policy").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references to this obligation row. */
    commitmentObligationsBizIdIdUnique: uniqueIndex(
      "commitment_obligations_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Composite key used by milestone requirement joins. */
    commitmentObligationsBizContractIdIdUnique: uniqueIndex(
      "commitment_obligations_biz_contract_id_id_unique",
    ).on(table.bizId, table.commitmentContractId, table.id),

    /** Main obligation board path by contract/status/due date. */
    commitmentObligationsBizContractStatusDueIdx: index(
      "commitment_obligations_biz_contract_status_due_idx",
    ).on(table.bizId, table.commitmentContractId, table.status, table.dueAt),

    /** Reverse lookup path by obligor subject. */
    commitmentObligationsBizObligorSubjectIdx: index(
      "commitment_obligations_biz_obligor_subject_idx",
    ).on(table.bizId, table.obligorSubjectType, table.obligorSubjectId),

    /** Reverse lookup path by beneficiary subject. */
    commitmentObligationsBizBeneficiarySubjectIdx: index(
      "commitment_obligations_biz_beneficiary_subject_idx",
    ).on(table.bizId, table.beneficiarySubjectType, table.beneficiarySubjectId),

    /** Tenant-safe FK to parent contract. */
    commitmentObligationsBizContractFk: foreignKey({
      columns: [table.bizId, table.commitmentContractId],
      foreignColumns: [commitmentContracts.bizId, commitmentContracts.id],
      name: "commitment_obligations_biz_contract_fk",
    }),

    /** Tenant-safe FK to optional obligor subject. */
    commitmentObligationsBizObligorSubjectFk: foreignKey({
      columns: [table.bizId, table.obligorSubjectType, table.obligorSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "commitment_obligations_biz_obligor_subject_fk",
    }),

    /** Tenant-safe FK to optional beneficiary subject. */
    commitmentObligationsBizBeneficiarySubjectFk: foreignKey({
      columns: [table.bizId, table.beneficiarySubjectType, table.beneficiarySubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "commitment_obligations_biz_beneficiary_subject_fk",
    }),

    /** Tenant-safe FK to optional source subject. */
    commitmentObligationsBizSourceSubjectFk: foreignKey({
      columns: [table.bizId, table.sourceSubjectType, table.sourceSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "commitment_obligations_biz_source_subject_fk",
    }),

    /** Subject pair shapes should stay deterministic. */
    commitmentObligationsSubjectPairCheck: check(
      "commitment_obligations_subject_pair_check",
      sql`
      (
        "obligor_subject_type" IS NULL
        AND "obligor_subject_id" IS NULL
      ) OR (
        "obligor_subject_type" IS NOT NULL
        AND "obligor_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Beneficiary subject pair should stay deterministic. */
    commitmentObligationsBeneficiaryPairCheck: check(
      "commitment_obligations_beneficiary_pair_check",
      sql`
      (
        "beneficiary_subject_type" IS NULL
        AND "beneficiary_subject_id" IS NULL
      ) OR (
        "beneficiary_subject_type" IS NOT NULL
        AND "beneficiary_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Source subject pair should stay deterministic. */
    commitmentObligationsSourcePairCheck: check(
      "commitment_obligations_source_pair_check",
      sql`
      (
        "source_subject_type" IS NULL
        AND "source_subject_id" IS NULL
      ) OR (
        "source_subject_type" IS NOT NULL
        AND "source_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Money, sort, and currency sanity checks. */
    commitmentObligationsAmountBoundsCheck: check(
      "commitment_obligations_amount_bounds_check",
      sql`
      ("required_amount_minor" IS NULL OR "required_amount_minor" >= 0)
      AND ("satisfied_amount_minor" IS NULL OR "satisfied_amount_minor" >= 0)
      AND (
        "required_amount_minor" IS NULL
        OR "satisfied_amount_minor" IS NULL
        OR "satisfied_amount_minor" <= "required_amount_minor"
      )
      AND "sort_order" >= 0
      `,
    ),

    /** Keep status and terminal timestamps aligned. */
    commitmentObligationsStatusShapeCheck: check(
      "commitment_obligations_status_shape_check",
      sql`
      (
        "status" = 'satisfied'
        AND "satisfied_at" IS NOT NULL
        AND "breached_at" IS NULL
        AND "waived_at" IS NULL
        AND "cancelled_at" IS NULL
      ) OR (
        "status" = 'breached'
        AND "breached_at" IS NOT NULL
        AND "satisfied_at" IS NULL
      ) OR (
        "status" = 'waived'
        AND "waived_at" IS NOT NULL
        AND "cancelled_at" IS NULL
      ) OR (
        "status" = 'cancelled'
        AND "cancelled_at" IS NOT NULL
      ) OR (
        "status" IN ('pending', 'in_progress', 'expired')
        AND "satisfied_at" IS NULL
        AND "breached_at" IS NULL
        AND "waived_at" IS NULL
        AND "cancelled_at" IS NULL
      )
      `,
    ),

    /** Timestamp ordering safety checks. */
    commitmentObligationsTimelineCheck: check(
      "commitment_obligations_timeline_check",
      sql`
      (
        "due_at" IS NULL
        OR "satisfied_at" IS NULL
        OR "satisfied_at" >= "due_at" - interval '100 years'
      )
      AND (
        "satisfied_at" IS NULL
        OR "breached_at" IS NULL
        OR "breached_at" >= "satisfied_at" - interval '100 years'
      )
      `,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    commitmentObligationsCurrencyFormatCheck: check(
      "commitment_obligations_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * commitment_milestones
 *
 * ELI5:
 * Milestones are contract release gates.
 * A milestone says: "when these obligations are satisfied, release this amount".
 */
export const commitmentMilestones = pgTable(
  "commitment_milestones",
  {
    /** Stable primary key for one milestone. */
    id: idWithTag("commitment_milestone"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent contract. */
    commitmentContractId: idRef("commitment_contract_id")
      .references(() => commitmentContracts.id)
      .notNull(),

    /** Stable key for API/import references. */
    code: varchar("code", { length: 100 }).notNull(),

    /** Human-readable milestone label. */
    title: varchar("title", { length: 220 }).notNull(),

    /** Optional detailed description. */
    description: text("description"),

    /** Milestone lifecycle state. */
    status: commitmentMilestoneStatusEnum("status").default("pending").notNull(),

    /** How linked obligations are evaluated for this gate. */
    evaluationMode: commitmentMilestoneEvaluationModeEnum("evaluation_mode")
      .default("all")
      .notNull(),

    /** Minimum satisfied obligations when `evaluation_mode=threshold`. */
    minSatisfiedCount: integer("min_satisfied_count"),

    /** Manual vs automatic release behavior. */
    releaseMode: commitmentMilestoneReleaseModeEnum("release_mode")
      .default("manual")
      .notNull(),

    /** Amount to release when this milestone releases, in minor units. */
    releaseAmountMinor: integer("release_amount_minor").default(0).notNull(),

    /** Settlement currency for release amount. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Optional due timestamp. */
    dueAt: timestamp("due_at", { withTimezone: true }),

    /** Timestamp when gate became ready. */
    readyAt: timestamp("ready_at", { withTimezone: true }),

    /** Timestamp when release was posted. */
    releasedAt: timestamp("released_at", { withTimezone: true }),

    /** Timestamp when milestone was cancelled. */
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    /** Optional actor that executed release. */
    releasedByUserId: idRef("released_by_user_id").references(() => users.id),

    /** Rendering/evaluation ordering hint. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Immutable policy snapshot for release logic explainability. */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references to this milestone row. */
    commitmentMilestonesBizIdIdUnique: uniqueIndex(
      "commitment_milestones_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Composite key used by milestone requirement joins. */
    commitmentMilestonesBizContractIdIdUnique: uniqueIndex(
      "commitment_milestones_biz_contract_id_id_unique",
    ).on(table.bizId, table.commitmentContractId, table.id),

    /** One stable milestone code per contract. */
    commitmentMilestonesContractCodeUnique: uniqueIndex(
      "commitment_milestones_contract_code_unique",
    ).on(table.commitmentContractId, table.code),

    /** Main board path by contract and status. */
    commitmentMilestonesBizContractStatusDueIdx: index(
      "commitment_milestones_biz_contract_status_due_idx",
    ).on(table.bizId, table.commitmentContractId, table.status, table.dueAt),

    /** Tenant-safe FK to parent contract. */
    commitmentMilestonesBizContractFk: foreignKey({
      columns: [table.bizId, table.commitmentContractId],
      foreignColumns: [commitmentContracts.bizId, commitmentContracts.id],
      name: "commitment_milestones_biz_contract_fk",
    }),

    /** Non-empty code + bounds checks. */
    commitmentMilestonesBoundsCheck: check(
      "commitment_milestones_bounds_check",
      sql`
      length("code") > 0
      AND "release_amount_minor" >= 0
      AND "sort_order" >= 0
      AND ("min_satisfied_count" IS NULL OR "min_satisfied_count" > 0)
      `,
    ),

    /** Threshold config should match evaluation mode. */
    commitmentMilestonesEvaluationShapeCheck: check(
      "commitment_milestones_evaluation_shape_check",
      sql`
      (
        "evaluation_mode" IN ('all', 'any')
        AND "min_satisfied_count" IS NULL
      ) OR (
        "evaluation_mode" = 'threshold'
        AND "min_satisfied_count" IS NOT NULL
      )
      `,
    ),

    /** Keep status and terminal timestamps aligned. */
    commitmentMilestonesStatusShapeCheck: check(
      "commitment_milestones_status_shape_check",
      sql`
      (
        "status" = 'pending'
        AND "ready_at" IS NULL
        AND "released_at" IS NULL
        AND "cancelled_at" IS NULL
      ) OR (
        "status" = 'ready'
        AND "ready_at" IS NOT NULL
        AND "released_at" IS NULL
        AND "cancelled_at" IS NULL
      ) OR (
        "status" = 'released'
        AND "released_at" IS NOT NULL
        AND "cancelled_at" IS NULL
      ) OR (
        "status" = 'cancelled'
        AND "cancelled_at" IS NOT NULL
      ) OR (
        "status" = 'skipped'
        AND "released_at" IS NULL
      )
      `,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    commitmentMilestonesCurrencyFormatCheck: check(
      "commitment_milestones_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * commitment_milestone_obligations
 *
 * ELI5:
 * This join table says which obligations participate in which milestone gate.
 *
 * Why this table exists:
 * - one milestone can depend on many obligations,
 * - one obligation can contribute to many milestones,
 * - this keeps milestone evaluation explicit and queryable.
 */
export const commitmentMilestoneObligations = pgTable(
  "commitment_milestone_obligations",
  {
    /** Stable primary key for one milestone-obligation link row. */
    id: idWithTag("commitment_milestone_obligation"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent contract for coherence checks and tenant-safe FKs. */
    commitmentContractId: idRef("commitment_contract_id")
      .references(() => commitmentContracts.id)
      .notNull(),

    /** Milestone being configured. */
    commitmentMilestoneId: idRef("commitment_milestone_id")
      .references(() => commitmentMilestones.id)
      .notNull(),

    /** Obligation contributing to milestone evaluation. */
    commitmentObligationId: idRef("commitment_obligation_id")
      .references(() => commitmentObligations.id)
      .notNull(),

    /** If false, link can be used as advisory weight only. */
    isRequired: boolean("is_required").default(true).notNull(),

    /** Relative contribution weight for threshold scoring. */
    weight: integer("weight").default(1).notNull(),

    /** Ordering hint for deterministic UI rendering. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    commitmentMilestoneObligationsBizIdIdUnique: uniqueIndex("commitment_milestone_obligations_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Prevent duplicate links for the same milestone/obligation pair. */
    commitmentMilestoneObligationsUnique: uniqueIndex(
      "commitment_milestone_obligations_unique",
    )
      .on(table.commitmentMilestoneId, table.commitmentObligationId)
      .where(sql`"deleted_at" IS NULL`),

    /** Main expansion path for one milestone. */
    commitmentMilestoneObligationsBizMilestoneIdx: index(
      "commitment_milestone_obligations_biz_milestone_idx",
    ).on(table.bizId, table.commitmentMilestoneId, table.sortOrder),

    /** Reverse lookup path for obligations. */
    commitmentMilestoneObligationsBizObligationIdx: index(
      "commitment_milestone_obligations_biz_obligation_idx",
    ).on(table.bizId, table.commitmentObligationId),

    /** Tenant-safe FK to parent contract. */
    commitmentMilestoneObligationsBizContractFk: foreignKey({
      columns: [table.bizId, table.commitmentContractId],
      foreignColumns: [commitmentContracts.bizId, commitmentContracts.id],
      name: "commitment_milestone_obligations_biz_contract_fk",
    }),

    /**
     * Tenant-safe/coherent FK to milestone using contract+id tuple.
     * This prevents linking a milestone from a different contract.
     */
    commitmentMilestoneObligationsBizMilestoneFk: foreignKey({
      columns: [table.bizId, table.commitmentContractId, table.commitmentMilestoneId],
      foreignColumns: [
        commitmentMilestones.bizId,
        commitmentMilestones.commitmentContractId,
        commitmentMilestones.id,
      ],
      name: "commitment_milestone_obligations_biz_milestone_fk",
    }),

    /**
     * Tenant-safe/coherent FK to obligation using contract+id tuple.
     * This prevents linking an obligation from a different contract.
     */
    commitmentMilestoneObligationsBizObligationFk: foreignKey({
      columns: [table.bizId, table.commitmentContractId, table.commitmentObligationId],
      foreignColumns: [
        commitmentObligations.bizId,
        commitmentObligations.commitmentContractId,
        commitmentObligations.id,
      ],
      name: "commitment_milestone_obligations_biz_obligation_fk",
    }),

    /** Basic numeric bounds. */
    commitmentMilestoneObligationsBoundsCheck: check(
      "commitment_milestone_obligations_bounds_check",
      sql`"weight" > 0 AND "sort_order" >= 0`,
    ),
  }),
);

/**
 * secured_balance_accounts
 *
 * ELI5:
 * This is the money bucket used by commitment contracts.
 *
 * One account can represent escrow, retainage, deposit hold, or other
 * assurance balances.
 */
export const securedBalanceAccounts = pgTable(
  "secured_balance_accounts",
  {
    /** Stable primary key for one secured-balance account. */
    id: idWithTag("secured_balance_account"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional parent contract when this account is contract-scoped. */
    commitmentContractId: idRef("commitment_contract_id").references(
      () => commitmentContracts.id,
    ),

    /** Account family. */
    accountType: securedBalanceAccountTypeEnum("account_type").notNull(),

    /** Account lifecycle state. */
    status: securedBalanceAccountStatusEnum("status").default("open").notNull(),

    /** Human-readable account name. */
    title: varchar("title", { length: 220 }).notNull(),

    /** Optional long-form description. */
    description: text("description"),

    /** Account currency. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Current posted balance in minor units. */
    balanceMinor: integer("balance_minor").default(0).notNull(),

    /** Current held amount in minor units. */
    heldMinor: integer("held_minor").default(0).notNull(),

    /** Cumulative released amount in minor units. */
    releasedMinor: integer("released_minor").default(0).notNull(),

    /** Cumulative forfeited amount in minor units. */
    forfeitedMinor: integer("forfeited_minor").default(0).notNull(),

    /** Owning subject for this account (who funds belong to). */
    ownerSubjectType: varchar("owner_subject_type", { length: 80 }).notNull(),
    ownerSubjectId: varchar("owner_subject_id", { length: 140 }).notNull(),

    /** Optional counterparty subject for bilateral settlements. */
    counterpartySubjectType: varchar("counterparty_subject_type", { length: 80 }),
    counterpartySubjectId: varchar("counterparty_subject_id", { length: 140 }),

    /** Optional open timestamp. */
    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional close timestamp. */
    closedAt: timestamp("closed_at", { withTimezone: true }),

    /** Account policy snapshot for explainability. */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe child references. */
    securedBalanceAccountsBizIdIdUnique: uniqueIndex(
      "secured_balance_accounts_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Main board path by contract/status. */
    securedBalanceAccountsBizContractStatusIdx: index(
      "secured_balance_accounts_biz_contract_status_idx",
    ).on(table.bizId, table.commitmentContractId, table.status),

    /** Reverse lookup path by owner subject. */
    securedBalanceAccountsBizOwnerSubjectIdx: index(
      "secured_balance_accounts_biz_owner_subject_idx",
    ).on(table.bizId, table.ownerSubjectType, table.ownerSubjectId),

    /** Tenant-safe FK to optional parent contract. */
    securedBalanceAccountsBizContractFk: foreignKey({
      columns: [table.bizId, table.commitmentContractId],
      foreignColumns: [commitmentContracts.bizId, commitmentContracts.id],
      name: "secured_balance_accounts_biz_contract_fk",
    }),

    /** Tenant-safe FK to owner subject. */
    securedBalanceAccountsBizOwnerSubjectFk: foreignKey({
      columns: [table.bizId, table.ownerSubjectType, table.ownerSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "secured_balance_accounts_biz_owner_subject_fk",
    }),

    /** Tenant-safe FK to optional counterparty subject. */
    securedBalanceAccountsBizCounterpartySubjectFk: foreignKey({
      columns: [table.bizId, table.counterpartySubjectType, table.counterpartySubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "secured_balance_accounts_biz_counterparty_subject_fk",
    }),

    /** Counterparty pair should be fully-null or fully-populated. */
    securedBalanceAccountsCounterpartyPairCheck: check(
      "secured_balance_accounts_counterparty_pair_check",
      sql`
      (
        "counterparty_subject_type" IS NULL
        AND "counterparty_subject_id" IS NULL
      ) OR (
        "counterparty_subject_type" IS NOT NULL
        AND "counterparty_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Balance-related bounds and consistency checks. */
    securedBalanceAccountsBalanceCheck: check(
      "secured_balance_accounts_balance_check",
      sql`
      "balance_minor" >= 0
      AND "held_minor" >= 0
      AND "released_minor" >= 0
      AND "forfeited_minor" >= 0
      AND "held_minor" <= "balance_minor"
      `,
    ),

    /** Timeline/status consistency for closed accounts. */
    securedBalanceAccountsStatusShapeCheck: check(
      "secured_balance_accounts_status_shape_check",
      sql`
      (
        "status" = 'closed'
        AND "closed_at" IS NOT NULL
      ) OR (
        "status" <> 'closed'
        AND "closed_at" IS NULL
      )
      `,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    securedBalanceAccountsCurrencyFormatCheck: check(
      "secured_balance_accounts_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * secured_balance_ledger_entries
 *
 * ELI5:
 * Immutable money-movement rows for secured-balance accounts.
 *
 * Why this table exists:
 * - account balance fields are convenient snapshots,
 * - ledger entries are the audit truth of how balances changed.
 */
export const securedBalanceLedgerEntries = pgTable(
  "secured_balance_ledger_entries",
  {
    /** Stable primary key for one ledger movement. */
    id: idWithTag("secured_balance_ledger_entry"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent secured-balance account. */
    securedBalanceAccountId: idRef("secured_balance_account_id")
      .references(() => securedBalanceAccounts.id)
      .notNull(),

    /** Ledger movement category. */
    entryType: securedBalanceLedgerEntryTypeEnum("entry_type").notNull(),

    /** Ledger posting state. */
    status: securedBalanceLedgerEntryStatusEnum("status")
      .default("posted")
      .notNull(),

    /** Event timestamp for this movement. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Movement currency. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Signed balance delta applied to account balance snapshot. */
    balanceDeltaMinor: integer("balance_delta_minor").default(0).notNull(),

    /** Signed held-amount delta applied to account hold snapshot. */
    heldDeltaMinor: integer("held_delta_minor").default(0).notNull(),

    /** Optional contract context pointer. */
    commitmentContractId: idRef("commitment_contract_id").references(
      () => commitmentContracts.id,
    ),

    /** Optional milestone context pointer. */
    commitmentMilestoneId: idRef("commitment_milestone_id").references(
      () => commitmentMilestones.id,
    ),

    /** Optional obligation context pointer. */
    commitmentObligationId: idRef("commitment_obligation_id").references(
      () => commitmentObligations.id,
    ),

    /** Optional payment transaction context pointer. */
    paymentTransactionId: idRef("payment_transaction_id").references(
      () => paymentTransactions.id,
    ),

    /** Optional AR invoice context pointer. */
    arInvoiceId: idRef("ar_invoice_id").references(() => arInvoices.id),

    /** Optional booking-order context pointer. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional booking-order-line context pointer. */
    bookingOrderLineId: idRef("booking_order_line_id").references(
      () => bookingOrderLines.id,
    ),

    /** Optional plugin/custom context pointer pair. */
    sourceSubjectType: varchar("source_subject_type", { length: 80 }),
    sourceSubjectId: varchar("source_subject_id", { length: 140 }),

    /** Optional idempotency key for retry-safe posting. */
    idempotencyKey: varchar("idempotency_key", { length: 200 }),

    /** Optional normalized reason code. */
    reasonCode: varchar("reason_code", { length: 120 }),

    /** Optional human note. */
    notes: text("notes"),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe allocation/claim-event FKs. */
    securedBalanceLedgerEntriesBizIdIdUnique: uniqueIndex(
      "secured_balance_ledger_entries_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Optional idempotency guard for posting retries. */
    securedBalanceLedgerEntriesBizIdempotencyUnique: uniqueIndex(
      "secured_balance_ledger_entries_biz_idempotency_unique",
    )
      .on(table.bizId, table.idempotencyKey)
      .where(sql`"idempotency_key" IS NOT NULL`),

    /** Main account timeline query path. */
    securedBalanceLedgerEntriesBizAccountOccurredIdx: index(
      "secured_balance_ledger_entries_biz_account_occurred_idx",
    ).on(table.bizId, table.securedBalanceAccountId, table.occurredAt),

    /** Status monitor query path. */
    securedBalanceLedgerEntriesBizStatusOccurredIdx: index(
      "secured_balance_ledger_entries_biz_status_occurred_idx",
    ).on(table.bizId, table.status, table.occurredAt),

    /** Tenant-safe FK to parent account. */
    securedBalanceLedgerEntriesBizAccountFk: foreignKey({
      columns: [table.bizId, table.securedBalanceAccountId],
      foreignColumns: [securedBalanceAccounts.bizId, securedBalanceAccounts.id],
      name: "secured_balance_ledger_entries_biz_account_fk",
    }),

    /** Tenant-safe FK to optional contract context. */
    securedBalanceLedgerEntriesBizContractFk: foreignKey({
      columns: [table.bizId, table.commitmentContractId],
      foreignColumns: [commitmentContracts.bizId, commitmentContracts.id],
      name: "secured_balance_ledger_entries_biz_contract_fk",
    }),

    /** Tenant-safe FK to optional milestone context. */
    securedBalanceLedgerEntriesBizMilestoneFk: foreignKey({
      columns: [table.bizId, table.commitmentMilestoneId],
      foreignColumns: [commitmentMilestones.bizId, commitmentMilestones.id],
      name: "secured_balance_ledger_entries_biz_milestone_fk",
    }),

    /** Tenant-safe FK to optional obligation context. */
    securedBalanceLedgerEntriesBizObligationFk: foreignKey({
      columns: [table.bizId, table.commitmentObligationId],
      foreignColumns: [commitmentObligations.bizId, commitmentObligations.id],
      name: "secured_balance_ledger_entries_biz_obligation_fk",
    }),

    /** Tenant-safe FK to optional payment transaction context. */
    securedBalanceLedgerEntriesBizPaymentTransactionFk: foreignKey({
      columns: [table.bizId, table.paymentTransactionId],
      foreignColumns: [paymentTransactions.bizId, paymentTransactions.id],
      name: "secured_balance_ledger_entries_biz_payment_transaction_fk",
    }),

    /** Tenant-safe FK to optional AR invoice context. */
    securedBalanceLedgerEntriesBizArInvoiceFk: foreignKey({
      columns: [table.bizId, table.arInvoiceId],
      foreignColumns: [arInvoices.bizId, arInvoices.id],
      name: "secured_balance_ledger_entries_biz_ar_invoice_fk",
    }),

    /** Tenant-safe FK to optional booking-order context. */
    securedBalanceLedgerEntriesBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "secured_balance_ledger_entries_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to optional booking-order-line context. */
    securedBalanceLedgerEntriesBizBookingOrderLineFk: foreignKey({
      columns: [table.bizId, table.bookingOrderLineId],
      foreignColumns: [bookingOrderLines.bizId, bookingOrderLines.id],
      name: "secured_balance_ledger_entries_biz_booking_order_line_fk",
    }),

    /** Tenant-safe FK to optional plugin/custom context subject. */
    securedBalanceLedgerEntriesBizSourceSubjectFk: foreignKey({
      columns: [table.bizId, table.sourceSubjectType, table.sourceSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "secured_balance_ledger_entries_biz_source_subject_fk",
    }),

    /** Source subject pair should be fully-null or fully-populated. */
    securedBalanceLedgerEntriesSourcePairCheck: check(
      "secured_balance_ledger_entries_source_pair_check",
      sql`
      (
        "source_subject_type" IS NULL
        AND "source_subject_id" IS NULL
      ) OR (
        "source_subject_type" IS NOT NULL
        AND "source_subject_id" IS NOT NULL
      )
      `,
    ),

    /** At least one delta must be non-zero to avoid no-op ledger rows. */
    securedBalanceLedgerEntriesDeltaCheck: check(
      "secured_balance_ledger_entries_delta_check",
      sql`"balance_delta_minor" <> 0 OR "held_delta_minor" <> 0`,
    ),

    /** At least one context pointer should exist for traceability. */
    securedBalanceLedgerEntriesContextCheck: check(
      "secured_balance_ledger_entries_context_check",
      sql`
      (
        ("commitment_contract_id" IS NOT NULL)::int
        + ("commitment_milestone_id" IS NOT NULL)::int
        + ("commitment_obligation_id" IS NOT NULL)::int
        + ("payment_transaction_id" IS NOT NULL)::int
        + ("ar_invoice_id" IS NOT NULL)::int
        + ("booking_order_id" IS NOT NULL)::int
        + ("booking_order_line_id" IS NOT NULL)::int
        + ("source_subject_type" IS NOT NULL)::int
      ) >= 1
      `,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    securedBalanceLedgerEntriesCurrencyFormatCheck: check(
      "secured_balance_ledger_entries_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * secured_balance_allocations
 *
 * ELI5:
 * One allocation row explains "which obligation/milestone/line this ledger
 * movement amount was applied to".
 *
 * Why this table exists:
 * - gives clean, queryable traceability from secured funds to concrete targets,
 * - avoids opaque app-only accounting splits.
 */
export const securedBalanceAllocations = pgTable(
  "secured_balance_allocations",
  {
    /** Stable primary key for one allocation row. */
    id: idWithTag("secured_balance_allocation"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent ledger movement being allocated. */
    securedBalanceLedgerEntryId: idRef("secured_balance_ledger_entry_id")
      .references(() => securedBalanceLedgerEntries.id)
      .notNull(),

    /** Allocation semantic category. */
    allocationType: securedBalanceAllocationTypeEnum("allocation_type").notNull(),

    /** Allocated amount in minor units (positive magnitude). */
    allocatedAmountMinor: integer("allocated_amount_minor").notNull(),

    /** Allocation currency. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Optional target obligation. */
    commitmentObligationId: idRef("commitment_obligation_id").references(
      () => commitmentObligations.id,
    ),

    /** Optional target milestone. */
    commitmentMilestoneId: idRef("commitment_milestone_id").references(
      () => commitmentMilestones.id,
    ),

    /** Optional target booking order line. */
    bookingOrderLineId: idRef("booking_order_line_id").references(
      () => bookingOrderLines.id,
    ),

    /** Optional target AR invoice. */
    arInvoiceId: idRef("ar_invoice_id").references(() => arInvoices.id),

    /**
     * Optional pointer to tender-to-line allocation row.
     * This ties secured settlement back to specific payment allocation lineage.
     */
    paymentTransactionLineAllocationId: idRef(
      "payment_transaction_line_allocation_id",
    ).references(() => paymentTransactionLineAllocations.id),

    /** Optional plugin/custom allocation target. */
    targetSubjectType: varchar("target_subject_type", { length: 80 }),
    targetSubjectId: varchar("target_subject_id", { length: 140 }),

    /** Allocation timestamp. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe cross-links. */
    securedBalanceAllocationsBizIdIdUnique: uniqueIndex(
      "secured_balance_allocations_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Main expansion path for one ledger movement. */
    securedBalanceAllocationsBizLedgerIdx: index(
      "secured_balance_allocations_biz_ledger_idx",
    ).on(table.bizId, table.securedBalanceLedgerEntryId),

    /** Reverse lookup path for obligation allocations. */
    securedBalanceAllocationsBizObligationIdx: index(
      "secured_balance_allocations_biz_obligation_idx",
    ).on(table.bizId, table.commitmentObligationId),

    /** Reverse lookup path for milestone allocations. */
    securedBalanceAllocationsBizMilestoneIdx: index(
      "secured_balance_allocations_biz_milestone_idx",
    ).on(table.bizId, table.commitmentMilestoneId),

    /** Tenant-safe FK to parent ledger movement. */
    securedBalanceAllocationsBizLedgerFk: foreignKey({
      columns: [table.bizId, table.securedBalanceLedgerEntryId],
      foreignColumns: [securedBalanceLedgerEntries.bizId, securedBalanceLedgerEntries.id],
      name: "secured_balance_allocations_biz_ledger_fk",
    }),

    /** Tenant-safe FK to optional obligation target. */
    securedBalanceAllocationsBizObligationFk: foreignKey({
      columns: [table.bizId, table.commitmentObligationId],
      foreignColumns: [commitmentObligations.bizId, commitmentObligations.id],
      name: "secured_balance_allocations_biz_obligation_fk",
    }),

    /** Tenant-safe FK to optional milestone target. */
    securedBalanceAllocationsBizMilestoneFk: foreignKey({
      columns: [table.bizId, table.commitmentMilestoneId],
      foreignColumns: [commitmentMilestones.bizId, commitmentMilestones.id],
      name: "secured_balance_allocations_biz_milestone_fk",
    }),

    /** Tenant-safe FK to optional booking-line target. */
    securedBalanceAllocationsBizBookingOrderLineFk: foreignKey({
      columns: [table.bizId, table.bookingOrderLineId],
      foreignColumns: [bookingOrderLines.bizId, bookingOrderLines.id],
      name: "secured_balance_allocations_biz_booking_order_line_fk",
    }),

    /** Tenant-safe FK to optional AR invoice target. */
    securedBalanceAllocationsBizArInvoiceFk: foreignKey({
      columns: [table.bizId, table.arInvoiceId],
      foreignColumns: [arInvoices.bizId, arInvoices.id],
      name: "secured_balance_allocations_biz_ar_invoice_fk",
    }),

    /** Tenant-safe FK to optional payment line-allocation pointer. */
    securedBalanceAllocationsBizPaymentLineAllocFk: foreignKey({
      columns: [table.bizId, table.paymentTransactionLineAllocationId],
      foreignColumns: [
        paymentTransactionLineAllocations.bizId,
        paymentTransactionLineAllocations.id,
      ],
      name: "secured_balance_allocations_biz_payment_line_alloc_fk",
    }),

    /** Tenant-safe FK to optional custom target subject. */
    securedBalanceAllocationsBizTargetSubjectFk: foreignKey({
      columns: [table.bizId, table.targetSubjectType, table.targetSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "secured_balance_allocations_biz_target_subject_fk",
    }),

    /** Target subject pair should be fully-null or fully-populated. */
    securedBalanceAllocationsTargetPairCheck: check(
      "secured_balance_allocations_target_pair_check",
      sql`
      (
        "target_subject_type" IS NULL
        AND "target_subject_id" IS NULL
      ) OR (
        "target_subject_type" IS NOT NULL
        AND "target_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Allocation amount should be strictly positive. */
    securedBalanceAllocationsAmountCheck: check(
      "secured_balance_allocations_amount_check",
      sql`"allocated_amount_minor" > 0`,
    ),

    /** At least one concrete allocation target should be set. */
    securedBalanceAllocationsTargetShapeCheck: check(
      "secured_balance_allocations_target_shape_check",
      sql`
      (
        ("commitment_obligation_id" IS NOT NULL)::int
        + ("commitment_milestone_id" IS NOT NULL)::int
        + ("booking_order_line_id" IS NOT NULL)::int
        + ("ar_invoice_id" IS NOT NULL)::int
        + ("payment_transaction_line_allocation_id" IS NOT NULL)::int
        + ("target_subject_type" IS NOT NULL)::int
      ) >= 1
      `,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    securedBalanceAllocationsCurrencyFormatCheck: check(
      "secured_balance_allocations_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * commitment_claims
 *
 * ELI5:
 * Claim rows represent disputes/issues against a commitment contract.
 *
 * This is intentionally generic so the same model can handle:
 * - escrow release disputes,
 * - quality/delivery disputes,
 * - damage claims,
 * - billing disagreements.
 */
export const commitmentClaims = pgTable(
  "commitment_claims",
  {
    /** Stable primary key for one claim. */
    id: idWithTag("commitment_claim"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent contract under dispute. */
    commitmentContractId: idRef("commitment_contract_id")
      .references(() => commitmentContracts.id)
      .notNull(),

    /** Claim semantic category. */
    claimType: commitmentClaimTypeEnum("claim_type").notNull(),

    /** Claim lifecycle state. */
    status: commitmentClaimStatusEnum("status").default("open").notNull(),

    /** Optional resolution outcome for resolved/closed claims. */
    resolutionType: commitmentClaimResolutionTypeEnum("resolution_type"),

    /** Human-readable claim title. */
    title: varchar("title", { length: 220 }).notNull(),

    /** Optional long-form issue summary. */
    description: text("description"),

    /** Subject raising the claim. */
    raisedBySubjectType: varchar("raised_by_subject_type", { length: 80 }).notNull(),
    raisedBySubjectId: varchar("raised_by_subject_id", { length: 140 }).notNull(),

    /** Optional subject the claim is raised against. */
    againstSubjectType: varchar("against_subject_type", { length: 80 }),
    againstSubjectId: varchar("against_subject_id", { length: 140 }),

    /** Claim open timestamp. */
    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional response-by timestamp for SLA escalation. */
    respondByAt: timestamp("respond_by_at", { withTimezone: true }),

    /** Optional resolve timestamp. */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),

    /** Optional close timestamp. */
    closedAt: timestamp("closed_at", { withTimezone: true }),

    /** Optional disputed amount in minor units. */
    disputedAmountMinor: integer("disputed_amount_minor"),

    /** Optional settled amount in minor units. */
    settledAmountMinor: integer("settled_amount_minor"),

    /** Currency for amount fields when present. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Optional resolver actor. */
    resolvedByUserId: idRef("resolved_by_user_id").references(() => users.id),

    /** Immutable policy snapshot used during claim handling. */
    policySnapshot: jsonb("policy_snapshot").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite unique key for tenant-safe claim-event links. */
    commitmentClaimsBizIdIdUnique: uniqueIndex(
      "commitment_claims_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Main claim board path by contract/status/opened time. */
    commitmentClaimsBizContractStatusOpenedIdx: index(
      "commitment_claims_biz_contract_status_opened_idx",
    ).on(table.bizId, table.commitmentContractId, table.status, table.openedAt),

    /** Reverse lookup path by raising subject. */
    commitmentClaimsBizRaisedBySubjectIdx: index(
      "commitment_claims_biz_raised_by_subject_idx",
    ).on(table.bizId, table.raisedBySubjectType, table.raisedBySubjectId),

    /** Tenant-safe FK to parent contract. */
    commitmentClaimsBizContractFk: foreignKey({
      columns: [table.bizId, table.commitmentContractId],
      foreignColumns: [commitmentContracts.bizId, commitmentContracts.id],
      name: "commitment_claims_biz_contract_fk",
    }),

    /** Tenant-safe FK to raising subject. */
    commitmentClaimsBizRaisedBySubjectFk: foreignKey({
      columns: [table.bizId, table.raisedBySubjectType, table.raisedBySubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "commitment_claims_biz_raised_by_subject_fk",
    }),

    /** Tenant-safe FK to optional against subject. */
    commitmentClaimsBizAgainstSubjectFk: foreignKey({
      columns: [table.bizId, table.againstSubjectType, table.againstSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "commitment_claims_biz_against_subject_fk",
    }),

    /** Against-subject pair should be fully-null or fully-populated. */
    commitmentClaimsAgainstPairCheck: check(
      "commitment_claims_against_pair_check",
      sql`
      (
        "against_subject_type" IS NULL
        AND "against_subject_id" IS NULL
      ) OR (
        "against_subject_type" IS NOT NULL
        AND "against_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Monetary bounds for disputed/settled amounts. */
    commitmentClaimsAmountBoundsCheck: check(
      "commitment_claims_amount_bounds_check",
      sql`
      ("disputed_amount_minor" IS NULL OR "disputed_amount_minor" >= 0)
      AND ("settled_amount_minor" IS NULL OR "settled_amount_minor" >= 0)
      AND (
        "disputed_amount_minor" IS NULL
        OR "settled_amount_minor" IS NULL
        OR "settled_amount_minor" <= "disputed_amount_minor"
      )
      `,
    ),

    /** Timeline ordering sanity checks. */
    commitmentClaimsTimelineCheck: check(
      "commitment_claims_timeline_check",
      sql`
      (
        "respond_by_at" IS NULL
        OR "respond_by_at" >= "opened_at"
      )
      AND (
        "resolved_at" IS NULL
        OR "resolved_at" >= "opened_at"
      )
      AND (
        "closed_at" IS NULL
        OR "closed_at" >= "opened_at"
      )
      `,
    ),

    /** Keep status and resolution timestamps aligned. */
    commitmentClaimsStatusShapeCheck: check(
      "commitment_claims_status_shape_check",
      sql`
      (
        "status" = 'open'
        AND "resolved_at" IS NULL
        AND "closed_at" IS NULL
        AND "resolution_type" IS NULL
      ) OR (
        "status" IN ('in_review', 'escalated')
        AND "closed_at" IS NULL
      ) OR (
        "status" = 'resolved'
        AND "resolved_at" IS NOT NULL
        AND "resolution_type" IS NOT NULL
      ) OR (
        "status" = 'closed'
        AND "resolved_at" IS NOT NULL
        AND "closed_at" IS NOT NULL
        AND "resolution_type" IS NOT NULL
      ) OR (
        "status" IN ('rejected', 'cancelled')
        AND "closed_at" IS NOT NULL
      )
      `,
    ),

    /** Currency should always use uppercase ISO-like code shape. */
    commitmentClaimsCurrencyFormatCheck: check(
      "commitment_claims_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * commitment_claim_events
 *
 * ELI5:
 * Immutable timeline entries for claim lifecycle history.
 *
 * This table makes claim handling auditable and replay-friendly.
 */
export const commitmentClaimEvents = pgTable(
  "commitment_claim_events",
  {
    /** Stable primary key for one claim event row. */
    id: idWithTag("commitment_claim_event"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent claim. */
    commitmentClaimId: idRef("commitment_claim_id")
      .references(() => commitmentClaims.id)
      .notNull(),

    /** Event category. */
    eventType: commitmentClaimEventTypeEnum("event_type").notNull(),

    /** Event occurrence timestamp. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional actor user pointer for human actions. */
    actorUserId: idRef("actor_user_id").references(() => users.id),

    /** Optional actor subject pointer for plugin/system actor identities. */
    actorSubjectType: varchar("actor_subject_type", { length: 80 }),
    actorSubjectId: varchar("actor_subject_id", { length: 140 }),

    /** Optional link to secured-balance ledger movement created by this event. */
    securedBalanceLedgerEntryId: idRef("secured_balance_ledger_entry_id").references(
      () => securedBalanceLedgerEntries.id,
    ),

    /** Optional short note. */
    note: text("note"),

    /** Structured event payload. */
    payload: jsonb("payload").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    commitmentClaimEventsBizIdIdUnique: uniqueIndex("commitment_claim_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Main timeline query path by claim and timestamp. */
    commitmentClaimEventsBizClaimOccurredIdx: index(
      "commitment_claim_events_biz_claim_occurred_idx",
    ).on(table.bizId, table.commitmentClaimId, table.occurredAt),

    /** Reverse lookup path by actor subject. */
    commitmentClaimEventsBizActorSubjectIdx: index(
      "commitment_claim_events_biz_actor_subject_idx",
    ).on(table.bizId, table.actorSubjectType, table.actorSubjectId),

    /** Tenant-safe FK to parent claim. */
    commitmentClaimEventsBizClaimFk: foreignKey({
      columns: [table.bizId, table.commitmentClaimId],
      foreignColumns: [commitmentClaims.bizId, commitmentClaims.id],
      name: "commitment_claim_events_biz_claim_fk",
    }),

    /** Tenant-safe FK to optional actor subject. */
    commitmentClaimEventsBizActorSubjectFk: foreignKey({
      columns: [table.bizId, table.actorSubjectType, table.actorSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "commitment_claim_events_biz_actor_subject_fk",
    }),

    /** Tenant-safe FK to optional secured-balance ledger movement. */
    commitmentClaimEventsBizLedgerEntryFk: foreignKey({
      columns: [table.bizId, table.securedBalanceLedgerEntryId],
      foreignColumns: [securedBalanceLedgerEntries.bizId, securedBalanceLedgerEntries.id],
      name: "commitment_claim_events_biz_ledger_entry_fk",
    }),

    /** Actor subject pair should be fully-null or fully-populated. */
    commitmentClaimEventsActorPairCheck: check(
      "commitment_claim_events_actor_pair_check",
      sql`
      (
        "actor_subject_type" IS NULL
        AND "actor_subject_id" IS NULL
      ) OR (
        "actor_subject_type" IS NOT NULL
        AND "actor_subject_id" IS NOT NULL
      )
      `,
    ),
  }),
);
