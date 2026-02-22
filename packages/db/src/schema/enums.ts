import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Central enum registry for the booking platform.
 *
 * Why this file exists:
 * - Keeps status/value vocabularies consistent across modules.
 * - Prevents drift between API layer and DB layer.
 * - Makes migrations deterministic when state machines evolve.
 *
 * How to extend safely:
 * - Add new values only after API/state-machine support exists.
 * - Avoid renaming existing values; add + deprecate instead.
 */

// -----------------------------------------------------------------------------
// Tenant + Identity scope
// -----------------------------------------------------------------------------

/** Biz operating model (impacts billing/features/reporting defaults). */
export const bizTypeEnum = pgEnum("biz_type", [
  "individual",
  "small_business",
  "enterprise",
]);

/** Shared soft-lifecycle for entities that are configurable content. */
export const lifecycleStatusEnum = pgEnum("lifecycle_status", [
  "draft",
  "active",
  "inactive",
  "archived",
]);

/**
 * Config dictionary promotion operation type.
 *
 * ELI5:
 * A promotion run either previews changes (`dry_run`), applies them, or rolls
 * a previous promotion back.
 */
export const bizConfigPromotionOperationEnum = pgEnum(
  "biz_config_promotion_operation",
  ["dry_run", "apply", "rollback"],
);

/** Promotion-run lifecycle for config-as-data deployments. */
export const bizConfigPromotionRunStatusEnum = pgEnum(
  "biz_config_promotion_run_status",
  ["queued", "running", "completed", "failed", "cancelled"],
);

/** Entity class affected by one promotion-run item row. */
export const bizConfigPromotionEntityTypeEnum = pgEnum(
  "biz_config_promotion_entity_type",
  ["set", "value", "binding"],
);

/** Mutation intent recorded by one promotion-run item row. */
export const bizConfigPromotionActionEnum = pgEnum(
  "biz_config_promotion_action",
  ["create", "update", "delete", "noop"],
);

/** Item-level execution status inside one promotion run. */
export const bizConfigPromotionItemStatusEnum = pgEnum(
  "biz_config_promotion_item_status",
  ["pending", "applied", "failed", "skipped"],
);

/** Location execution mode; used by scheduling + assignment + pricing scopes. */
export const locationTypeEnum = pgEnum("location_type", [
  "physical",
  "virtual",
  "mobile",
  "hybrid",
]);

/** Shared account can represent family customers or company-host groups. */
export const sharedAccountTypeEnum = pgEnum("shared_account_type", [
  "family",
  "company",
  "group",
]);

/** Party member roles drive delegation and permission semantics. */
export const sharedAccountMemberRoleEnum = pgEnum(
  "shared_account_member_role",
  ["primary", "adult", "minor", "dependent", "employee"],
);

/** Org membership roles used by admin/host APIs and access checks. */
export const orgMembershipRoleEnum = pgEnum("org_membership_role", [
  "owner",
  "admin",
  "manager",
  "staff",
  "host",
  "customer",
]);

// -----------------------------------------------------------------------------
// Resource + calendar scope
// -----------------------------------------------------------------------------

/**
 * Polymorphic resource category used by the core `resources` table.
 *
 * Important:
 * - This enum only models supply-side entities.
 * - Services are not resources; services are demand templates.
 */
export const resourceTypeEnum = pgEnum("resource_type", [
  "host",
  "company_host",
  "asset",
  "venue",
]);

/** Operational status for any resource (used by availability filtering). */
export const resourceStatusEnum = pgEnum("resource_status", [
  "active",
  "inactive",
  "maintenance",
  "retired",
]);

/** Calendar active/inactive toggle for schedule evaluation. */
export const calendarStatusEnum = pgEnum("calendar_status", [
  "active",
  "inactive",
]);

/**
 * Baseline availability behavior when no availability rules match.
 *
 * - `available_by_default`: open unless blocked by rules.
 * - `unavailable_by_default`: closed unless opened by rules.
 */
export const availabilityDefaultModeEnum = pgEnum(
  "availability_default_mode",
  ["available_by_default", "unavailable_by_default"],
);

/**
 * Availability rule window shape.
 *
 * - `recurring`: weekly/monthly/etc. rules with optional local-time window.
 * - `date_range`: calendar-date scoped rules (holidays, seasonal overrides).
 * - `timestamp_range`: exact instant windows for hard blocks and one-off events.
 */
export const availabilityRuleModeEnum = pgEnum("availability_rule_mode", [
  "recurring",
  "date_range",
  "timestamp_range",
]);

/**
 * Recurrence cadence for `availability_rules`.
 * `rrule` is a generic escape hatch for advanced patterns not covered by simple fields.
 */
export const availabilityRuleFrequencyEnum = pgEnum(
  "availability_rule_frequency",
  ["none", "daily", "weekly", "monthly", "yearly", "recurrence_rule"],
);

/**
 * Outcome directive of a matched availability rule.
 *
 * This name is intentionally explicit: each rule tells the scheduler what
 * should happen when the rule window matches a candidate slot.
 */
export const availabilityRuleOutcomeEnum = pgEnum("availability_rule_outcome", [
  "available",
  "unavailable",
  "override_hours",
  "special_pricing",
]);

/** One-off availability exceptions layered over weekly rules. */
export const availabilityExceptionTypeEnum = pgEnum(
  "availability_exception_type",
  ["closed", "modified_hours", "special_pricing", "holiday"],
);

// -----------------------------------------------------------------------------
// Services + bookings scope
// -----------------------------------------------------------------------------

/** Service semantic type (used for UX and downstream policy selection). */
export const serviceTypeEnum = pgEnum("service_type", [
  "appointment",
  "class",
  "rental",
  "multi_day",
  "call",
]);

/**
 * Service catalog visibility level.
 *
 * - `public`: visible to customer-facing channels.
 * - `private`: hidden from public channels; available by direct/admin flow.
 * - `internal`: operational-only template.
 */
export const serviceVisibilityEnum = pgEnum("service_visibility", [
  "public",
  "private",
  "internal",
]);

/**
 * Commercial classification for time-based service products.
 *
 * - `booking`: service/host-first experiences.
 * - `rental`: asset/venue-first experiences.
 * - `hybrid`: mixed compositions across both models.
 */
export const serviceProductKindEnum = pgEnum("service_product_kind", [
  "booking",
  "rental",
  "hybrid",
]);

/** Duration planning mode for availability + pricing computation. */
export const durationModeEnum = pgEnum("duration_mode", [
  "fixed",
  "flexible",
  "multi_day",
]);

/**
 * High-level product class.
 *
 * Keep this generic so one catalog can cover physical goods, digital goods,
 * fees, memberships, and service-linked products.
 */
export const productTypeEnum = pgEnum("product_type", [
  "physical",
  "digital",
  "service",
  "membership",
  "pass",
  "credit_pack",
  "fee",
  "other",
]);

/**
 * Shared required/optional semantics used across composition modules.
 *
 * Why this is shared:
 * - offer components, service-product requirements, and bundle components all
 *   represent the same core concept: whether a component is mandatory.
 */
export const requirementModeEnum = pgEnum("requirement_mode", [
  "required",
  "optional",
]);

/**
 * Shared selector-evaluation mode across requirement systems.
 *
 * - `any`: one matching selector path is enough.
 * - `all`: all selector paths must contribute.
 */
export const selectorMatchModeEnum = pgEnum("selector_match_mode", [
  "any",
  "all",
]);

/**
 * Shared selector shape for resource-matching systems.
 *
 * This keeps offer and service-product matching contracts aligned, so the same
 * matching engine can reason about both domains consistently.
 *
 * Streamline note:
 * - Category-specific selector branches were removed.
 * - Use `capability_template` for reusable taxonomy and classification across
 *   all supply types.
 */
export const resourceSelectorTypeEnum = pgEnum(
  "resource_selector_type",
  [
    "any",
    "resource",
    "resource_type",
    "capability_template",
    "location",
    "custom_subject",
  ],
);

/** Channel where booking was created (analytics + policy branching). */
export const bookingSourceEnum = pgEnum("booking_source", [
  "web",
  "mobile",
  "admin",
  "phone",
  "api",
  "import",
  "marketplace",
  "kiosk",
]);

/** Segment mode for hybrid bookings with multiple legs. */
export const bookingSegmentModeEnum = pgEnum("booking_segment_mode", [
  "in_person",
  "virtual",
  "phone",
]);

/** Per-participant attendance/participation status. */
export const bookingParticipantStatusEnum = pgEnum(
  "booking_participant_status",
  ["invited", "confirmed", "checked_in", "cancelled", "no_show"],
);

/** Assignment confirmation lifecycle for hosts/resources. */
export const bookingAssignmentStatusEnum = pgEnum("booking_assignment_status", [
  "pending",
  "confirmed",
  "declined",
  "replaced",
]);

// -----------------------------------------------------------------------------
// Reservation + waitlist scope
// -----------------------------------------------------------------------------

/** Reservation state before conversion to booking. */
export const reservationStatusEnum = pgEnum("reservation_status", [
  "active",
  "expired",
  "converted",
  "cancelled",
]);

/** Why a hold exists (used in expiration and telemetry logic). */
export const reservationHoldReasonEnum = pgEnum("reservation_hold_reason", [
  "checkout",
  "cooldown",
  "manual",
  "sync",
  "waitlist_offer",
]);

/** Waitlist strategy model. */
export const waitlistModeEnum = pgEnum("waitlist_mode", ["queue", "race"]);

/** Waitlist entry lifecycle. */
export const waitlistStatusEnum = pgEnum("waitlist_status", [
  "waiting",
  "offered",
  "accepted",
  "expired",
  "cancelled",
  "converted",
]);

// -----------------------------------------------------------------------------
// Pricing + fee scope
// -----------------------------------------------------------------------------

/** Matching dimension for manual pricing rules. */
export const pricingRuleTypeEnum = pgEnum("pricing_rule_type", [
  "base_override",
  "day_of_week",
  "time_window",
  "date_range",
  "holiday",
  "manual",
]);

/** How the matched rule transforms price. */
export const pricingAdjustmentTypeEnum = pgEnum("pricing_adjustment_type", [
  "set_price",
  "fixed_amount",
  "percentage",
]);

/** Classification of adjustment output for accounting + UI labels. */
export const pricingApplyAsEnum = pgEnum("pricing_apply_as", [
  "base_price",
  "discount",
  "surcharge",
  "call_fee",
  "booking_fee",
  "after_hours_fee",
  "emergency_fee",
]);

/**
 * Which kind of demand signal is being measured.
 *
 * These represent common demand-side and supply-pressure indicators.
 * Values are intentionally generic so one model can support many industries.
 */
export const demandSignalKindEnum = pgEnum("demand_signal_kind", [
  "quote_requests",
  "checkout_starts",
  "booking_conversions",
  "waitlist_depth",
  "search_views",
  "cancellation_rate",
  "no_show_rate",
  "capacity_utilization",
  "manual_index",
  "external_index",
]);

/**
 * Aggregation method used when rolling raw events into one signal value.
 *
 * Example:
 * - quote request count could use `sum`,
 * - utilization could use `avg` or `max`,
 * - volatility risk could use `p95`.
 */
export const demandSignalAggregationMethodEnum = pgEnum(
  "demand_signal_aggregation_method",
  ["sum", "avg", "min", "max", "p50", "p90", "p95", "latest"],
);

/**
 * Source of a demand observation.
 *
 * - `system`: computed from first-party events.
 * - `manual`: admin/operator-entered value.
 * - `import`: batch import from external source.
 * - `forecast`: projected value from prediction model.
 */
export const demandSignalSourceEnum = pgEnum("demand_signal_source", [
  "system",
  "manual",
  "import",
  "forecast",
]);

/**
 * Where an automated demand-pricing policy applies.
 *
 * Exactly one target payload should be present for each policy row.
 */
export const demandPricingTargetTypeEnum = pgEnum("demand_pricing_target_type", [
  "global",
  "resource",
  "service",
  "service_product",
  "offer",
  "offer_version",
  "location",
]);

/** Lifecycle of one automated demand-pricing policy. */
export const demandPricingPolicyStatusEnum = pgEnum("demand_pricing_policy_status", [
  "draft",
  "active",
  "inactive",
  "archived",
]);

/**
 * Score model used to combine multiple signals.
 *
 * - `weighted_sum`: weighted sum of normalized signal values.
 * - `max_signal`: use highest transformed signal.
 * - `manual_only`: bypass formula and use operator supplied score.
 */
export const demandPricingScoringModeEnum = pgEnum(
  "demand_pricing_scoring_mode",
  ["weighted_sum", "max_signal", "manual_only"],
);

/** Outcome of one demand-pricing evaluation attempt. */
export const demandPricingEvaluationStatusEnum = pgEnum(
  "demand_pricing_evaluation_status",
  ["applied", "no_match", "capped", "blocked", "error"],
);

/** Canonical fee categories used by policies and applied booking fees. */
export const feeTypeEnum = pgEnum("fee_type", [
  "phone_booking",
  "discovery_call",
  "onsite_visit",
  "after_hours",
  "emergency_callout",
  "late_cancel",
  "no_show",
]);

/** Fee application trigger moment in lifecycle. */
export const feeTriggerEnum = pgEnum("fee_trigger", [
  "on_booking",
  "on_confirmation",
  "on_arrival",
  "on_no_show",
  "on_late_cancel",
  "manual",
]);

/** Resolution state for fee records once attached to a booking/order. */
export const feeStatusEnum = pgEnum("fee_status", [
  "applied",
  "waived",
  "credited",
  "refunded",
]);

// -----------------------------------------------------------------------------
// Payment + ledger scope
// -----------------------------------------------------------------------------

/** High-level payable status used across bookings/orders/intents. */
export const paymentStatusEnum = pgEnum("payment_status", [
  "unpaid",
  "pending",
  "partial",
  "paid",
  "refunded",
  "disputed",
  "voided",
]);

