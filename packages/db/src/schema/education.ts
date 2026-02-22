import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { locations } from "./locations";
import { resources } from "./resources";
import { users } from "./users";
import { bookingOrders, fulfillmentUnits } from "./fulfillment";
import {
  certificationAwardStatusEnum,
  cohortStatusEnum,
  enrollmentStatusEnum,
  programSessionStatusEnum,
  programStatusEnum,
  sessionAttendanceStatusEnum,
} from "./enums";
import { offerVersions } from "./offers";
import { calendarBindings } from "./time_availability";

/**
 * programs
 *
 * ELI5:
 * Program template defines a multi-session educational/training product.
 */
export const programs = pgTable(
  "programs",
  {
    /** Stable primary key. */
    id: idWithTag("program"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Program name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Program slug. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Program lifecycle state. */
    status: programStatusEnum("status").default("draft").notNull(),

    /** Optional linked offer version for commerce/catalog flows. */
    offerVersionId: idRef("offer_version_id").references(() => offerVersions.id),

    /** Optional default calendar binding for program sessions. */
    calendarBindingId: idRef("calendar_binding_id").references(
      () => calendarBindings.id,
    ),

    /** Optional expected duration in days for planning. */
    expectedDurationDays: integer("expected_duration_days"),

    /** Optional default min attendance percentage (0..10000 bps). */
    requiredAttendanceBps: integer("required_attendance_bps").default(8000).notNull(),

    /** Structured curriculum metadata (modules, outcomes, prerequisites). */
    curriculum: jsonb("curriculum").default({}),

    /** Structured policy (makeup rules, late policy, grading policy, etc.). */
    policy: jsonb("policy").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    programsBizIdIdUnique: uniqueIndex("programs_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe child tables. */

    /** Unique slug per tenant. */
    programsBizSlugUnique: uniqueIndex("programs_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),

    /** Program listing path. */
    programsBizStatusIdx: index("programs_biz_status_idx").on(
      table.bizId,
      table.status,
    ),

    /** Tenant-safe FK to offer version. */
    programsBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "programs_biz_offer_version_fk",
    }),

    /** Tenant-safe FK to calendar binding. */
    programsBizCalendarBindingFk: foreignKey({
      columns: [table.bizId, table.calendarBindingId],
      foreignColumns: [calendarBindings.bizId, calendarBindings.id],
      name: "programs_biz_calendar_binding_fk",
    }),

    /** Bounds checks. */
    programsBoundsCheck: check(
      "programs_bounds_check",
      sql`
      ("expected_duration_days" IS NULL OR "expected_duration_days" > 0)
      AND "required_attendance_bps" >= 0
      AND "required_attendance_bps" <= 10000
      `,
    ),
  }),
);

/**
 * program_cohorts
 *
 * ELI5:
 * Cohort = one concrete run of a program with dates and roster.
 */
export const programCohorts = pgTable(
  "program_cohorts",
  {
    /** Stable primary key. */
    id: idWithTag("cohort"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent program. */
    programId: idRef("program_id")
      .references(() => programs.id)
      .notNull(),

    /** Cohort name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable code used in communication/reporting (SPRING-2026-A). */
    code: varchar("code", { length: 120 }).notNull(),

    /** Cohort lifecycle. */
    status: cohortStatusEnum("status").default("planned").notNull(),

    /** Enrollment open timestamp. */
    enrollmentOpensAt: timestamp("enrollment_opens_at", { withTimezone: true }),

    /** Enrollment close timestamp. */
    enrollmentClosesAt: timestamp("enrollment_closes_at", { withTimezone: true }),

    /** Cohort start timestamp. */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),

    /** Cohort end timestamp. */
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

    /** Optional location anchor. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Optional lead instructor resource. */
    leadResourceId: idRef("lead_resource_id").references(() => resources.id),

    /** Capacity ceiling. */
    capacity: integer("capacity"),

    /** Minimum enrollment threshold to run. */
    minEnrollment: integer("min_enrollment"),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    programCohortsBizIdIdUnique: uniqueIndex("program_cohorts_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe session/enrollment/cert tables. */

    /** Unique cohort code per program. */
    programCohortsProgramCodeUnique: uniqueIndex(
      "program_cohorts_program_code_unique",
    ).on(table.programId, table.code),

    /** Common active cohort query path. */
    programCohortsBizStatusStartsIdx: index("program_cohorts_biz_status_starts_idx").on(
      table.bizId,
      table.status,
      table.startsAt,
    ),

    /** Tenant-safe FK to program. */
    programCohortsBizProgramFk: foreignKey({
      columns: [table.bizId, table.programId],
      foreignColumns: [programs.bizId, programs.id],
      name: "program_cohorts_biz_program_fk",
    }),

    /** Tenant-safe FK to location. */
    programCohortsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "program_cohorts_biz_location_fk",
    }),

    /** Tenant-safe FK to lead resource. */
    programCohortsBizLeadResourceFk: foreignKey({
      columns: [table.bizId, table.leadResourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "program_cohorts_biz_lead_resource_fk",
    }),

    /** Cohort timeline and numeric bounds checks. */
    programCohortsCheck: check(
      "program_cohorts_check",
      sql`
      "ends_at" > "starts_at"
      AND ("enrollment_opens_at" IS NULL OR "enrollment_closes_at" IS NULL OR "enrollment_closes_at" >= "enrollment_opens_at")
      AND ("capacity" IS NULL OR "capacity" > 0)
      AND ("min_enrollment" IS NULL OR "min_enrollment" >= 0)
      AND ("capacity" IS NULL OR "min_enrollment" IS NULL OR "capacity" >= "min_enrollment")
      `,
    ),
  }),
);

