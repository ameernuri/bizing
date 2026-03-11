/**
 * Canonical knowledge-plane routes.
 *
 * Why this route family exists:
 * - gives Codex/OpenClaw/Bizing agents one shared memory API
 * - stores ingest history, chunk/embedding state, retrieval traces, and
 *   agent checkpoints in one auditable place
 * - enables "are both agents in sync?" checks with deterministic cursor rows
 */

import { createHash } from "crypto";
import { promises as fs } from "fs";
import { Hono } from "hono";
import { and, asc, count, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import path from "path";
import { z } from "zod";
import dbPackage from "@bizing/db";
import { getCurrentUser, requireAuth, requirePlatformAdmin } from "../middleware/auth.js";
import {
  chunkKnowledgeDocument,
  cosineSimilarity,
  generateKnowledgeEmbedding,
  similarityToBps,
} from "../services/knowledge-embeddings.js";
import { fail, ok, parsePositiveInt } from "./_api.js";

const {
  db,
  knowledgeSources,
  knowledgeDocuments,
  knowledgeChunks,
  knowledgeEmbeddings,
  knowledgeEdges,
  knowledgeAgentRuns,
  knowledgeRetrievalTraces,
  knowledgeEvents,
  knowledgeCheckpoints,
} = dbPackage;

const sourceTypeSchema = z.enum([
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

const sourceStatusSchema = z.enum(["active", "paused", "archived"]);
const documentStatusSchema = z.enum(["active", "superseded", "archived"]);
const chunkStatusSchema = z.enum(["active", "archived"]);
const retrievalModeSchema = z.enum(["keyword", "semantic", "hybrid", "graph"]);
const agentKindSchema = z.enum(["codex", "openclaw", "bizing_agent", "human", "system"]);
const agentRunStatusSchema = z.enum(["running", "succeeded", "failed", "cancelled"]);
const checkpointStatusSchema = z.enum(["healthy", "stale", "failed"]);
const edgeTypeSchema = z.enum(["wikilink", "refers_to", "derived_from", "depends_on", "supersedes", "related"]);

const listSourcesQuerySchema = z.object({
  bizId: z.string().optional(),
  sourceType: sourceTypeSchema.optional(),
  status: sourceStatusSchema.optional(),
  page: z.string().optional(),
  perPage: z.string().optional(),
});

const createSourceBodySchema = z.object({
  bizId: z.string().optional().nullable(),
  sourceKey: z.string().min(1).max(200),
  displayName: z.string().min(1).max(255),
  sourceType: sourceTypeSchema.default("other"),
  basePath: z.string().max(1000).optional().nullable(),
  baseUri: z.string().max(1000).optional().nullable(),
  gitRepo: z.string().max(800).optional().nullable(),
  gitBranch: z.string().max(255).optional().nullable(),
  latestCommitSha: z.string().max(120).optional().nullable(),
  sourceUpdatedAt: z.string().datetime().optional().nullable(),
  status: sourceStatusSchema.default("active"),
  metadata: z.record(z.unknown()).optional(),
});

const updateSourceBodySchema = createSourceBodySchema.partial();

const listDocumentsQuerySchema = z.object({
  bizId: z.string().optional(),
  sourceId: z.string().optional(),
  status: documentStatusSchema.optional(),
  page: z.string().optional(),
  perPage: z.string().optional(),
});

const createDocumentBodySchema = z.object({
  bizId: z.string().optional().nullable(),
  sourceId: z.string().min(1),
  documentKey: z.string().min(1).max(260),
  title: z.string().min(1).max(255),
  contentText: z.string().min(1),
  versionLabel: z.string().max(80).default("v1"),
  mimeType: z.string().max(120).default("text/markdown"),
  sourcePath: z.string().max(1000).optional().nullable(),
  sourceUri: z.string().max(1000).optional().nullable(),
  sourceUpdatedAt: z.string().datetime().optional().nullable(),
  status: documentStatusSchema.default("active"),
  metadata: z.record(z.unknown()).optional(),
  autoChunk: z.boolean().default(true),
  autoEmbed: z.boolean().default(false),
  chunkMaxChars: z.number().int().min(300).max(8000).optional(),
  chunkOverlapChars: z.number().int().min(0).max(2000).optional(),
});

const rechunkBodySchema = z.object({
  autoEmbed: z.boolean().default(false),
  chunkMaxChars: z.number().int().min(300).max(8000).optional(),
  chunkOverlapChars: z.number().int().min(0).max(2000).optional(),
});

const listChunksQuerySchema = z.object({
  documentId: z.string().optional(),
  sourceId: z.string().optional(),
  status: chunkStatusSchema.optional(),
  page: z.string().optional(),
  perPage: z.string().optional(),
});

const queryKnowledgeBodySchema = z.object({
  queryText: z.string().min(1),
  bizId: z.string().optional(),
  sourceIds: z.array(z.string()).optional(),
  sourceTypes: z.array(sourceTypeSchema).optional(),
  mode: retrievalModeSchema.default("hybrid"),
  limit: z.number().int().min(1).max(100).default(12),
  candidateLimit: z.number().int().min(50).max(1000).default(800),
  agentRunId: z.string().optional().nullable(),
  createTrace: z.boolean().default(true),
});

const createAgentRunBodySchema = z.object({
  bizId: z.string().optional().nullable(),
  agentKind: agentKindSchema.default("system"),
  agentName: z.string().min(1).max(160),
  runKey: z.string().max(220).optional().nullable(),
  objective: z.string().min(1),
  inputSummary: z.string().optional().nullable(),
  outputSummary: z.string().optional().nullable(),
  decisions: z.array(z.unknown()).optional(),
  unresolvedItems: z.array(z.unknown()).optional(),
  knowledgeCursor: z.string().max(220).optional().nullable(),
  status: agentRunStatusSchema.default("running"),
  endedAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

const listAgentRunsQuerySchema = z.object({
  bizId: z.string().optional(),
  agentKind: agentKindSchema.optional(),
  agentName: z.string().optional(),
  status: agentRunStatusSchema.optional(),
  page: z.string().optional(),
  perPage: z.string().optional(),
});

const upsertCheckpointBodySchema = z.object({
  bizId: z.string().optional().nullable(),
  checkpointKey: z.string().max(120).default("global"),
  lastKnowledgeEventId: z.string().optional().nullable(),
  lastCommitSha: z.string().max(120).optional().nullable(),
  lastDocumentHash: z.string().max(128).optional().nullable(),
  lastIngestedAt: z.string().datetime().optional().nullable(),
  status: checkpointStatusSchema.default("healthy"),
  metadata: z.record(z.unknown()).optional(),
});

const listCheckpointsQuerySchema = z.object({
  bizId: z.string().optional(),
  agentKind: agentKindSchema.optional(),
  agentName: z.string().optional(),
  checkpointKey: z.string().optional(),
});

const listEventsQuerySchema = z.object({
  bizId: z.string().optional(),
  sourceId: z.string().optional(),
  documentId: z.string().optional(),
  chunkId: z.string().optional(),
  agentRunId: z.string().optional(),
  eventType: z.enum(["ingest", "reindex", "query", "checkpoint", "agent_run", "sync"]).optional(),
  status: z.enum(["queued", "running", "succeeded", "failed"]).optional(),
  page: z.string().optional(),
  perPage: z.string().optional(),
});

const listRetrievalTracesQuerySchema = z.object({
  bizId: z.string().optional(),
  agentRunId: z.string().optional(),
  mode: retrievalModeSchema.optional(),
  page: z.string().optional(),
  perPage: z.string().optional(),
});

const syncStatusQuerySchema = z.object({
  bizId: z.string().optional(),
  checkpointKey: z.string().optional(),
});

const createEdgeBodySchema = z.object({
  bizId: z.string().optional().nullable(),
  fromDocumentId: z.string().min(1),
  toDocumentId: z.string().min(1),
  edgeType: edgeTypeSchema.default("related"),
  weightBps: z.number().int().min(0).max(10000).default(10000),
  metadata: z.record(z.unknown()).optional(),
});

const ingestSourceBodySchema = z.object({
  rootPath: z.string().min(1).max(2000).optional(),
  extensions: z.array(z.string().min(1).max(32)).optional(),
  includeHidden: z.boolean().default(false),
  maxFiles: z.number().int().min(1).max(5000).default(500),
  maxFileBytes: z.number().int().min(1024).max(10_000_000).default(300_000),
  autoChunk: z.boolean().default(true),
  autoEmbed: z.boolean().default(false),
  chunkMaxChars: z.number().int().min(300).max(8000).optional(),
  chunkOverlapChars: z.number().int().min(0).max(2000).optional(),
});

function wordCount(input: string) {
  return input.trim().split(/\s+/).filter(Boolean).length;
}

function toNumericVector(input: unknown): number[] {
  if (!Array.isArray(input)) return [];
  const next: number[] = [];
  for (const value of input) {
    const n = Number(value);
    if (Number.isFinite(n)) next.push(n);
  }
  return next;
}

function keywordScore(queryText: string, candidate: string) {
  const queryTerms = queryText
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((part) => part.length >= 2);
  if (queryTerms.length === 0) return 0;
  const haystack = candidate.toLowerCase();
  let hits = 0;
  for (const term of queryTerms) {
    if (haystack.includes(term)) hits += 1;
  }
  return hits / queryTerms.length;
}

function queryTerms(queryText: string) {
  return queryText
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

type BizScopeColumn = typeof knowledgeSources.bizId | typeof knowledgeCheckpoints.bizId;

function bizScopeWhere(column: BizScopeColumn, bizId?: string | null) {
  return bizId ? eq(column, bizId) : isNull(column);
}

const knowledgeSourcesNotDeleted = sql`"knowledge_sources"."deleted_at" IS NULL`;
const knowledgeDocumentsNotDeleted = sql`"knowledge_documents"."deleted_at" IS NULL`;
const knowledgeChunksNotDeleted = sql`"knowledge_chunks"."deleted_at" IS NULL`;
const knowledgeEmbeddingsNotDeleted = sql`"knowledge_embeddings"."deleted_at" IS NULL`;
const knowledgeEdgesNotDeleted = sql`"knowledge_edges"."deleted_at" IS NULL`;
const knowledgeAgentRunsNotDeleted = sql`"knowledge_agent_runs"."deleted_at" IS NULL`;
const knowledgeCheckpointsNotDeleted = sql`"knowledge_checkpoints"."deleted_at" IS NULL`;
const knowledgeEventsNotDeleted = sql`"knowledge_events"."deleted_at" IS NULL`;
const knowledgeRetrievalTracesNotDeleted = sql`"knowledge_retrieval_traces"."deleted_at" IS NULL`;

async function collectTextFiles(input: {
  rootPath: string;
  includeHidden: boolean;
  maxFiles: number;
  extensions?: string[];
}) {
  const normalizedExtensions =
    input.extensions?.map((row) => (row.startsWith(".") ? row.toLowerCase() : `.${row.toLowerCase()}`)) ?? null;

  const files: string[] = [];
  const queue = [input.rootPath];

  while (queue.length > 0 && files.length < input.maxFiles) {
    const current = queue.shift();
    if (!current) break;
    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!input.includeHidden && entry.name.startsWith(".")) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (normalizedExtensions && normalizedExtensions.length > 0) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!normalizedExtensions.includes(ext)) continue;
      }
      files.push(fullPath);
      if (files.length >= input.maxFiles) break;
    }
  }

  return files;
}

async function appendKnowledgeEvent(input: {
  actorUserId: string;
  bizId?: string | null;
  sourceId?: string | null;
  documentId?: string | null;
  chunkId?: string | null;
  agentRunId?: string | null;
  eventType: "ingest" | "reindex" | "query" | "checkpoint" | "agent_run" | "sync";
  status?: "queued" | "running" | "succeeded" | "failed";
  message?: string | null;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
}) {
  await db.insert(knowledgeEvents).values({
    bizId: input.bizId ?? null,
    sourceId: input.sourceId ?? null,
    documentId: input.documentId ?? null,
    chunkId: input.chunkId ?? null,
    agentRunId: input.agentRunId ?? null,
    eventType: input.eventType,
    status: input.status ?? "succeeded",
    message: input.message ?? null,
    payload: input.payload ?? {},
    result: input.result ?? {},
  });
}

async function rebuildChunksAndEmbeddings(input: {
  actorUserId: string;
  document: typeof knowledgeDocuments.$inferSelect;
  autoEmbed: boolean;
  chunkMaxChars?: number;
  chunkOverlapChars?: number;
}) {
  const chunks = chunkKnowledgeDocument(input.document.contentText, {
    maxChars: input.chunkMaxChars,
    overlapChars: input.chunkOverlapChars,
  });

  await db
    .update(knowledgeChunks)
    .set({
      status: "archived",
    })
    .where(and(eq(knowledgeChunks.documentId, input.document.id), eq(knowledgeChunks.status, "active")));

  const insertedChunks =
    chunks.length === 0
      ? []
      : await db
          .insert(knowledgeChunks)
          .values(
            chunks.map((chunk) => ({
              bizId: input.document.bizId ?? null,
              sourceId: input.document.sourceId,
              documentId: input.document.id,
              chunkIndex: chunk.chunkIndex,
              chunkText: chunk.chunkText,
              chunkHash: createHash("sha256").update(chunk.chunkText).digest("hex"),
              tokenEstimate: chunk.tokenEstimate,
              charStart: chunk.charStart,
              charEnd: chunk.charEnd,
              status: "active" as const,
              metadata: {},
            })),
          )
          .returning();

  let embedded = 0;
  const embedErrors: string[] = [];
  if (input.autoEmbed) {
    for (const chunk of insertedChunks) {
      try {
        const embedding = await generateKnowledgeEmbedding(chunk.chunkText);
        await db.insert(knowledgeEmbeddings).values({
          bizId: input.document.bizId ?? null,
          sourceId: input.document.sourceId,
          documentId: input.document.id,
          chunkId: chunk.id,
          provider: embedding.provider,
          model: embedding.model,
          dimensions: embedding.vector.length,
          embedding: embedding.vector,
          embeddingHash: createHash("sha256").update(JSON.stringify(embedding.vector)).digest("hex"),
          status: "ready",
          metadata: {},
        });
        embedded += 1;
      } catch (error) {
        embedErrors.push(error instanceof Error ? error.message : "Embedding failed.");
      }
    }
  }

  await appendKnowledgeEvent({
    actorUserId: input.actorUserId,
    bizId: input.document.bizId,
    sourceId: input.document.sourceId,
    documentId: input.document.id,
    eventType: "reindex",
    message: "Document rechunked.",
    payload: {
      autoEmbed: input.autoEmbed,
      chunkMaxChars: input.chunkMaxChars ?? null,
      chunkOverlapChars: input.chunkOverlapChars ?? null,
    },
    result: {
      chunkCount: insertedChunks.length,
      embeddedCount: embedded,
      embedErrors,
    },
  });

  return {
    chunks: insertedChunks,
    embeddedCount: embedded,
    embedErrors,
  };
}

export const knowledgeRoutes = new Hono();

knowledgeRoutes.get("/knowledge/stats", requireAuth, requirePlatformAdmin, async (c) => {
  const [sourcesCount, documentsCount, chunksCount, embeddingsCount, agentRunsCount] = await Promise.all([
    db.select({ value: count() }).from(knowledgeSources),
    db.select({ value: count() }).from(knowledgeDocuments),
    db.select({ value: count() }).from(knowledgeChunks),
    db.select({ value: count() }).from(knowledgeEmbeddings),
    db.select({ value: count() }).from(knowledgeAgentRuns),
  ]);

  return ok(c, {
    sources: Number(sourcesCount[0]?.value ?? 0),
    documents: Number(documentsCount[0]?.value ?? 0),
    chunks: Number(chunksCount[0]?.value ?? 0),
    embeddings: Number(embeddingsCount[0]?.value ?? 0),
    agentRuns: Number(agentRunsCount[0]?.value ?? 0),
  });
});

knowledgeRoutes.get("/knowledge/sources", requireAuth, requirePlatformAdmin, async (c) => {
  const parsed = listSourcesQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid query params.", 400, parsed.error.flatten());

  const page = parsePositiveInt(parsed.data.page, 1);
  const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 20), 200);
  const where = and(
    parsed.data.bizId ? eq(knowledgeSources.bizId, parsed.data.bizId) : undefined,
    parsed.data.sourceType ? eq(knowledgeSources.sourceType, parsed.data.sourceType) : undefined,
    parsed.data.status ? eq(knowledgeSources.status, parsed.data.status) : undefined,
    knowledgeSourcesNotDeleted,
  );

  const rows = await db.query.knowledgeSources.findMany({
    where,
    orderBy: [asc(knowledgeSources.displayName)],
    limit: perPage,
    offset: (page - 1) * perPage,
  });
  return ok(c, rows);
});

