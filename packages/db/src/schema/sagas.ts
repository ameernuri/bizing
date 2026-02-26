import { sql } from "drizzle-orm";
import { check, index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import { boolean, integer, jsonb, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { users } from "./users";
import {
  sagaArtifactTypeEnum,
  sagaActorMessageChannelEnum,
  sagaActorMessageStatusEnum,
  sagaDefinitionStatusEnum,
  sagaRunModeEnum,
  sagaRunStatusEnum,
  sagaRunStepStatusEnum,
} from "./enums";

/**
 * saga_definitions
 *
 * ELI5:
 * This table is the "library of test stories".
 * Each row points to one JSON saga spec file in the repository.
 *
 * Why both DB + file:
 * - file gives readable/versioned scenario source controlled in Git,
 * - DB gives fast filtering, status tracking, and API lookups.
 */
export const sagaDefinitions = pgTable(
  "saga_definitions",
  {
    /** Stable primary key for one saga definition row. */
    id: idWithTag("saga_definition"),

    /**
     * Optional tenant scope.
     *
     * Null = platform-wide reusable definition.
     * Non-null = tenant-owned custom definition.
     */
    bizId: idRef("biz_id").references(() => bizes.id),

    /**
     * Stable machine key used by APIs and file naming.
     * Example: `uc-1-solo-consultant-sarah`.
     */
    sagaKey: varchar("saga_key", { length: 160 }).notNull(),

    /** Human-readable title shown in UI and reports. */
    title: varchar("title", { length: 255 }).notNull(),

    /** Long-form summary explaining what this lifecycle validates. */
    description: text("description"),

    /** Definition lifecycle status (draft/active/archived). */
    status: sagaDefinitionStatusEnum("status").default("active").notNull(),

    /**
     * Optional source pointers back to research docs for traceability.
     * Example refs: `UC-1`, `Persona-1`.
     */
    sourceUseCaseRef: varchar("source_use_case_ref", { length: 80 }),
    sourcePersonaRef: varchar("source_persona_ref", { length: 120 }),
    sourceUseCaseFile: varchar("source_use_case_file", { length: 600 }),
    sourcePersonaFile: varchar("source_persona_file", { length: 600 }),

    /** Version label declared by the saga JSON spec schema. */
    specVersion: varchar("spec_version", { length: 40 }).default("v0").notNull(),

    /**
     * Repo-local path to the canonical JSON saga spec file.
     * This keeps API and docs synchronized with real source files.
     */
    specFilePath: varchar("spec_file_path", { length: 700 }).notNull(),

    /** SHA-256 checksum of spec content used for drift detection. */
    specChecksum: varchar("spec_checksum", { length: 128 }).notNull(),

    /** Extensible metadata bucket for indexing tags/grouping labels. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Standard full audit metadata with user FK references. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** One canonical key per environment. */
    sagaDefinitionsSagaKeyUnique: uniqueIndex("saga_definitions_saga_key_unique").on(
      table.sagaKey,
    ),

    /** Common lookup path for active defs by tenant scope. */
    sagaDefinitionsBizStatusIdx: index("saga_definitions_biz_status_idx").on(
      table.bizId,
      table.status,
    ),
  }),
);

/**
 * saga_runs
 *
 * ELI5:
 * One row = one concrete attempt of running one saga definition.
 * If you rerun the same scenario tomorrow, that is a new saga run row.
 */
export const sagaRuns = pgTable(
  "saga_runs",
  {
    /** Stable primary key for one test session. */
    id: idWithTag("saga_run"),

    /** Parent saga definition this run uses. */
    sagaDefinitionId: idRef("saga_definition_id")
      .references(() => sagaDefinitions.id)
      .notNull(),

    /**
     * Denormalized key for easier filtering without join.
     * Mirrors `saga_definitions.saga_key` at run creation time.
     */
    sagaKey: varchar("saga_key", { length: 160 }).notNull(),

    /** Optional tenant scope under which this run was executed. */
    bizId: idRef("biz_id").references(() => bizes.id),

    /** Current session-level execution status. */
    status: sagaRunStatusEnum("status").default("pending").notNull(),

    /** Run mode (safe simulation vs live integration run). */
    mode: sagaRunModeEnum("mode").default("dry_run").notNull(),

    /** Authenticated user that initiated the run. */
    requestedByUserId: idRef("requested_by_user_id")
      .references(() => users.id)
      .notNull(),

    /**
     * Optional label of the runner identity (human name or agent name).
     * Example: `codex-agent-01`.
     */
    runnerLabel: varchar("runner_label", { length: 160 }),

    /** Checksum of definition file at run start for reproducibility. */
    definitionChecksum: varchar("definition_checksum", { length: 128 }),

    /** Clock times for run lifecycle progress. */
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),

    /**
     * Materialized counters for fast UI dashboards without scanning steps.
     */
    totalSteps: integer("total_steps").default(0).notNull(),
    passedSteps: integer("passed_steps").default(0).notNull(),
    failedSteps: integer("failed_steps").default(0).notNull(),
    skippedSteps: integer("skipped_steps").default(0).notNull(),

    /** Structured context passed by runner (tokens, ids, scenario knobs). */
    runContext: jsonb("run_context").default({}).notNull(),

    /** Run summary payload produced at completion (stats/findings). */
    runSummary: jsonb("run_summary").default({}).notNull(),

    /** Extensible metadata for future orchestrators/plugins. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Standard full audit metadata with user FK references. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Fast dashboard filtering by status and recency. */
    sagaRunsStatusCreatedIdx: index("saga_runs_status_created_idx").on(
      table.status,
      table.startedAt,
    ),

    /** Common per-definition run history query path. */
    sagaRunsDefinitionCreatedIdx: index("saga_runs_definition_created_idx").on(
      table.sagaDefinitionId,
      table.startedAt,
    ),

    /** Common "my runs" list path. */
    sagaRunsRequestedByCreatedIdx: index("saga_runs_requested_by_created_idx").on(
      table.requestedByUserId,
      table.startedAt,
    ),

    /** Run counters must never become negative. */
    sagaRunsNonNegativeCountersCheck: check(
      "saga_runs_non_negative_counters_check",
      sql`
        "total_steps" >= 0
        AND "passed_steps" >= 0
        AND "failed_steps" >= 0
        AND "skipped_steps" >= 0
      `,
    ),

    /** Completed run cannot end before it started. */
    sagaRunsTimelineCheck: check(
      "saga_runs_timeline_check",
      sql`"started_at" IS NULL OR "ended_at" IS NULL OR "ended_at" >= "started_at"`,
    ),

    /** Completed counters cannot exceed total steps. */
    sagaRunsCounterBoundsCheck: check(
      "saga_runs_counter_bounds_check",
      sql`
        ("passed_steps" + "failed_steps" + "skipped_steps") <= "total_steps"
      `,
    ),
  }),
);

