import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../src";

/**
 * Applies SQL migrations from `packages/db/migrations`.
 *
 * Keep this script tiny and deterministic so CI/ops can call
 * `bun run db:migrate` without environment-specific wrappers.
 */
async function run() {
  try {
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("Database migrations applied successfully.");
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
