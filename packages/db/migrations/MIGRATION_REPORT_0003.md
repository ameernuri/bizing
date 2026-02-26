# Schema Migration Report: 0003_surgical_schema_fixes

**Date**: 2026-02-23  
**Status**: ✅ Database Migration Applied  
**Files Modified**: 
- `packages/db/migrations/0003_surgical_schema_fixes.sql`
- `packages/db/migrations/meta/_journal.json`

---

## Summary

Applied surgical schema fixes to support core use case features:
- **10 new columns** added to existing tables
- **8 new tables** created for advanced features
- **Indexes** added for query performance

---

## Section 1: Column Additions

### Table: `resources`
| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `is_mobile` | boolean | false | UC-15: Mobile service providers |
| `max_simultaneous_bookings` | integer | null | Max concurrent bookings |

**Applied**: ✅
```sql
ALTER TABLE "resources" 
  ADD COLUMN IF NOT EXISTS "is_mobile" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "max_simultaneous_bookings" integer;
```

### Table: `booking_orders`
| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `requested_duration_min` | integer | null | UC-2: Variable duration requests |
| `confirmed_duration_min` | integer | null | UC-2: Final confirmed duration |
| `customer_purchase_id` | text | null | UC-8, UC-16: Package session linking |
| `payment_terms` | text | null | UC-14: Corporate payment terms |

**Applied**: ✅

### Table: `offer_versions`
| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `unit_pricing_minor` | integer | null | UC-2: Per-unit pricing |
| `requires_deposit` | boolean | false | UC-13: Deposit requirements |
| `deposit_percent_bps` | integer | null | UC-13: Deposit percentage (basis points) |
| `min_gap_between_bookings_min` | integer | 0 | UC-13: Gap between rentals |

**Applied**: ✅

### Table: `fulfillment_units`
| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `secondary_resource_id` | text | null | UC-5: Room + equipment pairing |

**Applied**: ✅

---

## Section 2: New Tables

### 1. `booking_order_private_notes`
**Purpose**: Private staff notes on bookings (UC-1, UC-8)

```sql
CREATE TABLE IF NOT EXISTS "booking_order_private_notes" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "booking_order_id" text NOT NULL,
  "author_user_id" text NOT NULL,
  "note" text NOT NULL,
  "is_pinned" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);
```

**Applied**: ✅

---

### 2. `queues`
**Purpose**: Walk-in and waitlist queue management (UC-3, UC-19, UC-20)

```sql
CREATE TABLE IF NOT EXISTS "queues" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "location_id" text,
  "name" varchar(200) NOT NULL,
  "slug" varchar(120) NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "max_capacity" integer,
  "estimated_service_time_min" integer DEFAULT 15 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);
```

**Applied**: ✅

---

### 3. `queue_entries`
**Purpose**: Individual queue/waitlist entries

```sql
CREATE TABLE IF NOT EXISTS "queue_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "queue_id" text NOT NULL,
  "customer_user_id" text,
  "party_size" integer DEFAULT 1 NOT NULL,
  "status" text DEFAULT 'waiting' NOT NULL,
  "position" integer NOT NULL,
  "estimated_wait_min" integer,
  "notified_at" timestamp with time zone,
  "served_at" timestamp with time zone,
  "notes" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);
```

**Applied**: ✅

---

### 4. `class_schedules`
**Purpose**: Recurring class schedules (UC-7)

```sql
CREATE TABLE IF NOT EXISTS "class_schedules" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "offer_id" text NOT NULL,
  "location_id" text,
  "name" varchar(200) NOT NULL,
  "slug" varchar(120) NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "timezone" varchar(50) DEFAULT 'UTC' NOT NULL,
  "recurrence_rule" varchar(500) NOT NULL,
  "capacity" integer NOT NULL,
  "min_enrollment" integer DEFAULT 0 NOT NULL,
  "auto_cancel_if_under" boolean DEFAULT false NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);
```

**Applied**: ✅

---

### 5. `class_occurrences`
**Purpose**: Individual class instances (UC-7)

```sql
CREATE TABLE IF NOT EXISTS "class_occurrences" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "class_schedule_id" text NOT NULL,
  "occurrence_date" date NOT NULL,
  "start_at" timestamp with time zone NOT NULL,
  "end_at" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'scheduled' NOT NULL,
  "enrolled_count" integer DEFAULT 0 NOT NULL,
  "waitlist_count" integer DEFAULT 0 NOT NULL,
  "cancelled_at" timestamp with time zone,
  "cancellation_reason" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
```

**Applied**: ✅

---

### 6. `package_products`
**Purpose**: Pre-paid session packages (UC-8, UC-16)

