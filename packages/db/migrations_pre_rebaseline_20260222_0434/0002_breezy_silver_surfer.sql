DO $$ BEGIN
 CREATE TYPE "capacity_hold_event_type" AS ENUM('created', 'updated', 'extended', 'effect_mode_changed', 'quantity_changed', 'released', 'consumed', 'expired', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_owner_timeline_events" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"calendar_id" text NOT NULL,
	"calendar_binding_id" text NOT NULL,
	"calendar_timeline_event_id" text NOT NULL,
	"owner_type" "calendar_owner_type" NOT NULL,
	"owner_user_id" text,
	"owner_ref_type" varchar(80),
	"owner_ref_id" text,
	"owner_ref_key" varchar(320) NOT NULL,
	"source_type" "calendar_timeline_event_source_type" NOT NULL,
	"state" "calendar_timeline_state" NOT NULL,
	"visibility" "calendar_timeline_visibility" DEFAULT 'private' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"source_ref_type" varchar(80),
	"source_ref_id" text,
	"correlation_id" varchar(200),
	"idempotency_key" varchar(200),
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "capacity_hold_events" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"capacity_hold_id" text NOT NULL,
	"event_type" "capacity_hold_event_type" NOT NULL,
	"previous_status" "capacity_hold_status",
	"next_status" "capacity_hold_status",
	"previous_effect_mode" "capacity_hold_effect_mode",
	"next_effect_mode" "capacity_hold_effect_mode",
	"previous_quantity" integer,
	"next_quantity" integer,
	"actor_user_id" text,
	"actor_ref" varchar(200),
	"request_key" varchar(140),
	"reason_code" varchar(120),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
DROP INDEX IF EXISTS "capacity_hold_policies_biz_default_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "capacity_hold_policies_location_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "capacity_hold_policies_calendar_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "capacity_hold_policies_resource_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "capacity_hold_policies_pool_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "capacity_hold_policies_service_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "capacity_hold_policies_service_product_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "capacity_hold_policies_offer_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "capacity_hold_policies_offer_version_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "capacity_hold_policies_product_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "capacity_hold_policies_sellable_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "capacity_hold_policies_custom_subject_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "capacity_holds_biz_user_owner_status_window_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "capacity_holds_biz_group_owner_status_window_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "capacity_holds_biz_fingerprint_owner_status_window_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "capacity_hold_demand_alerts_biz_target_status_window_idx";--> statement-breakpoint
ALTER TABLE "calendar_bindings" ADD COLUMN "owner_ref_key" varchar(320) NOT NULL;--> statement-breakpoint
ALTER TABLE "capacity_hold_demand_alerts" ADD COLUMN "target_ref_key" varchar(320) NOT NULL;--> statement-breakpoint
ALTER TABLE "capacity_hold_policies" ADD COLUMN "target_ref_key" varchar(320) NOT NULL;--> statement-breakpoint
ALTER TABLE "capacity_holds" ADD COLUMN "target_ref_key" varchar(320) NOT NULL;--> statement-breakpoint
ALTER TABLE "capacity_holds" ADD COLUMN "owner_ref_key" varchar(320);--> statement-breakpoint
ALTER TABLE "autocollection_attempts" ADD COLUMN "status_config_value_id" text;--> statement-breakpoint
ALTER TABLE "installment_plans" ADD COLUMN "status_config_value_id" text;--> statement-breakpoint
ALTER TABLE "installment_schedule_items" ADD COLUMN "status_config_value_id" text;--> statement-breakpoint
ALTER TABLE "production_batch_reservations" ADD COLUMN "status_config_value_id" text;--> statement-breakpoint
ALTER TABLE "production_batches" ADD COLUMN "status_config_value_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_owner_timeline_events_biz_id_id_unique" ON "calendar_owner_timeline_events" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_owner_timeline_events_binding_event_unique" ON "calendar_owner_timeline_events" ("biz_id","calendar_binding_id","calendar_timeline_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_owner_timeline_events_owner_window_state_idx" ON "calendar_owner_timeline_events" ("biz_id","owner_ref_key","is_active","start_at","end_at","state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_owner_timeline_events_owner_user_window_idx" ON "calendar_owner_timeline_events" ("biz_id","owner_user_id","is_active","start_at","end_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_owner_timeline_events_binding_window_idx" ON "calendar_owner_timeline_events" ("biz_id","calendar_binding_id","start_at","end_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_owner_timeline_events_source_ref_idx" ON "calendar_owner_timeline_events" ("biz_id","source_type","source_ref_type","source_ref_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "capacity_hold_events_biz_id_id_unique" ON "capacity_hold_events" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_hold_events_biz_hold_occurred_idx" ON "capacity_hold_events" ("biz_id","capacity_hold_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_hold_events_biz_type_occurred_idx" ON "capacity_hold_events" ("biz_id","event_type","next_status","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_hold_events_biz_request_occurred_idx" ON "capacity_hold_events" ("biz_id","request_key","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_bindings_biz_owner_ref_key_idx" ON "calendar_bindings" ("biz_id","owner_ref_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_hold_policies_biz_target_scope_idx" ON "capacity_hold_policies" ("biz_id","target_type","target_ref_key","status","priority");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "capacity_hold_policies_target_unique" ON "capacity_hold_policies" ("biz_id","target_type","target_ref_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_holds_biz_target_status_window_idx" ON "capacity_holds" ("biz_id","target_type","target_ref_key","status","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_holds_biz_target_demand_window_idx" ON "capacity_holds" ("biz_id","target_type","target_ref_key","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_holds_biz_owner_ref_status_window_idx" ON "capacity_holds" ("biz_id","owner_ref_key","status","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "autocollection_attempts_biz_status_config_schedule_idx" ON "autocollection_attempts" ("biz_id","status_config_value_id","scheduled_for");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "installment_plans_biz_status_config_next_due_idx" ON "installment_plans" ("biz_id","status_config_value_id","next_due_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "installment_schedule_items_biz_status_config_due_idx" ON "installment_schedule_items" ("biz_id","status_config_value_id","due_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "production_batch_reservations_biz_status_config_requested_idx" ON "production_batch_reservations" ("biz_id","status_config_value_id","requested_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "production_batches_biz_status_config_idx" ON "production_batches" ("biz_id","status_config_value_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_hold_demand_alerts_biz_target_status_window_idx" ON "capacity_hold_demand_alerts" ("biz_id","target_type","target_ref_key","status","window_start_at","window_end_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "autocollection_attempts" ADD CONSTRAINT "autocollection_attempts_status_config_value_id_biz_config_values_id_fk" FOREIGN KEY ("status_config_value_id") REFERENCES "biz_config_values"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "autocollection_attempts" ADD CONSTRAINT "autocollection_attempts_biz_status_config_fk" FOREIGN KEY ("biz_id","status_config_value_id") REFERENCES "biz_config_values"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_status_config_value_id_biz_config_values_id_fk" FOREIGN KEY ("status_config_value_id") REFERENCES "biz_config_values"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_biz_status_config_fk" FOREIGN KEY ("biz_id","status_config_value_id") REFERENCES "biz_config_values"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installment_schedule_items" ADD CONSTRAINT "installment_schedule_items_status_config_value_id_biz_config_values_id_fk" FOREIGN KEY ("status_config_value_id") REFERENCES "biz_config_values"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installment_schedule_items" ADD CONSTRAINT "installment_schedule_items_biz_status_config_fk" FOREIGN KEY ("biz_id","status_config_value_id") REFERENCES "biz_config_values"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_batch_reservations" ADD CONSTRAINT "production_batch_reservations_status_config_value_id_biz_config_values_id_fk" FOREIGN KEY ("status_config_value_id") REFERENCES "biz_config_values"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_batch_reservations" ADD CONSTRAINT "production_batch_reservations_biz_status_config_fk" FOREIGN KEY ("biz_id","status_config_value_id") REFERENCES "biz_config_values"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_status_config_value_id_biz_config_values_id_fk" FOREIGN KEY ("status_config_value_id") REFERENCES "biz_config_values"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_biz_status_config_fk" FOREIGN KEY ("biz_id","status_config_value_id") REFERENCES "biz_config_values"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_owner_timeline_events" ADD CONSTRAINT "calendar_owner_timeline_events_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_owner_timeline_events" ADD CONSTRAINT "calendar_owner_timeline_events_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_owner_timeline_events" ADD CONSTRAINT "calendar_owner_timeline_events_calendar_binding_id_calendar_bindings_id_fk" FOREIGN KEY ("calendar_binding_id") REFERENCES "calendar_bindings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_owner_timeline_events" ADD CONSTRAINT "calendar_owner_timeline_events_calendar_timeline_event_id_calendar_timeline_events_id_fk" FOREIGN KEY ("calendar_timeline_event_id") REFERENCES "calendar_timeline_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_owner_timeline_events" ADD CONSTRAINT "calendar_owner_timeline_events_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_owner_timeline_events" ADD CONSTRAINT "calendar_owner_timeline_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_owner_timeline_events" ADD CONSTRAINT "calendar_owner_timeline_events_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_owner_timeline_events" ADD CONSTRAINT "calendar_owner_timeline_events_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_owner_timeline_events" ADD CONSTRAINT "calendar_owner_timeline_events_biz_calendar_fk" FOREIGN KEY ("biz_id","calendar_id") REFERENCES "calendars"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_owner_timeline_events" ADD CONSTRAINT "calendar_owner_timeline_events_biz_binding_fk" FOREIGN KEY ("biz_id","calendar_binding_id") REFERENCES "calendar_bindings"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_owner_timeline_events" ADD CONSTRAINT "calendar_owner_timeline_events_biz_timeline_event_fk" FOREIGN KEY ("biz_id","calendar_timeline_event_id") REFERENCES "calendar_timeline_events"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_events" ADD CONSTRAINT "capacity_hold_events_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_events" ADD CONSTRAINT "capacity_hold_events_capacity_hold_id_capacity_holds_id_fk" FOREIGN KEY ("capacity_hold_id") REFERENCES "capacity_holds"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_events" ADD CONSTRAINT "capacity_hold_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_events" ADD CONSTRAINT "capacity_hold_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_events" ADD CONSTRAINT "capacity_hold_events_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_events" ADD CONSTRAINT "capacity_hold_events_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_events" ADD CONSTRAINT "capacity_hold_events_biz_hold_fk" FOREIGN KEY ("biz_id","capacity_hold_id") REFERENCES "capacity_holds"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_events" ADD CONSTRAINT "capacity_hold_events_biz_actor_user_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