/** Provider intent lifecycle (Stripe payment/setup intent style). */
export const paymentIntentStatusEnum = pgEnum("payment_intent_status", [
  "requires_payment_method",
  "requires_confirmation",
  "requires_capture",
  "processing",
  "succeeded",
  "partially_paid",
  "failed",
  "cancelled",
  "refunded",
]);

/**
 * Immutable event taxonomy for payment-intent transition ledgers.
 *
 * Row snapshots answer "what is the status now?"
 * Event rows answer "how did we get here?".
 */
export const paymentIntentEventTypeEnum = pgEnum("payment_intent_event_type", [
  "created",
  "status_changed",
  "amount_updated",
  "authorized",
  "captured",
  "partially_captured",
  "failed",
  "cancelled",
  "refunded",
  "metadata_updated",
]);

/** Financial movement type for transactions table. */
export const transactionTypeEnum = pgEnum("transaction_type", [
  "authorization",
  "capture",
  "void",
  "refund",
  "adjustment",
  "fee",
  "chargeback",
]);

/** Transaction processing outcome. */
export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",
  "succeeded",
  "failed",
]);

/** Where money came from in split tender flows. */
export const allocationSourceTypeEnum = pgEnum("allocation_source_type", [
  "card",
  "wallet",
  "gift_card",
  "cash",
  "bank_transfer",
  "credit",
]);

/** What business component got paid/refunded. */
export const allocationTargetTypeEnum = pgEnum("allocation_target_type", [
  "service",
  "product",
  "fee",
  "tax",
  "deposit",
  "tip",
]);

/** Dispute lifecycle; maps cleanly to Stripe dispute handling. */
export const disputeStatusEnum = pgEnum("dispute_status", [
  "needs_response",
  "under_review",
  "won",
  "lost",
  "closed",
]);

// -----------------------------------------------------------------------------
// Program/package/membership scope
// -----------------------------------------------------------------------------

/** Enrollment status in a multi-session program. */
export const programEnrollmentStatusEnum = pgEnum("program_enrollment_status", [
  "active",
  "paused",
  "completed",
  "cancelled",
]);

/** Package wallet lifecycle from purchase to depletion/expiry. */
export const packageWalletStatusEnum = pgEnum("package_wallet_status", [
  "active",
  "expired",
  "depleted",
  "cancelled",
]);

/** Membership billing lifecycle. */
export const membershipSubscriptionStatusEnum = pgEnum(
  "membership_subscription_status",
  ["trialing", "active", "paused", "past_due", "cancelled", "expired"],
);

// -----------------------------------------------------------------------------
// Reliability/infra scope
// -----------------------------------------------------------------------------

/** Outbox event delivery status for async integrations/webhooks. */
export const outboxStatusEnum = pgEnum("outbox_status", [
  "pending",
  "processing",
  "published",
  "failed",
  "dead_letter",
]);

/** Idempotency key execution state. */
export const idempotencyStatusEnum = pgEnum("idempotency_status", [
  "processing",
  "completed",
  "failed",
]);

/** Registry source of an extension/integration package. */
export const extensionSourceTypeEnum = pgEnum("extension_source_type", [
  "first_party",
  "partner",
  "third_party",
  "private",
]);

/**
 * Runtime execution surface for extension hooks.
 *
 * - `internal`: handler runs inside the Bizing app process/workers.
 * - `webhook`: handler is an external HTTP endpoint.
 */
export const extensionRuntimeTypeEnum = pgEnum("extension_runtime_type", [
  "internal",
  "webhook",
]);

/** Installation lifecycle for a biz-specific extension install. */
export const extensionInstallStatusEnum = pgEnum("extension_install_status", [
  "active",
  "disabled",
  "suspended",
  "uninstalled",
]);

/** Lifecycle-event source classification for observability and debugging. */
export const lifecycleEventSourceEnum = pgEnum("lifecycle_event_source", [
  "api",
  "system",
  "workflow",
  "integration",
  "manual",
  "migration",
]);

/**
 * Hook phase lets subscribers choose whether they run before or after a domain
 * action is committed.
 */
export const lifecycleEventPhaseEnum = pgEnum("lifecycle_event_phase", [
  "before",
  "after",
]);

/** Delivery path for one lifecycle-event subscription. */
export const extensionHookDeliveryModeEnum = pgEnum(
  "extension_hook_delivery_mode",
  ["internal_handler", "webhook"],
);

/**
 * Scope used by extension permission grants and extension state records.
 *
 * ELI5:
 * - `biz`: applies to the whole business.
 * - `location`: applies only to one location.
 * - `custom_subject`: applies to one extensible subject from `subjects`.
 */
export const extensionScopeEnum = pgEnum("extension_scope", [
  "biz",
  "location",
  "custom_subject",
]);

/**
 * Allow/deny effect for extension permissions.
 *
 * Why this exists:
 * - Explicit deny is useful for "install is active, but this capability is blocked".
 * - Keeping this normalized avoids hidden policy logic in JSON blobs.
 */
export const extensionPermissionEffectEnum = pgEnum(
  "extension_permission_effect",
  ["allow", "deny"],
);

/**
 * Relationship direction model for `subject_relationships`.
 *
 * - `directed`: A -> B is different from B -> A.
 * - `undirected`: A <-> B should be treated as symmetric.
 */
export const subjectRelationshipDirectionEnum = pgEnum(
  "subject_relationship_direction",
  ["directed", "undirected"],
);

/** Scope for custom field definitions. */
export const customFieldScopeEnum = pgEnum("custom_field_scope", [
  "biz",
  "location",
]);

/**
 * Target classes that can receive custom fields.
 *
 * Keep this list broad and domain-neutral so extensions can use one uniform
 * contract across scheduling, commerce, and operations.
 */
export const customFieldTargetTypeEnum = pgEnum("custom_field_target_type", [
  "biz",
  "location",
  "user",
  "group_account",
  "resource",
  "service",
  "service_product",
  "offer",
  "offer_version",
  "product",
  "sellable",
  "booking_order",
  "booking_order_line",
  "fulfillment_unit",
  "payment_intent",
  "queue_entry",
  "trip",
  "custom",
]);

/**
 * Storage/validation type for custom fields.
 *
 * All values are stored as JSON in `custom_field_values.value`, while optional
 * search projection columns can be filled for faster filtering.
 */
export const customFieldDataTypeEnum = pgEnum("custom_field_data_type", [
  "short_text",
  "long_text",
  "number",
  "boolean",
  "date",
  "datetime",
  "single_select",
  "multi_select",
  "currency",
  "email",
  "phone",
  "url",
  "json",
]);

/** Visibility policy for custom fields in APIs/UIs. */
export const customFieldVisibilityEnum = pgEnum("custom_field_visibility", [
  "public",
  "internal",
  "private",
  "system",
]);

/** Who set the current custom field value. */
export const customFieldValueSourceEnum = pgEnum("custom_field_value_source", [
  "user",
  "system",
  "extension",
  "import",
  "migration",
]);

// -----------------------------------------------------------------------------
// Data collection + communication + growth scope
// -----------------------------------------------------------------------------

/**
 * High-level template class used by interaction/form workflows.
 *
 * These values are intentionally broad so one schema can support:
 * - intake questionnaires,
 * - legal waivers/releases,
 * - checklist-style preconditions,
 * - survey-style questionnaires.
 */
export const interactionTemplateTypeEnum = pgEnum("interaction_template_type", [
  "intake_form",
  "waiver",
  "release_form",
  "checklist",
  "survey",
  "other",
]);

/** Whether a bound interaction/checklist is mandatory for progression. */
export const interactionRequirementModeEnum = pgEnum(
  "interaction_requirement_mode",
  ["required", "optional"],
);

/** Assignment lifecycle for form/checklist obligations. */
export const interactionAssignmentStatusEnum = pgEnum(
  "interaction_assignment_status",
  ["pending", "in_progress", "completed", "expired", "waived", "cancelled"],
);

/** Submission lifecycle for one interaction attempt. */
export const interactionSubmissionStatusEnum = pgEnum(
  "interaction_submission_status",
  ["draft", "submitted", "accepted", "rejected", "withdrawn", "expired"],
);

/** Stored artifact type for uploads/evidence/signatures. */
export const interactionArtifactTypeEnum = pgEnum("interaction_artifact_type", [
  "file",
  "image",
  "video",
  "audio",
  "pdf",
  "signature",
  "other",
]);

/** How a signer produced the signature. */
export const signatureMethodEnum = pgEnum("signature_method", [
  "typed",
  "drawn",
  "click_accept",
  "uploaded",
]);

/** Role of the signer for legal/compliance chains. */
export const signatureSignerRoleEnum = pgEnum("signature_signer_role", [
  "customer",
  "guardian",
  "witness",
  "provider",
  "staff",
  "other",
]);

/**
 * Task/checklist item category.
 *
 * This keeps checklist semantics queryable while still allowing custom item
 * behavior through metadata payloads.
 */
export const requirementItemTypeEnum = pgEnum("requirement_item_type", [
  "confirm",
  "upload",
  "watch",
  "purchase",
  "attestation",
  "custom",
]);

/** Progress state for one checklist task instance. */
export const requirementItemStatusEnum = pgEnum("requirement_item_status", [
  "pending",
  "blocked",
  "completed",
  "skipped",
  "waived",
]);

/** Communication transport channel. */
export const communicationChannelEnum = pgEnum("communication_channel", [
  "sms",
  "email",
  "push",
  "whatsapp",
  "postal",
  "voice",
  "webhook",
]);

/** Purpose classification used by consent and policy engines. */
export const communicationPurposeEnum = pgEnum("communication_purpose", [
  "transactional",
  "marketing",
  "operational",
  "legal",
]);

/** Consent state for one subject/channel/purpose tuple. */
export const communicationConsentStatusEnum = pgEnum(
  "communication_consent_status",
  ["opted_in", "opted_out", "suppressed"],
);

/** Source of consent state change (for legal traceability). */
export const communicationConsentSourceEnum = pgEnum(
  "communication_consent_source",
  ["user_action", "admin_override", "import", "system", "legal_update"],
);

/** Delivery status for outbound communication messages. */
export const messageDeliveryStatusEnum = pgEnum("message_delivery_status", [
  "queued",
  "processing",
  "sent",
  "delivered",
  "failed",
  "bounced",
  "opened",
  "clicked",
  "replied",
  "cancelled",
  "suppressed",
]);

/** Detailed event timeline for outbound message telemetry. */
export const messageEventTypeEnum = pgEnum("message_event_type", [
  "queued",
  "sent",
  "delivered",
  "failed",
  "bounced",
  "opened",
  "clicked",
  "replied",
  "complained",
  "unsubscribed",
  "other",
]);

/** Campaign lifecycle for marketing/engagement journey definitions. */
export const marketingCampaignStatusEnum = pgEnum("marketing_campaign_status", [
  "draft",
  "active",
  "paused",
  "completed",
  "archived",
]);

/** Step type in a journey graph. */
export const marketingCampaignStepTypeEnum = pgEnum(
  "marketing_campaign_step_type",
  ["delay", "message", "condition", "exit"],
);

/** Enrollment status for one subject participating in one campaign. */
export const marketingEnrollmentStatusEnum = pgEnum(
  "marketing_enrollment_status",
  ["active", "completed", "exited", "failed", "paused"],
);

/** Survey question input style. */
export const surveyQuestionTypeEnum = pgEnum("survey_question_type", [
  "rating",
  "nps",
  "single_choice",
  "multi_choice",
  "text",
  "boolean",
]);

/** Invitation state for survey delivery workflows. */
export const surveyInvitationStatusEnum = pgEnum("survey_invitation_status", [
  "pending",
  "sent",
  "opened",
  "completed",
  "expired",
  "cancelled",
]);

/** Response lifecycle for one survey response attempt. */
export const surveyResponseStatusEnum = pgEnum("survey_response_status", [
  "started",
  "completed",
  "abandoned",
  "rejected",
]);

/** Whether a survey response is attributable to a known subject identity. */
export const surveyResponseVisibilityEnum = pgEnum(
  "survey_response_visibility",
  ["identified", "anonymous", "pseudonymous"],
);

/** Promotional discount campaign lifecycle. */
export const discountCampaignStatusEnum = pgEnum("discount_campaign_status", [
  "draft",
  "active",
  "paused",
  "expired",
  "archived",
]);

/** Commercial discount mechanic. */
export const discountTypeEnum = pgEnum("discount_type", [
  "percentage",
  "fixed_amount",
  "free_item",
  "free_service",
]);

/** Target commercial surface for discount application. */
export const discountScopeEnum = pgEnum("discount_scope", [
  "order",
  "line_item",
  "sellable",
  "service_product",
  "offer_version",
]);

/** How discount campaigns compose with each other. */
export const discountStackingModeEnum = pgEnum("discount_stacking_mode", [
  "exclusive",
  "stackable",
  "capped_stack",
]);

/** Redemption status for one discount usage record. */
export const discountRedemptionStatusEnum = pgEnum(
  "discount_redemption_status",
  ["reserved", "applied", "voided", "reversed"],
);

/**
 * Reusable work-template family for operational workflows.
 *
 * One enum powers many industries:
 * - construction site reports
 * - employee/contractor timesheets
 * - inspections and punch lists
 * - multi-party signoff processes
 */
export const workTemplateKindEnum = pgEnum("work_template_kind", [
  "report",
  "timesheet",
  "checklist",
  "inspection",
  "punch_list",
  "signoff",
  "form",
  "custom",
]);

/** Runtime lifecycle for one instantiated work run. */
export const workRunStatusEnum = pgEnum("work_run_status", [
  "draft",
  "active",
  "submitted",
  "approved",
  "rejected",
  "completed",
  "cancelled",
  "archived",
]);

/** Step shape in a work template. */
export const workStepTypeEnum = pgEnum("work_step_type", [
  "field",
  "check_item",
  "action",
  "approval_gate",
  "custom",
]);

/** Runtime status for one work-run step instance. */
export const workStepStatusEnum = pgEnum("work_step_status", [
  "pending",
  "in_progress",
  "completed",
  "blocked",
  "failed",
  "skipped",
]);

