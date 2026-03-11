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
import { compensationPlans } from "./compensation";
import { domainEvents } from "./domain_events";
import {
  lifecycleStatusEnum,
  workforceApplicationStatusEnum,
  workforceAssignmentStatusEnum,
  workforceBenefitEnrollmentStatusEnum,
  workforceBenefitPlanStatusEnum,
  workforceCandidateEventTypeEnum,
  workforceCandidateStatusEnum,
  workforceEmploymentClassEnum,
  workforcePerformanceCycleStatusEnum,
  workforcePerformanceReviewStatusEnum,
  workforceRequisitionStatusEnum,
  workforceTimeCommitmentEnum,
} from "./enums";
import { leavePolicies } from "./leave";
import { locations } from "./locations";
import { debugSnapshots, projectionDocuments } from "./projections";
import { resources } from "./resources";
import { users } from "./users";

/**
 * workforce_departments
 *
 * ELI5:
 * Tenant-specific org dictionary for workforce planning and reporting.
 */
export const workforceDepartments = pgTable(
  "workforce_departments",
  {
    /** Stable primary key. */
    id: idWithTag("wf_dept"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human-readable department label. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable slug used by APIs/imports. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Optional short department code. */
    departmentCode: varchar("department_code", { length: 80 }),

    /** Lifecycle state for activation/retirement. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Optional parent department for org trees. */
    parentWorkforceDepartmentId: idRef("parent_workforce_department_id"),

    /** Optional manager pointer for operational ownership. */
    managerUserId: idRef("manager_user_id").references(() => users.id),

    /** UI ordering hint. */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Department narrative notes. */
    description: text("description"),

    /** Canonical action associated with this row. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),

    /** Latest business event associated with this row. */
    latestDomainEventId: idRef("latest_domain_event_id").references(
      () => domainEvents.id,
    ),

    /** Optional projection row for org chart/dashboard views. */
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),

    /** Optional debug payload for org sync issues. */
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workforceDepartmentsBizIdIdUnique: uniqueIndex("workforce_departments_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    workforceDepartmentsBizSlugUnique: uniqueIndex("workforce_departments_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),

    workforceDepartmentsBizCodeUnique: uniqueIndex("workforce_departments_biz_code_unique")
      .on(table.bizId, table.departmentCode)
      .where(sql`"department_code" IS NOT NULL`),

    workforceDepartmentsBizStatusSortIdx: index("workforce_departments_biz_status_sort_idx").on(
      table.bizId,
      table.status,
      table.sortOrder,
    ),

    workforceDepartmentsActionRequestIdx: index("workforce_departments_action_request_idx").on(
      table.actionRequestId,
    ),

    workforceDepartmentsBizActionRequestFk: foreignKey({
      columns: [table.bizId, table.actionRequestId],
      foreignColumns: [actionRequests.bizId, actionRequests.id],
      name: "workforce_departments_biz_action_request_fk",
    }),

    workforceDepartmentsBizParentFk: foreignKey({
      columns: [table.bizId, table.parentWorkforceDepartmentId],
      foreignColumns: [table.bizId, table.id],
      name: "workforce_departments_biz_parent_fk",
    }),

    workforceDepartmentsSortOrderCheck: check(
      "workforce_departments_sort_order_check",
      sql`"sort_order" >= 0`,
    ),

    workforceDepartmentsParentLoopCheck: check(
      "workforce_departments_parent_loop_check",
      sql`
      "parent_workforce_department_id" IS NULL
      OR "parent_workforce_department_id" <> "id"
      `,
    ),
  }),
);

/**
 * workforce_positions
 *
 * ELI5:
 * Position templates define what roles exist, how many seats they have, and
 * where they sit in reporting structure.
 */
export const workforcePositions = pgTable(
  "workforce_positions",
  {
    /** Stable primary key. */
    id: idWithTag("wf_position"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional department ownership. */
    workforceDepartmentId: idRef("workforce_department_id").references(
      () => workforceDepartments.id,
    ),

    /** Optional location scope for this position. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Human-readable position title. */
    title: varchar("title", { length: 220 }).notNull(),

    /** Stable machine code used by APIs/imports. */
    positionCode: varchar("position_code", { length: 140 }).notNull(),

    /** Lifecycle state of position template. */
    status: lifecycleStatusEnum("status").default("draft").notNull(),

    /** Employment class default for assignments in this position. */
    employmentClass: workforceEmploymentClassEnum("employment_class")
      .default("employee")
      .notNull(),

    /** Time commitment default for this position. */
    timeCommitment: workforceTimeCommitmentEnum("time_commitment")
      .default("full_time")
      .notNull(),

    /** Optional reporting-line parent position. */
    reportsToWorkforcePositionId: idRef("reports_to_workforce_position_id"),

    /** Planned seat count for this position template. */
    headcountTarget: integer("headcount_target").default(1).notNull(),

    /** Filled seat count snapshot for reporting. */
    headcountFilled: integer("headcount_filled").default(0).notNull(),

    /** Fast flag indicating if hiring is currently enabled. */
    isHiringEnabled: boolean("is_hiring_enabled").default(false).notNull(),

    /** Position description. */
    description: text("description"),

    /** Structured requirements/capabilities payload. */
    requirements: jsonb("requirements").default({}).notNull(),

    /** Structured compensation banding payload. */
    compensationBand: jsonb("compensation_band").default({}).notNull(),

    /** Canonical action associated with this row. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),

    /** Latest business event associated with this row. */
    latestDomainEventId: idRef("latest_domain_event_id").references(
      () => domainEvents.id,
    ),

    /** Optional projection row for planning dashboards. */
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),

    /** Optional debug payload for staffing anomalies. */
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workforcePositionsBizIdIdUnique: uniqueIndex("workforce_positions_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    workforcePositionsBizPositionCodeUnique: uniqueIndex(
      "workforce_positions_biz_position_code_unique",
    ).on(table.bizId, table.positionCode),

    workforcePositionsBizStatusDeptIdx: index("workforce_positions_biz_status_dept_idx").on(
      table.bizId,
      table.status,
      table.workforceDepartmentId,
    ),

    workforcePositionsBizHiringStatusIdx: index("workforce_positions_biz_hiring_status_idx").on(
      table.bizId,
      table.isHiringEnabled,
      table.status,
    ),

    workforcePositionsActionRequestIdx: index("workforce_positions_action_request_idx").on(
      table.actionRequestId,
    ),

    workforcePositionsBizDepartmentFk: foreignKey({
      columns: [table.bizId, table.workforceDepartmentId],
      foreignColumns: [workforceDepartments.bizId, workforceDepartments.id],
      name: "workforce_positions_biz_department_fk",
    }),

    workforcePositionsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "workforce_positions_biz_location_fk",
    }),

    workforcePositionsBizReportsToFk: foreignKey({
      columns: [table.bizId, table.reportsToWorkforcePositionId],
      foreignColumns: [table.bizId, table.id],
      name: "workforce_positions_biz_reports_to_fk",
    }),

    workforcePositionsHeadcountCheck: check(
      "workforce_positions_headcount_check",
      sql`
      "headcount_target" >= 1
      AND "headcount_filled" >= 0
      AND "headcount_filled" <= "headcount_target"
      `,
    ),

    workforcePositionsReportsToLoopCheck: check(
      "workforce_positions_reports_to_loop_check",
      sql`
      "reports_to_workforce_position_id" IS NULL
      OR "reports_to_workforce_position_id" <> "id"
      `,
    ),
  }),
);

