ALTER TABLE "workflow_instances"
  ADD COLUMN IF NOT EXISTS "workflow_definition_id" text,
  ADD COLUMN IF NOT EXISTS "workflow_definition_version" integer;

CREATE TABLE IF NOT EXISTS "workflow_definitions" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "key" varchar(160) NOT NULL,
  "name" varchar(220) NOT NULL,
  "status" "lifecycle_status" DEFAULT 'active' NOT NULL,
  "trigger_mode" varchar(40) DEFAULT 'manual' NOT NULL,
  "target_type" varchar(120),
  "current_version" integer DEFAULT 1 NOT NULL,
  "description" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text,
  "deleted_by" text
);

CREATE TABLE IF NOT EXISTS "workflow_definition_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "workflow_definition_id" text NOT NULL,
  "version" integer NOT NULL,
  "status" "lifecycle_status" DEFAULT 'active' NOT NULL,
  "step_plan" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "input_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "output_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text,
  "deleted_by" text
);

CREATE TABLE IF NOT EXISTS "workflow_definition_triggers" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "workflow_definition_id" text NOT NULL,
  "status" "lifecycle_status" DEFAULT 'active' NOT NULL,
  "trigger_source" varchar(50) NOT NULL,
  "lifecycle_hook_contract_key" varchar(180),
  "lifecycle_hook_invocation_status" varchar(20),
  "lifecycle_hook_effect_type" varchar(120),
  "domain_event_pattern" varchar(200),
  "action_key" varchar(160),
  "target_type" varchar(120),
  "priority" integer DEFAULT 100 NOT NULL,
  "workflow_definition_version" integer DEFAULT 1 NOT NULL,
  "idempotency_mode" varchar(30) DEFAULT 'trigger_target' NOT NULL,
  "configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text,
  "deleted_by" text
);

CREATE TABLE IF NOT EXISTS "workflow_trigger_invocations" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "workflow_definition_trigger_id" text NOT NULL,
  "workflow_definition_id" text NOT NULL,
  "workflow_definition_version" integer NOT NULL,
  "workflow_instance_id" text,
  "trigger_source" varchar(50) NOT NULL,
  "trigger_ref_id" varchar(160) NOT NULL,
  "target_type" varchar(120) NOT NULL,
  "target_ref_id" varchar(160) NOT NULL,
  "idempotency_key" varchar(260),
  "status" varchar(20) DEFAULT 'running' NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "duration_ms" integer,
  "input_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "output_payload" jsonb DEFAULT '{}'::jsonb,
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

INSERT INTO "workflow_definitions" (
  "id",
  "biz_id",
  "key",
  "name",
  "status",
  "trigger_mode",
  "target_type",
  "current_version",
  "description",
  "metadata"
)
SELECT
  'workflow_definition_' || substring(md5(wi."biz_id" || '::' || wi."workflow_key") from 1 for 27),
  wi."biz_id",
  wi."workflow_key",
  wi."workflow_key",
  'active',
  'manual',
  NULL,
  1,
  'Backfilled from workflow_instances.workflow_key',
  jsonb_build_object('source', 'migration.0005', 'backfilled', true)
FROM "workflow_instances" wi
GROUP BY wi."biz_id", wi."workflow_key"
ON CONFLICT DO NOTHING;

INSERT INTO "workflow_definition_versions" (
  "id",
  "biz_id",
  "workflow_definition_id",
  "version",
  "status",
  "step_plan",
  "input_schema",
  "output_schema",
  "metadata"
)
SELECT
  'workflow_definition_version_' || substring(md5(wd."id" || '::1') from 1 for 27),
  wd."biz_id",
  wd."id",
  1,
  'active',
  '[{"stepKey":"review","name":"Manual review","sequence":0,"status":"pending"}]'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  jsonb_build_object('source', 'migration.0005', 'backfilled', true)
FROM "workflow_definitions" wd
ON CONFLICT DO NOTHING;

UPDATE "workflow_instances" wi
SET
  "workflow_definition_id" = wd."id",
  "workflow_definition_version" = COALESCE(wi."workflow_definition_version", 1)