/** Logged entry category inside a work run. */
export const workEntryTypeEnum = pgEnum("work_entry_type", [
  "note",
  "labor",
  "material",
  "expense",
  "mileage",
  "incident",
  "weather",
  "measurement",
  "custom",
]);

/** Approval state for one entry record (when moderation is required). */
export const workEntryStatusEnum = pgEnum("work_entry_status", [
  "logged",
  "submitted",
  "approved",
  "rejected",
  "voided",
]);

/** Clock segment category for timesheet semantics. */
export const workTimeSegmentTypeEnum = pgEnum("work_time_segment_type", [
  "work",
  "break",
  "travel",
  "standby",
  "overtime",
]);

/** Source of clock events for fraud/risk and device diagnostics. */
export const workClockSourceEnum = pgEnum("work_clock_source", [
  "mobile",
  "kiosk",
  "web",
  "api",
  "import",
]);

/** Routing mode for approval chains. */
export const workApprovalRoutingModeEnum = pgEnum(
  "work_approval_routing_mode",
  ["sequential", "parallel"],
);

/** Assignee selector for one approval node. */
export const workApprovalAssigneeTypeEnum = pgEnum(
  "work_approval_assignee_type",
  ["user", "group_account", "role", "external"],
);

/** Decision outcome for one approval node. */
export const workApprovalDecisionEnum = pgEnum("work_approval_decision", [
  "pending",
  "approved",
  "rejected",
  "delegated",
  "skipped",
]);


// ---------------------------------------------------------------------------
// Canonical booking domain enums (merged)
// ---------------------------------------------------------------------------

/**
 * Canonical booking enum registry.
 *
 * ELI5:
 * Think of enums as official word lists. If we allow everyone to invent words,
 * we get messy data very quickly. Enums keep state machines deterministic,
 * queryable, and safe for long-term migrations.
 *
 * Future improvement note:
 * If some enums become customer-configurable dictionaries, keep the enum as a
 * small stable "system mode" and move labels/extra behavior to config tables.
 */

// ---------------------------------------------------------------------------
// Offers domain
// ---------------------------------------------------------------------------

/** How an offer is fulfilled operationally. */
export const offerExecutionModeEnum = pgEnum("offer_execution_mode", [
  "slot",
  "queue",
  "request",
  "auction",
  "async",
  "route_trip",
  "open_access",
  "itinerary",
]);

/** Lifecycle state for offer shells. */
export const offerStatusEnum = pgEnum("offer_status", [
  "draft",
  "active",
  "inactive",
  "archived",
]);

/** Immutable version lifecycle for published commercial snapshots. */
export const offerVersionStatusEnum = pgEnum("offer_version_status", [
  "draft",
  "published",
  "superseded",
  "retired",
]);

/** Offer component mode uses shared required/optional semantics. */
export const offerComponentModeEnum = requirementModeEnum;

/** Offer component target type matches the canonical resource taxonomy. */
export const offerComponentTargetTypeEnum = resourceTypeEnum;

/** Offer component selector type uses shared resource selector shape. */
export const offerComponentSelectorTypeEnum = resourceSelectorTypeEnum;

/** Offer selector match mode uses shared any/all semantics. */
export const offerComponentSelectorMatchModeEnum = selectorMatchModeEnum;

/** How a seat class changes pricing on top of base amount. */
export const offerSeatPricingModeEnum = pgEnum("offer_seat_pricing_mode", [
  "included",
  "surcharge",
  "multiplier",
]);

// ---------------------------------------------------------------------------
// Catalog composition + inventory domain
// ---------------------------------------------------------------------------

/**
 * Canonical sellable identity kind.
 *
 * Why this exists:
 * - lets the platform speak one commercial language across:
 *   products, service products, offers, and direct resource-time rates
 * - powers unified reporting ("top selling sellable" regardless of source type)
 */
export const sellableKindEnum = pgEnum("sellable_kind", [
  "product",
  "service_product",
  "offer_version",
  "resource_rate",
]);

/**
 * Billing unit for direct resource-time sellables.
 *
 * Examples:
 * - host billed per hour,
 * - venue billed per day,
 * - fixed dispatch/session fee.
 */
export const resourceRateUnitEnum = pgEnum("resource_rate_unit", [
  "flat",
  "per_minute",
  "per_hour",
  "per_day",
  "per_session",
]);

/**
 * How one bundle's commercial price is derived from its components.
 *
 * - `fixed_bundle_price`: use the bundle product's own base price.
 * - `sum_components`: derive total from component pricing behavior.
 * - `hybrid`: mix fixed base with component adjustments.
 */
export const bundlePricingModeEnum = pgEnum("bundle_pricing_mode", [
  "fixed_bundle_price",
  "sum_components",
  "hybrid",
]);

/**
 * Which sellable primitive a bundle component points to.
 *
 * We keep this intentionally small and explicit:
 * - generic catalog product,
 * - schedule-aware service product,
 * - direct offer shell.
 */
export const bundleComponentTargetTypeEnum = pgEnum(
  "bundle_component_target_type",
  ["product", "service_product", "offer"],
);

/**
 * Pricing behavior of one component inside a bundle.
 *
 * - `included`: component is included in bundle base.
 * - `fixed_override`: component uses explicit fixed amount.
 * - `surcharge`: component adds surcharge on top of base.
 * - `multiplier`: component scales amount by multiplier.
 */
export const bundleComponentPriceModeEnum = pgEnum(
  "bundle_component_price_mode",
  ["included", "fixed_override", "surcharge", "multiplier"],
);

/**
 * Inventory storage scope.
 *
 * This supports physical + virtual stock contexts:
 * warehouses, storefront bins, service vehicles, or virtual pools.
 */
export const inventoryLocationKindEnum = pgEnum("inventory_location_kind", [
  "warehouse",
  "storefront",
  "vehicle",
  "virtual",
  "supplier",
  "third_party",
  "customer_site",
]);

/**
 * Immutable inventory movement vocabulary for stock ledger rows.
 *
 * Direction comes from signed `quantity_delta` in movement rows.
 */
export const inventoryMovementTypeEnum = pgEnum("inventory_movement_type", [
  "opening_balance",
  "receive",
  "reserve",
  "release",
  "commit",
  "adjustment_increase",
  "adjustment_decrease",
  "transfer_in",
  "transfer_out",
  "return_in",
  "return_to_vendor",
  "damage",
  "shrinkage",
  "cycle_count",
]);

/** Lifecycle of one stock reservation tied to commercial/fulfillment context. */
export const inventoryReservationStatusEnum = pgEnum(
  "inventory_reservation_status",
  [
    "reserved",
    "partially_committed",
    "committed",
    "released",
    "expired",
    "cancelled",
  ],
);

/** Delivery method class for physical fulfillment workflows. */
export const physicalFulfillmentMethodEnum = pgEnum(
  "physical_fulfillment_method",
  [
    "shipment",
    "pickup",
    "onsite_handover",
    "locker_pickup",
    "third_party_delivery",
  ],
);

/** Shipment/pick-pack lifecycle state for physical order fulfillment. */
export const physicalFulfillmentStatusEnum = pgEnum(
  "physical_fulfillment_status",
  [
    "draft",
    "allocated",
    "picking",
    "packed",
    "shipped",
    "out_for_delivery",
    "delivered",
    "returned",
    "cancelled",
    "failed",
  ],
);

/** Line-level status of one product inside a physical fulfillment. */
export const physicalFulfillmentItemStatusEnum = pgEnum(
  "physical_fulfillment_item_status",
  [
    "pending",
    "allocated",
    "picked",
    "packed",
    "shipped",
    "delivered",
    "returned",
    "cancelled",
  ],
);

// ---------------------------------------------------------------------------
// Supply / maintenance domain
// ---------------------------------------------------------------------------

/** Supply class this capability template applies to. */
export const resourceCapabilityScopeEnum = pgEnum(
  "resource_capability_scope",
  ["host", "company_host", "asset", "venue"],
);

/** Condition report type for lifecycle checkpoints on a resource. */
export const resourceConditionReportTypeEnum = pgEnum(
  "resource_condition_report_type",
  ["pre_use", "post_use", "inspection", "incident", "return_check"],
);

/** Trigger category for automatic maintenance policy evaluation. */
export const maintenanceTriggerTypeEnum = pgEnum("maintenance_trigger_type", [
  "usage_hours",
  "usage_count",
  "elapsed_days",
  "calendar_date",
  "manual",
]);

/** Effect taken when a maintenance policy threshold is hit. */
export const maintenanceActionTypeEnum = pgEnum("maintenance_action_type", [
  "create_work_order",
  "block_resource",
  "warn_only",
  "notify_only",
]);

/** Work order lifecycle state. */
export const maintenanceWorkOrderStatusEnum = pgEnum(
  "maintenance_work_order_status",
  ["open", "scheduled", "in_progress", "completed", "cancelled", "deferred"],
);

// ---------------------------------------------------------------------------
// Time and availability domain
// ---------------------------------------------------------------------------

/** Who owns a calendar. */
export const calendarOwnerTypeEnum = pgEnum("calendar_owner_type", [
  "biz",
  "user",
  "resource",
  "service",
  "service_product",
  "offer",
  "offer_version",
  "location",
  "custom_subject",
]);

/**
 * External calendar provider key.
 *
 * We keep this enum small on purpose:
 * - avoids provider-specific table forks in the core schema
 * - gives one stable discriminator for sync engines and auth flows
 */
export const calendarSyncProviderEnum = pgEnum("calendar_sync_provider", [
  "google",
  "microsoft",
  "apple",
  "ical",
  "other",
]);

/** Lifecycle state of one connected external calendar account. */
export const calendarSyncConnectionStatusEnum = pgEnum(
  "calendar_sync_connection_status",
  ["active", "reauth_required", "paused", "error", "revoked"],
);

/** Sync lifecycle of one external calendar feed under a connection. */
export const externalCalendarSyncStateEnum = pgEnum("external_calendar_sync_state", [
  "pending",
  "active",
  "paused",
  "error",
]);

/**
 * What one biz is allowed to see from a user's shared calendars.
 *
 * - `free_busy`: only busy blocks, no event text/details
 * - `masked_details`: limited event text allowed by policy
 * - `full_details`: full event details allowed
 *
 * This level applies uniformly whether source events came from:
 * - internal Bizing calendars (user-owned calendar bindings), or
 * - external connected calendars (Google/Microsoft/etc).
 */
export const calendarAccessLevelEnum = pgEnum("calendar_access_level", [
  "free_busy",
  "masked_details",
  "full_details",
]);

/**
 * How a user->biz calendar grant chooses which sources are visible.
 *
 * - `all_sources`: every eligible source owned by this user is visible
 * - `selected_sources`: only explicit rows in `calendar_access_grant_sources`
 */
export const calendarGrantScopeEnum = pgEnum("calendar_grant_scope", [
  "all_sources",
  "selected_sources",
]);

/** Access grant lifecycle between one user and one biz. */
export const calendarAccessGrantStatusEnum = pgEnum("calendar_access_grant_status", [
  "granted",
  "revoked",
  "expired",
]);

/**
 * Source kinds that can be shared under one user->biz calendar grant.
 *
 * - `external_calendar`: a connected provider feed (Google, Outlook, etc)
 * - `internal_user_calendar_binding`: a Bizing calendar binding with
 *   `owner_type='user'`, scoped to a specific source biz.
 */
export const calendarGrantSourceTypeEnum = pgEnum("calendar_grant_source_type", [
  "external_calendar",
  "internal_user_calendar_binding",
]);

/** Busy-state projection for one external event after normalization. */
export const externalCalendarEventBusyStatusEnum = pgEnum(
  "external_calendar_event_busy_status",
  ["free", "tentative", "busy", "out_of_office", "unknown"],
);

/** Provider event lifecycle after normalization. */
export const externalCalendarEventStatusEnum = pgEnum(
  "external_calendar_event_status",
  ["confirmed", "tentative", "cancelled"],
);

/** Active/inactive state for operational schedule usage. */
export const calendarOverlayKindEnum = pgEnum("calendar_overlay_kind", [
  "base",
  "blackout",
  "seasonal",
  "maintenance",
  "emergency",
  "promo",
]);

/** How an availability rule modifies candidate time windows. */
export const availabilityRuleActionEnum = pgEnum("availability_rule_action", [
  "available",
  "unavailable",
  "override_hours",
  "special_pricing",
  "capacity_adjustment",
]);

/**
 * Deterministic evaluation order for availability rules.
 *
 * Why this exists:
 * - two businesses can have identical rules but prefer different evaluation
 *   semantics,
 * - keeping this as explicit data avoids hidden hardcoded sort behavior.
 */
export const calendarRuleEvaluationOrderEnum = pgEnum(
  "calendar_rule_evaluation_order",
  ["priority_asc", "priority_desc", "specificity_then_priority"],
);

/**
 * Tie-break strategy when overlapping rules produce conflicting actions.
 *
 * ELI5:
 * if one rule says "available" and another says "unavailable" for the same
 * moment, this value decides who wins.
 */
export const calendarConflictResolutionModeEnum = pgEnum(
  "calendar_conflict_resolution_mode",
  ["priority_wins", "unavailable_wins", "available_wins", "most_restrictive_wins"],
);

/**
 * How a rule-template binding composes with calendar-local rule rows.
 *
 * - `append`: template rows are added as extra rules.
 * - `template_precedence`: template rows are evaluated before local rows.
 * - `template_only`: ignore calendar-local rows while this binding is active.
 */
export const calendarTemplateMergeModeEnum = pgEnum("calendar_template_merge_mode", [
  "append",
  "template_precedence",
  "template_only",
]);

/**
 * Source taxonomy for normalized calendar timeline facts.
 *
 * This powers one interoperable read model where UI/API can query all
 * calendar-relevant events through one table instead of many ad-hoc joins.
 */
