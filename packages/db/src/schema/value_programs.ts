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
import { actionRequests } from "./action_backbone";
import { bizes } from "./bizes";
import { domainEvents } from "./domain_events";
import {
  lifecycleStatusEnum,
  valueAccountStatusEnum,
  valueEvaluationStatusEnum,
  valueLedgerEntryTypeEnum,
  valueProgramAccountModelEnum,
  valueProgramKindEnum,
  valueRuleStatusEnum,
  valueTransferStatusEnum,
  valueUnitKindEnum,
} from "./enums";
import { groupAccounts } from "./group_accounts";
import { debugSnapshots, projectionDocuments } from "./projections";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * value_programs
 *
 * ELI5:
 * Program shell for loyalty/points/credits mechanics.
 * This defines one reusable value economy for a tenant.
 */
export const valuePrograms = pgTable(
  "value_programs",
  {
    /** Stable primary key. */
    id: idWithTag("value_program"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human-readable program label. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable slug used in APIs/import pipelines. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Business intent (loyalty, cashback, referral, etc). */
    kind: valueProgramKindEnum("kind").default("loyalty").notNull(),

    /** Default account owner model used by this program. */
    accountModel: valueProgramAccountModelEnum("account_model")
      .default("user")
      .notNull(),

    /** Unit semantics for balances and ledger movements. */
    unitKind: valueUnitKindEnum("unit_kind").default("points").notNull(),

    /** Lifecycle status for publish/retire flows. */
    status: lifecycleStatusEnum("status").default("draft").notNull(),

    /** Currency hint for programs that map to money-like credits. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Optional cap for one account balance in this program. */
    maxBalanceUnits: integer("max_balance_units"),

    /** Whether accounts may go negative. */
    allowNegativeBalance: boolean("allow_negative_balance")
      .default(false)
      .notNull(),

    /** Whether account-to-account transfers are enabled. */
    allowTransfers: boolean("allow_transfers").default(false).notNull(),

    /** Optional conversion ratio (basis points). */
    pointsToCurrencyRateBps: integer("points_to_currency_rate_bps"),

    /** Program-level behavior knobs and policy switches. */
    policy: jsonb("policy").default({}).notNull(),

    /** Canonical action linked to shell writes. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),

    /** Latest business event associated with this program shell. */
    latestDomainEventId: idRef("latest_domain_event_id").references(
      () => domainEvents.id,
    ),

    /** Optional read-model row for dashboards. */
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),

    /** Optional debug payload for misconfig/rule drift. */
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    valueProgramsBizIdIdUnique: uniqueIndex("value_programs_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    valueProgramsBizSlugUnique: uniqueIndex("value_programs_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),

    valueProgramsBizStatusKindIdx: index("value_programs_biz_status_kind_idx").on(
      table.bizId,
      table.status,
      table.kind,
    ),

    valueProgramsActionRequestIdx: index("value_programs_action_request_idx").on(
      table.actionRequestId,
    ),

    valueProgramsBizActionRequestFk: foreignKey({
      columns: [table.bizId, table.actionRequestId],
      foreignColumns: [actionRequests.bizId, actionRequests.id],
      name: "value_programs_biz_action_request_fk",
    }),

    valueProgramsBoundsCheck: check(
      "value_programs_bounds_check",
      sql`
      ("max_balance_units" IS NULL OR "max_balance_units" > 0)
      AND ("points_to_currency_rate_bps" IS NULL OR "points_to_currency_rate_bps" >= 0)
      `,
    ),

    valueProgramsCurrencyFormatCheck: check(
      "value_programs_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),
  }),
);

/**
 * value_program_tiers
 *
 * ELI5:
 * Tier ladder for a program (Bronze/Silver/Gold/etc).
 * Tiers are optional but when present they define deterministic promotion rules.
 */
