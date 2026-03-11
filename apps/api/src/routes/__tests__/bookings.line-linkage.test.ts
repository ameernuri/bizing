import { describe, expect, it } from 'vitest'
import { groupFulfillmentUnitsByLine } from '../bookings-line-execution'

describe('groupFulfillmentUnitsByLine', () => {
  it('prefers direct bookingOrderLineId linkage over component fallback', () => {
    const lines = [
      { id: 'line_1', offerComponentId: 'cmp_haircut' },
      { id: 'line_2', offerComponentId: 'cmp_haircut' },
    ] as any

    const units = [
      { id: 'unit_direct', bookingOrderLineId: 'line_2', offerComponentId: 'cmp_haircut' },
      { id: 'unit_ambiguous', bookingOrderLineId: null, offerComponentId: 'cmp_haircut' },
    ] as any

    const result = groupFulfillmentUnitsByLine(lines, units)

    expect(result.directLinkedUnitCount).toBe(1)
    expect(result.fallbackComponentLinkedUnitCount).toBe(0)
    expect(result.ambiguousFallbackUnitCount).toBe(1)
    expect(result.unitsByLine.get('line_2')).toEqual([units[0]])
    expect(result.unitsByLine.get('line_1')).toBeUndefined()
  })

  it('uses component fallback when a component maps to exactly one line', () => {
    const lines = [
      { id: 'line_1', offerComponentId: 'cmp_haircut' },
      { id: 'line_2', offerComponentId: 'cmp_color' },
    ] as any

    const units = [
      { id: 'unit_fallback', bookingOrderLineId: null, offerComponentId: 'cmp_haircut' },
    ] as any

    const result = groupFulfillmentUnitsByLine(lines, units)

    expect(result.directLinkedUnitCount).toBe(0)
    expect(result.fallbackComponentLinkedUnitCount).toBe(1)
    expect(result.ambiguousFallbackUnitCount).toBe(0)
    expect(result.fallbackLinkedLineCount).toBe(1)
    expect(result.unitsByLine.get('line_1')).toEqual([units[0]])
  })

  it('keeps direct linkage even when offerComponentId differs', () => {
    const lines = [
      { id: 'line_1', offerComponentId: 'cmp_haircut' },
      { id: 'line_2', offerComponentId: 'cmp_color' },
    ] as any

    const units = [
      { id: 'unit_direct', bookingOrderLineId: 'line_1', offerComponentId: 'cmp_color' },
    ] as any

    const result = groupFulfillmentUnitsByLine(lines, units)

    expect(result.directLinkedUnitCount).toBe(1)
    expect(result.fallbackComponentLinkedUnitCount).toBe(0)
    expect(result.unitsByLine.get('line_1')).toEqual([units[0]])
  })
})