knowledgeRoutes.post("/knowledge/sources", requireAuth, requirePlatformAdmin, async (c) => {
  const actor = getCurrentUser(c);
  if (!actor) return fail(c, "UNAUTHORIZED", "Authentication required.", 401);
  const parsed = createSourceBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());

  const scopedBizId = parsed.data.bizId ?? null;
  const existing = await db.query.knowledgeSources.findFirst({
    where: and(
      bizScopeWhere(knowledgeSources.bizId, scopedBizId),
      eq(knowledgeSources.sourceKey, parsed.data.sourceKey),
      knowledgeSourcesNotDeleted,
    ),
  });
  if (existing) {
    return fail(
      c,
      "DUPLICATE_SOURCE_KEY",
      "A knowledge source with this sourceKey already exists in the same scope.",
      409,
      { sourceId: existing.id },
    );
  }

  const [row] = await db
    .insert(knowledgeSources)
    .values({
      ...parsed.data,
      bizId: scopedBizId,
      sourceUpdatedAt: parsed.data.sourceUpdatedAt ? new Date(parsed.data.sourceUpdatedAt) : null,
      metadata: parsed.data.metadata ?? {},
    })
    .returning();

  await appendKnowledgeEvent({
    actorUserId: actor.id,
    bizId: row.bizId,
    sourceId: row.id,
    eventType: "ingest",
    message: "Knowledge source created.",
    payload: { sourceKey: row.sourceKey, sourceType: row.sourceType },
  });

  return ok(c, row, 201);
});

