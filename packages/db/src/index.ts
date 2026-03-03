import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

// Common utilities
export * from './schema/_common'
export * from './schema/enums'

// Schema exports
export * from './schema/bizes'
export * from './schema/users'
export * from './schema/locations'
export * from './schema/group_accounts'
export * from './schema/services'
export * from './schema/products'
export * from './schema/service_products'
export * from './schema/biz_configs'
export * from './schema/auth'
export * from './schema/assets'
export * from './schema/venues'
export * from './schema/resources'
export * from './schema/stripe'
export * from './schema/social_graph'
export * from './schema/api_credentials'
export * from './schema/auth_observability'
export * from './schema/ref_keys'
export * from './schema/sagas'
export * from './schema/ar'
export * from './schema/sla'
export * from './schema/supply'
export * from './schema/extensions'
export * from './schema/action_backbone'
export * from './schema/domain_events'
export * from './schema/external_installations'
export * from './schema/schedule_subjects'
export * from './schema/projections'
export * from './schema/instruments'
export * from './schema/communications'
export * from './schema/credential_exchange'
export * from './schema/enterprise'
export * from './schema/gifts'
export * from './schema/crm'
export * from './schema/customer_ops'
export * from './schema/receivables'
export * from './schema/gift_delivery'
export * from './schema/marketing_performance'
export * from './schema/supply_batches'
export * from './schema/ooda'
/**
 * Canonical booking architecture.
 *
 * v0 policy:
 * - no backwards-compatibility shims
 * - no duplicated legacy booking domains
 * - all new API/domain work should use these tables directly
 */
export * from './schema/canonical'
export * as schemaCanonical from './schema/canonical'

import * as enumsSchema from './schema/enums'
import * as bizesSchema from './schema/bizes'
import * as usersSchema from './schema/users'
import * as locationsSchema from './schema/locations'
import * as groupAccountsSchema from './schema/group_accounts'
import * as servicesSchema from './schema/services'
import * as productsSchema from './schema/products'
import * as serviceProductsSchema from './schema/service_products'
import * as bizConfigsSchema from './schema/biz_configs'
import * as authSchema from './schema/auth'
import * as assetsSchema from './schema/assets'
import * as venuesSchema from './schema/venues'
import * as resourcesSchema from './schema/resources'
import * as stripeSchema from './schema/stripe'
import * as socialGraphSchema from './schema/social_graph'
import * as apiCredentialsSchema from './schema/api_credentials'
import * as authObservabilitySchema from './schema/auth_observability'
import * as sagasSchema from './schema/sagas'
import * as arSchema from './schema/ar'
import * as slaSchema from './schema/sla'
import * as supplySchema from './schema/supply'
import * as extensionsSchema from './schema/extensions'
import * as actionBackboneSchema from './schema/action_backbone'
import * as domainEventsSchema from './schema/domain_events'
import * as externalInstallationsSchema from './schema/external_installations'
import * as scheduleSubjectsSchema from './schema/schedule_subjects'
import * as projectionsSchema from './schema/projections'
import * as instrumentsSchema from './schema/instruments'
import * as communicationsSchema from './schema/communications'
import * as credentialExchangeSchema from './schema/credential_exchange'
import * as enterpriseSchema from './schema/enterprise'
import * as giftsSchema from './schema/gifts'
import * as crmSchema from './schema/crm'
import * as customerOpsSchema from './schema/customer_ops'
import * as receivablesSchema from './schema/receivables'
import * as giftDeliverySchema from './schema/gift_delivery'
import * as marketingPerformanceSchema from './schema/marketing_performance'
import * as supplyBatchesSchema from './schema/supply_batches'
import * as oodaSchema from './schema/ooda'
import * as canonicalSchemaModules from './schema/canonical'

/**
 * Shared core models used by canonical booking domains.
 */