/**
 * workforce_assignments
 *
 * ELI5:
 * One assignment is one active relationship between a person/resource and a
 * workforce position template.
 */
export const workforceAssignments = pgTable(
  "workforce_assignments",
  {
    /** Stable primary key. */
    id: idWithTag("wf_assignment"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Position template this assignment fills. */
    workforcePositionId: idRef("workforce_position_id")
      .references(() => workforcePositions.id)
      .notNull(),

    /** Optional user principal for this assignment. */
    userId: idRef("user_id").references(() => users.id),

    /**
     * Optional resource principal for workforce-runtime alignment.
     * Useful when shift/fulfillment assignment is resource-driven.
     */
    resourceId: idRef("resource_id").references(() => resources.id),

    /** Runtime assignment lifecycle status. */
    status: workforceAssignmentStatusEnum("status").default("draft").notNull(),

    /** Employment class snapshot for this assignment. */
    employmentClass: workforceEmploymentClassEnum("employment_class")
      .default("employee")
      .notNull(),

    /** Time commitment snapshot for this assignment. */
    timeCommitment: workforceTimeCommitmentEnum("time_commitment")
      .default("full_time")
      .notNull(),

    /** Optional title override at assignment level. */
    assignmentTitle: varchar("assignment_title", { length: 220 }),

    /** Optional manager assignment pointer for reporting chain. */
    managerWorkforceAssignmentId: idRef("manager_workforce_assignment_id"),

    /** Optional compensation plan binding. */
    compensationPlanId: idRef("compensation_plan_id").references(
      () => compensationPlans.id,
    ),

    /** Optional leave policy binding. */
    leavePolicyId: idRef("leave_policy_id").references(() => leavePolicies.id),

    /** Assignment start timestamp. */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),

    /** Assignment end timestamp when concluded. */
    endsAt: timestamp("ends_at", { withTimezone: true }),

    /** Whether this is the principal assignment for the assignee. */
    isPrimary: boolean("is_primary").default(true).notNull(),

    /** Allocation ratio in basis points (10000 = full allocation). */
    allocationBasisPoints: integer("allocation_basis_points")
      .default(10000)
      .notNull(),

    /** Assignment policy payload (schedule, remote, overtime, etc). */
    workPolicy: jsonb("work_policy").default({}).notNull(),

    /** Canonical action associated with assignment changes. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),

    /** Latest business event associated with this row. */
    latestDomainEventId: idRef("latest_domain_event_id").references(
      () => domainEvents.id,
    ),

    /** Optional assignment projection document. */
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),

    /** Optional debug payload for assignment issues. */
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workforceAssignmentsBizIdIdUnique: uniqueIndex("workforce_assignments_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    workforceAssignmentsPrimaryUserUnique: uniqueIndex(
      "workforce_assignments_primary_user_unique",
    )
      .on(table.bizId, table.userId)
      .where(
        sql`"is_primary" = true AND "user_id" IS NOT NULL AND "status" IN ('active', 'on_leave') AND "deleted_at" IS NULL`,
      ),

    workforceAssignmentsBizStatusStartIdx: index("workforce_assignments_biz_status_start_idx").on(
      table.bizId,
      table.status,
      table.startsAt,
    ),

    workforceAssignmentsBizPositionStatusIdx: index(
      "workforce_assignments_biz_position_status_idx",
    ).on(table.bizId, table.workforcePositionId, table.status),

    workforceAssignmentsBizManagerStatusIdx: index(
      "workforce_assignments_biz_manager_status_idx",
    ).on(table.bizId, table.managerWorkforceAssignmentId, table.status),

    workforceAssignmentsActionRequestIdx: index("workforce_assignments_action_request_idx").on(
      table.actionRequestId,
    ),

    workforceAssignmentsBizActionRequestFk: foreignKey({
      columns: [table.bizId, table.actionRequestId],
      foreignColumns: [actionRequests.bizId, actionRequests.id],
      name: "workforce_assignments_biz_action_request_fk",
    }),

    workforceAssignmentsBizPositionFk: foreignKey({
      columns: [table.bizId, table.workforcePositionId],
      foreignColumns: [workforcePositions.bizId, workforcePositions.id],
      name: "workforce_assignments_biz_position_fk",
    }),

    workforceAssignmentsBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "workforce_assignments_biz_resource_fk",
    }),

    workforceAssignmentsBizManagerFk: foreignKey({
      columns: [table.bizId, table.managerWorkforceAssignmentId],
      foreignColumns: [table.bizId, table.id],
      name: "workforce_assignments_biz_manager_fk",
    }),

    workforceAssignmentsBizCompensationPlanFk: foreignKey({
      columns: [table.bizId, table.compensationPlanId],
      foreignColumns: [compensationPlans.bizId, compensationPlans.id],
      name: "workforce_assignments_biz_compensation_plan_fk",
    }),

    workforceAssignmentsBizLeavePolicyFk: foreignKey({
      columns: [table.bizId, table.leavePolicyId],
      foreignColumns: [leavePolicies.bizId, leavePolicies.id],
      name: "workforce_assignments_biz_leave_policy_fk",
    }),

    workforceAssignmentsPrincipalShapeCheck: check(
      "workforce_assignments_principal_shape_check",
      sql`"user_id" IS NOT NULL OR "resource_id" IS NOT NULL`,
    ),

    workforceAssignmentsAllocationCheck: check(
      "workforce_assignments_allocation_check",
      sql`
      "allocation_basis_points" >= 1
      AND "allocation_basis_points" <= 10000
      `,
    ),

    workforceAssignmentsTimelineCheck: check(
      "workforce_assignments_timeline_check",
      sql`("ends_at" IS NULL OR "ends_at" >= "starts_at")`,
    ),

    workforceAssignmentsManagerLoopCheck: check(
      "workforce_assignments_manager_loop_check",
      sql`
      "manager_workforce_assignment_id" IS NULL
      OR "manager_workforce_assignment_id" <> "id"
      `,
    ),
  }),
);

