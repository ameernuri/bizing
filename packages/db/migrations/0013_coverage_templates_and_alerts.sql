CREATE TABLE IF NOT EXISTS "coverage_lane_shift_templates" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL REFERENCES "bizes"("id"),
  "coverage_lane_id" text NOT NULL REFERENCES "coverage_lanes"("id"),
  "location_id" text REFERENCES "locations"("id"),
  "default_resource_id" text REFERENCES "resources"("id"),
  "name" varchar(220) NOT NULL,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "timezone" varchar(80) DEFAULT 'UTC' NOT NULL,
  "recurrence_rule" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "fill_mode" varchar(40) DEFAULT 'invite_accept' NOT NULL,
  "required_count" integer DEFAULT 1 NOT NULL,
  "auto_publish_enabled" boolean DEFAULT false NOT NULL,
  "publish_window_days" integer DEFAULT 14 NOT NULL,
  "last_published_through" timestamp with time zone,
  "policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text REFERENCES "users"("id"),
  "updated_by" text REFERENCES "users"("id"),
  "deleted_by" text REFERENCES "users"("id"),
  CONSTRAINT "coverage_lane_shift_templates_sanity_check"
    CHECK (
      length("name") > 0
      AND "required_count" > 0
      AND "publish_window_days" > 0
      AND "status" IN ('draft', 'active', 'inactive', 'archived')
      AND "fill_mode" IN ('direct_assign', 'fcfs_claim', 'invite_accept', 'auction', 'auto_match')
    ),
  CONSTRAINT "coverage_lane_shift_templates_biz_lane_fk"
    FOREIGN KEY ("biz_id", "coverage_lane_id") REFERENCES "coverage_lanes"("biz_id", "id"),
  CONSTRAINT "coverage_lane_shift_templates_biz_location_fk"
    FOREIGN KEY ("biz_id", "location_id") REFERENCES "locations"("biz_id", "id"),
  CONSTRAINT "coverage_lane_shift_templates_biz_resource_fk"
    FOREIGN KEY ("biz_id", "default_resource_id") REFERENCES "resources"("biz_id", "id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "coverage_lane_shift_templates_biz_id_id_unique"
  ON "coverage_lane_shift_templates" ("biz_id", "id");

CREATE INDEX IF NOT EXISTS "coverage_lane_shift_templates_biz_lane_status_idx"
  ON "coverage_lane_shift_templates" ("biz_id", "coverage_lane_id", "status");

CREATE TABLE IF NOT EXISTS "coverage_lane_alerts" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL REFERENCES "bizes"("id"),
  "coverage_lane_id" text NOT NULL REFERENCES "coverage_lanes"("id"),
  "alert_type" varchar(60) NOT NULL,
  "severity" varchar(20) DEFAULT 'notice' NOT NULL,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "title" varchar(220) NOT NULL,
  "summary" varchar(1000),
  "first_triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_observed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "acknowledged_at" timestamp with time zone,
  "resolved_at" timestamp with time zone,
  "workflow_instance_id" text REFERENCES "workflow_instances"("id"),
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text REFERENCES "users"("id"),
  "updated_by" text REFERENCES "users"("id"),
  "deleted_by" text REFERENCES "users"("id"),
  CONSTRAINT "coverage_lane_alerts_sanity_check"
    CHECK (
      length("alert_type") > 0
      AND length("title") > 0
      AND "severity" IN ('notice', 'warning', 'critical')
      AND "status" IN ('active', 'acknowledged', 'resolved')
      AND "last_observed_at" >= "first_triggered_at"
      AND ("resolved_at" IS NULL OR "resolved_at" >= "first_triggered_at")
    ),
  CONSTRAINT "coverage_lane_alerts_biz_lane_fk"
    FOREIGN KEY ("biz_id", "coverage_lane_id") REFERENCES "coverage_lanes"("biz_id", "id"),
  CONSTRAINT "coverage_lane_alerts_biz_workflow_fk"
    FOREIGN KEY ("biz_id", "workflow_instance_id") REFERENCES "workflow_instances"("biz_id", "id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "coverage_lane_alerts_biz_id_id_unique"
  ON "coverage_lane_alerts" ("biz_id", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "coverage_lane_alerts_active_unique"
  ON "coverage_lane_alerts" ("biz_id", "coverage_lane_id", "alert_type")
  WHERE "resolved_at" IS NULL AND "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "coverage_lane_alerts_biz_status_observed_idx"
  ON "coverage_lane_alerts" ("biz_id", "status", "last_observed_at");
