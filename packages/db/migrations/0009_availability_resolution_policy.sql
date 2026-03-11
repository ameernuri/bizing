DO $$ BEGIN
  CREATE TYPE "availability_resolution_layer_type" AS ENUM (
    'biz',
    'location',
    'offer',
    'offer_version',
    'service',
    'service_product',
    'provider_user',
    'resource',
    'custom_subject'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "availability_resolution_layer_enforcement" AS ENUM (
    'hard_required',
    'soft_preferred',
    'ignore'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "availability_resolution_layer_on_missing" AS ENUM (
    'allow',
    'block'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "availability_resolution_policies" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL REFERENCES "bizes" ("id"),
  "name" varchar(180) NOT NULL,
  "description" varchar(700),
  "status" "lifecycle_status" DEFAULT 'active' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text REFERENCES "users" ("id"),
  "updated_by" text REFERENCES "users" ("id"),
  "deleted_by" text REFERENCES "users" ("id")
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "availability_resolution_policies_biz_id_id_unique"
  ON "availability_resolution_policies" ("biz_id", "id");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "availability_resolution_policies_active_per_biz_unique"
  ON "availability_resolution_policies" ("biz_id")
  WHERE "status" = 'active' AND "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "availability_resolution_policies_biz_status_idx"
  ON "availability_resolution_policies" ("biz_id", "status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "availability_resolution_policy_layers" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text NOT NULL REFERENCES "bizes" ("id"),
  "availability_policy_id" text NOT NULL REFERENCES "availability_resolution_policies" ("id"),
  "layer_type" "availability_resolution_layer_type" NOT NULL,
  "precedence" integer DEFAULT 100 NOT NULL,
  "enforcement" "availability_resolution_layer_enforcement" DEFAULT 'hard_required' NOT NULL,
  "on_missing" "availability_resolution_layer_on_missing" DEFAULT 'allow' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text REFERENCES "users" ("id"),
  "updated_by" text REFERENCES "users" ("id"),
  "deleted_by" text REFERENCES "users" ("id"),
  CONSTRAINT "availability_resolution_policy_layers_precedence_check" CHECK ("precedence" >= 0)
);
--> statement-breakpoint

ALTER TABLE "availability_resolution_policy_layers"
  DROP CONSTRAINT IF EXISTS "availability_resolution_policy_layers_biz_policy_fk";
--> statement-breakpoint

ALTER TABLE "availability_resolution_policy_layers"
  ADD CONSTRAINT "availability_resolution_policy_layers_biz_policy_fk"
  FOREIGN KEY ("biz_id", "availability_policy_id")
  REFERENCES "availability_resolution_policies" ("biz_id", "id")
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "availability_resolution_policy_layers_biz_id_id_unique"
  ON "availability_resolution_policy_layers" ("biz_id", "id");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "availability_resolution_policy_layers_unique_active_layer"
  ON "availability_resolution_policy_layers" ("biz_id", "availability_policy_id", "layer_type")
  WHERE "is_active" = true AND "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "availability_resolution_policy_layers_policy_order_idx"
  ON "availability_resolution_policy_layers" ("biz_id", "availability_policy_id", "is_active", "precedence");