knowledgeRoutes.patch("/knowledge/sources/:sourceId", requireAuth, requirePlatformAdmin, async (c) => {
  const actor = getCurrentUser(c);
  if (!actor) return fail(c, "UNAUTHORIZED", "Authentication required.", 401);
  const sourceId = c.req.param("sourceId");
  const parsed = updateSourceBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());

  const existing = await db.query.knowledgeSources.findFirst({
    where: and(eq(knowledgeSources.id, sourceId), knowledgeSourcesNotDeleted),
  });
  if (!existing) return fail(c, "NOT_FOUND", "Knowledge source not found.", 404);

  const nextBizId = parsed.data.bizId === undefined ? existing.bizId ?? null : parsed.data.bizId ?? null;
  const nextSourceKey = parsed.data.sourceKey ?? existing.sourceKey;
  const duplicate = await db.query.knowledgeSources.findFirst({
    where: and(
      bizScopeWhere(knowledgeSources.bizId, nextBizId),
      eq(knowledgeSources.sourceKey, nextSourceKey),
      ne(knowledgeSources.id, sourceId),
      knowledgeSourcesNotDeleted,
    ),
  });
  if (duplicate) {
    return fail(
      c,
      "DUPLICATE_SOURCE_KEY",
      "A knowledge source with this sourceKey already exists in the same scope.",
      409,
      { sourceId: duplicate.id },
    );
  }

  const patch: Partial<typeof knowledgeSources.$inferInsert> = {
    ...parsed.data,
    sourceUpdatedAt:
      parsed.data.sourceUpdatedAt === undefined
        ? undefined
        : parsed.data.sourceUpdatedAt
          ? new Date(parsed.data.sourceUpdatedAt)
          : null,
  };

  const [row] = await db
    .update(knowledgeSources)
    .set(patch)
    .where(eq(knowledgeSources.id, sourceId))
    .returning();
  if (!row) return fail(c, "NOT_FOUND", "Knowledge source not found.", 404);

  await appendKnowledgeEvent({
    actorUserId: actor.id,
    bizId: row.bizId,
    sourceId: row.id,
    eventType: "sync",
    message: "Knowledge source updated.",
  });

  return ok(c, row);
});

knowledgeRoutes.get("/knowledge/documents", requireAuth, requirePlatformAdmin, async (c) => {
  const parsed = listDocumentsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid query params.", 400, parsed.error.flatten());

  const page = parsePositiveInt(parsed.data.page, 1);
  const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 25), 200);
  const where = and(
    parsed.data.bizId ? eq(knowledgeDocuments.bizId, parsed.data.bizId) : undefined,
    parsed.data.sourceId ? eq(knowledgeDocuments.sourceId, parsed.data.sourceId) : undefined,
    parsed.data.status ? eq(knowledgeDocuments.status, parsed.data.status) : undefined,
    knowledgeDocumentsNotDeleted,
  );

  const rows = await db.query.knowledgeDocuments.findMany({
    where,
    orderBy: [desc(knowledgeDocuments.ingestedAt)],
    limit: perPage,
    offset: (page - 1) * perPage,
  });
  return ok(c, rows);
});

knowledgeRoutes.get("/knowledge/documents/:documentId", requireAuth, requirePlatformAdmin, async (c) => {
  const documentId = c.req.param("documentId");
  const row = await db.query.knowledgeDocuments.findFirst({
    where: and(eq(knowledgeDocuments.id, documentId), knowledgeDocumentsNotDeleted),
  });
  if (!row) return fail(c, "NOT_FOUND", "Knowledge document not found.", 404);
  return ok(c, row);
});