/**
 * program_cohort_sessions
 *
 * ELI5:
 * Session = one class/meeting within a cohort.
 */
export const programCohortSessions = pgTable(
  "program_cohort_sessions",
  {
    /** Stable primary key. */
    id: idWithTag("cohort_session"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent cohort. */
    cohortId: idRef("cohort_id")
      .references(() => programCohorts.id)
      .notNull(),

    /** Session sequence order within cohort. */
    sequence: integer("sequence").notNull(),

    /** Session title. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Session lifecycle status. */
    status: programSessionStatusEnum("status").default("planned").notNull(),

    /** Session start. */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),

    /** Session end. */
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

    /** Optional location override. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Optional instructor resource override. */
    instructorResourceId: idRef("instructor_resource_id").references(
      () => resources.id,
    ),

    /** Optional linked fulfillment unit (if scheduled through booking core). */
    fulfillmentUnitId: idRef("fulfillment_unit_id").references(
      () => fulfillmentUnits.id,
    ),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references to this cohort-session row. */
    programCohortSessionsBizIdIdUnique: uniqueIndex(
      "program_cohort_sessions_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** One session sequence per cohort. */
    programCohortSessionsSequenceUnique: uniqueIndex(
      "program_cohort_sessions_sequence_unique",
    ).on(table.cohortId, table.sequence),

    /** Common cohort session timeline path. */
    programCohortSessionsBizCohortStartsIdx: index(
      "program_cohort_sessions_biz_cohort_starts_idx",
    ).on(table.bizId, table.cohortId, table.startsAt),

    /** Tenant-safe FK to cohort. */
    programCohortSessionsBizCohortFk: foreignKey({
      columns: [table.bizId, table.cohortId],
      foreignColumns: [programCohorts.bizId, programCohorts.id],
      name: "program_cohort_sessions_biz_cohort_fk",
    }),

    /** Tenant-safe FK to location. */
    programCohortSessionsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "program_cohort_sessions_biz_location_fk",
    }),

    /** Tenant-safe FK to instructor resource. */
    programCohortSessionsBizInstructorFk: foreignKey({
      columns: [table.bizId, table.instructorResourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "program_cohort_sessions_biz_instructor_fk",
    }),

    /** Tenant-safe FK to linked fulfillment unit. */
    programCohortSessionsBizFulfillmentUnitFk: foreignKey({
      columns: [table.bizId, table.fulfillmentUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "program_cohort_sessions_biz_fulfillment_unit_fk",
    }),

    /** Session sequence and time checks. */
    programCohortSessionsCheck: check(
      "program_cohort_sessions_check",
      sql`"sequence" >= 1 AND "ends_at" > "starts_at"`,
    ),
  }),
);

/**
 * cohort_enrollments
 *
 * ELI5:
 * Enrollment row tracks one learner in one cohort.
 */
