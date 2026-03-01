// ============================================
// COMPREHENSIVE BIZING SCHEMA GRAPH
// Tables: 479
// Relationships: 3129
// ============================================

MATCH (n) DETACH DELETE n;

// Create domains
CREATE (:AccessControlDomain:Domain {name: "Access Control", color: "#FF6B6B"})
CREATE (:BookingsDomain:Domain {name: "Bookings & Fulfillment", color: "#4ECDC4"})
CREATE (:CatalogDomain:Domain {name: "Catalog & Commerce", color: "#45B7D1"})
CREATE (:CoreInfrastructureDomain:Domain {name: "Core Infrastructure", color: "#96CEB4"})
CREATE (:Education&LearningDomain:Domain {name: "Education & Learning", color: "#FFEAA7"})
CREATE (:Enterprise&B2BDomain:Domain {name: "Enterprise & B2B", color: "#DDA0DD"})
CREATE (:GiftsDomain:Domain {name: "Gifts & Promotions", color: "#98D8C8"})
CREATE (:Governance&ComplianceDomain:Domain {name: "Governance & Compliance", color: "#F7DC6F"})
CREATE (:IdentityDomain:Domain {name: "Identity & Access", color: "#BB8FCE"})
CREATE (:Intelligence&AnalyticsDomain:Domain {name: "Intelligence & Analytics", color: "#85C1E2"})
CREATE (:Marketing&CRMDomain:Domain {name: "Marketing & CRM", color: "#F8C471"})
CREATE (:MarketplaceDomain:Domain {name: "Marketplace & Multi-Biz", color: "#82E0AA"})
CREATE (:OperationsDomain:Domain {name: "Operations & Workflow", color: "#F1948A"})
CREATE (:PaymentsDomain:Domain {name: "Payments & Money", color: "#85C1E9"})
CREATE (:QueueDomain:Domain {name: "Queue & Waitlist", color: "#D7BDE2"})
CREATE (:SocialDomain:Domain {name: "Social & Notifications", color: "#A9DFBF"})
CREATE (:SupplyDomain:Domain {name: "Supply & Resources", color: "#FF6B6B"})

// Create entities

CREATE (:AccessControlDomain:Entity {
  name: "accessActionTokenEvents",
  tableName: "access_action_token_events",
  domain: "AccessControl",
  description: "Table access_action_token_events",
  file: "access_rights.ts",
  fieldCount: 2,
  keyFields: "bizId, accessActionTokenId"
})

CREATE (:AccessControlDomain:Entity {
  name: "accessActionTokens",
  tableName: "access_action_tokens",
  domain: "AccessControl",
  description: "Table access_action_tokens",
  file: "access_rights.ts",
  fieldCount: 2,
  keyFields: "bizId, accessArtifactId"
})

CREATE (:AccessControlDomain:Entity {
  name: "accessActivityLogs",
  tableName: "access_activity_logs",
  domain: "AccessControl",
  description: "Table access_activity_logs",
  file: "access_rights.ts",
  fieldCount: 2,
  keyFields: "bizId, accessArtifactId"
})

CREATE (:PaymentsDomain:Entity {
  name: "accessArtifactEvents",
  tableName: "access_artifact_events",
  domain: "Payments",
  description: "Table access_artifact_events",
  file: "access_rights.ts",
  fieldCount: 2,
  keyFields: "bizId, accessArtifactId"
})

CREATE (:PaymentsDomain:Entity {
  name: "accessArtifactLinks",
  tableName: "access_artifact_links",
  domain: "Payments",
  description: "Table access_artifact_links",
  file: "access_rights.ts",
  fieldCount: 2,
  keyFields: "bizId, accessArtifactId"
})

CREATE (:PaymentsDomain:Entity {
  name: "accessArtifacts",
  tableName: "access_artifacts",
  domain: "Payments",
  description: "Table access_artifacts",
  file: "access_rights.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:BookingsDomain:Entity {
  name: "accessDeliveryLinks",
  tableName: "access_delivery_links",
  domain: "Bookings",
  description: "Table access_delivery_links",
  file: "access_rights.ts",
  fieldCount: 2,
  keyFields: "bizId, accessArtifactId"
})

CREATE (:PaymentsDomain:Entity {
  name: "accessLibraryItems",
  tableName: "access_library_items",
  domain: "Payments",
  description: "Table access_library_items",
  file: "access_library.ts",
  fieldCount: 3,
  keyFields: "bizId, ownerUserId, ownerGroupAccountId"
})

CREATE (:MarketplaceDomain:Entity {
  name: "accessResaleListings",
  tableName: "access_resale_listings",
  domain: "Marketplace",
  description: "Table access_resale_listings",
  file: "access_rights.ts",
  fieldCount: 5,
  keyFields: "bizId, accessArtifactId, accessTransferPolicyId, sellerUserId, sellerGroupAccountId"
})

CREATE (:AccessControlDomain:Entity {
  name: "accessSecurityDecisions",
  tableName: "access_security_decisions",
  domain: "AccessControl",
  description: "Table access_security_decisions",
  file: "access_rights.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:AccessControlDomain:Entity {
  name: "accessSecuritySignals",
  tableName: "access_security_signals",
  domain: "AccessControl",
  description: "Table access_security_signals",
  file: "access_rights.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:AccessControlDomain:Entity {
  name: "accessTransferPolicies",
  tableName: "access_transfer_policies",
  domain: "AccessControl",
  description: "Table access_transfer_policies",
  file: "access_rights.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:AccessControlDomain:Entity {
  name: "accessTransfers",
  tableName: "access_transfers",
  domain: "AccessControl",
  description: "Table access_transfers",
  file: "access_rights.ts",
  fieldCount: 6,
  keyFields: "bizId, sourceAccessArtifactId, targetAccessArtifactId, accessTransferPolicyId, requestedByUserId, approvedByUserId"
})

CREATE (:AccessControlDomain:Entity {
  name: "accessUsageWindows",
  tableName: "access_usage_windows",
  domain: "AccessControl",
  description: "Table access_usage_windows",
  file: "access_rights.ts",
  fieldCount: 2,
  keyFields: "bizId, accessArtifactId"
})

CREATE (:PaymentsDomain:Entity {
  name: "adSpendDailyFacts",
  tableName: "ad_spend_daily_facts",
  domain: "Payments",
  description: "Table ad_spend_daily_facts",
  file: "marketing_performance.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:Education&LearningDomain:Entity {
  name: "apiAccessTokens",
  tableName: "api_access_tokens",
  domain: "Education&Learning",
  description: "Table api_access_tokens",
  file: "api_credentials.ts",
  fieldCount: 3,
  keyFields: "apiCredentialId, ownerUserId, bizId"
})

CREATE (:Education&LearningDomain:Entity {
  name: "apiCredentials",
  tableName: "api_credentials",
  domain: "Education&Learning",
  description: "Table api_credentials",
  file: "api_credentials.ts",
  fieldCount: 2,
  keyFields: "ownerUserId, bizId"
})

CREATE (:PaymentsDomain:Entity {
  name: "arInvoices",
  tableName: "ar_invoices",
  domain: "Payments",
  description: "Table ar_invoices",
  file: "ar.ts",
  fieldCount: 3,
  keyFields: "bizId, billingAccountId, purchaseOrderId"
})

CREATE (:Education&LearningDomain:Entity {
  name: "assessmentAttempts",
  tableName: "assessment_attempts",
  domain: "Education&Learning",
  description: "Table assessment_attempts",
  file: "assessments.ts",
  fieldCount: 2,
  keyFields: "bizId, assessmentTemplateId"
})

CREATE (:Education&LearningDomain:Entity {
  name: "assessmentItems",
  tableName: "assessment_items",
  domain: "Education&Learning",
  description: "Table assessment_items",
  file: "assessments.ts",
  fieldCount: 2,
  keyFields: "bizId, assessmentTemplateId"
})

CREATE (:Education&LearningDomain:Entity {
  name: "assessmentResponses",
  tableName: "assessment_responses",
  domain: "Education&Learning",
  description: "Table assessment_responses",
  file: "assessments.ts",
  fieldCount: 4,
  keyFields: "bizId, assessmentAttemptId, assessmentTemplateId, assessmentItemId"
})

CREATE (:Education&LearningDomain:Entity {
  name: "assessmentResults",
  tableName: "assessment_results",
  domain: "Education&Learning",
  description: "Table assessment_results",
  file: "assessments.ts",
  fieldCount: 3,
  keyFields: "bizId, assessmentAttemptId, assessmentTemplateId"
})

CREATE (:Education&LearningDomain:Entity {
  name: "assessmentTemplates",
  tableName: "assessment_templates",
  domain: "Education&Learning",
  description: "Table assessment_templates",
  file: "assessments.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:SupplyDomain:Entity {
  name: "assets",
  tableName: "assets",
  domain: "Supply",
  description: "Table assets",
  file: "assets.ts",
  fieldCount: 2,
  keyFields: "bizId, locationId"
})

CREATE (:OperationsDomain:Entity {
  name: "asyncDeliverables",
  tableName: "async_deliverables",
  domain: "Operations",
  description: "Table async_deliverables",
  file: "workflows.ts",
  fieldCount: 4,
  keyFields: "bizId, workflowInstanceId, bookingOrderId, fulfillmentUnitId"
})

CREATE (:PaymentsDomain:Entity {
  name: "auctions",
  tableName: "auctions",
  domain: "Payments",
  description: "Table auctions",
  file: "marketplace.ts",
  fieldCount: 2,
  keyFields: "bizId, marketplaceListingId"
})

CREATE (:Governance&ComplianceDomain:Entity {
  name: "auditEvents",
  tableName: "audit_events",
  domain: "Governance&Compliance",
  description: "Table audit_events",
  file: "audit.ts",
  fieldCount: 3,
  keyFields: "bizId, streamId, actorUserId"
})

CREATE (:Governance&ComplianceDomain:Entity {
  name: "auditIntegrityRuns",
  tableName: "audit_integrity_runs",
  domain: "Governance&Compliance",
  description: "Table audit_integrity_runs",
  file: "audit.ts",
  fieldCount: 2,
  keyFields: "bizId, streamId"
})

CREATE (:Governance&ComplianceDomain:Entity {
  name: "auditStreams",
  tableName: "audit_streams",
  domain: "Governance&Compliance",
  description: "Table audit_streams",
  file: "audit.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:IdentityDomain:Entity {
  name: "authzMembershipRoleMappings",
  tableName: "authz_membership_role_mappings",
  domain: "Identity",
  description: "Table authz_membership_role_mappings",
  file: "authz.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:IdentityDomain:Entity {
  name: "authzPermissionDefinitions",
  tableName: "authz_permission_definitions",
  domain: "Identity",
  description: "Table authz_permission_definitions",
  file: "authz.ts",
  fieldCount: 0,
  keyFields: "id"
})

CREATE (:IdentityDomain:Entity {
  name: "authzRoleAssignments",
  tableName: "authz_role_assignments",
  domain: "Identity",
  description: "Table authz_role_assignments",
  file: "authz.ts",
  fieldCount: 3,
  keyFields: "userId, bizId, roleDefinitionId"
})

CREATE (:IdentityDomain:Entity {
  name: "authzRoleDefinitions",
  tableName: "authz_role_definitions",
  domain: "Identity",
  description: "Table authz_role_definitions",
  file: "authz.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:IdentityDomain:Entity {
  name: "authzRolePermissions",
  tableName: "authz_role_permissions",
  domain: "Identity",
  description: "Table authz_role_permissions",
  file: "authz.ts",
  fieldCount: 2,
  keyFields: "roleDefinitionId, permissionDefinitionId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "autocollectionAttempts",
  tableName: "autocollection_attempts",
  domain: "CoreInfrastructure",
  description: "Table autocollection_attempts",
  file: "receivables.ts",
  fieldCount: 5,
  keyFields: "bizId, billingAccountAutopayRuleId, billingAccountId, arInvoiceId, installmentScheduleItemId"
})

CREATE (:SupplyDomain:Entity {
  name: "availabilityDependencyRuleTargets",
  tableName: "availability_dependency_rule_targets",
  domain: "Supply",
  description: "Table availability_dependency_rule_targets",
  file: "time_availability.ts",
  fieldCount: 3,
  keyFields: "bizId, availabilityDependencyRuleId, requiredCalendarId"
})

CREATE (:SupplyDomain:Entity {
  name: "availabilityDependencyRules",
  tableName: "availability_dependency_rules",
  domain: "Supply",
  description: "Table availability_dependency_rules",
  file: "time_availability.ts",
  fieldCount: 2,
  keyFields: "bizId, dependentCalendarId"
})

CREATE (:SupplyDomain:Entity {
  name: "availabilityGates",
  tableName: "availability_gates",
  domain: "Supply",
  description: "Table availability_gates",
  file: "time_availability.ts",
  fieldCount: 2,
  keyFields: "bizId, calendarId"
})

CREATE (:SupplyDomain:Entity {
  name: "availabilityResolutionRuns",
  tableName: "availability_resolution_runs",
  domain: "Supply",
  description: "Table availability_resolution_runs",
  file: "time_availability.ts",
  fieldCount: 2,
  keyFields: "bizId, calendarId"
})

CREATE (:SupplyDomain:Entity {
  name: "availabilityRuleExclusionDates",
  tableName: "availability_rule_exclusion_dates",
  domain: "Supply",
  description: "Table availability_rule_exclusion_dates",
  file: "time_availability.ts",
  fieldCount: 2,
  keyFields: "bizId, availabilityRuleId"
})

CREATE (:SupplyDomain:Entity {
  name: "availabilityRuleTemplateItems",
  tableName: "availability_rule_template_items",
  domain: "Supply",
  description: "Table availability_rule_template_items",
  file: "time_availability.ts",
  fieldCount: 2,
  keyFields: "bizId, availabilityRuleTemplateId"
})

CREATE (:SupplyDomain:Entity {
  name: "availabilityRuleTemplates",
  tableName: "availability_rule_templates",
  domain: "Supply",
  description: "Table availability_rule_templates",
  file: "time_availability.ts",
  fieldCount: 2,
  keyFields: "bizId, locationId"
})

CREATE (:SupplyDomain:Entity {
  name: "availabilityRules",
  tableName: "availability_rules",
  domain: "Supply",
  description: "Table availability_rules",
  file: "time_availability.ts",
  fieldCount: 3,
  keyFields: "bizId, calendarId, overlayId"
})

CREATE (:PaymentsDomain:Entity {
  name: "bids",
  tableName: "bids",
  domain: "Payments",
  description: "Table bids",
  file: "marketplace.ts",
  fieldCount: 4,
  keyFields: "bizId, auctionId, bidderBizId, bidderUserId"
})

CREATE (:PaymentsDomain:Entity {
  name: "billingAccountAutopayRules",
  tableName: "billing_account_autopay_rules",
  domain: "Payments",
  description: "Table billing_account_autopay_rules",
  file: "receivables.ts",
  fieldCount: 2,
  keyFields: "bizId, billingAccountId"
})

CREATE (:IdentityDomain:Entity {
  name: "billingAccounts",
  tableName: "billing_accounts",
  domain: "Identity",
  description: "Table billing_accounts",
  file: "ar.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "bizConfigBindings",
  tableName: "biz_config_bindings",
  domain: "CoreInfrastructure",
  description: "Table biz_config_bindings",
  file: "biz_configs.ts",
  fieldCount: 3,
  keyFields: "bizId, configSetId, locationId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "bizConfigPromotionRunItems",
  tableName: "biz_config_promotion_run_items",
  domain: "CoreInfrastructure",
  description: "Table biz_config_promotion_run_items",
  file: "biz_configs.ts",
  fieldCount: 2,
  keyFields: "bizId, promotionRunId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "bizConfigPromotionRuns",
  tableName: "biz_config_promotion_runs",
  domain: "CoreInfrastructure",
  description: "Table biz_config_promotion_runs",
  file: "biz_configs.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "bizConfigSets",
  tableName: "biz_config_sets",
  domain: "CoreInfrastructure",
  description: "Table biz_config_sets",
  file: "biz_configs.ts",
  fieldCount: 2,
  keyFields: "bizId, locationId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "bizConfigValueLocalizations",
  tableName: "biz_config_value_localizations",
  domain: "CoreInfrastructure",
  description: "Table biz_config_value_localizations",
  file: "biz_configs.ts",
  fieldCount: 2,
  keyFields: "bizId, configValueId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "bizConfigValues",
  tableName: "biz_config_values",
  domain: "CoreInfrastructure",
  description: "Table biz_config_values",
  file: "biz_configs.ts",
  fieldCount: 2,
  keyFields: "bizId, configSetId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "bizCredentialRequestItems",
  tableName: "biz_credential_request_items",
  domain: "CoreInfrastructure",
  description: "Table biz_credential_request_items",
  file: "credential_exchange.ts",
  fieldCount: 3,
  keyFields: "bizId, bizCredentialRequestId, candidateUserId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "bizCredentialRequests",
  tableName: "biz_credential_requests",
  domain: "CoreInfrastructure",
  description: "Table biz_credential_requests",
  file: "credential_exchange.ts",
  fieldCount: 3,
  keyFields: "bizId, candidateUserId, requestedByUserId"
})

CREATE (:PaymentsDomain:Entity {
  name: "bizCredentialShareGrantSelectors",
  tableName: "biz_credential_share_grant_selectors",
  domain: "Payments",
  description: "Table biz_credential_share_grant_selectors",
  file: "credential_exchange.ts",
  fieldCount: 3,
  keyFields: "ownerUserId, granteeBizId, bizCredentialShareGrantId"
})

CREATE (:PaymentsDomain:Entity {
  name: "bizCredentialShareGrants",
  tableName: "biz_credential_share_grants",
  domain: "Payments",
  description: "Table biz_credential_share_grants",
  file: "credential_exchange.ts",
  fieldCount: 2,
  keyFields: "ownerUserId, granteeBizId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "bizExtensionInstalls",
  tableName: "biz_extension_installs",
  domain: "CoreInfrastructure",
  description: "Table biz_extension_installs",
  file: "extensions.ts",
  fieldCount: 2,
  keyFields: "bizId, extensionDefinitionId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "bizExtensionPermissionGrants",
  tableName: "biz_extension_permission_grants",
  domain: "CoreInfrastructure",
  description: "Table biz_extension_permission_grants",
  file: "extensions.ts",
  fieldCount: 3,
  keyFields: "bizId, bizExtensionInstallId, extensionPermissionDefinitionId"
})

CREATE (:IdentityDomain:Entity {
  name: "bizes",
  tableName: "bizes",
  domain: "Identity",
  description: "Table bizes",
  file: "bizes.ts",
  fieldCount: 0,
  keyFields: "id"
})

CREATE (:CatalogDomain:Entity {
  name: "bookingOrderLineSellables",
  tableName: "booking_order_line_sellables",
  domain: "Catalog",
  description: "Table booking_order_line_sellables",
  file: "product_commerce.ts",
  fieldCount: 3,
  keyFields: "bizId, bookingOrderLineId, sellableId"
})

CREATE (:BookingsDomain:Entity {
  name: "bookingOrderLines",
  tableName: "booking_order_lines",
  domain: "Bookings",
  description: "Table booking_order_lines",
  file: "fulfillment.ts",
  fieldCount: 2,
  keyFields: "bizId, bookingOrderId"
})

CREATE (:BookingsDomain:Entity {
  name: "bookingOrders",
  tableName: "booking_orders",
  domain: "Bookings",
  description: "Table booking_orders",
  file: "fulfillment.ts",
  fieldCount: 6,
  keyFields: "bizId, offerId, offerVersionId, customerUserId, customerGroupAccountId, statusConfigValueId"
})

CREATE (:BookingsDomain:Entity {
  name: "bookingParticipantObligations",
  tableName: "booking_participant_obligations",
  domain: "Bookings",
  description: "Table booking_participant_obligations",
  file: "participant_obligations.ts",
  fieldCount: 5,
  keyFields: "bizId, bookingOrderId, bookingOrderLineId, participantUserId, participantGroupAccountId"
})

CREATE (:SocialDomain:Entity {
  name: "breachNotifications",
  tableName: "breach_notifications",
  domain: "Social",
  description: "Table breach_notifications",
  file: "hipaa.ts",
  fieldCount: 2,
  keyFields: "bizId, securityIncidentId"
})

CREATE (:Governance&ComplianceDomain:Entity {
  name: "breakGlassReviews",
  tableName: "break_glass_reviews",
  domain: "Governance&Compliance",
  description: "Table break_glass_reviews",
  file: "hipaa.ts",
  fieldCount: 3,
  keyFields: "bizId, phiAccessEventId, reviewerUserId"
})

CREATE (:Governance&ComplianceDomain:Entity {
  name: "businessAssociateAgreements",
  tableName: "business_associate_agreements",
  domain: "Governance&Compliance",
  description: "Table business_associate_agreements",
  file: "hipaa.ts",
  fieldCount: 2,
  keyFields: "bizId, complianceProfileId"
})

CREATE (:PaymentsDomain:Entity {
  name: "calendarAccessGrantSources",
  tableName: "calendar_access_grant_sources",
  domain: "Payments",
  description: "Table calendar_access_grant_sources",
  file: "calendar_sync.ts",
  fieldCount: 6,
  keyFields: "ownerUserId, granteeBizId, calendarAccessGrantId, externalCalendarId, sourceBizId, calendarBindingId"
})

CREATE (:PaymentsDomain:Entity {
  name: "calendarAccessGrants",
  tableName: "calendar_access_grants",
  domain: "Payments",
  description: "Table calendar_access_grants",
  file: "calendar_sync.ts",
  fieldCount: 3,
  keyFields: "ownerUserId, granteeBizId, grantedByUserId"
})

CREATE (:SupplyDomain:Entity {
  name: "calendarBindings",
  tableName: "calendar_bindings",
  domain: "Supply",
  description: "Table calendar_bindings",
  file: "time_availability.ts",
  fieldCount: 9,
  keyFields: "bizId, calendarId, resourceId, serviceId, serviceProductId, offerId, offerVersionId, locationId"
})

CREATE (:SupplyDomain:Entity {
  name: "calendarOverlays",
  tableName: "calendar_overlays",
  domain: "Supply",
  description: "Table calendar_overlays",
  file: "time_availability.ts",
  fieldCount: 2,
  keyFields: "bizId, calendarId"
})

CREATE (:SupplyDomain:Entity {
  name: "calendarOwnerTimelineEvents",
  tableName: "calendar_owner_timeline_events",
  domain: "Supply",
  description: "Table calendar_owner_timeline_events",
  file: "time_availability.ts",
  fieldCount: 5,
  keyFields: "bizId, calendarId, calendarBindingId, calendarTimelineEventId, ownerUserId"
})

CREATE (:SupplyDomain:Entity {
  name: "calendarRevisions",
  tableName: "calendar_revisions",
  domain: "Supply",
  description: "Table calendar_revisions",
  file: "time_availability.ts",
  fieldCount: 2,
  keyFields: "bizId, calendarId"
})

CREATE (:SupplyDomain:Entity {
  name: "calendarRuleTemplateBindingExclusionDates",
  tableName: "calendar_rule_template_binding_exclusion_dates",
  domain: "Supply",
  description: "Table calendar_rule_template_binding_exclusion_dates",
  file: "time_availability.ts",
  fieldCount: 2,
  keyFields: "bizId, calendarRuleTemplateBindingId"
})

CREATE (:SupplyDomain:Entity {
  name: "calendarRuleTemplateBindings",
  tableName: "calendar_rule_template_bindings",
  domain: "Supply",
  description: "Table calendar_rule_template_bindings",
  file: "time_availability.ts",
  fieldCount: 3,
  keyFields: "bizId, calendarId, availabilityRuleTemplateId"
})

CREATE (:SupplyDomain:Entity {
  name: "calendarSyncConnections",
  tableName: "calendar_sync_connections",
  domain: "Supply",
  description: "Table calendar_sync_connections",
  file: "calendar_sync.ts",
  fieldCount: 1,
  keyFields: "ownerUserId"
})

CREATE (:SupplyDomain:Entity {
  name: "calendarTimelineEvents",
  tableName: "calendar_timeline_events",
  domain: "Supply",
  description: "Table calendar_timeline_events",
  file: "time_availability.ts",
  fieldCount: 2,
  keyFields: "bizId, calendarId"
})

CREATE (:SupplyDomain:Entity {
  name: "calendars",
  tableName: "calendars",
  domain: "Supply",
  description: "Table calendars",
  file: "time_availability.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:SupplyDomain:Entity {
  name: "capacityHoldDemandAlerts",
  tableName: "capacity_hold_demand_alerts",
  domain: "Supply",
  description: "Table capacity_hold_demand_alerts",
  file: "time_availability.ts",
  fieldCount: 12,
  keyFields: "bizId, capacityHoldPolicyId, locationId, calendarId, resourceId, capacityPoolId, serviceId, serviceProductId"
})

CREATE (:SupplyDomain:Entity {
  name: "capacityHoldEvents",
  tableName: "capacity_hold_events",
  domain: "Supply",
  description: "Table capacity_hold_events",
  file: "time_availability.ts",
  fieldCount: 3,
  keyFields: "bizId, capacityHoldId, actorUserId"
})

CREATE (:SupplyDomain:Entity {
  name: "capacityHoldPolicies",
  tableName: "capacity_hold_policies",
  domain: "Supply",
  description: "Table capacity_hold_policies",
  file: "time_availability.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:SupplyDomain:Entity {
  name: "capacityHolds",
  tableName: "capacity_holds",
  domain: "Supply",
  description: "Table capacity_holds",
  file: "time_availability.ts",
  fieldCount: 6,
  keyFields: "bizId, capacityHoldPolicyId, calendarId, capacityPoolId, resourceId, offerVersionId"
})

CREATE (:SupplyDomain:Entity {
  name: "capacityPoolMembers",
  tableName: "capacity_pool_members",
  domain: "Supply",
  description: "Table capacity_pool_members",
  file: "time_availability.ts",
  fieldCount: 5,
  keyFields: "bizId, capacityPoolId, resourceId, offerVersionId, locationId"
})

CREATE (:SupplyDomain:Entity {
  name: "capacityPools",
  tableName: "capacity_pools",
  domain: "Supply",
  description: "Table capacity_pools",
  file: "time_availability.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:PaymentsDomain:Entity {
  name: "certificationAwards",
  tableName: "certification_awards",
  domain: "Payments",
  description: "Table certification_awards",
  file: "education.ts",
  fieldCount: 4,
  keyFields: "bizId, certificationTemplateId, enrollmentId, learnerUserId"
})

CREATE (:Education&LearningDomain:Entity {
  name: "certificationTemplates",
  tableName: "certification_templates",
  domain: "Education&Learning",
  description: "Table certification_templates",
  file: "education.ts",
  fieldCount: 2,
  keyFields: "bizId, programId"
})

CREATE (:IdentityDomain:Entity {
  name: "channelAccounts",
  tableName: "channel_accounts",
  domain: "Identity",
  description: "Table channel_accounts",
  file: "channels.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "channelEntityLinks",
  tableName: "channel_entity_links",
  domain: "CoreInfrastructure",
  description: "Table channel_entity_links",
  file: "channels.ts",
  fieldCount: 6,
  keyFields: "bizId, channelAccountId, offerVersionId, bookingOrderId, resourceId, customerUserId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "channelSyncItems",
  tableName: "channel_sync_items",
  domain: "CoreInfrastructure",
  description: "Table channel_sync_items",
  file: "channels.ts",
  fieldCount: 3,
  keyFields: "bizId, channelSyncJobId, channelEntityLinkId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "channelSyncJobs",
  tableName: "channel_sync_jobs",
  domain: "CoreInfrastructure",
  description: "Table channel_sync_jobs",
  file: "channels.ts",
  fieldCount: 2,
  keyFields: "bizId, channelAccountId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "channelSyncStates",
  tableName: "channel_sync_states",
  domain: "CoreInfrastructure",
  description: "Table channel_sync_states",
  file: "channels.ts",
  fieldCount: 2,
  keyFields: "bizId, channelAccountId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "channelWebhookEvents",
  tableName: "channel_webhook_events",
  domain: "CoreInfrastructure",
  description: "Table channel_webhook_events",
  file: "channels.ts",
  fieldCount: 2,
  keyFields: "bizId, channelAccountId"
})

CREATE (:CatalogDomain:Entity {
  name: "checkoutRecoveryLinks",
  tableName: "checkout_recovery_links",
  domain: "Catalog",
  description: "Table checkout_recovery_links",
  file: "checkout.ts",
  fieldCount: 2,
  keyFields: "bizId, checkoutSessionId"
})

CREATE (:CatalogDomain:Entity {
  name: "checkoutSessionEvents",
  tableName: "checkout_session_events",
  domain: "Catalog",
  description: "Table checkout_session_events",
  file: "checkout.ts",
  fieldCount: 2,
  keyFields: "bizId, checkoutSessionId"
})

CREATE (:CatalogDomain:Entity {
  name: "checkoutSessionItems",
  tableName: "checkout_session_items",
  domain: "Catalog",
  description: "Table checkout_session_items",
  file: "checkout.ts",
  fieldCount: 3,
  keyFields: "bizId, checkoutSessionId, sellableId"
})

CREATE (:IdentityDomain:Entity {
  name: "checkoutSessions",
  tableName: "checkout_sessions",
  domain: "Identity",
  description: "Table checkout_sessions",
  file: "checkout.ts",
  fieldCount: 4,
  keyFields: "bizId, ownerUserId, ownerGroupAccountId, locationId"
})

CREATE (:Education&LearningDomain:Entity {
  name: "cohortEnrollments",
  tableName: "cohort_enrollments",
  domain: "Education&Learning",
  description: "Table cohort_enrollments",
  file: "education.ts",
  fieldCount: 4,
  keyFields: "bizId, cohortId, learnerUserId, bookingOrderId"
})

CREATE (:BookingsDomain:Entity {
  name: "commitmentClaimEvents",
  tableName: "commitment_claim_events",
  domain: "Bookings",
  description: "Table commitment_claim_events",
  file: "commitments.ts",
  fieldCount: 2,
  keyFields: "bizId, commitmentClaimId"
})

CREATE (:BookingsDomain:Entity {
  name: "commitmentClaims",
  tableName: "commitment_claims",
  domain: "Bookings",
  description: "Table commitment_claims",
  file: "commitments.ts",
  fieldCount: 2,
  keyFields: "bizId, commitmentContractId"
})

CREATE (:BookingsDomain:Entity {
  name: "commitmentContracts",
  tableName: "commitment_contracts",
  domain: "Bookings",
  description: "Table commitment_contracts",
  file: "commitments.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:BookingsDomain:Entity {
  name: "commitmentMilestoneObligations",
  tableName: "commitment_milestone_obligations",
  domain: "Bookings",
  description: "Table commitment_milestone_obligations",
  file: "commitments.ts",
  fieldCount: 4,
  keyFields: "bizId, commitmentContractId, commitmentMilestoneId, commitmentObligationId"
})

CREATE (:BookingsDomain:Entity {
  name: "commitmentMilestones",
  tableName: "commitment_milestones",
  domain: "Bookings",
  description: "Table commitment_milestones",
  file: "commitments.ts",
  fieldCount: 2,
  keyFields: "bizId, commitmentContractId"
})

CREATE (:BookingsDomain:Entity {
  name: "commitmentObligations",
  tableName: "commitment_obligations",
  domain: "Bookings",
  description: "Table commitment_obligations",
  file: "commitments.ts",
  fieldCount: 2,
  keyFields: "bizId, commitmentContractId"
})

CREATE (:SocialDomain:Entity {
  name: "communicationConsents",
  tableName: "communication_consents",
  domain: "Social",
  description: "Table communication_consents",
  file: "communications.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "compensationAssignmentRoles",
  tableName: "compensation_assignment_roles",
  domain: "CoreInfrastructure",
  description: "Table compensation_assignment_roles",
  file: "compensation.ts",
  fieldCount: 3,
  keyFields: "bizId, fulfillmentAssignmentId, roleTemplateId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "compensationLedgerEntries",
  tableName: "compensation_ledger_entries",
  domain: "CoreInfrastructure",
  description: "Table compensation_ledger_entries",
  file: "compensation.ts",
  fieldCount: 14,
  keyFields: "bizId, payeeResourceId, roleTemplateId, compensationAssignmentRoleId, compensationPlanVersionId, compensationPlanRuleId, bookingOrderId, bookingOrderLineId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "compensationPayRunItemEntries",
  tableName: "compensation_pay_run_item_entries",
  domain: "CoreInfrastructure",
  description: "Table compensation_pay_run_item_entries",
  file: "compensation.ts",
  fieldCount: 3,
  keyFields: "bizId, compensationPayRunItemId, compensationLedgerEntryId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "compensationPayRunItems",
  tableName: "compensation_pay_run_items",
  domain: "CoreInfrastructure",
  description: "Table compensation_pay_run_items",
  file: "compensation.ts",
  fieldCount: 3,
  keyFields: "bizId, compensationPayRunId, payeeResourceId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "compensationPayRuns",
  tableName: "compensation_pay_runs",
  domain: "CoreInfrastructure",
  description: "Table compensation_pay_runs",
  file: "compensation.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "compensationPlanRules",
  tableName: "compensation_plan_rules",
  domain: "CoreInfrastructure",
  description: "Table compensation_plan_rules",
  file: "compensation.ts",
  fieldCount: 2,
  keyFields: "bizId, compensationPlanVersionId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "compensationPlanVersions",
  tableName: "compensation_plan_versions",
  domain: "CoreInfrastructure",
  description: "Table compensation_plan_versions",
  file: "compensation.ts",
  fieldCount: 2,
  keyFields: "bizId, compensationPlanId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "compensationPlans",
  tableName: "compensation_plans",
  domain: "CoreInfrastructure",
  description: "Table compensation_plans",
  file: "compensation.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "compensationRoleTemplates",
  tableName: "compensation_role_templates",
  domain: "CoreInfrastructure",
  description: "Table compensation_role_templates",
  file: "compensation.ts",
  fieldCount: 2,
  keyFields: "bizId, locationId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "credentialDisclosureEvents",
  tableName: "credential_disclosure_events",
  domain: "CoreInfrastructure",
  description: "Table credential_disclosure_events",
  file: "credential_exchange.ts",
  fieldCount: 4,
  keyFields: "ownerUserId, granteeBizId, bizCredentialShareGrantId, bizCredentialRequestId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "credentialTypeDefinitions",
  tableName: "credential_type_definitions",
  domain: "CoreInfrastructure",
  description: "Table credential_type_definitions",
  file: "credential_exchange.ts",
  fieldCount: 0,
  keyFields: "id"
})

CREATE (:Marketing&CRMDomain:Entity {
  name: "crmContactChannels",
  tableName: "crm_contact_channels",
  domain: "Marketing&CRM",
  description: "Table crm_contact_channels",
  file: "crm.ts",
  fieldCount: 2,
  keyFields: "bizId, crmContactId"
})

