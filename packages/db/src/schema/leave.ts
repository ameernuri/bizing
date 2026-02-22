import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import {
  leaveAccrualPeriodEnum,
  leaveEventTypeEnum,
  leaveRequestStatusEnum,
  leaveUnitEnum,
  lifecycleStatusEnum,
  resourceTypeEnum,
} from "./enums";
import { locations } from "./locations";
import { resources } from "./resources";
import { users } from "./users";

/**
 * leave_policies
 *
 * ELI5:
 * This is the rulebook for time-off accrual and request behavior.
 */
export const leavePolicies = pgTable(
  "leave_policies",
  {
    id: idWithTag("leave_policy"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    name: varchar("name", { length: 220 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    status: lifecycleStatusEnum("status").default("draft").notNull(),

    /** Optional location scope; null means biz-wide. */
    locationId: idRef("location_id").references(() => locations.id),

    /**
     * Optional resource-type scope.
     * Leave is workforce-centric, so this should typically be host/company_host.
     */
    resourceType: resourceTypeEnum("resource_type"),

    /** Unit used in balances and requests under this policy. */
    unit: leaveUnitEnum("unit").default("hours").notNull(),

    /** How accrual is computed. */
    accrualPeriod: leaveAccrualPeriodEnum("accrual_period")
      .default("monthly")
      .notNull(),

    /** Quantity accrued per period/cycle (or per-hour-worked multiplier). */
    accrualRate: numeric("accrual_rate", { precision: 18, scale: 6 })
      .default("0")
      .notNull(),

    /** Default annual grant/allowance for this policy. */
    annualAllowance: numeric("annual_allowance", { precision: 18, scale: 6 })
      .default("0")
      .notNull(),

    /** Optional cap for carryover into next cycle/year. */
    carryoverMax: numeric("carryover_max", { precision: 18, scale: 6 }),

    /** Whether balance may go below zero. */
    allowNegativeBalance: boolean("allow_negative_balance")
      .default(false)
      .notNull(),

    /** Minimum notice requirement before leave start. */
    minNoticeMinutes: integer("min_notice_minutes").default(0).notNull(),

    /** Optional blackout windows and approval rules. */
    policy: jsonb("policy").default({}).notNull(),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    leavePoliciesBizIdIdUnique: uniqueIndex("leave_policies_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    leavePoliciesBizSlugUnique: uniqueIndex("leave_policies_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),
    leavePoliciesBizStatusIdx: index("leave_policies_biz_status_idx").on(
      table.bizId,
      table.status,
    ),

    leavePoliciesBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "leave_policies_biz_location_fk",
    }),

    leavePoliciesNumericBoundsCheck: check(
      "leave_policies_numeric_bounds_check",
      sql`
      "accrual_rate" >= 0
      AND "annual_allowance" >= 0
      AND ("carryover_max" IS NULL OR "carryover_max" >= 0)
      AND "min_notice_minutes" >= 0
      `,
    ),

    /**
     * Workforce-only resource type check.
     * If scope is set, it should target host/company_host.
     */
    leavePoliciesResourceTypeCheck: check(
      "leave_policies_resource_type_check",
      sql`
      "resource_type" IS NULL
      OR "resource_type" IN ('host', 'company_host')
      `,
    ),
  }),
);

/**
 * leave_balances
 *
 * ELI5:
 * Current balance ledger state for one resource under one policy.
 */
export const leaveBalances = pgTable(
  "leave_balances",
  {
    id: idWithTag("leave_balance"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    leavePolicyId: idRef("leave_policy_id")
      .references(() => leavePolicies.id)
      .notNull(),
    resourceId: idRef("resource_id")
      .references(() => resources.id)
      .notNull(),

    /** Current total balance in policy unit. */
    balanceAmount: numeric("balance_amount", { precision: 18, scale: 6 })
      .default("0")
      .notNull(),

    /** Portion of balance reserved by pending approved requests. */
    reservedAmount: numeric("reserved_amount", { precision: 18, scale: 6 })
      .default("0")
      .notNull(),

    /** Cumulative consumed amount for reporting. */
    usedAmount: numeric("used_amount", { precision: 18, scale: 6 })
      .default("0")
      .notNull(),

    asOfAt: timestamp("as_of_at", { withTimezone: true }).defaultNow().notNull(),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    leaveBalancesBizIdIdUnique: uniqueIndex("leave_balances_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    leaveBalancesPolicyResourceUnique: uniqueIndex(
      "leave_balances_policy_resource_unique",
    ).on(table.leavePolicyId, table.resourceId),
    leaveBalancesBizResourceIdx: index("leave_balances_biz_resource_idx").on(
      table.bizId,
      table.resourceId,
    ),

    leaveBalancesBizPolicyFk: foreignKey({
      columns: [table.bizId, table.leavePolicyId],
      foreignColumns: [leavePolicies.bizId, leavePolicies.id],
      name: "leave_balances_biz_policy_fk",
    }),
    leaveBalancesBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "leave_balances_biz_resource_fk",
    }),

    leaveBalancesBoundsCheck: check(
      "leave_balances_bounds_check",
      sql`
      "reserved_amount" >= 0
      AND "used_amount" >= 0
      `,
    ),
  }),
);

