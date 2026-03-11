import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  jsonb,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { users } from "./users";
import { subjects } from "./subjects";
import { actionRequests, actionExecutions } from "./action_backbone";
import { eventProjectionCheckpointStatusEnum } from "./enums";

/**
 * domain_events
 *
 * ELI5:
 * This table stores important business facts that happened.
 *
 * Example:
 * - booking.created
 * - booking.cancelled
 * - payment.failed
 * - member.offboarded
 *
 * These are not just webhook payloads.
 * They are core business facts that power:
 * - automation
 * - integrations
 * - workflows
 * - projections
 * - timelines
 * - debugging
 */
export const domainEvents = pgTable(
  "domain_events",
  {
    id: idWithTag("domain_event"),

    bizId: idRef("biz_id").references(() => bizes.id),

    /** Stable event name understood across the platform. */
    eventKey: varchar("event_key", { length: 180 }).notNull(),

    /** Broad category for filtering. */
    eventFamily: varchar("event_family", { length: 80 }).notNull(),

    /**
     * Subject this event is "about".
     * Example: booking order subject, member subject, payment subject.
     */
    subjectType: varchar("subject_type", { length: 80 }).notNull(),
    subjectId: varchar("subject_id", { length: 140 }).notNull(),

    /** Optional originating action request. */
    actionRequestId: idRef("action_request_id").references(() => actionRequests.id),

    /** Optional originating action execution attempt/phase. */
    actionExecutionId: idRef("action_execution_id").references(() => actionExecutions.id),

    /** Correlation chain support for replay/debugging. */
    correlationId: varchar("correlation_id", { length: 160 }),
    causationId: varchar("causation_id", { length: 160 }),

    /** Who caused this fact, if known. */
    actorType: varchar("actor_type", { length: 40 }),
    actorUserId: idRef("actor_user_id").references(() => users.id),
    actorRef: varchar("actor_ref", { length: 160 }),

    /** Event payload intended for downstream consumers. */
    payload: jsonb("payload").default({}).notNull(),

    /**
     * Small searchable summary for timeline UIs and debugging.
     * Keep this short and human-readable.
     */
    summary: text("summary"),

    /**
     * If true, this event is safe for broad internal subscription.
     * If false, consumers may need stronger policy checks.
     */
    isInternallyVisible: boolean("is_internally_visible").default(true).notNull(),

    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    metadata: jsonb("metadata").default({}).notNull(),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    domainEventsBizIdIdUnique: uniqueIndex("domain_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),

    domainEventsBizOccurredIdx: index("domain_events_biz_occurred_idx").on(
      table.bizId,
      table.occurredAt,
    ),

    domainEventsSubjectIdx: index("domain_events_subject_idx").on(
      table.bizId,
      table.subjectType,
      table.subjectId,
      table.occurredAt,
    ),

    domainEventsFamilyKeyIdx: index("domain_events_family_key_idx").on(
      table.bizId,
      table.eventFamily,
      table.eventKey,
      table.occurredAt,
    ),

    /**
     * Tenant-safe request reference.
     *
     * ELI5:
     * If an event says it came from an action request, both rows must belong to
     * the same biz.
     */
    domainEventsActionRequestTenantFk: foreignKey({
      columns: [table.bizId, table.actionRequestId],
      foreignColumns: [actionRequests.bizId, actionRequests.id],
      name: "domain_events_action_request_tenant_fk",
    }),

    /**
     * Tenant-safe execution reference.
     *
     * Prevents an event in one biz from pointing at an execution row in
     * another biz.
     */
    domainEventsActionExecutionTenantFk: foreignKey({
      columns: [table.bizId, table.actionExecutionId],
      foreignColumns: [actionExecutions.bizId, actionExecutions.id],
      name: "domain_events_action_execution_tenant_fk",
    }),

    domainEventsSubjectFk: foreignKey({
      columns: [table.bizId, table.subjectType, table.subjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "domain_events_subject_fk",
    }),

    domainEventsNonEmptyCheck: check(
      "domain_events_non_empty_check",
      sql`length("event_key") > 0 AND length("event_family") > 0 AND length("subject_type") > 0 AND length("subject_id") > 0`,
    ),
  }),
);

/**
 * event_projection_consumers
 *
 * ELI5:
 * Projections are rebuildable read models.
 * This table stores how far each event-driven projection consumer has processed
 * the domain-event stream.
 *
 * This is intentionally separate from reporting/observability projection
 * checkpoints. This table is the low-level event cursor. The reporting table is
 * the high-level health/lag view humans and agents inspect.
 */
export const eventProjectionCheckpoints = pgTable(
  "event_projection_consumers",
  {
    id: idWithTag("projection_checkpoint"),
    bizId: idRef("biz_id").references(() => bizes.id),

    projectionKey: varchar("projection_key", { length: 160 }).notNull(),
    consumerRef: varchar("consumer_ref", { length: 160 }).notNull(),
    lastDomainEventId: idRef("last_domain_event_id").references(() => domainEvents.id),
    lastProcessedAt: timestamp("last_processed_at", { withTimezone: true }),
    status: eventProjectionCheckpointStatusEnum("status").default("active").notNull(),
    lagHint: integer("lag_hint").default(0).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    eventProjectionCheckpointsBizIdIdUnique: uniqueIndex("event_projection_consumers_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    eventProjectionCheckpointsUnique: uniqueIndex("event_projection_consumers_unique").on(
      table.bizId,
      table.projectionKey,
      table.consumerRef,
    ),

    /**
     * Tenant-safe cursor pointer into the domain-event stream.
     *
     * Ensures one checkpoint cannot accidentally point at another biz's event.
     */
    eventProjectionCheckpointsLastEventTenantFk: foreignKey({
      columns: [table.bizId, table.lastDomainEventId],
      foreignColumns: [domainEvents.bizId, domainEvents.id],
      name: "event_projection_consumers_last_event_tenant_fk",
    }),
  }),
);