export const cohortEnrollments = pgTable(
  "cohort_enrollments",
  {
    /** Stable primary key. */
    id: idWithTag("cohort_enrollment"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Cohort enrolled into. */
    cohortId: idRef("cohort_id")
      .references(() => programCohorts.id)
      .notNull(),

    /** Learner user record. */
    learnerUserId: idRef("learner_user_id")
      .references(() => users.id)
      .notNull(),

    /** Optional sponsor/payer booking order. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Enrollment status. */
    status: enrollmentStatusEnum("status").default("enrolled").notNull(),

    /** Enrollment creation timestamp. */
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).defaultNow().notNull(),

    /** Completion timestamp if completed. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Drop timestamp if dropped. */
    droppedAt: timestamp("dropped_at", { withTimezone: true }),

    /** Optional numeric grade/score snapshot. */
    finalScore: integer("final_score"),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    cohortEnrollmentsBizIdIdUnique: uniqueIndex("cohort_enrollments_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One enrollment per learner per cohort. */
    cohortEnrollmentsUnique: uniqueIndex("cohort_enrollments_unique").on(
      table.cohortId,
      table.learnerUserId,
    ),

    /** Composite key for attendance/certification rows. */

    /** Enrollment ops listing path. */
    cohortEnrollmentsBizStatusIdx: index("cohort_enrollments_biz_status_idx").on(
      table.bizId,
      table.status,
      table.enrolledAt,
    ),

    /** Tenant-safe FK to cohort. */
    cohortEnrollmentsBizCohortFk: foreignKey({
      columns: [table.bizId, table.cohortId],
      foreignColumns: [programCohorts.bizId, programCohorts.id],
      name: "cohort_enrollments_biz_cohort_fk",
    }),

    /** Tenant-safe FK to booking order. */
    cohortEnrollmentsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "cohort_enrollments_biz_booking_order_fk",
    }),

    /** Timeline checks. */
    cohortEnrollmentsTimelineCheck: check(
      "cohort_enrollments_timeline_check",
      sql`
      ("completed_at" IS NULL OR "completed_at" >= "enrolled_at")
      AND ("dropped_at" IS NULL OR "dropped_at" >= "enrolled_at")
      `,
    ),
  }),
);

/**
 * session_attendance_records
 *
 * ELI5:
 * One row tracks attendance of one enrollment in one session.
 */
