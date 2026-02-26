DO $$ BEGIN
 CREATE TYPE "saga_actor_message_channel" AS ENUM('email', 'sms', 'push', 'in_app');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "saga_actor_message_status" AS ENUM('queued', 'sent', 'delivered', 'read', 'failed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saga_run_actor_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"saga_run_id" text NOT NULL,
	"saga_run_step_id" text,
	"channel" "saga_actor_message_channel" NOT NULL,
	"status" "saga_actor_message_status" DEFAULT 'queued' NOT NULL,
	"from_actor_profile_id" text,
	"to_actor_profile_id" text NOT NULL,
	"subject" varchar(255),
	"body_text" text NOT NULL,
	"provider_message_ref" varchar(180),
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saga_run_actor_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"saga_run_id" text NOT NULL,
	"actor_key" varchar(120) NOT NULL,
	"actor_name" varchar(255) NOT NULL,
	"actor_role" varchar(120) NOT NULL,
	"persona_ref" varchar(120),
	"linked_user_id" text,
	"virtual_email" varchar(255) NOT NULL,
	"virtual_phone" varchar(40) NOT NULL,
	"channel_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
ALTER TABLE "saga_run_steps" ADD COLUMN "delay_mode" varchar(30) DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "saga_run_steps" ADD COLUMN "delay_ms" integer;--> statement-breakpoint
ALTER TABLE "saga_run_steps" ADD COLUMN "delay_condition_key" varchar(180);--> statement-breakpoint
ALTER TABLE "saga_run_steps" ADD COLUMN "delay_timeout_ms" integer;--> statement-breakpoint
ALTER TABLE "saga_run_steps" ADD COLUMN "delay_poll_ms" integer;--> statement-breakpoint
ALTER TABLE "saga_run_steps" ADD COLUMN "delay_jitter_ms" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_run_actor_messages_run_status_idx" ON "saga_run_actor_messages" ("saga_run_id","status","queued_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_run_actor_messages_recipient_idx" ON "saga_run_actor_messages" ("to_actor_profile_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_run_actor_messages_run_step_idx" ON "saga_run_actor_messages" ("saga_run_step_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saga_run_actor_profiles_run_actor_key_unique" ON "saga_run_actor_profiles" ("saga_run_id","actor_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saga_run_actor_profiles_run_email_unique" ON "saga_run_actor_profiles" ("saga_run_id","virtual_email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saga_run_actor_profiles_run_phone_unique" ON "saga_run_actor_profiles" ("saga_run_id","virtual_phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_run_actor_profiles_run_idx" ON "saga_run_actor_profiles" ("saga_run_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_actor_messages" ADD CONSTRAINT "saga_run_actor_messages_saga_run_id_saga_runs_id_fk" FOREIGN KEY ("saga_run_id") REFERENCES "saga_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_actor_messages" ADD CONSTRAINT "saga_run_actor_messages_saga_run_step_id_saga_run_steps_id_fk" FOREIGN KEY ("saga_run_step_id") REFERENCES "saga_run_steps"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_actor_messages" ADD CONSTRAINT "saga_run_actor_messages_from_actor_profile_id_saga_run_actor_profiles_id_fk" FOREIGN KEY ("from_actor_profile_id") REFERENCES "saga_run_actor_profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_actor_messages" ADD CONSTRAINT "saga_run_actor_messages_to_actor_profile_id_saga_run_actor_profiles_id_fk" FOREIGN KEY ("to_actor_profile_id") REFERENCES "saga_run_actor_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_actor_messages" ADD CONSTRAINT "saga_run_actor_messages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_actor_messages" ADD CONSTRAINT "saga_run_actor_messages_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_actor_messages" ADD CONSTRAINT "saga_run_actor_messages_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_actor_profiles" ADD CONSTRAINT "saga_run_actor_profiles_saga_run_id_saga_runs_id_fk" FOREIGN KEY ("saga_run_id") REFERENCES "saga_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_actor_profiles" ADD CONSTRAINT "saga_run_actor_profiles_linked_user_id_users_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_actor_profiles" ADD CONSTRAINT "saga_run_actor_profiles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_actor_profiles" ADD CONSTRAINT "saga_run_actor_profiles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_actor_profiles" ADD CONSTRAINT "saga_run_actor_profiles_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