CREATE (:Marketing&CRMDomain:Entity {
  name: "crmContacts",
  tableName: "crm_contacts",
  domain: "Marketing&CRM",
  description: "Table crm_contacts",
  file: "crm.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:Marketing&CRMDomain:Entity {
  name: "crmConversationMessages",
  tableName: "crm_conversation_messages",
  domain: "Marketing&CRM",
  description: "Table crm_conversation_messages",
  file: "crm.ts",
  fieldCount: 2,
  keyFields: "bizId, crmConversationId"
})

CREATE (:PaymentsDomain:Entity {
  name: "crmConversationParticipants",
  tableName: "crm_conversation_participants",
  domain: "Payments",
  description: "Table crm_conversation_participants",
  file: "crm.ts",
  fieldCount: 3,
  keyFields: "bizId, crmConversationId, participantCrmContactId"
})

CREATE (:Marketing&CRMDomain:Entity {
  name: "crmConversations",
  tableName: "crm_conversations",
  domain: "Marketing&CRM",
  description: "Table crm_conversations",
  file: "crm.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:Marketing&CRMDomain:Entity {
  name: "crmLeadEvents",
  tableName: "crm_lead_events",
  domain: "Marketing&CRM",
  description: "Table crm_lead_events",
  file: "crm.ts",
  fieldCount: 2,
  keyFields: "bizId, crmLeadId"
})

CREATE (:Marketing&CRMDomain:Entity {
  name: "crmLeads",
  tableName: "crm_leads",
  domain: "Marketing&CRM",
  description: "Table crm_leads",
  file: "crm.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:Marketing&CRMDomain:Entity {
  name: "crmMergeCandidates",
  tableName: "crm_merge_candidates",
  domain: "Marketing&CRM",
  description: "Table crm_merge_candidates",
  file: "crm.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:Marketing&CRMDomain:Entity {
  name: "crmMergeDecisions",
  tableName: "crm_merge_decisions",
  domain: "Marketing&CRM",
  description: "Table crm_merge_decisions",
  file: "crm.ts",
  fieldCount: 2,
  keyFields: "bizId, crmMergeCandidateId"
})

CREATE (:Marketing&CRMDomain:Entity {
  name: "crmOpportunities",
  tableName: "crm_opportunities",
  domain: "Marketing&CRM",
  description: "Table crm_opportunities",
  file: "crm.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:Marketing&CRMDomain:Entity {
  name: "crmOpportunityStageEvents",
  tableName: "crm_opportunity_stage_events",
  domain: "Marketing&CRM",
  description: "Table crm_opportunity_stage_events",
  file: "crm.ts",
  fieldCount: 4,
  keyFields: "bizId, crmOpportunityId, fromCrmPipelineStageId, toCrmPipelineStageId"
})

CREATE (:Marketing&CRMDomain:Entity {
  name: "crmPipelineStages",
  tableName: "crm_pipeline_stages",
  domain: "Marketing&CRM",
  description: "Table crm_pipeline_stages",
  file: "crm.ts",
  fieldCount: 2,
  keyFields: "bizId, crmPipelineId"
})

CREATE (:Marketing&CRMDomain:Entity {
  name: "crmPipelines",
  tableName: "crm_pipelines",
  domain: "Marketing&CRM",
  description: "Table crm_pipelines",
  file: "crm.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:Marketing&CRMDomain:Entity {
  name: "crmSubjectRedirects",
  tableName: "crm_subject_redirects",
  domain: "Marketing&CRM",
  description: "Table crm_subject_redirects",
  file: "crm.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:PaymentsDomain:Entity {
  name: "crossBizContracts",
  tableName: "cross_biz_contracts",
  domain: "Payments",
  description: "Table cross_biz_contracts",
  file: "marketplace.ts",
  fieldCount: 2,
  keyFields: "bizId, counterpartyBizId"
})

CREATE (:PaymentsDomain:Entity {
  name: "crossBizOrders",
  tableName: "cross_biz_orders",
  domain: "Payments",
  description: "Table cross_biz_orders",
  file: "marketplace.ts",
  fieldCount: 6,
  keyFields: "bizId, buyerBizId, sellerBizId, contractId, offerVersionId, bookingOrderId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "customFieldDefinitionOptions",
  tableName: "custom_field_definition_options",
  domain: "CoreInfrastructure",
  description: "Table custom_field_definition_options",
  file: "extensions.ts",
  fieldCount: 2,
  keyFields: "bizId, customFieldDefinitionId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "customFieldDefinitions",
  tableName: "custom_field_definitions",
  domain: "CoreInfrastructure",
  description: "Table custom_field_definitions",
  file: "extensions.ts",
  fieldCount: 3,
  keyFields: "bizId, bizExtensionInstallId, locationId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "customFieldValues",
  tableName: "custom_field_values",
  domain: "CoreInfrastructure",
  description: "Table custom_field_values",
  file: "extensions.ts",
  fieldCount: 2,
  keyFields: "bizId, customFieldDefinitionId"
})

CREATE (:PaymentsDomain:Entity {
  name: "dataResidencyPolicies",
  tableName: "data_residency_policies",
  domain: "Payments",
  description: "Table data_residency_policies",
  file: "governance.ts",
  fieldCount: 2,
  keyFields: "bizId, complianceProfileId"
})

CREATE (:Governance&ComplianceDomain:Entity {
  name: "dataSubjectRequests",
  tableName: "data_subject_requests",
  domain: "Governance&Compliance",
  description: "Table data_subject_requests",
  file: "governance.ts",
  fieldCount: 2,
  keyFields: "bizId, subjectUserId"
})

CREATE (:CatalogDomain:Entity {
  name: "demandPricingApplications",
  tableName: "demand_pricing_applications",
  domain: "Catalog",
  description: "Table demand_pricing_applications",
  file: "demand_pricing.ts",
  fieldCount: 4,
  keyFields: "bizId, demandPricingEvaluationId, bookingOrderId, bookingOrderLineId"
})

CREATE (:CatalogDomain:Entity {
  name: "demandPricingEvaluations",
  tableName: "demand_pricing_evaluations",
  domain: "Catalog",
  description: "Table demand_pricing_evaluations",
  file: "demand_pricing.ts",
  fieldCount: 5,
  keyFields: "bizId, demandPricingPolicyId, demandPricingPolicyTierId, bookingOrderId, bookingOrderLineId"
})

CREATE (:CatalogDomain:Entity {
  name: "demandPricingPolicies",
  tableName: "demand_pricing_policies",
  domain: "Catalog",
  description: "Table demand_pricing_policies",
  file: "demand_pricing.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CatalogDomain:Entity {
  name: "demandPricingPolicySignals",
  tableName: "demand_pricing_policy_signals",
  domain: "Catalog",
  description: "Table demand_pricing_policy_signals",
  file: "demand_pricing.ts",
  fieldCount: 3,
  keyFields: "bizId, demandPricingPolicyId, demandSignalDefinitionId"
})

CREATE (:CatalogDomain:Entity {
  name: "demandPricingPolicyTiers",
  tableName: "demand_pricing_policy_tiers",
  domain: "Catalog",
  description: "Table demand_pricing_policy_tiers",
  file: "demand_pricing.ts",
  fieldCount: 2,
  keyFields: "bizId, demandPricingPolicyId"
})

CREATE (:CatalogDomain:Entity {
  name: "demandSignalDefinitions",
  tableName: "demand_signal_definitions",
  domain: "Catalog",
  description: "Table demand_signal_definitions",
  file: "demand_pricing.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CatalogDomain:Entity {
  name: "demandSignalObservations",
  tableName: "demand_signal_observations",
  domain: "Catalog",
  description: "Table demand_signal_observations",
  file: "demand_pricing.ts",
  fieldCount: 2,
  keyFields: "bizId, demandSignalDefinitionId"
})

CREATE (:Marketing&CRMDomain:Entity {
  name: "discountCampaigns",
  tableName: "discount_campaigns",
  domain: "Marketing&CRM",
  description: "Table discount_campaigns",
  file: "promotions.ts",
  fieldCount: 2,
  keyFields: "bizId, bizExtensionInstallId"
})

CREATE (:GiftsDomain:Entity {
  name: "discountCodes",
  tableName: "discount_codes",
  domain: "Gifts",
  description: "Table discount_codes",
  file: "promotions.ts",
  fieldCount: 2,
  keyFields: "bizId, discountCampaignId"
})

CREATE (:GiftsDomain:Entity {
  name: "discountRedemptions",
  tableName: "discount_redemptions",
  domain: "Gifts",
  description: "Table discount_redemptions",
  file: "promotions.ts",
  fieldCount: 6,
  keyFields: "bizId, discountCampaignId, discountCodeId, bookingOrderId, bookingOrderLineId, customerUserId"
})

CREATE (:OperationsDomain:Entity {
  name: "dispatchTasks",
  tableName: "dispatch_tasks",
  domain: "Operations",
  description: "Table dispatch_tasks",
  file: "transportation.ts",
  fieldCount: 3,
  keyFields: "bizId, tripId, assignedResourceId"
})

CREATE (:Enterprise&B2BDomain:Entity {
  name: "eligibilitySnapshots",
  tableName: "eligibility_snapshots",
  domain: "Enterprise&B2B",
  description: "Table eligibility_snapshots",
  file: "payer_eligibility.ts",
  fieldCount: 4,
  keyFields: "bizId, payerAuthorizationId, memberUserId, memberGroupAccountId"
})

CREATE (:Enterprise&B2BDomain:Entity {
  name: "enterpriseAdminDelegations",
  tableName: "enterprise_admin_delegations",
  domain: "Enterprise&B2B",
  description: "Table enterprise_admin_delegations",
  file: "enterprise.ts",
  fieldCount: 3,
  keyFields: "bizId, delegatorUserId, delegateUserId"
})

CREATE (:IdentityDomain:Entity {
  name: "enterpriseApprovalAuthorityLimits",
  tableName: "enterprise_approval_authority_limits",
  domain: "Identity",
  description: "Table enterprise_approval_authority_limits",
  file: "enterprise.ts",
  fieldCount: 2,
  keyFields: "bizId, userId"
})

CREATE (:Enterprise&B2BDomain:Entity {
  name: "enterpriseChangeRolloutResults",
  tableName: "enterprise_change_rollout_results",
  domain: "Enterprise&B2B",
  description: "Table enterprise_change_rollout_results",
  file: "enterprise.ts",
  fieldCount: 2,
  keyFields: "bizId, rolloutTargetId"
})

CREATE (:Enterprise&B2BDomain:Entity {
  name: "enterpriseChangeRolloutRuns",
  tableName: "enterprise_change_rollout_runs",
  domain: "Enterprise&B2B",
  description: "Table enterprise_change_rollout_runs",
  file: "enterprise.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:PaymentsDomain:Entity {
  name: "enterpriseChangeRolloutTargets",
  tableName: "enterprise_change_rollout_targets",
  domain: "Payments",
  description: "Table enterprise_change_rollout_targets",
  file: "enterprise.ts",
  fieldCount: 3,
  keyFields: "bizId, rolloutRunId, scopeId"
})

CREATE (:Enterprise&B2BDomain:Entity {
  name: "enterpriseContractPackBindings",
  tableName: "enterprise_contract_pack_bindings",
  domain: "Enterprise&B2B",
  description: "Table enterprise_contract_pack_bindings",
  file: "enterprise.ts",
  fieldCount: 3,
  keyFields: "bizId, contractPackVersionId, scopeId"
})

CREATE (:Enterprise&B2BDomain:Entity {
  name: "enterpriseContractPackTemplates",
  tableName: "enterprise_contract_pack_templates",
  domain: "Enterprise&B2B",
  description: "Table enterprise_contract_pack_templates",
  file: "enterprise.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:Enterprise&B2BDomain:Entity {
  name: "enterpriseContractPackVersions",
  tableName: "enterprise_contract_pack_versions",
  domain: "Enterprise&B2B",
  description: "Table enterprise_contract_pack_versions",
  file: "enterprise.ts",
  fieldCount: 2,
  keyFields: "bizId, contractPackTemplateId"
})

CREATE (:Enterprise&B2BDomain:Entity {
  name: "enterpriseExternalDirectoryLinks",
  tableName: "enterprise_external_directory_links",
  domain: "Enterprise&B2B",
  description: "Table enterprise_external_directory_links",
  file: "enterprise.ts",
  fieldCount: 2,
  keyFields: "bizId, identityProviderId"
})

CREATE (:Enterprise&B2BDomain:Entity {
  name: "enterpriseIdentityProviders",
  tableName: "enterprise_identity_providers",
  domain: "Enterprise&B2B",
  description: "Table enterprise_identity_providers",
  file: "enterprise.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:Enterprise&B2BDomain:Entity {
  name: "enterpriseInheritanceResolutions",
  tableName: "enterprise_inheritance_resolutions",
  domain: "Enterprise&B2B",
  description: "Table enterprise_inheritance_resolutions",
  file: "enterprise.ts",
  fieldCount: 3,
  keyFields: "bizId, strategyId, scopeId"
})

CREATE (:Enterprise&B2BDomain:Entity {
  name: "enterpriseInheritanceStrategies",
  tableName: "enterprise_inheritance_strategies",
  domain: "Enterprise&B2B",
  description: "Table enterprise_inheritance_strategies",
  file: "enterprise.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:IdentityDomain:Entity {
  name: "enterpriseIntercompanyAccounts",
  tableName: "enterprise_intercompany_accounts",
  domain: "Identity",
  description: "Table enterprise_intercompany_accounts",
  file: "enterprise.ts",
  fieldCount: 3,
  keyFields: "bizId, sourceBizId, counterpartyBizId"
})

CREATE (:Enterprise&B2BDomain:Entity {
  name: "enterpriseIntercompanyEntries",
  tableName: "enterprise_intercompany_entries",
  domain: "Enterprise&B2B",
  description: "Table enterprise_intercompany_entries",
  file: "enterprise.ts",
  fieldCount: 3,
  keyFields: "bizId, intercompanyAccountId, settlementRunId"
})

CREATE (:Enterprise&B2BDomain:Entity {
  name: "enterpriseIntercompanySettlementRuns",
  tableName: "enterprise_intercompany_settlement_runs",
  domain: "Enterprise&B2B",
  description: "Table enterprise_intercompany_settlement_runs",
  file: "enterprise.ts",
  fieldCount: 2,
  keyFields: "bizId, intercompanyAccountId"
})

CREATE (:Enterprise&B2BDomain:Entity {
  name: "enterpriseRelationshipTemplates",
  tableName: "enterprise_relationship_templates",
  domain: "Enterprise&B2B",
  description: "Table enterprise_relationship_templates",
  file: "enterprise.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:Enterprise&B2BDomain:Entity {
  name: "enterpriseRelationships",
  tableName: "enterprise_relationships",
  domain: "Enterprise&B2B",
  description: "Table enterprise_relationships",
  file: "enterprise.ts",
  fieldCount: 4,
  keyFields: "bizId, relationshipTemplateId, fromBizId, toBizId"
})

CREATE (:Enterprise&B2BDomain:Entity {
  name: "enterpriseScimSyncStates",
  tableName: "enterprise_scim_sync_states",
  domain: "Enterprise&B2B",
  description: "Table enterprise_scim_sync_states",
  file: "enterprise.ts",
  fieldCount: 2,
  keyFields: "bizId, identityProviderId"
})

CREATE (:Enterprise&B2BDomain:Entity {
  name: "enterpriseScopes",
  tableName: "enterprise_scopes",
  domain: "Enterprise&B2B",
  description: "Table enterprise_scopes",
  file: "enterprise.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:AccessControlDomain:Entity {
  name: "entitlementGrants",
  tableName: "entitlement_grants",
  domain: "AccessControl",
  description: "Table entitlement_grants",
  file: "entitlements.ts",
  fieldCount: 4,
  keyFields: "bizId, walletId, membershipId, bookingOrderId"
})

CREATE (:AccessControlDomain:Entity {
  name: "entitlementLedgerEntries",
  tableName: "entitlement_ledger_entries",
  domain: "AccessControl",
  description: "Table entitlement_ledger_entries",
  file: "entitlements.ts",
  fieldCount: 6,
  keyFields: "bizId, walletId, grantId, transferId, bookingOrderId, fulfillmentUnitId"
})

CREATE (:AccessControlDomain:Entity {
  name: "entitlementTransfers",
  tableName: "entitlement_transfers",
  domain: "AccessControl",
  description: "Table entitlement_transfers",
  file: "entitlements.ts",
  fieldCount: 5,
  keyFields: "bizId, fromWalletId, toWalletId, requestedByUserId, reviewedByUserId"
})

CREATE (:AccessControlDomain:Entity {
  name: "entitlementWallets",
  tableName: "entitlement_wallets",
  domain: "AccessControl",
  description: "Table entitlement_wallets",
  file: "entitlements.ts",
  fieldCount: 4,
  keyFields: "bizId, membershipId, ownerUserId, ownerGroupAccountId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "etaEvents",
  tableName: "eta_events",
  domain: "CoreInfrastructure",
  description: "Table eta_events",
  file: "transportation.ts",
  fieldCount: 3,
  keyFields: "bizId, tripId, routeStopId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "extensionApiCallRuns",
  tableName: "extension_api_call_runs",
  domain: "CoreInfrastructure",
  description: "Table extension_api_call_runs",
  file: "extensions.ts",
  fieldCount: 2,
  keyFields: "bizId, extensionServiceConnectionId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "extensionDefinitions",
  tableName: "extension_definitions",
  domain: "CoreInfrastructure",
  description: "Table extension_definitions",
  file: "extensions.ts",
  fieldCount: 0,
  keyFields: "id"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "extensionInstances",
  tableName: "extension_instances",
  domain: "CoreInfrastructure",
  description: "Table extension_instances",
  file: "extensions.ts",
  fieldCount: 2,
  keyFields: "bizId, extensionDefinitionId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "extensionPermissionDefinitions",
  tableName: "extension_permission_definitions",
  domain: "CoreInfrastructure",
  description: "Table extension_permission_definitions",
  file: "extensions.ts",
  fieldCount: 1,
  keyFields: "extensionDefinitionId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "extensionServiceConnections",
  tableName: "extension_service_connections",
  domain: "CoreInfrastructure",
  description: "Table extension_service_connections",
  file: "extensions.ts",
  fieldCount: 2,
  keyFields: "bizId, bizExtensionInstallId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "extensionServiceObjectLinks",
  tableName: "extension_service_object_links",
  domain: "CoreInfrastructure",
  description: "Table extension_service_object_links",
  file: "extensions.ts",
  fieldCount: 2,
  keyFields: "bizId, extensionServiceConnectionId"
})

CREATE (:CatalogDomain:Entity {
  name: "extensionServiceSyncItems",
  tableName: "extension_service_sync_items",
  domain: "Catalog",
  description: "Table extension_service_sync_items",
  file: "extensions.ts",
  fieldCount: 3,
  keyFields: "bizId, extensionServiceSyncJobId, extensionServiceObjectLinkId"
})

CREATE (:CatalogDomain:Entity {
  name: "extensionServiceSyncJobs",
  tableName: "extension_service_sync_jobs",
  domain: "Catalog",
  description: "Table extension_service_sync_jobs",
  file: "extensions.ts",
  fieldCount: 2,
  keyFields: "bizId, extensionServiceConnectionId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "extensionStateDocuments",
  tableName: "extension_state_documents",
  domain: "CoreInfrastructure",
  description: "Table extension_state_documents",
  file: "extensions.ts",
  fieldCount: 2,
  keyFields: "bizId, bizExtensionInstallId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "extensionWebhookIngressEvents",
  tableName: "extension_webhook_ingress_events",
  domain: "CoreInfrastructure",
  description: "Table extension_webhook_ingress_events",
  file: "extensions.ts",
  fieldCount: 2,
  keyFields: "bizId, extensionServiceConnectionId"
})

CREATE (:PaymentsDomain:Entity {
  name: "externalCalendarEvents",
  tableName: "external_calendar_events",
  domain: "Payments",
  description: "Table external_calendar_events",
  file: "calendar_sync.ts",
  fieldCount: 2,
  keyFields: "ownerUserId, externalCalendarId"
})

CREATE (:SupplyDomain:Entity {
  name: "externalCalendars",
  tableName: "external_calendars",
  domain: "Supply",
  description: "Table external_calendars",
  file: "calendar_sync.ts",
  fieldCount: 2,
  keyFields: "ownerUserId, calendarSyncConnectionId"
})

CREATE (:Enterprise&B2BDomain:Entity {
  name: "factEnterpriseComplianceDaily",
  tableName: "fact_enterprise_compliance_daily",
  domain: "Enterprise&B2B",
  description: "Table fact_enterprise_compliance_daily",
  file: "enterprise.ts",
  fieldCount: 2,
  keyFields: "bizId, memberBizId"
})

CREATE (:Enterprise&B2BDomain:Entity {
  name: "factEnterpriseRevenueDaily",
  tableName: "fact_enterprise_revenue_daily",
  domain: "Enterprise&B2B",
  description: "Table fact_enterprise_revenue_daily",
  file: "enterprise.ts",
  fieldCount: 2,
  keyFields: "bizId, memberBizId"
})

CREATE (:Enterprise&B2BDomain:Entity {
  name: "factEnterpriseUtilizationDaily",
  tableName: "fact_enterprise_utilization_daily",
  domain: "Enterprise&B2B",
  description: "Table fact_enterprise_utilization_daily",
  file: "enterprise.ts",
  fieldCount: 2,
  keyFields: "bizId, memberBizId"
})

CREATE (:Intelligence&AnalyticsDomain:Entity {
  name: "factOperationalDaily",
  tableName: "fact_operational_daily",
  domain: "Intelligence&Analytics",
  description: "Table fact_operational_daily",
  file: "reporting.ts",
  fieldCount: 2,
  keyFields: "bizId, locationId"
})

CREATE (:Intelligence&AnalyticsDomain:Entity {
  name: "factRefreshRuns",
  tableName: "fact_refresh_runs",
  domain: "Intelligence&Analytics",
  description: "Table fact_refresh_runs",
  file: "reporting.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:Intelligence&AnalyticsDomain:Entity {
  name: "factResourceUtilizationDaily",
  tableName: "fact_resource_utilization_daily",
  domain: "Intelligence&Analytics",
  description: "Table fact_resource_utilization_daily",
  file: "reporting.ts",
  fieldCount: 2,
  keyFields: "bizId, resourceId"
})

CREATE (:Intelligence&AnalyticsDomain:Entity {
  name: "factRevenueDaily",
  tableName: "fact_revenue_daily",
  domain: "Intelligence&Analytics",
  description: "Table fact_revenue_daily",
  file: "reporting.ts",
  fieldCount: 2,
  keyFields: "bizId, locationId"
})

CREATE (:Intelligence&AnalyticsDomain:Entity {
  name: "factRevenueMonthly",
  tableName: "fact_revenue_monthly",
  domain: "Intelligence&Analytics",
  description: "Table fact_revenue_monthly",
  file: "reporting.ts",
  fieldCount: 2,
  keyFields: "bizId, locationId"
})

CREATE (:Intelligence&AnalyticsDomain:Entity {
  name: "factSellableDaily",
  tableName: "fact_sellable_daily",
  domain: "Intelligence&Analytics",
  description: "Table fact_sellable_daily",
  file: "reporting.ts",
  fieldCount: 2,
  keyFields: "bizId, sellableId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "fleetVehicles",
  tableName: "fleet_vehicles",
  domain: "CoreInfrastructure",
  description: "Table fleet_vehicles",
  file: "transportation.ts",
  fieldCount: 2,
  keyFields: "bizId, resourceId"
})

CREATE (:BookingsDomain:Entity {
  name: "fulfillmentAssignmentEvents",
  tableName: "fulfillment_assignment_events",
  domain: "Bookings",
  description: "Table fulfillment_assignment_events",
  file: "fulfillment.ts",
  fieldCount: 4,
  keyFields: "bizId, fulfillmentAssignmentId, previousResourceId, nextResourceId"
})

CREATE (:BookingsDomain:Entity {
  name: "fulfillmentAssignments",
  tableName: "fulfillment_assignments",
  domain: "Bookings",
  description: "Table fulfillment_assignments",
  file: "fulfillment.ts",
  fieldCount: 4,
  keyFields: "bizId, fulfillmentUnitId, resourceId, statusConfigValueId"
})

CREATE (:BookingsDomain:Entity {
  name: "fulfillmentCheckpoints",
  tableName: "fulfillment_checkpoints",
  domain: "Bookings",
  description: "Table fulfillment_checkpoints",
  file: "fulfillment.ts",
  fieldCount: 3,
  keyFields: "bizId, fulfillmentUnitId, statusConfigValueId"
})

CREATE (:BookingsDomain:Entity {
  name: "fulfillmentDependencies",
  tableName: "fulfillment_dependencies",
  domain: "Bookings",
  description: "Table fulfillment_dependencies",
  file: "fulfillment.ts",
  fieldCount: 3,
  keyFields: "bizId, predecessorUnitId, successorUnitId"
})

CREATE (:BookingsDomain:Entity {
  name: "fulfillmentTransferEvents",
  tableName: "fulfillment_transfer_events",
  domain: "Bookings",
  description: "Table fulfillment_transfer_events",
  file: "fulfillment_transfers.ts",
  fieldCount: 2,
  keyFields: "bizId, fulfillmentTransferRequestId"
})

CREATE (:BookingsDomain:Entity {
  name: "fulfillmentTransferRequests",
  tableName: "fulfillment_transfer_requests",
  domain: "Bookings",
  description: "Table fulfillment_transfer_requests",
  file: "fulfillment_transfers.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:BookingsDomain:Entity {
  name: "fulfillmentUnits",
  tableName: "fulfillment_units",
  domain: "Bookings",
  description: "Table fulfillment_units",
  file: "fulfillment.ts",
  fieldCount: 4,
  keyFields: "bizId, bookingOrderId, offerComponentId, statusConfigValueId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "fxRateSnapshots",
  tableName: "fx_rate_snapshots",
  domain: "CoreInfrastructure",
  description: "Table fx_rate_snapshots",
  file: "tax_fx.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:BookingsDomain:Entity {
  name: "giftDeliveryAttempts",
  tableName: "gift_delivery_attempts",
  domain: "Bookings",
  description: "Table gift_delivery_attempts",
  file: "gift_delivery.ts",
  fieldCount: 2,
  keyFields: "bizId, giftDeliveryScheduleId"
})

CREATE (:BookingsDomain:Entity {
  name: "giftDeliverySchedules",
  tableName: "gift_delivery_schedules",
  domain: "Bookings",
  description: "Table gift_delivery_schedules",
  file: "gift_delivery.ts",
  fieldCount: 2,
  keyFields: "bizId, giftInstrumentId"
})

CREATE (:GiftsDomain:Entity {
  name: "giftExpirationEvents",
  tableName: "gift_expiration_events",
  domain: "Gifts",
  description: "Table gift_expiration_events",
  file: "gifts.ts",
  fieldCount: 2,
  keyFields: "bizId, giftInstrumentId"
})

CREATE (:GiftsDomain:Entity {
  name: "giftInstrumentLedgerEntries",
  tableName: "gift_instrument_ledger_entries",
  domain: "Gifts",
  description: "Table gift_instrument_ledger_entries",
  file: "gifts.ts",
  fieldCount: 2,
  keyFields: "bizId, giftInstrumentId"
})

CREATE (:GiftsDomain:Entity {
  name: "giftInstruments",
  tableName: "gift_instruments",
  domain: "Gifts",
  description: "Table gift_instruments",
  file: "gifts.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:GiftsDomain:Entity {
  name: "giftRedemptions",
  tableName: "gift_redemptions",
  domain: "Gifts",
  description: "Table gift_redemptions",
  file: "gifts.ts",
  fieldCount: 7,
  keyFields: "bizId, giftInstrumentId, bookingOrderId, bookingOrderLineId, paymentIntentId, paymentIntentTenderId, paymentTransactionId"
})

CREATE (:GiftsDomain:Entity {
  name: "giftTransfers",
  tableName: "gift_transfers",
  domain: "Gifts",
  description: "Table gift_transfers",
  file: "gifts.ts",
  fieldCount: 7,
  keyFields: "bizId, giftInstrumentId, targetGiftInstrumentId, fromUserId, fromGroupAccountId, toUserId, toGroupAccountId"
})

CREATE (:Education&LearningDomain:Entity {
  name: "gradingEvents",
  tableName: "grading_events",
  domain: "Education&Learning",
  description: "Table grading_events",
  file: "assessments.ts",
  fieldCount: 4,
  keyFields: "bizId, assessmentAttemptId, assessmentTemplateId, assessmentResponseId"
})

CREATE (:SocialDomain:Entity {
  name: "graphAudienceSegmentMembers",
  tableName: "graph_audience_segment_members",
  domain: "Social",
  description: "Table graph_audience_segment_members",
  file: "social_graph.ts",
  fieldCount: 2,
  keyFields: "segmentId, memberIdentityId"
})

CREATE (:SocialDomain:Entity {
  name: "graphAudienceSegments",
  tableName: "graph_audience_segments",
  domain: "Social",
  description: "Table graph_audience_segments",
  file: "social_graph.ts",
  fieldCount: 1,
  keyFields: "ownerIdentityId"
})

CREATE (:SocialDomain:Entity {
  name: "graphFeedItemAudienceRules",
  tableName: "graph_feed_item_audience_rules",
  domain: "Social",
  description: "Table graph_feed_item_audience_rules",
  file: "social_graph.ts",
  fieldCount: 1,
  keyFields: "feedItemId"
})

CREATE (:SocialDomain:Entity {
  name: "graphFeedItemDeliveries",
  tableName: "graph_feed_item_deliveries",
  domain: "Social",
  description: "Table graph_feed_item_deliveries",
  file: "social_graph.ts",
  fieldCount: 2,
  keyFields: "feedItemId, viewerIdentityId"
})

CREATE (:SocialDomain:Entity {
  name: "graphFeedItemLinks",
  tableName: "graph_feed_item_links",
  domain: "Social",
  description: "Table graph_feed_item_links",
  file: "social_graph.ts",
  fieldCount: 1,
  keyFields: "feedItemId"
})

CREATE (:SocialDomain:Entity {
  name: "graphFeedItems",
  tableName: "graph_feed_items",
  domain: "Social",
  description: "Table graph_feed_items",
  file: "social_graph.ts",
  fieldCount: 2,
  keyFields: "ownerIdentityId, contextBizId"
})

CREATE (:SocialDomain:Entity {
  name: "graphIdentities",
  tableName: "graph_identities",
  domain: "Social",
  description: "Table graph_identities",
  file: "social_graph.ts",
  fieldCount: 0,
  keyFields: "id"
})

CREATE (:SocialDomain:Entity {
  name: "graphIdentityNotificationEndpoints",
  tableName: "graph_identity_notification_endpoints",
  domain: "Social",
  description: "Table graph_identity_notification_endpoints",
  file: "social_graph.ts",
  fieldCount: 2,
  keyFields: "ownerIdentityId, bizId"
})

CREATE (:SocialDomain:Entity {
  name: "graphIdentityPolicies",
  tableName: "graph_identity_policies",
  domain: "Social",
  description: "Table graph_identity_policies",
  file: "social_graph.ts",
  fieldCount: 1,
  keyFields: "identityId"
})

CREATE (:SocialDomain:Entity {
  name: "graphRelationshipEvents",
  tableName: "graph_relationship_events",
  domain: "Social",
  description: "Table graph_relationship_events",
  file: "social_graph.ts",
  fieldCount: 1,
  keyFields: "relationshipId"
})

CREATE (:SocialDomain:Entity {
  name: "graphRelationships",
  tableName: "graph_relationships",
  domain: "Social",
  description: "Table graph_relationships",
  file: "social_graph.ts",
  fieldCount: 2,
  keyFields: "fromIdentityId, toIdentityId"
})

CREATE (:SocialDomain:Entity {
  name: "graphSubjectEventDeliveries",
  tableName: "graph_subject_event_deliveries",
  domain: "Social",
  description: "Table graph_subject_event_deliveries",
  file: "social_graph.ts",
  fieldCount: 5,
  keyFields: "bizId, subjectEventId, subscriptionId, subscriberIdentityId, endpointId"
})

CREATE (:SocialDomain:Entity {
  name: "graphSubjectEvents",
  tableName: "graph_subject_events",
  domain: "Social",
  description: "Table graph_subject_events",
  file: "social_graph.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:SocialDomain:Entity {
  name: "graphSubjectSubscriptions",
  tableName: "graph_subject_subscriptions",
  domain: "Social",
  description: "Table graph_subject_subscriptions",
  file: "social_graph.ts",
  fieldCount: 2,
  keyFields: "subscriberIdentityId, targetSubjectBizId"
})

CREATE (:IdentityDomain:Entity {
  name: "groupAccountMembers",
  tableName: "group_account_members",
  domain: "Identity",
  description: "Table group_account_members",
  file: "group_accounts.ts",
  fieldCount: 3,
  keyFields: "bizId, groupAccountId, userId"
})

CREATE (:IdentityDomain:Entity {
  name: "groupAccounts",
  tableName: "group_accounts",
  domain: "Identity",
  description: "Table group_accounts",
  file: "group_accounts.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:IdentityDomain:Entity {
  name: "hipaaAuthorizations",
  tableName: "hipaa_authorizations",
  domain: "Identity",
  description: "Table hipaa_authorizations",
  file: "hipaa.ts",
  fieldCount: 4,
  keyFields: "bizId, complianceProfileId, subjectUserId, subjectGroupAccountId"
})

CREATE (:SupplyDomain:Entity {
  name: "hostGroupMembers",
  tableName: "host_group_members",
  domain: "Supply",
  description: "Table host_group_members",
  file: "resources.ts",
  fieldCount: 3,
  keyFields: "bizId, hostGroupId, userId"
})

CREATE (:SupplyDomain:Entity {
  name: "hostGroups",
  tableName: "host_groups",
  domain: "Supply",
  description: "Table host_groups",
  file: "resources.ts",
  fieldCount: 3,
  keyFields: "bizId, resourceId, groupAccountId"
})

CREATE (:IdentityDomain:Entity {
  name: "hostUsers",
  tableName: "host_users",
  domain: "Identity",
  description: "Table host_users",
  file: "resources.ts",
  fieldCount: 3,
  keyFields: "bizId, resourceId, userId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "idempotencyKeys",
  tableName: "idempotency_keys",
  domain: "CoreInfrastructure",
  description: "Table idempotency_keys",
  file: "extensions.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "installmentPlans",
  tableName: "installment_plans",
  domain: "CoreInfrastructure",
  description: "Table installment_plans",
  file: "receivables.ts",
  fieldCount: 2,
  keyFields: "bizId, arInvoiceId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "installmentScheduleItems",
  tableName: "installment_schedule_items",
  domain: "CoreInfrastructure",
  description: "Table installment_schedule_items",
  file: "receivables.ts",
  fieldCount: 2,
  keyFields: "bizId, installmentPlanId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "interactionAssignments",
  tableName: "interaction_assignments",
  domain: "CoreInfrastructure",
  description: "Table interaction_assignments",
  file: "interaction_forms.ts",
  fieldCount: 2,
  keyFields: "bizId, interactionTemplateId"
})