export const calendarTimelineEventSourceTypeEnum = pgEnum(
  "calendar_timeline_event_source_type",
  [
    "availability_rule",
    "availability_gate",
    "capacity_hold",
    "maintenance_work_order",
    "external_calendar_event",
    "fulfillment",
    "manual_entry",
    "plugin",
    "custom_subject",
  ],
);

/**
 * Unified visibility class for timeline rows.
 *
 * This is intentionally aligned with calendar-sharing semantics so the same
 * row can be rendered to different viewers with policy-aware detail levels.
 */
export const calendarTimelineVisibilityEnum = pgEnum("calendar_timeline_visibility", [
  "private",
  "free_busy",
  "masked_details",
  "full_details",
]);

/**
 * Normalized availability interpretation for one timeline interval row.
 *
 * This gives API consumers a single field for color/state mapping, regardless
 * of original source table semantics.
 */
export const calendarTimelineStateEnum = pgEnum("calendar_timeline_state", [
  "available",
  "unavailable",
  "busy",
  "tentative",
  "blocked",
  "unknown",
]);

/**
 * Signal class that can drive a dynamic availability gate.
 *
 * ELI5:
 * A gate is an extra runtime switch layered on top of normal rules.
 * These values explain where that switch came from.
 */
export const availabilityGateSignalTypeEnum = pgEnum(
  "availability_gate_signal_type",
  [
    "manual",
    "queue_eta",
    "capacity_pressure",
    "dependency",
    "external_event",
    "plugin",
    "custom_subject",
  ],
);

/**
 * How dependency failures should affect schedulability.
 *
 * - `hard_block`: dependency failure blocks availability directly.
 * - `soft_gate`: dependency failure creates gate-style pressure, but callers may
 *   still choose graceful fallback behavior.
 * - `advisory`: dependency state is recorded for scoring/observability only.
 */
export const availabilityDependencyEnforcementModeEnum = pgEnum(
  "availability_dependency_enforcement_mode",
  ["hard_block", "soft_gate", "advisory"],
);

/**
 * How a dependency rule decides if enough targets are currently healthy.
 *
 * - `all`: every dependency target must be satisfied.
 * - `any`: at least one dependency target must be satisfied.
 * - `threshold`: target satisfaction must meet numeric threshold fields.
 */
export const availabilityDependencyEvaluationModeEnum = pgEnum(
  "availability_dependency_evaluation_mode",
  ["all", "any", "threshold"],
);

/**
 * Payload shape discriminator for dependency targets.
 *
 * Why this exists:
 * - `calendar` handles core first-party calendar dependencies.
 * - `custom_subject` keeps room for plugin-defined supply dependencies.
 */
export const availabilityDependencyTargetTypeEnum = pgEnum(
  "availability_dependency_target_type",
  ["calendar", "custom_subject"],
);

/** Shared pool lifecycle. */
export const capacityPoolStatusEnum = pgEnum("capacity_pool_status", [
  "active",
  "inactive",
  "archived",
]);

/** Member discriminator for shared capacity pools. */
export const capacityPoolMemberTypeEnum = pgEnum("capacity_pool_member_type", [
  "resource",
  "offer_version",
  "location",
  "custom_subject",
]);

/**
 * Target scope for temporary capacity reservations.
 *
 * Why this exists:
 * Holds can reserve time/capacity against different primitives while sharing
 * one generic table shape.
 */
export const capacityHoldTargetTypeEnum = pgEnum("capacity_hold_target_type", [
  "calendar",
  "capacity_pool",
  "resource",
  "offer_version",
  "custom_subject",
]);

/**
 * How one hold should affect schedulability.
 *
 * ELI5:
 * - `blocking`: reserves real capacity and can block checkout/booking.
 * - `non_blocking`: does not reserve capacity; used as demand intent signal.
 * - `advisory`: informational marker, usually for ops/analytics.
 */
export const capacityHoldEffectModeEnum = pgEnum("capacity_hold_effect_mode", [
  "blocking",
  "non_blocking",
  "advisory",
]);

/**
 * Identity shape for who created/owns a hold.
 *
 * Why this exists:
 * - anti-abuse limits need stable ownership dimensions,
 * - supports known users, shared/group accounts, custom plugin subjects,
 *   anonymous guests via fingerprint hash, and system-generated holds.
 */
export const capacityHoldOwnerTypeEnum = pgEnum("capacity_hold_owner_type", [
  "user",
  "group_account",
  "subject",
  "guest_fingerprint",
  "system",
]);

/**
 * Where a hold-policy row applies.
 *
 * This is intentionally broad so one table can provide:
 * - biz-wide defaults,
 * - scoped overrides at location/resource/service/offer/product levels,
 * - plugin-defined custom subject scopes.
 */
export const capacityHoldPolicyTargetTypeEnum = pgEnum(
  "capacity_hold_policy_target_type",
  [
    "biz",
    "location",
    "calendar",
    "resource",
    "capacity_pool",
    "service",
    "service_product",
    "offer",
    "offer_version",
    "product",
    "sellable",
    "custom_subject",
  ],
);

/** Lifecycle of a temporary capacity hold. */
export const capacityHoldStatusEnum = pgEnum("capacity_hold_status", [
  "active",
  "released",
  "consumed",
  "expired",
  "cancelled",
]);

/**
 * Transition/event taxonomy for immutable hold lifecycle logs.
 *
 * Why this exists:
 * - row snapshots tell "current state",
 * - event rows tell "how we got here" and "who changed what".
 */
export const capacityHoldEventTypeEnum = pgEnum("capacity_hold_event_type", [
  "created",
  "updated",
  "extended",
  "effect_mode_changed",
  "quantity_changed",
  "released",
  "consumed",
  "expired",
  "cancelled",
]);

/** Severity for hold-pressure alerts used by "act fast" notifications. */
export const capacityHoldDemandAlertSeverityEnum = pgEnum(
  "capacity_hold_demand_alert_severity",
  ["low", "medium", "high", "critical"],
);

/** Lifecycle of hold-pressure alerts. */
export const capacityHoldDemandAlertStatusEnum = pgEnum(
  "capacity_hold_demand_alert_status",
  ["open", "acknowledged", "resolved", "dismissed", "expired"],
);

/** Outcome classification for one availability-resolution run trace. */
export const availabilityResolutionStatusEnum = pgEnum(
  "availability_resolution_status",
  ["available", "unavailable", "mixed", "error"],
);

// ---------------------------------------------------------------------------
// Fulfillment domain
// ---------------------------------------------------------------------------

/** Commercial contract status from cart intent through completion. */
export const bookingOrderStatusEnum = pgEnum("booking_order_status", [
  "draft",
  "quoted",
  "awaiting_payment",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "expired",
  "failed",
]);

/** Billing line classification for order composition. */
export const bookingOrderLineTypeEnum = pgEnum("booking_order_line_type", [
  "offer_base",
  "seat",
  "addon",
  "fee",
  "tip",
  "tax",
  "discount",
  "refund_adjustment",
]);

/** Semantic shape of one fulfillment unit. */
export const fulfillmentUnitKindEnum = pgEnum("fulfillment_unit_kind", [
  "service_task",
  "rental_segment",
  "transport_leg",
  "queue_service",
  "async_review",
]);

/** Status for one atomic execution unit inside an order. */
export const fulfillmentUnitStatusEnum = pgEnum("fulfillment_unit_status", [
  "planned",
  "ready",
  "held",
  "in_progress",
  "completed",
  "cancelled",
  "blocked",
]);

/** Dependency edge semantics between two fulfillment units. */
export const fulfillmentDependencyTypeEnum = pgEnum(
  "fulfillment_dependency_type",
  ["must_follow", "same_day", "min_gap", "max_gap", "hard_block_if_missing"],
);

/** Assignment lifecycle for resource allocation per unit. */
export const fulfillmentAssignmentStatusEnum = pgEnum(
  "fulfillment_assignment_status",
  [
    "proposed",
    "reserved",
    "confirmed",
    "in_progress",
    "completed",
    "cancelled",
    "failed",
  ],
);

/**
 * Immutable event taxonomy for fulfillment-assignment transition ledgers.
 */
export const fulfillmentAssignmentEventTypeEnum = pgEnum(
  "fulfillment_assignment_event_type",
  [
    "created",
    "status_changed",
    "resource_changed",
    "window_changed",
    "conflict_policy_changed",
    "cancelled",
    "completed",
    "metadata_updated",
  ],
);

/**
 * Conflict policy for assignment-level overlap enforcement.
 *
 * Why this exists:
 * - some resources must never overlap,
 * - others intentionally allow overlap (shared/parallel capacity).
 *
 * `enforce_no_overlap` means the DB exclusion constraint should block
 * conflicting time windows for that resource.
 */
export const fulfillmentAssignmentConflictPolicyEnum = pgEnum(
  "fulfillment_assignment_conflict_policy",
  ["enforce_no_overlap", "allow_overlap"],
);

/** Operational milestone taxonomy used by checkpoints. */
export const fulfillmentCheckpointTypeEnum = pgEnum(
  "fulfillment_checkpoint_type",
  [
    "arrival",
    "check_in",
    "start",
    "pause",
    "resume",
    "pickup",
    "dropoff",
    "completion",
    "no_access",
  ],
);

/** State of a concrete checkpoint event. */
export const fulfillmentCheckpointStatusEnum = pgEnum(
  "fulfillment_checkpoint_status",
  ["pending", "completed", "skipped", "failed"],
);

/**
 * Lifecycle status for a standing reservation contract.
 *
 * ELI5:
 * - draft: being configured, not generating occurrences yet
 * - active: recurrence engine should generate upcoming occurrences
 * - paused: temporarily suspended (no new generation while paused)
 * - completed: naturally finished (for example reached end date)
 * - cancelled: intentionally terminated early
 * - archived: hidden from normal operations, kept for history
 */
export const standingReservationContractStatusEnum = pgEnum(
  "standing_reservation_contract_status",
  ["draft", "active", "paused", "completed", "cancelled", "archived"],
);

/**
 * Lifecycle for one generated standing-reservation occurrence.
 *
 * One occurrence can move from planning into booking/execution outcomes.
 */
export const standingReservationOccurrenceStatusEnum = pgEnum(
  "standing_reservation_occurrence_status",
  [
    "planned",
    "generated",
    "booked",
    "fulfilled",
    "skipped",
    "cancelled",
    "failed",
  ],
);

/**
 * Override action for standing reservation exceptions.
 *
 * - skip_occurrence: intentionally do not schedule one occurrence
 * - cancel_occurrence: cancel one already generated occurrence
 * - reschedule_occurrence: move one occurrence to a new window
 * - pause_window: suspend generation for a date/time range
 */
export const standingReservationExceptionActionEnum = pgEnum(
  "standing_reservation_exception_action",
  [
    "skip_occurrence",
    "cancel_occurrence",
    "reschedule_occurrence",
    "pause_window",
  ],
);

// ---------------------------------------------------------------------------
// Queue domain
// ---------------------------------------------------------------------------

/** Queue ordering strategy. */
export const queueStrategyEnum = pgEnum("queue_strategy", [
  "fifo",
  "priority",
  "weighted",
  "fair_share",
]);

/** Queue lifecycle state. */
export const queueStatusEnum = pgEnum("queue_status", [
  "active",
  "paused",
  "closed",
  "archived",
]);

/** Queue entry lifecycle from join to outcome. */
export const queueEntryStatusEnum = pgEnum("queue_entry_status", [
  "waiting",
  "offered",
  "claimed",
  "expired",
  "removed",
  "served",
  "cancelled",
  "no_show",
]);

/** Ticket lifecycle for kiosk/front-desk style queue numbers. */
export const queueTicketStatusEnum = pgEnum("queue_ticket_status", [
  "issued",
  "called",
  "serving",
  "completed",
  "cancelled",
  "expired",
]);

/** Event type for append-only queue history timelines. */
export const queueEventTypeEnum = pgEnum("queue_event_type", [
  "joined",
  "offered",
  "claimed",
  "expired",
  "cancelled",
  "called",
  "served",
  "status_changed",
  "priority_changed",
  "estimate_updated",
]);

/** Source of service-time observation data. */
export const serviceTimeObservationSourceEnum = pgEnum(
  "service_time_observation_source",
  ["actual", "manual_adjustment", "imported"],
);

/** Predictive model family used for wait-time estimates. */
export const waitTimePredictionModelEnum = pgEnum("wait_time_prediction_model", [
  "heuristic",
  "statistical",
  "ml",
  "manual",
]);

// ---------------------------------------------------------------------------
// Transportation domain
// ---------------------------------------------------------------------------

/** Vehicle lifecycle state for dispatch and booking eligibility. */
export const vehicleStatusEnum = pgEnum("vehicle_status", [
  "active",
  "maintenance",
  "out_of_service",
  "retired",
]);

/** Stop role inside a route definition. */
export const routeStopKindEnum = pgEnum("route_stop_kind", [
  "pickup",
  "dropoff",
  "waypoint",
  "depot",
  "break",
]);

/** Route lifecycle state. */
export const transportRouteStatusEnum = pgEnum("transport_route_status", [
  "active",
  "inactive",
  "archived",
]);

/** Trip execution state. */
export const transportTripStatusEnum = pgEnum("transport_trip_status", [
  "planned",
  "boarding",
  "in_progress",
  "delayed",
  "completed",
  "cancelled",
]);

/** Passenger manifest row status for one trip booking. */
export const tripManifestStatusEnum = pgEnum("trip_manifest_status", [
  "booked",
  "checked_in",
  "boarded",
  "no_show",
  "cancelled",
  "completed",
]);

/** Dispatch task execution state for drivers/dispatchers. */
export const dispatchTaskStatusEnum = pgEnum("dispatch_task_status", [
  "queued",
  "assigned",
  "accepted",
  "en_route",
  "in_progress",
  "done",
  "failed",
  "cancelled",
]);

/** ETA timeline event type for trip progress tracking. */
export const etaEventTypeEnum = pgEnum("eta_event_type", [
  "predicted",
  "updated",
  "arrived",
  "departed",
  "delay_alert",
]);

