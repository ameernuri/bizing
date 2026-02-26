CREATE TABLE IF NOT EXISTS "saga_coverage_items" (
	"id" text PRIMARY KEY NOT NULL,
	"saga_coverage_report_id" text NOT NULL,
	"saga_run_step_id" text,
	"item_type" varchar(50) NOT NULL,
	"item_ref_key" varchar(220) NOT NULL,
	"item_title" varchar(255),
	"verdict" varchar(20) NOT NULL,
	"native_to_hacky" varchar(40),
	"core_to_extension" varchar(50),
	"explanation" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saga_coverage_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"saga_run_id" text,
	"saga_definition_id" text,
	"scope_type" varchar(40) DEFAULT 'run' NOT NULL,
	"status" varchar(30) DEFAULT 'published' NOT NULL,
	"title" varchar(255),
	"report_markdown" text,
	"summary" text,
	"coverage_pct" integer,
	"strong_pct" integer,
	"full_pct" integer,
	"report_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saga_definition_links" (
	"id" text PRIMARY KEY NOT NULL,
	"saga_definition_id" text NOT NULL,
	"saga_use_case_version_id" text,
	"saga_persona_version_id" text,
	"saga_scenario_version_id" text,
	"relation_role" varchar(60) DEFAULT 'primary' NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saga_definition_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"saga_definition_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"spec_version" varchar(40) DEFAULT 'v0' NOT NULL,
	"spec_checksum" varchar(128) NOT NULL,
	"spec_json" jsonb NOT NULL,
	"source_file_path" varchar(700),
	"is_current" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saga_persona_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"saga_persona_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"profile" text,
	"goals" text,
	"pain_points" text,
	"test_scenarios" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"body_markdown" text NOT NULL,
	"content_checksum" varchar(128) NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saga_personas" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"persona_key" varchar(120) NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" "saga_definition_status" DEFAULT 'active' NOT NULL,
	"source_file_path" varchar(700),
	"source_ref" varchar(200),
	"profile_summary" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saga_scenario_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"saga_scenario_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"saga_use_case_version_id" text,
	"saga_persona_version_id" text,
	"title" varchar(255) NOT NULL,
	"narrative" text NOT NULL,
	"checkpoints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"body_markdown" text,
	"content_checksum" varchar(128) NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saga_scenarios" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"scenario_key" varchar(160) NOT NULL,
	"title" varchar(255) NOT NULL,
	"summary" text,
	"status" "saga_definition_status" DEFAULT 'active' NOT NULL,
	"source_file_path" varchar(700),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saga_tag_bindings" (
	"id" text PRIMARY KEY NOT NULL,
	"saga_tag_id" text NOT NULL,
	"target_type" varchar(60) NOT NULL,
	"target_id" text NOT NULL,
	"note" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saga_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"tag_key" varchar(80) NOT NULL,
	"label" varchar(120),
	"category" varchar(60),
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saga_use_case_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"saga_use_case_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"summary" text,
	"body_markdown" text NOT NULL,
	"extracted_needs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"extracted_scenario" text,
	"content_checksum" varchar(128) NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saga_use_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"uc_key" varchar(120) NOT NULL,
	"title" varchar(255) NOT NULL,
	"status" "saga_definition_status" DEFAULT 'active' NOT NULL,
	"source_file_path" varchar(700),
	"source_ref" varchar(200),
	"summary" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saga_coverage_items_report_item_unique" ON "saga_coverage_items" ("saga_coverage_report_id","item_type","item_ref_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_coverage_items_verdict_idx" ON "saga_coverage_items" ("verdict","native_to_hacky","core_to_extension");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_coverage_items_report_idx" ON "saga_coverage_items" ("saga_coverage_report_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saga_coverage_reports_run_unique" ON "saga_coverage_reports" ("saga_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_coverage_reports_scope_idx" ON "saga_coverage_reports" ("scope_type","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_coverage_reports_biz_idx" ON "saga_coverage_reports" ("biz_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saga_definition_links_unique" ON "saga_definition_links" ("saga_definition_id","saga_use_case_version_id","saga_persona_version_id","saga_scenario_version_id","relation_role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_definition_links_definition_idx" ON "saga_definition_links" ("saga_definition_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saga_definition_revisions_unique" ON "saga_definition_revisions" ("saga_definition_id","revision_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_definition_revisions_current_idx" ON "saga_definition_revisions" ("saga_definition_id","is_current");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_definition_revisions_checksum_idx" ON "saga_definition_revisions" ("saga_definition_id","spec_checksum");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saga_persona_versions_unique" ON "saga_persona_versions" ("saga_persona_id","version_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_persona_versions_current_idx" ON "saga_persona_versions" ("saga_persona_id","is_current");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saga_personas_persona_key_unique" ON "saga_personas" ("persona_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_personas_biz_status_idx" ON "saga_personas" ("biz_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saga_scenario_versions_unique" ON "saga_scenario_versions" ("saga_scenario_id","version_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_scenario_versions_current_idx" ON "saga_scenario_versions" ("saga_scenario_id","is_current");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saga_scenarios_scenario_key_unique" ON "saga_scenarios" ("scenario_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_scenarios_biz_status_idx" ON "saga_scenarios" ("biz_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saga_tag_bindings_unique" ON "saga_tag_bindings" ("saga_tag_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_tag_bindings_target_idx" ON "saga_tag_bindings" ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saga_tags_tag_key_unique" ON "saga_tags" ("tag_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_tags_category_idx" ON "saga_tags" ("category");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saga_use_case_versions_unique" ON "saga_use_case_versions" ("saga_use_case_id","version_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_use_case_versions_current_idx" ON "saga_use_case_versions" ("saga_use_case_id","is_current");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saga_use_cases_uc_key_unique" ON "saga_use_cases" ("uc_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_use_cases_biz_status_idx" ON "saga_use_cases" ("biz_id","status");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_coverage_items" ADD CONSTRAINT "saga_coverage_items_saga_coverage_report_id_saga_coverage_reports_id_fk" FOREIGN KEY ("saga_coverage_report_id") REFERENCES "saga_coverage_reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_coverage_items" ADD CONSTRAINT "saga_coverage_items_saga_run_step_id_saga_run_steps_id_fk" FOREIGN KEY ("saga_run_step_id") REFERENCES "saga_run_steps"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_coverage_items" ADD CONSTRAINT "saga_coverage_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_coverage_items" ADD CONSTRAINT "saga_coverage_items_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_coverage_items" ADD CONSTRAINT "saga_coverage_items_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_coverage_reports" ADD CONSTRAINT "saga_coverage_reports_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_coverage_reports" ADD CONSTRAINT "saga_coverage_reports_saga_run_id_saga_runs_id_fk" FOREIGN KEY ("saga_run_id") REFERENCES "saga_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_coverage_reports" ADD CONSTRAINT "saga_coverage_reports_saga_definition_id_saga_definitions_id_fk" FOREIGN KEY ("saga_definition_id") REFERENCES "saga_definitions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_coverage_reports" ADD CONSTRAINT "saga_coverage_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_coverage_reports" ADD CONSTRAINT "saga_coverage_reports_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_coverage_reports" ADD CONSTRAINT "saga_coverage_reports_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_definition_links" ADD CONSTRAINT "saga_definition_links_saga_definition_id_saga_definitions_id_fk" FOREIGN KEY ("saga_definition_id") REFERENCES "saga_definitions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_definition_links" ADD CONSTRAINT "saga_definition_links_saga_use_case_version_id_saga_use_case_versions_id_fk" FOREIGN KEY ("saga_use_case_version_id") REFERENCES "saga_use_case_versions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_definition_links" ADD CONSTRAINT "saga_definition_links_saga_persona_version_id_saga_persona_versions_id_fk" FOREIGN KEY ("saga_persona_version_id") REFERENCES "saga_persona_versions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_definition_links" ADD CONSTRAINT "saga_definition_links_saga_scenario_version_id_saga_scenario_versions_id_fk" FOREIGN KEY ("saga_scenario_version_id") REFERENCES "saga_scenario_versions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_definition_links" ADD CONSTRAINT "saga_definition_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_definition_links" ADD CONSTRAINT "saga_definition_links_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_definition_links" ADD CONSTRAINT "saga_definition_links_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_definition_revisions" ADD CONSTRAINT "saga_definition_revisions_saga_definition_id_saga_definitions_id_fk" FOREIGN KEY ("saga_definition_id") REFERENCES "saga_definitions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_definition_revisions" ADD CONSTRAINT "saga_definition_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_definition_revisions" ADD CONSTRAINT "saga_definition_revisions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_definition_revisions" ADD CONSTRAINT "saga_definition_revisions_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_persona_versions" ADD CONSTRAINT "saga_persona_versions_saga_persona_id_saga_personas_id_fk" FOREIGN KEY ("saga_persona_id") REFERENCES "saga_personas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_persona_versions" ADD CONSTRAINT "saga_persona_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_persona_versions" ADD CONSTRAINT "saga_persona_versions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_persona_versions" ADD CONSTRAINT "saga_persona_versions_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_personas" ADD CONSTRAINT "saga_personas_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_personas" ADD CONSTRAINT "saga_personas_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_personas" ADD CONSTRAINT "saga_personas_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_personas" ADD CONSTRAINT "saga_personas_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_scenario_versions" ADD CONSTRAINT "saga_scenario_versions_saga_scenario_id_saga_scenarios_id_fk" FOREIGN KEY ("saga_scenario_id") REFERENCES "saga_scenarios"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_scenario_versions" ADD CONSTRAINT "saga_scenario_versions_saga_use_case_version_id_saga_use_case_versions_id_fk" FOREIGN KEY ("saga_use_case_version_id") REFERENCES "saga_use_case_versions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_scenario_versions" ADD CONSTRAINT "saga_scenario_versions_saga_persona_version_id_saga_persona_versions_id_fk" FOREIGN KEY ("saga_persona_version_id") REFERENCES "saga_persona_versions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_scenario_versions" ADD CONSTRAINT "saga_scenario_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_scenario_versions" ADD CONSTRAINT "saga_scenario_versions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_scenario_versions" ADD CONSTRAINT "saga_scenario_versions_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_scenarios" ADD CONSTRAINT "saga_scenarios_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_scenarios" ADD CONSTRAINT "saga_scenarios_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_scenarios" ADD CONSTRAINT "saga_scenarios_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_scenarios" ADD CONSTRAINT "saga_scenarios_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_tag_bindings" ADD CONSTRAINT "saga_tag_bindings_saga_tag_id_saga_tags_id_fk" FOREIGN KEY ("saga_tag_id") REFERENCES "saga_tags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_tag_bindings" ADD CONSTRAINT "saga_tag_bindings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_tag_bindings" ADD CONSTRAINT "saga_tag_bindings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_tag_bindings" ADD CONSTRAINT "saga_tag_bindings_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_tags" ADD CONSTRAINT "saga_tags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_tags" ADD CONSTRAINT "saga_tags_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_tags" ADD CONSTRAINT "saga_tags_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_use_case_versions" ADD CONSTRAINT "saga_use_case_versions_saga_use_case_id_saga_use_cases_id_fk" FOREIGN KEY ("saga_use_case_id") REFERENCES "saga_use_cases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_use_case_versions" ADD CONSTRAINT "saga_use_case_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_use_case_versions" ADD CONSTRAINT "saga_use_case_versions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_use_case_versions" ADD CONSTRAINT "saga_use_case_versions_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_use_cases" ADD CONSTRAINT "saga_use_cases_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_use_cases" ADD CONSTRAINT "saga_use_cases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_use_cases" ADD CONSTRAINT "saga_use_cases_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_use_cases" ADD CONSTRAINT "saga_use_cases_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
