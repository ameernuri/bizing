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
import testRoutes from './test-failures.js'

export const coreApiRoutes = new Hono()

coreApiRoutes.route('/bizes', bizRoutes)
coreApiRoutes.route('/', locationRoutes)
coreApiRoutes.route('/', resourceRoutes)
coreApiRoutes.route('/', offerRoutes)
coreApiRoutes.route('/', bookingRoutes)
coreApiRoutes.route('/', queueRoutes)
coreApiRoutes.route('/', complianceRoutes)
coreApiRoutes.route('/', demandPricingRoutes)
coreApiRoutes.route('/', channelRoutes)
coreApiRoutes.route('/', dispatchRoutes)
coreApiRoutes.route('/', paymentRoutes)
coreApiRoutes.route('/', subjectSubscriptionRoutes)
coreApiRoutes.route('/', serviceRoutes)
coreApiRoutes.route('/', serviceProductRoutes)
coreApiRoutes.route('/', serviceProductRequirementRoutes)
coreApiRoutes.route('/', calendarRoutes)
coreApiRoutes.route('/', communicationRoutes)
coreApiRoutes.route('/', instrumentRoutes)
coreApiRoutes.route('/', customFieldRoutes)
coreApiRoutes.route('/', groupAccountRoutes)
coreApiRoutes.route('/', entitlementRoutes)
coreApiRoutes.route('/', policyRoutes)
coreApiRoutes.route('/', bookingParticipantRoutes)
coreApiRoutes.route('/', operationsRoutes)
coreApiRoutes.route('/', staffingRoutes)
coreApiRoutes.route('/', fulfillmentRoutes)
coreApiRoutes.route('/', compensationRoutes)
coreApiRoutes.route('/', accessRoutes)
coreApiRoutes.route('/', virtualMeetingRoutes)
coreApiRoutes.route('/', extensionRoutes)
coreApiRoutes.route('/', receivableRoutes)
coreApiRoutes.route('/', supplyRoutes)
coreApiRoutes.route('/', slaRoutes)
coreApiRoutes.route('/', taxFxRoutes)
coreApiRoutes.route('/', commitmentRoutes)
coreApiRoutes.route('/', actionRoutes)
coreApiRoutes.route('/', workflowRoutes)
coreApiRoutes.route('/', promotionRoutes)
coreApiRoutes.route('/', referralRoutes)
coreApiRoutes.route('/', lifecycleHookRoutes)
coreApiRoutes.route('/', crmRoutes)
coreApiRoutes.route('/', analyticsRoutes)
coreApiRoutes.route('/', educationRoutes)
coreApiRoutes.route('/', workManagementRoutes)
coreApiRoutes.route('/', leaveRoutes)
coreApiRoutes.route('/', hipaaRoutes)
coreApiRoutes.route('/', bizConfigRoutes)
coreApiRoutes.route('/', reportingRoutes)
coreApiRoutes.route('/', calendarSharingRoutes)
coreApiRoutes.route('/', governanceRoutes)
coreApiRoutes.route('/', sellablePricingRoutes)
coreApiRoutes.route('/', sellableRoutes)
coreApiRoutes.route('/', seatingRoutes)
coreApiRoutes.route('/', notificationEndpointRoutes)
coreApiRoutes.route('/', subjectEventRoutes)
coreApiRoutes.route('/', productRoutes)
coreApiRoutes.route('/', sellableVariantRoutes)
coreApiRoutes.route('/', checkoutRoutes)
coreApiRoutes.route('/', progressionRoutes)
coreApiRoutes.route('/', sessionInteractionRoutes)
coreApiRoutes.route('/', queueCounterRoutes)
coreApiRoutes.route('/', accessTransferRoutes)
coreApiRoutes.route('/', customerLibraryRoutes)
coreApiRoutes.route('/', accessSecurityRoutes)
coreApiRoutes.route('/', credentialExchangeRoutes)
coreApiRoutes.route('/', enterpriseRoutes)
coreApiRoutes.route('/', wishlistRoutes)
coreApiRoutes.route('/', salesQuoteRoutes)
coreApiRoutes.route('/', giftDeliveryRoutes)
coreApiRoutes.route('/', marketingPerformanceRoutes)
coreApiRoutes.route('/', sagaRoutes)
coreApiRoutes.route('/', authzRoutes)
coreApiRoutes.route('/', authMachineRoutes)
coreApiRoutes.route('/agents', codeModeRoutes)

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
