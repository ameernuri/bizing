-- Migration: 0003_surgical_schema_fixes.sql
-- Purpose: Minimal schema additions to support core use case features
-- Author: Bizing Agent
-- Date: 2026-02-23

-- ============================================================================
-- SECTION 1: ENUM EXTENSIONS (Non-breaking additions)
-- ============================================================================

-- Add 'pending_approval' to booking_order_status for approval workflows (UC-6)
DO $$
BEGIN
  ALTER TYPE "booking_order_status" ADD VALUE IF NOT EXISTS 'pending_approval';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add 'active' to offer_version_status as alias for 'published' (common usage)
DO $$
BEGIN
  ALTER TYPE "offer_version_status" ADD VALUE IF NOT EXISTS 'active';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- SECTION 2: COLUMN ADDITIONS (Existing tables)
-- ============================================================================

-- Add mobile service support to resources (UC-15)
ALTER TABLE "resources" 
  ADD COLUMN IF NOT EXISTS "is_mobile" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "max_simultaneous_bookings" integer;

-- Add duration tracking to booking_orders (UC-2 variable duration)
ALTER TABLE "booking_orders"
  ADD COLUMN IF NOT EXISTS "requested_duration_min" integer,
  ADD COLUMN IF NOT EXISTS "confirmed_duration_min" integer,
  ADD COLUMN IF NOT EXISTS "customer_purchase_id" text,
  ADD COLUMN IF NOT EXISTS "payment_terms" text;

-- Add unit pricing to offer_versions (UC-2 variable duration)
ALTER TABLE "offer_versions"
  ADD COLUMN IF NOT EXISTS "unit_pricing_minor" integer,
  ADD COLUMN IF NOT EXISTS "requires_deposit" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "deposit_percent_bps" integer,
  ADD COLUMN IF NOT EXISTS "min_gap_between_bookings_min" integer DEFAULT 0 NOT NULL;

-- Add secondary resource to fulfillment_units (UC-5 room pairing)
ALTER TABLE "fulfillment_units"
  ADD COLUMN IF NOT EXISTS "secondary_resource_id" text;

-- ============================================================================
-- SECTION 3: MISSING CORE TABLES
-- ============================================================================

-- Table: booking_order_private_notes (UC-1, UC-8)
-- Purpose: Store private staff notes on bookings
CREATE TABLE IF NOT EXISTS "booking_order_private_notes" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "booking_order_id" text NOT NULL,
  "author_user_id" text NOT NULL,
  "note" text NOT NULL,
  "is_pinned" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "booking_order_private_notes_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id"),
  CONSTRAINT "booking_order_private_notes_booking_order_id_booking_orders_id_fk" FOREIGN KEY ("booking_order_id") REFERENCES "booking_orders"("id")
);

-- Table: queues (UC-3, UC-19, UC-20)
-- Purpose: Manage walk-in queues and waitlists
CREATE TYPE "queue_status" AS ENUM('active', 'paused', 'closed');

CREATE TABLE IF NOT EXISTS "queues" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "location_id" text,
  "name" varchar(200) NOT NULL,
  "slug" varchar(120) NOT NULL,
  "status" "queue_status" DEFAULT 'active' NOT NULL,
  "max_capacity" integer,
  "estimated_service_time_min" integer DEFAULT 15 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "queues_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id"),
  CONSTRAINT "queues_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id")
);

-- Table: queue_entries (UC-3, UC-19, UC-20)
-- Purpose: Individual entries in a queue
CREATE TYPE "queue_entry_status" AS ENUM('waiting', 'notified', 'serving', 'served', 'abandoned', 'removed');

CREATE TABLE IF NOT EXISTS "queue_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "queue_id" text NOT NULL,
  "customer_user_id" text,
  "party_size" integer DEFAULT 1 NOT NULL,
  "status" "queue_entry_status" DEFAULT 'waiting' NOT NULL,
  "position" integer NOT NULL,
  "estimated_wait_min" integer,
  "notified_at" timestamp with time zone,
  "served_at" timestamp with time zone,
  "notes" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "queue_entries_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id"),
  CONSTRAINT "queue_entries_queue_id_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "queues"("id")
);