/**
 * saga_definition_revisions
 *
 * ELI5:
 * This stores saga design snapshots in the DB.
 * File specs can still exist, but DB now has canonical revision history.
 */
export const sagaDefinitionRevisions = pgTable(
  "saga_definition_revisions",
  {
    /** Stable primary key. */
    id: idWithTag("saga_def_rev"),

    /** Parent definition this revision belongs to. */
    sagaDefinitionId: idRef("saga_definition_id")
      .references(() => sagaDefinitions.id, { onDelete: "cascade" })
      .notNull(),

    /** Monotonic revision number for one definition. */
    revisionNumber: integer("revision_number").notNull(),

    /** Spec schema version snapshot. */
    specVersion: varchar("spec_version", { length: 40 }).default("v0").notNull(),

    /** Spec content checksum snapshot. */
    specChecksum: varchar("spec_checksum", { length: 128 }).notNull(),

    /** Full parsed spec JSON snapshot. */
    specJson: jsonb("spec_json").notNull(),

    /** Optional source file path snapshot for traceability. */
    sourceFilePath: varchar("source_file_path", { length: 700 }),

    /** Current revision marker for quick lookup. */
    isCurrent: boolean("is_current").default(true).notNull(),

    /** Metadata bucket for import/source hints. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit columns. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sagaDefinitionRevisionsUnique: uniqueIndex("saga_definition_revisions_unique").on(
      table.sagaDefinitionId,
      table.revisionNumber,
    ),
    sagaDefinitionRevisionsCurrentIdx: index("saga_definition_revisions_current_idx").on(
      table.sagaDefinitionId,
      table.isCurrent,
    ),
    sagaDefinitionRevisionsChecksumIdx: index("saga_definition_revisions_checksum_idx").on(
      table.sagaDefinitionId,
      table.specChecksum,
    ),
    sagaDefinitionRevisionsVersionCheck: check(
      "saga_definition_revisions_version_check",
      sql`"revision_number" >= 1`,
    ),
  }),
);

/**
 * saga_run_steps
 *
 * ELI5:
 * This is the checklist of all steps inside one run.
 * It stores both the instruction and the outcome for each step.
 */
export const sagaRunSteps = pgTable(
  "saga_run_steps",
  {
    /** Stable primary key for one step execution row. */
    id: idWithTag("saga_run_step"),

    /** Parent run this step belongs to. */
    sagaRunId: idRef("saga_run_id")
      .references(() => sagaRuns.id, { onDelete: "cascade" })
      .notNull(),

    /** Phase grouping identity from the saga spec. */
    phaseKey: varchar("phase_key", { length: 160 }).notNull(),
    phaseOrder: integer("phase_order").notNull(),
    phaseTitle: varchar("phase_title", { length: 255 }).notNull(),

    /** Step identity from the saga spec. */
    stepKey: varchar("step_key", { length: 180 }).notNull(),
    stepOrder: integer("step_order").notNull(),

    /** Actor label (biz_owner, customer_1, malicious_user, etc.). */
    actorKey: varchar("actor_key", { length: 120 }).notNull(),

    /** Natural-language instruction this step expects the runner to execute. */
    instruction: text("instruction").notNull(),

    /** What success should look like for this step. */
    expectedResult: text("expected_result"),

    /**
     * Declarative wait mode for this step.
     *
     * ELI5:
     * Some steps need time to pass (for example "wait 30s for notification")
     * or need polling until a condition appears.
     */
    delayMode: varchar("delay_mode", { length: 30 }).default("none").notNull(),

    /** Fixed wait duration when `delay_mode='fixed'`. */
    delayMs: integer("delay_ms"),

    /** Condition key when `delay_mode='until_condition'`. */
    delayConditionKey: varchar("delay_condition_key", { length: 180 }),

    /** Max wait duration for condition-based waits. */
    delayTimeoutMs: integer("delay_timeout_ms"),

    /** Poll interval for condition-based waits. */
    delayPollMs: integer("delay_poll_ms"),

    /** Optional random jitter added around wait/poll timing. */
    delayJitterMs: integer("delay_jitter_ms").default(0).notNull(),

    /** Runtime status for this step. */
    status: sagaRunStepStatusEnum("status").default("pending").notNull(),

    /** Number of retry attempts for this step. */
    attemptCount: integer("attempt_count").default(0).notNull(),

    /** Execution timestamps for detailed timing analytics. */
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),

    /** Optional failure taxonomy/code for structured reporting. */
    failureCode: varchar("failure_code", { length: 120 }),
    failureMessage: text("failure_message"),

    /**
     * Structured output blob from the test agent.
     * Example: endpoint responses, assertion outcomes, references to created ids.
     */
    resultPayload: jsonb("result_payload").default({}).notNull(),

    /** Structured assertion outcomes for this step. */
    assertionSummary: jsonb("assertion_summary").default({}).notNull(),

    /** Extensible metadata for plugins and future workflow enrichments. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Standard full audit metadata with user FK references. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** One logical step key per run (deterministic updates). */
    sagaRunStepsRunStepKeyUnique: uniqueIndex("saga_run_steps_run_step_key_unique").on(
      table.sagaRunId,
      table.stepKey,
    ),

    /** Canonical execution order traversal path for run playback. */
    sagaRunStepsRunPhaseStepIdx: index("saga_run_steps_run_phase_step_idx").on(
      table.sagaRunId,
      table.phaseOrder,
      table.stepOrder,
    ),

    /** Failure triage list path. */
    sagaRunStepsRunStatusIdx: index("saga_run_steps_run_status_idx").on(
      table.sagaRunId,
      table.status,
    ),

    /** Step order fields and retries must be non-negative. */
    sagaRunStepsNonNegativeCheck: check(
      "saga_run_steps_non_negative_check",
      sql`
        "phase_order" >= 0
        AND "step_order" >= 0
        AND "attempt_count" >= 0
        AND "delay_jitter_ms" >= 0
        AND ("delay_ms" IS NULL OR "delay_ms" > 0)
        AND ("delay_timeout_ms" IS NULL OR "delay_timeout_ms" > 0)
        AND ("delay_poll_ms" IS NULL OR "delay_poll_ms" > 0)
      `,
    ),

    /** Completed step cannot end before it started. */
    sagaRunStepsTimelineCheck: check(
      "saga_run_steps_timeline_check",
      sql`"started_at" IS NULL OR "ended_at" IS NULL OR "ended_at" >= "started_at"`,
    ),

    /** Delay payload must match selected delay mode. */
    sagaRunStepsDelayShapeCheck: check(
      "saga_run_steps_delay_shape_check",
      sql`
      (
        "delay_mode" = 'none'
        AND "delay_ms" IS NULL
        AND "delay_condition_key" IS NULL
        AND "delay_timeout_ms" IS NULL
        AND "delay_poll_ms" IS NULL
      ) OR (
        "delay_mode" = 'fixed'
        AND "delay_ms" IS NOT NULL
        AND "delay_condition_key" IS NULL
      ) OR (
        "delay_mode" = 'until_condition'
        AND "delay_ms" IS NULL
        AND "delay_condition_key" IS NOT NULL
      )
      `,
    ),
  }),
);

