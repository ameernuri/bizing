import "dotenv/config";
import { Client } from "pg";

/**
 * Ensures canonical saga depth lane columns exist in live databases.
 *
 * Why this exists:
 * - saga lane filtering (`shallow`/`medium`/`deep`) is now first-class in
 *   API, runner presets, and OODash.
 * - older local DB snapshots may miss the enum and/or columns.
 * - this script is idempotent and safe in repeated bootstrap flows.
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
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'saga_depth') THEN
          CREATE TYPE "saga_depth" AS ENUM ('shallow', 'medium', 'deep');
        END IF;
      END
      $$;
    `);

    await client.query(`
      ALTER TABLE IF EXISTS "saga_definitions"
      ADD COLUMN IF NOT EXISTS "depth" "saga_depth" DEFAULT 'medium' NOT NULL;

      ALTER TABLE IF EXISTS "saga_runs"
      ADD COLUMN IF NOT EXISTS "depth" "saga_depth" DEFAULT 'medium' NOT NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "saga_definitions_depth_status_idx"
      ON "saga_definitions" ("depth", "status");

      CREATE INDEX IF NOT EXISTS "saga_runs_depth_status_created_idx"
      ON "saga_runs" ("depth", "status", "started_at");
    `);

    console.log(
      JSON.stringify({
        ok: true,
        ensured: [
          "saga_depth",
          "saga_definitions.depth",
          "saga_runs.depth",
          "saga_definitions_depth_status_idx",
          "saga_runs_depth_status_created_idx",
        ],
      }),
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[bootstrap-saga-depth] failed");
  console.error(error);
  process.exit(1);
});

