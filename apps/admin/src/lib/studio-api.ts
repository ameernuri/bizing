import { EnvelopedApiError, requestEnvelopedApiResponse } from '@/lib/enveloped-api'

export type StudioApiTrace = {
  at: string
  method: string
  path: string
  durationMs: number
  status: number
  ok: boolean
  requestBody?: unknown
  responseBody?: unknown
  errorMessage?: string
}

let traceListener: ((trace: StudioApiTrace) => void) | null = null

export function setStudioApiTraceListener(listener: ((trace: StudioApiTrace) => void) | null) {
  traceListener = listener
}

export type StudioActorUser = {
  id: string
  email: string
  name: string
  role: string
  status?: string
  phone?: string | null
  createdAt?: string
}

export type StudioActorToken = {
  tokenType: 'Bearer'
  accessToken: string
  expiresAt: string
  expiresInSeconds: number
  scopes: string[]
  actor: StudioActorUser
  credential: {
    id: string
    bizId?: string | null
    label?: string
    keyPreview?: string
  }
}

export type PersonaInboxSummary = {
  personaKey: string
  displayName: string
  messageCount: number
  deliveredCount: number
  failedCount: number
  lastSentAt: string | null
  channels: string[]
}

export type PersonaInboxMessageEvent = {
  id: string
  eventType: string
  occurredAt: string
  payload: Record<string, unknown>
  metadata: Record<string, unknown>
}

export type PersonaInboxMessage = {
  id: string
  channel: 'email' | 'sms' | 'push' | 'whatsapp' | 'postal' | 'voice' | 'webhook'
  purpose: 'transactional' | 'marketing' | 'operational' | 'legal'
  status:
    | 'queued'
    | 'processing'
    | 'sent'
    | 'delivered'
    | 'failed'
    | 'bounced'
    | 'opened'
    | 'clicked'
    | 'replied'
    | 'cancelled'
    | 'suppressed'
  recipientRef: string
  providerKey?: string | null
  providerMessageRef?: string | null
  payload: Record<string, unknown>
  metadata: Record<string, unknown>
  scheduledFor: string
  sentAt?: string | null
  deliveredAt?: string | null
  failedAt?: string | null
  events: PersonaInboxMessageEvent[]
}

export type OwnerWelcomeEmailDispatch = {
  alreadySent: boolean
  message: Record<string, unknown>
  events: Record<string, unknown>[]
}

export type StudioRequestOptions = {
  actorToken?: string | null
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
}

