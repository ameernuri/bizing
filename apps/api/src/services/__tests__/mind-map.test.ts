/**
 * @fileoverview Mind Map unit tests
 *
 * @description
 * Tests for mind-map.ts with actual exported functions.
 *
 * @architecture
 * Tests: src/services/__tests__/mind-map.test.ts
 * Tests: mind-map.ts
 *
 * @created 2026-02-11
 * @version 1.0.0
 */

import { describe, it, expect } from 'vitest'
import { getCachedMindMap, listAllFiles, searchMindDynamic } from '../mind-map'

describe('mind-map.ts', () => {
  describe('getCachedMindMap', () => {
    it('should return valid mind map structure', () => {
      const map = getCachedMindMap()
      
      expect(map.entryPoint).toBeDefined()
      expect(Array.isArray(map.directories)).toBe(true)
      expect(map.nodes).toBeDefined()
      expect(typeof map.nodes.size).toBe('number')
    })

    it('should have populated nodes', () => {
      const map = getCachedMindMap()
      
      expect(map.nodes.size).toBeGreaterThan(0)
    })

    it('should have valid directory structure', () => {
      const map = getCachedMindMap()
      
      // Directories is an array (may be empty or have different structure)
      expect(Array.isArray(map.directories)).toBe(true)
    })
  })

  describe('listAllFiles', () => {
    it('should return array of files', () => {
      const files = listAllFiles()
      
      expect(Array.isArray(files)).toBe(true)
    })

    it('should have files with required fields', () => {
      const files = listAllFiles()
      
      if (files.length > 0) {
        expect(files[0].path).toBeDefined()
        expect(files[0].title).toBeDefined()
        expect(typeof files[0].type).toBe('string')
      }
    })
  })

  describe('searchMindDynamic', () => {
    it('should return array of results', () => {
      const results = searchMindDynamic('test')
      
      expect(Array.isArray(results)).toBe(true)
    })

    it('should return empty array for no matches', () => {
      const results = searchMindDynamic('nonexistent-xyz-123')
      
      expect(results.length).toBe(0)
    })

    it('should find INDEX file', () => {
      const results = searchMindDynamic('INDEX')
      
      expect(results.length).toBeGreaterThan(0)
    })
  })
})