knowledgeRoutes.post("/knowledge/documents", requireAuth, requirePlatformAdmin, async (c) => {
  const actor = getCurrentUser(c);
  if (!actor) return fail(c, "UNAUTHORIZED", "Authentication required.", 401);
  const parsed = createDocumentBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());

  const source = await db.query.knowledgeSources.findFirst({
    where: and(eq(knowledgeSources.id, parsed.data.sourceId), knowledgeSourcesNotDeleted),
  });
  if (!source) return fail(c, "NOT_FOUND", "Knowledge source not found.", 404);

  const contentHash = createHash("sha256").update(parsed.data.contentText).digest("hex");
  const activePrevious = await db.query.knowledgeDocuments.findFirst({
    where: and(
      eq(knowledgeDocuments.sourceId, source.id),
      eq(knowledgeDocuments.documentKey, parsed.data.documentKey),
      eq(knowledgeDocuments.status, "active"),
    ),
    orderBy: [desc(knowledgeDocuments.ingestedAt)],
  });

  if (activePrevious?.contentHash === contentHash) {
    return ok(
      c,
      {
        document: activePrevious,
        chunkSummary: null,
        deduped: true,
      },
      200,
    );
  }

  if (activePrevious) {
    await db
      .update(knowledgeDocuments)
      .set({ status: "superseded" })
      .where(eq(knowledgeDocuments.id, activePrevious.id));
    await db
      .update(knowledgeChunks)
      .set({ status: "archived" })
      .where(and(eq(knowledgeChunks.documentId, activePrevious.id), eq(knowledgeChunks.status, "active")));
  }
  const [document] = await db
    .insert(knowledgeDocuments)
    .values({
      bizId: parsed.data.bizId ?? source.bizId ?? null,
      sourceId: parsed.data.sourceId,
      documentKey: parsed.data.documentKey,
      title: parsed.data.title,
      contentText: parsed.data.contentText,
      contentHash,
      versionLabel: parsed.data.versionLabel,
      mimeType: parsed.data.mimeType,
      tokenEstimate: Math.max(1, Math.ceil(parsed.data.contentText.length / 4)),
      wordCount: wordCount(parsed.data.contentText),
      sourcePath: parsed.data.sourcePath ?? null,
      sourceUri: parsed.data.sourceUri ?? null,
      sourceUpdatedAt: parsed.data.sourceUpdatedAt ? new Date(parsed.data.sourceUpdatedAt) : null,
      status: parsed.data.status,
      metadata: parsed.data.metadata ?? {},
    })
    .returning();

  await appendKnowledgeEvent({
    actorUserId: actor.id,
    bizId: document.bizId,
    sourceId: document.sourceId,
    documentId: document.id,
    eventType: "ingest",
    message: "Knowledge document created.",
    payload: {
      documentKey: document.documentKey,
      autoChunk: parsed.data.autoChunk,
      autoEmbed: parsed.data.autoEmbed,
    },
  });

  let chunkSummary: Record<string, unknown> | null = null;
  if (parsed.data.autoChunk) {
    const result = await rebuildChunksAndEmbeddings({
      actorUserId: actor.id,
      document,
      autoEmbed: parsed.data.autoEmbed,
      chunkMaxChars: parsed.data.chunkMaxChars,
      chunkOverlapChars: parsed.data.chunkOverlapChars,
    });
    chunkSummary = {
      chunkCount: result.chunks.length,
      embeddedCount: result.embeddedCount,
      embedErrors: result.embedErrors,
    };
  }

  return ok(c, { document, chunkSummary }, 201);
});

knowledgeRoutes.post("/knowledge/documents/:documentId/rechunk", requireAuth, requirePlatformAdmin, async (c) => {
  const actor = getCurrentUser(c);
  if (!actor) return fail(c, "UNAUTHORIZED", "Authentication required.", 401);
  const documentId = c.req.param("documentId");
  const parsed = rechunkBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());

  const document = await db.query.knowledgeDocuments.findFirst({
    where: and(eq(knowledgeDocuments.id, documentId), knowledgeDocumentsNotDeleted),
  });
  if (!document) return fail(c, "NOT_FOUND", "Knowledge document not found.", 404);

  const result = await rebuildChunksAndEmbeddings({
    actorUserId: actor.id,
    document,
    autoEmbed: parsed.data.autoEmbed,
    chunkMaxChars: parsed.data.chunkMaxChars,
    chunkOverlapChars: parsed.data.chunkOverlapChars,
  });

  return ok(c, {
    documentId: document.id,
    chunkCount: result.chunks.length,
    embeddedCount: result.embeddedCount,
    embedErrors: result.embedErrors,
  });
});

knowledgeRoutes.get("/knowledge/chunks", requireAuth, requirePlatformAdmin, async (c) => {
  const parsed = listChunksQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid query params.", 400, parsed.error.flatten());

  const page = parsePositiveInt(parsed.data.page, 1);
  const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 30), 200);
  const where = and(
    parsed.data.documentId ? eq(knowledgeChunks.documentId, parsed.data.documentId) : undefined,
    parsed.data.sourceId ? eq(knowledgeChunks.sourceId, parsed.data.sourceId) : undefined,
    parsed.data.status ? eq(knowledgeChunks.status, parsed.data.status) : undefined,
    knowledgeChunksNotDeleted,
  );

  const rows = await db.query.knowledgeChunks.findMany({
    where,
    orderBy: [asc(knowledgeChunks.documentId), asc(knowledgeChunks.chunkIndex)],
    limit: perPage,
    offset: (page - 1) * perPage,
  });
  return ok(c, rows);
});

knowledgeRoutes.post("/knowledge/chunks/:chunkId/embed", requireAuth, requirePlatformAdmin, async (c) => {
  const actor = getCurrentUser(c);
  if (!actor) return fail(c, "UNAUTHORIZED", "Authentication required.", 401);
  const chunkId = c.req.param("chunkId");
  const chunk = await db.query.knowledgeChunks.findFirst({
    where: and(eq(knowledgeChunks.id, chunkId), knowledgeChunksNotDeleted),
  });
  if (!chunk) return fail(c, "NOT_FOUND", "Knowledge chunk not found.", 404);

  const embedding = await generateKnowledgeEmbedding(chunk.chunkText);
  const [row] = await db
    .insert(knowledgeEmbeddings)
    .values({
      bizId: chunk.bizId,
      sourceId: chunk.sourceId,
      documentId: chunk.documentId,
      chunkId: chunk.id,
      provider: embedding.provider,
      model: embedding.model,
      dimensions: embedding.vector.length,
      embedding: embedding.vector,
      embeddingHash: createHash("sha256").update(JSON.stringify(embedding.vector)).digest("hex"),
      status: "ready",
      metadata: {},
    })
    .onConflictDoUpdate({
      target: [knowledgeEmbeddings.chunkId, knowledgeEmbeddings.provider, knowledgeEmbeddings.model],
      set: {
        dimensions: embedding.vector.length,
        embedding: embedding.vector,
        embeddingHash: createHash("sha256").update(JSON.stringify(embedding.vector)).digest("hex"),
        status: "ready",
        errorMessage: null,
        computedAt: new Date(),
      },
    })
    .returning();

  await appendKnowledgeEvent({
    actorUserId: actor.id,
    bizId: chunk.bizId,
    sourceId: chunk.sourceId,
    documentId: chunk.documentId,
    chunkId: chunk.id,
    eventType: "reindex",
    message: "Chunk embedding refreshed.",
    result: { provider: row.provider, model: row.model, dimensions: row.dimensions },
  });

  return ok(c, row, 201);
});

