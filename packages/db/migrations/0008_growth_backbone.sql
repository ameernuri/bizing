CREATE TABLE IF NOT EXISTS "growth_localization_resources" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL REFERENCES "bizes" ("id"),
  "key" varchar(160) NOT NULL,
  "name" varchar(220) NOT NULL,
  "target_type" varchar(120) NOT NULL,
  "target_ref_id" varchar(160) NOT NULL,
  "field_key" varchar(160) NOT NULL,
  "default_locale" varchar(35) DEFAULT 'en-US' NOT NULL,
  "status" "lifecycle_status" DEFAULT 'active' NOT NULL,
  "current_version" integer DEFAULT 1 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text REFERENCES "users" ("id"),
  "updated_by" text REFERENCES "users" ("id"),
  "deleted_by" text REFERENCES "users" ("id"),
  CONSTRAINT "growth_localization_resources_default_locale_format_check"
    CHECK ("default_locale" ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  CONSTRAINT "growth_localization_resources_current_version_check"
    CHECK ("current_version" >= 1)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "growth_localization_values" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL REFERENCES "bizes" ("id"),
  "growth_localization_resource_id" text NOT NULL REFERENCES "growth_localization_resources" ("id"),
  "locale" varchar(35) NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "is_current" boolean DEFAULT true NOT NULL,
  "is_machine_generated" boolean DEFAULT false NOT NULL,
  "source_type" varchar(40) DEFAULT 'manual' NOT NULL,
  "content_text" text,
  "content_json" jsonb,
  "quality_score" integer,
  "status" "lifecycle_status" DEFAULT 'active' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text REFERENCES "users" ("id"),
  "updated_by" text REFERENCES "users" ("id"),
  "deleted_by" text REFERENCES "users" ("id"),
  CONSTRAINT "growth_localization_values_locale_format_check"
    CHECK ("locale" ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  CONSTRAINT "growth_localization_values_version_check"
    CHECK ("version" >= 1),
  CONSTRAINT "growth_localization_values_source_type_check"
    CHECK ("source_type" IN ('manual', 'import', 'machine_translation', 'workflow', 'system') OR "source_type" LIKE 'custom_%'),
  CONSTRAINT "growth_localization_values_quality_score_check"
    CHECK ("quality_score" IS NULL OR ("quality_score" >= 0 AND "quality_score" <= 100)),
  CONSTRAINT "growth_localization_values_payload_shape_check"
    CHECK ("content_text" IS NOT NULL OR "content_json" IS NOT NULL)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "growth_experiments" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL REFERENCES "bizes" ("id"),
  "key" varchar(160) NOT NULL,
  "name" varchar(220) NOT NULL,
  "status" varchar(40) DEFAULT 'draft' NOT NULL,
  "hypothesis" text,
  "objective_type" varchar(80) DEFAULT 'conversion_rate' NOT NULL,
  "assignment_unit_type" varchar(60) DEFAULT 'subject' NOT NULL,
  "assignment_strategy" varchar(60) DEFAULT 'weighted_hash' NOT NULL,
  "marketing_audience_segment_id" text REFERENCES "marketing_audience_segments" ("id"),
  "target_type" varchar(120),
  "target_ref_id" varchar(160),
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "winner_growth_experiment_variant_id" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text REFERENCES "users" ("id"),
  "updated_by" text REFERENCES "users" ("id"),
  "deleted_by" text REFERENCES "users" ("id"),
  CONSTRAINT "growth_experiments_status_check"
    CHECK ("status" IN ('draft', 'active', 'paused', 'completed', 'archived') OR "status" LIKE 'custom_%'),
  CONSTRAINT "growth_experiments_assignment_unit_type_check"
    CHECK ("assignment_unit_type" IN ('subject', 'session', 'user', 'group_account', 'custom_subject') OR "assignment_unit_type" LIKE 'custom_%'),
  CONSTRAINT "growth_experiments_assignment_strategy_check"
    CHECK ("assignment_strategy" IN ('weighted_hash', 'manual', 'rule', 'sticky_random') OR "assignment_strategy" LIKE 'custom_%'),
  CONSTRAINT "growth_experiments_window_check"
    CHECK ("starts_at" IS NULL OR "ends_at" IS NULL OR "ends_at" > "starts_at")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "growth_experiment_variants" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL REFERENCES "bizes" ("id"),
  "growth_experiment_id" text NOT NULL REFERENCES "growth_experiments" ("id"),
  "variant_key" varchar(120) NOT NULL,
  "name" varchar(220) NOT NULL,
  "status" "lifecycle_status" DEFAULT 'active' NOT NULL,
  "is_control" boolean DEFAULT false NOT NULL,
  "allocation_bps" integer DEFAULT 0 NOT NULL,
  "treatment" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text REFERENCES "users" ("id"),
  "updated_by" text REFERENCES "users" ("id"),
  "deleted_by" text REFERENCES "users" ("id"),
  CONSTRAINT "growth_experiment_variants_allocation_check"
    CHECK ("allocation_bps" >= 0 AND "allocation_bps" <= 10000)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "growth_experiment_assignments" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL REFERENCES "bizes" ("id"),
  "growth_experiment_id" text NOT NULL REFERENCES "growth_experiments" ("id"),
  "growth_experiment_variant_id" text NOT NULL REFERENCES "growth_experiment_variants" ("id"),
  "subject_type" varchar(80) NOT NULL,
  "subject_ref_id" varchar(160) NOT NULL,
  "assignment_key" varchar(180),
  "status" varchar(40) DEFAULT 'assigned' NOT NULL,
  "assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
  "exposed_at" timestamp with time zone,
  "converted_at" timestamp with time zone,
  "conversion_event_key" varchar(180),
  "conversion_value_minor" integer,
  "currency" varchar(3) DEFAULT 'USD' NOT NULL,
  "source_type" varchar(40) DEFAULT 'api' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text REFERENCES "users" ("id"),
  "updated_by" text REFERENCES "users" ("id"),
  "deleted_by" text REFERENCES "users" ("id"),
  CONSTRAINT "growth_experiment_assignments_status_check"
    CHECK ("status" IN ('assigned', 'exposed', 'converted', 'excluded', 'failed') OR "status" LIKE 'custom_%'),
  CONSTRAINT "growth_experiment_assignments_source_type_check"
    CHECK ("source_type" IN ('api', 'workflow', 'system', 'import') OR "source_type" LIKE 'custom_%'),
  CONSTRAINT "growth_experiment_assignments_timeline_check"
    CHECK (("exposed_at" IS NULL OR "exposed_at" >= "assigned_at")
      AND ("converted_at" IS NULL OR "converted_at" >= COALESCE("exposed_at", "assigned_at"))),
  CONSTRAINT "growth_experiment_assignments_conversion_value_check"
    CHECK ("conversion_value_minor" IS NULL OR "conversion_value_minor" >= 0),
  CONSTRAINT "growth_experiment_assignments_currency_check"
    CHECK ("currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "growth_experiment_measurements" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL REFERENCES "bizes" ("id"),
  "growth_experiment_id" text NOT NULL REFERENCES "growth_experiments" ("id"),
  "growth_experiment_variant_id" text REFERENCES "growth_experiment_variants" ("id"),
  "growth_experiment_assignment_id" text REFERENCES "growth_experiment_assignments" ("id"),
  "metric_key" varchar(120) NOT NULL,
  "metric_value" numeric(18,6) NOT NULL,
  "metric_unit" varchar(40),
  "observed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "source_type" varchar(40) DEFAULT 'api' NOT NULL,
  "event_ref" varchar(180),
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text REFERENCES "users" ("id"),
  "updated_by" text REFERENCES "users" ("id"),
  "deleted_by" text REFERENCES "users" ("id"),
  CONSTRAINT "growth_experiment_measurements_source_type_check"
    CHECK ("source_type" IN ('api', 'workflow', 'system', 'import') OR "source_type" LIKE 'custom_%')
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "growth_marketing_activations" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL REFERENCES "bizes" ("id"),
  "key" varchar(160) NOT NULL,
  "name" varchar(220) NOT NULL,
  "status" "lifecycle_status" DEFAULT 'active' NOT NULL,
  "provider" varchar(80) NOT NULL,
  "channel_account_id" text REFERENCES "channel_accounts" ("id"),
  "source_type" varchar(40) DEFAULT 'experiment_variant' NOT NULL,
  "growth_experiment_id" text REFERENCES "growth_experiments" ("id"),
  "growth_experiment_variant_id" text REFERENCES "growth_experiment_variants" ("id"),
  "marketing_campaign_id" text REFERENCES "marketing_campaigns" ("id"),
  "message_template_id" text REFERENCES "message_templates" ("id"),
  "marketing_audience_segment_id" text REFERENCES "marketing_audience_segments" ("id"),
  "destination_ref" varchar(220),
  "sync_mode" varchar(40) DEFAULT 'push' NOT NULL,
  "publish_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text REFERENCES "users" ("id"),
  "updated_by" text REFERENCES "users" ("id"),
  "deleted_by" text REFERENCES "users" ("id"),
  CONSTRAINT "growth_marketing_activations_source_type_check"
    CHECK ("source_type" IN ('experiment', 'experiment_variant', 'campaign', 'template', 'audience_segment', 'custom') OR "source_type" LIKE 'custom_%'),
  CONSTRAINT "growth_marketing_activations_sync_mode_check"
    CHECK ("sync_mode" IN ('push', 'pull', 'bidirectional') OR "sync_mode" LIKE 'custom_%'),
  CONSTRAINT "growth_marketing_activations_source_shape_check"
    CHECK (
      (("growth_experiment_id" IS NOT NULL)::int
      + ("growth_experiment_variant_id" IS NOT NULL)::int
      + ("marketing_campaign_id" IS NOT NULL)::int
      + ("message_template_id" IS NOT NULL)::int
      + ("marketing_audience_segment_id" IS NOT NULL)::int) >= 1
    )
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "growth_marketing_activation_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL REFERENCES "bizes" ("id"),
  "growth_marketing_activation_id" text NOT NULL REFERENCES "growth_marketing_activations" ("id"),
  "status" varchar(40) DEFAULT 'queued' NOT NULL,
  "trigger_source" varchar(40) DEFAULT 'manual' NOT NULL,
  "trigger_ref_id" varchar(160),
  "initiated_by_user_id" text REFERENCES "users" ("id"),
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  "input_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "output_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error_code" varchar(120),
  "error_message" text,
  "published_count" integer DEFAULT 0 NOT NULL,
  "synced_count" integer DEFAULT 0 NOT NULL,
  "failed_count" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text REFERENCES "users" ("id"),
  "updated_by" text REFERENCES "users" ("id"),
  "deleted_by" text REFERENCES "users" ("id"),
  CONSTRAINT "growth_marketing_activation_runs_status_check"
    CHECK ("status" IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'partial') OR "status" LIKE 'custom_%'),
  CONSTRAINT "growth_marketing_activation_runs_trigger_source_check"
    CHECK ("trigger_source" IN ('manual', 'workflow', 'lifecycle_hook', 'schedule', 'system', 'api') OR "trigger_source" LIKE 'custom_%'),
  CONSTRAINT "growth_marketing_activation_runs_counts_check"
    CHECK ("published_count" >= 0 AND "synced_count" >= 0 AND "failed_count" >= 0),
  CONSTRAINT "growth_marketing_activation_runs_window_check"
    CHECK ("finished_at" IS NULL OR "finished_at" >= "started_at")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "growth_marketing_activation_run_items" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL REFERENCES "bizes" ("id"),
  "growth_marketing_activation_run_id" text NOT NULL REFERENCES "growth_marketing_activation_runs" ("id"),
  "item_type" varchar(80) NOT NULL,
  "item_ref_id" varchar(180),
  "external_ref" varchar(220),
  "status" varchar(40) DEFAULT 'planned' NOT NULL,
  "error_code" varchar(120),
  "error_message" text,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text REFERENCES "users" ("id"),
  "updated_by" text REFERENCES "users" ("id"),
  "deleted_by" text REFERENCES "users" ("id"),
  CONSTRAINT "growth_marketing_activation_run_items_status_check"
    CHECK ("status" IN ('planned', 'published', 'synced', 'failed', 'skipped') OR "status" LIKE 'custom_%')
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "growth_localization_resources_biz_id_id_unique"
  ON "growth_localization_resources" ("biz_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "growth_localization_resources_biz_key_unique"
  ON "growth_localization_resources" ("biz_id", "key");
CREATE UNIQUE INDEX IF NOT EXISTS "growth_localization_resources_biz_target_field_unique"
  ON "growth_localization_resources" ("biz_id", "target_type", "target_ref_id", "field_key");
CREATE INDEX IF NOT EXISTS "growth_localization_resources_biz_status_locale_idx"
  ON "growth_localization_resources" ("biz_id", "status", "default_locale");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "growth_localization_values_biz_id_id_unique"
  ON "growth_localization_values" ("biz_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "growth_localization_values_resource_locale_version_unique"
  ON "growth_localization_values" ("growth_localization_resource_id", "locale", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "growth_localization_values_resource_locale_current_unique"
  ON "growth_localization_values" ("growth_localization_resource_id", "locale")
  WHERE "is_current" = true AND "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "growth_localization_values_biz_locale_status_idx"
  ON "growth_localization_values" ("biz_id", "locale", "status", "is_current");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "growth_experiments_biz_id_id_unique"
  ON "growth_experiments" ("biz_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "growth_experiments_biz_key_unique"
  ON "growth_experiments" ("biz_id", "key");
CREATE INDEX IF NOT EXISTS "growth_experiments_biz_status_window_idx"
  ON "growth_experiments" ("biz_id", "status", "starts_at", "ends_at");
CREATE INDEX IF NOT EXISTS "growth_experiments_biz_objective_idx"
  ON "growth_experiments" ("biz_id", "objective_type", "assignment_strategy");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "growth_experiment_variants_biz_id_id_unique"
  ON "growth_experiment_variants" ("biz_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "growth_experiment_variants_unique"
  ON "growth_experiment_variants" ("growth_experiment_id", "variant_key");
CREATE INDEX IF NOT EXISTS "growth_experiment_variants_biz_experiment_status_idx"
  ON "growth_experiment_variants" ("biz_id", "growth_experiment_id", "status", "allocation_bps");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "growth_experiment_assignments_biz_id_id_unique"
  ON "growth_experiment_assignments" ("biz_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "growth_experiment_assignments_unique"
  ON "growth_experiment_assignments" ("biz_id", "growth_experiment_id", "subject_type", "subject_ref_id");
CREATE INDEX IF NOT EXISTS "growth_experiment_assignments_biz_variant_status_idx"
  ON "growth_experiment_assignments" ("biz_id", "growth_experiment_variant_id", "status", "assigned_at");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "growth_experiment_measurements_biz_id_id_unique"
  ON "growth_experiment_measurements" ("biz_id", "id");
CREATE INDEX IF NOT EXISTS "growth_experiment_measurements_biz_experiment_metric_idx"
  ON "growth_experiment_measurements" ("biz_id", "growth_experiment_id", "metric_key", "observed_at");
CREATE INDEX IF NOT EXISTS "growth_experiment_measurements_biz_variant_metric_idx"
  ON "growth_experiment_measurements" ("biz_id", "growth_experiment_variant_id", "metric_key", "observed_at");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "growth_marketing_activations_biz_id_id_unique"
  ON "growth_marketing_activations" ("biz_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "growth_marketing_activations_biz_key_unique"
  ON "growth_marketing_activations" ("biz_id", "key");
CREATE INDEX IF NOT EXISTS "growth_marketing_activations_biz_status_provider_idx"
  ON "growth_marketing_activations" ("biz_id", "status", "provider", "source_type");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "growth_marketing_activation_runs_biz_id_id_unique"
  ON "growth_marketing_activation_runs" ("biz_id", "id");
CREATE INDEX IF NOT EXISTS "growth_marketing_activation_runs_biz_activation_status_idx"
  ON "growth_marketing_activation_runs" ("biz_id", "growth_marketing_activation_id", "status", "started_at");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "growth_marketing_activation_run_items_biz_id_id_unique"
  ON "growth_marketing_activation_run_items" ("biz_id", "id");
CREATE INDEX IF NOT EXISTS "growth_marketing_activation_run_items_biz_run_status_idx"
  ON "growth_marketing_activation_run_items" ("biz_id", "growth_marketing_activation_run_id", "status", "item_type");
