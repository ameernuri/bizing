/**
 * Canonical API router.
 *
 * This is the only mounted business API surface. Route modules are split by
 * domain but share the same auth/ACL model.
 */

import { Hono } from 'hono'
import { bizRoutes } from './bizes.js'
import { locationRoutes } from './locations.js'
import { resourceRoutes } from './resources.js'
import { offerRoutes } from './offers.js'
import { bookingRoutes } from './bookings.js'
import { queueRoutes } from './queues.js'
import { complianceRoutes } from './compliance.js'
import { demandPricingRoutes } from './demand-pricing.js'
import { channelRoutes } from './channels.js'
import { dispatchRoutes } from './dispatch.js'
import { paymentRoutes } from './payments.js'
import { subjectSubscriptionRoutes } from './subject-subscriptions.js'
import { codeModeRoutes } from './mcp.js'
import { sagaRoutes } from './sagas.js'
import { authzRoutes } from './authz.js'
import { authMachineRoutes } from './auth-machine.js'
import { serviceRoutes } from './services.js'
import { offerComponentRoutes } from './offer-components.js'
import { serviceProductRoutes } from './service-products.js'
import { serviceProductRequirementRoutes } from './service-product-requirements.js'
import { calendarRoutes } from './calendars.js'
import { communicationRoutes } from './communications.js'
import { instrumentRoutes } from './instruments.js'
import { customFieldRoutes } from './custom-fields.js'
import { groupAccountRoutes } from './group-accounts.js'
import { entitlementRoutes } from './entitlements.js'
import { policyRoutes } from './policies.js'
import { bookingParticipantRoutes } from './booking-participants.js'
import { operationsRoutes } from './operations.js'
import { staffingRoutes } from './staffing.js'
import { coverageLaneRoutes } from './coverage-lanes.js'
import { fulfillmentRoutes } from './fulfillment.js'
import { compensationRoutes } from './compensation.js'
import { accessRoutes } from './access.js'
import { virtualMeetingRoutes } from './virtual-meetings.js'
import { extensionRoutes } from './extensions.js'
import { receivableRoutes } from './receivables.js'
import { supplyRoutes } from './supply.js'
import { slaRoutes } from './sla.js'
import { taxFxRoutes } from './tax-fx.js'
import { commitmentRoutes } from './commitments.js'
import { actionRoutes } from './actions.js'
import { workflowRoutes } from './workflows.js'
import { promotionRoutes } from './promotions.js'
import { referralRoutes } from './referrals.js'
import { lifecycleHookRoutes } from './lifecycle-hooks.js'
import { crmRoutes } from './crm.js'
import { analyticsRoutes } from './analytics.js'
import { educationRoutes } from './education.js'
import { workManagementRoutes } from './work-management.js'
import { leaveRoutes } from './leave.js'
import { hipaaRoutes } from './hipaa.js'
import { bizConfigRoutes } from './biz-configs.js'
import { reportingRoutes } from './reporting.js'
import { calendarSharingRoutes } from './calendar-sharing.js'
import { governanceRoutes } from './governance.js'
import { sellablePricingRoutes } from './sellable-pricing.js'
import { sellableRoutes } from './sellables.js'
import { seatingRoutes } from './seating.js'
import { notificationEndpointRoutes } from './notification-endpoints.js'
import { subjectEventRoutes } from './subject-events.js'
import { productRoutes } from './products.js'
import { sellableVariantRoutes } from './sellable-variants.js'
import { checkoutRoutes } from './checkout.js'
import { progressionRoutes } from './progression.js'
import { sessionInteractionRoutes } from './session-interactions.js'
import { queueCounterRoutes } from './queue-counters.js'
import { accessTransferRoutes } from './access-transfers.js'
import { customerLibraryRoutes } from './customer-library.js'
import { accessSecurityRoutes } from './access-security.js'
import { credentialExchangeRoutes } from './credential-exchange.js'
import { enterpriseRoutes } from './enterprise.js'
import { wishlistRoutes } from './wishlists.js'
import { salesQuoteRoutes } from './sales-quotes.js'
import { giftDeliveryRoutes } from './gift-delivery.js'
import { marketingPerformanceRoutes } from './marketing-performance.js'
import { customerOpsRoutes } from './customer-ops.js'
import { oodaRoutes } from './ooda.js'
import { knowledgeRoutes } from './knowledge.js'
import { inventoryRoutes } from './inventory.js'
import { valueProgramRoutes } from './value-programs.js'
import { workforceRoutes } from './workforce.js'
import { growthRoutes } from './growth.js'
import { workItemRoutes } from './work-items.js'
import { commandRoutes } from './commands.js'
import { aiActionRoutes } from './ai-actions.js'
import { domainManifestEntries } from './domain-manifest.js'
import testRoutes from './test-failures.js'

