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
coreApiRoutes.route('/', sagaRoutes)
coreApiRoutes.route('/', authzRoutes)
coreApiRoutes.route('/', authMachineRoutes)
coreApiRoutes.route('/agents', codeModeRoutes)
coreApiRoutes.route('/test', testRoutes)

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