/**
 * saga_run_artifacts
 *
 * ELI5:
 * A run artifact is saved evidence (report, pseudoshot, trace, attachment)
 * produced while validating one saga run.
 */
export const sagaRunArtifacts = pgTable(
  "saga_run_artifacts",
  {
    /** Stable primary key for one evidence record. */
    id: idWithTag("saga_artifact"),

    /** Parent run. */
    sagaRunId: idRef("saga_run_id")
      .references(() => sagaRuns.id, { onDelete: "cascade" })
      .notNull(),

    /**
     * Optional step anchor.
     * Null means artifact is run-level (for example final report).
     */
    sagaRunStepId: idRef("saga_run_step_id").references(() => sagaRunSteps.id, {
      onDelete: "cascade",
    }),

    /** Evidence category. */
    artifactType: sagaArtifactTypeEnum("artifact_type").notNull(),

    /** Friendly display name for UI and report views. */
    title: varchar("title", { length: 255 }).notNull(),

    /**
     * Repo-local storage path where artifact body is saved.
     * Example: `testing/sagas/runs/saga_run_x/pseudoshots/step-01.json`.
     */
    storagePath: varchar("storage_path", { length: 800 }).notNull(),

    /** MIME/content hint for consumers (application/json, text/markdown, etc.). */
    contentType: varchar("content_type", { length: 120 })
      .default("application/json")
      .notNull(),

    /**
     * DB-cached artifact body.
     *
     * Why store this even though file storage exists:
     * - Makes dashboard reads fast and reliable even when local file path moves.
     * - Keeps most run evidence queryable directly from DB for analytics/reporting.
     * - File path is still retained as backup/export path.
     */
    bodyText: text("body_text"),

    /** Optional byte size for storage/transfer diagnostics. */
    byteSize: integer("byte_size"),

    /** Optional checksum of artifact payload for integrity checks. */
    checksum: varchar("checksum", { length: 128 }),

    /** Logical capture time (defaults to row create time when omitted). */
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),

    /** Extensible metadata for render hints and plugin-owned attributes. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Standard full audit metadata with user FK references. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Common run evidence timeline query path. */
    sagaRunArtifactsRunCapturedIdx: index("saga_run_artifacts_run_captured_idx").on(
      table.sagaRunId,
      table.capturedAt,
    ),

    /** Common run + type filter path. */
    sagaRunArtifactsRunTypeIdx: index("saga_run_artifacts_run_type_idx").on(
      table.sagaRunId,
      table.artifactType,
    ),

    /** Optional per-step artifact filtering path. */
    sagaRunArtifactsRunStepIdx: index("saga_run_artifacts_run_step_idx").on(
      table.sagaRunStepId,
    ),

    /** Byte size must be non-negative when present. */
    sagaRunArtifactsByteSizeCheck: check(
      "saga_run_artifacts_byte_size_check",
      sql`"byte_size" IS NULL OR "byte_size" >= 0`,
    ),
  }),
);

