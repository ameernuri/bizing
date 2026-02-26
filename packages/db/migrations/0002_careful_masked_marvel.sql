ALTER TYPE "booking_order_status" ADD VALUE 'checked_in';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "extension_instances" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"extension_definition_id" text NOT NULL,
	"entity_type" varchar(120) NOT NULL,
	"entity_id" varchar(140) NOT NULL,
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"label" varchar(200),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "extension_instances_biz_id_id_unique" ON "extension_instances" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "extension_instances_biz_entity_extension_unique" ON "extension_instances" ("biz_id","entity_type","entity_id","extension_definition_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extension_instances_biz_entity_idx" ON "extension_instances" ("biz_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extension_instances_biz_extension_idx" ON "extension_instances" ("biz_id","extension_definition_id","status");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "extension_instances" ADD CONSTRAINT "extension_instances_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "extension_instances" ADD CONSTRAINT "extension_instances_extension_definition_id_extension_definitions_id_fk" FOREIGN KEY ("extension_definition_id") REFERENCES "extension_definitions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "extension_instances" ADD CONSTRAINT "extension_instances_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "extension_instances" ADD CONSTRAINT "extension_instances_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "extension_instances" ADD CONSTRAINT "extension_instances_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "extension_instances" ADD CONSTRAINT "extension_instances_extension_def_fk" FOREIGN KEY ("extension_definition_id") REFERENCES "extension_definitions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