export const sessionAttendanceRecords = pgTable(
  "session_attendance_records",
  {
    /** Stable primary key. */
    id: idWithTag("attendance"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Session being attended. */
    sessionId: idRef("session_id")
      .references(() => programCohortSessions.id)
      .notNull(),

    /** Enrollment being measured. */
    enrollmentId: idRef("enrollment_id")
      .references(() => cohortEnrollments.id)
      .notNull(),

    /** Attendance status for this session. */
    status: sessionAttendanceStatusEnum("status").default("present").notNull(),

    /** Check-in timestamp. */
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),

    /** Check-out timestamp. */
    checkedOutAt: timestamp("checked_out_at", { withTimezone: true }),

    /** Minutes attended. */
    attendedMinutes: integer("attended_minutes"),

    /** Optional notes. */
    notes: varchar("notes", { length: 800 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sessionAttendanceRecordsBizIdIdUnique: uniqueIndex("session_attendance_records_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One attendance row per session+enrollment. */
    sessionAttendanceRecordsUnique: uniqueIndex(
      "session_attendance_records_unique",
    ).on(table.sessionId, table.enrollmentId),

    /** Common attendance board path. */
    sessionAttendanceRecordsBizSessionStatusIdx: index(
      "session_attendance_records_biz_session_status_idx",
    ).on(table.bizId, table.sessionId, table.status),

    /** Tenant-safe FK to session. */
    sessionAttendanceRecordsBizSessionFk: foreignKey({
      columns: [table.bizId, table.sessionId],
      foreignColumns: [programCohortSessions.bizId, programCohortSessions.id],
      name: "session_attendance_records_biz_session_fk",
    }),

    /** Tenant-safe FK to enrollment. */
    sessionAttendanceRecordsBizEnrollmentFk: foreignKey({
      columns: [table.bizId, table.enrollmentId],
      foreignColumns: [cohortEnrollments.bizId, cohortEnrollments.id],
      name: "session_attendance_records_biz_enrollment_fk",
    }),

    /** Time and duration checks. */
    sessionAttendanceRecordsCheck: check(
      "session_attendance_records_check",
      sql`
      ("checked_out_at" IS NULL OR "checked_in_at" IS NULL OR "checked_out_at" >= "checked_in_at")
      AND ("attended_minutes" IS NULL OR "attended_minutes" >= 0)
      `,
    ),
  }),
);

/**
 * certification_templates
 *
 * ELI5:
 * Defines certificate rules for completing programs/cohorts.
 */
export const certificationTemplates = pgTable(
  "certification_templates",
  {
    /** Stable primary key. */
    id: idWithTag("cert_template"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent program this certification applies to. */
    programId: idRef("program_id")
      .references(() => programs.id)
      .notNull(),

    /** Template name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable slug. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Criteria payload (attendance threshold, score cutoff, required modules). */
    criteria: jsonb("criteria").default({}).notNull(),

    /** Optional validity in days from award; null means no expiry. */
    validForDays: integer("valid_for_days"),

    /** Active toggle. */
    isActive: boolean("is_active").default(true).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for award FKs. */
    certificationTemplatesBizIdIdUnique: uniqueIndex(
      "certification_templates_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Unique slug per program. */
    certificationTemplatesProgramSlugUnique: uniqueIndex(
      "certification_templates_program_slug_unique",
    ).on(table.programId, table.slug),

    /** Tenant-safe FK to program. */
    certificationTemplatesBizProgramFk: foreignKey({
      columns: [table.bizId, table.programId],
      foreignColumns: [programs.bizId, programs.id],
      name: "certification_templates_biz_program_fk",
    }),

    /** Validity days must be positive when present. */
    certificationTemplatesValidityCheck: check(
      "certification_templates_validity_check",
      sql`"valid_for_days" IS NULL OR "valid_for_days" > 0`,
    ),
  }),
);

/**
 * certification_awards
 *
 * ELI5:
 * One row is one certificate issued to one learner enrollment.
 */
export const certificationAwards = pgTable(
  "certification_awards",
  {
    /** Stable primary key. */
    id: idWithTag("cert_award"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Certification template used. */
    certificationTemplateId: idRef("certification_template_id")
      .references(() => certificationTemplates.id)
      .notNull(),

    /** Enrollment that earned or attempted this certificate. */
    enrollmentId: idRef("enrollment_id")
      .references(() => cohortEnrollments.id)
      .notNull(),

    /** Learner user id (denormalized for simpler retrieval). */
    learnerUserId: idRef("learner_user_id")
      .references(() => users.id)
      .notNull(),

    /** Certification award lifecycle state. */
    status: certificationAwardStatusEnum("status").default("awarded").notNull(),

    /** Award timestamp. */
    awardedAt: timestamp("awarded_at", { withTimezone: true }).defaultNow().notNull(),

    /** Expiration timestamp if applicable. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Revocation timestamp if revoked. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),

    /** Evidence payload for auditability. */
    evidence: jsonb("evidence").default({}),

    /** Optional reference code printed on certificate. */
    certificateCode: varchar("certificate_code", { length: 120 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    certificationAwardsBizIdIdUnique: uniqueIndex("certification_awards_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One award row per template+enrollment. */
    certificationAwardsTemplateEnrollmentUnique: uniqueIndex(
      "certification_awards_template_enrollment_unique",
    ).on(table.certificationTemplateId, table.enrollmentId),

    /** Certificate code uniqueness per tenant when present. */
    certificationAwardsCodeUnique: uniqueIndex("certification_awards_code_unique")
      .on(table.bizId, table.certificateCode)
      .where(sql`"certificate_code" IS NOT NULL`),

    /** Certificate registry lookup path. */
    certificationAwardsBizLearnerStatusIdx: index(
      "certification_awards_biz_learner_status_idx",
    ).on(table.bizId, table.learnerUserId, table.status),

    /** Tenant-safe FK to template. */
    certificationAwardsBizTemplateFk: foreignKey({
      columns: [table.bizId, table.certificationTemplateId],
      foreignColumns: [certificationTemplates.bizId, certificationTemplates.id],
      name: "certification_awards_biz_template_fk",
    }),

    /** Tenant-safe FK to enrollment. */
    certificationAwardsBizEnrollmentFk: foreignKey({
      columns: [table.bizId, table.enrollmentId],
      foreignColumns: [cohortEnrollments.bizId, cohortEnrollments.id],
      name: "certification_awards_biz_enrollment_fk",
    }),

    /** Expiry/revocation timeline checks. */
    certificationAwardsTimelineCheck: check(
      "certification_awards_timeline_check",
      sql`
      ("expires_at" IS NULL OR "expires_at" >= "awarded_at")
      AND ("revoked_at" IS NULL OR "revoked_at" >= "awarded_at")
      `,
    ),
  }),
);