// ---------------------------------------------------------------------------
// Marketplace and cross-biz domain
// ---------------------------------------------------------------------------

/** Marketplace listing publication lifecycle. */
export const marketplaceListingStatusEnum = pgEnum(
  "marketplace_listing_status",
  ["draft", "active", "paused", "closed", "archived"],
);

/** Listing entity type exposed in marketplace channels. */
export const marketplaceListingTypeEnum = pgEnum("marketplace_listing_type", [
  "offer_version",
  "resource",
  "package",
]);

/** Auction lifecycle for offer-listing bid windows. */
export const auctionStatusEnum = pgEnum("auction_status", [
  "scheduled",
  "live",
  "closed",
  "cancelled",
  "settled",
]);

/**
 * Target class for auction rows.
 *
 * This keeps one auction engine reusable across:
 * - marketplace listings,
 * - internal staffing/job-board postings,
 * - plugin/custom targets via shared subjects registry.
 */
export const auctionTargetTypeEnum = pgEnum("auction_target_type", [
  "marketplace_listing",
  "custom_subject",
]);

/** Bid state within an auction or reverse-bid process. */
export const bidStatusEnum = pgEnum("bid_status", [
  "pending",
  "winning",
  "outbid",
  "accepted",
  "rejected",
  "withdrawn",
  "expired",
]);

/** Contract state for two businesses transacting together. */
export const crossBizContractStatusEnum = pgEnum("cross_biz_contract_status", [
  "draft",
  "active",
  "suspended",
  "terminated",
  "expired",
]);

/** State of one cross-biz execution order. */
export const crossBizOrderStatusEnum = pgEnum("cross_biz_order_status", [
  "draft",
  "pending",
  "confirmed",
  "fulfilled",
  "settled",
  "cancelled",
  "disputed",
]);

/** Revenue-share calculation mode. */
export const revenueShareRuleTypeEnum = pgEnum("revenue_share_rule_type", [
  "fixed_percent",
  "fixed_amount",
  "tiered",
]);

/** Referral timeline event type. */
export const referralEventTypeEnum = pgEnum("referral_event_type", [
  "referral_created",
  "qualified_purchase",
  "converted",
  "reward_granted",
  "expired",
  "reversed",
]);

/** Referral reward lifecycle. */
export const referralRewardStatusEnum = pgEnum("referral_reward_status", [
  "pending",
  "approved",
  "granted",
  "reversed",
  "expired",
]);

// ---------------------------------------------------------------------------
// Governance / compliance / privacy domain
// ---------------------------------------------------------------------------

/** Policy pack used to explain which legal/compliance frameworks apply. */
export const complianceRegimeEnum = pgEnum("compliance_regime", [
  "hipaa",
  "gdpr",
  "ccpa",
  "ferpa",
  "pci_dss",
  "soc2",
  "custom",
]);

/** How sensitive a data class is for storage, masking, and access rules. */
export const piiSensitivityLevelEnum = pgEnum("pii_sensitivity_level", [
  "low",
  "moderate",
  "high",
  "restricted",
]);

/** Geographic scope used by data residency policy evaluation. */
export const residencyScopeEnum = pgEnum("residency_scope", [
  "global",
  "region",
  "country",
  "tenant_custom",
]);

/** Residency policy enforcement strictness. */
export const residencyEnforcementModeEnum = pgEnum(
  "residency_enforcement_mode",
  ["hard_block", "soft_warn", "report_only"],
);

/** User privacy mode for sensitive bookings and records. */
export const privacyIdentityModeEnum = pgEnum("privacy_identity_mode", [
  "full_identity",
  "pseudonymous",
  "anonymous",
  "sealed",
]);

/** Data subject request kind (GDPR/CCPA style rights workflows). */
export const dataSubjectRequestTypeEnum = pgEnum(
  "data_subject_request_type",
  [
    "access",
    "rectification",
    "deletion",
    "portability",
    "restriction",
    "objection",
  ],
);

/** Lifecycle of a data subject request. */
export const dataSubjectRequestStatusEnum = pgEnum(
  "data_subject_request_status",
  [
    "submitted",
    "verifying",
    "identity_verified",
    "processing",
    "fulfilled",
    "denied",
    "cancelled",
  ],
);

/** What object class is protected by a legal hold. */
export const legalHoldScopeEnum = pgEnum("legal_hold_scope", [
  "tenant",
  "offer",
  "booking_order",
  "payment",
  "audit_log",
  "custom",
]);

/** Legal hold lifecycle status. */
export const legalHoldStatusEnum = pgEnum("legal_hold_status", [
  "active",
  "released",
  "expired",
]);

/** Retention interval unit. */
export const retentionIntervalUnitEnum = pgEnum("retention_interval_unit", [
  "days",
  "months",
  "years",
  "indefinite",
]);

/** Action to take when retention period is reached. */
export const retentionActionEnum = pgEnum("retention_action", [
  "delete",
  "anonymize",
  "archive",
]);

/** Identity verification method used in data subject requests. */
export const dsrVerificationMethodEnum = pgEnum("dsr_verification_method", [
  "email_otp",
  "document",
  "manual",
  "account_login",
]);

/** Redaction target record type. */
export const redactionTargetTypeEnum = pgEnum("redaction_target_type", [
  "user",
  "booking_order",
  "fulfillment_unit",
  "payment",
  "note",
  "attachment",
  "custom",
]);