export const valueProgramTiers = pgTable(
  "value_program_tiers",
  {
    /** Stable primary key. */
    id: idWithTag("value_tier"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent value program. */
    valueProgramId: idRef("value_program_id")
      .references(() => valuePrograms.id)
      .notNull(),

    /** Stable tier key (bronze/silver/gold/platinum). */
    tierKey: varchar("tier_key", { length: 120 }).notNull(),

    /** Human-readable tier label. */
    name: varchar("name", { length: 180 }).notNull(),

    /** Lifecycle state for activation/retirement. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Rank order (1 = lowest tier). */
    rank: integer("rank").default(1).notNull(),

    /** Minimum lifetime earned units required for this tier. */
    minLifetimeEarnedUnits: integer("min_lifetime_earned_units")
      .default(0)
      .notNull(),

    /** Minimum current balance units required for this tier. */
    minCurrentBalanceUnits: integer("min_current_balance_units")
      .default(0)
      .notNull(),

    /** Benefits and perks payload. */
    benefits: jsonb("benefits").default({}).notNull(),

    /** Optional retention/downgrade policy. */
    retentionPolicy: jsonb("retention_policy").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    valueProgramTiersBizIdIdUnique: uniqueIndex("value_program_tiers_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    valueProgramTiersTierKeyUnique: uniqueIndex("value_program_tiers_tier_key_unique").on(
      table.bizId,
      table.valueProgramId,
      table.tierKey,
    ),

    valueProgramTiersRankUnique: uniqueIndex("value_program_tiers_rank_unique").on(
      table.bizId,
      table.valueProgramId,
      table.rank,
    ),

    valueProgramTiersProgramStatusRankIdx: index(
      "value_program_tiers_program_status_rank_idx",
    ).on(table.bizId, table.valueProgramId, table.status, table.rank),

    valueProgramTiersBizProgramFk: foreignKey({
      columns: [table.bizId, table.valueProgramId],
      foreignColumns: [valuePrograms.bizId, valuePrograms.id],
      name: "value_program_tiers_biz_program_fk",
    }),

    valueProgramTiersBoundsCheck: check(
      "value_program_tiers_bounds_check",
      sql`
      "rank" >= 1
      AND "min_lifetime_earned_units" >= 0
      AND "min_current_balance_units" >= 0
      `,
    ),
  }),
);

/**
 * value_program_accounts
 *
 * ELI5:
 * Account holder row for one value program.
 * Think "wallet profile" before looking at immutable ledger transactions.
 */
