export type BookingLineLinkRef = {
  id: string
  offerComponentId?: string | null
}

export type FulfillmentUnitLinkRef = {
  bookingOrderLineId?: string | null
  offerComponentId?: string | null
}

/**
 * Links fulfillment units to booking lines with deterministic precedence:
 * 1) direct line FK (`bookingOrderLineId`)
 * 2) legacy fallback by `offerComponentId` only when exactly one line matches
 */
export function groupFulfillmentUnitsByLine<
  TLine extends BookingLineLinkRef,
  TUnit extends FulfillmentUnitLinkRef,
>(
  lines: TLine[],
  units: TUnit[],
) {
  const lineIds = new Set(lines.map((line) => line.id))
  const componentToLineIds = new Map<string, string[]>()
  for (const line of lines) {
    if (!line.offerComponentId) continue
    const bucket = componentToLineIds.get(line.offerComponentId) ?? []
    bucket.push(line.id)
    componentToLineIds.set(line.offerComponentId, bucket)
  }

  const unitsByLine = new Map<string, TUnit[]>()
  let directLinkedUnitCount = 0
  let fallbackComponentLinkedUnitCount = 0
  let ambiguousFallbackUnitCount = 0
  const fallbackLinkedLineIds = new Set<string>()

  for (const unit of units) {
    if (unit.bookingOrderLineId && lineIds.has(unit.bookingOrderLineId)) {
      const bucket = unitsByLine.get(unit.bookingOrderLineId) ?? []
      bucket.push(unit)
      unitsByLine.set(unit.bookingOrderLineId, bucket)
      directLinkedUnitCount += 1
      continue
    }

    if (!unit.offerComponentId) continue
    const candidateLineIds = componentToLineIds.get(unit.offerComponentId) ?? []
    if (candidateLineIds.length === 1) {
      const linkedLineId = candidateLineIds[0]
      const bucket = unitsByLine.get(linkedLineId) ?? []
      bucket.push(unit)
      unitsByLine.set(linkedLineId, bucket)
      fallbackLinkedLineIds.add(linkedLineId)
      fallbackComponentLinkedUnitCount += 1
      continue
    }

    if (candidateLineIds.length > 1) {
      ambiguousFallbackUnitCount += 1
    }
  }

  return {
    unitsByLine,
    directLinkedUnitCount,
    fallbackComponentLinkedUnitCount,
    ambiguousFallbackUnitCount,
    fallbackLinkedLineCount: fallbackLinkedLineIds.size,
  }
}
