import { sql } from "drizzle-orm";
import { check, index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  jsonb,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { actionRequests } from "./action_backbone";
import { bizes } from "./bizes";
import { messageTemplates, outboundMessages } from "./communications";
import { crmContacts, crmConversations, crmLeads, crmOpportunities } from "./crm";
import { domainEvents } from "./domain_events";
import { customerProfiles } from "./external_installations";
import { bookingOrders } from "./fulfillment";
import { lifecycleStatusEnum } from "./enums";
import { paymentTransactions } from "./payments";
import { debugSnapshots, projectionDocuments } from "./projections";
import { slaPolicies } from "./sla";
import { users } from "./users";
import { workflowInstances } from "./workflows";

/**
 * customer_profile_crm_links
 *
 * ELI5:
 * `customer_profiles` is our cross-channel customer identity root.
 * `crm_contacts` is our sales/CRM contact card.
 *
 * This table links those two worlds in a normalized, auditable way so:
 * - CRM can stay strong for pipelines and sales motions,
 * - customer identity can stay strong for support/marketing lifecycle,
 * - we do not duplicate identity facts in two table families.
 */
export const customerProfileCrmLinks = pgTable(
  "customer_profile_crm_links",
  {
    /** Stable primary key for one profile<->contact relationship row. */
    id: idWithTag("cust_crm_link"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Canonical customer profile anchor. */
    customerProfileId: idRef("customer_profile_id")
      .references(() => customerProfiles.id, { onDelete: "cascade" })
      .notNull(),

    /** CRM contact card anchor. */
    crmContactId: idRef("crm_contact_id")
      .references(() => crmContacts.id, { onDelete: "cascade" })
      .notNull(),

    /**
     * Relationship meaning.
     * - primary: main active CRM card
     * - secondary: additional linked contact
     * - historical: old card kept for lineage
     */
    linkType: varchar("link_type", { length: 40 }).default("primary").notNull(),

    /** Quick flag for primary relationship resolution. */
    isPrimary: boolean("is_primary").default(false).notNull(),

    /** Optional operator note for merge/debug context. */
    note: text("note"),

    /** Backbone trace links. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),
    domainEventId: idRef("domain_event_id").references(() => domainEvents.id),
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    customerProfileCrmLinksBizIdIdUnique: uniqueIndex(
      "customer_profile_crm_links_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Prevent duplicate active relationship rows for the same pair. */
    customerProfileCrmLinksPairUnique: uniqueIndex("customer_profile_crm_links_pair_unique")
      .on(table.bizId, table.customerProfileId, table.crmContactId)
      .where(sql`"deleted_at" IS NULL`),

    /** Resolve primary contact quickly when loading customer 360 cards. */
    customerProfileCrmLinksPrimaryIdx: index("customer_profile_crm_links_primary_idx").on(
      table.bizId,
      table.customerProfileId,
      table.isPrimary,
    ),

    /** Link-type vocabulary remains extensible. */
    customerProfileCrmLinksTypeCheck: check(
      "customer_profile_crm_links_type_check",
      sql`
      "link_type" IN ('primary', 'secondary', 'historical')
      OR "link_type" LIKE 'custom_%'
      `,
    ),
  }),
);

/**
 * customer_timeline_events
 *
 * ELI5:
 * This is the unified customer story feed.
 *
 * Each row is one business-relevant event that humans/agents can read in order
 * without joining ten unrelated runtime tables.
 */
export const customerTimelineEvents = pgTable(
  "customer_timeline_events",
  {
    /** Stable primary key for one timeline fact row. */
    id: idWithTag("customer_timeline_evt"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Customer profile this event belongs to. */
    customerProfileId: idRef("customer_profile_id")
      .references(() => customerProfiles.id, { onDelete: "cascade" })
      .notNull(),

    /** Event classification key for filtering and grouping. */
    eventType: varchar("event_type", { length: 80 }).notNull(),

    /** Human-readable short title for timeline UIs. */
    title: varchar("title", { length: 260 }).notNull(),

    /** Optional richer summary text. */
    summary: text("summary"),

    /** Source domain of this event. */
    sourceDomain: varchar("source_domain", { length: 60 }).notNull(),

    /** Optional source entity pointer. */
    sourceEntityType: varchar("source_entity_type", { length: 80 }),
    sourceEntityId: idRef("source_entity_id"),

    /** Whether this can be shown in customer-facing timeline UIs. */
    isCustomerVisible: boolean("is_customer_visible").default(false).notNull(),

    /** Relative priority for timeline sorting/highlights. */
    importance: integer("importance").default(100).notNull(),

    /** Event occurrence timestamp. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Flexible payload for rich UI/event detail. */
    payload: jsonb("payload").default({}).notNull(),

    /** Backbone trace links. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),
    domainEventId: idRef("domain_event_id").references(() => domainEvents.id),
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    customerTimelineEventsBizIdIdUnique: uniqueIndex(
      "customer_timeline_events_biz_id_id_unique",
    ).on(table.bizId, table.id),
    customerTimelineEventsProfileOccurredIdx: index(
      "customer_timeline_events_profile_occurred_idx",
    ).on(table.bizId, table.customerProfileId, table.occurredAt),
    customerTimelineEventsTypeIdx: index("customer_timeline_events_type_idx").on(
      table.bizId,
      table.eventType,
      table.occurredAt,
    ),
    customerTimelineEventsImportanceCheck: check(
      "customer_timeline_events_importance_check",
      sql`"importance" >= 0`,
    ),
  }),
);

/**
 * crm_activities
 *
 * ELI5:
 * This is the universal "something happened in customer ops" table for CRM.
 * Think calls, emails, meetings, follow-ups, and notes.
 *
 * Why this exists:
 * - opportunities alone do not tell you what reps/support actually did,
 * - support events alone do not tell you sales motion quality,
 * - this gives a single activity stream to join with timeline reporting.
 */
export const crmActivities = pgTable(
  "crm_activities",
  {
    /** Stable primary key for one CRM activity. */
    id: idWithTag("crm_activity"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional customer identity anchor for unified timeline joins. */
    customerProfileId: idRef("customer_profile_id").references(() => customerProfiles.id),

    /** Optional CRM anchors. */
    crmContactId: idRef("crm_contact_id").references(() => crmContacts.id),
    crmLeadId: idRef("crm_lead_id").references(() => crmLeads.id),
    crmOpportunityId: idRef("crm_opportunity_id").references(() => crmOpportunities.id),

    /** Optional support anchor when activity is related to service recovery. */
    supportCaseId: idRef("support_case_id"),

    /** Optional conversation/message linkage for omnichannel traceability. */
    crmConversationId: idRef("crm_conversation_id").references(() => crmConversations.id),
    outboundMessageId: idRef("outbound_message_id").references(() => outboundMessages.id),

    /** Activity category (call, email, sms, meeting, note, task, etc). */
    activityType: varchar("activity_type", { length: 60 }).notNull(),

    /** Flow direction for messaging and communication analytics. */
    direction: varchar("direction", { length: 32 }).default("internal").notNull(),

    /** Lifecycle status for this activity item. */
    status: varchar("status", { length: 32 }).default("done").notNull(),

    /** Human summary/title shown in inboxes and timelines. */
    title: varchar("title", { length: 260 }).notNull(),

    /** Optional longer body/detail. */
    body: text("body"),

    /** Optional owner/assignee for execution accountability. */
    ownerUserId: idRef("owner_user_id").references(() => users.id),

    /** Optional due time for planned activities. */
    dueAt: timestamp("due_at", { withTimezone: true }),

    /** Optional completion timestamp for done activities. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Optional duration for calls/meetings. */
    durationMinutes: integer("duration_minutes"),

    /** Optional result classification key. */
    outcomeType: varchar("outcome_type", { length: 80 }),

    /** Arbitrary structured payload for integration/plugin augmentation. */
    payload: jsonb("payload").default({}).notNull(),

    /** Backbone trace links. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),
    domainEventId: idRef("domain_event_id").references(() => domainEvents.id),
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    crmActivitiesBizIdIdUnique: uniqueIndex("crm_activities_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    crmActivitiesCustomerTimelineIdx: index("crm_activities_customer_timeline_idx").on(
      table.bizId,
      table.customerProfileId,
      table.completedAt,
    ),
    crmActivitiesOpportunityIdx: index("crm_activities_opportunity_idx").on(
      table.bizId,
      table.crmOpportunityId,
      table.completedAt,
    ),
    crmActivitiesOwnerStatusIdx: index("crm_activities_owner_status_idx").on(
      table.bizId,
      table.ownerUserId,
      table.status,
      table.dueAt,
    ),
    crmActivitiesDirectionCheck: check(
      "crm_activities_direction_check",
      sql`
      "direction" IN ('inbound', 'outbound', 'internal')
      OR "direction" LIKE 'custom_%'
      `,
    ),
    crmActivitiesStatusCheck: check(
      "crm_activities_status_check",
      sql`
      "status" IN ('planned', 'in_progress', 'done', 'cancelled', 'skipped')
      OR "status" LIKE 'custom_%'
      `,
    ),
  }),
);

/**
 * crm_tasks
 *
 * ELI5:
 * Explicit task backlog for sales/support/customer-success operations.
 */
export const crmTasks = pgTable(
  "crm_tasks",
  {
    id: idWithTag("crm_task"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    customerProfileId: idRef("customer_profile_id").references(() => customerProfiles.id),
    crmContactId: idRef("crm_contact_id").references(() => crmContacts.id),
    crmLeadId: idRef("crm_lead_id").references(() => crmLeads.id),
    crmOpportunityId: idRef("crm_opportunity_id").references(() => crmOpportunities.id),
    supportCaseId: idRef("support_case_id"),

    title: varchar("title", { length: 260 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 32 }).default("open").notNull(),
    priority: varchar("priority", { length: 32 }).default("normal").notNull(),
    assignedUserId: idRef("assigned_user_id").references(() => users.id),
    dueAt: timestamp("due_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    metadata: jsonb("metadata").default({}).notNull(),

    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),
    domainEventId: idRef("domain_event_id").references(() => domainEvents.id),
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    crmTasksBizIdIdUnique: uniqueIndex("crm_tasks_biz_id_id_unique").on(table.bizId, table.id),
    crmTasksAssigneeStatusIdx: index("crm_tasks_assignee_status_idx").on(
      table.bizId,
      table.assignedUserId,
      table.status,
      table.priority,
      table.dueAt,
    ),
    crmTasksCustomerIdx: index("crm_tasks_customer_idx").on(
      table.bizId,
      table.customerProfileId,
      table.status,
    ),
    crmTasksStatusCheck: check(
      "crm_tasks_status_check",
      sql`
      "status" IN ('open', 'in_progress', 'blocked', 'done', 'cancelled')
      OR "status" LIKE 'custom_%'
      `,
    ),
    crmTasksPriorityCheck: check(
      "crm_tasks_priority_check",
      sql`
      "priority" IN ('low', 'normal', 'high', 'urgent')
      OR "priority" LIKE 'custom_%'
      `,
    ),
    crmTasksTimelineCheck: check(
      "crm_tasks_timeline_check",
      sql`
      ("started_at" IS NULL OR "started_at" >= "created_at")
      AND ("completed_at" IS NULL OR "completed_at" >= coalesce("started_at", "created_at"))
      `,
    ),
  }),
);

/**
 * support_cases
 *
 * ELI5:
 * First-class support ticket/case model.
 *
 * Why first-class:
 * - we need support to be as strong as booking/sales, not just chat logs,
 * - SLAs, escalation, and AI-assist workflows need one canonical state object.
 */
export const supportCases = pgTable(
  "support_cases",
  {
    id: idWithTag("support_case"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Primary customer anchor. */
    customerProfileId: idRef("customer_profile_id")
      .references(() => customerProfiles.id)
      .notNull(),

    /** Optional CRM and conversation anchors. */
    crmContactId: idRef("crm_contact_id").references(() => crmContacts.id),
    crmConversationId: idRef("crm_conversation_id").references(() => crmConversations.id),

    /** Optional operational anchors. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),
    paymentTransactionId: idRef("payment_transaction_id").references(
      () => paymentTransactions.id,
    ),

    /** Optional SLA policy anchor for deadline expectations. */
    slaPolicyId: idRef("sla_policy_id").references(() => slaPolicies.id),

    caseType: varchar("case_type", { length: 60 }).notNull(),
    status: varchar("status", { length: 40 }).default("new").notNull(),
    priority: varchar("priority", { length: 24 }).default("normal").notNull(),
    severityLevel: integer("severity_level").default(2).notNull(),
    channelType: varchar("channel_type", { length: 40 }).default("in_app").notNull(),

    title: varchar("title", { length: 260 }).notNull(),
    description: text("description"),

    ownerUserId: idRef("owner_user_id").references(() => users.id),
    assignedUserId: idRef("assigned_user_id").references(() => users.id),
    queueRef: varchar("queue_ref", { length: 160 }),

    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
    firstResponseDueAt: timestamp("first_response_due_at", { withTimezone: true }),
    nextResponseDueAt: timestamp("next_response_due_at", { withTimezone: true }),
    resolutionDueAt: timestamp("resolution_due_at", { withTimezone: true }),
    firstRespondedAt: timestamp("first_responded_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),

    /** Optional quality outcomes. */
    csatScore: integer("csat_score"),
    npsScore: integer("nps_score"),
    resolutionType: varchar("resolution_type", { length: 80 }),
    resolutionSummary: text("resolution_summary"),

    tags: jsonb("tags").default([]).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),

    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),
    domainEventId: idRef("domain_event_id").references(() => domainEvents.id),
    workflowInstanceId: idRef("workflow_instance_id").references(
      () => workflowInstances.id,
    ),
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    supportCasesBizIdIdUnique: uniqueIndex("support_cases_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    supportCasesInboxIdx: index("support_cases_inbox_idx").on(
      table.bizId,
      table.status,
      table.priority,
      table.severityLevel,
      table.nextResponseDueAt,
    ),
    supportCasesAssigneeIdx: index("support_cases_assignee_idx").on(
      table.bizId,
      table.assignedUserId,
      table.status,
      table.priority,
      table.nextResponseDueAt,
    ),
    supportCasesCustomerIdx: index("support_cases_customer_idx").on(
      table.bizId,
      table.customerProfileId,
      table.openedAt,
    ),
    supportCasesSeverityCheck: check(
      "support_cases_severity_check",
      sql`"severity_level" BETWEEN 1 AND 5`,
    ),
    supportCasesStatusCheck: check(
      "support_cases_status_check",
      sql`
      "status" IN ('new', 'open', 'pending_customer', 'pending_internal', 'resolved', 'closed', 'spam', 'archived')
      OR "status" LIKE 'custom_%'
      `,
    ),
    supportCasesPriorityCheck: check(
      "support_cases_priority_check",
      sql`
      "priority" IN ('low', 'normal', 'high', 'urgent')
      OR "priority" LIKE 'custom_%'
      `,
    ),
    supportCasesTimelineCheck: check(
      "support_cases_timeline_check",
      sql`
      ("first_responded_at" IS NULL OR "first_responded_at" >= "opened_at")
      AND ("resolved_at" IS NULL OR "resolved_at" >= "opened_at")
      AND ("closed_at" IS NULL OR "closed_at" >= coalesce("resolved_at", "opened_at"))
      `,
    ),
    supportCasesCsatCheck: check(
      "support_cases_csat_check",
      sql`"csat_score" IS NULL OR "csat_score" BETWEEN 1 AND 5`,
    ),
    supportCasesNpsCheck: check(
      "support_cases_nps_check",
      sql`"nps_score" IS NULL OR "nps_score" BETWEEN -100 AND 100`,
    ),
  }),
);

/**
 * support_case_participants
 *
 * ELI5:
 * Tracks who is involved in a case and in what role.
 */
export const supportCaseParticipants = pgTable(
  "support_case_participants",
  {
    id: idWithTag("support_participant"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    supportCaseId: idRef("support_case_id")
      .references(() => supportCases.id, { onDelete: "cascade" })
      .notNull(),

    participantType: varchar("participant_type", { length: 40 }).notNull(),
    role: varchar("role", { length: 40 }).notNull(),

    userId: idRef("user_id").references(() => users.id),
    customerProfileId: idRef("customer_profile_id").references(() => customerProfiles.id),
    externalRef: varchar("external_ref", { length: 220 }),

    isPrimary: boolean("is_primary").default(false).notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    leftAt: timestamp("left_at", { withTimezone: true }),
    metadata: jsonb("metadata").default({}).notNull(),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    supportCaseParticipantsBizIdIdUnique: uniqueIndex(
      "support_case_participants_biz_id_id_unique",
    ).on(table.bizId, table.id),
    supportCaseParticipantsCaseIdx: index("support_case_participants_case_idx").on(
      table.bizId,
      table.supportCaseId,
      table.role,
      table.isPrimary,
    ),
    supportCaseParticipantsShapeCheck: check(
      "support_case_participants_shape_check",
      sql`
      (
        "participant_type" = 'user'
        AND "user_id" IS NOT NULL
      ) OR (
        "participant_type" = 'customer'
        AND "customer_profile_id" IS NOT NULL
      ) OR (
        "participant_type" IN ('agent', 'integration', 'external')
        AND "external_ref" IS NOT NULL
      ) OR (
        "participant_type" LIKE 'custom_%'
      )
      `,
    ),
    supportCaseParticipantsRoleCheck: check(
      "support_case_participants_role_check",
      sql`
      "role" IN ('requester', 'assignee', 'collaborator', 'watcher', 'bot')
      OR "role" LIKE 'custom_%'
      `,
    ),
    supportCaseParticipantsTimelineCheck: check(
      "support_case_participants_timeline_check",
      sql`"left_at" IS NULL OR "left_at" >= "joined_at"`,
    ),
  }),
);

/**
 * support_case_events
 *
 * ELI5:
 * Immutable-style event ledger for case lifecycle transitions and key actions.
 */
export const supportCaseEvents = pgTable(
  "support_case_events",
  {
    id: idWithTag("support_case_evt"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    supportCaseId: idRef("support_case_id")
      .references(() => supportCases.id, { onDelete: "cascade" })
      .notNull(),

    eventType: varchar("event_type", { length: 80 }).notNull(),
    actorType: varchar("actor_type", { length: 40 }).default("system").notNull(),
    actorUserId: idRef("actor_user_id").references(() => users.id),
    actorCustomerProfileId: idRef("actor_customer_profile_id").references(
      () => customerProfiles.id,
    ),
    actorLabel: varchar("actor_label", { length: 200 }),

    fromStatus: varchar("from_status", { length: 40 }),
    toStatus: varchar("to_status", { length: 40 }),
    note: text("note"),
    payload: jsonb("payload").default({}).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),
    domainEventId: idRef("domain_event_id").references(() => domainEvents.id),
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    supportCaseEventsBizIdIdUnique: uniqueIndex("support_case_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    supportCaseEventsCaseOccurredIdx: index("support_case_events_case_occurred_idx").on(
      table.bizId,
      table.supportCaseId,
      table.occurredAt,
    ),
    supportCaseEventsTypeCheck: check(
      "support_case_events_type_check",
      sql`
      "event_type" IN (
        'created',
        'status_changed',
        'assignment_changed',
        'customer_reply',
        'agent_reply',
        'internal_note',
        'sla_breached',
        'escalated',
        'merged',
        'resolved',
        'reopened',
        'closed'
      ) OR "event_type" LIKE 'custom_%'
      `,
    ),
    supportCaseEventsActorShapeCheck: check(
      "support_case_events_actor_shape_check",
      sql`
      (
        "actor_type" = 'user'
        AND "actor_user_id" IS NOT NULL
      ) OR (
        "actor_type" = 'customer'
        AND "actor_customer_profile_id" IS NOT NULL
      ) OR (
        "actor_type" IN ('agent', 'system', 'integration')
      ) OR (
        "actor_type" LIKE 'custom_%'
      )
      `,
    ),
  }),
);

/**
 * support_case_links
 *
 * ELI5:
 * Generic relationship edges from a support case to other business entities.
 *
 * We intentionally keep this generic so new domains can link into support
 * without schema rewrites.
 */
export const supportCaseLinks = pgTable(
  "support_case_links",
  {
    id: idWithTag("support_case_link"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    supportCaseId: idRef("support_case_id")
      .references(() => supportCases.id, { onDelete: "cascade" })
      .notNull(),
    targetType: varchar("target_type", { length: 80 }).notNull(),
    targetId: idRef("target_id").notNull(),
    relationType: varchar("relation_type", { length: 60 }).default("about").notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    supportCaseLinksBizIdIdUnique: uniqueIndex("support_case_links_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    supportCaseLinksUnique: uniqueIndex("support_case_links_unique").on(
      table.bizId,
      table.supportCaseId,
      table.targetType,
      table.targetId,
      table.relationType,
    ),
    supportCaseLinksTargetIdx: index("support_case_links_target_idx").on(
      table.bizId,
      table.targetType,
      table.targetId,
    ),
  }),
);

/**
 * customer_journeys
 *
 * ELI5:
 * Canonical lifecycle orchestration shell for marketing and customer success.
 */
export const customerJourneys = pgTable(
  "customer_journeys",
  {
    id: idWithTag("customer_journey"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    name: varchar("name", { length: 220 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    status: lifecycleStatusEnum("status").default("active").notNull(),
    journeyType: varchar("journey_type", { length: 60 }).default("lifecycle").notNull(),
    entryPolicy: jsonb("entry_policy").default({}).notNull(),
    exitPolicy: jsonb("exit_policy").default({}).notNull(),
    suppressionPolicy: jsonb("suppression_policy").default({}).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),
    domainEventId: idRef("domain_event_id").references(() => domainEvents.id),
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    customerJourneysBizIdIdUnique: uniqueIndex("customer_journeys_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    customerJourneysBizSlugUnique: uniqueIndex("customer_journeys_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),
    customerJourneysStatusTypeIdx: index("customer_journeys_status_type_idx").on(
      table.bizId,
      table.status,
      table.journeyType,
    ),
  }),
);

/**
 * customer_journey_steps
 *
 * ELI5:
 * One row is one step inside a journey graph.
 */
export const customerJourneySteps = pgTable(
  "customer_journey_steps",
  {
    id: idWithTag("customer_journey_step"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    customerJourneyId: idRef("customer_journey_id")
      .references(() => customerJourneys.id, { onDelete: "cascade" })
      .notNull(),
    stepKey: varchar("step_key", { length: 140 }).notNull(),
    name: varchar("name", { length: 220 }).notNull(),
    status: lifecycleStatusEnum("status").default("active").notNull(),
    stepType: varchar("step_type", { length: 80 }).notNull(),
    sequence: integer("sequence").default(100).notNull(),
    waitDurationMinutes: integer("wait_duration_minutes"),
    channelType: varchar("channel_type", { length: 40 }),
    messageTemplateId: idRef("message_template_id").references(() => messageTemplates.id),
    actionPolicy: jsonb("action_policy").default({}).notNull(),
    successNextStepKey: varchar("success_next_step_key", { length: 140 }),
    failureNextStepKey: varchar("failure_next_step_key", { length: 140 }),
    metadata: jsonb("metadata").default({}).notNull(),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    customerJourneyStepsBizIdIdUnique: uniqueIndex("customer_journey_steps_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    customerJourneyStepsJourneyStepKeyUnique: uniqueIndex(
      "customer_journey_steps_journey_step_key_unique",
    ).on(table.customerJourneyId, table.stepKey),
    customerJourneyStepsJourneySequenceIdx: index("customer_journey_steps_journey_sequence_idx").on(
      table.bizId,
      table.customerJourneyId,
      table.sequence,
    ),
    customerJourneyStepsWaitCheck: check(
      "customer_journey_steps_wait_check",
      sql`"wait_duration_minutes" IS NULL OR "wait_duration_minutes" >= 0`,
    ),
  }),
);

/**
 * customer_journey_enrollments
 *
 * ELI5:
 * A customer currently moving through a journey.
 */
export const customerJourneyEnrollments = pgTable(
  "customer_journey_enrollments",
  {
    id: idWithTag("customer_enrollment"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    customerJourneyId: idRef("customer_journey_id")
      .references(() => customerJourneys.id, { onDelete: "cascade" })
      .notNull(),
    customerProfileId: idRef("customer_profile_id")
      .references(() => customerProfiles.id)
      .notNull(),
    status: varchar("status", { length: 40 }).default("queued").notNull(),
    currentStepId: idRef("current_step_id").references(() => customerJourneySteps.id),
    sourceType: varchar("source_type", { length: 60 }).default("trigger").notNull(),
    sourceRef: varchar("source_ref", { length: 220 }),
    enteredAt: timestamp("entered_at", { withTimezone: true }).defaultNow().notNull(),
    lastStepAt: timestamp("last_step_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    touchCount: integer("touch_count").default(0).notNull(),
    conversionCount: integer("conversion_count").default(0).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),

    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),
    domainEventId: idRef("domain_event_id").references(() => domainEvents.id),
    workflowInstanceId: idRef("workflow_instance_id").references(
      () => workflowInstances.id,
    ),
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    customerJourneyEnrollmentsBizIdIdUnique: uniqueIndex(
      "customer_journey_enrollments_biz_id_id_unique",
    ).on(table.bizId, table.id),
    customerJourneyEnrollmentsActiveUnique: uniqueIndex(
      "customer_journey_enrollments_active_unique",
    )
      .on(table.bizId, table.customerJourneyId, table.customerProfileId)
      .where(sql`"deleted_at" IS NULL AND "status" IN ('queued', 'active', 'paused')`),
    customerJourneyEnrollmentsJourneyStatusIdx: index(
      "customer_journey_enrollments_journey_status_idx",
    ).on(table.bizId, table.customerJourneyId, table.status, table.enteredAt),
    customerJourneyEnrollmentsCustomerStatusIdx: index(
      "customer_journey_enrollments_customer_status_idx",
    ).on(table.bizId, table.customerProfileId, table.status, table.enteredAt),
    customerJourneyEnrollmentsStatusCheck: check(
      "customer_journey_enrollments_status_check",
      sql`
      "status" IN ('queued', 'active', 'paused', 'completed', 'cancelled', 'failed')
      OR "status" LIKE 'custom_%'
      `,
    ),
    customerJourneyEnrollmentsCountsCheck: check(
      "customer_journey_enrollments_counts_check",
      sql`"touch_count" >= 0 AND "conversion_count" >= 0`,
    ),
    customerJourneyEnrollmentsTimelineCheck: check(
      "customer_journey_enrollments_timeline_check",
      sql`"completed_at" IS NULL OR "completed_at" >= "entered_at"`,
    ),
  }),
);

/**
 * customer_journey_events
 *
 * ELI5:
 * Event ledger for one journey enrollment run.
 */
export const customerJourneyEvents = pgTable(
  "customer_journey_events",
  {
    id: idWithTag("customer_journey_evt"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    customerJourneyEnrollmentId: idRef("customer_journey_enrollment_id")
      .references(() => customerJourneyEnrollments.id, { onDelete: "cascade" })
      .notNull(),
    customerJourneyStepId: idRef("customer_journey_step_id").references(
      () => customerJourneySteps.id,
    ),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    outboundMessageId: idRef("outbound_message_id").references(() => outboundMessages.id),
    payload: jsonb("payload").default({}).notNull(),
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),
    domainEventId: idRef("domain_event_id").references(() => domainEvents.id),
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    customerJourneyEventsBizIdIdUnique: uniqueIndex("customer_journey_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    customerJourneyEventsEnrollmentOccurredIdx: index(
      "customer_journey_events_enrollment_occurred_idx",
    ).on(table.bizId, table.customerJourneyEnrollmentId, table.occurredAt),
    customerJourneyEventsTypeCheck: check(
      "customer_journey_events_type_check",
      sql`
      "event_type" IN (
        'enrolled',
        'step_started',
        'step_completed',
        'message_scheduled',
        'message_sent',
        'message_delivered',
        'message_opened',
        'message_clicked',
        'reply_received',
        'converted',
        'paused',
        'resumed',
        'failed',
        'completed',
        'cancelled'
      ) OR "event_type" LIKE 'custom_%'
      `,
    ),
  }),
);

/**
 * customer_playbooks
 *
 * ELI5:
 * This is the "autopilot recipe" table for CRM/support/marketing operations.
 */
export const customerPlaybooks = pgTable(
  "customer_playbooks",
  {
    id: idWithTag("customer_playbook"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    name: varchar("name", { length: 220 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    status: lifecycleStatusEnum("status").default("active").notNull(),
    domain: varchar("domain", { length: 40 }).default("cross_domain").notNull(),
    triggerType: varchar("trigger_type", { length: 40 }).default("event").notNull(),
    triggerConfig: jsonb("trigger_config").default({}).notNull(),
    decisionPolicy: jsonb("decision_policy").default({}).notNull(),
    actionPlan: jsonb("action_plan").default({}).notNull(),
    requiresApproval: boolean("requires_approval").default(true).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),
    domainEventId: idRef("domain_event_id").references(() => domainEvents.id),
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    customerPlaybooksBizIdIdUnique: uniqueIndex("customer_playbooks_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    customerPlaybooksBizSlugUnique: uniqueIndex("customer_playbooks_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),
    customerPlaybooksDomainStatusIdx: index("customer_playbooks_domain_status_idx").on(
      table.bizId,
      table.domain,
      table.status,
    ),
  }),
);

/**
 * customer_playbook_bindings
 *
 * ELI5:
 * Where one playbook is attached to a target scope.
 */
export const customerPlaybookBindings = pgTable(
  "customer_playbook_bindings",
  {
    id: idWithTag("customer_playbook_bind"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    customerPlaybookId: idRef("customer_playbook_id")
      .references(() => customerPlaybooks.id, { onDelete: "cascade" })
      .notNull(),
    targetType: varchar("target_type", { length: 80 }).notNull(),
    targetId: idRef("target_id").notNull(),
    priority: integer("priority").default(100).notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    customerPlaybookBindingsBizIdIdUnique: uniqueIndex(
      "customer_playbook_bindings_biz_id_id_unique",
    ).on(table.bizId, table.id),
    customerPlaybookBindingsUnique: uniqueIndex("customer_playbook_bindings_unique").on(
      table.bizId,
      table.customerPlaybookId,
      table.targetType,
      table.targetId,
    ),
    customerPlaybookBindingsResolverIdx: index("customer_playbook_bindings_resolver_idx").on(
      table.bizId,
      table.targetType,
      table.targetId,
      table.isEnabled,
      table.priority,
    ),
  }),
);

/**
 * customer_playbook_runs
 *
 * ELI5:
 * Runtime execution ledger for one autopilot playbook execution.
 */
export const customerPlaybookRuns = pgTable(
  "customer_playbook_runs",
  {
    id: idWithTag("customer_playbook_run"),
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),
    customerPlaybookId: idRef("customer_playbook_id")
      .references(() => customerPlaybooks.id)
      .notNull(),
    customerProfileId: idRef("customer_profile_id").references(() => customerProfiles.id),
    supportCaseId: idRef("support_case_id").references(() => supportCases.id),
    crmOpportunityId: idRef("crm_opportunity_id").references(() => crmOpportunities.id),
    status: varchar("status", { length: 40 }).default("queued").notNull(),
    requestedByUserId: idRef("requested_by_user_id").references(() => users.id),
    executorType: varchar("executor_type", { length: 40 }).default("agent").notNull(),
    executorRef: varchar("executor_ref", { length: 200 }),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    inputPayload: jsonb("input_payload").default({}).notNull(),
    outputPayload: jsonb("output_payload").default({}).notNull(),
    failureSummary: text("failure_summary"),

    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),
    domainEventId: idRef("domain_event_id").references(() => domainEvents.id),
    workflowInstanceId: idRef("workflow_instance_id").references(
      () => workflowInstances.id,
    ),
    projectionDocumentId: idRef("projection_document_id").references(
      () => projectionDocuments.id,
    ),
    debugSnapshotId: idRef("debug_snapshot_id").references(() => debugSnapshots.id),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    customerPlaybookRunsBizIdIdUnique: uniqueIndex("customer_playbook_runs_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    customerPlaybookRunsPlaybookStatusIdx: index("customer_playbook_runs_playbook_status_idx").on(
      table.bizId,
      table.customerPlaybookId,
      table.status,
      table.startedAt,
    ),
    customerPlaybookRunsCustomerStatusIdx: index("customer_playbook_runs_customer_status_idx").on(
      table.bizId,
      table.customerProfileId,
      table.status,
      table.startedAt,
    ),
    customerPlaybookRunsStatusCheck: check(
      "customer_playbook_runs_status_check",
      sql`
      "status" IN ('queued', 'running', 'waiting_approval', 'completed', 'failed', 'cancelled')
      OR "status" LIKE 'custom_%'
      `,
    ),
    customerPlaybookRunsExecutorTypeCheck: check(
      "customer_playbook_runs_executor_type_check",
      sql`
      "executor_type" IN ('agent', 'human', 'workflow', 'system')
      OR "executor_type" LIKE 'custom_%'
      `,
    ),
    customerPlaybookRunsTimelineCheck: check(
      "customer_playbook_runs_timeline_check",
      sql`"finished_at" IS NULL OR "finished_at" >= "started_at"`,
    ),
  }),
);
