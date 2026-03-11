import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { users } from "./users";

/**
 * knowledge_source_type
 *
 * ELI5:
 * This says where the knowledge came from.
 * Example: git docs, mind notes, saga runs, API contract snapshots.
 */
export const knowledgeSourceTypeEnum = pgEnum("knowledge_source_type", [
  "git",
  "docs",
  "mind",
  "ooda",
  "saga_run",
  "api_contract",
  "decision_log",
  "chat",
  "other",
]);

/**
 * knowledge_source_status
 *
 * ELI5:
 * A source can be active, temporarily paused, or retired.
 */
export const knowledgeSourceStatusEnum = pgEnum("knowledge_source_status", [
  "active",
  "paused",
  "archived",
]);

/**
 * knowledge_document_status
 *
 * ELI5:
 * Documents are versioned. A row can be currently active, superseded by a newer
 * version, or archived.
 */
export const knowledgeDocumentStatusEnum = pgEnum("knowledge_document_status", [
  "active",
  "superseded",
  "archived",
]);

/**
 * knowledge_chunk_status
 *
 * ELI5:
 * Chunks are pieces of a document used for retrieval. We keep status so old
 * chunks can be retired safely without deleting historical rows.
 */
export const knowledgeChunkStatusEnum = pgEnum("knowledge_chunk_status", [
  "active",
  "archived",
]);

/**
 * knowledge_embedding_status
 *
 * ELI5:
 * Embedding jobs can be pending, ready, or failed.
 */
export const knowledgeEmbeddingStatusEnum = pgEnum("knowledge_embedding_status", [
  "pending",
  "ready",
  "failed",
]);

/**
 * knowledge_edge_type
 *
 * ELI5:
 * Edges connect knowledge documents so retrieval can follow relationships,
 * not only keyword/vector similarity.
 */
export const knowledgeEdgeTypeEnum = pgEnum("knowledge_edge_type", [
  "wikilink",
  "refers_to",
  "derived_from",
  "depends_on",
  "supersedes",
  "related",
]);

/**
 * knowledge_event_type
 *
 * ELI5:
 * Events are append-only operational facts about the memory pipeline:
 * ingest, reindex, query, checkpoint updates, and agent-run writes.
 */
export const knowledgeEventTypeEnum = pgEnum("knowledge_event_type", [
  "ingest",
  "reindex",
  "query",
  "checkpoint",
  "agent_run",
  "sync",
]);

/**
 * knowledge_event_status
 *
 * ELI5:
 * Tracks whether one operation is queued/running/succeeded/failed.
 */
export const knowledgeEventStatusEnum = pgEnum("knowledge_event_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
]);

/**
 * knowledge_agent_kind
 *
 * ELI5:
 * Which actor produced a run summary or cursor update.
 */
export const knowledgeAgentKindEnum = pgEnum("knowledge_agent_kind", [
  "codex",
  "openclaw",
  "bizing_agent",
  "human",
  "system",
]);

/**
 * knowledge_agent_run_status
 *
 * ELI5:
 * Lifecycle for one structured agent run report.
 */