knowledgeRoutes.post("/knowledge/query", requireAuth, requirePlatformAdmin, async (c) => {
  const actor = getCurrentUser(c);
  if (!actor) return fail(c, "UNAUTHORIZED", "Authentication required.", 401);
  const parsed = queryKnowledgeBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());

  const sourceWhere = and(
    parsed.data.bizId ? eq(knowledgeSources.bizId, parsed.data.bizId) : undefined,
    eq(knowledgeSources.status, "active"),
    knowledgeSourcesNotDeleted,
    parsed.data.sourceTypes?.length ? inArray(knowledgeSources.sourceType, parsed.data.sourceTypes) : undefined,
    parsed.data.sourceIds?.length ? inArray(knowledgeSources.id, parsed.data.sourceIds) : undefined,
  );

  const sourceRows = await db.query.knowledgeSources.findMany({
    where: sourceWhere,
    columns: { id: true, displayName: true, sourceType: true },
  });
  if (sourceRows.length === 0) {
    return ok(c, { results: [], reason: "No active sources matched query filters." });
  }

  const sourceIdSet = new Set(sourceRows.map((row) => row.id));
  const terms = queryTerms(parsed.data.queryText).slice(0, 8);
  const textFilter =
    parsed.data.mode === "semantic" || terms.length === 0
      ? undefined
      : or(...terms.map((term) => ilike(knowledgeChunks.chunkText, `%${term}%`)));
  const chunks = await db.query.knowledgeChunks.findMany({
    where: and(
      inArray(knowledgeChunks.sourceId, Array.from(sourceIdSet)),
      eq(knowledgeChunks.status, "active"),
      knowledgeChunksNotDeleted,
      textFilter,
    ),
    orderBy: [desc(knowledgeChunks.id)],
    limit: parsed.data.candidateLimit,
  });

  if (chunks.length === 0) {
    return ok(c, { results: [], reason: "No active chunks available for matched sources." });
  }

  const chunkDocIds = Array.from(new Set(chunks.map((row) => row.documentId)));
  const activeDocs = chunkDocIds.length
    ? await db.query.knowledgeDocuments.findMany({
        where: and(
          inArray(knowledgeDocuments.id, chunkDocIds),
          eq(knowledgeDocuments.status, "active"),
          knowledgeDocumentsNotDeleted,
        ),
      })
    : [];
  const activeDocIdSet = new Set(activeDocs.map((row) => row.id));
  const activeChunks = chunks.filter((row) => activeDocIdSet.has(row.documentId));
  if (activeChunks.length === 0) {
    return ok(c, { results: [], reason: "No active chunks from active documents are available." });
  }

  const chunkIds = activeChunks.map((row) => row.id);
  const embeddingsRows = await db.query.knowledgeEmbeddings.findMany({
    where: and(
      inArray(knowledgeEmbeddings.chunkId, chunkIds),
      eq(knowledgeEmbeddings.status, "ready"),
      knowledgeEmbeddingsNotDeleted,
    ),
    orderBy: [desc(knowledgeEmbeddings.computedAt)],
  });

  const embeddingByChunk = new Map<string, typeof knowledgeEmbeddings.$inferSelect>();
  for (const row of embeddingsRows) {
    if (!embeddingByChunk.has(row.chunkId)) embeddingByChunk.set(row.chunkId, row);
  }

  let queryVector: number[] | null = null;
  let queryEmbeddingMeta: { provider: string; model: string } | null = null;
  if (parsed.data.mode === "semantic" || parsed.data.mode === "hybrid" || parsed.data.mode === "graph") {
    try {
      const result = await generateKnowledgeEmbedding(parsed.data.queryText);
      queryVector = result.vector;
      queryEmbeddingMeta = { provider: result.provider, model: result.model };
    } catch {
      queryVector = null;
      queryEmbeddingMeta = null;
    }
  }

  const baseScored = activeChunks
    .map((chunk) => {
      const embedding = embeddingByChunk.get(chunk.id);
      const chunkVector = embedding ? toNumericVector(embedding.embedding) : [];
      const semantic =
        queryVector && chunkVector.length === queryVector.length
          ? cosineSimilarity(queryVector, chunkVector)
          : 0;
      const keyword = keywordScore(parsed.data.queryText, chunk.chunkText);
      let finalScore = 0;
      if (parsed.data.mode === "semantic") finalScore = semantic;
      else if (parsed.data.mode === "keyword") finalScore = keyword;
      else finalScore = semantic * 0.65 + keyword * 0.35;

      return {
        chunk,
        embedding,
        semanticScore: semantic,
        keywordScore: keyword,
        finalScore,
        finalScoreBps: similarityToBps(finalScore),
      };
    });

  let graphEdgeCount = 0;
  let scored = baseScored;
  if (parsed.data.mode === "graph") {
    const graphDocIds = Array.from(new Set(baseScored.map((row) => row.chunk.documentId)));
    const edges = graphDocIds.length
      ? await db.query.knowledgeEdges.findMany({
          where: and(
            knowledgeEdgesNotDeleted,
            or(
              inArray(knowledgeEdges.fromDocumentId, graphDocIds),
              inArray(knowledgeEdges.toDocumentId, graphDocIds),
            ),
          ),
        })
      : [];
    graphEdgeCount = edges.length;

    const seedScoreByDoc = new Map<string, number>();
    for (const row of baseScored) {
      const seed = Math.max(row.semanticScore, row.keywordScore);
      const current = seedScoreByDoc.get(row.chunk.documentId) ?? 0;
      if (seed > current) seedScoreByDoc.set(row.chunk.documentId, seed);
    }

    const edgeBoostByDoc = new Map<string, number>();
    for (const edge of edges) {
      const weight = Math.max(0, Math.min(1, Number(edge.weightBps ?? 0) / 10000));
      const fromSeed = seedScoreByDoc.get(edge.fromDocumentId) ?? 0;
      const toSeed = seedScoreByDoc.get(edge.toDocumentId) ?? 0;
      if (fromSeed > 0) {
        const current = edgeBoostByDoc.get(edge.toDocumentId) ?? 0;
        edgeBoostByDoc.set(edge.toDocumentId, Math.max(current, fromSeed * weight));
      }
      if (toSeed > 0) {
        const current = edgeBoostByDoc.get(edge.fromDocumentId) ?? 0;
        edgeBoostByDoc.set(edge.fromDocumentId, Math.max(current, toSeed * weight));
      }
    }

    scored = baseScored.map((row) => {
      const graphBoost = edgeBoostByDoc.get(row.chunk.documentId) ?? 0;
      const finalScore = row.semanticScore * 0.55 + row.keywordScore * 0.15 + graphBoost * 0.3;
      return {
        ...row,
        graphBoost,
        finalScore,
        finalScoreBps: similarityToBps(finalScore),
      };
    });
  }

  scored = scored.sort((a, b) => b.finalScore - a.finalScore).slice(0, parsed.data.limit);

  const docIds = Array.from(new Set(scored.map((row) => row.chunk.documentId)));
  const docs = docIds.length ? activeDocs.filter((row) => docIds.includes(row.id)) : [];
  const docsMap = new Map(docs.map((row) => [row.id, row]));
  const sourceMap = new Map(sourceRows.map((row) => [row.id, row]));

  const results = scored.map((row) => ({
    documentId: row.chunk.documentId,
    documentKey: docsMap.get(row.chunk.documentId)?.documentKey ?? null,
    documentTitle: docsMap.get(row.chunk.documentId)?.title ?? null,
    sourceId: row.chunk.sourceId,
    sourceName: sourceMap.get(row.chunk.sourceId)?.displayName ?? null,
    sourceType: sourceMap.get(row.chunk.sourceId)?.sourceType ?? null,
    chunkId: row.chunk.id,
    chunkIndex: row.chunk.chunkIndex,
    chunkText: row.chunk.chunkText,
    charStart: row.chunk.charStart,
    charEnd: row.chunk.charEnd,
    semanticScore: row.semanticScore,
    keywordScore: row.keywordScore,
    finalScore: row.finalScore,
    finalScoreBps: row.finalScoreBps,
  }));

  if (parsed.data.createTrace) {
    await db.insert(knowledgeRetrievalTraces).values({
      bizId: parsed.data.bizId ?? null,
      agentRunId: parsed.data.agentRunId ?? null,
      queryText: parsed.data.queryText,
      mode: parsed.data.mode,
      scope: {
        sourceIds: parsed.data.sourceIds ?? [],
        sourceTypes: parsed.data.sourceTypes ?? [],
      },
      resultDocumentIds: results.map((row) => row.documentId),
      resultChunkIds: results.map((row) => row.chunkId),
      resultScores: results.map((row) => row.finalScore),
      topScoreBps: results[0]?.finalScoreBps ?? null,
      modelProvider: queryEmbeddingMeta?.provider ?? null,
      model: queryEmbeddingMeta?.model ?? null,
      metadata: {
        candidateCount: activeChunks.length,
        embeddedCandidates: Array.from(embeddingByChunk.keys()).length,
        queryTerms: terms,
        graphEdgeCount,
      },
    });
  }

  await appendKnowledgeEvent({
    actorUserId: actor.id,
    bizId: parsed.data.bizId ?? null,
    agentRunId: parsed.data.agentRunId ?? null,
    eventType: "query",
    message: "Knowledge query executed.",
    payload: {
      queryText: parsed.data.queryText,
      mode: parsed.data.mode,
    },
    result: {
      resultCount: results.length,
      topScoreBps: results[0]?.finalScoreBps ?? null,
    },
  });

  return ok(c, {
    results,
    query: {
      mode: parsed.data.mode,
      limit: parsed.data.limit,
      candidateLimit: parsed.data.candidateLimit,
      candidateCount: activeChunks.length,
      queryEmbeddingProvider: queryEmbeddingMeta?.provider ?? null,
      queryEmbeddingModel: queryEmbeddingMeta?.model ?? null,
      queryTerms: terms,
      graphEdgeCount,
    },
  });
});

