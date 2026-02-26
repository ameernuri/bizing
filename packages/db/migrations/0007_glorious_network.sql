CREATE TABLE IF NOT EXISTS "api_access_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"api_credential_id" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"biz_id" text,
	"token_hash" varchar(128) NOT NULL,
	"token_preview" varchar(32) NOT NULL,
	"scopes" jsonb DEFAULT '["*"]'::jsonb NOT NULL,
	"status" varchar(60) DEFAULT 'active' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_reason" varchar(500),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"biz_id" text,
	"label" varchar(180) NOT NULL,
	"description" varchar(1000),
	"key_hash" varchar(128) NOT NULL,
	"key_preview" varchar(32) NOT NULL,
	"scopes" jsonb DEFAULT '["*"]'::jsonb NOT NULL,
	"allow_direct_api_key_auth" boolean DEFAULT false NOT NULL,
	"status" varchar(60) DEFAULT 'active' NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_reason" varchar(500),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_access_tokens_token_hash_unique" ON "api_access_tokens" ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_access_tokens_credential_status_idx" ON "api_access_tokens" ("api_credential_id","status","issued_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_access_tokens_owner_issued_idx" ON "api_access_tokens" ("owner_user_id","issued_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_credentials_biz_id_id_unique" ON "api_credentials" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_credentials_key_hash_unique" ON "api_credentials" ("key_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_credentials_owner_status_idx" ON "api_credentials" ("owner_user_id","status","last_used_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_credentials_biz_status_idx" ON "api_credentials" ("biz_id","status","last_used_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_access_tokens" ADD CONSTRAINT "api_access_tokens_api_credential_id_api_credentials_id_fk" FOREIGN KEY ("api_credential_id") REFERENCES "api_credentials"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_access_tokens" ADD CONSTRAINT "api_access_tokens_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_access_tokens" ADD CONSTRAINT "api_access_tokens_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_access_tokens" ADD CONSTRAINT "api_access_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_access_tokens" ADD CONSTRAINT "api_access_tokens_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_access_tokens" ADD CONSTRAINT "api_access_tokens_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_access_tokens" ADD CONSTRAINT "api_access_tokens_biz_credential_fk" FOREIGN KEY ("biz_id","api_credential_id") REFERENCES "api_credentials"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_status_check" CHECK (
  "status" IN ('active', 'revoked', 'expired')
  OR "status" LIKE 'custom_%'
 );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_timeline_check" CHECK (
  ("expires_at" IS NULL OR "expires_at" > "created_at")
  AND ("revoked_at" IS NULL OR "revoked_at" >= "created_at")
 );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_revocation_shape_check" CHECK (
  (
    "status" = 'active'
    AND "revoked_at" IS NULL
  ) OR (
    "status" = 'revoked'
    AND "revoked_at" IS NOT NULL
  ) OR (
    "status" = 'expired'
  ) OR (
    "status" LIKE 'custom_%'
  )
 );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_access_tokens" ADD CONSTRAINT "api_access_tokens_status_check" CHECK (
  "status" IN ('active', 'revoked', 'expired')
  OR "status" LIKE 'custom_%'
 );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_access_tokens" ADD CONSTRAINT "api_access_tokens_timeline_check" CHECK (
  "expires_at" > "issued_at"
  AND ("revoked_at" IS NULL OR "revoked_at" >= "issued_at")
 );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_access_tokens" ADD CONSTRAINT "api_access_tokens_revocation_shape_check" CHECK (
  (
    "status" = 'active'
    AND "revoked_at" IS NULL
  ) OR (
    "status" = 'revoked'
    AND "revoked_at" IS NOT NULL
  ) OR (
    "status" = 'expired'
  ) OR (
    "status" LIKE 'custom_%'
  )
 );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