/**
 * workforce_requisitions
 *
 * ELI5:
 * Hiring demand shell tied to position and department planning.
 */
export const workforceRequisitions = pgTable(
  "workforce_requisitions",
  {
    /** Stable primary key. */
    id: idWithTag("wf_requisition"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional position target for this requisition. */
    workforcePositionId: idRef("workforce_position_id").references(
      () => workforcePositions.id,
    ),

    /** Optional department scope. */
    workforceDepartmentId: idRef("workforce_department_id").references(
      () => workforceDepartments.id,
    ),

    /** Optional location scope. */
    locationId: idRef("location_id").references(() => locations.id),

    /** Human-readable requisition title. */
    title: varchar("title", { length: 220 }).notNull(),

    /** Requisition lifecycle status. */
    status: workforceRequisitionStatusEnum("status").default("draft").notNull(),

    /** Number of openings requested. */
    openingCount: integer("opening_count").default(1).notNull(),

    /** Number of openings filled. */
    filledCount: integer("filled_count").default(0).notNull(),

    /** Priority hint (lower values are higher priority). */
    priority: integer("priority").default(100).notNull(),

    /** Hiring manager owner. */
    hiringManagerUserId: idRef("hiring_manager_user_id").references(() => users.id),

    /** Recruiter owner. */
    recruiterUserId: idRef("recruiter_user_id").references(() => users.id),

    /** Open timestamp. */
    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),

    /** Target hire date. */
    targetHireByAt: timestamp("target_hire_by_at", { withTimezone: true }),

    /** Close timestamp. */
    closedAt: timestamp("closed_at", { withTimezone: true }),

    /** Additional notes. */
    description: text("description"),

    /** Structured hiring requirements payload. */
    requirements: jsonb("requirements").default({}).notNull(),

    /** Canonical action associated with requisition writes. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),

    /** Latest business event associated with this requisition. */
    latestDomainEventId: idRef("latest_domain_event_id").references(
      () => domainEvents.id,
    ),

    /** Optional projection row for recruiting board views. */
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),

    /** Optional debug payload for requisition workflow issues. */
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workforceRequisitionsBizIdIdUnique: uniqueIndex(
      "workforce_requisitions_biz_id_id_unique",
    ).on(table.bizId, table.id),

    workforceRequisitionsBizStatusPriorityIdx: index(
      "workforce_requisitions_biz_status_priority_idx",
    ).on(table.bizId, table.status, table.priority),

    workforceRequisitionsBizPositionStatusIdx: index(
      "workforce_requisitions_biz_position_status_idx",
    ).on(table.bizId, table.workforcePositionId, table.status),

    workforceRequisitionsActionRequestIdx: index("workforce_requisitions_action_request_idx").on(
      table.actionRequestId,
    ),

    workforceRequisitionsBizActionRequestFk: foreignKey({
      columns: [table.bizId, table.actionRequestId],
      foreignColumns: [actionRequests.bizId, actionRequests.id],
      name: "workforce_requisitions_biz_action_request_fk",
    }),

    workforceRequisitionsBizPositionFk: foreignKey({
      columns: [table.bizId, table.workforcePositionId],
      foreignColumns: [workforcePositions.bizId, workforcePositions.id],
      name: "workforce_requisitions_biz_position_fk",
    }),

    workforceRequisitionsBizDepartmentFk: foreignKey({
      columns: [table.bizId, table.workforceDepartmentId],
      foreignColumns: [workforceDepartments.bizId, workforceDepartments.id],
      name: "workforce_requisitions_biz_department_fk",
    }),

    workforceRequisitionsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "workforce_requisitions_biz_location_fk",
    }),

    workforceRequisitionsCountsCheck: check(
      "workforce_requisitions_counts_check",
      sql`
      "opening_count" > 0
      AND "filled_count" >= 0
      AND "filled_count" <= "opening_count"
      AND "priority" >= 0
      `,
    ),

    workforceRequisitionsTimelineCheck: check(
      "workforce_requisitions_timeline_check",
      sql`
      ("target_hire_by_at" IS NULL OR "target_hire_by_at" >= "opened_at")
      AND ("closed_at" IS NULL OR "closed_at" >= "opened_at")
      `,
    ),
  }),
);