```sql
CREATE TABLE IF NOT EXISTS "package_products" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "offer_id" text NOT NULL,
  "name" varchar(200) NOT NULL,
  "slug" varchar(120) NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "session_count" integer NOT NULL,
  "price_minor" integer NOT NULL,
  "currency" varchar(3) DEFAULT 'USD' NOT NULL,
  "expiry_type" text DEFAULT 'never' NOT NULL,
  "expiry_days" integer,
  "expiry_date" date,
  "transferable" boolean DEFAULT false NOT NULL,
  "refundable" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);
```

**Applied**: ✅

---

### 7. `customer_purchases`
**Purpose**: Customer package purchase tracking (UC-8, UC-16)

```sql
CREATE TABLE IF NOT EXISTS "customer_purchases" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "package_product_id" text NOT NULL,
  "customer_user_id" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "sessions_total" integer NOT NULL,
  "sessions_used" integer DEFAULT 0 NOT NULL,
  "sessions_remaining" integer NOT NULL,
  "purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone,
  "transferred_from_purchase_id" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
```

**Applied**: ✅

---

### 8. `seat_maps`
**Purpose**: Venue seat layouts (UC-7, UC-18)

```sql
CREATE TABLE IF NOT EXISTS "seat_maps" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "venue_id" text NOT NULL,
  "name" varchar(200) NOT NULL,
  "slug" varchar(120) NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);
```

**Applied**: ✅

---

### 9. `seat_map_seats`
**Purpose**: Individual seats in a layout (UC-7, UC-18)

```sql
CREATE TABLE IF NOT EXISTS "seat_map_seats" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL,
  "seat_map_id" text NOT NULL,
  "row_label" varchar(20) NOT NULL,
  "seat_number" varchar(20) NOT NULL,
  "x_position" integer NOT NULL,
  "y_position" integer NOT NULL,
  "status" text DEFAULT 'available' NOT NULL,
  "seat_type" varchar(50) DEFAULT 'standard',
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
```

**Applied**: ✅

---

## Section 3: Indexes Created

```sql
CREATE INDEX IF NOT EXISTS "booking_order_private_notes_biz_order_idx" 
  ON "booking_order_private_notes" ("biz_id", "booking_order_id", "created_at");

CREATE INDEX IF NOT EXISTS "queues_biz_status_idx" 
  ON "queues" ("biz_id", "status");

CREATE INDEX IF NOT EXISTS "queue_entries_queue_status_idx" 
  ON "queue_entries" ("queue_id", "status", "position");

CREATE INDEX IF NOT EXISTS "class_schedules_biz_offer_idx" 
  ON "class_schedules" ("biz_id", "offer_id", "status");

CREATE INDEX IF NOT EXISTS "class_occurrences_schedule_date_idx" 
  ON "class_occurrences" ("class_schedule_id", "occurrence_date");

CREATE INDEX IF NOT EXISTS "customer_purchases_customer_status_idx" 
  ON "customer_purchases" ("customer_user_id", "status");
```

**Applied**: ✅

---

## Use Case Coverage

| Use Case | Feature | Tables/Columns | Status |
|----------|---------|----------------|--------|
| UC-1 | Solo Consultant Private Notes | `booking_order_private_notes` | ✅ Added |
| UC-2 | Variable Duration | `booking_orders.requested_duration_min`, `offer_versions.unit_pricing_minor` | ✅ Added |
| UC-3 | Walk-in Queue | `queues`, `queue_entries` | ✅ Added |
| UC-5 | Room Pairing | `fulfillment_units.secondary_resource_id` | ✅ Added |
| UC-7 | Fitness Classes | `class_schedules`, `class_occurrences`, `seat_maps`, `seat_map_seats` | ✅ Added |
| UC-8 | Session Packages | `package_products`, `customer_purchases`, `booking_orders.customer_purchase_id` | ✅ Added |
| UC-13 | Rental Gaps | `offer_versions.min_gap_between_bookings_min`, `requires_deposit` | ✅ Added |
| UC-15 | Mobile Services | `resources.is_mobile`, `max_simultaneous_bookings` | ✅ Added |
| UC-16 | Package Transfers | `customer_purchases.transferred_from_purchase_id` | ✅ Added |
| UC-18 | Seat Selection | `seat_maps`, `seat_map_seats` | ✅ Added |
| UC-19/20 | Waitlist | `queues`, `queue_entries` | ✅ Added |

---

## Testing Notes

The database schema has been successfully updated. The new tables and columns exist at the PostgreSQL level and can be queried directly.

**Note**: The Agent API lifecycle runner maintains a schema cache that may need to be restarted to recognize new tables and columns for insert/update operations via the pseudo-SQL interface.

**Verification Method**: Direct SQL queries via `psql` or database client confirm all schema changes are applied.

---

## Migration Files

| File | Description |
|------|-------------|
| `0003_surgical_schema_fixes.sql` | Full migration SQL |
| `apply-tables.ts` | TypeScript script for column additions |
| `apply-tables2.ts` | TypeScript script for table creation |

---

*Migration completed successfully*