-- Table: class_schedules (UC-7)
-- Purpose: Recurring class schedules
CREATE TYPE "class_schedule_status" AS ENUM('draft', 'active', 'inactive', 'archived');

CREATE TABLE IF NOT EXISTS "class_schedules" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "offer_id" text NOT NULL,
  "location_id" text,
  "name" varchar(200) NOT NULL,
  "slug" varchar(120) NOT NULL,
  "status" "class_schedule_status" DEFAULT 'draft' NOT NULL,
  "timezone" varchar(50) DEFAULT 'UTC' NOT NULL,
  "recurrence_rule" varchar(500) NOT NULL,
  "capacity" integer NOT NULL,
  "min_enrollment" integer DEFAULT 0 NOT NULL,
  "auto_cancel_if_under" boolean DEFAULT false NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "class_schedules_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id"),
  CONSTRAINT "class_schedules_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "offers"("id"),
  CONSTRAINT "class_schedules_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id")
);

-- Table: class_occurrences (UC-7)
-- Purpose: Individual instances of scheduled classes
CREATE TYPE "class_occurrence_status" AS ENUM('scheduled', 'open', 'full', 'waitlist', 'cancelled', 'completed');

CREATE TABLE IF NOT EXISTS "class_occurrences" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "class_schedule_id" text NOT NULL,
  "occurrence_date" date NOT NULL,
  "start_at" timestamp with time zone NOT NULL,
  "end_at" timestamp with time zone NOT NULL,
  "status" "class_occurrence_status" DEFAULT 'scheduled' NOT NULL,
  "enrolled_count" integer DEFAULT 0 NOT NULL,
  "waitlist_count" integer DEFAULT 0 NOT NULL,
  "cancelled_at" timestamp with time zone,
  "cancellation_reason" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "class_occurrences_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id"),
  CONSTRAINT "class_occurrences_class_schedule_id_class_schedules_id_fk" FOREIGN KEY ("class_schedule_id") REFERENCES "class_schedules"("id")
);

-- Table: package_products (UC-8, UC-16)
-- Purpose: Pre-paid session packages
CREATE TYPE "package_product_status" AS ENUM('draft', 'active', 'inactive', 'archived');
CREATE TYPE "package_expiry_type" AS ENUM('never', 'days_from_purchase', 'fixed_date');

CREATE TABLE IF NOT EXISTS "package_products" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "offer_id" text NOT NULL,
  "name" varchar(200) NOT NULL,
  "slug" varchar(120) NOT NULL,
  "status" "package_product_status" DEFAULT 'draft' NOT NULL,
  "session_count" integer NOT NULL,
  "price_minor" integer NOT NULL,
  "currency" varchar(3) DEFAULT 'USD' NOT NULL,
  "expiry_type" "package_expiry_type" DEFAULT 'never' NOT NULL,
  "expiry_days" integer,
  "expiry_date" date,
  "transferable" boolean DEFAULT false NOT NULL,
  "refundable" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "package_products_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id"),
  CONSTRAINT "package_products_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "offers"("id")
);

-- Table: customer_purchases (UC-8, UC-16)
-- Purpose: Track customer package purchases and usage
CREATE TYPE "customer_purchase_status" AS ENUM('active', 'exhausted', 'expired', 'cancelled', 'transferred');

CREATE TABLE IF NOT EXISTS "customer_purchases" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "package_product_id" text NOT NULL,
  "customer_user_id" text NOT NULL,
  "status" "customer_purchase_status" DEFAULT 'active' NOT NULL,
  "sessions_total" integer NOT NULL,
  "sessions_used" integer DEFAULT 0 NOT NULL,
  "sessions_remaining" integer NOT NULL,
  "purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone,
  "transferred_from_purchase_id" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_purchases_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id"),
  CONSTRAINT "customer_purchases_package_product_id_package_products_id_fk" FOREIGN KEY ("package_product_id") REFERENCES "package_products"("id")
);