/** Redaction batch lifecycle. */
export const redactionJobStatusEnum = pgEnum("redaction_job_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

/**
 * How one policy template aggregates multiple rules.
 *
 * - `all`: every active rule must pass
 * - `any`: at least one active rule must pass
 * - `threshold`: at least N active rules must pass
 */
export const policyRuleAggregationModeEnum = pgEnum("policy_rule_aggregation_mode", [
  "all",
  "any",
  "threshold",
]);

/**
 * Rule condition shape used by generic policy evaluation engines.
 *
 * This intentionally avoids vertical-specific semantics.
 */
export const policyRulePredicateTypeEnum = pgEnum("policy_rule_predicate_type", [
  "expression",
  "metric_threshold",
  "schedule_window",
  "event_pattern",
  "custom",
]);

/** Severity used by rule definitions and breach records. */
export const policyRuleSeverityEnum = pgEnum("policy_rule_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

/**
 * Where one policy binding applies.
 *
 * This keeps policy scoping reusable across industries and domains.
 */
export const policyBindingTargetTypeEnum = pgEnum("policy_binding_target_type", [
  "biz",
  "location",
  "resource",
  "service",
  "service_product",
  "offer",
  "offer_version",
  "queue",
  "subject",
]);

/** Lifecycle status for one concrete policy breach record. */
export const policyBreachStatusEnum = pgEnum("policy_breach_status", [
  "open",
  "acknowledged",
  "in_review",
  "resolved",
  "waived",
  "dismissed",
]);

/** Origin of breach detection. */
export const policyBreachDetectionSourceEnum = pgEnum("policy_breach_detection_source", [
  "auto_engine",
  "manual_review",
  "external_import",
  "plugin",
]);

/**
 * Consequence category emitted when a breach is handled.
 *
 * These are generic building blocks that can model labor penalties, SLA credits,
 * compliance remediations, or custom operational outcomes.
 */
export const policyConsequenceTypeEnum = pgEnum("policy_consequence_type", [
  "warning",
  "cooldown",
  "suspension",
  "compensation_adjustment",
  "payment_adjustment",
  "credit",
  "debit",
  "queue_review",
  "workflow_trigger",
  "custom",
]);

/** Lifecycle status for one consequence event row. */
export const policyConsequenceStatusEnum = pgEnum("policy_consequence_status", [
  "planned",
  "applied",
  "failed",
  "reverted",
  "cancelled",
]);

/**
 * Counterparty type for business associate agreements (BAA).
 *
 * Kept broad so this can model both first-party processor contracts and
 * third-party extension/vendor agreements.
 */
export const baaPartyTypeEnum = pgEnum("baa_party_type", [
  "extension_install",
  "vendor_org",
  "subcontractor",
  "other",
]);

/** Lifecycle state for one BAA record. */
export const baaStatusEnum = pgEnum("baa_status", [
  "draft",
  "active",
  "suspended",
  "terminated",
  "expired",
]);

/**
 * HIPAA purpose-of-use class for PHI access/disclosure controls.
 *
 * Includes core HIPAA buckets and a generic fallback for future regimes.
 */
export const hipaaPurposeOfUseEnum = pgEnum("hipaa_purpose_of_use", [
  "treatment",
  "payment",
  "operations",
  "public_health",
  "legal",
  "research",
  "individual_request",
  "emergency",
  "other",
]);

/** Action taken against PHI-bearing records. */
export const phiAccessActionEnum = pgEnum("phi_access_action", [
  "view",
  "create",
  "update",
  "delete",
  "export",
  "print",
  "disclose",
]);

/** Policy decision result for one PHI access attempt. */
export const phiAccessDecisionEnum = pgEnum("phi_access_decision", [
  "allowed",
  "denied",
]);

/** Review lifecycle for emergency break-glass access records. */
export const breakGlassReviewStatusEnum = pgEnum("break_glass_review_status", [
  "pending",
  "approved",
  "rejected",
  "escalated",
]);

/** Recipient class used by HIPAA accounting-of-disclosures records. */
export const disclosureRecipientTypeEnum = pgEnum("disclosure_recipient_type", [
  "provider",
  "payer",
  "business_associate",
  "individual",
  "legal_authority",
  "public_health_authority",
  "other",
]);

/** Authorization lifecycle for patient/guardian disclosure consents. */
export const hipaaAuthorizationStatusEnum = pgEnum("hipaa_authorization_status", [
  "draft",
  "signed",
  "revoked",
  "expired",
]);

/** Security-incident category for breach/response workflows. */
export const securityIncidentTypeEnum = pgEnum("security_incident_type", [
  "unauthorized_access",
  "improper_disclosure",
  "ransomware",
  "data_loss_or_theft",
  "availability_outage",
  "integrity_compromise",
  "other",
]);

/** Severity level used by incident triage workflows. */
export const securityIncidentSeverityEnum = pgEnum("security_incident_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

/** Incident workflow state from detection to closure. */
export const securityIncidentStatusEnum = pgEnum("security_incident_status", [
  "open",
  "investigating",
  "contained",
  "resolved",
  "reported",
  "closed",
]);

/** Recipient class for breach-notification tasks. */
export const breachNotificationRecipientTypeEnum = pgEnum(
  "breach_notification_recipient_type",
  [
    "affected_individual",
    "regulator",
    "media",
    "business_associate",
    "other",
  ],
);

/** Delivery lifecycle for one breach-notification task. */
export const breachNotificationStatusEnum = pgEnum("breach_notification_status", [
  "draft",
  "scheduled",
  "sent",
  "failed",
  "cancelled",
]);

// ---------------------------------------------------------------------------
// Workflow and async domain
// ---------------------------------------------------------------------------

/** Classification of manual/automated review pipelines. */
export const reviewQueueTypeEnum = pgEnum("review_queue_type", [
  "fraud",
  "manual_approval",
  "compliance",
  "moderation",
  "risk",
]);

/** Lifecycle state for review queues. */
export const reviewQueueStatusEnum = pgEnum("review_queue_status", [
  "active",
  "paused",
  "archived",
]);

/** Status of one review item inside a review queue. */
export const reviewItemStatusEnum = pgEnum("review_item_status", [
  "pending",
  "claimed",
  "approved",
  "rejected",
  "escalated",
  "timed_out",
  "cancelled",
]);

/** Workflow instance lifecycle state. */
export const workflowInstanceStatusEnum = pgEnum("workflow_instance_status", [
  "pending",
  "running",
  "waiting_input",
  "completed",
  "failed",
  "cancelled",
]);

/** Trigger source for workflow instance creation. */
export const workflowTriggerTypeEnum = pgEnum("workflow_trigger_type", [
  "manual",
  "policy",
  "webhook",
  "schedule",
  "system_event",
]);

/** Workflow step lifecycle state. */
export const workflowStepStatusEnum = pgEnum("workflow_step_status", [
  "pending",
  "running",
  "blocked",
  "completed",
  "failed",
  "skipped",
]);

/** Decision output written by humans or policy engines. */
export const workflowDecisionOutcomeEnum = pgEnum(
  "workflow_decision_outcome",
  ["approve", "reject", "request_changes", "escalate", "defer"],
);

/** Async deliverable lifecycle for "submit and get result later" products. */
export const asyncDeliverableStatusEnum = pgEnum("async_deliverable_status", [
  "queued",
  "processing",
  "ready",
  "delivered",
  "expired",
  "failed",
  "cancelled",
]);

/** Output type produced by an async deliverable workflow. */
export const asyncDeliverableTypeEnum = pgEnum("async_deliverable_type", [
  "document",
  "media_bundle",
  "analysis_result",
  "message_response",
  "custom",
]);

// ---------------------------------------------------------------------------
// Payments domain
// ---------------------------------------------------------------------------

/** Tender instrument class used for charging/settlement flows. */
export const paymentMethodTypeEnum = pgEnum("payment_method_type", [
  "card",
  "cash",
  "bank_transfer",
  "wallet",
  "gift_card",
  "external_channel_credit",
  "custom",
]);

/** Order-level payment lifecycle status. */
export const paymentTransactionTypeEnum = pgEnum("payment_transaction_type", [
  "authorization",
  "capture",
  "charge",
  "refund",
  "void",
  "chargeback",
  "chargeback_reversal",
  "fee",
  "adjustment",
  "payout",
  "transfer",
]);

/** Immutable transaction processing state. */
export const paymentTransactionStatusEnum = pgEnum(
  "payment_transaction_status",
  ["pending", "processing", "succeeded", "failed", "cancelled", "disputed"],
);

/** Card/network dispute lifecycle state. */
export const paymentDisputeStatusEnum = pgEnum("payment_dispute_status", [
  "warning_needs_response",
  "needs_response",
  "under_review",
  "won",
  "lost",
  "cancelled",
]);

/** Settlement batch lifecycle for payable reconciliation. */
export const settlementBatchStatusEnum = pgEnum("settlement_batch_status", [
  "open",
  "calculating",
  "ready",
  "paid",
  "failed",
  "cancelled",
]);

/** Payout transfer lifecycle state. */
export const payoutStatusEnum = pgEnum("payout_status", [
  "pending",
  "in_transit",
  "paid",
  "failed",
  "cancelled",
  "reversed",
]);

/** Payout ledger movement classification. */
export const payoutLedgerEntryTypeEnum = pgEnum("payout_ledger_entry_type", [
  "credit",
  "debit",
  "fee",
  "adjustment",
  "reversal",
]);

// ---------------------------------------------------------------------------
// Compensation / payroll domain
// ---------------------------------------------------------------------------

/**
 * Lifecycle of one immutable compensation plan version.
 *
 * Why versioning exists:
 * - Compensation rules change over time.
 * - Historical bookings must still be explainable with the old rule set.
 * - Versioning lets us publish new rules without mutating old history.
 */
export const compensationPlanVersionStatusEnum = pgEnum(
  "compensation_plan_version_status",
  ["draft", "active", "retired", "archived"],
);

/**
 * Selector shape for compensation rule matching.
 *
 * This mirrors booking selector philosophy:
 * - one selector type per row,
 * - one matching payload per row,
 * - deterministic rule interpretation by workers.
 *
 * Streamline note:
 * - Category-specific selector branches were removed.
 * - Capability templates are the reusable cross-supply selector primitive.
 */
export const compensationRuleSelectorTypeEnum = pgEnum(
  "compensation_rule_selector_type",
  [
    "any",
    "resource",
    "resource_type",
    "capability_template",
    "location",
    "service",
    "service_product",
    "offer_component",
  ],
);

/**
 * Compensation formula model used by a rule.
 *
 * - `flat_amount`: fixed payout amount per matched assignment/order context.
 * - `percent_of_*`: basis-point percent against selected commercial amount.
 * - `hourly`: payout from duration and hourly rate.
 * - `base_plus_percent`: hybrid of fixed base + percent component.
 */
export const compensationCalculationModeEnum = pgEnum(
  "compensation_calculation_mode",
  [
    "flat_amount",
    "percent_of_order_total",
    "percent_of_order_subtotal",
    "percent_of_line_total",
    "hourly",
    "base_plus_percent",
  ],
);

/**
 * Immutable compensation ledger movement type.
 *
 * The table using this enum is append-oriented:
 * - never rewrite prior facts,
 * - write reversal/correction rows instead.
 */
export const compensationLedgerEntryTypeEnum = pgEnum(
  "compensation_ledger_entry_type",
  [
    "accrual",
    "adjustment",
    "reversal",
    "hold",
    "release",
    "payout",
    "correction",
  ],
);

/** Payroll batch lifecycle for compensation disbursement cycles. */
export const compensationPayRunStatusEnum = pgEnum("compensation_pay_run_status", [
  "draft",
  "calculating",
  "review",
  "approved",
  "processing_payout",
  "paid",
  "failed",
  "cancelled",
]);

/** Per-payee state inside one payroll batch. */
export const compensationPayRunItemStatusEnum = pgEnum(
  "compensation_pay_run_item_status",
  ["pending", "approved", "withheld", "paid", "failed", "cancelled"],
);

// ---------------------------------------------------------------------------
// Membership / entitlement domain
// ---------------------------------------------------------------------------

/** Membership plan lifecycle for publication and retirement. */
export const membershipPlanStatusEnum = pgEnum("membership_plan_status", [
  "draft",
  "active",
  "inactive",
  "archived",
]);

/** Billing interval unit for recurring membership plans. */
export const membershipBillingIntervalUnitEnum = pgEnum(
  "membership_billing_interval_unit",
  ["day", "week", "month", "year", "custom"],
);

/** Individual membership contract status. */
export const membershipStatusEnum = pgEnum("membership_status", [
  "trialing",
  "active",
  "paused",
  "past_due",
  "cancelled",
  "expired",
]);

/** Kind of entitlement value granted to a wallet. */
export const entitlementGrantTypeEnum = pgEnum("entitlement_grant_type", [
  "pass",
  "credit",
  "time_allowance",
  "seat_pack",
  "custom",
]);

/** Immutable entitlement wallet movement type. */
export const entitlementLedgerEntryTypeEnum = pgEnum(
  "entitlement_ledger_entry_type",
  [
    "grant",
    "consume",
    "expire",
    "rollover",
    "transfer_in",
    "transfer_out",
    "adjustment",
    "reversal",
  ],
);

/** Entitlement transfer request lifecycle. */
export const entitlementTransferStatusEnum = pgEnum(
  "entitlement_transfer_status",
  ["requested", "approved", "rejected", "completed", "cancelled", "expired"],
);

/** Batch execution state for entitlement rollover jobs. */
export const rolloverRunStatusEnum = pgEnum("rollover_run_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

// ---------------------------------------------------------------------------
// Channel integration domain
// ---------------------------------------------------------------------------

/** External booking/sales channel provider. */
export const channelProviderEnum = pgEnum("channel_provider", [
  "google_reserve",
  "classpass",
  "instagram",
  "facebook",
  "meta_messenger",
  "custom",
]);

/** Connection health state for one channel account. */
export const channelConnectionStatusEnum = pgEnum(
  "channel_connection_status",
  ["active", "inactive", "error", "revoked"],
);

/** Sync direction mode for channel integration mappings/jobs. */
export const channelSyncDirectionEnum = pgEnum("channel_sync_direction", [
  "inbound",
  "outbound",
  "bidirectional",
]);

/** Entity shape synchronized to/from channel systems. */
export const channelObjectTypeEnum = pgEnum("channel_object_type", [
  "offer_version",
  "availability",
  "booking_order",
  "customer",
  "resource",
  "class_session",
  "custom",
]);

/** Channel synchronization job lifecycle. */
export const channelSyncJobStatusEnum = pgEnum("channel_sync_job_status", [
  "queued",
  "running",
  "succeeded",
  "partial",
  "failed",
  "cancelled",
]);

/** Per-item status for row-level sync processing in one sync job. */
export const channelSyncItemStatusEnum = pgEnum("channel_sync_item_status", [
  "pending",
  "succeeded",
  "failed",
  "skipped",
]);

/** Webhook event processing lifecycle for channel callbacks. */
export const channelWebhookStatusEnum = pgEnum("channel_webhook_status", [
  "received",
  "processed",
  "failed",
  "ignored",
]);

// ---------------------------------------------------------------------------
// Operational intelligence domain
// ---------------------------------------------------------------------------

/** Ranking model lifecycle state. */
export const rankingModelStatusEnum = pgEnum("ranking_model_status", [
  "draft",
  "active",
  "inactive",
  "archived",
]);

/** Event taxonomy feeding favorability and ranking scores. */
export const rankingEventTypeEnum = pgEnum("ranking_event_type", [
  "booking_completed",
  "cancelled_by_host",
  "cancelled_by_customer",
  "no_show",
  "rating_received",
  "manual_adjustment",
]);

/**
 * Internal staffing demand lifecycle.
 *
 * ELI5:
 * A demand is a posted need for people/resources to cover a work window.
 * Replacement is just one demand type within this shared model.
 */
export const staffingDemandStatusEnum = pgEnum("staffing_demand_status", [
  "open",
  "offered",
  "claimed",
  "assigned",
  "filled",
  "expired",
  "cancelled",
]);

/** Business intent class for one staffing demand. */
export const staffingDemandTypeEnum = pgEnum("staffing_demand_type", [
  "replacement",
  "open_shift",
  "internal_task",
  "on_call",
  "overtime",
]);

/**
 * Matching/award strategy for staffing demand fulfillment.
 *
 * - `direct_assign`: manager assigns directly.
 * - `fcfs_claim`: first valid claimant wins.
 * - `invite_accept`: invited candidates accept/decline.
 * - `auction`: candidates submit bids/terms.
 * - `auto_match`: policy engine picks candidates automatically.
 */
export const staffingFillModeEnum = pgEnum("staffing_fill_mode", [
  "direct_assign",
  "fcfs_claim",
  "invite_accept",
  "auction",
  "auto_match",
]);

/** Required/optional intent for staffing requirement groups. */
export const staffingRequirementModeEnum = pgEnum("staffing_requirement_mode", [
  "required",
  "optional",
]);

/** How selectors inside one staffing requirement group are evaluated. */
export const staffingSelectorMatchModeEnum = pgEnum(
  "staffing_selector_match_mode",
  ["any", "all"],
);

/**
 * Selector payload type for staffing requirement targeting.
 *
 * This mirrors selector patterns used in service-product composition so the
 * resolver can stay generic and deterministic.
 */
export const staffingSelectorTypeEnum = pgEnum("staffing_selector_type", [
  "any",
  "resource",
  "resource_type",
  "capability_template",
  "location",
  "custom_subject",
]);

/** Fairness accounting period unit for staffing balancing. */
export const fairnessWindowUnitEnum = pgEnum("fairness_window_unit", [
  "day",
  "week",
  "month",
]);

/** Overtime policy scope target class. */
export const overtimePolicyScopeEnum = pgEnum("overtime_policy_scope", [
  "biz",
  "location",
  "resource_type",
  "resource",
]);

/** Overtime policy lifecycle state. */
export const overtimePolicyStatusEnum = pgEnum("overtime_policy_status", [
  "active",
  "inactive",
  "archived",
]);

/** Forecast row state for overtime prediction workflows. */
export const overtimeForecastStatusEnum = pgEnum("overtime_forecast_status", [
  "projected",
  "confirmed",
  "mitigated",
  "ignored",
]);

/** Candidate response mode for one staffing demand. */
export const staffingResponseModeEnum = pgEnum("staffing_response_mode", [
  "invite",
  "claim",
  "bid",
]);

/** Candidate response lifecycle state for staffing demands. */
export const staffingResponseStatusEnum = pgEnum("staffing_response_status", [
  "pending",
  "accepted",
  "declined",
  "expired",
  "withdrawn",
  "won",
  "lost",
  "cancelled",
]);

/** Execution state of one concrete staffing assignment row. */
export const staffingAssignmentStatusEnum = pgEnum("staffing_assignment_status", [
  "planned",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
]);

/**
 * Canonical source type for one operational demand identity row.
 *
 * This lets one unified operations backbone reference demand origins from
 * customer fulfillment, internal staffing, or plugin/custom domains.
 */
export const operationalDemandSourceTypeEnum = pgEnum(
  "operational_demand_source_type",
  ["fulfillment_unit", "staffing_demand", "custom_subject"],
);

/**
 * Canonical source type for one operational assignment identity row.
 *
 * The same assignment graph can represent:
 * - customer-facing fulfillment assignments,
 * - internal staffing postings,
 * - plugin/custom assignment sources.
 */
export const operationalAssignmentSourceTypeEnum = pgEnum(
  "operational_assignment_source_type",
  ["fulfillment_assignment", "staffing_assignment", "custom_subject"],
);

// ---------------------------------------------------------------------------
// Education / program domain
// ---------------------------------------------------------------------------

/** Program template lifecycle state. */
export const programStatusEnum = pgEnum("program_status", [
  "draft",
  "active",
  "inactive",
  "archived",
]);

/** Cohort run lifecycle state. */
export const cohortStatusEnum = pgEnum("cohort_status", [
  "planned",
  "enrolling",
  "in_progress",
  "completed",
  "cancelled",
]);

/** Cohort session lifecycle state. */
export const programSessionStatusEnum = pgEnum("program_session_status", [
  "planned",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
]);

/** Enrollment status for participant in one cohort. */
export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "enrolled",
  "waitlisted",
  "dropped",
  "completed",
  "failed",
]);

/** Attendance status per participant per session. */
export const sessionAttendanceStatusEnum = pgEnum("session_attendance_status", [
  "present",
  "late",
  "absent",
  "excused",
  "no_show",
  "makeup",
]);

/** Certification award lifecycle state. */
export const certificationAwardStatusEnum = pgEnum("certification_award_status", [
  "awarded",
  "revoked",
  "expired",
]);

// ---------------------------------------------------------------------------
// Immutable audit/event log domain
// ---------------------------------------------------------------------------

/** Who or what produced an immutable audit event. */
export const auditActorTypeEnum = pgEnum("audit_actor_type", [
  "user",
  "system",
  "api_key",
  "integration",
]);

/** Event action class for immutable audit rows. */
export const auditEventTypeEnum = pgEnum("audit_event_type", [
  "create",
  "update",
  "delete",
  "read",
  "state_transition",
  "policy_decision",
  "payment_event",
  "custom",
]);

/** Verification state for hash-chain integrity checks. */
export const auditIntegrityStatusEnum = pgEnum("audit_integrity_status", [
  "valid",
  "broken",
  "unverified",
]);

// ---------------------------------------------------------------------------
// Gift instruments + participant obligations + AR + commitments domain
// ---------------------------------------------------------------------------

/** Gift instrument lifecycle state. */
export const giftInstrumentStatusEnum = pgEnum("gift_instrument_status", [
  "draft",
  "active",
  "partially_redeemed",
  "redeemed",
  "expired",
  "voided",
]);

/** Gift redemption lifecycle state. */
export const giftRedemptionStatusEnum = pgEnum("gift_redemption_status", [
  "applied",
  "reversed",
  "failed",
]);

/** Gift transfer lifecycle state. */
export const giftTransferStatusEnum = pgEnum("gift_transfer_status", [
  "pending",
  "completed",
  "cancelled",
  "failed",
]);

/**
 * How a transfer should behave on value ownership.
 *
 * - full_transfer: move whole instrument ownership as one unit
 * - split_transfer: move partial value into a new child instrument
 */
export const giftTransferModeEnum = pgEnum("gift_transfer_mode", [
  "full_transfer",
  "split_transfer",
]);

/**
 * Issuance provenance class for one gift instrument.
 *
 * This helps APIs and reports answer "where did this gift come from?".
 */
export const giftInstrumentSourceTypeEnum = pgEnum("gift_instrument_source_type", [
  "manual",
  "purchase",
  "promotion",
  "compensation",
  "transfer_split",
  "migration",
  "external",
]);

/**
 * Immutable ledger entry type for gift-value accounting.
 *
 * Signed amount convention:
 * - positive: value increases on instrument
 * - negative: value decreases on instrument
 */
export const giftLedgerEntryTypeEnum = pgEnum("gift_ledger_entry_type", [
  "issuance",
  "redemption",
  "redemption_reversal",
  "transfer_out",
  "transfer_in",
  "expiration",
  "void_adjustment",
  "manual_adjustment",
]);

/** Reason class for gift expiration events. */
export const giftExpirationReasonEnum = pgEnum("gift_expiration_reason", [
  "scheduled_expiry",
  "manual_expiry",
  "policy_expiry",
]);

/** Participant-obligation semantic kind. */
export const participantObligationTypeEnum = pgEnum("participant_obligation_type", [
  "payment_contribution",
  "consent",
  "identity_verification",
  "attendance",
  "document_submission",
  "custom",
]);

/** Participant-obligation lifecycle state. */
export const participantObligationStatusEnum = pgEnum("participant_obligation_status", [
  "pending",
  "satisfied",
  "waived",
  "cancelled",
  "overdue",
]);

/** Event types for participant-obligation timeline rows. */
export const participantObligationEventTypeEnum = pgEnum(
  "participant_obligation_event_type",
  [
    "created",
    "updated",
    "satisfied",
    "waived",
    "cancelled",
    "reopened",
    "payment_applied",
    "note",
  ],
);

/** Billing-account counterparty category. */
export const billingAccountTypeEnum = pgEnum("billing_account_type", [
  "user",
  "group_account",
  "biz",
]);

/** Billing-account lifecycle state. */
export const billingAccountStatusEnum = pgEnum("billing_account_status", [
  "active",
  "suspended",
  "closed",
]);

/** Purchase-order lifecycle state. */
export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", [
  "draft",
  "issued",
  "accepted",
  "partially_billed",
  "closed",
  "cancelled",
]);

