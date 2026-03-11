CREATE TABLE IF NOT EXISTS "ooda_asciip_documents" (
  "id" text PRIMARY KEY NOT NULL,
  "biz_id" text,
  "document_path" varchar(600) NOT NULL,
  "title" varchar(180) NOT NULL,
  "editor_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  "status" varchar(24) DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text,
  "deleted_by" text,
  CONSTRAINT "ooda_asciip_documents_revision_check" CHECK ("revision" >= 1),
  CONSTRAINT "ooda_asciip_documents_status_check" CHECK ("status" IN ('active', 'archived'))
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "ooda_asciip_documents"
    ADD CONSTRAINT "ooda_asciip_documents_biz_id_bizes_id_fk"
    FOREIGN KEY ("biz_id") REFERENCES "bizes"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "ooda_asciip_documents"
    ADD CONSTRAINT "ooda_asciip_documents_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "ooda_asciip_documents"
    ADD CONSTRAINT "ooda_asciip_documents_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "ooda_asciip_documents"
    ADD CONSTRAINT "ooda_asciip_documents_deleted_by_users_id_fk"
    FOREIGN KEY ("deleted_by") REFERENCES "users"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "ooda_asciip_documents_path_unique"
  ON "ooda_asciip_documents" ("document_path");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ooda_asciip_documents_biz_status_idx"
  ON "ooda_asciip_documents" ("biz_id", "status", "updated_at");