/**
 * workforce_candidates
 *
 * ELI5:
 * Candidate profile shell reused across requisitions and applications.
 */
export const workforceCandidates = pgTable(
  "workforce_candidates",
  {
    /** Stable primary key. */
    id: idWithTag("wf_candidate"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Candidate lifecycle status across hiring funnel. */
    status: workforceCandidateStatusEnum("status").default("sourced").notNull(),

    /** Candidate display name. */
    fullName: varchar("full_name", { length: 220 }).notNull(),

    /** Primary contact email. */
    primaryEmail: varchar("primary_email", { length: 320 }),

    /** Primary contact phone. */
    primaryPhone: varchar("primary_phone", { length: 60 }),

    /** Source label (referral, inbound, agency, etc). */
    sourceChannel: varchar("source_channel", { length: 120 }),

    /** Current company text snapshot. */
    currentCompany: varchar("current_company", { length: 220 }),

    /** Current title text snapshot. */
    currentTitle: varchar("current_title", { length: 220 }),

    /** Candidate location preference. */
    locationPreference: text("location_preference"),

    /** Availability date hint. */
    availableFromAt: timestamp("available_from_at", { withTimezone: true }),

    /** Optional document/link pointer for resume profile. */
    resumeDocumentRef: varchar("resume_document_ref", { length: 260 }),

    /** Structured profile metadata (skills, links, tags, etc). */
    profile: jsonb("profile").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workforceCandidatesBizIdIdUnique: uniqueIndex("workforce_candidates_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    workforceCandidatesBizPrimaryEmailUnique: uniqueIndex(
      "workforce_candidates_biz_primary_email_unique",
    )
      .on(table.bizId, table.primaryEmail)
      .where(sql`"primary_email" IS NOT NULL AND "deleted_at" IS NULL`),

    workforceCandidatesBizStatusNameIdx: index("workforce_candidates_biz_status_name_idx").on(
      table.bizId,
      table.status,
      table.fullName,
    ),

    workforceCandidatesEmailFormatCheck: check(
      "workforce_candidates_email_format_check",
      sql`
      "primary_email" IS NULL
      OR "primary_email" ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'
      `,
    ),
  }),
);

/**
 * workforce_applications
 *
 * ELI5:
 * Candidate-to-requisition application shell with hiring outcomes.
 */
export const workforceApplications = pgTable(
  "workforce_applications",
  {
    /** Stable primary key. */
    id: idWithTag("wf_application"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent requisition. */
    workforceRequisitionId: idRef("workforce_requisition_id")
      .references(() => workforceRequisitions.id)
      .notNull(),

    /** Candidate profile. */
    workforceCandidateId: idRef("workforce_candidate_id")
      .references(() => workforceCandidates.id)
      .notNull(),

    /** Application lifecycle status. */
    status: workforceApplicationStatusEnum("status").default("applied").notNull(),

    /** Apply timestamp. */
    appliedAt: timestamp("applied_at", { withTimezone: true }).defaultNow().notNull(),

    /** Recruiter owner for this application. */
    assignedRecruiterUserId: idRef("assigned_recruiter_user_id").references(
      () => users.id,
    ),

    /** Decision actor. */
    decisionByUserId: idRef("decision_by_user_id").references(() => users.id),

    /** Decision timestamp for terminal statuses. */
    decisionAt: timestamp("decision_at", { withTimezone: true }),

    /** Desired compensation snapshot (minor units). */
    desiredCompensationMinor: integer("desired_compensation_minor"),

    /** Currency for desired compensation amount. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Hired assignment pointer when status=hired. */
    hiredWorkforceAssignmentId: idRef("hired_workforce_assignment_id").references(
      () => workforceAssignments.id,
    ),

    /** Optional offer payload (terms, approvals, deadlines). */
    offerPayload: jsonb("offer_payload").default({}).notNull(),

    /** Notes. */
    notes: text("notes"),

    /** Canonical action associated with application transitions. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),

    /** Latest business event associated with this application. */
    latestDomainEventId: idRef("latest_domain_event_id").references(
      () => domainEvents.id,
    ),

    /** Optional projection row for recruiting board views. */
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),

    /** Optional debug payload for workflow anomalies. */
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workforceApplicationsBizIdIdUnique: uniqueIndex("workforce_applications_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    workforceApplicationsRequisitionCandidateUnique: uniqueIndex(
      "workforce_applications_requisition_candidate_unique",
    ).on(table.bizId, table.workforceRequisitionId, table.workforceCandidateId),

    workforceApplicationsBizStatusAppliedIdx: index("workforce_applications_biz_status_applied_idx").on(
      table.bizId,
      table.status,
      table.appliedAt,
    ),

    workforceApplicationsBizCandidateStatusIdx: index(
      "workforce_applications_biz_candidate_status_idx",
    ).on(table.bizId, table.workforceCandidateId, table.status),

    workforceApplicationsActionRequestIdx: index("workforce_applications_action_request_idx").on(
      table.actionRequestId,
    ),

    workforceApplicationsBizRequisitionFk: foreignKey({
      columns: [table.bizId, table.workforceRequisitionId],
      foreignColumns: [workforceRequisitions.bizId, workforceRequisitions.id],
      name: "workforce_applications_biz_requisition_fk",
    }),

    workforceApplicationsBizCandidateFk: foreignKey({
      columns: [table.bizId, table.workforceCandidateId],
      foreignColumns: [workforceCandidates.bizId, workforceCandidates.id],
      name: "workforce_applications_biz_candidate_fk",
    }),

    workforceApplicationsBizHiredAssignmentFk: foreignKey({
      columns: [table.bizId, table.hiredWorkforceAssignmentId],
      foreignColumns: [workforceAssignments.bizId, workforceAssignments.id],
      name: "workforce_applications_biz_hired_assignment_fk",
    }),

    workforceApplicationsCompensationCheck: check(
      "workforce_applications_compensation_check",
      sql`
      "desired_compensation_minor" IS NULL
      OR "desired_compensation_minor" >= 0
      `,
    ),

    workforceApplicationsCurrencyFormatCheck: check(
      "workforce_applications_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),

    workforceApplicationsTimelineCheck: check(
      "workforce_applications_timeline_check",
      sql`("decision_at" IS NULL OR "decision_at" >= "applied_at")`,
    ),

    workforceApplicationsStatusShapeCheck: check(
      "workforce_applications_status_shape_check",
      sql`
      ("status" <> 'hired' OR "hired_workforce_assignment_id" IS NOT NULL)
      AND ("hired_workforce_assignment_id" IS NULL OR "status" = 'hired')
      `,
    ),
  }),
);

