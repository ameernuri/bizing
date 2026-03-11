CREATE TABLE IF NOT EXISTS "lifecycle_hook_contracts" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "key" varchar(180) NOT NULL,
  "name" varchar(220) NOT NULL,
  "status" "lifecycle_status" DEFAULT 'active' NOT NULL,
  "phase" "lifecycle_event_phase" DEFAULT 'after' NOT NULL,
  "trigger_mode" varchar(40) DEFAULT 'manual' NOT NULL,
  "target_type" varchar(120) NOT NULL,
  "mutability" varchar(20) DEFAULT 'effects' NOT NULL,
  "current_version" integer DEFAULT 1 NOT NULL,
  "description" varchar(2000),
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text,
  "deleted_by" text
);

CREATE TABLE IF NOT EXISTS "lifecycle_hook_contract_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "lifecycle_hook_contract_id" text NOT NULL,
  "version" integer NOT NULL,
  "status" "lifecycle_status" DEFAULT 'active' NOT NULL,
  "input_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "context_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "effect_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text,
  "deleted_by" text
);

CREATE TABLE IF NOT EXISTS "lifecycle_hook_invocations" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "lifecycle_hook_contract_id" text NOT NULL,
  "contract_key" varchar(180) NOT NULL,
  "contract_version" integer NOT NULL,
  "trigger_source" varchar(40) DEFAULT 'api' NOT NULL,
  "trigger_ref_id" varchar(160),
  "target_type" varchar(120) NOT NULL,
  "target_ref_id" varchar(160) NOT NULL,
  "status" varchar(20) DEFAULT 'running' NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "duration_ms" integer,
  "input_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "context_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "output_payload" jsonb DEFAULT '{}'::jsonb,
  "error_code" varchar(120),
  "error_message" varchar(2000),
  "idempotency_key" varchar(200),
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text,
  "deleted_by" text
);

ALTER TABLE "automation_hook_bindings"
  ADD COLUMN IF NOT EXISTS "lifecycle_hook_contract_id" text,
  ADD COLUMN IF NOT EXISTS "lifecycle_hook_contract_version" integer DEFAULT 1;

ALTER TABLE "automation_hook_runs"
  ADD COLUMN IF NOT EXISTS "lifecycle_hook_invocation_id" text;

INSERT INTO "lifecycle_hook_contracts" (
  "id",
  "biz_id",
  "key",
  "name",
  "status",
  "phase",
  "trigger_mode",
  "target_type",
  "mutability",
  "current_version",
  "description",
  "metadata"
)
SELECT
  'lifecycle_hook_contract_' || substring(md5(ahb."biz_id" || '::' || ahb."hook_point") from 1 for 27),
  ahb."biz_id",
  ahb."hook_point",
  ahb."hook_point",
  'active',
  CASE
    WHEN ahb."hook_point" LIKE '%.before_%' OR ahb."hook_point" LIKE '%._before_%' THEN 'before'::"lifecycle_event_phase"
    ELSE 'after'::"lifecycle_event_phase"
  END,
  'manual',
  COALESCE((ahb."filter" ->> 'targetType'), 'custom'),
  CASE
    WHEN ahb."hook_point" LIKE '%.before_%' OR ahb."hook_point" LIKE '%._before_%' THEN 'effects'
    ELSE 'effects'
  END,
  1,
  'Backfilled from automation_hook_bindings.hook_point',
  jsonb_build_object('source', 'migration.0004', 'backfilled', true)
FROM "automation_hook_bindings" ahb
ON CONFLICT DO NOTHING;

UPDATE "automation_hook_bindings" ahb
SET
  "lifecycle_hook_contract_id" = lhc."id",
  "lifecycle_hook_contract_version" = COALESCE(ahb."lifecycle_hook_contract_version", 1)
FROM "lifecycle_hook_contracts" lhc
WHERE
  ahb."lifecycle_hook_contract_id" IS NULL
  AND lhc."biz_id" = ahb."biz_id"
  AND lhc."key" = ahb."hook_point";

