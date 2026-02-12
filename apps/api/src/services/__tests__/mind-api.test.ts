/**
 * @fileoverview Mind API unit tests
 *
 * @description
 * Tests for mind-api.ts against real mind files.
 *
 * @architecture
 * Tests: src/services/__tests__/mind-api.test.ts
 * Tests: mind-api.ts, mind-map.ts
 *
 * @created 2026-02-11
 * @version 1.0.0
 */

import { describe, it, expect } from 'vitest'
import { getCompactMindState, getMindFile } from '../mind-api'

describe('mind-api.ts', () => {
  describe('getCompactMindState', () => {
    it('should return valid mind state structure', () => {
      const state = getCompactMindState()
      
      expect(state).toBeDefined()
      expect(typeof state.currentFocus).toBe('string')
      expect(Array.isArray(state.topTasks)).toBe(true)
      expect(Array.isArray(state.blockers)).toBe(true)
      expect(Array.isArray(state.recentLearnings)).toBe(true)
    })

    it('should have non-empty current focus', () => {
      const state = getCompactMindState()
      
      expect(state.currentFocus.length).toBeGreaterThan(0)
    })
  })

  describe('getMindFile', () => {
    it('should return result object', () => {
      const result = getMindFile('INDEX.md')
      
      expect(result).toBeDefined()
      expect(typeof result.exists).toBe('boolean')
    })

    it('should return exists=false for non-existent file', () => {
      const result = getMindFile('nonexistent-file-xyz.md')
      
      expect(result.exists).toBe(false)
      expect(result.content).toBeNull()
    })

    it('should find existing files', () => {
      const result = getMindFile('INDEX.md')
      
      expect(result.exists).toBe(true)
      expect(result.content).toBeDefined()
    })
  })
})