/** AR-invoice lifecycle state. */
export const arInvoiceStatusEnum = pgEnum("ar_invoice_status", [
  "draft",
  "issued",
  "partially_paid",
  "paid",
  "overdue",
  "voided",
  "in_dispute",
  "written_off",
]);

/** AR-invoice event taxonomy for immutable invoice timelines. */
export const invoiceEventTypeEnum = pgEnum("invoice_event_type", [
  "created",
  "issued",
  "sent",
  "viewed",
  "payment_recorded",
  "partial_payment",
  "voided",
  "disputed",
  "resolved",
  "note",
]);

/**
 * High-level commitment contract family.
 *
 * This stays intentionally generic so one module can cover:
 * - escrow style holding/release,
 * - retainage style delayed release,
 * - service-level commitment agreements,
 * - dispute-mediated settlement contracts.
 */
export const commitmentContractTypeEnum = pgEnum("commitment_contract_type", [
  "escrow",
  "retainage",
  "service_commitment",
  "payment_assurance",
  "custom",
]);

/** Lifecycle state for one commitment contract. */
export const commitmentContractStatusEnum = pgEnum("commitment_contract_status", [
  "draft",
  "active",
  "paused",
  "completed",
  "cancelled",
  "defaulted",
  "disputed",
]);

/**
 * Semantic requirement type for one obligation row under a commitment.
 */
export const commitmentObligationTypeEnum = pgEnum("commitment_obligation_type", [
  "payment",
  "service_delivery",
  "evidence_submission",
  "inspection_pass",
  "approval",
  "custom",
]);

/** Lifecycle state for one commitment obligation. */
export const commitmentObligationStatusEnum = pgEnum("commitment_obligation_status", [
  "pending",
  "in_progress",
  "satisfied",
  "waived",
  "breached",
  "cancelled",
  "expired",
]);

/** Lifecycle state for one commitment milestone. */
export const commitmentMilestoneStatusEnum = pgEnum("commitment_milestone_status", [
  "pending",
  "ready",
  "released",
  "skipped",
  "cancelled",
]);

/**
 * Evaluation mode for milestone requirement groups.
 *
 * - `all`: all required linked obligations must satisfy.
 * - `any`: at least one required linked obligation must satisfy.
 * - `threshold`: `min_satisfied_count` determines gate pass.
 */
export const commitmentMilestoneEvaluationModeEnum = pgEnum(
  "commitment_milestone_evaluation_mode",
  ["all", "any", "threshold"],
);

/**
 * Release trigger mode for one milestone.
 *
 * - `manual`: operator/workflow explicitly releases.
 * - `automatic`: release is emitted as soon as evaluation passes.
 */
export const commitmentMilestoneReleaseModeEnum = pgEnum(
  "commitment_milestone_release_mode",
  ["manual", "automatic"],
);

/** Secured-balance account category. */
export const securedBalanceAccountTypeEnum = pgEnum("secured_balance_account_type", [
  "escrow",
  "retainage",
  "deposit",
  "assurance",
  "custom",
]);

/** Lifecycle state for one secured-balance account. */
export const securedBalanceAccountStatusEnum = pgEnum(
  "secured_balance_account_status",
  ["open", "locked", "releasing", "frozen", "closed"],
);

/** Immutable ledger movement type for secured balances. */
export const securedBalanceLedgerEntryTypeEnum = pgEnum(
  "secured_balance_ledger_entry_type",
  [
    "fund",
    "hold",
    "release",
    "refund",
    "forfeit",
    "adjustment",
    "transfer_in",
    "transfer_out",
  ],
);

/** Posting state for one secured-balance ledger entry. */
export const securedBalanceLedgerEntryStatusEnum = pgEnum(
  "secured_balance_ledger_entry_status",
  ["pending", "posted", "reversed", "failed"],
);

/** Allocation reason for distributing one secured-balance ledger amount. */
export const securedBalanceAllocationTypeEnum = pgEnum(
  "secured_balance_allocation_type",
  ["obligation_settlement", "milestone_release", "refund", "forfeit", "adjustment"],
);

/** Claim category under commitment dispute workflows. */
export const commitmentClaimTypeEnum = pgEnum("commitment_claim_type", [
  "non_delivery",
  "quality_issue",
  "damage",
  "billing_dispute",
  "fraud",
  "sla_breach",
  "custom",
]);

/** Lifecycle state for one commitment claim. */
export const commitmentClaimStatusEnum = pgEnum("commitment_claim_status", [
  "open",
  "in_review",
  "escalated",
  "resolved",
  "rejected",
  "cancelled",
  "closed",
]);

/** Resolution outcome for a closed claim. */
export const commitmentClaimResolutionTypeEnum = pgEnum(
  "commitment_claim_resolution_type",
  [
    "release_funds",
    "refund",
    "forfeit",
    "partial_settlement",
    "rework_required",
    "no_action",
    "other",
  ],
);

/** Timeline event type for commitment claim history rows. */
export const commitmentClaimEventTypeEnum = pgEnum("commitment_claim_event_type", [
  "opened",
  "note",
  "evidence_added",
  "amount_updated",
  "escalated",
  "resolution_proposed",
  "resolved",
  "reopened",
  "closed",
]);

// ---------------------------------------------------------------------------
// SLA + FX/Tax + Workforce leave domain
// ---------------------------------------------------------------------------

/** Scope discriminator for reusable SLA policy definitions. */
export const slaPolicyScopeTypeEnum = pgEnum("sla_policy_scope_type", [
  "biz",
  "location",
  "resource",
  "offer_version",
  "service_product",
  "queue",
  "custom_subject",
]);

/** What SLA metric is measured (response/start/completion/custom). */
export const slaMetricKindEnum = pgEnum("sla_metric_kind", [
  "response_time",
  "start_time",
  "completion_time",
  "custom",
]);

/** Lifecycle state for breach records. */
export const slaBreachStatusEnum = pgEnum("sla_breach_status", [
  "open",
  "acknowledged",
  "compensated",
  "waived",
  "closed",
]);

/** Target discriminator for one concrete breach instance. */
export const slaBreachTargetTypeEnum = pgEnum("sla_breach_target_type", [
  "booking_order",
  "fulfillment_unit",
  "queue_entry",
  "work_run",
  "resource",
  "custom_subject",
]);

/** Compensation artifact kind used when resolving SLA breaches. */
export const slaCompensationTypeEnum = pgEnum("sla_compensation_type", [
  "credit",
  "refund",
  "gift_value",
  "internal_adjustment",
  "custom",
]);

/** Lifecycle status for SLA compensation records. */
export const slaCompensationStatusEnum = pgEnum("sla_compensation_status", [
  "pending",
  "applied",
  "reversed",
  "failed",
]);

/** FX rate source kind for deterministic replay/audit. */
export const fxRateSourceEnum = pgEnum("fx_rate_source", [
  "provider",
  "manual",
  "custom",
]);

/** Tax calculation lifecycle status. */
export const taxCalculationStatusEnum = pgEnum("tax_calculation_status", [
  "calculated",
  "finalized",
  "voided",
]);

/** Unit used by leave policy and leave request quantities. */
export const leaveUnitEnum = pgEnum("leave_unit", [
  "minutes",
  "hours",
  "days",
]);

/** Leave accrual cadence model. */
export const leaveAccrualPeriodEnum = pgEnum("leave_accrual_period", [
  "per_hour_worked",
  "weekly",
  "biweekly",
  "monthly",
  "yearly",
  "manual",
]);

/** Leave-request workflow status. */
export const leaveRequestStatusEnum = pgEnum("leave_request_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "withdrawn",
]);

/** Event taxonomy for leave ledger rows. */
export const leaveEventTypeEnum = pgEnum("leave_event_type", [
  "grant",
  "accrual",
  "adjustment",
  "request_approved",
  "request_reversed",
  "expiry",
  "carryover",
]);

// ---------------------------------------------------------------------------
// Offline + reporting fact domain
// ---------------------------------------------------------------------------

/** Offline operation intent class captured by sync journal rows. */
export const offlineOperationKindEnum = pgEnum("offline_operation_kind", [
  "create",
  "update",
  "delete",
  "upsert",
  "custom",
]);

/** Processing status for one offline journal row. */
export const offlineOperationStatusEnum = pgEnum("offline_operation_status", [
  "pending",
  "applied",
  "conflict",
  "rejected",
  "failed",
  "superseded",
]);

/** Conflict class used for deterministic merge handling. */
export const offlineConflictTypeEnum = pgEnum("offline_conflict_type", [
  "version_mismatch",
  "uniqueness_violation",
  "dependency_missing",
  "permission_denied",
  "deleted_remote",
  "custom",
]);

/** Lifecycle status for one recorded merge conflict. */
export const offlineConflictStatusEnum = pgEnum("offline_conflict_status", [
  "open",
  "resolved",
  "ignored",
  "escalated",
]);

/** Action type captured by conflict-resolution event ledger. */
export const offlineResolutionActionEnum = pgEnum("offline_resolution_action", [
  "use_local",
  "use_remote",
  "manual_merge",
  "replay_with_patch",
  "cancel_operation",
]);

/** Refresh job status for reporting fact materialization runs. */
export const factRefreshStatusEnum = pgEnum("fact_refresh_status", [
  "running",
  "succeeded",
  "partial",
  "failed",
]);

/**
 * Scope class for read-model checkpoints.
 *
 * ELI5:
 * One projection can be global for a biz or narrowed to one location/resource/
 * sellable/custom subject.
 */
export const projectionScopeTypeEnum = pgEnum("projection_scope_type", [
  "biz",
  "location",
  "resource",
  "sellable",
  "custom_subject",
]);

/**
 * Health state for one projection checkpoint row.
 *
 * This helps operations quickly detect stale/broken projections.
 */
export const projectionHealthStatusEnum = pgEnum("projection_health_status", [
  "healthy",
  "lagging",
  "degraded",
  "failed",
]);

// ---------------------------------------------------------------------------
// Notes / annotations domain
// ---------------------------------------------------------------------------

/** Visibility level for human/AI/system annotations. */
export const noteVisibilityEnum = pgEnum("note_visibility", [
  "public",
  "private",
  "ai",
  "system",
]);

/** Target entity class for annotations. */
export const noteTargetTypeEnum = pgEnum("note_target_type", [
  "booking_order",
  "fulfillment_unit",
  "resource",
  "offer",
  "offer_version",
  "customer",
  "queue_entry",
  "trip",
  "custom",
]);

/** Annotation lifecycle status. */
export const noteStatusEnum = pgEnum("note_status", [
  "active",
  "archived",
  "deleted",
]);

// ---------------------------------------------------------------------------
// Unified access-rights domain (licenses/downloads/tickets/content gates)
// ---------------------------------------------------------------------------

/**
 * What kind of access right the artifact represents.
 *
 * Keep this broad so one backbone can model:
 * - license keys,
 * - download entitlements,
 * - ticket/access claims,
 * - generic gated-content rights.
 */
export const accessArtifactTypeEnum = pgEnum("access_artifact_type", [
  "access_grant",
  "license_key",
  "download_entitlement",
  "ticket_entitlement",
  "content_gate",
  "replay_access",
  "custom",
]);

/** Lifecycle state for one access artifact row. */
export const accessArtifactStatusEnum = pgEnum("access_artifact_status", [
  "draft",
  "active",
  "suspended",
  "revoked",
  "expired",
  "consumed",
  "transferred",
]);

/** Link target type for `access_artifact_links`. */
export const accessArtifactLinkTypeEnum = pgEnum("access_artifact_link_type", [
  "sellable",
  "booking_order",
  "booking_order_line",
  "membership",
  "entitlement_grant",
  "payment_transaction",
  "fulfillment_unit",
  "custom_subject",
  "external_reference",
]);

/** Event taxonomy for immutable artifact event timeline rows. */
export const accessArtifactEventTypeEnum = pgEnum("access_artifact_event_type", [
  "issued",
  "activated",
  "verified",
  "verification_failed",
  "consumed",
  "usage_debited",
  "usage_credited",
  "suspended",
  "unsuspended",
  "revoked",
  "expired",
  "transferred_in",
  "transferred_out",
  "reissued",
  "metadata_updated",
]);

