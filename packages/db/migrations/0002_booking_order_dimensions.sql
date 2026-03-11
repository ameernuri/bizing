ALTER TABLE "booking_orders"
  ADD COLUMN IF NOT EXISTS "location_id" text,
  ADD COLUMN IF NOT EXISTS "service_product_id" text,
  ADD COLUMN IF NOT EXISTS "provider_user_id" text,
  ADD COLUMN IF NOT EXISTS "acquisition_source" varchar(120),
  ADD COLUMN IF NOT EXISTS "attendance_outcome" varchar(40),
  ADD COLUMN IF NOT EXISTS "lead_time_minutes" integer;

UPDATE "booking_orders"
SET "location_id" = NULLIF("metadata"->>'locationId', '')
WHERE "location_id" IS NULL
  AND "metadata" ? 'locationId';

UPDATE "booking_orders"
SET "service_product_id" = NULLIF("metadata"->>'serviceProductId', '')
WHERE "service_product_id" IS NULL
  AND "metadata" ? 'serviceProductId';

UPDATE "booking_orders"
SET "provider_user_id" = NULLIF("metadata"->>'providerUserId', '')
WHERE "provider_user_id" IS NULL
  AND "metadata" ? 'providerUserId';

UPDATE "booking_orders"
SET "acquisition_source" = NULLIF("metadata"->>'acquisitionSource', '')
WHERE "acquisition_source" IS NULL
  AND "metadata" ? 'acquisitionSource';

UPDATE "booking_orders"
SET "attendance_outcome" = NULLIF("metadata"->>'attendanceOutcome', '')
WHERE "attendance_outcome" IS NULL
  AND "metadata" ? 'attendanceOutcome';

UPDATE "booking_orders"
SET "lead_time_minutes" = ("metadata"->>'leadTimeMinutes')::integer
WHERE "lead_time_minutes" IS NULL
  AND "metadata" ? 'leadTimeMinutes'
  AND ("metadata"->>'leadTimeMinutes') ~ '^[0-9]+$';

CREATE INDEX IF NOT EXISTS "booking_orders_biz_location_idx"
  ON "booking_orders" ("biz_id", "location_id", "confirmed_start_at");

CREATE INDEX IF NOT EXISTS "booking_orders_biz_service_product_idx"
  ON "booking_orders" ("biz_id", "service_product_id", "confirmed_start_at");

CREATE INDEX IF NOT EXISTS "booking_orders_biz_provider_idx"
  ON "booking_orders" ("biz_id", "provider_user_id", "confirmed_start_at");

CREATE INDEX IF NOT EXISTS "booking_orders_biz_acquisition_source_idx"
  ON "booking_orders" ("biz_id", "acquisition_source", "confirmed_start_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'booking_orders_biz_location_fk'
  ) THEN
    ALTER TABLE "booking_orders"
      ADD CONSTRAINT "booking_orders_biz_location_fk"
      FOREIGN KEY ("biz_id", "location_id")
      REFERENCES "locations" ("biz_id", "id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'booking_orders_biz_service_product_fk'
  ) THEN
    ALTER TABLE "booking_orders"
      ADD CONSTRAINT "booking_orders_biz_service_product_fk"
      FOREIGN KEY ("biz_id", "service_product_id")
      REFERENCES "service_products" ("biz_id", "id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'booking_orders_lead_time_minutes_non_negative_check'
  ) THEN
    ALTER TABLE "booking_orders"
      ADD CONSTRAINT "booking_orders_lead_time_minutes_non_negative_check"
      CHECK ("lead_time_minutes" IS NULL OR "lead_time_minutes" >= 0);
  END IF;
END $$;