CREATE (:PaymentsDomain:Entity {
  name: "interactionSubmissionArtifacts",
  tableName: "interaction_submission_artifacts",
  domain: "Payments",
  description: "Table interaction_submission_artifacts",
  file: "interaction_forms.ts",
  fieldCount: 2,
  keyFields: "bizId, interactionSubmissionId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "interactionSubmissionSignatures",
  tableName: "interaction_submission_signatures",
  domain: "CoreInfrastructure",
  description: "Table interaction_submission_signatures",
  file: "interaction_forms.ts",
  fieldCount: 3,
  keyFields: "bizId, interactionSubmissionId, signerUserId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "interactionSubmissions",
  tableName: "interaction_submissions",
  domain: "CoreInfrastructure",
  description: "Table interaction_submissions",
  file: "interaction_forms.ts",
  fieldCount: 3,
  keyFields: "bizId, interactionAssignmentId, statusConfigValueId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "interactionTemplateBindings",
  tableName: "interaction_template_bindings",
  domain: "CoreInfrastructure",
  description: "Table interaction_template_bindings",
  file: "interaction_forms.ts",
  fieldCount: 2,
  keyFields: "bizId, interactionTemplateId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "interactionTemplates",
  tableName: "interaction_templates",
  domain: "CoreInfrastructure",
  description: "Table interaction_templates",
  file: "interaction_forms.ts",
  fieldCount: 3,
  keyFields: "bizId, bizExtensionInstallId, templateTypeConfigValueId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "inventoryItems",
  tableName: "inventory_items",
  domain: "CoreInfrastructure",
  description: "Table inventory_items",
  file: "product_commerce.ts",
  fieldCount: 3,
  keyFields: "bizId, inventoryLocationId, productId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "inventoryLocations",
  tableName: "inventory_locations",
  domain: "CoreInfrastructure",
  description: "Table inventory_locations",
  file: "product_commerce.ts",
  fieldCount: 2,
  keyFields: "bizId, locationId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "inventoryMovements",
  tableName: "inventory_movements",
  domain: "CoreInfrastructure",
  description: "Table inventory_movements",
  file: "product_commerce.ts",
  fieldCount: 2,
  keyFields: "bizId, inventoryItemId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "inventoryReservations",
  tableName: "inventory_reservations",
  domain: "CoreInfrastructure",
  description: "Table inventory_reservations",
  file: "product_commerce.ts",
  fieldCount: 5,
  keyFields: "bizId, inventoryItemId, bookingOrderId, bookingOrderLineId, fulfillmentUnitId"
})

CREATE (:PaymentsDomain:Entity {
  name: "invoiceEvents",
  tableName: "invoice_events",
  domain: "Payments",
  description: "Table invoice_events",
  file: "ar.ts",
  fieldCount: 2,
  keyFields: "bizId, arInvoiceId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "leaveBalances",
  tableName: "leave_balances",
  domain: "CoreInfrastructure",
  description: "Table leave_balances",
  file: "leave.ts",
  fieldCount: 3,
  keyFields: "bizId, leavePolicyId, resourceId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "leaveEvents",
  tableName: "leave_events",
  domain: "CoreInfrastructure",
  description: "Table leave_events",
  file: "leave.ts",
  fieldCount: 4,
  keyFields: "bizId, leavePolicyId, resourceId, leaveRequestId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "leavePolicies",
  tableName: "leave_policies",
  domain: "CoreInfrastructure",
  description: "Table leave_policies",
  file: "leave.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "leaveRequests",
  tableName: "leave_requests",
  domain: "CoreInfrastructure",
  description: "Table leave_requests",
  file: "leave.ts",
  fieldCount: 5,
  keyFields: "bizId, leavePolicyId, resourceId, requesterUserId, approverUserId"
})

CREATE (:Governance&ComplianceDomain:Entity {
  name: "legalHolds",
  tableName: "legal_holds",
  domain: "Governance&Compliance",
  description: "Table legal_holds",
  file: "governance.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "lifecycleEventDeliveries",
  tableName: "lifecycle_event_deliveries",
  domain: "CoreInfrastructure",
  description: "Table lifecycle_event_deliveries",
  file: "extensions.ts",
  fieldCount: 3,
  keyFields: "bizId, lifecycleEventId, lifecycleEventSubscriptionId"
})

CREATE (:SocialDomain:Entity {
  name: "lifecycleEventSubscriptions",
  tableName: "lifecycle_event_subscriptions",
  domain: "Social",
  description: "Table lifecycle_event_subscriptions",
  file: "extensions.ts",
  fieldCount: 2,
  keyFields: "bizId, bizExtensionInstallId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "lifecycleEvents",
  tableName: "lifecycle_events",
  domain: "CoreInfrastructure",
  description: "Table lifecycle_events",
  file: "extensions.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "locations",
  tableName: "locations",
  domain: "CoreInfrastructure",
  description: "Table locations",
  file: "locations.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:IdentityDomain:Entity {
  name: "marketingAudienceSegmentMemberships",
  tableName: "marketing_audience_segment_memberships",
  domain: "Identity",
  description: "Table marketing_audience_segment_memberships",
  file: "marketing_performance.ts",
  fieldCount: 3,
  keyFields: "bizId, marketingAudienceSegmentId, memberCrmContactId"
})

CREATE (:PaymentsDomain:Entity {
  name: "marketingAudienceSegments",
  tableName: "marketing_audience_segments",
  domain: "Payments",
  description: "Table marketing_audience_segments",
  file: "marketing_performance.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:PaymentsDomain:Entity {
  name: "marketingAudienceSyncRuns",
  tableName: "marketing_audience_sync_runs",
  domain: "Payments",
  description: "Table marketing_audience_sync_runs",
  file: "marketing_performance.ts",
  fieldCount: 3,
  keyFields: "bizId, marketingAudienceSegmentId, channelAccountId"
})

CREATE (:PaymentsDomain:Entity {
  name: "marketingCampaignEnrollments",
  tableName: "marketing_campaign_enrollments",
  domain: "Payments",
  description: "Table marketing_campaign_enrollments",
  file: "communications.ts",
  fieldCount: 2,
  keyFields: "bizId, marketingCampaignId"
})

CREATE (:PaymentsDomain:Entity {
  name: "marketingCampaignSteps",
  tableName: "marketing_campaign_steps",
  domain: "Payments",
  description: "Table marketing_campaign_steps",
  file: "communications.ts",
  fieldCount: 2,
  keyFields: "bizId, marketingCampaignId"
})

CREATE (:PaymentsDomain:Entity {
  name: "marketingCampaigns",
  tableName: "marketing_campaigns",
  domain: "Payments",
  description: "Table marketing_campaigns",
  file: "communications.ts",
  fieldCount: 2,
  keyFields: "bizId, bizExtensionInstallId"
})

CREATE (:PaymentsDomain:Entity {
  name: "marketplaceListings",
  tableName: "marketplace_listings",
  domain: "Payments",
  description: "Table marketplace_listings",
  file: "marketplace.ts",
  fieldCount: 3,
  keyFields: "bizId, offerVersionId, resourceId"
})

CREATE (:AccessControlDomain:Entity {
  name: "membershipPlans",
  tableName: "membership_plans",
  domain: "AccessControl",
  description: "Table membership_plans",
  file: "entitlements.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:IdentityDomain:Entity {
  name: "memberships",
  tableName: "memberships",
  domain: "Identity",
  description: "Table memberships",
  file: "entitlements.ts",
  fieldCount: 4,
  keyFields: "bizId, membershipPlanId, ownerUserId, ownerGroupAccountId"
})

CREATE (:SocialDomain:Entity {
  name: "messageTemplateBindings",
  tableName: "message_template_bindings",
  domain: "Social",
  description: "Table message_template_bindings",
  file: "communications.ts",
  fieldCount: 2,
  keyFields: "bizId, messageTemplateId"
})

CREATE (:SocialDomain:Entity {
  name: "messageTemplates",
  tableName: "message_templates",
  domain: "Social",
  description: "Table message_templates",
  file: "communications.ts",
  fieldCount: 2,
  keyFields: "bizId, bizExtensionInstallId"
})

CREATE (:AccessControlDomain:Entity {
  name: "noteAccessOverrides",
  tableName: "note_access_overrides",
  domain: "AccessControl",
  description: "Table note_access_overrides",
  file: "notes.ts",
  fieldCount: 3,
  keyFields: "bizId, noteId, userId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "noteRevisions",
  tableName: "note_revisions",
  domain: "CoreInfrastructure",
  description: "Table note_revisions",
  file: "notes.ts",
  fieldCount: 3,
  keyFields: "bizId, noteId, editedByUserId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "notes",
  tableName: "notes",
  domain: "CoreInfrastructure",
  description: "Table notes",
  file: "notes.ts",
  fieldCount: 9,
  keyFields: "bizId, bookingOrderId, fulfillmentUnitId, resourceId, offerId, offerVersionId, customerUserId, queueEntryId"
})

CREATE (:CatalogDomain:Entity {
  name: "offerComponentSeatTypes",
  tableName: "offer_component_seat_types",
  domain: "Catalog",
  description: "Table offer_component_seat_types",
  file: "offers.ts",
  fieldCount: 3,
  keyFields: "bizId, offerVersionId, componentId"
})

CREATE (:CatalogDomain:Entity {
  name: "offerComponentSelectors",
  tableName: "offer_component_selectors",
  domain: "Catalog",
  description: "Table offer_component_selectors",
  file: "offers.ts",
  fieldCount: 5,
  keyFields: "bizId, componentId, resourceId, capabilityTemplateId, locationId"
})

CREATE (:CatalogDomain:Entity {
  name: "offerComponents",
  tableName: "offer_components",
  domain: "Catalog",
  description: "Table offer_components",
  file: "offers.ts",
  fieldCount: 2,
  keyFields: "bizId, offerVersionId"
})

CREATE (:CatalogDomain:Entity {
  name: "offerVersionAdmissionModes",
  tableName: "offer_version_admission_modes",
  domain: "Catalog",
  description: "Table offer_version_admission_modes",
  file: "offers.ts",
  fieldCount: 3,
  keyFields: "bizId, offerVersionId, modeConfigValueId"
})

CREATE (:CatalogDomain:Entity {
  name: "offerVersions",
  tableName: "offer_versions",
  domain: "Catalog",
  description: "Table offer_versions",
  file: "offers.ts",
  fieldCount: 3,
  keyFields: "bizId, offerId, statusConfigValueId"
})

CREATE (:CatalogDomain:Entity {
  name: "offers",
  tableName: "offers",
  domain: "Catalog",
  description: "Table offers",
  file: "offers.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:PaymentsDomain:Entity {
  name: "offlineConversionPushes",
  tableName: "offline_conversion_pushes",
  domain: "Payments",
  description: "Table offline_conversion_pushes",
  file: "marketing_performance.ts",
  fieldCount: 2,
  keyFields: "bizId, channelAccountId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "offlineMergeConflicts",
  tableName: "offline_merge_conflicts",
  domain: "CoreInfrastructure",
  description: "Table offline_merge_conflicts",
  file: "offline.ts",
  fieldCount: 2,
  keyFields: "bizId, offlineOpJournalId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "offlineOpsJournal",
  tableName: "offline_ops_journal",
  domain: "CoreInfrastructure",
  description: "Table offline_ops_journal",
  file: "offline.ts",
  fieldCount: 2,
  keyFields: "bizId, actorUserId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "offlineResolutionEvents",
  tableName: "offline_resolution_events",
  domain: "CoreInfrastructure",
  description: "Table offline_resolution_events",
  file: "offline.ts",
  fieldCount: 3,
  keyFields: "bizId, offlineMergeConflictId, actorUserId"
})

CREATE (:OperationsDomain:Entity {
  name: "operationalAssignments",
  tableName: "operational_assignments",
  domain: "Operations",
  description: "Table operational_assignments",
  file: "operations_backbone.ts",
  fieldCount: 4,
  keyFields: "bizId, operationalDemandId, fulfillmentAssignmentId, staffingAssignmentId"
})

CREATE (:OperationsDomain:Entity {
  name: "operationalDemands",
  tableName: "operational_demands",
  domain: "Operations",
  description: "Table operational_demands",
  file: "operations_backbone.ts",
  fieldCount: 3,
  keyFields: "bizId, fulfillmentUnitId, staffingDemandId"
})

CREATE (:IdentityDomain:Entity {
  name: "orgMembershipLocations",
  tableName: "org_membership_locations",
  domain: "Identity",
  description: "Table org_membership_locations",
  file: "memberships.ts",
  fieldCount: 3,
  keyFields: "bizId, membershipId, locationId"
})

CREATE (:IdentityDomain:Entity {
  name: "orgMemberships",
  tableName: "org_memberships",
  domain: "Identity",
  description: "Table org_memberships",
  file: "memberships.ts",
  fieldCount: 2,
  keyFields: "bizId, userId"
})

CREATE (:SocialDomain:Entity {
  name: "outboundMessageEvents",
  tableName: "outbound_message_events",
  domain: "Social",
  description: "Table outbound_message_events",
  file: "communications.ts",
  fieldCount: 2,
  keyFields: "bizId, outboundMessageId"
})

CREATE (:SocialDomain:Entity {
  name: "outboundMessages",
  tableName: "outbound_messages",
  domain: "Social",
  description: "Table outbound_messages",
  file: "communications.ts",
  fieldCount: 7,
  keyFields: "bizId, messageTemplateId, lifecycleEventId, marketingCampaignId, marketingCampaignStepId, recipientUserId, recipientGroupAccountId"
})

CREATE (:Intelligence&AnalyticsDomain:Entity {
  name: "overtimeForecasts",
  tableName: "overtime_forecasts",
  domain: "Intelligence&Analytics",
  description: "Table overtime_forecasts",
  file: "intelligence.ts",
  fieldCount: 3,
  keyFields: "bizId, overtimePolicyId, resourceId"
})

CREATE (:Intelligence&AnalyticsDomain:Entity {
  name: "overtimePolicies",
  tableName: "overtime_policies",
  domain: "Intelligence&Analytics",
  description: "Table overtime_policies",
  file: "intelligence.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:PaymentsDomain:Entity {
  name: "participantObligationEvents",
  tableName: "participant_obligation_events",
  domain: "Payments",
  description: "Table participant_obligation_events",
  file: "participant_obligations.ts",
  fieldCount: 2,
  keyFields: "bizId, bookingParticipantObligationId"
})

CREATE (:IdentityDomain:Entity {
  name: "payerAuthorizations",
  tableName: "payer_authorizations",
  domain: "Identity",
  description: "Table payer_authorizations",
  file: "payer_eligibility.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:PaymentsDomain:Entity {
  name: "paymentDisputes",
  tableName: "payment_disputes",
  domain: "Payments",
  description: "Table payment_disputes",
  file: "payments.ts",
  fieldCount: 3,
  keyFields: "bizId, paymentTransactionId, paymentIntentId"
})

CREATE (:PaymentsDomain:Entity {
  name: "paymentIntentEvents",
  tableName: "payment_intent_events",
  domain: "Payments",
  description: "Table payment_intent_events",
  file: "payments.ts",
  fieldCount: 3,
  keyFields: "bizId, paymentIntentId, actorUserId"
})

CREATE (:PaymentsDomain:Entity {
  name: "paymentIntentLineAllocations",
  tableName: "payment_intent_line_allocations",
  domain: "Payments",
  description: "Table payment_intent_line_allocations",
  file: "payments.ts",
  fieldCount: 5,
  keyFields: "bizId, paymentIntentId, paymentIntentTenderId, bookingOrderId, bookingOrderLineId"
})

CREATE (:PaymentsDomain:Entity {
  name: "paymentIntentTenders",
  tableName: "payment_intent_tenders",
  domain: "Payments",
  description: "Table payment_intent_tenders",
  file: "payments.ts",
  fieldCount: 4,
  keyFields: "bizId, paymentIntentId, paymentMethodId, giftInstrumentId"
})

CREATE (:PaymentsDomain:Entity {
  name: "paymentIntents",
  tableName: "payment_intents",
  domain: "Payments",
  description: "Table payment_intents",
  file: "payments.ts",
  fieldCount: 4,
  keyFields: "bizId, bookingOrderId, crossBizOrderId, paymentProcessorAccountId"
})

CREATE (:PaymentsDomain:Entity {
  name: "paymentMethods",
  tableName: "payment_methods",
  domain: "Payments",
  description: "Table payment_methods",
  file: "payments.ts",
  fieldCount: 3,
  keyFields: "bizId, ownerUserId, paymentProcessorAccountId"
})

CREATE (:IdentityDomain:Entity {
  name: "paymentProcessorAccounts",
  tableName: "payment_processor_accounts",
  domain: "Identity",
  description: "Table payment_processor_accounts",
  file: "payments.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:PaymentsDomain:Entity {
  name: "paymentTransactionLineAllocations",
  tableName: "payment_transaction_line_allocations",
  domain: "Payments",
  description: "Table payment_transaction_line_allocations",
  file: "payments.ts",
  fieldCount: 7,
  keyFields: "bizId, paymentTransactionId, paymentIntentId, paymentIntentTenderId, bookingOrderId, bookingOrderLineId, paymentIntentLineAllocationId"
})

CREATE (:PaymentsDomain:Entity {
  name: "paymentTransactions",
  tableName: "payment_transactions",
  domain: "Payments",
  description: "Table payment_transactions",
  file: "payments.ts",
  fieldCount: 8,
  keyFields: "bizId, paymentIntentId, bookingOrderId, crossBizOrderId, paymentIntentTenderId, paymentMethodId, paymentProcessorAccountId, giftInstrumentId"
})

CREATE (:PaymentsDomain:Entity {
  name: "payoutLedgerEntries",
  tableName: "payout_ledger_entries",
  domain: "Payments",
  description: "Table payout_ledger_entries",
  file: "payments.ts",
  fieldCount: 3,
  keyFields: "bizId, payoutId, settlementEntryId"
})

CREATE (:PaymentsDomain:Entity {
  name: "payouts",
  tableName: "payouts",
  domain: "Payments",
  description: "Table payouts",
  file: "payments.ts",
  fieldCount: 3,
  keyFields: "bizId, settlementBatchId, paymentProcessorAccountId"
})

CREATE (:Governance&ComplianceDomain:Entity {
  name: "phiAccessEvents",
  tableName: "phi_access_events",
  domain: "Governance&Compliance",
  description: "Table phi_access_events",
  file: "hipaa.ts",
  fieldCount: 4,
  keyFields: "bizId, phiAccessPolicyId, hipaaAuthorizationId, actorUserId"
})

CREATE (:Governance&ComplianceDomain:Entity {
  name: "phiAccessPolicies",
  tableName: "phi_access_policies",
  domain: "Governance&Compliance",
  description: "Table phi_access_policies",
  file: "hipaa.ts",
  fieldCount: 2,
  keyFields: "bizId, complianceProfileId"
})

CREATE (:Governance&ComplianceDomain:Entity {
  name: "phiDisclosureEvents",
  tableName: "phi_disclosure_events",
  domain: "Governance&Compliance",
  description: "Table phi_disclosure_events",
  file: "hipaa.ts",
  fieldCount: 4,
  keyFields: "bizId, complianceProfileId, subjectUserId, subjectGroupAccountId"
})

CREATE (:BookingsDomain:Entity {
  name: "physicalFulfillmentItems",
  tableName: "physical_fulfillment_items",
  domain: "Bookings",
  description: "Table physical_fulfillment_items",
  file: "product_commerce.ts",
  fieldCount: 6,
  keyFields: "bizId, physicalFulfillmentId, productId, bookingOrderLineId, inventoryItemId, inventoryReservationId"
})

CREATE (:BookingsDomain:Entity {
  name: "physicalFulfillments",
  tableName: "physical_fulfillments",
  domain: "Bookings",
  description: "Table physical_fulfillments",
  file: "product_commerce.ts",
  fieldCount: 4,
  keyFields: "bizId, bookingOrderId, originInventoryLocationId, destinationLocationId"
})

CREATE (:Governance&ComplianceDomain:Entity {
  name: "policyBindings",
  tableName: "policy_bindings",
  domain: "Governance&Compliance",
  description: "Table policy_bindings",
  file: "governance.ts",
  fieldCount: 9,
  keyFields: "bizId, policyTemplateId, locationId, resourceId, serviceId, serviceProductId, offerId, offerVersionId"
})

CREATE (:Governance&ComplianceDomain:Entity {
  name: "policyBreachEvents",
  tableName: "policy_breach_events",
  domain: "Governance&Compliance",
  description: "Table policy_breach_events",
  file: "governance.ts",
  fieldCount: 4,
  keyFields: "bizId, policyTemplateId, policyRuleId, policyBindingId"
})

CREATE (:Governance&ComplianceDomain:Entity {
  name: "policyConsequenceEvents",
  tableName: "policy_consequence_events",
  domain: "Governance&Compliance",
  description: "Table policy_consequence_events",
  file: "governance.ts",
  fieldCount: 2,
  keyFields: "bizId, policyBreachEventId"
})

CREATE (:Governance&ComplianceDomain:Entity {
  name: "policyRules",
  tableName: "policy_rules",
  domain: "Governance&Compliance",
  description: "Table policy_rules",
  file: "governance.ts",
  fieldCount: 2,
  keyFields: "bizId, policyTemplateId"
})

CREATE (:Governance&ComplianceDomain:Entity {
  name: "policyTemplates",
  tableName: "policy_templates",
  domain: "Governance&Compliance",
  description: "Table policy_templates",
  file: "governance.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:Governance&ComplianceDomain:Entity {
  name: "privacyIdentityModes",
  tableName: "privacy_identity_modes",
  domain: "Governance&Compliance",
  description: "Table privacy_identity_modes",
  file: "governance.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "productBundleComponents",
  tableName: "product_bundle_components",
  domain: "CoreInfrastructure",
  description: "Table product_bundle_components",
  file: "product_commerce.ts",
  fieldCount: 5,
  keyFields: "bizId, productBundleId, productId, serviceProductId, offerId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "productBundles",
  tableName: "product_bundles",
  domain: "CoreInfrastructure",
  description: "Table product_bundles",
  file: "product_commerce.ts",
  fieldCount: 2,
  keyFields: "bizId, bundleProductId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "productionBatchReservations",
  tableName: "production_batch_reservations",
  domain: "CoreInfrastructure",
  description: "Table production_batch_reservations",
  file: "supply_batches.ts",
  fieldCount: 2,
  keyFields: "bizId, productionBatchId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "productionBatches",
  tableName: "production_batches",
  domain: "CoreInfrastructure",
  description: "Table production_batches",
  file: "supply_batches.ts",
  fieldCount: 3,
  keyFields: "bizId, locationId, sellableId"
})

CREATE (:CatalogDomain:Entity {
  name: "products",
  tableName: "products",
  domain: "Catalog",
  description: "Table products",
  file: "products.ts",
  fieldCount: 2,
  keyFields: "bizId, locationId"
})

CREATE (:IdentityDomain:Entity {
  name: "programCohortSessions",
  tableName: "program_cohort_sessions",
  domain: "Identity",
  description: "Table program_cohort_sessions",
  file: "education.ts",
  fieldCount: 2,
  keyFields: "bizId, cohortId"
})

CREATE (:Education&LearningDomain:Entity {
  name: "programCohorts",
  tableName: "program_cohorts",
  domain: "Education&Learning",
  description: "Table program_cohorts",
  file: "education.ts",
  fieldCount: 2,
  keyFields: "bizId, programId"
})

CREATE (:Education&LearningDomain:Entity {
  name: "programs",
  tableName: "programs",
  domain: "Education&Learning",
  description: "Table programs",
  file: "education.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:Intelligence&AnalyticsDomain:Entity {
  name: "projectionCheckpoints",
  tableName: "projection_checkpoints",
  domain: "Intelligence&Analytics",
  description: "Table projection_checkpoints",
  file: "reporting.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:PaymentsDomain:Entity {
  name: "purchaseOrders",
  tableName: "purchase_orders",
  domain: "Payments",
  description: "Table purchase_orders",
  file: "ar.ts",
  fieldCount: 2,
  keyFields: "bizId, billingAccountId"
})

CREATE (:QueueDomain:Entity {
  name: "queueCounterAssignments",
  tableName: "queue_counter_assignments",
  domain: "Queue",
  description: "Table queue_counter_assignments",
  file: "queue_operations.ts",
  fieldCount: 5,
  keyFields: "bizId, queueCounterId, assigneeUserId, assigneeGroupAccountId, assigneeResourceId"
})

CREATE (:QueueDomain:Entity {
  name: "queueCounters",
  tableName: "queue_counters",
  domain: "Queue",
  description: "Table queue_counters",
  file: "queue_operations.ts",
  fieldCount: 3,
  keyFields: "bizId, queueId, locationId"
})

CREATE (:QueueDomain:Entity {
  name: "queueEntries",
  tableName: "queue_entries",
  domain: "Queue",
  description: "Table queue_entries",
  file: "queue.ts",
  fieldCount: 8,
  keyFields: "bizId, queueId, customerUserId, customerGroupAccountId, requestedOfferVersionId, bookingOrderId, fulfillmentUnitId, statusConfigValueId"
})

CREATE (:QueueDomain:Entity {
  name: "queueEvents",
  tableName: "queue_events",
  domain: "Queue",
  description: "Table queue_events",
  file: "queue.ts",
  fieldCount: 3,
  keyFields: "bizId, queueEntryId, actorUserId"
})

CREATE (:QueueDomain:Entity {
  name: "queueTicketCalls",
  tableName: "queue_ticket_calls",
  domain: "Queue",
  description: "Table queue_ticket_calls",
  file: "queue_operations.ts",
  fieldCount: 4,
  keyFields: "bizId, queueTicketId, queueEntryId, queueCounterId"
})

CREATE (:QueueDomain:Entity {
  name: "queueTickets",
  tableName: "queue_tickets",
  domain: "Queue",
  description: "Table queue_tickets",
  file: "queue.ts",
  fieldCount: 4,
  keyFields: "bizId, queueEntryId, queueId, statusConfigValueId"
})

CREATE (:QueueDomain:Entity {
  name: "queues",
  tableName: "queues",
  domain: "Queue",
  description: "Table queues",
  file: "queue.ts",
  fieldCount: 2,
  keyFields: "bizId, locationId"
})

CREATE (:SocialDomain:Entity {
  name: "quietHourPolicies",
  tableName: "quiet_hour_policies",
  domain: "Social",
  description: "Table quiet_hour_policies",
  file: "communications.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:Intelligence&AnalyticsDomain:Entity {
  name: "rankingEvents",
  tableName: "ranking_events",
  domain: "Intelligence&Analytics",
  description: "Table ranking_events",
  file: "intelligence.ts",
  fieldCount: 3,
  keyFields: "bizId, rankingProfileId, resourceId"
})

CREATE (:Intelligence&AnalyticsDomain:Entity {
  name: "rankingProfiles",
  tableName: "ranking_profiles",
  domain: "Intelligence&Analytics",
  description: "Table ranking_profiles",
  file: "intelligence.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:Intelligence&AnalyticsDomain:Entity {
  name: "rankingScores",
  tableName: "ranking_scores",
  domain: "Intelligence&Analytics",
  description: "Table ranking_scores",
  file: "intelligence.ts",
  fieldCount: 3,
  keyFields: "bizId, rankingProfileId, resourceId"
})

CREATE (:Governance&ComplianceDomain:Entity {
  name: "redactionJobs",
  tableName: "redaction_jobs",
  domain: "Governance&Compliance",
  description: "Table redaction_jobs",
  file: "governance.ts",
  fieldCount: 3,
  keyFields: "bizId, dataSubjectRequestId, legalHoldId"
})

CREATE (:MarketplaceDomain:Entity {
  name: "referralAttributions",
  tableName: "referral_attributions",
  domain: "Marketplace",
  description: "Table referral_attributions",
  file: "referral_attribution.ts",
  fieldCount: 6,
  keyFields: "bizId, referralLinkId, referralLinkClickId, referralEventId, bookingOrderId, crossBizOrderId"
})

CREATE (:PaymentsDomain:Entity {
  name: "referralEvents",
  tableName: "referral_events",
  domain: "Payments",
  description: "Table referral_events",
  file: "marketplace.ts",
  fieldCount: 6,
  keyFields: "bizId, referralProgramId, referrerUserId, referredUserId, bookingOrderId, crossBizOrderId"
})

CREATE (:MarketplaceDomain:Entity {
  name: "referralLinkClicks",
  tableName: "referral_link_clicks",
  domain: "Marketplace",
  description: "Table referral_link_clicks",
  file: "referral_attribution.ts",
  fieldCount: 2,
  keyFields: "bizId, referralLinkId"
})

CREATE (:MarketplaceDomain:Entity {
  name: "referralLinks",
  tableName: "referral_links",
  domain: "Marketplace",
  description: "Table referral_links",
  file: "referral_attribution.ts",
  fieldCount: 2,
  keyFields: "bizId, referralProgramId"
})

CREATE (:PaymentsDomain:Entity {
  name: "referralPrograms",
  tableName: "referral_programs",
  domain: "Payments",
  description: "Table referral_programs",
  file: "marketplace.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "requirementEdges",
  tableName: "requirement_edges",
  domain: "CoreInfrastructure",
  description: "Table requirement_edges",
  file: "progression.ts",
  fieldCount: 4,
  keyFields: "bizId, requirementSetId, fromNodeId, toNodeId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "requirementEvaluations",
  tableName: "requirement_evaluations",
  domain: "CoreInfrastructure",
  description: "Table requirement_evaluations",
  file: "progression.ts",
  fieldCount: 2,
  keyFields: "bizId, requirementSetId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "requirementEvidenceLinks",
  tableName: "requirement_evidence_links",
  domain: "CoreInfrastructure",
  description: "Table requirement_evidence_links",
  file: "progression.ts",
  fieldCount: 3,
  keyFields: "bizId, requirementEvaluationId, requirementNodeId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "requirementListAssignmentItems",
  tableName: "requirement_list_assignment_items",
  domain: "CoreInfrastructure",
  description: "Table requirement_list_assignment_items",
  file: "interaction_forms.ts",
  fieldCount: 4,
  keyFields: "bizId, requirementListAssignmentId, templateItemId, statusConfigValueId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "requirementListAssignments",
  tableName: "requirement_list_assignments",
  domain: "CoreInfrastructure",
  description: "Table requirement_list_assignments",
  file: "interaction_forms.ts",
  fieldCount: 2,
  keyFields: "bizId, requirementListTemplateId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "requirementListTemplateItems",
  tableName: "requirement_list_template_items",
  domain: "CoreInfrastructure",
  description: "Table requirement_list_template_items",
  file: "interaction_forms.ts",
  fieldCount: 2,
  keyFields: "bizId, requirementListTemplateId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "requirementListTemplates",
  tableName: "requirement_list_templates",
  domain: "CoreInfrastructure",
  description: "Table requirement_list_templates",
  file: "interaction_forms.ts",
  fieldCount: 2,
  keyFields: "bizId, bizExtensionInstallId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "requirementNodes",
  tableName: "requirement_nodes",
  domain: "CoreInfrastructure",
  description: "Table requirement_nodes",
  file: "progression.ts",
  fieldCount: 2,
  keyFields: "bizId, requirementSetId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "requirementSets",
  tableName: "requirement_sets",
  domain: "CoreInfrastructure",
  description: "Table requirement_sets",
  file: "progression.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "resourceCapabilityAssignments",
  tableName: "resource_capability_assignments",
  domain: "CoreInfrastructure",
  description: "Table resource_capability_assignments",
  file: "supply.ts",
  fieldCount: 3,
  keyFields: "bizId, resourceId, capabilityTemplateId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "resourceCapabilityTemplates",
  tableName: "resource_capability_templates",
  domain: "CoreInfrastructure",
  description: "Table resource_capability_templates",
  file: "supply.ts",
  fieldCount: 2,
  keyFields: "bizId, locationId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "resourceConditionReports",
  tableName: "resource_condition_reports",
  domain: "CoreInfrastructure",
  description: "Table resource_condition_reports",
  file: "supply.ts",
  fieldCount: 3,
  keyFields: "bizId, resourceId, reporterUserId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "resourceMaintenancePolicies",
  tableName: "resource_maintenance_policies",
  domain: "CoreInfrastructure",
  description: "Table resource_maintenance_policies",
  file: "supply.ts",
  fieldCount: 3,
  keyFields: "bizId, resourceId, capabilityTemplateId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "resourceMaintenanceWorkOrders",
  tableName: "resource_maintenance_work_orders",
  domain: "CoreInfrastructure",
  description: "Table resource_maintenance_work_orders",
  file: "supply.ts",
  fieldCount: 5,
  keyFields: "bizId, resourceId, policyId, calendarId, calendarTimelineEventId"
})

CREATE (:SupplyDomain:Entity {
  name: "resourceServiceCapabilities",
  tableName: "resource_service_capabilities",
  domain: "Supply",
  description: "Table resource_service_capabilities",
  file: "resources.ts",
  fieldCount: 4,
  keyFields: "bizId, resourceId, serviceId, locationId"
})

CREATE (:SupplyDomain:Entity {
  name: "resourceStatusDefinitions",
  tableName: "resource_status_definitions",
  domain: "Supply",
  description: "Table resource_status_definitions",
  file: "resources.ts",
  fieldCount: 2,
  keyFields: "bizId, locationId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "resourceUsageCounters",
  tableName: "resource_usage_counters",
  domain: "CoreInfrastructure",
  description: "Table resource_usage_counters",
  file: "supply.ts",
  fieldCount: 2,
  keyFields: "bizId, resourceId"
})

CREATE (:SupplyDomain:Entity {
  name: "resources",
  tableName: "resources",
  domain: "Supply",
  description: "Table resources",
  file: "resources.ts",
  fieldCount: 2,
  keyFields: "bizId, locationId"
})

CREATE (:Governance&ComplianceDomain:Entity {
  name: "retentionPolicies",
  tableName: "retention_policies",
  domain: "Governance&Compliance",
  description: "Table retention_policies",
  file: "governance.ts",
  fieldCount: 2,
  keyFields: "bizId, complianceProfileId"
})

CREATE (:SupplyDomain:Entity {
  name: "revenueShareRules",
  tableName: "revenue_share_rules",
  domain: "Supply",
  description: "Table revenue_share_rules",
  file: "marketplace.ts",
  fieldCount: 3,
  keyFields: "bizId, contractId, marketplaceListingId"
})

CREATE (:QueueDomain:Entity {
  name: "reviewQueueItems",
  tableName: "review_queue_items",
  domain: "Queue",
  description: "Table review_queue_items",
  file: "workflows.ts",
  fieldCount: 2,
  keyFields: "bizId, reviewQueueId"
})

CREATE (:QueueDomain:Entity {
  name: "reviewQueues",
  tableName: "review_queues",
  domain: "Queue",
  description: "Table review_queues",
  file: "workflows.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:PaymentsDomain:Entity {
  name: "rewardGrants",
  tableName: "reward_grants",
  domain: "Payments",
  description: "Table reward_grants",
  file: "marketplace.ts",
  fieldCount: 4,
  keyFields: "bizId, referralProgramId, referralEventId, recipientUserId"
})

