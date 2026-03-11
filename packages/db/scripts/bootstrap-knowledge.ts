import "dotenv/config";
import { Client } from "pg";

/**
 * Ensures canonical shared-knowledge plane tables exist.
 *
 * Why this script exists:
 * - drizzle interactive push/generate can block on rename prompts in drifted DBs.
 * - v0 needs a deterministic, idempotent way to bootstrap the new knowledge plane.
 * - this script only creates missing enums/tables/indexes/constraints; it does not
 *   mutate unrelated domains.
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");

  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'knowledge_source_type') THEN
          CREATE TYPE "knowledge_source_type" AS ENUM ('git','docs','mind','ooda','saga_run','api_contract','decision_log','chat','other');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'knowledge_source_status') THEN
          CREATE TYPE "knowledge_source_status" AS ENUM ('active','paused','archived');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'knowledge_document_status') THEN
          CREATE TYPE "knowledge_document_status" AS ENUM ('active','superseded','archived');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'knowledge_chunk_status') THEN
          CREATE TYPE "knowledge_chunk_status" AS ENUM ('active','archived');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'knowledge_embedding_status') THEN
          CREATE TYPE "knowledge_embedding_status" AS ENUM ('pending','ready','failed');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'knowledge_edge_type') THEN
          CREATE TYPE "knowledge_edge_type" AS ENUM ('wikilink','refers_to','derived_from','depends_on','supersedes','related');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'knowledge_event_type') THEN
          CREATE TYPE "knowledge_event_type" AS ENUM ('ingest','reindex','query','checkpoint','agent_run','sync');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'knowledge_event_status') THEN
          CREATE TYPE "knowledge_event_status" AS ENUM ('queued','running','succeeded','failed');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'knowledge_agent_kind') THEN
          CREATE TYPE "knowledge_agent_kind" AS ENUM ('codex','openclaw','bizing_agent','human','system');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'knowledge_agent_run_status') THEN
          CREATE TYPE "knowledge_agent_run_status" AS ENUM ('running','succeeded','failed','cancelled');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'knowledge_checkpoint_status') THEN
          CREATE TYPE "knowledge_checkpoint_status" AS ENUM ('healthy','stale','failed');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'knowledge_retrieval_mode') THEN
          CREATE TYPE "knowledge_retrieval_mode" AS ENUM ('keyword','semantic','hybrid','graph');
        END IF;
      END
      $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "knowledge_sources" (
        "id" varchar(255) PRIMARY KEY NOT NULL,
        "biz_id" varchar(255),
        "source_key" varchar(200) NOT NULL,
        "display_name" varchar(255) NOT NULL,
        "source_type" "knowledge_source_type" DEFAULT 'other' NOT NULL,
        "base_path" varchar(1000),
        "base_uri" varchar(1000),
        "git_repo" varchar(800),
        "git_branch" varchar(255),
        "latest_commit_sha" varchar(120),
        "source_updated_at" timestamp with time zone,
        "status" "knowledge_source_status" DEFAULT 'active' NOT NULL,
        "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "deleted_at" timestamp with time zone,
        "created_by" varchar(255),
        "updated_by" varchar(255),
        "deleted_by" varchar(255)
      );

      CREATE TABLE IF NOT EXISTS "knowledge_documents" (
        "id" varchar(255) PRIMARY KEY NOT NULL,
        "biz_id" varchar(255),
        "source_id" varchar(255) NOT NULL,
        "document_key" varchar(260) NOT NULL,
        "title" varchar(255) NOT NULL,
        "content_text" text NOT NULL,
        "content_hash" varchar(128) NOT NULL,
        "version_label" varchar(80) DEFAULT 'v1' NOT NULL,
        "mime_type" varchar(120) DEFAULT 'text/markdown' NOT NULL,
        "token_estimate" integer DEFAULT 0 NOT NULL,
        "word_count" integer DEFAULT 0 NOT NULL,
        "source_path" varchar(1000),
        "source_uri" varchar(1000),
        "source_updated_at" timestamp with time zone,
        "ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
        "status" "knowledge_document_status" DEFAULT 'active' NOT NULL,
        "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "deleted_at" timestamp with time zone,
        "created_by" varchar(255),
        "updated_by" varchar(255),
        "deleted_by" varchar(255)
      );

      CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
        "id" varchar(255) PRIMARY KEY NOT NULL,
        "biz_id" varchar(255),
        "source_id" varchar(255) NOT NULL,
        "document_id" varchar(255) NOT NULL,
        "chunk_index" integer NOT NULL,
        "chunk_text" text NOT NULL,
        "chunk_hash" varchar(128) NOT NULL,
        "token_estimate" integer DEFAULT 0 NOT NULL,
        "char_start" integer DEFAULT 0 NOT NULL,
        "char_end" integer DEFAULT 0 NOT NULL,
        "status" "knowledge_chunk_status" DEFAULT 'active' NOT NULL,
        "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "deleted_at" timestamp with time zone,
        "created_by" varchar(255),
        "updated_by" varchar(255),
        "deleted_by" varchar(255)
      );

      CREATE TABLE IF NOT EXISTS "knowledge_embeddings" (
        "id" varchar(255) PRIMARY KEY NOT NULL,
        "biz_id" varchar(255),
        "source_id" varchar(255) NOT NULL,
        "document_id" varchar(255) NOT NULL,
        "chunk_id" varchar(255) NOT NULL,
        "provider" varchar(80) NOT NULL,
        "model" varchar(160) NOT NULL,
        "dimensions" integer DEFAULT 0 NOT NULL,
        "embedding" jsonb NOT NULL,
        "embedding_hash" varchar(128) NOT NULL,
        "status" "knowledge_embedding_status" DEFAULT 'ready' NOT NULL,
        "error_message" text,
        "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "computed_at" timestamp with time zone DEFAULT now() NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "deleted_at" timestamp with time zone,
        "created_by" varchar(255),
        "updated_by" varchar(255),
        "deleted_by" varchar(255)
      );

      CREATE TABLE IF NOT EXISTS "knowledge_edges" (
        "id" varchar(255) PRIMARY KEY NOT NULL,
        "biz_id" varchar(255),
        "from_document_id" varchar(255) NOT NULL,
        "to_document_id" varchar(255) NOT NULL,
        "edge_type" "knowledge_edge_type" DEFAULT 'related' NOT NULL,
        "weight_bps" integer DEFAULT 10000 NOT NULL,
        "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "deleted_at" timestamp with time zone,
        "created_by" varchar(255),
        "updated_by" varchar(255),
        "deleted_by" varchar(255)
      );

      CREATE TABLE IF NOT EXISTS "knowledge_agent_runs" (
        "id" varchar(255) PRIMARY KEY NOT NULL,
        "biz_id" varchar(255),
        "agent_kind" "knowledge_agent_kind" DEFAULT 'system' NOT NULL,
        "agent_name" varchar(160) NOT NULL,
        "run_key" varchar(220),
        "objective" text NOT NULL,
        "input_summary" text,
        "output_summary" text,
        "decisions" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "unresolved_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "knowledge_cursor" varchar(220),
        "status" "knowledge_agent_run_status" DEFAULT 'running' NOT NULL,
        "started_at" timestamp with time zone DEFAULT now() NOT NULL,
        "ended_at" timestamp with time zone,
        "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "deleted_at" timestamp with time zone,
        "created_by" varchar(255),
        "updated_by" varchar(255),
        "deleted_by" varchar(255)
      );

      CREATE TABLE IF NOT EXISTS "knowledge_retrieval_traces" (
        "id" varchar(255) PRIMARY KEY NOT NULL,
        "biz_id" varchar(255),
        "agent_run_id" varchar(255),
        "query_text" text NOT NULL,
        "mode" "knowledge_retrieval_mode" DEFAULT 'hybrid' NOT NULL,
        "scope" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "result_document_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "result_chunk_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "result_scores" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "top_score_bps" integer,
        "model_provider" varchar(80),
        "model" varchar(160),
        "latency_ms" integer,
        "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "deleted_at" timestamp with time zone,
        "created_by" varchar(255),
        "updated_by" varchar(255),
        "deleted_by" varchar(255)
      );

      CREATE TABLE IF NOT EXISTS "knowledge_events" (
        "id" varchar(255) PRIMARY KEY NOT NULL,
        "biz_id" varchar(255),
        "source_id" varchar(255),
        "document_id" varchar(255),
        "chunk_id" varchar(255),
        "agent_run_id" varchar(255),
        "event_type" "knowledge_event_type" NOT NULL,
        "status" "knowledge_event_status" DEFAULT 'queued' NOT NULL,
        "message" text,
        "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "result" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "deleted_at" timestamp with time zone,
        "created_by" varchar(255),
        "updated_by" varchar(255),
        "deleted_by" varchar(255)
      );

      CREATE TABLE IF NOT EXISTS "knowledge_checkpoints" (
        "id" varchar(255) PRIMARY KEY NOT NULL,
        "biz_id" varchar(255),
        "agent_kind" "knowledge_agent_kind" NOT NULL,
        "agent_name" varchar(160) NOT NULL,
        "checkpoint_key" varchar(120) DEFAULT 'global' NOT NULL,
        "last_knowledge_event_id" varchar(255),
        "last_commit_sha" varchar(120),
        "last_document_hash" varchar(128),
        "last_ingested_at" timestamp with time zone,
        "last_observed_at" timestamp with time zone DEFAULT now() NOT NULL,
        "status" "knowledge_checkpoint_status" DEFAULT 'healthy' NOT NULL,
        "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "deleted_at" timestamp with time zone,
        "created_by" varchar(255),
        "updated_by" varchar(255),
        "deleted_by" varchar(255)
      );
    `);

    /**
     * Repair audit-column drift on previously bootstrapped DBs.
     *
     * ELI5:
     * Early v0 bootstrap rows created knowledge tables without actor columns.
     * Routes now read/write created_by/updated_by/deleted_by through canonical
     * schema, so we make those columns (and user FKs) deterministic here.
     */
    await client.query(`
      DO $$
      DECLARE
        table_name text;
        fk_name text;
      BEGIN
        FOREACH table_name IN ARRAY ARRAY[
          'knowledge_sources',
          'knowledge_documents',
          'knowledge_chunks',
          'knowledge_embeddings',
          'knowledge_edges',
          'knowledge_agent_runs',
          'knowledge_retrieval_traces',
          'knowledge_events',
          'knowledge_checkpoints'
        ] LOOP
          EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_by varchar(255)', table_name);
          EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_by varchar(255)', table_name);
          EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_by varchar(255)', table_name);

          fk_name := table_name || '_created_by_users_fk';
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = fk_name
          ) THEN
            EXECUTE format(
              'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION',
              table_name, fk_name
            );
          END IF;

          fk_name := table_name || '_updated_by_users_fk';
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = fk_name
          ) THEN
            EXECUTE format(
              'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION',
              table_name, fk_name
            );
          END IF;

          fk_name := table_name || '_deleted_by_users_fk';
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = fk_name
          ) THEN
            EXECUTE format(
              'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION',
              table_name, fk_name
            );
          END IF;
        END LOOP;
      END
      $$;
    `);

    await client.query(`
      DROP INDEX IF EXISTS "knowledge_sources_source_key_unique";
      CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_sources_global_source_key_unique"
      ON "knowledge_sources" ("source_key")
      WHERE "biz_id" IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_sources_biz_source_key_unique"
      ON "knowledge_sources" ("biz_id", "source_key")
      WHERE "biz_id" IS NOT NULL;
      CREATE INDEX IF NOT EXISTS "knowledge_sources_biz_type_status_idx"
      ON "knowledge_sources" ("biz_id", "source_type", "status");

      CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_documents_source_key_hash_unique"
      ON "knowledge_documents" ("source_id", "document_key", "content_hash");
      CREATE INDEX IF NOT EXISTS "knowledge_documents_biz_source_status_idx"
      ON "knowledge_documents" ("biz_id", "source_id", "status");
      CREATE INDEX IF NOT EXISTS "knowledge_documents_updated_idx"
      ON "knowledge_documents" ("updated_at");

      CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_chunks_document_chunk_version_unique"
      ON "knowledge_chunks" ("document_id", "chunk_index", "chunk_hash");
      CREATE INDEX IF NOT EXISTS "knowledge_chunks_source_doc_idx"
      ON "knowledge_chunks" ("source_id", "document_id");
      CREATE INDEX IF NOT EXISTS "knowledge_chunks_biz_status_idx"
      ON "knowledge_chunks" ("biz_id", "status");

      CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_embeddings_chunk_provider_model_unique"
      ON "knowledge_embeddings" ("chunk_id", "provider", "model");
      CREATE INDEX IF NOT EXISTS "knowledge_embeddings_biz_doc_idx"
      ON "knowledge_embeddings" ("biz_id", "document_id");
      CREATE INDEX IF NOT EXISTS "knowledge_embeddings_status_computed_idx"
      ON "knowledge_embeddings" ("status", "computed_at");

      CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_edges_unique"
      ON "knowledge_edges" ("from_document_id", "to_document_id", "edge_type");
      CREATE INDEX IF NOT EXISTS "knowledge_edges_biz_type_idx"
      ON "knowledge_edges" ("biz_id", "edge_type");

      CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_agent_runs_run_key_unique"
      ON "knowledge_agent_runs" ("run_key");
      CREATE INDEX IF NOT EXISTS "knowledge_agent_runs_agent_status_idx"
      ON "knowledge_agent_runs" ("agent_kind", "agent_name", "status");
      CREATE INDEX IF NOT EXISTS "knowledge_agent_runs_biz_started_idx"
      ON "knowledge_agent_runs" ("biz_id", "started_at");

      CREATE INDEX IF NOT EXISTS "knowledge_retrieval_traces_agent_occurred_idx"
      ON "knowledge_retrieval_traces" ("agent_run_id", "occurred_at");
      CREATE INDEX IF NOT EXISTS "knowledge_retrieval_traces_biz_occurred_idx"
      ON "knowledge_retrieval_traces" ("biz_id", "occurred_at");

      CREATE INDEX IF NOT EXISTS "knowledge_events_type_occurred_idx"
      ON "knowledge_events" ("event_type", "occurred_at");
      CREATE INDEX IF NOT EXISTS "knowledge_events_biz_occurred_idx"
      ON "knowledge_events" ("biz_id", "occurred_at");

      DROP INDEX IF EXISTS "knowledge_checkpoints_agent_key_unique";
      CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_checkpoints_global_agent_key_unique"
      ON "knowledge_checkpoints" ("agent_kind", "agent_name", "checkpoint_key")
      WHERE "biz_id" IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_checkpoints_biz_agent_key_unique"
      ON "knowledge_checkpoints" ("biz_id", "agent_kind", "agent_name", "checkpoint_key")
      WHERE "biz_id" IS NOT NULL;
      CREATE INDEX IF NOT EXISTS "knowledge_checkpoints_biz_observed_idx"
      ON "knowledge_checkpoints" ("biz_id", "last_observed_at");
    `);

    await client.query(`
      ALTER TABLE "knowledge_documents"
      DROP CONSTRAINT IF EXISTS "knowledge_documents_non_negative_counts_check";
      ALTER TABLE "knowledge_documents"
      ADD CONSTRAINT "knowledge_documents_non_negative_counts_check"
      CHECK ("token_estimate" >= 0 AND "word_count" >= 0);

      ALTER TABLE "knowledge_chunks"
      DROP CONSTRAINT IF EXISTS "knowledge_chunks_offsets_check";
      ALTER TABLE "knowledge_chunks"
      ADD CONSTRAINT "knowledge_chunks_offsets_check"
      CHECK ("chunk_index" >= 0 AND "token_estimate" >= 0 AND "char_start" >= 0 AND "char_end" >= "char_start");

      ALTER TABLE "knowledge_embeddings"
      DROP CONSTRAINT IF EXISTS "knowledge_embeddings_dimensions_check";
      ALTER TABLE "knowledge_embeddings"
      ADD CONSTRAINT "knowledge_embeddings_dimensions_check"
      CHECK ("dimensions" >= 0);

      ALTER TABLE "knowledge_edges"
      DROP CONSTRAINT IF EXISTS "knowledge_edges_weight_check";
      ALTER TABLE "knowledge_edges"
      ADD CONSTRAINT "knowledge_edges_weight_check"
      CHECK ("weight_bps" >= 0 AND "weight_bps" <= 10000 AND "from_document_id" <> "to_document_id");

      ALTER TABLE "knowledge_agent_runs"
      DROP CONSTRAINT IF EXISTS "knowledge_agent_runs_timeline_check";
      ALTER TABLE "knowledge_agent_runs"
      ADD CONSTRAINT "knowledge_agent_runs_timeline_check"
      CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at");

      ALTER TABLE "knowledge_retrieval_traces"
      DROP CONSTRAINT IF EXISTS "knowledge_retrieval_traces_scores_check";
      ALTER TABLE "knowledge_retrieval_traces"
      ADD CONSTRAINT "knowledge_retrieval_traces_scores_check"
      CHECK ((top_score_bps IS NULL OR (top_score_bps >= 0 AND top_score_bps <= 10000))
             AND (latency_ms IS NULL OR latency_ms >= 0));
    `);

    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bizes') THEN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_sources_biz_id_bizes_id_fk') THEN
            ALTER TABLE "knowledge_sources"
              ADD CONSTRAINT "knowledge_sources_biz_id_bizes_id_fk"
              FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_documents_biz_id_bizes_id_fk') THEN
            ALTER TABLE "knowledge_documents"
              ADD CONSTRAINT "knowledge_documents_biz_id_bizes_id_fk"
              FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_chunks_biz_id_bizes_id_fk') THEN
            ALTER TABLE "knowledge_chunks"
              ADD CONSTRAINT "knowledge_chunks_biz_id_bizes_id_fk"
              FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_embeddings_biz_id_bizes_id_fk') THEN
            ALTER TABLE "knowledge_embeddings"
              ADD CONSTRAINT "knowledge_embeddings_biz_id_bizes_id_fk"
              FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_edges_biz_id_bizes_id_fk') THEN
            ALTER TABLE "knowledge_edges"
              ADD CONSTRAINT "knowledge_edges_biz_id_bizes_id_fk"
              FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_agent_runs_biz_id_bizes_id_fk') THEN
            ALTER TABLE "knowledge_agent_runs"
              ADD CONSTRAINT "knowledge_agent_runs_biz_id_bizes_id_fk"
              FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_retrieval_traces_biz_id_bizes_id_fk') THEN
            ALTER TABLE "knowledge_retrieval_traces"
              ADD CONSTRAINT "knowledge_retrieval_traces_biz_id_bizes_id_fk"
              FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_events_biz_id_bizes_id_fk') THEN
            ALTER TABLE "knowledge_events"
              ADD CONSTRAINT "knowledge_events_biz_id_bizes_id_fk"
              FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_checkpoints_biz_id_bizes_id_fk') THEN
            ALTER TABLE "knowledge_checkpoints"
              ADD CONSTRAINT "knowledge_checkpoints_biz_id_bizes_id_fk"
              FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
          END IF;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_documents_source_id_knowledge_sources_id_fk') THEN
          ALTER TABLE "knowledge_documents"
            ADD CONSTRAINT "knowledge_documents_source_id_knowledge_sources_id_fk"
            FOREIGN KEY ("source_id") REFERENCES "knowledge_sources"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_chunks_source_id_knowledge_sources_id_fk') THEN
          ALTER TABLE "knowledge_chunks"
            ADD CONSTRAINT "knowledge_chunks_source_id_knowledge_sources_id_fk"
            FOREIGN KEY ("source_id") REFERENCES "knowledge_sources"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_chunks_document_id_knowledge_documents_id_fk') THEN
          ALTER TABLE "knowledge_chunks"
            ADD CONSTRAINT "knowledge_chunks_document_id_knowledge_documents_id_fk"
            FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_embeddings_source_id_knowledge_sources_id_fk') THEN
          ALTER TABLE "knowledge_embeddings"
            ADD CONSTRAINT "knowledge_embeddings_source_id_knowledge_sources_id_fk"
            FOREIGN KEY ("source_id") REFERENCES "knowledge_sources"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_embeddings_document_id_knowledge_documents_id_fk') THEN
          ALTER TABLE "knowledge_embeddings"
            ADD CONSTRAINT "knowledge_embeddings_document_id_knowledge_documents_id_fk"
            FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_embeddings_chunk_id_knowledge_chunks_id_fk') THEN
          ALTER TABLE "knowledge_embeddings"
            ADD CONSTRAINT "knowledge_embeddings_chunk_id_knowledge_chunks_id_fk"
            FOREIGN KEY ("chunk_id") REFERENCES "knowledge_chunks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_edges_from_document_id_knowledge_documents_id_fk') THEN
          ALTER TABLE "knowledge_edges"
            ADD CONSTRAINT "knowledge_edges_from_document_id_knowledge_documents_id_fk"
            FOREIGN KEY ("from_document_id") REFERENCES "knowledge_documents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_edges_to_document_id_knowledge_documents_id_fk') THEN
          ALTER TABLE "knowledge_edges"
            ADD CONSTRAINT "knowledge_edges_to_document_id_knowledge_documents_id_fk"
            FOREIGN KEY ("to_document_id") REFERENCES "knowledge_documents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_retrieval_traces_agent_run_id_knowledge_agent_runs_id_fk') THEN
          ALTER TABLE "knowledge_retrieval_traces"
            ADD CONSTRAINT "knowledge_retrieval_traces_agent_run_id_knowledge_agent_runs_id_fk"
            FOREIGN KEY ("agent_run_id") REFERENCES "knowledge_agent_runs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_events_source_id_knowledge_sources_id_fk') THEN
          ALTER TABLE "knowledge_events"
            ADD CONSTRAINT "knowledge_events_source_id_knowledge_sources_id_fk"
            FOREIGN KEY ("source_id") REFERENCES "knowledge_sources"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_events_document_id_knowledge_documents_id_fk') THEN
          ALTER TABLE "knowledge_events"
            ADD CONSTRAINT "knowledge_events_document_id_knowledge_documents_id_fk"
            FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_events_chunk_id_knowledge_chunks_id_fk') THEN
          ALTER TABLE "knowledge_events"
            ADD CONSTRAINT "knowledge_events_chunk_id_knowledge_chunks_id_fk"
            FOREIGN KEY ("chunk_id") REFERENCES "knowledge_chunks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_events_agent_run_id_knowledge_agent_runs_id_fk') THEN
          ALTER TABLE "knowledge_events"
            ADD CONSTRAINT "knowledge_events_agent_run_id_knowledge_agent_runs_id_fk"
            FOREIGN KEY ("agent_run_id") REFERENCES "knowledge_agent_runs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_checkpoints_last_knowledge_event_id_knowledge_events_id_fk') THEN
          ALTER TABLE "knowledge_checkpoints"
            ADD CONSTRAINT "knowledge_checkpoints_last_knowledge_event_id_knowledge_events_id_fk"
            FOREIGN KEY ("last_knowledge_event_id") REFERENCES "knowledge_events"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    console.log(
      JSON.stringify({
        ok: true,
        ensured: [
          "knowledge_* enums",
          "knowledge_sources",
          "knowledge_documents",
          "knowledge_chunks",
          "knowledge_embeddings",
          "knowledge_edges",
          "knowledge_agent_runs",
          "knowledge_retrieval_traces",
          "knowledge_events",
          "knowledge_checkpoints",
        ],
      }),
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[bootstrap-knowledge] failed");
  console.error(error);
  process.exit(1);
});