/**
 * workforce_candidate_events
 *
 * ELI5:
 * Immutable candidate timeline events for recruiting explainability.
 */
export const workforceCandidateEvents = pgTable(
  "workforce_candidate_events",
  {
    /** Stable primary key. */
    id: idWithTag("wf_cand_event"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Candidate this event belongs to. */
    workforceCandidateId: idRef("workforce_candidate_id")
      .references(() => workforceCandidates.id)
      .notNull(),

    /** Optional requisition context. */
    workforceRequisitionId: idRef("workforce_requisition_id").references(
      () => workforceRequisitions.id,
    ),

    /** Optional application context. */
    workforceApplicationId: idRef("workforce_application_id").references(
      () => workforceApplications.id,
    ),

    /** Event taxonomy. */
    eventType: workforceCandidateEventTypeEnum("event_type").notNull(),

    /** Event timestamp. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Optional actor user pointer. */
    actorUserId: idRef("actor_user_id").references(() => users.id),

    /** Optional short event title. */
    title: varchar("title", { length: 200 }),

    /** Event notes. */
    notes: text("notes"),

    /** Structured event payload. */
    eventPayload: jsonb("event_payload").default({}).notNull(),

    /** Canonical action associated with this event append. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),

    /** Domain event pointer for shared event rail alignment. */
    latestDomainEventId: idRef("latest_domain_event_id").references(
      () => domainEvents.id,
    ),

    /** Optional projection row for timeline surfaces. */
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),

    /** Optional debug payload. */
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workforceCandidateEventsBizIdIdUnique: uniqueIndex(
      "workforce_candidate_events_biz_id_id_unique",
    ).on(table.bizId, table.id),

    workforceCandidateEventsCandidateOccurredIdx: index(
      "workforce_candidate_events_candidate_occurred_idx",
    ).on(table.bizId, table.workforceCandidateId, table.occurredAt),

    workforceCandidateEventsApplicationOccurredIdx: index(
      "workforce_candidate_events_application_occurred_idx",
    ).on(table.bizId, table.workforceApplicationId, table.occurredAt),

    workforceCandidateEventsActionRequestIdx: index(
      "workforce_candidate_events_action_request_idx",
    ).on(table.actionRequestId),

    workforceCandidateEventsBizActionRequestFk: foreignKey({
      columns: [table.bizId, table.actionRequestId],
      foreignColumns: [actionRequests.bizId, actionRequests.id],
      name: "workforce_candidate_events_biz_action_request_fk",
    }),

    workforceCandidateEventsBizCandidateFk: foreignKey({
      columns: [table.bizId, table.workforceCandidateId],
      foreignColumns: [workforceCandidates.bizId, workforceCandidates.id],
      name: "workforce_candidate_events_biz_candidate_fk",
    }),

    workforceCandidateEventsBizRequisitionFk: foreignKey({
      columns: [table.bizId, table.workforceRequisitionId],
      foreignColumns: [workforceRequisitions.bizId, workforceRequisitions.id],
      name: "workforce_candidate_events_biz_requisition_fk",
    }),

    workforceCandidateEventsBizApplicationFk: foreignKey({
      columns: [table.bizId, table.workforceApplicationId],
      foreignColumns: [workforceApplications.bizId, workforceApplications.id],
      name: "workforce_candidate_events_biz_application_fk",
    }),
  }),
);

/**
 * workforce_performance_cycles
 *
 * ELI5:
 * Named review cycle windows for structured performance programs.
 */