export const knowledgeAgentRunStatusEnum = pgEnum("knowledge_agent_run_status", [
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

/**
 * knowledge_checkpoint_status
 *
 * ELI5:
 * Health state for each agent checkpoint cursor.
 */
export const knowledgeCheckpointStatusEnum = pgEnum("knowledge_checkpoint_status", [
  "healthy",
  "stale",
  "failed",
]);

/**
 * knowledge_retrieval_mode
 *
 * ELI5:
 * How retrieval was performed for one query trace.
 */
export const knowledgeRetrievalModeEnum = pgEnum("knowledge_retrieval_mode", [
  "keyword",
  "semantic",
  "hybrid",
  "graph",
]);

/**
 * knowledge_sources
 *
 * ELI5:
 * One row = one source stream that can continuously feed the shared memory
 * plane. This is the root object for ingest configuration.
 */
export const knowledgeSources = pgTable(
  "knowledge_sources",
  {
    /** Stable primary key for one source definition. */
    id: idWithTag("knowledge_source"),

    /**
     * Optional tenant scope.
     *
     * Null means global/platform source.
     */
    bizId: idRef("biz_id").references(() => bizes.id),

    /** Machine-friendly key used by sync workers. */
    sourceKey: varchar("source_key", { length: 200 }).notNull(),

    /** Human-readable source label for dashboards/debugging. */
    displayName: varchar("display_name", { length: 255 }).notNull(),

    /** Source family (git/docs/mind/ooda/etc). */
    sourceType: knowledgeSourceTypeEnum("source_type").default("other").notNull(),

    /** Local filesystem root used by ingestion workers when applicable. */
    basePath: varchar("base_path", { length: 1000 }),

    /** Network URI root when source is remote/API-based. */
    baseUri: varchar("base_uri", { length: 1000 }),

    /** Git repo URL/path (if source_type = git). */
    gitRepo: varchar("git_repo", { length: 800 }),

    /** Git branch tracked by this source. */
    gitBranch: varchar("git_branch", { length: 255 }),

    /** Latest commit SHA observed during sync. */
    latestCommitSha: varchar("latest_commit_sha", { length: 120 }),

    /** Last source-updated timestamp observed by ingestion. */
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),

    /** Operational status for this source. */
    status: knowledgeSourceStatusEnum("status").default("active").notNull(),

    /** Source-level extra config and flags. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit columns with actor references. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /**
     * Source keys are unique within one scope:
     * - global rows (`biz_id IS NULL`) share one keyspace
     * - tenant rows (`biz_id IS NOT NULL`) are unique per biz
     */
    knowledgeSourcesGlobalSourceKeyUnique: uniqueIndex(
      "knowledge_sources_global_source_key_unique",
    )
      .on(table.sourceKey)
      .where(sql`"biz_id" IS NULL`),
    knowledgeSourcesBizSourceKeyUnique: uniqueIndex("knowledge_sources_biz_source_key_unique")
      .on(table.bizId, table.sourceKey)
      .where(sql`"biz_id" IS NOT NULL`),
    knowledgeSourcesBizTypeStatusIdx: index("knowledge_sources_biz_type_status_idx").on(
      table.bizId,
      table.sourceType,
      table.status,
    ),
  }),
);

/**
 * knowledge_documents
 *
 * ELI5:
 * One row = one version of one logical document from one source.
 * This is the durable, auditable text record before chunking.
 */
export const knowledgeDocuments = pgTable(
  "knowledge_documents",
  {
    /** Stable primary key for one document version row. */
    id: idWithTag("knowledge_document"),

    /** Optional tenant scope for row-level ownership and filtering. */
    bizId: idRef("biz_id").references(() => bizes.id),

    /** Parent source that produced this document. */
    sourceId: idRef("source_id")
      .references(() => knowledgeSources.id)
      .notNull(),

    /**
     * Logical key for "same document across versions".
     * Example: docs/API.md or mind/workspace/principles-and-philosophy.md.
     */
    documentKey: varchar("document_key", { length: 260 }).notNull(),

    /** Human-readable title extracted from the source. */
    title: varchar("title", { length: 255 }).notNull(),

    /** Full canonical text body used for chunking + retrieval + replay. */
    contentText: text("content_text").notNull(),

    /** Hash of full content for idempotent ingest writes. */
    contentHash: varchar("content_hash", { length: 128 }).notNull(),

    /** Optional semantic version/tag from ingestion metadata. */
    versionLabel: varchar("version_label", { length: 80 }).default("v1").notNull(),

    /** MIME type for rendering/downstream parsers. */
    mimeType: varchar("mime_type", { length: 120 }).default("text/markdown").notNull(),

    /** Approximate token count used for chunk planning. */
    tokenEstimate: integer("token_estimate").default(0).notNull(),

    /** Approximate word count useful for dashboards. */
    wordCount: integer("word_count").default(0).notNull(),

    /** Original source-local path, if available. */
    sourcePath: varchar("source_path", { length: 1000 }),

    /** Original URI, if available. */
    sourceUri: varchar("source_uri", { length: 1000 }),

    /** Last upstream modification timestamp known for this document. */
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),

    /** Timestamp when this row was ingested into the knowledge plane. */
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),

    /** Lifecycle status for this document version. */
    status: knowledgeDocumentStatusEnum("status").default("active").notNull(),

    /** Additional ingest metadata (commit SHA, parser info, etc). */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit columns with actor references. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    knowledgeDocumentsSourceKeyHashUnique: uniqueIndex(
      "knowledge_documents_source_key_hash_unique",
    ).on(table.sourceId, table.documentKey, table.contentHash),
    knowledgeDocumentsBizSourceStatusIdx: index("knowledge_documents_biz_source_status_idx").on(
      table.bizId,
      table.sourceId,
      table.status,
    ),
    knowledgeDocumentsUpdatedIdx: index("knowledge_documents_updated_idx").on(
      table.sourceUpdatedAt,
      table.ingestedAt,
    ),
    knowledgeDocumentsNonNegativeCountsCheck: check(
      "knowledge_documents_non_negative_counts_check",
      sql`"token_estimate" >= 0 AND "word_count" >= 0`,
    ),
  }),
);

