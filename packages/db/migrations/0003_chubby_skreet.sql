DO $$ BEGIN
 CREATE TYPE "saga_artifact_type" AS ENUM('report', 'pseudoshot', 'api_trace', 'step_log', 'attachment');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "saga_definition_status" AS ENUM('draft', 'active', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "saga_run_mode" AS ENUM('dry_run', 'live');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "saga_run_status" AS ENUM('pending', 'running', 'passed', 'failed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "saga_run_step_status" AS ENUM('pending', 'in_progress', 'passed', 'failed', 'skipped', 'blocked');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saga_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"saga_key" varchar(160) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "saga_definition_status" DEFAULT 'active' NOT NULL,
	"source_use_case_ref" varchar(80),
	"source_persona_ref" varchar(120),
	"source_use_case_file" varchar(600),
	"source_persona_file" varchar(600),
	"spec_version" varchar(40) DEFAULT 'v0' NOT NULL,
	"spec_file_path" varchar(700) NOT NULL,
	"spec_checksum" varchar(128) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saga_run_artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"saga_run_id" text NOT NULL,
	"saga_run_step_id" text,
	"artifact_type" "saga_artifact_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"storage_path" varchar(800) NOT NULL,
	"content_type" varchar(120) DEFAULT 'application/json' NOT NULL,
	"byte_size" integer,
	"checksum" varchar(128),
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saga_run_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"saga_run_id" text NOT NULL,
	"phase_key" varchar(160) NOT NULL,
	"phase_order" integer NOT NULL,
	"phase_title" varchar(255) NOT NULL,
	"step_key" varchar(180) NOT NULL,
	"step_order" integer NOT NULL,
	"actor_key" varchar(120) NOT NULL,
	"instruction" text NOT NULL,
	"expected_result" text,
	"status" "saga_run_step_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"failure_code" varchar(120),
	"failure_message" text,
	"result_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"assertion_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saga_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"saga_definition_id" text NOT NULL,
	"saga_key" varchar(160) NOT NULL,
	"biz_id" text,
	"status" "saga_run_status" DEFAULT 'pending' NOT NULL,
	"mode" "saga_run_mode" DEFAULT 'dry_run' NOT NULL,
	"requested_by_user_id" text NOT NULL,
	"runner_label" varchar(160),
	"definition_checksum" varchar(128),
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"last_heartbeat_at" timestamp with time zone,
	"total_steps" integer DEFAULT 0 NOT NULL,
	"passed_steps" integer DEFAULT 0 NOT NULL,
	"failed_steps" integer DEFAULT 0 NOT NULL,
	"skipped_steps" integer DEFAULT 0 NOT NULL,
	"run_context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"run_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saga_definitions_saga_key_unique" ON "saga_definitions" ("saga_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_definitions_biz_status_idx" ON "saga_definitions" ("biz_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_run_artifacts_run_captured_idx" ON "saga_run_artifacts" ("saga_run_id","captured_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_run_artifacts_run_type_idx" ON "saga_run_artifacts" ("saga_run_id","artifact_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_run_artifacts_run_step_idx" ON "saga_run_artifacts" ("saga_run_step_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saga_run_steps_run_step_key_unique" ON "saga_run_steps" ("saga_run_id","step_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_run_steps_run_phase_step_idx" ON "saga_run_steps" ("saga_run_id","phase_order","step_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_run_steps_run_status_idx" ON "saga_run_steps" ("saga_run_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_runs_status_created_idx" ON "saga_runs" ("status","started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_runs_definition_created_idx" ON "saga_runs" ("saga_definition_id","started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_runs_requested_by_created_idx" ON "saga_runs" ("requested_by_user_id","started_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_definitions" ADD CONSTRAINT "saga_definitions_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_definitions" ADD CONSTRAINT "saga_definitions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_definitions" ADD CONSTRAINT "saga_definitions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_definitions" ADD CONSTRAINT "saga_definitions_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_artifacts" ADD CONSTRAINT "saga_run_artifacts_saga_run_id_saga_runs_id_fk" FOREIGN KEY ("saga_run_id") REFERENCES "saga_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_artifacts" ADD CONSTRAINT "saga_run_artifacts_saga_run_step_id_saga_run_steps_id_fk" FOREIGN KEY ("saga_run_step_id") REFERENCES "saga_run_steps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_artifacts" ADD CONSTRAINT "saga_run_artifacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_artifacts" ADD CONSTRAINT "saga_run_artifacts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_artifacts" ADD CONSTRAINT "saga_run_artifacts_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_steps" ADD CONSTRAINT "saga_run_steps_saga_run_id_saga_runs_id_fk" FOREIGN KEY ("saga_run_id") REFERENCES "saga_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_steps" ADD CONSTRAINT "saga_run_steps_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_steps" ADD CONSTRAINT "saga_run_steps_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_steps" ADD CONSTRAINT "saga_run_steps_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_runs" ADD CONSTRAINT "saga_runs_saga_definition_id_saga_definitions_id_fk" FOREIGN KEY ("saga_definition_id") REFERENCES "saga_definitions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_runs" ADD CONSTRAINT "saga_runs_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_runs" ADD CONSTRAINT "saga_runs_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_runs" ADD CONSTRAINT "saga_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_runs" ADD CONSTRAINT "saga_runs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_runs" ADD CONSTRAINT "saga_runs_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
