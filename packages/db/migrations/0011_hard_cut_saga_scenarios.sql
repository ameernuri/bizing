ALTER TABLE "saga_definition_links"
  DROP CONSTRAINT IF EXISTS "saga_definition_links_saga_scenario_version_id_saga_scenario_versions_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "saga_definition_links_unique";
--> statement-breakpoint
ALTER TABLE "saga_definition_links"
  DROP CONSTRAINT IF EXISTS "saga_definition_links_target_shape_check";
--> statement-breakpoint
ALTER TABLE "saga_definition_links"
  DROP COLUMN IF EXISTS "saga_scenario_version_id";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saga_definition_links_unique"
  ON "saga_definition_links" ("saga_definition_id", "saga_use_case_version_id", "saga_persona_version_id", "relation_role");
--> statement-breakpoint
ALTER TABLE "saga_definition_links"
  ADD CONSTRAINT "saga_definition_links_target_shape_check"
  CHECK (
    (("saga_use_case_version_id" IS NOT NULL)::int
    + ("saga_persona_version_id" IS NOT NULL)::int) >= 1
  );
--> statement-breakpoint
ALTER TABLE "saga_tag_bindings"
  DROP CONSTRAINT IF EXISTS "saga_tag_bindings_target_type_check";
--> statement-breakpoint
ALTER TABLE "saga_tag_bindings"
  ADD CONSTRAINT "saga_tag_bindings_target_type_check"
  CHECK (
    "target_type" IN (
      'use_case',
      'use_case_version',
      'persona',
      'persona_version',
      'saga_definition',
      'saga_run',
      'coverage_report',
      'coverage_item'
    )
  );
--> statement-breakpoint
DROP TABLE IF EXISTS "saga_scenario_versions";
--> statement-breakpoint
DROP TABLE IF EXISTS "saga_scenarios";
