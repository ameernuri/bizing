// ============================================
// BIZING SCHEMA GRAPH - 479 TABLES
// ============================================

MATCH (n) DETACH DELETE n;

// Create domains
CREATE (AccessDomain:Domain {name: "Access", color: "#F1948A"})
CREATE (BookingsDomain:Domain {name: "Bookings", color: "#96CEB4"})
CREATE (CatalogDomain:Domain {name: "Catalog", color: "#4ECDC4"})
CREATE (CoreDomain:Domain {name: "Core", color: "#D5DBDB"})
CREATE (EducationDomain:Domain {name: "Education", color: "#F8C471"})
CREATE (EnterpriseDomain:Domain {name: "Enterprise", color: "#BB8FCE"})
CREATE (GiftsDomain:Domain {name: "Gifts", color: "#A9DFBF"})
CREATE (GovernanceDomain:Domain {name: "Governance", color: "#85C1E2"})
CREATE (IdentityDomain:Domain {name: "Identity", color: "#FF6B6B"})
CREATE (IntelligenceDomain:Domain {name: "Intelligence", color: "#82E0AA"})
CREATE (MarketingDomain:Domain {name: "Marketing", color: "#D7BDE2"})
CREATE (MarketplaceDomain:Domain {name: "Marketplace", color: "#F7DC6F"})
CREATE (OperationsDomain:Domain {name: "Operations", color: "#85C1E9"})
CREATE (PaymentsDomain:Domain {name: "Payments", color: "#FFEAA7"})
CREATE (QueueDomain:Domain {name: "Queue", color: "#DDA0DD"})
CREATE (SocialDomain:Domain {name: "Social", color: "#98D8C8"})
CREATE (SupplyDomain:Domain {name: "Supply", color: "#45B7D1"})

// Create entities

// Access (15 tables)
CREATE (accessActionTokenEventsNode:Entity {
  name: "accessActionTokenEvents",
  tableName: "access_action_token_events",
  domain: "Access",
  description: "access_action_token_events",
  file: "access_rights.ts"
})
CREATE (AccessDomain)-[:CONTAINS]->(accessActionTokenEventsNode)
CREATE (accessActionTokensNode:Entity {
  name: "accessActionTokens",
  tableName: "access_action_tokens",
  domain: "Access",
  description: "access_action_tokens",
  file: "access_rights.ts"
})
CREATE (AccessDomain)-[:CONTAINS]->(accessActionTokensNode)
CREATE (accessActivityLogsNode:Entity {
  name: "accessActivityLogs",
  tableName: "access_activity_logs",
  domain: "Access",
  description: "access_activity_logs",
  file: "access_rights.ts"
})
CREATE (AccessDomain)-[:CONTAINS]->(accessActivityLogsNode)
CREATE (accessLibraryItemsNode:Entity {
  name: "accessLibraryItems",
  tableName: "access_library_items",
  domain: "Access",
  description: "access_library_items",
  file: "access_library.ts"
})
CREATE (AccessDomain)-[:CONTAINS]->(accessLibraryItemsNode)
CREATE (accessSecurityDecisionsNode:Entity {
  name: "accessSecurityDecisions",
  tableName: "access_security_decisions",
  domain: "Access",
  description: "access_security_decisions",
  file: "access_rights.ts"
})
CREATE (AccessDomain)-[:CONTAINS]->(accessSecurityDecisionsNode)
CREATE (accessSecuritySignalsNode:Entity {
  name: "accessSecuritySignals",
  tableName: "access_security_signals",
  domain: "Access",
  description: "access_security_signals",
  file: "access_rights.ts"
})
CREATE (AccessDomain)-[:CONTAINS]->(accessSecuritySignalsNode)
CREATE (accessTransferPoliciesNode:Entity {
  name: "accessTransferPolicies",
  tableName: "access_transfer_policies",
  domain: "Access",
  description: "access_transfer_policies",
  file: "access_rights.ts"
})
CREATE (AccessDomain)-[:CONTAINS]->(accessTransferPoliciesNode)
CREATE (accessTransfersNode:Entity {
  name: "accessTransfers",
  tableName: "access_transfers",
  domain: "Access",
  description: "access_transfers",
  file: "access_rights.ts"
})
CREATE (AccessDomain)-[:CONTAINS]->(accessTransfersNode)
CREATE (accessUsageWindowsNode:Entity {
  name: "accessUsageWindows",
  tableName: "access_usage_windows",
  domain: "Access",
  description: "access_usage_windows",
  file: "access_rights.ts"
})
CREATE (AccessDomain)-[:CONTAINS]->(accessUsageWindowsNode)
CREATE (bizExtensionPermissionGrantsNode:Entity {
  name: "bizExtensionPermissionGrants",
  tableName: "biz_extension_permission_grants",
  domain: "Access",
  description: "biz_extension_permission_grants",
  file: "extensions.ts"
})
CREATE (AccessDomain)-[:CONTAINS]->(bizExtensionPermissionGrantsNode)
CREATE (entitlementGrantsNode:Entity {
  name: "entitlementGrants",
  tableName: "entitlement_grants",
  domain: "Access",
  description: "entitlement_grants",
  file: "entitlements.ts"
})
CREATE (AccessDomain)-[:CONTAINS]->(entitlementGrantsNode)
CREATE (entitlementTransfersNode:Entity {
  name: "entitlementTransfers",
  tableName: "entitlement_transfers",
  domain: "Access",
  description: "entitlement_transfers",
  file: "entitlements.ts"
})
CREATE (AccessDomain)-[:CONTAINS]->(entitlementTransfersNode)
CREATE (entitlementWalletsNode:Entity {
  name: "entitlementWallets",
  tableName: "entitlement_wallets",
  domain: "Access",
  description: "entitlement_wallets",
  file: "entitlements.ts"
})
CREATE (AccessDomain)-[:CONTAINS]->(entitlementWalletsNode)
CREATE (extensionPermissionDefinitionsNode:Entity {
  name: "extensionPermissionDefinitions",
  tableName: "extension_permission_definitions",
  domain: "Access",
  description: "extension_permission_definitions",
  file: "extensions.ts"
})
CREATE (AccessDomain)-[:CONTAINS]->(extensionPermissionDefinitionsNode)
CREATE (rolloverRunsNode:Entity {
  name: "rolloverRuns",
  tableName: "rollover_runs",
  domain: "Access",
  description: "rollover_runs",
  file: "entitlements.ts"
})
CREATE (AccessDomain)-[:CONTAINS]->(rolloverRunsNode)

// Bookings (23 tables)
CREATE (accessDeliveryLinksNode:Entity {
  name: "accessDeliveryLinks",
  tableName: "access_delivery_links",
  domain: "Bookings",
  description: "access_delivery_links",
  file: "access_rights.ts"
})
CREATE (BookingsDomain)-[:CONTAINS]->(accessDeliveryLinksNode)
CREATE (bookingOrderLinesNode:Entity {
  name: "bookingOrderLines",
  tableName: "booking_order_lines",
  domain: "Bookings",
  description: "booking_order_lines",
  file: "fulfillment.ts"
})
CREATE (BookingsDomain)-[:CONTAINS]->(bookingOrderLinesNode)
CREATE (bookingOrdersNode:Entity {
  name: "bookingOrders",
  tableName: "booking_orders",
  domain: "Bookings",
  description: "booking_orders",
  file: "fulfillment.ts"
})
CREATE (BookingsDomain)-[:CONTAINS]->(bookingOrdersNode)
CREATE (bookingParticipantObligationsNode:Entity {
  name: "bookingParticipantObligations",
  tableName: "booking_participant_obligations",
  domain: "Bookings",
  description: "booking_participant_obligations",
  file: "participant_obligations.ts"
})
CREATE (BookingsDomain)-[:CONTAINS]->(bookingParticipantObligationsNode)
CREATE (commitmentClaimEventsNode:Entity {
  name: "commitmentClaimEvents",
  tableName: "commitment_claim_events",
  domain: "Bookings",
  description: "commitment_claim_events",
  file: "commitments.ts"
})
CREATE (BookingsDomain)-[:CONTAINS]->(commitmentClaimEventsNode)
CREATE (commitmentClaimsNode:Entity {
  name: "commitmentClaims",
  tableName: "commitment_claims",
  domain: "Bookings",
  description: "commitment_claims",
  file: "commitments.ts"
})
CREATE (BookingsDomain)-[:CONTAINS]->(commitmentClaimsNode)
CREATE (commitmentContractsNode:Entity {
  name: "commitmentContracts",
  tableName: "commitment_contracts",
  domain: "Bookings",
  description: "commitment_contracts",
  file: "commitments.ts"
})
CREATE (BookingsDomain)-[:CONTAINS]->(commitmentContractsNode)
CREATE (commitmentMilestoneObligationsNode:Entity {
  name: "commitmentMilestoneObligations",
  tableName: "commitment_milestone_obligations",
  domain: "Bookings",
  description: "commitment_milestone_obligations",
  file: "commitments.ts"
})
CREATE (BookingsDomain)-[:CONTAINS]->(commitmentMilestoneObligationsNode)
CREATE (commitmentMilestonesNode:Entity {
  name: "commitmentMilestones",
  tableName: "commitment_milestones",
  domain: "Bookings",
  description: "commitment_milestones",
  file: "commitments.ts"
})
CREATE (BookingsDomain)-[:CONTAINS]->(commitmentMilestonesNode)
CREATE (commitmentObligationsNode:Entity {
  name: "commitmentObligations",
  tableName: "commitment_obligations",
  domain: "Bookings",
  description: "commitment_obligations",
  file: "commitments.ts"
})
CREATE (BookingsDomain)-[:CONTAINS]->(commitmentObligationsNode)
CREATE (fulfillmentAssignmentEventsNode:Entity {
  name: "fulfillmentAssignmentEvents",
  tableName: "fulfillment_assignment_events",
  domain: "Bookings",
  description: "fulfillment_assignment_events",
  file: "fulfillment.ts"
})
CREATE (BookingsDomain)-[:CONTAINS]->(fulfillmentAssignmentEventsNode)
CREATE (fulfillmentAssignmentsNode:Entity {
  name: "fulfillmentAssignments",
  tableName: "fulfillment_assignments",
  domain: "Bookings",
  description: "fulfillment_assignments",
  file: "fulfillment.ts"
})
CREATE (BookingsDomain)-[:CONTAINS]->(fulfillmentAssignmentsNode)
CREATE (fulfillmentCheckpointsNode:Entity {
  name: "fulfillmentCheckpoints",
  tableName: "fulfillment_checkpoints",
  domain: "Bookings",
  description: "fulfillment_checkpoints",
  file: "fulfillment.ts"
})
CREATE (BookingsDomain)-[:CONTAINS]->(fulfillmentCheckpointsNode)
CREATE (fulfillmentDependenciesNode:Entity {
  name: "fulfillmentDependencies",
  tableName: "fulfillment_dependencies",
  domain: "Bookings",
  description: "fulfillment_dependencies",
  file: "fulfillment.ts"
})
CREATE (BookingsDomain)-[:CONTAINS]->(fulfillmentDependenciesNode)
CREATE (fulfillmentTransferEventsNode:Entity {
  name: "fulfillmentTransferEvents",
  tableName: "fulfillment_transfer_events",
  domain: "Bookings",
  description: "fulfillment_transfer_events",
  file: "fulfillment_transfers.ts"
})
CREATE (BookingsDomain)-[:CONTAINS]->(fulfillmentTransferEventsNode)
CREATE (fulfillmentTransferRequestsNode:Entity {
  name: "fulfillmentTransferRequests",
  tableName: "fulfillment_transfer_requests",
  domain: "Bookings",
  description: "fulfillment_transfer_requests",
  file: "fulfillment_transfers.ts"
})
CREATE (BookingsDomain)-[:CONTAINS]->(fulfillmentTransferRequestsNode)
CREATE (fulfillmentUnitsNode:Entity {
  name: "fulfillmentUnits",
  tableName: "fulfillment_units",
  domain: "Bookings",
  description: "fulfillment_units",
  file: "fulfillment.ts"
})
CREATE (BookingsDomain)-[:CONTAINS]->(fulfillmentUnitsNode)
CREATE (giftDeliveryAttemptsNode:Entity {
  name: "giftDeliveryAttempts",
  tableName: "gift_delivery_attempts",
  domain: "Bookings",
  description: "gift_delivery_attempts",
  file: "gift_delivery.ts"
})
CREATE (BookingsDomain)-[:CONTAINS]->(giftDeliveryAttemptsNode)
CREATE (giftDeliverySchedulesNode:Entity {
  name: "giftDeliverySchedules",
  tableName: "gift_delivery_schedules",
  domain: "Bookings",
  description: "gift_delivery_schedules",
  file: "gift_delivery.ts"
})
CREATE (BookingsDomain)-[:CONTAINS]->(giftDeliverySchedulesNode)
CREATE (securedBalanceLedgerEntriesNode:Entity {
  name: "securedBalanceLedgerEntries",
  tableName: "secured_balance_ledger_entries",
  domain: "Bookings",
  description: "secured_balance_ledger_entries",
  file: "commitments.ts"
})
CREATE (BookingsDomain)-[:CONTAINS]->(securedBalanceLedgerEntriesNode)
CREATE (standingReservationContractsNode:Entity {
  name: "standingReservationContracts",
  tableName: "standing_reservation_contracts",
  domain: "Bookings",
  description: "standing_reservation_contracts",
  file: "fulfillment.ts"
})
CREATE (BookingsDomain)-[:CONTAINS]->(standingReservationContractsNode)
CREATE (standingReservationExceptionsNode:Entity {
  name: "standingReservationExceptions",
  tableName: "standing_reservation_exceptions",
  domain: "Bookings",
  description: "standing_reservation_exceptions",
  file: "fulfillment.ts"
})
CREATE (BookingsDomain)-[:CONTAINS]->(standingReservationExceptionsNode)
CREATE (standingReservationOccurrencesNode:Entity {
  name: "standingReservationOccurrences",
  tableName: "standing_reservation_occurrences",
  domain: "Bookings",
  description: "standing_reservation_occurrences",
  file: "fulfillment.ts"
})
CREATE (BookingsDomain)-[:CONTAINS]->(standingReservationOccurrencesNode)