FROM "workflow_definitions" wd
WHERE
  wi."workflow_definition_id" IS NULL
  AND wd."biz_id" = wi."biz_id"
  AND wd."key" = wi."workflow_key";

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_definitions_biz_id_id_unique"
  ON "workflow_definitions" ("biz_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_definitions_biz_key_unique"
  ON "workflow_definitions" ("biz_id", "key");
CREATE INDEX IF NOT EXISTS "workflow_definitions_biz_status_trigger_idx"
  ON "workflow_definitions" ("biz_id", "status", "trigger_mode");

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_definition_versions_biz_id_id_unique"
  ON "workflow_definition_versions" ("biz_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_definition_versions_biz_definition_version_unique"
  ON "workflow_definition_versions" ("biz_id", "workflow_definition_id", "version");
CREATE INDEX IF NOT EXISTS "workflow_definition_versions_biz_definition_status_idx"
  ON "workflow_definition_versions" ("biz_id", "workflow_definition_id", "status", "version");

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_definition_triggers_biz_id_id_unique"
  ON "workflow_definition_triggers" ("biz_id", "id");
CREATE INDEX IF NOT EXISTS "workflow_definition_triggers_biz_definition_status_priority_idx"
  ON "workflow_definition_triggers" ("biz_id", "workflow_definition_id", "status", "priority", "id");
CREATE INDEX IF NOT EXISTS "workflow_definition_triggers_biz_source_status_priority_idx"
  ON "workflow_definition_triggers" ("biz_id", "trigger_source", "status", "priority", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_trigger_invocations_biz_id_id_unique"
  ON "workflow_trigger_invocations" ("biz_id", "id");
CREATE INDEX IF NOT EXISTS "workflow_trigger_invocations_biz_trigger_started_idx"
  ON "workflow_trigger_invocations" ("biz_id", "workflow_definition_trigger_id", "started_at");
CREATE INDEX IF NOT EXISTS "workflow_trigger_invocations_biz_target_started_idx"
  ON "workflow_trigger_invocations" ("biz_id", "target_type", "target_ref_id", "started_at");
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_trigger_invocations_biz_idempotency_unique"
  ON "workflow_trigger_invocations" ("biz_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "workflow_instances_biz_definition_status_started_idx"
  ON "workflow_instances" ("biz_id", "workflow_definition_id", "workflow_definition_version", "status", "started_at");

DO $$
BEGIN
  ALTER TABLE "workflow_definition_versions"
    ADD CONSTRAINT "workflow_definition_versions_biz_definition_fk"
    FOREIGN KEY ("biz_id", "workflow_definition_id")
    REFERENCES "workflow_definitions"("biz_id", "id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "workflow_definition_triggers"
    ADD CONSTRAINT "workflow_definition_triggers_biz_definition_fk"
    FOREIGN KEY ("biz_id", "workflow_definition_id")
    REFERENCES "workflow_definitions"("biz_id", "id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "workflow_trigger_invocations"
    ADD CONSTRAINT "workflow_trigger_invocations_biz_trigger_fk"
    FOREIGN KEY ("biz_id", "workflow_definition_trigger_id")
    REFERENCES "workflow_definition_triggers"("biz_id", "id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "workflow_trigger_invocations"
    ADD CONSTRAINT "workflow_trigger_invocations_biz_definition_fk"
    FOREIGN KEY ("biz_id", "workflow_definition_id")
    REFERENCES "workflow_definitions"("biz_id", "id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "workflow_trigger_invocations"
    ADD CONSTRAINT "workflow_trigger_invocations_biz_definition_version_fk"
    FOREIGN KEY ("biz_id", "workflow_definition_id", "workflow_definition_version")
    REFERENCES "workflow_definition_versions"("biz_id", "workflow_definition_id", "version")
    ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "workflow_trigger_invocations"
    ADD CONSTRAINT "workflow_trigger_invocations_biz_workflow_instance_fk"
    FOREIGN KEY ("biz_id", "workflow_instance_id")
    REFERENCES "workflow_instances"("biz_id", "id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "workflow_instances"
    ADD CONSTRAINT "workflow_instances_biz_definition_fk"
    FOREIGN KEY ("biz_id", "workflow_definition_id")
    REFERENCES "workflow_definitions"("biz_id", "id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "workflow_instances"
    ADD CONSTRAINT "workflow_instances_biz_definition_version_fk"
    FOREIGN KEY ("biz_id", "workflow_definition_id", "workflow_definition_version")
    REFERENCES "workflow_definition_versions"("biz_id", "workflow_definition_id", "version")
    ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "workflow_definitions"
    ADD CONSTRAINT "workflow_definitions_trigger_mode_check"
    CHECK ("trigger_mode" IN ('manual', 'lifecycle_hook', 'domain_event', 'action', 'schedule', 'system'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "workflow_definitions"
    ADD CONSTRAINT "workflow_definitions_current_version_check"
    CHECK ("current_version" >= 1);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "workflow_definition_versions"
    ADD CONSTRAINT "workflow_definition_versions_version_check"
    CHECK ("version" >= 1);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "workflow_definition_triggers"
    ADD CONSTRAINT "workflow_definition_triggers_trigger_source_check"
    CHECK (
      "trigger_source" IN (
        'lifecycle_hook_invocation',
        'lifecycle_hook_effect',
        'domain_event',
        'action_request',
        'manual',
        'schedule',
        'system'
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "workflow_definition_triggers"
    ADD CONSTRAINT "workflow_definition_triggers_invocation_status_check"
    CHECK (
      "lifecycle_hook_invocation_status" IS NULL
      OR "lifecycle_hook_invocation_status" IN ('running', 'succeeded', 'failed', 'skipped')
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "workflow_definition_triggers"
    ADD CONSTRAINT "workflow_definition_triggers_priority_check"
    CHECK ("priority" >= 0 AND "priority" <= 100000);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "workflow_definition_triggers"
    ADD CONSTRAINT "workflow_definition_triggers_version_check"
    CHECK ("workflow_definition_version" >= 1);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "workflow_definition_triggers"
    ADD CONSTRAINT "workflow_definition_triggers_idempotency_mode_check"
    CHECK ("idempotency_mode" IN ('none', 'trigger', 'trigger_target'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "workflow_definition_triggers"
    ADD CONSTRAINT "workflow_definition_triggers_selector_check"
    CHECK (
      (
        "trigger_source" = 'lifecycle_hook_invocation'
        AND "lifecycle_hook_contract_key" IS NOT NULL
      ) OR (
        "trigger_source" = 'lifecycle_hook_effect'
        AND (
          "lifecycle_hook_contract_key" IS NOT NULL
          OR "lifecycle_hook_effect_type" IS NOT NULL
        )
      ) OR (
        "trigger_source" = 'domain_event'
        AND "domain_event_pattern" IS NOT NULL
      ) OR (
        "trigger_source" = 'action_request'
        AND "action_key" IS NOT NULL
      ) OR (
        "trigger_source" IN ('manual', 'schedule', 'system')
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "workflow_trigger_invocations"
    ADD CONSTRAINT "workflow_trigger_invocations_trigger_source_check"
    CHECK (
      "trigger_source" IN (
        'lifecycle_hook_invocation',
        'lifecycle_hook_effect',
        'domain_event',
        'action_request',
        'manual',
        'schedule',
        'system'
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "workflow_trigger_invocations"
    ADD CONSTRAINT "workflow_trigger_invocations_status_check"
    CHECK ("status" IN ('running', 'succeeded', 'failed', 'skipped'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "workflow_trigger_invocations"
    ADD CONSTRAINT "workflow_trigger_invocations_version_check"
    CHECK ("workflow_definition_version" >= 1);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "workflow_trigger_invocations"
    ADD CONSTRAINT "workflow_trigger_invocations_duration_check"
    CHECK ("duration_ms" IS NULL OR "duration_ms" >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "workflow_trigger_invocations"
    ADD CONSTRAINT "workflow_trigger_invocations_timeline_check"
    CHECK ("completed_at" IS NULL OR "completed_at" >= "started_at");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "workflow_instances"
    ADD CONSTRAINT "workflow_instances_definition_version_check"
    CHECK (
      (
        "workflow_definition_id" IS NULL
        AND "workflow_definition_version" IS NULL
      ) OR (
        "workflow_definition_id" IS NOT NULL
        AND "workflow_definition_version" IS NOT NULL
        AND "workflow_definition_version" >= 1
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
