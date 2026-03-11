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
import { users } from "./users";
import { subjects } from "./subjects";
import { scheduleSubjectStatusEnum } from "./enums";

/**
 * schedule_subjects
 *
 * ELI5:
 * This is the shared list of "things that participate in time and capacity".
 *
 * Examples:
 * - a host
 * - an asset
 * - a venue
 * - a service
 * - an offer
 * - a service product
 * - a location
 * - even a future plugin-defined thing
 *
 * Why this exists:
 * The platform has many things that can be:
 * - available
 * - unavailable
 * - reserved
 * - blocked
 * - capacity-constrained
 *
 * We want to model that once.
 */
export const scheduleSubjects = pgTable(
  "schedule_subjects",
  {
    id: idWithTag("schedule_subject"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Link to the canonical subject registry so this stays extensible. */
    subjectType: varchar("subject_type", { length: 80 }).notNull(),
    subjectId: varchar("subject_id", { length: 140 }).notNull(),

    /**
     * Broad scheduling class.
     * Example values:
     * - resource
     * - service
     * - offer
     * - location
     * - customer
     */
    scheduleClass: varchar("schedule_class", { length: 60 }).notNull(),

    displayName: varchar("display_name", { length: 240 }),
    status: scheduleSubjectStatusEnum("status").default("active").notNull(),

    /**
     * Default scheduling behavior for overlap/capacity decisions.
     *
     * Example values:
     * - exclusive
     * - shared
     * - advisory
     */
    schedulingMode: varchar("scheduling_mode", { length: 40 }).default("exclusive").notNull(),

    defaultCapacity: integer("default_capacity").default(1).notNull(),
    defaultLeadTimeMin: integer("default_lead_time_min").default(0).notNull(),
    defaultBufferBeforeMin: integer("default_buffer_before_min").default(0).notNull(),
    defaultBufferAfterMin: integer("default_buffer_after_min").default(0).notNull(),

    /** If true, this subject should normally get its own dedicated timeline view. */
    shouldProjectTimeline: boolean("should_project_timeline").default(true).notNull(),

    policy: jsonb("policy").default({}).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    scheduleSubjectsBizIdIdUnique: uniqueIndex("schedule_subjects_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    scheduleSubjectsUnique: uniqueIndex("schedule_subjects_unique").on(
      table.bizId,
      table.subjectType,
      table.subjectId,
    ),
    scheduleSubjectsClassIdx: index("schedule_subjects_class_idx").on(
      table.bizId,
      table.scheduleClass,
      table.status,
    ),
    scheduleSubjectsSubjectFk: foreignKey({
      columns: [table.bizId, table.subjectType, table.subjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "schedule_subjects_subject_fk",
    }),
    scheduleSubjectsSanityCheck: check(
      "schedule_subjects_sanity_check",
      sql`
      "default_capacity" >= 0
      AND "default_lead_time_min" >= 0
      AND "default_buffer_before_min" >= 0
      AND "default_buffer_after_min" >= 0
      `,
    ),
  }),
);

/**
 * schedule_subject_links
 *
 * ELI5:
 * A schedule subject may depend on or consume another schedule subject.
 *
 * Examples:
 * - service requires host
 * - host requires front-desk support to operate
 * - offer depends on room + equipment
 */
export const scheduleSubjectLinks = pgTable(
  "schedule_subject_links",
  {
    id: idWithTag("schedule_link"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    parentScheduleSubjectId: idRef("parent_schedule_subject_id")
      .references(() => scheduleSubjects.id, { onDelete: "cascade" })
      .notNull(),
    childScheduleSubjectId: idRef("child_schedule_subject_id")
      .references(() => scheduleSubjects.id, { onDelete: "cascade" })
      .notNull(),
    linkType: varchar("link_type", { length: 60 }).notNull(),
    quantityRequired: integer("quantity_required").default(1).notNull(),
    isOptional: boolean("is_optional").default(false).notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    policy: jsonb("policy").default({}).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    scheduleSubjectLinksBizIdIdUnique: uniqueIndex("schedule_subject_links_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    scheduleSubjectLinksUnique: uniqueIndex("schedule_subject_links_unique").on(
      table.bizId,
      table.parentScheduleSubjectId,
      table.childScheduleSubjectId,
      table.linkType,
    ),
    scheduleSubjectLinksDistinctCheck: check(
      "schedule_subject_links_distinct_check",
      sql`"parent_schedule_subject_id" <> "child_schedule_subject_id" AND "quantity_required" > 0`,
    ),
  }),
);
