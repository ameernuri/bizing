/**
 * Test failure endpoint for saga validation.
 * These endpoints intentionally fail to test the saga runner's error detection.
 */

import { Hono } from 'hono'
import { fail } from './_api.js'

const testRoutes = new Hono()

// Intentionally returns 500 error
testRoutes.post('/trigger-500', async (c) => {
  return fail(c, 'INTENTIONAL_500', 'This endpoint intentionally returns 500 for testing', 500)
})

// Intentionally returns 400 validation error
testRoutes.post('/trigger-400', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  if (!body.requiredField) {
    return fail(c, 'VALIDATION_ERROR', 'Missing required field: requiredField', 400)
  }
  return fail(c, 'INTENTIONAL_400', 'This should have failed validation', 400)
})

// Intentionally returns 404
testRoutes.get('/trigger-404/:id', async (c) => {
  return fail(c, 'NOT_FOUND', 'Resource not found for testing', 404)
})

// Intentionally returns 401
testRoutes.get('/trigger-401', async (c) => {
  return fail(c, 'UNAUTHORIZED', 'Authentication required for testing', 401)
})

// Intentionally returns 403
testRoutes.get('/trigger-403', async (c) => {
  return fail(c, 'FORBIDDEN', 'Access denied for testing', 403)
})

// Intentionally returns 409
testRoutes.post('/trigger-409', async (c) => {
  return fail(c, 'DUPLICATE_SLUG', 'A biz with this slug already exists for testing', 409)
})

// Intentionally times out (simulated)
testRoutes.get('/trigger-timeout', async (c) => {
  // In real scenario this would hang, but for testing we return 504
  return fail(c, 'GATEWAY_TIMEOUT', 'Request timed out for testing', 504)
})

// Intentionally returns malformed JSON
testRoutes.get('/trigger-malformed', async (c) => {
  return c.text('this is not valid json {', 200)
})

export default testRoutes
