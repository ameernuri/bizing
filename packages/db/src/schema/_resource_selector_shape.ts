import { sql } from "drizzle-orm";

/**
 * Shared selector-shape SQL used by offer and service-product selector tables.
 *
 * Why this exists:
 * - both domains use the same selector payload contract,
 * - duplicating this long check in many tables makes future edits brittle,
 * - one shared source keeps selector semantics identical across domains.
 *
 * Contract:
 * - `selector_type` decides exactly which selector payload columns must be set.
 * - every non-matching payload column must remain NULL.
 * - this guarantees deterministic matching behavior and prevents ambiguous rows.
 */
export const resourceSelectorShapeCheckSql = sql`
(
  "selector_type" = 'any'
  AND "resource_id" IS NULL
  AND "resource_type" IS NULL
  AND "capability_template_id" IS NULL
  AND "location_id" IS NULL
  AND "subject_type" IS NULL
  AND "subject_id" IS NULL
) OR (
  "selector_type" = 'resource'
  AND "resource_id" IS NOT NULL
  AND "resource_type" IS NULL
  AND "capability_template_id" IS NULL
  AND "location_id" IS NULL
  AND "subject_type" IS NULL
  AND "subject_id" IS NULL
) OR (
  "selector_type" = 'resource_type'
  AND "resource_id" IS NULL
  AND "resource_type" IS NOT NULL
  AND "capability_template_id" IS NULL
  AND "location_id" IS NULL
  AND "subject_type" IS NULL
  AND "subject_id" IS NULL
) OR (
  "selector_type" = 'capability_template'
  AND "resource_id" IS NULL
  AND "resource_type" IS NULL
  AND "capability_template_id" IS NOT NULL
  AND "location_id" IS NULL
  AND "subject_type" IS NULL
  AND "subject_id" IS NULL
) OR (
  "selector_type" = 'location'
  AND "resource_id" IS NULL
  AND "resource_type" IS NULL
  AND "capability_template_id" IS NULL
  AND "location_id" IS NOT NULL
  AND "subject_type" IS NULL
  AND "subject_id" IS NULL
) OR (
  "selector_type" = 'custom_subject'
  AND "resource_id" IS NULL
  AND "resource_type" IS NULL
  AND "capability_template_id" IS NULL
  AND "location_id" IS NULL
  AND "subject_type" IS NOT NULL
  AND "subject_id" IS NOT NULL
)
`;