export const workforcePerformanceCycles = pgTable(
  "workforce_performance_cycles",
  {
    /** Stable primary key. */
    id: idWithTag("wf_perf_cycle"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human-readable cycle name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable slug used by APIs/imports. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Cycle lifecycle state. */
    status: workforcePerformanceCycleStatusEnum("status")
      .default("draft")
      .notNull(),

    /** Cycle start timestamp. */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),

    /** Cycle end timestamp. */
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

    /** Optional calibration due timestamp. */
    calibrationDueAt: timestamp("calibration_due_at", { withTimezone: true }),

    /** Publish timestamp for participant visibility. */
    publishedAt: timestamp("published_at", { withTimezone: true }),

    /** Close timestamp after completion. */
    closedAt: timestamp("closed_at", { withTimezone: true }),

    /** Structured cycle policy payload. */
    policy: jsonb("policy").default({}).notNull(),

    /** Canonical action associated with cycle transitions. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),

    /** Latest domain event associated with this cycle. */
    latestDomainEventId: idRef("latest_domain_event_id").references(
      () => domainEvents.id,
    ),

    /** Optional projection document for cycle dashboards. */
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),

    /** Optional debug payload for cycle anomalies. */
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workforcePerformanceCyclesBizIdIdUnique: uniqueIndex(
      "workforce_performance_cycles_biz_id_id_unique",
    ).on(table.bizId, table.id),

    workforcePerformanceCyclesBizSlugUnique: uniqueIndex(
      "workforce_performance_cycles_biz_slug_unique",
    ).on(table.bizId, table.slug),

    workforcePerformanceCyclesBizStatusStartIdx: index(
      "workforce_performance_cycles_biz_status_start_idx",
    ).on(table.bizId, table.status, table.startsAt),

    workforcePerformanceCyclesActionRequestIdx: index(
      "workforce_performance_cycles_action_request_idx",
    ).on(table.actionRequestId),

    workforcePerformanceCyclesBizActionRequestFk: foreignKey({
      columns: [table.bizId, table.actionRequestId],
      foreignColumns: [actionRequests.bizId, actionRequests.id],
      name: "workforce_performance_cycles_biz_action_request_fk",
    }),

    workforcePerformanceCyclesTimelineCheck: check(
      "workforce_performance_cycles_timeline_check",
      sql`
      "ends_at" > "starts_at"
      AND ("calibration_due_at" IS NULL OR "calibration_due_at" >= "starts_at")
      AND ("closed_at" IS NULL OR "closed_at" >= "starts_at")
      `,
    ),
  }),
);

/**
 * workforce_performance_reviews
 *
 * ELI5:
 * One review record per assignment per cycle.
 */
export const workforcePerformanceReviews = pgTable(
  "workforce_performance_reviews",
  {
    /** Stable primary key. */
    id: idWithTag("wf_perf_review"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent cycle. */
    workforcePerformanceCycleId: idRef("workforce_performance_cycle_id")
      .references(() => workforcePerformanceCycles.id)
      .notNull(),

    /** Assignment under review. */
    workforceAssignmentId: idRef("workforce_assignment_id")
      .references(() => workforceAssignments.id)
      .notNull(),

    /** Optional reviewer assignment pointer. */
    reviewerWorkforceAssignmentId: idRef("reviewer_workforce_assignment_id").references(
      () => workforceAssignments.id,
    ),

    /** Review lifecycle status. */
    status: workforcePerformanceReviewStatusEnum("status")
      .default("draft")
      .notNull(),

    /** Score in basis points (0..10000). */
    scoreBasisPoints: integer("score_basis_points"),

    /** Structured self-assessment payload. */
    selfAssessment: jsonb("self_assessment").default({}).notNull(),

    /** Structured manager/reviewer assessment payload. */
    managerAssessment: jsonb("manager_assessment").default({}).notNull(),

    /** Structured goals payload. */
    goals: jsonb("goals").default({}).notNull(),

    /** Submission timestamp. */
    submittedAt: timestamp("submitted_at", { withTimezone: true }),

    /** Completion timestamp. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Canonical action associated with this review transition. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),

    /** Latest domain event associated with this review. */
    latestDomainEventId: idRef("latest_domain_event_id").references(
      () => domainEvents.id,
    ),

    /** Optional projection row for performance dashboards. */
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),

    /** Optional debug payload for review/rating drift. */
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workforcePerformanceReviewsBizIdIdUnique: uniqueIndex(
      "workforce_performance_reviews_biz_id_id_unique",
    ).on(table.bizId, table.id),

    workforcePerformanceReviewsCycleAssignmentUnique: uniqueIndex(
      "workforce_performance_reviews_cycle_assignment_unique",
    ).on(table.bizId, table.workforcePerformanceCycleId, table.workforceAssignmentId),

    workforcePerformanceReviewsCycleStatusIdx: index(
      "workforce_performance_reviews_cycle_status_idx",
    ).on(table.bizId, table.workforcePerformanceCycleId, table.status),

    workforcePerformanceReviewsAssignmentStatusIdx: index(
      "workforce_performance_reviews_assignment_status_idx",
    ).on(table.bizId, table.workforceAssignmentId, table.status),

    workforcePerformanceReviewsActionRequestIdx: index(
      "workforce_performance_reviews_action_request_idx",
    ).on(table.actionRequestId),

    workforcePerformanceReviewsBizCycleFk: foreignKey({
      columns: [table.bizId, table.workforcePerformanceCycleId],
      foreignColumns: [workforcePerformanceCycles.bizId, workforcePerformanceCycles.id],
      name: "workforce_performance_reviews_biz_cycle_fk",
    }),

    workforcePerformanceReviewsBizAssignmentFk: foreignKey({
      columns: [table.bizId, table.workforceAssignmentId],
      foreignColumns: [workforceAssignments.bizId, workforceAssignments.id],
      name: "workforce_performance_reviews_biz_assignment_fk",
    }),

    workforcePerformanceReviewsBizReviewerAssignmentFk: foreignKey({
      columns: [table.bizId, table.reviewerWorkforceAssignmentId],
      foreignColumns: [workforceAssignments.bizId, workforceAssignments.id],
      name: "workforce_performance_reviews_biz_reviewer_assignment_fk",
    }),

    workforcePerformanceReviewsScoreCheck: check(
      "workforce_performance_reviews_score_check",
      sql`
      "score_basis_points" IS NULL
      OR ("score_basis_points" >= 0 AND "score_basis_points" <= 10000)
      `,
    ),

    workforcePerformanceReviewsTimelineCheck: check(
      "workforce_performance_reviews_timeline_check",
      sql`
      ("completed_at" IS NULL OR "submitted_at" IS NULL OR "completed_at" >= "submitted_at")
      `,
    ),

    workforcePerformanceReviewsStatusShapeCheck: check(
      "workforce_performance_reviews_status_shape_check",
      sql`("status" <> 'completed' OR "completed_at" IS NOT NULL)`,
    ),
  }),
);

