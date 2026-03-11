DO $$ BEGIN
  CREATE TYPE "biz_visibility" AS ENUM ('published', 'unpublished', 'private');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "bizes"
  ADD COLUMN IF NOT EXISTS "visibility" "biz_visibility" DEFAULT 'published' NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "bizes_visibility_idx"
  ON "bizes" ("visibility");
