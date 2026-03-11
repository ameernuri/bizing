ALTER TABLE "checkout_session_items"
  ADD COLUMN IF NOT EXISTS "source_kind" varchar(40) DEFAULT 'core' NOT NULL,
  ADD COLUMN IF NOT EXISTS "source_ref_id" varchar(140),
  ADD COLUMN IF NOT EXISTS "source_key" varchar(180);

ALTER TABLE "booking_order_lines"
  ADD COLUMN IF NOT EXISTS "source_kind" varchar(40) DEFAULT 'core' NOT NULL,
  ADD COLUMN IF NOT EXISTS "source_ref_id" varchar(140),
  ADD COLUMN IF NOT EXISTS "source_key" varchar(180);

CREATE TABLE IF NOT EXISTS "automation_hook_bindings" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "biz_extension_install_id" text,
  "name" varchar(200) NOT NULL,
  "status" "lifecycle_status" DEFAULT 'active' NOT NULL,
  "hook_point" varchar(160) NOT NULL,
  "priority" integer DEFAULT 100 NOT NULL,
  "delivery_mode" "extension_hook_delivery_mode" NOT NULL,
  "internal_handler_key" varchar(200),
  "webhook_url" varchar(1000),
  "signing_secret_ref" varchar(255),
  "timeout_ms" integer DEFAULT 5000 NOT NULL,
  "failure_mode" varchar(20) DEFAULT 'fail_open' NOT NULL,
  "workflow_key" varchar(140),
  "configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "filter" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text,
  "deleted_by" text
);

CREATE TABLE IF NOT EXISTS "automation_hook_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "automation_hook_binding_id" text NOT NULL,
  "hook_point" varchar(160) NOT NULL,
  "target_type" varchar(100) NOT NULL,
  "target_ref_id" varchar(140) NOT NULL,
  "status" varchar(20) DEFAULT 'running' NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "duration_ms" integer,
  "input_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
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

CREATE INDEX IF NOT EXISTS "checkout_session_items_biz_session_source_idx"
  ON "checkout_session_items" ("biz_id", "checkout_session_id", "source_kind", "source_ref_id", "source_key");

CREATE UNIQUE INDEX IF NOT EXISTS "checkout_session_items_biz_session_source_key_unique"
  ON "checkout_session_items" ("biz_id", "checkout_session_id", "source_kind", "source_ref_id", "source_key")
  WHERE "source_ref_id" IS NOT NULL AND "source_key" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "booking_order_lines_biz_order_source_idx"
  ON "booking_order_lines" ("biz_id", "booking_order_id", "source_kind", "source_ref_id", "source_key");