/**
 * knowledge_chunks
 *
 * ELI5:
 * One row = one chunk of a document, used for retrieval scoring and context
 * assembly.
 */
export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    /** Stable primary key for one chunk row. */
    id: idWithTag("knowledge_chunk"),

    /** Optional tenant scope for ownership/filtering. */
    bizId: idRef("biz_id").references(() => bizes.id),

    /** Parent source for easier source-level filtering. */
    sourceId: idRef("source_id")
      .references(() => knowledgeSources.id)
      .notNull(),

    /** Parent document version this chunk belongs to. */
    documentId: idRef("document_id")
      .references(() => knowledgeDocuments.id)
      .notNull(),

    /** Sequence index of this chunk inside the parent document. */
    chunkIndex: integer("chunk_index").notNull(),

    /** Chunk body used for retrieval/context assembly. */
    chunkText: text("chunk_text").notNull(),

    /** Chunk-level hash for idempotent chunk pipelines. */
    chunkHash: varchar("chunk_hash", { length: 128 }).notNull(),

    /** Approximate token count for this chunk. */
    tokenEstimate: integer("token_estimate").default(0).notNull(),

    /** Character range start offset in parent document text. */
    charStart: integer("char_start"),

    /** Character range end offset in parent document text. */
    charEnd: integer("char_end"),

    /** Chunk lifecycle status. */
    status: knowledgeChunkStatusEnum("status").default("active").notNull(),

    /** Chunk-level metadata (section path, heading chain, parser info). */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit columns with actor references. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    knowledgeChunksDocumentChunkVersionUnique: uniqueIndex(
      "knowledge_chunks_document_chunk_version_unique",
    ).on(table.documentId, table.chunkIndex, table.chunkHash),
    knowledgeChunksSourceDocIdx: index("knowledge_chunks_source_doc_idx").on(
      table.sourceId,
      table.documentId,
    ),
    knowledgeChunksBizStatusIdx: index("knowledge_chunks_biz_status_idx").on(
      table.bizId,
      table.status,
    ),
    knowledgeChunksOffsetsCheck: check(
      "knowledge_chunks_offsets_check",
      sql`
        (
          "char_start" IS NULL
          OR "char_end" IS NULL
          OR ("char_start" >= 0 AND "char_end" >= "char_start")
        )
        AND "token_estimate" >= 0
      `,
    ),
  }),
);

/**
 * knowledge_embeddings
 *
 * ELI5:
 * One row = one embedding vector for one chunk under one model.
 *
 * Important:
 * We store embedding arrays in JSON to keep v0 deploy friction low even when
 * pgvector extension is not installed yet. The API can still do cosine scoring
 * in application code, and we can hard-cut to native pgvector later.
 */
