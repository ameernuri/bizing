/**
 * Canonical booking domain barrel.
 *
 * This is the single source of truth for booking architecture modules.
 * Keeping this barrel explicit makes the public schema contract intentional,
 * stable, and easy to extend without introducing parallel table families.
 */
export * from "./offers";
export * from "./supply";
export * from "./time_availability";
export * from "./calendar_sync";
export * from "./credential_exchange";
export * from "./fulfillment";
export * from "./payments";
export * from "./compensation";
export * from "./product_commerce";
export * from "./demand_pricing";
export * from "./entitlements";
export * from "./channels";
export * from "./intelligence";
export * from "./education";
export * from "./progression";
export * from "./audit";
export * from "./ref_keys";
export * from "./extensions";
export * from "./biz_configs";
export * from "./subjects";
export * from "./access_rights";
export * from "./access_library";
export * from "./checkout";
export * from "./commerce_preferences";
export * from "./sales_quotes";
export * from "./session_interactions";
export * from "./session_interaction_artifacts";
export * from "./sellable_variants";
export * from "./sellable_pricing";
export * from "./assessments";
export * from "./interaction_forms";
export * from "./communications";
export * from "./social_graph";
export * from "./api_credentials";
export * from "./surveys";
export * from "./promotions";
export * from "./work_management";
export * from "./notes";
export * from "./queue";
export * from "./queue_operations";
export * from "./seating";
export * from "./transportation";
export * from "./marketplace";
export * from "./referral_attribution";
export * from "./operations_backbone";
export * from "./enterprise";
export * from "./governance";
export * from "./authz";
export * from "./hipaa";
export * from "./payer_eligibility";
export * from "./workflows";
export * from "./gifts";
export * from "./participant_obligations";
export * from "./ar";
export * from "./receivables";
export * from "./commitments";
export * from "./fulfillment_transfers";
export * from "./sla";
export * from "./tax_fx";
export * from "./leave";
export * from "./offline";
export * from "./reporting";
export * from "./shipment_schedules";
export * from "./gift_delivery";
export * from "./marketing_performance";
export * from "./crm";
export * from "./supply_batches";
export * from "./sagas";
