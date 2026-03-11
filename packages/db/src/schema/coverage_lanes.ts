import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  jsonb,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { calendars } from "./time_availability";
import { scheduleSubjects } from "./schedule_subjects";
import { lifecycleStatusEnum, coverageLaneMembershipRoleEnum, coverageLanePresenceModeEnum, coverageLaneTypeEnum } from "./enums";
import { locations } from "./locations";
import { resources } from "./resources";
import { users } from "./users";
import { workflowInstances } from "./workflows";

/**
 * coverage_lanes
 *
 * ELI5:
 * A coverage lane is one operational duty channel that needs a real owner in
 * time, like:
 * - front desk
 * - inbound phone response
 * - remote on-call triage
 * - dispatch supervisor
 *
 * Why this exists:
 * - staffing demands model "we need coverage in a window",
 * - calendars model "time is open/closed",
 * - but the platform still needed a first-class thing representing the duty
 *   itself so staffing, availability, workflows, and calendar UI all point at
 *   the same identity.
 */
export const coverageLanes = pgTable(
  "coverage_lanes",
  {
    id: idWithTag("coverage_lane"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    locationId: idRef("location_id").references(() => locations.id),

    name: varchar("name", { length: 220 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    status: lifecycleStatusEnum("status").default("active").notNull(),

    laneType: coverageLaneTypeEnum("lane_type").default("custom").notNull(),
    presenceMode: coverageLanePresenceModeEnum("presence_mode")
      .default("onsite")
      .notNull(),

    requiredHeadcount: integer("required_headcount").default(1).notNull(),

    /**
     * Canonical schedule identity for this lane.
     * Null is allowed during bootstrapping; API writers should populate it.
     */
    scheduleSubjectId: idRef("schedule_subject_id").references(() => scheduleSubjects.id),

    /**
     * Dedicated calendar that represents the lane's covered/uncovered windows.
     * This lets the calendar UI render on-call lanes just like other schedule
     * participants and lets dependency rules target them directly.
     */
    primaryCalendarId: idRef("primary_calendar_id").references(() => calendars.id),

    /** Whether callers may route work here automatically without manual review. */
    autoDispatchEnabled: boolean("auto_dispatch_enabled").default(false).notNull(),

    /** SLA/escalation/config policy for this lane. */
    policy: jsonb("policy").default({}).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    coverageLanesBizIdIdUnique: uniqueIndex("coverage_lanes_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    coverageLanesBizSlugUnique: uniqueIndex("coverage_lanes_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),
    coverageLanesBizStatusIdx: index("coverage_lanes_biz_status_idx").on(
      table.bizId,
      table.status,
      table.laneType,
    ),
    coverageLanesBizLocationIdx: index("coverage_lanes_biz_location_idx").on(
      table.bizId,
      table.locationId,
      table.status,
    ),
    coverageLanesScheduleSubjectUnique: uniqueIndex(
      "coverage_lanes_schedule_subject_unique",
    )
      .on(table.scheduleSubjectId)
      .where(sql`"schedule_subject_id" IS NOT NULL AND "deleted_at" IS NULL`),
    coverageLanesPrimaryCalendarUnique: uniqueIndex(
      "coverage_lanes_primary_calendar_unique",
    )
      .on(table.primaryCalendarId)
      .where(sql`"primary_calendar_id" IS NOT NULL AND "deleted_at" IS NULL`),
    coverageLanesBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "coverage_lanes_biz_location_fk",
    }),
    coverageLanesBizScheduleSubjectFk: foreignKey({
      columns: [table.bizId, table.scheduleSubjectId],
      foreignColumns: [scheduleSubjects.bizId, scheduleSubjects.id],
      name: "coverage_lanes_biz_schedule_subject_fk",
    }),
    coverageLanesBizPrimaryCalendarFk: foreignKey({
      columns: [table.bizId, table.primaryCalendarId],
      foreignColumns: [calendars.bizId, calendars.id],
      name: "coverage_lanes_biz_primary_calendar_fk",
    }),
    coverageLanesSanityCheck: check(
      "coverage_lanes_sanity_check",
      sql`
      length("name") > 0
      AND length("slug") > 0
      AND "required_headcount" > 0
      `,
    ),
  }),
);