knowledgeRoutes.post("/knowledge/edges", requireAuth, requirePlatformAdmin, async (c) => {
  const actor = getCurrentUser(c);
  if (!actor) return fail(c, "UNAUTHORIZED", "Authentication required.", 401);
  const parsed = createEdgeBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());

  const [row] = await db
    .insert(knowledgeEdges)
    .values({
      ...parsed.data,
      bizId: parsed.data.bizId ?? null,
      metadata: parsed.data.metadata ?? {},
    })
    .onConflictDoUpdate({
      target: [knowledgeEdges.fromDocumentId, knowledgeEdges.toDocumentId, knowledgeEdges.edgeType],
      set: {
        weightBps: parsed.data.weightBps,
        metadata: parsed.data.metadata ?? {},
      },
    })
    .returning();

  return ok(c, row, 201);
});

knowledgeRoutes.post("/knowledge/sources/:sourceId/ingest-files", requireAuth, requirePlatformAdmin, async (c) => {
  const actor = getCurrentUser(c);
  if (!actor) return fail(c, "UNAUTHORIZED", "Authentication required.", 401);
  const sourceId = c.req.param("sourceId");
  const parsed = ingestSourceBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());

  const source = await db.query.knowledgeSources.findFirst({
    where: and(eq(knowledgeSources.id, sourceId), knowledgeSourcesNotDeleted),
  });
  if (!source) return fail(c, "NOT_FOUND", "Knowledge source not found.", 404);

  const rootPath = parsed.data.rootPath ?? source.basePath ?? null;
  if (!rootPath) return fail(c, "VALIDATION_ERROR", "Source has no basePath and no rootPath override was provided.", 400);

  const rootStat = await fs.stat(rootPath).catch(() => null);
  if (!rootStat || !rootStat.isDirectory()) {
    return fail(c, "VALIDATION_ERROR", "Root path does not exist or is not a directory.", 400, { rootPath });
  }

  const files = await collectTextFiles({
    rootPath,
    includeHidden: parsed.data.includeHidden,
    maxFiles: parsed.data.maxFiles,
    extensions: parsed.data.extensions,
  });

  const summary = {
    rootPath,
    scannedFiles: files.length,
    createdDocuments: 0,
    skippedUnchanged: 0,
    skippedUnreadable: 0,
    archivedSuperseded: 0,
    chunkedDocuments: 0,
    embeddedChunks: 0,
    embedErrors: 0,
    failures: 0,
  };

  const createdDocumentIds: string[] = [];
  const failureSamples: Array<{ file: string; error: string }> = [];

  for (const fullPath of files) {
    const stat = await fs.stat(fullPath).catch(() => null);
    if (!stat || !stat.isFile() || stat.size > parsed.data.maxFileBytes) {
      summary.skippedUnreadable += 1;
      continue;
    }

    const contentText = await fs.readFile(fullPath, "utf8").catch(() => null);
    if (!contentText) {
      summary.skippedUnreadable += 1;
      continue;
    }

    const documentKey = path.relative(rootPath, fullPath).split(path.sep).join("/");
    const contentHash = createHash("sha256").update(contentText).digest("hex");

    try {
      const existing = await db.query.knowledgeDocuments.findFirst({
        where: and(
          eq(knowledgeDocuments.sourceId, source.id),
          eq(knowledgeDocuments.documentKey, documentKey),
          eq(knowledgeDocuments.status, "active"),
        ),
        orderBy: [desc(knowledgeDocuments.ingestedAt)],
      });

      if (existing?.contentHash === contentHash) {
        summary.skippedUnchanged += 1;
        continue;
      }

      if (existing) {
        await db
          .update(knowledgeDocuments)
          .set({
            status: "superseded",
          })
          .where(eq(knowledgeDocuments.id, existing.id));
        await db
          .update(knowledgeChunks)
          .set({
            status: "archived",
          })
          .where(and(eq(knowledgeChunks.documentId, existing.id), eq(knowledgeChunks.status, "active")));
        summary.archivedSuperseded += 1;
      }

      const parsedVersion = existing?.versionLabel?.startsWith("v")
        ? Number(existing.versionLabel.slice(1))
        : Number.NaN;
      const nextVersion = Number.isFinite(parsedVersion) ? `v${parsedVersion + 1}` : existing ? "v2" : "v1";

      const [document] = await db
        .insert(knowledgeDocuments)
        .values({
          bizId: source.bizId ?? null,
          sourceId: source.id,
          documentKey,
          title: path.basename(fullPath),
          contentText,
          contentHash,
          versionLabel: nextVersion,
          mimeType: "text/plain",
          tokenEstimate: Math.max(1, Math.ceil(contentText.length / 4)),
          wordCount: wordCount(contentText),
          sourcePath: fullPath,
          sourceUri: source.baseUri ? `${source.baseUri.replace(/\/$/, "")}/${documentKey}` : null,
          sourceUpdatedAt: stat.mtime,
          status: "active",
          metadata: {
            sourcePathRoot: rootPath,
            sizeBytes: stat.size,
          },
        })
        .returning();

      summary.createdDocuments += 1;
      createdDocumentIds.push(document.id);

      if (parsed.data.autoChunk) {
        const rebuild = await rebuildChunksAndEmbeddings({
          actorUserId: actor.id,
          document,
          autoEmbed: parsed.data.autoEmbed,
          chunkMaxChars: parsed.data.chunkMaxChars,
          chunkOverlapChars: parsed.data.chunkOverlapChars,
        });
        summary.chunkedDocuments += 1;
        summary.embeddedChunks += rebuild.embeddedCount;
        summary.embedErrors += rebuild.embedErrors.length;
      }
    } catch (error) {
      summary.failures += 1;
      if (failureSamples.length < 15) {
        failureSamples.push({
          file: documentKey,
          error: error instanceof Error ? error.message : "Unknown ingest error.",
        });
      }
    }
  }

  await appendKnowledgeEvent({
    actorUserId: actor.id,
    bizId: source.bizId,
    sourceId: source.id,
    eventType: "sync",
    message: "Filesystem source ingest completed.",
    payload: {
      rootPath,
      options: parsed.data,
    },
    result: {
      ...summary,
      createdDocumentIdsSample: createdDocumentIds.slice(0, 50),
      failureSamples,
    },
  });

  return ok(c, {
    sourceId: source.id,
    summary,
    createdDocumentIdsSample: createdDocumentIds.slice(0, 50),
    failureSamples,
  });
});

