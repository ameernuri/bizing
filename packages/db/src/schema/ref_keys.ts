/**
 * Canonical reference-key builders for cross-table interoperability.
 *
 * ELI5:
 * Many schema rows store a "ref key" string like `resource:abc123`.
 * These keys let generic code (plugins, jobs, API handlers) join/query across
 * domains without knowing every typed FK column beforehand.
 *
 * Why this file exists:
 * - one deterministic builder means one key format everywhere,
 * - prevents subtle bugs from hand-built strings,
 * - keeps plugin code and core code speaking the same key language.
 */

type Id = string;

const ensure = (label: string, value: string): string => {
  if (!value || value.trim().length === 0) {
    throw new Error(`ref key builder: ${label} is required`);
  }
  return value;
};

/**
 * Calendar-binding owner key input shapes.
 *
 * This mirrors `calendar_owner_type` payload rules in `calendar_bindings`.
 */
export type CalendarOwnerRefInput =
  | { ownerType: "biz" }
  | { ownerType: "user"; ownerUserId: Id }
  | { ownerType: "resource"; resourceId: Id }
  | { ownerType: "service"; serviceId: Id }
  | { ownerType: "service_product"; serviceProductId: Id }
  | { ownerType: "offer"; offerId: Id }
  | { ownerType: "offer_version"; offerVersionId: Id }
  | { ownerType: "location"; locationId: Id }
  | { ownerType: "custom_subject"; ownerRefType: string; ownerRefId: Id };

/**
 * Build deterministic key for `calendar_bindings.owner_ref_key`.
 */
export const buildCalendarOwnerRefKey = (input: CalendarOwnerRefInput): string => {
  switch (input.ownerType) {
    case "biz":
      return "biz";
    case "user":
      return `user:${ensure("ownerUserId", input.ownerUserId)}`;
    case "resource":
      return `resource:${ensure("resourceId", input.resourceId)}`;
    case "service":
      return `service:${ensure("serviceId", input.serviceId)}`;
    case "service_product":
      return `service_product:${ensure("serviceProductId", input.serviceProductId)}`;
    case "offer":
      return `offer:${ensure("offerId", input.offerId)}`;
    case "offer_version":
      return `offer_version:${ensure("offerVersionId", input.offerVersionId)}`;
    case "location":
      return `location:${ensure("locationId", input.locationId)}`;
    case "custom_subject":
      return `custom_subject:${ensure("ownerRefType", input.ownerRefType)}:${ensure("ownerRefId", input.ownerRefId)}`;
    default: {
      const impossible: never = input;
      throw new Error(`Unsupported calendar owner type: ${String(impossible)}`);
    }
  }
};

/**
 * Hold-policy target key input shapes.
 *
 * This mirrors `capacity_hold_policy_target_type` payload rules.
 */
export type CapacityHoldPolicyTargetRefInput =
  | { targetType: "biz" }
  | { targetType: "location"; locationId: Id }
  | { targetType: "calendar"; calendarId: Id }
  | { targetType: "resource"; resourceId: Id }
  | { targetType: "capacity_pool"; capacityPoolId: Id }
  | { targetType: "service"; serviceId: Id }
  | { targetType: "service_product"; serviceProductId: Id }
  | { targetType: "offer"; offerId: Id }
  | { targetType: "offer_version"; offerVersionId: Id }
  | { targetType: "product"; productId: Id }
  | { targetType: "sellable"; sellableId: Id }
  | { targetType: "custom_subject"; targetRefType: string; targetRefId: Id };

/**
 * Build deterministic key for `capacity_hold_policies.target_ref_key`.
 */
export const buildCapacityHoldPolicyTargetRefKey = (
  input: CapacityHoldPolicyTargetRefInput,
): string => {
  switch (input.targetType) {
    case "biz":
      return "biz";
    case "location":
      return `location:${ensure("locationId", input.locationId)}`;
    case "calendar":
      return `calendar:${ensure("calendarId", input.calendarId)}`;
    case "resource":
      return `resource:${ensure("resourceId", input.resourceId)}`;
    case "capacity_pool":
      return `capacity_pool:${ensure("capacityPoolId", input.capacityPoolId)}`;
    case "service":
      return `service:${ensure("serviceId", input.serviceId)}`;
    case "service_product":
      return `service_product:${ensure("serviceProductId", input.serviceProductId)}`;
    case "offer":
      return `offer:${ensure("offerId", input.offerId)}`;
    case "offer_version":
      return `offer_version:${ensure("offerVersionId", input.offerVersionId)}`;
    case "product":
      return `product:${ensure("productId", input.productId)}`;
    case "sellable":
      return `sellable:${ensure("sellableId", input.sellableId)}`;
    case "custom_subject":
      return `custom_subject:${ensure("targetRefType", input.targetRefType)}:${ensure("targetRefId", input.targetRefId)}`;
    default: {
      const impossible: never = input;
      throw new Error(`Unsupported hold-policy target type: ${String(impossible)}`);
    }
  }
};

