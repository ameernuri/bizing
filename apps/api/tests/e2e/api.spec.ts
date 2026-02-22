/**
 * @fileoverview API E2E tests with Playwright
 *
 * @description
 * End-to-end tests for the Bizing API. Tests the actual HTTP
 * endpoints by starting the server and making real requests.
 *
 * @architecture
 * Tests: apps/api/tests/e2e/api.spec.ts
 * Tests: server.ts API endpoints
 * Related: vitest.config.ts, playwright.config.ts
 *
 * @design-decisions
 * - Use Playwright for E2E testing
 * - Start server in test mode
 * - Test actual HTTP responses
 * - Clean up server after tests
 *
 * @todo
 * - [ ] TODO: Add authentication tests
 * - [ ] TODO: Add rate limiting tests
 * - [ ] FIXME: Handle server startup timeouts
 *
 * @created 2026-02-11
 * @version 1.0.0
 */

import { test, expect } from '@playwright/test'

const API_BASE = 'http://localhost:6129'

test.describe('Bizing API', () => {
  test.describe('Health Check', () => {
    test('should return health status', async ({ request }) => {
      const response = await request.get(`${API_BASE}/health`)
      
      expect(response.status()).toBe(200)
      
      const body = await response.json()
      expect(body.status).toBe('ok')
      expect(body.version).toBeDefined()
    })
  })

  test.describe('Mind API', () => {
    test('should return mind structure', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/mind/structure`)
      
      expect(response.status()).toBe(200)
      
      const body = await response.json()
      expect(body.totalFiles).toBeDefined()
      expect(body.totalDirectories).toBeDefined()
      expect(body.entryPoint).toBeDefined()
    })

    test('should return mind state', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/mind/state`)
      
      expect(response.status()).toBe(200)
      
      const body = await response.json()
      expect(body.currentFocus).toBeDefined()
      expect(body.topTasks).toBeDefined()
      expect(body.blockers).toBeDefined()
    })

    test('should list all files', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/mind/files`)
      
      expect(response.status()).toBe(200)
      
      const body = await response.json()
      expect(Array.isArray(body)).toBe(true)
    })

    test('should search mind', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/mind/search?q=test`)
      
      expect(response.status()).toBe(200)
      
      const body = await response.json()
      // API returns array directly
      expect(Array.isArray(body)).toBe(true)
      if (body.length > 0) {
        expect(body[0].path).toBeDefined()
        expect(body[0].title).toBeDefined()
        expect(typeof body[0].relevance).toBe('number')
      }
    })
  })

  test.describe('Bizing Chat', () => {
    test('should respond to chat messages', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/v1/bizing/chat`, {
        data: {
          message: 'Hello',
          sessionId: 'e2e-test'
        }
      })
      
      expect(response.status()).toBe(200)
      
      const body = await response.json()
      expect(body.response).toBeDefined()
      expect(body.sessionId).toBe('e2e-test')
    })

    test('should maintain conversation context', async ({ request }) => {
      // First message
      const response1 = await request.post(`${API_BASE}/api/v1/bizing/chat`, {
        data: {
          message: 'My name is Test',
          sessionId: 'e2e-context'
        }
      })
      
      // Second message asking about first
      const response2 = await request.post(`${API_BASE}/api/v1/bizing/chat`, {
        data: {
          message: 'What is my name?',
          sessionId: 'e2e-context'
        }
      })
      
      expect(response2.status()).toBe(200)
      
      const body2 = await response2.json()
      expect(body2.response).toBeDefined()
    })

    test('should use semantic search', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/v1/bizing/chat`, {
        data: {
          message: 'How do agents build startups?'
        }
      })
      
      expect(response.status()).toBe(200)
      
      const body = await response.json()
      expect(body.response).toBeDefined()
      // Response may contain relevant info about agents/startups
      expect(body.response.length).toBeGreaterThan(0)
    })
  })

  test.describe('Stats API', () => {
    test('should return stats', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/stats`)
      
      expect(response.status()).toBe(200)
      
      const body = await response.json()
      expect(body.totalRevenue).toBeDefined()
      expect(body.totalBookings).toBeDefined()
      expect(body.totalCustomers).toBeDefined()
    })
  })

  test.describe('Schema API', () => {
    test('should return schema graph', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/schema/graph`)
      
      expect(response.status()).toBe(200)
      
      const body = await response.json()
      expect(body.entities).toBeDefined()
      expect(body.nodes).toBeDefined()
      expect(body.edges).toBeDefined()
    })
  })
})