knowledgeRoutes.get("/knowledge/agent-runs", requireAuth, requirePlatformAdmin, async (c) => {
  const parsed = listAgentRunsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid query params.", 400, parsed.error.flatten());

  const page = parsePositiveInt(parsed.data.page, 1);
  const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 25), 200);
  const where = and(
    parsed.data.bizId ? eq(knowledgeAgentRuns.bizId, parsed.data.bizId) : undefined,
    parsed.data.agentKind ? eq(knowledgeAgentRuns.agentKind, parsed.data.agentKind) : undefined,
    parsed.data.agentName ? eq(knowledgeAgentRuns.agentName, parsed.data.agentName) : undefined,
    parsed.data.status ? eq(knowledgeAgentRuns.status, parsed.data.status) : undefined,
    knowledgeAgentRunsNotDeleted,
  );
  const rows = await db.query.knowledgeAgentRuns.findMany({
    where,
    orderBy: [desc(knowledgeAgentRuns.startedAt)],
    limit: perPage,
    offset: (page - 1) * perPage,
  });
  return ok(c, rows);
});

knowledgeRoutes.post("/knowledge/agent-runs", requireAuth, requirePlatformAdmin, async (c) => {
  const actor = getCurrentUser(c);
  if (!actor) return fail(c, "UNAUTHORIZED", "Authentication required.", 401);
  const parsed = createAgentRunBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());

  const [row] = await db
    .insert(knowledgeAgentRuns)
    .values({
      bizId: parsed.data.bizId ?? null,
      agentKind: parsed.data.agentKind,
      agentName: parsed.data.agentName,
      runKey: parsed.data.runKey ?? null,
      objective: parsed.data.objective,
      inputSummary: parsed.data.inputSummary ?? null,
      outputSummary: parsed.data.outputSummary ?? null,
      decisions: parsed.data.decisions ?? [],
      unresolvedItems: parsed.data.unresolvedItems ?? [],
      knowledgeCursor: parsed.data.knowledgeCursor ?? null,
      status: parsed.data.status,
      endedAt: parsed.data.endedAt ? new Date(parsed.data.endedAt) : null,
      metadata: parsed.data.metadata ?? {},
    })
    .returning();

  await appendKnowledgeEvent({
    actorUserId: actor.id,
    bizId: row.bizId,
    agentRunId: row.id,
    eventType: "agent_run",
    message: "Knowledge agent run recorded.",
    payload: {
      agentKind: row.agentKind,
      agentName: row.agentName,
      runKey: row.runKey,
    },
  });

  return ok(c, row, 201);
});

knowledgeRoutes.get("/knowledge/checkpoints", requireAuth, requirePlatformAdmin, async (c) => {
  const parsed = listCheckpointsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid query params.", 400, parsed.error.flatten());

  const rows = await db.query.knowledgeCheckpoints.findMany({
    where: and(
      parsed.data.bizId ? eq(knowledgeCheckpoints.bizId, parsed.data.bizId) : undefined,
      parsed.data.agentKind ? eq(knowledgeCheckpoints.agentKind, parsed.data.agentKind) : undefined,
      parsed.data.agentName ? eq(knowledgeCheckpoints.agentName, parsed.data.agentName) : undefined,
      parsed.data.checkpointKey ? eq(knowledgeCheckpoints.checkpointKey, parsed.data.checkpointKey) : undefined,
      knowledgeCheckpointsNotDeleted,
    ),
    orderBy: [asc(knowledgeCheckpoints.agentKind), asc(knowledgeCheckpoints.agentName)],
  });
  return ok(c, rows);
});

knowledgeRoutes.get("/knowledge/events", requireAuth, requirePlatformAdmin, async (c) => {
  const parsed = listEventsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid query params.", 400, parsed.error.flatten());

  const page = parsePositiveInt(parsed.data.page, 1);
  const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 50), 200);
  const where = and(
    parsed.data.bizId ? eq(knowledgeEvents.bizId, parsed.data.bizId) : undefined,
    parsed.data.sourceId ? eq(knowledgeEvents.sourceId, parsed.data.sourceId) : undefined,
    parsed.data.documentId ? eq(knowledgeEvents.documentId, parsed.data.documentId) : undefined,
    parsed.data.chunkId ? eq(knowledgeEvents.chunkId, parsed.data.chunkId) : undefined,
    parsed.data.agentRunId ? eq(knowledgeEvents.agentRunId, parsed.data.agentRunId) : undefined,
    parsed.data.eventType ? eq(knowledgeEvents.eventType, parsed.data.eventType) : undefined,
    parsed.data.status ? eq(knowledgeEvents.status, parsed.data.status) : undefined,
    knowledgeEventsNotDeleted,
  );

  const rows = await db.query.knowledgeEvents.findMany({
    where,
    orderBy: [desc(knowledgeEvents.occurredAt)],
    limit: perPage,
    offset: (page - 1) * perPage,
  });
  return ok(c, rows);
});

knowledgeRoutes.get("/knowledge/retrieval-traces", requireAuth, requirePlatformAdmin, async (c) => {
  const parsed = listRetrievalTracesQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid query params.", 400, parsed.error.flatten());

  const page = parsePositiveInt(parsed.data.page, 1);
  const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 50), 200);
  const where = and(
    parsed.data.bizId ? eq(knowledgeRetrievalTraces.bizId, parsed.data.bizId) : undefined,
    parsed.data.agentRunId ? eq(knowledgeRetrievalTraces.agentRunId, parsed.data.agentRunId) : undefined,
    parsed.data.mode ? eq(knowledgeRetrievalTraces.mode, parsed.data.mode) : undefined,
    knowledgeRetrievalTracesNotDeleted,
  );

  const rows = await db.query.knowledgeRetrievalTraces.findMany({
    where,
    orderBy: [desc(knowledgeRetrievalTraces.occurredAt)],
    limit: perPage,
    offset: (page - 1) * perPage,
  });
  return ok(c, rows);
});

