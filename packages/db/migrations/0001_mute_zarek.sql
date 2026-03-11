DO $$ BEGIN
 CREATE TYPE "action_execution_status" AS ENUM('pending', 'running', 'previewed', 'succeeded', 'failed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "action_idempotency_status" AS ENUM('reserved', 'pending', 'running', 'previewed', 'succeeded', 'failed', 'expired', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "action_request_status" AS ENUM('pending', 'running', 'previewed', 'succeeded', 'failed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "client_external_subject_status" AS ENUM('active', 'inactive', 'suspended', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "client_installation_credential_status" AS ENUM('active', 'disabled', 'suspended', 'uninstalled', 'revoked', 'expired', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "client_installation_status" AS ENUM('active', 'disabled', 'suspended', 'uninstalled', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "customer_identity_handle_status" AS ENUM('active', 'inactive', 'suspended', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "customer_profile_status" AS ENUM('shadow', 'claimed', 'merged', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "customer_verification_challenge_status" AS ENUM('pending', 'sent', 'verified', 'failed', 'expired', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "customer_visibility_policy_status" AS ENUM('active', 'inactive', 'suspended', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "event_projection_checkpoint_status" AS ENUM('active', 'paused', 'disabled', 'healthy', 'lagging', 'degraded', 'failed', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "procurement_order_line_status" AS ENUM('open', 'partially_received', 'received', 'cancelled', 'closed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "procurement_order_status" AS ENUM('draft', 'submitted', 'acknowledged', 'partially_received', 'received', 'cancelled', 'closed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "projection_document_status" AS ENUM('current', 'stale', 'superseded', 'failed', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "projection_status" AS ENUM('draft', 'active', 'inactive', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "receipt_batch_status" AS ENUM('draft', 'received', 'processed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "replenishment_policy_mode" AS ENUM('min_max', 'days_of_cover', 'event_driven', 'manual');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "replenishment_run_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "replenishment_suggestion_status" AS ENUM('proposed', 'accepted', 'rejected', 'ordered', 'expired', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "saga_coverage_report_status" AS ENUM('draft', 'published', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "saga_depth" AS ENUM('shallow', 'medium', 'deep');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "saga_run_clock_mode" AS ENUM('virtual', 'realtime');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "saga_run_clock_status" AS ENUM('idle', 'running', 'paused', 'completed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "saga_scheduler_job_status" AS ENUM('pending', 'ready', 'running', 'completed', 'failed', 'cancelled', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "saga_scheduler_job_type" AS ENUM('step_delay', 'condition_wait', 'message_delivery', 'custom');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "schedule_subject_status" AS ENUM('draft', 'active', 'inactive', 'suspended', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "supply_partner_type" AS ENUM('manufacturer', 'supplier', 'distributor', 'dropship_partner', 'third_party_logistics', 'marketplace_seller', 'internal');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "time_scope_type" AS ENUM('biz', 'user', 'location', 'calendar', 'schedule_subject', 'resource', 'capacity_pool', 'service', 'service_product', 'offer', 'offer_version', 'product', 'sellable', 'custom_subject');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "value_account_status" AS ENUM('active', 'suspended', 'closed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "value_evaluation_status" AS ENUM('pending', 'applied', 'skipped', 'failed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "value_ledger_entry_type" AS ENUM('earn', 'redeem', 'expire', 'adjustment', 'transfer_in', 'transfer_out', 'tier_upgrade', 'tier_downgrade', 'reversal');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "value_program_account_model" AS ENUM('user', 'group_account', 'subject');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "value_program_kind" AS ENUM('loyalty', 'cashback', 'referral', 'membership_perk', 'engagement', 'custom');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "value_rule_status" AS ENUM('draft', 'active', 'inactive', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "value_transfer_status" AS ENUM('requested', 'approved', 'rejected', 'completed', 'cancelled', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "value_unit_kind" AS ENUM('points', 'credits', 'stamps', 'status_score', 'custom');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "workforce_application_status" AS ENUM('applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn', 'on_hold');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "workforce_assignment_status" AS ENUM('draft', 'active', 'on_leave', 'suspended', 'terminated', 'ended');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "workforce_benefit_enrollment_status" AS ENUM('pending', 'active', 'declined', 'cancelled', 'ended');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "workforce_benefit_plan_status" AS ENUM('draft', 'active', 'inactive', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "workforce_candidate_event_type" AS ENUM('note', 'stage_transition', 'interview_scheduled', 'interview_completed', 'offer_sent', 'offer_accepted', 'offer_declined', 'hired', 'rejected', 'withdrawn');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "workforce_candidate_status" AS ENUM('sourced', 'screening', 'interviewing', 'offer', 'hired', 'rejected', 'withdrawn');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "workforce_employment_class" AS ENUM('employee', 'contractor', 'temporary', 'intern', 'vendor_worker');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "workforce_performance_cycle_status" AS ENUM('draft', 'active', 'closed', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "workforce_performance_review_status" AS ENUM('draft', 'in_progress', 'submitted', 'completed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "workforce_requisition_status" AS ENUM('draft', 'open', 'on_hold', 'filled', 'cancelled', 'closed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "workforce_time_commitment" AS ENUM('full_time', 'part_time', 'shift_based', 'project_based', 'flexible');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "knowledge_agent_kind" AS ENUM('codex', 'openclaw', 'bizing_agent', 'human', 'system');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "knowledge_agent_run_status" AS ENUM('running', 'succeeded', 'failed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "knowledge_checkpoint_status" AS ENUM('healthy', 'stale', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "knowledge_chunk_status" AS ENUM('active', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "knowledge_document_status" AS ENUM('active', 'superseded', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "knowledge_edge_type" AS ENUM('wikilink', 'refers_to', 'derived_from', 'depends_on', 'supersedes', 'related');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "knowledge_embedding_status" AS ENUM('pending', 'ready', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "knowledge_event_status" AS ENUM('queued', 'running', 'succeeded', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "knowledge_event_type" AS ENUM('ingest', 'reindex', 'query', 'checkpoint', 'agent_run', 'sync');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "knowledge_retrieval_mode" AS ENUM('keyword', 'semantic', 'hybrid', 'graph');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "knowledge_source_status" AS ENUM('active', 'paused', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "knowledge_source_type" AS ENUM('git', 'docs', 'mind', 'ooda', 'saga_run', 'api_contract', 'decision_log', 'chat', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "lifecycle_status" ADD VALUE 'suspended';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "action_executions" (
	"id" text PRIMARY KEY NOT NULL,
	"action_request_id" text NOT NULL,
	"biz_id" text,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"phase_key" varchar(100) NOT NULL,
	"status" "action_execution_status" DEFAULT 'pending' NOT NULL,
	"failure_code" varchar(120),
	"failure_message" text,
	"is_retryable" boolean DEFAULT false NOT NULL,
	"diagnostics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"effect_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "action_failures" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"action_request_id" text NOT NULL,
	"action_execution_id" text,
	"failure_family" varchar(40) NOT NULL,
	"failure_code" varchar(120) NOT NULL,
	"failure_message" text NOT NULL,
	"suggested_resolution" text,
	"is_retryable" boolean DEFAULT false NOT NULL,
	"diagnostics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"state_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"debug_snapshot_id" text,
	"failed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "action_idempotency_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"action_request_id" text NOT NULL,
	"idempotency_key" varchar(200) NOT NULL,
	"action_key" varchar(160) NOT NULL,
	"actor_namespace" varchar(160),
	"request_hash" varchar(128) NOT NULL,
	"status" "action_idempotency_status" DEFAULT 'reserved' NOT NULL,
	"expires_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "action_related_entities" (
	"id" text PRIMARY KEY NOT NULL,
	"action_request_id" text NOT NULL,
	"biz_id" text,
	"entity_role" varchar(60) NOT NULL,
	"entity_subject_type" varchar(80) NOT NULL,
	"entity_subject_id" varchar(140) NOT NULL,
	"relation_type" varchar(40) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "action_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"action_key" varchar(160) NOT NULL,
	"action_family" varchar(80) NOT NULL,
	"actor_type" varchar(40) NOT NULL,
	"actor_user_id" text,
	"actor_ref" varchar(160),
	"source_installation_ref" varchar(160),
	"intent_mode" varchar(32) DEFAULT 'execute' NOT NULL,
	"status" "action_request_status" DEFAULT 'pending' NOT NULL,
	"risk_lane" varchar(32) DEFAULT 'green' NOT NULL,
	"target_subject_type" varchar(80),
	"target_subject_id" varchar(140),
	"input_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"preview_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status_reason" text,
	"correlation_id" varchar(160),
	"causation_id" varchar(160),
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"execution_started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "domain_events" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"event_key" varchar(180) NOT NULL,
	"event_family" varchar(80) NOT NULL,
	"subject_type" varchar(80) NOT NULL,
	"subject_id" varchar(140) NOT NULL,
	"action_request_id" text,
	"action_execution_id" text,
	"correlation_id" varchar(160),
	"causation_id" varchar(160),
	"actor_type" varchar(40),
	"actor_user_id" text,
	"actor_ref" varchar(160),
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" text,
	"is_internally_visible" boolean DEFAULT true NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
DO $$
DECLARE
  lifecycle_source_table text;
BEGIN
  IF to_regclass('public.lifecycle_events') IS NOT NULL THEN
    lifecycle_source_table := 'lifecycle_events';
  ELSIF to_regclass('public.lifecycle_events_legacy_20260305') IS NOT NULL THEN
    lifecycle_source_table := 'lifecycle_events_legacy_20260305';
  END IF;

  IF lifecycle_source_table IS NOT NULL THEN
    EXECUTE format($migrate$
      INSERT INTO "domain_events" (
        "id",
        "biz_id",
        "event_key",
        "event_family",
        "subject_type",
        "subject_id",
        "correlation_id",
        "causation_id",
        "actor_type",
        "actor_user_id",
        "payload",
        "summary",
        "is_internally_visible",
        "occurred_at",
        "metadata",
        "created_at",
        "updated_at"
      )
      SELECT
        le."id",
        le."biz_id",
        left(le."event_name", 180),
        left(
          coalesce(nullif(split_part(le."event_name", '.', 1), ''), le."source_type"::text, 'legacy'),
          80
        ),
        left(le."entity_type", 80),
        left(le."entity_id", 140),
        left(le."correlation_id", 160),
        le."causation_event_id",
        'legacy.lifecycle_event',
        le."actor_user_id",
        coalesce(le."payload", '{}'::jsonb),
        concat('Backfilled lifecycle event: ', le."event_name"),
        true,
        le."occurred_at",
        coalesce(le."metadata", '{}'::jsonb) || jsonb_build_object(
          'legacy_source_type', le."source_type",
          'legacy_event_version', le."event_version",
          'legacy_aggregate_type', le."aggregate_type",
          'legacy_aggregate_id', le."aggregate_id",
          'legacy_idempotency_key', le."idempotency_key",
          'backfilled_at', now()
        ),
        coalesce(le."created_at", now()),
        now()
      FROM %I le
      ON CONFLICT ("id") DO NOTHING
    $migrate$, lifecycle_source_table);
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_projection_consumers" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"projection_key" varchar(160) NOT NULL,
	"consumer_ref" varchar(160) NOT NULL,
	"last_domain_event_id" text,
	"last_processed_at" timestamp with time zone,
	"status" "event_projection_checkpoint_status" DEFAULT 'active' NOT NULL,
	"lag_hint" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_external_subjects" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"client_installation_id" text NOT NULL,
	"subject_kind" varchar(60) NOT NULL,
	"external_subject_key" varchar(240) NOT NULL,
	"customer_profile_id" text,
	"status" "client_external_subject_status" DEFAULT 'active' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_installation_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"client_installation_id" text NOT NULL,
	"credential_type" varchar(40) NOT NULL,
	"public_key_hint" varchar(255),
	"secret_hash" varchar(255) NOT NULL,
	"status" "client_installation_credential_status" DEFAULT 'active' NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_installations" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"installation_type" varchar(60) NOT NULL,
	"provider_key" varchar(80) NOT NULL,
	"display_name" varchar(240) NOT NULL,
	"origin_url" varchar(700),
	"site_key" varchar(180),
	"status" "client_installation_status" DEFAULT 'active' NOT NULL,
	"trust_mode" varchar(40) DEFAULT 'write_only' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_identity_handles" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"handle_type" varchar(60) NOT NULL,
	"normalized_value" varchar(500) NOT NULL,
	"display_value" varchar(500),
	"status" "customer_identity_handle_status" DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_identity_links" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"customer_profile_id" text NOT NULL,
	"customer_identity_handle_id" text NOT NULL,
	"client_installation_id" text,
	"link_source" varchar(60) NOT NULL,
	"confidence_level" varchar(32) DEFAULT 'asserted' NOT NULL,
	"verification_state" varchar(32) DEFAULT 'unverified' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_profile_merges" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"source_customer_profile_id" text NOT NULL,
	"target_customer_profile_id" text NOT NULL,
	"merge_reason" text NOT NULL,
	"merge_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_request_id" text,
	"merge_domain_event_id" text,
	"debug_snapshot_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"status" "customer_profile_status" DEFAULT 'shadow' NOT NULL,
	"display_name" varchar(240),
	"primary_email" varchar(320),
	"primary_phone" varchar(40),
	"claimed_user_id" text,
	"primary_crm_contact_id" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"lifecycle_stage" varchar(40) DEFAULT 'prospect' NOT NULL,
	"support_tier" varchar(40) DEFAULT 'standard' NOT NULL,
	"acquisition_source_type" varchar(80),
	"acquisition_source_ref" varchar(220),
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_engaged_at" timestamp with time zone,
	"last_purchase_at" timestamp with time zone,
	"profile_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_verification_challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"customer_profile_id" text NOT NULL,
	"handle_id" text,
	"challenge_type" varchar(40) NOT NULL,
	"status" "customer_verification_challenge_status" DEFAULT 'pending' NOT NULL,
	"code_hash" varchar(255),
	"sent_to" varchar(500),
	"expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"action_request_id" text,
	"completed_domain_event_id" text,
	"debug_snapshot_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_visibility_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"customer_profile_id" text NOT NULL,
	"client_installation_id" text,
	"visibility_scope" varchar(60) NOT NULL,
	"status" "customer_visibility_policy_status" DEFAULT 'active' NOT NULL,
	"policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "schedule_subject_links" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"parent_schedule_subject_id" text NOT NULL,
	"child_schedule_subject_id" text NOT NULL,
	"link_type" varchar(60) NOT NULL,
	"quantity_required" integer DEFAULT 1 NOT NULL,
	"is_optional" boolean DEFAULT false NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "schedule_subjects" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"subject_type" varchar(80) NOT NULL,
	"subject_id" varchar(140) NOT NULL,
	"schedule_class" varchar(60) NOT NULL,
	"display_name" varchar(240),
	"status" "schedule_subject_status" DEFAULT 'active' NOT NULL,
	"scheduling_mode" varchar(40) DEFAULT 'exclusive' NOT NULL,
	"default_capacity" integer DEFAULT 1 NOT NULL,
	"default_lead_time_min" integer DEFAULT 0 NOT NULL,
	"default_buffer_before_min" integer DEFAULT 0 NOT NULL,
	"default_buffer_after_min" integer DEFAULT 0 NOT NULL,
	"should_project_timeline" boolean DEFAULT true NOT NULL,
	"policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "debug_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"snapshot_family" varchar(80) NOT NULL,
	"context_ref" varchar(180) NOT NULL,
	"severity" varchar(24) DEFAULT 'info' NOT NULL,
	"snapshot_data" jsonb NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projection_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"projection_id" text NOT NULL,
	"document_key" varchar(180) NOT NULL,
	"subject_type" varchar(80),
	"subject_id" varchar(140),
	"status" "projection_document_status" DEFAULT 'current' NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"rendered_data" jsonb NOT NULL,
	"stale_reason" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projections" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"projection_key" varchar(160) NOT NULL,
	"projection_family" varchar(80) NOT NULL,
	"status" "projection_status" DEFAULT 'active' NOT NULL,
	"freshness_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"agent_kind" "knowledge_agent_kind" DEFAULT 'system' NOT NULL,
	"agent_name" varchar(160) NOT NULL,
	"run_key" varchar(220),
	"objective" text NOT NULL,
	"input_summary" text,
	"output_summary" text,
	"decisions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"unresolved_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"knowledge_cursor" varchar(220),
	"status" "knowledge_agent_run_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_checkpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"agent_kind" "knowledge_agent_kind" NOT NULL,
	"agent_name" varchar(160) NOT NULL,
	"checkpoint_key" varchar(120) DEFAULT 'global' NOT NULL,
	"last_knowledge_event_id" text,
	"last_commit_sha" varchar(120),
	"last_document_hash" varchar(128),
	"last_ingested_at" timestamp with time zone,
	"last_observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "knowledge_checkpoint_status" DEFAULT 'healthy' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"source_id" text NOT NULL,
	"document_id" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"chunk_text" text NOT NULL,
	"chunk_hash" varchar(128) NOT NULL,
	"token_estimate" integer DEFAULT 0 NOT NULL,
	"char_start" integer,
	"char_end" integer,
	"status" "knowledge_chunk_status" DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"source_id" text NOT NULL,
	"document_key" varchar(260) NOT NULL,
	"title" varchar(255) NOT NULL,
	"content_text" text NOT NULL,
	"content_hash" varchar(128) NOT NULL,
	"version_label" varchar(80) DEFAULT 'v1' NOT NULL,
	"mime_type" varchar(120) DEFAULT 'text/markdown' NOT NULL,
	"token_estimate" integer DEFAULT 0 NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"source_path" varchar(1000),
	"source_uri" varchar(1000),
	"source_updated_at" timestamp with time zone,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "knowledge_document_status" DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_edges" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"from_document_id" text NOT NULL,
	"to_document_id" text NOT NULL,
	"edge_type" "knowledge_edge_type" DEFAULT 'related' NOT NULL,
	"weight_bps" integer DEFAULT 10000 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_embeddings" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"source_id" text NOT NULL,
	"document_id" text NOT NULL,
	"chunk_id" text NOT NULL,
	"provider" varchar(80) NOT NULL,
	"model" varchar(160) NOT NULL,
	"dimensions" integer NOT NULL,
	"embedding" jsonb NOT NULL,
	"embedding_hash" varchar(128),
	"status" "knowledge_embedding_status" DEFAULT 'ready' NOT NULL,
	"error_message" text,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_events" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"source_id" text,
	"document_id" text,
	"chunk_id" text,
	"agent_run_id" text,
	"event_type" "knowledge_event_type" NOT NULL,
	"status" "knowledge_event_status" DEFAULT 'queued' NOT NULL,
	"message" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_retrieval_traces" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"agent_run_id" text,
	"query_text" text NOT NULL,
	"mode" "knowledge_retrieval_mode" DEFAULT 'hybrid' NOT NULL,
	"scope" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_document_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"result_chunk_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"result_scores" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"top_score_bps" integer,
	"model_provider" varchar(80),
	"model" varchar(160),
	"latency_ms" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"source_key" varchar(200) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"source_type" "knowledge_source_type" DEFAULT 'other' NOT NULL,
	"base_path" varchar(1000),
	"base_uri" varchar(1000),
	"git_repo" varchar(800),
	"git_branch" varchar(255),
	"latest_commit_sha" varchar(120),
	"source_updated_at" timestamp with time zone,
	"status" "knowledge_source_status" DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_lot_units" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"inventory_item_id" text NOT NULL,
	"inventory_location_id" text,
	"inventory_receipt_item_id" text,
	"lot_code" varchar(160) NOT NULL,
	"serial_start" varchar(160),
	"serial_end" varchar(160),
	"manufactured_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"quantity_on_hand" integer DEFAULT 0 NOT NULL,
	"quantity_reserved" integer DEFAULT 0 NOT NULL,
	"quantity_consumed" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_procurement_order_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"inventory_procurement_order_id" text NOT NULL,
	"inventory_item_id" text,
	"supply_partner_catalog_item_id" text,
	"target_subject_type" varchar(80),
	"target_subject_id" varchar(140),
	"status" "procurement_order_line_status" DEFAULT 'open' NOT NULL,
	"line_number" integer DEFAULT 1 NOT NULL,
	"description" text,
	"quantity_ordered" integer NOT NULL,
	"quantity_received" integer DEFAULT 0 NOT NULL,
	"unit_cost_minor" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"line_total_minor" integer DEFAULT 0 NOT NULL,
	"expected_by_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_procurement_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"supply_partner_id" text NOT NULL,
	"status" "procurement_order_status" DEFAULT 'draft' NOT NULL,
	"order_number" varchar(160) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"inventory_replenishment_run_id" text,
	"ordered_total_minor" integer DEFAULT 0 NOT NULL,
	"received_total_minor" integer DEFAULT 0 NOT NULL,
	"invoiced_total_minor" integer DEFAULT 0 NOT NULL,
	"ordered_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"expected_by_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"notes" text,
	"action_request_id" text,
	"latest_domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_receipt_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"inventory_procurement_order_id" text,
	"supply_partner_id" text,
	"inventory_location_id" text,
	"status" "receipt_batch_status" DEFAULT 'draft' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"received_by_user_id" text,
	"source_document_ref" varchar(180),
	"notes" text,
	"action_request_id" text,
	"latest_domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_receipt_items" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"inventory_receipt_batch_id" text NOT NULL,
	"inventory_procurement_order_line_id" text,
	"inventory_item_id" text,
	"quantity_received" integer NOT NULL,
	"quantity_accepted" integer DEFAULT 0 NOT NULL,
	"quantity_rejected" integer DEFAULT 0 NOT NULL,
	"quantity_damaged" integer DEFAULT 0 NOT NULL,
	"unit_cost_minor" integer,
	"inventory_movement_id" text,
	"lot_code" varchar(160),
	"serial_start" varchar(160),
	"serial_end" varchar(160),
	"expires_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_replenishment_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"inventory_item_id" text NOT NULL,
	"policy_mode" "replenishment_policy_mode" DEFAULT 'min_max' NOT NULL,
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"preferred_supply_partner_id" text,
	"policy_priority" integer DEFAULT 100 NOT NULL,
	"review_cadence_minutes" integer DEFAULT 1440 NOT NULL,
	"reorder_point_qty" integer,
	"reorder_target_qty" integer,
	"safety_stock_qty" integer DEFAULT 0 NOT NULL,
	"days_of_cover" integer,
	"allow_auto_draft_orders" boolean DEFAULT false NOT NULL,
	"policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_evaluated_at" timestamp with time zone,
	"action_request_id" text,
	"latest_domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_replenishment_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"status" "replenishment_run_status" DEFAULT 'pending' NOT NULL,
	"trigger_type" varchar(60) DEFAULT 'schedule' NOT NULL,
	"triggered_by_user_id" text,
	"window_starts_at" timestamp with time zone NOT NULL,
	"window_ends_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"suggestion_count" integer DEFAULT 0 NOT NULL,
	"accepted_count" integer DEFAULT 0 NOT NULL,
	"draft_order_count" integer DEFAULT 0 NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_request_id" text,
	"latest_domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_replenishment_suggestions" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"inventory_replenishment_run_id" text NOT NULL,
	"inventory_replenishment_policy_id" text,
	"inventory_item_id" text NOT NULL,
	"supply_partner_id" text,
	"status" "replenishment_suggestion_status" DEFAULT 'proposed' NOT NULL,
	"priority_score" integer DEFAULT 100 NOT NULL,
	"quantity_suggested" integer NOT NULL,
	"quantity_accepted" integer,
	"inventory_procurement_order_id" text,
	"expires_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"decided_by_user_id" text,
	"rationale" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supply_partner_catalog_items" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"supply_partner_id" text NOT NULL,
	"target_subject_type" varchar(80) NOT NULL,
	"target_subject_id" varchar(140) NOT NULL,
	"partner_sku" varchar(180) NOT NULL,
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"unit_cost_minor" integer DEFAULT 0 NOT NULL,
	"min_order_qty" integer DEFAULT 1 NOT NULL,
	"order_increment_qty" integer DEFAULT 1 NOT NULL,
	"lead_time_days" integer,
	"is_preferred" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supply_partners" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"partner_type" "supply_partner_type" NOT NULL,
	"status" "lifecycle_status" DEFAULT 'draft' NOT NULL,
	"name" varchar(220) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"legal_name" varchar(260),
	"default_lead_time_days" integer DEFAULT 0 NOT NULL,
	"ordering_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"contact_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "value_ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"value_program_id" text NOT NULL,
	"value_account_id" text NOT NULL,
	"value_transfer_id" text,
	"entry_type" "value_ledger_entry_type" NOT NULL,
	"units_delta" integer NOT NULL,
	"balance_after_units" integer NOT NULL,
	"idempotency_key" varchar(180),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"source_subject_type" varchar(80),
	"source_subject_id" varchar(140),
	"source_ref_type" varchar(80),
	"source_ref_id" varchar(140),
	"reverses_ledger_entry_id" text,
	"description" text,
	"action_request_id" text,
	"latest_domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "value_program_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"value_program_id" text NOT NULL,
	"account_number" varchar(180) NOT NULL,
	"status" "value_account_status" DEFAULT 'active' NOT NULL,
	"owner_model" "value_program_account_model" NOT NULL,
	"owner_user_id" text,
	"owner_group_account_id" text,
	"owner_subject_type" varchar(80),
	"owner_subject_id" varchar(140),
	"current_balance_units" integer DEFAULT 0 NOT NULL,
	"lifetime_earned_units" integer DEFAULT 0 NOT NULL,
	"lifetime_redeemed_units" integer DEFAULT 0 NOT NULL,
	"lifetime_expired_units" integer DEFAULT 0 NOT NULL,
	"current_tier_id" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone,
	"action_request_id" text,
	"latest_domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "value_program_tiers" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"value_program_id" text NOT NULL,
	"tier_key" varchar(120) NOT NULL,
	"name" varchar(180) NOT NULL,
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"rank" integer DEFAULT 1 NOT NULL,
	"min_lifetime_earned_units" integer DEFAULT 0 NOT NULL,
	"min_current_balance_units" integer DEFAULT 0 NOT NULL,
	"benefits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"retention_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "value_programs" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"name" varchar(220) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"kind" "value_program_kind" DEFAULT 'loyalty' NOT NULL,
	"account_model" "value_program_account_model" DEFAULT 'user' NOT NULL,
	"unit_kind" "value_unit_kind" DEFAULT 'points' NOT NULL,
	"status" "lifecycle_status" DEFAULT 'draft' NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"max_balance_units" integer,
	"allow_negative_balance" boolean DEFAULT false NOT NULL,
	"allow_transfers" boolean DEFAULT false NOT NULL,
	"points_to_currency_rate_bps" integer,
	"policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_request_id" text,
	"latest_domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "value_rule_evaluations" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"value_program_id" text NOT NULL,
	"value_rule_id" text NOT NULL,
	"value_account_id" text,
	"status" "value_evaluation_status" DEFAULT 'pending' NOT NULL,
	"evaluation_key" varchar(180) NOT NULL,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_at" timestamp with time zone,
	"units_delta" integer,
	"value_ledger_entry_id" text,
	"source_subject_type" varchar(80),
	"source_subject_id" varchar(140),
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_request_id" text,
	"latest_domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "value_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"value_program_id" text NOT NULL,
	"name" varchar(220) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"status" "value_rule_status" DEFAULT 'draft' NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"rule_type" varchar(80) DEFAULT 'earn' NOT NULL,
	"trigger_type" varchar(80) DEFAULT 'event' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"max_applications_per_account" integer,
	"rule" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_request_id" text,
	"latest_domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "value_transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"value_program_id" text NOT NULL,
	"source_value_account_id" text NOT NULL,
	"target_value_account_id" text NOT NULL,
	"status" "value_transfer_status" DEFAULT 'requested' NOT NULL,
	"units" integer NOT NULL,
	"requested_by_user_id" text,
	"decided_by_user_id" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"reason" text,
	"notes" text,
	"action_request_id" text,
	"latest_domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workforce_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"workforce_requisition_id" text NOT NULL,
	"workforce_candidate_id" text NOT NULL,
	"status" "workforce_application_status" DEFAULT 'applied' NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_recruiter_user_id" text,
	"decision_by_user_id" text,
	"decision_at" timestamp with time zone,
	"desired_compensation_minor" integer,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"hired_workforce_assignment_id" text,
	"offer_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"action_request_id" text,
	"latest_domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workforce_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"workforce_position_id" text NOT NULL,
	"user_id" text,
	"resource_id" text,
	"status" "workforce_assignment_status" DEFAULT 'draft' NOT NULL,
	"employment_class" "workforce_employment_class" DEFAULT 'employee' NOT NULL,
	"time_commitment" "workforce_time_commitment" DEFAULT 'full_time' NOT NULL,
	"assignment_title" varchar(220),
	"manager_workforce_assignment_id" text,
	"compensation_plan_id" text,
	"leave_policy_id" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"is_primary" boolean DEFAULT true NOT NULL,
	"allocation_basis_points" integer DEFAULT 10000 NOT NULL,
	"work_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_request_id" text,
	"latest_domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workforce_benefit_enrollments" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"workforce_benefit_plan_id" text NOT NULL,
	"workforce_assignment_id" text NOT NULL,
	"status" "workforce_benefit_enrollment_status" DEFAULT 'pending' NOT NULL,
	"coverage_tier" varchar(100),
	"dependent_count" integer DEFAULT 0 NOT NULL,
	"employee_contribution_minor" integer,
	"employer_contribution_minor" integer,
	"elected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"waived_reason" text,
	"notes" text,
	"action_request_id" text,
	"latest_domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workforce_benefit_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"name" varchar(220) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"status" "workforce_benefit_plan_status" DEFAULT 'draft' NOT NULL,
	"benefit_type" varchar(80) DEFAULT 'health' NOT NULL,
	"provider_name" varchar(220),
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"employer_contribution_minor" integer DEFAULT 0 NOT NULL,
	"employee_contribution_minor" integer DEFAULT 0 NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"eligibility_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"coverage_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_request_id" text,
	"latest_domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workforce_candidate_events" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"workforce_candidate_id" text NOT NULL,
	"workforce_requisition_id" text,
	"workforce_application_id" text,
	"event_type" "workforce_candidate_event_type" NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" text,
	"title" varchar(200),
	"notes" text,
	"event_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_request_id" text,
	"latest_domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workforce_candidates" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"status" "workforce_candidate_status" DEFAULT 'sourced' NOT NULL,
	"full_name" varchar(220) NOT NULL,
	"primary_email" varchar(320),
	"primary_phone" varchar(60),
	"source_channel" varchar(120),
	"current_company" varchar(220),
	"current_title" varchar(220),
	"location_preference" text,
	"available_from_at" timestamp with time zone,
	"resume_document_ref" varchar(260),
	"profile" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workforce_departments" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"name" varchar(220) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"department_code" varchar(80),
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"parent_workforce_department_id" text,
	"manager_user_id" text,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"description" text,
	"action_request_id" text,
	"latest_domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workforce_performance_cycles" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"name" varchar(220) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"status" "workforce_performance_cycle_status" DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"calibration_due_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_request_id" text,
	"latest_domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workforce_performance_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"workforce_performance_cycle_id" text NOT NULL,
	"workforce_assignment_id" text NOT NULL,
	"reviewer_workforce_assignment_id" text,
	"status" "workforce_performance_review_status" DEFAULT 'draft' NOT NULL,
	"score_basis_points" integer,
	"self_assessment" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"manager_assessment" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"goals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"action_request_id" text,
	"latest_domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workforce_positions" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"workforce_department_id" text,
	"location_id" text,
	"title" varchar(220) NOT NULL,
	"position_code" varchar(140) NOT NULL,
	"status" "lifecycle_status" DEFAULT 'draft' NOT NULL,
	"employment_class" "workforce_employment_class" DEFAULT 'employee' NOT NULL,
	"time_commitment" "workforce_time_commitment" DEFAULT 'full_time' NOT NULL,
	"reports_to_workforce_position_id" text,
	"headcount_target" integer DEFAULT 1 NOT NULL,
	"headcount_filled" integer DEFAULT 0 NOT NULL,
	"is_hiring_enabled" boolean DEFAULT false NOT NULL,
	"description" text,
	"requirements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"compensation_band" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_request_id" text,
	"latest_domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workforce_requisitions" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"workforce_position_id" text,
	"workforce_department_id" text,
	"location_id" text,
	"title" varchar(220) NOT NULL,
	"status" "workforce_requisition_status" DEFAULT 'draft' NOT NULL,
	"opening_count" integer DEFAULT 1 NOT NULL,
	"filled_count" integer DEFAULT 0 NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"hiring_manager_user_id" text,
	"recruiter_user_id" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"target_hire_by_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"description" text,
	"requirements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_request_id" text,
	"latest_domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "time_scopes" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"scope_type" "time_scope_type" NOT NULL,
	"scope_ref_type" varchar(80),
	"scope_ref_id" text,
	"scope_ref_key" varchar(320) NOT NULL,
	"display_name" varchar(220),
	"is_active" boolean DEFAULT true NOT NULL,
	"policy" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_access_events" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"auth_principal_id" text,
	"owner_user_id" text,
	"api_credential_id" text,
	"api_access_token_id" text,
	"client_installation_id" text,
	"auth_source" varchar(30) DEFAULT 'unknown' NOT NULL,
	"event_type" varchar(80) NOT NULL,
	"decision" varchar(20) NOT NULL,
	"reason_code" varchar(120),
	"reason_message" varchar(1200),
	"http_method" varchar(12),
	"http_path" varchar(500),
	"http_status" integer,
	"request_id" varchar(120),
	"source_ip" varchar(80),
	"user_agent" varchar(500),
	"principal_hint" varchar(220),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_principals" (
	"id" text PRIMARY KEY NOT NULL,
	"principal_key" varchar(320) NOT NULL,
	"biz_id" text,
	"owner_user_id" text,
	"principal_type" varchar(40) NOT NULL,
	"auth_source" varchar(30) NOT NULL,
	"api_credential_id" text,
	"api_access_token_id" text,
	"external_subject_ref" varchar(320),
	"client_installation_id" text,
	"display_label" varchar(220),
	"status" varchar(30) DEFAULT 'active' NOT NULL,
	"is_authenticatable" boolean DEFAULT true NOT NULL,
	"last_authenticated_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crm_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"customer_profile_id" text,
	"crm_contact_id" text,
	"crm_lead_id" text,
	"crm_opportunity_id" text,
	"support_case_id" text,
	"crm_conversation_id" text,
	"outbound_message_id" text,
	"activity_type" varchar(60) NOT NULL,
	"direction" varchar(32) DEFAULT 'internal' NOT NULL,
	"status" varchar(32) DEFAULT 'done' NOT NULL,
	"title" varchar(260) NOT NULL,
	"body" text,
	"owner_user_id" text,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"duration_minutes" integer,
	"outcome_type" varchar(80),
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_request_id" text,
	"domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crm_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"customer_profile_id" text,
	"crm_contact_id" text,
	"crm_lead_id" text,
	"crm_opportunity_id" text,
	"support_case_id" text,
	"title" varchar(260) NOT NULL,
	"description" text,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"priority" varchar(32) DEFAULT 'normal' NOT NULL,
	"assigned_user_id" text,
	"due_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_request_id" text,
	"domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_journey_enrollments" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"customer_journey_id" text NOT NULL,
	"customer_profile_id" text NOT NULL,
	"status" varchar(40) DEFAULT 'queued' NOT NULL,
	"current_step_id" text,
	"source_type" varchar(60) DEFAULT 'trigger' NOT NULL,
	"source_ref" varchar(220),
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_step_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"touch_count" integer DEFAULT 0 NOT NULL,
	"conversion_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_request_id" text,
	"domain_event_id" text,
	"workflow_instance_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_journey_events" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"customer_journey_enrollment_id" text NOT NULL,
	"customer_journey_step_id" text,
	"event_type" varchar(80) NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"outbound_message_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_request_id" text,
	"domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_journey_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"customer_journey_id" text NOT NULL,
	"step_key" varchar(140) NOT NULL,
	"name" varchar(220) NOT NULL,
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"step_type" varchar(80) NOT NULL,
	"sequence" integer DEFAULT 100 NOT NULL,
	"wait_duration_minutes" integer,
	"channel_type" varchar(40),
	"message_template_id" text,
	"action_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"success_next_step_key" varchar(140),
	"failure_next_step_key" varchar(140),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_journeys" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"name" varchar(220) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"journey_type" varchar(60) DEFAULT 'lifecycle' NOT NULL,
	"entry_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"exit_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"suppression_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_request_id" text,
	"domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_playbook_bindings" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"customer_playbook_id" text NOT NULL,
	"target_type" varchar(80) NOT NULL,
	"target_id" text NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_playbook_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"customer_playbook_id" text NOT NULL,
	"customer_profile_id" text,
	"support_case_id" text,
	"crm_opportunity_id" text,
	"status" varchar(40) DEFAULT 'queued' NOT NULL,
	"requested_by_user_id" text,
	"executor_type" varchar(40) DEFAULT 'agent' NOT NULL,
	"executor_ref" varchar(200),
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"input_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"failure_summary" text,
	"action_request_id" text,
	"domain_event_id" text,
	"workflow_instance_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_playbooks" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"name" varchar(220) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"domain" varchar(40) DEFAULT 'cross_domain' NOT NULL,
	"trigger_type" varchar(40) DEFAULT 'event' NOT NULL,
	"trigger_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"decision_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_plan" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_request_id" text,
	"domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_profile_crm_links" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"customer_profile_id" text NOT NULL,
	"crm_contact_id" text NOT NULL,
	"link_type" varchar(40) DEFAULT 'primary' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"note" text,
	"action_request_id" text,
	"domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_timeline_events" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"customer_profile_id" text NOT NULL,
	"event_type" varchar(80) NOT NULL,
	"title" varchar(260) NOT NULL,
	"summary" text,
	"source_domain" varchar(60) NOT NULL,
	"source_entity_type" varchar(80),
	"source_entity_id" text,
	"is_customer_visible" boolean DEFAULT false NOT NULL,
	"importance" integer DEFAULT 100 NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_request_id" text,
	"domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_case_events" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"support_case_id" text NOT NULL,
	"event_type" varchar(80) NOT NULL,
	"actor_type" varchar(40) DEFAULT 'system' NOT NULL,
	"actor_user_id" text,
	"actor_customer_profile_id" text,
	"actor_label" varchar(200),
	"from_status" varchar(40),
	"to_status" varchar(40),
	"note" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"action_request_id" text,
	"domain_event_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_case_links" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"support_case_id" text NOT NULL,
	"target_type" varchar(80) NOT NULL,
	"target_id" text NOT NULL,
	"relation_type" varchar(60) DEFAULT 'about' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_case_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"support_case_id" text NOT NULL,
	"participant_type" varchar(40) NOT NULL,
	"role" varchar(40) NOT NULL,
	"user_id" text,
	"customer_profile_id" text,
	"external_ref" varchar(220),
	"is_primary" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"customer_profile_id" text NOT NULL,
	"crm_contact_id" text,
	"crm_conversation_id" text,
	"booking_order_id" text,
	"payment_transaction_id" text,
	"sla_policy_id" text,
	"case_type" varchar(60) NOT NULL,
	"status" varchar(40) DEFAULT 'new' NOT NULL,
	"priority" varchar(24) DEFAULT 'normal' NOT NULL,
	"severity_level" integer DEFAULT 2 NOT NULL,
	"channel_type" varchar(40) DEFAULT 'in_app' NOT NULL,
	"title" varchar(260) NOT NULL,
	"description" text,
	"owner_user_id" text,
	"assigned_user_id" text,
	"queue_ref" varchar(160),
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_response_due_at" timestamp with time zone,
	"next_response_due_at" timestamp with time zone,
	"resolution_due_at" timestamp with time zone,
	"first_responded_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"csat_score" integer,
	"nps_score" integer,
	"resolution_type" varchar(80),
	"resolution_summary" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_request_id" text,
	"domain_event_id" text,
	"workflow_instance_id" text,
	"projection_document_id" text,
	"debug_snapshot_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ooda_loop_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"ooda_loop_id" text NOT NULL,
	"ooda_loop_entry_id" text,
	"action_key" varchar(160) NOT NULL,
	"action_title" varchar(255) NOT NULL,
	"status" varchar(24) DEFAULT 'queued' NOT NULL,
	"dry_run" boolean DEFAULT true NOT NULL,
	"requested_by_user_id" text NOT NULL,
	"assigned_to_user_id" text,
	"linked_saga_run_id" text,
	"request_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ooda_loop_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"ooda_loop_id" text NOT NULL,
	"phase" varchar(16) NOT NULL,
	"entry_type" varchar(32) NOT NULL,
	"title" varchar(255) NOT NULL,
	"body_markdown" text,
	"severity" varchar(16) DEFAULT 'medium' NOT NULL,
	"status" varchar(24) DEFAULT 'open' NOT NULL,
	"gap_type" varchar(40),
	"source_type" varchar(24) DEFAULT 'manual' NOT NULL,
	"source_ref_id" text,
	"linked_use_case_id" text,
	"linked_saga_definition_id" text,
	"linked_saga_run_id" text,
	"linked_saga_run_step_id" text,
	"linked_coverage_item_id" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ooda_loop_links" (
	"id" text PRIMARY KEY NOT NULL,
	"ooda_loop_id" text NOT NULL,
	"target_type" varchar(48) NOT NULL,
	"target_id" text NOT NULL,
	"relation_role" varchar(32) DEFAULT 'focus' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ooda_loops" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text,
	"loop_key" varchar(160) NOT NULL,
	"title" varchar(255) NOT NULL,
	"objective" text,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"current_phase" varchar(16) DEFAULT 'observe' NOT NULL,
	"priority" integer DEFAULT 50 NOT NULL,
	"owner_user_id" text,
	"health_score" integer DEFAULT 0 NOT NULL,
	"last_signal_at" timestamp with time zone,
	"next_review_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saga_run_scheduler_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"saga_run_id" text NOT NULL,
	"saga_run_step_id" text,
	"step_key" varchar(180),
	"job_type" "saga_scheduler_job_type" DEFAULT 'step_delay' NOT NULL,
	"status" "saga_scheduler_job_status" DEFAULT 'pending' NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"condition_key" varchar(240),
	"timeout_at" timestamp with time zone,
	"poll_every_ms" integer,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"enqueued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_evaluated_at" timestamp with time zone,
	"failure_message" text,
	"result_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saga_run_simulation_clocks" (
	"id" text PRIMARY KEY NOT NULL,
	"saga_run_id" text NOT NULL,
	"mode" "saga_run_clock_mode" DEFAULT 'virtual' NOT NULL,
	"status" "saga_run_clock_status" DEFAULT 'idle' NOT NULL,
	"current_time_at" timestamp with time zone NOT NULL,
	"timezone" varchar(80) DEFAULT 'UTC' NOT NULL,
	"auto_advance" boolean DEFAULT true NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_advanced_at" timestamp with time zone,
	"advance_count" integer DEFAULT 0 NOT NULL,
	"total_advanced_ms" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
DO $$ BEGIN
  IF to_regclass('public.org_membership_locations') IS NOT NULL
    AND to_regclass('public.org_membership_locations_legacy_20260305') IS NULL THEN
    EXECUTE 'ALTER TABLE "org_membership_locations" RENAME TO "org_membership_locations_legacy_20260305"';
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF to_regclass('public.org_memberships') IS NOT NULL
    AND to_regclass('public.org_memberships_legacy_20260305') IS NULL THEN
    EXECUTE 'ALTER TABLE "org_memberships" RENAME TO "org_memberships_legacy_20260305"';
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF to_regclass('public.lifecycle_events') IS NOT NULL
    AND to_regclass('public.lifecycle_events_legacy_20260305') IS NULL THEN
    EXECUTE 'ALTER TABLE "lifecycle_events" RENAME TO "lifecycle_events_legacy_20260305"';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "extension_state_documents" DROP CONSTRAINT "extension_state_documents_last_lifecycle_event_id_lifecycle_events_id_fk";
--> statement-breakpoint
ALTER TABLE "extension_state_documents" DROP CONSTRAINT "extension_state_documents_biz_lifecycle_event_fk";
--> statement-breakpoint
ALTER TABLE "lifecycle_event_deliveries" DROP CONSTRAINT "lifecycle_event_deliveries_lifecycle_event_id_lifecycle_events_id_fk";
--> statement-breakpoint
ALTER TABLE "lifecycle_event_deliveries" DROP CONSTRAINT "lifecycle_event_deliveries_biz_event_fk";
--> statement-breakpoint
ALTER TABLE "outbound_messages" DROP CONSTRAINT "outbound_messages_lifecycle_event_id_lifecycle_events_id_fk";
--> statement-breakpoint
ALTER TABLE "outbound_messages" DROP CONSTRAINT "outbound_messages_biz_lifecycle_event_fk";
--> statement-breakpoint
ALTER TABLE "projection_checkpoints" DROP CONSTRAINT "projection_checkpoints_last_lifecycle_event_id_lifecycle_events_id_fk";
--> statement-breakpoint
ALTER TABLE "projection_checkpoints" DROP CONSTRAINT "projection_checkpoints_biz_lifecycle_event_fk";
--> statement-breakpoint
ALTER TABLE "saga_coverage_reports" ALTER COLUMN "status" SET DATA TYPE saga_coverage_report_status;--> statement-breakpoint
ALTER TABLE "saga_definition_revisions" ALTER COLUMN "spec_version" SET DEFAULT 'saga.v1';--> statement-breakpoint
ALTER TABLE "saga_definitions" ALTER COLUMN "spec_version" SET DEFAULT 'saga.v1';--> statement-breakpoint
ALTER TABLE "capacity_hold_demand_alerts" ADD COLUMN "time_scope_id" text;--> statement-breakpoint
ALTER TABLE "capacity_hold_policies" ADD COLUMN "time_scope_id" text;--> statement-breakpoint
ALTER TABLE "capacity_holds" ADD COLUMN "time_scope_id" text;--> statement-breakpoint
ALTER TABLE "fulfillment_units" ADD COLUMN "booking_order_line_id" text;--> statement-breakpoint
ALTER TABLE "saga_definitions" ADD COLUMN "depth" "saga_depth" DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "saga_runs" ADD COLUMN "depth" "saga_depth" DEFAULT 'medium' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "action_executions_biz_id_id_unique" ON "action_executions" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "action_executions_request_attempt_unique" ON "action_executions" ("action_request_id","attempt_number","phase_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "action_executions_request_status_idx" ON "action_executions" ("action_request_id","status","started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "action_executions_retry_idx" ON "action_executions" ("failure_code","is_retryable");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "action_failures_biz_id_id_unique" ON "action_failures" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "action_failures_request_idx" ON "action_failures" ("action_request_id","failed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "action_failures_family_code_idx" ON "action_failures" ("failure_family","failure_code","failed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "action_failures_debug_snapshot_idx" ON "action_failures" ("debug_snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "action_idempotency_biz_id_id_unique" ON "action_idempotency_keys" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "action_idempotency_namespace_unique" ON "action_idempotency_keys" ("biz_id","action_key","actor_namespace","idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "action_idempotency_status_expiry_idx" ON "action_idempotency_keys" ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "action_related_entities_biz_id_id_unique" ON "action_related_entities" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "action_related_entities_action_idx" ON "action_related_entities" ("action_request_id","relation_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "action_related_entities_entity_idx" ON "action_related_entities" ("biz_id","entity_subject_type","entity_subject_id","relation_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "action_requests_biz_id_id_unique" ON "action_requests" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "action_requests_biz_requested_at_idx" ON "action_requests" ("biz_id","requested_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "action_requests_biz_action_status_idx" ON "action_requests" ("biz_id","action_family","action_key","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "action_requests_actor_idx" ON "action_requests" ("biz_id","actor_type","actor_user_id","actor_ref","requested_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "action_requests_correlation_idx" ON "action_requests" ("correlation_id","causation_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "domain_events_biz_id_id_unique" ON "domain_events" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domain_events_biz_occurred_idx" ON "domain_events" ("biz_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domain_events_subject_idx" ON "domain_events" ("biz_id","subject_type","subject_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domain_events_family_key_idx" ON "domain_events" ("biz_id","event_family","event_key","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_projection_consumers_biz_id_id_unique" ON "event_projection_consumers" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_projection_consumers_unique" ON "event_projection_consumers" ("biz_id","projection_key","consumer_ref");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "client_external_subjects_biz_id_id_unique" ON "client_external_subjects" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "client_external_subjects_install_unique" ON "client_external_subjects" ("client_installation_id","subject_kind","external_subject_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_external_subjects_profile_idx" ON "client_external_subjects" ("customer_profile_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "client_installation_credentials_biz_id_id_unique" ON "client_installation_credentials" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_installation_credentials_install_idx" ON "client_installation_credentials" ("client_installation_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "client_installations_biz_id_id_unique" ON "client_installations" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "client_installations_biz_provider_site_unique" ON "client_installations" ("biz_id","provider_key","site_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_installations_biz_status_idx" ON "client_installations" ("biz_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_identity_handles_biz_id_id_unique" ON "customer_identity_handles" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_identity_handles_unique" ON "customer_identity_handles" ("biz_id","handle_type","normalized_value");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_identity_handles_lookup_idx" ON "customer_identity_handles" ("biz_id","handle_type","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_identity_links_biz_id_id_unique" ON "customer_identity_links" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_identity_links_unique" ON "customer_identity_links" ("customer_profile_id","customer_identity_handle_id","client_installation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_identity_links_profile_idx" ON "customer_identity_links" ("customer_profile_id","verification_state","confidence_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_profile_merges_action_request_idx" ON "customer_profile_merges" ("action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_profiles_biz_id_id_unique" ON "customer_profiles" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_profiles_biz_status_idx" ON "customer_profiles" ("biz_id","status","lifecycle_stage","support_tier","is_verified");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_profiles_biz_email_idx" ON "customer_profiles" ("biz_id","primary_email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_profiles_biz_phone_idx" ON "customer_profiles" ("biz_id","primary_phone");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "schedule_subject_links_biz_id_id_unique" ON "schedule_subject_links" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "schedule_subject_links_unique" ON "schedule_subject_links" ("biz_id","parent_schedule_subject_id","child_schedule_subject_id","link_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "schedule_subjects_biz_id_id_unique" ON "schedule_subjects" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "schedule_subjects_unique" ON "schedule_subjects" ("biz_id","subject_type","subject_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_subjects_class_idx" ON "schedule_subjects" ("biz_id","schedule_class","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "debug_snapshots_biz_id_id_unique" ON "debug_snapshots" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "debug_snapshots_context_idx" ON "debug_snapshots" ("snapshot_family","context_ref","captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "projection_documents_biz_id_id_unique" ON "projection_documents" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "projection_documents_unique" ON "projection_documents" ("projection_id","document_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projection_documents_subject_idx" ON "projection_documents" ("biz_id","subject_type","subject_id","generated_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "projections_biz_id_id_unique" ON "projections" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "projections_unique" ON "projections" ("biz_id","projection_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_agent_runs_run_key_unique" ON "knowledge_agent_runs" ("run_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_agent_runs_agent_status_idx" ON "knowledge_agent_runs" ("agent_kind","agent_name","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_agent_runs_biz_started_idx" ON "knowledge_agent_runs" ("biz_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_checkpoints_global_agent_key_unique" ON "knowledge_checkpoints" ("agent_kind","agent_name","checkpoint_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_checkpoints_biz_agent_key_unique" ON "knowledge_checkpoints" ("biz_id","agent_kind","agent_name","checkpoint_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_checkpoints_biz_observed_idx" ON "knowledge_checkpoints" ("biz_id","last_observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_chunks_document_chunk_version_unique" ON "knowledge_chunks" ("document_id","chunk_index","chunk_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_chunks_source_doc_idx" ON "knowledge_chunks" ("source_id","document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_chunks_biz_status_idx" ON "knowledge_chunks" ("biz_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_documents_source_key_hash_unique" ON "knowledge_documents" ("source_id","document_key","content_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_documents_biz_source_status_idx" ON "knowledge_documents" ("biz_id","source_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_documents_updated_idx" ON "knowledge_documents" ("source_updated_at","ingested_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_edges_unique" ON "knowledge_edges" ("from_document_id","to_document_id","edge_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_edges_biz_type_idx" ON "knowledge_edges" ("biz_id","edge_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_embeddings_chunk_provider_model_unique" ON "knowledge_embeddings" ("chunk_id","provider","model");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_embeddings_biz_doc_idx" ON "knowledge_embeddings" ("biz_id","document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_embeddings_status_computed_idx" ON "knowledge_embeddings" ("status","computed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_events_type_occurred_idx" ON "knowledge_events" ("event_type","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_events_biz_occurred_idx" ON "knowledge_events" ("biz_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_retrieval_traces_agent_occurred_idx" ON "knowledge_retrieval_traces" ("agent_run_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_retrieval_traces_biz_occurred_idx" ON "knowledge_retrieval_traces" ("biz_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_sources_global_source_key_unique" ON "knowledge_sources" ("source_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_sources_biz_source_key_unique" ON "knowledge_sources" ("biz_id","source_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_sources_biz_type_status_idx" ON "knowledge_sources" ("biz_id","source_type","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_lot_units_biz_id_id_unique" ON "inventory_lot_units" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_lot_units_biz_item_lot_unique" ON "inventory_lot_units" ("biz_id","inventory_item_id","inventory_location_id","lot_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_lot_units_biz_status_expiry_idx" ON "inventory_lot_units" ("biz_id","status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_procurement_order_lines_biz_id_id_unique" ON "inventory_procurement_order_lines" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_procurement_order_lines_order_line_number_unique" ON "inventory_procurement_order_lines" ("inventory_procurement_order_id","line_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_procurement_order_lines_biz_order_status_idx" ON "inventory_procurement_order_lines" ("biz_id","inventory_procurement_order_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_procurement_orders_biz_id_id_unique" ON "inventory_procurement_orders" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_procurement_orders_biz_order_number_unique" ON "inventory_procurement_orders" ("biz_id","order_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_procurement_orders_biz_status_expected_idx" ON "inventory_procurement_orders" ("biz_id","status","expected_by_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_procurement_orders_action_request_idx" ON "inventory_procurement_orders" ("action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_receipt_batches_biz_id_id_unique" ON "inventory_receipt_batches" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_receipt_batches_biz_status_received_idx" ON "inventory_receipt_batches" ("biz_id","status","received_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_receipt_batches_biz_order_idx" ON "inventory_receipt_batches" ("biz_id","inventory_procurement_order_id","received_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_receipt_batches_action_request_idx" ON "inventory_receipt_batches" ("action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_receipt_items_biz_id_id_unique" ON "inventory_receipt_items" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_receipt_items_biz_batch_idx" ON "inventory_receipt_items" ("biz_id","inventory_receipt_batch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_receipt_items_biz_item_idx" ON "inventory_receipt_items" ("biz_id","inventory_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_replenishment_policies_biz_id_id_unique" ON "inventory_replenishment_policies" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_replenishment_policies_active_per_item_unique" ON "inventory_replenishment_policies" ("biz_id","inventory_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_replenishment_policies_biz_mode_status_priority_idx" ON "inventory_replenishment_policies" ("biz_id","policy_mode","status","policy_priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_replenishment_policies_action_request_idx" ON "inventory_replenishment_policies" ("action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_replenishment_runs_biz_id_id_unique" ON "inventory_replenishment_runs" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_replenishment_runs_biz_status_started_idx" ON "inventory_replenishment_runs" ("biz_id","status","started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_replenishment_runs_window_idx" ON "inventory_replenishment_runs" ("biz_id","window_starts_at","window_ends_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_replenishment_runs_action_request_idx" ON "inventory_replenishment_runs" ("action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_replenishment_suggestions_biz_id_id_unique" ON "inventory_replenishment_suggestions" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_replenishment_suggestions_run_status_priority_idx" ON "inventory_replenishment_suggestions" ("biz_id","inventory_replenishment_run_id","status","priority_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_replenishment_suggestions_item_status_idx" ON "inventory_replenishment_suggestions" ("biz_id","inventory_item_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "supply_partner_catalog_items_biz_id_id_unique" ON "supply_partner_catalog_items" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "supply_partner_catalog_items_partner_sku_unique" ON "supply_partner_catalog_items" ("biz_id","supply_partner_id","partner_sku");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supply_partner_catalog_items_partner_status_idx" ON "supply_partner_catalog_items" ("biz_id","supply_partner_id","status","is_preferred");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supply_partner_catalog_items_target_idx" ON "supply_partner_catalog_items" ("biz_id","target_subject_type","target_subject_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "supply_partners_biz_id_id_unique" ON "supply_partners" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "supply_partners_biz_slug_unique" ON "supply_partners" ("biz_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supply_partners_biz_type_status_idx" ON "supply_partners" ("biz_id","partner_type","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "value_ledger_entries_biz_id_id_unique" ON "value_ledger_entries" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "value_ledger_entries_account_idempotency_unique" ON "value_ledger_entries" ("biz_id","value_account_id","idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "value_ledger_entries_account_occurred_idx" ON "value_ledger_entries" ("biz_id","value_account_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "value_ledger_entries_program_entry_type_idx" ON "value_ledger_entries" ("biz_id","value_program_id","entry_type","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "value_ledger_entries_source_subject_idx" ON "value_ledger_entries" ("biz_id","source_subject_type","source_subject_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "value_ledger_entries_action_request_idx" ON "value_ledger_entries" ("action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "value_program_accounts_biz_id_id_unique" ON "value_program_accounts" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "value_program_accounts_number_unique" ON "value_program_accounts" ("biz_id","value_program_id","account_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "value_program_accounts_owner_user_unique" ON "value_program_accounts" ("biz_id","value_program_id","owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "value_program_accounts_owner_group_unique" ON "value_program_accounts" ("biz_id","value_program_id","owner_group_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "value_program_accounts_owner_subject_unique" ON "value_program_accounts" ("biz_id","value_program_id","owner_subject_type","owner_subject_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "value_program_accounts_program_status_idx" ON "value_program_accounts" ("biz_id","value_program_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "value_program_accounts_owner_status_idx" ON "value_program_accounts" ("biz_id","owner_model","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "value_program_accounts_action_request_idx" ON "value_program_accounts" ("action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "value_program_tiers_biz_id_id_unique" ON "value_program_tiers" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "value_program_tiers_tier_key_unique" ON "value_program_tiers" ("biz_id","value_program_id","tier_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "value_program_tiers_rank_unique" ON "value_program_tiers" ("biz_id","value_program_id","rank");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "value_program_tiers_program_status_rank_idx" ON "value_program_tiers" ("biz_id","value_program_id","status","rank");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "value_programs_biz_id_id_unique" ON "value_programs" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "value_programs_biz_slug_unique" ON "value_programs" ("biz_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "value_programs_biz_status_kind_idx" ON "value_programs" ("biz_id","status","kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "value_programs_action_request_idx" ON "value_programs" ("action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "value_rule_evaluations_biz_id_id_unique" ON "value_rule_evaluations" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "value_rule_evaluations_rule_eval_key_unique" ON "value_rule_evaluations" ("biz_id","value_rule_id","evaluation_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "value_rule_evaluations_account_status_evaluated_idx" ON "value_rule_evaluations" ("biz_id","value_account_id","status","evaluated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "value_rule_evaluations_rule_status_evaluated_idx" ON "value_rule_evaluations" ("biz_id","value_rule_id","status","evaluated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "value_rule_evaluations_action_request_idx" ON "value_rule_evaluations" ("action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "value_rules_biz_id_id_unique" ON "value_rules" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "value_rules_program_slug_unique" ON "value_rules" ("biz_id","value_program_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "value_rules_program_status_priority_idx" ON "value_rules" ("biz_id","value_program_id","status","priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "value_rules_action_request_idx" ON "value_rules" ("action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "value_transfers_biz_id_id_unique" ON "value_transfers" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "value_transfers_biz_program_status_requested_idx" ON "value_transfers" ("biz_id","value_program_id","status","requested_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "value_transfers_biz_source_status_idx" ON "value_transfers" ("biz_id","source_value_account_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "value_transfers_biz_target_status_idx" ON "value_transfers" ("biz_id","target_value_account_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "value_transfers_action_request_idx" ON "value_transfers" ("action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workforce_applications_biz_id_id_unique" ON "workforce_applications" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workforce_applications_requisition_candidate_unique" ON "workforce_applications" ("biz_id","workforce_requisition_id","workforce_candidate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_applications_biz_status_applied_idx" ON "workforce_applications" ("biz_id","status","applied_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_applications_biz_candidate_status_idx" ON "workforce_applications" ("biz_id","workforce_candidate_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_applications_action_request_idx" ON "workforce_applications" ("action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workforce_assignments_biz_id_id_unique" ON "workforce_assignments" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workforce_assignments_primary_user_unique" ON "workforce_assignments" ("biz_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_assignments_biz_status_start_idx" ON "workforce_assignments" ("biz_id","status","starts_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_assignments_biz_position_status_idx" ON "workforce_assignments" ("biz_id","workforce_position_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_assignments_biz_manager_status_idx" ON "workforce_assignments" ("biz_id","manager_workforce_assignment_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_assignments_action_request_idx" ON "workforce_assignments" ("action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workforce_benefit_enrollments_biz_id_id_unique" ON "workforce_benefit_enrollments" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workforce_benefit_enrollments_active_unique" ON "workforce_benefit_enrollments" ("biz_id","workforce_benefit_plan_id","workforce_assignment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_benefit_enrollments_assignment_status_idx" ON "workforce_benefit_enrollments" ("biz_id","workforce_assignment_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_benefit_enrollments_plan_status_idx" ON "workforce_benefit_enrollments" ("biz_id","workforce_benefit_plan_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_benefit_enrollments_action_request_idx" ON "workforce_benefit_enrollments" ("action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workforce_benefit_plans_biz_id_id_unique" ON "workforce_benefit_plans" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workforce_benefit_plans_biz_slug_unique" ON "workforce_benefit_plans" ("biz_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_benefit_plans_biz_status_effective_idx" ON "workforce_benefit_plans" ("biz_id","status","effective_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_benefit_plans_action_request_idx" ON "workforce_benefit_plans" ("action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workforce_candidate_events_biz_id_id_unique" ON "workforce_candidate_events" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_candidate_events_candidate_occurred_idx" ON "workforce_candidate_events" ("biz_id","workforce_candidate_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_candidate_events_application_occurred_idx" ON "workforce_candidate_events" ("biz_id","workforce_application_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_candidate_events_action_request_idx" ON "workforce_candidate_events" ("action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workforce_candidates_biz_id_id_unique" ON "workforce_candidates" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workforce_candidates_biz_primary_email_unique" ON "workforce_candidates" ("biz_id","primary_email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_candidates_biz_status_name_idx" ON "workforce_candidates" ("biz_id","status","full_name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workforce_departments_biz_id_id_unique" ON "workforce_departments" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workforce_departments_biz_slug_unique" ON "workforce_departments" ("biz_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workforce_departments_biz_code_unique" ON "workforce_departments" ("biz_id","department_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_departments_biz_status_sort_idx" ON "workforce_departments" ("biz_id","status","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_departments_action_request_idx" ON "workforce_departments" ("action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workforce_performance_cycles_biz_id_id_unique" ON "workforce_performance_cycles" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workforce_performance_cycles_biz_slug_unique" ON "workforce_performance_cycles" ("biz_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_performance_cycles_biz_status_start_idx" ON "workforce_performance_cycles" ("biz_id","status","starts_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_performance_cycles_action_request_idx" ON "workforce_performance_cycles" ("action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workforce_performance_reviews_biz_id_id_unique" ON "workforce_performance_reviews" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workforce_performance_reviews_cycle_assignment_unique" ON "workforce_performance_reviews" ("biz_id","workforce_performance_cycle_id","workforce_assignment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_performance_reviews_cycle_status_idx" ON "workforce_performance_reviews" ("biz_id","workforce_performance_cycle_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_performance_reviews_assignment_status_idx" ON "workforce_performance_reviews" ("biz_id","workforce_assignment_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_performance_reviews_action_request_idx" ON "workforce_performance_reviews" ("action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workforce_positions_biz_id_id_unique" ON "workforce_positions" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workforce_positions_biz_position_code_unique" ON "workforce_positions" ("biz_id","position_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_positions_biz_status_dept_idx" ON "workforce_positions" ("biz_id","status","workforce_department_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_positions_biz_hiring_status_idx" ON "workforce_positions" ("biz_id","is_hiring_enabled","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_positions_action_request_idx" ON "workforce_positions" ("action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workforce_requisitions_biz_id_id_unique" ON "workforce_requisitions" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_requisitions_biz_status_priority_idx" ON "workforce_requisitions" ("biz_id","status","priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_requisitions_biz_position_status_idx" ON "workforce_requisitions" ("biz_id","workforce_position_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workforce_requisitions_action_request_idx" ON "workforce_requisitions" ("action_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "time_scopes_biz_id_id_unique" ON "time_scopes" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "time_scopes_biz_scope_ref_unique" ON "time_scopes" ("biz_id","scope_ref_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "time_scopes_biz_scope_type_active_idx" ON "time_scopes" ("biz_id","scope_type","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "time_scopes_biz_scope_subject_idx" ON "time_scopes" ("biz_id","scope_ref_type","scope_ref_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_access_events_biz_occurred_idx" ON "auth_access_events" ("biz_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_access_events_principal_occurred_idx" ON "auth_access_events" ("auth_principal_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_access_events_installation_occurred_idx" ON "auth_access_events" ("client_installation_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_access_events_source_decision_occurred_idx" ON "auth_access_events" ("auth_source","decision","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_access_events_type_occurred_idx" ON "auth_access_events" ("event_type","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_access_events_request_id_idx" ON "auth_access_events" ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_principals_principal_key_unique" ON "auth_principals" ("principal_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_principals_biz_type_status_idx" ON "auth_principals" ("biz_id","principal_type","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_principals_owner_status_idx" ON "auth_principals" ("owner_user_id","status","last_authenticated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_principals_credential_idx" ON "auth_principals" ("api_credential_id","api_access_token_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_principals_installation_idx" ON "auth_principals" ("client_installation_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "crm_activities_biz_id_id_unique" ON "crm_activities" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_activities_customer_timeline_idx" ON "crm_activities" ("biz_id","customer_profile_id","completed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_activities_opportunity_idx" ON "crm_activities" ("biz_id","crm_opportunity_id","completed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_activities_owner_status_idx" ON "crm_activities" ("biz_id","owner_user_id","status","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "crm_tasks_biz_id_id_unique" ON "crm_tasks" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_tasks_assignee_status_idx" ON "crm_tasks" ("biz_id","assigned_user_id","status","priority","due_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_tasks_customer_idx" ON "crm_tasks" ("biz_id","customer_profile_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_journey_enrollments_biz_id_id_unique" ON "customer_journey_enrollments" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_journey_enrollments_active_unique" ON "customer_journey_enrollments" ("biz_id","customer_journey_id","customer_profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_journey_enrollments_journey_status_idx" ON "customer_journey_enrollments" ("biz_id","customer_journey_id","status","entered_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_journey_enrollments_customer_status_idx" ON "customer_journey_enrollments" ("biz_id","customer_profile_id","status","entered_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_journey_events_biz_id_id_unique" ON "customer_journey_events" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_journey_events_enrollment_occurred_idx" ON "customer_journey_events" ("biz_id","customer_journey_enrollment_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_journey_steps_biz_id_id_unique" ON "customer_journey_steps" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_journey_steps_journey_step_key_unique" ON "customer_journey_steps" ("customer_journey_id","step_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_journey_steps_journey_sequence_idx" ON "customer_journey_steps" ("biz_id","customer_journey_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_journeys_biz_id_id_unique" ON "customer_journeys" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_journeys_biz_slug_unique" ON "customer_journeys" ("biz_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_journeys_status_type_idx" ON "customer_journeys" ("biz_id","status","journey_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_playbook_bindings_biz_id_id_unique" ON "customer_playbook_bindings" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_playbook_bindings_unique" ON "customer_playbook_bindings" ("biz_id","customer_playbook_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_playbook_bindings_resolver_idx" ON "customer_playbook_bindings" ("biz_id","target_type","target_id","is_enabled","priority");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_playbook_runs_biz_id_id_unique" ON "customer_playbook_runs" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_playbook_runs_playbook_status_idx" ON "customer_playbook_runs" ("biz_id","customer_playbook_id","status","started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_playbook_runs_customer_status_idx" ON "customer_playbook_runs" ("biz_id","customer_profile_id","status","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_playbooks_biz_id_id_unique" ON "customer_playbooks" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_playbooks_biz_slug_unique" ON "customer_playbooks" ("biz_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_playbooks_domain_status_idx" ON "customer_playbooks" ("biz_id","domain","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_profile_crm_links_biz_id_id_unique" ON "customer_profile_crm_links" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_profile_crm_links_pair_unique" ON "customer_profile_crm_links" ("biz_id","customer_profile_id","crm_contact_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_profile_crm_links_primary_idx" ON "customer_profile_crm_links" ("biz_id","customer_profile_id","is_primary");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_timeline_events_biz_id_id_unique" ON "customer_timeline_events" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_timeline_events_profile_occurred_idx" ON "customer_timeline_events" ("biz_id","customer_profile_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_timeline_events_type_idx" ON "customer_timeline_events" ("biz_id","event_type","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "support_case_events_biz_id_id_unique" ON "support_case_events" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_case_events_case_occurred_idx" ON "support_case_events" ("biz_id","support_case_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "support_case_links_biz_id_id_unique" ON "support_case_links" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "support_case_links_unique" ON "support_case_links" ("biz_id","support_case_id","target_type","target_id","relation_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_case_links_target_idx" ON "support_case_links" ("biz_id","target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "support_case_participants_biz_id_id_unique" ON "support_case_participants" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_case_participants_case_idx" ON "support_case_participants" ("biz_id","support_case_id","role","is_primary");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "support_cases_biz_id_id_unique" ON "support_cases" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_cases_inbox_idx" ON "support_cases" ("biz_id","status","priority","severity_level","next_response_due_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_cases_assignee_idx" ON "support_cases" ("biz_id","assigned_user_id","status","priority","next_response_due_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_cases_customer_idx" ON "support_cases" ("biz_id","customer_profile_id","opened_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ooda_loop_actions_loop_status_idx" ON "ooda_loop_actions" ("ooda_loop_id","status","started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ooda_loop_actions_requester_idx" ON "ooda_loop_actions" ("requested_by_user_id","started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ooda_loop_entries_loop_phase_idx" ON "ooda_loop_entries" ("ooda_loop_id","phase","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ooda_loop_entries_gap_idx" ON "ooda_loop_entries" ("gap_type","severity");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ooda_loop_links_unique" ON "ooda_loop_links" ("ooda_loop_id","target_type","target_id","relation_role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ooda_loop_links_loop_idx" ON "ooda_loop_links" ("ooda_loop_id","relation_role");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ooda_loops_loop_key_unique" ON "ooda_loops" ("loop_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ooda_loops_biz_status_idx" ON "ooda_loops" ("biz_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ooda_loops_priority_idx" ON "ooda_loops" ("status","priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_run_scheduler_jobs_run_status_due_idx" ON "saga_run_scheduler_jobs" ("saga_run_id","status","due_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_run_scheduler_jobs_run_step_idx" ON "saga_run_scheduler_jobs" ("saga_run_step_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_run_scheduler_jobs_step_key_idx" ON "saga_run_scheduler_jobs" ("saga_run_id","step_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saga_run_simulation_clocks_run_unique" ON "saga_run_simulation_clocks" ("saga_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_run_simulation_clocks_status_idx" ON "saga_run_simulation_clocks" ("status","last_advanced_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_hold_demand_alerts_biz_time_scope_status_window_idx" ON "capacity_hold_demand_alerts" ("biz_id","time_scope_id","status","window_start_at","window_end_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_hold_policies_biz_time_scope_status_idx" ON "capacity_hold_policies" ("biz_id","time_scope_id","status","priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_holds_biz_time_scope_status_window_idx" ON "capacity_holds" ("biz_id","time_scope_id","status","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fulfillment_units_biz_order_line_idx" ON "fulfillment_units" ("biz_id","booking_order_id","booking_order_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bizing_agent_profiles_bizing_id_id_unique" ON "bizing_agent_profiles" ("bizing_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "instrument_runs_biz_id_id_unique" ON "instrument_runs" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_definitions_depth_status_idx" ON "saga_definitions" ("depth","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saga_runs_depth_status_created_idx" ON "saga_runs" ("depth","status","started_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_time_scope_id_time_scopes_id_fk" FOREIGN KEY ("time_scope_id") REFERENCES "time_scopes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_demand_alerts" ADD CONSTRAINT "capacity_hold_demand_alerts_biz_time_scope_fk" FOREIGN KEY ("biz_id","time_scope_id") REFERENCES "time_scopes"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_time_scope_id_time_scopes_id_fk" FOREIGN KEY ("time_scope_id") REFERENCES "time_scopes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_hold_policies" ADD CONSTRAINT "capacity_hold_policies_biz_time_scope_fk" FOREIGN KEY ("biz_id","time_scope_id") REFERENCES "time_scopes"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_holds" ADD CONSTRAINT "capacity_holds_time_scope_id_time_scopes_id_fk" FOREIGN KEY ("time_scope_id") REFERENCES "time_scopes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_holds" ADD CONSTRAINT "capacity_holds_biz_time_scope_fk" FOREIGN KEY ("biz_id","time_scope_id") REFERENCES "time_scopes"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fulfillment_units" ADD CONSTRAINT "fulfillment_units_booking_order_line_id_booking_order_lines_id_fk" FOREIGN KEY ("booking_order_line_id") REFERENCES "booking_order_lines"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fulfillment_units" ADD CONSTRAINT "fulfillment_units_biz_order_line_fk" FOREIGN KEY ("biz_id","booking_order_id","booking_order_line_id") REFERENCES "booking_order_lines"("biz_id","booking_order_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "extension_state_documents" ADD CONSTRAINT "extension_state_documents_last_lifecycle_event_id_domain_events_id_fk" FOREIGN KEY ("last_lifecycle_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "extension_state_documents" ADD CONSTRAINT "extension_state_documents_biz_lifecycle_event_fk" FOREIGN KEY ("biz_id","last_lifecycle_event_id") REFERENCES "domain_events"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lifecycle_event_deliveries" ADD CONSTRAINT "lifecycle_event_deliveries_lifecycle_event_id_domain_events_id_fk" FOREIGN KEY ("lifecycle_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lifecycle_event_deliveries" ADD CONSTRAINT "lifecycle_event_deliveries_biz_event_fk" FOREIGN KEY ("biz_id","lifecycle_event_id") REFERENCES "domain_events"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_lifecycle_event_id_domain_events_id_fk" FOREIGN KEY ("lifecycle_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_biz_lifecycle_event_fk" FOREIGN KEY ("biz_id","lifecycle_event_id") REFERENCES "domain_events"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projection_checkpoints" ADD CONSTRAINT "projection_checkpoints_last_lifecycle_event_id_domain_events_id_fk" FOREIGN KEY ("last_lifecycle_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projection_checkpoints" ADD CONSTRAINT "projection_checkpoints_biz_lifecycle_event_fk" FOREIGN KEY ("biz_id","last_lifecycle_event_id") REFERENCES "domain_events"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_executions" ADD CONSTRAINT "action_executions_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_executions" ADD CONSTRAINT "action_executions_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_executions" ADD CONSTRAINT "action_executions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_executions" ADD CONSTRAINT "action_executions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_executions" ADD CONSTRAINT "action_executions_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_failures" ADD CONSTRAINT "action_failures_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_failures" ADD CONSTRAINT "action_failures_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_failures" ADD CONSTRAINT "action_failures_action_execution_id_action_executions_id_fk" FOREIGN KEY ("action_execution_id") REFERENCES "action_executions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_failures" ADD CONSTRAINT "action_failures_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_failures" ADD CONSTRAINT "action_failures_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_failures" ADD CONSTRAINT "action_failures_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_failures" ADD CONSTRAINT "action_failures_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_idempotency_keys" ADD CONSTRAINT "action_idempotency_keys_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_idempotency_keys" ADD CONSTRAINT "action_idempotency_keys_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_idempotency_keys" ADD CONSTRAINT "action_idempotency_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_idempotency_keys" ADD CONSTRAINT "action_idempotency_keys_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_idempotency_keys" ADD CONSTRAINT "action_idempotency_keys_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_related_entities" ADD CONSTRAINT "action_related_entities_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_related_entities" ADD CONSTRAINT "action_related_entities_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_related_entities" ADD CONSTRAINT "action_related_entities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_related_entities" ADD CONSTRAINT "action_related_entities_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_related_entities" ADD CONSTRAINT "action_related_entities_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_related_entities" ADD CONSTRAINT "action_related_entities_subject_fk" FOREIGN KEY ("biz_id","entity_subject_type","entity_subject_id") REFERENCES "subjects"("biz_id","subject_type","subject_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_requests" ADD CONSTRAINT "action_requests_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_requests" ADD CONSTRAINT "action_requests_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_requests" ADD CONSTRAINT "action_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_requests" ADD CONSTRAINT "action_requests_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_requests" ADD CONSTRAINT "action_requests_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_requests" ADD CONSTRAINT "action_requests_target_subject_fk" FOREIGN KEY ("biz_id","target_subject_type","target_subject_id") REFERENCES "subjects"("biz_id","subject_type","subject_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_action_execution_id_action_executions_id_fk" FOREIGN KEY ("action_execution_id") REFERENCES "action_executions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_action_request_tenant_fk" FOREIGN KEY ("biz_id","action_request_id") REFERENCES "action_requests"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_action_execution_tenant_fk" FOREIGN KEY ("biz_id","action_execution_id") REFERENCES "action_executions"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_subject_fk" FOREIGN KEY ("biz_id","subject_type","subject_id") REFERENCES "subjects"("biz_id","subject_type","subject_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_projection_consumers" ADD CONSTRAINT "event_projection_consumers_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_projection_consumers" ADD CONSTRAINT "event_projection_consumers_last_domain_event_id_domain_events_id_fk" FOREIGN KEY ("last_domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_projection_consumers" ADD CONSTRAINT "event_projection_consumers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_projection_consumers" ADD CONSTRAINT "event_projection_consumers_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_projection_consumers" ADD CONSTRAINT "event_projection_consumers_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_projection_consumers" ADD CONSTRAINT "event_projection_consumers_last_event_tenant_fk" FOREIGN KEY ("biz_id","last_domain_event_id") REFERENCES "domain_events"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_external_subjects" ADD CONSTRAINT "client_external_subjects_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_external_subjects" ADD CONSTRAINT "client_external_subjects_client_installation_id_client_installations_id_fk" FOREIGN KEY ("client_installation_id") REFERENCES "client_installations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_external_subjects" ADD CONSTRAINT "client_external_subjects_customer_profile_id_customer_profiles_id_fk" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_external_subjects" ADD CONSTRAINT "client_external_subjects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_external_subjects" ADD CONSTRAINT "client_external_subjects_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_external_subjects" ADD CONSTRAINT "client_external_subjects_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_installation_credentials" ADD CONSTRAINT "client_installation_credentials_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_installation_credentials" ADD CONSTRAINT "client_installation_credentials_client_installation_id_client_installations_id_fk" FOREIGN KEY ("client_installation_id") REFERENCES "client_installations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_installation_credentials" ADD CONSTRAINT "client_installation_credentials_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_installation_credentials" ADD CONSTRAINT "client_installation_credentials_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_installation_credentials" ADD CONSTRAINT "client_installation_credentials_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_installations" ADD CONSTRAINT "client_installations_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_installations" ADD CONSTRAINT "client_installations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_installations" ADD CONSTRAINT "client_installations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_installations" ADD CONSTRAINT "client_installations_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_identity_handles" ADD CONSTRAINT "customer_identity_handles_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_identity_handles" ADD CONSTRAINT "customer_identity_handles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_identity_handles" ADD CONSTRAINT "customer_identity_handles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_identity_handles" ADD CONSTRAINT "customer_identity_handles_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_identity_links" ADD CONSTRAINT "customer_identity_links_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_identity_links" ADD CONSTRAINT "customer_identity_links_customer_profile_id_customer_profiles_id_fk" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_identity_links" ADD CONSTRAINT "customer_identity_links_customer_identity_handle_id_customer_identity_handles_id_fk" FOREIGN KEY ("customer_identity_handle_id") REFERENCES "customer_identity_handles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_identity_links" ADD CONSTRAINT "customer_identity_links_client_installation_id_client_installations_id_fk" FOREIGN KEY ("client_installation_id") REFERENCES "client_installations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_identity_links" ADD CONSTRAINT "customer_identity_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_identity_links" ADD CONSTRAINT "customer_identity_links_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_identity_links" ADD CONSTRAINT "customer_identity_links_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_merges" ADD CONSTRAINT "customer_profile_merges_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_merges" ADD CONSTRAINT "customer_profile_merges_source_customer_profile_id_customer_profiles_id_fk" FOREIGN KEY ("source_customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_merges" ADD CONSTRAINT "customer_profile_merges_target_customer_profile_id_customer_profiles_id_fk" FOREIGN KEY ("target_customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_merges" ADD CONSTRAINT "customer_profile_merges_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_merges" ADD CONSTRAINT "customer_profile_merges_merge_domain_event_id_domain_events_id_fk" FOREIGN KEY ("merge_domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_merges" ADD CONSTRAINT "customer_profile_merges_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_merges" ADD CONSTRAINT "customer_profile_merges_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_merges" ADD CONSTRAINT "customer_profile_merges_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_merges" ADD CONSTRAINT "customer_profile_merges_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_merges" ADD CONSTRAINT "customer_profile_merges_source_profile_tenant_fk" FOREIGN KEY ("biz_id","source_customer_profile_id") REFERENCES "customer_profiles"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_merges" ADD CONSTRAINT "customer_profile_merges_target_profile_tenant_fk" FOREIGN KEY ("biz_id","target_customer_profile_id") REFERENCES "customer_profiles"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_merges" ADD CONSTRAINT "customer_profile_merges_action_request_tenant_fk" FOREIGN KEY ("biz_id","action_request_id") REFERENCES "action_requests"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_merges" ADD CONSTRAINT "customer_profile_merges_event_tenant_fk" FOREIGN KEY ("biz_id","merge_domain_event_id") REFERENCES "domain_events"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_merges" ADD CONSTRAINT "customer_profile_merges_debug_snapshot_tenant_fk" FOREIGN KEY ("biz_id","debug_snapshot_id") REFERENCES "debug_snapshots"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_claimed_user_id_users_id_fk" FOREIGN KEY ("claimed_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_primary_crm_contact_id_crm_contacts_id_fk" FOREIGN KEY ("primary_crm_contact_id") REFERENCES "crm_contacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_primary_crm_contact_tenant_fk" FOREIGN KEY ("biz_id","primary_crm_contact_id") REFERENCES "crm_contacts"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_verification_challenges" ADD CONSTRAINT "customer_verification_challenges_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_verification_challenges" ADD CONSTRAINT "customer_verification_challenges_customer_profile_id_customer_profiles_id_fk" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_verification_challenges" ADD CONSTRAINT "customer_verification_challenges_handle_id_customer_identity_handles_id_fk" FOREIGN KEY ("handle_id") REFERENCES "customer_identity_handles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_verification_challenges" ADD CONSTRAINT "customer_verification_challenges_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_verification_challenges" ADD CONSTRAINT "customer_verification_challenges_completed_domain_event_id_domain_events_id_fk" FOREIGN KEY ("completed_domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_verification_challenges" ADD CONSTRAINT "customer_verification_challenges_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_verification_challenges" ADD CONSTRAINT "customer_verification_challenges_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_verification_challenges" ADD CONSTRAINT "customer_verification_challenges_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_verification_challenges" ADD CONSTRAINT "customer_verification_challenges_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_verification_challenges" ADD CONSTRAINT "customer_verification_challenges_action_request_tenant_fk" FOREIGN KEY ("biz_id","action_request_id") REFERENCES "action_requests"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_visibility_policies" ADD CONSTRAINT "customer_visibility_policies_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_visibility_policies" ADD CONSTRAINT "customer_visibility_policies_customer_profile_id_customer_profiles_id_fk" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_visibility_policies" ADD CONSTRAINT "customer_visibility_policies_client_installation_id_client_installations_id_fk" FOREIGN KEY ("client_installation_id") REFERENCES "client_installations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_visibility_policies" ADD CONSTRAINT "customer_visibility_policies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_visibility_policies" ADD CONSTRAINT "customer_visibility_policies_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_visibility_policies" ADD CONSTRAINT "customer_visibility_policies_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "schedule_subject_links" ADD CONSTRAINT "schedule_subject_links_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "schedule_subject_links" ADD CONSTRAINT "schedule_subject_links_parent_schedule_subject_id_schedule_subjects_id_fk" FOREIGN KEY ("parent_schedule_subject_id") REFERENCES "schedule_subjects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "schedule_subject_links" ADD CONSTRAINT "schedule_subject_links_child_schedule_subject_id_schedule_subjects_id_fk" FOREIGN KEY ("child_schedule_subject_id") REFERENCES "schedule_subjects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "schedule_subject_links" ADD CONSTRAINT "schedule_subject_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "schedule_subject_links" ADD CONSTRAINT "schedule_subject_links_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "schedule_subject_links" ADD CONSTRAINT "schedule_subject_links_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "schedule_subjects" ADD CONSTRAINT "schedule_subjects_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "schedule_subjects" ADD CONSTRAINT "schedule_subjects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "schedule_subjects" ADD CONSTRAINT "schedule_subjects_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "schedule_subjects" ADD CONSTRAINT "schedule_subjects_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "schedule_subjects" ADD CONSTRAINT "schedule_subjects_subject_fk" FOREIGN KEY ("biz_id","subject_type","subject_id") REFERENCES "subjects"("biz_id","subject_type","subject_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "debug_snapshots" ADD CONSTRAINT "debug_snapshots_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "debug_snapshots" ADD CONSTRAINT "debug_snapshots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "debug_snapshots" ADD CONSTRAINT "debug_snapshots_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "debug_snapshots" ADD CONSTRAINT "debug_snapshots_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projection_documents" ADD CONSTRAINT "projection_documents_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projection_documents" ADD CONSTRAINT "projection_documents_projection_id_projections_id_fk" FOREIGN KEY ("projection_id") REFERENCES "projections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projection_documents" ADD CONSTRAINT "projection_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projection_documents" ADD CONSTRAINT "projection_documents_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projection_documents" ADD CONSTRAINT "projection_documents_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projections" ADD CONSTRAINT "projections_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projections" ADD CONSTRAINT "projections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projections" ADD CONSTRAINT "projections_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projections" ADD CONSTRAINT "projections_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_agent_runs" ADD CONSTRAINT "knowledge_agent_runs_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_agent_runs" ADD CONSTRAINT "knowledge_agent_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_agent_runs" ADD CONSTRAINT "knowledge_agent_runs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_agent_runs" ADD CONSTRAINT "knowledge_agent_runs_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_checkpoints" ADD CONSTRAINT "knowledge_checkpoints_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_checkpoints" ADD CONSTRAINT "knowledge_checkpoints_last_knowledge_event_id_knowledge_events_id_fk" FOREIGN KEY ("last_knowledge_event_id") REFERENCES "knowledge_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_checkpoints" ADD CONSTRAINT "knowledge_checkpoints_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_checkpoints" ADD CONSTRAINT "knowledge_checkpoints_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_checkpoints" ADD CONSTRAINT "knowledge_checkpoints_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_source_id_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "knowledge_sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_knowledge_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_source_id_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "knowledge_sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_edges" ADD CONSTRAINT "knowledge_edges_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_edges" ADD CONSTRAINT "knowledge_edges_from_document_id_knowledge_documents_id_fk" FOREIGN KEY ("from_document_id") REFERENCES "knowledge_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_edges" ADD CONSTRAINT "knowledge_edges_to_document_id_knowledge_documents_id_fk" FOREIGN KEY ("to_document_id") REFERENCES "knowledge_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_edges" ADD CONSTRAINT "knowledge_edges_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_edges" ADD CONSTRAINT "knowledge_edges_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_edges" ADD CONSTRAINT "knowledge_edges_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_source_id_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "knowledge_sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_document_id_knowledge_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_chunk_id_knowledge_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "knowledge_chunks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_events" ADD CONSTRAINT "knowledge_events_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_events" ADD CONSTRAINT "knowledge_events_source_id_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "knowledge_sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_events" ADD CONSTRAINT "knowledge_events_document_id_knowledge_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_events" ADD CONSTRAINT "knowledge_events_chunk_id_knowledge_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "knowledge_chunks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_events" ADD CONSTRAINT "knowledge_events_agent_run_id_knowledge_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "knowledge_agent_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_events" ADD CONSTRAINT "knowledge_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_events" ADD CONSTRAINT "knowledge_events_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_events" ADD CONSTRAINT "knowledge_events_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_retrieval_traces" ADD CONSTRAINT "knowledge_retrieval_traces_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_retrieval_traces" ADD CONSTRAINT "knowledge_retrieval_traces_agent_run_id_knowledge_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "knowledge_agent_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_retrieval_traces" ADD CONSTRAINT "knowledge_retrieval_traces_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_retrieval_traces" ADD CONSTRAINT "knowledge_retrieval_traces_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_retrieval_traces" ADD CONSTRAINT "knowledge_retrieval_traces_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_lot_units" ADD CONSTRAINT "inventory_lot_units_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_lot_units" ADD CONSTRAINT "inventory_lot_units_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_lot_units" ADD CONSTRAINT "inventory_lot_units_inventory_location_id_inventory_locations_id_fk" FOREIGN KEY ("inventory_location_id") REFERENCES "inventory_locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_lot_units" ADD CONSTRAINT "inventory_lot_units_inventory_receipt_item_id_inventory_receipt_items_id_fk" FOREIGN KEY ("inventory_receipt_item_id") REFERENCES "inventory_receipt_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_lot_units" ADD CONSTRAINT "inventory_lot_units_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_lot_units" ADD CONSTRAINT "inventory_lot_units_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_lot_units" ADD CONSTRAINT "inventory_lot_units_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_lot_units" ADD CONSTRAINT "inventory_lot_units_biz_inventory_item_fk" FOREIGN KEY ("biz_id","inventory_item_id") REFERENCES "inventory_items"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_lot_units" ADD CONSTRAINT "inventory_lot_units_biz_location_fk" FOREIGN KEY ("biz_id","inventory_location_id") REFERENCES "inventory_locations"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_lot_units" ADD CONSTRAINT "inventory_lot_units_biz_receipt_item_fk" FOREIGN KEY ("biz_id","inventory_receipt_item_id") REFERENCES "inventory_receipt_items"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_procurement_order_lines" ADD CONSTRAINT "inventory_procurement_order_lines_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_procurement_order_lines" ADD CONSTRAINT "inventory_procurement_order_lines_inventory_procurement_order_id_inventory_procurement_orders_id_fk" FOREIGN KEY ("inventory_procurement_order_id") REFERENCES "inventory_procurement_orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_procurement_order_lines" ADD CONSTRAINT "inventory_procurement_order_lines_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_procurement_order_lines" ADD CONSTRAINT "inventory_procurement_order_lines_supply_partner_catalog_item_id_supply_partner_catalog_items_id_fk" FOREIGN KEY ("supply_partner_catalog_item_id") REFERENCES "supply_partner_catalog_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_procurement_order_lines" ADD CONSTRAINT "inventory_procurement_order_lines_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_procurement_order_lines" ADD CONSTRAINT "inventory_procurement_order_lines_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_procurement_order_lines" ADD CONSTRAINT "inventory_procurement_order_lines_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_procurement_order_lines" ADD CONSTRAINT "inventory_procurement_order_lines_biz_order_fk" FOREIGN KEY ("biz_id","inventory_procurement_order_id") REFERENCES "inventory_procurement_orders"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_procurement_order_lines" ADD CONSTRAINT "inventory_procurement_order_lines_biz_inventory_item_fk" FOREIGN KEY ("biz_id","inventory_item_id") REFERENCES "inventory_items"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_procurement_order_lines" ADD CONSTRAINT "inventory_procurement_order_lines_biz_catalog_item_fk" FOREIGN KEY ("biz_id","supply_partner_catalog_item_id") REFERENCES "supply_partner_catalog_items"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_procurement_order_lines" ADD CONSTRAINT "inventory_procurement_order_lines_biz_target_subject_fk" FOREIGN KEY ("biz_id","target_subject_type","target_subject_id") REFERENCES "subjects"("biz_id","subject_type","subject_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_procurement_orders" ADD CONSTRAINT "inventory_procurement_orders_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_procurement_orders" ADD CONSTRAINT "inventory_procurement_orders_supply_partner_id_supply_partners_id_fk" FOREIGN KEY ("supply_partner_id") REFERENCES "supply_partners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_procurement_orders" ADD CONSTRAINT "inventory_procurement_orders_inventory_replenishment_run_id_inventory_replenishment_runs_id_fk" FOREIGN KEY ("inventory_replenishment_run_id") REFERENCES "inventory_replenishment_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_procurement_orders" ADD CONSTRAINT "inventory_procurement_orders_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_procurement_orders" ADD CONSTRAINT "inventory_procurement_orders_latest_domain_event_id_domain_events_id_fk" FOREIGN KEY ("latest_domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_procurement_orders" ADD CONSTRAINT "inventory_procurement_orders_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_procurement_orders" ADD CONSTRAINT "inventory_procurement_orders_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_procurement_orders" ADD CONSTRAINT "inventory_procurement_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_procurement_orders" ADD CONSTRAINT "inventory_procurement_orders_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_procurement_orders" ADD CONSTRAINT "inventory_procurement_orders_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_procurement_orders" ADD CONSTRAINT "inventory_procurement_orders_biz_partner_fk" FOREIGN KEY ("biz_id","supply_partner_id") REFERENCES "supply_partners"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_procurement_orders" ADD CONSTRAINT "inventory_procurement_orders_biz_replenishment_run_fk" FOREIGN KEY ("biz_id","inventory_replenishment_run_id") REFERENCES "inventory_replenishment_runs"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_batches" ADD CONSTRAINT "inventory_receipt_batches_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_batches" ADD CONSTRAINT "inventory_receipt_batches_inventory_procurement_order_id_inventory_procurement_orders_id_fk" FOREIGN KEY ("inventory_procurement_order_id") REFERENCES "inventory_procurement_orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_batches" ADD CONSTRAINT "inventory_receipt_batches_supply_partner_id_supply_partners_id_fk" FOREIGN KEY ("supply_partner_id") REFERENCES "supply_partners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_batches" ADD CONSTRAINT "inventory_receipt_batches_inventory_location_id_inventory_locations_id_fk" FOREIGN KEY ("inventory_location_id") REFERENCES "inventory_locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_batches" ADD CONSTRAINT "inventory_receipt_batches_received_by_user_id_users_id_fk" FOREIGN KEY ("received_by_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_batches" ADD CONSTRAINT "inventory_receipt_batches_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_batches" ADD CONSTRAINT "inventory_receipt_batches_latest_domain_event_id_domain_events_id_fk" FOREIGN KEY ("latest_domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_batches" ADD CONSTRAINT "inventory_receipt_batches_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_batches" ADD CONSTRAINT "inventory_receipt_batches_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_batches" ADD CONSTRAINT "inventory_receipt_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_batches" ADD CONSTRAINT "inventory_receipt_batches_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_batches" ADD CONSTRAINT "inventory_receipt_batches_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_batches" ADD CONSTRAINT "inventory_receipt_batches_biz_action_request_fk" FOREIGN KEY ("biz_id","action_request_id") REFERENCES "action_requests"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_batches" ADD CONSTRAINT "inventory_receipt_batches_biz_order_fk" FOREIGN KEY ("biz_id","inventory_procurement_order_id") REFERENCES "inventory_procurement_orders"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_batches" ADD CONSTRAINT "inventory_receipt_batches_biz_partner_fk" FOREIGN KEY ("biz_id","supply_partner_id") REFERENCES "supply_partners"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_batches" ADD CONSTRAINT "inventory_receipt_batches_biz_location_fk" FOREIGN KEY ("biz_id","inventory_location_id") REFERENCES "inventory_locations"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_items" ADD CONSTRAINT "inventory_receipt_items_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_items" ADD CONSTRAINT "inventory_receipt_items_inventory_receipt_batch_id_inventory_receipt_batches_id_fk" FOREIGN KEY ("inventory_receipt_batch_id") REFERENCES "inventory_receipt_batches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_items" ADD CONSTRAINT "inventory_receipt_items_inventory_procurement_order_line_id_inventory_procurement_order_lines_id_fk" FOREIGN KEY ("inventory_procurement_order_line_id") REFERENCES "inventory_procurement_order_lines"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_items" ADD CONSTRAINT "inventory_receipt_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_items" ADD CONSTRAINT "inventory_receipt_items_inventory_movement_id_inventory_movements_id_fk" FOREIGN KEY ("inventory_movement_id") REFERENCES "inventory_movements"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_items" ADD CONSTRAINT "inventory_receipt_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_items" ADD CONSTRAINT "inventory_receipt_items_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_items" ADD CONSTRAINT "inventory_receipt_items_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_items" ADD CONSTRAINT "inventory_receipt_items_biz_batch_fk" FOREIGN KEY ("biz_id","inventory_receipt_batch_id") REFERENCES "inventory_receipt_batches"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_items" ADD CONSTRAINT "inventory_receipt_items_biz_order_line_fk" FOREIGN KEY ("biz_id","inventory_procurement_order_line_id") REFERENCES "inventory_procurement_order_lines"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_items" ADD CONSTRAINT "inventory_receipt_items_biz_inventory_item_fk" FOREIGN KEY ("biz_id","inventory_item_id") REFERENCES "inventory_items"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_receipt_items" ADD CONSTRAINT "inventory_receipt_items_biz_inventory_movement_fk" FOREIGN KEY ("biz_id","inventory_movement_id") REFERENCES "inventory_movements"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_policies" ADD CONSTRAINT "inventory_replenishment_policies_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_policies" ADD CONSTRAINT "inventory_replenishment_policies_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_policies" ADD CONSTRAINT "inventory_replenishment_policies_preferred_supply_partner_id_supply_partners_id_fk" FOREIGN KEY ("preferred_supply_partner_id") REFERENCES "supply_partners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_policies" ADD CONSTRAINT "inventory_replenishment_policies_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_policies" ADD CONSTRAINT "inventory_replenishment_policies_latest_domain_event_id_domain_events_id_fk" FOREIGN KEY ("latest_domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_policies" ADD CONSTRAINT "inventory_replenishment_policies_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_policies" ADD CONSTRAINT "inventory_replenishment_policies_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_policies" ADD CONSTRAINT "inventory_replenishment_policies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_policies" ADD CONSTRAINT "inventory_replenishment_policies_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_policies" ADD CONSTRAINT "inventory_replenishment_policies_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_policies" ADD CONSTRAINT "inventory_replenishment_policies_biz_inventory_item_fk" FOREIGN KEY ("biz_id","inventory_item_id") REFERENCES "inventory_items"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_policies" ADD CONSTRAINT "inventory_replenishment_policies_biz_preferred_partner_fk" FOREIGN KEY ("biz_id","preferred_supply_partner_id") REFERENCES "supply_partners"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_runs" ADD CONSTRAINT "inventory_replenishment_runs_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_runs" ADD CONSTRAINT "inventory_replenishment_runs_triggered_by_user_id_users_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_runs" ADD CONSTRAINT "inventory_replenishment_runs_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_runs" ADD CONSTRAINT "inventory_replenishment_runs_latest_domain_event_id_domain_events_id_fk" FOREIGN KEY ("latest_domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_runs" ADD CONSTRAINT "inventory_replenishment_runs_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_runs" ADD CONSTRAINT "inventory_replenishment_runs_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_runs" ADD CONSTRAINT "inventory_replenishment_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_runs" ADD CONSTRAINT "inventory_replenishment_runs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_runs" ADD CONSTRAINT "inventory_replenishment_runs_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_runs" ADD CONSTRAINT "inventory_replenishment_runs_biz_action_request_fk" FOREIGN KEY ("biz_id","action_request_id") REFERENCES "action_requests"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_suggestions" ADD CONSTRAINT "inventory_replenishment_suggestions_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_suggestions" ADD CONSTRAINT "inventory_replenishment_suggestions_inventory_replenishment_run_id_inventory_replenishment_runs_id_fk" FOREIGN KEY ("inventory_replenishment_run_id") REFERENCES "inventory_replenishment_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_suggestions" ADD CONSTRAINT "inventory_replenishment_suggestions_inventory_replenishment_policy_id_inventory_replenishment_policies_id_fk" FOREIGN KEY ("inventory_replenishment_policy_id") REFERENCES "inventory_replenishment_policies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_suggestions" ADD CONSTRAINT "inventory_replenishment_suggestions_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_suggestions" ADD CONSTRAINT "inventory_replenishment_suggestions_supply_partner_id_supply_partners_id_fk" FOREIGN KEY ("supply_partner_id") REFERENCES "supply_partners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_suggestions" ADD CONSTRAINT "inventory_replenishment_suggestions_inventory_procurement_order_id_inventory_procurement_orders_id_fk" FOREIGN KEY ("inventory_procurement_order_id") REFERENCES "inventory_procurement_orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_suggestions" ADD CONSTRAINT "inventory_replenishment_suggestions_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_suggestions" ADD CONSTRAINT "inventory_replenishment_suggestions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_suggestions" ADD CONSTRAINT "inventory_replenishment_suggestions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_suggestions" ADD CONSTRAINT "inventory_replenishment_suggestions_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_suggestions" ADD CONSTRAINT "inventory_replenishment_suggestions_biz_run_fk" FOREIGN KEY ("biz_id","inventory_replenishment_run_id") REFERENCES "inventory_replenishment_runs"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_suggestions" ADD CONSTRAINT "inventory_replenishment_suggestions_biz_policy_fk" FOREIGN KEY ("biz_id","inventory_replenishment_policy_id") REFERENCES "inventory_replenishment_policies"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_suggestions" ADD CONSTRAINT "inventory_replenishment_suggestions_biz_item_fk" FOREIGN KEY ("biz_id","inventory_item_id") REFERENCES "inventory_items"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_suggestions" ADD CONSTRAINT "inventory_replenishment_suggestions_biz_partner_fk" FOREIGN KEY ("biz_id","supply_partner_id") REFERENCES "supply_partners"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_replenishment_suggestions" ADD CONSTRAINT "inventory_replenishment_suggestions_biz_order_fk" FOREIGN KEY ("biz_id","inventory_procurement_order_id") REFERENCES "inventory_procurement_orders"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supply_partner_catalog_items" ADD CONSTRAINT "supply_partner_catalog_items_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supply_partner_catalog_items" ADD CONSTRAINT "supply_partner_catalog_items_supply_partner_id_supply_partners_id_fk" FOREIGN KEY ("supply_partner_id") REFERENCES "supply_partners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supply_partner_catalog_items" ADD CONSTRAINT "supply_partner_catalog_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supply_partner_catalog_items" ADD CONSTRAINT "supply_partner_catalog_items_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supply_partner_catalog_items" ADD CONSTRAINT "supply_partner_catalog_items_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supply_partner_catalog_items" ADD CONSTRAINT "supply_partner_catalog_items_biz_partner_fk" FOREIGN KEY ("biz_id","supply_partner_id") REFERENCES "supply_partners"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supply_partner_catalog_items" ADD CONSTRAINT "supply_partner_catalog_items_biz_target_subject_fk" FOREIGN KEY ("biz_id","target_subject_type","target_subject_id") REFERENCES "subjects"("biz_id","subject_type","subject_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supply_partners" ADD CONSTRAINT "supply_partners_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supply_partners" ADD CONSTRAINT "supply_partners_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supply_partners" ADD CONSTRAINT "supply_partners_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supply_partners" ADD CONSTRAINT "supply_partners_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_ledger_entries" ADD CONSTRAINT "value_ledger_entries_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_ledger_entries" ADD CONSTRAINT "value_ledger_entries_value_program_id_value_programs_id_fk" FOREIGN KEY ("value_program_id") REFERENCES "value_programs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_ledger_entries" ADD CONSTRAINT "value_ledger_entries_value_account_id_value_program_accounts_id_fk" FOREIGN KEY ("value_account_id") REFERENCES "value_program_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_ledger_entries" ADD CONSTRAINT "value_ledger_entries_value_transfer_id_value_transfers_id_fk" FOREIGN KEY ("value_transfer_id") REFERENCES "value_transfers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_ledger_entries" ADD CONSTRAINT "value_ledger_entries_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_ledger_entries" ADD CONSTRAINT "value_ledger_entries_latest_domain_event_id_domain_events_id_fk" FOREIGN KEY ("latest_domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_ledger_entries" ADD CONSTRAINT "value_ledger_entries_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_ledger_entries" ADD CONSTRAINT "value_ledger_entries_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_ledger_entries" ADD CONSTRAINT "value_ledger_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_ledger_entries" ADD CONSTRAINT "value_ledger_entries_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_ledger_entries" ADD CONSTRAINT "value_ledger_entries_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_ledger_entries" ADD CONSTRAINT "value_ledger_entries_biz_program_fk" FOREIGN KEY ("biz_id","value_program_id") REFERENCES "value_programs"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_ledger_entries" ADD CONSTRAINT "value_ledger_entries_biz_account_fk" FOREIGN KEY ("biz_id","value_account_id") REFERENCES "value_program_accounts"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_ledger_entries" ADD CONSTRAINT "value_ledger_entries_biz_transfer_fk" FOREIGN KEY ("biz_id","value_transfer_id") REFERENCES "value_transfers"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_ledger_entries" ADD CONSTRAINT "value_ledger_entries_biz_source_subject_fk" FOREIGN KEY ("biz_id","source_subject_type","source_subject_id") REFERENCES "subjects"("biz_id","subject_type","subject_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_ledger_entries" ADD CONSTRAINT "value_ledger_entries_biz_reversal_fk" FOREIGN KEY ("biz_id","reverses_ledger_entry_id") REFERENCES "value_ledger_entries"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_program_accounts" ADD CONSTRAINT "value_program_accounts_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_program_accounts" ADD CONSTRAINT "value_program_accounts_value_program_id_value_programs_id_fk" FOREIGN KEY ("value_program_id") REFERENCES "value_programs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_program_accounts" ADD CONSTRAINT "value_program_accounts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_program_accounts" ADD CONSTRAINT "value_program_accounts_owner_group_account_id_group_accounts_id_fk" FOREIGN KEY ("owner_group_account_id") REFERENCES "group_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_program_accounts" ADD CONSTRAINT "value_program_accounts_current_tier_id_value_program_tiers_id_fk" FOREIGN KEY ("current_tier_id") REFERENCES "value_program_tiers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_program_accounts" ADD CONSTRAINT "value_program_accounts_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_program_accounts" ADD CONSTRAINT "value_program_accounts_latest_domain_event_id_domain_events_id_fk" FOREIGN KEY ("latest_domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_program_accounts" ADD CONSTRAINT "value_program_accounts_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_program_accounts" ADD CONSTRAINT "value_program_accounts_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_program_accounts" ADD CONSTRAINT "value_program_accounts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_program_accounts" ADD CONSTRAINT "value_program_accounts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_program_accounts" ADD CONSTRAINT "value_program_accounts_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_program_accounts" ADD CONSTRAINT "value_program_accounts_biz_action_request_fk" FOREIGN KEY ("biz_id","action_request_id") REFERENCES "action_requests"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_program_accounts" ADD CONSTRAINT "value_program_accounts_biz_program_fk" FOREIGN KEY ("biz_id","value_program_id") REFERENCES "value_programs"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_program_accounts" ADD CONSTRAINT "value_program_accounts_biz_tier_fk" FOREIGN KEY ("biz_id","current_tier_id") REFERENCES "value_program_tiers"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_program_accounts" ADD CONSTRAINT "value_program_accounts_biz_group_account_fk" FOREIGN KEY ("biz_id","owner_group_account_id") REFERENCES "group_accounts"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_program_accounts" ADD CONSTRAINT "value_program_accounts_biz_owner_subject_fk" FOREIGN KEY ("biz_id","owner_subject_type","owner_subject_id") REFERENCES "subjects"("biz_id","subject_type","subject_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_program_tiers" ADD CONSTRAINT "value_program_tiers_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_program_tiers" ADD CONSTRAINT "value_program_tiers_value_program_id_value_programs_id_fk" FOREIGN KEY ("value_program_id") REFERENCES "value_programs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_program_tiers" ADD CONSTRAINT "value_program_tiers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_program_tiers" ADD CONSTRAINT "value_program_tiers_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_program_tiers" ADD CONSTRAINT "value_program_tiers_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_program_tiers" ADD CONSTRAINT "value_program_tiers_biz_program_fk" FOREIGN KEY ("biz_id","value_program_id") REFERENCES "value_programs"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_programs" ADD CONSTRAINT "value_programs_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_programs" ADD CONSTRAINT "value_programs_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_programs" ADD CONSTRAINT "value_programs_latest_domain_event_id_domain_events_id_fk" FOREIGN KEY ("latest_domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_programs" ADD CONSTRAINT "value_programs_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_programs" ADD CONSTRAINT "value_programs_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_programs" ADD CONSTRAINT "value_programs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_programs" ADD CONSTRAINT "value_programs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_programs" ADD CONSTRAINT "value_programs_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_programs" ADD CONSTRAINT "value_programs_biz_action_request_fk" FOREIGN KEY ("biz_id","action_request_id") REFERENCES "action_requests"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rule_evaluations" ADD CONSTRAINT "value_rule_evaluations_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rule_evaluations" ADD CONSTRAINT "value_rule_evaluations_value_program_id_value_programs_id_fk" FOREIGN KEY ("value_program_id") REFERENCES "value_programs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rule_evaluations" ADD CONSTRAINT "value_rule_evaluations_value_rule_id_value_rules_id_fk" FOREIGN KEY ("value_rule_id") REFERENCES "value_rules"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rule_evaluations" ADD CONSTRAINT "value_rule_evaluations_value_account_id_value_program_accounts_id_fk" FOREIGN KEY ("value_account_id") REFERENCES "value_program_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rule_evaluations" ADD CONSTRAINT "value_rule_evaluations_value_ledger_entry_id_value_ledger_entries_id_fk" FOREIGN KEY ("value_ledger_entry_id") REFERENCES "value_ledger_entries"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rule_evaluations" ADD CONSTRAINT "value_rule_evaluations_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rule_evaluations" ADD CONSTRAINT "value_rule_evaluations_latest_domain_event_id_domain_events_id_fk" FOREIGN KEY ("latest_domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rule_evaluations" ADD CONSTRAINT "value_rule_evaluations_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rule_evaluations" ADD CONSTRAINT "value_rule_evaluations_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rule_evaluations" ADD CONSTRAINT "value_rule_evaluations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rule_evaluations" ADD CONSTRAINT "value_rule_evaluations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rule_evaluations" ADD CONSTRAINT "value_rule_evaluations_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rule_evaluations" ADD CONSTRAINT "value_rule_evaluations_biz_program_fk" FOREIGN KEY ("biz_id","value_program_id") REFERENCES "value_programs"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rule_evaluations" ADD CONSTRAINT "value_rule_evaluations_biz_rule_fk" FOREIGN KEY ("biz_id","value_rule_id") REFERENCES "value_rules"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rule_evaluations" ADD CONSTRAINT "value_rule_evaluations_biz_account_fk" FOREIGN KEY ("biz_id","value_account_id") REFERENCES "value_program_accounts"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rule_evaluations" ADD CONSTRAINT "value_rule_evaluations_biz_ledger_entry_fk" FOREIGN KEY ("biz_id","value_ledger_entry_id") REFERENCES "value_ledger_entries"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rule_evaluations" ADD CONSTRAINT "value_rule_evaluations_biz_source_subject_fk" FOREIGN KEY ("biz_id","source_subject_type","source_subject_id") REFERENCES "subjects"("biz_id","subject_type","subject_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rules" ADD CONSTRAINT "value_rules_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rules" ADD CONSTRAINT "value_rules_value_program_id_value_programs_id_fk" FOREIGN KEY ("value_program_id") REFERENCES "value_programs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rules" ADD CONSTRAINT "value_rules_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rules" ADD CONSTRAINT "value_rules_latest_domain_event_id_domain_events_id_fk" FOREIGN KEY ("latest_domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rules" ADD CONSTRAINT "value_rules_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rules" ADD CONSTRAINT "value_rules_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rules" ADD CONSTRAINT "value_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rules" ADD CONSTRAINT "value_rules_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rules" ADD CONSTRAINT "value_rules_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rules" ADD CONSTRAINT "value_rules_biz_action_request_fk" FOREIGN KEY ("biz_id","action_request_id") REFERENCES "action_requests"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_rules" ADD CONSTRAINT "value_rules_biz_program_fk" FOREIGN KEY ("biz_id","value_program_id") REFERENCES "value_programs"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_transfers" ADD CONSTRAINT "value_transfers_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_transfers" ADD CONSTRAINT "value_transfers_value_program_id_value_programs_id_fk" FOREIGN KEY ("value_program_id") REFERENCES "value_programs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_transfers" ADD CONSTRAINT "value_transfers_source_value_account_id_value_program_accounts_id_fk" FOREIGN KEY ("source_value_account_id") REFERENCES "value_program_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_transfers" ADD CONSTRAINT "value_transfers_target_value_account_id_value_program_accounts_id_fk" FOREIGN KEY ("target_value_account_id") REFERENCES "value_program_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_transfers" ADD CONSTRAINT "value_transfers_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_transfers" ADD CONSTRAINT "value_transfers_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_transfers" ADD CONSTRAINT "value_transfers_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_transfers" ADD CONSTRAINT "value_transfers_latest_domain_event_id_domain_events_id_fk" FOREIGN KEY ("latest_domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_transfers" ADD CONSTRAINT "value_transfers_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_transfers" ADD CONSTRAINT "value_transfers_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_transfers" ADD CONSTRAINT "value_transfers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_transfers" ADD CONSTRAINT "value_transfers_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_transfers" ADD CONSTRAINT "value_transfers_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_transfers" ADD CONSTRAINT "value_transfers_biz_action_request_fk" FOREIGN KEY ("biz_id","action_request_id") REFERENCES "action_requests"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_transfers" ADD CONSTRAINT "value_transfers_biz_program_fk" FOREIGN KEY ("biz_id","value_program_id") REFERENCES "value_programs"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_transfers" ADD CONSTRAINT "value_transfers_biz_source_account_fk" FOREIGN KEY ("biz_id","source_value_account_id") REFERENCES "value_program_accounts"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_transfers" ADD CONSTRAINT "value_transfers_biz_target_account_fk" FOREIGN KEY ("biz_id","target_value_account_id") REFERENCES "value_program_accounts"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_applications" ADD CONSTRAINT "workforce_applications_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_applications" ADD CONSTRAINT "workforce_applications_workforce_requisition_id_workforce_requisitions_id_fk" FOREIGN KEY ("workforce_requisition_id") REFERENCES "workforce_requisitions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_applications" ADD CONSTRAINT "workforce_applications_workforce_candidate_id_workforce_candidates_id_fk" FOREIGN KEY ("workforce_candidate_id") REFERENCES "workforce_candidates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_applications" ADD CONSTRAINT "workforce_applications_assigned_recruiter_user_id_users_id_fk" FOREIGN KEY ("assigned_recruiter_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_applications" ADD CONSTRAINT "workforce_applications_decision_by_user_id_users_id_fk" FOREIGN KEY ("decision_by_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_applications" ADD CONSTRAINT "workforce_applications_hired_workforce_assignment_id_workforce_assignments_id_fk" FOREIGN KEY ("hired_workforce_assignment_id") REFERENCES "workforce_assignments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_applications" ADD CONSTRAINT "workforce_applications_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_applications" ADD CONSTRAINT "workforce_applications_latest_domain_event_id_domain_events_id_fk" FOREIGN KEY ("latest_domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_applications" ADD CONSTRAINT "workforce_applications_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_applications" ADD CONSTRAINT "workforce_applications_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_applications" ADD CONSTRAINT "workforce_applications_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_applications" ADD CONSTRAINT "workforce_applications_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_applications" ADD CONSTRAINT "workforce_applications_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_applications" ADD CONSTRAINT "workforce_applications_biz_requisition_fk" FOREIGN KEY ("biz_id","workforce_requisition_id") REFERENCES "workforce_requisitions"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_applications" ADD CONSTRAINT "workforce_applications_biz_candidate_fk" FOREIGN KEY ("biz_id","workforce_candidate_id") REFERENCES "workforce_candidates"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_applications" ADD CONSTRAINT "workforce_applications_biz_hired_assignment_fk" FOREIGN KEY ("biz_id","hired_workforce_assignment_id") REFERENCES "workforce_assignments"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_assignments" ADD CONSTRAINT "workforce_assignments_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_assignments" ADD CONSTRAINT "workforce_assignments_workforce_position_id_workforce_positions_id_fk" FOREIGN KEY ("workforce_position_id") REFERENCES "workforce_positions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_assignments" ADD CONSTRAINT "workforce_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_assignments" ADD CONSTRAINT "workforce_assignments_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_assignments" ADD CONSTRAINT "workforce_assignments_compensation_plan_id_compensation_plans_id_fk" FOREIGN KEY ("compensation_plan_id") REFERENCES "compensation_plans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_assignments" ADD CONSTRAINT "workforce_assignments_leave_policy_id_leave_policies_id_fk" FOREIGN KEY ("leave_policy_id") REFERENCES "leave_policies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_assignments" ADD CONSTRAINT "workforce_assignments_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_assignments" ADD CONSTRAINT "workforce_assignments_latest_domain_event_id_domain_events_id_fk" FOREIGN KEY ("latest_domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_assignments" ADD CONSTRAINT "workforce_assignments_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_assignments" ADD CONSTRAINT "workforce_assignments_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_assignments" ADD CONSTRAINT "workforce_assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_assignments" ADD CONSTRAINT "workforce_assignments_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_assignments" ADD CONSTRAINT "workforce_assignments_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_assignments" ADD CONSTRAINT "workforce_assignments_biz_action_request_fk" FOREIGN KEY ("biz_id","action_request_id") REFERENCES "action_requests"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_assignments" ADD CONSTRAINT "workforce_assignments_biz_position_fk" FOREIGN KEY ("biz_id","workforce_position_id") REFERENCES "workforce_positions"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_assignments" ADD CONSTRAINT "workforce_assignments_biz_resource_fk" FOREIGN KEY ("biz_id","resource_id") REFERENCES "resources"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_assignments" ADD CONSTRAINT "workforce_assignments_biz_manager_fk" FOREIGN KEY ("biz_id","manager_workforce_assignment_id") REFERENCES "workforce_assignments"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_assignments" ADD CONSTRAINT "workforce_assignments_biz_compensation_plan_fk" FOREIGN KEY ("biz_id","compensation_plan_id") REFERENCES "compensation_plans"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_assignments" ADD CONSTRAINT "workforce_assignments_biz_leave_policy_fk" FOREIGN KEY ("biz_id","leave_policy_id") REFERENCES "leave_policies"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_benefit_enrollments" ADD CONSTRAINT "workforce_benefit_enrollments_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_benefit_enrollments" ADD CONSTRAINT "workforce_benefit_enrollments_workforce_benefit_plan_id_workforce_benefit_plans_id_fk" FOREIGN KEY ("workforce_benefit_plan_id") REFERENCES "workforce_benefit_plans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_benefit_enrollments" ADD CONSTRAINT "workforce_benefit_enrollments_workforce_assignment_id_workforce_assignments_id_fk" FOREIGN KEY ("workforce_assignment_id") REFERENCES "workforce_assignments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_benefit_enrollments" ADD CONSTRAINT "workforce_benefit_enrollments_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_benefit_enrollments" ADD CONSTRAINT "workforce_benefit_enrollments_latest_domain_event_id_domain_events_id_fk" FOREIGN KEY ("latest_domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_benefit_enrollments" ADD CONSTRAINT "workforce_benefit_enrollments_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_benefit_enrollments" ADD CONSTRAINT "workforce_benefit_enrollments_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_benefit_enrollments" ADD CONSTRAINT "workforce_benefit_enrollments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_benefit_enrollments" ADD CONSTRAINT "workforce_benefit_enrollments_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_benefit_enrollments" ADD CONSTRAINT "workforce_benefit_enrollments_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_benefit_enrollments" ADD CONSTRAINT "workforce_benefit_enrollments_biz_action_request_fk" FOREIGN KEY ("biz_id","action_request_id") REFERENCES "action_requests"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_benefit_enrollments" ADD CONSTRAINT "workforce_benefit_enrollments_biz_plan_fk" FOREIGN KEY ("biz_id","workforce_benefit_plan_id") REFERENCES "workforce_benefit_plans"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_benefit_enrollments" ADD CONSTRAINT "workforce_benefit_enrollments_biz_assignment_fk" FOREIGN KEY ("biz_id","workforce_assignment_id") REFERENCES "workforce_assignments"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_benefit_plans" ADD CONSTRAINT "workforce_benefit_plans_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_benefit_plans" ADD CONSTRAINT "workforce_benefit_plans_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_benefit_plans" ADD CONSTRAINT "workforce_benefit_plans_latest_domain_event_id_domain_events_id_fk" FOREIGN KEY ("latest_domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_benefit_plans" ADD CONSTRAINT "workforce_benefit_plans_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_benefit_plans" ADD CONSTRAINT "workforce_benefit_plans_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_benefit_plans" ADD CONSTRAINT "workforce_benefit_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_benefit_plans" ADD CONSTRAINT "workforce_benefit_plans_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_benefit_plans" ADD CONSTRAINT "workforce_benefit_plans_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_benefit_plans" ADD CONSTRAINT "workforce_benefit_plans_biz_action_request_fk" FOREIGN KEY ("biz_id","action_request_id") REFERENCES "action_requests"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_candidate_events" ADD CONSTRAINT "workforce_candidate_events_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_candidate_events" ADD CONSTRAINT "workforce_candidate_events_workforce_candidate_id_workforce_candidates_id_fk" FOREIGN KEY ("workforce_candidate_id") REFERENCES "workforce_candidates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_candidate_events" ADD CONSTRAINT "workforce_candidate_events_workforce_requisition_id_workforce_requisitions_id_fk" FOREIGN KEY ("workforce_requisition_id") REFERENCES "workforce_requisitions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_candidate_events" ADD CONSTRAINT "workforce_candidate_events_workforce_application_id_workforce_applications_id_fk" FOREIGN KEY ("workforce_application_id") REFERENCES "workforce_applications"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_candidate_events" ADD CONSTRAINT "workforce_candidate_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_candidate_events" ADD CONSTRAINT "workforce_candidate_events_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_candidate_events" ADD CONSTRAINT "workforce_candidate_events_latest_domain_event_id_domain_events_id_fk" FOREIGN KEY ("latest_domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_candidate_events" ADD CONSTRAINT "workforce_candidate_events_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_candidate_events" ADD CONSTRAINT "workforce_candidate_events_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_candidate_events" ADD CONSTRAINT "workforce_candidate_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_candidate_events" ADD CONSTRAINT "workforce_candidate_events_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_candidate_events" ADD CONSTRAINT "workforce_candidate_events_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_candidate_events" ADD CONSTRAINT "workforce_candidate_events_biz_action_request_fk" FOREIGN KEY ("biz_id","action_request_id") REFERENCES "action_requests"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_candidate_events" ADD CONSTRAINT "workforce_candidate_events_biz_candidate_fk" FOREIGN KEY ("biz_id","workforce_candidate_id") REFERENCES "workforce_candidates"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_candidate_events" ADD CONSTRAINT "workforce_candidate_events_biz_requisition_fk" FOREIGN KEY ("biz_id","workforce_requisition_id") REFERENCES "workforce_requisitions"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_candidate_events" ADD CONSTRAINT "workforce_candidate_events_biz_application_fk" FOREIGN KEY ("biz_id","workforce_application_id") REFERENCES "workforce_applications"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_candidates" ADD CONSTRAINT "workforce_candidates_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_candidates" ADD CONSTRAINT "workforce_candidates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_candidates" ADD CONSTRAINT "workforce_candidates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_candidates" ADD CONSTRAINT "workforce_candidates_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_departments" ADD CONSTRAINT "workforce_departments_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_departments" ADD CONSTRAINT "workforce_departments_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_departments" ADD CONSTRAINT "workforce_departments_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_departments" ADD CONSTRAINT "workforce_departments_latest_domain_event_id_domain_events_id_fk" FOREIGN KEY ("latest_domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_departments" ADD CONSTRAINT "workforce_departments_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_departments" ADD CONSTRAINT "workforce_departments_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_departments" ADD CONSTRAINT "workforce_departments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_departments" ADD CONSTRAINT "workforce_departments_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_departments" ADD CONSTRAINT "workforce_departments_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_departments" ADD CONSTRAINT "workforce_departments_biz_action_request_fk" FOREIGN KEY ("biz_id","action_request_id") REFERENCES "action_requests"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_departments" ADD CONSTRAINT "workforce_departments_biz_parent_fk" FOREIGN KEY ("biz_id","parent_workforce_department_id") REFERENCES "workforce_departments"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_performance_cycles" ADD CONSTRAINT "workforce_performance_cycles_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_performance_cycles" ADD CONSTRAINT "workforce_performance_cycles_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_performance_cycles" ADD CONSTRAINT "workforce_performance_cycles_latest_domain_event_id_domain_events_id_fk" FOREIGN KEY ("latest_domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_performance_cycles" ADD CONSTRAINT "workforce_performance_cycles_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_performance_cycles" ADD CONSTRAINT "workforce_performance_cycles_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_performance_cycles" ADD CONSTRAINT "workforce_performance_cycles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_performance_cycles" ADD CONSTRAINT "workforce_performance_cycles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_performance_cycles" ADD CONSTRAINT "workforce_performance_cycles_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_performance_cycles" ADD CONSTRAINT "workforce_performance_cycles_biz_action_request_fk" FOREIGN KEY ("biz_id","action_request_id") REFERENCES "action_requests"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_performance_reviews" ADD CONSTRAINT "workforce_performance_reviews_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_performance_reviews" ADD CONSTRAINT "workforce_performance_reviews_workforce_performance_cycle_id_workforce_performance_cycles_id_fk" FOREIGN KEY ("workforce_performance_cycle_id") REFERENCES "workforce_performance_cycles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_performance_reviews" ADD CONSTRAINT "workforce_performance_reviews_workforce_assignment_id_workforce_assignments_id_fk" FOREIGN KEY ("workforce_assignment_id") REFERENCES "workforce_assignments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_performance_reviews" ADD CONSTRAINT "workforce_performance_reviews_reviewer_workforce_assignment_id_workforce_assignments_id_fk" FOREIGN KEY ("reviewer_workforce_assignment_id") REFERENCES "workforce_assignments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_performance_reviews" ADD CONSTRAINT "workforce_performance_reviews_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_performance_reviews" ADD CONSTRAINT "workforce_performance_reviews_latest_domain_event_id_domain_events_id_fk" FOREIGN KEY ("latest_domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_performance_reviews" ADD CONSTRAINT "workforce_performance_reviews_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_performance_reviews" ADD CONSTRAINT "workforce_performance_reviews_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_performance_reviews" ADD CONSTRAINT "workforce_performance_reviews_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_performance_reviews" ADD CONSTRAINT "workforce_performance_reviews_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_performance_reviews" ADD CONSTRAINT "workforce_performance_reviews_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_performance_reviews" ADD CONSTRAINT "workforce_performance_reviews_biz_cycle_fk" FOREIGN KEY ("biz_id","workforce_performance_cycle_id") REFERENCES "workforce_performance_cycles"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_performance_reviews" ADD CONSTRAINT "workforce_performance_reviews_biz_assignment_fk" FOREIGN KEY ("biz_id","workforce_assignment_id") REFERENCES "workforce_assignments"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_performance_reviews" ADD CONSTRAINT "workforce_performance_reviews_biz_reviewer_assignment_fk" FOREIGN KEY ("biz_id","reviewer_workforce_assignment_id") REFERENCES "workforce_assignments"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_positions" ADD CONSTRAINT "workforce_positions_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_positions" ADD CONSTRAINT "workforce_positions_workforce_department_id_workforce_departments_id_fk" FOREIGN KEY ("workforce_department_id") REFERENCES "workforce_departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_positions" ADD CONSTRAINT "workforce_positions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_positions" ADD CONSTRAINT "workforce_positions_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_positions" ADD CONSTRAINT "workforce_positions_latest_domain_event_id_domain_events_id_fk" FOREIGN KEY ("latest_domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_positions" ADD CONSTRAINT "workforce_positions_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_positions" ADD CONSTRAINT "workforce_positions_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_positions" ADD CONSTRAINT "workforce_positions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_positions" ADD CONSTRAINT "workforce_positions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_positions" ADD CONSTRAINT "workforce_positions_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_positions" ADD CONSTRAINT "workforce_positions_biz_department_fk" FOREIGN KEY ("biz_id","workforce_department_id") REFERENCES "workforce_departments"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_positions" ADD CONSTRAINT "workforce_positions_biz_location_fk" FOREIGN KEY ("biz_id","location_id") REFERENCES "locations"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_positions" ADD CONSTRAINT "workforce_positions_biz_reports_to_fk" FOREIGN KEY ("biz_id","reports_to_workforce_position_id") REFERENCES "workforce_positions"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_requisitions" ADD CONSTRAINT "workforce_requisitions_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_requisitions" ADD CONSTRAINT "workforce_requisitions_workforce_position_id_workforce_positions_id_fk" FOREIGN KEY ("workforce_position_id") REFERENCES "workforce_positions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_requisitions" ADD CONSTRAINT "workforce_requisitions_workforce_department_id_workforce_departments_id_fk" FOREIGN KEY ("workforce_department_id") REFERENCES "workforce_departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_requisitions" ADD CONSTRAINT "workforce_requisitions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_requisitions" ADD CONSTRAINT "workforce_requisitions_hiring_manager_user_id_users_id_fk" FOREIGN KEY ("hiring_manager_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_requisitions" ADD CONSTRAINT "workforce_requisitions_recruiter_user_id_users_id_fk" FOREIGN KEY ("recruiter_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_requisitions" ADD CONSTRAINT "workforce_requisitions_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_requisitions" ADD CONSTRAINT "workforce_requisitions_latest_domain_event_id_domain_events_id_fk" FOREIGN KEY ("latest_domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_requisitions" ADD CONSTRAINT "workforce_requisitions_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_requisitions" ADD CONSTRAINT "workforce_requisitions_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_requisitions" ADD CONSTRAINT "workforce_requisitions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_requisitions" ADD CONSTRAINT "workforce_requisitions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_requisitions" ADD CONSTRAINT "workforce_requisitions_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_requisitions" ADD CONSTRAINT "workforce_requisitions_biz_action_request_fk" FOREIGN KEY ("biz_id","action_request_id") REFERENCES "action_requests"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_requisitions" ADD CONSTRAINT "workforce_requisitions_biz_position_fk" FOREIGN KEY ("biz_id","workforce_position_id") REFERENCES "workforce_positions"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_requisitions" ADD CONSTRAINT "workforce_requisitions_biz_department_fk" FOREIGN KEY ("biz_id","workforce_department_id") REFERENCES "workforce_departments"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workforce_requisitions" ADD CONSTRAINT "workforce_requisitions_biz_location_fk" FOREIGN KEY ("biz_id","location_id") REFERENCES "locations"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "time_scopes" ADD CONSTRAINT "time_scopes_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "time_scopes" ADD CONSTRAINT "time_scopes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "time_scopes" ADD CONSTRAINT "time_scopes_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "time_scopes" ADD CONSTRAINT "time_scopes_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "time_scopes" ADD CONSTRAINT "time_scopes_biz_scope_subject_fk" FOREIGN KEY ("biz_id","scope_ref_type","scope_ref_id") REFERENCES "subjects"("biz_id","subject_type","subject_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_access_events" ADD CONSTRAINT "auth_access_events_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_access_events" ADD CONSTRAINT "auth_access_events_auth_principal_id_auth_principals_id_fk" FOREIGN KEY ("auth_principal_id") REFERENCES "auth_principals"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_access_events" ADD CONSTRAINT "auth_access_events_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_access_events" ADD CONSTRAINT "auth_access_events_api_credential_id_api_credentials_id_fk" FOREIGN KEY ("api_credential_id") REFERENCES "api_credentials"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_access_events" ADD CONSTRAINT "auth_access_events_api_access_token_id_api_access_tokens_id_fk" FOREIGN KEY ("api_access_token_id") REFERENCES "api_access_tokens"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_access_events" ADD CONSTRAINT "auth_access_events_client_installation_id_client_installations_id_fk" FOREIGN KEY ("client_installation_id") REFERENCES "client_installations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_access_events" ADD CONSTRAINT "auth_access_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_access_events" ADD CONSTRAINT "auth_access_events_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_access_events" ADD CONSTRAINT "auth_access_events_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_principals" ADD CONSTRAINT "auth_principals_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_principals" ADD CONSTRAINT "auth_principals_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_principals" ADD CONSTRAINT "auth_principals_api_credential_id_api_credentials_id_fk" FOREIGN KEY ("api_credential_id") REFERENCES "api_credentials"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_principals" ADD CONSTRAINT "auth_principals_api_access_token_id_api_access_tokens_id_fk" FOREIGN KEY ("api_access_token_id") REFERENCES "api_access_tokens"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_principals" ADD CONSTRAINT "auth_principals_client_installation_id_client_installations_id_fk" FOREIGN KEY ("client_installation_id") REFERENCES "client_installations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_principals" ADD CONSTRAINT "auth_principals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_principals" ADD CONSTRAINT "auth_principals_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_principals" ADD CONSTRAINT "auth_principals_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_customer_profile_id_customer_profiles_id_fk" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_crm_contact_id_crm_contacts_id_fk" FOREIGN KEY ("crm_contact_id") REFERENCES "crm_contacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_crm_lead_id_crm_leads_id_fk" FOREIGN KEY ("crm_lead_id") REFERENCES "crm_leads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_crm_opportunity_id_crm_opportunities_id_fk" FOREIGN KEY ("crm_opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_crm_conversation_id_crm_conversations_id_fk" FOREIGN KEY ("crm_conversation_id") REFERENCES "crm_conversations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_outbound_message_id_outbound_messages_id_fk" FOREIGN KEY ("outbound_message_id") REFERENCES "outbound_messages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_domain_event_id_domain_events_id_fk" FOREIGN KEY ("domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_customer_profile_id_customer_profiles_id_fk" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_crm_contact_id_crm_contacts_id_fk" FOREIGN KEY ("crm_contact_id") REFERENCES "crm_contacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_crm_lead_id_crm_leads_id_fk" FOREIGN KEY ("crm_lead_id") REFERENCES "crm_leads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_crm_opportunity_id_crm_opportunities_id_fk" FOREIGN KEY ("crm_opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_domain_event_id_domain_events_id_fk" FOREIGN KEY ("domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_enrollments" ADD CONSTRAINT "customer_journey_enrollments_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_enrollments" ADD CONSTRAINT "customer_journey_enrollments_customer_journey_id_customer_journeys_id_fk" FOREIGN KEY ("customer_journey_id") REFERENCES "customer_journeys"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_enrollments" ADD CONSTRAINT "customer_journey_enrollments_customer_profile_id_customer_profiles_id_fk" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_enrollments" ADD CONSTRAINT "customer_journey_enrollments_current_step_id_customer_journey_steps_id_fk" FOREIGN KEY ("current_step_id") REFERENCES "customer_journey_steps"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_enrollments" ADD CONSTRAINT "customer_journey_enrollments_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_enrollments" ADD CONSTRAINT "customer_journey_enrollments_domain_event_id_domain_events_id_fk" FOREIGN KEY ("domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_enrollments" ADD CONSTRAINT "customer_journey_enrollments_workflow_instance_id_workflow_instances_id_fk" FOREIGN KEY ("workflow_instance_id") REFERENCES "workflow_instances"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_enrollments" ADD CONSTRAINT "customer_journey_enrollments_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_enrollments" ADD CONSTRAINT "customer_journey_enrollments_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_enrollments" ADD CONSTRAINT "customer_journey_enrollments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_enrollments" ADD CONSTRAINT "customer_journey_enrollments_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_enrollments" ADD CONSTRAINT "customer_journey_enrollments_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_events" ADD CONSTRAINT "customer_journey_events_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_events" ADD CONSTRAINT "customer_journey_events_customer_journey_enrollment_id_customer_journey_enrollments_id_fk" FOREIGN KEY ("customer_journey_enrollment_id") REFERENCES "customer_journey_enrollments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_events" ADD CONSTRAINT "customer_journey_events_customer_journey_step_id_customer_journey_steps_id_fk" FOREIGN KEY ("customer_journey_step_id") REFERENCES "customer_journey_steps"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_events" ADD CONSTRAINT "customer_journey_events_outbound_message_id_outbound_messages_id_fk" FOREIGN KEY ("outbound_message_id") REFERENCES "outbound_messages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_events" ADD CONSTRAINT "customer_journey_events_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_events" ADD CONSTRAINT "customer_journey_events_domain_event_id_domain_events_id_fk" FOREIGN KEY ("domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_events" ADD CONSTRAINT "customer_journey_events_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_events" ADD CONSTRAINT "customer_journey_events_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_events" ADD CONSTRAINT "customer_journey_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_events" ADD CONSTRAINT "customer_journey_events_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_events" ADD CONSTRAINT "customer_journey_events_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_steps" ADD CONSTRAINT "customer_journey_steps_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_steps" ADD CONSTRAINT "customer_journey_steps_customer_journey_id_customer_journeys_id_fk" FOREIGN KEY ("customer_journey_id") REFERENCES "customer_journeys"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_steps" ADD CONSTRAINT "customer_journey_steps_message_template_id_message_templates_id_fk" FOREIGN KEY ("message_template_id") REFERENCES "message_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_steps" ADD CONSTRAINT "customer_journey_steps_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_steps" ADD CONSTRAINT "customer_journey_steps_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journey_steps" ADD CONSTRAINT "customer_journey_steps_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journeys" ADD CONSTRAINT "customer_journeys_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journeys" ADD CONSTRAINT "customer_journeys_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journeys" ADD CONSTRAINT "customer_journeys_domain_event_id_domain_events_id_fk" FOREIGN KEY ("domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journeys" ADD CONSTRAINT "customer_journeys_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journeys" ADD CONSTRAINT "customer_journeys_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journeys" ADD CONSTRAINT "customer_journeys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journeys" ADD CONSTRAINT "customer_journeys_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_journeys" ADD CONSTRAINT "customer_journeys_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbook_bindings" ADD CONSTRAINT "customer_playbook_bindings_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbook_bindings" ADD CONSTRAINT "customer_playbook_bindings_customer_playbook_id_customer_playbooks_id_fk" FOREIGN KEY ("customer_playbook_id") REFERENCES "customer_playbooks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbook_bindings" ADD CONSTRAINT "customer_playbook_bindings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbook_bindings" ADD CONSTRAINT "customer_playbook_bindings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbook_bindings" ADD CONSTRAINT "customer_playbook_bindings_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbook_runs" ADD CONSTRAINT "customer_playbook_runs_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbook_runs" ADD CONSTRAINT "customer_playbook_runs_customer_playbook_id_customer_playbooks_id_fk" FOREIGN KEY ("customer_playbook_id") REFERENCES "customer_playbooks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbook_runs" ADD CONSTRAINT "customer_playbook_runs_customer_profile_id_customer_profiles_id_fk" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbook_runs" ADD CONSTRAINT "customer_playbook_runs_support_case_id_support_cases_id_fk" FOREIGN KEY ("support_case_id") REFERENCES "support_cases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbook_runs" ADD CONSTRAINT "customer_playbook_runs_crm_opportunity_id_crm_opportunities_id_fk" FOREIGN KEY ("crm_opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbook_runs" ADD CONSTRAINT "customer_playbook_runs_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbook_runs" ADD CONSTRAINT "customer_playbook_runs_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbook_runs" ADD CONSTRAINT "customer_playbook_runs_domain_event_id_domain_events_id_fk" FOREIGN KEY ("domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbook_runs" ADD CONSTRAINT "customer_playbook_runs_workflow_instance_id_workflow_instances_id_fk" FOREIGN KEY ("workflow_instance_id") REFERENCES "workflow_instances"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbook_runs" ADD CONSTRAINT "customer_playbook_runs_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbook_runs" ADD CONSTRAINT "customer_playbook_runs_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbook_runs" ADD CONSTRAINT "customer_playbook_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbook_runs" ADD CONSTRAINT "customer_playbook_runs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbook_runs" ADD CONSTRAINT "customer_playbook_runs_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbooks" ADD CONSTRAINT "customer_playbooks_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbooks" ADD CONSTRAINT "customer_playbooks_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbooks" ADD CONSTRAINT "customer_playbooks_domain_event_id_domain_events_id_fk" FOREIGN KEY ("domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbooks" ADD CONSTRAINT "customer_playbooks_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbooks" ADD CONSTRAINT "customer_playbooks_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbooks" ADD CONSTRAINT "customer_playbooks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbooks" ADD CONSTRAINT "customer_playbooks_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_playbooks" ADD CONSTRAINT "customer_playbooks_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_crm_links" ADD CONSTRAINT "customer_profile_crm_links_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_crm_links" ADD CONSTRAINT "customer_profile_crm_links_customer_profile_id_customer_profiles_id_fk" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_crm_links" ADD CONSTRAINT "customer_profile_crm_links_crm_contact_id_crm_contacts_id_fk" FOREIGN KEY ("crm_contact_id") REFERENCES "crm_contacts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_crm_links" ADD CONSTRAINT "customer_profile_crm_links_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_crm_links" ADD CONSTRAINT "customer_profile_crm_links_domain_event_id_domain_events_id_fk" FOREIGN KEY ("domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_crm_links" ADD CONSTRAINT "customer_profile_crm_links_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_crm_links" ADD CONSTRAINT "customer_profile_crm_links_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_crm_links" ADD CONSTRAINT "customer_profile_crm_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_crm_links" ADD CONSTRAINT "customer_profile_crm_links_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profile_crm_links" ADD CONSTRAINT "customer_profile_crm_links_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_timeline_events" ADD CONSTRAINT "customer_timeline_events_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_timeline_events" ADD CONSTRAINT "customer_timeline_events_customer_profile_id_customer_profiles_id_fk" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_timeline_events" ADD CONSTRAINT "customer_timeline_events_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_timeline_events" ADD CONSTRAINT "customer_timeline_events_domain_event_id_domain_events_id_fk" FOREIGN KEY ("domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_timeline_events" ADD CONSTRAINT "customer_timeline_events_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_timeline_events" ADD CONSTRAINT "customer_timeline_events_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_timeline_events" ADD CONSTRAINT "customer_timeline_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_timeline_events" ADD CONSTRAINT "customer_timeline_events_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_timeline_events" ADD CONSTRAINT "customer_timeline_events_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_case_events" ADD CONSTRAINT "support_case_events_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_case_events" ADD CONSTRAINT "support_case_events_support_case_id_support_cases_id_fk" FOREIGN KEY ("support_case_id") REFERENCES "support_cases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_case_events" ADD CONSTRAINT "support_case_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_case_events" ADD CONSTRAINT "support_case_events_actor_customer_profile_id_customer_profiles_id_fk" FOREIGN KEY ("actor_customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_case_events" ADD CONSTRAINT "support_case_events_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_case_events" ADD CONSTRAINT "support_case_events_domain_event_id_domain_events_id_fk" FOREIGN KEY ("domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_case_events" ADD CONSTRAINT "support_case_events_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_case_events" ADD CONSTRAINT "support_case_events_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_case_events" ADD CONSTRAINT "support_case_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_case_events" ADD CONSTRAINT "support_case_events_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_case_events" ADD CONSTRAINT "support_case_events_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_case_links" ADD CONSTRAINT "support_case_links_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_case_links" ADD CONSTRAINT "support_case_links_support_case_id_support_cases_id_fk" FOREIGN KEY ("support_case_id") REFERENCES "support_cases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_case_links" ADD CONSTRAINT "support_case_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_case_links" ADD CONSTRAINT "support_case_links_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_case_links" ADD CONSTRAINT "support_case_links_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_case_participants" ADD CONSTRAINT "support_case_participants_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_case_participants" ADD CONSTRAINT "support_case_participants_support_case_id_support_cases_id_fk" FOREIGN KEY ("support_case_id") REFERENCES "support_cases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_case_participants" ADD CONSTRAINT "support_case_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_case_participants" ADD CONSTRAINT "support_case_participants_customer_profile_id_customer_profiles_id_fk" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_case_participants" ADD CONSTRAINT "support_case_participants_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_case_participants" ADD CONSTRAINT "support_case_participants_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_case_participants" ADD CONSTRAINT "support_case_participants_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_customer_profile_id_customer_profiles_id_fk" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_crm_contact_id_crm_contacts_id_fk" FOREIGN KEY ("crm_contact_id") REFERENCES "crm_contacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_crm_conversation_id_crm_conversations_id_fk" FOREIGN KEY ("crm_conversation_id") REFERENCES "crm_conversations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_booking_order_id_booking_orders_id_fk" FOREIGN KEY ("booking_order_id") REFERENCES "booking_orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_payment_transaction_id_payment_transactions_id_fk" FOREIGN KEY ("payment_transaction_id") REFERENCES "payment_transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_sla_policy_id_sla_policies_id_fk" FOREIGN KEY ("sla_policy_id") REFERENCES "sla_policies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_action_request_id_action_requests_id_fk" FOREIGN KEY ("action_request_id") REFERENCES "action_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_domain_event_id_domain_events_id_fk" FOREIGN KEY ("domain_event_id") REFERENCES "domain_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_workflow_instance_id_workflow_instances_id_fk" FOREIGN KEY ("workflow_instance_id") REFERENCES "workflow_instances"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_projection_document_id_projection_documents_id_fk" FOREIGN KEY ("projection_document_id") REFERENCES "projection_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_debug_snapshot_id_debug_snapshots_id_fk" FOREIGN KEY ("debug_snapshot_id") REFERENCES "debug_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loop_actions" ADD CONSTRAINT "ooda_loop_actions_ooda_loop_id_ooda_loops_id_fk" FOREIGN KEY ("ooda_loop_id") REFERENCES "ooda_loops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loop_actions" ADD CONSTRAINT "ooda_loop_actions_ooda_loop_entry_id_ooda_loop_entries_id_fk" FOREIGN KEY ("ooda_loop_entry_id") REFERENCES "ooda_loop_entries"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loop_actions" ADD CONSTRAINT "ooda_loop_actions_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loop_actions" ADD CONSTRAINT "ooda_loop_actions_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loop_actions" ADD CONSTRAINT "ooda_loop_actions_linked_saga_run_id_saga_runs_id_fk" FOREIGN KEY ("linked_saga_run_id") REFERENCES "saga_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loop_actions" ADD CONSTRAINT "ooda_loop_actions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loop_actions" ADD CONSTRAINT "ooda_loop_actions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loop_actions" ADD CONSTRAINT "ooda_loop_actions_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loop_entries" ADD CONSTRAINT "ooda_loop_entries_ooda_loop_id_ooda_loops_id_fk" FOREIGN KEY ("ooda_loop_id") REFERENCES "ooda_loops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loop_entries" ADD CONSTRAINT "ooda_loop_entries_linked_use_case_id_saga_use_cases_id_fk" FOREIGN KEY ("linked_use_case_id") REFERENCES "saga_use_cases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loop_entries" ADD CONSTRAINT "ooda_loop_entries_linked_saga_definition_id_saga_definitions_id_fk" FOREIGN KEY ("linked_saga_definition_id") REFERENCES "saga_definitions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loop_entries" ADD CONSTRAINT "ooda_loop_entries_linked_saga_run_id_saga_runs_id_fk" FOREIGN KEY ("linked_saga_run_id") REFERENCES "saga_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loop_entries" ADD CONSTRAINT "ooda_loop_entries_linked_saga_run_step_id_saga_run_steps_id_fk" FOREIGN KEY ("linked_saga_run_step_id") REFERENCES "saga_run_steps"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loop_entries" ADD CONSTRAINT "ooda_loop_entries_linked_coverage_item_id_saga_coverage_items_id_fk" FOREIGN KEY ("linked_coverage_item_id") REFERENCES "saga_coverage_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loop_entries" ADD CONSTRAINT "ooda_loop_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loop_entries" ADD CONSTRAINT "ooda_loop_entries_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loop_entries" ADD CONSTRAINT "ooda_loop_entries_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loop_links" ADD CONSTRAINT "ooda_loop_links_ooda_loop_id_ooda_loops_id_fk" FOREIGN KEY ("ooda_loop_id") REFERENCES "ooda_loops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loop_links" ADD CONSTRAINT "ooda_loop_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loop_links" ADD CONSTRAINT "ooda_loop_links_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loop_links" ADD CONSTRAINT "ooda_loop_links_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loops" ADD CONSTRAINT "ooda_loops_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loops" ADD CONSTRAINT "ooda_loops_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loops" ADD CONSTRAINT "ooda_loops_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loops" ADD CONSTRAINT "ooda_loops_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ooda_loops" ADD CONSTRAINT "ooda_loops_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_scheduler_jobs" ADD CONSTRAINT "saga_run_scheduler_jobs_saga_run_id_saga_runs_id_fk" FOREIGN KEY ("saga_run_id") REFERENCES "saga_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_scheduler_jobs" ADD CONSTRAINT "saga_run_scheduler_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_scheduler_jobs" ADD CONSTRAINT "saga_run_scheduler_jobs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_scheduler_jobs" ADD CONSTRAINT "saga_run_scheduler_jobs_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_simulation_clocks" ADD CONSTRAINT "saga_run_simulation_clocks_saga_run_id_saga_runs_id_fk" FOREIGN KEY ("saga_run_id") REFERENCES "saga_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_simulation_clocks" ADD CONSTRAINT "saga_run_simulation_clocks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_simulation_clocks" ADD CONSTRAINT "saga_run_simulation_clocks_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saga_run_simulation_clocks" ADD CONSTRAINT "saga_run_simulation_clocks_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
