import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

/**
 * Repairs partial index definitions after schema bootstrap.
 *
 * Why this exists:
 * - The canonical v0 schema uses many partial indexes to express "only one
 *   active/default row under these conditions".
 * - `drizzle-kit push` is currently flattening some of those into plain indexes
 *   on fresh databases.
 * - That creates fake uniqueness collisions during saga runs even though the
 *   schema files are correct.
 *
 * ELI5:
 * We read the source-of-truth SQL, find every index that says "only when this
 * condition is true", then make the live database match that exact rule.
 */

type PartialIndexSpec = {
  name: string;
  createSql: string;
};

function normalizeSql(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

async function loadCanonicalPartialIndexes(): Promise<PartialIndexSpec[]> {
  const migrationPath = path.resolve(
    import.meta.dir,
    "../migrations/0000_luxuriant_goblin_queen.sql",
  );
  const sql = await readFile(migrationPath, "utf8");

  /**
   * Drizzle migrations use `--> statement-breakpoint` between executable
   * statements. Splitting on that marker keeps parsing deterministic and avoids
   * accidental multi-statement regex matches.
   */
  const specs: PartialIndexSpec[] = [];
  const statements = sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    if (!/CREATE(?: UNIQUE)? INDEX IF NOT EXISTS /i.test(statement)) continue;
    if (!/\bWHERE\b/i.test(statement)) continue;

    const nameMatch = statement.match(
      /CREATE(?: UNIQUE)? INDEX IF NOT EXISTS "([^"]+)"/i,
    );
    if (!nameMatch) continue;

    const name = nameMatch[1];
    specs.push({ name, createSql: statement });
  }

  /**
   * Some schema files define partial indexes that are currently not emitted into
   * the generated baseline SQL consistently. We hard-code them here so the live
   * database still matches the canonical schema contract used by the API and
   * saga suite.
   *
   * ELI5:
   * If the schema says "only one active primary calendar per user", the real
   * database must enforce exactly that condition. A flattened plain unique index
   * turns valid scenario rows into fake failures.
   */
  const manualSpecs: PartialIndexSpec[] = [
    {
      name: "calendar_bindings_primary_per_biz_unique",
      createSql:
        'CREATE UNIQUE INDEX IF NOT EXISTS "calendar_bindings_primary_per_biz_unique" ON "calendar_bindings" ("biz_id") WHERE "owner_type" = \'biz\' AND "is_primary" = true AND "is_active" = true AND "deleted_at" IS NULL',
    },
    {
      name: "calendar_bindings_primary_per_user_unique",
      createSql:
        'CREATE UNIQUE INDEX IF NOT EXISTS "calendar_bindings_primary_per_user_unique" ON "calendar_bindings" ("biz_id","owner_user_id") WHERE "owner_type" = \'user\' AND "is_primary" = true AND "is_active" = true AND "deleted_at" IS NULL',
    },
    {
      name: "calendar_bindings_primary_per_resource_unique",
      createSql:
        'CREATE UNIQUE INDEX IF NOT EXISTS "calendar_bindings_primary_per_resource_unique" ON "calendar_bindings" ("biz_id","resource_id") WHERE "owner_type" = \'resource\' AND "is_primary" = true AND "is_active" = true AND "deleted_at" IS NULL',
    },
    {
      name: "calendar_bindings_primary_per_service_unique",
      createSql:
        'CREATE UNIQUE INDEX IF NOT EXISTS "calendar_bindings_primary_per_service_unique" ON "calendar_bindings" ("biz_id","service_id") WHERE "owner_type" = \'service\' AND "is_primary" = true AND "is_active" = true AND "deleted_at" IS NULL',
    },
    {
      name: "calendar_bindings_primary_per_service_product_unique",
      createSql:
        'CREATE UNIQUE INDEX IF NOT EXISTS "calendar_bindings_primary_per_service_product_unique" ON "calendar_bindings" ("biz_id","service_product_id") WHERE "owner_type" = \'service_product\' AND "is_primary" = true AND "is_active" = true AND "deleted_at" IS NULL',
    },
    {
      name: "calendar_bindings_primary_per_offer_unique",
      createSql:
        'CREATE UNIQUE INDEX IF NOT EXISTS "calendar_bindings_primary_per_offer_unique" ON "calendar_bindings" ("biz_id","offer_id") WHERE "owner_type" = \'offer\' AND "is_primary" = true AND "is_active" = true AND "deleted_at" IS NULL',
    },
    {
      name: "calendar_bindings_primary_per_offer_version_unique",
      createSql:
        'CREATE UNIQUE INDEX IF NOT EXISTS "calendar_bindings_primary_per_offer_version_unique" ON "calendar_bindings" ("biz_id","offer_version_id") WHERE "owner_type" = \'offer_version\' AND "is_primary" = true AND "is_active" = true AND "deleted_at" IS NULL',
    },
    {
      name: "calendar_bindings_primary_per_location_unique",
      createSql:
        'CREATE UNIQUE INDEX IF NOT EXISTS "calendar_bindings_primary_per_location_unique" ON "calendar_bindings" ("biz_id","location_id") WHERE "owner_type" = \'location\' AND "is_primary" = true AND "is_active" = true AND "deleted_at" IS NULL',
    },
    {
      name: "calendar_bindings_primary_per_custom_subject_unique",
      createSql:
        'CREATE UNIQUE INDEX IF NOT EXISTS "calendar_bindings_primary_per_custom_subject_unique" ON "calendar_bindings" ("biz_id","owner_ref_type","owner_ref_id") WHERE "owner_type" = \'custom_subject\' AND "is_primary" = true AND "is_active" = true AND "deleted_at" IS NULL',
    },
    {
      name: "calendar_bindings_primary_per_schedule_subject_unique",
      createSql:
        'CREATE UNIQUE INDEX IF NOT EXISTS "calendar_bindings_primary_per_schedule_subject_unique" ON "calendar_bindings" ("biz_id","schedule_subject_id") WHERE "schedule_subject_id" IS NOT NULL AND "is_primary" = true AND "is_active" = true AND "deleted_at" IS NULL',
    },
    {
      name: "projection_checkpoints_biz_scope_unique",
      createSql:
        'CREATE UNIQUE INDEX IF NOT EXISTS "projection_checkpoints_biz_scope_unique" ON "projection_checkpoints" ("biz_id","projection_key") WHERE "scope_type" = \'biz\' AND "deleted_at" IS NULL',
    },
    {
      name: "projection_checkpoints_location_scope_unique",
      createSql:
        'CREATE UNIQUE INDEX IF NOT EXISTS "projection_checkpoints_location_scope_unique" ON "projection_checkpoints" ("biz_id","projection_key","location_id") WHERE "scope_type" = \'location\' AND "deleted_at" IS NULL',
    },
    {
      name: "projection_checkpoints_resource_scope_unique",
      createSql:
        'CREATE UNIQUE INDEX IF NOT EXISTS "projection_checkpoints_resource_scope_unique" ON "projection_checkpoints" ("biz_id","projection_key","resource_id") WHERE "scope_type" = \'resource\' AND "deleted_at" IS NULL',
    },
    {
      name: "projection_checkpoints_sellable_scope_unique",
      createSql:
        'CREATE UNIQUE INDEX IF NOT EXISTS "projection_checkpoints_sellable_scope_unique" ON "projection_checkpoints" ("biz_id","projection_key","sellable_id") WHERE "scope_type" = \'sellable\' AND "deleted_at" IS NULL',
    },
    {
      name: "projection_checkpoints_custom_subject_scope_unique",
      createSql:
        'CREATE UNIQUE INDEX IF NOT EXISTS "projection_checkpoints_custom_subject_scope_unique" ON "projection_checkpoints" ("biz_id","projection_key","subject_type","subject_id") WHERE "scope_type" = \'custom_subject\' AND "deleted_at" IS NULL',
    },
    {
      name: "graph_identity_notification_endpoints_destination_unique",
      createSql:
        'CREATE UNIQUE INDEX IF NOT EXISTS "graph_identity_notification_endpoints_destination_unique" ON "graph_identity_notification_endpoints" ("owner_identity_id","channel","destination") WHERE "deleted_at" IS NULL AND "destination" IS NOT NULL',
    },
    {
      name: "graph_identity_notification_endpoints_default_unique",
      createSql:
        'CREATE UNIQUE INDEX IF NOT EXISTS "graph_identity_notification_endpoints_default_unique" ON "graph_identity_notification_endpoints" ("owner_identity_id","channel") WHERE "is_default" = true AND "deleted_at" IS NULL',
    },
    {
      name: "user_credential_documents_primary_per_record_unique",
      createSql:
        'CREATE UNIQUE INDEX IF NOT EXISTS "user_credential_documents_primary_per_record_unique" ON "user_credential_documents" ("owner_user_id","user_credential_record_id") WHERE "is_primary" = true AND "deleted_at" IS NULL',
    },
  ];

  for (const spec of manualSpecs) {
    if (!specs.some((existing) => existing.name === spec.name)) {
      specs.push(spec);
    }
  }

  return specs;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  const client = new Client({ connectionString });
  await client.connect();

  const specs = await loadCanonicalPartialIndexes();
  const repaired: string[] = [];
  const alreadyCanonical: string[] = [];
  let lifecycleDeliveryFkRepaired = false;

  try {
    for (const spec of specs) {
      const existing = await client.query<{
        indexdef: string;
      }>(
        `
        SELECT indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = $1
        `,
        [spec.name],
      );

      const expected = normalizeSql(
        spec.createSql.replace("IF NOT EXISTS ", "").replace(/;$/, ""),
      );
      const actual = normalizeSql(existing.rows[0]?.indexdef ?? "");

      if (actual === expected) {
        alreadyCanonical.push(spec.name);
        continue;
      }

      /**
       * Drop/recreate is intentional:
       * - if the index was flattened, CREATE IF NOT EXISTS would no-op
       * - re-creating from the canonical statement makes the database match the
       *   schema we actually designed
       */
      await client.query(`DROP INDEX IF EXISTS "${spec.name}"`);
      await client.query(spec.createSql);
      repaired.push(spec.name);
    }

    /**
     * Canonical FK repair for lifecycle deliveries.
     *
     * Why this exists:
     * - Older local DB states may still point lifecycle delivery rows to
     *   `lifecycle_events` instead of canonical `domain_events`.
     * - The API now writes canonical domain events only, so stale FK targets
     *   cause false 409 failures in saga validation.
     *
     * ELI5:
     * If delivery rows say "this delivery belongs to event X", the database
     * must check event X in the canonical event table, not in a legacy table.
     */
    const lifecycleFkRows = await client.query<{ conname: string; def: string }>(
      `
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'lifecycle_event_deliveries'::regclass
        AND contype = 'f'
        AND (
          conname IN (
            'lifecycle_event_deliveries_biz_event_fk',
            'lifecycle_event_deliveries_lifecycle_event_id_lifecycle_events_',
            'lifecycle_event_deliveries_lifecycle_event_id_domain_events_fk'
          )
          OR pg_get_constraintdef(oid) ILIKE '%lifecycle_events%'
          OR pg_get_constraintdef(oid) ILIKE '%domain_events%'
        )
      `,
    );
    const hasLegacyLifecycleTarget = lifecycleFkRows.rows.some((row) =>
      row.def.toLowerCase().includes("references lifecycle_events"),
    );
    if (hasLegacyLifecycleTarget) {
      await client.query("BEGIN");
      try {
        await client.query(`
          DELETE FROM lifecycle_event_deliveries d
          WHERE NOT EXISTS (
            SELECT 1
            FROM domain_events e
            WHERE e.id = d.lifecycle_event_id
              AND e.biz_id = d.biz_id
          )
        `);
        await client.query(`
          ALTER TABLE lifecycle_event_deliveries
            DROP CONSTRAINT IF EXISTS lifecycle_event_deliveries_biz_event_fk,
            DROP CONSTRAINT IF EXISTS lifecycle_event_deliveries_lifecycle_event_id_lifecycle_events_,
            DROP CONSTRAINT IF EXISTS lifecycle_event_deliveries_lifecycle_event_id_domain_events_fk
        `);
        await client.query(`
          ALTER TABLE lifecycle_event_deliveries
            ADD CONSTRAINT lifecycle_event_deliveries_biz_event_fk
              FOREIGN KEY (biz_id, lifecycle_event_id) REFERENCES domain_events(biz_id, id),
            ADD CONSTRAINT lifecycle_event_deliveries_lifecycle_event_id_domain_events_fk
              FOREIGN KEY (lifecycle_event_id) REFERENCES domain_events(id)
        `);
        await client.query("COMMIT");
        lifecycleDeliveryFkRepaired = true;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log(
      JSON.stringify(
        {
          inspected: specs.length,
          repaired,
          alreadyCanonicalCount: alreadyCanonical.length,
          lifecycleDeliveryFkRepaired,
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
  console.error("[repair-canonical-indexes] failed");
  console.error(error);
  process.exit(1);
});