export const valueProgramAccounts = pgTable(
  "value_program_accounts",
  {
    /** Stable primary key. */
    id: idWithTag("value_account"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent value program. */
    valueProgramId: idRef("value_program_id")
      .references(() => valuePrograms.id)
      .notNull(),

    /** Human-safe account identifier. */
    accountNumber: varchar("account_number", { length: 180 }).notNull(),

    /** Lifecycle status for this account shell. */
    status: valueAccountStatusEnum("status").default("active").notNull(),

    /** Owner identity model for this account. */
    ownerModel: valueProgramAccountModelEnum("owner_model").notNull(),

    /** Owner user id when model=user. */
    ownerUserId: idRef("owner_user_id").references(() => users.id),

    /** Owner group account id when model=group_account. */
    ownerGroupAccountId: idRef("owner_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Owner subject type when model=subject. */
    ownerSubjectType: varchar("owner_subject_type", { length: 80 }),

    /** Owner subject id when model=subject. */
    ownerSubjectId: varchar("owner_subject_id", { length: 140 }),

    /** Cached current balance for low-latency reads. */
    currentBalanceUnits: integer("current_balance_units").default(0).notNull(),

    /** Cumulative earned units. */
    lifetimeEarnedUnits: integer("lifetime_earned_units").default(0).notNull(),

    /** Cumulative redeemed units. */
    lifetimeRedeemedUnits: integer("lifetime_redeemed_units").default(0).notNull(),

    /** Cumulative expired units. */
    lifetimeExpiredUnits: integer("lifetime_expired_units").default(0).notNull(),

    /** Optional current tier snapshot for UX shortcuts. */
    currentTierId: idRef("current_tier_id").references(() => valueProgramTiers.id),

    /** Account opened timestamp. */
    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),

    /** Account closed timestamp when status=closed. */
    closedAt: timestamp("closed_at", { withTimezone: true }),

    /** Last activity timestamp for stale account detection. */
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),

    /** Canonical action associated with account transition. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),

    /** Latest business event associated with this account. */
    latestDomainEventId: idRef("latest_domain_event_id").references(
      () => domainEvents.id,
    ),

    /** Optional account projection for operator surfaces. */
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),

    /** Optional debug payload for account anomalies. */
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    valueProgramAccountsBizIdIdUnique: uniqueIndex(
      "value_program_accounts_biz_id_id_unique",
    ).on(table.bizId, table.id),

    valueProgramAccountsNumberUnique: uniqueIndex(
      "value_program_accounts_number_unique",
    ).on(table.bizId, table.valueProgramId, table.accountNumber),

    valueProgramAccountsOwnerUserUnique: uniqueIndex(
      "value_program_accounts_owner_user_unique",
    )
      .on(table.bizId, table.valueProgramId, table.ownerUserId)
      .where(
        sql`"owner_model" = 'user' AND "owner_user_id" IS NOT NULL AND "deleted_at" IS NULL`,
      ),

    valueProgramAccountsOwnerGroupUnique: uniqueIndex(
      "value_program_accounts_owner_group_unique",
    )
      .on(table.bizId, table.valueProgramId, table.ownerGroupAccountId)
      .where(
        sql`"owner_model" = 'group_account' AND "owner_group_account_id" IS NOT NULL AND "deleted_at" IS NULL`,
      ),

    valueProgramAccountsOwnerSubjectUnique: uniqueIndex(
      "value_program_accounts_owner_subject_unique",
    )
      .on(table.bizId, table.valueProgramId, table.ownerSubjectType, table.ownerSubjectId)
      .where(
        sql`"owner_model" = 'subject' AND "owner_subject_type" IS NOT NULL AND "owner_subject_id" IS NOT NULL AND "deleted_at" IS NULL`,
      ),

    valueProgramAccountsProgramStatusIdx: index(
      "value_program_accounts_program_status_idx",
    ).on(table.bizId, table.valueProgramId, table.status),

    valueProgramAccountsOwnerStatusIdx: index(
      "value_program_accounts_owner_status_idx",
    ).on(table.bizId, table.ownerModel, table.status),

    valueProgramAccountsActionRequestIdx: index(
      "value_program_accounts_action_request_idx",
    ).on(table.actionRequestId),

    valueProgramAccountsBizActionRequestFk: foreignKey({
      columns: [table.bizId, table.actionRequestId],
      foreignColumns: [actionRequests.bizId, actionRequests.id],
      name: "value_program_accounts_biz_action_request_fk",
    }),

    valueProgramAccountsBizProgramFk: foreignKey({
      columns: [table.bizId, table.valueProgramId],
      foreignColumns: [valuePrograms.bizId, valuePrograms.id],
      name: "value_program_accounts_biz_program_fk",
    }),

    valueProgramAccountsBizTierFk: foreignKey({
      columns: [table.bizId, table.currentTierId],
      foreignColumns: [valueProgramTiers.bizId, valueProgramTiers.id],
      name: "value_program_accounts_biz_tier_fk",
    }),

    valueProgramAccountsBizGroupAccountFk: foreignKey({
      columns: [table.bizId, table.ownerGroupAccountId],
      foreignColumns: [groupAccounts.bizId, groupAccounts.id],
      name: "value_program_accounts_biz_group_account_fk",
    }),

    valueProgramAccountsBizOwnerSubjectFk: foreignKey({
      columns: [table.bizId, table.ownerSubjectType, table.ownerSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "value_program_accounts_biz_owner_subject_fk",
    }),

    valueProgramAccountsBoundsCheck: check(
      "value_program_accounts_bounds_check",
      sql`
      "lifetime_earned_units" >= 0
      AND "lifetime_redeemed_units" >= 0
      AND "lifetime_expired_units" >= 0
      `,
    ),

    valueProgramAccountsOwnerShapeCheck: check(
      "value_program_accounts_owner_shape_check",
      sql`
      (
        "owner_model" = 'user'
        AND "owner_user_id" IS NOT NULL
        AND "owner_group_account_id" IS NULL
        AND "owner_subject_type" IS NULL
        AND "owner_subject_id" IS NULL
      ) OR (
        "owner_model" = 'group_account'
        AND "owner_user_id" IS NULL
        AND "owner_group_account_id" IS NOT NULL
        AND "owner_subject_type" IS NULL
        AND "owner_subject_id" IS NULL
      ) OR (
        "owner_model" = 'subject'
        AND "owner_user_id" IS NULL
        AND "owner_group_account_id" IS NULL
        AND "owner_subject_type" IS NOT NULL
        AND "owner_subject_id" IS NOT NULL
      )
      `,
    ),

    valueProgramAccountsTimelineCheck: check(
      "value_program_accounts_timeline_check",
      sql`("closed_at" IS NULL OR "closed_at" >= "opened_at")`,
    ),
  }),
);

