/**
 * @fileoverview Playwright configuration for E2E tests
 *
 * @description
 * Configures Playwright for Bizing API E2E testing.
 * Runs against localhost API server.
 *
 * @related
 * tests/e2e/api.spec.ts - Test files
 * vitest.config.ts - Unit test config
 *
 * @todo
 * - [ ] TODO: Add CI configuration
 * - [ ] IDEA: Add visual regression testing
 *
 * @created 2026-02-11
 * @version 1.0.0
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:6129',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'api',
      use: {
        ...devices['Desktop Chrome'],
        // API tests don't need a browser
        launchOptions: {
          args: ['--no-sandbox'],
        },
      },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:6129/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100,
    },
  },
})
