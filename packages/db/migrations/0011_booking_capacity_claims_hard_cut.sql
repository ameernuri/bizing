CREATE TABLE IF NOT EXISTS "booking_capacity_claims" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL REFERENCES "bizes"("id"),
  "booking_order_id" text NOT NULL REFERENCES "booking_orders"("id") ON DELETE CASCADE,
  "time_scope_id" text,
  "scope_type" "time_scope_type" NOT NULL,
  "scope_ref_key" varchar(320) NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text REFERENCES "users"("id"),
  "updated_by" text REFERENCES "users"("id"),
  "deleted_by" text REFERENCES "users"("id"),
  CONSTRAINT "booking_capacity_claims_bounds_check"
    CHECK (length("scope_ref_key") > 0 AND "quantity" > 0 AND "ends_at" > "starts_at"),
  CONSTRAINT "booking_capacity_claims_biz_booking_fk"
    FOREIGN KEY ("biz_id", "booking_order_id") REFERENCES "booking_orders"("biz_id", "id"),
  CONSTRAINT "booking_capacity_claims_biz_time_scope_fk"
    FOREIGN KEY ("biz_id", "time_scope_id") REFERENCES "time_scopes"("biz_id", "id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "booking_capacity_claims_biz_id_id_unique"
  ON "booking_capacity_claims" ("biz_id", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "booking_capacity_claims_booking_scope_unique"
  ON "booking_capacity_claims" ("booking_order_id", "scope_ref_key");

CREATE INDEX IF NOT EXISTS "booking_capacity_claims_biz_scope_window_idx"
  ON "booking_capacity_claims" ("biz_id", "scope_ref_key", "starts_at", "ends_at");

CREATE INDEX IF NOT EXISTS "booking_capacity_claims_biz_booking_idx"
  ON "booking_capacity_claims" ("biz_id", "booking_order_id");

CREATE INDEX IF NOT EXISTS "booking_capacity_claims_biz_time_scope_idx"
  ON "booking_capacity_claims" ("biz_id", "time_scope_id");
