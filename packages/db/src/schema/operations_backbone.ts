import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { fulfillmentAssignments, fulfillmentUnits } from "./fulfillment";
import { staffingAssignments, staffingDemands } from "./intelligence";
import {
  lifecycleStatusEnum,
  operationalAssignmentSourceTypeEnum,
  operationalDemandSourceTypeEnum,
} from "./enums";
import { resources } from "./resources";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * operational_demands
 *
 * ELI5:
 * This is a universal "demand identity card".
 *
 * Why this exists:
 * - We have more than one way to create work demand:
 *   - customer-facing fulfillment (`fulfillment_units`)
 *   - internal staffing board (`staffing_demands`)
 *   - plugin/custom modules (`custom_subject`)
 * - analytics, dispatch tooling, and plugins often need one shared demand lens.
 * - this table gives one canonical id without forcing domain tables to merge.
 *
 * Practical effect:
 * - one row here points to exactly one source row,
 * - downstream systems can join this table first, then branch only when needed.
 */
export const operationalDemands = pgTable(
  "operational_demands",
  {
    /** Stable canonical demand id used across domains. */
    id: idWithTag("op_demand"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /**
     * Source family for this canonical demand.
     *
     * - `fulfillment_unit`: customer-facing execution demand.
     * - `staffing_demand`: internal workforce demand.
     * - `custom_subject`: plugin-defined demand source.
     */
    sourceType: operationalDemandSourceTypeEnum("source_type").notNull(),

    /** Source payload when `source_type=fulfillment_unit`. */
    fulfillmentUnitId: idRef("fulfillment_unit_id").references(
      () => fulfillmentUnits.id,
    ),

    /** Source payload when `source_type=staffing_demand`. */
    staffingDemandId: idRef("staffing_demand_id").references(
      () => staffingDemands.id,
    ),

    /** Source payload when `source_type=custom_subject`. */
    customSubjectType: varchar("custom_subject_type", { length: 80 }),
    customSubjectId: varchar("custom_subject_id", { length: 140 }),

    /**
     * Canonical lifecycle status used by unified boards and projections.
     * Source-native statuses remain in source tables.
     */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /**
     * Snapshot of source-native status string.
     *
     * Why this is string:
     * Different source domains have different enums. Keeping exact source
     * status text avoids lossy mappings and keeps audit/debug simple.
     */
    sourceStatus: varchar("source_status", { length: 80 }).notNull(),

    /** Optional normalized demand window start for cross-domain board sorting. */
    startsAt: timestamp("starts_at", { withTimezone: true }),

    /** Optional normalized demand window end for cross-domain board sorting. */
    endsAt: timestamp("ends_at", { withTimezone: true }),

    /** Generic priority used by dispatch/ranking systems. */
    priority: integer("priority").default(100).notNull(),

    /** Optional idempotency key for upsert workers. */
    requestKey: varchar("request_key", { length: 140 }),

    /** Extensible non-indexed payload for custom demand metadata. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe downstream references. */
    operationalDemandsBizIdIdUnique: uniqueIndex(
      "operational_demands_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Optional idempotency dedupe path. */
    operationalDemandsBizRequestKeyUnique: uniqueIndex(
      "operational_demands_biz_request_key_unique",
    )
      .on(table.bizId, table.requestKey)
      .where(sql`"request_key" IS NOT NULL`),

    /** Main cross-domain board path. */
    operationalDemandsBizStatusWindowIdx: index(
      "operational_demands_biz_status_window_idx",
    ).on(table.bizId, table.status, table.startsAt, table.priority),

    /** Source-oriented analytics/debug path. */
    operationalDemandsBizSourceTypeStatusIdx: index(
      "operational_demands_biz_source_type_status_idx",
    ).on(table.bizId, table.sourceType, table.sourceStatus),

    /** Reverse lookup path for custom source subjects. */
    operationalDemandsBizCustomSubjectIdx: index(
      "operational_demands_biz_custom_subject_idx",
    ).on(table.bizId, table.customSubjectType, table.customSubjectId),

    /** One canonical row per fulfillment unit source. */
    operationalDemandsUniqueFulfillmentUnit: uniqueIndex(
      "operational_demands_unique_fulfillment_unit",
    )
      .on(table.fulfillmentUnitId)
      .where(sql`"source_type" = 'fulfillment_unit' AND "deleted_at" IS NULL`),

    /** One canonical row per staffing demand source. */
    operationalDemandsUniqueStaffingDemand: uniqueIndex(
      "operational_demands_unique_staffing_demand",
    )
      .on(table.staffingDemandId)
      .where(sql`"source_type" = 'staffing_demand' AND "deleted_at" IS NULL`),

    /** One canonical row per custom subject source. */
    operationalDemandsUniqueCustomSubject: uniqueIndex(
      "operational_demands_unique_custom_subject",
    )
      .on(table.bizId, table.customSubjectType, table.customSubjectId)
      .where(sql`"source_type" = 'custom_subject' AND "deleted_at" IS NULL`),

    /** Tenant-safe FK to optional fulfillment-unit source. */
    operationalDemandsBizFulfillmentUnitFk: foreignKey({
      columns: [table.bizId, table.fulfillmentUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "operational_demands_biz_fulfillment_unit_fk",
    }),

    /** Tenant-safe FK to optional staffing-demand source. */
    operationalDemandsBizStaffingDemandFk: foreignKey({
      columns: [table.bizId, table.staffingDemandId],
      foreignColumns: [staffingDemands.bizId, staffingDemands.id],
      name: "operational_demands_biz_staffing_demand_fk",
    }),

    /** Tenant-safe FK to optional custom-subject source. */
    operationalDemandsBizCustomSubjectFk: foreignKey({
      columns: [table.bizId, table.customSubjectType, table.customSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "operational_demands_biz_custom_subject_fk",
    }),

    /** Window ordering and numeric bounds sanity checks. */
    operationalDemandsBoundsCheck: check(
      "operational_demands_bounds_check",
      sql`
      ("ends_at" IS NULL OR "starts_at" IS NULL OR "ends_at" > "starts_at")
      AND "priority" >= 0
      AND length("source_status") > 0
      `,
    ),

    /** Custom subject payload should be fully-null or fully-populated. */
    operationalDemandsCustomSubjectPairCheck: check(
      "operational_demands_custom_subject_pair_check",
      sql`
      (
        "custom_subject_type" IS NULL
        AND "custom_subject_id" IS NULL
      ) OR (
        "custom_subject_type" IS NOT NULL
        AND "custom_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Source payload must match `source_type` exactly. */
    operationalDemandsSourceShapeCheck: check(
      "operational_demands_source_shape_check",
      sql`
      (
        "source_type" = 'fulfillment_unit'
        AND "fulfillment_unit_id" IS NOT NULL
        AND "staffing_demand_id" IS NULL
        AND "custom_subject_type" IS NULL
        AND "custom_subject_id" IS NULL
      ) OR (
        "source_type" = 'staffing_demand'
        AND "fulfillment_unit_id" IS NULL
        AND "staffing_demand_id" IS NOT NULL
        AND "custom_subject_type" IS NULL
        AND "custom_subject_id" IS NULL
      ) OR (
        "source_type" = 'custom_subject'
        AND "fulfillment_unit_id" IS NULL
        AND "staffing_demand_id" IS NULL
        AND "custom_subject_type" IS NOT NULL
        AND "custom_subject_id" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * operational_assignments
 *
 * ELI5:
 * This is a universal "assignment identity card" linked to canonical demand.
 *
 * Why this exists:
 * - fulfillment and staffing both produce assignment rows,
 * - downstream systems (timesheets, payroll, fairness, BI) benefit from one
 *   assignment identity and one join path.
 *
 * Design:
 * - one row points to exactly one source assignment row,
 * - optional `operational_demand_id` links assignment to canonical demand graph,
 * - canonical status/source status are both stored for deterministic analysis.
 */
export const operationalAssignments = pgTable(
  "operational_assignments",
  {
    /** Stable canonical assignment id used across modules. */
    id: idWithTag("op_assignment"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional parent canonical demand. */
    operationalDemandId: idRef("operational_demand_id").references(
      () => operationalDemands.id,
    ),

    /**
     * Source family for this canonical assignment.
     *
     * - `fulfillment_assignment`: customer execution assignment source.
     * - `staffing_assignment`: internal staffing assignment source.
     * - `custom_subject`: plugin-defined assignment source.
     */
    sourceType: operationalAssignmentSourceTypeEnum("source_type").notNull(),

    /** Source payload when `source_type=fulfillment_assignment`. */
    fulfillmentAssignmentId: idRef("fulfillment_assignment_id").references(
      () => fulfillmentAssignments.id,
    ),

    /** Source payload when `source_type=staffing_assignment`. */
    staffingAssignmentId: idRef("staffing_assignment_id").references(
      () => staffingAssignments.id,
    ),

    /** Source payload when `source_type=custom_subject`. */
    customSubjectType: varchar("custom_subject_type", { length: 80 }),
    customSubjectId: varchar("custom_subject_id", { length: 140 }),

    /**
     * Canonical resource pointer for unified workload/utilization/timesheet use.
     * For fulfillment/staffing sources this should be populated.
     */
    resourceId: idRef("resource_id").references(() => resources.id),

    /** Canonical lifecycle status for unified assignment boards. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Source-native assignment status snapshot (kept as raw text). */
    sourceStatus: varchar("source_status", { length: 80 }).notNull(),

    /** Optional normalized assignment window start. */
    startsAt: timestamp("starts_at", { withTimezone: true }),

    /** Optional normalized assignment window end. */
    endsAt: timestamp("ends_at", { withTimezone: true }),

    /** Generic assignment priority for dispatch tooling. */
    priority: integer("priority").default(100).notNull(),

    /** Optional idempotency key for upsert workers. */
    requestKey: varchar("request_key", { length: 140 }),

    /** Extensible non-indexed payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe downstream references. */
    operationalAssignmentsBizIdIdUnique: uniqueIndex(
      "operational_assignments_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Optional idempotency dedupe path. */
    operationalAssignmentsBizRequestKeyUnique: uniqueIndex(
      "operational_assignments_biz_request_key_unique",
    )
      .on(table.bizId, table.requestKey)
      .where(sql`"request_key" IS NOT NULL`),

    /** Main assignment board query path. */
    operationalAssignmentsBizStatusWindowIdx: index(
      "operational_assignments_biz_status_window_idx",
    ).on(table.bizId, table.status, table.startsAt, table.priority),

    /** Resource workload and timeline lookup path. */
    operationalAssignmentsBizResourceStatusWindowIdx: index(
      "operational_assignments_biz_resource_status_window_idx",
    ).on(table.bizId, table.resourceId, table.status, table.startsAt),

    /** Canonical demand join path. */
    operationalAssignmentsBizDemandIdx: index(
      "operational_assignments_biz_demand_idx",
    ).on(table.bizId, table.operationalDemandId, table.status),

    /** Reverse lookup path for custom-source assignments. */
    operationalAssignmentsBizCustomSubjectIdx: index(
      "operational_assignments_biz_custom_subject_idx",
    ).on(table.bizId, table.customSubjectType, table.customSubjectId),

    /** One canonical row per fulfillment assignment source. */
    operationalAssignmentsUniqueFulfillmentAssignment: uniqueIndex(
      "operational_assignments_unique_fulfillment_assignment",
    )
      .on(table.fulfillmentAssignmentId)
      .where(
        sql`"source_type" = 'fulfillment_assignment' AND "deleted_at" IS NULL`,
      ),

    /** One canonical row per staffing assignment source. */
    operationalAssignmentsUniqueStaffingAssignment: uniqueIndex(
      "operational_assignments_unique_staffing_assignment",
    )
      .on(table.staffingAssignmentId)
      .where(
        sql`"source_type" = 'staffing_assignment' AND "deleted_at" IS NULL`,
      ),

    /** One canonical row per custom-subject assignment source. */
    operationalAssignmentsUniqueCustomSubject: uniqueIndex(
      "operational_assignments_unique_custom_subject",
    )
      .on(table.bizId, table.customSubjectType, table.customSubjectId)
      .where(sql`"source_type" = 'custom_subject' AND "deleted_at" IS NULL`),

    /** Tenant-safe FK to canonical demand. */
    operationalAssignmentsBizDemandFk: foreignKey({
      columns: [table.bizId, table.operationalDemandId],
      foreignColumns: [operationalDemands.bizId, operationalDemands.id],
      name: "operational_assignments_biz_demand_fk",
    }),

    /** Tenant-safe FK to fulfillment assignment source. */
    operationalAssignmentsBizFulfillmentAssignmentFk: foreignKey({
      columns: [table.bizId, table.fulfillmentAssignmentId],
      foreignColumns: [fulfillmentAssignments.bizId, fulfillmentAssignments.id],
      name: "operational_assignments_biz_fulfillment_assignment_fk",
    }),

    /** Tenant-safe FK to staffing assignment source. */
    operationalAssignmentsBizStaffingAssignmentFk: foreignKey({
      columns: [table.bizId, table.staffingAssignmentId],
      foreignColumns: [staffingAssignments.bizId, staffingAssignments.id],
      name: "operational_assignments_biz_staffing_assignment_fk",
    }),

    /** Tenant-safe FK to canonical resource pointer. */
    operationalAssignmentsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "operational_assignments_biz_resource_fk",
    }),

    /** Tenant-safe FK to custom-subject assignment source. */
    operationalAssignmentsBizCustomSubjectFk: foreignKey({
      columns: [table.bizId, table.customSubjectType, table.customSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "operational_assignments_biz_custom_subject_fk",
    }),

    /** Window ordering and numeric bounds sanity checks. */
    operationalAssignmentsBoundsCheck: check(
      "operational_assignments_bounds_check",
      sql`
      ("ends_at" IS NULL OR "starts_at" IS NULL OR "ends_at" > "starts_at")
      AND "priority" >= 0
      AND length("source_status") > 0
      `,
    ),

    /** Custom subject payload should be fully-null or fully-populated. */
    operationalAssignmentsCustomSubjectPairCheck: check(
      "operational_assignments_custom_subject_pair_check",
      sql`
      (
        "custom_subject_type" IS NULL
        AND "custom_subject_id" IS NULL
      ) OR (
        "custom_subject_type" IS NOT NULL
        AND "custom_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Source payload must match `source_type` exactly. */
    operationalAssignmentsSourceShapeCheck: check(
      "operational_assignments_source_shape_check",
      sql`
      (
        "source_type" = 'fulfillment_assignment'
        AND "fulfillment_assignment_id" IS NOT NULL
        AND "staffing_assignment_id" IS NULL
        AND "custom_subject_type" IS NULL
        AND "custom_subject_id" IS NULL
      ) OR (
        "source_type" = 'staffing_assignment'
        AND "fulfillment_assignment_id" IS NULL
        AND "staffing_assignment_id" IS NOT NULL
        AND "custom_subject_type" IS NULL
        AND "custom_subject_id" IS NULL
      ) OR (
        "source_type" = 'custom_subject'
        AND "fulfillment_assignment_id" IS NULL
        AND "staffing_assignment_id" IS NULL
        AND "custom_subject_type" IS NOT NULL
        AND "custom_subject_id" IS NOT NULL
      )
      `,
    ),
  }),
);