/**
 * coverage_lane_memberships
 *
 * ELI5:
 * Which resources are eligible to cover one operational duty lane.
 *
 * Why this exists:
 * - a lane can have primary and backup coverage pools,
 * - remote and onsite participation may differ,
 * - staffing demand candidate resolution should not have to guess membership
 *   from free-form notes or titles.
 */
export const coverageLaneMemberships = pgTable(
  "coverage_lane_memberships",
  {
    id: idWithTag("coverage_lane_member"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    coverageLaneId: idRef("coverage_lane_id")
      .references(() => coverageLanes.id)
      .notNull(),

    resourceId: idRef("resource_id")
      .references(() => resources.id)
      .notNull(),

    status: lifecycleStatusEnum("status").default("active").notNull(),
    membershipRole: coverageLaneMembershipRoleEnum("membership_role")
      .default("primary")
      .notNull(),
    participationMode: coverageLanePresenceModeEnum("participation_mode")
      .default("onsite")
      .notNull(),

    escalationOrder: integer("escalation_order").default(100).notNull(),
    responsePriority: integer("response_priority").default(100).notNull(),
    isDispatchEligible: boolean("is_dispatch_eligible").default(true).notNull(),

    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),

    policy: jsonb("policy").default({}).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    coverageLaneMembershipsBizIdIdUnique: uniqueIndex(
      "coverage_lane_memberships_biz_id_id_unique",
    ).on(table.bizId, table.id),
    coverageLaneMembershipsLaneResourceUnique: uniqueIndex(
      "coverage_lane_memberships_lane_resource_unique",
    )
      .on(table.coverageLaneId, table.resourceId)
      .where(sql`"deleted_at" IS NULL`),
    coverageLaneMembershipsBizLaneStatusIdx: index(
      "coverage_lane_memberships_biz_lane_status_idx",
    ).on(table.bizId, table.coverageLaneId, table.status, table.escalationOrder),
    coverageLaneMembershipsBizResourceStatusIdx: index(
      "coverage_lane_memberships_biz_resource_status_idx",
    ).on(table.bizId, table.resourceId, table.status, table.responsePriority),
    coverageLaneMembershipsBizLaneFk: foreignKey({
      columns: [table.bizId, table.coverageLaneId],
      foreignColumns: [coverageLanes.bizId, coverageLanes.id],
      name: "coverage_lane_memberships_biz_lane_fk",
    }),
    coverageLaneMembershipsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "coverage_lane_memberships_biz_resource_fk",
    }),
    coverageLaneMembershipsWindowCheck: check(
      "coverage_lane_memberships_window_check",
      sql`
      "escalation_order" >= 0
      AND "response_priority" >= 0
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
 * coverage_lane_shift_templates
 *
 * ELI5:
 * Reusable recurring shift recipe for one coverage lane.
 *
 * Why this exists:
 * - recurring coverage should be defined once,
 * - publishing future demand/assignments should be idempotent,
 * - owner workflows need a stable primitive for "every weekday, 9-1".
 */
export const coverageLaneShiftTemplates = pgTable(
  "coverage_lane_shift_templates",
  {
    id: idWithTag("coverage_shift_template"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    coverageLaneId: idRef("coverage_lane_id")
      .references(() => coverageLanes.id)
      .notNull(),

    locationId: idRef("location_id").references(() => locations.id),
    defaultResourceId: idRef("default_resource_id").references(() => resources.id),

    name: varchar("name", { length: 220 }).notNull(),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    timezone: varchar("timezone", { length: 80 }).default("UTC").notNull(),

    /** { dayOfWeeks: number[], startTime: '09:00', endTime: '17:00' } */
    recurrenceRule: jsonb("recurrence_rule").default({}).notNull(),

    /** direct_assign | fcfs_claim | invite_accept | auction | auto_match */
    fillMode: varchar("fill_mode", { length: 40 }).default("invite_accept").notNull(),

    requiredCount: integer("required_count").default(1).notNull(),
    autoPublishEnabled: boolean("auto_publish_enabled").default(false).notNull(),
    publishWindowDays: integer("publish_window_days").default(14).notNull(),
    lastPublishedThrough: timestamp("last_published_through", { withTimezone: true }),

    policy: jsonb("policy").default({}).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    coverageLaneShiftTemplatesBizIdIdUnique: uniqueIndex(
      "coverage_lane_shift_templates_biz_id_id_unique",
    ).on(table.bizId, table.id),
    coverageLaneShiftTemplatesBizLaneStatusIdx: index(
      "coverage_lane_shift_templates_biz_lane_status_idx",
    ).on(table.bizId, table.coverageLaneId, table.status),
    coverageLaneShiftTemplatesBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "coverage_lane_shift_templates_biz_location_fk",
    }),
    coverageLaneShiftTemplatesBizLaneFk: foreignKey({
      columns: [table.bizId, table.coverageLaneId],
      foreignColumns: [coverageLanes.bizId, coverageLanes.id],
      name: "coverage_lane_shift_templates_biz_lane_fk",
    }),
    coverageLaneShiftTemplatesBizResourceFk: foreignKey({
      columns: [table.bizId, table.defaultResourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "coverage_lane_shift_templates_biz_resource_fk",
    }),
    coverageLaneShiftTemplatesSanityCheck: check(
      "coverage_lane_shift_templates_sanity_check",
      sql`
      length("name") > 0
      AND "required_count" > 0
      AND "publish_window_days" > 0
      AND "status" IN ('draft', 'active', 'inactive', 'archived')
      AND "fill_mode" IN ('direct_assign', 'fcfs_claim', 'invite_accept', 'auction', 'auto_match')
      `,
    ),
  }),
);

/**
 * coverage_lane_alerts
 *
 * ELI5:
 * Persistent operational alert state for one lane.
 *
 * Why this exists:
 * - uncovered lanes need a durable timer before escalation,
 * - workflows should launch once per active alert period,
 * - UI needs more than a transient computed banner.
 */
export const coverageLaneAlerts = pgTable(
  "coverage_lane_alerts",
  {
    id: idWithTag("coverage_lane_alert"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    coverageLaneId: idRef("coverage_lane_id")
      .references(() => coverageLanes.id)
      .notNull(),

    alertType: varchar("alert_type", { length: 60 }).notNull(),
    severity: varchar("severity", { length: 20 }).default("notice").notNull(),
    status: varchar("status", { length: 20 }).default("active").notNull(),

    title: varchar("title", { length: 220 }).notNull(),
    summary: varchar("summary", { length: 1000 }),

    firstTriggeredAt: timestamp("first_triggered_at", { withTimezone: true }).defaultNow().notNull(),
    lastObservedAt: timestamp("last_observed_at", { withTimezone: true }).defaultNow().notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),

    workflowInstanceId: idRef("workflow_instance_id").references(() => workflowInstances.id),

    metadata: jsonb("metadata").default({}).notNull(),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    coverageLaneAlertsBizIdIdUnique: uniqueIndex("coverage_lane_alerts_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    coverageLaneAlertsActiveUnique: uniqueIndex("coverage_lane_alerts_active_unique")
      .on(table.bizId, table.coverageLaneId, table.alertType)
      .where(sql`"resolved_at" IS NULL AND "deleted_at" IS NULL`),
    coverageLaneAlertsBizStatusObservedIdx: index("coverage_lane_alerts_biz_status_observed_idx").on(
      table.bizId,
      table.status,
      table.lastObservedAt,
    ),
    coverageLaneAlertsBizLaneFk: foreignKey({
      columns: [table.bizId, table.coverageLaneId],
      foreignColumns: [coverageLanes.bizId, coverageLanes.id],
      name: "coverage_lane_alerts_biz_lane_fk",
    }),
    coverageLaneAlertsBizWorkflowFk: foreignKey({
      columns: [table.bizId, table.workflowInstanceId],
      foreignColumns: [workflowInstances.bizId, workflowInstances.id],
      name: "coverage_lane_alerts_biz_workflow_fk",
    }),
    coverageLaneAlertsSanityCheck: check(
      "coverage_lane_alerts_sanity_check",
      sql`
      length("alert_type") > 0
      AND length("title") > 0
      AND "severity" IN ('notice', 'warning', 'critical')
      AND "status" IN ('active', 'acknowledged', 'resolved')
      AND "last_observed_at" >= "first_triggered_at"
      AND ("resolved_at" IS NULL OR "resolved_at" >= "first_triggered_at")
      `,
    ),
  }),
);