// Catalog (55 tables)
CREATE (bookingOrderLineSellablesNode:Entity {
  name: "bookingOrderLineSellables",
  tableName: "booking_order_line_sellables",
  domain: "Catalog",
  description: "booking_order_line_sellables",
  file: "product_commerce.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(bookingOrderLineSellablesNode)
CREATE (checkoutRecoveryLinksNode:Entity {
  name: "checkoutRecoveryLinks",
  tableName: "checkout_recovery_links",
  domain: "Catalog",
  description: "checkout_recovery_links",
  file: "checkout.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(checkoutRecoveryLinksNode)
CREATE (demandPricingApplicationsNode:Entity {
  name: "demandPricingApplications",
  tableName: "demand_pricing_applications",
  domain: "Catalog",
  description: "demand_pricing_applications",
  file: "demand_pricing.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(demandPricingApplicationsNode)
CREATE (demandPricingEvaluationsNode:Entity {
  name: "demandPricingEvaluations",
  tableName: "demand_pricing_evaluations",
  domain: "Catalog",
  description: "demand_pricing_evaluations",
  file: "demand_pricing.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(demandPricingEvaluationsNode)
CREATE (demandPricingPoliciesNode:Entity {
  name: "demandPricingPolicies",
  tableName: "demand_pricing_policies",
  domain: "Catalog",
  description: "demand_pricing_policies",
  file: "demand_pricing.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(demandPricingPoliciesNode)
CREATE (demandPricingPolicySignalsNode:Entity {
  name: "demandPricingPolicySignals",
  tableName: "demand_pricing_policy_signals",
  domain: "Catalog",
  description: "demand_pricing_policy_signals",
  file: "demand_pricing.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(demandPricingPolicySignalsNode)
CREATE (demandPricingPolicyTiersNode:Entity {
  name: "demandPricingPolicyTiers",
  tableName: "demand_pricing_policy_tiers",
  domain: "Catalog",
  description: "demand_pricing_policy_tiers",
  file: "demand_pricing.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(demandPricingPolicyTiersNode)
CREATE (demandSignalDefinitionsNode:Entity {
  name: "demandSignalDefinitions",
  tableName: "demand_signal_definitions",
  domain: "Catalog",
  description: "demand_signal_definitions",
  file: "demand_pricing.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(demandSignalDefinitionsNode)
CREATE (demandSignalObservationsNode:Entity {
  name: "demandSignalObservations",
  tableName: "demand_signal_observations",
  domain: "Catalog",
  description: "demand_signal_observations",
  file: "demand_pricing.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(demandSignalObservationsNode)
CREATE (extensionServiceConnectionsNode:Entity {
  name: "extensionServiceConnections",
  tableName: "extension_service_connections",
  domain: "Catalog",
  description: "extension_service_connections",
  file: "extensions.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(extensionServiceConnectionsNode)
CREATE (extensionServiceObjectLinksNode:Entity {
  name: "extensionServiceObjectLinks",
  tableName: "extension_service_object_links",
  domain: "Catalog",
  description: "extension_service_object_links",
  file: "extensions.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(extensionServiceObjectLinksNode)
CREATE (extensionServiceSyncItemsNode:Entity {
  name: "extensionServiceSyncItems",
  tableName: "extension_service_sync_items",
  domain: "Catalog",
  description: "extension_service_sync_items",
  file: "extensions.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(extensionServiceSyncItemsNode)
CREATE (extensionServiceSyncJobsNode:Entity {
  name: "extensionServiceSyncJobs",
  tableName: "extension_service_sync_jobs",
  domain: "Catalog",
  description: "extension_service_sync_jobs",
  file: "extensions.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(extensionServiceSyncJobsNode)
CREATE (factSellableDailyNode:Entity {
  name: "factSellableDaily",
  tableName: "fact_sellable_daily",
  domain: "Catalog",
  description: "fact_sellable_daily",
  file: "reporting.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(factSellableDailyNode)
CREATE (inventoryItemsNode:Entity {
  name: "inventoryItems",
  tableName: "inventory_items",
  domain: "Catalog",
  description: "inventory_items",
  file: "product_commerce.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(inventoryItemsNode)
CREATE (inventoryLocationsNode:Entity {
  name: "inventoryLocations",
  tableName: "inventory_locations",
  domain: "Catalog",
  description: "inventory_locations",
  file: "product_commerce.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(inventoryLocationsNode)
CREATE (inventoryMovementsNode:Entity {
  name: "inventoryMovements",
  tableName: "inventory_movements",
  domain: "Catalog",
  description: "inventory_movements",
  file: "product_commerce.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(inventoryMovementsNode)
CREATE (inventoryReservationsNode:Entity {
  name: "inventoryReservations",
  tableName: "inventory_reservations",
  domain: "Catalog",
  description: "inventory_reservations",
  file: "product_commerce.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(inventoryReservationsNode)
CREATE (offerComponentSeatTypesNode:Entity {
  name: "offerComponentSeatTypes",
  tableName: "offer_component_seat_types",
  domain: "Catalog",
  description: "offer_component_seat_types",
  file: "offers.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(offerComponentSeatTypesNode)
CREATE (offerComponentSelectorsNode:Entity {
  name: "offerComponentSelectors",
  tableName: "offer_component_selectors",
  domain: "Catalog",
  description: "offer_component_selectors",
  file: "offers.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(offerComponentSelectorsNode)
CREATE (offerComponentsNode:Entity {
  name: "offerComponents",
  tableName: "offer_components",
  domain: "Catalog",
  description: "offer_components",
  file: "offers.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(offerComponentsNode)
CREATE (offerVersionAdmissionModesNode:Entity {
  name: "offerVersionAdmissionModes",
  tableName: "offer_version_admission_modes",
  domain: "Catalog",
  description: "offer_version_admission_modes",
  file: "offers.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(offerVersionAdmissionModesNode)
CREATE (offerVersionsNode:Entity {
  name: "offerVersions",
  tableName: "offer_versions",
  domain: "Catalog",
  description: "offer_versions",
  file: "offers.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(offerVersionsNode)
CREATE (offersNode:Entity {
  name: "offers",
  tableName: "offers",
  domain: "Catalog",
  description: "offers",
  file: "offers.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(offersNode)
CREATE (physicalFulfillmentItemsNode:Entity {
  name: "physicalFulfillmentItems",
  tableName: "physical_fulfillment_items",
  domain: "Catalog",
  description: "physical_fulfillment_items",
  file: "product_commerce.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(physicalFulfillmentItemsNode)
CREATE (physicalFulfillmentsNode:Entity {
  name: "physicalFulfillments",
  tableName: "physical_fulfillments",
  domain: "Catalog",
  description: "physical_fulfillments",
  file: "product_commerce.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(physicalFulfillmentsNode)
CREATE (productBundleComponentsNode:Entity {
  name: "productBundleComponents",
  tableName: "product_bundle_components",
  domain: "Catalog",
  description: "product_bundle_components",
  file: "product_commerce.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(productBundleComponentsNode)
CREATE (productBundlesNode:Entity {
  name: "productBundles",
  tableName: "product_bundles",
  domain: "Catalog",
  description: "product_bundles",
  file: "product_commerce.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(productBundlesNode)
CREATE (productionBatchReservationsNode:Entity {
  name: "productionBatchReservations",
  tableName: "production_batch_reservations",
  domain: "Catalog",
  description: "production_batch_reservations",
  file: "supply_batches.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(productionBatchReservationsNode)
CREATE (productionBatchesNode:Entity {
  name: "productionBatches",
  tableName: "production_batches",
  domain: "Catalog",
  description: "production_batches",
  file: "supply_batches.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(productionBatchesNode)
CREATE (productsNode:Entity {
  name: "products",
  tableName: "products",
  domain: "Catalog",
  description: "products",
  file: "products.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(productsNode)
CREATE (resourceServiceCapabilitiesNode:Entity {
  name: "resourceServiceCapabilities",
  tableName: "resource_service_capabilities",
  domain: "Catalog",
  description: "resource_service_capabilities",
  file: "resources.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(resourceServiceCapabilitiesNode)
CREATE (sellableOfferVersionsNode:Entity {
  name: "sellableOfferVersions",
  tableName: "sellable_offer_versions",
  domain: "Catalog",
  description: "sellable_offer_versions",
  file: "product_commerce.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(sellableOfferVersionsNode)
CREATE (sellablePricingModesNode:Entity {
  name: "sellablePricingModes",
  tableName: "sellable_pricing_modes",
  domain: "Catalog",
  description: "sellable_pricing_modes",
  file: "sellable_pricing.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(sellablePricingModesNode)
CREATE (sellablePricingOverridesNode:Entity {
  name: "sellablePricingOverrides",
  tableName: "sellable_pricing_overrides",
  domain: "Catalog",
  description: "sellable_pricing_overrides",
  file: "sellable_pricing.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(sellablePricingOverridesNode)
CREATE (sellablePricingThresholdsNode:Entity {
  name: "sellablePricingThresholds",
  tableName: "sellable_pricing_thresholds",
  domain: "Catalog",
  description: "sellable_pricing_thresholds",
  file: "sellable_pricing.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(sellablePricingThresholdsNode)
CREATE (sellableProductsNode:Entity {
  name: "sellableProducts",
  tableName: "sellable_products",
  domain: "Catalog",
  description: "sellable_products",
  file: "product_commerce.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(sellableProductsNode)
CREATE (sellableResourceRatesNode:Entity {
  name: "sellableResourceRates",
  tableName: "sellable_resource_rates",
  domain: "Catalog",
  description: "sellable_resource_rates",
  file: "product_commerce.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(sellableResourceRatesNode)
CREATE (sellableServiceProductsNode:Entity {
  name: "sellableServiceProducts",
  tableName: "sellable_service_products",
  domain: "Catalog",
  description: "sellable_service_products",
  file: "product_commerce.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(sellableServiceProductsNode)
CREATE (sellableVariantDimensionValuesNode:Entity {
  name: "sellableVariantDimensionValues",
  tableName: "sellable_variant_dimension_values",
  domain: "Catalog",
  description: "sellable_variant_dimension_values",
  file: "sellable_variants.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(sellableVariantDimensionValuesNode)
CREATE (sellableVariantDimensionsNode:Entity {
  name: "sellableVariantDimensions",
  tableName: "sellable_variant_dimensions",
  domain: "Catalog",
  description: "sellable_variant_dimensions",
  file: "sellable_variants.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(sellableVariantDimensionsNode)
CREATE (sellableVariantSelectionsNode:Entity {
  name: "sellableVariantSelections",
  tableName: "sellable_variant_selections",
  domain: "Catalog",
  description: "sellable_variant_selections",
  file: "sellable_variants.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(sellableVariantSelectionsNode)
CREATE (sellableVariantsNode:Entity {
  name: "sellableVariants",
  tableName: "sellable_variants",
  domain: "Catalog",
  description: "sellable_variants",
  file: "sellable_variants.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(sellableVariantsNode)
CREATE (sellablesNode:Entity {
  name: "sellables",
  tableName: "sellables",
  domain: "Catalog",
  description: "sellables",
  file: "product_commerce.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(sellablesNode)
CREATE (serviceGroupsNode:Entity {
  name: "serviceGroups",
  tableName: "service_groups",
  domain: "Catalog",
  description: "service_groups",
  file: "services.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(serviceGroupsNode)
CREATE (serviceProductRequirementGroupsNode:Entity {
  name: "serviceProductRequirementGroups",
  tableName: "service_product_requirement_groups",
  domain: "Catalog",
  description: "service_product_requirement_groups",
  file: "service_products.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(serviceProductRequirementGroupsNode)
CREATE (serviceProductRequirementSelectorsNode:Entity {
  name: "serviceProductRequirementSelectors",
  tableName: "service_product_requirement_selectors",
  domain: "Catalog",
  description: "service_product_requirement_selectors",
  file: "service_products.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(serviceProductRequirementSelectorsNode)
CREATE (serviceProductSeatTypeRequirementsNode:Entity {
  name: "serviceProductSeatTypeRequirements",
  tableName: "service_product_seat_type_requirements",
  domain: "Catalog",
  description: "service_product_seat_type_requirements",
  file: "service_products.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(serviceProductSeatTypeRequirementsNode)
CREATE (serviceProductSeatTypesNode:Entity {
  name: "serviceProductSeatTypes",
  tableName: "service_product_seat_types",
  domain: "Catalog",
  description: "service_product_seat_types",
  file: "service_products.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(serviceProductSeatTypesNode)
CREATE (serviceProductServicesNode:Entity {
  name: "serviceProductServices",
  tableName: "service_product_services",
  domain: "Catalog",
  description: "service_product_services",
  file: "service_products.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(serviceProductServicesNode)
CREATE (serviceProductsNode:Entity {
  name: "serviceProducts",
  tableName: "service_products",
  domain: "Catalog",
  description: "service_products",
  file: "service_products.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(serviceProductsNode)
CREATE (serviceTimeObservationsNode:Entity {
  name: "serviceTimeObservations",
  tableName: "service_time_observations",
  domain: "Catalog",
  description: "service_time_observations",
  file: "queue.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(serviceTimeObservationsNode)
CREATE (servicesNode:Entity {
  name: "services",
  tableName: "services",
  domain: "Catalog",
  description: "services",
  file: "services.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(servicesNode)
CREATE (wishlistItemsNode:Entity {
  name: "wishlistItems",
  tableName: "wishlist_items",
  domain: "Catalog",
  description: "wishlist_items",
  file: "commerce_preferences.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(wishlistItemsNode)
CREATE (wishlistsNode:Entity {
  name: "wishlists",
  tableName: "wishlists",
  domain: "Catalog",
  description: "wishlists",
  file: "commerce_preferences.ts"
})
CREATE (CatalogDomain)-[:CONTAINS]->(wishlistsNode)

// Core (97 tables)
CREATE (autocollectionAttemptsNode:Entity {
  name: "autocollectionAttempts",
  tableName: "autocollection_attempts",
  domain: "Core",
  description: "autocollection_attempts",
  file: "receivables.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(autocollectionAttemptsNode)
CREATE (bizConfigBindingsNode:Entity {
  name: "bizConfigBindings",
  tableName: "biz_config_bindings",
  domain: "Core",
  description: "biz_config_bindings",
  file: "biz_configs.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(bizConfigBindingsNode)
CREATE (bizConfigSetsNode:Entity {
  name: "bizConfigSets",
  tableName: "biz_config_sets",
  domain: "Core",
  description: "biz_config_sets",
  file: "biz_configs.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(bizConfigSetsNode)
CREATE (bizConfigValueLocalizationsNode:Entity {
  name: "bizConfigValueLocalizations",
  tableName: "biz_config_value_localizations",
  domain: "Core",
  description: "biz_config_value_localizations",
  file: "biz_configs.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(bizConfigValueLocalizationsNode)
CREATE (bizConfigValuesNode:Entity {
  name: "bizConfigValues",
  tableName: "biz_config_values",
  domain: "Core",
  description: "biz_config_values",
  file: "biz_configs.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(bizConfigValuesNode)
CREATE (bizExtensionInstallsNode:Entity {
  name: "bizExtensionInstalls",
  tableName: "biz_extension_installs",
  domain: "Core",
  description: "biz_extension_installs",
  file: "extensions.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(bizExtensionInstallsNode)
CREATE (compensationAssignmentRolesNode:Entity {
  name: "compensationAssignmentRoles",
  tableName: "compensation_assignment_roles",
  domain: "Core",
  description: "compensation_assignment_roles",
  file: "compensation.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(compensationAssignmentRolesNode)
CREATE (compensationPayRunItemEntriesNode:Entity {
  name: "compensationPayRunItemEntries",
  tableName: "compensation_pay_run_item_entries",
  domain: "Core",
  description: "compensation_pay_run_item_entries",
  file: "compensation.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(compensationPayRunItemEntriesNode)
CREATE (compensationPayRunItemsNode:Entity {
  name: "compensationPayRunItems",
  tableName: "compensation_pay_run_items",
  domain: "Core",
  description: "compensation_pay_run_items",
  file: "compensation.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(compensationPayRunItemsNode)
CREATE (compensationPayRunsNode:Entity {
  name: "compensationPayRuns",
  tableName: "compensation_pay_runs",
  domain: "Core",
  description: "compensation_pay_runs",
  file: "compensation.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(compensationPayRunsNode)
CREATE (compensationPlanRulesNode:Entity {
  name: "compensationPlanRules",
  tableName: "compensation_plan_rules",
  domain: "Core",
  description: "compensation_plan_rules",
  file: "compensation.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(compensationPlanRulesNode)
CREATE (compensationPlanVersionsNode:Entity {
  name: "compensationPlanVersions",
  tableName: "compensation_plan_versions",
  domain: "Core",
  description: "compensation_plan_versions",
  file: "compensation.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(compensationPlanVersionsNode)
CREATE (compensationPlansNode:Entity {
  name: "compensationPlans",
  tableName: "compensation_plans",
  domain: "Core",
  description: "compensation_plans",
  file: "compensation.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(compensationPlansNode)
CREATE (compensationRoleTemplatesNode:Entity {
  name: "compensationRoleTemplates",
  tableName: "compensation_role_templates",
  domain: "Core",
  description: "compensation_role_templates",
  file: "compensation.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(compensationRoleTemplatesNode)
CREATE (customFieldDefinitionOptionsNode:Entity {
  name: "customFieldDefinitionOptions",
  tableName: "custom_field_definition_options",
  domain: "Core",
  description: "custom_field_definition_options",
  file: "extensions.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(customFieldDefinitionOptionsNode)
CREATE (customFieldDefinitionsNode:Entity {
  name: "customFieldDefinitions",
  tableName: "custom_field_definitions",
  domain: "Core",
  description: "custom_field_definitions",
  file: "extensions.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(customFieldDefinitionsNode)
CREATE (customFieldValuesNode:Entity {
  name: "customFieldValues",
  tableName: "custom_field_values",
  domain: "Core",
  description: "custom_field_values",
  file: "extensions.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(customFieldValuesNode)
CREATE (extensionApiCallRunsNode:Entity {
  name: "extensionApiCallRuns",
  tableName: "extension_api_call_runs",
  domain: "Core",
  description: "extension_api_call_runs",
  file: "extensions.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(extensionApiCallRunsNode)
CREATE (extensionDefinitionsNode:Entity {
  name: "extensionDefinitions",
  tableName: "extension_definitions",
  domain: "Core",
  description: "extension_definitions",
  file: "extensions.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(extensionDefinitionsNode)
CREATE (extensionInstancesNode:Entity {
  name: "extensionInstances",
  tableName: "extension_instances",
  domain: "Core",
  description: "extension_instances",
  file: "extensions.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(extensionInstancesNode)
CREATE (extensionStateDocumentsNode:Entity {
  name: "extensionStateDocuments",
  tableName: "extension_state_documents",
  domain: "Core",
  description: "extension_state_documents",
  file: "extensions.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(extensionStateDocumentsNode)
CREATE (extensionWebhookIngressEventsNode:Entity {
  name: "extensionWebhookIngressEvents",
  tableName: "extension_webhook_ingress_events",
  domain: "Core",
  description: "extension_webhook_ingress_events",
  file: "extensions.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(extensionWebhookIngressEventsNode)
CREATE (fxRateSnapshotsNode:Entity {
  name: "fxRateSnapshots",
  tableName: "fx_rate_snapshots",
  domain: "Core",
  description: "fx_rate_snapshots",
  file: "tax_fx.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(fxRateSnapshotsNode)
CREATE (idempotencyKeysNode:Entity {
  name: "idempotencyKeys",
  tableName: "idempotency_keys",
  domain: "Core",
  description: "idempotency_keys",
  file: "extensions.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(idempotencyKeysNode)
CREATE (installmentPlansNode:Entity {
  name: "installmentPlans",
  tableName: "installment_plans",
  domain: "Core",
  description: "installment_plans",
  file: "receivables.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(installmentPlansNode)
CREATE (installmentScheduleItemsNode:Entity {
  name: "installmentScheduleItems",
  tableName: "installment_schedule_items",
  domain: "Core",
  description: "installment_schedule_items",
  file: "receivables.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(installmentScheduleItemsNode)
CREATE (interactionAssignmentsNode:Entity {
  name: "interactionAssignments",
  tableName: "interaction_assignments",
  domain: "Core",
  description: "interaction_assignments",
  file: "interaction_forms.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(interactionAssignmentsNode)
CREATE (interactionSubmissionSignaturesNode:Entity {
  name: "interactionSubmissionSignatures",
  tableName: "interaction_submission_signatures",
  domain: "Core",
  description: "interaction_submission_signatures",
  file: "interaction_forms.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(interactionSubmissionSignaturesNode)
CREATE (interactionSubmissionsNode:Entity {
  name: "interactionSubmissions",
  tableName: "interaction_submissions",
  domain: "Core",
  description: "interaction_submissions",
  file: "interaction_forms.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(interactionSubmissionsNode)
CREATE (interactionTemplateBindingsNode:Entity {
  name: "interactionTemplateBindings",
  tableName: "interaction_template_bindings",
  domain: "Core",
  description: "interaction_template_bindings",
  file: "interaction_forms.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(interactionTemplateBindingsNode)
CREATE (interactionTemplatesNode:Entity {
  name: "interactionTemplates",
  tableName: "interaction_templates",
  domain: "Core",
  description: "interaction_templates",
  file: "interaction_forms.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(interactionTemplatesNode)
CREATE (leaveEventsNode:Entity {
  name: "leaveEvents",
  tableName: "leave_events",
  domain: "Core",
  description: "leave_events",
  file: "leave.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(leaveEventsNode)
CREATE (leavePoliciesNode:Entity {
  name: "leavePolicies",
  tableName: "leave_policies",
  domain: "Core",
  description: "leave_policies",
  file: "leave.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(leavePoliciesNode)
CREATE (leaveRequestsNode:Entity {
  name: "leaveRequests",
  tableName: "leave_requests",
  domain: "Core",
  description: "leave_requests",
  file: "leave.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(leaveRequestsNode)
CREATE (lifecycleEventDeliveriesNode:Entity {
  name: "lifecycleEventDeliveries",
  tableName: "lifecycle_event_deliveries",
  domain: "Core",
  description: "lifecycle_event_deliveries",
  file: "extensions.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(lifecycleEventDeliveriesNode)
CREATE (lifecycleEventsNode:Entity {
  name: "lifecycleEvents",
  tableName: "lifecycle_events",
  domain: "Core",
  description: "lifecycle_events",
  file: "extensions.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(lifecycleEventsNode)
CREATE (noteAccessOverridesNode:Entity {
  name: "noteAccessOverrides",
  tableName: "note_access_overrides",
  domain: "Core",
  description: "note_access_overrides",
  file: "notes.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(noteAccessOverridesNode)
CREATE (noteRevisionsNode:Entity {
  name: "noteRevisions",
  tableName: "note_revisions",
  domain: "Core",
  description: "note_revisions",
  file: "notes.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(noteRevisionsNode)
CREATE (notesNode:Entity {
  name: "notes",
  tableName: "notes",
  domain: "Core",
  description: "notes",
  file: "notes.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(notesNode)
CREATE (offlineMergeConflictsNode:Entity {
  name: "offlineMergeConflicts",
  tableName: "offline_merge_conflicts",
  domain: "Core",
  description: "offline_merge_conflicts",
  file: "offline.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(offlineMergeConflictsNode)
CREATE (offlineOpsJournalNode:Entity {
  name: "offlineOpsJournal",
  tableName: "offline_ops_journal",
  domain: "Core",
  description: "offline_ops_journal",
  file: "offline.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(offlineOpsJournalNode)
CREATE (offlineResolutionEventsNode:Entity {
  name: "offlineResolutionEvents",
  tableName: "offline_resolution_events",
  domain: "Core",
  description: "offline_resolution_events",
  file: "offline.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(offlineResolutionEventsNode)
CREATE (participantObligationEventsNode:Entity {
  name: "participantObligationEvents",
  tableName: "participant_obligation_events",
  domain: "Core",
  description: "participant_obligation_events",
  file: "participant_obligations.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(participantObligationEventsNode)
CREATE (purchaseOrdersNode:Entity {
  name: "purchaseOrders",
  tableName: "purchase_orders",
  domain: "Core",
  description: "purchase_orders",
  file: "ar.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(purchaseOrdersNode)
CREATE (requirementEdgesNode:Entity {
  name: "requirementEdges",
  tableName: "requirement_edges",
  domain: "Core",
  description: "requirement_edges",
  file: "progression.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(requirementEdgesNode)
CREATE (requirementEvaluationsNode:Entity {
  name: "requirementEvaluations",
  tableName: "requirement_evaluations",
  domain: "Core",
  description: "requirement_evaluations",
  file: "progression.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(requirementEvaluationsNode)
CREATE (requirementEvidenceLinksNode:Entity {
  name: "requirementEvidenceLinks",
  tableName: "requirement_evidence_links",
  domain: "Core",
  description: "requirement_evidence_links",
  file: "progression.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(requirementEvidenceLinksNode)
CREATE (requirementListAssignmentItemsNode:Entity {
  name: "requirementListAssignmentItems",
  tableName: "requirement_list_assignment_items",
  domain: "Core",
  description: "requirement_list_assignment_items",
  file: "interaction_forms.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(requirementListAssignmentItemsNode)
CREATE (requirementListAssignmentsNode:Entity {
  name: "requirementListAssignments",
  tableName: "requirement_list_assignments",
  domain: "Core",
  description: "requirement_list_assignments",
  file: "interaction_forms.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(requirementListAssignmentsNode)
CREATE (requirementListTemplateItemsNode:Entity {
  name: "requirementListTemplateItems",
  tableName: "requirement_list_template_items",
  domain: "Core",
  description: "requirement_list_template_items",
  file: "interaction_forms.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(requirementListTemplateItemsNode)
CREATE (requirementListTemplatesNode:Entity {
  name: "requirementListTemplates",
  tableName: "requirement_list_templates",
  domain: "Core",
  description: "requirement_list_templates",
  file: "interaction_forms.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(requirementListTemplatesNode)
CREATE (requirementNodesNode:Entity {
  name: "requirementNodes",
  tableName: "requirement_nodes",
  domain: "Core",
  description: "requirement_nodes",
  file: "progression.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(requirementNodesNode)
CREATE (requirementSetsNode:Entity {
  name: "requirementSets",
  tableName: "requirement_sets",
  domain: "Core",
  description: "requirement_sets",
  file: "progression.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(requirementSetsNode)
CREATE (sagaCoverageItemsNode:Entity {
  name: "sagaCoverageItems",
  tableName: "saga_coverage_items",
  domain: "Core",
  description: "saga_coverage_items",
  file: "sagas.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(sagaCoverageItemsNode)
CREATE (sagaCoverageReportsNode:Entity {
  name: "sagaCoverageReports",
  tableName: "saga_coverage_reports",
  domain: "Core",
  description: "saga_coverage_reports",
  file: "sagas.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(sagaCoverageReportsNode)
CREATE (sagaDefinitionLinksNode:Entity {
  name: "sagaDefinitionLinks",
  tableName: "saga_definition_links",
  domain: "Core",
  description: "saga_definition_links",
  file: "sagas.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(sagaDefinitionLinksNode)
CREATE (sagaDefinitionRevisionsNode:Entity {
  name: "sagaDefinitionRevisions",
  tableName: "saga_definition_revisions",
  domain: "Core",
  description: "saga_definition_revisions",
  file: "sagas.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(sagaDefinitionRevisionsNode)
CREATE (sagaDefinitionsNode:Entity {
  name: "sagaDefinitions",
  tableName: "saga_definitions",
  domain: "Core",
  description: "saga_definitions",
  file: "sagas.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(sagaDefinitionsNode)
CREATE (sagaPersonaVersionsNode:Entity {
  name: "sagaPersonaVersions",
  tableName: "saga_persona_versions",
  domain: "Core",
  description: "saga_persona_versions",
  file: "sagas.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(sagaPersonaVersionsNode)
CREATE (sagaPersonasNode:Entity {
  name: "sagaPersonas",
  tableName: "saga_personas",
  domain: "Core",
  description: "saga_personas",
  file: "sagas.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(sagaPersonasNode)
CREATE (sagaRunActorMessagesNode:Entity {
  name: "sagaRunActorMessages",
  tableName: "saga_run_actor_messages",
  domain: "Core",
  description: "saga_run_actor_messages",
  file: "sagas.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(sagaRunActorMessagesNode)
CREATE (sagaRunActorProfilesNode:Entity {
  name: "sagaRunActorProfiles",
  tableName: "saga_run_actor_profiles",
  domain: "Core",
  description: "saga_run_actor_profiles",
  file: "sagas.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(sagaRunActorProfilesNode)
CREATE (sagaRunStepsNode:Entity {
  name: "sagaRunSteps",
  tableName: "saga_run_steps",
  domain: "Core",
  description: "saga_run_steps",
  file: "sagas.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(sagaRunStepsNode)
CREATE (sagaRunsNode:Entity {
  name: "sagaRuns",
  tableName: "saga_runs",
  domain: "Core",
  description: "saga_runs",
  file: "sagas.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(sagaRunsNode)
CREATE (sagaTagBindingsNode:Entity {
  name: "sagaTagBindings",
  tableName: "saga_tag_bindings",
  domain: "Core",
  description: "saga_tag_bindings",
  file: "sagas.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(sagaTagBindingsNode)
CREATE (sagaTagsNode:Entity {
  name: "sagaTags",
  tableName: "saga_tags",
  domain: "Core",
  description: "saga_tags",
  file: "sagas.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(sagaTagsNode)
CREATE (sagaUseCaseVersionsNode:Entity {
  name: "sagaUseCaseVersions",
  tableName: "saga_use_case_versions",
  domain: "Core",
  description: "saga_use_case_versions",
  file: "sagas.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(sagaUseCaseVersionsNode)
CREATE (sagaUseCasesNode:Entity {
  name: "sagaUseCases",
  tableName: "saga_use_cases",
  domain: "Core",
  description: "saga_use_cases",
  file: "sagas.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(sagaUseCasesNode)
CREATE (salesQuoteAcceptancesNode:Entity {
  name: "salesQuoteAcceptances",
  tableName: "sales_quote_acceptances",
  domain: "Core",
  description: "sales_quote_acceptances",
  file: "sales_quotes.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(salesQuoteAcceptancesNode)
CREATE (salesQuoteLinesNode:Entity {
  name: "salesQuoteLines",
  tableName: "sales_quote_lines",
  domain: "Core",
  description: "sales_quote_lines",
  file: "sales_quotes.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(salesQuoteLinesNode)
CREATE (salesQuoteVersionsNode:Entity {
  name: "salesQuoteVersions",
  tableName: "sales_quote_versions",
  domain: "Core",
  description: "sales_quote_versions",
  file: "sales_quotes.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(salesQuoteVersionsNode)
CREATE (salesQuotesNode:Entity {
  name: "salesQuotes",
  tableName: "sales_quotes",
  domain: "Core",
  description: "sales_quotes",
  file: "sales_quotes.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(salesQuotesNode)
CREATE (seatHoldsNode:Entity {
  name: "seatHolds",
  tableName: "seat_holds",
  domain: "Core",
  description: "seat_holds",
  file: "seating.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(seatHoldsNode)
CREATE (seatMapSeatsNode:Entity {
  name: "seatMapSeats",
  tableName: "seat_map_seats",
  domain: "Core",
  description: "seat_map_seats",
  file: "seating.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(seatMapSeatsNode)
CREATE (seatMapsNode:Entity {
  name: "seatMaps",
  tableName: "seat_maps",
  domain: "Core",
  description: "seat_maps",
  file: "seating.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(seatMapsNode)
CREATE (seatReservationsNode:Entity {
  name: "seatReservations",
  tableName: "seat_reservations",
  domain: "Core",
  description: "seat_reservations",
  file: "seating.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(seatReservationsNode)
CREATE (stripeCustomersNode:Entity {
  name: "stripeCustomers",
  tableName: "stripe_customers",
  domain: "Core",
  description: "stripe_customers",
  file: "stripe.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(stripeCustomersNode)
CREATE (stripePayoutsNode:Entity {
  name: "stripePayouts",
  tableName: "stripe_payouts",
  domain: "Core",
  description: "stripe_payouts",
  file: "stripe.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(stripePayoutsNode)
CREATE (stripeSetupIntentsNode:Entity {
  name: "stripeSetupIntents",
  tableName: "stripe_setup_intents",
  domain: "Core",
  description: "stripe_setup_intents",
  file: "stripe.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(stripeSetupIntentsNode)
CREATE (stripeTransfersNode:Entity {
  name: "stripeTransfers",
  tableName: "stripe_transfers",
  domain: "Core",
  description: "stripe_transfers",
  file: "stripe.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(stripeTransfersNode)
CREATE (stripeWebhookEventsNode:Entity {
  name: "stripeWebhookEvents",
  tableName: "stripe_webhook_events",
  domain: "Core",
  description: "stripe_webhook_events",
  file: "stripe.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(stripeWebhookEventsNode)
CREATE (subjectRelationshipsNode:Entity {
  name: "subjectRelationships",
  tableName: "subject_relationships",
  domain: "Core",
  description: "subject_relationships",
  file: "subjects.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(subjectRelationshipsNode)
CREATE (subjectsNode:Entity {
  name: "subjects",
  tableName: "subjects",
  domain: "Core",
  description: "subjects",
  file: "subjects.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(subjectsNode)
CREATE (surveyQuestionsNode:Entity {
  name: "surveyQuestions",
  tableName: "survey_questions",
  domain: "Core",
  description: "survey_questions",
  file: "surveys.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(surveyQuestionsNode)
CREATE (surveyResponseAnswersNode:Entity {
  name: "surveyResponseAnswers",
  tableName: "survey_response_answers",
  domain: "Core",
  description: "survey_response_answers",
  file: "surveys.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(surveyResponseAnswersNode)
CREATE (surveyResponsesNode:Entity {
  name: "surveyResponses",
  tableName: "survey_responses",
  domain: "Core",
  description: "survey_responses",
  file: "surveys.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(surveyResponsesNode)
CREATE (surveyTemplatesNode:Entity {
  name: "surveyTemplates",
  tableName: "survey_templates",
  domain: "Core",
  description: "survey_templates",
  file: "surveys.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(surveyTemplatesNode)
CREATE (taxCalculationsNode:Entity {
  name: "taxCalculations",
  tableName: "tax_calculations",
  domain: "Core",
  description: "tax_calculations",
  file: "tax_fx.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(taxCalculationsNode)
CREATE (taxProfilesNode:Entity {
  name: "taxProfiles",
  tableName: "tax_profiles",
  domain: "Core",
  description: "tax_profiles",
  file: "tax_fx.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(taxProfilesNode)
CREATE (taxRuleRefsNode:Entity {
  name: "taxRuleRefs",
  tableName: "tax_rule_refs",
  domain: "Core",
  description: "tax_rule_refs",
  file: "tax_fx.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(taxRuleRefsNode)
CREATE (workApprovalsNode:Entity {
  name: "workApprovals",
  tableName: "work_approvals",
  domain: "Core",
  description: "work_approvals",
  file: "work_management.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(workApprovalsNode)
CREATE (workEntriesNode:Entity {
  name: "workEntries",
  tableName: "work_entries",
  domain: "Core",
  description: "work_entries",
  file: "work_management.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(workEntriesNode)
CREATE (workRunStepsNode:Entity {
  name: "workRunSteps",
  tableName: "work_run_steps",
  domain: "Core",
  description: "work_run_steps",
  file: "work_management.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(workRunStepsNode)
CREATE (workRunsNode:Entity {
  name: "workRuns",
  tableName: "work_runs",
  domain: "Core",
  description: "work_runs",
  file: "work_management.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(workRunsNode)
CREATE (workTemplateStepsNode:Entity {
  name: "workTemplateSteps",
  tableName: "work_template_steps",
  domain: "Core",
  description: "work_template_steps",
  file: "work_management.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(workTemplateStepsNode)
CREATE (workTemplatesNode:Entity {
  name: "workTemplates",
  tableName: "work_templates",
  domain: "Core",
  description: "work_templates",
  file: "work_management.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(workTemplatesNode)
CREATE (workTimeSegmentsNode:Entity {
  name: "workTimeSegments",
  tableName: "work_time_segments",
  domain: "Core",
  description: "work_time_segments",
  file: "work_management.ts"
})
CREATE (CoreDomain)-[:CONTAINS]->(workTimeSegmentsNode)

// Education (19 tables)
CREATE (apiAccessTokensNode:Entity {
  name: "apiAccessTokens",
  tableName: "api_access_tokens",
  domain: "Education",
  description: "api_access_tokens",
  file: "api_credentials.ts"
})
CREATE (EducationDomain)-[:CONTAINS]->(apiAccessTokensNode)
CREATE (apiCredentialsNode:Entity {
  name: "apiCredentials",
  tableName: "api_credentials",
  domain: "Education",
  description: "api_credentials",
  file: "api_credentials.ts"
})
CREATE (EducationDomain)-[:CONTAINS]->(apiCredentialsNode)
CREATE (assessmentAttemptsNode:Entity {
  name: "assessmentAttempts",
  tableName: "assessment_attempts",
  domain: "Education",
  description: "assessment_attempts",
  file: "assessments.ts"
})
CREATE (EducationDomain)-[:CONTAINS]->(assessmentAttemptsNode)
CREATE (assessmentItemsNode:Entity {
  name: "assessmentItems",
  tableName: "assessment_items",
  domain: "Education",
  description: "assessment_items",
  file: "assessments.ts"
})
CREATE (EducationDomain)-[:CONTAINS]->(assessmentItemsNode)
CREATE (assessmentResponsesNode:Entity {
  name: "assessmentResponses",
  tableName: "assessment_responses",
  domain: "Education",
  description: "assessment_responses",
  file: "assessments.ts"
})
CREATE (EducationDomain)-[:CONTAINS]->(assessmentResponsesNode)
CREATE (assessmentResultsNode:Entity {
  name: "assessmentResults",
  tableName: "assessment_results",
  domain: "Education",
  description: "assessment_results",
  file: "assessments.ts"
})
CREATE (EducationDomain)-[:CONTAINS]->(assessmentResultsNode)
CREATE (assessmentTemplatesNode:Entity {
  name: "assessmentTemplates",
  tableName: "assessment_templates",
  domain: "Education",
  description: "assessment_templates",
  file: "assessments.ts"
})
CREATE (EducationDomain)-[:CONTAINS]->(assessmentTemplatesNode)
CREATE (bizCredentialRequestItemsNode:Entity {
  name: "bizCredentialRequestItems",
  tableName: "biz_credential_request_items",
  domain: "Education",
  description: "biz_credential_request_items",
  file: "credential_exchange.ts"
})
CREATE (EducationDomain)-[:CONTAINS]->(bizCredentialRequestItemsNode)
CREATE (bizCredentialRequestsNode:Entity {
  name: "bizCredentialRequests",
  tableName: "biz_credential_requests",
  domain: "Education",
  description: "biz_credential_requests",
  file: "credential_exchange.ts"
})
CREATE (EducationDomain)-[:CONTAINS]->(bizCredentialRequestsNode)
CREATE (bizCredentialShareGrantSelectorsNode:Entity {
  name: "bizCredentialShareGrantSelectors",
  tableName: "biz_credential_share_grant_selectors",
  domain: "Education",
  description: "biz_credential_share_grant_selectors",
  file: "credential_exchange.ts"
})
CREATE (EducationDomain)-[:CONTAINS]->(bizCredentialShareGrantSelectorsNode)
CREATE (bizCredentialShareGrantsNode:Entity {
  name: "bizCredentialShareGrants",
  tableName: "biz_credential_share_grants",
  domain: "Education",
  description: "biz_credential_share_grants",
  file: "credential_exchange.ts"
})
CREATE (EducationDomain)-[:CONTAINS]->(bizCredentialShareGrantsNode)
CREATE (certificationAwardsNode:Entity {
  name: "certificationAwards",
  tableName: "certification_awards",
  domain: "Education",
  description: "certification_awards",
  file: "education.ts"
})
CREATE (EducationDomain)-[:CONTAINS]->(certificationAwardsNode)
CREATE (certificationTemplatesNode:Entity {
  name: "certificationTemplates",
  tableName: "certification_templates",
  domain: "Education",
  description: "certification_templates",
  file: "education.ts"
})
CREATE (EducationDomain)-[:CONTAINS]->(certificationTemplatesNode)
CREATE (cohortEnrollmentsNode:Entity {
  name: "cohortEnrollments",
  tableName: "cohort_enrollments",
  domain: "Education",
  description: "cohort_enrollments",
  file: "education.ts"
})
CREATE (EducationDomain)-[:CONTAINS]->(cohortEnrollmentsNode)
CREATE (credentialDisclosureEventsNode:Entity {
  name: "credentialDisclosureEvents",
  tableName: "credential_disclosure_events",
  domain: "Education",
  description: "credential_disclosure_events",
  file: "credential_exchange.ts"
})
CREATE (EducationDomain)-[:CONTAINS]->(credentialDisclosureEventsNode)
CREATE (credentialTypeDefinitionsNode:Entity {
  name: "credentialTypeDefinitions",
  tableName: "credential_type_definitions",
  domain: "Education",
  description: "credential_type_definitions",
  file: "credential_exchange.ts"
})
CREATE (EducationDomain)-[:CONTAINS]->(credentialTypeDefinitionsNode)
CREATE (gradingEventsNode:Entity {
  name: "gradingEvents",
  tableName: "grading_events",
  domain: "Education",
  description: "grading_events",
  file: "assessments.ts"
})
CREATE (EducationDomain)-[:CONTAINS]->(gradingEventsNode)
CREATE (programCohortsNode:Entity {
  name: "programCohorts",
  tableName: "program_cohorts",
  domain: "Education",
  description: "program_cohorts",
  file: "education.ts"
})
CREATE (EducationDomain)-[:CONTAINS]->(programCohortsNode)
CREATE (programsNode:Entity {
  name: "programs",
  tableName: "programs",
  domain: "Education",
  description: "programs",
  file: "education.ts"
})
CREATE (EducationDomain)-[:CONTAINS]->(programsNode)

// Enterprise (23 tables)
CREATE (eligibilitySnapshotsNode:Entity {
  name: "eligibilitySnapshots",
  tableName: "eligibility_snapshots",
  domain: "Enterprise",
  description: "eligibility_snapshots",
  file: "payer_eligibility.ts"
})
CREATE (EnterpriseDomain)-[:CONTAINS]->(eligibilitySnapshotsNode)
CREATE (enterpriseAdminDelegationsNode:Entity {
  name: "enterpriseAdminDelegations",
  tableName: "enterprise_admin_delegations",
  domain: "Enterprise",
  description: "enterprise_admin_delegations",
  file: "enterprise.ts"
})
CREATE (EnterpriseDomain)-[:CONTAINS]->(enterpriseAdminDelegationsNode)
CREATE (enterpriseChangeRolloutResultsNode:Entity {
  name: "enterpriseChangeRolloutResults",
  tableName: "enterprise_change_rollout_results",
  domain: "Enterprise",
  description: "enterprise_change_rollout_results",
  file: "enterprise.ts"
})
CREATE (EnterpriseDomain)-[:CONTAINS]->(enterpriseChangeRolloutResultsNode)
CREATE (enterpriseChangeRolloutRunsNode:Entity {
  name: "enterpriseChangeRolloutRuns",
  tableName: "enterprise_change_rollout_runs",
  domain: "Enterprise",
  description: "enterprise_change_rollout_runs",
  file: "enterprise.ts"
})
CREATE (EnterpriseDomain)-[:CONTAINS]->(enterpriseChangeRolloutRunsNode)
CREATE (enterpriseChangeRolloutTargetsNode:Entity {
  name: "enterpriseChangeRolloutTargets",
  tableName: "enterprise_change_rollout_targets",
  domain: "Enterprise",
  description: "enterprise_change_rollout_targets",
  file: "enterprise.ts"
})
CREATE (EnterpriseDomain)-[:CONTAINS]->(enterpriseChangeRolloutTargetsNode)
CREATE (enterpriseContractPackBindingsNode:Entity {
  name: "enterpriseContractPackBindings",
  tableName: "enterprise_contract_pack_bindings",
  domain: "Enterprise",
  description: "enterprise_contract_pack_bindings",
  file: "enterprise.ts"
})
CREATE (EnterpriseDomain)-[:CONTAINS]->(enterpriseContractPackBindingsNode)
CREATE (enterpriseContractPackTemplatesNode:Entity {
  name: "enterpriseContractPackTemplates",
  tableName: "enterprise_contract_pack_templates",
  domain: "Enterprise",
  description: "enterprise_contract_pack_templates",
  file: "enterprise.ts"
})
CREATE (EnterpriseDomain)-[:CONTAINS]->(enterpriseContractPackTemplatesNode)
CREATE (enterpriseContractPackVersionsNode:Entity {
  name: "enterpriseContractPackVersions",
  tableName: "enterprise_contract_pack_versions",
  domain: "Enterprise",
  description: "enterprise_contract_pack_versions",
  file: "enterprise.ts"
})
CREATE (EnterpriseDomain)-[:CONTAINS]->(enterpriseContractPackVersionsNode)
CREATE (enterpriseExternalDirectoryLinksNode:Entity {
  name: "enterpriseExternalDirectoryLinks",
  tableName: "enterprise_external_directory_links",
  domain: "Enterprise",
  description: "enterprise_external_directory_links",
  file: "enterprise.ts"
})
CREATE (EnterpriseDomain)-[:CONTAINS]->(enterpriseExternalDirectoryLinksNode)
CREATE (enterpriseIdentityProvidersNode:Entity {
  name: "enterpriseIdentityProviders",
  tableName: "enterprise_identity_providers",
  domain: "Enterprise",
  description: "enterprise_identity_providers",
  file: "enterprise.ts"
})
CREATE (EnterpriseDomain)-[:CONTAINS]->(enterpriseIdentityProvidersNode)
CREATE (enterpriseInheritanceResolutionsNode:Entity {
  name: "enterpriseInheritanceResolutions",
  tableName: "enterprise_inheritance_resolutions",
  domain: "Enterprise",
  description: "enterprise_inheritance_resolutions",
  file: "enterprise.ts"
})
CREATE (EnterpriseDomain)-[:CONTAINS]->(enterpriseInheritanceResolutionsNode)
CREATE (enterpriseInheritanceStrategiesNode:Entity {
  name: "enterpriseInheritanceStrategies",
  tableName: "enterprise_inheritance_strategies",
  domain: "Enterprise",
  description: "enterprise_inheritance_strategies",
  file: "enterprise.ts"
})
CREATE (EnterpriseDomain)-[:CONTAINS]->(enterpriseInheritanceStrategiesNode)
CREATE (enterpriseIntercompanyEntriesNode:Entity {
  name: "enterpriseIntercompanyEntries",
  tableName: "enterprise_intercompany_entries",
  domain: "Enterprise",
  description: "enterprise_intercompany_entries",
  file: "enterprise.ts"
})
CREATE (EnterpriseDomain)-[:CONTAINS]->(enterpriseIntercompanyEntriesNode)
CREATE (enterpriseIntercompanySettlementRunsNode:Entity {
  name: "enterpriseIntercompanySettlementRuns",
  tableName: "enterprise_intercompany_settlement_runs",
  domain: "Enterprise",
  description: "enterprise_intercompany_settlement_runs",
  file: "enterprise.ts"
})
CREATE (EnterpriseDomain)-[:CONTAINS]->(enterpriseIntercompanySettlementRunsNode)
CREATE (enterpriseRelationshipTemplatesNode:Entity {
  name: "enterpriseRelationshipTemplates",
  tableName: "enterprise_relationship_templates",
  domain: "Enterprise",
  description: "enterprise_relationship_templates",
  file: "enterprise.ts"
})
CREATE (EnterpriseDomain)-[:CONTAINS]->(enterpriseRelationshipTemplatesNode)
CREATE (enterpriseRelationshipsNode:Entity {
  name: "enterpriseRelationships",
  tableName: "enterprise_relationships",
  domain: "Enterprise",
  description: "enterprise_relationships",
  file: "enterprise.ts"
})
CREATE (EnterpriseDomain)-[:CONTAINS]->(enterpriseRelationshipsNode)
CREATE (enterpriseScimSyncStatesNode:Entity {
  name: "enterpriseScimSyncStates",
  tableName: "enterprise_scim_sync_states",
  domain: "Enterprise",
  description: "enterprise_scim_sync_states",
  file: "enterprise.ts"
})
CREATE (EnterpriseDomain)-[:CONTAINS]->(enterpriseScimSyncStatesNode)
CREATE (enterpriseScopesNode:Entity {
  name: "enterpriseScopes",
  tableName: "enterprise_scopes",
  domain: "Enterprise",
  description: "enterprise_scopes",
  file: "enterprise.ts"
})
CREATE (EnterpriseDomain)-[:CONTAINS]->(enterpriseScopesNode)
CREATE (factEnterpriseComplianceDailyNode:Entity {
  name: "factEnterpriseComplianceDaily",
  tableName: "fact_enterprise_compliance_daily",
  domain: "Enterprise",
  description: "fact_enterprise_compliance_daily",
  file: "enterprise.ts"
})
CREATE (EnterpriseDomain)-[:CONTAINS]->(factEnterpriseComplianceDailyNode)
CREATE (factEnterpriseUtilizationDailyNode:Entity {
  name: "factEnterpriseUtilizationDaily",
  tableName: "fact_enterprise_utilization_daily",
  domain: "Enterprise",
  description: "fact_enterprise_utilization_daily",
  file: "enterprise.ts"
})
CREATE (EnterpriseDomain)-[:CONTAINS]->(factEnterpriseUtilizationDailyNode)
CREATE (slaBreachEventsNode:Entity {
  name: "slaBreachEvents",
  tableName: "sla_breach_events",
  domain: "Enterprise",
  description: "sla_breach_events",
  file: "sla.ts"
})
CREATE (EnterpriseDomain)-[:CONTAINS]->(slaBreachEventsNode)
CREATE (slaCompensationEventsNode:Entity {
  name: "slaCompensationEvents",
  tableName: "sla_compensation_events",
  domain: "Enterprise",
  description: "sla_compensation_events",
  file: "sla.ts"
})
CREATE (EnterpriseDomain)-[:CONTAINS]->(slaCompensationEventsNode)
CREATE (slaPoliciesNode:Entity {
  name: "slaPolicies",
  tableName: "sla_policies",
  domain: "Enterprise",
  description: "sla_policies",
  file: "sla.ts"
})
CREATE (EnterpriseDomain)-[:CONTAINS]->(slaPoliciesNode)

// Gifts (8 tables)
CREATE (bizConfigPromotionRunItemsNode:Entity {
  name: "bizConfigPromotionRunItems",
  tableName: "biz_config_promotion_run_items",
  domain: "Gifts",
  description: "biz_config_promotion_run_items",
  file: "biz_configs.ts"
})
CREATE (GiftsDomain)-[:CONTAINS]->(bizConfigPromotionRunItemsNode)
CREATE (bizConfigPromotionRunsNode:Entity {
  name: "bizConfigPromotionRuns",
  tableName: "biz_config_promotion_runs",
  domain: "Gifts",
  description: "biz_config_promotion_runs",
  file: "biz_configs.ts"
})
CREATE (GiftsDomain)-[:CONTAINS]->(bizConfigPromotionRunsNode)
CREATE (discountCodesNode:Entity {
  name: "discountCodes",
  tableName: "discount_codes",
  domain: "Gifts",
  description: "discount_codes",
  file: "promotions.ts"
})
CREATE (GiftsDomain)-[:CONTAINS]->(discountCodesNode)
CREATE (discountRedemptionsNode:Entity {
  name: "discountRedemptions",
  tableName: "discount_redemptions",
  domain: "Gifts",
  description: "discount_redemptions",
  file: "promotions.ts"
})
CREATE (GiftsDomain)-[:CONTAINS]->(discountRedemptionsNode)
CREATE (giftExpirationEventsNode:Entity {
  name: "giftExpirationEvents",
  tableName: "gift_expiration_events",
  domain: "Gifts",
  description: "gift_expiration_events",
  file: "gifts.ts"
})
CREATE (GiftsDomain)-[:CONTAINS]->(giftExpirationEventsNode)
CREATE (giftInstrumentsNode:Entity {
  name: "giftInstruments",
  tableName: "gift_instruments",
  domain: "Gifts",
  description: "gift_instruments",
  file: "gifts.ts"
})
CREATE (GiftsDomain)-[:CONTAINS]->(giftInstrumentsNode)
CREATE (giftRedemptionsNode:Entity {
  name: "giftRedemptions",
  tableName: "gift_redemptions",
  domain: "Gifts",
  description: "gift_redemptions",
  file: "gifts.ts"
})
CREATE (GiftsDomain)-[:CONTAINS]->(giftRedemptionsNode)
CREATE (giftTransfersNode:Entity {
  name: "giftTransfers",
  tableName: "gift_transfers",
  domain: "Gifts",
  description: "gift_transfers",
  file: "gifts.ts"
})
CREATE (GiftsDomain)-[:CONTAINS]->(giftTransfersNode)

// Governance (21 tables)
CREATE (auditEventsNode:Entity {
  name: "auditEvents",
  tableName: "audit_events",
  domain: "Governance",
  description: "audit_events",
  file: "audit.ts"
})
CREATE (GovernanceDomain)-[:CONTAINS]->(auditEventsNode)
CREATE (auditIntegrityRunsNode:Entity {
  name: "auditIntegrityRuns",
  tableName: "audit_integrity_runs",
  domain: "Governance",
  description: "audit_integrity_runs",
  file: "audit.ts"
})
CREATE (GovernanceDomain)-[:CONTAINS]->(auditIntegrityRunsNode)
CREATE (auditStreamsNode:Entity {
  name: "auditStreams",
  tableName: "audit_streams",
  domain: "Governance",
  description: "audit_streams",
  file: "audit.ts"
})
CREATE (GovernanceDomain)-[:CONTAINS]->(auditStreamsNode)
CREATE (breakGlassReviewsNode:Entity {
  name: "breakGlassReviews",
  tableName: "break_glass_reviews",
  domain: "Governance",
  description: "break_glass_reviews",
  file: "hipaa.ts"
})
CREATE (GovernanceDomain)-[:CONTAINS]->(breakGlassReviewsNode)
CREATE (businessAssociateAgreementsNode:Entity {
  name: "businessAssociateAgreements",
  tableName: "business_associate_agreements",
  domain: "Governance",
  description: "business_associate_agreements",
  file: "hipaa.ts"
})
CREATE (GovernanceDomain)-[:CONTAINS]->(businessAssociateAgreementsNode)
CREATE (dataResidencyPoliciesNode:Entity {
  name: "dataResidencyPolicies",
  tableName: "data_residency_policies",
  domain: "Governance",
  description: "data_residency_policies",
  file: "governance.ts"
})
CREATE (GovernanceDomain)-[:CONTAINS]->(dataResidencyPoliciesNode)
CREATE (dataSubjectRequestsNode:Entity {
  name: "dataSubjectRequests",
  tableName: "data_subject_requests",
  domain: "Governance",
  description: "data_subject_requests",
  file: "governance.ts"
})
CREATE (GovernanceDomain)-[:CONTAINS]->(dataSubjectRequestsNode)
CREATE (legalHoldsNode:Entity {
  name: "legalHolds",
  tableName: "legal_holds",
  domain: "Governance",
  description: "legal_holds",
  file: "governance.ts"
})
CREATE (GovernanceDomain)-[:CONTAINS]->(legalHoldsNode)
CREATE (phiAccessEventsNode:Entity {
  name: "phiAccessEvents",
  tableName: "phi_access_events",
  domain: "Governance",
  description: "phi_access_events",
  file: "hipaa.ts"
})
CREATE (GovernanceDomain)-[:CONTAINS]->(phiAccessEventsNode)
CREATE (phiAccessPoliciesNode:Entity {
  name: "phiAccessPolicies",
  tableName: "phi_access_policies",
  domain: "Governance",
  description: "phi_access_policies",
  file: "hipaa.ts"
})
CREATE (GovernanceDomain)-[:CONTAINS]->(phiAccessPoliciesNode)
CREATE (phiDisclosureEventsNode:Entity {
  name: "phiDisclosureEvents",
  tableName: "phi_disclosure_events",
  domain: "Governance",
  description: "phi_disclosure_events",
  file: "hipaa.ts"
})
CREATE (GovernanceDomain)-[:CONTAINS]->(phiDisclosureEventsNode)
CREATE (policyBindingsNode:Entity {
  name: "policyBindings",
  tableName: "policy_bindings",
  domain: "Governance",
  description: "policy_bindings",
  file: "governance.ts"
})
CREATE (GovernanceDomain)-[:CONTAINS]->(policyBindingsNode)
CREATE (policyBreachEventsNode:Entity {
  name: "policyBreachEvents",
  tableName: "policy_breach_events",
  domain: "Governance",
  description: "policy_breach_events",
  file: "governance.ts"
})
CREATE (GovernanceDomain)-[:CONTAINS]->(policyBreachEventsNode)
CREATE (policyConsequenceEventsNode:Entity {
  name: "policyConsequenceEvents",
  tableName: "policy_consequence_events",
  domain: "Governance",
  description: "policy_consequence_events",
  file: "governance.ts"
})
CREATE (GovernanceDomain)-[:CONTAINS]->(policyConsequenceEventsNode)
CREATE (policyRulesNode:Entity {
  name: "policyRules",
  tableName: "policy_rules",
  domain: "Governance",
  description: "policy_rules",
  file: "governance.ts"
})
CREATE (GovernanceDomain)-[:CONTAINS]->(policyRulesNode)
CREATE (policyTemplatesNode:Entity {
  name: "policyTemplates",
  tableName: "policy_templates",
  domain: "Governance",
  description: "policy_templates",
  file: "governance.ts"
})
CREATE (GovernanceDomain)-[:CONTAINS]->(policyTemplatesNode)
CREATE (privacyIdentityModesNode:Entity {
  name: "privacyIdentityModes",
  tableName: "privacy_identity_modes",
  domain: "Governance",
  description: "privacy_identity_modes",
  file: "governance.ts"
})
CREATE (GovernanceDomain)-[:CONTAINS]->(privacyIdentityModesNode)
CREATE (redactionJobsNode:Entity {
  name: "redactionJobs",
  tableName: "redaction_jobs",
  domain: "Governance",
  description: "redaction_jobs",
  file: "governance.ts"
})
CREATE (GovernanceDomain)-[:CONTAINS]->(redactionJobsNode)
CREATE (retentionPoliciesNode:Entity {
  name: "retentionPolicies",
  tableName: "retention_policies",
  domain: "Governance",
  description: "retention_policies",
  file: "governance.ts"
})
CREATE (GovernanceDomain)-[:CONTAINS]->(retentionPoliciesNode)
CREATE (securityIncidentsNode:Entity {
  name: "securityIncidents",
  tableName: "security_incidents",
  domain: "Governance",
  description: "security_incidents",
  file: "hipaa.ts"
})
CREATE (GovernanceDomain)-[:CONTAINS]->(securityIncidentsNode)
CREATE (tenantComplianceProfilesNode:Entity {
  name: "tenantComplianceProfiles",
  tableName: "tenant_compliance_profiles",
  domain: "Governance",
  description: "tenant_compliance_profiles",
  file: "governance.ts"
})
CREATE (GovernanceDomain)-[:CONTAINS]->(tenantComplianceProfilesNode)

// Identity (40 tables)
CREATE (authzMembershipRoleMappingsNode:Entity {
  name: "authzMembershipRoleMappings",
  tableName: "authz_membership_role_mappings",
  domain: "Identity",
  description: "authz_membership_role_mappings",
  file: "authz.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(authzMembershipRoleMappingsNode)
CREATE (authzPermissionDefinitionsNode:Entity {
  name: "authzPermissionDefinitions",
  tableName: "authz_permission_definitions",
  domain: "Identity",
  description: "authz_permission_definitions",
  file: "authz.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(authzPermissionDefinitionsNode)
CREATE (authzRoleAssignmentsNode:Entity {
  name: "authzRoleAssignments",
  tableName: "authz_role_assignments",
  domain: "Identity",
  description: "authz_role_assignments",
  file: "authz.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(authzRoleAssignmentsNode)
CREATE (authzRoleDefinitionsNode:Entity {
  name: "authzRoleDefinitions",
  tableName: "authz_role_definitions",
  domain: "Identity",
  description: "authz_role_definitions",
  file: "authz.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(authzRoleDefinitionsNode)
CREATE (authzRolePermissionsNode:Entity {
  name: "authzRolePermissions",
  tableName: "authz_role_permissions",
  domain: "Identity",
  description: "authz_role_permissions",
  file: "authz.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(authzRolePermissionsNode)
CREATE (billingAccountAutopayRulesNode:Entity {
  name: "billingAccountAutopayRules",
  tableName: "billing_account_autopay_rules",
  domain: "Identity",
  description: "billing_account_autopay_rules",
  file: "receivables.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(billingAccountAutopayRulesNode)
CREATE (billingAccountsNode:Entity {
  name: "billingAccounts",
  tableName: "billing_accounts",
  domain: "Identity",
  description: "billing_accounts",
  file: "ar.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(billingAccountsNode)
CREATE (bizesNode:Entity {
  name: "bizes",
  tableName: "bizes",
  domain: "Identity",
  description: "bizes",
  file: "bizes.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(bizesNode)
CREATE (channelAccountsNode:Entity {
  name: "channelAccounts",
  tableName: "channel_accounts",
  domain: "Identity",
  description: "channel_accounts",
  file: "channels.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(channelAccountsNode)
CREATE (checkoutSessionEventsNode:Entity {
  name: "checkoutSessionEvents",
  tableName: "checkout_session_events",
  domain: "Identity",
  description: "checkout_session_events",
  file: "checkout.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(checkoutSessionEventsNode)
CREATE (checkoutSessionItemsNode:Entity {
  name: "checkoutSessionItems",
  tableName: "checkout_session_items",
  domain: "Identity",
  description: "checkout_session_items",
  file: "checkout.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(checkoutSessionItemsNode)
CREATE (checkoutSessionsNode:Entity {
  name: "checkoutSessions",
  tableName: "checkout_sessions",
  domain: "Identity",
  description: "checkout_sessions",
  file: "checkout.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(checkoutSessionsNode)
CREATE (enterpriseApprovalAuthorityLimitsNode:Entity {
  name: "enterpriseApprovalAuthorityLimits",
  tableName: "enterprise_approval_authority_limits",
  domain: "Identity",
  description: "enterprise_approval_authority_limits",
  file: "enterprise.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(enterpriseApprovalAuthorityLimitsNode)
CREATE (enterpriseIntercompanyAccountsNode:Entity {
  name: "enterpriseIntercompanyAccounts",
  tableName: "enterprise_intercompany_accounts",
  domain: "Identity",
  description: "enterprise_intercompany_accounts",
  file: "enterprise.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(enterpriseIntercompanyAccountsNode)
CREATE (groupAccountMembersNode:Entity {
  name: "groupAccountMembers",
  tableName: "group_account_members",
  domain: "Identity",
  description: "group_account_members",
  file: "group_accounts.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(groupAccountMembersNode)
CREATE (groupAccountsNode:Entity {
  name: "groupAccounts",
  tableName: "group_accounts",
  domain: "Identity",
  description: "group_accounts",
  file: "group_accounts.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(groupAccountsNode)
CREATE (hipaaAuthorizationsNode:Entity {
  name: "hipaaAuthorizations",
  tableName: "hipaa_authorizations",
  domain: "Identity",
  description: "hipaa_authorizations",
  file: "hipaa.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(hipaaAuthorizationsNode)
CREATE (hostUsersNode:Entity {
  name: "hostUsers",
  tableName: "host_users",
  domain: "Identity",
  description: "host_users",
  file: "resources.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(hostUsersNode)
CREATE (marketingAudienceSegmentMembershipsNode:Entity {
  name: "marketingAudienceSegmentMemberships",
  tableName: "marketing_audience_segment_memberships",
  domain: "Identity",
  description: "marketing_audience_segment_memberships",
  file: "marketing_performance.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(marketingAudienceSegmentMembershipsNode)
CREATE (membershipPlansNode:Entity {
  name: "membershipPlans",
  tableName: "membership_plans",
  domain: "Identity",
  description: "membership_plans",
  file: "entitlements.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(membershipPlansNode)
CREATE (membershipsNode:Entity {
  name: "memberships",
  tableName: "memberships",
  domain: "Identity",
  description: "memberships",
  file: "entitlements.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(membershipsNode)
CREATE (orgMembershipLocationsNode:Entity {
  name: "orgMembershipLocations",
  tableName: "org_membership_locations",
  domain: "Identity",
  description: "org_membership_locations",
  file: "memberships.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(orgMembershipLocationsNode)
CREATE (orgMembershipsNode:Entity {
  name: "orgMemberships",
  tableName: "org_memberships",
  domain: "Identity",
  description: "org_memberships",
  file: "memberships.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(orgMembershipsNode)
CREATE (payerAuthorizationsNode:Entity {
  name: "payerAuthorizations",
  tableName: "payer_authorizations",
  domain: "Identity",
  description: "payer_authorizations",
  file: "payer_eligibility.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(payerAuthorizationsNode)
CREATE (paymentProcessorAccountsNode:Entity {
  name: "paymentProcessorAccounts",
  tableName: "payment_processor_accounts",
  domain: "Identity",
  description: "payment_processor_accounts",
  file: "payments.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(paymentProcessorAccountsNode)
CREATE (programCohortSessionsNode:Entity {
  name: "programCohortSessions",
  tableName: "program_cohort_sessions",
  domain: "Identity",
  description: "program_cohort_sessions",
  file: "education.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(programCohortSessionsNode)
CREATE (securedBalanceAccountsNode:Entity {
  name: "securedBalanceAccounts",
  tableName: "secured_balance_accounts",
  domain: "Identity",
  description: "secured_balance_accounts",
  file: "commitments.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(securedBalanceAccountsNode)
CREATE (sessionAttendanceRecordsNode:Entity {
  name: "sessionAttendanceRecords",
  tableName: "session_attendance_records",
  domain: "Identity",
  description: "session_attendance_records",
  file: "education.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(sessionAttendanceRecordsNode)
CREATE (sessionInteractionAggregatesNode:Entity {
  name: "sessionInteractionAggregates",
  tableName: "session_interaction_aggregates",
  domain: "Identity",
  description: "session_interaction_aggregates",
  file: "session_interactions.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(sessionInteractionAggregatesNode)
CREATE (sessionInteractionArtifactsNode:Entity {
  name: "sessionInteractionArtifacts",
  tableName: "session_interaction_artifacts",
  domain: "Identity",
  description: "session_interaction_artifacts",
  file: "session_interaction_artifacts.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(sessionInteractionArtifactsNode)
CREATE (sessionInteractionEventsNode:Entity {
  name: "sessionInteractionEvents",
  tableName: "session_interaction_events",
  domain: "Identity",
  description: "session_interaction_events",
  file: "session_interactions.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(sessionInteractionEventsNode)
CREATE (stripeAccountsNode:Entity {
  name: "stripeAccounts",
  tableName: "stripe_accounts",
  domain: "Identity",
  description: "stripe_accounts",
  file: "stripe.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(stripeAccountsNode)
CREATE (stripeCheckoutSessionsNode:Entity {
  name: "stripeCheckoutSessions",
  tableName: "stripe_checkout_sessions",
  domain: "Identity",
  description: "stripe_checkout_sessions",
  file: "stripe.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(stripeCheckoutSessionsNode)
CREATE (surveyInvitationsNode:Entity {
  name: "surveyInvitations",
  tableName: "survey_invitations",
  domain: "Identity",
  description: "survey_invitations",
  file: "surveys.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(surveyInvitationsNode)
CREATE (userCredentialDocumentsNode:Entity {
  name: "userCredentialDocuments",
  tableName: "user_credential_documents",
  domain: "Identity",
  description: "user_credential_documents",
  file: "credential_exchange.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(userCredentialDocumentsNode)
CREATE (userCredentialFactsNode:Entity {
  name: "userCredentialFacts",
  tableName: "user_credential_facts",
  domain: "Identity",
  description: "user_credential_facts",
  file: "credential_exchange.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(userCredentialFactsNode)
CREATE (userCredentialProfilesNode:Entity {
  name: "userCredentialProfiles",
  tableName: "user_credential_profiles",
  domain: "Identity",
  description: "user_credential_profiles",
  file: "credential_exchange.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(userCredentialProfilesNode)
CREATE (userCredentialRecordsNode:Entity {
  name: "userCredentialRecords",
  tableName: "user_credential_records",
  domain: "Identity",
  description: "user_credential_records",
  file: "credential_exchange.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(userCredentialRecordsNode)
CREATE (userCredentialVerificationsNode:Entity {
  name: "userCredentialVerifications",
  tableName: "user_credential_verifications",
  domain: "Identity",
  description: "user_credential_verifications",
  file: "credential_exchange.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(userCredentialVerificationsNode)
CREATE (usersNode:Entity {
  name: "users",
  tableName: "users",
  domain: "Identity",
  description: "users",
  file: "users.ts"
})
CREATE (IdentityDomain)-[:CONTAINS]->(usersNode)

// Intelligence (23 tables)
CREATE (accessArtifactEventsNode:Entity {
  name: "accessArtifactEvents",
  tableName: "access_artifact_events",
  domain: "Intelligence",
  description: "access_artifact_events",
  file: "access_rights.ts"
})
CREATE (IntelligenceDomain)-[:CONTAINS]->(accessArtifactEventsNode)
CREATE (accessArtifactLinksNode:Entity {
  name: "accessArtifactLinks",
  tableName: "access_artifact_links",
  domain: "Intelligence",
  description: "access_artifact_links",
  file: "access_rights.ts"
})
CREATE (IntelligenceDomain)-[:CONTAINS]->(accessArtifactLinksNode)
CREATE (accessArtifactsNode:Entity {
  name: "accessArtifacts",
  tableName: "access_artifacts",
  domain: "Intelligence",
  description: "access_artifacts",
  file: "access_rights.ts"
})
CREATE (IntelligenceDomain)-[:CONTAINS]->(accessArtifactsNode)
CREATE (adSpendDailyFactsNode:Entity {
  name: "adSpendDailyFacts",
  tableName: "ad_spend_daily_facts",
  domain: "Intelligence",
  description: "ad_spend_daily_facts",
  file: "marketing_performance.ts"
})
CREATE (IntelligenceDomain)-[:CONTAINS]->(adSpendDailyFactsNode)
CREATE (factOperationalDailyNode:Entity {
  name: "factOperationalDaily",
  tableName: "fact_operational_daily",
  domain: "Intelligence",
  description: "fact_operational_daily",
  file: "reporting.ts"
})
CREATE (IntelligenceDomain)-[:CONTAINS]->(factOperationalDailyNode)
CREATE (factRefreshRunsNode:Entity {
  name: "factRefreshRuns",
  tableName: "fact_refresh_runs",
  domain: "Intelligence",
  description: "fact_refresh_runs",
  file: "reporting.ts"
})
CREATE (IntelligenceDomain)-[:CONTAINS]->(factRefreshRunsNode)
CREATE (interactionSubmissionArtifactsNode:Entity {
  name: "interactionSubmissionArtifacts",
  tableName: "interaction_submission_artifacts",
  domain: "Intelligence",
  description: "interaction_submission_artifacts",
  file: "interaction_forms.ts"
})
CREATE (IntelligenceDomain)-[:CONTAINS]->(interactionSubmissionArtifactsNode)
CREATE (overtimeForecastsNode:Entity {
  name: "overtimeForecasts",
  tableName: "overtime_forecasts",
  domain: "Intelligence",
  description: "overtime_forecasts",
  file: "intelligence.ts"
})
CREATE (IntelligenceDomain)-[:CONTAINS]->(overtimeForecastsNode)
CREATE (overtimePoliciesNode:Entity {
  name: "overtimePolicies",
  tableName: "overtime_policies",
  domain: "Intelligence",
  description: "overtime_policies",
  file: "intelligence.ts"
})
CREATE (IntelligenceDomain)-[:CONTAINS]->(overtimePoliciesNode)
CREATE (projectionCheckpointsNode:Entity {
  name: "projectionCheckpoints",
  tableName: "projection_checkpoints",
  domain: "Intelligence",
  description: "projection_checkpoints",
  file: "reporting.ts"
})
CREATE (IntelligenceDomain)-[:CONTAINS]->(projectionCheckpointsNode)
CREATE (rankingEventsNode:Entity {
  name: "rankingEvents",
  tableName: "ranking_events",
  domain: "Intelligence",
  description: "ranking_events",
  file: "intelligence.ts"
})
CREATE (IntelligenceDomain)-[:CONTAINS]->(rankingEventsNode)
CREATE (rankingProfilesNode:Entity {
  name: "rankingProfiles",
  tableName: "ranking_profiles",
  domain: "Intelligence",
  description: "ranking_profiles",
  file: "intelligence.ts"
})
CREATE (IntelligenceDomain)-[:CONTAINS]->(rankingProfilesNode)
CREATE (rankingScoresNode:Entity {
  name: "rankingScores",
  tableName: "ranking_scores",
  domain: "Intelligence",
  description: "ranking_scores",
  file: "intelligence.ts"
})
CREATE (IntelligenceDomain)-[:CONTAINS]->(rankingScoresNode)
CREATE (sagaRunArtifactsNode:Entity {
  name: "sagaRunArtifacts",
  tableName: "saga_run_artifacts",
  domain: "Intelligence",
  description: "saga_run_artifacts",
  file: "sagas.ts"
})
CREATE (IntelligenceDomain)-[:CONTAINS]->(sagaRunArtifactsNode)
CREATE (staffingAssignmentsNode:Entity {
  name: "staffingAssignments",
  tableName: "staffing_assignments",
  domain: "Intelligence",
  description: "staffing_assignments",
  file: "intelligence.ts"
})
CREATE (IntelligenceDomain)-[:CONTAINS]->(staffingAssignmentsNode)
CREATE (staffingDemandRequirementsNode:Entity {
  name: "staffingDemandRequirements",
  tableName: "staffing_demand_requirements",
  domain: "Intelligence",
  description: "staffing_demand_requirements",
  file: "intelligence.ts"
})
CREATE (IntelligenceDomain)-[:CONTAINS]->(staffingDemandRequirementsNode)
CREATE (staffingDemandSelectorsNode:Entity {
  name: "staffingDemandSelectors",
  tableName: "staffing_demand_selectors",
  domain: "Intelligence",
  description: "staffing_demand_selectors",
  file: "intelligence.ts"
})
CREATE (IntelligenceDomain)-[:CONTAINS]->(staffingDemandSelectorsNode)
CREATE (staffingDemandsNode:Entity {
  name: "staffingDemands",
  tableName: "staffing_demands",
  domain: "Intelligence",
  description: "staffing_demands",
  file: "intelligence.ts"
})
CREATE (IntelligenceDomain)-[:CONTAINS]->(staffingDemandsNode)
CREATE (staffingFairnessCountersNode:Entity {
  name: "staffingFairnessCounters",
  tableName: "staffing_fairness_counters",
  domain: "Intelligence",
  description: "staffing_fairness_counters",
  file: "intelligence.ts"
})
CREATE (IntelligenceDomain)-[:CONTAINS]->(staffingFairnessCountersNode)
CREATE (staffingPoolMembersNode:Entity {
  name: "staffingPoolMembers",
  tableName: "staffing_pool_members",
  domain: "Intelligence",
  description: "staffing_pool_members",
  file: "intelligence.ts"
})
CREATE (IntelligenceDomain)-[:CONTAINS]->(staffingPoolMembersNode)
CREATE (staffingPoolsNode:Entity {
  name: "staffingPools",
  tableName: "staffing_pools",
  domain: "Intelligence",
  description: "staffing_pools",
  file: "intelligence.ts"
})
CREATE (IntelligenceDomain)-[:CONTAINS]->(staffingPoolsNode)
CREATE (staffingResponsesNode:Entity {
  name: "staffingResponses",
  tableName: "staffing_responses",
  domain: "Intelligence",
  description: "staffing_responses",
  file: "intelligence.ts"
})
CREATE (IntelligenceDomain)-[:CONTAINS]->(staffingResponsesNode)
CREATE (workArtifactsNode:Entity {
  name: "workArtifacts",
  tableName: "work_artifacts",
  domain: "Intelligence",
  description: "work_artifacts",
  file: "work_management.ts"
})
CREATE (IntelligenceDomain)-[:CONTAINS]->(workArtifactsNode)

// Marketing (17 tables)
CREATE (crmContactsNode:Entity {
  name: "crmContacts",
  tableName: "crm_contacts",
  domain: "Marketing",
  description: "crm_contacts",
  file: "crm.ts"
})
CREATE (MarketingDomain)-[:CONTAINS]->(crmContactsNode)
CREATE (crmConversationMessagesNode:Entity {
  name: "crmConversationMessages",
  tableName: "crm_conversation_messages",
  domain: "Marketing",
  description: "crm_conversation_messages",
  file: "crm.ts"
})
CREATE (MarketingDomain)-[:CONTAINS]->(crmConversationMessagesNode)
CREATE (crmConversationParticipantsNode:Entity {
  name: "crmConversationParticipants",
  tableName: "crm_conversation_participants",
  domain: "Marketing",
  description: "crm_conversation_participants",
  file: "crm.ts"
})
CREATE (MarketingDomain)-[:CONTAINS]->(crmConversationParticipantsNode)
CREATE (crmConversationsNode:Entity {
  name: "crmConversations",
  tableName: "crm_conversations",
  domain: "Marketing",
  description: "crm_conversations",
  file: "crm.ts"
})
CREATE (MarketingDomain)-[:CONTAINS]->(crmConversationsNode)
CREATE (crmLeadEventsNode:Entity {
  name: "crmLeadEvents",
  tableName: "crm_lead_events",
  domain: "Marketing",
  description: "crm_lead_events",
  file: "crm.ts"
})
CREATE (MarketingDomain)-[:CONTAINS]->(crmLeadEventsNode)
CREATE (crmLeadsNode:Entity {
  name: "crmLeads",
  tableName: "crm_leads",
  domain: "Marketing",
  description: "crm_leads",
  file: "crm.ts"
})
CREATE (MarketingDomain)-[:CONTAINS]->(crmLeadsNode)
CREATE (crmMergeCandidatesNode:Entity {
  name: "crmMergeCandidates",
  tableName: "crm_merge_candidates",
  domain: "Marketing",
  description: "crm_merge_candidates",
  file: "crm.ts"
})
CREATE (MarketingDomain)-[:CONTAINS]->(crmMergeCandidatesNode)
CREATE (crmMergeDecisionsNode:Entity {
  name: "crmMergeDecisions",
  tableName: "crm_merge_decisions",
  domain: "Marketing",
  description: "crm_merge_decisions",
  file: "crm.ts"
})
CREATE (MarketingDomain)-[:CONTAINS]->(crmMergeDecisionsNode)
CREATE (crmOpportunitiesNode:Entity {
  name: "crmOpportunities",
  tableName: "crm_opportunities",
  domain: "Marketing",
  description: "crm_opportunities",
  file: "crm.ts"
})
CREATE (MarketingDomain)-[:CONTAINS]->(crmOpportunitiesNode)
CREATE (crmOpportunityStageEventsNode:Entity {
  name: "crmOpportunityStageEvents",
  tableName: "crm_opportunity_stage_events",
  domain: "Marketing",
  description: "crm_opportunity_stage_events",
  file: "crm.ts"
})
CREATE (MarketingDomain)-[:CONTAINS]->(crmOpportunityStageEventsNode)
CREATE (crmPipelineStagesNode:Entity {
  name: "crmPipelineStages",
  tableName: "crm_pipeline_stages",
  domain: "Marketing",
  description: "crm_pipeline_stages",
  file: "crm.ts"
})
CREATE (MarketingDomain)-[:CONTAINS]->(crmPipelineStagesNode)
CREATE (crmPipelinesNode:Entity {
  name: "crmPipelines",
  tableName: "crm_pipelines",
  domain: "Marketing",
  description: "crm_pipelines",
  file: "crm.ts"
})
CREATE (MarketingDomain)-[:CONTAINS]->(crmPipelinesNode)
CREATE (crmSubjectRedirectsNode:Entity {
  name: "crmSubjectRedirects",
  tableName: "crm_subject_redirects",
  domain: "Marketing",
  description: "crm_subject_redirects",
  file: "crm.ts"
})
CREATE (MarketingDomain)-[:CONTAINS]->(crmSubjectRedirectsNode)
CREATE (discountCampaignsNode:Entity {
  name: "discountCampaigns",
  tableName: "discount_campaigns",
  domain: "Marketing",
  description: "discount_campaigns",
  file: "promotions.ts"
})
CREATE (MarketingDomain)-[:CONTAINS]->(discountCampaignsNode)
CREATE (marketingAudienceSegmentsNode:Entity {
  name: "marketingAudienceSegments",
  tableName: "marketing_audience_segments",
  domain: "Marketing",
  description: "marketing_audience_segments",
  file: "marketing_performance.ts"
})
CREATE (MarketingDomain)-[:CONTAINS]->(marketingAudienceSegmentsNode)
CREATE (marketingAudienceSyncRunsNode:Entity {
  name: "marketingAudienceSyncRuns",
  tableName: "marketing_audience_sync_runs",
  domain: "Marketing",
  description: "marketing_audience_sync_runs",
  file: "marketing_performance.ts"
})
CREATE (MarketingDomain)-[:CONTAINS]->(marketingAudienceSyncRunsNode)
CREATE (offlineConversionPushesNode:Entity {
  name: "offlineConversionPushes",
  tableName: "offline_conversion_pushes",
  domain: "Marketing",
  description: "offline_conversion_pushes",
  file: "marketing_performance.ts"
})
CREATE (MarketingDomain)-[:CONTAINS]->(offlineConversionPushesNode)

// Marketplace (12 tables)
CREATE (accessResaleListingsNode:Entity {
  name: "accessResaleListings",
  tableName: "access_resale_listings",
  domain: "Marketplace",
  description: "access_resale_listings",
  file: "access_rights.ts"
})
CREATE (MarketplaceDomain)-[:CONTAINS]->(accessResaleListingsNode)
CREATE (auctionsNode:Entity {
  name: "auctions",
  tableName: "auctions",
  domain: "Marketplace",
  description: "auctions",
  file: "marketplace.ts"
})
CREATE (MarketplaceDomain)-[:CONTAINS]->(auctionsNode)
CREATE (bidsNode:Entity {
  name: "bids",
  tableName: "bids",
  domain: "Marketplace",
  description: "bids",
  file: "marketplace.ts"
})
CREATE (MarketplaceDomain)-[:CONTAINS]->(bidsNode)
CREATE (crossBizContractsNode:Entity {
  name: "crossBizContracts",
  tableName: "cross_biz_contracts",
  domain: "Marketplace",
  description: "cross_biz_contracts",
  file: "marketplace.ts"
})
CREATE (MarketplaceDomain)-[:CONTAINS]->(crossBizContractsNode)
CREATE (crossBizOrdersNode:Entity {
  name: "crossBizOrders",
  tableName: "cross_biz_orders",
  domain: "Marketplace",
  description: "cross_biz_orders",
  file: "marketplace.ts"
})
CREATE (MarketplaceDomain)-[:CONTAINS]->(crossBizOrdersNode)
CREATE (marketplaceListingsNode:Entity {
  name: "marketplaceListings",
  tableName: "marketplace_listings",
  domain: "Marketplace",
  description: "marketplace_listings",
  file: "marketplace.ts"
})
CREATE (MarketplaceDomain)-[:CONTAINS]->(marketplaceListingsNode)
CREATE (referralAttributionsNode:Entity {
  name: "referralAttributions",
  tableName: "referral_attributions",
  domain: "Marketplace",
  description: "referral_attributions",
  file: "referral_attribution.ts"
})
CREATE (MarketplaceDomain)-[:CONTAINS]->(referralAttributionsNode)
CREATE (referralEventsNode:Entity {
  name: "referralEvents",
  tableName: "referral_events",
  domain: "Marketplace",
  description: "referral_events",
  file: "marketplace.ts"
})
CREATE (MarketplaceDomain)-[:CONTAINS]->(referralEventsNode)
CREATE (referralLinkClicksNode:Entity {
  name: "referralLinkClicks",
  tableName: "referral_link_clicks",
  domain: "Marketplace",
  description: "referral_link_clicks",
  file: "referral_attribution.ts"
})
CREATE (MarketplaceDomain)-[:CONTAINS]->(referralLinkClicksNode)
CREATE (referralLinksNode:Entity {
  name: "referralLinks",
  tableName: "referral_links",
  domain: "Marketplace",
  description: "referral_links",
  file: "referral_attribution.ts"
})
CREATE (MarketplaceDomain)-[:CONTAINS]->(referralLinksNode)
CREATE (referralProgramsNode:Entity {
  name: "referralPrograms",
  tableName: "referral_programs",
  domain: "Marketplace",
  description: "referral_programs",
  file: "marketplace.ts"
})
CREATE (MarketplaceDomain)-[:CONTAINS]->(referralProgramsNode)
CREATE (rewardGrantsNode:Entity {
  name: "rewardGrants",
  tableName: "reward_grants",
  domain: "Marketplace",
  description: "reward_grants",
  file: "marketplace.ts"
})
CREATE (MarketplaceDomain)-[:CONTAINS]->(rewardGrantsNode)

// Operations (17 tables)
CREATE (asyncDeliverablesNode:Entity {
  name: "asyncDeliverables",
  tableName: "async_deliverables",
  domain: "Operations",
  description: "async_deliverables",
  file: "workflows.ts"
})
CREATE (OperationsDomain)-[:CONTAINS]->(asyncDeliverablesNode)
CREATE (dispatchTasksNode:Entity {
  name: "dispatchTasks",
  tableName: "dispatch_tasks",
  domain: "Operations",
  description: "dispatch_tasks",
  file: "transportation.ts"
})
CREATE (OperationsDomain)-[:CONTAINS]->(dispatchTasksNode)
CREATE (etaEventsNode:Entity {
  name: "etaEvents",
  tableName: "eta_events",
  domain: "Operations",
  description: "eta_events",
  file: "transportation.ts"
})
CREATE (OperationsDomain)-[:CONTAINS]->(etaEventsNode)
CREATE (fleetVehiclesNode:Entity {
  name: "fleetVehicles",
  tableName: "fleet_vehicles",
  domain: "Operations",
  description: "fleet_vehicles",
  file: "transportation.ts"
})
CREATE (OperationsDomain)-[:CONTAINS]->(fleetVehiclesNode)
CREATE (operationalAssignmentsNode:Entity {
  name: "operationalAssignments",
  tableName: "operational_assignments",
  domain: "Operations",
  description: "operational_assignments",
  file: "operations_backbone.ts"
})
CREATE (OperationsDomain)-[:CONTAINS]->(operationalAssignmentsNode)
CREATE (operationalDemandsNode:Entity {
  name: "operationalDemands",
  tableName: "operational_demands",
  domain: "Operations",
  description: "operational_demands",
  file: "operations_backbone.ts"
})
CREATE (OperationsDomain)-[:CONTAINS]->(operationalDemandsNode)
CREATE (shipmentGeneratedItemsNode:Entity {
  name: "shipmentGeneratedItems",
  tableName: "shipment_generated_items",
  domain: "Operations",
  description: "shipment_generated_items",
  file: "shipment_schedules.ts"
})
CREATE (OperationsDomain)-[:CONTAINS]->(shipmentGeneratedItemsNode)
CREATE (shipmentGenerationRunsNode:Entity {
  name: "shipmentGenerationRuns",
  tableName: "shipment_generation_runs",
  domain: "Operations",
  description: "shipment_generation_runs",
  file: "shipment_schedules.ts"
})
CREATE (OperationsDomain)-[:CONTAINS]->(shipmentGenerationRunsNode)
CREATE (shipmentSchedulesNode:Entity {
  name: "shipmentSchedules",
  tableName: "shipment_schedules",
  domain: "Operations",
  description: "shipment_schedules",
  file: "shipment_schedules.ts"
})
CREATE (OperationsDomain)-[:CONTAINS]->(shipmentSchedulesNode)
CREATE (transportRouteStopsNode:Entity {
  name: "transportRouteStops",
  tableName: "transport_route_stops",
  domain: "Operations",
  description: "transport_route_stops",
  file: "transportation.ts"
})
CREATE (OperationsDomain)-[:CONTAINS]->(transportRouteStopsNode)
CREATE (transportRoutesNode:Entity {
  name: "transportRoutes",
  tableName: "transport_routes",
  domain: "Operations",
  description: "transport_routes",
  file: "transportation.ts"
})
CREATE (OperationsDomain)-[:CONTAINS]->(transportRoutesNode)
CREATE (transportTripsNode:Entity {
  name: "transportTrips",
  tableName: "transport_trips",
  domain: "Operations",
  description: "transport_trips",
  file: "transportation.ts"
})
CREATE (OperationsDomain)-[:CONTAINS]->(transportTripsNode)
CREATE (tripManifestsNode:Entity {
  name: "tripManifests",
  tableName: "trip_manifests",
  domain: "Operations",
  description: "trip_manifests",
  file: "transportation.ts"
})
CREATE (OperationsDomain)-[:CONTAINS]->(tripManifestsNode)
CREATE (tripStopInventoryNode:Entity {
  name: "tripStopInventory",
  tableName: "trip_stop_inventory",
  domain: "Operations",
  description: "trip_stop_inventory",
  file: "transportation.ts"
})
CREATE (OperationsDomain)-[:CONTAINS]->(tripStopInventoryNode)
CREATE (workflowDecisionsNode:Entity {
  name: "workflowDecisions",
  tableName: "workflow_decisions",
  domain: "Operations",
  description: "workflow_decisions",
  file: "workflows.ts"
})
CREATE (OperationsDomain)-[:CONTAINS]->(workflowDecisionsNode)
CREATE (workflowInstancesNode:Entity {
  name: "workflowInstances",
  tableName: "workflow_instances",
  domain: "Operations",
  description: "workflow_instances",
  file: "workflows.ts"
})
CREATE (OperationsDomain)-[:CONTAINS]->(workflowInstancesNode)
CREATE (workflowStepsNode:Entity {
  name: "workflowSteps",
  tableName: "workflow_steps",
  domain: "Operations",
  description: "workflow_steps",
  file: "workflows.ts"
})
CREATE (OperationsDomain)-[:CONTAINS]->(workflowStepsNode)

// Payments (18 tables)
CREATE (arInvoicesNode:Entity {
  name: "arInvoices",
  tableName: "ar_invoices",
  domain: "Payments",
  description: "ar_invoices",
  file: "ar.ts"
})
CREATE (PaymentsDomain)-[:CONTAINS]->(arInvoicesNode)
CREATE (compensationLedgerEntriesNode:Entity {
  name: "compensationLedgerEntries",
  tableName: "compensation_ledger_entries",
  domain: "Payments",
  description: "compensation_ledger_entries",
  file: "compensation.ts"
})
CREATE (PaymentsDomain)-[:CONTAINS]->(compensationLedgerEntriesNode)
CREATE (entitlementLedgerEntriesNode:Entity {
  name: "entitlementLedgerEntries",
  tableName: "entitlement_ledger_entries",
  domain: "Payments",
  description: "entitlement_ledger_entries",
  file: "entitlements.ts"
})
CREATE (PaymentsDomain)-[:CONTAINS]->(entitlementLedgerEntriesNode)
CREATE (giftInstrumentLedgerEntriesNode:Entity {
  name: "giftInstrumentLedgerEntries",
  tableName: "gift_instrument_ledger_entries",
  domain: "Payments",
  description: "gift_instrument_ledger_entries",
  file: "gifts.ts"
})
CREATE (PaymentsDomain)-[:CONTAINS]->(giftInstrumentLedgerEntriesNode)
CREATE (invoiceEventsNode:Entity {
  name: "invoiceEvents",
  tableName: "invoice_events",
  domain: "Payments",
  description: "invoice_events",
  file: "ar.ts"
})
CREATE (PaymentsDomain)-[:CONTAINS]->(invoiceEventsNode)
CREATE (leaveBalancesNode:Entity {
  name: "leaveBalances",
  tableName: "leave_balances",
  domain: "Payments",
  description: "leave_balances",
  file: "leave.ts"
})
CREATE (PaymentsDomain)-[:CONTAINS]->(leaveBalancesNode)
CREATE (paymentDisputesNode:Entity {
  name: "paymentDisputes",
  tableName: "payment_disputes",
  domain: "Payments",
  description: "payment_disputes",
  file: "payments.ts"
})
CREATE (PaymentsDomain)-[:CONTAINS]->(paymentDisputesNode)
CREATE (paymentIntentEventsNode:Entity {
  name: "paymentIntentEvents",
  tableName: "payment_intent_events",
  domain: "Payments",
  description: "payment_intent_events",
  file: "payments.ts"
})
CREATE (PaymentsDomain)-[:CONTAINS]->(paymentIntentEventsNode)
CREATE (paymentIntentTendersNode:Entity {
  name: "paymentIntentTenders",
  tableName: "payment_intent_tenders",
  domain: "Payments",
  description: "payment_intent_tenders",
  file: "payments.ts"
})
CREATE (PaymentsDomain)-[:CONTAINS]->(paymentIntentTendersNode)
CREATE (paymentIntentsNode:Entity {
  name: "paymentIntents",
  tableName: "payment_intents",
  domain: "Payments",
  description: "payment_intents",
  file: "payments.ts"
})
CREATE (PaymentsDomain)-[:CONTAINS]->(paymentIntentsNode)
CREATE (paymentMethodsNode:Entity {
  name: "paymentMethods",
  tableName: "payment_methods",
  domain: "Payments",
  description: "payment_methods",
  file: "payments.ts"
})
CREATE (PaymentsDomain)-[:CONTAINS]->(paymentMethodsNode)
CREATE (paymentTransactionsNode:Entity {
  name: "paymentTransactions",
  tableName: "payment_transactions",
  domain: "Payments",
  description: "payment_transactions",
  file: "payments.ts"
})
CREATE (PaymentsDomain)-[:CONTAINS]->(paymentTransactionsNode)
CREATE (payoutLedgerEntriesNode:Entity {
  name: "payoutLedgerEntries",
  tableName: "payout_ledger_entries",
  domain: "Payments",
  description: "payout_ledger_entries",
  file: "payments.ts"
})
CREATE (PaymentsDomain)-[:CONTAINS]->(payoutLedgerEntriesNode)
CREATE (payoutsNode:Entity {
  name: "payouts",
  tableName: "payouts",
  domain: "Payments",
  description: "payouts",
  file: "payments.ts"
})
CREATE (PaymentsDomain)-[:CONTAINS]->(payoutsNode)
CREATE (settlementBatchesNode:Entity {
  name: "settlementBatches",
  tableName: "settlement_batches",
  domain: "Payments",
  description: "settlement_batches",
  file: "payments.ts"
})
CREATE (PaymentsDomain)-[:CONTAINS]->(settlementBatchesNode)
CREATE (settlementEntriesNode:Entity {
  name: "settlementEntries",
  tableName: "settlement_entries",
  domain: "Payments",
  description: "settlement_entries",
  file: "payments.ts"
})
CREATE (PaymentsDomain)-[:CONTAINS]->(settlementEntriesNode)
CREATE (stripeInvoicesNode:Entity {
  name: "stripeInvoices",
  tableName: "stripe_invoices",
  domain: "Payments",
  description: "stripe_invoices",
  file: "stripe.ts"
})
CREATE (PaymentsDomain)-[:CONTAINS]->(stripeInvoicesNode)
CREATE (stripePaymentMethodsNode:Entity {
  name: "stripePaymentMethods",
  tableName: "stripe_payment_methods",
  domain: "Payments",
  description: "stripe_payment_methods",
  file: "stripe.ts"
})
CREATE (PaymentsDomain)-[:CONTAINS]->(stripePaymentMethodsNode)

// Queue (10 tables)
CREATE (queueCounterAssignmentsNode:Entity {
  name: "queueCounterAssignments",
  tableName: "queue_counter_assignments",
  domain: "Queue",
  description: "queue_counter_assignments",
  file: "queue_operations.ts"
})
CREATE (QueueDomain)-[:CONTAINS]->(queueCounterAssignmentsNode)
CREATE (queueCountersNode:Entity {
  name: "queueCounters",
  tableName: "queue_counters",
  domain: "Queue",
  description: "queue_counters",
  file: "queue_operations.ts"
})
CREATE (QueueDomain)-[:CONTAINS]->(queueCountersNode)
CREATE (queueEntriesNode:Entity {
  name: "queueEntries",
  tableName: "queue_entries",
  domain: "Queue",
  description: "queue_entries",
  file: "queue.ts"
})
CREATE (QueueDomain)-[:CONTAINS]->(queueEntriesNode)
CREATE (queueEventsNode:Entity {
  name: "queueEvents",
  tableName: "queue_events",
  domain: "Queue",
  description: "queue_events",
  file: "queue.ts"
})
CREATE (QueueDomain)-[:CONTAINS]->(queueEventsNode)
CREATE (queueTicketCallsNode:Entity {
  name: "queueTicketCalls",
  tableName: "queue_ticket_calls",
  domain: "Queue",
  description: "queue_ticket_calls",
  file: "queue_operations.ts"
})
CREATE (QueueDomain)-[:CONTAINS]->(queueTicketCallsNode)
CREATE (queueTicketsNode:Entity {
  name: "queueTickets",
  tableName: "queue_tickets",
  domain: "Queue",
  description: "queue_tickets",
  file: "queue.ts"
})
CREATE (QueueDomain)-[:CONTAINS]->(queueTicketsNode)
CREATE (queuesNode:Entity {
  name: "queues",
  tableName: "queues",
  domain: "Queue",
  description: "queues",
  file: "queue.ts"
})
CREATE (QueueDomain)-[:CONTAINS]->(queuesNode)
CREATE (reviewQueueItemsNode:Entity {
  name: "reviewQueueItems",
  tableName: "review_queue_items",
  domain: "Queue",
  description: "review_queue_items",
  file: "workflows.ts"
})
CREATE (QueueDomain)-[:CONTAINS]->(reviewQueueItemsNode)
CREATE (reviewQueuesNode:Entity {
  name: "reviewQueues",
  tableName: "review_queues",
  domain: "Queue",
  description: "review_queues",
  file: "workflows.ts"
})
CREATE (QueueDomain)-[:CONTAINS]->(reviewQueuesNode)
CREATE (waitTimePredictionsNode:Entity {
  name: "waitTimePredictions",
  tableName: "wait_time_predictions",
  domain: "Queue",
  description: "wait_time_predictions",
  file: "queue.ts"
})
CREATE (QueueDomain)-[:CONTAINS]->(waitTimePredictionsNode)

// Social (31 tables)
CREATE (breachNotificationsNode:Entity {
  name: "breachNotifications",
  tableName: "breach_notifications",
  domain: "Social",
  description: "breach_notifications",
  file: "hipaa.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(breachNotificationsNode)
CREATE (channelEntityLinksNode:Entity {
  name: "channelEntityLinks",
  tableName: "channel_entity_links",
  domain: "Social",
  description: "channel_entity_links",
  file: "channels.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(channelEntityLinksNode)
CREATE (channelSyncItemsNode:Entity {
  name: "channelSyncItems",
  tableName: "channel_sync_items",
  domain: "Social",
  description: "channel_sync_items",
  file: "channels.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(channelSyncItemsNode)
CREATE (channelSyncJobsNode:Entity {
  name: "channelSyncJobs",
  tableName: "channel_sync_jobs",
  domain: "Social",
  description: "channel_sync_jobs",
  file: "channels.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(channelSyncJobsNode)
CREATE (channelSyncStatesNode:Entity {
  name: "channelSyncStates",
  tableName: "channel_sync_states",
  domain: "Social",
  description: "channel_sync_states",
  file: "channels.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(channelSyncStatesNode)
CREATE (channelWebhookEventsNode:Entity {
  name: "channelWebhookEvents",
  tableName: "channel_webhook_events",
  domain: "Social",
  description: "channel_webhook_events",
  file: "channels.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(channelWebhookEventsNode)
CREATE (communicationConsentsNode:Entity {
  name: "communicationConsents",
  tableName: "communication_consents",
  domain: "Social",
  description: "communication_consents",
  file: "communications.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(communicationConsentsNode)
CREATE (crmContactChannelsNode:Entity {
  name: "crmContactChannels",
  tableName: "crm_contact_channels",
  domain: "Social",
  description: "crm_contact_channels",
  file: "crm.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(crmContactChannelsNode)
CREATE (graphAudienceSegmentMembersNode:Entity {
  name: "graphAudienceSegmentMembers",
  tableName: "graph_audience_segment_members",
  domain: "Social",
  description: "graph_audience_segment_members",
  file: "social_graph.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(graphAudienceSegmentMembersNode)
CREATE (graphAudienceSegmentsNode:Entity {
  name: "graphAudienceSegments",
  tableName: "graph_audience_segments",
  domain: "Social",
  description: "graph_audience_segments",
  file: "social_graph.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(graphAudienceSegmentsNode)
CREATE (graphFeedItemAudienceRulesNode:Entity {
  name: "graphFeedItemAudienceRules",
  tableName: "graph_feed_item_audience_rules",
  domain: "Social",
  description: "graph_feed_item_audience_rules",
  file: "social_graph.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(graphFeedItemAudienceRulesNode)
CREATE (graphFeedItemDeliveriesNode:Entity {
  name: "graphFeedItemDeliveries",
  tableName: "graph_feed_item_deliveries",
  domain: "Social",
  description: "graph_feed_item_deliveries",
  file: "social_graph.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(graphFeedItemDeliveriesNode)
CREATE (graphFeedItemLinksNode:Entity {
  name: "graphFeedItemLinks",
  tableName: "graph_feed_item_links",
  domain: "Social",
  description: "graph_feed_item_links",
  file: "social_graph.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(graphFeedItemLinksNode)
CREATE (graphFeedItemsNode:Entity {
  name: "graphFeedItems",
  tableName: "graph_feed_items",
  domain: "Social",
  description: "graph_feed_items",
  file: "social_graph.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(graphFeedItemsNode)
CREATE (graphIdentitiesNode:Entity {
  name: "graphIdentities",
  tableName: "graph_identities",
  domain: "Social",
  description: "graph_identities",
  file: "social_graph.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(graphIdentitiesNode)
CREATE (graphIdentityNotificationEndpointsNode:Entity {
  name: "graphIdentityNotificationEndpoints",
  tableName: "graph_identity_notification_endpoints",
  domain: "Social",
  description: "graph_identity_notification_endpoints",
  file: "social_graph.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(graphIdentityNotificationEndpointsNode)
CREATE (graphIdentityPoliciesNode:Entity {
  name: "graphIdentityPolicies",
  tableName: "graph_identity_policies",
  domain: "Social",
  description: "graph_identity_policies",
  file: "social_graph.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(graphIdentityPoliciesNode)
CREATE (graphRelationshipEventsNode:Entity {
  name: "graphRelationshipEvents",
  tableName: "graph_relationship_events",
  domain: "Social",
  description: "graph_relationship_events",
  file: "social_graph.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(graphRelationshipEventsNode)
CREATE (graphRelationshipsNode:Entity {
  name: "graphRelationships",
  tableName: "graph_relationships",
  domain: "Social",
  description: "graph_relationships",
  file: "social_graph.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(graphRelationshipsNode)
CREATE (graphSubjectEventDeliveriesNode:Entity {
  name: "graphSubjectEventDeliveries",
  tableName: "graph_subject_event_deliveries",
  domain: "Social",
  description: "graph_subject_event_deliveries",
  file: "social_graph.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(graphSubjectEventDeliveriesNode)
CREATE (graphSubjectEventsNode:Entity {
  name: "graphSubjectEvents",
  tableName: "graph_subject_events",
  domain: "Social",
  description: "graph_subject_events",
  file: "social_graph.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(graphSubjectEventsNode)
CREATE (graphSubjectSubscriptionsNode:Entity {
  name: "graphSubjectSubscriptions",
  tableName: "graph_subject_subscriptions",
  domain: "Social",
  description: "graph_subject_subscriptions",
  file: "social_graph.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(graphSubjectSubscriptionsNode)
CREATE (lifecycleEventSubscriptionsNode:Entity {
  name: "lifecycleEventSubscriptions",
  tableName: "lifecycle_event_subscriptions",
  domain: "Social",
  description: "lifecycle_event_subscriptions",
  file: "extensions.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(lifecycleEventSubscriptionsNode)
CREATE (marketingCampaignEnrollmentsNode:Entity {
  name: "marketingCampaignEnrollments",
  tableName: "marketing_campaign_enrollments",
  domain: "Social",
  description: "marketing_campaign_enrollments",
  file: "communications.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(marketingCampaignEnrollmentsNode)
CREATE (marketingCampaignStepsNode:Entity {
  name: "marketingCampaignSteps",
  tableName: "marketing_campaign_steps",
  domain: "Social",
  description: "marketing_campaign_steps",
  file: "communications.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(marketingCampaignStepsNode)
CREATE (marketingCampaignsNode:Entity {
  name: "marketingCampaigns",
  tableName: "marketing_campaigns",
  domain: "Social",
  description: "marketing_campaigns",
  file: "communications.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(marketingCampaignsNode)
CREATE (messageTemplateBindingsNode:Entity {
  name: "messageTemplateBindings",
  tableName: "message_template_bindings",
  domain: "Social",
  description: "message_template_bindings",
  file: "communications.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(messageTemplateBindingsNode)
CREATE (messageTemplatesNode:Entity {
  name: "messageTemplates",
  tableName: "message_templates",
  domain: "Social",
  description: "message_templates",
  file: "communications.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(messageTemplatesNode)
CREATE (outboundMessageEventsNode:Entity {
  name: "outboundMessageEvents",
  tableName: "outbound_message_events",
  domain: "Social",
  description: "outbound_message_events",
  file: "communications.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(outboundMessageEventsNode)
CREATE (outboundMessagesNode:Entity {
  name: "outboundMessages",
  tableName: "outbound_messages",
  domain: "Social",
  description: "outbound_messages",
  file: "communications.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(outboundMessagesNode)
CREATE (quietHourPoliciesNode:Entity {
  name: "quietHourPolicies",
  tableName: "quiet_hour_policies",
  domain: "Social",
  description: "quiet_hour_policies",
  file: "communications.ts"
})
CREATE (SocialDomain)-[:CONTAINS]->(quietHourPoliciesNode)

// Supply (50 tables)
CREATE (assetsNode:Entity {
  name: "assets",
  tableName: "assets",
  domain: "Supply",
  description: "assets",
  file: "assets.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(assetsNode)
CREATE (availabilityDependencyRuleTargetsNode:Entity {
  name: "availabilityDependencyRuleTargets",
  tableName: "availability_dependency_rule_targets",
  domain: "Supply",
  description: "availability_dependency_rule_targets",
  file: "time_availability.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(availabilityDependencyRuleTargetsNode)
CREATE (availabilityDependencyRulesNode:Entity {
  name: "availabilityDependencyRules",
  tableName: "availability_dependency_rules",
  domain: "Supply",
  description: "availability_dependency_rules",
  file: "time_availability.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(availabilityDependencyRulesNode)
CREATE (availabilityGatesNode:Entity {
  name: "availabilityGates",
  tableName: "availability_gates",
  domain: "Supply",
  description: "availability_gates",
  file: "time_availability.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(availabilityGatesNode)
CREATE (availabilityResolutionRunsNode:Entity {
  name: "availabilityResolutionRuns",
  tableName: "availability_resolution_runs",
  domain: "Supply",
  description: "availability_resolution_runs",
  file: "time_availability.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(availabilityResolutionRunsNode)
CREATE (availabilityRuleExclusionDatesNode:Entity {
  name: "availabilityRuleExclusionDates",
  tableName: "availability_rule_exclusion_dates",
  domain: "Supply",
  description: "availability_rule_exclusion_dates",
  file: "time_availability.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(availabilityRuleExclusionDatesNode)
CREATE (availabilityRuleTemplateItemsNode:Entity {
  name: "availabilityRuleTemplateItems",
  tableName: "availability_rule_template_items",
  domain: "Supply",
  description: "availability_rule_template_items",
  file: "time_availability.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(availabilityRuleTemplateItemsNode)
CREATE (availabilityRuleTemplatesNode:Entity {
  name: "availabilityRuleTemplates",
  tableName: "availability_rule_templates",
  domain: "Supply",
  description: "availability_rule_templates",
  file: "time_availability.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(availabilityRuleTemplatesNode)
CREATE (availabilityRulesNode:Entity {
  name: "availabilityRules",
  tableName: "availability_rules",
  domain: "Supply",
  description: "availability_rules",
  file: "time_availability.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(availabilityRulesNode)
CREATE (calendarAccessGrantSourcesNode:Entity {
  name: "calendarAccessGrantSources",
  tableName: "calendar_access_grant_sources",
  domain: "Supply",
  description: "calendar_access_grant_sources",
  file: "calendar_sync.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(calendarAccessGrantSourcesNode)
CREATE (calendarAccessGrantsNode:Entity {
  name: "calendarAccessGrants",
  tableName: "calendar_access_grants",
  domain: "Supply",
  description: "calendar_access_grants",
  file: "calendar_sync.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(calendarAccessGrantsNode)
CREATE (calendarBindingsNode:Entity {
  name: "calendarBindings",
  tableName: "calendar_bindings",
  domain: "Supply",
  description: "calendar_bindings",
  file: "time_availability.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(calendarBindingsNode)
CREATE (calendarOverlaysNode:Entity {
  name: "calendarOverlays",
  tableName: "calendar_overlays",
  domain: "Supply",
  description: "calendar_overlays",
  file: "time_availability.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(calendarOverlaysNode)
CREATE (calendarOwnerTimelineEventsNode:Entity {
  name: "calendarOwnerTimelineEvents",
  tableName: "calendar_owner_timeline_events",
  domain: "Supply",
  description: "calendar_owner_timeline_events",
  file: "time_availability.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(calendarOwnerTimelineEventsNode)
CREATE (calendarRevisionsNode:Entity {
  name: "calendarRevisions",
  tableName: "calendar_revisions",
  domain: "Supply",
  description: "calendar_revisions",
  file: "time_availability.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(calendarRevisionsNode)
CREATE (calendarRuleTemplateBindingExclusionDatesNode:Entity {
  name: "calendarRuleTemplateBindingExclusionDates",
  tableName: "calendar_rule_template_binding_exclusion_dates",
  domain: "Supply",
  description: "calendar_rule_template_binding_exclusion_dates",
  file: "time_availability.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(calendarRuleTemplateBindingExclusionDatesNode)
CREATE (calendarRuleTemplateBindingsNode:Entity {
  name: "calendarRuleTemplateBindings",
  tableName: "calendar_rule_template_bindings",
  domain: "Supply",
  description: "calendar_rule_template_bindings",
  file: "time_availability.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(calendarRuleTemplateBindingsNode)
CREATE (calendarSyncConnectionsNode:Entity {
  name: "calendarSyncConnections",
  tableName: "calendar_sync_connections",
  domain: "Supply",
  description: "calendar_sync_connections",
  file: "calendar_sync.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(calendarSyncConnectionsNode)
CREATE (calendarTimelineEventsNode:Entity {
  name: "calendarTimelineEvents",
  tableName: "calendar_timeline_events",
  domain: "Supply",
  description: "calendar_timeline_events",
  file: "time_availability.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(calendarTimelineEventsNode)
CREATE (calendarsNode:Entity {
  name: "calendars",
  tableName: "calendars",
  domain: "Supply",
  description: "calendars",
  file: "time_availability.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(calendarsNode)
CREATE (capacityHoldDemandAlertsNode:Entity {
  name: "capacityHoldDemandAlerts",
  tableName: "capacity_hold_demand_alerts",
  domain: "Supply",
  description: "capacity_hold_demand_alerts",
  file: "time_availability.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(capacityHoldDemandAlertsNode)
CREATE (capacityHoldEventsNode:Entity {
  name: "capacityHoldEvents",
  tableName: "capacity_hold_events",
  domain: "Supply",
  description: "capacity_hold_events",
  file: "time_availability.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(capacityHoldEventsNode)
CREATE (capacityHoldPoliciesNode:Entity {
  name: "capacityHoldPolicies",
  tableName: "capacity_hold_policies",
  domain: "Supply",
  description: "capacity_hold_policies",
  file: "time_availability.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(capacityHoldPoliciesNode)
CREATE (capacityHoldsNode:Entity {
  name: "capacityHolds",
  tableName: "capacity_holds",
  domain: "Supply",
  description: "capacity_holds",
  file: "time_availability.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(capacityHoldsNode)
CREATE (capacityPoolMembersNode:Entity {
  name: "capacityPoolMembers",
  tableName: "capacity_pool_members",
  domain: "Supply",
  description: "capacity_pool_members",
  file: "time_availability.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(capacityPoolMembersNode)
CREATE (capacityPoolsNode:Entity {
  name: "capacityPools",
  tableName: "capacity_pools",
  domain: "Supply",
  description: "capacity_pools",
  file: "time_availability.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(capacityPoolsNode)
CREATE (externalCalendarEventsNode:Entity {
  name: "externalCalendarEvents",
  tableName: "external_calendar_events",
  domain: "Supply",
  description: "external_calendar_events",
  file: "calendar_sync.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(externalCalendarEventsNode)
CREATE (externalCalendarsNode:Entity {
  name: "externalCalendars",
  tableName: "external_calendars",
  domain: "Supply",
  description: "external_calendars",
  file: "calendar_sync.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(externalCalendarsNode)
CREATE (factEnterpriseRevenueDailyNode:Entity {
  name: "factEnterpriseRevenueDaily",
  tableName: "fact_enterprise_revenue_daily",
  domain: "Supply",
  description: "fact_enterprise_revenue_daily",
  file: "enterprise.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(factEnterpriseRevenueDailyNode)
CREATE (factResourceUtilizationDailyNode:Entity {
  name: "factResourceUtilizationDaily",
  tableName: "fact_resource_utilization_daily",
  domain: "Supply",
  description: "fact_resource_utilization_daily",
  file: "reporting.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(factResourceUtilizationDailyNode)
CREATE (factRevenueDailyNode:Entity {
  name: "factRevenueDaily",
  tableName: "fact_revenue_daily",
  domain: "Supply",
  description: "fact_revenue_daily",
  file: "reporting.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(factRevenueDailyNode)
CREATE (factRevenueMonthlyNode:Entity {
  name: "factRevenueMonthly",
  tableName: "fact_revenue_monthly",
  domain: "Supply",
  description: "fact_revenue_monthly",
  file: "reporting.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(factRevenueMonthlyNode)
CREATE (hostGroupMembersNode:Entity {
  name: "hostGroupMembers",
  tableName: "host_group_members",
  domain: "Supply",
  description: "host_group_members",
  file: "resources.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(hostGroupMembersNode)
CREATE (hostGroupsNode:Entity {
  name: "hostGroups",
  tableName: "host_groups",
  domain: "Supply",
  description: "host_groups",
  file: "resources.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(hostGroupsNode)
CREATE (locationsNode:Entity {
  name: "locations",
  tableName: "locations",
  domain: "Supply",
  description: "locations",
  file: "locations.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(locationsNode)
CREATE (paymentIntentLineAllocationsNode:Entity {
  name: "paymentIntentLineAllocations",
  tableName: "payment_intent_line_allocations",
  domain: "Supply",
  description: "payment_intent_line_allocations",
  file: "payments.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(paymentIntentLineAllocationsNode)
CREATE (paymentTransactionLineAllocationsNode:Entity {
  name: "paymentTransactionLineAllocations",
  tableName: "payment_transaction_line_allocations",
  domain: "Supply",
  description: "payment_transaction_line_allocations",
  file: "payments.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(paymentTransactionLineAllocationsNode)
CREATE (resourceCapabilityAssignmentsNode:Entity {
  name: "resourceCapabilityAssignments",
  tableName: "resource_capability_assignments",
  domain: "Supply",
  description: "resource_capability_assignments",
  file: "supply.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(resourceCapabilityAssignmentsNode)
CREATE (resourceCapabilityTemplatesNode:Entity {
  name: "resourceCapabilityTemplates",
  tableName: "resource_capability_templates",
  domain: "Supply",
  description: "resource_capability_templates",
  file: "supply.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(resourceCapabilityTemplatesNode)
CREATE (resourceConditionReportsNode:Entity {
  name: "resourceConditionReports",
  tableName: "resource_condition_reports",
  domain: "Supply",
  description: "resource_condition_reports",
  file: "supply.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(resourceConditionReportsNode)
CREATE (resourceMaintenancePoliciesNode:Entity {
  name: "resourceMaintenancePolicies",
  tableName: "resource_maintenance_policies",
  domain: "Supply",
  description: "resource_maintenance_policies",
  file: "supply.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(resourceMaintenancePoliciesNode)
CREATE (resourceMaintenanceWorkOrdersNode:Entity {
  name: "resourceMaintenanceWorkOrders",
  tableName: "resource_maintenance_work_orders",
  domain: "Supply",
  description: "resource_maintenance_work_orders",
  file: "supply.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(resourceMaintenanceWorkOrdersNode)
CREATE (resourceStatusDefinitionsNode:Entity {
  name: "resourceStatusDefinitions",
  tableName: "resource_status_definitions",
  domain: "Supply",
  description: "resource_status_definitions",
  file: "resources.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(resourceStatusDefinitionsNode)
CREATE (resourceUsageCountersNode:Entity {
  name: "resourceUsageCounters",
  tableName: "resource_usage_counters",
  domain: "Supply",
  description: "resource_usage_counters",
  file: "supply.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(resourceUsageCountersNode)
CREATE (resourcesNode:Entity {
  name: "resources",
  tableName: "resources",
  domain: "Supply",
  description: "resources",
  file: "resources.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(resourcesNode)
CREATE (revenueShareRulesNode:Entity {
  name: "revenueShareRules",
  tableName: "revenue_share_rules",
  domain: "Supply",
  description: "revenue_share_rules",
  file: "marketplace.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(revenueShareRulesNode)
CREATE (securedBalanceAllocationsNode:Entity {
  name: "securedBalanceAllocations",
  tableName: "secured_balance_allocations",
  domain: "Supply",
  description: "secured_balance_allocations",
  file: "commitments.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(securedBalanceAllocationsNode)
CREATE (subjectLocationBindingsNode:Entity {
  name: "subjectLocationBindings",
  tableName: "subject_location_bindings",
  domain: "Supply",
  description: "subject_location_bindings",
  file: "subjects.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(subjectLocationBindingsNode)
CREATE (venuesNode:Entity {
  name: "venues",
  tableName: "venues",
  domain: "Supply",
  description: "venues",
  file: "venues.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(venuesNode)
CREATE (workTimeSegmentAllocationsNode:Entity {
  name: "workTimeSegmentAllocations",
  tableName: "work_time_segment_allocations",
  domain: "Supply",
  description: "work_time_segment_allocations",
  file: "work_management.ts"
})
CREATE (SupplyDomain)-[:CONTAINS]->(workTimeSegmentAllocationsNode)

// Indexes
CREATE INDEX entity_name_idx FOR (e:Entity) ON (e.name);
CREATE INDEX entity_domain_idx FOR (e:Entity) ON (e.domain);

RETURN '479 tables created across 17 domains' as status;