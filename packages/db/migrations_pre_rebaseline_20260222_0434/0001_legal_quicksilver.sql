DO $$ BEGIN
 CREATE TYPE "capacity_hold_demand_alert_severity" AS ENUM('low', 'medium', 'high', 'critical');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "capacity_hold_demand_alert_status" AS ENUM('open', 'acknowledged', 'resolved', 'dismissed', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "capacity_hold_effect_mode" AS ENUM('blocking', 'non_blocking', 'advisory');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "capacity_hold_owner_type" AS ENUM('user', 'group_account', 'subject', 'guest_fingerprint', 'system');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "capacity_hold_policy_target_type" AS ENUM('biz', 'location', 'calendar', 'resource', 'capacity_pool', 'service', 'service_product', 'offer', 'offer_version', 'product', 'sellable', 'custom_subject');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "capacity_hold_demand_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"capacity_hold_policy_id" text,
	"target_type" "capacity_hold_policy_target_type" NOT NULL,
	"location_id" text,
	"calendar_id" text,
	"resource_id" text,
	"capacity_pool_id" text,
	"service_id" text,
	"service_product_id" text,
	"offer_id" text,
	"offer_version_id" text,
	"product_id" text,
	"sellable_id" text,
	"target_ref_type" varchar(80),
	"target_ref_id" text,
	"status" "capacity_hold_demand_alert_status" DEFAULT 'open' NOT NULL,
	"severity" "capacity_hold_demand_alert_severity" DEFAULT 'medium' NOT NULL,
	"window_start_at" timestamp with time zone NOT NULL,
	"window_end_at" timestamp with time zone NOT NULL,
	"blocking_hold_count" integer DEFAULT 0 NOT NULL,
	"non_blocking_hold_count" integer DEFAULT 0 NOT NULL,
	"unique_owner_count" integer DEFAULT 0 NOT NULL,
	"pressure_score" integer DEFAULT 0 NOT NULL,
	"title" varchar(260),
	"summary" varchar(1200),
	"request_key" varchar(140),
	"first_triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"threshold_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "capacity_hold_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" varchar(1000),
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"target_type" "capacity_hold_policy_target_type" NOT NULL,
	"location_id" text,
	"calendar_id" text,
	"resource_id" text,
	"capacity_pool_id" text,
	"service_id" text,
	"service_product_id" text,
	"offer_id" text,
	"offer_version_id" text,
	"product_id" text,
	"sellable_id" text,
	"target_ref_type" varchar(80),
	"target_ref_id" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"allow_blocking_holds" boolean DEFAULT true NOT NULL,
	"allow_non_blocking_holds" boolean DEFAULT false NOT NULL,
	"default_effect_mode" "capacity_hold_effect_mode" DEFAULT 'blocking' NOT NULL,
	"min_hold_duration_min" integer DEFAULT 1 NOT NULL,
	"max_hold_duration_min" integer DEFAULT 30 NOT NULL,
	"default_hold_duration_min" integer DEFAULT 10 NOT NULL,
	"max_active_holds_per_owner" integer,
	"max_active_blocking_holds_per_owner" integer,
	"max_active_non_blocking_holds_per_owner" integer,
	"cooldown_after_expiry_sec" integer DEFAULT 0 NOT NULL,
	"require_owner_identity" boolean DEFAULT false NOT NULL,
	"require_payment_intent_for_blocking_hold" boolean DEFAULT false NOT NULL,
	"min_preauth_amount_minor" integer,
	"emit_demand_signals" boolean DEFAULT true NOT NULL,
	"emit_act_fast_alerts" boolean DEFAULT true NOT NULL,
	"act_fast_threshold_count" integer,
	"act_fast_threshold_unique_owners" integer,
	"priority" integer DEFAULT 100 NOT NULL,
	"effective_start_at" timestamp with time zone,
	"effective_end_at" timestamp with time zone,
	"policy" jsonb DEFAULT '{}'::jsonb,
	"notification_policy" jsonb DEFAULT '{}'::jsonb,
	"anti_abuse_policy" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
ALTER TABLE "capacity_holds" ADD COLUMN "capacity_hold_policy_id" text;--> statement-breakpoint
ALTER TABLE "capacity_holds" ADD COLUMN "effect_mode" "capacity_hold_effect_mode" DEFAULT 'blocking' NOT NULL;--> statement-breakpoint
ALTER TABLE "capacity_holds" ADD COLUMN "demand_weight" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "capacity_holds" ADD COLUMN "counts_toward_demand" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "capacity_holds" ADD COLUMN "owner_type" "capacity_hold_owner_type";--> statement-breakpoint
ALTER TABLE "capacity_holds" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "capacity_holds" ADD COLUMN "owner_group_account_id" text;--> statement-breakpoint
ALTER TABLE "capacity_holds" ADD COLUMN "owner_subject_type" varchar(80);--> statement-breakpoint
ALTER TABLE "capacity_holds" ADD COLUMN "owner_subject_id" text;--> statement-breakpoint
ALTER TABLE "capacity_holds" ADD COLUMN "owner_fingerprint_hash" varchar(140);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "capacity_hold_demand_alerts_biz_id_id_unique" ON "capacity_hold_demand_alerts" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "capacity_hold_demand_alerts_biz_request_key_unique" ON "capacity_hold_demand_alerts" ("biz_id","request_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_hold_demand_alerts_biz_status_severity_observed_idx" ON "capacity_hold_demand_alerts" ("biz_id","status","severity","last_observed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_hold_demand_alerts_biz_target_status_window_idx" ON "capacity_hold_demand_alerts" ("biz_id","target_type","status","window_start_at","window_end_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_hold_demand_alerts_biz_calendar_status_window_idx" ON "capacity_hold_demand_alerts" ("biz_id","calendar_id","status","window_start_at","window_end_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "capacity_hold_policies_biz_id_id_unique" ON "capacity_hold_policies" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_hold_policies_biz_status_target_priority_idx" ON "capacity_hold_policies" ("biz_id","status","target_type","priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_hold_policies_biz_status_window_idx" ON "capacity_hold_policies" ("biz_id","status","effective_start_at","effective_end_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "capacity_hold_policies_biz_default_unique" ON "capacity_hold_policies" ("biz_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "capacity_hold_policies_location_unique" ON "capacity_hold_policies" ("biz_id","location_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "capacity_hold_policies_calendar_unique" ON "capacity_hold_policies" ("biz_id","calendar_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "capacity_hold_policies_resource_unique" ON "capacity_hold_policies" ("biz_id","resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "capacity_hold_policies_pool_unique" ON "capacity_hold_policies" ("biz_id","capacity_pool_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "capacity_hold_policies_service_unique" ON "capacity_hold_policies" ("biz_id","service_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "capacity_hold_policies_service_product_unique" ON "capacity_hold_policies" ("biz_id","service_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "capacity_hold_policies_offer_unique" ON "capacity_hold_policies" ("biz_id","offer_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "capacity_hold_policies_offer_version_unique" ON "capacity_hold_policies" ("biz_id","offer_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "capacity_hold_policies_product_unique" ON "capacity_hold_policies" ("biz_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "capacity_hold_policies_sellable_unique" ON "capacity_hold_policies" ("biz_id","sellable_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "capacity_hold_policies_custom_subject_unique" ON "capacity_hold_policies" ("biz_id","target_ref_type","target_ref_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_holds_biz_effect_status_window_idx" ON "capacity_holds" ("biz_id","effect_mode","status","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_holds_biz_policy_status_window_idx" ON "capacity_holds" ("biz_id","capacity_hold_policy_id","status","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_holds_biz_owner_status_window_idx" ON "capacity_holds" ("biz_id","owner_type","status","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_holds_biz_user_owner_status_window_idx" ON "capacity_holds" ("biz_id","owner_user_id","status","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_holds_biz_group_owner_status_window_idx" ON "capacity_holds" ("biz_id","owner_group_account_id","status","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_holds_biz_fingerprint_owner_status_window_idx" ON "capacity_holds" ("biz_id","owner_fingerprint_hash","status","starts_at","ends_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_holds" ADD CONSTRAINT "capacity_holds_capacity_hold_policy_id_capacity_hold_policies_id_fk" FOREIGN KEY ("capacity_hold_policy_id") REFERENCES "capacity_hold_policies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_holds" ADD CONSTRAINT "capacity_holds_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_holds" ADD CONSTRAINT "capacity_holds_owner_group_account_id_group_accounts_id_fk" FOREIGN KEY ("owner_group_account_id") REFERENCES "group_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_holds" ADD CONSTRAINT "capacity_holds_biz_policy_fk" FOREIGN KEY ("biz_id","capacity_hold_policy_id") REFERENCES "capacity_hold_policies"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_holds" ADD CONSTRAINT "capacity_holds_biz_owner_group_account_fk" FOREIGN KEY ("biz_id","owner_group_account_id") REFERENCES "group_accounts"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_holds" ADD CONSTRAINT "capacity_holds_biz_owner_subject_fk" FOREIGN KEY ("biz_id","owner_subject_type","owner_subject_id") REFERENCES "subjects"("biz_id","subject_type","subject_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_capacity_hold_policy_id_capacity_hold_policies_id_fk" FOREIGN KEY ("capacity_hold_policy_id") REFERENCES "capacity_hold_policies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_capacity_pool_id_capacity_pools_id_fk" FOREIGN KEY ("capacity_pool_id") REFERENCES "capacity_pools"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_service_product_id_service_products_id_fk" FOREIGN KEY ("service_product_id") REFERENCES "service_products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_offer_version_id_offer_versions_id_fk" FOREIGN KEY ("offer_version_id") REFERENCES "offer_versions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_sellable_id_sellables_id_fk" FOREIGN KEY ("sellable_id") REFERENCES "sellables"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_biz_policy_fk" FOREIGN KEY ("biz_id","capacity_hold_policy_id") REFERENCES "capacity_hold_policies"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_biz_location_fk" FOREIGN KEY ("biz_id","location_id") REFERENCES "locations"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_biz_calendar_fk" FOREIGN KEY ("biz_id","calendar_id") REFERENCES "calendars"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_biz_resource_fk" FOREIGN KEY ("biz_id","resource_id") REFERENCES "resources"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_biz_pool_fk" FOREIGN KEY ("biz_id","capacity_pool_id") REFERENCES "capacity_pools"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_biz_service_fk" FOREIGN KEY ("biz_id","service_id") REFERENCES "services"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_biz_service_product_fk" FOREIGN KEY ("biz_id","service_product_id") REFERENCES "service_products"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_biz_offer_fk" FOREIGN KEY ("biz_id","offer_id") REFERENCES "offers"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_biz_offer_version_fk" FOREIGN KEY ("biz_id","offer_version_id") REFERENCES "offer_versions"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_biz_product_fk" FOREIGN KEY ("biz_id","product_id") REFERENCES "products"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_biz_sellable_fk" FOREIGN KEY ("biz_id","sellable_id") REFERENCES "sellables"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_biz_subject_fk" FOREIGN KEY ("biz_id","target_ref_type","target_ref_id") REFERENCES "subjects"("biz_id","subject_type","subject_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_capacity_pool_id_capacity_pools_id_fk" FOREIGN KEY ("capacity_pool_id") REFERENCES "capacity_pools"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_service_product_id_service_products_id_fk" FOREIGN KEY ("service_product_id") REFERENCES "service_products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_offer_version_id_offer_versions_id_fk" FOREIGN KEY ("offer_version_id") REFERENCES "offer_versions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_sellable_id_sellables_id_fk" FOREIGN KEY ("sellable_id") REFERENCES "sellables"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_biz_location_fk" FOREIGN KEY ("biz_id","location_id") REFERENCES "locations"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_biz_calendar_fk" FOREIGN KEY ("biz_id","calendar_id") REFERENCES "calendars"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_biz_resource_fk" FOREIGN KEY ("biz_id","resource_id") REFERENCES "resources"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_biz_pool_fk" FOREIGN KEY ("biz_id","capacity_pool_id") REFERENCES "capacity_pools"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_biz_service_fk" FOREIGN KEY ("biz_id","service_id") REFERENCES "services"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_biz_service_product_fk" FOREIGN KEY ("biz_id","service_product_id") REFERENCES "service_products"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_biz_offer_fk" FOREIGN KEY ("biz_id","offer_id") REFERENCES "offers"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_biz_offer_version_fk" FOREIGN KEY ("biz_id","offer_version_id") REFERENCES "offer_versions"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_biz_product_fk" FOREIGN KEY ("biz_id","product_id") REFERENCES "products"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_biz_sellable_fk" FOREIGN KEY ("biz_id","sellable_id") REFERENCES "sellables"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_biz_subject_fk" FOREIGN KEY ("biz_id","target_ref_type","target_ref_id") REFERENCES "subjects"("biz_id","subject_type","subject_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
