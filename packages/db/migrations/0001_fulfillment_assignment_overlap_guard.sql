-- Enforce deterministic no-overlap windows for active assignment rows.
-- This is the canonical DB safety net behind UC double-booking protection.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint

-- Constraint name includes `overlap` intentionally so agent/lifecycle tests
-- can assert overlap failures without fragile driver-specific error parsing.
ALTER TABLE "fulfillment_assignments"
  DROP CONSTRAINT IF EXISTS "fulfillment_assignments_no_overlap_excl";
--> statement-breakpoint

ALTER TABLE "fulfillment_assignments"
  ADD CONSTRAINT "fulfillment_assignments_no_overlap_excl"
  EXCLUDE USING gist (
    "biz_id" WITH =,
    "resource_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  )
  WHERE (
    "deleted_at" IS NULL
    AND "conflict_policy" = 'enforce_no_overlap'
    AND "status" IN ('reserved', 'confirmed', 'in_progress')
    AND "starts_at" IS NOT NULL
    AND "ends_at" IS NOT NULL
  );