export const knowledgeEmbeddings = pgTable(
  "knowledge_embeddings",
  {
    /** Stable primary key for one embedding row. */
    id: idWithTag("knowledge_embedding"),

    /** Optional tenant scope for ownership/filtering. */
    bizId: idRef("biz_id").references(() => bizes.id),

    /** Parent source for traceability. */
    sourceId: idRef("source_id")
      .references(() => knowledgeSources.id)
      .notNull(),

    /** Parent document for traceability. */
    documentId: idRef("document_id")
      .references(() => knowledgeDocuments.id)
      .notNull(),

    /** Parent chunk this embedding represents. */
    chunkId: idRef("chunk_id")
      .references(() => knowledgeChunks.id)
      .notNull(),

    /** Provider label (openai/ollama/etc). */
    provider: varchar("provider", { length: 80 }).notNull(),

    /** Model label used for this embedding row. */
    model: varchar("model", { length: 160 }).notNull(),

    /** Embedding dimension count. */
    dimensions: integer("dimensions").notNull(),

    /** Embedding vector payload (float array stored as JSON). */
    embedding: jsonb("embedding").notNull(),

    /** Optional content hash of the embedding payload for dedupe/debug. */
    embeddingHash: varchar("embedding_hash", { length: 128 }),

    /** Embedding generation status. */
    status: knowledgeEmbeddingStatusEnum("status").default("ready").notNull(),

    /** Error detail for failed generation attempts. */
    errorMessage: text("error_message"),

    /** Time when embedding was computed/refreshed. */
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),

    /** Extensible metadata for model/provider configs. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit columns with actor references. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    knowledgeEmbeddingsChunkProviderModelUnique: uniqueIndex(
      "knowledge_embeddings_chunk_provider_model_unique",
    ).on(table.chunkId, table.provider, table.model),
    knowledgeEmbeddingsBizDocIdx: index("knowledge_embeddings_biz_doc_idx").on(
      table.bizId,
      table.documentId,
    ),
    knowledgeEmbeddingsStatusComputedIdx: index("knowledge_embeddings_status_computed_idx").on(
      table.status,
      table.computedAt,
    ),
    knowledgeEmbeddingsDimensionsCheck: check(
      "knowledge_embeddings_dimensions_check",
      sql`"dimensions" > 0`,
    ),
  }),
);

/**
 * knowledge_edges
 *
 * ELI5:
 * Relationship graph between documents so retrieval can traverse references.
 */
export const knowledgeEdges = pgTable(
  "knowledge_edges",
  {
    /** Stable primary key for one graph edge row. */
    id: idWithTag("knowledge_edge"),

    /** Optional tenant scope for ownership/filtering. */
    bizId: idRef("biz_id").references(() => bizes.id),

    /** Source-side document for this edge. */
    fromDocumentId: idRef("from_document_id")
      .references(() => knowledgeDocuments.id)
      .notNull(),

    /** Target-side document for this edge. */
    toDocumentId: idRef("to_document_id")
      .references(() => knowledgeDocuments.id)
      .notNull(),

    /** Edge semantics. */
    edgeType: knowledgeEdgeTypeEnum("edge_type").default("related").notNull(),

    /**
     * Relative confidence/weight in basis points.
     * Example: 10000 = 100%.
     */
    weightBps: integer("weight_bps").default(10000).notNull(),

    /** Additional relation metadata (anchor text, parser info, etc). */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit columns with actor references. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    knowledgeEdgesUnique: uniqueIndex("knowledge_edges_unique").on(
      table.fromDocumentId,
      table.toDocumentId,
      table.edgeType,
    ),
    knowledgeEdgesBizTypeIdx: index("knowledge_edges_biz_type_idx").on(
      table.bizId,
      table.edgeType,
    ),
    knowledgeEdgesWeightCheck: check(
      "knowledge_edges_weight_check",
      sql`"weight_bps" >= 0 AND "weight_bps" <= 10000`,
    ),
  }),
);

/**
 * knowledge_agent_runs
 *
 * ELI5:
 * One row = one structured execution report emitted by an agent (Codex,
 * OpenClaw, Bizing-internal agent, etc).
 */