-- Table: seat_maps (UC-7, UC-18)
-- Purpose: Seat layouts for venues
CREATE TYPE "seat_map_status" AS ENUM('draft', 'active', 'inactive');

CREATE TABLE IF NOT EXISTS "seat_maps" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "venue_id" text NOT NULL,
  "name" varchar(200) NOT NULL,
  "slug" varchar(120) NOT NULL,
  "status" "seat_map_status" DEFAULT 'draft' NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "seat_maps_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id"),
  CONSTRAINT "seat_maps_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "venues"("id")
);

-- Table: seat_map_seats (UC-7, UC-18)
-- Purpose: Individual seats in a seat map
CREATE TYPE "seat_status" AS ENUM('available', 'reserved', 'occupied', 'disabled');

CREATE TABLE IF NOT EXISTS "seat_map_seats" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "seat_map_id" text NOT NULL,
  "row_label" varchar(20) NOT NULL,
  "seat_number" varchar(20) NOT NULL,
  "x_position" integer NOT NULL,
  "y_position" integer NOT NULL,
  "status" "seat_status" DEFAULT 'available' NOT NULL,
  "seat_type" varchar(50) DEFAULT 'standard',
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "seat_map_seats_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id"),
  CONSTRAINT "seat_map_seats_seat_map_id_seat_maps_id_fk" FOREIGN KEY ("seat_map_id") REFERENCES "seat_maps"("id")
);

-- ============================================================================
-- SECTION 4: INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS "booking_order_private_notes_biz_order_idx" ON "booking_order_private_notes" ("biz_id", "booking_order_id", "created_at");
CREATE INDEX IF NOT EXISTS "queues_biz_status_idx" ON "queues" ("biz_id", "status");
CREATE INDEX IF NOT EXISTS "queue_entries_queue_status_idx" ON "queue_entries" ("queue_id", "status", "position");
CREATE INDEX IF NOT EXISTS "class_schedules_biz_offer_idx" ON "class_schedules" ("biz_id", "offer_id", "status");
CREATE INDEX IF NOT EXISTS "class_occurrences_schedule_date_idx" ON "class_occurrences" ("class_schedule_id", "occurrence_date");
CREATE INDEX IF NOT EXISTS "customer_purchases_customer_status_idx" ON "customer_purchases" ("customer_user_id", "status");

-- ============================================================================
-- SECTION 5: DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE "booking_order_private_notes" IS 'Private staff notes attached to booking orders (UC-1, UC-8)';
COMMENT ON TABLE "queues" IS 'Walk-in and waitlist queues (UC-3, UC-19, UC-20)';
COMMENT ON TABLE "queue_entries" IS 'Individual queue/waitlist entries (UC-3, UC-19, UC-20)';
COMMENT ON TABLE "class_schedules" IS 'Recurring class schedules (UC-7)';
COMMENT ON TABLE "class_occurrences" IS 'Individual class instances (UC-7)';
COMMENT ON TABLE "package_products" IS 'Pre-paid session packages (UC-8, UC-16)';
COMMENT ON TABLE "customer_purchases" IS 'Customer package purchase tracking (UC-8, UC-16)';
COMMENT ON TABLE "seat_maps" IS 'Venue seat layouts (UC-7, UC-18)';
COMMENT ON TABLE "seat_map_seats" IS 'Individual seats in a layout (UC-7, UC-18)';

COMMENT ON COLUMN "resources"."is_mobile" IS 'Whether resource travels to customer (UC-15)';
COMMENT ON COLUMN "resources"."max_simultaneous_bookings" IS 'Max concurrent bookings for this resource';
COMMENT ON COLUMN "booking_orders"."requested_duration_min" IS 'Customer-requested duration (UC-2)';
COMMENT ON COLUMN "booking_orders"."confirmed_duration_min" IS 'Final confirmed duration (UC-2)';
COMMENT ON COLUMN "offer_versions"."unit_pricing_minor" IS 'Per-unit pricing for variable duration (UC-2)';
COMMENT ON COLUMN "offer_versions"."requires_deposit" IS 'Whether a deposit is required (UC-13)';