const schemaCore = {
  ...enumsSchema,
  ...bizesSchema,
  ...usersSchema,
  ...locationsSchema,
  ...groupAccountsSchema,
  ...servicesSchema,
  ...productsSchema,
  ...serviceProductsSchema,
  ...bizConfigsSchema,
  ...authSchema,
  ...assetsSchema,
  ...venuesSchema,
  ...resourcesSchema,
  ...stripeSchema,
  ...socialGraphSchema,
  ...apiCredentialsSchema,
  ...authObservabilitySchema,
  ...sagasSchema,
  ...arSchema,
  ...slaSchema,
  ...supplySchema,
  ...extensionsSchema,
  ...actionBackboneSchema,
  ...domainEventsSchema,
  ...externalInstallationsSchema,
  ...scheduleSubjectsSchema,
  ...projectionsSchema,
  ...instrumentsSchema,
  ...communicationsSchema,
  ...credentialExchangeSchema,
  ...enterpriseSchema,
  ...giftsSchema,
  ...crmSchema,
  ...customerOpsSchema,
  ...receivablesSchema,
  ...giftDeliverySchema,
  ...marketingPerformanceSchema,
  ...supplyBatchesSchema,
  ...oodaSchema,
}

/**
 * Unified active Drizzle schema registry.
 *
 * Order is intentional:
 * 1) core shared models
 * 2) canonical booking modules
 */
const schema = {
  ...schemaCore,
  ...canonicalSchemaModules,
}

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required to initialize @bizing/db')
}

export const pool = new Pool({ connectionString })
export const db = drizzle(pool, { schema })

export async function checkDatabaseConnection(): Promise<boolean> {
  const client = await pool.connect()
  try {
    await client.query('SELECT 1')
    return true
  } finally {
    client.release()
  }
}

