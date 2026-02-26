DO $$ BEGIN
 CREATE TYPE "authz_permission_effect" AS ENUM('allow', 'deny');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "authz_scope_type" AS ENUM('platform', 'biz', 'location', 'resource', 'subject');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "saga_artifact_type" ADD VALUE 'snapshot';