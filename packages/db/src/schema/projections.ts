import { check, index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import {
  integer,
  jsonb,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { users } from "./users";

/**
 * projections
 *
 * ELI5:
 * This table is the registry of read models.
 *
 * The canonical core stores truth.
 * Projections store useful, rebuildable views of that truth.
 */
export const projections = pgTable(
  "projections",
  {
    id: idWithTag("projection"),
    bizId: idRef("biz_id").references(() => bizes.id),
    projectionKey: varchar("projection_key", { length: 160 }).notNull(),
    projectionFamily: varchar("projection_family", { length: 80 }).notNull(),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    freshnessPolicy: jsonb("freshness_policy").default({}).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    projectionsBizIdIdUnique: uniqueIndex("projections_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    projectionsUnique: uniqueIndex("projections_unique").on(
      table.bizId,
      table.projectionKey,
    ),
  }),
);

/**
 * projection_documents
 *
 * ELI5:
 * One row = one cached/readable projection document.
 *
 * Examples:
 * - a customer summary
 * - a calendar timeline
 * - a workflow inbox card
 * - an agent planning view
 */
export const projectionDocuments = pgTable(
  "projection_documents",
  {
    id: idWithTag("projection_doc"),
    bizId: idRef("biz_id").references(() => bizes.id),
    projectionId: idRef("projection_id")
      .references(() => projections.id, { onDelete: "cascade" })
      .notNull(),
    documentKey: varchar("document_key", { length: 180 }).notNull(),
    subjectType: varchar("subject_type", { length: 80 }),
    subjectId: varchar("subject_id", { length: 140 }),
    status: varchar("status", { length: 32 }).default("current").notNull(),
    versionNumber: integer("version_number").default(1).notNull(),
    renderedData: jsonb("rendered_data").notNull(),
    staleReason: text("stale_reason"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
    metadata: jsonb("metadata").default({}).notNull(),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    projectionDocumentsBizIdIdUnique: uniqueIndex(
      "projection_documents_biz_id_id_unique",
    ).on(table.bizId, table.id),
    projectionDocumentsUnique: uniqueIndex("projection_documents_unique").on(
      table.projectionId,
      table.documentKey,
    ),
    projectionDocumentsSubjectIdx: index("projection_documents_subject_idx").on(
      table.bizId,
      table.subjectType,
      table.subjectId,
      table.generatedAt,
    ),
    projectionDocumentsVersionCheck: check(
      "projection_documents_version_check",
      sql`"version_number" > 0`,
    ),
  }),
);

/**
 * debug_snapshots
 *
 * ELI5:
 * This table captures structured "what the system saw" snapshots for
 * debugging important failures and test runs.
 *
 * This is not meant to replace logs.
 * It is meant to preserve the useful structured context that humans and agents
 * can inspect later.
 */
export const debugSnapshots = pgTable(
  "debug_snapshots",
  {
    id: idWithTag("debug_snapshot"),
    bizId: idRef("biz_id").references(() => bizes.id),
    snapshotFamily: varchar("snapshot_family", { length: 80 }).notNull(),
    contextRef: varchar("context_ref", { length: 180 }).notNull(),
    severity: varchar("severity", { length: 24 }).default("info").notNull(),
    snapshotData: jsonb("snapshot_data").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
    metadata: jsonb("metadata").default({}).notNull(),

    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    debugSnapshotsBizIdIdUnique: uniqueIndex("debug_snapshots_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    debugSnapshotsContextIdx: index("debug_snapshots_context_idx").on(
      table.snapshotFamily,
      table.contextRef,
      table.capturedAt,
    ),
  }),
);