/**
 * saga_run_actor_profiles
 *
 * ELI5:
 * Every actor in a run gets a virtual identity row (email + phone).
 * This lets tests simulate notifications/messages without sending to real users.
 */
export const sagaRunActorProfiles = pgTable(
  "saga_run_actor_profiles",
  {
    /** Stable primary key for one actor identity in one run. */
    id: idWithTag("saga_actor_profile"),

    /** Parent run this actor profile belongs to. */
    sagaRunId: idRef("saga_run_id")
      .references(() => sagaRuns.id, { onDelete: "cascade" })
      .notNull(),

    /** Stable actor key from saga spec (for example `customer_1`). */
    actorKey: varchar("actor_key", { length: 120 }).notNull(),

    /** Human display name from saga actor definition. */
    actorName: varchar("actor_name", { length: 255 }).notNull(),

    /** Actor role from saga actor definition. */
    actorRole: varchar("actor_role", { length: 120 }).notNull(),

    /** Optional persona reference backing this actor. */
    personaRef: varchar("persona_ref", { length: 120 }),

    /** Optional linked auth user created for this actor in the test env. */
    linkedUserId: idRef("linked_user_id").references(() => users.id),

    /** Virtual email inbox for message simulation in this run. */
    virtualEmail: varchar("virtual_email", { length: 255 }).notNull(),

    /** Virtual phone for SMS-style simulation in this run. */
    virtualPhone: varchar("virtual_phone", { length: 40 }).notNull(),

    /** Channel preferences and notification toggles for this actor. */
    channelPreferences: jsonb("channel_preferences").default({}).notNull(),

    /** Extra metadata for runner/plugin-owned state. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit columns. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sagaRunActorProfilesRunActorKeyUnique: uniqueIndex(
      "saga_run_actor_profiles_run_actor_key_unique",
    ).on(table.sagaRunId, table.actorKey),
    sagaRunActorProfilesRunEmailUnique: uniqueIndex(
      "saga_run_actor_profiles_run_email_unique",
    ).on(table.sagaRunId, table.virtualEmail),
    sagaRunActorProfilesRunPhoneUnique: uniqueIndex(
      "saga_run_actor_profiles_run_phone_unique",
    ).on(table.sagaRunId, table.virtualPhone),
    sagaRunActorProfilesRunIdx: index("saga_run_actor_profiles_run_idx").on(table.sagaRunId),
    sagaRunActorProfilesEmailCheck: check(
      "saga_run_actor_profiles_email_check",
      sql`position('@' in "virtual_email") > 1`,
    ),
  }),
);

/**
 * saga_run_actor_messages
 *
 * ELI5:
 * Simulated communications sent between run actors (email/SMS/push/in-app).
 * This becomes auditable proof that notification workflows work.
 */
export const sagaRunActorMessages = pgTable(
  "saga_run_actor_messages",
  {
    /** Stable primary key for one message event. */
    id: idWithTag("saga_actor_msg"),

    /** Parent run this message belongs to. */
    sagaRunId: idRef("saga_run_id")
      .references(() => sagaRuns.id, { onDelete: "cascade" })
      .notNull(),

    /** Optional step that triggered this message. */
    sagaRunStepId: idRef("saga_run_step_id").references(() => sagaRunSteps.id, {
      onDelete: "set null",
    }),

    /** Channel used for this simulated message. */
    channel: sagaActorMessageChannelEnum("channel").notNull(),

    /** Delivery lifecycle status. */
    status: sagaActorMessageStatusEnum("status").default("queued").notNull(),

    /** Optional sender actor profile (null means system-generated). */
    fromActorProfileId: idRef("from_actor_profile_id").references(
      () => sagaRunActorProfiles.id,
      { onDelete: "set null" },
    ),

    /** Required recipient actor profile. */
    toActorProfileId: idRef("to_actor_profile_id")
      .references(() => sagaRunActorProfiles.id, { onDelete: "cascade" })
      .notNull(),

    /** Optional message subject (usually for email/in-app). */
    subject: varchar("subject", { length: 255 }),

    /** Message body payload shown to recipient. */
    bodyText: text("body_text").notNull(),

    /** Optional provider-like ref for idempotency/debugging. */
    providerMessageRef: varchar("provider_message_ref", { length: 180 }),

    /** Delivery timestamps. */
    queuedAt: timestamp("queued_at", { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),

    /** Optional structured error reason on failure. */
    errorMessage: text("error_message"),

    /** Extensible metadata for notification payload/render/debug hints. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit columns. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sagaRunActorMessagesRunStatusIdx: index("saga_run_actor_messages_run_status_idx").on(
      table.sagaRunId,
      table.status,
      table.queuedAt,
    ),
    sagaRunActorMessagesRecipientIdx: index("saga_run_actor_messages_recipient_idx").on(
      table.toActorProfileId,
      table.status,
    ),
    sagaRunActorMessagesRunStepIdx: index("saga_run_actor_messages_run_step_idx").on(
      table.sagaRunStepId,
    ),
    sagaRunActorMessagesTimelineCheck: check(
      "saga_run_actor_messages_timeline_check",
      sql`
      ("sent_at" IS NULL OR "sent_at" >= "queued_at")
      AND ("delivered_at" IS NULL OR "sent_at" IS NULL OR "delivered_at" >= "sent_at")
      AND ("read_at" IS NULL OR "delivered_at" IS NULL OR "read_at" >= "delivered_at")
      AND ("failed_at" IS NULL OR "failed_at" >= "queued_at")
      `,
    ),
  }),
);

/**
 * ---------------------------------------------------------------------------
 * Canonical Lifecycle Loop Library (UC -> Persona -> Saga -> Coverage)
 * ---------------------------------------------------------------------------
 *
 * Why these tables exist:
 * - The project needs one unified dashboard loop, not disconnected markdown files.
 * - UCs, personas, coverage, and tags become first-class DB entities.
 * - Saga definitions/runs can then be mapped to explicit requirement sources.
 *
 * Design principle:
 * - DB is canonical for querying/filtering/workflow state.
 * - Files remain import/export artifacts, not the only source of truth.
 */

/**
 * saga_use_cases
 *
 * ELI5:
 * One row is one named use-case family (for example UC-1).
 * Think of this as the "folder" for use-case versions.
 */
export const sagaUseCases = pgTable(
  "saga_use_cases",
  {
    /** Stable primary key. */
    id: idWithTag("saga_uc"),

    /**
     * Optional tenant owner.
     * Null means platform/global UC.
     */
    bizId: idRef("biz_id").references(() => bizes.id),

    /** Stable UC key (for example `UC-1`). */
    ucKey: varchar("uc_key", { length: 120 }).notNull(),

    /** Human-readable title. */
    title: varchar("title", { length: 255 }).notNull(),

    /** Lifecycle state for library curation. */
    status: sagaDefinitionStatusEnum("status").default("active").notNull(),

    /** Optional markdown/source file pointer. */
    sourceFilePath: varchar("source_file_path", { length: 700 }),

    /** Optional source section reference in file. */
    sourceRef: varchar("source_ref", { length: 200 }),

    /** Optional high-level summary. */
    summary: text("summary"),

    /** Flexible metadata for tags, ownership, and notes. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit columns. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sagaUseCasesUcKeyUnique: uniqueIndex("saga_use_cases_uc_key_unique").on(table.ucKey),
    sagaUseCasesBizStatusIdx: index("saga_use_cases_biz_status_idx").on(table.bizId, table.status),
    sagaUseCasesKeyCheck: check(
      "saga_use_cases_key_check",
      sql`length("uc_key") > 0`,
    ),
  }),
);

/**
 * saga_use_case_versions
 *
 * ELI5:
 * Every edit to a UC can become a new version row so runs can point to exact
 * requirement snapshots they were tested against.
 */
export const sagaUseCaseVersions = pgTable(
  "saga_use_case_versions",
  {
    /** Stable primary key. */
    id: idWithTag("saga_uc_ver"),

    /** Parent use-case family. */
    sagaUseCaseId: idRef("saga_use_case_id")
      .references(() => sagaUseCases.id, { onDelete: "cascade" })
      .notNull(),

    /** Monotonic version number within one UC. */
    versionNumber: integer("version_number").notNull(),

    /** Snapshot title for this version. */
    title: varchar("title", { length: 255 }).notNull(),

    /** Optional short summary for quick table views. */
    summary: text("summary"),

    /** Full markdown body snapshot for this version. */
    bodyMarkdown: text("body_markdown").notNull(),

    /** Structured extracted needs list from parser/importer. */
    extractedNeeds: jsonb("extracted_needs").default([]).notNull(),

    /** Structured extracted scenario narrative from parser/importer. */
    extractedScenario: text("extracted_scenario"),

    /** Content checksum so drift and duplicate versions are detectable. */
    contentChecksum: varchar("content_checksum", { length: 128 }).notNull(),

    /** True when this is the current recommended version. */
    isCurrent: boolean("is_current").default(true).notNull(),

    /** Optional publish timestamp for release tracking. */
    publishedAt: timestamp("published_at", { withTimezone: true }),

    /** Extra metadata for future tooling. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit columns. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sagaUseCaseVersionsUnique: uniqueIndex("saga_use_case_versions_unique").on(
      table.sagaUseCaseId,
      table.versionNumber,
    ),
    sagaUseCaseVersionsCurrentIdx: index("saga_use_case_versions_current_idx").on(
      table.sagaUseCaseId,
      table.isCurrent,
    ),
    sagaUseCaseVersionsVersionCheck: check(
      "saga_use_case_versions_version_check",
      sql`"version_number" >= 1`,
    ),
  }),
);

/**
 * saga_personas
 *
 * ELI5:
 * One row is one persona identity (for example "Solo Entrepreneur Sarah").
 * Version rows store evolving details over time.
 */
export const sagaPersonas = pgTable(
  "saga_personas",
  {
    /** Stable primary key. */
    id: idWithTag("saga_persona"),

    /** Optional tenant owner. Null means platform/global persona. */
    bizId: idRef("biz_id").references(() => bizes.id),

    /** Stable persona key (for example `P-1`). */
    personaKey: varchar("persona_key", { length: 120 }).notNull(),

    /** Display name. */
    name: varchar("name", { length: 255 }).notNull(),

    /** Lifecycle state for library curation. */
    status: sagaDefinitionStatusEnum("status").default("active").notNull(),

    /** Optional markdown/source file pointer. */
    sourceFilePath: varchar("source_file_path", { length: 700 }),

    /** Optional source section reference in file. */
    sourceRef: varchar("source_ref", { length: 200 }),

    /** Quick profile summary for list views. */
    profileSummary: text("profile_summary"),

    /** Flexible metadata for attributes and tags. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit columns. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sagaPersonasPersonaKeyUnique: uniqueIndex("saga_personas_persona_key_unique").on(table.personaKey),
    sagaPersonasBizStatusIdx: index("saga_personas_biz_status_idx").on(table.bizId, table.status),
  }),
);

/**
 * saga_persona_versions
 *
 * ELI5:
 * Persona details can change; this table snapshots each change.
 */
export const sagaPersonaVersions = pgTable(
  "saga_persona_versions",
  {
    /** Stable primary key. */
    id: idWithTag("saga_persona_ver"),

    /** Parent persona family. */
    sagaPersonaId: idRef("saga_persona_id")
      .references(() => sagaPersonas.id, { onDelete: "cascade" })
      .notNull(),

    /** Monotonic version number within one persona. */
    versionNumber: integer("version_number").notNull(),

    /** Snapshot display name for this version. */
    name: varchar("name", { length: 255 }).notNull(),

    /** Snapshot profile text. */
    profile: text("profile"),

    /** Snapshot goals text. */
    goals: text("goals"),

    /** Snapshot pain points text. */
    painPoints: text("pain_points"),

    /** Structured test scenario bullets associated with this persona. */
    testScenarios: jsonb("test_scenarios").default([]).notNull(),

    /** Full markdown body snapshot. */
    bodyMarkdown: text("body_markdown").notNull(),

    /** Content checksum for drift tracking. */
    contentChecksum: varchar("content_checksum", { length: 128 }).notNull(),

    /** True when this is the current recommended version. */
    isCurrent: boolean("is_current").default(true).notNull(),

    /** Optional publish timestamp. */
    publishedAt: timestamp("published_at", { withTimezone: true }),

    /** Extensible metadata bucket. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit columns. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sagaPersonaVersionsUnique: uniqueIndex("saga_persona_versions_unique").on(
      table.sagaPersonaId,
      table.versionNumber,
    ),
    sagaPersonaVersionsCurrentIdx: index("saga_persona_versions_current_idx").on(
      table.sagaPersonaId,
      table.isCurrent,
    ),
    sagaPersonaVersionsVersionCheck: check(
      "saga_persona_versions_version_check",
      sql`"version_number" >= 1`,
    ),
  }),
);

/**
 * saga_definition_links
 *
 * ELI5:
 * This table tells us which UC/persona versions a saga definition
 * is intended to validate.
 */
export const sagaDefinitionLinks = pgTable(
  "saga_definition_links",
  {
    /** Stable primary key. */
    id: idWithTag("saga_def_link"),

    /** Saga definition being mapped. */
    sagaDefinitionId: idRef("saga_definition_id")
      .references(() => sagaDefinitions.id, { onDelete: "cascade" })
      .notNull(),

    /** Optional UC snapshot target. */
    sagaUseCaseVersionId: idRef("saga_use_case_version_id").references(
      () => sagaUseCaseVersions.id,
    ),

    /** Optional persona snapshot target. */
    sagaPersonaVersionId: idRef("saga_persona_version_id").references(
      () => sagaPersonaVersions.id,
    ),

    /**
     * Optional relation role.
     * Example values: `primary`, `secondary`, `negative_test`.
     */
    relationRole: varchar("relation_role", { length: 60 }).default("primary").notNull(),

    /** Optional weighting for coverage rollups (default 1). */
    weight: integer("weight").default(1).notNull(),

    /** Extensible metadata bucket. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit columns. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sagaDefinitionLinksUnique: uniqueIndex("saga_definition_links_unique").on(
      table.sagaDefinitionId,
      table.sagaUseCaseVersionId,
      table.sagaPersonaVersionId,
      table.relationRole,
    ),
    sagaDefinitionLinksDefinitionIdx: index("saga_definition_links_definition_idx").on(
      table.sagaDefinitionId,
    ),
    sagaDefinitionLinksWeightCheck: check(
      "saga_definition_links_weight_check",
      sql`"weight" >= 1`,
    ),
    sagaDefinitionLinksTargetShapeCheck: check(
      "saga_definition_links_target_shape_check",
      sql`
      (
        ("saga_use_case_version_id" IS NOT NULL)::int
        + ("saga_persona_version_id" IS NOT NULL)::int
      ) >= 1
      `,
    ),
  }),
);

/**
 * saga_coverage_reports
 *
 * ELI5:
 * One report row is one structured coverage snapshot for a run or definition.
 * It complements markdown report artifacts with queryable dimensions.
 */
export const sagaCoverageReports = pgTable(
  "saga_coverage_reports",
  {
    /** Stable primary key. */
    id: idWithTag("saga_cov_report"),

    /** Optional tenant scope for multi-tenant filtering. */
    bizId: idRef("biz_id").references(() => bizes.id),

    /** Optional run scope for execution-derived coverage. */
    sagaRunId: idRef("saga_run_id").references(() => sagaRuns.id, {
      onDelete: "cascade",
    }),

    /** Optional definition scope for static/expected coverage. */
    sagaDefinitionId: idRef("saga_definition_id").references(() => sagaDefinitions.id),

    /**
     * Coverage scope classification.
     * Examples: `run`, `definition`, `portfolio`.
     */
    scopeType: varchar("scope_type", { length: 40 }).default("run").notNull(),

    /** Lifecycle state for report publication. */
    status: varchar("status", { length: 30 }).default("published").notNull(),

    /** Optional human-readable title. */
    title: varchar("title", { length: 255 }),

    /** Optional report markdown snapshot for inline viewing. */
    reportMarkdown: text("report_markdown"),

    /** Optional compact summary line. */
    summary: text("summary"),

    /** Rollup percentages for quick dashboard cards. */
    coveragePct: integer("coverage_pct"),
    strongPct: integer("strong_pct"),
    fullPct: integer("full_pct"),

    /** Additional structured report payload for extensions. */
    reportData: jsonb("report_data").default({}).notNull(),

    /** Extensible metadata bucket. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit columns. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sagaCoverageReportsRunUnique: uniqueIndex("saga_coverage_reports_run_unique")
      .on(table.sagaRunId)
      .where(sql`"saga_run_id" IS NOT NULL`),
    sagaCoverageReportsScopeIdx: index("saga_coverage_reports_scope_idx").on(
      table.scopeType,
      table.status,
    ),
    sagaCoverageReportsBizIdx: index("saga_coverage_reports_biz_idx").on(table.bizId),
    sagaCoverageReportsPctCheck: check(
      "saga_coverage_reports_pct_check",
      sql`
      ("coverage_pct" IS NULL OR ("coverage_pct" >= 0 AND "coverage_pct" <= 100))
      AND ("strong_pct" IS NULL OR ("strong_pct" >= 0 AND "strong_pct" <= 100))
      AND ("full_pct" IS NULL OR ("full_pct" >= 0 AND "full_pct" <= 100))
      `,
    ),
  }),
);

/**
 * saga_coverage_items
 *
 * ELI5:
 * One row represents one evaluated requirement item in a coverage report.
 * This is the atomic data used for filters, tags, and trend charts.
 */
export const sagaCoverageItems = pgTable(
  "saga_coverage_items",
  {
    /** Stable primary key. */
    id: idWithTag("saga_cov_item"),

    /** Parent report. */
    sagaCoverageReportId: idRef("saga_coverage_report_id")
      .references(() => sagaCoverageReports.id, { onDelete: "cascade" })
      .notNull(),

    /** Optional run step link when item maps directly to one executed step. */
    sagaRunStepId: idRef("saga_run_step_id").references(() => sagaRunSteps.id),

    /** Requirement item type. */
    itemType: varchar("item_type", { length: 50 }).notNull(),

    /** Stable ref key (for example `UC-1`, `SCENARIO-XYZ`, `stepKey`). */
    itemRefKey: varchar("item_ref_key", { length: 220 }).notNull(),

    /** Optional display title for this item. */
    itemTitle: varchar("item_title", { length: 255 }),

    /**
     * Coverage level verdict.
     * Canonical values used by current docs: full/strong/partial/gap.
     */
    verdict: varchar("verdict", { length: 20 }).notNull(),

    /**
     * Native-to-hacky axis bucket.
     * Canonical values: native/mostly-native/mixed-model/workaround-heavy/hacky.
     */
    nativeToHacky: varchar("native_to_hacky", { length: 40 }),

    /**
     * Core-to-extension axis bucket.
     * Canonical values: core-native/core-first/balanced-core-extension/extension-heavy/extension-driven.
     */
    coreToExtension: varchar("core_to_extension", { length: 50 }),

    /** Optional reason/explanation. */
    explanation: text("explanation"),

    /** Structured evidence payload. */
    evidence: jsonb("evidence").default({}).notNull(),

    /** Free-form metadata for custom scoring dimensions. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit columns. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sagaCoverageItemsReportItemUnique: uniqueIndex("saga_coverage_items_report_item_unique").on(
      table.sagaCoverageReportId,
      table.itemType,
      table.itemRefKey,
    ),
    sagaCoverageItemsVerdictIdx: index("saga_coverage_items_verdict_idx").on(
      table.verdict,
      table.nativeToHacky,
      table.coreToExtension,
    ),
    sagaCoverageItemsReportIdx: index("saga_coverage_items_report_idx").on(
      table.sagaCoverageReportId,
    ),
    sagaCoverageItemsVerdictCheck: check(
      "saga_coverage_items_verdict_check",
      sql`"verdict" IN ('full', 'strong', 'partial', 'gap')`,
    ),
  }),
);

/**
 * saga_tags
 *
 * ELI5:
 * Central tag dictionary for UC/coverage/saga categorization.
 * Example tags: #core-native, #extension-heavy, #hacky, #full.
 */
export const sagaTags = pgTable(
  "saga_tags",
  {
    /** Stable primary key. */
    id: idWithTag("saga_tag"),

    /** Tag key with hash prefix preserved (for example `#core-native`). */
    tagKey: varchar("tag_key", { length: 80 }).notNull(),

    /** Optional display label (defaults to tag key in UI if empty). */
    label: varchar("label", { length: 120 }),

    /** Optional category bucket for filtering panes. */
    category: varchar("category", { length: 60 }),

    /** Optional description/help text. */
    description: text("description"),

    /** Extensible metadata. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit columns. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sagaTagsTagKeyUnique: uniqueIndex("saga_tags_tag_key_unique").on(table.tagKey),
    sagaTagsCategoryIdx: index("saga_tags_category_idx").on(table.category),
    sagaTagsTagFormatCheck: check(
      "saga_tags_tag_format_check",
      sql`"tag_key" ~ '^#[a-z0-9][a-z0-9-_]*$'`,
    ),
  }),
);

/**
 * saga_tag_bindings
 *
 * ELI5:
 * Generic polymorphic tag mapping so one tag system can annotate all loop
 * entities (UCs, personas, saga defs, reports, coverage items).
 */
export const sagaTagBindings = pgTable(
  "saga_tag_bindings",
  {
    /** Stable primary key. */
    id: idWithTag("saga_tag_bind"),

    /** Tag dictionary row. */
    sagaTagId: idRef("saga_tag_id")
      .references(() => sagaTags.id, { onDelete: "cascade" })
      .notNull(),

    /** Target type this tag is attached to. */
    targetType: varchar("target_type", { length: 60 }).notNull(),

    /** Target id (polymorphic reference). */
    targetId: idRef("target_id").notNull(),

    /** Optional notes for why this tag was applied. */
    note: text("note"),

    /** Extra metadata. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit columns. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    sagaTagBindingsUnique: uniqueIndex("saga_tag_bindings_unique").on(
      table.sagaTagId,
      table.targetType,
      table.targetId,
    ),
    sagaTagBindingsTargetIdx: index("saga_tag_bindings_target_idx").on(
      table.targetType,
      table.targetId,
    ),
    sagaTagBindingsTargetTypeCheck: check(
      "saga_tag_bindings_target_type_check",
      sql`
      "target_type" IN (
        'use_case',
        'use_case_version',
        'persona',
        'persona_version',
        'saga_definition',
        'saga_run',
        'coverage_report',
        'coverage_item'
      )
      `,
    ),
  }),
);