CREATE UNIQUE INDEX IF NOT EXISTS "booking_order_lines_biz_order_source_key_unique"
  ON "booking_order_lines" ("biz_id", "booking_order_id", "source_kind", "source_ref_id", "source_key")
  WHERE "source_ref_id" IS NOT NULL AND "source_key" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "automation_hook_bindings_biz_id_id_unique"
  ON "automation_hook_bindings" ("biz_id", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "automation_hook_bindings_biz_hook_point_name_unique"
  ON "automation_hook_bindings" ("biz_id", "hook_point", "name");

CREATE INDEX IF NOT EXISTS "automation_hook_bindings_biz_status_point_priority_idx"
  ON "automation_hook_bindings" ("biz_id", "status", "hook_point", "priority", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "automation_hook_runs_biz_id_id_unique"
  ON "automation_hook_runs" ("biz_id", "id");

CREATE INDEX IF NOT EXISTS "automation_hook_runs_biz_point_target_started_idx"
  ON "automation_hook_runs" ("biz_id", "hook_point", "target_type", "target_ref_id", "started_at");

CREATE INDEX IF NOT EXISTS "automation_hook_runs_biz_binding_started_idx"
  ON "automation_hook_runs" ("biz_id", "automation_hook_binding_id", "started_at");

CREATE UNIQUE INDEX IF NOT EXISTS "automation_hook_runs_biz_idempotency_unique"
  ON "automation_hook_runs" ("biz_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checkout_session_items_source_shape_check'
  ) THEN
    ALTER TABLE "checkout_session_items"
      ADD CONSTRAINT "checkout_session_items_source_shape_check"
      CHECK (
        "source_kind" IN ('core', 'manual', 'extension', 'system')
        AND (
          ("source_ref_id" IS NULL AND "source_key" IS NULL)
          OR ("source_ref_id" IS NOT NULL AND "source_key" IS NOT NULL)
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_order_lines_source_shape_check'
  ) THEN
    ALTER TABLE "booking_order_lines"
      ADD CONSTRAINT "booking_order_lines_source_shape_check"
      CHECK (
        "source_kind" IN ('core', 'manual', 'extension', 'system')
        AND (
          ("source_ref_id" IS NULL AND "source_key" IS NULL)
          OR ("source_ref_id" IS NOT NULL AND "source_key" IS NOT NULL)
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_hook_bindings_biz_id_bizes_id_fk'
  ) THEN
    ALTER TABLE "automation_hook_bindings"
      ADD CONSTRAINT "automation_hook_bindings_biz_id_bizes_id_fk"
      FOREIGN KEY ("biz_id")
      REFERENCES "bizes"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_hook_bindings_biz_extension_install_id_biz_extension_installs_id_fk'
  ) THEN
    ALTER TABLE "automation_hook_bindings"
      ADD CONSTRAINT "automation_hook_bindings_biz_extension_install_id_biz_extension_installs_id_fk"
      FOREIGN KEY ("biz_extension_install_id")
      REFERENCES "biz_extension_installs"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_hook_bindings_biz_install_fk'
  ) THEN
    ALTER TABLE "automation_hook_bindings"
      ADD CONSTRAINT "automation_hook_bindings_biz_install_fk"
      FOREIGN KEY ("biz_id", "biz_extension_install_id")
      REFERENCES "biz_extension_installs"("biz_id", "id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_hook_bindings_created_by_users_id_fk'
  ) THEN
    ALTER TABLE "automation_hook_bindings"
      ADD CONSTRAINT "automation_hook_bindings_created_by_users_id_fk"
      FOREIGN KEY ("created_by")
      REFERENCES "users"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_hook_bindings_updated_by_users_id_fk'
  ) THEN
    ALTER TABLE "automation_hook_bindings"
      ADD CONSTRAINT "automation_hook_bindings_updated_by_users_id_fk"
      FOREIGN KEY ("updated_by")
      REFERENCES "users"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_hook_bindings_deleted_by_users_id_fk'
  ) THEN
    ALTER TABLE "automation_hook_bindings"
      ADD CONSTRAINT "automation_hook_bindings_deleted_by_users_id_fk"
      FOREIGN KEY ("deleted_by")
      REFERENCES "users"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_hook_bindings_timeout_bounds_check'
  ) THEN
    ALTER TABLE "automation_hook_bindings"
      ADD CONSTRAINT "automation_hook_bindings_timeout_bounds_check"
      CHECK ("timeout_ms" >= 100 AND "timeout_ms" <= 300000);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_hook_bindings_priority_bounds_check'
  ) THEN
    ALTER TABLE "automation_hook_bindings"
      ADD CONSTRAINT "automation_hook_bindings_priority_bounds_check"
      CHECK ("priority" >= 0 AND "priority" <= 100000);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_hook_bindings_failure_mode_check'
  ) THEN
    ALTER TABLE "automation_hook_bindings"
      ADD CONSTRAINT "automation_hook_bindings_failure_mode_check"
      CHECK ("failure_mode" IN ('fail_open', 'fail_closed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_hook_bindings_delivery_shape_check'
  ) THEN
    ALTER TABLE "automation_hook_bindings"
      ADD CONSTRAINT "automation_hook_bindings_delivery_shape_check"
      CHECK (
        (
          "delivery_mode" = 'internal_handler'
          AND "internal_handler_key" IS NOT NULL
          AND "webhook_url" IS NULL
          AND "signing_secret_ref" IS NULL
        ) OR (
          "delivery_mode" = 'webhook'
          AND "internal_handler_key" IS NULL
          AND "webhook_url" IS NOT NULL
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_hook_runs_biz_id_bizes_id_fk'
  ) THEN
    ALTER TABLE "automation_hook_runs"
      ADD CONSTRAINT "automation_hook_runs_biz_id_bizes_id_fk"
      FOREIGN KEY ("biz_id")
      REFERENCES "bizes"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_hook_runs_automation_hook_binding_id_automation_hook_bindings_id_fk'
  ) THEN
    ALTER TABLE "automation_hook_runs"
      ADD CONSTRAINT "automation_hook_runs_automation_hook_binding_id_automation_hook_bindings_id_fk"
      FOREIGN KEY ("automation_hook_binding_id")
      REFERENCES "automation_hook_bindings"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_hook_runs_biz_binding_fk'
  ) THEN
    ALTER TABLE "automation_hook_runs"
      ADD CONSTRAINT "automation_hook_runs_biz_binding_fk"
      FOREIGN KEY ("biz_id", "automation_hook_binding_id")
      REFERENCES "automation_hook_bindings"("biz_id", "id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_hook_runs_created_by_users_id_fk'
  ) THEN
    ALTER TABLE "automation_hook_runs"
      ADD CONSTRAINT "automation_hook_runs_created_by_users_id_fk"
      FOREIGN KEY ("created_by")
      REFERENCES "users"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_hook_runs_updated_by_users_id_fk'
  ) THEN
    ALTER TABLE "automation_hook_runs"
      ADD CONSTRAINT "automation_hook_runs_updated_by_users_id_fk"
      FOREIGN KEY ("updated_by")
      REFERENCES "users"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_hook_runs_deleted_by_users_id_fk'
  ) THEN
    ALTER TABLE "automation_hook_runs"
      ADD CONSTRAINT "automation_hook_runs_deleted_by_users_id_fk"
      FOREIGN KEY ("deleted_by")
      REFERENCES "users"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_hook_runs_status_check'
  ) THEN
    ALTER TABLE "automation_hook_runs"
      ADD CONSTRAINT "automation_hook_runs_status_check"
      CHECK ("status" IN ('running', 'succeeded', 'failed', 'skipped'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_hook_runs_duration_bounds_check'
  ) THEN
    ALTER TABLE "automation_hook_runs"
      ADD CONSTRAINT "automation_hook_runs_duration_bounds_check"
      CHECK ("duration_ms" IS NULL OR "duration_ms" >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_hook_runs_timeline_check'
  ) THEN
    ALTER TABLE "automation_hook_runs"
      ADD CONSTRAINT "automation_hook_runs_timeline_check"
      CHECK ("completed_at" IS NULL OR "completed_at" >= "started_at");
  END IF;
END $$;