/**
 * value_transfers
 *
 * ELI5:
 * Transfer request/approval shell between two value accounts.
 * Ledger rows carry immutable movement details; this table carries workflow state.
 */
export const valueTransfers = pgTable(
  "value_transfers",
  {
    /** Stable primary key. */
    id: idWithTag("value_transfer"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent value program. */
    valueProgramId: idRef("value_program_id")
      .references(() => valuePrograms.id)
      .notNull(),

    /** Source account for debits. */
    sourceValueAccountId: idRef("source_value_account_id")
      .references(() => valueProgramAccounts.id)
      .notNull(),

    /** Target account for credits. */
    targetValueAccountId: idRef("target_value_account_id")
      .references(() => valueProgramAccounts.id)
      .notNull(),

    /** Transfer lifecycle status. */
    status: valueTransferStatusEnum("status").default("requested").notNull(),

    /** Positive units requested for transfer. */
    units: integer("units").notNull(),

    /** Transfer requester (optional for system-initiated flows). */
    requestedByUserId: idRef("requested_by_user_id").references(() => users.id),

    /** Transfer approver/decider. */
    decidedByUserId: idRef("decided_by_user_id").references(() => users.id),

    /** Request timestamp. */
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),

    /** Decision timestamp when approved/rejected. */
    decidedAt: timestamp("decided_at", { withTimezone: true }),

    /** Completion timestamp when ledger entries are posted. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Optional transfer-expiry timestamp. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Request reason shown to operators and end users. */
    reason: text("reason"),

    /** Internal operator notes. */
    notes: text("notes"),

    /** Canonical action associated with this transfer shell. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),

    /** Latest business event associated with this transfer. */
    latestDomainEventId: idRef("latest_domain_event_id").references(
      () => domainEvents.id,
    ),

    /** Optional transfer projection for dashboards. */
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),

    /** Optional debug payload for transfer failures. */
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    valueTransfersBizIdIdUnique: uniqueIndex("value_transfers_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    valueTransfersBizProgramStatusRequestedIdx: index(
      "value_transfers_biz_program_status_requested_idx",
    ).on(table.bizId, table.valueProgramId, table.status, table.requestedAt),

    valueTransfersBizSourceStatusIdx: index("value_transfers_biz_source_status_idx").on(
      table.bizId,
      table.sourceValueAccountId,
      table.status,
    ),

    valueTransfersBizTargetStatusIdx: index("value_transfers_biz_target_status_idx").on(
      table.bizId,
      table.targetValueAccountId,
      table.status,
    ),

    valueTransfersActionRequestIdx: index("value_transfers_action_request_idx").on(
      table.actionRequestId,
    ),

    valueTransfersBizActionRequestFk: foreignKey({
      columns: [table.bizId, table.actionRequestId],
      foreignColumns: [actionRequests.bizId, actionRequests.id],
      name: "value_transfers_biz_action_request_fk",
    }),

    valueTransfersBizProgramFk: foreignKey({
      columns: [table.bizId, table.valueProgramId],
      foreignColumns: [valuePrograms.bizId, valuePrograms.id],
      name: "value_transfers_biz_program_fk",
    }),

    valueTransfersBizSourceAccountFk: foreignKey({
      columns: [table.bizId, table.sourceValueAccountId],
      foreignColumns: [valueProgramAccounts.bizId, valueProgramAccounts.id],
      name: "value_transfers_biz_source_account_fk",
    }),

    valueTransfersBizTargetAccountFk: foreignKey({
      columns: [table.bizId, table.targetValueAccountId],
      foreignColumns: [valueProgramAccounts.bizId, valueProgramAccounts.id],
      name: "value_transfers_biz_target_account_fk",
    }),

    valueTransfersUnitsCheck: check(
      "value_transfers_units_check",
      sql`"units" > 0`,
    ),

    valueTransfersAccountPairCheck: check(
      "value_transfers_account_pair_check",
      sql`"source_value_account_id" <> "target_value_account_id"`,
    ),

    valueTransfersTimelineCheck: check(
      "value_transfers_timeline_check",
      sql`
      ("decided_at" IS NULL OR "decided_at" >= "requested_at")
      AND ("completed_at" IS NULL OR "completed_at" >= "requested_at")
      AND ("expires_at" IS NULL OR "expires_at" >= "requested_at")
      AND ("completed_at" IS NULL OR "decided_at" IS NULL OR "completed_at" >= "decided_at")
      `,
    ),

    valueTransfersStatusShapeCheck: check(
      "value_transfers_status_shape_check",
      sql`
      ("status" <> 'approved' OR "decided_at" IS NOT NULL)
      AND ("status" <> 'rejected' OR "decided_at" IS NOT NULL)
      AND ("status" <> 'completed' OR "completed_at" IS NOT NULL)
      `,
    ),
  }),
);