CREATE (:AccessControlDomain:Entity {
  name: "rolloverRuns",
  tableName: "rollover_runs",
  domain: "AccessControl",
  description: "Table rollover_runs",
  file: "entitlements.ts",
  fieldCount: 3,
  keyFields: "bizId, membershipPlanId, membershipId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "sagaCoverageItems",
  tableName: "saga_coverage_items",
  domain: "CoreInfrastructure",
  description: "Table saga_coverage_items",
  file: "sagas.ts",
  fieldCount: 1,
  keyFields: "sagaCoverageReportId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "sagaCoverageReports",
  tableName: "saga_coverage_reports",
  domain: "CoreInfrastructure",
  description: "Table saga_coverage_reports",
  file: "sagas.ts",
  fieldCount: 2,
  keyFields: "bizId, sagaRunId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "sagaDefinitionLinks",
  tableName: "saga_definition_links",
  domain: "CoreInfrastructure",
  description: "Table saga_definition_links",
  file: "sagas.ts",
  fieldCount: 1,
  keyFields: "sagaDefinitionId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "sagaDefinitionRevisions",
  tableName: "saga_definition_revisions",
  domain: "CoreInfrastructure",
  description: "Table saga_definition_revisions",
  file: "sagas.ts",
  fieldCount: 1,
  keyFields: "sagaDefinitionId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "sagaDefinitions",
  tableName: "saga_definitions",
  domain: "CoreInfrastructure",
  description: "Table saga_definitions",
  file: "sagas.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "sagaPersonaVersions",
  tableName: "saga_persona_versions",
  domain: "CoreInfrastructure",
  description: "Table saga_persona_versions",
  file: "sagas.ts",
  fieldCount: 1,
  keyFields: "sagaPersonaId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "sagaPersonas",
  tableName: "saga_personas",
  domain: "CoreInfrastructure",
  description: "Table saga_personas",
  file: "sagas.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:PaymentsDomain:Entity {
  name: "sagaRunActorMessages",
  tableName: "saga_run_actor_messages",
  domain: "Payments",
  description: "Table saga_run_actor_messages",
  file: "sagas.ts",
  fieldCount: 1,
  keyFields: "sagaRunId"
})

CREATE (:PaymentsDomain:Entity {
  name: "sagaRunActorProfiles",
  tableName: "saga_run_actor_profiles",
  domain: "Payments",
  description: "Table saga_run_actor_profiles",
  file: "sagas.ts",
  fieldCount: 1,
  keyFields: "sagaRunId"
})

CREATE (:PaymentsDomain:Entity {
  name: "sagaRunArtifacts",
  tableName: "saga_run_artifacts",
  domain: "Payments",
  description: "Table saga_run_artifacts",
  file: "sagas.ts",
  fieldCount: 1,
  keyFields: "sagaRunId"
})

CREATE (:PaymentsDomain:Entity {
  name: "sagaRunSteps",
  tableName: "saga_run_steps",
  domain: "Payments",
  description: "Table saga_run_steps",
  file: "sagas.ts",
  fieldCount: 1,
  keyFields: "sagaRunId"
})

CREATE (:PaymentsDomain:Entity {
  name: "sagaRuns",
  tableName: "saga_runs",
  domain: "Payments",
  description: "Table saga_runs",
  file: "sagas.ts",
  fieldCount: 1,
  keyFields: "sagaDefinitionId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "sagaTagBindings",
  tableName: "saga_tag_bindings",
  domain: "CoreInfrastructure",
  description: "Table saga_tag_bindings",
  file: "sagas.ts",
  fieldCount: 1,
  keyFields: "sagaTagId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "sagaTags",
  tableName: "saga_tags",
  domain: "CoreInfrastructure",
  description: "Table saga_tags",
  file: "sagas.ts",
  fieldCount: 0,
  keyFields: "id"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "sagaUseCaseVersions",
  tableName: "saga_use_case_versions",
  domain: "CoreInfrastructure",
  description: "Table saga_use_case_versions",
  file: "sagas.ts",
  fieldCount: 1,
  keyFields: "sagaUseCaseId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "sagaUseCases",
  tableName: "saga_use_cases",
  domain: "CoreInfrastructure",
  description: "Table saga_use_cases",
  file: "sagas.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "salesQuoteAcceptances",
  tableName: "sales_quote_acceptances",
  domain: "CoreInfrastructure",
  description: "Table sales_quote_acceptances",
  file: "sales_quotes.ts",
  fieldCount: 2,
  keyFields: "bizId, salesQuoteVersionId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "salesQuoteLines",
  tableName: "sales_quote_lines",
  domain: "CoreInfrastructure",
  description: "Table sales_quote_lines",
  file: "sales_quotes.ts",
  fieldCount: 2,
  keyFields: "bizId, salesQuoteVersionId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "salesQuoteVersions",
  tableName: "sales_quote_versions",
  domain: "CoreInfrastructure",
  description: "Table sales_quote_versions",
  file: "sales_quotes.ts",
  fieldCount: 2,
  keyFields: "bizId, salesQuoteId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "salesQuotes",
  tableName: "sales_quotes",
  domain: "CoreInfrastructure",
  description: "Table sales_quotes",
  file: "sales_quotes.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "seatHolds",
  tableName: "seat_holds",
  domain: "CoreInfrastructure",
  description: "Table seat_holds",
  file: "seating.ts",
  fieldCount: 8,
  keyFields: "bizId, seatMapId, seatMapSeatId, bookingOrderId, bookingOrderLineId, queueEntryId, holderUserId, holderGroupAccountId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "seatMapSeats",
  tableName: "seat_map_seats",
  domain: "CoreInfrastructure",
  description: "Table seat_map_seats",
  file: "seating.ts",
  fieldCount: 2,
  keyFields: "bizId, seatMapId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "seatMaps",
  tableName: "seat_maps",
  domain: "CoreInfrastructure",
  description: "Table seat_maps",
  file: "seating.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "seatReservations",
  tableName: "seat_reservations",
  domain: "CoreInfrastructure",
  description: "Table seat_reservations",
  file: "seating.ts",
  fieldCount: 8,
  keyFields: "bizId, seatMapId, seatMapSeatId, seatHoldId, bookingOrderId, bookingOrderLineId, fulfillmentUnitId, queueEntryId"
})

CREATE (:IdentityDomain:Entity {
  name: "securedBalanceAccounts",
  tableName: "secured_balance_accounts",
  domain: "Identity",
  description: "Table secured_balance_accounts",
  file: "commitments.ts",
  fieldCount: 2,
  keyFields: "bizId, commitmentContractId"
})

CREATE (:BookingsDomain:Entity {
  name: "securedBalanceAllocations",
  tableName: "secured_balance_allocations",
  domain: "Bookings",
  description: "Table secured_balance_allocations",
  file: "commitments.ts",
  fieldCount: 2,
  keyFields: "bizId, securedBalanceLedgerEntryId"
})

CREATE (:BookingsDomain:Entity {
  name: "securedBalanceLedgerEntries",
  tableName: "secured_balance_ledger_entries",
  domain: "Bookings",
  description: "Table secured_balance_ledger_entries",
  file: "commitments.ts",
  fieldCount: 2,
  keyFields: "bizId, securedBalanceAccountId"
})

CREATE (:Governance&ComplianceDomain:Entity {
  name: "securityIncidents",
  tableName: "security_incidents",
  domain: "Governance&Compliance",
  description: "Table security_incidents",
  file: "hipaa.ts",
  fieldCount: 2,
  keyFields: "bizId, complianceProfileId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "sellableOfferVersions",
  tableName: "sellable_offer_versions",
  domain: "CoreInfrastructure",
  description: "Table sellable_offer_versions",
  file: "product_commerce.ts",
  fieldCount: 3,
  keyFields: "bizId, sellableId, offerVersionId"
})

CREATE (:CatalogDomain:Entity {
  name: "sellablePricingModes",
  tableName: "sellable_pricing_modes",
  domain: "Catalog",
  description: "Table sellable_pricing_modes",
  file: "sellable_pricing.ts",
  fieldCount: 2,
  keyFields: "bizId, sellableId"
})

CREATE (:CatalogDomain:Entity {
  name: "sellablePricingOverrides",
  tableName: "sellable_pricing_overrides",
  domain: "Catalog",
  description: "Table sellable_pricing_overrides",
  file: "sellable_pricing.ts",
  fieldCount: 4,
  keyFields: "bizId, sellablePricingModeId, locationId, channelAccountId"
})

CREATE (:CatalogDomain:Entity {
  name: "sellablePricingThresholds",
  tableName: "sellable_pricing_thresholds",
  domain: "Catalog",
  description: "Table sellable_pricing_thresholds",
  file: "sellable_pricing.ts",
  fieldCount: 2,
  keyFields: "bizId, sellablePricingModeId"
})

CREATE (:CatalogDomain:Entity {
  name: "sellableProducts",
  tableName: "sellable_products",
  domain: "Catalog",
  description: "Table sellable_products",
  file: "product_commerce.ts",
  fieldCount: 3,
  keyFields: "bizId, sellableId, productId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "sellableResourceRates",
  tableName: "sellable_resource_rates",
  domain: "CoreInfrastructure",
  description: "Table sellable_resource_rates",
  file: "product_commerce.ts",
  fieldCount: 3,
  keyFields: "bizId, sellableId, resourceId"
})

CREATE (:CatalogDomain:Entity {
  name: "sellableServiceProducts",
  tableName: "sellable_service_products",
  domain: "Catalog",
  description: "Table sellable_service_products",
  file: "product_commerce.ts",
  fieldCount: 3,
  keyFields: "bizId, sellableId, serviceProductId"
})

CREATE (:PaymentsDomain:Entity {
  name: "sellableVariantDimensionValues",
  tableName: "sellable_variant_dimension_values",
  domain: "Payments",
  description: "Table sellable_variant_dimension_values",
  file: "sellable_variants.ts",
  fieldCount: 2,
  keyFields: "bizId, sellableVariantDimensionId"
})

CREATE (:PaymentsDomain:Entity {
  name: "sellableVariantDimensions",
  tableName: "sellable_variant_dimensions",
  domain: "Payments",
  description: "Table sellable_variant_dimensions",
  file: "sellable_variants.ts",
  fieldCount: 2,
  keyFields: "bizId, baseSellableId"
})

CREATE (:PaymentsDomain:Entity {
  name: "sellableVariantSelections",
  tableName: "sellable_variant_selections",
  domain: "Payments",
  description: "Table sellable_variant_selections",
  file: "sellable_variants.ts",
  fieldCount: 5,
  keyFields: "bizId, sellableVariantId, baseSellableId, sellableVariantDimensionId, sellableVariantDimensionValueId"
})

CREATE (:PaymentsDomain:Entity {
  name: "sellableVariants",
  tableName: "sellable_variants",
  domain: "Payments",
  description: "Table sellable_variants",
  file: "sellable_variants.ts",
  fieldCount: 3,
  keyFields: "bizId, baseSellableId, variantSellableId"
})

CREATE (:CatalogDomain:Entity {
  name: "sellables",
  tableName: "sellables",
  domain: "Catalog",
  description: "Table sellables",
  file: "product_commerce.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CatalogDomain:Entity {
  name: "serviceGroups",
  tableName: "service_groups",
  domain: "Catalog",
  description: "Table service_groups",
  file: "services.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CatalogDomain:Entity {
  name: "serviceProductRequirementGroups",
  tableName: "service_product_requirement_groups",
  domain: "Catalog",
  description: "Table service_product_requirement_groups",
  file: "service_products.ts",
  fieldCount: 2,
  keyFields: "bizId, serviceProductId"
})

CREATE (:CatalogDomain:Entity {
  name: "serviceProductRequirementSelectors",
  tableName: "service_product_requirement_selectors",
  domain: "Catalog",
  description: "Table service_product_requirement_selectors",
  file: "service_products.ts",
  fieldCount: 5,
  keyFields: "bizId, requirementGroupId, resourceId, capabilityTemplateId, locationId"
})

CREATE (:CatalogDomain:Entity {
  name: "serviceProductSeatTypeRequirements",
  tableName: "service_product_seat_type_requirements",
  domain: "Catalog",
  description: "Table service_product_seat_type_requirements",
  file: "service_products.ts",
  fieldCount: 3,
  keyFields: "bizId, seatTypeId, requirementGroupId"
})

CREATE (:CatalogDomain:Entity {
  name: "serviceProductSeatTypes",
  tableName: "service_product_seat_types",
  domain: "Catalog",
  description: "Table service_product_seat_types",
  file: "service_products.ts",
  fieldCount: 2,
  keyFields: "bizId, serviceProductId"
})

CREATE (:CatalogDomain:Entity {
  name: "serviceProductServices",
  tableName: "service_product_services",
  domain: "Catalog",
  description: "Table service_product_services",
  file: "service_products.ts",
  fieldCount: 4,
  keyFields: "bizId, serviceProductId, serviceId, serviceGroupId"
})

CREATE (:CatalogDomain:Entity {
  name: "serviceProducts",
  tableName: "service_products",
  domain: "Catalog",
  description: "Table service_products",
  file: "service_products.ts",
  fieldCount: 2,
  keyFields: "bizId, productId"
})

CREATE (:QueueDomain:Entity {
  name: "serviceTimeObservations",
  tableName: "service_time_observations",
  domain: "Queue",
  description: "Table service_time_observations",
  file: "queue.ts",
  fieldCount: 5,
  keyFields: "bizId, queueId, offerVersionId, resourceId, fulfillmentUnitId"
})

CREATE (:CatalogDomain:Entity {
  name: "services",
  tableName: "services",
  domain: "Catalog",
  description: "Table services",
  file: "services.ts",
  fieldCount: 2,
  keyFields: "bizId, serviceGroupId"
})

CREATE (:Education&LearningDomain:Entity {
  name: "sessionAttendanceRecords",
  tableName: "session_attendance_records",
  domain: "Education&Learning",
  description: "Table session_attendance_records",
  file: "education.ts",
  fieldCount: 3,
  keyFields: "bizId, sessionId, enrollmentId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "sessionInteractionAggregates",
  tableName: "session_interaction_aggregates",
  domain: "CoreInfrastructure",
  description: "Table session_interaction_aggregates",
  file: "session_interactions.ts",
  fieldCount: 3,
  keyFields: "bizId, programSessionId, fulfillmentUnitId"
})

CREATE (:PaymentsDomain:Entity {
  name: "sessionInteractionArtifacts",
  tableName: "session_interaction_artifacts",
  domain: "Payments",
  description: "Table session_interaction_artifacts",
  file: "session_interaction_artifacts.ts",
  fieldCount: 2,
  keyFields: "bizId, sessionInteractionEventId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "sessionInteractionEvents",
  tableName: "session_interaction_events",
  domain: "CoreInfrastructure",
  description: "Table session_interaction_events",
  file: "session_interactions.ts",
  fieldCount: 3,
  keyFields: "bizId, programSessionId, fulfillmentUnitId"
})

CREATE (:PaymentsDomain:Entity {
  name: "settlementBatches",
  tableName: "settlement_batches",
  domain: "Payments",
  description: "Table settlement_batches",
  file: "payments.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:PaymentsDomain:Entity {
  name: "settlementEntries",
  tableName: "settlement_entries",
  domain: "Payments",
  description: "Table settlement_entries",
  file: "payments.ts",
  fieldCount: 5,
  keyFields: "bizId, settlementBatchId, paymentTransactionId, bookingOrderId, crossBizOrderId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "shipmentGeneratedItems",
  tableName: "shipment_generated_items",
  domain: "CoreInfrastructure",
  description: "Table shipment_generated_items",
  file: "shipment_schedules.ts",
  fieldCount: 3,
  keyFields: "bizId, shipmentGenerationRunId, shipmentScheduleId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "shipmentGenerationRuns",
  tableName: "shipment_generation_runs",
  domain: "CoreInfrastructure",
  description: "Table shipment_generation_runs",
  file: "shipment_schedules.ts",
  fieldCount: 2,
  keyFields: "bizId, shipmentScheduleId"
})

CREATE (:OperationsDomain:Entity {
  name: "shipmentSchedules",
  tableName: "shipment_schedules",
  domain: "Operations",
  description: "Table shipment_schedules",
  file: "shipment_schedules.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:Enterprise&B2BDomain:Entity {
  name: "slaBreachEvents",
  tableName: "sla_breach_events",
  domain: "Enterprise&B2B",
  description: "Table sla_breach_events",
  file: "sla.ts",
  fieldCount: 7,
  keyFields: "bizId, slaPolicyId, bookingOrderId, fulfillmentUnitId, queueEntryId, workRunId, resourceId"
})

CREATE (:Enterprise&B2BDomain:Entity {
  name: "slaCompensationEvents",
  tableName: "sla_compensation_events",
  domain: "Enterprise&B2B",
  description: "Table sla_compensation_events",
  file: "sla.ts",
  fieldCount: 2,
  keyFields: "bizId, slaBreachEventId"
})

CREATE (:Enterprise&B2BDomain:Entity {
  name: "slaPolicies",
  tableName: "sla_policies",
  domain: "Enterprise&B2B",
  description: "Table sla_policies",
  file: "sla.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:Intelligence&AnalyticsDomain:Entity {
  name: "staffingAssignments",
  tableName: "staffing_assignments",
  domain: "Intelligence&Analytics",
  description: "Table staffing_assignments",
  file: "intelligence.ts",
  fieldCount: 6,
  keyFields: "bizId, staffingDemandId, resourceId, staffingResponseId, fulfillmentAssignmentId, fulfillmentUnitId"
})

CREATE (:Intelligence&AnalyticsDomain:Entity {
  name: "staffingDemandRequirements",
  tableName: "staffing_demand_requirements",
  domain: "Intelligence&Analytics",
  description: "Table staffing_demand_requirements",
  file: "intelligence.ts",
  fieldCount: 2,
  keyFields: "bizId, staffingDemandId"
})

CREATE (:Intelligence&AnalyticsDomain:Entity {
  name: "staffingDemandSelectors",
  tableName: "staffing_demand_selectors",
  domain: "Intelligence&Analytics",
  description: "Table staffing_demand_selectors",
  file: "intelligence.ts",
  fieldCount: 5,
  keyFields: "bizId, staffingDemandRequirementId, resourceId, capabilityTemplateId, locationId"
})

CREATE (:Intelligence&AnalyticsDomain:Entity {
  name: "staffingDemands",
  tableName: "staffing_demands",
  domain: "Intelligence&Analytics",
  description: "Table staffing_demands",
  file: "intelligence.ts",
  fieldCount: 2,
  keyFields: "bizId, staffingPoolId"
})

CREATE (:Intelligence&AnalyticsDomain:Entity {
  name: "staffingFairnessCounters",
  tableName: "staffing_fairness_counters",
  domain: "Intelligence&Analytics",
  description: "Table staffing_fairness_counters",
  file: "intelligence.ts",
  fieldCount: 3,
  keyFields: "bizId, staffingPoolId, resourceId"
})

CREATE (:Intelligence&AnalyticsDomain:Entity {
  name: "staffingPoolMembers",
  tableName: "staffing_pool_members",
  domain: "Intelligence&Analytics",
  description: "Table staffing_pool_members",
  file: "intelligence.ts",
  fieldCount: 4,
  keyFields: "bizId, staffingPoolId, resourceId, capabilityTemplateId"
})

CREATE (:Intelligence&AnalyticsDomain:Entity {
  name: "staffingPools",
  tableName: "staffing_pools",
  domain: "Intelligence&Analytics",
  description: "Table staffing_pools",
  file: "intelligence.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:Intelligence&AnalyticsDomain:Entity {
  name: "staffingResponses",
  tableName: "staffing_responses",
  domain: "Intelligence&Analytics",
  description: "Table staffing_responses",
  file: "intelligence.ts",
  fieldCount: 3,
  keyFields: "bizId, staffingDemandId, candidateResourceId"
})

CREATE (:BookingsDomain:Entity {
  name: "standingReservationContracts",
  tableName: "standing_reservation_contracts",
  domain: "Bookings",
  description: "Table standing_reservation_contracts",
  file: "fulfillment.ts",
  fieldCount: 6,
  keyFields: "bizId, offerId, offerVersionId, locationId, customerUserId, customerGroupAccountId"
})

CREATE (:BookingsDomain:Entity {
  name: "standingReservationExceptions",
  tableName: "standing_reservation_exceptions",
  domain: "Bookings",
  description: "Table standing_reservation_exceptions",
  file: "fulfillment.ts",
  fieldCount: 2,
  keyFields: "bizId, standingReservationContractId"
})

CREATE (:BookingsDomain:Entity {
  name: "standingReservationOccurrences",
  tableName: "standing_reservation_occurrences",
  domain: "Bookings",
  description: "Table standing_reservation_occurrences",
  file: "fulfillment.ts",
  fieldCount: 2,
  keyFields: "bizId, standingReservationContractId"
})

CREATE (:IdentityDomain:Entity {
  name: "stripeAccounts",
  tableName: "stripe_accounts",
  domain: "Identity",
  description: "Table stripe_accounts",
  file: "stripe.ts",
  fieldCount: 2,
  keyFields: "bizId, paymentProcessorAccountId"
})

CREATE (:IdentityDomain:Entity {
  name: "stripeCheckoutSessions",
  tableName: "stripe_checkout_sessions",
  domain: "Identity",
  description: "Table stripe_checkout_sessions",
  file: "stripe.ts",
  fieldCount: 6,
  keyFields: "bizId, bookingOrderId, crossBizOrderId, paymentIntentRefId, stripeCustomerRefId, stripeAccountRefId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "stripeCustomers",
  tableName: "stripe_customers",
  domain: "CoreInfrastructure",
  description: "Table stripe_customers",
  file: "stripe.ts",
  fieldCount: 4,
  keyFields: "bizId, stripeAccountRefId, userId, groupAccountId"
})

CREATE (:PaymentsDomain:Entity {
  name: "stripeInvoices",
  tableName: "stripe_invoices",
  domain: "Payments",
  description: "Table stripe_invoices",
  file: "stripe.ts",
  fieldCount: 5,
  keyFields: "bizId, bookingOrderId, crossBizOrderId, stripeCustomerRefId, stripeAccountRefId"
})

CREATE (:PaymentsDomain:Entity {
  name: "stripePaymentMethods",
  tableName: "stripe_payment_methods",
  domain: "Payments",
  description: "Table stripe_payment_methods",
  file: "stripe.ts",
  fieldCount: 2,
  keyFields: "bizId, stripeCustomerRefId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "stripePayouts",
  tableName: "stripe_payouts",
  domain: "CoreInfrastructure",
  description: "Table stripe_payouts",
  file: "stripe.ts",
  fieldCount: 2,
  keyFields: "bizId, stripeAccountRefId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "stripeSetupIntents",
  tableName: "stripe_setup_intents",
  domain: "CoreInfrastructure",
  description: "Table stripe_setup_intents",
  file: "stripe.ts",
  fieldCount: 4,
  keyFields: "bizId, userId, groupAccountId, stripeCustomerRefId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "stripeTransfers",
  tableName: "stripe_transfers",
  domain: "CoreInfrastructure",
  description: "Table stripe_transfers",
  file: "stripe.ts",
  fieldCount: 6,
  keyFields: "bizId, bookingOrderId, crossBizOrderId, paymentIntentRefId, paymentTransactionRefId, destinationAccountRefId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "stripeWebhookEvents",
  tableName: "stripe_webhook_events",
  domain: "CoreInfrastructure",
  description: "Table stripe_webhook_events",
  file: "stripe.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "subjectLocationBindings",
  tableName: "subject_location_bindings",
  domain: "CoreInfrastructure",
  description: "Table subject_location_bindings",
  file: "subjects.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "subjectRelationships",
  tableName: "subject_relationships",
  domain: "CoreInfrastructure",
  description: "Table subject_relationships",
  file: "subjects.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "subjects",
  tableName: "subjects",
  domain: "CoreInfrastructure",
  description: "Table subjects",
  file: "subjects.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:IdentityDomain:Entity {
  name: "surveyInvitations",
  tableName: "survey_invitations",
  domain: "Identity",
  description: "Table survey_invitations",
  file: "surveys.ts",
  fieldCount: 2,
  keyFields: "bizId, surveyTemplateId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "surveyQuestions",
  tableName: "survey_questions",
  domain: "CoreInfrastructure",
  description: "Table survey_questions",
  file: "surveys.ts",
  fieldCount: 2,
  keyFields: "bizId, surveyTemplateId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "surveyResponseAnswers",
  tableName: "survey_response_answers",
  domain: "CoreInfrastructure",
  description: "Table survey_response_answers",
  file: "surveys.ts",
  fieldCount: 3,
  keyFields: "bizId, surveyResponseId, surveyQuestionId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "surveyResponses",
  tableName: "survey_responses",
  domain: "CoreInfrastructure",
  description: "Table survey_responses",
  file: "surveys.ts",
  fieldCount: 3,
  keyFields: "bizId, surveyInvitationId, respondentUserId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "surveyTemplates",
  tableName: "survey_templates",
  domain: "CoreInfrastructure",
  description: "Table survey_templates",
  file: "surveys.ts",
  fieldCount: 2,
  keyFields: "bizId, bizExtensionInstallId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "taxCalculations",
  tableName: "tax_calculations",
  domain: "CoreInfrastructure",
  description: "Table tax_calculations",
  file: "tax_fx.ts",
  fieldCount: 6,
  keyFields: "bizId, taxProfileId, taxRuleRefId, fxRateSnapshotId, bookingOrderId, arInvoiceId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "taxProfiles",
  tableName: "tax_profiles",
  domain: "CoreInfrastructure",
  description: "Table tax_profiles",
  file: "tax_fx.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "taxRuleRefs",
  tableName: "tax_rule_refs",
  domain: "CoreInfrastructure",
  description: "Table tax_rule_refs",
  file: "tax_fx.ts",
  fieldCount: 2,
  keyFields: "bizId, taxProfileId"
})

CREATE (:Governance&ComplianceDomain:Entity {
  name: "tenantComplianceProfiles",
  tableName: "tenant_compliance_profiles",
  domain: "Governance&Compliance",
  description: "Table tenant_compliance_profiles",
  file: "governance.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:OperationsDomain:Entity {
  name: "transportRouteStops",
  tableName: "transport_route_stops",
  domain: "Operations",
  description: "Table transport_route_stops",
  file: "transportation.ts",
  fieldCount: 2,
  keyFields: "bizId, routeId"
})

CREATE (:OperationsDomain:Entity {
  name: "transportRoutes",
  tableName: "transport_routes",
  domain: "Operations",
  description: "Table transport_routes",
  file: "transportation.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "transportTrips",
  tableName: "transport_trips",
  domain: "CoreInfrastructure",
  description: "Table transport_trips",
  file: "transportation.ts",
  fieldCount: 6,
  keyFields: "bizId, routeId, offerVersionId, fleetVehicleId, driverResourceId, calendarBindingId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "tripManifests",
  tableName: "trip_manifests",
  domain: "CoreInfrastructure",
  description: "Table trip_manifests",
  file: "transportation.ts",
  fieldCount: 7,
  keyFields: "bizId, tripId, bookingOrderId, fulfillmentUnitId, queueEntryId, passengerUserId, passengerGroupAccountId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "tripStopInventory",
  tableName: "trip_stop_inventory",
  domain: "CoreInfrastructure",
  description: "Table trip_stop_inventory",
  file: "transportation.ts",
  fieldCount: 3,
  keyFields: "bizId, tripId, routeStopId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "userCredentialDocuments",
  tableName: "user_credential_documents",
  domain: "CoreInfrastructure",
  description: "Table user_credential_documents",
  file: "credential_exchange.ts",
  fieldCount: 2,
  keyFields: "ownerUserId, userCredentialRecordId"
})

CREATE (:Intelligence&AnalyticsDomain:Entity {
  name: "userCredentialFacts",
  tableName: "user_credential_facts",
  domain: "Intelligence&Analytics",
  description: "Table user_credential_facts",
  file: "credential_exchange.ts",
  fieldCount: 2,
  keyFields: "ownerUserId, userCredentialRecordId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "userCredentialProfiles",
  tableName: "user_credential_profiles",
  domain: "CoreInfrastructure",
  description: "Table user_credential_profiles",
  file: "credential_exchange.ts",
  fieldCount: 1,
  keyFields: "ownerUserId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "userCredentialRecords",
  tableName: "user_credential_records",
  domain: "CoreInfrastructure",
  description: "Table user_credential_records",
  file: "credential_exchange.ts",
  fieldCount: 2,
  keyFields: "ownerUserId, credentialTypeDefinitionId"
})

CREATE (:IdentityDomain:Entity {
  name: "userCredentialVerifications",
  tableName: "user_credential_verifications",
  domain: "Identity",
  description: "Table user_credential_verifications",
  file: "credential_exchange.ts",
  fieldCount: 3,
  keyFields: "ownerUserId, userCredentialRecordId, userCredentialDocumentId"
})

CREATE (:IdentityDomain:Entity {
  name: "users",
  tableName: "users",
  domain: "Identity",
  description: "Table users",
  file: "users.ts",
  fieldCount: 0,
  keyFields: "id"
})

CREATE (:SupplyDomain:Entity {
  name: "venues",
  tableName: "venues",
  domain: "Supply",
  description: "Table venues",
  file: "venues.ts",
  fieldCount: 2,
  keyFields: "bizId, locationId"
})

CREATE (:QueueDomain:Entity {
  name: "waitTimePredictions",
  tableName: "wait_time_predictions",
  domain: "Queue",
  description: "Table wait_time_predictions",
  file: "queue.ts",
  fieldCount: 3,
  keyFields: "bizId, queueId, queueEntryId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "wishlistItems",
  tableName: "wishlist_items",
  domain: "CoreInfrastructure",
  description: "Table wishlist_items",
  file: "commerce_preferences.ts",
  fieldCount: 3,
  keyFields: "bizId, wishlistId, sellableId"
})

CREATE (:CatalogDomain:Entity {
  name: "wishlists",
  tableName: "wishlists",
  domain: "Catalog",
  description: "Table wishlists",
  file: "commerce_preferences.ts",
  fieldCount: 2,
  keyFields: "bizId, crmContactId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "workApprovals",
  tableName: "work_approvals",
  domain: "CoreInfrastructure",
  description: "Table work_approvals",
  file: "work_management.ts",
  fieldCount: 4,
  keyFields: "bizId, workRunId, approverUserId, approverGroupAccountId"
})

CREATE (:PaymentsDomain:Entity {
  name: "workArtifacts",
  tableName: "work_artifacts",
  domain: "Payments",
  description: "Table work_artifacts",
  file: "work_management.ts",
  fieldCount: 3,
  keyFields: "bizId, workRunId, workEntryId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "workEntries",
  tableName: "work_entries",
  domain: "CoreInfrastructure",
  description: "Table work_entries",
  file: "work_management.ts",
  fieldCount: 4,
  keyFields: "bizId, workRunId, workRunStepId, statusConfigValueId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "workRunSteps",
  tableName: "work_run_steps",
  domain: "CoreInfrastructure",
  description: "Table work_run_steps",
  file: "work_management.ts",
  fieldCount: 4,
  keyFields: "bizId, workRunId, workTemplateStepId, statusConfigValueId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "workRuns",
  tableName: "work_runs",
  domain: "CoreInfrastructure",
  description: "Table work_runs",
  file: "work_management.ts",
  fieldCount: 3,
  keyFields: "bizId, workTemplateId, parentWorkRunId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "workTemplateSteps",
  tableName: "work_template_steps",
  domain: "CoreInfrastructure",
  description: "Table work_template_steps",
  file: "work_management.ts",
  fieldCount: 2,
  keyFields: "bizId, workTemplateId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "workTemplates",
  tableName: "work_templates",
  domain: "CoreInfrastructure",
  description: "Table work_templates",
  file: "work_management.ts",
  fieldCount: 3,
  keyFields: "bizId, bizExtensionInstallId, kindConfigValueId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "workTimeSegmentAllocations",
  tableName: "work_time_segment_allocations",
  domain: "CoreInfrastructure",
  description: "Table work_time_segment_allocations",
  file: "work_management.ts",
  fieldCount: 3,
  keyFields: "bizId, workTimeSegmentId, staffingAssignmentId"
})

CREATE (:CoreInfrastructureDomain:Entity {
  name: "workTimeSegments",
  tableName: "work_time_segments",
  domain: "CoreInfrastructure",
  description: "Table work_time_segments",
  file: "work_management.ts",
  fieldCount: 3,
  keyFields: "bizId, workRunId, userId"
})

CREATE (:OperationsDomain:Entity {
  name: "workflowDecisions",
  tableName: "workflow_decisions",
  domain: "Operations",
  description: "Table workflow_decisions",
  file: "workflows.ts",
  fieldCount: 4,
  keyFields: "bizId, workflowInstanceId, workflowStepId, deciderUserId"
})

CREATE (:OperationsDomain:Entity {
  name: "workflowInstances",
  tableName: "workflow_instances",
  domain: "Operations",
  description: "Table workflow_instances",
  file: "workflows.ts",
  fieldCount: 1,
  keyFields: "bizId"
})

CREATE (:OperationsDomain:Entity {
  name: "workflowSteps",
  tableName: "workflow_steps",
  domain: "Operations",
  description: "Table workflow_steps",
  file: "workflows.ts",
  fieldCount: 2,
  keyFields: "bizId, workflowInstanceId"
})

// Create relationships

