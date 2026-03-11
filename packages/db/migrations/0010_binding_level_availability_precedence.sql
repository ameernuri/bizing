ALTER TABLE "calendar_bindings"
  ADD COLUMN IF NOT EXISTS "priority" integer DEFAULT 100 NOT NULL;
--> statement-breakpoint

ALTER TABLE "calendar_bindings"
  ADD COLUMN IF NOT EXISTS "is_required" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

UPDATE "calendar_bindings"
SET
  "priority" = CASE
    WHEN "owner_type" = 'biz' THEN 10
    WHEN "owner_type" = 'location' THEN 20
    WHEN "owner_type" = 'offer_version' THEN 30
    WHEN "owner_type" = 'offer' THEN 40
    WHEN "owner_type" = 'service_product' THEN 50
    WHEN "owner_type" = 'service' THEN 60
    WHEN "owner_type" = 'user' THEN 70
    WHEN "owner_type" = 'resource' THEN 80
    WHEN "owner_type" = 'custom_subject' THEN 90
    ELSE 100
  END,
  "is_required" = CASE
    WHEN "owner_type" IN ('offer_version', 'offer', 'user', 'resource') THEN true
    ELSE false
  END
WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "calendar_bindings_biz_active_priority_idx"
  ON "calendar_bindings" ("biz_id", "is_active", "is_primary", "priority");
--> statement-breakpoint

DROP TABLE IF EXISTS "availability_resolution_policy_layers";
--> statement-breakpoint

DROP TABLE IF EXISTS "availability_resolution_policies";
--> statement-breakpoint

DROP TYPE IF EXISTS "availability_resolution_layer_on_missing";
--> statement-breakpoint

DROP TYPE IF EXISTS "availability_resolution_layer_enforcement";
--> statement-breakpoint

DROP TYPE IF EXISTS "availability_resolution_layer_type";