/**
 * leave_requests
 *
 * ELI5:
 * One request is one ask for time off in a time window.
 */
export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: idWithTag("leave_request"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    leavePolicyId: idRef("leave_policy_id")
      .references(() => leavePolicies.id)
      .notNull(),
    resourceId: idRef("resource_id")
      .references(() => resources.id)
      .notNull(),

    requesterUserId: idRef("requester_user_id").references(() => users.id),
    approverUserId: idRef("approver_user_id").references(() => users.id),

    status: leaveRequestStatusEnum("status").default("pending").notNull(),
    unit: leaveUnitEnum("unit").notNull(),

    quantityRequested: numeric("quantity_requested", { precision: 18, scale: 6 })
      .notNull(),
    quantityApproved: numeric("quantity_approved", { precision: 18, scale: 6 }),

    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),

    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),

    reason: text("reason"),
    decisionReason: text("decision_reason"),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    leaveRequestsBizIdIdUnique: uniqueIndex("leave_requests_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    leaveRequestsBizStatusStartIdx: index("leave_requests_biz_status_start_idx").on(
      table.bizId,
      table.status,
      table.startAt,
    ),
    leaveRequestsBizResourceStartIdx: index("leave_requests_biz_resource_start_idx").on(
      table.bizId,
      table.resourceId,
      table.startAt,
    ),

    leaveRequestsBizPolicyFk: foreignKey({
      columns: [table.bizId, table.leavePolicyId],
      foreignColumns: [leavePolicies.bizId, leavePolicies.id],
      name: "leave_requests_biz_policy_fk",
    }),
    leaveRequestsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "leave_requests_biz_resource_fk",
    }),

    leaveRequestsQuantityCheck: check(
      "leave_requests_quantity_check",
      sql`
      "quantity_requested" > 0
      AND ("quantity_approved" IS NULL OR "quantity_approved" >= 0)
      AND ("quantity_approved" IS NULL OR "quantity_approved" <= "quantity_requested")
      `,
    ),

    leaveRequestsTimelineCheck: check(
      "leave_requests_timeline_check",
      sql`
      "end_at" > "start_at"
      AND ("decided_at" IS NULL OR "decided_at" >= "submitted_at")
      `,
    ),
  }),
);

/**
 * leave_events
 *
 * ELI5:
 * Append-style ledger of leave balance changes.
 */
export const leaveEvents = pgTable(
  "leave_events",
  {
    id: idWithTag("leave_event"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    leavePolicyId: idRef("leave_policy_id")
      .references(() => leavePolicies.id)
      .notNull(),
    resourceId: idRef("resource_id")
      .references(() => resources.id)
      .notNull(),
    leaveRequestId: idRef("leave_request_id").references(() => leaveRequests.id),

    eventType: leaveEventTypeEnum("event_type").notNull(),

    /** Signed delta in policy unit (+accrual, -consumption). */
    amountDelta: numeric("amount_delta", { precision: 18, scale: 6 }).notNull(),

    /** Optional post-application running balance snapshot. */
    resultingBalance: numeric("resulting_balance", { precision: 18, scale: 6 }),

    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    actorUserId: idRef("actor_user_id").references(() => users.id),
    note: varchar("note", { length: 1000 }),
    metadata: jsonb("metadata").default({}),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    leaveEventsBizIdIdUnique: uniqueIndex("leave_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    leaveEventsBizResourceOccurredIdx: index("leave_events_biz_resource_occurred_idx").on(
      table.bizId,
      table.resourceId,
      table.occurredAt,
    ),

    leaveEventsBizPolicyFk: foreignKey({
      columns: [table.bizId, table.leavePolicyId],
      foreignColumns: [leavePolicies.bizId, leavePolicies.id],
      name: "leave_events_biz_policy_fk",
    }),
    leaveEventsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "leave_events_biz_resource_fk",
    }),
    leaveEventsBizRequestFk: foreignKey({
      columns: [table.bizId, table.leaveRequestId],
      foreignColumns: [leaveRequests.bizId, leaveRequests.id],
      name: "leave_events_biz_request_fk",
    }),

    leaveEventsAmountCheck: check(
      "leave_events_amount_check",
      sql`"amount_delta" <> 0`,
    ),

    /** Request-linked event types should always carry request linkage. */
    leaveEventsRequestShapeCheck: check(
      "leave_events_request_shape_check",
      sql`
      (
        "event_type" IN ('request_approved', 'request_reversed')
        AND "leave_request_id" IS NOT NULL
      ) OR (
        "event_type" NOT IN ('request_approved', 'request_reversed')
      )
      `,
    ),
  }),
);
