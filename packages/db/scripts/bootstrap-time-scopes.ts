import "dotenv/config";
import { Client } from "pg";

/**
 * Ensures canonical `time_scopes` exists in live databases.
 *
 * Why this script exists:
 * - saga + API runtime now rely on `time_scopes` as the canonical scheduling
 *   scope dictionary.
 * - older local databases may predate the module and miss both enum/table.
 * - this script is idempotent and safe to run during bootstrap/migrate flows.
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
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'time_scope_type') THEN
          CREATE TYPE "time_scope_type" AS ENUM (
            'biz',
            'user',
            'location',
            'calendar',
            'schedule_subject',
            'resource',
            'capacity_pool',
            'service',
            'service_product',
            'offer',
            'offer_version',
            'product',
            'sellable',
            'custom_subject'
          );
        END IF;
      END
      $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "time_scopes" (
        "id" varchar(255) PRIMARY KEY NOT NULL,
        "biz_id" varchar(255) NOT NULL,
        "scope_type" "time_scope_type" NOT NULL,
        "scope_ref_type" varchar(80),
        "scope_ref_id" varchar(255),
        "scope_ref_key" varchar(320) NOT NULL,
        "display_name" varchar(220),
        "is_active" boolean DEFAULT true NOT NULL,
        "policy" jsonb DEFAULT '{}'::jsonb,
        "metadata" jsonb DEFAULT '{}'::jsonb,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "deleted_at" timestamp with time zone,
        "created_by" varchar(255),
        "updated_by" varchar(255),
        "deleted_by" varchar(255),
        CONSTRAINT "time_scopes_biz_id_bizes_id_fk"
          FOREIGN KEY ("biz_id") REFERENCES "bizes"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "time_scopes_created_by_users_id_fk"
          FOREIGN KEY ("created_by") REFERENCES "users"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "time_scopes_updated_by_users_id_fk"
          FOREIGN KEY ("updated_by") REFERENCES "users"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "time_scopes_deleted_by_users_id_fk"
          FOREIGN KEY ("deleted_by") REFERENCES "users"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION
      );
    `);

    await client.query(`
      ALTER TABLE "time_scopes"
      DROP CONSTRAINT IF EXISTS "time_scopes_shape_check";
      ALTER TABLE "time_scopes"
      ADD CONSTRAINT "time_scopes_shape_check"
      CHECK (
        length("scope_ref_key") > 0
        AND (
          ("scope_ref_type" IS NULL AND "scope_ref_id" IS NULL)
          OR ("scope_ref_type" IS NOT NULL AND "scope_ref_id" IS NOT NULL)
        )
      );
    `);

    await client.query(`
      ALTER TABLE "time_scopes"
      DROP CONSTRAINT IF EXISTS "time_scopes_biz_scope_subject_fk";
      ALTER TABLE "time_scopes"
      ADD CONSTRAINT "time_scopes_biz_scope_subject_fk"
      FOREIGN KEY ("biz_id", "scope_ref_type", "scope_ref_id")
      REFERENCES "subjects"("biz_id", "subject_type", "subject_id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "time_scopes_biz_id_id_unique"
      ON "time_scopes" ("biz_id", "id");
      CREATE UNIQUE INDEX IF NOT EXISTS "time_scopes_biz_scope_ref_unique"
      ON "time_scopes" ("biz_id", "scope_ref_key");
      CREATE INDEX IF NOT EXISTS "time_scopes_biz_scope_type_active_idx"
      ON "time_scopes" ("biz_id", "scope_type", "is_active");
      CREATE INDEX IF NOT EXISTS "time_scopes_biz_scope_subject_idx"
      ON "time_scopes" ("biz_id", "scope_ref_type", "scope_ref_id");
    `);

    /**
     * Older DB snapshots may have capacity-hold tables without the canonical
     * `time_scope_id` bridge column. Add them in-place so runtime/sagas can use
     * the normalized scope model immediately.
     */
    await client.query(`
      ALTER TABLE "capacity_hold_policies"
      ADD COLUMN IF NOT EXISTS "time_scope_id" varchar(255);
      ALTER TABLE "capacity_holds"
      ADD COLUMN IF NOT EXISTS "time_scope_id" varchar(255);
      ALTER TABLE "capacity_hold_demand_alerts"
      ADD COLUMN IF NOT EXISTS "time_scope_id" varchar(255);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "capacity_hold_policies_biz_time_scope_status_idx"
      ON "capacity_hold_policies" ("biz_id", "time_scope_id", "status", "priority");
      CREATE INDEX IF NOT EXISTS "capacity_holds_biz_time_scope_status_window_idx"
      ON "capacity_holds" ("biz_id", "time_scope_id", "status", "starts_at", "ends_at");
      CREATE INDEX IF NOT EXISTS "capacity_hold_demand_alerts_biz_time_scope_status_window_idx"
      ON "capacity_hold_demand_alerts" ("biz_id", "time_scope_id", "status", "window_start_at", "window_end_at");
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'capacity_hold_policies_biz_time_scope_fk'
        ) THEN
          ALTER TABLE "capacity_hold_policies"
          ADD CONSTRAINT "capacity_hold_policies_biz_time_scope_fk"
          FOREIGN KEY ("biz_id", "time_scope_id")
          REFERENCES "time_scopes" ("biz_id", "id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'capacity_holds_biz_time_scope_fk'
        ) THEN
          ALTER TABLE "capacity_holds"
          ADD CONSTRAINT "capacity_holds_biz_time_scope_fk"
          FOREIGN KEY ("biz_id", "time_scope_id")
          REFERENCES "time_scopes" ("biz_id", "id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'capacity_hold_demand_alerts_biz_time_scope_fk'
        ) THEN
          ALTER TABLE "capacity_hold_demand_alerts"
          ADD CONSTRAINT "capacity_hold_demand_alerts_biz_time_scope_fk"
          FOREIGN KEY ("biz_id", "time_scope_id")
          REFERENCES "time_scopes" ("biz_id", "id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    console.log(
      JSON.stringify({
        ok: true,
        ensured: [
          "time_scope_type",
          "time_scopes",
          "capacity_hold_policies.time_scope_id",
          "capacity_holds.time_scope_id",
          "capacity_hold_demand_alerts.time_scope_id",
        ],
      }),
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[bootstrap-time-scopes] failed");
  console.error(error);
  process.exit(1);
});
