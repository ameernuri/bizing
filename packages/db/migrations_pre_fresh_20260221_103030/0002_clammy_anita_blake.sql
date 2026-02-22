DROP TABLE "asset_categories";--> statement-breakpoint
DROP TABLE "asset_status_definition_tag_scopes";--> statement-breakpoint
DROP TABLE "asset_tag_assignments";--> statement-breakpoint
DROP TABLE "asset_tag_templates";--> statement-breakpoint
DROP TABLE "venue_amenity_assignments";--> statement-breakpoint
DROP TABLE "venue_amenity_templates";--> statement-breakpoint
DROP TABLE "venue_categories";--> statement-breakpoint
DROP TABLE "venue_tag_assignments";--> statement-breakpoint
DROP TABLE "venue_tag_templates";--> statement-breakpoint
ALTER TABLE "service_product_requirement_selectors" DROP CONSTRAINT "service_product_requirement_selectors_asset_category_id_asset_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "service_product_requirement_selectors" DROP CONSTRAINT "service_product_requirement_selectors_venue_category_id_venue_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "service_product_requirement_selectors" DROP CONSTRAINT "service_product_requirement_selectors_biz_asset_category_fk";
--> statement-breakpoint
ALTER TABLE "service_product_requirement_selectors" DROP CONSTRAINT "service_product_requirement_selectors_biz_venue_category_fk";
--> statement-breakpoint
ALTER TABLE "assets" DROP CONSTRAINT "assets_category_id_asset_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "assets" DROP CONSTRAINT "assets_biz_category_fk";
--> statement-breakpoint
ALTER TABLE "venues" DROP CONSTRAINT "venues_category_id_venue_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "venues" DROP CONSTRAINT "venues_biz_category_fk";
--> statement-breakpoint
ALTER TABLE "offer_component_selectors" DROP CONSTRAINT "offer_component_selectors_asset_category_id_asset_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "offer_component_selectors" DROP CONSTRAINT "offer_component_selectors_venue_category_id_venue_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "compensation_plan_rules" DROP CONSTRAINT "compensation_plan_rules_asset_category_id_asset_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "compensation_plan_rules" DROP CONSTRAINT "compensation_plan_rules_venue_category_id_venue_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "compensation_plan_rules" DROP CONSTRAINT "compensation_plan_rules_biz_asset_category_fk";
--> statement-breakpoint
ALTER TABLE "compensation_plan_rules" DROP CONSTRAINT "compensation_plan_rules_biz_venue_category_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "service_product_requirement_selectors_asset_category_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "service_product_requirement_selectors_venue_category_idx";--> statement-breakpoint
ALTER TABLE "service_product_requirement_selectors" DROP COLUMN IF EXISTS "asset_category_id";--> statement-breakpoint
ALTER TABLE "service_product_requirement_selectors" DROP COLUMN IF EXISTS "venue_category_id";--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN IF EXISTS "category_id";--> statement-breakpoint
ALTER TABLE "venues" DROP COLUMN IF EXISTS "category_id";--> statement-breakpoint
ALTER TABLE "offer_component_selectors" DROP COLUMN IF EXISTS "asset_category_id";--> statement-breakpoint
ALTER TABLE "offer_component_selectors" DROP COLUMN IF EXISTS "venue_category_id";--> statement-breakpoint
ALTER TABLE "compensation_plan_rules" DROP COLUMN IF EXISTS "asset_category_id";--> statement-breakpoint
ALTER TABLE "compensation_plan_rules" DROP COLUMN IF EXISTS "venue_category_id";