INSERT INTO "lifecycle_hook_contract_versions" (
  "id",
  "biz_id",
  "lifecycle_hook_contract_id",
  "version",
  "status",
  "input_schema",
  "context_schema",
  "effect_schema",
  "metadata"
)
SELECT
  'lifecycle_hook_contract_version_' || substring(md5(lhc."id" || '::1') from 1 for 27),
  lhc."biz_id",
  lhc."id",
  1,
  'active',
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  jsonb_build_object('source', 'migration.0004', 'backfilled', true)
FROM "lifecycle_hook_contracts" lhc
ON CONFLICT DO NOTHING;

INSERT INTO "lifecycle_hook_invocations" (
  "id",
  "biz_id",
  "lifecycle_hook_contract_id",
  "contract_key",
  "contract_version",
  "trigger_source",
  "trigger_ref_id",
  "target_type",
  "target_ref_id",
  "status",
  "started_at",
  "completed_at",
  "duration_ms",
  "input_payload",
  "context_payload",
  "output_payload",
  "error_code",
  "error_message",
  "idempotency_key",
  "metadata"
)
SELECT
  'lifecycle_hook_invocation_' || substring(md5(ahr."id") from 1 for 27),
  ahr."biz_id",
  ahb."lifecycle_hook_contract_id",
  ahb."hook_point",
  COALESCE(ahb."lifecycle_hook_contract_version", 1),
  'system',
  ahr."id",
  ahr."target_type",
  ahr."target_ref_id",
  ahr."status",
  ahr."started_at",
  ahr."completed_at",
  ahr."duration_ms",
  COALESCE(ahr."input_payload", '{}'::jsonb),
  jsonb_build_object('source', 'migration.0004', 'backfilled', true),
  COALESCE(ahr."output_payload", '{}'::jsonb),
  ahr."error_code",
  ahr."error_message",
  NULL,
  jsonb_build_object('source', 'migration.0004', 'backfilled', true, 'automationHookRunId', ahr."id")
FROM "automation_hook_runs" ahr
JOIN "automation_hook_bindings" ahb
  ON ahb."id" = ahr."automation_hook_binding_id"
  AND ahb."biz_id" = ahr."biz_id"
ON CONFLICT DO NOTHING;

UPDATE "automation_hook_runs" ahr
SET "lifecycle_hook_invocation_id" = 'lifecycle_hook_invocation_' || substring(md5(ahr."id") from 1 for 27)
WHERE ahr."lifecycle_hook_invocation_id" IS NULL;

ALTER TABLE "automation_hook_bindings"
  ALTER COLUMN "lifecycle_hook_contract_id" SET NOT NULL,
  ALTER COLUMN "lifecycle_hook_contract_version" SET NOT NULL;

ALTER TABLE "automation_hook_runs"
  ALTER COLUMN "lifecycle_hook_invocation_id" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "lifecycle_hook_effect_events" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "lifecycle_hook_invocation_id" text NOT NULL,
  "automation_hook_run_id" text,
  "effect_type" varchar(120) NOT NULL,
  "status" varchar(20) DEFAULT 'applied' NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "output_payload" jsonb DEFAULT '{}'::jsonb,
  "applied_at" timestamp with time zone DEFAULT now() NOT NULL,
  "error_code" varchar(120),
  "error_message" varchar(2000),
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text,
  "deleted_by" text
);