knowledgeRoutes.get("/knowledge/sync-status", requireAuth, requirePlatformAdmin, async (c) => {
  const parsed = syncStatusQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid query params.", 400, parsed.error.flatten());

  const checkpointWhere = and(
    parsed.data.bizId ? eq(knowledgeCheckpoints.bizId, parsed.data.bizId) : undefined,
    parsed.data.checkpointKey ? eq(knowledgeCheckpoints.checkpointKey, parsed.data.checkpointKey) : undefined,
    knowledgeCheckpointsNotDeleted,
  );
  const eventWhere = and(
    parsed.data.bizId ? eq(knowledgeEvents.bizId, parsed.data.bizId) : undefined,
    knowledgeEventsNotDeleted,
  );

  const [checkpoints, latestEvent] = await Promise.all([
    db.query.knowledgeCheckpoints.findMany({
      where: checkpointWhere,
      orderBy: [asc(knowledgeCheckpoints.checkpointKey), asc(knowledgeCheckpoints.agentKind), asc(knowledgeCheckpoints.agentName)],
    }),
    db.query.knowledgeEvents.findFirst({
      where: eventWhere,
      orderBy: [desc(knowledgeEvents.occurredAt)],
    }),
  ]);

  const checkpointEventIds = checkpoints
    .map((row) => row.lastKnowledgeEventId)
    .filter((row): row is string => Boolean(row));
  const checkpointEvents = checkpointEventIds.length
    ? await db.query.knowledgeEvents.findMany({
        where: inArray(knowledgeEvents.id, checkpointEventIds),
      })
    : [];
  const checkpointEventMap = new Map(checkpointEvents.map((row) => [row.id, row]));

  const rows = checkpoints.map((row) => {
    const lastEvent = row.lastKnowledgeEventId ? checkpointEventMap.get(row.lastKnowledgeEventId) ?? null : null;
    const lagMs =
      latestEvent && lastEvent
        ? Math.max(0, latestEvent.occurredAt.getTime() - lastEvent.occurredAt.getTime())
        : null;

    return {
      id: row.id,
      bizId: row.bizId,
      checkpointKey: row.checkpointKey,
      agentKind: row.agentKind,
      agentName: row.agentName,
      status: row.status,
      lastKnowledgeEventId: row.lastKnowledgeEventId,
      lastKnowledgeEventOccurredAt: lastEvent?.occurredAt ?? null,
      lastCommitSha: row.lastCommitSha,
      lastDocumentHash: row.lastDocumentHash,
      lastIngestedAt: row.lastIngestedAt,
      lastObservedAt: row.lastObservedAt,
      lagMs,
      inSyncWithLatestEvent: Boolean(latestEvent?.id && row.lastKnowledgeEventId === latestEvent.id),
    };
  });

  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.bizId ?? "global"}:${row.checkpointKey}`;
    const existing = grouped.get(key) ?? [];
    existing.push(row);
    grouped.set(key, existing);
  }

  const syncGroups = Array.from(grouped.entries()).map(([key, groupRows]) => {
    const commitShaSet = new Set(groupRows.map((row) => row.lastCommitSha).filter(Boolean));
    const eventIdSet = new Set(groupRows.map((row) => row.lastKnowledgeEventId).filter(Boolean));
    return {
      key,
      bizId: groupRows[0]?.bizId ?? null,
      checkpointKey: groupRows[0]?.checkpointKey ?? null,
      participants: groupRows.map((row) => ({
        agentKind: row.agentKind,
        agentName: row.agentName,
        status: row.status,
        lastCommitSha: row.lastCommitSha,
        lastKnowledgeEventId: row.lastKnowledgeEventId,
        lagMs: row.lagMs,
      })),
      allSameCommitSha: commitShaSet.size <= 1,
      allSameEventCursor: eventIdSet.size <= 1,
    };
  });

  return ok(c, {
    latestEvent: latestEvent
      ? {
          id: latestEvent.id,
          eventType: latestEvent.eventType,
          status: latestEvent.status,
          occurredAt: latestEvent.occurredAt,
        }
      : null,
    checkpoints: rows,
    syncGroups,
  });
});

knowledgeRoutes.put("/knowledge/checkpoints/:agentKind/:agentName", requireAuth, requirePlatformAdmin, async (c) => {
  const actor = getCurrentUser(c);
  if (!actor) return fail(c, "UNAUTHORIZED", "Authentication required.", 401);

  const agentKindParsed = agentKindSchema.safeParse(c.req.param("agentKind"));
  if (!agentKindParsed.success) return fail(c, "VALIDATION_ERROR", "Invalid agent kind.", 400, agentKindParsed.error.flatten());
  const agentName = c.req.param("agentName");
  if (!agentName || agentName.length > 160) return fail(c, "VALIDATION_ERROR", "Invalid agent name.", 400);

  const parsed = upsertCheckpointBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid request body.", 400, parsed.error.flatten());

  const existing = await db.query.knowledgeCheckpoints.findFirst({
    where: and(
      bizScopeWhere(knowledgeCheckpoints.bizId, parsed.data.bizId ?? null),
      eq(knowledgeCheckpoints.agentKind, agentKindParsed.data),
      eq(knowledgeCheckpoints.agentName, agentName),
      eq(knowledgeCheckpoints.checkpointKey, parsed.data.checkpointKey),
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(knowledgeCheckpoints)
      .set({
        bizId: parsed.data.bizId ?? existing.bizId,
        lastKnowledgeEventId:
          parsed.data.lastKnowledgeEventId === undefined
            ? existing.lastKnowledgeEventId
            : parsed.data.lastKnowledgeEventId,
        lastCommitSha:
          parsed.data.lastCommitSha === undefined ? existing.lastCommitSha : parsed.data.lastCommitSha,
        lastDocumentHash:
          parsed.data.lastDocumentHash === undefined
            ? existing.lastDocumentHash
            : parsed.data.lastDocumentHash,
        lastIngestedAt:
          parsed.data.lastIngestedAt === undefined
            ? existing.lastIngestedAt
            : parsed.data.lastIngestedAt
              ? new Date(parsed.data.lastIngestedAt)
              : null,
        lastObservedAt: new Date(),
        status: parsed.data.status,
        metadata: parsed.data.metadata ?? existing.metadata,
      })
      .where(eq(knowledgeCheckpoints.id, existing.id))
      .returning();

    await appendKnowledgeEvent({
      actorUserId: actor.id,
      bizId: updated.bizId,
      eventType: "checkpoint",
      message: "Knowledge checkpoint updated.",
      payload: {
        agentKind: updated.agentKind,
        agentName: updated.agentName,
        checkpointKey: updated.checkpointKey,
      },
    });

    return ok(c, updated);
  }

  const [created] = await db
    .insert(knowledgeCheckpoints)
    .values({
      bizId: parsed.data.bizId ?? null,
      agentKind: agentKindParsed.data,
      agentName,
      checkpointKey: parsed.data.checkpointKey,
      lastKnowledgeEventId: parsed.data.lastKnowledgeEventId ?? null,
      lastCommitSha: parsed.data.lastCommitSha ?? null,
      lastDocumentHash: parsed.data.lastDocumentHash ?? null,
      lastIngestedAt: parsed.data.lastIngestedAt ? new Date(parsed.data.lastIngestedAt) : null,
      lastObservedAt: new Date(),
      status: parsed.data.status,
      metadata: parsed.data.metadata ?? {},
    })
    .returning();

  await appendKnowledgeEvent({
    actorUserId: actor.id,
    bizId: created.bizId,
    eventType: "checkpoint",
    message: "Knowledge checkpoint created.",
    payload: {
      agentKind: created.agentKind,
      agentName: created.agentName,
      checkpointKey: created.checkpointKey,
    },
  });

  return ok(c, created, 201);
});
