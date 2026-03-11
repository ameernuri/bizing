DO $$
BEGIN
  CREATE TYPE "coverage_lane_type" AS ENUM (
    'front_desk',
    'phone_response',
    'remote_response',
    'triage',
    'dispatch',
    'supervisor',
    'custom'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "coverage_lane_presence_mode" AS ENUM ('onsite', 'remote', 'hybrid');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "coverage_lane_membership_role" AS ENUM ('primary', 'backup', 'overflow');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "coverage_lanes" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL REFERENCES "bizes"("id"),
  "location_id" text REFERENCES "locations"("id"),
  "name" varchar(220) NOT NULL,
  "slug" varchar(140) NOT NULL,
  "status" "lifecycle_status" DEFAULT 'active' NOT NULL,
  "lane_type" "coverage_lane_type" DEFAULT 'custom' NOT NULL,
  "presence_mode" "coverage_lane_presence_mode" DEFAULT 'onsite' NOT NULL,
  "required_headcount" integer DEFAULT 1 NOT NULL,
  "schedule_subject_id" text REFERENCES "schedule_subjects"("id"),
  "primary_calendar_id" text REFERENCES "calendars"("id"),
  "auto_dispatch_enabled" boolean DEFAULT false NOT NULL,
  "policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text REFERENCES "users"("id"),
  "updated_by" text REFERENCES "users"("id"),
  "deleted_by" text REFERENCES "users"("id"),
  CONSTRAINT "coverage_lanes_sanity_check"
    CHECK (length("name") > 0 AND length("slug") > 0 AND "required_headcount" > 0),
  CONSTRAINT "coverage_lanes_biz_location_fk"
    FOREIGN KEY ("biz_id", "location_id") REFERENCES "locations"("biz_id", "id"),
  CONSTRAINT "coverage_lanes_biz_schedule_subject_fk"
    FOREIGN KEY ("biz_id", "schedule_subject_id") REFERENCES "schedule_subjects"("biz_id", "id"),
  CONSTRAINT "coverage_lanes_biz_primary_calendar_fk"
    FOREIGN KEY ("biz_id", "primary_calendar_id") REFERENCES "calendars"("biz_id", "id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "coverage_lanes_biz_id_id_unique"
  ON "coverage_lanes" ("biz_id", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "coverage_lanes_biz_slug_unique"
  ON "coverage_lanes" ("biz_id", "slug");

CREATE INDEX IF NOT EXISTS "coverage_lanes_biz_status_idx"
  ON "coverage_lanes" ("biz_id", "status", "lane_type");

CREATE INDEX IF NOT EXISTS "coverage_lanes_biz_location_idx"
  ON "coverage_lanes" ("biz_id", "location_id", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "coverage_lanes_schedule_subject_unique"
  ON "coverage_lanes" ("schedule_subject_id")
  WHERE "schedule_subject_id" IS NOT NULL AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "coverage_lanes_primary_calendar_unique"
  ON "coverage_lanes" ("primary_calendar_id")
  WHERE "primary_calendar_id" IS NOT NULL AND "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "coverage_lane_memberships" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL REFERENCES "bizes"("id"),
  "coverage_lane_id" text NOT NULL REFERENCES "coverage_lanes"("id"),
  "resource_id" text NOT NULL REFERENCES "resources"("id"),
  "status" "lifecycle_status" DEFAULT 'active' NOT NULL,
  "membership_role" "coverage_lane_membership_role" DEFAULT 'primary' NOT NULL,
  "participation_mode" "coverage_lane_presence_mode" DEFAULT 'onsite' NOT NULL,
  "escalation_order" integer DEFAULT 100 NOT NULL,
  "response_priority" integer DEFAULT 100 NOT NULL,
  "is_dispatch_eligible" boolean DEFAULT true NOT NULL,
  "effective_from" timestamp with time zone,
  "effective_to" timestamp with time zone,
  "policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text REFERENCES "users"("id"),
  "updated_by" text REFERENCES "users"("id"),
  "deleted_by" text REFERENCES "users"("id"),
  CONSTRAINT "coverage_lane_memberships_window_check"
    CHECK (
      "escalation_order" >= 0
      AND "response_priority" >= 0
      AND ("effective_from" IS NULL OR "effective_to" IS NULL OR "effective_to" > "effective_from")
    ),
  CONSTRAINT "coverage_lane_memberships_biz_lane_fk"
    FOREIGN KEY ("biz_id", "coverage_lane_id") REFERENCES "coverage_lanes"("biz_id", "id"),
  CONSTRAINT "coverage_lane_memberships_biz_resource_fk"
    FOREIGN KEY ("biz_id", "resource_id") REFERENCES "resources"("biz_id", "id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "coverage_lane_memberships_biz_id_id_unique"
  ON "coverage_lane_memberships" ("biz_id", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "coverage_lane_memberships_lane_resource_unique"
  ON "coverage_lane_memberships" ("coverage_lane_id", "resource_id")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "coverage_lane_memberships_biz_lane_status_idx"
  ON "coverage_lane_memberships" ("biz_id", "coverage_lane_id", "status", "escalation_order");

CREATE INDEX IF NOT EXISTS "coverage_lane_memberships_biz_resource_status_idx"
  ON "coverage_lane_memberships" ("biz_id", "resource_id", "status", "response_priority");

ALTER TABLE "staffing_demands"
  ADD COLUMN IF NOT EXISTS "coverage_lane_id" text REFERENCES "coverage_lanes"("id");

ALTER TABLE "staffing_assignments"
  ADD COLUMN IF NOT EXISTS "coverage_lane_id" text REFERENCES "coverage_lanes"("id");

DO $$
BEGIN
  ALTER TABLE "staffing_demands"
    ADD CONSTRAINT "staffing_demands_biz_coverage_lane_fk"
    FOREIGN KEY ("biz_id", "coverage_lane_id")
    REFERENCES "coverage_lanes"("biz_id", "id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "staffing_assignments"
    ADD CONSTRAINT "staffing_assignments_biz_coverage_lane_fk"
    FOREIGN KEY ("biz_id", "coverage_lane_id")
    REFERENCES "coverage_lanes"("biz_id", "id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
