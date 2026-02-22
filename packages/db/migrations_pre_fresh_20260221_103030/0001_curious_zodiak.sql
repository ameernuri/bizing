ALTER TABLE "sellable_offer_versions" DROP CONSTRAINT "sellable_offer_versions_biz_sellable_fk";
--> statement-breakpoint
ALTER TABLE "sellable_products" DROP CONSTRAINT "sellable_products_biz_sellable_fk";
--> statement-breakpoint
ALTER TABLE "sellable_resource_rates" DROP CONSTRAINT "sellable_resource_rates_biz_sellable_fk";
--> statement-breakpoint
ALTER TABLE "sellable_service_products" DROP CONSTRAINT "sellable_service_products_biz_sellable_fk";
--> statement-breakpoint
ALTER TABLE "sellable_offer_versions" ADD COLUMN "sellable_kind" "sellable_kind" DEFAULT 'offer_version' NOT NULL;--> statement-breakpoint
ALTER TABLE "sellable_products" ADD COLUMN "sellable_kind" "sellable_kind" DEFAULT 'product' NOT NULL;--> statement-breakpoint
ALTER TABLE "sellable_resource_rates" ADD COLUMN "sellable_kind" "sellable_kind" DEFAULT 'resource_rate' NOT NULL;--> statement-breakpoint
ALTER TABLE "sellable_service_products" ADD COLUMN "sellable_kind" "sellable_kind" DEFAULT 'service_product' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sellables_biz_id_id_kind_unique" ON "sellables" ("biz_id","id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resources_host_user_single_wrapper_unique" ON "resources" ("host_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resources_group_account_single_wrapper_unique" ON "resources" ("group_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resources_asset_single_wrapper_unique" ON "resources" ("asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resources_venue_single_wrapper_unique" ON "resources" ("venue_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sellable_offer_versions" ADD CONSTRAINT "sellable_offer_versions_biz_sellable_fk" FOREIGN KEY ("biz_id","sellable_id","sellable_kind") REFERENCES "sellables"("biz_id","id","kind") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sellable_products" ADD CONSTRAINT "sellable_products_biz_sellable_fk" FOREIGN KEY ("biz_id","sellable_id","sellable_kind") REFERENCES "sellables"("biz_id","id","kind") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sellable_resource_rates" ADD CONSTRAINT "sellable_resource_rates_biz_sellable_fk" FOREIGN KEY ("biz_id","sellable_id","sellable_kind") REFERENCES "sellables"("biz_id","id","kind") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sellable_service_products" ADD CONSTRAINT "sellable_service_products_biz_sellable_fk" FOREIGN KEY ("biz_id","sellable_id","sellable_kind") REFERENCES "sellables"("biz_id","id","kind") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