const dbPackage = {
  db,
  pool,
  checkDatabaseConnection,
  authSchema: authSchema.authSchema,
  bizes: bizesSchema.bizes,
  members: authSchema.members,
  invitations: authSchema.invitations,
  sessions: authSchema.sessions,
  accounts: authSchema.accounts,
  verifications: authSchema.verifications,
  locations: locationsSchema.locations,
  serviceGroups: servicesSchema.serviceGroups,
  services: servicesSchema.services,
  serviceProducts: serviceProductsSchema.serviceProducts,
  bizConfigSets: bizConfigsSchema.bizConfigSets,
  bizConfigValues: bizConfigsSchema.bizConfigValues,
  bizConfigValueLocalizations: bizConfigsSchema.bizConfigValueLocalizations,
  bizConfigBindings: bizConfigsSchema.bizConfigBindings,
  serviceProductServices: serviceProductsSchema.serviceProductServices,
  serviceProductRequirementGroups: serviceProductsSchema.serviceProductRequirementGroups,
  serviceProductRequirementSelectors: serviceProductsSchema.serviceProductRequirementSelectors,
  calendars: canonicalSchemaModules.calendars,
  calendarBindings: canonicalSchemaModules.calendarBindings,
  calendarOverlays: canonicalSchemaModules.calendarOverlays,
  availabilityRules: canonicalSchemaModules.availabilityRules,
  availabilityDependencyRules: canonicalSchemaModules.availabilityDependencyRules,
  availabilityDependencyRuleTargets: canonicalSchemaModules.availabilityDependencyRuleTargets,
  capacityHolds: canonicalSchemaModules.capacityHolds,
  resources: resourcesSchema.resources,
  resourceCapabilityTemplates: canonicalSchemaModules.resourceCapabilityTemplates,
  resourceCapabilityAssignments: canonicalSchemaModules.resourceCapabilityAssignments,
  bookingOrders: canonicalSchemaModules.bookingOrders,
  bookingOrderLines: canonicalSchemaModules.bookingOrderLines,
  offers: canonicalSchemaModules.offers,
  offerVersions: canonicalSchemaModules.offerVersions,
  offerVersionAdmissionModes: canonicalSchemaModules.offerVersionAdmissionModes,
  paymentProcessorAccounts: canonicalSchemaModules.paymentProcessorAccounts,
  paymentMethods: canonicalSchemaModules.paymentMethods,
  paymentIntents: canonicalSchemaModules.paymentIntents,
  paymentIntentEvents: canonicalSchemaModules.paymentIntentEvents,
  paymentIntentTenders: canonicalSchemaModules.paymentIntentTenders,
  paymentIntentLineAllocations: canonicalSchemaModules.paymentIntentLineAllocations,
  paymentTransactions: canonicalSchemaModules.paymentTransactions,
  paymentTransactionLineAllocations: canonicalSchemaModules.paymentTransactionLineAllocations,
  checkoutSessions: canonicalSchemaModules.checkoutSessions,
  checkoutSessionItems: canonicalSchemaModules.checkoutSessionItems,
  checkoutSessionEvents: canonicalSchemaModules.checkoutSessionEvents,
  checkoutRecoveryLinks: canonicalSchemaModules.checkoutRecoveryLinks,
  groupAccounts: groupAccountsSchema.groupAccounts,
  groupAccountMembers: groupAccountsSchema.groupAccountMembers,
  bookingParticipantObligations: canonicalSchemaModules.bookingParticipantObligations,
  participantObligationEvents: canonicalSchemaModules.participantObligationEvents,
  outboundMessages: canonicalSchemaModules.outboundMessages,
  outboundMessageEvents: canonicalSchemaModules.outboundMessageEvents,
  communicationConsents: canonicalSchemaModules.communicationConsents,
  quietHourPolicies: canonicalSchemaModules.quietHourPolicies,
  messageTemplates: communicationsSchema.messageTemplates,
  messageTemplateBindings: communicationsSchema.messageTemplateBindings,
  marketingCampaigns: communicationsSchema.marketingCampaigns,
  marketingCampaignSteps: communicationsSchema.marketingCampaignSteps,
  marketingCampaignEnrollments: communicationsSchema.marketingCampaignEnrollments,
  customFieldDefinitions: extensionsSchema.customFieldDefinitions,
  customFieldDefinitionOptions: extensionsSchema.customFieldDefinitionOptions,
  customFieldValues: extensionsSchema.customFieldValues,
  fxRateSnapshots: canonicalSchemaModules.fxRateSnapshots,
  taxProfiles: canonicalSchemaModules.taxProfiles,
  taxRuleRefs: canonicalSchemaModules.taxRuleRefs,
  taxCalculations: canonicalSchemaModules.taxCalculations,
  auditStreams: canonicalSchemaModules.auditStreams,
  auditEvents: canonicalSchemaModules.auditEvents,
  auditIntegrityRuns: canonicalSchemaModules.auditIntegrityRuns,
  extensionDefinitions: extensionsSchema.extensionDefinitions,
  extensionPermissionDefinitions: extensionsSchema.extensionPermissionDefinitions,
  bizExtensionInstalls: extensionsSchema.bizExtensionInstalls,
  bizExtensionPermissionGrants: extensionsSchema.bizExtensionPermissionGrants,
  extensionStateDocuments: extensionsSchema.extensionStateDocuments,
  queues: canonicalSchemaModules.queues,
  queueEntries: canonicalSchemaModules.queueEntries,
  channelAccounts: canonicalSchemaModules.channelAccounts,
  channelSyncStates: canonicalSchemaModules.channelSyncStates,
  channelEntityLinks: canonicalSchemaModules.channelEntityLinks,
  channelSyncJobs: canonicalSchemaModules.channelSyncJobs,
  channelSyncItems: canonicalSchemaModules.channelSyncItems,
  calendarSyncConnections: canonicalSchemaModules.calendarSyncConnections,
  externalCalendars: canonicalSchemaModules.externalCalendars,
  externalCalendarEvents: canonicalSchemaModules.externalCalendarEvents,
  calendarAccessGrants: canonicalSchemaModules.calendarAccessGrants,
  calendarAccessGrantSources: canonicalSchemaModules.calendarAccessGrantSources,
  graphIdentities: socialGraphSchema.graphIdentities,
  graphSubjectSubscriptions: socialGraphSchema.graphSubjectSubscriptions,
  graphIdentityNotificationEndpoints: socialGraphSchema.graphIdentityNotificationEndpoints,
  graphSubjectEvents: socialGraphSchema.graphSubjectEvents,
  graphSubjectEventDeliveries: socialGraphSchema.graphSubjectEventDeliveries,
  credentialTypeDefinitions: canonicalSchemaModules.credentialTypeDefinitions,
  userCredentialProfiles: canonicalSchemaModules.userCredentialProfiles,
  userCredentialRecords: canonicalSchemaModules.userCredentialRecords,
  userCredentialDocuments: canonicalSchemaModules.userCredentialDocuments,
  userCredentialFacts: canonicalSchemaModules.userCredentialFacts,
  userCredentialVerifications: canonicalSchemaModules.userCredentialVerifications,
  bizCredentialShareGrants: canonicalSchemaModules.bizCredentialShareGrants,
  bizCredentialShareGrantSelectors: canonicalSchemaModules.bizCredentialShareGrantSelectors,
  bizCredentialRequests: canonicalSchemaModules.bizCredentialRequests,
  bizCredentialRequestItems: canonicalSchemaModules.bizCredentialRequestItems,
  credentialDisclosureEvents: canonicalSchemaModules.credentialDisclosureEvents,
  enterpriseRelationshipTemplates: canonicalSchemaModules.enterpriseRelationshipTemplates,
  enterpriseRelationships: canonicalSchemaModules.enterpriseRelationships,
  enterpriseScopes: canonicalSchemaModules.enterpriseScopes,
  enterpriseIntercompanyAccounts: canonicalSchemaModules.enterpriseIntercompanyAccounts,
  enterpriseIntercompanySettlementRuns: canonicalSchemaModules.enterpriseIntercompanySettlementRuns,
  enterpriseIntercompanyEntries: canonicalSchemaModules.enterpriseIntercompanyEntries,
  enterpriseContractPackTemplates: canonicalSchemaModules.enterpriseContractPackTemplates,
  enterpriseContractPackVersions: canonicalSchemaModules.enterpriseContractPackVersions,
  enterpriseContractPackBindings: canonicalSchemaModules.enterpriseContractPackBindings,
  enterpriseAdminDelegations: canonicalSchemaModules.enterpriseAdminDelegations,
  enterpriseApprovalAuthorityLimits: canonicalSchemaModules.enterpriseApprovalAuthorityLimits,
  enterpriseIdentityProviders: canonicalSchemaModules.enterpriseIdentityProviders,
  enterpriseScimSyncStates: canonicalSchemaModules.enterpriseScimSyncStates,
  enterpriseExternalDirectoryLinks: canonicalSchemaModules.enterpriseExternalDirectoryLinks,
  enterpriseChangeRolloutRuns: canonicalSchemaModules.enterpriseChangeRolloutRuns,
  enterpriseChangeRolloutTargets: canonicalSchemaModules.enterpriseChangeRolloutTargets,
  enterpriseChangeRolloutResults: canonicalSchemaModules.enterpriseChangeRolloutResults,
  factEnterpriseRevenueDaily: canonicalSchemaModules.factEnterpriseRevenueDaily,
  factEnterpriseUtilizationDaily: canonicalSchemaModules.factEnterpriseUtilizationDaily,
  subjects: canonicalSchemaModules.subjects,
  transportRoutes: canonicalSchemaModules.transportRoutes,
  transportRouteStops: canonicalSchemaModules.transportRouteStops,
  transportTrips: canonicalSchemaModules.transportTrips,
  dispatchTasks: canonicalSchemaModules.dispatchTasks,
  etaEvents: canonicalSchemaModules.etaEvents,
  demandSignalDefinitions: canonicalSchemaModules.demandSignalDefinitions,
  demandSignalObservations: canonicalSchemaModules.demandSignalObservations,
  demandPricingPolicies: canonicalSchemaModules.demandPricingPolicies,
  demandPricingPolicySignals: canonicalSchemaModules.demandPricingPolicySignals,
  demandPricingPolicyTiers: canonicalSchemaModules.demandPricingPolicyTiers,
  demandPricingEvaluations: canonicalSchemaModules.demandPricingEvaluations,
  demandPricingApplications: canonicalSchemaModules.demandPricingApplications,
  users: usersSchema.users,
  membershipPlans: canonicalSchemaModules.membershipPlans,
  memberships: canonicalSchemaModules.memberships,
  entitlementMemberships: canonicalSchemaModules.memberships,
  entitlementWallets: canonicalSchemaModules.entitlementWallets,
  entitlementGrants: canonicalSchemaModules.entitlementGrants,
  entitlementLedgerEntries: canonicalSchemaModules.entitlementLedgerEntries,
  rolloverRuns: canonicalSchemaModules.rolloverRuns,
  apiCredentials: apiCredentialsSchema.apiCredentials,
  apiAccessTokens: apiCredentialsSchema.apiAccessTokens,
  billingAccounts: arSchema.billingAccounts,
  purchaseOrders: arSchema.purchaseOrders,
  arInvoices: arSchema.arInvoices,
  invoiceEvents: arSchema.invoiceEvents,
  authPrincipals: authObservabilitySchema.authPrincipals,
  authAccessEvents: authObservabilitySchema.authAccessEvents,
  sagaDefinitions: sagasSchema.sagaDefinitions,
  sagaDefinitionRevisions: sagasSchema.sagaDefinitionRevisions,
  sagaRuns: sagasSchema.sagaRuns,
  sagaRunSimulationClocks: sagasSchema.sagaRunSimulationClocks,
  sagaRunSchedulerJobs: sagasSchema.sagaRunSchedulerJobs,
  sagaRunSteps: sagasSchema.sagaRunSteps,
  sagaRunArtifacts: sagasSchema.sagaRunArtifacts,
  sagaRunActorProfiles: sagasSchema.sagaRunActorProfiles,
  sagaRunActorMessages: sagasSchema.sagaRunActorMessages,
  sagaUseCases: sagasSchema.sagaUseCases,
  sagaUseCaseVersions: sagasSchema.sagaUseCaseVersions,
  sagaPersonas: sagasSchema.sagaPersonas,
  sagaPersonaVersions: sagasSchema.sagaPersonaVersions,
  sagaDefinitionLinks: sagasSchema.sagaDefinitionLinks,
  sagaCoverageReports: sagasSchema.sagaCoverageReports,
  sagaCoverageItems: sagasSchema.sagaCoverageItems,
  sagaTags: sagasSchema.sagaTags,
  sagaTagBindings: sagasSchema.sagaTagBindings,
  oodaLoops: oodaSchema.oodaLoops,
  oodaLoopLinks: oodaSchema.oodaLoopLinks,
  oodaLoopEntries: oodaSchema.oodaLoopEntries,
  oodaLoopActions: oodaSchema.oodaLoopActions,
  policyTemplates: canonicalSchemaModules.policyTemplates,
  policyRules: canonicalSchemaModules.policyRules,
  policyBindings: canonicalSchemaModules.policyBindings,
  instruments: instrumentsSchema.instruments,
  instrumentItems: instrumentsSchema.instrumentItems,
  instrumentBindings: instrumentsSchema.instrumentBindings,
  instrumentRuns: instrumentsSchema.instrumentRuns,
  instrumentResponses: instrumentsSchema.instrumentResponses,
  instrumentEvents: instrumentsSchema.instrumentEvents,
  actionRequests: canonicalSchemaModules.actionRequests,
  actionIdempotencyKeys: canonicalSchemaModules.actionIdempotencyKeys,
  actionExecutions: canonicalSchemaModules.actionExecutions,
  actionRelatedEntities: canonicalSchemaModules.actionRelatedEntities,
  actionFailures: canonicalSchemaModules.actionFailures,
  reviewQueues: canonicalSchemaModules.reviewQueues,
  reviewQueueItems: canonicalSchemaModules.reviewQueueItems,
  workflowInstances: canonicalSchemaModules.workflowInstances,
  workflowSteps: canonicalSchemaModules.workflowSteps,
  workflowDecisions: canonicalSchemaModules.workflowDecisions,
  asyncDeliverables: canonicalSchemaModules.asyncDeliverables,
  domainEvents: canonicalSchemaModules.domainEvents,
  eventProjectionCheckpoints: canonicalSchemaModules.eventProjectionCheckpoints,
  businessAssociateAgreements: canonicalSchemaModules.businessAssociateAgreements,
  hipaaAuthorizations: canonicalSchemaModules.hipaaAuthorizations,
  phiAccessPolicies: canonicalSchemaModules.phiAccessPolicies,
  phiAccessEvents: canonicalSchemaModules.phiAccessEvents,
  breakGlassReviews: canonicalSchemaModules.breakGlassReviews,
  phiDisclosureEvents: canonicalSchemaModules.phiDisclosureEvents,
  securityIncidents: canonicalSchemaModules.securityIncidents,
  breachNotifications: canonicalSchemaModules.breachNotifications,
  lifecycleEventSubscriptions: extensionsSchema.lifecycleEventSubscriptions,
  lifecycleEventDeliveries: extensionsSchema.lifecycleEventDeliveries,
  clientInstallations: canonicalSchemaModules.clientInstallations,
  clientInstallationCredentials: canonicalSchemaModules.clientInstallationCredentials,
  customerProfiles: canonicalSchemaModules.customerProfiles,
  customerIdentityHandles: canonicalSchemaModules.customerIdentityHandles,
  customerIdentityLinks: canonicalSchemaModules.customerIdentityLinks,
  customerProfileCrmLinks: canonicalSchemaModules.customerProfileCrmLinks,
  customerTimelineEvents: canonicalSchemaModules.customerTimelineEvents,
  crmActivities: canonicalSchemaModules.crmActivities,
  crmTasks: canonicalSchemaModules.crmTasks,
  supportCases: canonicalSchemaModules.supportCases,
  supportCaseEvents: canonicalSchemaModules.supportCaseEvents,
  supportCaseParticipants: canonicalSchemaModules.supportCaseParticipants,
  supportCaseLinks: canonicalSchemaModules.supportCaseLinks,
  customerJourneys: canonicalSchemaModules.customerJourneys,
  customerJourneySteps: canonicalSchemaModules.customerJourneySteps,
  customerJourneyEnrollments: canonicalSchemaModules.customerJourneyEnrollments,
  customerJourneyEvents: canonicalSchemaModules.customerJourneyEvents,
  customerPlaybooks: canonicalSchemaModules.customerPlaybooks,
  customerPlaybookBindings: canonicalSchemaModules.customerPlaybookBindings,
  customerPlaybookRuns: canonicalSchemaModules.customerPlaybookRuns,
  clientExternalSubjects: canonicalSchemaModules.clientExternalSubjects,
  customerVerificationChallenges: canonicalSchemaModules.customerVerificationChallenges,
  customerProfileMerges: canonicalSchemaModules.customerProfileMerges,
  customerVisibilityPolicies: canonicalSchemaModules.customerVisibilityPolicies,
  scheduleSubjects: canonicalSchemaModules.scheduleSubjects,
  scheduleSubjectLinks: canonicalSchemaModules.scheduleSubjectLinks,
  projections: canonicalSchemaModules.projections,
  projectionDocuments: canonicalSchemaModules.projectionDocuments,
  debugSnapshots: canonicalSchemaModules.debugSnapshots,
  programs: canonicalSchemaModules.programs,
  programCohorts: canonicalSchemaModules.programCohorts,
  programCohortSessions: canonicalSchemaModules.programCohortSessions,
  cohortEnrollments: canonicalSchemaModules.cohortEnrollments,
  sessionAttendanceRecords: canonicalSchemaModules.sessionAttendanceRecords,
  certificationTemplates: canonicalSchemaModules.certificationTemplates,
  certificationAwards: canonicalSchemaModules.certificationAwards,
  workTemplates: canonicalSchemaModules.workTemplates,
  workRuns: canonicalSchemaModules.workRuns,
  workEntries: canonicalSchemaModules.workEntries,
  workArtifacts: canonicalSchemaModules.workArtifacts,
  workTimeSegments: canonicalSchemaModules.workTimeSegments,
  workTimeSegmentAllocations: canonicalSchemaModules.workTimeSegmentAllocations,
  leavePolicies: canonicalSchemaModules.leavePolicies,
  leaveBalances: canonicalSchemaModules.leaveBalances,
  leaveRequests: canonicalSchemaModules.leaveRequests,
  leaveEvents: canonicalSchemaModules.leaveEvents,
  staffingDemands: canonicalSchemaModules.staffingDemands,
  staffingDemandRequirements: canonicalSchemaModules.staffingDemandRequirements,
  staffingDemandSelectors: canonicalSchemaModules.staffingDemandSelectors,
  staffingResponses: canonicalSchemaModules.staffingResponses,
  staffingAssignments: canonicalSchemaModules.staffingAssignments,
  operationalDemands: canonicalSchemaModules.operationalDemands,
  operationalAssignments: canonicalSchemaModules.operationalAssignments,
  commitmentContracts: canonicalSchemaModules.commitmentContracts,
  commitmentObligations: canonicalSchemaModules.commitmentObligations,
  commitmentMilestones: canonicalSchemaModules.commitmentMilestones,
  commitmentMilestoneObligations: canonicalSchemaModules.commitmentMilestoneObligations,
  securedBalanceAccounts: canonicalSchemaModules.securedBalanceAccounts,
  securedBalanceLedgerEntries: canonicalSchemaModules.securedBalanceLedgerEntries,
  securedBalanceAllocations: canonicalSchemaModules.securedBalanceAllocations,
  commitmentClaims: canonicalSchemaModules.commitmentClaims,
  commitmentClaimEvents: canonicalSchemaModules.commitmentClaimEvents,
  fulfillmentUnits: canonicalSchemaModules.fulfillmentUnits,
  fulfillmentAssignments: canonicalSchemaModules.fulfillmentAssignments,
  resourceUsageCounters: supplySchema.resourceUsageCounters,
  resourceMaintenancePolicies: supplySchema.resourceMaintenancePolicies,
  resourceMaintenanceWorkOrders: supplySchema.resourceMaintenanceWorkOrders,
  resourceConditionReports: supplySchema.resourceConditionReports,
  compensationRoleTemplates: canonicalSchemaModules.compensationRoleTemplates,
  compensationPlans: canonicalSchemaModules.compensationPlans,
  compensationPlanVersions: canonicalSchemaModules.compensationPlanVersions,
  compensationPlanRules: canonicalSchemaModules.compensationPlanRules,
  compensationAssignmentRoles: canonicalSchemaModules.compensationAssignmentRoles,
  compensationLedgerEntries: canonicalSchemaModules.compensationLedgerEntries,
  compensationPayRuns: canonicalSchemaModules.compensationPayRuns,
  compensationPayRunItems: canonicalSchemaModules.compensationPayRunItems,
  compensationPayRunItemEntries: canonicalSchemaModules.compensationPayRunItemEntries,
  sellables: canonicalSchemaModules.sellables,
  sellableVariantDimensions: canonicalSchemaModules.sellableVariantDimensions,
  sellableVariantDimensionValues: canonicalSchemaModules.sellableVariantDimensionValues,
  sellableVariants: canonicalSchemaModules.sellableVariants,
  sellableVariantSelections: canonicalSchemaModules.sellableVariantSelections,
  sellableProducts: canonicalSchemaModules.sellableProducts,
  sellableServiceProducts: canonicalSchemaModules.sellableServiceProducts,
  sellableOfferVersions: canonicalSchemaModules.sellableOfferVersions,
  sellableResourceRates: canonicalSchemaModules.sellableResourceRates,
  discountCampaigns: canonicalSchemaModules.discountCampaigns,
  discountCodes: canonicalSchemaModules.discountCodes,
  discountRedemptions: canonicalSchemaModules.discountRedemptions,
  referralPrograms: canonicalSchemaModules.referralPrograms,
  referralEvents: canonicalSchemaModules.referralEvents,
  rewardGrants: canonicalSchemaModules.rewardGrants,
  referralLinks: canonicalSchemaModules.referralLinks,
  referralLinkClicks: canonicalSchemaModules.referralLinkClicks,
  referralAttributions: canonicalSchemaModules.referralAttributions,
  crmContacts: canonicalSchemaModules.crmContacts,
  crmLeads: canonicalSchemaModules.crmLeads,
  crmOpportunities: canonicalSchemaModules.crmOpportunities,
  crmPipelines: crmSchema.crmPipelines,
  crmPipelineStages: crmSchema.crmPipelineStages,
  accessArtifacts: canonicalSchemaModules.accessArtifacts,
  accessUsageWindows: canonicalSchemaModules.accessUsageWindows,
  accessLibraryItems: canonicalSchemaModules.accessLibraryItems,
  accessTransferPolicies: canonicalSchemaModules.accessTransferPolicies,
  accessTransfers: canonicalSchemaModules.accessTransfers,
  accessResaleListings: canonicalSchemaModules.accessResaleListings,
  accessSecuritySignals: canonicalSchemaModules.accessSecuritySignals,
  accessSecurityDecisions: canonicalSchemaModules.accessSecurityDecisions,
  accessArtifactLinks: canonicalSchemaModules.accessArtifactLinks,
  accessArtifactEvents: canonicalSchemaModules.accessArtifactEvents,
  accessActionTokens: canonicalSchemaModules.accessActionTokens,
  projectionCheckpoints: canonicalSchemaModules.projectionCheckpoints,
  policyBreachEvents: canonicalSchemaModules.policyBreachEvents,
  policyConsequenceEvents: canonicalSchemaModules.policyConsequenceEvents,
  sellablePricingModes: canonicalSchemaModules.sellablePricingModes,
  sellablePricingThresholds: canonicalSchemaModules.sellablePricingThresholds,
  sellablePricingOverrides: canonicalSchemaModules.sellablePricingOverrides,
  wishlists: canonicalSchemaModules.wishlists,
  wishlistItems: canonicalSchemaModules.wishlistItems,
  salesQuotes: canonicalSchemaModules.salesQuotes,
  salesQuoteVersions: canonicalSchemaModules.salesQuoteVersions,
  salesQuoteLines: canonicalSchemaModules.salesQuoteLines,
  salesQuoteAcceptances: canonicalSchemaModules.salesQuoteAcceptances,
  salesQuoteRequests: canonicalSchemaModules.salesQuoteRequests,
  salesQuoteGenerationRuns: canonicalSchemaModules.salesQuoteGenerationRuns,
  installmentPlans: canonicalSchemaModules.installmentPlans,
  installmentScheduleItems: canonicalSchemaModules.installmentScheduleItems,
  giftInstruments: giftsSchema.giftInstruments,
  billingAccountAutopayRules: receivablesSchema.billingAccountAutopayRules,
  autocollectionAttempts: receivablesSchema.autocollectionAttempts,
  giftDeliverySchedules: giftDeliverySchema.giftDeliverySchedules,
  giftDeliveryAttempts: giftDeliverySchema.giftDeliveryAttempts,
  marketingAudienceSegments: marketingPerformanceSchema.marketingAudienceSegments,
  marketingAudienceSegmentMemberships: marketingPerformanceSchema.marketingAudienceSegmentMemberships,
  marketingAudienceSyncRuns: marketingPerformanceSchema.marketingAudienceSyncRuns,
  adSpendDailyFacts: marketingPerformanceSchema.adSpendDailyFacts,
  offlineConversionPushes: marketingPerformanceSchema.offlineConversionPushes,
  productionBatches: supplyBatchesSchema.productionBatches,
  productionBatchReservations: supplyBatchesSchema.productionBatchReservations,
  seatMaps: canonicalSchemaModules.seatMaps,
  seatMapSeats: canonicalSchemaModules.seatMapSeats,
  seatHolds: canonicalSchemaModules.seatHolds,
  seatReservations: canonicalSchemaModules.seatReservations,
  queueCounters: canonicalSchemaModules.queueCounters,
  queueCounterAssignments: canonicalSchemaModules.queueCounterAssignments,
  queueTickets: canonicalSchemaModules.queueTickets,
  queueTicketCalls: canonicalSchemaModules.queueTicketCalls,
  products: productsSchema.products,
  productBundles: canonicalSchemaModules.productBundles,
  productBundleComponents: canonicalSchemaModules.productBundleComponents,
  bookingOrderLineSellables: canonicalSchemaModules.bookingOrderLineSellables,
  sessionInteractionEvents: canonicalSchemaModules.sessionInteractionEvents,
  sessionInteractionAggregates: canonicalSchemaModules.sessionInteractionAggregates,
  sessionInteractionArtifacts: canonicalSchemaModules.sessionInteractionArtifacts,
  requirementSets: canonicalSchemaModules.requirementSets,
  requirementNodes: canonicalSchemaModules.requirementNodes,
  requirementEdges: canonicalSchemaModules.requirementEdges,
  requirementEvaluations: canonicalSchemaModules.requirementEvaluations,
  requirementEvidenceLinks: canonicalSchemaModules.requirementEvidenceLinks,
  authzPermissionDefinitions: canonicalSchemaModules.authzPermissionDefinitions,
  authzRoleDefinitions: canonicalSchemaModules.authzRoleDefinitions,
  authzRolePermissions: canonicalSchemaModules.authzRolePermissions,
  authzMembershipRoleMappings: canonicalSchemaModules.authzMembershipRoleMappings,
  authzRoleAssignments: canonicalSchemaModules.authzRoleAssignments,
  slaPolicies: slaSchema.slaPolicies,
  slaBreachEvents: slaSchema.slaBreachEvents,
  slaCompensationEvents: slaSchema.slaCompensationEvents,
}

export default dbPackage