/**
 * value_ledger_entries
 *
 * ELI5:
 * Immutable movement log. This is the accounting source of truth for balances.
 */
export const valueLedgerEntries = pgTable(
  "value_ledger_entries",
  {
    /** Stable primary key. */
    id: idWithTag("value_ledger"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent value program. */
    valueProgramId: idRef("value_program_id")
      .references(() => valuePrograms.id)
      .notNull(),

    /** Target account whose balance changed. */
    valueAccountId: idRef("value_account_id")
      .references(() => valueProgramAccounts.id)
      .notNull(),

    /** Optional transfer shell that this entry belongs to. */
    valueTransferId: idRef("value_transfer_id").references(() => valueTransfers.id),

    /** Immutable movement taxonomy. */
    entryType: valueLedgerEntryTypeEnum("entry_type").notNull(),

    /** Signed unit delta (+/-). */
    unitsDelta: integer("units_delta").notNull(),

    /** Cached post-write balance snapshot for this account. */
    balanceAfterUnits: integer("balance_after_units").notNull(),

    /** Optional idempotency key for deterministic write dedupe. */
    idempotencyKey: varchar("idempotency_key", { length: 180 }),

    /** Domain timestamp for when this movement happened. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** When this movement becomes effective for balance semantics. */
    effectiveAt: timestamp("effective_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional expiration timestamp for this earned movement. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Optional source subject type for explainability. */
    sourceSubjectType: varchar("source_subject_type", { length: 80 }),

    /** Optional source subject id for explainability. */
    sourceSubjectId: varchar("source_subject_id", { length: 140 }),

    /** Optional generic source ref type (booking_order/payment/etc). */
    sourceRefType: varchar("source_ref_type", { length: 80 }),

    /** Optional generic source ref id. */
    sourceRefId: varchar("source_ref_id", { length: 140 }),

    /** Reversal pointer when entry_type=reversal. */
    reversesLedgerEntryId: idRef("reverses_ledger_entry_id"),

    /** Optional movement explanation text. */
    description: text("description"),

    /** Canonical action associated with this ledger append. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),

    /** Domain event associated with this ledger append. */
    latestDomainEventId: idRef("latest_domain_event_id").references(
      () => domainEvents.id,
    ),

    /** Optional read-model row for statement surfaces. */
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),

    /** Optional debug payload for ledger write anomalies. */
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    valueLedgerEntriesBizIdIdUnique: uniqueIndex("value_ledger_entries_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    valueLedgerEntriesAccountIdempotencyUnique: uniqueIndex(
      "value_ledger_entries_account_idempotency_unique",
    )
      .on(table.bizId, table.valueAccountId, table.idempotencyKey)
      .where(sql`"idempotency_key" IS NOT NULL`),

    valueLedgerEntriesAccountOccurredIdx: index(
      "value_ledger_entries_account_occurred_idx",
    ).on(table.bizId, table.valueAccountId, table.occurredAt),

    valueLedgerEntriesProgramEntryTypeIdx: index(
      "value_ledger_entries_program_entry_type_idx",
    ).on(table.bizId, table.valueProgramId, table.entryType, table.occurredAt),

    valueLedgerEntriesSourceSubjectIdx: index(
      "value_ledger_entries_source_subject_idx",
    ).on(table.bizId, table.sourceSubjectType, table.sourceSubjectId),

    valueLedgerEntriesActionRequestIdx: index(
      "value_ledger_entries_action_request_idx",
    ).on(table.actionRequestId),

    valueLedgerEntriesBizProgramFk: foreignKey({
      columns: [table.bizId, table.valueProgramId],
      foreignColumns: [valuePrograms.bizId, valuePrograms.id],
      name: "value_ledger_entries_biz_program_fk",
    }),

    valueLedgerEntriesBizAccountFk: foreignKey({
      columns: [table.bizId, table.valueAccountId],
      foreignColumns: [valueProgramAccounts.bizId, valueProgramAccounts.id],
      name: "value_ledger_entries_biz_account_fk",
    }),

    valueLedgerEntriesBizTransferFk: foreignKey({
      columns: [table.bizId, table.valueTransferId],
      foreignColumns: [valueTransfers.bizId, valueTransfers.id],
      name: "value_ledger_entries_biz_transfer_fk",
    }),

    valueLedgerEntriesBizSourceSubjectFk: foreignKey({
      columns: [table.bizId, table.sourceSubjectType, table.sourceSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "value_ledger_entries_biz_source_subject_fk",
    }),

    valueLedgerEntriesBizReversalFk: foreignKey({
      columns: [table.bizId, table.reversesLedgerEntryId],
      foreignColumns: [table.bizId, table.id],
      name: "value_ledger_entries_biz_reversal_fk",
    }),

    valueLedgerEntriesDeltaCheck: check(
      "value_ledger_entries_delta_check",
      sql`"units_delta" <> 0`,
    ),

    valueLedgerEntriesEntryDirectionCheck: check(
      "value_ledger_entries_entry_direction_check",
      sql`
      (
        "entry_type" IN ('earn', 'transfer_in', 'tier_upgrade')
        AND "units_delta" > 0
      ) OR (
        "entry_type" IN ('redeem', 'expire', 'transfer_out', 'tier_downgrade')
        AND "units_delta" < 0
      ) OR (
        "entry_type" IN ('adjustment', 'reversal')
      )
      `,
    ),

    valueLedgerEntriesReversalShapeCheck: check(
      "value_ledger_entries_reversal_shape_check",
      sql`("entry_type" <> 'reversal' OR "reverses_ledger_entry_id" IS NOT NULL)`,
    ),

    valueLedgerEntriesTimelineCheck: check(
      "value_ledger_entries_timeline_check",
      sql`("expires_at" IS NULL OR "expires_at" >= "effective_at")`,
    ),

    valueLedgerEntriesSourceSubjectPairCheck: check(
      "value_ledger_entries_source_subject_pair_check",
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
  }),
);

/**
 * value_rules
 *
 * ELI5:
 * Programmable earn/redeem rule definitions.
 * Workers evaluate these rules and append immutable ledger entries.
 */
export const valueRules = pgTable(
  "value_rules",
  {
    /** Stable primary key. */
    id: idWithTag("value_rule"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent value program. */
    valueProgramId: idRef("value_program_id")
      .references(() => valuePrograms.id)
      .notNull(),

    /** Human-readable rule name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable slug for APIs/imports. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Rule lifecycle state. */
    status: valueRuleStatusEnum("status").default("draft").notNull(),

    /** Resolver precedence (lower runs first). */
    priority: integer("priority").default(100).notNull(),

    /** Rule category (earn/redeem/expiry/etc). */
    ruleType: varchar("rule_type", { length: 80 }).default("earn").notNull(),

    /** Trigger class (event/schedule/manual/api/custom). */
    triggerType: varchar("trigger_type", { length: 80 }).default("event").notNull(),

    /** Optional active window start. */
    startsAt: timestamp("starts_at", { withTimezone: true }),

    /** Optional active window end. */
    endsAt: timestamp("ends_at", { withTimezone: true }),

    /** Optional cap on applications per account in the active window. */
    maxApplicationsPerAccount: integer("max_applications_per_account"),

    /** Structured condition/effect payload. */
    rule: jsonb("rule").default({}).notNull(),

    /** Canonical action linked to rule writes. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),

    /** Latest business event associated with rule updates. */
    latestDomainEventId: idRef("latest_domain_event_id").references(
      () => domainEvents.id,
    ),

    /** Optional projection document for rule explainability. */
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),

    /** Optional debug payload for rule-evaluation drift. */
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    valueRulesBizIdIdUnique: uniqueIndex("value_rules_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    valueRulesProgramSlugUnique: uniqueIndex("value_rules_program_slug_unique").on(
      table.bizId,
      table.valueProgramId,
      table.slug,
    ),

    valueRulesProgramStatusPriorityIdx: index("value_rules_program_status_priority_idx").on(
      table.bizId,
      table.valueProgramId,
      table.status,
      table.priority,
    ),

    valueRulesActionRequestIdx: index("value_rules_action_request_idx").on(
      table.actionRequestId,
    ),

    valueRulesBizActionRequestFk: foreignKey({
      columns: [table.bizId, table.actionRequestId],
      foreignColumns: [actionRequests.bizId, actionRequests.id],
      name: "value_rules_biz_action_request_fk",
    }),

    valueRulesBizProgramFk: foreignKey({
      columns: [table.bizId, table.valueProgramId],
      foreignColumns: [valuePrograms.bizId, valuePrograms.id],
      name: "value_rules_biz_program_fk",
    }),

    valueRulesBoundsCheck: check(
      "value_rules_bounds_check",
      sql`
      "priority" >= 0
      AND ("max_applications_per_account" IS NULL OR "max_applications_per_account" > 0)
      `,
    ),

    valueRulesTimelineCheck: check(
      "value_rules_timeline_check",
      sql`("ends_at" IS NULL OR "starts_at" IS NULL OR "ends_at" >= "starts_at")`,
    ),

    valueRulesTriggerTypeCheck: check(
      "value_rules_trigger_type_check",
      sql`
      "trigger_type" IN ('event', 'schedule', 'manual', 'api')
      OR "trigger_type" LIKE 'custom_%'
      `,
    ),
  }),
);

/**
 * value_rule_evaluations
 *
 * ELI5:
 * Runtime evidence rows for deterministic rule evaluation outcomes.
 */
export const valueRuleEvaluations = pgTable(
  "value_rule_evaluations",
  {
    /** Stable primary key. */
    id: idWithTag("value_eval"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent program. */
    valueProgramId: idRef("value_program_id")
      .references(() => valuePrograms.id)
      .notNull(),

    /** Rule that was evaluated. */
    valueRuleId: idRef("value_rule_id")
      .references(() => valueRules.id)
      .notNull(),

    /** Target account that was evaluated. */
    valueAccountId: idRef("value_account_id").references(() => valueProgramAccounts.id),

    /** Evaluation lifecycle state. */
    status: valueEvaluationStatusEnum("status").default("pending").notNull(),

    /** Deterministic dedupe key for one logical evaluation input. */
    evaluationKey: varchar("evaluation_key", { length: 180 }).notNull(),

    /** Evaluation timestamp. */
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).defaultNow().notNull(),

    /** Apply timestamp for successful ledger writes. */
    appliedAt: timestamp("applied_at", { withTimezone: true }),

    /** Proposed/applied unit delta. */
    unitsDelta: integer("units_delta"),

    /** Resulting ledger row when status=applied. */
    valueLedgerEntryId: idRef("value_ledger_entry_id").references(
      () => valueLedgerEntries.id,
    ),

    /** Optional contextual source subject type. */
    sourceSubjectType: varchar("source_subject_type", { length: 80 }),

    /** Optional contextual source subject id. */
    sourceSubjectId: varchar("source_subject_id", { length: 140 }),

    /** Structured explanation/payload from rule engine. */
    details: jsonb("details").default({}).notNull(),

    /** Canonical action linked to evaluation runtime. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),

    /** Latest business event associated with this evaluation. */
    latestDomainEventId: idRef("latest_domain_event_id").references(
      () => domainEvents.id,
    ),

    /** Optional projection document for audit surfaces. */
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),

    /** Optional debug payload for evaluator failures. */
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    valueRuleEvaluationsBizIdIdUnique: uniqueIndex(
      "value_rule_evaluations_biz_id_id_unique",
    ).on(table.bizId, table.id),

    valueRuleEvaluationsRuleEvalKeyUnique: uniqueIndex(
      "value_rule_evaluations_rule_eval_key_unique",
    ).on(table.bizId, table.valueRuleId, table.evaluationKey),

    valueRuleEvaluationsAccountStatusEvaluatedIdx: index(
      "value_rule_evaluations_account_status_evaluated_idx",
    ).on(table.bizId, table.valueAccountId, table.status, table.evaluatedAt),

    valueRuleEvaluationsRuleStatusEvaluatedIdx: index(
      "value_rule_evaluations_rule_status_evaluated_idx",
    ).on(table.bizId, table.valueRuleId, table.status, table.evaluatedAt),

    valueRuleEvaluationsActionRequestIdx: index(
      "value_rule_evaluations_action_request_idx",
    ).on(table.actionRequestId),

    valueRuleEvaluationsBizProgramFk: foreignKey({
      columns: [table.bizId, table.valueProgramId],
      foreignColumns: [valuePrograms.bizId, valuePrograms.id],
      name: "value_rule_evaluations_biz_program_fk",
    }),

    valueRuleEvaluationsBizRuleFk: foreignKey({
      columns: [table.bizId, table.valueRuleId],
      foreignColumns: [valueRules.bizId, valueRules.id],
      name: "value_rule_evaluations_biz_rule_fk",
    }),

    valueRuleEvaluationsBizAccountFk: foreignKey({
      columns: [table.bizId, table.valueAccountId],
      foreignColumns: [valueProgramAccounts.bizId, valueProgramAccounts.id],
      name: "value_rule_evaluations_biz_account_fk",
    }),

    valueRuleEvaluationsBizLedgerEntryFk: foreignKey({
      columns: [table.bizId, table.valueLedgerEntryId],
      foreignColumns: [valueLedgerEntries.bizId, valueLedgerEntries.id],
      name: "value_rule_evaluations_biz_ledger_entry_fk",
    }),

    valueRuleEvaluationsBizSourceSubjectFk: foreignKey({
      columns: [table.bizId, table.sourceSubjectType, table.sourceSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "value_rule_evaluations_biz_source_subject_fk",
    }),

    valueRuleEvaluationsApplyShapeCheck: check(
      "value_rule_evaluations_apply_shape_check",
      sql`
      (
        "status" <> 'applied'
      ) OR (
        "status" = 'applied'
        AND "value_account_id" IS NOT NULL
        AND "value_ledger_entry_id" IS NOT NULL
        AND "units_delta" IS NOT NULL
        AND "units_delta" <> 0
        AND "applied_at" IS NOT NULL
      )
      `,
    ),

    valueRuleEvaluationsTimelineCheck: check(
      "value_rule_evaluations_timeline_check",
      sql`("applied_at" IS NULL OR "applied_at" >= "evaluated_at")`,
    ),

    valueRuleEvaluationsSourceSubjectPairCheck: check(
      "value_rule_evaluations_source_subject_pair_check",
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
  }),
);

export type ValueProgram = typeof valuePrograms.$inferSelect;
export type NewValueProgram = typeof valuePrograms.$inferInsert;

export type ValueProgramTier = typeof valueProgramTiers.$inferSelect;
export type NewValueProgramTier = typeof valueProgramTiers.$inferInsert;

export type ValueProgramAccount = typeof valueProgramAccounts.$inferSelect;
export type NewValueProgramAccount = typeof valueProgramAccounts.$inferInsert;

export type ValueTransfer = typeof valueTransfers.$inferSelect;
export type NewValueTransfer = typeof valueTransfers.$inferInsert;

export type ValueLedgerEntry = typeof valueLedgerEntries.$inferSelect;
export type NewValueLedgerEntry = typeof valueLedgerEntries.$inferInsert;

export type ValueRule = typeof valueRules.$inferSelect;
export type NewValueRule = typeof valueRules.$inferInsert;

export type ValueRuleEvaluation = typeof valueRuleEvaluations.$inferSelect;
export type NewValueRuleEvaluation = typeof valueRuleEvaluations.$inferInsert;