/**
 * Hold-row target key input shapes.
 *
 * This mirrors `capacity_hold_target_type` payload rules.
 */
export type CapacityHoldTargetRefInput =
  | { targetType: "calendar"; calendarId: Id }
  | { targetType: "capacity_pool"; capacityPoolId: Id }
  | { targetType: "resource"; resourceId: Id }
  | { targetType: "offer_version"; offerVersionId: Id }
  | { targetType: "custom_subject"; targetRefType: string; targetRefId: Id };

/**
 * Build deterministic key for `capacity_holds.target_ref_key`.
 */
export const buildCapacityHoldTargetRefKey = (
  input: CapacityHoldTargetRefInput,
): string => {
  switch (input.targetType) {
    case "calendar":
      return `calendar:${ensure("calendarId", input.calendarId)}`;
    case "capacity_pool":
      return `capacity_pool:${ensure("capacityPoolId", input.capacityPoolId)}`;
    case "resource":
      return `resource:${ensure("resourceId", input.resourceId)}`;
    case "offer_version":
      return `offer_version:${ensure("offerVersionId", input.offerVersionId)}`;
    case "custom_subject":
      return `custom_subject:${ensure("targetRefType", input.targetRefType)}:${ensure("targetRefId", input.targetRefId)}`;
    default: {
      const impossible: never = input;
      throw new Error(`Unsupported hold target type: ${String(impossible)}`);
    }
  }
};

/**
 * Hold-owner key input shapes.
 *
 * This mirrors `capacity_hold_owner_type` payload rules.
 */
export type CapacityHoldOwnerRefInput =
  | { ownerType: "user"; ownerUserId: Id }
  | { ownerType: "group_account"; ownerGroupAccountId: Id }
  | { ownerType: "subject"; ownerSubjectType: string; ownerSubjectId: Id }
  | { ownerType: "guest_fingerprint"; ownerFingerprintHash: string }
  | { ownerType: "system" };

/**
 * Build deterministic key for `capacity_holds.owner_ref_key`.
 */
export const buildCapacityHoldOwnerRefKey = (
  input: CapacityHoldOwnerRefInput,
): string => {
  switch (input.ownerType) {
    case "user":
      return `user:${ensure("ownerUserId", input.ownerUserId)}`;
    case "group_account":
      return `group_account:${ensure("ownerGroupAccountId", input.ownerGroupAccountId)}`;
    case "subject":
      return `subject:${ensure("ownerSubjectType", input.ownerSubjectType)}:${ensure("ownerSubjectId", input.ownerSubjectId)}`;
    case "guest_fingerprint":
      return `guest_fingerprint:${ensure("ownerFingerprintHash", input.ownerFingerprintHash)}`;
    case "system":
      return "system";
    default: {
      const impossible: never = input;
      throw new Error(`Unsupported hold owner type: ${String(impossible)}`);
    }
  }
};

/**
 * Convenience helper for hold writes.
 *
 * ELI5:
 * API/services often need both keys at once when inserting hold rows.
 * This helper keeps that call-site logic tiny and consistent.
 */
export const buildCapacityHoldRefKeys = (input: {
  target: CapacityHoldTargetRefInput;
  owner?: CapacityHoldOwnerRefInput | null;
}): { targetRefKey: string; ownerRefKey: string | null } => ({
  targetRefKey: buildCapacityHoldTargetRefKey(input.target),
  ownerRefKey: input.owner ? buildCapacityHoldOwnerRefKey(input.owner) : null,
});

/**
 * Convenience helper for hold-policy writes.
 *
 * Returns the canonical target key expected by
 * `capacity_hold_policies.target_ref_key`.
 */
export const buildCapacityHoldPolicyRefKey = (
  target: CapacityHoldPolicyTargetRefInput,
): string => buildCapacityHoldPolicyTargetRefKey(target);
