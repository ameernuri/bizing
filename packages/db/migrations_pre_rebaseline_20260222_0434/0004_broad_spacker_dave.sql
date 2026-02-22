DO $$ BEGIN
 CREATE TYPE "fulfillment_assignment_event_type" AS ENUM('created', 'status_changed', 'resource_changed', 'window_changed', 'conflict_policy_changed', 'cancelled', 'completed', 'metadata_updated');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "payment_intent_event_type" AS ENUM('created', 'status_changed', 'amount_updated', 'authorized', 'captured', 'partially_captured', 'failed', 'cancelled', 'refunded', 'metadata_updated');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fulfillment_assignment_events" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"fulfillment_assignment_id" text NOT NULL,
	"event_type" "fulfillment_assignment_event_type" NOT NULL,
	"previous_status" "fulfillment_assignment_status",
	"next_status" "fulfillment_assignment_status",
	"previous_resource_id" text,
	"next_resource_id" text,
	"previous_starts_at" timestamp with time zone,
	"next_starts_at" timestamp with time zone,
	"previous_ends_at" timestamp with time zone,
	"next_ends_at" timestamp with time zone,
	"previous_conflict_policy" "fulfillment_assignment_conflict_policy",
	"next_conflict_policy" "fulfillment_assignment_conflict_policy",
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
CREATE TABLE IF NOT EXISTS "payment_intent_events" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"payment_intent_id" text NOT NULL,
	"event_type" "payment_intent_event_type" NOT NULL,
	"previous_status" "payment_intent_status",
	"next_status" "payment_intent_status",
	"previous_amount_target_minor" integer,
	"next_amount_target_minor" integer,
	"previous_amount_captured_minor" integer,
	"next_amount_captured_minor" integer,
	"previous_amount_refunded_minor" integer,
	"next_amount_refunded_minor" integer,
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
ALTER TABLE "sales_quotes" ADD COLUMN "status_config_value_id" text;--> statement-breakpoint
ALTER TABLE "gift_delivery_attempts" ADD COLUMN "status_config_value_id" text;--> statement-breakpoint
ALTER TABLE "gift_delivery_schedules" ADD COLUMN "status_config_value_id" text;--> statement-breakpoint
ALTER TABLE "marketing_audience_sync_runs" ADD COLUMN "status_config_value_id" text;--> statement-breakpoint
ALTER TABLE "offline_conversion_pushes" ADD COLUMN "status_config_value_id" text;--> statement-breakpoint
ALTER TABLE "crm_conversation_messages" ADD COLUMN "status_config_value_id" text;--> statement-breakpoint
ALTER TABLE "crm_conversations" ADD COLUMN "status_config_value_id" text;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD COLUMN "status_config_value_id" text;--> statement-breakpoint
ALTER TABLE "crm_merge_candidates" ADD COLUMN "status_config_value_id" text;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD COLUMN "status_config_value_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fulfillment_assignment_events_biz_id_id_unique" ON "fulfillment_assignment_events" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fulfillment_assignment_events_biz_assignment_occurred_idx" ON "fulfillment_assignment_events" ("biz_id","fulfillment_assignment_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fulfillment_assignment_events_biz_type_occurred_idx" ON "fulfillment_assignment_events" ("biz_id","event_type","next_status","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fulfillment_assignment_events_biz_request_occurred_idx" ON "fulfillment_assignment_events" ("biz_id","request_key","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_intent_events_biz_id_id_unique" ON "payment_intent_events" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_intent_events_biz_intent_occurred_idx" ON "payment_intent_events" ("biz_id","payment_intent_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_intent_events_biz_type_occurred_idx" ON "payment_intent_events" ("biz_id","event_type","next_status","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_intent_events_biz_request_occurred_idx" ON "payment_intent_events" ("biz_id","request_key","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_owner_timeline_events_binding_idempotency_unique" ON "calendar_owner_timeline_events" ("biz_id","calendar_binding_id","idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_quotes_biz_status_config_valid_until_idx" ON "sales_quotes" ("biz_id","status_config_value_id","valid_until");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gift_delivery_attempts_biz_status_config_attempted_idx" ON "gift_delivery_attempts" ("biz_id","status_config_value_id","attempted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gift_delivery_schedules_biz_status_config_send_idx" ON "gift_delivery_schedules" ("biz_id","status_config_value_id","send_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_audience_sync_runs_biz_status_config_requested_idx" ON "marketing_audience_sync_runs" ("biz_id","status_config_value_id","requested_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "offline_conversion_pushes_biz_status_config_conversion_idx" ON "offline_conversion_pushes" ("biz_id","status_config_value_id","conversion_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_conversation_messages_biz_status_config_occurred_idx" ON "crm_conversation_messages" ("biz_id","status_config_value_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_conversations_biz_status_config_recency_idx" ON "crm_conversations" ("biz_id","status_config_value_id","last_message_at","priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_leads_biz_status_config_priority_idx" ON "crm_leads" ("biz_id","status_config_value_id","priority","score_bps");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_merge_candidates_biz_status_config_detected_idx" ON "crm_merge_candidates" ("biz_id","status_config_value_id","detected_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_opportunities_biz_status_config_stage_idx" ON "crm_opportunities" ("biz_id","status_config_value_id","crm_pipeline_stage_id","probability_bps");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sales_quotes" ADD CONSTRAINT "sales_quotes_biz_status_config_fk" FOREIGN KEY ("biz_id","status_config_value_id") REFERENCES "biz_config_values"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gift_delivery_attempts" ADD CONSTRAINT "gift_delivery_attempts_biz_status_config_fk" FOREIGN KEY ("biz_id","status_config_value_id") REFERENCES "biz_config_values"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gift_delivery_schedules" ADD CONSTRAINT "gift_delivery_schedules_biz_status_config_fk" FOREIGN KEY ("biz_id","status_config_value_id") REFERENCES "biz_config_values"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketing_audience_sync_runs" ADD CONSTRAINT "marketing_audience_sync_runs_biz_status_config_fk" FOREIGN KEY ("biz_id","status_config_value_id") REFERENCES "biz_config_values"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "offline_conversion_pushes" ADD CONSTRAINT "offline_conversion_pushes_biz_status_config_fk" FOREIGN KEY ("biz_id","status_config_value_id") REFERENCES "biz_config_values"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_conversation_messages" ADD CONSTRAINT "crm_conversation_messages_biz_status_config_fk" FOREIGN KEY ("biz_id","status_config_value_id") REFERENCES "biz_config_values"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_conversations" ADD CONSTRAINT "crm_conversations_biz_status_config_fk" FOREIGN KEY ("biz_id","status_config_value_id") REFERENCES "biz_config_values"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_biz_status_config_fk" FOREIGN KEY ("biz_id","status_config_value_id") REFERENCES "biz_config_values"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_merge_candidates" ADD CONSTRAINT "crm_merge_candidates_biz_status_config_fk" FOREIGN KEY ("biz_id","status_config_value_id") REFERENCES "biz_config_values"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_biz_status_config_fk" FOREIGN KEY ("biz_id","status_config_value_id") REFERENCES "biz_config_values"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fulfillment_assignment_events" ADD CONSTRAINT "fulfillment_assignment_events_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fulfillment_assignment_events" ADD CONSTRAINT "fulfillment_assignment_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fulfillment_assignment_events" ADD CONSTRAINT "fulfillment_assignment_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fulfillment_assignment_events" ADD CONSTRAINT "fulfillment_assignment_events_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fulfillment_assignment_events" ADD CONSTRAINT "fulfillment_assignment_events_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fulfillment_assignment_events" ADD CONSTRAINT "fulfillment_assignment_events_biz_assignment_fk" FOREIGN KEY ("biz_id","fulfillment_assignment_id") REFERENCES "fulfillment_assignments"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fulfillment_assignment_events" ADD CONSTRAINT "fulfillment_assignment_events_biz_previous_resource_fk" FOREIGN KEY ("biz_id","previous_resource_id") REFERENCES "resources"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fulfillment_assignment_events" ADD CONSTRAINT "fulfillment_assignment_events_biz_next_resource_fk" FOREIGN KEY ("biz_id","next_resource_id") REFERENCES "resources"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_intent_events" ADD CONSTRAINT "payment_intent_events_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_intent_events" ADD CONSTRAINT "payment_intent_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_intent_events" ADD CONSTRAINT "payment_intent_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_intent_events" ADD CONSTRAINT "payment_intent_events_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_intent_events" ADD CONSTRAINT "payment_intent_events_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_intent_events" ADD CONSTRAINT "payment_intent_events_biz_intent_fk" FOREIGN KEY ("biz_id","payment_intent_id") REFERENCES "payment_intents"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