/**
 * workforce_benefit_plans
 *
 * ELI5:
 * Benefits catalog for one tenant (health, dental, retirement, etc).
 */
export const workforceBenefitPlans = pgTable(
  "workforce_benefit_plans",
  {
    /** Stable primary key. */
    id: idWithTag("wf_benefit_plan"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human-readable plan name. */
    name: varchar("name", { length: 220 }).notNull(),

    /** Stable slug used in APIs/imports. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Plan lifecycle state. */
    status: workforceBenefitPlanStatusEnum("status").default("draft").notNull(),

    /** Benefit category. */
    benefitType: varchar("benefit_type", { length: 80 }).default("health").notNull(),

    /** Optional provider label. */
    providerName: varchar("provider_name", { length: 220 }),

    /** Currency for contribution amounts. */
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    /** Employer contribution default (minor units). */
    employerContributionMinor: integer("employer_contribution_minor")
      .default(0)
      .notNull(),

    /** Employee contribution default (minor units). */
    employeeContributionMinor: integer("employee_contribution_minor")
      .default(0)
      .notNull(),

    /** Plan effective timestamp. */
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),

    /** Optional plan end timestamp. */
    endsAt: timestamp("ends_at", { withTimezone: true }),

    /** Structured eligibility rules. */
    eligibilityPolicy: jsonb("eligibility_policy").default({}).notNull(),

    /** Structured coverage options and limits. */
    coveragePolicy: jsonb("coverage_policy").default({}).notNull(),

    /** Canonical action associated with this plan. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),

    /** Latest domain event associated with this plan. */
    latestDomainEventId: idRef("latest_domain_event_id").references(
      () => domainEvents.id,
    ),

    /** Optional projection document for benefits dashboards. */
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),

    /** Optional debug payload for plan issues. */
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workforceBenefitPlansBizIdIdUnique: uniqueIndex(
      "workforce_benefit_plans_biz_id_id_unique",
    ).on(table.bizId, table.id),

    workforceBenefitPlansBizSlugUnique: uniqueIndex("workforce_benefit_plans_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),

    workforceBenefitPlansBizStatusEffectiveIdx: index(
      "workforce_benefit_plans_biz_status_effective_idx",
    ).on(table.bizId, table.status, table.effectiveAt),

    workforceBenefitPlansActionRequestIdx: index("workforce_benefit_plans_action_request_idx").on(
      table.actionRequestId,
    ),

    workforceBenefitPlansBizActionRequestFk: foreignKey({
      columns: [table.bizId, table.actionRequestId],
      foreignColumns: [actionRequests.bizId, actionRequests.id],
      name: "workforce_benefit_plans_biz_action_request_fk",
    }),

    workforceBenefitPlansContributionCheck: check(
      "workforce_benefit_plans_contribution_check",
      sql`
      "employer_contribution_minor" >= 0
      AND "employee_contribution_minor" >= 0
      `,
    ),

    workforceBenefitPlansTimelineCheck: check(
      "workforce_benefit_plans_timeline_check",
      sql`("ends_at" IS NULL OR "ends_at" >= "effective_at")`,
    ),

    workforceBenefitPlansCurrencyFormatCheck: check(
      "workforce_benefit_plans_currency_format_check",
      sql`"currency" ~ '^[A-Z]{3}$'`,
    ),

    workforceBenefitPlansTypeCheck: check(
      "workforce_benefit_plans_type_check",
      sql`
      "benefit_type" IN ('health', 'dental', 'vision', 'retirement', 'life', 'wellness')
      OR "benefit_type" LIKE 'custom_%'
      `,
    ),
  }),
);

/**
 * workforce_benefit_enrollments
 *
 * ELI5:
 * Assignment enrollment rows for benefit elections over time.
 */