/** Access action captured in access activity logs. */
export const accessActionTypeEnum = pgEnum("access_action_type", [
  "verify",
  "view",
  "download",
  "redeem",
  "transfer",
  "support_override",
]);

/** Outcome class for one access activity attempt. */
export const accessActionOutcomeEnum = pgEnum("access_action_outcome", [
  "allowed",
  "denied",
  "expired",
  "revoked",
  "suspended",
  "limit_exceeded",
  "invalid",
  "risk_blocked",
  "not_found",
  "error",
]);

/** Limit window semantics for reusable usage policies. */
export const accessUsageWindowModeEnum = pgEnum("access_usage_window_mode", [
  "lifetime",
  "rolling_window",
  "calendar_day",
  "fixed_window",
]);

/** Lifecycle for signed/opaque access delivery links. */
export const accessDeliveryLinkStatusEnum = pgEnum("access_delivery_link_status", [
  "active",
  "expired",
  "revoked",
  "consumed",
]);

/** Distribution path used for one access delivery link. */
export const accessDeliveryLinkChannelEnum = pgEnum("access_delivery_link_channel", [
  "web",
  "email",
  "sms",
  "api",
  "support",
]);

// ---------------------------------------------------------------------------
// Checkout session + recovery domain
// ---------------------------------------------------------------------------

/** Lifecycle state of one recoverable checkout session. */
export const checkoutSessionStatusEnum = pgEnum("checkout_session_status", [
  "active",
  "abandoned",
  "recovery_sent",
  "recovered",
  "completed",
  "expired",
  "cancelled",
]);

/** Channel where checkout was initiated/executed. */
export const checkoutChannelEnum = pgEnum("checkout_channel", [
  "web",
  "mobile",
  "pos",
  "api",
  "admin",
  "external_channel",
]);

/** Item type in a checkout session line. */
export const checkoutItemTypeEnum = pgEnum("checkout_item_type", [
  "sellable",
  "custom_fee",
  "custom_subject",
]);

/** Event taxonomy for checkout session timeline rows. */
export const checkoutEventTypeEnum = pgEnum("checkout_event_type", [
  "started",
  "item_added",
  "item_updated",
  "item_removed",
  "coupon_applied",
  "coupon_removed",
  "payment_started",
  "payment_failed",
  "abandoned",
  "recovery_sent",
  "recovered",
  "completed",
  "expired",
  "cancelled",
]);

/** Lifecycle state for recovery links/messages. */
export const checkoutRecoveryStatusEnum = pgEnum("checkout_recovery_status", [
  "active",
  "used",
  "expired",
  "revoked",
]);

/** Message/delivery channel used for checkout recovery outreach. */
export const checkoutRecoveryChannelEnum = pgEnum("checkout_recovery_channel", [
  "email",
  "sms",
  "push",
  "manual",
  "link",
]);

// ---------------------------------------------------------------------------
// Generic requirement graph / progression domain
// ---------------------------------------------------------------------------

/** Lifecycle of a requirement set definition. */
export const requirementSetStatusEnum = pgEnum("requirement_set_status", [
  "draft",
  "active",
  "inactive",
  "archived",
]);

/** How requirement-set pass/fail is evaluated. */
export const requirementSetEvaluationModeEnum = pgEnum(
  "requirement_set_evaluation_mode",
  ["all", "any", "threshold"],
);

/** Node behavior class inside a requirement graph. */
export const requirementNodeTypeEnum = pgEnum("requirement_node_type", [
  "predicate",
  "group",
  "milestone",
  "manual",
  "custom",
]);

/** Edge semantics in the requirement graph. */
export const requirementEdgeTypeEnum = pgEnum("requirement_edge_type", [
  "depends_on",
  "unlocks",
  "blocks",
]);

/** Runtime status of one requirement evaluation instance. */
export const requirementEvaluationStatusEnum = pgEnum(
  "requirement_evaluation_status",
  ["pending", "in_progress", "passed", "failed", "blocked", "waived", "expired"],
);

/** Evidence source class linked to requirement evaluation records. */
export const requirementEvidenceTypeEnum = pgEnum("requirement_evidence_type", [
  "subject",
  "external_reference",
  "artifact",
  "event",
]);

// ---------------------------------------------------------------------------
// Virtual/live session interaction domain
// ---------------------------------------------------------------------------

/** Session source family for one interaction event. */
export const sessionInteractionSourceTypeEnum = pgEnum(
  "session_interaction_source_type",
  ["program_session", "fulfillment_unit", "custom_subject"],
);

/** Interaction event type captured for engagement analytics/workflows. */
export const sessionInteractionTypeEnum = pgEnum("session_interaction_type", [
  "join",
  "leave",
  "chat_message",
  "qna_question",
  "qna_answer",
  "poll_response",
  "reaction",
  "hand_raise",
  "replay_view",
  "custom",
]);

/** Visibility class of one interaction event payload. */
export const sessionInteractionVisibilityEnum = pgEnum(
  "session_interaction_visibility",
  ["public", "participant_only", "staff_only", "private"],
);

// ---------------------------------------------------------------------------
// Sellable variant domain
// ---------------------------------------------------------------------------

/** Dimension data type for sellable variant modeling. */
export const sellableVariantDimensionTypeEnum = pgEnum(
  "sellable_variant_dimension_type",
  ["choice", "boolean", "numeric", "text"],
);

/** Lifecycle status for one concrete variant row. */
export const sellableVariantStatusEnum = pgEnum("sellable_variant_status", [
  "active",
  "inactive",
  "archived",
]);

/** How variant pricing is derived relative to base sellable price. */
export const sellableVariantPriceModeEnum = pgEnum("sellable_variant_price_mode", [
  "inherited",
  "override",
  "delta",
]);

// ---------------------------------------------------------------------------
// Access operation extensions (tokens/transfers/resale/security)
// ---------------------------------------------------------------------------

/** Token shape used for access actions like download/verify/check-in. */
export const accessActionTokenTypeEnum = pgEnum("access_action_token_type", [
  "opaque_link",
  "numeric_code",
  "qr_code",
  "one_time_password",
  "custom",
]);

/** Lifecycle status for one access action token. */
export const accessActionTokenStatusEnum = pgEnum("access_action_token_status", [
  "active",
  "used",
  "expired",
  "revoked",
  "consumed",
]);

/** Event taxonomy for token lifecycle timeline rows. */
export const accessActionTokenEventTypeEnum = pgEnum(
  "access_action_token_event_type",
  [
    "issued",
    "validated",
    "validation_failed",
    "used",
    "reissued",
    "expired",
    "revoked",
    "consumed",
  ],
);

/** Transfer execution mode for moving access rights between parties. */
export const accessTransferModeEnum = pgEnum("access_transfer_mode", [
  "full_transfer",
  "split_transfer",
  "delegation",
]);

/** Transfer workflow lifecycle state. */
export const accessTransferStatusEnum = pgEnum("access_transfer_status", [
  "requested",
  "approved",
  "rejected",
  "cancelled",
  "expired",
  "completed",
  "reversed",
]);

/** Listing lifecycle for secondary/resale access-right offers. */
export const accessResaleStatusEnum = pgEnum("access_resale_status", [
  "draft",
  "active",
  "reserved",
  "sold",
  "expired",
  "cancelled",
  "removed",
]);

/** Security signal taxonomy for access-abuse detection workflows. */
export const accessSecuritySignalTypeEnum = pgEnum("access_security_signal_type", [
  "ip_velocity",
  "geo_anomaly",
  "token_reuse",
  "device_mismatch",
  "download_burst",
  "provider_risk",
  "manual_flag",
  "custom",
]);

/** Lifecycle state for one detected security signal row. */
export const accessSecuritySignalStatusEnum = pgEnum("access_security_signal_status", [
  "open",
  "acknowledged",
  "resolved",
  "dismissed",
]);

/** Decision outcome class from security policy evaluation. */
export const accessSecurityDecisionOutcomeEnum = pgEnum(
  "access_security_decision_outcome",
  [
    "allow",
    "challenge",
    "deny",
    "manual_review",
    "suspend_artifact",
    "revoke_artifact",
  ],
);

/** Lifecycle state for one security decision row. */
export const accessSecurityDecisionStatusEnum = pgEnum(
  "access_security_decision_status",
  ["active", "expired", "reverted"],
);

// ---------------------------------------------------------------------------
// Sellable pricing primitives
// ---------------------------------------------------------------------------

/** Commercial pricing mode used by one sellable pricing rule. */
export const sellablePricingModeEnum = pgEnum("sellable_pricing_mode", [
  "free",
  "fixed",
  "flexible",
  "tiered",
  "metered",
  "external_quote",
]);

/** Scope used by pricing rows and overrides. */
export const sellablePricingScopeTypeEnum = pgEnum("sellable_pricing_scope_type", [
  "biz",
  "location",
  "channel",
  "custom_subject",
]);

/** Threshold semantic class for pricing guardrails. */
export const sellablePricingThresholdTypeEnum = pgEnum(
  "sellable_pricing_threshold_type",
  ["minimum", "maximum", "suggested", "default"],
);

/** Override mechanic used by scoped pricing override rows. */
export const sellablePricingOverrideTypeEnum = pgEnum(
  "sellable_pricing_override_type",
  ["absolute", "delta", "multiplier"],
);

// ---------------------------------------------------------------------------
// Assessment / grading primitives
// ---------------------------------------------------------------------------

/** Lifecycle state for one assessment template. */
export const assessmentTemplateStatusEnum = pgEnum("assessment_template_status", [
  "draft",
  "active",
  "inactive",
  "archived",
]);

/** Item/question type in an assessment template. */
export const assessmentItemTypeEnum = pgEnum("assessment_item_type", [
  "single_choice",
  "multi_choice",
  "text",
  "numeric",
  "boolean",
  "file_upload",
  "custom",
]);

/** How grading is evaluated for a template/attempt. */
export const assessmentEvaluationModeEnum = pgEnum("assessment_evaluation_mode", [
  "auto",
  "manual",
  "hybrid",
]);

/** Attempt lifecycle state for one assessment run. */
export const assessmentAttemptStatusEnum = pgEnum("assessment_attempt_status", [
  "started",
  "submitted",
  "graded",
  "passed",
  "failed",
  "expired",
  "cancelled",
  "voided",
]);

/** Final result status for a finalized assessment outcome row. */
export const assessmentResultStatusEnum = pgEnum("assessment_result_status", [
  "pending",
  "passed",
  "failed",
  "waived",
  "invalidated",
]);

/** Event taxonomy for grading and regrading timeline records. */
export const gradingEventTypeEnum = pgEnum("grading_event_type", [
  "attempt_started",
  "attempt_submitted",
  "auto_graded",
  "manual_graded",
  "regraded",
  "waived",
  "override_pass",
  "override_fail",
  "feedback_added",
]);

// ---------------------------------------------------------------------------
// Enterprise control-plane primitives
// ---------------------------------------------------------------------------

/**
 * Generic enterprise scope vocabulary used by delegation, inheritance,
 * contract-pack binding, and rollout primitives.
 *
 * Why this enum exists:
 * - keeps "where does this rule apply?" shape consistent across modules.
 * - avoids one-off scope fields per enterprise table.
 */
export const enterpriseScopeTypeEnum = pgEnum("enterprise_scope_type", [
  "network",
  "biz",
  "location",
  "subject",
]);

/** Lifecycle state for delegated admin authority grants. */
export const enterpriseDelegationStatusEnum = pgEnum(
  "enterprise_delegation_status",
  ["active", "revoked", "expired", "suspended"],
);

/** Status of one materialized inheritance resolution snapshot. */
export const enterpriseResolutionStatusEnum = pgEnum(
  "enterprise_resolution_status",
  ["ready", "stale", "error"],
);

/** Intercompany account classification for accounting/reporting behavior. */
export const intercompanyAccountTypeEnum = pgEnum("intercompany_account_type", [
  "clearing",
  "royalty",
  "management_fee",
  "cost_share",
  "custom",
]);

/** Intercompany ledger movement class. */
export const intercompanyEntryTypeEnum = pgEnum("intercompany_entry_type", [
  "accrual",
  "adjustment",
  "settlement",
  "reversal",
]);

/** Posting state for one intercompany ledger movement. */
export const intercompanyEntryStatusEnum = pgEnum("intercompany_entry_status", [
  "pending",
  "posted",
  "reversed",
  "voided",
]);

/** Batch status for one intercompany settlement run. */
export const intercompanySettlementRunStatusEnum = pgEnum(
  "intercompany_settlement_run_status",
  ["draft", "running", "completed", "failed", "cancelled"],
);

/** Binding strength when attaching contract packs to scopes. */
export const enterpriseContractPackBindingModeEnum = pgEnum(
  "enterprise_contract_pack_binding_mode",
  ["required", "recommended", "optional"],
);

/** Enterprise identity-provider category. */
export const enterpriseIdentityProviderTypeEnum = pgEnum(
  "enterprise_identity_provider_type",
  ["oidc", "saml", "scim", "custom"],
);

/** Control-plane status for SCIM synchronization runs. */
export const enterpriseScimSyncStatusEnum = pgEnum("enterprise_scim_sync_status", [
  "pending",
  "running",
  "succeeded",
  "partial",
  "failed",
]);

/** Lifecycle state for one external directory identity link. */
export const enterpriseDirectoryLinkStatusEnum = pgEnum(
  "enterprise_directory_link_status",
  ["active", "disabled", "error"],
);

/** Control-plane status for change rollout runs. */
export const enterpriseRolloutStatusEnum = pgEnum("enterprise_rollout_status", [
  "draft",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

/** Per-target execution status inside a rollout run. */
export const enterpriseRolloutTargetStatusEnum = pgEnum(
  "enterprise_rollout_target_status",
  ["pending", "applied", "skipped", "failed"],
);