export const knowledgeAgentRuns = pgTable(
  "knowledge_agent_runs",
  {
    /** Stable primary key for one agent run report. */
    id: idWithTag("knowledge_agent_run"),

    /** Optional tenant scope. */
    bizId: idRef("biz_id").references(() => bizes.id),

    /** Which class of actor emitted this run row. */
    agentKind: knowledgeAgentKindEnum("agent_kind").default("system").notNull(),

    /** Actor runtime label (for example `openclaw-main`). */
    agentName: varchar("agent_name", { length: 160 }).notNull(),

    /** Optional caller-provided run key for idempotent writes. */
    runKey: varchar("run_key", { length: 220 }),

    /** Main objective the run attempted to complete. */
    objective: text("objective").notNull(),

    /** Input/context summary used by the actor. */
    inputSummary: text("input_summary"),

    /** Final output summary from this run. */
    outputSummary: text("output_summary"),

    /** Structured decisions list for replay and audit. */
    decisions: jsonb("decisions").default([]).notNull(),

    /** Structured unresolved items to hand off across agents. */
    unresolvedItems: jsonb("unresolved_items").default([]).notNull(),

    /** Cursor marker used by this run against the knowledge event stream. */
    knowledgeCursor: varchar("knowledge_cursor", { length: 220 }),

    /** Lifecycle status for this run report. */
    status: knowledgeAgentRunStatusEnum("status").default("running").notNull(),

    /** Run lifecycle timestamps. */
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),

    /** Additional metadata bucket. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit columns with actor references. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    knowledgeAgentRunsRunKeyUnique: uniqueIndex("knowledge_agent_runs_run_key_unique").on(
      table.runKey,
    ),
    knowledgeAgentRunsAgentStatusIdx: index("knowledge_agent_runs_agent_status_idx").on(
      table.agentKind,
      table.agentName,
      table.status,
    ),
    knowledgeAgentRunsBizStartedIdx: index("knowledge_agent_runs_biz_started_idx").on(
      table.bizId,
      table.startedAt,
    ),
    knowledgeAgentRunsTimelineCheck: check(
      "knowledge_agent_runs_timeline_check",
      sql`"ended_at" IS NULL OR "ended_at" >= "started_at"`,
    ),
  }),
);

/**
 * knowledge_retrieval_traces
 *
 * ELI5:
 * One row captures exactly how a query was answered, including result ids and
 * scores. This makes retrieval behavior auditable and debuggable.
 */
export const knowledgeRetrievalTraces = pgTable(
  "knowledge_retrieval_traces",
  {
    /** Stable primary key for one retrieval trace row. */
    id: idWithTag("knowledge_retrieval_trace"),

    /** Optional tenant scope for row-level ownership. */
    bizId: idRef("biz_id").references(() => bizes.id),

    /** Optional link to one agent run report. */
    agentRunId: idRef("agent_run_id").references(() => knowledgeAgentRuns.id),

    /** Raw query text submitted by caller. */
    queryText: text("query_text").notNull(),

    /** Retrieval strategy used for this trace. */
    mode: knowledgeRetrievalModeEnum("mode").default("hybrid").notNull(),

    /** Scope filters applied by the query runtime. */
    scope: jsonb("scope").default({}).notNull(),

    /** Ordered result document ids returned by retrieval. */
    resultDocumentIds: jsonb("result_document_ids").default([]).notNull(),

    /** Ordered result chunk ids returned by retrieval. */
    resultChunkIds: jsonb("result_chunk_ids").default([]).notNull(),

    /** Ordered numeric scores for result ranking. */
    resultScores: jsonb("result_scores").default([]).notNull(),

    /** Top score normalized to basis points for compact reporting. */
    topScoreBps: integer("top_score_bps"),

    /** Query model metadata for reproducibility. */
    modelProvider: varchar("model_provider", { length: 80 }),
    model: varchar("model", { length: 160 }),

    /** End-to-end retrieval latency in milliseconds. */
    latencyMs: integer("latency_ms"),

    /** Extra debug details from retrieval execution. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Timestamp of this retrieval operation. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Full audit columns with actor references. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    knowledgeRetrievalTracesAgentOccurredIdx: index(
      "knowledge_retrieval_traces_agent_occurred_idx",
    ).on(table.agentRunId, table.occurredAt),
    knowledgeRetrievalTracesBizOccurredIdx: index(
      "knowledge_retrieval_traces_biz_occurred_idx",
    ).on(table.bizId, table.occurredAt),
    knowledgeRetrievalTracesScoresCheck: check(
      "knowledge_retrieval_traces_scores_check",
      sql`
        (
          "top_score_bps" IS NULL
          OR ("top_score_bps" >= 0 AND "top_score_bps" <= 10000)
        )
        AND ("latency_ms" IS NULL OR "latency_ms" >= 0)
      `,
    ),
  }),
);

/**
 * knowledge_events
 *
 * ELI5:
 * Append-only event log for the knowledge plane. This is the source for
 * cursor checkpoints and sync drift detection.
 */
export const knowledgeEvents = pgTable(
  "knowledge_events",
  {
    /** Stable primary key for one event row. */
    id: idWithTag("knowledge_event"),

    /** Optional tenant scope. */
    bizId: idRef("biz_id").references(() => bizes.id),

    /** Optional source link for event provenance. */
    sourceId: idRef("source_id").references(() => knowledgeSources.id),

    /** Optional document link for event provenance. */
    documentId: idRef("document_id").references(() => knowledgeDocuments.id),

    /** Optional chunk link for event provenance. */
    chunkId: idRef("chunk_id").references(() => knowledgeChunks.id),

    /** Optional agent-run link for event provenance. */
    agentRunId: idRef("agent_run_id").references(() => knowledgeAgentRuns.id),

    /** Event family label. */
    eventType: knowledgeEventTypeEnum("event_type").notNull(),

    /** Event processing status. */
    status: knowledgeEventStatusEnum("status").default("queued").notNull(),

    /** Human-readable event message. */
    message: text("message"),

    /** Input payload for this event. */
    payload: jsonb("payload").default({}).notNull(),

    /** Output/result payload for this event. */
    result: jsonb("result").default({}).notNull(),

    /** Event time (logical occurrence). */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),

    /** Full audit columns with actor references. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    knowledgeEventsTypeOccurredIdx: index("knowledge_events_type_occurred_idx").on(
      table.eventType,
      table.occurredAt,
    ),
    knowledgeEventsBizOccurredIdx: index("knowledge_events_biz_occurred_idx").on(
      table.bizId,
      table.occurredAt,
    ),
  }),
);

/**
 * knowledge_checkpoints
 *
 * ELI5:
 * One row tracks where an agent is in the shared knowledge stream.
 * This is how Codex/OpenClaw can verify they are in sync.
 */
export const knowledgeCheckpoints = pgTable(
  "knowledge_checkpoints",
  {
    /** Stable primary key for one checkpoint row. */
    id: idWithTag("knowledge_checkpoint"),

    /** Optional tenant scope for tenant-specific cursors. */
    bizId: idRef("biz_id").references(() => bizes.id),

    /** Agent family for this checkpoint. */
    agentKind: knowledgeAgentKindEnum("agent_kind").notNull(),

    /** Agent runtime label, for example `openclaw-main`. */
    agentName: varchar("agent_name", { length: 160 }).notNull(),

    /**
     * Optional sub-stream key.
     * Example: `global`, `schema-sync`, `ooda-sync`.
     */
    checkpointKey: varchar("checkpoint_key", { length: 120 }).default("global").notNull(),

    /** Last applied knowledge event id for this cursor. */
    lastKnowledgeEventId: idRef("last_knowledge_event_id").references(() => knowledgeEvents.id),

    /** Last commit SHA observed by this agent checkpoint. */
    lastCommitSha: varchar("last_commit_sha", { length: 120 }),

    /** Last document hash observed/applied by this checkpoint. */
    lastDocumentHash: varchar("last_document_hash", { length: 128 }),

    /** Last successful ingest timestamp seen by this cursor. */
    lastIngestedAt: timestamp("last_ingested_at", { withTimezone: true }),

    /** Last observed heartbeat for this checkpoint. */
    lastObservedAt: timestamp("last_observed_at", { withTimezone: true }).defaultNow().notNull(),

    /** Checkpoint health status. */
    status: knowledgeCheckpointStatusEnum("status").default("healthy").notNull(),

    /** Extra checkpoint metadata. */
    metadata: jsonb("metadata").default({}).notNull(),

    /** Full audit columns with actor references. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /**
     * Checkpoints are unique per scope:
     * - global checkpoints by (agent_kind, agent_name, checkpoint_key)
     * - tenant checkpoints by (biz_id, agent_kind, agent_name, checkpoint_key)
     */
    knowledgeCheckpointsGlobalAgentKeyUnique: uniqueIndex(
      "knowledge_checkpoints_global_agent_key_unique",
    )
      .on(table.agentKind, table.agentName, table.checkpointKey)
      .where(sql`"biz_id" IS NULL`),
    knowledgeCheckpointsBizAgentKeyUnique: uniqueIndex(
      "knowledge_checkpoints_biz_agent_key_unique",
    )
      .on(table.bizId, table.agentKind, table.agentName, table.checkpointKey)
      .where(sql`"biz_id" IS NOT NULL`),
    knowledgeCheckpointsBizObservedIdx: index("knowledge_checkpoints_biz_observed_idx").on(
      table.bizId,
      table.lastObservedAt,
    ),
  }),
);
