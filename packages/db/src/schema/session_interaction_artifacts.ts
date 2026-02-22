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
import { lifecycleStatusEnum, sessionInteractionVisibilityEnum } from "./enums";
import { sessionInteractionEvents } from "./session_interactions";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * session_interaction_artifacts
 *
 * ELI5:
 * One row = one file/media artifact attached to a specific interaction event.
 *
 * Why this exists:
 * - interaction events hold text/payload and timeline semantics,
 * - artifact rows hold storage metadata and retention/visibility controls,
 * - splitting these keeps both domains clean and scalable.
 */
export const sessionInteractionArtifacts = pgTable(
  "session_interaction_artifacts",
  {
    /** Stable primary key for one interaction artifact row. */
    id: idWithTag("session_interaction_artifact"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent interaction event this artifact belongs to. */
    sessionInteractionEventId: idRef("session_interaction_event_id")
      .references(() => sessionInteractionEvents.id)
      .notNull(),

    /**
     * Artifact media type.
     * Keep flexible with check guard + custom_% extension path.
     */
    artifactType: varchar("artifact_type", { length: 60 }).notNull(),

    /** Artifact lifecycle status (active/archived/deleted workflows). */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Visibility class for API/redaction policy integration. */
    visibility: sessionInteractionVisibilityEnum("visibility")
      .default("public")
      .notNull(),

    /** Optional display label shown in playback/review UIs. */
    label: varchar("label", { length: 240 }),

    /** Storage provider key (s3, gcs, r2, local, custom_%). */
    storageProvider: varchar("storage_provider", { length: 40 }).default("s3").notNull(),

    /** Canonical storage object key/path. */
    storageKey: varchar("storage_key", { length: 1000 }).notNull(),

    /** Optional MIME/content type. */
    contentType: varchar("content_type", { length: 120 }),

    /** Optional object size in bytes. */
    byteSize: integer("byte_size"),

    /** Optional content checksum/hash for integrity checks. */
    checksum: varchar("checksum", { length: 255 }),

    /** Optional actor user who uploaded/attached this artifact. */
    uploadedByUserId: idRef("uploaded_by_user_id").references(() => users.id),

    /** Optional actor subject namespace for plugin/system uploaders. */
    uploadedBySubjectType: varchar("uploaded_by_subject_type", { length: 80 }),

    /** Optional actor subject id for plugin/system uploaders. */
    uploadedBySubjectId: varchar("uploaded_by_subject_id", { length: 140 }),

    /** Artifact creation timestamp from source pipeline. */
    createdAtSource: timestamp("created_at_source", { withTimezone: true }),

    /** Optional retention/expiry timestamp. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** Optional soft-redaction timestamp (artifact hidden but row retained). */
    redactedAt: timestamp("redacted_at", { withTimezone: true }),

    /** Structured artifact metadata (dimensions, duration, OCR hints, etc.). */
    details: jsonb("details").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe external references. */
    sessionInteractionArtifactsBizIdIdUnique: uniqueIndex(
      "session_interaction_artifacts_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Optional uniqueness guard for storage key reuse inside one tenant/provider. */
    sessionInteractionArtifactsBizStorageUnique: uniqueIndex(
      "session_interaction_artifacts_biz_storage_unique",
    ).on(table.bizId, table.storageProvider, table.storageKey),

    /** Main session playback path. */
    sessionInteractionArtifactsBizEventStatusIdx: index(
      "session_interaction_artifacts_biz_event_status_idx",
    ).on(table.bizId, table.sessionInteractionEventId, table.status),

    /** Tenant-safe FK to parent interaction event. */
    sessionInteractionArtifactsBizEventFk: foreignKey({
      columns: [table.bizId, table.sessionInteractionEventId],
      foreignColumns: [sessionInteractionEvents.bizId, sessionInteractionEvents.id],
      name: "session_interaction_artifacts_biz_event_fk",
    }),

    /** Tenant-safe FK to optional uploader subject pointer. */
    sessionInteractionArtifactsBizUploaderSubjectFk: foreignKey({
      columns: [table.bizId, table.uploadedBySubjectType, table.uploadedBySubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "session_interaction_artifacts_biz_uploader_subject_fk",
    }),

    /** Uploader subject pointer should be fully null or fully set. */
    sessionInteractionArtifactsUploaderSubjectPairCheck: check(
      "session_interaction_artifacts_uploader_subject_pair_check",
      sql`
      (
        "uploaded_by_subject_type" IS NULL
        AND "uploaded_by_subject_id" IS NULL
      ) OR (
        "uploaded_by_subject_type" IS NOT NULL
        AND "uploaded_by_subject_id" IS NOT NULL
      )
      `,
    ),

    /** Artifact type vocabulary guard with extension escape hatch. */
    sessionInteractionArtifactsTypeCheck: check(
      "session_interaction_artifacts_type_check",
      sql`
      "artifact_type" IN ('image', 'video', 'audio', 'document', 'transcript', 'whiteboard', 'attachment')
      OR "artifact_type" LIKE 'custom_%'
      `,
    ),

    /** Storage provider vocabulary guard with extension escape hatch. */
    sessionInteractionArtifactsStorageProviderCheck: check(
      "session_interaction_artifacts_storage_provider_check",
      sql`
      "storage_provider" IN ('s3', 'gcs', 'r2', 'local')
      OR "storage_provider" LIKE 'custom_%'
      `,
    ),

    /** Basic bounds/timeline integrity checks. */
    sessionInteractionArtifactsBoundsCheck: check(
      "session_interaction_artifacts_bounds_check",
      sql`
      ("byte_size" IS NULL OR "byte_size" >= 0)
      AND ("expires_at" IS NULL OR "created_at_source" IS NULL OR "expires_at" >= "created_at_source")
      `,
    ),
  }),
);

export type SessionInteractionArtifact = typeof sessionInteractionArtifacts.$inferSelect;
export type NewSessionInteractionArtifact = typeof sessionInteractionArtifacts.$inferInsert;

