/**
 * @fileoverview Vitest setup file for admin app tests
 *
 * @description
 * Configures the test environment before running tests.
 * Sets up global mocks and test utilities.
 *
 * @created 2026-02-11
 * @version 1.0.0
 */

import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  value: () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
  writable: true,
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

// Suppress console.error in tests (optional)
// vi.spyOn(console, 'error').mockImplementation(() => {})
