import { apiUrl } from '@/lib/api'

type ApiEnvelope<T> = {
  success: boolean
  data: T
  meta?: Record<string, unknown>
  error?: {
    code?: string
    message?: string
  }
}

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

export type StudioRequestOptions = {
  actorToken?: string | null
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
}

async function request<T>(path: string, options?: StudioRequestOptions): Promise<T> {
  const method = options?.method ?? 'GET'
  const startedAt = Date.now()
  const requestBody = options?.body
  const response = await fetch(apiUrl(path), {
    method,
    credentials: 'include',
    headers: {
      accept: 'application/json',
      ...(options?.body ? { 'content-type': 'application/json' } : {}),
      ...(options?.actorToken ? { authorization: `Bearer ${options.actorToken}` } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  })

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null
  const durationMs = Date.now() - startedAt
  if (!response.ok || !payload?.success) {
    const message = payload?.error?.message ?? `Request failed (${response.status})`
    traceListener?.({
      at: new Date().toISOString(),
      method,
      path,
      durationMs,
      status: response.status,
      ok: false,
      requestBody,
      responseBody: payload,
      errorMessage: message,
    })
    throw new Error(message)
  }
  traceListener?.({
    at: new Date().toISOString(),
    method,
    path,
    durationMs,
    status: response.status,
    ok: true,
    requestBody,
    responseBody: payload,
  })
  return payload.data
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
    },
    actorToken?: string | null,
  ) => request<Record<string, unknown>>('/api/v1/bizes', { method: 'POST', body, actorToken }),

  listLocations: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/locations?perPage=200`, { actorToken }),
  createLocation: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/locations`, { method: 'POST', body, actorToken }),

  listResources: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/resources?perPage=200`, { actorToken }),
  createResource: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/resources`, { method: 'POST', body, actorToken }),

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

  listServiceGroups: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/service-groups?perPage=200`, { actorToken }),
  createServiceGroup: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/service-groups`, { method: 'POST', body, actorToken }),
  listServices: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/services?perPage=200`, { actorToken }),
  createService: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/services`, { method: 'POST', body, actorToken }),

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
  getPublicOfferAvailability: (bizId: string, offerId: string, limit = 20) =>
    request<unknown>(`/api/v1/public/bizes/${bizId}/offers/${offerId}/availability?limit=${limit}`),

  listProducts: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/products`, { actorToken }),
  createProduct: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/products`, { method: 'POST', body, actorToken }),

  listServiceProducts: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/service-products?perPage=200`, { actorToken }),
  createServiceProduct: (bizId: string, body: Record<string, unknown>, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/service-products`, { method: 'POST', body, actorToken }),

  listPublicBookings: (bizId: string, actorToken: string) =>
    request<unknown[]>(`/api/v1/public/bizes/${bizId}/booking-orders?perPage=100`, { actorToken }),
  createPublicBooking: (bizId: string, body: Record<string, unknown>, actorToken: string) =>
    request<unknown>(`/api/v1/public/bizes/${bizId}/booking-orders`, { method: 'POST', body, actorToken }),
  payPublicBookingAdvanced: (bizId: string, bookingOrderId: string, body: Record<string, unknown>, actorToken: string) =>
    request<unknown>(
      `/api/v1/public/bizes/${bizId}/booking-orders/${bookingOrderId}/payments/advanced`,
      { method: 'POST', body, actorToken },
    ),

  listPaymentIntents: (bizId: string, actorToken?: string | null) =>
    request<unknown[]>(`/api/v1/bizes/${bizId}/payment-intents?perPage=100`, { actorToken }),
  getPaymentIntentDetail: (bizId: string, paymentIntentId: string, actorToken?: string | null) =>
    request<unknown>(`/api/v1/bizes/${bizId}/payment-intents/${paymentIntentId}`, { actorToken }),

  listOutboundMessages: (bizId: string, query?: { recipientUserId?: string; bookingOrderId?: string }, actorToken?: string | null) => {
    const search = new URLSearchParams()
    search.set('perPage', '100')
    if (query?.recipientUserId) search.set('recipientUserId', query.recipientUserId)
    if (query?.bookingOrderId) search.set('bookingOrderId', query.bookingOrderId)
    return request<unknown[]>(`/api/v1/bizes/${bizId}/outbound-messages?${search.toString()}`, {
      actorToken,
    })
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
