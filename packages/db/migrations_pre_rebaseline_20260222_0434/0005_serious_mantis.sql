DO $$ BEGIN
 CREATE TYPE "biz_config_promotion_action" AS ENUM('create', 'update', 'delete', 'noop');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "biz_config_promotion_entity_type" AS ENUM('set', 'value', 'binding');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "biz_config_promotion_item_status" AS ENUM('pending', 'applied', 'failed', 'skipped');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "biz_config_promotion_operation" AS ENUM('dry_run', 'apply', 'rollback');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "biz_config_promotion_run_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "biz_config_promotion_run_items" ALTER COLUMN "entity_type" SET DATA TYPE biz_config_promotion_entity_type;--> statement-breakpoint
ALTER TABLE "biz_config_promotion_run_items" ALTER COLUMN "action" SET DATA TYPE biz_config_promotion_action;--> statement-breakpoint
ALTER TABLE "biz_config_promotion_run_items" ALTER COLUMN "status" SET DATA TYPE biz_config_promotion_item_status;--> statement-breakpoint
ALTER TABLE "biz_config_promotion_runs" ALTER COLUMN "operation" SET DATA TYPE biz_config_promotion_operation;--> statement-breakpoint
ALTER TABLE "biz_config_promotion_runs" ALTER COLUMN "status" SET DATA TYPE biz_config_promotion_run_status;