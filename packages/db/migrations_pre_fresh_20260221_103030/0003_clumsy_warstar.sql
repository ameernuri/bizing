ALTER TABLE "assets" DROP CONSTRAINT "assets_status_definition_id_asset_status_definitions_id_fk";
--> statement-breakpoint
ALTER TABLE "assets" DROP CONSTRAINT "assets_biz_status_definition_fk";
--> statement-breakpoint
ALTER TABLE "venues" DROP CONSTRAINT "venues_status_definition_id_venue_status_definitions_id_fk";
--> statement-breakpoint
ALTER TABLE "venues" DROP CONSTRAINT "venues_biz_status_definition_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "assets_biz_status_definition_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "venues_biz_status_definition_idx";--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "buffer_before_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "buffer_after_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN IF EXISTS "status_definition_id";--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN IF EXISTS "capacity";--> statement-breakpoint
ALTER TABLE "venues" DROP COLUMN IF EXISTS "capacity";--> statement-breakpoint
ALTER TABLE "venues" DROP COLUMN IF EXISTS "allow_simultaneous_bookings";--> statement-breakpoint
ALTER TABLE "venues" DROP COLUMN IF EXISTS "max_simultaneous_bookings";--> statement-breakpoint
ALTER TABLE "venues" DROP COLUMN IF EXISTS "status_definition_id";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assets_biz_location_idx" ON "assets" ("biz_id","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venues_biz_location_idx" ON "venues" ("biz_id","location_id");--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_buffer_before_minutes_non_negative_check" CHECK ("resources"."buffer_before_minutes" >= 0);--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_buffer_after_minutes_non_negative_check" CHECK ("resources"."buffer_after_minutes" >= 0);--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_setup_minutes_non_negative_check" CHECK ("venues"."setup_minutes" >= 0);--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_teardown_minutes_non_negative_check" CHECK ("venues"."teardown_minutes" >= 0);--> statement-breakpoint
DROP TABLE "asset_status_definitions";--> statement-breakpoint
DROP TABLE "venue_status_definitions";