export const coreApiRoutes = new Hono()

const coreRouteRegistry: Record<string, Hono> = {
  bizes: bizRoutes,
  locations: locationRoutes,
  resources: resourceRoutes,
  offers: offerRoutes,
  bookings: bookingRoutes,
  queues: queueRoutes,
  compliance: complianceRoutes,
  'demand-pricing': demandPricingRoutes,
  channels: channelRoutes,
  dispatch: dispatchRoutes,
  payments: paymentRoutes,
  'subject-subscriptions': subjectSubscriptionRoutes,
  services: serviceRoutes,
  calendars: calendarRoutes,
  communications: communicationRoutes,
  instruments: instrumentRoutes,
  'custom-fields': customFieldRoutes,
  'group-accounts': groupAccountRoutes,
  entitlements: entitlementRoutes,
  policies: policyRoutes,
  'booking-participants': bookingParticipantRoutes,
  operations: operationsRoutes,
  staffing: staffingRoutes,
  'coverage-lanes': coverageLaneRoutes,
  fulfillment: fulfillmentRoutes,
  compensation: compensationRoutes,
  access: accessRoutes,
  'virtual-meetings': virtualMeetingRoutes,
  extensions: extensionRoutes,
  receivables: receivableRoutes,
  supply: supplyRoutes,
  sla: slaRoutes,
  'tax-fx': taxFxRoutes,
  commitments: commitmentRoutes,
  actions: actionRoutes,
  workflows: workflowRoutes,
  promotions: promotionRoutes,
  referrals: referralRoutes,
  'lifecycle-hooks': lifecycleHookRoutes,
  crm: crmRoutes,
  analytics: analyticsRoutes,
  education: educationRoutes,
  'work-management': workManagementRoutes,
  leave: leaveRoutes,
  hipaa: hipaaRoutes,
  'biz-configs': bizConfigRoutes,
  reporting: reportingRoutes,
  'calendar-sharing': calendarSharingRoutes,
  governance: governanceRoutes,
  'sellable-pricing': sellablePricingRoutes,
  sellables: sellableRoutes,
  seating: seatingRoutes,
  'notification-endpoints': notificationEndpointRoutes,
  'subject-events': subjectEventRoutes,
  products: productRoutes,
  'sellable-variants': sellableVariantRoutes,
  checkout: checkoutRoutes,
  progression: progressionRoutes,
  'session-interactions': sessionInteractionRoutes,
  'queue-counters': queueCounterRoutes,
  'access-transfers': accessTransferRoutes,
  'customer-library': customerLibraryRoutes,
  'access-security': accessSecurityRoutes,
  'credential-exchange': credentialExchangeRoutes,
  enterprise: enterpriseRoutes,
  wishlists: wishlistRoutes,
  'sales-quotes': salesQuoteRoutes,
  'gift-delivery': giftDeliveryRoutes,
  'marketing-performance': marketingPerformanceRoutes,
  'customer-ops': customerOpsRoutes,
  ooda: oodaRoutes,
  knowledge: knowledgeRoutes,
  inventory: inventoryRoutes,
  'value-programs': valueProgramRoutes,
  workforce: workforceRoutes,
  growth: growthRoutes,
  'work-items': workItemRoutes,
  commands: commandRoutes,
  'ai-actions': aiActionRoutes,
  sagas: sagaRoutes,
  authz: authzRoutes,
  'auth-machine': authMachineRoutes,
  mcp: codeModeRoutes,
}

for (const entry of domainManifestEntries) {
  const router = coreRouteRegistry[entry.key]
  if (!router) {
    throw new Error(`core-api route registry is missing router for manifest key: ${entry.key}`)
  }
  coreApiRoutes.route(entry.mountPath, router)
}

/**
 * Hidden legacy mounts kept only so internal saga/runtime coverage can finish
 * migrating away from service/service-product endpoints during the catalog cut.
 * They are intentionally omitted from the public domain manifest.
 */
coreApiRoutes.route('/', serviceProductRoutes)
coreApiRoutes.route('/', serviceProductRequirementRoutes)
coreApiRoutes.route('/', offerComponentRoutes)

/**
 * Test-failure routes are explicitly opt-in for local runner diagnostics.
 *
 * Security posture:
 * - disabled by default to avoid exposing intentionally-broken handlers
 *   in normal environments.
 */
if (process.env.ENABLE_TEST_FAILURE_ROUTES === 'true') {
  coreApiRoutes.route('/test', testRoutes)
}

coreApiRoutes.get('/health', (c) => {
  return c.json({
    success: true,
    data: {
      service: 'bizing-core-api',
      status: 'healthy',
      version: '0.2.0',
    },
    meta: {
      requestId: c.get('requestId') ?? crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  })
})
