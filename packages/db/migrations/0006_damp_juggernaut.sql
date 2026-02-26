CREATE TABLE IF NOT EXISTS "authz_membership_role_mappings" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"membership_role" varchar(60) NOT NULL,
	"role_definition_id" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "authz_permission_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"permission_key" varchar(180) NOT NULL,
	"name" varchar(220) NOT NULL,
	"description" varchar(1000),
	"module_key" varchar(120) DEFAULT 'core' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "authz_role_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"biz_id" text,
	"role_definition_id" text NOT NULL,
	"scope_type" "authz_scope_type" NOT NULL,
	"scope_ref" varchar(280) NOT NULL,
	"location_id" text,
	"resource_id" text,
	"scope_subject_type" varchar(80),
	"scope_subject_id" varchar(140),
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "authz_role_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"scope_type" "authz_scope_type" NOT NULL,
	"scope_ref" varchar(280) NOT NULL,
	"location_id" text,
	"resource_id" text,
	"scope_subject_type" varchar(80),
	"scope_subject_id" varchar(140),
	"role_key" varchar(140) NOT NULL,
	"name" varchar(220) NOT NULL,
	"description" varchar(1000),
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "authz_role_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"role_definition_id" text NOT NULL,
	"permission_definition_id" text NOT NULL,
	"effect" "authz_permission_effect" DEFAULT 'allow' NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"condition" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "authz_membership_role_mappings_biz_id_id_unique" ON "authz_membership_role_mappings" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "authz_membership_role_mappings_unique" ON "authz_membership_role_mappings" ("biz_id","membership_role","role_definition_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "authz_membership_role_mappings_lookup_idx" ON "authz_membership_role_mappings" ("biz_id","membership_role","is_active","priority");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "authz_permission_definitions_key_unique" ON "authz_permission_definitions" ("permission_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "authz_permission_definitions_module_idx" ON "authz_permission_definitions" ("module_key","is_system");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "authz_role_assignments_biz_id_id_unique" ON "authz_role_assignments" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "authz_role_assignments_unique" ON "authz_role_assignments" ("user_id","role_definition_id","scope_ref");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "authz_role_assignments_user_status_idx" ON "authz_role_assignments" ("user_id","status","effective_from","effective_to");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "authz_role_assignments_biz_scope_idx" ON "authz_role_assignments" ("biz_id","scope_type","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "authz_role_definitions_biz_id_id_unique" ON "authz_role_definitions" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "authz_role_definitions_scope_role_unique" ON "authz_role_definitions" ("scope_ref","role_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "authz_role_definitions_biz_scope_status_idx" ON "authz_role_definitions" ("biz_id","scope_type","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "authz_role_permissions_unique" ON "authz_role_permissions" ("role_definition_id","permission_definition_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "authz_role_permissions_role_active_idx" ON "authz_role_permissions" ("role_definition_id","is_active","priority");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_membership_role_mappings" ADD CONSTRAINT "authz_membership_role_mappings_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_membership_role_mappings" ADD CONSTRAINT "authz_membership_role_mappings_role_definition_id_authz_role_definitions_id_fk" FOREIGN KEY ("role_definition_id") REFERENCES "authz_role_definitions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_membership_role_mappings" ADD CONSTRAINT "authz_membership_role_mappings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_membership_role_mappings" ADD CONSTRAINT "authz_membership_role_mappings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_membership_role_mappings" ADD CONSTRAINT "authz_membership_role_mappings_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_permission_definitions" ADD CONSTRAINT "authz_permission_definitions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_permission_definitions" ADD CONSTRAINT "authz_permission_definitions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_permission_definitions" ADD CONSTRAINT "authz_permission_definitions_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_assignments" ADD CONSTRAINT "authz_role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_assignments" ADD CONSTRAINT "authz_role_assignments_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_assignments" ADD CONSTRAINT "authz_role_assignments_role_definition_id_authz_role_definitions_id_fk" FOREIGN KEY ("role_definition_id") REFERENCES "authz_role_definitions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_assignments" ADD CONSTRAINT "authz_role_assignments_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_assignments" ADD CONSTRAINT "authz_role_assignments_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_assignments" ADD CONSTRAINT "authz_role_assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_assignments" ADD CONSTRAINT "authz_role_assignments_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_assignments" ADD CONSTRAINT "authz_role_assignments_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_assignments" ADD CONSTRAINT "authz_role_assignments_biz_location_fk" FOREIGN KEY ("biz_id","location_id") REFERENCES "locations"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_assignments" ADD CONSTRAINT "authz_role_assignments_biz_resource_fk" FOREIGN KEY ("biz_id","resource_id") REFERENCES "resources"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_assignments" ADD CONSTRAINT "authz_role_assignments_biz_subject_fk" FOREIGN KEY ("biz_id","scope_subject_type","scope_subject_id") REFERENCES "subjects"("biz_id","subject_type","subject_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_definitions" ADD CONSTRAINT "authz_role_definitions_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_definitions" ADD CONSTRAINT "authz_role_definitions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_definitions" ADD CONSTRAINT "authz_role_definitions_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_definitions" ADD CONSTRAINT "authz_role_definitions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_definitions" ADD CONSTRAINT "authz_role_definitions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_definitions" ADD CONSTRAINT "authz_role_definitions_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_definitions" ADD CONSTRAINT "authz_role_definitions_biz_location_fk" FOREIGN KEY ("biz_id","location_id") REFERENCES "locations"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_definitions" ADD CONSTRAINT "authz_role_definitions_biz_resource_fk" FOREIGN KEY ("biz_id","resource_id") REFERENCES "resources"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_definitions" ADD CONSTRAINT "authz_role_definitions_biz_subject_fk" FOREIGN KEY ("biz_id","scope_subject_type","scope_subject_id") REFERENCES "subjects"("biz_id","subject_type","subject_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_permissions" ADD CONSTRAINT "authz_role_permissions_role_definition_id_authz_role_definitions_id_fk" FOREIGN KEY ("role_definition_id") REFERENCES "authz_role_definitions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_permissions" ADD CONSTRAINT "authz_role_permissions_permission_definition_id_authz_permission_definitions_id_fk" FOREIGN KEY ("permission_definition_id") REFERENCES "authz_permission_definitions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_permissions" ADD CONSTRAINT "authz_role_permissions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_permissions" ADD CONSTRAINT "authz_role_permissions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authz_role_permissions" ADD CONSTRAINT "authz_role_permissions_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