async function request<T>(path: string, options?: StudioRequestOptions): Promise<T> {
  const method = options?.method ?? 'GET'
  const startedAt = Date.now()
  const requestBody = options?.body
  try {
    const result = await requestEnvelopedApiResponse<T>(path, {
      method,
      headers: {
        accept: 'application/json',
        ...(options?.body ? { 'content-type': 'application/json' } : {}),
        ...(options?.actorToken ? { authorization: `Bearer ${options.actorToken}` } : {}),
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    })
    const durationMs = Date.now() - startedAt
    traceListener?.({
      at: new Date().toISOString(),
      method,
      path,
      durationMs,
      status: result.status,
      ok: true,
      requestBody,
      responseBody: result.payload,
    })
    return result.data
  } catch (error) {
    const durationMs = Date.now() - startedAt
    const status = error instanceof EnvelopedApiError ? error.status : 500
    const payload = error instanceof EnvelopedApiError ? error.payload : null
    const message = error instanceof Error ? error.message : 'Request failed'
    traceListener?.({
      at: new Date().toISOString(),
      method,
      path,
      durationMs,
      status,
      ok: false,
      requestBody,
      responseBody: payload,
      errorMessage: message,
    })
    if (error instanceof Error) throw error
    throw new Error(message)
  }
}

export const studioApi = {
  listOodaLoops: (params?: { status?: 'draft' | 'active' | 'paused' | 'completed' | 'archived'; query?: string; limit?: number }) => {
    const search = new URLSearchParams()
    if (params?.status) search.set('status', params.status)
    if (params?.query) search.set('query', params.query)
    if (params?.limit) search.set('limit', String(params.limit))
    return request<unknown[]>(`/api/v1/ooda/loops${search.size ? `?${search.toString()}` : ''}`)
  },
  createOodaLoop: (input: {
    loopKey?: string
    title: string
    objective?: string
    status?: 'draft' | 'active' | 'paused' | 'completed' | 'archived'
    priority?: number
    metadata?: Record<string, unknown>
  }) => request<unknown>('/api/v1/ooda/loops', { method: 'POST', body: input }),

  listImpersonationUsers: (search?: string) =>
    request<StudioActorUser[]>(
      `/api/v1/auth/impersonation/users${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    ),

  createImpersonationUser: (input: {
    email: string
    name: string
    role?: 'owner' | 'admin' | 'manager' | 'staff' | 'host' | 'customer'
    phone?: string
    autoMembershipBizId?: string
    autoMembershipRole?: 'owner' | 'admin' | 'manager' | 'staff' | 'host' | 'customer'
  }) =>
    request<{ user: StudioActorUser; membership?: unknown; reusedExistingUser?: boolean }>(
      '/api/v1/auth/impersonation/users',
      { method: 'POST', body: input },
    ),

  issueImpersonationToken: (input: {
    targetUserId?: string
    targetEmail?: string
    targetName?: string
    targetRole?: 'owner' | 'admin' | 'manager' | 'staff' | 'host' | 'customer'
    autoCreateUser?: boolean
    bizId?: string
    ensureMembership?: boolean
    membershipRole?: 'owner' | 'admin' | 'manager' | 'staff' | 'host' | 'customer'
    scopes?: string[]
    ttlSeconds?: number
    label?: string
  }) => request<StudioActorToken>('/api/v1/auth/impersonation/tokens', { method: 'POST', body: input }),

  listBizes: (actorToken?: string | null) => request<unknown[]>('/api/v1/bizes?perPage=200', { actorToken }),
  createBiz: (
    body: {
      name: string
      slug: string
      type?: 'individual' | 'small_business' | 'enterprise'
      timezone?: string
      currency?: string
      visibility?: 'published' | 'unpublished' | 'private'
    },
    actorToken?: string | null,
  ) => request<Record<string, unknown>>('/api/v1/bizes', { method: 'POST', body, actorToken }),
  listPublicBizes: (params?: { limit?: number; search?: string }) => {
    const search = new URLSearchParams()
    if (params?.limit) search.set('limit', String(params.limit))
    if (params?.search) search.set('search', params.search)
    return request<unknown[]>(`/api/v1/bizes/public${search.size ? `?${search.toString()}` : ''}`)
  },
  patchBiz: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}`, { method: 'PATCH', body, actorToken }),
  sendOwnerWelcomeEmail: (bizId: string, actorToken?: string | null) =>
    request<OwnerWelcomeEmailDispatch>(`/api/v1/bizes/${bizId}/onboarding/welcome-email`, {
      method: 'POST',
      actorToken,
    }),
  listBizMembers: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/members`, { actorToken }),
  createBizMember: (
    bizId: string,
    body: {
      userId?: string
      email?: string
      role?: 'owner' | 'admin' | 'manager' | 'staff' | 'host' | 'customer'
    },
    actorToken?: string | null,
  ) => request<unknown>(`/api/v1/bizes/${bizId}/members`, { method: 'POST', body, actorToken }),

  listLocations: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/locations?perPage=200`, { actorToken }),
  listPublicLocations: (bizId: string) =>
    request<unknown[]>(`/api/v1/public/bizes/${bizId}/locations`),
  createLocation: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/locations`, { method: 'POST', body, actorToken }),

  listResources: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/resources?perPage=200`, { actorToken }),
  createResource: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/resources`, { method: 'POST', body, actorToken }),
  listCoverageLanes: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/coverage-lanes`, { actorToken }),
  createCoverageLane: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/coverage-lanes`, { method: 'POST', body, actorToken }),
  patchCoverageLane: (bizId: string, laneId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/coverage-lanes/${laneId}`, { method: 'PATCH', body, actorToken }),
  listCoverageLaneAlerts: (
    bizId: string,
    params?: { laneId?: string; status?: 'active' | 'acknowledged' | 'resolved' },
    actorToken?: string | null,
  ) => {
    const search = new URLSearchParams()
    if (params?.laneId) search.set('laneId', params.laneId)
    if (params?.status) search.set('status', params.status)
    return request<unknown[]>(`/api/v1/bizes/${bizId}/coverage-lane-alerts${search.size ? `?${search.toString()}` : ''}`, {
      actorToken,
    })
  },
  evaluateCoverageLaneAlerts: (bizId: string, params?: { locationId?: string }, actorToken?: string | null) => {
    const search = new URLSearchParams()
    if (params?.locationId) search.set('locationId', params.locationId)
    return request<unknown>(`/api/v1/bizes/${bizId}/coverage-lanes/evaluate-alerts${search.size ? `?${search.toString()}` : ''}`, {
      method: 'POST',
      body: {},
      actorToken,
    })
  },
  listCoverageLaneMemberships: (bizId: string, laneId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/coverage-lanes/${laneId}/memberships`, { actorToken }),
  createCoverageLaneMembership: (
    bizId: string,
    laneId: string,
    body: Record<string, unknown>,
    actorToken?: string | null,
  ) => request<unknown>(`/api/v1/bizes/${bizId}/coverage-lanes/${laneId}/memberships`, { method: 'POST', body, actorToken }),
  patchCoverageLaneMembership: (
    bizId: string,
    membershipId: string,
    body: Record<string, unknown>,
    actorToken?: string | null,
  ) => request<unknown>(`/api/v1/bizes/${bizId}/coverage-lane-memberships/${membershipId}`, { method: 'PATCH', body, actorToken }),
  createCoverageLaneOnCallShift: (
    bizId: string,
    laneId: string,
    body: Record<string, unknown>,
    actorToken?: string | null,
  ) => request<unknown>(`/api/v1/bizes/${bizId}/coverage-lanes/${laneId}/on-call-shifts`, { method: 'POST', body, actorToken }),
  listCoverageLaneShiftTemplates: (bizId: string, laneId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/coverage-lanes/${laneId}/shift-templates`, { actorToken }),
  createCoverageLaneShiftTemplate: (
    bizId: string,
    laneId: string,
    body: Record<string, unknown>,
    actorToken?: string | null,
  ) => request<unknown>(`/api/v1/bizes/${bizId}/coverage-lanes/${laneId}/shift-templates`, { method: 'POST', body, actorToken }),
  patchCoverageLaneShiftTemplate: (
    bizId: string,
    templateId: string,
    body: Record<string, unknown>,
    actorToken?: string | null,
  ) => request<unknown>(`/api/v1/bizes/${bizId}/coverage-shift-templates/${templateId}`, { method: 'PATCH', body, actorToken }),
  publishCoverageLaneShiftTemplate: (
    bizId: string,
    templateId: string,
    body?: { through?: string },
    actorToken?: string | null,
  ) => request<unknown>(`/api/v1/bizes/${bizId}/coverage-shift-templates/${templateId}/publish`, { method: 'POST', body: body ?? {}, actorToken }),
  listCoverageLaneCoverage: (
    bizId: string,
    laneId: string,
    params?: { from?: string; to?: string },
    actorToken?: string | null,
  ) => {
    const search = new URLSearchParams()
    if (params?.from) search.set('from', params.from)
    if (params?.to) search.set('to', params.to)
    return request<unknown>(
      `/api/v1/bizes/${bizId}/coverage-lanes/${laneId}/coverage${search.size ? `?${search.toString()}` : ''}`,
      { actorToken },
    )
  },

  listCalendars: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/calendars?perPage=200`, { actorToken }),
  createCalendar: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/calendars`, { method: 'POST', body, actorToken }),
  listCalendarBindings: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/calendar-bindings?perPage=200`, { actorToken }),
  createCalendarBinding: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/calendar-bindings`, { method: 'POST', body, actorToken }),
  fetchCalendarTimeline: (
    bizId: string,
    calendarId: string,
    params: { startAt?: string; endAt?: string },
    actorToken?: string | null,
  ) => {
    const search = new URLSearchParams()
    if (params.startAt) search.set('startAt', params.startAt)
    if (params.endAt) search.set('endAt', params.endAt)
    search.set('includeRules', 'true')
    search.set('includeBookings', 'true')
    search.set('includeHolds', 'true')
    return request<unknown>(
      `/api/v1/bizes/${bizId}/calendars/${calendarId}/timeline?${search.toString()}`,
      { actorToken },
    )
  },
  listAvailabilityRules: (bizId: string, calendarId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/calendars/${calendarId}/availability-rules?perPage=200`, { actorToken }),
  createAvailabilityRule: (
    bizId: string,
    calendarId: string,
    body: Record<string, unknown>,
    actorToken?: string | null,
  ) =>
    request<unknown>(`/api/v1/bizes/${bizId}/calendars/${calendarId}/availability-rules`, {
      method: 'POST',
      body,
      actorToken,
    }),
  patchAvailabilityRule: (
    bizId: string,
    calendarId: string,
    ruleId: string,
    body: Record<string, unknown>,
    actorToken?: string | null,
  ) =>
    request<unknown>(`/api/v1/bizes/${bizId}/calendars/${calendarId}/availability-rules/${ruleId}`, {
      method: 'PATCH',
      body,
      actorToken,
    }),
  deactivateAvailabilityRule: (bizId: string, calendarId: string, ruleId: string, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/calendars/${calendarId}/availability-rules/${ruleId}`, {
      method: 'DELETE',
      actorToken,
    }),
  listCalendarCapacityHolds: (bizId: string, calendarId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/calendars/${calendarId}/capacity-holds`, { actorToken }),

  listServiceGroups: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/service-groups?perPage=200`, { actorToken }),
  createServiceGroup: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/service-groups`, { method: 'POST', body, actorToken }),
  listServices: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/service-groups?perPage=200`, { actorToken }),
  createService: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/service-groups`, {
      method: 'POST',
      body: {
        name: String(body.name ?? 'Catalog'),
        slug: String(body.slug ?? 'catalog'),
        description: body.description,
        status: body.status,
        statusConfigValueId: body.statusConfigValueId,
        metadata: body.metadata,
      },
      actorToken,
    }),

  listOffers: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/offers?perPage=200`, { actorToken }),
  createOffer: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/offers`, { method: 'POST', body, actorToken }),
  listOfferVersions: (bizId: string, offerId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/offers/${offerId}/versions`, { actorToken }),
  createOfferVersion: (bizId: string, offerId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/offers/${offerId}/versions`, {
      method: 'POST',
      body,
      actorToken,
    }),
  patchOffer: (bizId: string, offerId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/offers/${offerId}`, { method: 'PATCH', body, actorToken }),
  patchOfferVersion: (
    bizId: string,
    offerId: string,
    offerVersionId: string,
    body: Record<string, unknown>,
    actorToken?: string | null,
  ) =>
    request<unknown>(`/api/v1/bizes/${bizId}/offers/${offerId}/versions/${offerVersionId}`, {
      method: 'PATCH',
      body,
      actorToken,
    }),
  listPublicOffers: (bizId: string) => request<unknown[]>(`/api/v1/public/bizes/${bizId}/offers`),
  getPublicOfferAvailability: (
    bizId: string,
    offerId: string,
    limit = 20,
    options?: { offerVersionId?: string; viewerTier?: string; locationId?: string },
  ) => {
    const search = new URLSearchParams()
    search.set('limit', String(limit))
    if (options?.offerVersionId) search.set('offerVersionId', options.offerVersionId)
    if (options?.viewerTier) search.set('viewerTier', options.viewerTier)
    if (options?.locationId) search.set('locationId', options.locationId)
    return request<unknown>(`/api/v1/public/bizes/${bizId}/offers/${offerId}/availability?${search.toString()}`)
  },
  getPublicOfferWalkUp: (bizId: string, offerId: string, options?: { offerVersionId?: string; locationId?: string }) => {
    const search = new URLSearchParams()
    if (options?.offerVersionId) search.set('offerVersionId', options.offerVersionId)
    if (options?.locationId) search.set('locationId', options.locationId)
    return request<unknown>(
      `/api/v1/public/bizes/${bizId}/offers/${offerId}/walk-up${search.size ? `?${search.toString()}` : ''}`,
    )
  },

  listProducts: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/products`, { actorToken }),
  createProduct: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/products`, { method: 'POST', body, actorToken }),

  listServiceProducts: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/service-products?perPage=200`, { actorToken }),
  createServiceProduct: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/service-products`, { method: 'POST', body, actorToken }),

  listPublicBookings: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/public/bizes/${bizId}/booking-orders?perPage=100`, { actorToken }),
  createPublicBooking: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/public/bizes/${bizId}/booking-orders`, { method: 'POST', body, actorToken }),
  payPublicBookingAdvanced: (
    bizId: string,
    bookingOrderId: string,
    body: Record<string, unknown>,
    actorToken?: string | null,
  ) =>
    request<unknown>(
      `/api/v1/public/bizes/${bizId}/booking-orders/${bookingOrderId}/payments/advanced`,
      { method: 'POST', body, actorToken },
    ),
  createPublicStripePaymentIntent: (
    bizId: string,
    bookingOrderId: string,
    body: Record<string, unknown>,
    actorToken?: string | null,
  ) =>
    request<unknown>(
      `/api/v1/public/bizes/${bizId}/booking-orders/${bookingOrderId}/payments/stripe/payment-intents`,
      { method: 'POST', body, actorToken },
    ),

  listPaymentIntents: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/payment-intents?perPage=100`, { actorToken }),
  getPaymentIntentDetail: (bizId: string, paymentIntentId: string, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/payment-intents/${paymentIntentId}`, { actorToken }),

  listBookingOrders: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/booking-orders?perPage=200`, { actorToken }),
  createBookingOrder: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/booking-orders`, { method: 'POST', body, actorToken }),
  patchBookingOrderStatus: (
    bizId: string,
    bookingOrderId: string,
    body: { status: string },
    actorToken?: string | null,
  ) =>
    request<unknown>(`/api/v1/bizes/${bizId}/booking-orders/${bookingOrderId}/status`, {
      method: 'PATCH',
      body,
      actorToken,
    }),

  listOutboundMessages: (bizId: string, query?: { recipientUserId?: string; bookingOrderId?: string }, actorToken?: string | null) => {
    const search = new URLSearchParams()
    search.set('perPage', '100')
    if (query?.recipientUserId) search.set('recipientUserId', query.recipientUserId)
    if (query?.bookingOrderId) search.set('bookingOrderId', query.bookingOrderId)
    return request<unknown[]>(`/api/v1/bizes/${bizId}/outbound-messages?${search.toString()}`, {
      actorToken,
    })
  },
  createOutboundMessage: (
    bizId: string,
    body: {
      channel: 'sms' | 'email' | 'push' | 'whatsapp' | 'postal' | 'voice' | 'webhook'
      purpose: 'transactional' | 'marketing' | 'operational' | 'legal'
      recipientRef: string
      recipientUserId?: string
      recipientGroupAccountId?: string
      status?: 'queued' | 'processing' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'opened' | 'clicked' | 'replied' | 'cancelled' | 'suppressed'
      providerKey?: string
      payload?: Record<string, unknown>
      metadata?: Record<string, unknown>
    },
    actorToken?: string | null,
  ) =>
    request<unknown>(`/api/v1/bizes/${bizId}/outbound-messages`, {
      method: 'POST',
      body,
      actorToken,
    }),

  listPersonaInboxes: (bizId: string, query?: { search?: string; limit?: number }) => {
    const search = new URLSearchParams()
    if (query?.search) search.set('search', query.search)
    if (query?.limit) search.set('limit', String(query.limit))
    return request<PersonaInboxSummary[]>(
      `/api/v1/internal/bizes/${bizId}/persona-inboxes${search.size ? `?${search.toString()}` : ''}`,
    )
  },
  listPersonaInboxMessages: (
    bizId: string,
    personaKey: string,
    query?: { channel?: 'email' | 'sms' | 'push'; status?: 'queued' | 'sent' | 'delivered' | 'failed'; limit?: number },
  ) => {
    const search = new URLSearchParams()
    if (query?.channel) search.set('channel', query.channel)
    if (query?.status) search.set('status', query.status)
    if (query?.limit) search.set('limit', String(query.limit))
    return request<PersonaInboxMessage[]>(
      `/api/v1/internal/bizes/${bizId}/persona-inboxes/${encodeURIComponent(personaKey)}/messages${search.size ? `?${search.toString()}` : ''}`,
    )
  },
  sendPersonaInboxSimulation: (
    bizId: string,
    personaKey: string,
    body: {
      channel: 'email' | 'sms' | 'push'
      purpose?: 'transactional' | 'marketing' | 'operational' | 'legal'
      status?: 'queued' | 'sent' | 'delivered' | 'failed'
      recipientRef?: string
      subject?: string
      title?: string
      body?: string
      metadata?: Record<string, unknown>
    },
  ) =>
    request<{ message: PersonaInboxMessage; events: PersonaInboxMessageEvent[] }>(
      `/api/v1/internal/bizes/${bizId}/persona-inboxes/${encodeURIComponent(personaKey)}/messages/simulate`,
      {
        method: 'POST',
        body,
      },
    ),
  createOutboundMessageEvent: (
    bizId: string,
    messageId: string,
    body: {
      eventType: 'queued' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'opened' | 'clicked' | 'replied' | 'complained' | 'unsubscribed' | 'other'
      nextStatus?: 'queued' | 'processing' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'opened' | 'clicked' | 'replied' | 'cancelled' | 'suppressed'
      providerEventRef?: string
      payload?: Record<string, unknown>
      metadata?: Record<string, unknown>
      errorCode?: string
      errorMessage?: string
    },
    actorToken?: string | null,
  ) =>
    request<unknown>(`/api/v1/bizes/${bizId}/outbound-messages/${messageId}/events`, {
      method: 'POST',
      body,
      actorToken,
    }),

  listAnalyticsReports: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/analytics/reports?perPage=100`, { actorToken }),
  createAnalyticsReport: (
    bizId: string,
    body: {
      projectionKey: string
      name: string
      description?: string
      spec?: Record<string, unknown>
      freshnessPolicy?: Record<string, unknown>
      metadata?: Record<string, unknown>
    },
    actorToken?: string | null,
  ) =>
    request<unknown>(`/api/v1/bizes/${bizId}/analytics/reports`, {
      method: 'POST',
      body,
      actorToken,
    }),
  renderAnalyticsReport: (
    bizId: string,
    projectionId: string,
    body?: {
      documentKey?: string
      subjectType?: string
      subjectId?: string
      specOverrides?: Record<string, unknown>
      metadata?: Record<string, unknown>
    },
    actorToken?: string | null,
  ) =>
    request<unknown>(`/api/v1/bizes/${bizId}/analytics/reports/${projectionId}/render`, {
      method: 'POST',
      body: body ?? {},
      actorToken,
    }),
  exportAnalyticsReport: (
    bizId: string,
    body: {
      projectionId: string
      format: 'csv' | 'pdf'
      reason?: string
      metadata?: Record<string, unknown>
    },
    actorToken?: string | null,
  ) =>
    request<unknown>(`/api/v1/bizes/${bizId}/analytics/exports`, {
      method: 'POST',
      body,
      actorToken,
    }),
  getCoverageLaneReportSummary: (
    bizId: string,
    params?: { from?: string; to?: string; locationId?: string },
    actorToken?: string | null,
  ) => {
    const search = new URLSearchParams()
    if (params?.from) search.set('from', params.from)
    if (params?.to) search.set('to', params.to)
    if (params?.locationId) search.set('locationId', params.locationId)
    return request<unknown>(
      `/api/v1/bizes/${bizId}/reporting/coverage-lanes/summary${search.size ? `?${search.toString()}` : ''}`,
      { actorToken },
    )
  },

  listQueues: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/queues?perPage=200`, { actorToken }),
  createQueue: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/queues`, { method: 'POST', body, actorToken }),
  listQueueEntries: (bizId: string, queueId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/queues/${queueId}/entries?perPage=200`, { actorToken }),
  createQueueEntry: (bizId: string, queueId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/queues/${queueId}/entries`, { method: 'POST', body, actorToken }),
  offerNextQueueEntry: (bizId: string, queueId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/queues/${queueId}/offer-next`, { method: 'POST', body, actorToken }),

  listReviewQueues: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/review-queues?perPage=200`, { actorToken }),
  createReviewQueue: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/review-queues`, { method: 'POST', body, actorToken }),
  listReviewQueueItems: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/review-queue-items?perPage=200`, { actorToken }),
  createReviewQueueItem: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/review-queue-items`, { method: 'POST', body, actorToken }),
  listWorkflows: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/workflows?perPage=200`, { actorToken }),
  listAsyncDeliverables: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/async-deliverables?perPage=200`, { actorToken }),

  getComplianceControls: (bizId: string, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/compliance/controls`, { actorToken }),
  getBookingComplianceGate: (bizId: string, bookingOrderId: string, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/booking-orders/${bookingOrderId}/compliance-gate`, { actorToken }),
  createComplianceConsent: (
    bizId: string,
    bookingOrderId: string,
    body: Record<string, unknown>,
    actorToken?: string | null,
  ) =>
    request<unknown>(`/api/v1/bizes/${bizId}/booking-orders/${bookingOrderId}/compliance-consents`, {
      method: 'POST',
      body,
      actorToken,
    }),

  listDispatchRoutes: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/dispatch/routes`, { actorToken }),
  createDispatchRoute: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/dispatch/routes`, { method: 'POST', body, actorToken }),
  createDispatchTrip: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/dispatch/trips`, { method: 'POST', body, actorToken }),
  createDispatchTask: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/dispatch/tasks`, { method: 'POST', body, actorToken }),
  getDispatchState: (bizId: string, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/dispatch/state`, { actorToken }),

  listMembershipPlans: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/membership-plans?perPage=200`, { actorToken }),
  createMembershipPlan: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/membership-plans`, { method: 'POST', body, actorToken }),
  listMemberships: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/memberships?perPage=200`, { actorToken }),
  createMembership: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/memberships`, { method: 'POST', body, actorToken }),
  listEntitlementWallets: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/entitlement-wallets?perPage=200`, { actorToken }),
  createEntitlementWallet: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/entitlement-wallets`, { method: 'POST', body, actorToken }),
  createEntitlementGrant: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/entitlement-grants`, { method: 'POST', body, actorToken }),
  consumeEntitlementWallet: (bizId: string, walletId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/entitlement-wallets/${walletId}/consume`, { method: 'POST', body, actorToken }),
  listEntitlementLedger: (bizId: string, walletId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/entitlement-wallets/${walletId}/ledger?perPage=200`, { actorToken }),

  listCrmPipelines: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/crm/pipelines`, { actorToken }),
  createCrmPipeline: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/crm/pipelines`, { method: 'POST', body, actorToken }),
  listCrmPipelineStages: (bizId: string, pipelineId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/crm/pipelines/${pipelineId}/stages`, { actorToken }),
  createCrmPipelineStage: (
    bizId: string,
    pipelineId: string,
    body: Record<string, unknown>,
    actorToken?: string | null,
  ) => request<unknown>(`/api/v1/bizes/${bizId}/crm/pipelines/${pipelineId}/stages`, { method: 'POST', body, actorToken }),
  listCrmContacts: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/crm/contacts?perPage=200`, { actorToken }),
  createCrmContact: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/crm/contacts`, { method: 'POST', body, actorToken }),
  listCrmLeads: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/crm/leads?perPage=200`, { actorToken }),
  createCrmLead: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/crm/leads`, { method: 'POST', body, actorToken }),
  listCrmOpportunities: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/crm/opportunities?perPage=200`, { actorToken }),
  createCrmOpportunity: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/crm/opportunities`, { method: 'POST', body, actorToken }),
  getCrmContactSummary: (bizId: string, contactId: string, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/crm/contacts/${contactId}/summary`, { actorToken }),

  listChannelAccounts: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/channel-accounts?perPage=200`, { actorToken }),
  createChannelAccount: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/channel-accounts`, { method: 'POST', body, actorToken }),
  listChannelSyncStates: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/channel-sync-states`, { actorToken }),
  upsertChannelSyncState: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/channel-sync-states`, { method: 'POST', body, actorToken }),
  listChannelEntityLinks: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/channel-entity-links?perPage=200`, { actorToken }),
  createChannelEntityLink: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/channel-entity-links`, { method: 'POST', body, actorToken }),
  getChannelInsights: (bizId: string, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/channel-insights`, { actorToken }),
}