CREATE UNIQUE INDEX IF NOT EXISTS "lifecycle_hook_contracts_biz_id_id_unique"
  ON "lifecycle_hook_contracts" ("biz_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "lifecycle_hook_contracts_biz_key_unique"
  ON "lifecycle_hook_contracts" ("biz_id", "key");
CREATE INDEX IF NOT EXISTS "lifecycle_hook_contracts_biz_status_phase_target_idx"
  ON "lifecycle_hook_contracts" ("biz_id", "status", "phase", "target_type");

CREATE UNIQUE INDEX IF NOT EXISTS "lifecycle_hook_contract_versions_biz_id_id_unique"
  ON "lifecycle_hook_contract_versions" ("biz_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "lifecycle_hook_contract_versions_biz_contract_version_unique"
  ON "lifecycle_hook_contract_versions" ("biz_id", "lifecycle_hook_contract_id", "version");
CREATE INDEX IF NOT EXISTS "lifecycle_hook_contract_versions_biz_contract_status_version_idx"
  ON "lifecycle_hook_contract_versions" ("biz_id", "lifecycle_hook_contract_id", "status", "version");

CREATE UNIQUE INDEX IF NOT EXISTS "lifecycle_hook_invocations_biz_id_id_unique"
  ON "lifecycle_hook_invocations" ("biz_id", "id");
CREATE INDEX IF NOT EXISTS "lifecycle_hook_invocations_biz_contract_target_started_idx"
  ON "lifecycle_hook_invocations" ("biz_id", "lifecycle_hook_contract_id", "target_type", "target_ref_id", "started_at");
CREATE UNIQUE INDEX IF NOT EXISTS "lifecycle_hook_invocations_biz_idempotency_unique"
  ON "lifecycle_hook_invocations" ("biz_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "automation_hook_bindings_biz_contract_priority_idx"
  ON "automation_hook_bindings" ("biz_id", "lifecycle_hook_contract_id", "status", "priority", "id");
CREATE INDEX IF NOT EXISTS "automation_hook_runs_biz_invocation_started_idx"
  ON "automation_hook_runs" ("biz_id", "lifecycle_hook_invocation_id", "started_at");

CREATE UNIQUE INDEX IF NOT EXISTS "lifecycle_hook_effect_events_biz_id_id_unique"
  ON "lifecycle_hook_effect_events" ("biz_id", "id");
CREATE INDEX IF NOT EXISTS "lifecycle_hook_effect_events_biz_invocation_applied_idx"
  ON "lifecycle_hook_effect_events" ("biz_id", "lifecycle_hook_invocation_id", "applied_at");
CREATE INDEX IF NOT EXISTS "lifecycle_hook_effect_events_biz_run_applied_idx"
  ON "lifecycle_hook_effect_events" ("biz_id", "automation_hook_run_id", "applied_at");
CREATE INDEX IF NOT EXISTS "lifecycle_hook_effect_events_biz_type_status_idx"
  ON "lifecycle_hook_effect_events" ("biz_id", "effect_type", "status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lifecycle_hook_contracts_biz_id_bizes_id_fk') THEN
    ALTER TABLE "lifecycle_hook_contracts"
      ADD CONSTRAINT "lifecycle_hook_contracts_biz_id_bizes_id_fk"
      FOREIGN KEY ("biz_id") REFERENCES "bizes"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lifecycle_hook_contracts_trigger_mode_check') THEN
    ALTER TABLE "lifecycle_hook_contracts"
      ADD CONSTRAINT "lifecycle_hook_contracts_trigger_mode_check"
      CHECK ("trigger_mode" IN ('action', 'event', 'manual', 'schedule', 'workflow', 'system'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lifecycle_hook_contracts_mutability_check') THEN
    ALTER TABLE "lifecycle_hook_contracts"
      ADD CONSTRAINT "lifecycle_hook_contracts_mutability_check"
      CHECK ("mutability" IN ('readonly', 'effects'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lifecycle_hook_contracts_current_version_check') THEN
    ALTER TABLE "lifecycle_hook_contracts"
      ADD CONSTRAINT "lifecycle_hook_contracts_current_version_check"
      CHECK ("current_version" >= 1);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lifecycle_hook_contract_versions_biz_contract_fk') THEN
    ALTER TABLE "lifecycle_hook_contract_versions"
      ADD CONSTRAINT "lifecycle_hook_contract_versions_biz_contract_fk"
      FOREIGN KEY ("biz_id", "lifecycle_hook_contract_id")
      REFERENCES "lifecycle_hook_contracts"("biz_id", "id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lifecycle_hook_contract_versions_version_check') THEN
    ALTER TABLE "lifecycle_hook_contract_versions"
      ADD CONSTRAINT "lifecycle_hook_contract_versions_version_check"
      CHECK ("version" >= 1);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lifecycle_hook_invocations_biz_contract_fk') THEN
    ALTER TABLE "lifecycle_hook_invocations"
      ADD CONSTRAINT "lifecycle_hook_invocations_biz_contract_fk"
      FOREIGN KEY ("biz_id", "lifecycle_hook_contract_id")
      REFERENCES "lifecycle_hook_contracts"("biz_id", "id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lifecycle_hook_invocations_trigger_source_check') THEN
    ALTER TABLE "lifecycle_hook_invocations"
      ADD CONSTRAINT "lifecycle_hook_invocations_trigger_source_check"
      CHECK ("trigger_source" IN ('api', 'action', 'event', 'workflow', 'schedule', 'system'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lifecycle_hook_invocations_status_check') THEN
    ALTER TABLE "lifecycle_hook_invocations"
      ADD CONSTRAINT "lifecycle_hook_invocations_status_check"
      CHECK ("status" IN ('running', 'succeeded', 'failed', 'skipped'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lifecycle_hook_invocations_duration_bounds_check') THEN
    ALTER TABLE "lifecycle_hook_invocations"
      ADD CONSTRAINT "lifecycle_hook_invocations_duration_bounds_check"
      CHECK ("duration_ms" IS NULL OR "duration_ms" >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lifecycle_hook_invocations_timeline_check') THEN
    ALTER TABLE "lifecycle_hook_invocations"
      ADD CONSTRAINT "lifecycle_hook_invocations_timeline_check"
      CHECK ("completed_at" IS NULL OR "completed_at" >= "started_at");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'automation_hook_bindings_biz_contract_fk') THEN
    ALTER TABLE "automation_hook_bindings"
      ADD CONSTRAINT "automation_hook_bindings_biz_contract_fk"
      FOREIGN KEY ("biz_id", "lifecycle_hook_contract_id")
      REFERENCES "lifecycle_hook_contracts"("biz_id", "id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'automation_hook_bindings_contract_version_check') THEN
    ALTER TABLE "automation_hook_bindings"
      ADD CONSTRAINT "automation_hook_bindings_contract_version_check"
      CHECK ("lifecycle_hook_contract_version" >= 1);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'automation_hook_runs_biz_invocation_fk') THEN
    ALTER TABLE "automation_hook_runs"
      ADD CONSTRAINT "automation_hook_runs_biz_invocation_fk"
      FOREIGN KEY ("biz_id", "lifecycle_hook_invocation_id")
      REFERENCES "lifecycle_hook_invocations"("biz_id", "id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lifecycle_hook_effect_events_biz_invocation_fk') THEN
    ALTER TABLE "lifecycle_hook_effect_events"
      ADD CONSTRAINT "lifecycle_hook_effect_events_biz_invocation_fk"
      FOREIGN KEY ("biz_id", "lifecycle_hook_invocation_id")
      REFERENCES "lifecycle_hook_invocations"("biz_id", "id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lifecycle_hook_effect_events_biz_run_fk') THEN
    ALTER TABLE "lifecycle_hook_effect_events"
      ADD CONSTRAINT "lifecycle_hook_effect_events_biz_run_fk"
      FOREIGN KEY ("biz_id", "automation_hook_run_id")
      REFERENCES "automation_hook_runs"("biz_id", "id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lifecycle_hook_effect_events_status_check') THEN
    ALTER TABLE "lifecycle_hook_effect_events"
      ADD CONSTRAINT "lifecycle_hook_effect_events_status_check"
      CHECK ("status" IN ('planned', 'applied', 'failed', 'skipped'));
  END IF;
END $$;
