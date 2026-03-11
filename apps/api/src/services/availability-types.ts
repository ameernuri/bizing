export type LayerType =
  | 'biz'
  | 'location'
  | 'offer'
  | 'offer_version'
  | 'service'
  | 'service_product'
  | 'provider_user'
  | 'resource'
  | 'custom_subject'

export type AvailabilityExplanation = {
  sourceType: 'resolver' | 'calendar' | 'dependency' | 'capacity_claim' | 'capacity_hold'
  source: string
  message: string
  metadata?: Record<string, unknown>
}

export type AvailabilityDecisionReason =
  | 'missing_context'
  | 'missing_calendar'
  | 'calendar_unavailable'
  | 'booking_conflict'
  | 'capacity_hold'

export type AvailabilityDecisionEntry = {
  layerType: LayerType
  reason: AvailabilityDecisionReason
  calendarId?: string
  detail?: string
  explanations?: AvailabilityExplanation[]
}

export type ResolvedBindingLayer = {
  layerType: LayerType
  bindingId: string
  calendarId: string
  priority: number
  isRequired: boolean
}

export type ResolverInput = {
  bizId: string
  offerId?: string | null
  offerVersionId?: string | null
  serviceId?: string | null
  serviceProductId?: string | null
  locationId?: string | null
  providerUserId?: string | null
  resourceId?: string | null
  customSubjectType?: string | null
  customSubjectId?: string | null
  ignoreBookingOrderId?: string | null
}

export type ResolveSlotInput = ResolverInput & {
  slotStartAt: Date
  slotEndAt: Date
}

export type ResolveSlotDecision = {
  bookable: boolean
  hardBlocks: AvailabilityDecisionEntry[]
  advisories: AvailabilityDecisionEntry[]
}

export type OfferAvailabilitySlotInput = ResolverInput & {
  fromAt: Date
  toAt: Date
  stepMinutes: number
  durationMinutes: number
  maxSlots?: number
}

export type OfferAvailabilitySlotResult = {
  slots: Array<{ startAt: string; endAt: string }>
  evaluatedBindings: ResolvedBindingLayer[]
  computedLeadTimeHours: number
  computedMaxAdvanceDays: number
  truncated: boolean
}

export type PreparedResolverContext = {
  relevantBindings: ResolvedBindingLayer[]
  calendarsById: Map<string, CalendarRuntimeContext>
}

export type CalendarBookabilityOutcome = {
  available: boolean
  source: string
  explanations: AvailabilityExplanation[]
}

export type CalendarRuleRow = unknown
export type CalendarDependencyRuleRow = unknown
export type CalendarDependencyTargetRow = unknown

export type CalendarDependencyTargetRuntime<TTarget = unknown> = TTarget & {
  resolvedCalendarIds: string[]
}

export type CalendarDependencyRuntime<TRule = unknown, TTarget = unknown> = {
  rule: TRule
  targets: CalendarDependencyTargetRuntime<TTarget>[]
}

export type CalendarRuntimeContext = {
  calendar: any
  rules: any[]
  exclusionByRuleId: Map<string, Set<string>>
  gates: any[]
  dependencyRules: CalendarDependencyRuntime[]
}
