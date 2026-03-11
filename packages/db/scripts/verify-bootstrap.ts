import "dotenv/config";
import { Client } from "pg";

/**
 * Verifies that a freshly bootstrapped DB matches canonical invariants.
 *
 * ELI5:
 * We do not trust "migration command exited 0" as proof.
 * We explicitly check core tables + critical partial indexes used by saga/API.
 */

const REQUIRED_TABLES = [
  "action_requests",
  "action_executions",
  "domain_events",
  "ooda_loops",
  "saga_runs",
  "saga_run_simulation_clocks",
  "saga_run_scheduler_jobs",
  "calendar_bindings",
  "time_scopes",
  "projection_checkpoints",
  "crm_tasks",
  "knowledge_sources",
  "knowledge_documents",
  "knowledge_chunks",
  "knowledge_embeddings",
  "knowledge_events",
  "knowledge_checkpoints",
];

const REQUIRED_PARTIAL_INDEXES = [
  "calendar_bindings_primary_per_biz_unique",
  "calendar_bindings_primary_per_user_unique",
  "projection_checkpoints_biz_scope_unique",
  "projection_checkpoints_location_scope_unique",
  "crm_pipelines_default_per_type_unique",
  "knowledge_sources_global_source_key_unique",
  "knowledge_sources_biz_source_key_unique",
  "knowledge_checkpoints_global_agent_key_unique",
  "knowledge_checkpoints_biz_agent_key_unique",
];

const REQUIRED_COLUMNS: Array<{ table: string; column: string }> = [
  { table: "saga_definitions", column: "depth" },
  { table: "saga_runs", column: "depth" },
  { table: "knowledge_sources", column: "created_by" },
  { table: "knowledge_documents", column: "created_by" },
  { table: "knowledge_chunks", column: "created_by" },
  { table: "knowledge_embeddings", column: "created_by" },
  { table: "knowledge_edges", column: "created_by" },
  { table: "knowledge_agent_runs", column: "created_by" },
  { table: "knowledge_retrieval_traces", column: "created_by" },
  { table: "knowledge_events", column: "created_by" },
  { table: "knowledge_checkpoints", column: "created_by" },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const tableRows = await client.query<{ table_name: string }>(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      `,
    );
    const existingTables = new Set(tableRows.rows.map((row) => row.table_name));
    const missingTables = REQUIRED_TABLES.filter((tableName) => !existingTables.has(tableName));

    const columnRows = await client.query<{ table_name: string; column_name: string }>(
      `
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      `,
    );
    const existingColumns = new Set(
      columnRows.rows.map((row) => `${row.table_name}.${row.column_name}`),
    );
    const missingColumns = REQUIRED_COLUMNS.filter(
      (ref) => !existingColumns.has(`${ref.table}.${ref.column}`),
    );

    const indexRows = await client.query<{ indexname: string; indexdef: string }>(
      `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      `,
    );
    const indexMap = new Map(indexRows.rows.map((row) => [row.indexname, row.indexdef]));
    const missingIndexes = REQUIRED_PARTIAL_INDEXES.filter((indexName) => !indexMap.has(indexName));
    const nonPartialIndexes = REQUIRED_PARTIAL_INDEXES.filter((indexName) => {
      const def = indexMap.get(indexName);
      if (!def) return false;
      return !/\bwhere\b/i.test(def);
    });

    if (
      missingTables.length ||
      missingColumns.length ||
      missingIndexes.length ||
      nonPartialIndexes.length
    ) {
      console.error(
        JSON.stringify(
          {
            ok: false,
            missingTables,
            missingColumns,
            missingIndexes,
            nonPartialIndexes,
            message:
              "Bootstrap verification failed. Run db:push/db:migrate again and ensure canonical index repair completed.",
          },
          null,
          2,
        ),
      );
      process.exit(1);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          checkedTables: REQUIRED_TABLES.length,
          checkedColumns: REQUIRED_COLUMNS.length,
          checkedPartialIndexes: REQUIRED_PARTIAL_INDEXES.length,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[verify-bootstrap] failed");
  console.error(error);
  process.exit(1);
});
