DO $$ BEGIN
 CREATE TYPE "enterprise_contract_pack_binding_mode" AS ENUM('required', 'recommended', 'optional');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "enterprise_delegation_status" AS ENUM('active', 'revoked', 'expired', 'suspended');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "enterprise_directory_link_status" AS ENUM('active', 'disabled', 'error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "enterprise_identity_provider_type" AS ENUM('oidc', 'saml', 'scim', 'custom');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "enterprise_resolution_status" AS ENUM('ready', 'stale', 'error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "enterprise_rollout_status" AS ENUM('draft', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "enterprise_rollout_target_status" AS ENUM('pending', 'applied', 'skipped', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "enterprise_scim_sync_status" AS ENUM('pending', 'running', 'succeeded', 'partial', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "enterprise_scope_type" AS ENUM('network', 'biz', 'location', 'subject');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "intercompany_account_type" AS ENUM('clearing', 'royalty', 'management_fee', 'cost_share', 'custom');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "intercompany_entry_status" AS ENUM('pending', 'posted', 'reversed', 'voided');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "intercompany_entry_type" AS ENUM('accrual', 'adjustment', 'settlement', 'reversal');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "intercompany_settlement_run_status" AS ENUM('draft', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_admin_delegations" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"delegator_user_id" text NOT NULL,
	"delegate_user_id" text NOT NULL,
	"delegation_action" varchar(100) NOT NULL,
	"scope_type" "enterprise_scope_type" NOT NULL,
	"scope_key" varchar(260) NOT NULL,
	"target_biz_id" text,
	"target_location_id" text,
	"target_subject_type" varchar(80),
	"target_subject_id" varchar(140),
	"status" "enterprise_delegation_status" DEFAULT 'active' NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"can_subdelegate" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_approval_authority_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"user_id" text NOT NULL,
	"action_type" varchar(100) NOT NULL,
	"scope_type" "enterprise_scope_type" NOT NULL,
	"scope_key" varchar(260) NOT NULL,
	"target_biz_id" text,
	"target_location_id" text,
	"target_subject_type" varchar(80),
	"target_subject_id" varchar(140),
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"per_approval_limit_minor" integer,
	"daily_limit_minor" integer,
	"monthly_limit_minor" integer,
	"requires_second_approver" boolean DEFAULT false NOT NULL,
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_change_rollout_results" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"rollout_target_id" text NOT NULL,
	"result_type" varchar(80) DEFAULT 'applied' NOT NULL,
	"result_code" varchar(120),
	"message" text,
	"before_snapshot" jsonb DEFAULT '{}'::jsonb,
	"after_snapshot" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_change_rollout_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"name" varchar(180) NOT NULL,
	"slug" varchar(120),
	"change_type" varchar(100) NOT NULL,
	"status" "enterprise_rollout_status" DEFAULT 'draft' NOT NULL,
	"source_revision" varchar(160),
	"target_revision" varchar(160),
	"requested_by_user_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"error_summary" varchar(2000),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_change_rollout_targets" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"rollout_run_id" text NOT NULL,
	"scope_type" "enterprise_scope_type" NOT NULL,
	"scope_key" varchar(260) NOT NULL,
	"target_biz_id" text,
	"target_location_id" text,
	"target_subject_type" varchar(80),
	"target_subject_id" varchar(140),
	"target_order" integer DEFAULT 100 NOT NULL,
	"status" "enterprise_rollout_target_status" DEFAULT 'pending' NOT NULL,
	"applied_at" timestamp with time zone,
	"error_summary" varchar(2000),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_contract_pack_bindings" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"contract_pack_version_id" text NOT NULL,
	"binding_mode" "enterprise_contract_pack_binding_mode" DEFAULT 'required' NOT NULL,
	"scope_type" "enterprise_scope_type" NOT NULL,
	"scope_key" varchar(260) NOT NULL,
	"target_biz_id" text,
	"target_location_id" text,
	"target_subject_type" varchar(80),
	"target_subject_id" varchar(140),
	"is_inherited" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_contract_pack_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"name" varchar(180) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"domain_key" varchar(80) DEFAULT 'operations' NOT NULL,
	"description" text,
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_contract_pack_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"contract_pack_template_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"status" "lifecycle_status" DEFAULT 'draft' NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"definition" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_external_directory_links" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"identity_provider_id" text NOT NULL,
	"principal_type" varchar(60) NOT NULL,
	"user_id" text,
	"subject_type" varchar(80),
	"subject_id" varchar(140),
	"external_directory_id" varchar(200) NOT NULL,
	"external_parent_id" varchar(200),
	"status" "enterprise_directory_link_status" DEFAULT 'active' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_identity_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"name" varchar(180) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"provider_type" "enterprise_identity_provider_type" NOT NULL,
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"issuer_url" varchar(500),
	"authorization_url" varchar(500),
	"token_url" varchar(500),
	"jwks_url" varchar(500),
	"sso_entry_point_url" varchar(500),
	"scim_base_url" varchar(500),
	"audience" varchar(255),
	"client_id" varchar(255),
	"last_sync_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_inheritance_resolutions" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"strategy_id" text NOT NULL,
	"scope_type" "enterprise_scope_type" NOT NULL,
	"scope_key" varchar(260) NOT NULL,
	"target_biz_id" text,
	"target_location_id" text,
	"target_subject_type" varchar(80),
	"target_subject_id" varchar(140),
	"domain_key" varchar(140) NOT NULL,
	"resolution_status" "enterprise_resolution_status" DEFAULT 'ready' NOT NULL,
	"resolved_version" integer DEFAULT 1 NOT NULL,
	"resolution_hash" varchar(180),
	"resolved_document" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resolved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_inheritance_strategies" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"name" varchar(180) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"inheritance_domain" varchar(100) NOT NULL,
	"resolution_mode" varchar(80) DEFAULT 'override_last' NOT NULL,
	"precedence" jsonb DEFAULT '["network","biz","location","subject"]'::jsonb NOT NULL,
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_intercompany_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"source_biz_id" text NOT NULL,
	"counterparty_biz_id" text NOT NULL,
	"account_type" "intercompany_account_type" NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"external_account_ref" varchar(140),
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_intercompany_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"intercompany_account_id" text NOT NULL,
	"settlement_run_id" text,
	"entry_type" "intercompany_entry_type" NOT NULL,
	"status" "intercompany_entry_status" DEFAULT 'pending' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"description" text,
	"reference_key" varchar(160),
	"source_cross_biz_order_id" text,
	"source_payment_transaction_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_intercompany_settlement_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"intercompany_account_id" text NOT NULL,
	"status" "intercompany_settlement_run_status" DEFAULT 'draft' NOT NULL,
	"window_start_date" date NOT NULL,
	"window_end_date" date NOT NULL,
	"expected_total_minor" integer DEFAULT 0 NOT NULL,
	"posted_total_minor" integer DEFAULT 0 NOT NULL,
	"difference_minor" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"error_summary" varchar(2000),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_relationship_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"relationship_type_key" varchar(120) NOT NULL,
	"inverse_relationship_type_key" varchar(120),
	"description" text,
	"is_symmetric" boolean DEFAULT false NOT NULL,
	"allows_cycles" boolean DEFAULT false NOT NULL,
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_relationships" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"relationship_template_id" text NOT NULL,
	"from_biz_id" text NOT NULL,
	"to_biz_id" text NOT NULL,
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"priority" integer DEFAULT 100 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_scim_sync_states" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"identity_provider_id" text NOT NULL,
	"status" "enterprise_scim_sync_status" DEFAULT 'pending' NOT NULL,
	"sync_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_finished_at" timestamp with time zone,
	"cursor" varchar(1000),
	"imported_users_count" integer DEFAULT 0 NOT NULL,
	"updated_users_count" integer DEFAULT 0 NOT NULL,
	"deactivated_users_count" integer DEFAULT 0 NOT NULL,
	"error_summary" varchar(2000),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fact_enterprise_compliance_daily" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"member_biz_id" text,
	"fact_date" date NOT NULL,
	"open_incidents_count" integer DEFAULT 0 NOT NULL,
	"open_breaches_count" integer DEFAULT 0 NOT NULL,
	"overdue_review_count" integer DEFAULT 0 NOT NULL,
	"resolved_incidents_count" integer DEFAULT 0 NOT NULL,
	"compliance_score_bps" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fact_enterprise_revenue_daily" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"member_biz_id" text,
	"fact_date" date NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"gross_minor" integer DEFAULT 0 NOT NULL,
	"fee_minor" integer DEFAULT 0 NOT NULL,
	"refund_minor" integer DEFAULT 0 NOT NULL,
	"net_minor" integer DEFAULT 0 NOT NULL,
	"orders_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fact_enterprise_utilization_daily" (
	"id" text PRIMARY KEY NOT NULL,
	"biz_id" text NOT NULL,
	"member_biz_id" text,
	"fact_date" date NOT NULL,
	"available_minutes" integer DEFAULT 0 NOT NULL,
	"scheduled_minutes" integer DEFAULT 0 NOT NULL,
	"blocked_minutes" integer DEFAULT 0 NOT NULL,
	"utilization_bps" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"deleted_by" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_admin_delegations_biz_id_id_unique" ON "enterprise_admin_delegations" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_admin_delegations_active_unique" ON "enterprise_admin_delegations" ("biz_id","delegator_user_id","delegate_user_id","delegation_action","scope_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enterprise_admin_delegations_biz_delegate_status_idx" ON "enterprise_admin_delegations" ("biz_id","delegate_user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_approval_authority_limits_biz_id_id_unique" ON "enterprise_approval_authority_limits" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_approval_authority_limits_active_unique" ON "enterprise_approval_authority_limits" ("biz_id","user_id","action_type","scope_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enterprise_approval_authority_limits_biz_user_status_idx" ON "enterprise_approval_authority_limits" ("biz_id","user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_change_rollout_results_biz_id_id_unique" ON "enterprise_change_rollout_results" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enterprise_change_rollout_results_biz_target_idx" ON "enterprise_change_rollout_results" ("biz_id","rollout_target_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_change_rollout_runs_biz_id_id_unique" ON "enterprise_change_rollout_runs" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_change_rollout_runs_biz_slug_unique" ON "enterprise_change_rollout_runs" ("biz_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enterprise_change_rollout_runs_biz_status_started_idx" ON "enterprise_change_rollout_runs" ("biz_id","status","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_change_rollout_targets_biz_id_id_unique" ON "enterprise_change_rollout_targets" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_change_rollout_targets_run_scope_unique" ON "enterprise_change_rollout_targets" ("biz_id","rollout_run_id","scope_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enterprise_change_rollout_targets_biz_run_status_order_idx" ON "enterprise_change_rollout_targets" ("biz_id","rollout_run_id","status","target_order");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_contract_pack_bindings_biz_id_id_unique" ON "enterprise_contract_pack_bindings" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_contract_pack_bindings_active_unique" ON "enterprise_contract_pack_bindings" ("biz_id","contract_pack_version_id","scope_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enterprise_contract_pack_bindings_biz_scope_status_idx" ON "enterprise_contract_pack_bindings" ("biz_id","scope_type","status","priority");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_contract_pack_templates_biz_id_id_unique" ON "enterprise_contract_pack_templates" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_contract_pack_templates_biz_slug_unique" ON "enterprise_contract_pack_templates" ("biz_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enterprise_contract_pack_templates_biz_domain_status_idx" ON "enterprise_contract_pack_templates" ("biz_id","domain_key","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_contract_pack_versions_biz_id_id_unique" ON "enterprise_contract_pack_versions" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_contract_pack_versions_template_version_unique" ON "enterprise_contract_pack_versions" ("contract_pack_template_id","version_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enterprise_contract_pack_versions_biz_template_status_idx" ON "enterprise_contract_pack_versions" ("biz_id","contract_pack_template_id","status","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_external_directory_links_biz_id_id_unique" ON "enterprise_external_directory_links" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_external_directory_links_external_unique" ON "enterprise_external_directory_links" ("biz_id","identity_provider_id","external_directory_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_external_directory_links_principal_unique" ON "enterprise_external_directory_links" ("biz_id","identity_provider_id","principal_type","user_id","subject_type","subject_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enterprise_external_directory_links_biz_provider_status_idx" ON "enterprise_external_directory_links" ("biz_id","identity_provider_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_identity_providers_biz_id_id_unique" ON "enterprise_identity_providers" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_identity_providers_biz_slug_unique" ON "enterprise_identity_providers" ("biz_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enterprise_identity_providers_biz_status_type_idx" ON "enterprise_identity_providers" ("biz_id","status","provider_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_inheritance_resolutions_biz_id_id_unique" ON "enterprise_inheritance_resolutions" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_inheritance_resolutions_scope_unique" ON "enterprise_inheritance_resolutions" ("biz_id","strategy_id","scope_key","domain_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enterprise_inheritance_resolutions_biz_domain_status_idx" ON "enterprise_inheritance_resolutions" ("biz_id","domain_key","resolution_status","resolved_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_inheritance_strategies_biz_id_id_unique" ON "enterprise_inheritance_strategies" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_inheritance_strategies_biz_slug_unique" ON "enterprise_inheritance_strategies" ("biz_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enterprise_inheritance_strategies_biz_domain_status_idx" ON "enterprise_inheritance_strategies" ("biz_id","inheritance_domain","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_intercompany_accounts_biz_id_id_unique" ON "enterprise_intercompany_accounts" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_intercompany_accounts_active_lane_unique" ON "enterprise_intercompany_accounts" ("biz_id","source_biz_id","counterparty_biz_id","account_type","currency");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enterprise_intercompany_accounts_biz_source_counterparty_idx" ON "enterprise_intercompany_accounts" ("biz_id","source_biz_id","counterparty_biz_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_intercompany_entries_biz_id_id_unique" ON "enterprise_intercompany_entries" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enterprise_intercompany_entries_biz_account_occurred_idx" ON "enterprise_intercompany_entries" ("biz_id","intercompany_account_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enterprise_intercompany_entries_biz_status_occurred_idx" ON "enterprise_intercompany_entries" ("biz_id","status","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_intercompany_entries_biz_reference_key_unique" ON "enterprise_intercompany_entries" ("biz_id","reference_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_intercompany_settlement_runs_biz_id_id_unique" ON "enterprise_intercompany_settlement_runs" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_intercompany_settlement_runs_biz_account_window_unique" ON "enterprise_intercompany_settlement_runs" ("biz_id","intercompany_account_id","window_start_date","window_end_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enterprise_intercompany_settlement_runs_biz_status_started_idx" ON "enterprise_intercompany_settlement_runs" ("biz_id","status","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_relationship_templates_biz_id_id_unique" ON "enterprise_relationship_templates" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_relationship_templates_biz_slug_unique" ON "enterprise_relationship_templates" ("biz_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_relationship_templates_biz_type_key_unique" ON "enterprise_relationship_templates" ("biz_id","relationship_type_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enterprise_relationship_templates_biz_status_idx" ON "enterprise_relationship_templates" ("biz_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_relationships_biz_id_id_unique" ON "enterprise_relationships" ("biz_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_relationships_active_edge_unique" ON "enterprise_relationships" ("biz_id","relationship_template_id","from_biz_id","to_biz_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enterprise_relationships_biz_from_status_idx" ON "enterprise_relationships" ("biz_id","from_biz_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enterprise_relationships_biz_to_status_idx" ON "enterprise_relationships" ("biz_id","to_biz_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_scim_sync_states_biz_id_id_unique" ON "enterprise_scim_sync_states" ("biz_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enterprise_scim_sync_states_biz_provider_started_idx" ON "enterprise_scim_sync_states" ("biz_id","identity_provider_id","sync_started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enterprise_scim_sync_states_biz_status_started_idx" ON "enterprise_scim_sync_states" ("biz_id","status","sync_started_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fact_enterprise_compliance_daily_slice_unique" ON "fact_enterprise_compliance_daily" ("biz_id","member_biz_id","fact_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fact_enterprise_compliance_daily_biz_date_idx" ON "fact_enterprise_compliance_daily" ("biz_id","fact_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fact_enterprise_revenue_daily_slice_unique" ON "fact_enterprise_revenue_daily" ("biz_id","member_biz_id","fact_date","currency");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fact_enterprise_revenue_daily_biz_date_idx" ON "fact_enterprise_revenue_daily" ("biz_id","fact_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fact_enterprise_utilization_daily_slice_unique" ON "fact_enterprise_utilization_daily" ("biz_id","member_biz_id","fact_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fact_enterprise_utilization_daily_biz_date_idx" ON "fact_enterprise_utilization_daily" ("biz_id","fact_date");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_admin_delegations" ADD CONSTRAINT "enterprise_admin_delegations_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_admin_delegations" ADD CONSTRAINT "enterprise_admin_delegations_delegator_user_id_users_id_fk" FOREIGN KEY ("delegator_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_admin_delegations" ADD CONSTRAINT "enterprise_admin_delegations_delegate_user_id_users_id_fk" FOREIGN KEY ("delegate_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_admin_delegations" ADD CONSTRAINT "enterprise_admin_delegations_target_biz_id_bizes_id_fk" FOREIGN KEY ("target_biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_admin_delegations" ADD CONSTRAINT "enterprise_admin_delegations_target_location_id_locations_id_fk" FOREIGN KEY ("target_location_id") REFERENCES "locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_admin_delegations" ADD CONSTRAINT "enterprise_admin_delegations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_admin_delegations" ADD CONSTRAINT "enterprise_admin_delegations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_admin_delegations" ADD CONSTRAINT "enterprise_admin_delegations_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_admin_delegations" ADD CONSTRAINT "enterprise_admin_delegations_target_location_fk" FOREIGN KEY ("target_biz_id","target_location_id") REFERENCES "locations"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_admin_delegations" ADD CONSTRAINT "enterprise_admin_delegations_target_subject_fk" FOREIGN KEY ("target_biz_id","target_subject_type","target_subject_id") REFERENCES "subjects"("biz_id","subject_type","subject_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_approval_authority_limits" ADD CONSTRAINT "enterprise_approval_authority_limits_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_approval_authority_limits" ADD CONSTRAINT "enterprise_approval_authority_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_approval_authority_limits" ADD CONSTRAINT "enterprise_approval_authority_limits_target_biz_id_bizes_id_fk" FOREIGN KEY ("target_biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_approval_authority_limits" ADD CONSTRAINT "enterprise_approval_authority_limits_target_location_id_locations_id_fk" FOREIGN KEY ("target_location_id") REFERENCES "locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_approval_authority_limits" ADD CONSTRAINT "enterprise_approval_authority_limits_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_approval_authority_limits" ADD CONSTRAINT "enterprise_approval_authority_limits_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_approval_authority_limits" ADD CONSTRAINT "enterprise_approval_authority_limits_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_approval_authority_limits" ADD CONSTRAINT "enterprise_approval_authority_limits_target_location_fk" FOREIGN KEY ("target_biz_id","target_location_id") REFERENCES "locations"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_approval_authority_limits" ADD CONSTRAINT "enterprise_approval_authority_limits_target_subject_fk" FOREIGN KEY ("target_biz_id","target_subject_type","target_subject_id") REFERENCES "subjects"("biz_id","subject_type","subject_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_change_rollout_results" ADD CONSTRAINT "enterprise_change_rollout_results_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_change_rollout_results" ADD CONSTRAINT "enterprise_change_rollout_results_rollout_target_id_enterprise_change_rollout_targets_id_fk" FOREIGN KEY ("rollout_target_id") REFERENCES "enterprise_change_rollout_targets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_change_rollout_results" ADD CONSTRAINT "enterprise_change_rollout_results_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_change_rollout_results" ADD CONSTRAINT "enterprise_change_rollout_results_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_change_rollout_results" ADD CONSTRAINT "enterprise_change_rollout_results_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_change_rollout_results" ADD CONSTRAINT "enterprise_change_rollout_results_biz_target_fk" FOREIGN KEY ("biz_id","rollout_target_id") REFERENCES "enterprise_change_rollout_targets"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_change_rollout_runs" ADD CONSTRAINT "enterprise_change_rollout_runs_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_change_rollout_runs" ADD CONSTRAINT "enterprise_change_rollout_runs_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_change_rollout_runs" ADD CONSTRAINT "enterprise_change_rollout_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_change_rollout_runs" ADD CONSTRAINT "enterprise_change_rollout_runs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_change_rollout_runs" ADD CONSTRAINT "enterprise_change_rollout_runs_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_change_rollout_targets" ADD CONSTRAINT "enterprise_change_rollout_targets_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_change_rollout_targets" ADD CONSTRAINT "enterprise_change_rollout_targets_rollout_run_id_enterprise_change_rollout_runs_id_fk" FOREIGN KEY ("rollout_run_id") REFERENCES "enterprise_change_rollout_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_change_rollout_targets" ADD CONSTRAINT "enterprise_change_rollout_targets_target_biz_id_bizes_id_fk" FOREIGN KEY ("target_biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_change_rollout_targets" ADD CONSTRAINT "enterprise_change_rollout_targets_target_location_id_locations_id_fk" FOREIGN KEY ("target_location_id") REFERENCES "locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_change_rollout_targets" ADD CONSTRAINT "enterprise_change_rollout_targets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_change_rollout_targets" ADD CONSTRAINT "enterprise_change_rollout_targets_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_change_rollout_targets" ADD CONSTRAINT "enterprise_change_rollout_targets_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_change_rollout_targets" ADD CONSTRAINT "enterprise_change_rollout_targets_biz_run_fk" FOREIGN KEY ("biz_id","rollout_run_id") REFERENCES "enterprise_change_rollout_runs"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_change_rollout_targets" ADD CONSTRAINT "enterprise_change_rollout_targets_target_location_fk" FOREIGN KEY ("target_biz_id","target_location_id") REFERENCES "locations"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_change_rollout_targets" ADD CONSTRAINT "enterprise_change_rollout_targets_target_subject_fk" FOREIGN KEY ("target_biz_id","target_subject_type","target_subject_id") REFERENCES "subjects"("biz_id","subject_type","subject_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_contract_pack_bindings" ADD CONSTRAINT "enterprise_contract_pack_bindings_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_contract_pack_bindings" ADD CONSTRAINT "enterprise_contract_pack_bindings_contract_pack_version_id_enterprise_contract_pack_versions_id_fk" FOREIGN KEY ("contract_pack_version_id") REFERENCES "enterprise_contract_pack_versions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_contract_pack_bindings" ADD CONSTRAINT "enterprise_contract_pack_bindings_target_biz_id_bizes_id_fk" FOREIGN KEY ("target_biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_contract_pack_bindings" ADD CONSTRAINT "enterprise_contract_pack_bindings_target_location_id_locations_id_fk" FOREIGN KEY ("target_location_id") REFERENCES "locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_contract_pack_bindings" ADD CONSTRAINT "enterprise_contract_pack_bindings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_contract_pack_bindings" ADD CONSTRAINT "enterprise_contract_pack_bindings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_contract_pack_bindings" ADD CONSTRAINT "enterprise_contract_pack_bindings_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_contract_pack_bindings" ADD CONSTRAINT "enterprise_contract_pack_bindings_biz_pack_version_fk" FOREIGN KEY ("biz_id","contract_pack_version_id") REFERENCES "enterprise_contract_pack_versions"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_contract_pack_bindings" ADD CONSTRAINT "enterprise_contract_pack_bindings_target_location_fk" FOREIGN KEY ("target_biz_id","target_location_id") REFERENCES "locations"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_contract_pack_bindings" ADD CONSTRAINT "enterprise_contract_pack_bindings_target_subject_fk" FOREIGN KEY ("target_biz_id","target_subject_type","target_subject_id") REFERENCES "subjects"("biz_id","subject_type","subject_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_contract_pack_templates" ADD CONSTRAINT "enterprise_contract_pack_templates_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_contract_pack_templates" ADD CONSTRAINT "enterprise_contract_pack_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_contract_pack_templates" ADD CONSTRAINT "enterprise_contract_pack_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_contract_pack_templates" ADD CONSTRAINT "enterprise_contract_pack_templates_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_contract_pack_versions" ADD CONSTRAINT "enterprise_contract_pack_versions_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_contract_pack_versions" ADD CONSTRAINT "enterprise_contract_pack_versions_contract_pack_template_id_enterprise_contract_pack_templates_id_fk" FOREIGN KEY ("contract_pack_template_id") REFERENCES "enterprise_contract_pack_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_contract_pack_versions" ADD CONSTRAINT "enterprise_contract_pack_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_contract_pack_versions" ADD CONSTRAINT "enterprise_contract_pack_versions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_contract_pack_versions" ADD CONSTRAINT "enterprise_contract_pack_versions_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_contract_pack_versions" ADD CONSTRAINT "enterprise_contract_pack_versions_biz_template_fk" FOREIGN KEY ("biz_id","contract_pack_template_id") REFERENCES "enterprise_contract_pack_templates"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_external_directory_links" ADD CONSTRAINT "enterprise_external_directory_links_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_external_directory_links" ADD CONSTRAINT "enterprise_external_directory_links_identity_provider_id_enterprise_identity_providers_id_fk" FOREIGN KEY ("identity_provider_id") REFERENCES "enterprise_identity_providers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_external_directory_links" ADD CONSTRAINT "enterprise_external_directory_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_external_directory_links" ADD CONSTRAINT "enterprise_external_directory_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_external_directory_links" ADD CONSTRAINT "enterprise_external_directory_links_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_external_directory_links" ADD CONSTRAINT "enterprise_external_directory_links_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_external_directory_links" ADD CONSTRAINT "enterprise_external_directory_links_biz_provider_fk" FOREIGN KEY ("biz_id","identity_provider_id") REFERENCES "enterprise_identity_providers"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_external_directory_links" ADD CONSTRAINT "enterprise_external_directory_links_subject_fk" FOREIGN KEY ("biz_id","subject_type","subject_id") REFERENCES "subjects"("biz_id","subject_type","subject_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_identity_providers" ADD CONSTRAINT "enterprise_identity_providers_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_identity_providers" ADD CONSTRAINT "enterprise_identity_providers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_identity_providers" ADD CONSTRAINT "enterprise_identity_providers_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_identity_providers" ADD CONSTRAINT "enterprise_identity_providers_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_inheritance_resolutions" ADD CONSTRAINT "enterprise_inheritance_resolutions_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_inheritance_resolutions" ADD CONSTRAINT "enterprise_inheritance_resolutions_strategy_id_enterprise_inheritance_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "enterprise_inheritance_strategies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_inheritance_resolutions" ADD CONSTRAINT "enterprise_inheritance_resolutions_target_biz_id_bizes_id_fk" FOREIGN KEY ("target_biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_inheritance_resolutions" ADD CONSTRAINT "enterprise_inheritance_resolutions_target_location_id_locations_id_fk" FOREIGN KEY ("target_location_id") REFERENCES "locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_inheritance_resolutions" ADD CONSTRAINT "enterprise_inheritance_resolutions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_inheritance_resolutions" ADD CONSTRAINT "enterprise_inheritance_resolutions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_inheritance_resolutions" ADD CONSTRAINT "enterprise_inheritance_resolutions_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_inheritance_resolutions" ADD CONSTRAINT "enterprise_inheritance_resolutions_biz_strategy_fk" FOREIGN KEY ("biz_id","strategy_id") REFERENCES "enterprise_inheritance_strategies"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_inheritance_resolutions" ADD CONSTRAINT "enterprise_inheritance_resolutions_target_location_fk" FOREIGN KEY ("target_biz_id","target_location_id") REFERENCES "locations"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_inheritance_resolutions" ADD CONSTRAINT "enterprise_inheritance_resolutions_target_subject_fk" FOREIGN KEY ("target_biz_id","target_subject_type","target_subject_id") REFERENCES "subjects"("biz_id","subject_type","subject_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_inheritance_strategies" ADD CONSTRAINT "enterprise_inheritance_strategies_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_inheritance_strategies" ADD CONSTRAINT "enterprise_inheritance_strategies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_inheritance_strategies" ADD CONSTRAINT "enterprise_inheritance_strategies_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_inheritance_strategies" ADD CONSTRAINT "enterprise_inheritance_strategies_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_accounts" ADD CONSTRAINT "enterprise_intercompany_accounts_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_accounts" ADD CONSTRAINT "enterprise_intercompany_accounts_source_biz_id_bizes_id_fk" FOREIGN KEY ("source_biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_accounts" ADD CONSTRAINT "enterprise_intercompany_accounts_counterparty_biz_id_bizes_id_fk" FOREIGN KEY ("counterparty_biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_accounts" ADD CONSTRAINT "enterprise_intercompany_accounts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_accounts" ADD CONSTRAINT "enterprise_intercompany_accounts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_accounts" ADD CONSTRAINT "enterprise_intercompany_accounts_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_entries" ADD CONSTRAINT "enterprise_intercompany_entries_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_entries" ADD CONSTRAINT "enterprise_intercompany_entries_intercompany_account_id_enterprise_intercompany_accounts_id_fk" FOREIGN KEY ("intercompany_account_id") REFERENCES "enterprise_intercompany_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_entries" ADD CONSTRAINT "enterprise_intercompany_entries_settlement_run_id_enterprise_intercompany_settlement_runs_id_fk" FOREIGN KEY ("settlement_run_id") REFERENCES "enterprise_intercompany_settlement_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_entries" ADD CONSTRAINT "enterprise_intercompany_entries_source_cross_biz_order_id_cross_biz_orders_id_fk" FOREIGN KEY ("source_cross_biz_order_id") REFERENCES "cross_biz_orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_entries" ADD CONSTRAINT "enterprise_intercompany_entries_source_payment_transaction_id_payment_transactions_id_fk" FOREIGN KEY ("source_payment_transaction_id") REFERENCES "payment_transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_entries" ADD CONSTRAINT "enterprise_intercompany_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_entries" ADD CONSTRAINT "enterprise_intercompany_entries_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_entries" ADD CONSTRAINT "enterprise_intercompany_entries_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_entries" ADD CONSTRAINT "enterprise_intercompany_entries_biz_account_fk" FOREIGN KEY ("biz_id","intercompany_account_id") REFERENCES "enterprise_intercompany_accounts"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_entries" ADD CONSTRAINT "enterprise_intercompany_entries_biz_settlement_run_fk" FOREIGN KEY ("biz_id","settlement_run_id") REFERENCES "enterprise_intercompany_settlement_runs"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_entries" ADD CONSTRAINT "enterprise_intercompany_entries_biz_cross_biz_order_fk" FOREIGN KEY ("biz_id","source_cross_biz_order_id") REFERENCES "cross_biz_orders"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_entries" ADD CONSTRAINT "enterprise_intercompany_entries_biz_payment_transaction_fk" FOREIGN KEY ("biz_id","source_payment_transaction_id") REFERENCES "payment_transactions"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_settlement_runs" ADD CONSTRAINT "enterprise_intercompany_settlement_runs_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_settlement_runs" ADD CONSTRAINT "enterprise_intercompany_settlement_runs_intercompany_account_id_enterprise_intercompany_accounts_id_fk" FOREIGN KEY ("intercompany_account_id") REFERENCES "enterprise_intercompany_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_settlement_runs" ADD CONSTRAINT "enterprise_intercompany_settlement_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_settlement_runs" ADD CONSTRAINT "enterprise_intercompany_settlement_runs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_settlement_runs" ADD CONSTRAINT "enterprise_intercompany_settlement_runs_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_intercompany_settlement_runs" ADD CONSTRAINT "enterprise_intercompany_settlement_runs_biz_account_fk" FOREIGN KEY ("biz_id","intercompany_account_id") REFERENCES "enterprise_intercompany_accounts"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_relationship_templates" ADD CONSTRAINT "enterprise_relationship_templates_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_relationship_templates" ADD CONSTRAINT "enterprise_relationship_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_relationship_templates" ADD CONSTRAINT "enterprise_relationship_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_relationship_templates" ADD CONSTRAINT "enterprise_relationship_templates_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_relationships" ADD CONSTRAINT "enterprise_relationships_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_relationships" ADD CONSTRAINT "enterprise_relationships_relationship_template_id_enterprise_relationship_templates_id_fk" FOREIGN KEY ("relationship_template_id") REFERENCES "enterprise_relationship_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_relationships" ADD CONSTRAINT "enterprise_relationships_from_biz_id_bizes_id_fk" FOREIGN KEY ("from_biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_relationships" ADD CONSTRAINT "enterprise_relationships_to_biz_id_bizes_id_fk" FOREIGN KEY ("to_biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_relationships" ADD CONSTRAINT "enterprise_relationships_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_relationships" ADD CONSTRAINT "enterprise_relationships_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_relationships" ADD CONSTRAINT "enterprise_relationships_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_relationships" ADD CONSTRAINT "enterprise_relationships_biz_template_fk" FOREIGN KEY ("biz_id","relationship_template_id") REFERENCES "enterprise_relationship_templates"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_scim_sync_states" ADD CONSTRAINT "enterprise_scim_sync_states_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_scim_sync_states" ADD CONSTRAINT "enterprise_scim_sync_states_identity_provider_id_enterprise_identity_providers_id_fk" FOREIGN KEY ("identity_provider_id") REFERENCES "enterprise_identity_providers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_scim_sync_states" ADD CONSTRAINT "enterprise_scim_sync_states_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_scim_sync_states" ADD CONSTRAINT "enterprise_scim_sync_states_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_scim_sync_states" ADD CONSTRAINT "enterprise_scim_sync_states_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enterprise_scim_sync_states" ADD CONSTRAINT "enterprise_scim_sync_states_biz_provider_fk" FOREIGN KEY ("biz_id","identity_provider_id") REFERENCES "enterprise_identity_providers"("biz_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fact_enterprise_compliance_daily" ADD CONSTRAINT "fact_enterprise_compliance_daily_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fact_enterprise_compliance_daily" ADD CONSTRAINT "fact_enterprise_compliance_daily_member_biz_id_bizes_id_fk" FOREIGN KEY ("member_biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fact_enterprise_compliance_daily" ADD CONSTRAINT "fact_enterprise_compliance_daily_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fact_enterprise_compliance_daily" ADD CONSTRAINT "fact_enterprise_compliance_daily_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fact_enterprise_compliance_daily" ADD CONSTRAINT "fact_enterprise_compliance_daily_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fact_enterprise_revenue_daily" ADD CONSTRAINT "fact_enterprise_revenue_daily_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fact_enterprise_revenue_daily" ADD CONSTRAINT "fact_enterprise_revenue_daily_member_biz_id_bizes_id_fk" FOREIGN KEY ("member_biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fact_enterprise_revenue_daily" ADD CONSTRAINT "fact_enterprise_revenue_daily_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fact_enterprise_revenue_daily" ADD CONSTRAINT "fact_enterprise_revenue_daily_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fact_enterprise_revenue_daily" ADD CONSTRAINT "fact_enterprise_revenue_daily_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fact_enterprise_utilization_daily" ADD CONSTRAINT "fact_enterprise_utilization_daily_biz_id_bizes_id_fk" FOREIGN KEY ("biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fact_enterprise_utilization_daily" ADD CONSTRAINT "fact_enterprise_utilization_daily_member_biz_id_bizes_id_fk" FOREIGN KEY ("member_biz_id") REFERENCES "bizes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fact_enterprise_utilization_daily" ADD CONSTRAINT "fact_enterprise_utilization_daily_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fact_enterprise_utilization_daily" ADD CONSTRAINT "fact_enterprise_utilization_daily_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fact_enterprise_utilization_daily" ADD CONSTRAINT "fact_enterprise_utilization_daily_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