MATCH (a:Entity {name: "accessActionTokenEvents"}), (b:Entity {name: "accessActionTokens"})
CREATE (a)-[:REFERENCES {fields: "accessActionTokenId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "accessActionTokenEvents"}), (b:Entity {name: "accessArtifacts"})
CREATE (a)-[:REFERENCES {fields: "accessArtifact_id, accessArtifact_id, accessArtifact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "accessActionTokens"}), (b:Entity {name: "accessArtifacts"})
CREATE (a)-[:REFERENCES {fields: "accessArtifactId, accessArtifact_id, accessArtifact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "accessActivityLogs"}), (b:Entity {name: "accessArtifacts"})
CREATE (a)-[:REFERENCES {fields: "accessArtifactId, accessArtifact_id, accessArtifact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "accessArtifactEvents"}), (b:Entity {name: "accessArtifacts"})
CREATE (a)-[:REFERENCES {fields: "accessArtifactId, accessArtifact_id, accessArtifact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "accessArtifactLinks"}), (b:Entity {name: "accessArtifacts"})
CREATE (a)-[:REFERENCES {fields: "accessArtifactId, accessArtifact_id, accessArtifact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "accessArtifacts"}), (b:Entity {name: "accessArtifacts"})
CREATE (a)-[:REFERENCES {fields: "accessArtifact_id, accessArtifact_id, accessArtifact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "accessDeliveryLinks"}), (b:Entity {name: "accessArtifacts"})
CREATE (a)-[:REFERENCES {fields: "accessArtifactId, accessArtifact_id, accessArtifact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "accessResaleListings"}), (b:Entity {name: "accessArtifacts"})
CREATE (a)-[:REFERENCES {fields: "accessArtifactId, accessArtifact_id, accessArtifact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "accessResaleListings"}), (b:Entity {name: "accessTransfers"})
CREATE (a)-[:REFERENCES {fields: "completedTransfer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "accessSecurityDecisions"}), (b:Entity {name: "accessArtifacts"})
CREATE (a)-[:REFERENCES {fields: "accessArtifact_id, accessArtifact_id, accessArtifact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "accessSecurityDecisions"}), (b:Entity {name: "accessTransfers"})
CREATE (a)-[:REFERENCES {fields: "completedTransfer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "accessSecuritySignals"}), (b:Entity {name: "accessArtifacts"})
CREATE (a)-[:REFERENCES {fields: "accessArtifact_id, accessArtifact_id, accessArtifact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "accessSecuritySignals"}), (b:Entity {name: "accessTransfers"})
CREATE (a)-[:REFERENCES {fields: "completedTransfer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "accessTransferPolicies"}), (b:Entity {name: "accessArtifacts"})
CREATE (a)-[:REFERENCES {fields: "accessArtifact_id, accessArtifact_id, accessArtifact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "accessTransfers"}), (b:Entity {name: "accessArtifacts"})
CREATE (a)-[:REFERENCES {fields: "sourceAccessArtifactId, accessArtifact_id, accessArtifact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "accessTransfers"}), (b:Entity {name: "accessTransfers"})
CREATE (a)-[:REFERENCES {fields: "completedTransfer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "accessUsageWindows"}), (b:Entity {name: "accessArtifacts"})
CREATE (a)-[:REFERENCES {fields: "accessArtifactId, accessArtifact_id, accessArtifact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "adSpendDailyFacts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "adSpendDailyFacts"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "adSpendDailyFacts"}), (b:Entity {name: "channelAccounts"})
CREATE (a)-[:REFERENCES {fields: "channelAccount_id, channelAccount_id, channelAccount_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "adSpendDailyFacts"}), (b:Entity {name: "crmContacts"})
CREATE (a)-[:REFERENCES {fields: "memberCrmContact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "apiAccessTokens"}), (b:Entity {name: "apiCredentials"})
CREATE (a)-[:REFERENCES {fields: "apiCredentialId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "arInvoices"}), (b:Entity {name: "billingAccounts"})
CREATE (a)-[:REFERENCES {fields: "billingAccountId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "arInvoices"}), (b:Entity {name: "purchaseOrders"})
CREATE (a)-[:REFERENCES {fields: "purchaseOrderId, purchaseOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "assessmentAttempts"}), (b:Entity {name: "assessmentTemplates"})
CREATE (a)-[:REFERENCES {fields: "assessmentTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "assessmentItems"}), (b:Entity {name: "assessmentTemplates"})
CREATE (a)-[:REFERENCES {fields: "assessmentTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "assessmentResponses"}), (b:Entity {name: "assessmentAttempts"})
CREATE (a)-[:REFERENCES {fields: "assessmentAttemptId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "assessmentResponses"}), (b:Entity {name: "assessmentItems"})
CREATE (a)-[:REFERENCES {fields: "assessmentItemId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "assessmentResponses"}), (b:Entity {name: "assessmentTemplates"})
CREATE (a)-[:REFERENCES {fields: "assessmentTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "assessmentResults"}), (b:Entity {name: "assessmentAttempts"})
CREATE (a)-[:REFERENCES {fields: "assessmentAttemptId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "assessmentResults"}), (b:Entity {name: "assessmentTemplates"})
CREATE (a)-[:REFERENCES {fields: "assessmentTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "asyncDeliverables"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "asyncDeliverables"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "asyncDeliverables"}), (b:Entity {name: "users"})
CREATE (a)-[:REFERENCES {fields: "assignedToUser_id, assignedToUser_id, deciderUser_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "asyncDeliverables"}), (b:Entity {name: "workflowSteps"})
CREATE (a)-[:REFERENCES {fields: "workflowStep_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "auctions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, bidderBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "auctions"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "auditEvents"}), (b:Entity {name: "auditEvents"})
CREATE (a)-[:REFERENCES {fields: "firstBrokenEvent_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "auditEvents"}), (b:Entity {name: "auditStreams"})
CREATE (a)-[:REFERENCES {fields: "streamId, stream_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "auditIntegrityRuns"}), (b:Entity {name: "auditEvents"})
CREATE (a)-[:REFERENCES {fields: "firstBrokenEvent_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "auditIntegrityRuns"}), (b:Entity {name: "auditStreams"})
CREATE (a)-[:REFERENCES {fields: "streamId, stream_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "auditStreams"}), (b:Entity {name: "auditStreams"})
CREATE (a)-[:REFERENCES {fields: "stream_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "authzRoleAssignments"}), (b:Entity {name: "authzRoleDefinitions"})
CREATE (a)-[:REFERENCES {fields: "roleDefinitionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "authzRolePermissions"}), (b:Entity {name: "authzPermissionDefinitions"})
CREATE (a)-[:REFERENCES {fields: "permissionDefinitionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "authzRolePermissions"}), (b:Entity {name: "authzRoleDefinitions"})
CREATE (a)-[:REFERENCES {fields: "roleDefinitionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "autocollectionAttempts"}), (b:Entity {name: "arInvoices"})
CREATE (a)-[:REFERENCES {fields: "arInvoiceId, arInvoice_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "autocollectionAttempts"}), (b:Entity {name: "billingAccountAutopayRules"})
CREATE (a)-[:REFERENCES {fields: "billingAccountAutopayRuleId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "autocollectionAttempts"}), (b:Entity {name: "billingAccounts"})
CREATE (a)-[:REFERENCES {fields: "billingAccountId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "autocollectionAttempts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "autocollectionAttempts"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntent_id, paymentIntent_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "autocollectionAttempts"}), (b:Entity {name: "paymentMethods"})
CREATE (a)-[:REFERENCES {fields: "paymentMethod_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityDependencyRuleTargets"}), (b:Entity {name: "availabilityDependencyRules"})
CREATE (a)-[:REFERENCES {fields: "availabilityDependencyRuleId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityDependencyRuleTargets"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityDependencyRuleTargets"}), (b:Entity {name: "calendarOverlays"})
CREATE (a)-[:REFERENCES {fields: "overlay_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityDependencyRuleTargets"}), (b:Entity {name: "calendars"})
CREATE (a)-[:REFERENCES {fields: "calendar_id, calendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityDependencyRuleTargets"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityDependencyRuleTargets"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id, offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityDependencyRuleTargets"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id, offer_id, offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityDependencyRuleTargets"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id, product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityDependencyRuleTargets"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityDependencyRuleTargets"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id, sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityDependencyRuleTargets"}), (b:Entity {name: "services"})
CREATE (a)-[:REFERENCES {fields: "service_id, service_id, service_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityDependencyRules"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityDependencyRules"}), (b:Entity {name: "calendarOverlays"})
CREATE (a)-[:REFERENCES {fields: "overlay_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityDependencyRules"}), (b:Entity {name: "calendars"})
CREATE (a)-[:REFERENCES {fields: "dependentCalendarId, calendar_id, calendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityDependencyRules"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityDependencyRules"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id, offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityDependencyRules"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id, offer_id, offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityDependencyRules"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id, product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityDependencyRules"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityDependencyRules"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id, sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityDependencyRules"}), (b:Entity {name: "services"})
CREATE (a)-[:REFERENCES {fields: "service_id, service_id, service_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityGates"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityGates"}), (b:Entity {name: "calendarOverlays"})
CREATE (a)-[:REFERENCES {fields: "overlay_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityGates"}), (b:Entity {name: "calendars"})
CREATE (a)-[:REFERENCES {fields: "calendarId, calendar_id, calendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityGates"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityGates"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id, offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityGates"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id, offer_id, offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityGates"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id, product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityGates"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityGates"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id, sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityGates"}), (b:Entity {name: "services"})
CREATE (a)-[:REFERENCES {fields: "service_id, service_id, service_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityResolutionRuns"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityResolutionRuns"}), (b:Entity {name: "calendarOverlays"})
CREATE (a)-[:REFERENCES {fields: "overlay_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityResolutionRuns"}), (b:Entity {name: "calendars"})
CREATE (a)-[:REFERENCES {fields: "calendarId, calendar_id, calendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityResolutionRuns"}), (b:Entity {name: "capacityPools"})
CREATE (a)-[:REFERENCES {fields: "capacityPool_id, capacityPool_id, capacityPool_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityResolutionRuns"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityResolutionRuns"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id, offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityResolutionRuns"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id, offer_id, offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityResolutionRuns"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id, product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityResolutionRuns"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityResolutionRuns"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id, sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityResolutionRuns"}), (b:Entity {name: "services"})
CREATE (a)-[:REFERENCES {fields: "service_id, service_id, service_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleExclusionDates"}), (b:Entity {name: "availabilityRules"})
CREATE (a)-[:REFERENCES {fields: "availabilityRuleId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleExclusionDates"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleExclusionDates"}), (b:Entity {name: "calendarOverlays"})
CREATE (a)-[:REFERENCES {fields: "overlay_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleExclusionDates"}), (b:Entity {name: "calendars"})
CREATE (a)-[:REFERENCES {fields: "calendar_id, calendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleExclusionDates"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleExclusionDates"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id, offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleExclusionDates"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id, offer_id, offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleExclusionDates"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id, product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleExclusionDates"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleExclusionDates"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id, sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleExclusionDates"}), (b:Entity {name: "services"})
CREATE (a)-[:REFERENCES {fields: "service_id, service_id, service_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleTemplateItems"}), (b:Entity {name: "availabilityRuleTemplates"})
CREATE (a)-[:REFERENCES {fields: "availabilityRuleTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleTemplateItems"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleTemplateItems"}), (b:Entity {name: "calendars"})
CREATE (a)-[:REFERENCES {fields: "calendar_id, calendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleTemplateItems"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleTemplateItems"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id, offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleTemplateItems"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id, offer_id, offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleTemplateItems"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id, product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleTemplateItems"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleTemplateItems"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id, sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleTemplateItems"}), (b:Entity {name: "services"})
CREATE (a)-[:REFERENCES {fields: "service_id, service_id, service_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleTemplates"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleTemplates"}), (b:Entity {name: "calendars"})
CREATE (a)-[:REFERENCES {fields: "calendar_id, calendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleTemplates"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "locationId, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleTemplates"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id, offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleTemplates"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id, offer_id, offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleTemplates"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id, product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleTemplates"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleTemplates"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id, sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRuleTemplates"}), (b:Entity {name: "services"})
CREATE (a)-[:REFERENCES {fields: "service_id, service_id, service_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRules"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRules"}), (b:Entity {name: "calendarOverlays"})
CREATE (a)-[:REFERENCES {fields: "overlayId, overlay_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRules"}), (b:Entity {name: "calendars"})
CREATE (a)-[:REFERENCES {fields: "calendarId, calendar_id, calendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRules"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRules"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id, offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRules"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id, offer_id, offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRules"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id, product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRules"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRules"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id, sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "availabilityRules"}), (b:Entity {name: "services"})
CREATE (a)-[:REFERENCES {fields: "service_id, service_id, service_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bids"}), (b:Entity {name: "auctions"})
CREATE (a)-[:REFERENCES {fields: "auctionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bids"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, bidderBizId, bidderBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bids"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "billingAccountAutopayRules"}), (b:Entity {name: "arInvoices"})
CREATE (a)-[:REFERENCES {fields: "arInvoice_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "billingAccountAutopayRules"}), (b:Entity {name: "billingAccounts"})
CREATE (a)-[:REFERENCES {fields: "billingAccountId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "billingAccountAutopayRules"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "billingAccountAutopayRules"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntent_id, paymentIntent_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "billingAccountAutopayRules"}), (b:Entity {name: "paymentMethods"})
CREATE (a)-[:REFERENCES {fields: "paymentMethod_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizConfigBindings"}), (b:Entity {name: "bizConfigBindings"})
CREATE (a)-[:REFERENCES {fields: "configBinding_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizConfigBindings"}), (b:Entity {name: "bizConfigSets"})
CREATE (a)-[:REFERENCES {fields: "configSetId, configSet_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizConfigBindings"}), (b:Entity {name: "bizConfigValues"})
CREATE (a)-[:REFERENCES {fields: "configValue_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizConfigPromotionRunItems"}), (b:Entity {name: "bizConfigBindings"})
CREATE (a)-[:REFERENCES {fields: "configBinding_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizConfigPromotionRunItems"}), (b:Entity {name: "bizConfigPromotionRuns"})
CREATE (a)-[:REFERENCES {fields: "promotionRunId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizConfigPromotionRunItems"}), (b:Entity {name: "bizConfigSets"})
CREATE (a)-[:REFERENCES {fields: "configSet_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizConfigPromotionRunItems"}), (b:Entity {name: "bizConfigValues"})
CREATE (a)-[:REFERENCES {fields: "configValue_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizConfigPromotionRuns"}), (b:Entity {name: "bizConfigBindings"})
CREATE (a)-[:REFERENCES {fields: "configBinding_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizConfigPromotionRuns"}), (b:Entity {name: "bizConfigSets"})
CREATE (a)-[:REFERENCES {fields: "configSet_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizConfigPromotionRuns"}), (b:Entity {name: "bizConfigValues"})
CREATE (a)-[:REFERENCES {fields: "configValue_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizConfigSets"}), (b:Entity {name: "bizConfigSets"})
CREATE (a)-[:REFERENCES {fields: "configSet_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizConfigValueLocalizations"}), (b:Entity {name: "bizConfigSets"})
CREATE (a)-[:REFERENCES {fields: "configSet_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizConfigValueLocalizations"}), (b:Entity {name: "bizConfigValues"})
CREATE (a)-[:REFERENCES {fields: "configValueId, configValue_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizConfigValues"}), (b:Entity {name: "bizConfigSets"})
CREATE (a)-[:REFERENCES {fields: "configSetId, configSet_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizConfigValues"}), (b:Entity {name: "bizConfigValues"})
CREATE (a)-[:REFERENCES {fields: "configValue_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizCredentialRequestItems"}), (b:Entity {name: "bizCredentialRequests"})
CREATE (a)-[:REFERENCES {fields: "bizCredentialRequestId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizCredentialRequestItems"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, verifierBiz_id, granteeBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizCredentialRequestItems"}), (b:Entity {name: "userCredentialRecords"})
CREATE (a)-[:REFERENCES {fields: "credentialRecord_id, credentialRecord_id, credentialRecord_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizCredentialRequests"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, verifierBiz_id, granteeBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizCredentialRequests"}), (b:Entity {name: "userCredentialRecords"})
CREATE (a)-[:REFERENCES {fields: "credentialRecord_id, credentialRecord_id, credentialRecord_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizCredentialShareGrantSelectors"}), (b:Entity {name: "bizCredentialShareGrants"})
CREATE (a)-[:REFERENCES {fields: "bizCredentialShareGrantId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizCredentialShareGrantSelectors"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "granteeBizId, verifierBiz_id, granteeBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizCredentialShareGrantSelectors"}), (b:Entity {name: "userCredentialRecords"})
CREATE (a)-[:REFERENCES {fields: "credentialRecord_id, credentialRecord_id, credentialRecord_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizCredentialShareGrants"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "granteeBizId, verifierBiz_id, granteeBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizCredentialShareGrants"}), (b:Entity {name: "userCredentialRecords"})
CREATE (a)-[:REFERENCES {fields: "credentialRecord_id, credentialRecord_id, credentialRecord_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizExtensionInstalls"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizExtensionInstalls"}), (b:Entity {name: "extensionDefinitions"})
CREATE (a)-[:REFERENCES {fields: "extensionDefinitionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizExtensionPermissionGrants"}), (b:Entity {name: "bizExtensionInstalls"})
CREATE (a)-[:REFERENCES {fields: "bizExtensionInstallId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizExtensionPermissionGrants"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bizExtensionPermissionGrants"}), (b:Entity {name: "extensionPermissionDefinitions"})
CREATE (a)-[:REFERENCES {fields: "extensionPermissionDefinitionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bookingOrderLineSellables"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bookingOrderLineSellables"}), (b:Entity {name: "bookingOrderLines"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderLineId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bookingOrderLineSellables"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bookingOrderLineSellables"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bookingOrderLineSellables"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bookingOrderLineSellables"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellableId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bookingOrderLines"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bookingOrderLines"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bookingOrders"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bookingOrders"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bookingParticipantObligations"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "bookingParticipantObligations"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "breachNotifications"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "breachNotifications"}), (b:Entity {name: "phiAccessPolicies"})
CREATE (a)-[:REFERENCES {fields: "phiAccessPolicy_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "breachNotifications"}), (b:Entity {name: "securityIncidents"})
CREATE (a)-[:REFERENCES {fields: "securityIncidentId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "breakGlassReviews"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "breakGlassReviews"}), (b:Entity {name: "phiAccessEvents"})
CREATE (a)-[:REFERENCES {fields: "phiAccessEventId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "breakGlassReviews"}), (b:Entity {name: "phiAccessPolicies"})
CREATE (a)-[:REFERENCES {fields: "phiAccessPolicy_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "businessAssociateAgreements"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarAccessGrantSources"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "granteeBizId, sourceBizId, sourceBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarAccessGrantSources"}), (b:Entity {name: "calendarAccessGrants"})
CREATE (a)-[:REFERENCES {fields: "calendarAccessGrantId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarAccessGrantSources"}), (b:Entity {name: "externalCalendars"})
CREATE (a)-[:REFERENCES {fields: "externalCalendarId, externalCalendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarAccessGrants"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "granteeBizId, sourceBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarAccessGrants"}), (b:Entity {name: "externalCalendars"})
CREATE (a)-[:REFERENCES {fields: "externalCalendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarBindings"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarBindings"}), (b:Entity {name: "calendars"})
CREATE (a)-[:REFERENCES {fields: "calendarId, calendar_id, calendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarBindings"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "locationId, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarBindings"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersionId, offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarBindings"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offerId, offer_id, offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarBindings"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id, product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarBindings"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resourceId, resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarBindings"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id, sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarBindings"}), (b:Entity {name: "services"})
CREATE (a)-[:REFERENCES {fields: "serviceId, service_id, service_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarOverlays"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarOverlays"}), (b:Entity {name: "calendarOverlays"})
CREATE (a)-[:REFERENCES {fields: "overlay_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarOverlays"}), (b:Entity {name: "calendars"})
CREATE (a)-[:REFERENCES {fields: "calendarId, calendar_id, calendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarOverlays"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarOverlays"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id, offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarOverlays"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id, offer_id, offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarOverlays"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id, product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarOverlays"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarOverlays"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id, sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarOverlays"}), (b:Entity {name: "services"})
CREATE (a)-[:REFERENCES {fields: "service_id, service_id, service_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarOwnerTimelineEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarOwnerTimelineEvents"}), (b:Entity {name: "calendarOverlays"})
CREATE (a)-[:REFERENCES {fields: "overlay_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarOwnerTimelineEvents"}), (b:Entity {name: "calendars"})
CREATE (a)-[:REFERENCES {fields: "calendarId, calendar_id, calendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarOwnerTimelineEvents"}), (b:Entity {name: "capacityPools"})
CREATE (a)-[:REFERENCES {fields: "capacityPool_id, capacityPool_id, capacityPool_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarOwnerTimelineEvents"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarOwnerTimelineEvents"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id, offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarOwnerTimelineEvents"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id, offer_id, offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarOwnerTimelineEvents"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id, product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarOwnerTimelineEvents"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarOwnerTimelineEvents"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id, sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarOwnerTimelineEvents"}), (b:Entity {name: "services"})
CREATE (a)-[:REFERENCES {fields: "service_id, service_id, service_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRevisions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRevisions"}), (b:Entity {name: "calendarOverlays"})
CREATE (a)-[:REFERENCES {fields: "overlay_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRevisions"}), (b:Entity {name: "calendars"})
CREATE (a)-[:REFERENCES {fields: "calendar_id, calendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRevisions"}), (b:Entity {name: "capacityPools"})
CREATE (a)-[:REFERENCES {fields: "capacityPool_id, capacityPool_id, capacityPool_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRevisions"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRevisions"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id, offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRevisions"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id, offer_id, offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRevisions"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id, product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRevisions"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRevisions"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id, sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRevisions"}), (b:Entity {name: "services"})
CREATE (a)-[:REFERENCES {fields: "service_id, service_id, service_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRuleTemplateBindingExclusionDates"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRuleTemplateBindingExclusionDates"}), (b:Entity {name: "calendarRuleTemplateBindings"})
CREATE (a)-[:REFERENCES {fields: "calendarRuleTemplateBindingId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRuleTemplateBindingExclusionDates"}), (b:Entity {name: "calendars"})
CREATE (a)-[:REFERENCES {fields: "calendar_id, calendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRuleTemplateBindingExclusionDates"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRuleTemplateBindingExclusionDates"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id, offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRuleTemplateBindingExclusionDates"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id, offer_id, offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRuleTemplateBindingExclusionDates"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id, product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRuleTemplateBindingExclusionDates"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRuleTemplateBindingExclusionDates"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id, sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRuleTemplateBindingExclusionDates"}), (b:Entity {name: "services"})
CREATE (a)-[:REFERENCES {fields: "service_id, service_id, service_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRuleTemplateBindings"}), (b:Entity {name: "availabilityRuleTemplates"})
CREATE (a)-[:REFERENCES {fields: "availabilityRuleTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRuleTemplateBindings"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRuleTemplateBindings"}), (b:Entity {name: "calendars"})
CREATE (a)-[:REFERENCES {fields: "calendarId, calendar_id, calendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRuleTemplateBindings"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRuleTemplateBindings"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id, offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRuleTemplateBindings"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id, offer_id, offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRuleTemplateBindings"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id, product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRuleTemplateBindings"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRuleTemplateBindings"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id, sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarRuleTemplateBindings"}), (b:Entity {name: "services"})
CREATE (a)-[:REFERENCES {fields: "service_id, service_id, service_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarSyncConnections"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "sourceBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarTimelineEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarTimelineEvents"}), (b:Entity {name: "calendarOverlays"})
CREATE (a)-[:REFERENCES {fields: "overlay_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarTimelineEvents"}), (b:Entity {name: "calendars"})
CREATE (a)-[:REFERENCES {fields: "calendarId, calendar_id, calendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarTimelineEvents"}), (b:Entity {name: "capacityPools"})
CREATE (a)-[:REFERENCES {fields: "capacityPool_id, capacityPool_id, capacityPool_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarTimelineEvents"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarTimelineEvents"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id, offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarTimelineEvents"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id, offer_id, offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarTimelineEvents"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id, product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarTimelineEvents"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarTimelineEvents"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id, sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendarTimelineEvents"}), (b:Entity {name: "services"})
CREATE (a)-[:REFERENCES {fields: "service_id, service_id, service_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendars"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendars"}), (b:Entity {name: "calendars"})
CREATE (a)-[:REFERENCES {fields: "calendar_id, calendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendars"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendars"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id, offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendars"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id, offer_id, offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendars"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id, product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendars"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendars"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id, sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "calendars"}), (b:Entity {name: "services"})
CREATE (a)-[:REFERENCES {fields: "service_id, service_id, service_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldDemandAlerts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldDemandAlerts"}), (b:Entity {name: "calendarOverlays"})
CREATE (a)-[:REFERENCES {fields: "overlay_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldDemandAlerts"}), (b:Entity {name: "calendars"})
CREATE (a)-[:REFERENCES {fields: "calendarId, calendar_id, calendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldDemandAlerts"}), (b:Entity {name: "capacityPools"})
CREATE (a)-[:REFERENCES {fields: "capacityPoolId, capacityPool_id, capacityPool_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldDemandAlerts"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "locationId, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldDemandAlerts"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersionId, offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldDemandAlerts"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offerId, offer_id, offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldDemandAlerts"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "productId, product_id, product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldDemandAlerts"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resourceId, resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldDemandAlerts"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellableId, sellable_id, sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldDemandAlerts"}), (b:Entity {name: "services"})
CREATE (a)-[:REFERENCES {fields: "serviceId, service_id, service_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldEvents"}), (b:Entity {name: "calendarOverlays"})
CREATE (a)-[:REFERENCES {fields: "overlay_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldEvents"}), (b:Entity {name: "calendars"})
CREATE (a)-[:REFERENCES {fields: "calendar_id, calendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldEvents"}), (b:Entity {name: "capacityPools"})
CREATE (a)-[:REFERENCES {fields: "capacityPool_id, capacityPool_id, capacityPool_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldEvents"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldEvents"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id, offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldEvents"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id, offer_id, offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldEvents"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id, product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldEvents"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldEvents"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id, sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldEvents"}), (b:Entity {name: "services"})
CREATE (a)-[:REFERENCES {fields: "service_id, service_id, service_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldPolicies"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldPolicies"}), (b:Entity {name: "calendarOverlays"})
CREATE (a)-[:REFERENCES {fields: "overlay_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldPolicies"}), (b:Entity {name: "calendars"})
CREATE (a)-[:REFERENCES {fields: "calendar_id, calendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldPolicies"}), (b:Entity {name: "capacityPools"})
CREATE (a)-[:REFERENCES {fields: "capacityPool_id, capacityPool_id, capacityPool_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldPolicies"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldPolicies"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id, offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldPolicies"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id, offer_id, offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldPolicies"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id, product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldPolicies"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldPolicies"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id, sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHoldPolicies"}), (b:Entity {name: "services"})
CREATE (a)-[:REFERENCES {fields: "service_id, service_id, service_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHolds"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHolds"}), (b:Entity {name: "calendarOverlays"})
CREATE (a)-[:REFERENCES {fields: "overlay_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHolds"}), (b:Entity {name: "calendars"})
CREATE (a)-[:REFERENCES {fields: "calendarId, calendar_id, calendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHolds"}), (b:Entity {name: "capacityPools"})
CREATE (a)-[:REFERENCES {fields: "capacityPoolId, capacityPool_id, capacityPool_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHolds"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHolds"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersionId, offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHolds"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id, offer_id, offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHolds"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id, product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHolds"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resourceId, resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHolds"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id, sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityHolds"}), (b:Entity {name: "services"})
CREATE (a)-[:REFERENCES {fields: "service_id, service_id, service_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityPoolMembers"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityPoolMembers"}), (b:Entity {name: "calendarOverlays"})
CREATE (a)-[:REFERENCES {fields: "overlay_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityPoolMembers"}), (b:Entity {name: "calendars"})
CREATE (a)-[:REFERENCES {fields: "calendar_id, calendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityPoolMembers"}), (b:Entity {name: "capacityPools"})
CREATE (a)-[:REFERENCES {fields: "capacityPoolId, capacityPool_id, capacityPool_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityPoolMembers"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "locationId, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityPoolMembers"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersionId, offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityPoolMembers"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id, offer_id, offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityPoolMembers"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id, product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityPoolMembers"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resourceId, resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityPoolMembers"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id, sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityPoolMembers"}), (b:Entity {name: "services"})
CREATE (a)-[:REFERENCES {fields: "service_id, service_id, service_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityPools"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityPools"}), (b:Entity {name: "calendarOverlays"})
CREATE (a)-[:REFERENCES {fields: "overlay_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityPools"}), (b:Entity {name: "calendars"})
CREATE (a)-[:REFERENCES {fields: "calendar_id, calendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityPools"}), (b:Entity {name: "capacityPools"})
CREATE (a)-[:REFERENCES {fields: "capacityPool_id, capacityPool_id, capacityPool_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityPools"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityPools"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id, offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityPools"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id, offer_id, offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityPools"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id, product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityPools"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityPools"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id, sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "capacityPools"}), (b:Entity {name: "services"})
CREATE (a)-[:REFERENCES {fields: "service_id, service_id, service_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "certificationAwards"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "certificationAwards"}), (b:Entity {name: "certificationTemplates"})
CREATE (a)-[:REFERENCES {fields: "certificationTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "certificationAwards"}), (b:Entity {name: "cohortEnrollments"})
CREATE (a)-[:REFERENCES {fields: "enrollmentId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "certificationTemplates"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "certificationTemplates"}), (b:Entity {name: "programs"})
CREATE (a)-[:REFERENCES {fields: "programId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "channelAccounts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "channelEntityLinks"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "channelEntityLinks"}), (b:Entity {name: "channelAccounts"})
CREATE (a)-[:REFERENCES {fields: "channelAccountId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "channelSyncItems"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "channelSyncItems"}), (b:Entity {name: "channelSyncJobs"})
CREATE (a)-[:REFERENCES {fields: "channelSyncJobId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "channelSyncJobs"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "channelSyncJobs"}), (b:Entity {name: "channelAccounts"})
CREATE (a)-[:REFERENCES {fields: "channelAccountId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "channelSyncStates"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "channelSyncStates"}), (b:Entity {name: "channelAccounts"})
CREATE (a)-[:REFERENCES {fields: "channelAccountId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "channelWebhookEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "channelWebhookEvents"}), (b:Entity {name: "channelAccounts"})
CREATE (a)-[:REFERENCES {fields: "channelAccountId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "checkoutRecoveryLinks"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "checkoutRecoveryLinks"}), (b:Entity {name: "checkoutSessions"})
CREATE (a)-[:REFERENCES {fields: "checkoutSessionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "checkoutSessionEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "checkoutSessionEvents"}), (b:Entity {name: "checkoutSessions"})
CREATE (a)-[:REFERENCES {fields: "checkoutSessionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "checkoutSessionItems"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "checkoutSessionItems"}), (b:Entity {name: "checkoutSessions"})
CREATE (a)-[:REFERENCES {fields: "checkoutSessionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "checkoutSessions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "cohortEnrollments"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "cohortEnrollments"}), (b:Entity {name: "programCohorts"})
CREATE (a)-[:REFERENCES {fields: "cohortId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "commitmentClaimEvents"}), (b:Entity {name: "arInvoices"})
CREATE (a)-[:REFERENCES {fields: "arInvoice_id, arInvoice_id, arInvoice_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "commitmentClaimEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "commitmentClaimEvents"}), (b:Entity {name: "commitmentClaims"})
CREATE (a)-[:REFERENCES {fields: "commitmentClaimId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "commitmentClaims"}), (b:Entity {name: "arInvoices"})
CREATE (a)-[:REFERENCES {fields: "arInvoice_id, arInvoice_id, arInvoice_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "commitmentClaims"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "commitmentClaims"}), (b:Entity {name: "commitmentContracts"})
CREATE (a)-[:REFERENCES {fields: "commitmentContractId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "commitmentContracts"}), (b:Entity {name: "arInvoices"})
CREATE (a)-[:REFERENCES {fields: "arInvoice_id, arInvoice_id, arInvoice_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "commitmentContracts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "commitmentMilestoneObligations"}), (b:Entity {name: "arInvoices"})
CREATE (a)-[:REFERENCES {fields: "arInvoice_id, arInvoice_id, arInvoice_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "commitmentMilestoneObligations"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "commitmentMilestoneObligations"}), (b:Entity {name: "commitmentContracts"})
CREATE (a)-[:REFERENCES {fields: "commitmentContractId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "commitmentMilestoneObligations"}), (b:Entity {name: "commitmentMilestones"})
CREATE (a)-[:REFERENCES {fields: "commitmentMilestoneId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "commitmentMilestoneObligations"}), (b:Entity {name: "commitmentObligations"})
CREATE (a)-[:REFERENCES {fields: "commitmentObligationId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "commitmentMilestones"}), (b:Entity {name: "arInvoices"})
CREATE (a)-[:REFERENCES {fields: "arInvoice_id, arInvoice_id, arInvoice_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "commitmentMilestones"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "commitmentMilestones"}), (b:Entity {name: "commitmentContracts"})
CREATE (a)-[:REFERENCES {fields: "commitmentContractId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "commitmentObligations"}), (b:Entity {name: "arInvoices"})
CREATE (a)-[:REFERENCES {fields: "arInvoice_id, arInvoice_id, arInvoice_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "commitmentObligations"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "commitmentObligations"}), (b:Entity {name: "commitmentContracts"})
CREATE (a)-[:REFERENCES {fields: "commitmentContractId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "communicationConsents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "compensationAssignmentRoles"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "compensationAssignmentRoles"}), (b:Entity {name: "compensationRoleTemplates"})
CREATE (a)-[:REFERENCES {fields: "roleTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "compensationLedgerEntries"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "compensationPayRunItemEntries"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "compensationPayRunItemEntries"}), (b:Entity {name: "compensationLedgerEntries"})
CREATE (a)-[:REFERENCES {fields: "compensationLedgerEntryId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "compensationPayRunItemEntries"}), (b:Entity {name: "compensationPayRunItems"})
CREATE (a)-[:REFERENCES {fields: "compensationPayRunItemId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "compensationPayRunItems"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "compensationPayRunItems"}), (b:Entity {name: "compensationPayRuns"})
CREATE (a)-[:REFERENCES {fields: "compensationPayRunId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "compensationPayRuns"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "compensationPlanRules"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "compensationPlanRules"}), (b:Entity {name: "compensationPlanVersions"})
CREATE (a)-[:REFERENCES {fields: "compensationPlanVersionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "compensationPlanVersions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "compensationPlanVersions"}), (b:Entity {name: "compensationPlans"})
CREATE (a)-[:REFERENCES {fields: "compensationPlanId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "compensationPlans"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "compensationRoleTemplates"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "credentialDisclosureEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "granteeBizId, verifierBiz_id, granteeBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "credentialDisclosureEvents"}), (b:Entity {name: "userCredentialRecords"})
CREATE (a)-[:REFERENCES {fields: "credentialRecord_id, credentialRecord_id, credentialRecord_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "credentialTypeDefinitions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "verifierBiz_id, granteeBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmContactChannels"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmContactChannels"}), (b:Entity {name: "crmContacts"})
CREATE (a)-[:REFERENCES {fields: "crmContactId, crmContact_id, crmContact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmContactChannels"}), (b:Entity {name: "outboundMessages"})
CREATE (a)-[:REFERENCES {fields: "outboundMessage_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmContacts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmContacts"}), (b:Entity {name: "crmContacts"})
CREATE (a)-[:REFERENCES {fields: "crmContact_id, crmContact_id, senderCrmContact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmContacts"}), (b:Entity {name: "outboundMessages"})
CREATE (a)-[:REFERENCES {fields: "outboundMessage_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmConversationMessages"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmConversationMessages"}), (b:Entity {name: "crmContacts"})
CREATE (a)-[:REFERENCES {fields: "crmContact_id, crmContact_id, senderCrmContact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmConversationMessages"}), (b:Entity {name: "crmConversations"})
CREATE (a)-[:REFERENCES {fields: "crmConversationId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmConversationMessages"}), (b:Entity {name: "crmLeads"})
CREATE (a)-[:REFERENCES {fields: "primaryCrmLead_id, crmLead_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmConversationMessages"}), (b:Entity {name: "crmOpportunities"})
CREATE (a)-[:REFERENCES {fields: "crmOpportunity_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmConversationMessages"}), (b:Entity {name: "crmPipelines"})
CREATE (a)-[:REFERENCES {fields: "crmPipeline_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmConversationMessages"}), (b:Entity {name: "outboundMessages"})
CREATE (a)-[:REFERENCES {fields: "outboundMessage_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmConversationParticipants"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmConversationParticipants"}), (b:Entity {name: "crmContacts"})
CREATE (a)-[:REFERENCES {fields: "crmContact_id, crmContact_id, senderCrmContact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmConversationParticipants"}), (b:Entity {name: "crmConversations"})
CREATE (a)-[:REFERENCES {fields: "crmConversationId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmConversationParticipants"}), (b:Entity {name: "crmLeads"})
CREATE (a)-[:REFERENCES {fields: "primaryCrmLead_id, crmLead_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmConversationParticipants"}), (b:Entity {name: "crmOpportunities"})
CREATE (a)-[:REFERENCES {fields: "crmOpportunity_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmConversationParticipants"}), (b:Entity {name: "crmPipelines"})
CREATE (a)-[:REFERENCES {fields: "crmPipeline_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmConversationParticipants"}), (b:Entity {name: "outboundMessages"})
CREATE (a)-[:REFERENCES {fields: "outboundMessage_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmConversations"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmConversations"}), (b:Entity {name: "crmContacts"})
CREATE (a)-[:REFERENCES {fields: "crmContact_id, crmContact_id, senderCrmContact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmConversations"}), (b:Entity {name: "crmLeads"})
CREATE (a)-[:REFERENCES {fields: "primaryCrmLead_id, crmLead_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmConversations"}), (b:Entity {name: "crmOpportunities"})
CREATE (a)-[:REFERENCES {fields: "crmOpportunity_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmConversations"}), (b:Entity {name: "crmPipelines"})
CREATE (a)-[:REFERENCES {fields: "crmPipeline_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmConversations"}), (b:Entity {name: "outboundMessages"})
CREATE (a)-[:REFERENCES {fields: "outboundMessage_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmLeadEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmLeadEvents"}), (b:Entity {name: "crmContacts"})
CREATE (a)-[:REFERENCES {fields: "crmContact_id, crmContact_id, senderCrmContact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmLeadEvents"}), (b:Entity {name: "crmLeads"})
CREATE (a)-[:REFERENCES {fields: "crmLeadId, primaryCrmLead_id, crmLead_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmLeadEvents"}), (b:Entity {name: "crmPipelines"})
CREATE (a)-[:REFERENCES {fields: "crmPipeline_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmLeadEvents"}), (b:Entity {name: "outboundMessages"})
CREATE (a)-[:REFERENCES {fields: "outboundMessage_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmLeads"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmLeads"}), (b:Entity {name: "crmContacts"})
CREATE (a)-[:REFERENCES {fields: "crmContact_id, crmContact_id, senderCrmContact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmLeads"}), (b:Entity {name: "crmLeads"})
CREATE (a)-[:REFERENCES {fields: "primaryCrmLead_id, crmLead_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmLeads"}), (b:Entity {name: "crmPipelines"})
CREATE (a)-[:REFERENCES {fields: "crmPipeline_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmLeads"}), (b:Entity {name: "outboundMessages"})
CREATE (a)-[:REFERENCES {fields: "outboundMessage_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmMergeCandidates"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmMergeCandidates"}), (b:Entity {name: "crmContacts"})
CREATE (a)-[:REFERENCES {fields: "crmContact_id, crmContact_id, senderCrmContact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmMergeCandidates"}), (b:Entity {name: "crmLeads"})
CREATE (a)-[:REFERENCES {fields: "primaryCrmLead_id, crmLead_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmMergeCandidates"}), (b:Entity {name: "crmOpportunities"})
CREATE (a)-[:REFERENCES {fields: "crmOpportunity_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmMergeCandidates"}), (b:Entity {name: "crmPipelines"})
CREATE (a)-[:REFERENCES {fields: "crmPipeline_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmMergeCandidates"}), (b:Entity {name: "outboundMessages"})
CREATE (a)-[:REFERENCES {fields: "outboundMessage_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmMergeDecisions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmMergeDecisions"}), (b:Entity {name: "crmContacts"})
CREATE (a)-[:REFERENCES {fields: "crmContact_id, crmContact_id, senderCrmContact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmMergeDecisions"}), (b:Entity {name: "crmLeads"})
CREATE (a)-[:REFERENCES {fields: "primaryCrmLead_id, crmLead_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmMergeDecisions"}), (b:Entity {name: "crmMergeCandidates"})
CREATE (a)-[:REFERENCES {fields: "crmMergeCandidateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmMergeDecisions"}), (b:Entity {name: "crmOpportunities"})
CREATE (a)-[:REFERENCES {fields: "crmOpportunity_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmMergeDecisions"}), (b:Entity {name: "crmPipelines"})
CREATE (a)-[:REFERENCES {fields: "crmPipeline_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmMergeDecisions"}), (b:Entity {name: "outboundMessages"})
CREATE (a)-[:REFERENCES {fields: "outboundMessage_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmOpportunities"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmOpportunities"}), (b:Entity {name: "crmContacts"})
CREATE (a)-[:REFERENCES {fields: "crmContact_id, crmContact_id, senderCrmContact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmOpportunities"}), (b:Entity {name: "crmLeads"})
CREATE (a)-[:REFERENCES {fields: "primaryCrmLead_id, crmLead_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmOpportunities"}), (b:Entity {name: "crmOpportunities"})
CREATE (a)-[:REFERENCES {fields: "crmOpportunity_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmOpportunities"}), (b:Entity {name: "crmPipelines"})
CREATE (a)-[:REFERENCES {fields: "crmPipeline_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmOpportunities"}), (b:Entity {name: "outboundMessages"})
CREATE (a)-[:REFERENCES {fields: "outboundMessage_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmOpportunityStageEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmOpportunityStageEvents"}), (b:Entity {name: "crmContacts"})
CREATE (a)-[:REFERENCES {fields: "crmContact_id, crmContact_id, senderCrmContact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmOpportunityStageEvents"}), (b:Entity {name: "crmLeads"})
CREATE (a)-[:REFERENCES {fields: "primaryCrmLead_id, crmLead_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmOpportunityStageEvents"}), (b:Entity {name: "crmOpportunities"})
CREATE (a)-[:REFERENCES {fields: "crmOpportunityId, crmOpportunity_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmOpportunityStageEvents"}), (b:Entity {name: "crmPipelines"})
CREATE (a)-[:REFERENCES {fields: "crmPipeline_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmOpportunityStageEvents"}), (b:Entity {name: "outboundMessages"})
CREATE (a)-[:REFERENCES {fields: "outboundMessage_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmPipelineStages"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmPipelineStages"}), (b:Entity {name: "crmContacts"})
CREATE (a)-[:REFERENCES {fields: "crmContact_id, crmContact_id, senderCrmContact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmPipelineStages"}), (b:Entity {name: "crmPipelines"})
CREATE (a)-[:REFERENCES {fields: "crmPipelineId, crmPipeline_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmPipelineStages"}), (b:Entity {name: "outboundMessages"})
CREATE (a)-[:REFERENCES {fields: "outboundMessage_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmPipelines"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmPipelines"}), (b:Entity {name: "crmContacts"})
CREATE (a)-[:REFERENCES {fields: "crmContact_id, crmContact_id, senderCrmContact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmPipelines"}), (b:Entity {name: "crmPipelines"})
CREATE (a)-[:REFERENCES {fields: "crmPipeline_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmPipelines"}), (b:Entity {name: "outboundMessages"})
CREATE (a)-[:REFERENCES {fields: "outboundMessage_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmSubjectRedirects"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmSubjectRedirects"}), (b:Entity {name: "crmContacts"})
CREATE (a)-[:REFERENCES {fields: "crmContact_id, crmContact_id, senderCrmContact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmSubjectRedirects"}), (b:Entity {name: "crmLeads"})
CREATE (a)-[:REFERENCES {fields: "primaryCrmLead_id, crmLead_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmSubjectRedirects"}), (b:Entity {name: "crmOpportunities"})
CREATE (a)-[:REFERENCES {fields: "crmOpportunity_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmSubjectRedirects"}), (b:Entity {name: "crmPipelines"})
CREATE (a)-[:REFERENCES {fields: "crmPipeline_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crmSubjectRedirects"}), (b:Entity {name: "outboundMessages"})
CREATE (a)-[:REFERENCES {fields: "outboundMessage_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crossBizContracts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, counterpartyBizId, bidderBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crossBizContracts"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crossBizContracts"}), (b:Entity {name: "crossBizContracts"})
CREATE (a)-[:REFERENCES {fields: "contract_id, contract_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crossBizOrders"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, buyerBizId, sellerBizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crossBizOrders"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crossBizOrders"}), (b:Entity {name: "crossBizContracts"})
CREATE (a)-[:REFERENCES {fields: "contractId, contract_id, contract_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "crossBizOrders"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "customFieldDefinitionOptions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "customFieldDefinitionOptions"}), (b:Entity {name: "customFieldDefinitions"})
CREATE (a)-[:REFERENCES {fields: "customFieldDefinitionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "customFieldDefinitions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "customFieldValues"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "customFieldValues"}), (b:Entity {name: "customFieldDefinitions"})
CREATE (a)-[:REFERENCES {fields: "customFieldDefinitionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "dataResidencyPolicies"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "dataSubjectRequests"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "dataSubjectRequests"}), (b:Entity {name: "legalHolds"})
CREATE (a)-[:REFERENCES {fields: "legalHold_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "demandPricingApplications"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "demandPricingApplications"}), (b:Entity {name: "demandPricingEvaluations"})
CREATE (a)-[:REFERENCES {fields: "demandPricingEvaluationId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "demandPricingEvaluations"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "demandPricingEvaluations"}), (b:Entity {name: "demandPricingPolicies"})
CREATE (a)-[:REFERENCES {fields: "demandPricingPolicyId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "demandPricingPolicies"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "demandPricingPolicySignals"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "demandPricingPolicySignals"}), (b:Entity {name: "demandPricingPolicies"})
CREATE (a)-[:REFERENCES {fields: "demandPricingPolicyId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "demandPricingPolicySignals"}), (b:Entity {name: "demandSignalDefinitions"})
CREATE (a)-[:REFERENCES {fields: "demandSignalDefinitionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "demandPricingPolicyTiers"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "demandPricingPolicyTiers"}), (b:Entity {name: "demandPricingPolicies"})
CREATE (a)-[:REFERENCES {fields: "demandPricingPolicyId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "demandSignalDefinitions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "demandSignalObservations"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "demandSignalObservations"}), (b:Entity {name: "demandSignalDefinitions"})
CREATE (a)-[:REFERENCES {fields: "demandSignalDefinitionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "discountCampaigns"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "discountCampaigns"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "discountCodes"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "discountCodes"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "discountCodes"}), (b:Entity {name: "discountCampaigns"})
CREATE (a)-[:REFERENCES {fields: "discountCampaignId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "discountCodes"}), (b:Entity {name: "discountCodes"})
CREATE (a)-[:REFERENCES {fields: "discountCode_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "discountRedemptions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "discountRedemptions"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "discountRedemptions"}), (b:Entity {name: "discountCampaigns"})
CREATE (a)-[:REFERENCES {fields: "discountCampaignId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "discountRedemptions"}), (b:Entity {name: "discountCodes"})
CREATE (a)-[:REFERENCES {fields: "discountCodeId, discountCode_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "dispatchTasks"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "dispatchTasks"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "dispatchTasks"}), (b:Entity {name: "fleetVehicles"})
CREATE (a)-[:REFERENCES {fields: "fleetVehicle_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "dispatchTasks"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "originLocation_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "dispatchTasks"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "dispatchTasks"}), (b:Entity {name: "queueEntries"})
CREATE (a)-[:REFERENCES {fields: "queueEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "dispatchTasks"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "assignedResourceId, resource_id, driverResource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "dispatchTasks"}), (b:Entity {name: "transportRouteStops"})
CREATE (a)-[:REFERENCES {fields: "routeStop_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "dispatchTasks"}), (b:Entity {name: "transportTrips"})
CREATE (a)-[:REFERENCES {fields: "tripId, trip_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "eligibilitySnapshots"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "eligibilitySnapshots"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "eligibilitySnapshots"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseAdminDelegations"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, targetBiz_id, memberBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseApprovalAuthorityLimits"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, targetBiz_id, memberBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseChangeRolloutResults"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, targetBiz_id, memberBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseChangeRolloutResults"}), (b:Entity {name: "enterpriseChangeRolloutTargets"})
CREATE (a)-[:REFERENCES {fields: "rolloutTargetId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseChangeRolloutRuns"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, targetBiz_id, memberBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseChangeRolloutTargets"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, targetBiz_id, memberBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseChangeRolloutTargets"}), (b:Entity {name: "enterpriseChangeRolloutRuns"})
CREATE (a)-[:REFERENCES {fields: "rolloutRunId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseChangeRolloutTargets"}), (b:Entity {name: "enterpriseScopes"})
CREATE (a)-[:REFERENCES {fields: "scopeId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseContractPackBindings"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, targetBiz_id, memberBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseContractPackBindings"}), (b:Entity {name: "enterpriseContractPackVersions"})
CREATE (a)-[:REFERENCES {fields: "contractPackVersionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseContractPackBindings"}), (b:Entity {name: "enterpriseScopes"})
CREATE (a)-[:REFERENCES {fields: "scopeId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseContractPackTemplates"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, targetBiz_id, memberBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseContractPackVersions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, targetBiz_id, memberBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseContractPackVersions"}), (b:Entity {name: "enterpriseContractPackTemplates"})
CREATE (a)-[:REFERENCES {fields: "contractPackTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseExternalDirectoryLinks"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, targetBiz_id, memberBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseExternalDirectoryLinks"}), (b:Entity {name: "enterpriseIdentityProviders"})
CREATE (a)-[:REFERENCES {fields: "identityProviderId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseIdentityProviders"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, targetBiz_id, memberBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseInheritanceResolutions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, targetBiz_id, memberBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseInheritanceResolutions"}), (b:Entity {name: "enterpriseInheritanceStrategies"})
CREATE (a)-[:REFERENCES {fields: "strategyId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseInheritanceResolutions"}), (b:Entity {name: "enterpriseScopes"})
CREATE (a)-[:REFERENCES {fields: "scopeId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseInheritanceStrategies"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, targetBiz_id, memberBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseIntercompanyAccounts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, sourceBizId, counterpartyBizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseIntercompanyEntries"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, targetBiz_id, memberBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseIntercompanyEntries"}), (b:Entity {name: "enterpriseIntercompanyAccounts"})
CREATE (a)-[:REFERENCES {fields: "intercompanyAccountId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseIntercompanySettlementRuns"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, targetBiz_id, memberBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseIntercompanySettlementRuns"}), (b:Entity {name: "enterpriseIntercompanyAccounts"})
CREATE (a)-[:REFERENCES {fields: "intercompanyAccountId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseRelationshipTemplates"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, targetBiz_id, memberBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseRelationships"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, fromBizId, toBizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseRelationships"}), (b:Entity {name: "enterpriseRelationshipTemplates"})
CREATE (a)-[:REFERENCES {fields: "relationshipTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseScimSyncStates"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, targetBiz_id, memberBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseScimSyncStates"}), (b:Entity {name: "enterpriseIdentityProviders"})
CREATE (a)-[:REFERENCES {fields: "identityProviderId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "enterpriseScopes"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, targetBiz_id, memberBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "entitlementGrants"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "entitlementGrants"}), (b:Entity {name: "entitlementGrants"})
CREATE (a)-[:REFERENCES {fields: "grant_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "entitlementGrants"}), (b:Entity {name: "entitlementWallets"})
CREATE (a)-[:REFERENCES {fields: "walletId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "entitlementGrants"}), (b:Entity {name: "membershipPlans"})
CREATE (a)-[:REFERENCES {fields: "membershipPlan_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "entitlementGrants"}), (b:Entity {name: "memberships"})
CREATE (a)-[:REFERENCES {fields: "membershipId, membership_id, membership_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "entitlementLedgerEntries"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "entitlementLedgerEntries"}), (b:Entity {name: "entitlementGrants"})
CREATE (a)-[:REFERENCES {fields: "grantId, grant_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "entitlementLedgerEntries"}), (b:Entity {name: "entitlementTransfers"})
CREATE (a)-[:REFERENCES {fields: "transferId, transfer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "entitlementLedgerEntries"}), (b:Entity {name: "entitlementWallets"})
CREATE (a)-[:REFERENCES {fields: "walletId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "entitlementLedgerEntries"}), (b:Entity {name: "membershipPlans"})
CREATE (a)-[:REFERENCES {fields: "membershipPlan_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "entitlementLedgerEntries"}), (b:Entity {name: "memberships"})
CREATE (a)-[:REFERENCES {fields: "membership_id, membership_id, membership_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "entitlementTransfers"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "entitlementTransfers"}), (b:Entity {name: "entitlementGrants"})
CREATE (a)-[:REFERENCES {fields: "grant_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "entitlementTransfers"}), (b:Entity {name: "entitlementTransfers"})
CREATE (a)-[:REFERENCES {fields: "transfer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "entitlementTransfers"}), (b:Entity {name: "entitlementWallets"})
CREATE (a)-[:REFERENCES {fields: "fromWalletId, toWalletId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "entitlementTransfers"}), (b:Entity {name: "membershipPlans"})
CREATE (a)-[:REFERENCES {fields: "membershipPlan_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "entitlementTransfers"}), (b:Entity {name: "memberships"})
CREATE (a)-[:REFERENCES {fields: "membership_id, membership_id, membership_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "entitlementWallets"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "entitlementWallets"}), (b:Entity {name: "membershipPlans"})
CREATE (a)-[:REFERENCES {fields: "membershipPlan_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "entitlementWallets"}), (b:Entity {name: "memberships"})
CREATE (a)-[:REFERENCES {fields: "membershipId, membership_id, membership_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "etaEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "etaEvents"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "etaEvents"}), (b:Entity {name: "fleetVehicles"})
CREATE (a)-[:REFERENCES {fields: "fleetVehicle_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "etaEvents"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "originLocation_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "etaEvents"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "etaEvents"}), (b:Entity {name: "queueEntries"})
CREATE (a)-[:REFERENCES {fields: "queueEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "etaEvents"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, driverResource_id, assignedResource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "etaEvents"}), (b:Entity {name: "transportRouteStops"})
CREATE (a)-[:REFERENCES {fields: "routeStopId, routeStop_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "etaEvents"}), (b:Entity {name: "transportTrips"})
CREATE (a)-[:REFERENCES {fields: "tripId, trip_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "extensionApiCallRuns"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "extensionApiCallRuns"}), (b:Entity {name: "extensionServiceConnections"})
CREATE (a)-[:REFERENCES {fields: "extensionServiceConnectionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "extensionInstances"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "extensionInstances"}), (b:Entity {name: "extensionDefinitions"})
CREATE (a)-[:REFERENCES {fields: "extensionDefinitionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "extensionPermissionDefinitions"}), (b:Entity {name: "extensionDefinitions"})
CREATE (a)-[:REFERENCES {fields: "extensionDefinitionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "extensionServiceConnections"}), (b:Entity {name: "bizExtensionInstalls"})
CREATE (a)-[:REFERENCES {fields: "bizExtensionInstallId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "extensionServiceConnections"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "extensionServiceObjectLinks"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "extensionServiceObjectLinks"}), (b:Entity {name: "extensionServiceConnections"})
CREATE (a)-[:REFERENCES {fields: "extensionServiceConnectionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "extensionServiceSyncItems"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "extensionServiceSyncItems"}), (b:Entity {name: "extensionServiceSyncJobs"})
CREATE (a)-[:REFERENCES {fields: "extensionServiceSyncJobId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "extensionServiceSyncJobs"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "extensionServiceSyncJobs"}), (b:Entity {name: "extensionServiceConnections"})
CREATE (a)-[:REFERENCES {fields: "extensionServiceConnectionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "extensionStateDocuments"}), (b:Entity {name: "bizExtensionInstalls"})
CREATE (a)-[:REFERENCES {fields: "bizExtensionInstallId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "extensionStateDocuments"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "extensionWebhookIngressEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "extensionWebhookIngressEvents"}), (b:Entity {name: "extensionServiceConnections"})
CREATE (a)-[:REFERENCES {fields: "extensionServiceConnectionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "externalCalendarEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "sourceBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "externalCalendarEvents"}), (b:Entity {name: "externalCalendars"})
CREATE (a)-[:REFERENCES {fields: "externalCalendarId, externalCalendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "externalCalendars"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "sourceBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "externalCalendars"}), (b:Entity {name: "calendarSyncConnections"})
CREATE (a)-[:REFERENCES {fields: "calendarSyncConnectionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "externalCalendars"}), (b:Entity {name: "externalCalendars"})
CREATE (a)-[:REFERENCES {fields: "externalCalendar_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "factEnterpriseComplianceDaily"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, memberBizId, targetBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "factEnterpriseRevenueDaily"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, memberBizId, targetBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "factEnterpriseUtilizationDaily"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, memberBizId, targetBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "factOperationalDaily"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "factOperationalDaily"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "locationId, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "factOperationalDaily"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "factRefreshRuns"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "factRefreshRuns"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "factRefreshRuns"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "factResourceUtilizationDaily"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "factResourceUtilizationDaily"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "factResourceUtilizationDaily"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "factRevenueDaily"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "factRevenueDaily"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "locationId, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "factRevenueDaily"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "factRevenueMonthly"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "factRevenueMonthly"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "locationId, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "factRevenueMonthly"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "factSellableDaily"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "factSellableDaily"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "factSellableDaily"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellableId, sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fleetVehicles"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fleetVehicles"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fleetVehicles"}), (b:Entity {name: "fleetVehicles"})
CREATE (a)-[:REFERENCES {fields: "fleetVehicle_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fleetVehicles"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "originLocation_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fleetVehicles"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fleetVehicles"}), (b:Entity {name: "queueEntries"})
CREATE (a)-[:REFERENCES {fields: "queueEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fleetVehicles"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resourceId, resource_id, driverResource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fulfillmentAssignmentEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fulfillmentAssignmentEvents"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fulfillmentAssignments"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fulfillmentAssignments"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fulfillmentAssignments"}), (b:Entity {name: "fulfillmentUnits"})
CREATE (a)-[:REFERENCES {fields: "fulfillmentUnitId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fulfillmentCheckpoints"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fulfillmentCheckpoints"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fulfillmentCheckpoints"}), (b:Entity {name: "fulfillmentUnits"})
CREATE (a)-[:REFERENCES {fields: "fulfillmentUnitId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fulfillmentDependencies"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fulfillmentDependencies"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fulfillmentDependencies"}), (b:Entity {name: "fulfillmentUnits"})
CREATE (a)-[:REFERENCES {fields: "predecessorUnitId, successorUnitId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fulfillmentTransferEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fulfillmentTransferEvents"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fulfillmentTransferEvents"}), (b:Entity {name: "fulfillmentTransferRequests"})
CREATE (a)-[:REFERENCES {fields: "fulfillmentTransferRequestId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fulfillmentTransferRequests"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fulfillmentTransferRequests"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fulfillmentUnits"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fulfillmentUnits"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fxRateSnapshots"}), (b:Entity {name: "arInvoices"})
CREATE (a)-[:REFERENCES {fields: "arInvoice_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fxRateSnapshots"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fxRateSnapshots"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "fxRateSnapshots"}), (b:Entity {name: "fxRateSnapshots"})
CREATE (a)-[:REFERENCES {fields: "fxRateSnapshot_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftDeliveryAttempts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftDeliveryAttempts"}), (b:Entity {name: "giftDeliverySchedules"})
CREATE (a)-[:REFERENCES {fields: "giftDeliveryScheduleId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftDeliverySchedules"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftExpirationEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftExpirationEvents"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftExpirationEvents"}), (b:Entity {name: "giftInstruments"})
CREATE (a)-[:REFERENCES {fields: "giftInstrumentId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftExpirationEvents"}), (b:Entity {name: "giftRedemptions"})
CREATE (a)-[:REFERENCES {fields: "giftRedemption_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftExpirationEvents"}), (b:Entity {name: "giftTransfers"})
CREATE (a)-[:REFERENCES {fields: "giftTransfer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftInstrumentLedgerEntries"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftInstrumentLedgerEntries"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftInstrumentLedgerEntries"}), (b:Entity {name: "giftInstruments"})
CREATE (a)-[:REFERENCES {fields: "giftInstrumentId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftInstrumentLedgerEntries"}), (b:Entity {name: "giftRedemptions"})
CREATE (a)-[:REFERENCES {fields: "giftRedemption_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftInstrumentLedgerEntries"}), (b:Entity {name: "giftTransfers"})
CREATE (a)-[:REFERENCES {fields: "giftTransfer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftInstruments"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftInstruments"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftRedemptions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftRedemptions"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftRedemptions"}), (b:Entity {name: "giftInstruments"})
CREATE (a)-[:REFERENCES {fields: "giftInstrumentId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftRedemptions"}), (b:Entity {name: "giftRedemptions"})
CREATE (a)-[:REFERENCES {fields: "giftRedemption_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftTransfers"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftTransfers"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftTransfers"}), (b:Entity {name: "giftInstruments"})
CREATE (a)-[:REFERENCES {fields: "giftInstrumentId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftTransfers"}), (b:Entity {name: "giftRedemptions"})
CREATE (a)-[:REFERENCES {fields: "giftRedemption_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "giftTransfers"}), (b:Entity {name: "giftTransfers"})
CREATE (a)-[:REFERENCES {fields: "giftTransfer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "gradingEvents"}), (b:Entity {name: "assessmentAttempts"})
CREATE (a)-[:REFERENCES {fields: "assessmentAttemptId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "gradingEvents"}), (b:Entity {name: "assessmentTemplates"})
CREATE (a)-[:REFERENCES {fields: "assessmentTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphAudienceSegmentMembers"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "ownerBiz_id, contextBiz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphAudienceSegmentMembers"}), (b:Entity {name: "graphAudienceSegments"})
CREATE (a)-[:REFERENCES {fields: "segmentId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphAudienceSegmentMembers"}), (b:Entity {name: "graphIdentities"})
CREATE (a)-[:REFERENCES {fields: "memberIdentityId, actorIdentity_id, actorIdentity_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphAudienceSegments"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "ownerBiz_id, contextBiz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphAudienceSegments"}), (b:Entity {name: "graphIdentities"})
CREATE (a)-[:REFERENCES {fields: "ownerIdentityId, actorIdentity_id, actorIdentity_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphFeedItemAudienceRules"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "ownerBiz_id, contextBiz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphFeedItemAudienceRules"}), (b:Entity {name: "graphFeedItems"})
CREATE (a)-[:REFERENCES {fields: "feedItemId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphFeedItemAudienceRules"}), (b:Entity {name: "graphIdentities"})
CREATE (a)-[:REFERENCES {fields: "actorIdentity_id, actorIdentity_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphFeedItemAudienceRules"}), (b:Entity {name: "graphIdentityNotificationEndpoints"})
CREATE (a)-[:REFERENCES {fields: "endpoint_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphFeedItemDeliveries"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "ownerBiz_id, contextBiz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphFeedItemDeliveries"}), (b:Entity {name: "graphFeedItems"})
CREATE (a)-[:REFERENCES {fields: "feedItemId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphFeedItemDeliveries"}), (b:Entity {name: "graphIdentities"})
CREATE (a)-[:REFERENCES {fields: "viewerIdentityId, actorIdentity_id, actorIdentity_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphFeedItemLinks"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "ownerBiz_id, contextBiz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphFeedItemLinks"}), (b:Entity {name: "graphFeedItems"})
CREATE (a)-[:REFERENCES {fields: "feedItemId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphFeedItemLinks"}), (b:Entity {name: "graphIdentities"})
CREATE (a)-[:REFERENCES {fields: "actorIdentity_id, actorIdentity_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphFeedItems"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "contextBizId, ownerBiz_id, contextBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphFeedItems"}), (b:Entity {name: "graphIdentities"})
CREATE (a)-[:REFERENCES {fields: "ownerIdentityId, actorIdentity_id, actorIdentity_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphIdentities"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "ownerBiz_id, contextBiz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphIdentities"}), (b:Entity {name: "graphIdentities"})
CREATE (a)-[:REFERENCES {fields: "actorIdentity_id, actorIdentity_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphIdentityNotificationEndpoints"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, ownerBiz_id, contextBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphIdentityNotificationEndpoints"}), (b:Entity {name: "graphIdentities"})
CREATE (a)-[:REFERENCES {fields: "ownerIdentityId, actorIdentity_id, actorIdentity_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphIdentityNotificationEndpoints"}), (b:Entity {name: "graphIdentityNotificationEndpoints"})
CREATE (a)-[:REFERENCES {fields: "endpoint_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphIdentityPolicies"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "ownerBiz_id, contextBiz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphIdentityPolicies"}), (b:Entity {name: "graphIdentities"})
CREATE (a)-[:REFERENCES {fields: "identityId, actorIdentity_id, actorIdentity_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphRelationshipEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "ownerBiz_id, contextBiz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphRelationshipEvents"}), (b:Entity {name: "graphIdentities"})
CREATE (a)-[:REFERENCES {fields: "actorIdentity_id, actorIdentity_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphRelationshipEvents"}), (b:Entity {name: "graphRelationships"})
CREATE (a)-[:REFERENCES {fields: "relationshipId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphRelationships"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "ownerBiz_id, contextBiz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphRelationships"}), (b:Entity {name: "graphIdentities"})
CREATE (a)-[:REFERENCES {fields: "fromIdentityId, toIdentityId, actorIdentity_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphSubjectEventDeliveries"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, ownerBiz_id, contextBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphSubjectEventDeliveries"}), (b:Entity {name: "graphIdentities"})
CREATE (a)-[:REFERENCES {fields: "subscriberIdentityId, actorIdentity_id, actorIdentity_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphSubjectEventDeliveries"}), (b:Entity {name: "graphIdentityNotificationEndpoints"})
CREATE (a)-[:REFERENCES {fields: "endpointId, endpoint_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphSubjectEventDeliveries"}), (b:Entity {name: "graphSubjectEvents"})
CREATE (a)-[:REFERENCES {fields: "subjectEventId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphSubjectEventDeliveries"}), (b:Entity {name: "graphSubjectSubscriptions"})
CREATE (a)-[:REFERENCES {fields: "subscriptionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphSubjectEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, ownerBiz_id, contextBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphSubjectEvents"}), (b:Entity {name: "graphIdentities"})
CREATE (a)-[:REFERENCES {fields: "actorIdentity_id, actorIdentity_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphSubjectEvents"}), (b:Entity {name: "graphIdentityNotificationEndpoints"})
CREATE (a)-[:REFERENCES {fields: "endpoint_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphSubjectSubscriptions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "ownerBiz_id, contextBiz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "graphSubjectSubscriptions"}), (b:Entity {name: "graphIdentities"})
CREATE (a)-[:REFERENCES {fields: "subscriberIdentityId, actorIdentity_id, actorIdentity_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "groupAccountMembers"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "groupAccountMembers"}), (b:Entity {name: "groupAccounts"})
CREATE (a)-[:REFERENCES {fields: "groupAccountId, groupAccount_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "groupAccounts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "groupAccounts"}), (b:Entity {name: "groupAccounts"})
CREATE (a)-[:REFERENCES {fields: "groupAccount_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "hipaaAuthorizations"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "hostGroupMembers"}), (b:Entity {name: "assets"})
CREATE (a)-[:REFERENCES {fields: "asset_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "hostGroupMembers"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "hostGroupMembers"}), (b:Entity {name: "hostGroups"})
CREATE (a)-[:REFERENCES {fields: "hostGroupId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "hostGroupMembers"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "hostGroups"}), (b:Entity {name: "assets"})
CREATE (a)-[:REFERENCES {fields: "asset_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "hostGroups"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "hostGroups"}), (b:Entity {name: "groupAccounts"})
CREATE (a)-[:REFERENCES {fields: "groupAccountId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "hostGroups"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "hostGroups"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resourceId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "hostUsers"}), (b:Entity {name: "assets"})
CREATE (a)-[:REFERENCES {fields: "asset_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "hostUsers"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "hostUsers"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "hostUsers"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resourceId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "idempotencyKeys"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "installmentPlans"}), (b:Entity {name: "arInvoices"})
CREATE (a)-[:REFERENCES {fields: "arInvoiceId, arInvoice_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "installmentPlans"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "installmentPlans"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntent_id, paymentIntent_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "installmentPlans"}), (b:Entity {name: "paymentMethods"})
CREATE (a)-[:REFERENCES {fields: "paymentMethod_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "installmentScheduleItems"}), (b:Entity {name: "arInvoices"})
CREATE (a)-[:REFERENCES {fields: "arInvoice_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "installmentScheduleItems"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "installmentScheduleItems"}), (b:Entity {name: "installmentPlans"})
CREATE (a)-[:REFERENCES {fields: "installmentPlanId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "installmentScheduleItems"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntent_id, paymentIntent_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "installmentScheduleItems"}), (b:Entity {name: "paymentMethods"})
CREATE (a)-[:REFERENCES {fields: "paymentMethod_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "interactionAssignments"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "interactionAssignments"}), (b:Entity {name: "interactionTemplates"})
CREATE (a)-[:REFERENCES {fields: "interactionTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "interactionSubmissionArtifacts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "interactionSubmissionArtifacts"}), (b:Entity {name: "interactionSubmissions"})
CREATE (a)-[:REFERENCES {fields: "interactionSubmissionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "interactionSubmissionSignatures"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "interactionSubmissionSignatures"}), (b:Entity {name: "interactionSubmissions"})
CREATE (a)-[:REFERENCES {fields: "interactionSubmissionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "interactionSubmissions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "interactionSubmissions"}), (b:Entity {name: "interactionAssignments"})
CREATE (a)-[:REFERENCES {fields: "interactionAssignmentId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "interactionTemplateBindings"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "interactionTemplateBindings"}), (b:Entity {name: "interactionTemplates"})
CREATE (a)-[:REFERENCES {fields: "interactionTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "interactionTemplates"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "inventoryItems"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "inventoryItems"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "inventoryItems"}), (b:Entity {name: "inventoryItems"})
CREATE (a)-[:REFERENCES {fields: "inventoryItem_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "inventoryItems"}), (b:Entity {name: "inventoryLocations"})
CREATE (a)-[:REFERENCES {fields: "inventoryLocationId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "inventoryItems"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "inventoryItems"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "inventoryLocations"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "inventoryLocations"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "inventoryLocations"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "locationId, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "inventoryLocations"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "inventoryMovements"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "inventoryMovements"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "inventoryMovements"}), (b:Entity {name: "inventoryItems"})
CREATE (a)-[:REFERENCES {fields: "inventoryItemId, inventoryItem_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "inventoryMovements"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "inventoryMovements"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "inventoryReservations"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "inventoryReservations"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "inventoryReservations"}), (b:Entity {name: "inventoryItems"})
CREATE (a)-[:REFERENCES {fields: "inventoryItemId, inventoryItem_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "inventoryReservations"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "inventoryReservations"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "invoiceEvents"}), (b:Entity {name: "arInvoices"})
CREATE (a)-[:REFERENCES {fields: "arInvoiceId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "invoiceEvents"}), (b:Entity {name: "purchaseOrders"})
CREATE (a)-[:REFERENCES {fields: "purchaseOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "leaveBalances"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "leaveBalances"}), (b:Entity {name: "leavePolicies"})
CREATE (a)-[:REFERENCES {fields: "leavePolicyId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "leaveEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "leaveEvents"}), (b:Entity {name: "leavePolicies"})
CREATE (a)-[:REFERENCES {fields: "leavePolicyId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "leaveEvents"}), (b:Entity {name: "leaveRequests"})
CREATE (a)-[:REFERENCES {fields: "leaveRequestId, leaveRequest_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "leavePolicies"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "leaveRequests"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "leaveRequests"}), (b:Entity {name: "leavePolicies"})
CREATE (a)-[:REFERENCES {fields: "leavePolicyId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "leaveRequests"}), (b:Entity {name: "leaveRequests"})
CREATE (a)-[:REFERENCES {fields: "leaveRequest_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "legalHolds"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "legalHolds"}), (b:Entity {name: "legalHolds"})
CREATE (a)-[:REFERENCES {fields: "legalHold_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "lifecycleEventDeliveries"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "lifecycleEventDeliveries"}), (b:Entity {name: "lifecycleEventSubscriptions"})
CREATE (a)-[:REFERENCES {fields: "lifecycleEventSubscriptionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "lifecycleEventDeliveries"}), (b:Entity {name: "lifecycleEvents"})
CREATE (a)-[:REFERENCES {fields: "lifecycleEventId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "lifecycleEventSubscriptions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "lifecycleEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "locations"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "marketingAudienceSegmentMemberships"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "marketingAudienceSegmentMemberships"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "marketingAudienceSegmentMemberships"}), (b:Entity {name: "channelAccounts"})
CREATE (a)-[:REFERENCES {fields: "channelAccount_id, channelAccount_id, channelAccount_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "marketingAudienceSegmentMemberships"}), (b:Entity {name: "crmContacts"})
CREATE (a)-[:REFERENCES {fields: "memberCrmContactId, memberCrmContact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "marketingAudienceSegmentMemberships"}), (b:Entity {name: "marketingAudienceSegments"})
CREATE (a)-[:REFERENCES {fields: "marketingAudienceSegmentId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "marketingAudienceSegments"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "marketingAudienceSegments"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "marketingAudienceSegments"}), (b:Entity {name: "channelAccounts"})
CREATE (a)-[:REFERENCES {fields: "channelAccount_id, channelAccount_id, channelAccount_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "marketingAudienceSegments"}), (b:Entity {name: "crmContacts"})
CREATE (a)-[:REFERENCES {fields: "memberCrmContact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "marketingAudienceSyncRuns"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "marketingAudienceSyncRuns"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "marketingAudienceSyncRuns"}), (b:Entity {name: "channelAccounts"})
CREATE (a)-[:REFERENCES {fields: "channelAccountId, channelAccount_id, channelAccount_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "marketingAudienceSyncRuns"}), (b:Entity {name: "crmContacts"})
CREATE (a)-[:REFERENCES {fields: "memberCrmContact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "marketingAudienceSyncRuns"}), (b:Entity {name: "marketingAudienceSegments"})
CREATE (a)-[:REFERENCES {fields: "marketingAudienceSegmentId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "marketingCampaignEnrollments"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "marketingCampaignEnrollments"}), (b:Entity {name: "marketingCampaigns"})
CREATE (a)-[:REFERENCES {fields: "marketingCampaignId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "marketingCampaignSteps"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "marketingCampaignSteps"}), (b:Entity {name: "marketingCampaigns"})
CREATE (a)-[:REFERENCES {fields: "marketingCampaignId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "marketingCampaigns"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "marketplaceListings"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, bidderBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "marketplaceListings"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "membershipPlans"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "membershipPlans"}), (b:Entity {name: "membershipPlans"})
CREATE (a)-[:REFERENCES {fields: "membershipPlan_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "memberships"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "memberships"}), (b:Entity {name: "membershipPlans"})
CREATE (a)-[:REFERENCES {fields: "membershipPlanId, membershipPlan_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "memberships"}), (b:Entity {name: "memberships"})
CREATE (a)-[:REFERENCES {fields: "membership_id, membership_id, membership_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "messageTemplateBindings"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "messageTemplateBindings"}), (b:Entity {name: "messageTemplates"})
CREATE (a)-[:REFERENCES {fields: "messageTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "messageTemplates"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "noteAccessOverrides"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "noteAccessOverrides"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "noteAccessOverrides"}), (b:Entity {name: "notes"})
CREATE (a)-[:REFERENCES {fields: "noteId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "noteRevisions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "noteRevisions"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "noteRevisions"}), (b:Entity {name: "notes"})
CREATE (a)-[:REFERENCES {fields: "noteId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "notes"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "notes"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offerComponentSeatTypes"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offerComponentSeatTypes"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offerComponentSeatTypes"}), (b:Entity {name: "offerComponents"})
CREATE (a)-[:REFERENCES {fields: "componentId, component_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offerComponentSeatTypes"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offerComponentSelectors"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offerComponentSelectors"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "locationId, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offerComponentSelectors"}), (b:Entity {name: "offerComponents"})
CREATE (a)-[:REFERENCES {fields: "componentId, component_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offerComponents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offerComponents"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offerComponents"}), (b:Entity {name: "offerComponents"})
CREATE (a)-[:REFERENCES {fields: "component_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offerComponents"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offerVersionAdmissionModes"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offerVersionAdmissionModes"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offerVersionAdmissionModes"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offerVersions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offerVersions"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offerVersions"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offerId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offers"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offers"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offlineConversionPushes"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offlineConversionPushes"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offlineConversionPushes"}), (b:Entity {name: "channelAccounts"})
CREATE (a)-[:REFERENCES {fields: "channelAccountId, channelAccount_id, channelAccount_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offlineConversionPushes"}), (b:Entity {name: "crmContacts"})
CREATE (a)-[:REFERENCES {fields: "memberCrmContact_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offlineMergeConflicts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offlineMergeConflicts"}), (b:Entity {name: "offlineOpsJournal"})
CREATE (a)-[:REFERENCES {fields: "offlineOpJournalId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offlineOpsJournal"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offlineResolutionEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "offlineResolutionEvents"}), (b:Entity {name: "offlineMergeConflicts"})
CREATE (a)-[:REFERENCES {fields: "offlineMergeConflictId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "operationalAssignments"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "operationalDemands"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "orgMembershipLocations"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "orgMembershipLocations"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "locationId, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "orgMembershipLocations"}), (b:Entity {name: "orgMemberships"})
CREATE (a)-[:REFERENCES {fields: "membershipId, membership_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "orgMemberships"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "orgMemberships"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "orgMemberships"}), (b:Entity {name: "orgMemberships"})
CREATE (a)-[:REFERENCES {fields: "membership_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "outboundMessageEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "outboundMessageEvents"}), (b:Entity {name: "outboundMessages"})
CREATE (a)-[:REFERENCES {fields: "outboundMessageId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "outboundMessages"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "overtimeForecasts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "overtimeForecasts"}), (b:Entity {name: "overtimePolicies"})
CREATE (a)-[:REFERENCES {fields: "overtimePolicyId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "overtimePolicies"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "participantObligationEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "participantObligationEvents"}), (b:Entity {name: "bookingParticipantObligations"})
CREATE (a)-[:REFERENCES {fields: "bookingParticipantObligationId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "payerAuthorizations"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "payerAuthorizations"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "payerAuthorizations"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentDisputes"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentDisputes"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentDisputes"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrder_id, crossBizOrder_id, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentDisputes"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntentId, paymentIntent_id, paymentIntent_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentDisputes"}), (b:Entity {name: "paymentMethods"})
CREATE (a)-[:REFERENCES {fields: "paymentMethod_id, paymentMethod_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentDisputes"}), (b:Entity {name: "paymentTransactions"})
CREATE (a)-[:REFERENCES {fields: "paymentTransactionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentIntentEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentIntentEvents"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentIntentEvents"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrder_id, crossBizOrder_id, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentIntentEvents"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntent_id, paymentIntent_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentIntentEvents"}), (b:Entity {name: "paymentMethods"})
CREATE (a)-[:REFERENCES {fields: "paymentMethod_id, paymentMethod_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentIntentLineAllocations"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentIntentLineAllocations"}), (b:Entity {name: "bookingOrderLines"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderLineId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentIntentLineAllocations"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentIntentLineAllocations"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrder_id, crossBizOrder_id, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentIntentLineAllocations"}), (b:Entity {name: "paymentIntentTenders"})
CREATE (a)-[:REFERENCES {fields: "paymentIntentTenderId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentIntentLineAllocations"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntentId, paymentIntent_id, paymentIntent_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentIntentLineAllocations"}), (b:Entity {name: "paymentMethods"})
CREATE (a)-[:REFERENCES {fields: "paymentMethod_id, paymentMethod_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentIntentTenders"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentIntentTenders"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentIntentTenders"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrder_id, crossBizOrder_id, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentIntentTenders"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntentId, paymentIntent_id, paymentIntent_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentIntentTenders"}), (b:Entity {name: "paymentMethods"})
CREATE (a)-[:REFERENCES {fields: "paymentMethodId, paymentMethod_id, paymentMethod_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentIntents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentIntents"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentIntents"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrderId, crossBizOrder_id, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentIntents"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntent_id, paymentIntent_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentIntents"}), (b:Entity {name: "paymentMethods"})
CREATE (a)-[:REFERENCES {fields: "paymentMethod_id, paymentMethod_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentMethods"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentMethods"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentMethods"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrder_id, crossBizOrder_id, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentMethods"}), (b:Entity {name: "paymentMethods"})
CREATE (a)-[:REFERENCES {fields: "paymentMethod_id, paymentMethod_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentProcessorAccounts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentProcessorAccounts"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentProcessorAccounts"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrder_id, crossBizOrder_id, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentTransactionLineAllocations"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentTransactionLineAllocations"}), (b:Entity {name: "bookingOrderLines"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderLineId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentTransactionLineAllocations"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentTransactionLineAllocations"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrder_id, crossBizOrder_id, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentTransactionLineAllocations"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntentId, paymentIntent_id, paymentIntent_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentTransactionLineAllocations"}), (b:Entity {name: "paymentMethods"})
CREATE (a)-[:REFERENCES {fields: "paymentMethod_id, paymentMethod_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentTransactionLineAllocations"}), (b:Entity {name: "paymentTransactions"})
CREATE (a)-[:REFERENCES {fields: "paymentTransactionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentTransactions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentTransactions"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentTransactions"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrderId, crossBizOrder_id, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentTransactions"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntentId, paymentIntent_id, paymentIntent_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "paymentTransactions"}), (b:Entity {name: "paymentMethods"})
CREATE (a)-[:REFERENCES {fields: "paymentMethodId, paymentMethod_id, paymentMethod_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "payoutLedgerEntries"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "payoutLedgerEntries"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "payoutLedgerEntries"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrder_id, crossBizOrder_id, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "payoutLedgerEntries"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntent_id, paymentIntent_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "payoutLedgerEntries"}), (b:Entity {name: "paymentMethods"})
CREATE (a)-[:REFERENCES {fields: "paymentMethod_id, paymentMethod_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "payoutLedgerEntries"}), (b:Entity {name: "payouts"})
CREATE (a)-[:REFERENCES {fields: "payoutId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "payouts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "payouts"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "payouts"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrder_id, crossBizOrder_id, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "payouts"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntent_id, paymentIntent_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "payouts"}), (b:Entity {name: "paymentMethods"})
CREATE (a)-[:REFERENCES {fields: "paymentMethod_id, paymentMethod_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "phiAccessEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "phiAccessEvents"}), (b:Entity {name: "phiAccessPolicies"})
CREATE (a)-[:REFERENCES {fields: "phiAccessPolicyId, phiAccessPolicy_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "phiAccessPolicies"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "phiAccessPolicies"}), (b:Entity {name: "phiAccessPolicies"})
CREATE (a)-[:REFERENCES {fields: "phiAccessPolicy_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "phiDisclosureEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "phiDisclosureEvents"}), (b:Entity {name: "phiAccessPolicies"})
CREATE (a)-[:REFERENCES {fields: "phiAccessPolicy_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "physicalFulfillmentItems"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "physicalFulfillmentItems"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "physicalFulfillmentItems"}), (b:Entity {name: "inventoryItems"})
CREATE (a)-[:REFERENCES {fields: "inventoryItemId, inventoryItem_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "physicalFulfillmentItems"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "physicalFulfillmentItems"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "physicalFulfillmentItems"}), (b:Entity {name: "physicalFulfillments"})
CREATE (a)-[:REFERENCES {fields: "physicalFulfillmentId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "physicalFulfillments"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "physicalFulfillments"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "physicalFulfillments"}), (b:Entity {name: "inventoryItems"})
CREATE (a)-[:REFERENCES {fields: "inventoryItem_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "physicalFulfillments"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "physicalFulfillments"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "policyBindings"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "policyBindings"}), (b:Entity {name: "legalHolds"})
CREATE (a)-[:REFERENCES {fields: "legalHold_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "policyBindings"}), (b:Entity {name: "policyBindings"})
CREATE (a)-[:REFERENCES {fields: "policyBinding_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "policyBindings"}), (b:Entity {name: "policyRules"})
CREATE (a)-[:REFERENCES {fields: "policyRule_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "policyBindings"}), (b:Entity {name: "policyTemplates"})
CREATE (a)-[:REFERENCES {fields: "policyTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "policyBreachEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "policyBreachEvents"}), (b:Entity {name: "legalHolds"})
CREATE (a)-[:REFERENCES {fields: "legalHold_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "policyBreachEvents"}), (b:Entity {name: "policyBindings"})
CREATE (a)-[:REFERENCES {fields: "policyBindingId, policyBinding_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "policyBreachEvents"}), (b:Entity {name: "policyRules"})
CREATE (a)-[:REFERENCES {fields: "policyRuleId, policyRule_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "policyBreachEvents"}), (b:Entity {name: "policyTemplates"})
CREATE (a)-[:REFERENCES {fields: "policyTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "policyConsequenceEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "policyConsequenceEvents"}), (b:Entity {name: "legalHolds"})
CREATE (a)-[:REFERENCES {fields: "legalHold_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "policyConsequenceEvents"}), (b:Entity {name: "policyBindings"})
CREATE (a)-[:REFERENCES {fields: "policyBinding_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "policyConsequenceEvents"}), (b:Entity {name: "policyBreachEvents"})
CREATE (a)-[:REFERENCES {fields: "policyBreachEventId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "policyConsequenceEvents"}), (b:Entity {name: "policyRules"})
CREATE (a)-[:REFERENCES {fields: "policyRule_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "policyRules"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "policyRules"}), (b:Entity {name: "legalHolds"})
CREATE (a)-[:REFERENCES {fields: "legalHold_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "policyRules"}), (b:Entity {name: "policyRules"})
CREATE (a)-[:REFERENCES {fields: "policyRule_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "policyRules"}), (b:Entity {name: "policyTemplates"})
CREATE (a)-[:REFERENCES {fields: "policyTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "policyTemplates"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "policyTemplates"}), (b:Entity {name: "legalHolds"})
CREATE (a)-[:REFERENCES {fields: "legalHold_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "privacyIdentityModes"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "privacyIdentityModes"}), (b:Entity {name: "legalHolds"})
CREATE (a)-[:REFERENCES {fields: "legalHold_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "productBundleComponents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "productBundleComponents"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "productBundleComponents"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "productBundleComponents"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offerId, offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "productBundleComponents"}), (b:Entity {name: "productBundles"})
CREATE (a)-[:REFERENCES {fields: "productBundleId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "productBundles"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "productBundles"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "productBundles"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "productBundles"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "productionBatchReservations"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "productionBatchReservations"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "productionBatchReservations"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "productionBatchReservations"}), (b:Entity {name: "productionBatches"})
CREATE (a)-[:REFERENCES {fields: "productionBatchId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "productionBatches"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "productionBatches"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "productionBatches"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "locationId, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "productionBatches"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellableId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "products"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "products"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "locationId, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "programCohortSessions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "programCohortSessions"}), (b:Entity {name: "programCohorts"})
CREATE (a)-[:REFERENCES {fields: "cohortId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "programCohorts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "programCohorts"}), (b:Entity {name: "programs"})
CREATE (a)-[:REFERENCES {fields: "programId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "programs"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "projectionCheckpoints"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "projectionCheckpoints"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "projectionCheckpoints"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "purchaseOrders"}), (b:Entity {name: "billingAccounts"})
CREATE (a)-[:REFERENCES {fields: "billingAccountId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "purchaseOrders"}), (b:Entity {name: "purchaseOrders"})
CREATE (a)-[:REFERENCES {fields: "purchaseOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueCounterAssignments"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueCounterAssignments"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueCounterAssignments"}), (b:Entity {name: "queueCounters"})
CREATE (a)-[:REFERENCES {fields: "queueCounterId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueCounters"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueCounters"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "locationId, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueCounters"}), (b:Entity {name: "queues"})
CREATE (a)-[:REFERENCES {fields: "queueId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueEntries"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueEntries"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueEntries"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueEntries"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueEntries"}), (b:Entity {name: "queueEntries"})
CREATE (a)-[:REFERENCES {fields: "queueEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueEntries"}), (b:Entity {name: "queues"})
CREATE (a)-[:REFERENCES {fields: "queueId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueEvents"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueEvents"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueEvents"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueEvents"}), (b:Entity {name: "queueEntries"})
CREATE (a)-[:REFERENCES {fields: "queueEntryId, queueEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueTicketCalls"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueTicketCalls"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueTicketCalls"}), (b:Entity {name: "queueCounters"})
CREATE (a)-[:REFERENCES {fields: "queueCounterId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueTicketCalls"}), (b:Entity {name: "queueEntries"})
CREATE (a)-[:REFERENCES {fields: "queueEntryId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueTicketCalls"}), (b:Entity {name: "queueTickets"})
CREATE (a)-[:REFERENCES {fields: "queueTicketId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueTickets"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueTickets"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueTickets"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueTickets"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueTickets"}), (b:Entity {name: "queueEntries"})
CREATE (a)-[:REFERENCES {fields: "queueEntryId, queueEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queueTickets"}), (b:Entity {name: "queues"})
CREATE (a)-[:REFERENCES {fields: "queueId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queues"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queues"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queues"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "locationId, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "queues"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "quietHourPolicies"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "rankingEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "rankingEvents"}), (b:Entity {name: "rankingProfiles"})
CREATE (a)-[:REFERENCES {fields: "rankingProfileId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "rankingProfiles"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "rankingScores"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "rankingScores"}), (b:Entity {name: "rankingProfiles"})
CREATE (a)-[:REFERENCES {fields: "rankingProfileId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "redactionJobs"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "redactionJobs"}), (b:Entity {name: "legalHolds"})
CREATE (a)-[:REFERENCES {fields: "legalHoldId, legalHold_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralAttributions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralAttributions"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralAttributions"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrderId, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralAttributions"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralAttributions"}), (b:Entity {name: "referralEvents"})
CREATE (a)-[:REFERENCES {fields: "referralEventId, referralEvent_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralAttributions"}), (b:Entity {name: "referralLinks"})
CREATE (a)-[:REFERENCES {fields: "referralLinkId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralAttributions"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, bidderBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralEvents"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralEvents"}), (b:Entity {name: "crossBizContracts"})
CREATE (a)-[:REFERENCES {fields: "contract_id, contract_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralEvents"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrderId, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralEvents"}), (b:Entity {name: "referralPrograms"})
CREATE (a)-[:REFERENCES {fields: "referralProgramId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralLinkClicks"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralLinkClicks"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralLinkClicks"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralLinkClicks"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralLinkClicks"}), (b:Entity {name: "referralEvents"})
CREATE (a)-[:REFERENCES {fields: "referralEvent_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralLinkClicks"}), (b:Entity {name: "referralLinks"})
CREATE (a)-[:REFERENCES {fields: "referralLinkId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralLinkClicks"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralLinks"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralLinks"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralLinks"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralLinks"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralLinks"}), (b:Entity {name: "referralEvents"})
CREATE (a)-[:REFERENCES {fields: "referralEvent_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralLinks"}), (b:Entity {name: "referralPrograms"})
CREATE (a)-[:REFERENCES {fields: "referralProgramId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralLinks"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralPrograms"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, bidderBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralPrograms"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralPrograms"}), (b:Entity {name: "crossBizContracts"})
CREATE (a)-[:REFERENCES {fields: "contract_id, contract_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "referralPrograms"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "requirementEdges"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "requirementEdges"}), (b:Entity {name: "requirementNodes"})
CREATE (a)-[:REFERENCES {fields: "fromNodeId, toNodeId, requirementNode_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "requirementEdges"}), (b:Entity {name: "requirementSets"})
CREATE (a)-[:REFERENCES {fields: "requirementSetId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "requirementEvaluations"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "requirementEvaluations"}), (b:Entity {name: "requirementNodes"})
CREATE (a)-[:REFERENCES {fields: "requirementNode_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "requirementEvaluations"}), (b:Entity {name: "requirementSets"})
CREATE (a)-[:REFERENCES {fields: "requirementSetId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "requirementEvidenceLinks"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "requirementEvidenceLinks"}), (b:Entity {name: "requirementEvaluations"})
CREATE (a)-[:REFERENCES {fields: "requirementEvaluationId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "requirementEvidenceLinks"}), (b:Entity {name: "requirementNodes"})
CREATE (a)-[:REFERENCES {fields: "requirementNodeId, requirementNode_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "requirementListAssignmentItems"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "requirementListAssignmentItems"}), (b:Entity {name: "requirementListAssignments"})
CREATE (a)-[:REFERENCES {fields: "requirementListAssignmentId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "requirementListAssignmentItems"}), (b:Entity {name: "requirementListTemplateItems"})
CREATE (a)-[:REFERENCES {fields: "templateItemId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "requirementListAssignments"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "requirementListAssignments"}), (b:Entity {name: "requirementListTemplates"})
CREATE (a)-[:REFERENCES {fields: "requirementListTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "requirementListTemplateItems"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "requirementListTemplateItems"}), (b:Entity {name: "requirementListTemplates"})
CREATE (a)-[:REFERENCES {fields: "requirementListTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "requirementListTemplates"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "requirementNodes"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "requirementNodes"}), (b:Entity {name: "requirementNodes"})
CREATE (a)-[:REFERENCES {fields: "requirementNode_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "requirementNodes"}), (b:Entity {name: "requirementSets"})
CREATE (a)-[:REFERENCES {fields: "requirementSetId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "requirementSets"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceCapabilityAssignments"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceCapabilityAssignments"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceCapabilityAssignments"}), (b:Entity {name: "resourceCapabilityTemplates"})
CREATE (a)-[:REFERENCES {fields: "capabilityTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceCapabilityAssignments"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resourceId, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceCapabilityTemplates"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceCapabilityTemplates"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "locationId, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceCapabilityTemplates"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceConditionReports"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceConditionReports"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceConditionReports"}), (b:Entity {name: "resourceMaintenancePolicies"})
CREATE (a)-[:REFERENCES {fields: "policy_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceConditionReports"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resourceId, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceMaintenancePolicies"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceMaintenancePolicies"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceMaintenancePolicies"}), (b:Entity {name: "resourceMaintenancePolicies"})
CREATE (a)-[:REFERENCES {fields: "policy_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceMaintenancePolicies"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resourceId, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceMaintenanceWorkOrders"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceMaintenanceWorkOrders"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceMaintenanceWorkOrders"}), (b:Entity {name: "resourceMaintenancePolicies"})
CREATE (a)-[:REFERENCES {fields: "policyId, policy_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceMaintenanceWorkOrders"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resourceId, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceServiceCapabilities"}), (b:Entity {name: "assets"})
CREATE (a)-[:REFERENCES {fields: "asset_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceServiceCapabilities"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceServiceCapabilities"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "locationId, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceServiceCapabilities"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resourceId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceStatusDefinitions"}), (b:Entity {name: "assets"})
CREATE (a)-[:REFERENCES {fields: "asset_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceStatusDefinitions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceStatusDefinitions"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "locationId, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceUsageCounters"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceUsageCounters"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resourceUsageCounters"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resourceId, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resources"}), (b:Entity {name: "assets"})
CREATE (a)-[:REFERENCES {fields: "asset_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resources"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "resources"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "locationId, location_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "retentionPolicies"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "revenueShareRules"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, bidderBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "revenueShareRules"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "revenueShareRules"}), (b:Entity {name: "crossBizContracts"})
CREATE (a)-[:REFERENCES {fields: "contractId, contract_id, contract_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "revenueShareRules"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "reviewQueueItems"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "reviewQueueItems"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "reviewQueueItems"}), (b:Entity {name: "reviewQueues"})
CREATE (a)-[:REFERENCES {fields: "reviewQueueId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "reviewQueueItems"}), (b:Entity {name: "users"})
CREATE (a)-[:REFERENCES {fields: "assignedToUser_id, assignedToUser_id, deciderUser_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "reviewQueues"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "reviewQueues"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "reviewQueues"}), (b:Entity {name: "users"})
CREATE (a)-[:REFERENCES {fields: "assignedToUser_id, assignedToUser_id, deciderUser_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "rewardGrants"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, bidderBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "rewardGrants"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "rewardGrants"}), (b:Entity {name: "crossBizContracts"})
CREATE (a)-[:REFERENCES {fields: "contract_id, contract_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "rewardGrants"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "rewardGrants"}), (b:Entity {name: "referralEvents"})
CREATE (a)-[:REFERENCES {fields: "referralEventId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "rewardGrants"}), (b:Entity {name: "referralPrograms"})
CREATE (a)-[:REFERENCES {fields: "referralProgramId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "rolloverRuns"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "rolloverRuns"}), (b:Entity {name: "entitlementGrants"})
CREATE (a)-[:REFERENCES {fields: "grant_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "rolloverRuns"}), (b:Entity {name: "entitlementTransfers"})
CREATE (a)-[:REFERENCES {fields: "transfer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "rolloverRuns"}), (b:Entity {name: "membershipPlans"})
CREATE (a)-[:REFERENCES {fields: "membershipPlanId, membershipPlan_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "rolloverRuns"}), (b:Entity {name: "memberships"})
CREATE (a)-[:REFERENCES {fields: "membershipId, membership_id, membership_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaCoverageItems"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "biz_id, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaCoverageItems"}), (b:Entity {name: "sagaDefinitions"})
CREATE (a)-[:REFERENCES {fields: "sagaDefinition_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaCoverageItems"}), (b:Entity {name: "sagaRunSteps"})
CREATE (a)-[:REFERENCES {fields: "sagaRunStep_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaCoverageReports"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaCoverageReports"}), (b:Entity {name: "sagaDefinitions"})
CREATE (a)-[:REFERENCES {fields: "sagaDefinition_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaCoverageReports"}), (b:Entity {name: "sagaRunSteps"})
CREATE (a)-[:REFERENCES {fields: "sagaRunStep_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaDefinitionLinks"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "biz_id, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaDefinitionLinks"}), (b:Entity {name: "sagaDefinitions"})
CREATE (a)-[:REFERENCES {fields: "sagaDefinition_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaDefinitionLinks"}), (b:Entity {name: "sagaRunSteps"})
CREATE (a)-[:REFERENCES {fields: "sagaRunStep_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaDefinitionRevisions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "biz_id, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaDefinitionRevisions"}), (b:Entity {name: "sagaDefinitions"})
CREATE (a)-[:REFERENCES {fields: "sagaDefinition_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaDefinitions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaDefinitions"}), (b:Entity {name: "sagaDefinitions"})
CREATE (a)-[:REFERENCES {fields: "sagaDefinition_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaPersonaVersions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "biz_id, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaPersonaVersions"}), (b:Entity {name: "sagaDefinitions"})
CREATE (a)-[:REFERENCES {fields: "sagaDefinition_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaPersonaVersions"}), (b:Entity {name: "sagaRunSteps"})
CREATE (a)-[:REFERENCES {fields: "sagaRunStep_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaPersonas"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaPersonas"}), (b:Entity {name: "sagaDefinitions"})
CREATE (a)-[:REFERENCES {fields: "sagaDefinition_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaPersonas"}), (b:Entity {name: "sagaRunSteps"})
CREATE (a)-[:REFERENCES {fields: "sagaRunStep_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaRunActorMessages"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "biz_id, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaRunActorMessages"}), (b:Entity {name: "sagaDefinitions"})
CREATE (a)-[:REFERENCES {fields: "sagaDefinition_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaRunActorMessages"}), (b:Entity {name: "sagaRunSteps"})
CREATE (a)-[:REFERENCES {fields: "sagaRunStep_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaRunActorProfiles"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "biz_id, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaRunActorProfiles"}), (b:Entity {name: "sagaDefinitions"})
CREATE (a)-[:REFERENCES {fields: "sagaDefinition_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaRunActorProfiles"}), (b:Entity {name: "sagaRunSteps"})
CREATE (a)-[:REFERENCES {fields: "sagaRunStep_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaRunArtifacts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "biz_id, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaRunArtifacts"}), (b:Entity {name: "sagaDefinitions"})
CREATE (a)-[:REFERENCES {fields: "sagaDefinition_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaRunArtifacts"}), (b:Entity {name: "sagaRunSteps"})
CREATE (a)-[:REFERENCES {fields: "sagaRunStep_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaRunSteps"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "biz_id, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaRunSteps"}), (b:Entity {name: "sagaDefinitions"})
CREATE (a)-[:REFERENCES {fields: "sagaDefinition_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaRunSteps"}), (b:Entity {name: "sagaRunSteps"})
CREATE (a)-[:REFERENCES {fields: "sagaRunStep_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaRuns"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "biz_id, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaRuns"}), (b:Entity {name: "sagaDefinitions"})
CREATE (a)-[:REFERENCES {fields: "sagaDefinitionId, sagaDefinition_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaTagBindings"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "biz_id, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaTagBindings"}), (b:Entity {name: "sagaDefinitions"})
CREATE (a)-[:REFERENCES {fields: "sagaDefinition_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaTagBindings"}), (b:Entity {name: "sagaRunSteps"})
CREATE (a)-[:REFERENCES {fields: "sagaRunStep_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaTags"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "biz_id, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaTags"}), (b:Entity {name: "sagaDefinitions"})
CREATE (a)-[:REFERENCES {fields: "sagaDefinition_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaTags"}), (b:Entity {name: "sagaRunSteps"})
CREATE (a)-[:REFERENCES {fields: "sagaRunStep_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaUseCaseVersions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "biz_id, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaUseCaseVersions"}), (b:Entity {name: "sagaDefinitions"})
CREATE (a)-[:REFERENCES {fields: "sagaDefinition_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaUseCaseVersions"}), (b:Entity {name: "sagaRunSteps"})
CREATE (a)-[:REFERENCES {fields: "sagaRunStep_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaUseCases"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaUseCases"}), (b:Entity {name: "sagaDefinitions"})
CREATE (a)-[:REFERENCES {fields: "sagaDefinition_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sagaUseCases"}), (b:Entity {name: "sagaRunSteps"})
CREATE (a)-[:REFERENCES {fields: "sagaRunStep_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "salesQuoteAcceptances"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "salesQuoteAcceptances"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "salesQuoteAcceptances"}), (b:Entity {name: "salesQuoteVersions"})
CREATE (a)-[:REFERENCES {fields: "salesQuoteVersionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "salesQuoteAcceptances"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "salesQuoteLines"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "salesQuoteLines"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "salesQuoteLines"}), (b:Entity {name: "salesQuoteVersions"})
CREATE (a)-[:REFERENCES {fields: "salesQuoteVersionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "salesQuoteLines"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "salesQuoteVersions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "salesQuoteVersions"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "salesQuoteVersions"}), (b:Entity {name: "salesQuotes"})
CREATE (a)-[:REFERENCES {fields: "salesQuoteId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "salesQuoteVersions"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "salesQuotes"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "salesQuotes"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "salesQuotes"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellable_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "seatHolds"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "seatHolds"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "seatHolds"}), (b:Entity {name: "queueEntries"})
CREATE (a)-[:REFERENCES {fields: "queueEntryId, queueEntry_id, queueEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "seatHolds"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "seatHolds"}), (b:Entity {name: "seatHolds"})
CREATE (a)-[:REFERENCES {fields: "seatHold_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "seatHolds"}), (b:Entity {name: "seatMapSeats"})
CREATE (a)-[:REFERENCES {fields: "seatMapSeatId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "seatHolds"}), (b:Entity {name: "seatMaps"})
CREATE (a)-[:REFERENCES {fields: "seatMapId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "seatMapSeats"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "seatMapSeats"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "seatMapSeats"}), (b:Entity {name: "queueEntries"})
CREATE (a)-[:REFERENCES {fields: "queueEntry_id, queueEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "seatMapSeats"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "seatMapSeats"}), (b:Entity {name: "seatMaps"})
CREATE (a)-[:REFERENCES {fields: "seatMapId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "seatMaps"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "seatMaps"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "seatMaps"}), (b:Entity {name: "queueEntries"})
CREATE (a)-[:REFERENCES {fields: "queueEntry_id, queueEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "seatMaps"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "seatReservations"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "seatReservations"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "seatReservations"}), (b:Entity {name: "queueEntries"})
CREATE (a)-[:REFERENCES {fields: "queueEntryId, queueEntry_id, queueEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "seatReservations"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "seatReservations"}), (b:Entity {name: "seatHolds"})
CREATE (a)-[:REFERENCES {fields: "seatHoldId, seatHold_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "seatReservations"}), (b:Entity {name: "seatMapSeats"})
CREATE (a)-[:REFERENCES {fields: "seatMapSeatId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "seatReservations"}), (b:Entity {name: "seatMaps"})
CREATE (a)-[:REFERENCES {fields: "seatMapId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "securedBalanceAccounts"}), (b:Entity {name: "arInvoices"})
CREATE (a)-[:REFERENCES {fields: "arInvoice_id, arInvoice_id, arInvoice_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "securedBalanceAccounts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "securedBalanceAllocations"}), (b:Entity {name: "arInvoices"})
CREATE (a)-[:REFERENCES {fields: "arInvoice_id, arInvoice_id, arInvoice_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "securedBalanceAllocations"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "securedBalanceAllocations"}), (b:Entity {name: "securedBalanceLedgerEntries"})
CREATE (a)-[:REFERENCES {fields: "securedBalanceLedgerEntryId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "securedBalanceLedgerEntries"}), (b:Entity {name: "arInvoices"})
CREATE (a)-[:REFERENCES {fields: "arInvoice_id, arInvoice_id, arInvoice_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "securedBalanceLedgerEntries"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "securedBalanceLedgerEntries"}), (b:Entity {name: "securedBalanceAccounts"})
CREATE (a)-[:REFERENCES {fields: "securedBalanceAccountId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "securityIncidents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "securityIncidents"}), (b:Entity {name: "phiAccessPolicies"})
CREATE (a)-[:REFERENCES {fields: "phiAccessPolicy_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableOfferVersions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableOfferVersions"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableOfferVersions"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableOfferVersions"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableOfferVersions"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableOfferVersions"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellableId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellablePricingModes"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellablePricingModes"}), (b:Entity {name: "channelAccounts"})
CREATE (a)-[:REFERENCES {fields: "channelAccount_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellablePricingModes"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellablePricingModes"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellableId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellablePricingOverrides"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellablePricingOverrides"}), (b:Entity {name: "channelAccounts"})
CREATE (a)-[:REFERENCES {fields: "channelAccountId, channelAccount_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellablePricingOverrides"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "locationId, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellablePricingOverrides"}), (b:Entity {name: "sellablePricingModes"})
CREATE (a)-[:REFERENCES {fields: "sellablePricingModeId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellablePricingThresholds"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellablePricingThresholds"}), (b:Entity {name: "channelAccounts"})
CREATE (a)-[:REFERENCES {fields: "channelAccount_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellablePricingThresholds"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellablePricingThresholds"}), (b:Entity {name: "sellablePricingModes"})
CREATE (a)-[:REFERENCES {fields: "sellablePricingModeId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableProducts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableProducts"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableProducts"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableProducts"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableProducts"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellableId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableResourceRates"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableResourceRates"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableResourceRates"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableResourceRates"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableResourceRates"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellableId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableServiceProducts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableServiceProducts"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableServiceProducts"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableServiceProducts"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableServiceProducts"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "sellableId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableVariantDimensionValues"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableVariantDimensionValues"}), (b:Entity {name: "sellableVariantDimensions"})
CREATE (a)-[:REFERENCES {fields: "sellableVariantDimensionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableVariantDimensions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableVariantDimensions"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "baseSellableId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableVariantSelections"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableVariantSelections"}), (b:Entity {name: "sellableVariantDimensionValues"})
CREATE (a)-[:REFERENCES {fields: "sellableVariantDimensionValueId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableVariantSelections"}), (b:Entity {name: "sellableVariantDimensions"})
CREATE (a)-[:REFERENCES {fields: "sellableVariantDimensionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableVariantSelections"}), (b:Entity {name: "sellableVariants"})
CREATE (a)-[:REFERENCES {fields: "sellableVariantId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableVariantSelections"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "baseSellableId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableVariants"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellableVariants"}), (b:Entity {name: "sellables"})
CREATE (a)-[:REFERENCES {fields: "baseSellableId, variantSellableId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellables"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellables"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellables"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sellables"}), (b:Entity {name: "offers"})
CREATE (a)-[:REFERENCES {fields: "offer_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceGroups"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductRequirementGroups"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductRequirementGroups"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductRequirementGroups"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductRequirementGroups"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductRequirementGroups"}), (b:Entity {name: "serviceProducts"})
CREATE (a)-[:REFERENCES {fields: "serviceProductId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductRequirementSelectors"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductRequirementSelectors"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "locationId, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductRequirementSelectors"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductRequirementSelectors"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resourceId, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductRequirementSelectors"}), (b:Entity {name: "serviceProductRequirementGroups"})
CREATE (a)-[:REFERENCES {fields: "requirementGroupId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductSeatTypeRequirements"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductSeatTypeRequirements"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductSeatTypeRequirements"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductSeatTypeRequirements"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductSeatTypeRequirements"}), (b:Entity {name: "serviceProductRequirementGroups"})
CREATE (a)-[:REFERENCES {fields: "requirementGroupId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductSeatTypeRequirements"}), (b:Entity {name: "serviceProductSeatTypes"})
CREATE (a)-[:REFERENCES {fields: "seatTypeId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductSeatTypes"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductSeatTypes"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductSeatTypes"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductSeatTypes"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductSeatTypes"}), (b:Entity {name: "serviceProducts"})
CREATE (a)-[:REFERENCES {fields: "serviceProductId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductServices"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductServices"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductServices"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductServices"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProductServices"}), (b:Entity {name: "serviceProducts"})
CREATE (a)-[:REFERENCES {fields: "serviceProductId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProducts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProducts"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProducts"}), (b:Entity {name: "products"})
CREATE (a)-[:REFERENCES {fields: "productId, product_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceProducts"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceTimeObservations"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceTimeObservations"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceTimeObservations"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceTimeObservations"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersionId, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceTimeObservations"}), (b:Entity {name: "queueEntries"})
CREATE (a)-[:REFERENCES {fields: "queueEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "serviceTimeObservations"}), (b:Entity {name: "queues"})
CREATE (a)-[:REFERENCES {fields: "queueId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "services"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "services"}), (b:Entity {name: "serviceGroups"})
CREATE (a)-[:REFERENCES {fields: "serviceGroupId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sessionAttendanceRecords"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sessionAttendanceRecords"}), (b:Entity {name: "cohortEnrollments"})
CREATE (a)-[:REFERENCES {fields: "enrollmentId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sessionAttendanceRecords"}), (b:Entity {name: "programCohortSessions"})
CREATE (a)-[:REFERENCES {fields: "sessionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sessionInteractionAggregates"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sessionInteractionArtifacts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "sessionInteractionEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "settlementBatches"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "settlementBatches"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "settlementBatches"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrder_id, crossBizOrder_id, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "settlementBatches"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntent_id, paymentIntent_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "settlementBatches"}), (b:Entity {name: "paymentMethods"})
CREATE (a)-[:REFERENCES {fields: "paymentMethod_id, paymentMethod_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "settlementEntries"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "settlementEntries"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "settlementEntries"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrderId, crossBizOrder_id, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "settlementEntries"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntent_id, paymentIntent_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "settlementEntries"}), (b:Entity {name: "paymentMethods"})
CREATE (a)-[:REFERENCES {fields: "paymentMethod_id, paymentMethod_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "settlementEntries"}), (b:Entity {name: "settlementBatches"})
CREATE (a)-[:REFERENCES {fields: "settlementBatchId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "shipmentGeneratedItems"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "shipmentGeneratedItems"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "shipmentGeneratedItems"}), (b:Entity {name: "memberships"})
CREATE (a)-[:REFERENCES {fields: "membership_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "shipmentGeneratedItems"}), (b:Entity {name: "shipmentGenerationRuns"})
CREATE (a)-[:REFERENCES {fields: "shipmentGenerationRunId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "shipmentGeneratedItems"}), (b:Entity {name: "shipmentSchedules"})
CREATE (a)-[:REFERENCES {fields: "shipmentScheduleId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "shipmentGenerationRuns"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "shipmentGenerationRuns"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "shipmentGenerationRuns"}), (b:Entity {name: "memberships"})
CREATE (a)-[:REFERENCES {fields: "membership_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "shipmentGenerationRuns"}), (b:Entity {name: "shipmentSchedules"})
CREATE (a)-[:REFERENCES {fields: "shipmentScheduleId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "shipmentSchedules"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "shipmentSchedules"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "shipmentSchedules"}), (b:Entity {name: "memberships"})
CREATE (a)-[:REFERENCES {fields: "membership_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaBreachEvents"}), (b:Entity {name: "arInvoices"})
CREATE (a)-[:REFERENCES {fields: "arInvoice_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaBreachEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaBreachEvents"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaBreachEvents"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaBreachEvents"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaBreachEvents"}), (b:Entity {name: "queueEntries"})
CREATE (a)-[:REFERENCES {fields: "queueEntryId, queueEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaBreachEvents"}), (b:Entity {name: "queues"})
CREATE (a)-[:REFERENCES {fields: "queue_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaBreachEvents"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resourceId, resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaBreachEvents"}), (b:Entity {name: "slaPolicies"})
CREATE (a)-[:REFERENCES {fields: "slaPolicyId, slaPolicy_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaCompensationEvents"}), (b:Entity {name: "arInvoices"})
CREATE (a)-[:REFERENCES {fields: "arInvoice_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaCompensationEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaCompensationEvents"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaCompensationEvents"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaCompensationEvents"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaCompensationEvents"}), (b:Entity {name: "queueEntries"})
CREATE (a)-[:REFERENCES {fields: "queueEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaCompensationEvents"}), (b:Entity {name: "queues"})
CREATE (a)-[:REFERENCES {fields: "queue_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaCompensationEvents"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaCompensationEvents"}), (b:Entity {name: "slaBreachEvents"})
CREATE (a)-[:REFERENCES {fields: "slaBreachEventId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaCompensationEvents"}), (b:Entity {name: "slaPolicies"})
CREATE (a)-[:REFERENCES {fields: "slaPolicy_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaPolicies"}), (b:Entity {name: "arInvoices"})
CREATE (a)-[:REFERENCES {fields: "arInvoice_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaPolicies"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaPolicies"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaPolicies"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaPolicies"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaPolicies"}), (b:Entity {name: "queueEntries"})
CREATE (a)-[:REFERENCES {fields: "queueEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaPolicies"}), (b:Entity {name: "queues"})
CREATE (a)-[:REFERENCES {fields: "queue_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaPolicies"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "slaPolicies"}), (b:Entity {name: "slaPolicies"})
CREATE (a)-[:REFERENCES {fields: "slaPolicy_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "staffingAssignments"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "staffingAssignments"}), (b:Entity {name: "staffingDemands"})
CREATE (a)-[:REFERENCES {fields: "staffingDemandId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "staffingAssignments"}), (b:Entity {name: "staffingPools"})
CREATE (a)-[:REFERENCES {fields: "staffingPool_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "staffingDemandRequirements"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "staffingDemandRequirements"}), (b:Entity {name: "staffingDemands"})
CREATE (a)-[:REFERENCES {fields: "staffingDemandId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "staffingDemandRequirements"}), (b:Entity {name: "staffingPools"})
CREATE (a)-[:REFERENCES {fields: "staffingPool_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "staffingDemandSelectors"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "staffingDemandSelectors"}), (b:Entity {name: "staffingDemandRequirements"})
CREATE (a)-[:REFERENCES {fields: "staffingDemandRequirementId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "staffingDemandSelectors"}), (b:Entity {name: "staffingPools"})
CREATE (a)-[:REFERENCES {fields: "staffingPool_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "staffingDemands"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "staffingDemands"}), (b:Entity {name: "staffingPools"})
CREATE (a)-[:REFERENCES {fields: "staffingPoolId, staffingPool_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "staffingFairnessCounters"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "staffingFairnessCounters"}), (b:Entity {name: "staffingPools"})
CREATE (a)-[:REFERENCES {fields: "staffingPoolId, staffingPool_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "staffingPoolMembers"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "staffingPoolMembers"}), (b:Entity {name: "staffingPools"})
CREATE (a)-[:REFERENCES {fields: "staffingPoolId, staffingPool_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "staffingPools"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "staffingPools"}), (b:Entity {name: "staffingPools"})
CREATE (a)-[:REFERENCES {fields: "staffingPool_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "staffingResponses"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "staffingResponses"}), (b:Entity {name: "staffingDemands"})
CREATE (a)-[:REFERENCES {fields: "staffingDemandId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "staffingResponses"}), (b:Entity {name: "staffingPools"})
CREATE (a)-[:REFERENCES {fields: "staffingPool_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "standingReservationContracts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "standingReservationExceptions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "standingReservationExceptions"}), (b:Entity {name: "standingReservationContracts"})
CREATE (a)-[:REFERENCES {fields: "standingReservationContractId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "standingReservationOccurrences"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "standingReservationOccurrences"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "standingReservationOccurrences"}), (b:Entity {name: "standingReservationContracts"})
CREATE (a)-[:REFERENCES {fields: "standingReservationContractId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeAccounts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeAccounts"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeAccounts"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrder_id, crossBizOrder_id, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeAccounts"}), (b:Entity {name: "groupAccounts"})
CREATE (a)-[:REFERENCES {fields: "groupAccount_id, groupAccount_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeAccounts"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntentRef_id, paymentIntentRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeAccounts"}), (b:Entity {name: "paymentProcessorAccounts"})
CREATE (a)-[:REFERENCES {fields: "paymentProcessorAccountId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeAccounts"}), (b:Entity {name: "paymentTransactions"})
CREATE (a)-[:REFERENCES {fields: "paymentTransactionRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeAccounts"}), (b:Entity {name: "stripeAccounts"})
CREATE (a)-[:REFERENCES {fields: "stripeAccountRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeCheckoutSessions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeCheckoutSessions"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeCheckoutSessions"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrderId, crossBizOrder_id, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeCheckoutSessions"}), (b:Entity {name: "groupAccounts"})
CREATE (a)-[:REFERENCES {fields: "groupAccount_id, groupAccount_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeCheckoutSessions"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntentRefId, paymentIntentRef_id, paymentIntentRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeCheckoutSessions"}), (b:Entity {name: "paymentTransactions"})
CREATE (a)-[:REFERENCES {fields: "paymentTransactionRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeCheckoutSessions"}), (b:Entity {name: "stripeAccounts"})
CREATE (a)-[:REFERENCES {fields: "stripeAccountRefId, stripeAccountRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeCheckoutSessions"}), (b:Entity {name: "stripeCustomers"})
CREATE (a)-[:REFERENCES {fields: "stripeCustomerRefId, stripeCustomerRef_id, stripeCustomerRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeCustomers"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeCustomers"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeCustomers"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrder_id, crossBizOrder_id, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeCustomers"}), (b:Entity {name: "groupAccounts"})
CREATE (a)-[:REFERENCES {fields: "groupAccountId, groupAccount_id, groupAccount_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeCustomers"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntentRef_id, paymentIntentRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeCustomers"}), (b:Entity {name: "paymentTransactions"})
CREATE (a)-[:REFERENCES {fields: "paymentTransactionRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeCustomers"}), (b:Entity {name: "stripeAccounts"})
CREATE (a)-[:REFERENCES {fields: "stripeAccountRefId, stripeAccountRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeCustomers"}), (b:Entity {name: "stripeCustomers"})
CREATE (a)-[:REFERENCES {fields: "stripeCustomerRef_id, stripeCustomerRef_id, stripeCustomerRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeInvoices"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeInvoices"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeInvoices"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrderId, crossBizOrder_id, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeInvoices"}), (b:Entity {name: "groupAccounts"})
CREATE (a)-[:REFERENCES {fields: "groupAccount_id, groupAccount_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeInvoices"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntentRef_id, paymentIntentRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeInvoices"}), (b:Entity {name: "paymentTransactions"})
CREATE (a)-[:REFERENCES {fields: "paymentTransactionRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeInvoices"}), (b:Entity {name: "stripeAccounts"})
CREATE (a)-[:REFERENCES {fields: "stripeAccountRefId, stripeAccountRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeInvoices"}), (b:Entity {name: "stripeCustomers"})
CREATE (a)-[:REFERENCES {fields: "stripeCustomerRefId, stripeCustomerRef_id, stripeCustomerRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripePaymentMethods"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripePaymentMethods"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripePaymentMethods"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrder_id, crossBizOrder_id, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripePaymentMethods"}), (b:Entity {name: "groupAccounts"})
CREATE (a)-[:REFERENCES {fields: "groupAccount_id, groupAccount_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripePaymentMethods"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntentRef_id, paymentIntentRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripePaymentMethods"}), (b:Entity {name: "paymentTransactions"})
CREATE (a)-[:REFERENCES {fields: "paymentTransactionRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripePaymentMethods"}), (b:Entity {name: "stripeAccounts"})
CREATE (a)-[:REFERENCES {fields: "stripeAccountRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripePaymentMethods"}), (b:Entity {name: "stripeCustomers"})
CREATE (a)-[:REFERENCES {fields: "stripeCustomerRefId, stripeCustomerRef_id, stripeCustomerRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripePayouts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripePayouts"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripePayouts"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrder_id, crossBizOrder_id, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripePayouts"}), (b:Entity {name: "groupAccounts"})
CREATE (a)-[:REFERENCES {fields: "groupAccount_id, groupAccount_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripePayouts"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntentRef_id, paymentIntentRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripePayouts"}), (b:Entity {name: "paymentTransactions"})
CREATE (a)-[:REFERENCES {fields: "paymentTransactionRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripePayouts"}), (b:Entity {name: "stripeAccounts"})
CREATE (a)-[:REFERENCES {fields: "stripeAccountRefId, stripeAccountRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripePayouts"}), (b:Entity {name: "stripeCustomers"})
CREATE (a)-[:REFERENCES {fields: "stripeCustomerRef_id, stripeCustomerRef_id, stripeCustomerRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeSetupIntents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeSetupIntents"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeSetupIntents"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrder_id, crossBizOrder_id, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeSetupIntents"}), (b:Entity {name: "groupAccounts"})
CREATE (a)-[:REFERENCES {fields: "groupAccountId, groupAccount_id, groupAccount_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeSetupIntents"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntentRef_id, paymentIntentRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeSetupIntents"}), (b:Entity {name: "paymentTransactions"})
CREATE (a)-[:REFERENCES {fields: "paymentTransactionRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeSetupIntents"}), (b:Entity {name: "stripeAccounts"})
CREATE (a)-[:REFERENCES {fields: "stripeAccountRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeSetupIntents"}), (b:Entity {name: "stripeCustomers"})
CREATE (a)-[:REFERENCES {fields: "stripeCustomerRefId, stripeCustomerRef_id, stripeCustomerRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeTransfers"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeTransfers"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeTransfers"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrderId, crossBizOrder_id, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeTransfers"}), (b:Entity {name: "groupAccounts"})
CREATE (a)-[:REFERENCES {fields: "groupAccount_id, groupAccount_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeTransfers"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntentRefId, paymentIntentRef_id, paymentIntentRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeTransfers"}), (b:Entity {name: "paymentTransactions"})
CREATE (a)-[:REFERENCES {fields: "paymentTransactionRefId, paymentTransactionRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeTransfers"}), (b:Entity {name: "stripeAccounts"})
CREATE (a)-[:REFERENCES {fields: "destinationAccountRefId, stripeAccountRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeTransfers"}), (b:Entity {name: "stripeCustomers"})
CREATE (a)-[:REFERENCES {fields: "stripeCustomerRef_id, stripeCustomerRef_id, stripeCustomerRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeWebhookEvents"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId, biz_id, biz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeWebhookEvents"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeWebhookEvents"}), (b:Entity {name: "crossBizOrders"})
CREATE (a)-[:REFERENCES {fields: "crossBizOrder_id, crossBizOrder_id, crossBizOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeWebhookEvents"}), (b:Entity {name: "groupAccounts"})
CREATE (a)-[:REFERENCES {fields: "groupAccount_id, groupAccount_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeWebhookEvents"}), (b:Entity {name: "paymentIntents"})
CREATE (a)-[:REFERENCES {fields: "paymentIntentRef_id, paymentIntentRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeWebhookEvents"}), (b:Entity {name: "paymentTransactions"})
CREATE (a)-[:REFERENCES {fields: "paymentTransactionRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeWebhookEvents"}), (b:Entity {name: "stripeAccounts"})
CREATE (a)-[:REFERENCES {fields: "stripeAccountRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "stripeWebhookEvents"}), (b:Entity {name: "stripeCustomers"})
CREATE (a)-[:REFERENCES {fields: "stripeCustomerRef_id, stripeCustomerRef_id, stripeCustomerRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "subjectLocationBindings"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "subjectRelationships"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "subjects"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "surveyInvitations"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "surveyInvitations"}), (b:Entity {name: "surveyTemplates"})
CREATE (a)-[:REFERENCES {fields: "surveyTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "surveyQuestions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "surveyQuestions"}), (b:Entity {name: "surveyTemplates"})
CREATE (a)-[:REFERENCES {fields: "surveyTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "surveyResponseAnswers"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "surveyResponseAnswers"}), (b:Entity {name: "surveyQuestions"})
CREATE (a)-[:REFERENCES {fields: "surveyQuestionId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "surveyResponseAnswers"}), (b:Entity {name: "surveyResponses"})
CREATE (a)-[:REFERENCES {fields: "surveyResponseId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "surveyResponses"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "surveyResponses"}), (b:Entity {name: "surveyInvitations"})
CREATE (a)-[:REFERENCES {fields: "surveyInvitationId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "surveyTemplates"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "taxCalculations"}), (b:Entity {name: "arInvoices"})
CREATE (a)-[:REFERENCES {fields: "arInvoiceId, arInvoice_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "taxCalculations"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "taxCalculations"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "taxCalculations"}), (b:Entity {name: "fxRateSnapshots"})
CREATE (a)-[:REFERENCES {fields: "fxRateSnapshotId, fxRateSnapshot_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "taxCalculations"}), (b:Entity {name: "taxProfiles"})
CREATE (a)-[:REFERENCES {fields: "taxProfileId, taxProfile_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "taxCalculations"}), (b:Entity {name: "taxRuleRefs"})
CREATE (a)-[:REFERENCES {fields: "taxRuleRefId, taxRuleRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "taxProfiles"}), (b:Entity {name: "arInvoices"})
CREATE (a)-[:REFERENCES {fields: "arInvoice_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "taxProfiles"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "taxProfiles"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "taxProfiles"}), (b:Entity {name: "fxRateSnapshots"})
CREATE (a)-[:REFERENCES {fields: "fxRateSnapshot_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "taxProfiles"}), (b:Entity {name: "taxProfiles"})
CREATE (a)-[:REFERENCES {fields: "taxProfile_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "taxRuleRefs"}), (b:Entity {name: "arInvoices"})
CREATE (a)-[:REFERENCES {fields: "arInvoice_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "taxRuleRefs"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "taxRuleRefs"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "taxRuleRefs"}), (b:Entity {name: "fxRateSnapshots"})
CREATE (a)-[:REFERENCES {fields: "fxRateSnapshot_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "taxRuleRefs"}), (b:Entity {name: "taxProfiles"})
CREATE (a)-[:REFERENCES {fields: "taxProfileId, taxProfile_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "taxRuleRefs"}), (b:Entity {name: "taxRuleRefs"})
CREATE (a)-[:REFERENCES {fields: "taxRuleRef_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "tenantComplianceProfiles"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportRouteStops"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportRouteStops"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportRouteStops"}), (b:Entity {name: "fleetVehicles"})
CREATE (a)-[:REFERENCES {fields: "fleetVehicle_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportRouteStops"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "originLocation_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportRouteStops"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportRouteStops"}), (b:Entity {name: "queueEntries"})
CREATE (a)-[:REFERENCES {fields: "queueEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportRouteStops"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, driverResource_id, assignedResource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportRouteStops"}), (b:Entity {name: "transportRouteStops"})
CREATE (a)-[:REFERENCES {fields: "routeStop_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportRouteStops"}), (b:Entity {name: "transportRoutes"})
CREATE (a)-[:REFERENCES {fields: "routeId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportRoutes"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportRoutes"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportRoutes"}), (b:Entity {name: "fleetVehicles"})
CREATE (a)-[:REFERENCES {fields: "fleetVehicle_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportRoutes"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "originLocation_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportRoutes"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportRoutes"}), (b:Entity {name: "queueEntries"})
CREATE (a)-[:REFERENCES {fields: "queueEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportRoutes"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, driverResource_id, assignedResource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportTrips"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportTrips"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportTrips"}), (b:Entity {name: "fleetVehicles"})
CREATE (a)-[:REFERENCES {fields: "fleetVehicleId, fleetVehicle_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportTrips"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "originLocation_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportTrips"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersionId, offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportTrips"}), (b:Entity {name: "queueEntries"})
CREATE (a)-[:REFERENCES {fields: "queueEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportTrips"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "driverResourceId, resource_id, driverResource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportTrips"}), (b:Entity {name: "transportRouteStops"})
CREATE (a)-[:REFERENCES {fields: "routeStop_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportTrips"}), (b:Entity {name: "transportRoutes"})
CREATE (a)-[:REFERENCES {fields: "routeId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "transportTrips"}), (b:Entity {name: "transportTrips"})
CREATE (a)-[:REFERENCES {fields: "trip_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "tripManifests"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "tripManifests"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrderId, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "tripManifests"}), (b:Entity {name: "fleetVehicles"})
CREATE (a)-[:REFERENCES {fields: "fleetVehicle_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "tripManifests"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "originLocation_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "tripManifests"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "tripManifests"}), (b:Entity {name: "queueEntries"})
CREATE (a)-[:REFERENCES {fields: "queueEntryId, queueEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "tripManifests"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, driverResource_id, assignedResource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "tripManifests"}), (b:Entity {name: "transportRouteStops"})
CREATE (a)-[:REFERENCES {fields: "routeStop_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "tripManifests"}), (b:Entity {name: "transportTrips"})
CREATE (a)-[:REFERENCES {fields: "tripId, trip_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "tripStopInventory"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "tripStopInventory"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "tripStopInventory"}), (b:Entity {name: "fleetVehicles"})
CREATE (a)-[:REFERENCES {fields: "fleetVehicle_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "tripStopInventory"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "originLocation_id, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "tripStopInventory"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "tripStopInventory"}), (b:Entity {name: "queueEntries"})
CREATE (a)-[:REFERENCES {fields: "queueEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "tripStopInventory"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id, driverResource_id, assignedResource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "tripStopInventory"}), (b:Entity {name: "transportRouteStops"})
CREATE (a)-[:REFERENCES {fields: "routeStopId, routeStop_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "tripStopInventory"}), (b:Entity {name: "transportTrips"})
CREATE (a)-[:REFERENCES {fields: "tripId, trip_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "userCredentialDocuments"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "verifierBiz_id, granteeBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "userCredentialDocuments"}), (b:Entity {name: "userCredentialRecords"})
CREATE (a)-[:REFERENCES {fields: "userCredentialRecordId, credentialRecord_id, credentialRecord_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "userCredentialFacts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "verifierBiz_id, granteeBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "userCredentialFacts"}), (b:Entity {name: "userCredentialRecords"})
CREATE (a)-[:REFERENCES {fields: "userCredentialRecordId, credentialRecord_id, credentialRecord_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "userCredentialProfiles"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "verifierBiz_id, granteeBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "userCredentialRecords"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "verifierBiz_id, granteeBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "userCredentialRecords"}), (b:Entity {name: "userCredentialRecords"})
CREATE (a)-[:REFERENCES {fields: "credentialRecord_id, credentialRecord_id, credentialRecord_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "userCredentialVerifications"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "verifierBiz_id, granteeBiz_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "userCredentialVerifications"}), (b:Entity {name: "userCredentialRecords"})
CREATE (a)-[:REFERENCES {fields: "userCredentialRecordId, credentialRecord_id, credentialRecord_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "venues"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "venues"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "locationId, location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "waitTimePredictions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "waitTimePredictions"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "waitTimePredictions"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "waitTimePredictions"}), (b:Entity {name: "offerVersions"})
CREATE (a)-[:REFERENCES {fields: "offerVersion_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "waitTimePredictions"}), (b:Entity {name: "queueEntries"})
CREATE (a)-[:REFERENCES {fields: "queueEntryId, queueEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "waitTimePredictions"}), (b:Entity {name: "queues"})
CREATE (a)-[:REFERENCES {fields: "queueId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "wishlistItems"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "wishlistItems"}), (b:Entity {name: "wishlists"})
CREATE (a)-[:REFERENCES {fields: "wishlistId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "wishlists"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workApprovals"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workApprovals"}), (b:Entity {name: "idempotencyKeys"})
CREATE (a)-[:REFERENCES {fields: "idempotencyKey_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workApprovals"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workApprovals"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workApprovals"}), (b:Entity {name: "users"})
CREATE (a)-[:REFERENCES {fields: "approverUserId, assigneeUser_id, completedByUser_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workApprovals"}), (b:Entity {name: "workEntries"})
CREATE (a)-[:REFERENCES {fields: "workEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workApprovals"}), (b:Entity {name: "workRunSteps"})
CREATE (a)-[:REFERENCES {fields: "workRunStep_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workApprovals"}), (b:Entity {name: "workRuns"})
CREATE (a)-[:REFERENCES {fields: "workRunId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workArtifacts"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workArtifacts"}), (b:Entity {name: "idempotencyKeys"})
CREATE (a)-[:REFERENCES {fields: "idempotencyKey_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workArtifacts"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workArtifacts"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workArtifacts"}), (b:Entity {name: "users"})
CREATE (a)-[:REFERENCES {fields: "assigneeUser_id, completedByUser_id, approvedByUser_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workArtifacts"}), (b:Entity {name: "workEntries"})
CREATE (a)-[:REFERENCES {fields: "workEntryId, workEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workArtifacts"}), (b:Entity {name: "workRunSteps"})
CREATE (a)-[:REFERENCES {fields: "workRunStep_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workArtifacts"}), (b:Entity {name: "workRuns"})
CREATE (a)-[:REFERENCES {fields: "workRunId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workEntries"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workEntries"}), (b:Entity {name: "idempotencyKeys"})
CREATE (a)-[:REFERENCES {fields: "idempotencyKey_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workEntries"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workEntries"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workEntries"}), (b:Entity {name: "users"})
CREATE (a)-[:REFERENCES {fields: "assigneeUser_id, completedByUser_id, approvedByUser_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workEntries"}), (b:Entity {name: "workEntries"})
CREATE (a)-[:REFERENCES {fields: "workEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workEntries"}), (b:Entity {name: "workRunSteps"})
CREATE (a)-[:REFERENCES {fields: "workRunStepId, workRunStep_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workEntries"}), (b:Entity {name: "workRuns"})
CREATE (a)-[:REFERENCES {fields: "workRunId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workRunSteps"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workRunSteps"}), (b:Entity {name: "idempotencyKeys"})
CREATE (a)-[:REFERENCES {fields: "idempotencyKey_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workRunSteps"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workRunSteps"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workRunSteps"}), (b:Entity {name: "users"})
CREATE (a)-[:REFERENCES {fields: "assigneeUser_id, completedByUser_id, approvedByUser_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workRunSteps"}), (b:Entity {name: "workRunSteps"})
CREATE (a)-[:REFERENCES {fields: "workRunStep_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workRunSteps"}), (b:Entity {name: "workRuns"})
CREATE (a)-[:REFERENCES {fields: "workRunId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workRunSteps"}), (b:Entity {name: "workTemplateSteps"})
CREATE (a)-[:REFERENCES {fields: "workTemplateStepId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workRuns"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workRuns"}), (b:Entity {name: "idempotencyKeys"})
CREATE (a)-[:REFERENCES {fields: "idempotencyKey_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workRuns"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workRuns"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workRuns"}), (b:Entity {name: "users"})
CREATE (a)-[:REFERENCES {fields: "assigneeUser_id, completedByUser_id, approvedByUser_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workRuns"}), (b:Entity {name: "workTemplates"})
CREATE (a)-[:REFERENCES {fields: "workTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTemplateSteps"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTemplateSteps"}), (b:Entity {name: "idempotencyKeys"})
CREATE (a)-[:REFERENCES {fields: "idempotencyKey_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTemplateSteps"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTemplateSteps"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTemplateSteps"}), (b:Entity {name: "users"})
CREATE (a)-[:REFERENCES {fields: "assigneeUser_id, completedByUser_id, approvedByUser_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTemplateSteps"}), (b:Entity {name: "workTemplates"})
CREATE (a)-[:REFERENCES {fields: "workTemplateId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTemplates"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTemplates"}), (b:Entity {name: "idempotencyKeys"})
CREATE (a)-[:REFERENCES {fields: "idempotencyKey_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTemplates"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTemplates"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTemplates"}), (b:Entity {name: "users"})
CREATE (a)-[:REFERENCES {fields: "assigneeUser_id, completedByUser_id, approvedByUser_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTimeSegmentAllocations"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTimeSegmentAllocations"}), (b:Entity {name: "idempotencyKeys"})
CREATE (a)-[:REFERENCES {fields: "idempotencyKey_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTimeSegmentAllocations"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTimeSegmentAllocations"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTimeSegmentAllocations"}), (b:Entity {name: "staffingAssignments"})
CREATE (a)-[:REFERENCES {fields: "staffingAssignmentId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTimeSegmentAllocations"}), (b:Entity {name: "users"})
CREATE (a)-[:REFERENCES {fields: "assigneeUser_id, completedByUser_id, approvedByUser_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTimeSegmentAllocations"}), (b:Entity {name: "workEntries"})
CREATE (a)-[:REFERENCES {fields: "workEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTimeSegmentAllocations"}), (b:Entity {name: "workRunSteps"})
CREATE (a)-[:REFERENCES {fields: "workRunStep_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTimeSegmentAllocations"}), (b:Entity {name: "workTimeSegments"})
CREATE (a)-[:REFERENCES {fields: "workTimeSegmentId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTimeSegments"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTimeSegments"}), (b:Entity {name: "idempotencyKeys"})
CREATE (a)-[:REFERENCES {fields: "idempotencyKey_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTimeSegments"}), (b:Entity {name: "locations"})
CREATE (a)-[:REFERENCES {fields: "location_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTimeSegments"}), (b:Entity {name: "resources"})
CREATE (a)-[:REFERENCES {fields: "resource_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTimeSegments"}), (b:Entity {name: "users"})
CREATE (a)-[:REFERENCES {fields: "userId, assigneeUser_id, completedByUser_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTimeSegments"}), (b:Entity {name: "workEntries"})
CREATE (a)-[:REFERENCES {fields: "workEntry_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTimeSegments"}), (b:Entity {name: "workRunSteps"})
CREATE (a)-[:REFERENCES {fields: "workRunStep_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workTimeSegments"}), (b:Entity {name: "workRuns"})
CREATE (a)-[:REFERENCES {fields: "workRunId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workflowDecisions"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workflowDecisions"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workflowDecisions"}), (b:Entity {name: "users"})
CREATE (a)-[:REFERENCES {fields: "deciderUserId, assignedToUser_id, assignedToUser_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workflowDecisions"}), (b:Entity {name: "workflowInstances"})
CREATE (a)-[:REFERENCES {fields: "workflowInstanceId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workflowDecisions"}), (b:Entity {name: "workflowSteps"})
CREATE (a)-[:REFERENCES {fields: "workflowStepId, workflowStep_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workflowInstances"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workflowInstances"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workflowInstances"}), (b:Entity {name: "users"})
CREATE (a)-[:REFERENCES {fields: "assignedToUser_id, assignedToUser_id, deciderUser_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workflowSteps"}), (b:Entity {name: "bizes"})
CREATE (a)-[:REFERENCES {fields: "bizId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workflowSteps"}), (b:Entity {name: "bookingOrders"})
CREATE (a)-[:REFERENCES {fields: "bookingOrder_id, bookingOrder_id, bookingOrder_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workflowSteps"}), (b:Entity {name: "users"})
CREATE (a)-[:REFERENCES {fields: "assignedToUser_id, assignedToUser_id, deciderUser_id", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workflowSteps"}), (b:Entity {name: "workflowInstances"})
CREATE (a)-[:REFERENCES {fields: "workflowInstanceId", type: "N:1"}]->(b)

MATCH (a:Entity {name: "workflowSteps"}), (b:Entity {name: "workflowSteps"})
CREATE (a)-[:REFERENCES {fields: "workflowStep_id", type: "N:1"}]->(b)

// Indexes
CREATE INDEX entity_name FOR (e:Entity) ON (e.name);
CREATE INDEX entity_domain FOR (e:Entity) ON (e.domain);

// Stats
RETURN '479 tables, 3129 relationships created' as status;