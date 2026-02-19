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
/** @deprecated Use `sharedAccountTypeEnum`. */
export const partyTypeEnum = sharedAccountTypeEnum;

/** Party member roles drive delegation and permission semantics. */
export const sharedAccountMemberRoleEnum = pgEnum(
  "shared_account_member_role",
  ["primary", "adult", "minor", "dependent", "employee"],
);
/** @deprecated Use `sharedAccountMemberRoleEnum`. */
export const partyMemberRoleEnum = sharedAccountMemberRoleEnum;

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

/** Polymorphic bookable entity category. */
export const bookableTypeEnum = pgEnum("bookable_type", [
  "host",
  "company_host",
  "asset",
  "venue",
  "service",
]);

/** Operational status for any bookable (used by availability filtering). */
export const bookableStatusEnum = pgEnum("bookable_status", [
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
 * Operational effect of a matched availability rule.
 * `override_hours` and `special_pricing` preserve former exception scenarios.
 */
export const availabilityRuleEffectEnum = pgEnum("availability_rule_effect", [
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

/** Duration planning mode for availability + pricing computation. */
export const durationModeEnum = pgEnum("duration_mode", [
  "fixed",
  "flexible",
  "multi_day",
]);

/**
 * Booking lifecycle state machine.
 *
 * Notes:
 * - `held` is a pre-confirmation reservation-like state.
 * - `pending_approval` is manual approval workflow.
 * - `waitlisted` is explicit queue/race wait state.
 */
export const bookingStatusEnum = pgEnum("booking_status", [
  "draft",
  "held",
  "pending",
  "pending_approval",
  "confirmed",
  "checked_in",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
  "declined",
  "waitlisted",
]);

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

/** Visibility model for notes attached to bookings. */
export const noteVisibilityEnum = pgEnum("note_visibility", [
  "public",
  "private",
  "system",
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
  "processing",
  "succeeded",
  "canceled",
  "failed",
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
