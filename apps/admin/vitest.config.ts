/**
 * @fileoverview Vitest configuration for admin app
 *
 * @description
 * Configures Vitest for testing React components in the admin app.
 * Uses jsdom for browser environment simulation.
 *
 * @created 2026-02-11
 * @version 1.0.0
 */

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx,js,jsx}'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
    },
  },
})