export const workforceBenefitEnrollments = pgTable(
  "workforce_benefit_enrollments",
  {
    /** Stable primary key. */
    id: idWithTag("wf_benefit_enroll"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Benefit plan selected/waived. */
    workforceBenefitPlanId: idRef("workforce_benefit_plan_id")
      .references(() => workforceBenefitPlans.id)
      .notNull(),

    /** Assignment making the election. */
    workforceAssignmentId: idRef("workforce_assignment_id")
      .references(() => workforceAssignments.id)
      .notNull(),

    /** Enrollment lifecycle state. */
    status: workforceBenefitEnrollmentStatusEnum("status")
      .default("pending")
      .notNull(),

    /** Optional coverage tier label. */
    coverageTier: varchar("coverage_tier", { length: 100 }),

    /** Number of covered dependents. */
    dependentCount: integer("dependent_count").default(0).notNull(),

    /** Employee contribution override (minor units). */
    employeeContributionMinor: integer("employee_contribution_minor"),

    /** Employer contribution override (minor units). */
    employerContributionMinor: integer("employer_contribution_minor"),

    /** Election timestamp. */
    electedAt: timestamp("elected_at", { withTimezone: true }).defaultNow().notNull(),

    /** Enrollment effective timestamp. */
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),

    /** Enrollment end timestamp. */
    endedAt: timestamp("ended_at", { withTimezone: true }),

    /** Optional reason for waiver/decline. */
    waivedReason: text("waived_reason"),

    /** Notes for operators/payroll teams. */
    notes: text("notes"),

    /** Canonical action associated with this election transition. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),

    /** Latest domain event associated with this enrollment. */
    latestDomainEventId: idRef("latest_domain_event_id").references(
      () => domainEvents.id,
    ),

    /** Optional projection document for benefits surfaces. */
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),

    /** Optional debug payload for enrollment failures. */
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    workforceBenefitEnrollmentsBizIdIdUnique: uniqueIndex(
      "workforce_benefit_enrollments_biz_id_id_unique",
    ).on(table.bizId, table.id),

    workforceBenefitEnrollmentsActiveUnique: uniqueIndex(
      "workforce_benefit_enrollments_active_unique",
    )
      .on(table.bizId, table.workforceBenefitPlanId, table.workforceAssignmentId)
      .where(sql`"status" IN ('pending', 'active') AND "deleted_at" IS NULL`),

    workforceBenefitEnrollmentsAssignmentStatusIdx: index(
      "workforce_benefit_enrollments_assignment_status_idx",
    ).on(table.bizId, table.workforceAssignmentId, table.status),

    workforceBenefitEnrollmentsPlanStatusIdx: index(
      "workforce_benefit_enrollments_plan_status_idx",
    ).on(table.bizId, table.workforceBenefitPlanId, table.status),

    workforceBenefitEnrollmentsActionRequestIdx: index(
      "workforce_benefit_enrollments_action_request_idx",
    ).on(table.actionRequestId),

    workforceBenefitEnrollmentsBizActionRequestFk: foreignKey({
      columns: [table.bizId, table.actionRequestId],
      foreignColumns: [actionRequests.bizId, actionRequests.id],
      name: "workforce_benefit_enrollments_biz_action_request_fk",
    }),

    workforceBenefitEnrollmentsBizPlanFk: foreignKey({
      columns: [table.bizId, table.workforceBenefitPlanId],
      foreignColumns: [workforceBenefitPlans.bizId, workforceBenefitPlans.id],
      name: "workforce_benefit_enrollments_biz_plan_fk",
    }),

    workforceBenefitEnrollmentsBizAssignmentFk: foreignKey({
      columns: [table.bizId, table.workforceAssignmentId],
      foreignColumns: [workforceAssignments.bizId, workforceAssignments.id],
      name: "workforce_benefit_enrollments_biz_assignment_fk",
    }),

    workforceBenefitEnrollmentsContributionCheck: check(
      "workforce_benefit_enrollments_contribution_check",
      sql`
      "dependent_count" >= 0
      AND ("employee_contribution_minor" IS NULL OR "employee_contribution_minor" >= 0)
      AND ("employer_contribution_minor" IS NULL OR "employer_contribution_minor" >= 0)
      `,
    ),

    workforceBenefitEnrollmentsTimelineCheck: check(
      "workforce_benefit_enrollments_timeline_check",
      sql`
      "effective_at" >= "elected_at"
      AND ("ended_at" IS NULL OR "ended_at" >= "effective_at")
      `,
    ),

    workforceBenefitEnrollmentsStatusShapeCheck: check(
      "workforce_benefit_enrollments_status_shape_check",
      sql`("status" <> 'ended' OR "ended_at" IS NOT NULL)`,
    ),
  }),
);

export type WorkforceDepartment = typeof workforceDepartments.$inferSelect;
export type NewWorkforceDepartment = typeof workforceDepartments.$inferInsert;

export type WorkforcePosition = typeof workforcePositions.$inferSelect;
export type NewWorkforcePosition = typeof workforcePositions.$inferInsert;

export type WorkforceAssignment = typeof workforceAssignments.$inferSelect;
export type NewWorkforceAssignment = typeof workforceAssignments.$inferInsert;

export type WorkforceRequisition = typeof workforceRequisitions.$inferSelect;
export type NewWorkforceRequisition = typeof workforceRequisitions.$inferInsert;

export type WorkforceCandidate = typeof workforceCandidates.$inferSelect;
export type NewWorkforceCandidate = typeof workforceCandidates.$inferInsert;

export type WorkforceApplication = typeof workforceApplications.$inferSelect;
export type NewWorkforceApplication = typeof workforceApplications.$inferInsert;

export type WorkforceCandidateEvent = typeof workforceCandidateEvents.$inferSelect;
export type NewWorkforceCandidateEvent = typeof workforceCandidateEvents.$inferInsert;

export type WorkforcePerformanceCycle = typeof workforcePerformanceCycles.$inferSelect;
export type NewWorkforcePerformanceCycle = typeof workforcePerformanceCycles.$inferInsert;

export type WorkforcePerformanceReview = typeof workforcePerformanceReviews.$inferSelect;
export type NewWorkforcePerformanceReview =
  typeof workforcePerformanceReviews.$inferInsert;

export type WorkforceBenefitPlan = typeof workforceBenefitPlans.$inferSelect;
export type NewWorkforceBenefitPlan = typeof workforceBenefitPlans.$inferInsert;

export type WorkforceBenefitEnrollment = typeof workforceBenefitEnrollments.$inferSelect;
export type NewWorkforceBenefitEnrollment =
  typeof workforceBenefitEnrollments.$inferInsert;
