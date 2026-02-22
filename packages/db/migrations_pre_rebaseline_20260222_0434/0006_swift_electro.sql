ALTER TABLE "enterprise_scopes" DROP CONSTRAINT "enterprise_scopes_target_location_id_locations_id_fk";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_memberships_biz_id_id_unique" ON "org_memberships" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "host_groups_biz_id_id_unique" ON "host_groups" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "host_users_biz_id_id_unique" ON "host_users" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stripe_customers_biz_id_id_unique" ON "stripe_customers" ("biz_id","id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org_membership_locations" ADD CONSTRAINT "org_membership_locations_biz_membership_fk" FOREIGN KEY ("biz_id","membership_id") REFERENCES "org_memberships"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org_membership_locations" ADD CONSTRAINT "org_membership_locations_biz_location_fk" FOREIGN KEY ("biz_id","location_id") REFERENCES "locations"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_biz_location_fk" FOREIGN KEY ("biz_id","location_id") REFERENCES "locations"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_products" ADD CONSTRAINT "service_products_biz_product_fk" FOREIGN KEY ("biz_id","product_id") REFERENCES "products"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "host_group_members" ADD CONSTRAINT "host_group_members_biz_host_group_fk" FOREIGN KEY ("biz_id","host_group_id") REFERENCES "host_groups"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "host_groups" ADD CONSTRAINT "host_groups_biz_resource_fk" FOREIGN KEY ("biz_id","resource_id") REFERENCES "resources"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "host_groups" ADD CONSTRAINT "host_groups_biz_group_account_fk" FOREIGN KEY ("biz_id","group_account_id") REFERENCES "group_accounts"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "host_users" ADD CONSTRAINT "host_users_biz_resource_fk" FOREIGN KEY ("biz_id","resource_id") REFERENCES "resources"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_service_capabilities" ADD CONSTRAINT "resource_service_capabilities_biz_resource_fk" FOREIGN KEY ("biz_id","resource_id") REFERENCES "resources"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_service_capabilities" ADD CONSTRAINT "resource_service_capabilities_biz_service_fk" FOREIGN KEY ("biz_id","service_id") REFERENCES "services"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_service_capabilities" ADD CONSTRAINT "resource_service_capabilities_biz_location_fk" FOREIGN KEY ("biz_id","location_id") REFERENCES "locations"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_status_definitions" ADD CONSTRAINT "resource_status_definitions_biz_location_fk" FOREIGN KEY ("biz_id","location_id") REFERENCES "locations"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stripe_customers" ADD CONSTRAINT "stripe_customers_biz_group_account_fk" FOREIGN KEY ("biz_id","group_account_id") REFERENCES "group_accounts"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stripe_payment_methods" ADD CONSTRAINT "stripe_payment_methods_biz_customer_fk" FOREIGN KEY ("biz_id","stripe_customer_ref_id") REFERENCES "stripe_customers"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "grading_events" ADD CONSTRAINT "grading_events_biz_template_fk" FOREIGN KEY ("biz_id","assessment_template_id") REFERENCES "assessment_templates"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sla_breach_events" ADD CONSTRAINT "sla_breach_events_biz_booking_order_fk" FOREIGN KEY ("biz_id","booking_order_id") REFERENCES "booking_orders"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sla_breach_events" ADD CONSTRAINT "sla_breach_events_biz_fulfillment_unit_fk" FOREIGN KEY ("biz_id","fulfillment_unit_id") REFERENCES "fulfillment_units"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sla_breach_events" ADD CONSTRAINT "sla_breach_events_biz_queue_entry_fk" FOREIGN KEY ("biz_id","queue_entry_id") REFERENCES "queue_entries"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sla_breach_events" ADD CONSTRAINT "sla_breach_events_biz_work_run_fk" FOREIGN KEY ("biz_id","work_run_id") REFERENCES "work_runs"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sla_breach_events" ADD CONSTRAINT "sla_breach_events_biz_resource_fk" FOREIGN KEY ("biz_id","resource_id") REFERENCES "resources"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_biz_location_fk" FOREIGN KEY ("biz_id","location_id") REFERENCES "locations"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_biz_resource_fk" FOREIGN KEY ("biz_id","resource_id") REFERENCES "resources"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_biz_offer_version_fk" FOREIGN KEY ("biz_id","offer_version_id") REFERENCES "offer_versions"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_biz_service_product_fk" FOREIGN KEY ("biz_id","service_product_id") REFERENCES "service_products"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_biz_queue_fk" FOREIGN KEY ("biz_id","queue_id") REFERENCES "queues"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_biz_group_account_fk" FOREIGN KEY ("biz_id","group_account_id") REFERENCES "group_accounts"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
