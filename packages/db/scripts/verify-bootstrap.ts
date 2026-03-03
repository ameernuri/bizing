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
  "projection_checkpoints",
  "crm_tasks",
];

const REQUIRED_PARTIAL_INDEXES = [
  "calendar_bindings_primary_per_biz_unique",
  "calendar_bindings_primary_per_user_unique",
  "projection_checkpoints_biz_scope_unique",
  "projection_checkpoints_location_scope_unique",
  "crm_pipelines_default_per_type_unique",
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

    if (missingTables.length || missingIndexes.length || nonPartialIndexes.length) {
      console.error(
        JSON.stringify(
          {
            ok: false,
            missingTables,
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
