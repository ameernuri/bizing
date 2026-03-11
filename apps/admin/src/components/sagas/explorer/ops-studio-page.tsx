'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, HelpCircle, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PageIntro } from './common'
import { apiUrl } from '@/lib/api'
import {
  setStudioApiTraceListener,
  studioApi,
  type StudioActorToken,
  type StudioActorUser,
  type StudioApiTrace,
} from '@/lib/studio-api'

const ReactJson = dynamic(() => import('react-json-view'), { ssr: false })

type JsonMap = Record<string, unknown>
type ActorRole = 'owner' | 'admin' | 'manager' | 'staff' | 'host' | 'customer'
type MacroStep = {
  at: string
  status: 'ok' | 'error'
  step: string
  detail?: string
}
type SandboxRegistryEntry = {
  actorIds: string[]
  selectedBizId?: string
  entities: Record<string, string[]>
}
type SandboxRegistry = Record<string, SandboxRegistryEntry>

const SANDBOX_REGISTRY_KEY = 'bizing_ops_sandbox_registry_v1'

function titled(value: string) {
  return value
    .split('_')
    .join(' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function asArray(value: unknown): JsonMap[] {
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === 'object') as JsonMap[]) : []
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

function isoAfterMinutes(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString()
}

function rowRef(row: JsonMap, key: string) {
  const direct = row[key]
  if (typeof direct === 'string') return direct
  const metadata = row.metadata
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const value = (metadata as JsonMap)[key]
    if (typeof value === 'string') return value
  }
  return ''
}

function FieldTitle({ label, help }: { label: string; help?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {help ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={`Help: ${label}`}>
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">{help}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  )
}

/**
 * Operations Studio
 *
 * Purpose:
 * - run real lifecycle flows against real API endpoints
 * - switch actor context with impersonation tokens (owner/member/customer)
 * - see bookings, calendars, payments, and outbound messages in one place
 */
export function OpsStudioPage() {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [macroName, setMacroName] = useState<string>('')
  const [macroSteps, setMacroSteps] = useState<MacroStep[]>([])
  const [apiTraces, setApiTraces] = useState<StudioApiTrace[]>([])
  const [selectedTraceIndex, setSelectedTraceIndex] = useState<number>(0)

  const [sandboxes, setSandboxes] = useState<JsonMap[]>([])
  const [activeSandboxId, setActiveSandboxId] = useState<string>('')
  const [newSandboxTitle, setNewSandboxTitle] = useState<string>('')
  const [seedUserCount, setSeedUserCount] = useState<number>(3)
  const [sandboxRegistry, setSandboxRegistry] = useState<SandboxRegistry>({})

  const [actors, setActors] = useState<StudioActorUser[]>([])
  const [actorTokenMap, setActorTokenMap] = useState<Record<string, StudioActorToken>>({})
  const [activeActorId, setActiveActorId] = useState<string>('')

  const [bizes, setBizes] = useState<JsonMap[]>([])
  const [selectedBizId, setSelectedBizId] = useState<string>('')
  const [locations, setLocations] = useState<JsonMap[]>([])
  const [resources, setResources] = useState<JsonMap[]>([])
  const [calendars, setCalendars] = useState<JsonMap[]>([])
  const [calendarBindings, setCalendarBindings] = useState<JsonMap[]>([])
  const [timeline, setTimeline] = useState<unknown | null>(null)
  const [serviceGroups, setServiceGroups] = useState<JsonMap[]>([])
  const [services, setServices] = useState<JsonMap[]>([])
  const [offers, setOffers] = useState<JsonMap[]>([])
  const [products, setProducts] = useState<JsonMap[]>([])
  const [serviceProducts, setServiceProducts] = useState<JsonMap[]>([])
  const [publicOffers, setPublicOffers] = useState<JsonMap[]>([])
  const [publicAvailability, setPublicAvailability] = useState<unknown | null>(null)
  const [customerBookings, setCustomerBookings] = useState<JsonMap[]>([])
  const [paymentIntents, setPaymentIntents] = useState<JsonMap[]>([])
  const [paymentIntentDetail, setPaymentIntentDetail] = useState<unknown | null>(null)
  const [outboundMessages, setOutboundMessages] = useState<JsonMap[]>([])
  const [queues, setQueues] = useState<JsonMap[]>([])
  const [queueEntries, setQueueEntries] = useState<JsonMap[]>([])
  const [reviewQueues, setReviewQueues] = useState<JsonMap[]>([])
  const [reviewQueueItems, setReviewQueueItems] = useState<JsonMap[]>([])
  const [workflows, setWorkflows] = useState<JsonMap[]>([])
  const [asyncDeliverables, setAsyncDeliverables] = useState<JsonMap[]>([])
  const [dispatchRoutes, setDispatchRoutes] = useState<JsonMap[]>([])
  const [dispatchState, setDispatchState] = useState<unknown | null>(null)
  const [membershipPlans, setMembershipPlans] = useState<JsonMap[]>([])
  const [memberships, setMemberships] = useState<JsonMap[]>([])
  const [entitlementWallets, setEntitlementWallets] = useState<JsonMap[]>([])
  const [walletLedger, setWalletLedger] = useState<JsonMap[]>([])
  const [crmPipelines, setCrmPipelines] = useState<JsonMap[]>([])
  const [crmPipelineStages, setCrmPipelineStages] = useState<JsonMap[]>([])
  const [crmContacts, setCrmContacts] = useState<JsonMap[]>([])
  const [crmLeads, setCrmLeads] = useState<JsonMap[]>([])
  const [crmOpportunities, setCrmOpportunities] = useState<JsonMap[]>([])
  const [crmContactSummary, setCrmContactSummary] = useState<unknown | null>(null)
  const [channelAccounts, setChannelAccounts] = useState<JsonMap[]>([])
  const [channelSyncStates, setChannelSyncStates] = useState<JsonMap[]>([])
  const [channelEntityLinks, setChannelEntityLinks] = useState<JsonMap[]>([])
  const [channelInsights, setChannelInsights] = useState<unknown | null>(null)
  const [complianceControls, setComplianceControls] = useState<unknown | null>(null)
  const [complianceGate, setComplianceGate] = useState<unknown | null>(null)

  const [createActorForm, setCreateActorForm] = useState({
    email: '',
    name: '',
    role: 'customer' as ActorRole,
  })

  const [createBizForm, setCreateBizForm] = useState({
    name: '',
    slug: '',
    timezone: 'America/Los_Angeles',
    currency: 'USD',
  })
  const [createLocationForm, setCreateLocationForm] = useState({
    name: '',
    slug: '',
    type: 'physical',
  })
  const [createResourceForm, setCreateResourceForm] = useState({
    name: '',
    slug: '',
    type: 'host',
    locationId: '',
  })
  const [createCalendarForm, setCreateCalendarForm] = useState({
    name: '',
    timezone: 'America/Los_Angeles',
    slotDurationMin: 30,
    slotIntervalMin: 15,
  })
  const [createBindingForm, setCreateBindingForm] = useState({
    calendarId: '',
    ownerType: 'biz',
    resourceId: '',
    serviceId: '',
    serviceProductId: '',
    offerId: '',
    locationId: '',
    ownerUserId: '',
  })
  const [createServiceGroupForm, setCreateServiceGroupForm] = useState({
    name: '',
    slug: '',
  })
  const [createServiceForm, setCreateServiceForm] = useState({
    serviceGroupId: '',
    name: '',
    slug: '',
    type: 'appointment',
  })
  const [createOfferForm, setCreateOfferForm] = useState({
    serviceGroupId: '',
    name: '',
    slug: '',
    executionMode: 'slot',
  })
  const [createOfferVersionForm, setCreateOfferVersionForm] = useState({
    offerId: '',
    version: 1,
    durationMode: 'fixed',
    defaultDurationMin: 60,
    basePriceMinor: 10000,
    currency: 'USD',
  })
  const [createProductForm, setCreateProductForm] = useState({
    name: '',
    slug: '',
    type: 'digital',
    basePriceMinor: 0,
    currency: 'USD',
  })
  const [createServiceProductForm, setCreateServiceProductForm] = useState({
    name: '',
    slug: '',
    kind: 'booking',
    durationMode: 'fixed',
    defaultDurationMinutes: 60,
    basePriceAmountMinorUnits: 10000,
    currency: 'USD',
  })
  const [customerFlow, setCustomerFlow] = useState({
    offerId: '',
    requestedStartAt: isoAfterMinutes(120),
  })
  const [queueForm, setQueueForm] = useState({
    name: '',
    slug: '',
    strategy: 'fifo',
    locationId: '',
  })
  const [queueEntryForm, setQueueEntryForm] = useState({
    queueId: '',
    priorityScore: 0,
  })
  const [reviewQueueForm, setReviewQueueForm] = useState({
    name: '',
    slug: '',
    type: 'manual_approval',
  })
  const [reviewQueueItemForm, setReviewQueueItemForm] = useState({
    reviewQueueId: '',
    itemType: 'manual_review',
    itemRefId: '',
  })
  const [dispatchRouteForm, setDispatchRouteForm] = useState({
    name: '',
    slug: '',
    timezone: 'America/Los_Angeles',
  })
  const [dispatchTripForm, setDispatchTripForm] = useState({
    routeId: '',
    departureAt: isoAfterMinutes(240),
    arrivalAt: isoAfterMinutes(300),
    capacitySeats: 8,
  })
  const [dispatchTaskForm, setDispatchTaskForm] = useState({
    tripId: '',
    title: '',
  })
  const [membershipPlanForm, setMembershipPlanForm] = useState({
    name: '',
    slug: '',
    entitlementType: 'credit',
    entitlementQuantityPerCycle: 4,
    priceMinor: 15000,
    currency: 'USD',
  })
  const [membershipForm, setMembershipForm] = useState({
    membershipPlanId: '',
    startsAt: isoAfterMinutes(60),
    currentPeriodStartAt: isoAfterMinutes(60),
    currentPeriodEndAt: isoAfterMinutes(60 * 24 * 30),
  })
  const [walletForm, setWalletForm] = useState({
    name: '',
    entitlementType: 'credit',
    balanceQuantity: 0,
  })
  const [grantForm, setGrantForm] = useState({
    walletId: '',
    quantity: 1,
    validFromAt: new Date().toISOString(),
  })
  const [consumeForm, setConsumeForm] = useState({
    walletId: '',
    quantity: 1,
  })
  const [crmPipelineForm, setCrmPipelineForm] = useState({
    name: '',
    slug: '',
  })
  const [crmStageForm, setCrmStageForm] = useState({
    pipelineId: '',
    name: '',
    slug: '',
    probabilityBps: 4000,
  })
  const [crmContactForm, setCrmContactForm] = useState({
    displayName: '',
    email: '',
  })
  const [crmLeadForm, setCrmLeadForm] = useState({
    crmContactId: '',
    sourceType: 'studio',
  })
  const [crmOpportunityForm, setCrmOpportunityForm] = useState({
    crmPipelineId: '',
    crmPipelineStageId: '',
    title: '',
    estimatedAmountMinor: 10000,
  })
  const [channelAccountForm, setChannelAccountForm] = useState({
    provider: 'google_reserve',
    name: '',
  })
  const [channelSyncForm, setChannelSyncForm] = useState({
    channelAccountId: '',
    objectType: 'booking_order',
    direction: 'bidirectional',
  })
  const [channelEntityLinkForm, setChannelEntityLinkForm] = useState({
    channelAccountId: '',
    objectType: 'booking_order',
    bookingOrderId: '',
    externalObjectId: '',
  })
  const [complianceForm, setComplianceForm] = useState({
    bookingOrderId: '',
    participantUserId: '',
    policyTemplateId: '',
  })

  const [selectedPaymentIntentId, setSelectedPaymentIntentId] = useState('')
  const [selectedWalletId, setSelectedWalletId] = useState('')
  const [selectedCrmContactId, setSelectedCrmContactId] = useState('')
  const [calendarLensType, setCalendarLensType] = useState<'all' | 'location' | 'resource' | 'service' | 'offer'>('all')
  const [calendarLensId, setCalendarLensId] = useState<string>('')

  const activeActor = useMemo(
    () => actors.find((actor) => actor.id === activeActorId) ?? null,
    [actors, activeActorId],
  )
  const activeSandbox = useMemo(
    () => sandboxes.find((sandbox) => text(sandbox.id) === activeSandboxId) ?? null,
    [sandboxes, activeSandboxId],
  )
  const activeActorToken = activeActor ? actorTokenMap[activeActor.id]?.accessToken ?? null : null
  const hasActiveActorToken = Boolean(activeActorToken)

  function saveSandboxRegistry(next: SandboxRegistry) {
    setSandboxRegistry(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SANDBOX_REGISTRY_KEY, JSON.stringify(next))
    }
  }

  function ensureSandboxRecord(registry: SandboxRegistry, sandboxId: string): SandboxRegistryEntry {
    return (
      registry[sandboxId] ?? {
        actorIds: [],
        entities: {},
      }
    )
  }

  function registerSandboxEntity(kind: string, id: string) {
    if (!activeSandboxId || !id) return
    const current = ensureSandboxRecord(sandboxRegistry, activeSandboxId)
    const currentIds = current.entities[kind] ?? []
    if (currentIds.includes(id)) return
    const next: SandboxRegistry = {
      ...sandboxRegistry,
      [activeSandboxId]: {
        ...current,
        entities: {
          ...current.entities,
          [kind]: [...currentIds, id],
        },
      },
    }
    saveSandboxRegistry(next)
  }

  function registerSandboxActor(userId: string) {
    if (!activeSandboxId || !userId) return
    const current = ensureSandboxRecord(sandboxRegistry, activeSandboxId)
    if (current.actorIds.includes(userId)) return
    const next: SandboxRegistry = {
      ...sandboxRegistry,
      [activeSandboxId]: {
        ...current,
        actorIds: [...current.actorIds, userId],
      },
    }
    saveSandboxRegistry(next)
  }

  function setSandboxSelectedBiz(bizId: string) {
    if (!activeSandboxId) return
    const current = ensureSandboxRecord(sandboxRegistry, activeSandboxId)
    const next: SandboxRegistry = {
      ...sandboxRegistry,
      [activeSandboxId]: {
        ...current,
        selectedBizId: bizId,
      },
    }
    saveSandboxRegistry(next)
  }

  function filterRowsBySandbox(kind: string, rows: JsonMap[]) {
    if (!activeSandboxId) return rows
    const current = sandboxRegistry[activeSandboxId]
    if (!current) return []
    const ids = new Set(current.entities[kind] ?? [])
    if (ids.size === 0) return []
    return rows.filter((row) => ids.has(text(row.id)))
  }

  async function safeRun(label: string, fn: () => Promise<void>) {
    setBusy(label)
    setError(null)
    setSuccess(null)
    try {
      await fn()
      setSuccess(`${label} succeeded`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `${label} failed`)
    } finally {
      setBusy(null)
    }
  }

  function saveTokenMap(next: Record<string, StudioActorToken>) {
    setActorTokenMap(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('bizing_ops_actor_tokens', JSON.stringify(next))
    }
  }

  async function loadActors() {
    const rows = await studioApi.listImpersonationUsers()
    const filtered = activeSandboxId
      ? rows.filter((row) => (sandboxRegistry[activeSandboxId]?.actorIds ?? []).includes(row.id))
      : rows
    setActors(filtered)
    if (!activeActorId && filtered[0]) setActiveActorId(filtered[0].id)
  }

  async function loadSandboxes() {
    const rows = await studioApi.listOodaLoops({ limit: 400 })
    const scoped = asArray(rows).filter((row) => {
      const metadata = (row.metadata as JsonMap | undefined) ?? {}
      return metadata.opsStudioSandbox === true
    })
    setSandboxes(scoped)
    if (!activeSandboxId && scoped[0]) setActiveSandboxId(text(scoped[0].id))
  }

  async function loadBizScopedData(input?: { bizId?: string; token?: string | null }) {
    const bizId = input?.bizId ?? selectedBizId
    if (!bizId) return
    const token = input?.token ?? activeActorToken
    const [nextLocations, nextResources, nextCalendars, nextBindings, nextServiceGroups, nextServices, nextOffers, nextProducts, nextServiceProducts, nextPublicOffers, nextPaymentIntents, nextMessages] =
      await Promise.all([
        studioApi.listLocations(bizId, token),
        studioApi.listResources(bizId, token),
        studioApi.listCalendars(bizId, token),
        studioApi.listCalendarBindings(bizId, token),
        studioApi.listServiceGroups(bizId, token),
        studioApi.listServices(bizId, token),
        studioApi.listOffers(bizId, token),
        studioApi.listProducts(bizId, token),
        studioApi.listServiceProducts(bizId, token),
        studioApi.listPublicOffers(bizId),
        studioApi.listPaymentIntents(bizId, token),
        studioApi.listOutboundMessages(bizId, undefined, token),
      ])

    setLocations(filterRowsBySandbox('locations', asArray(nextLocations)))
    setResources(filterRowsBySandbox('resources', asArray(nextResources)))
    setCalendars(filterRowsBySandbox('calendars', asArray(nextCalendars)))
    setCalendarBindings(filterRowsBySandbox('calendar_bindings', asArray(nextBindings)))
    setServiceGroups(filterRowsBySandbox('service_groups', asArray(nextServiceGroups)))
    setServices(filterRowsBySandbox('services', asArray(nextServices)))
    setOffers(filterRowsBySandbox('offers', asArray(nextOffers)))
    setProducts(filterRowsBySandbox('products', asArray(nextProducts)))
    setServiceProducts(filterRowsBySandbox('service_products', asArray(nextServiceProducts)))
    setPublicOffers(filterRowsBySandbox('offers', asArray(nextPublicOffers)))
    setPaymentIntents(asArray(nextPaymentIntents))
    setOutboundMessages(asArray(nextMessages))
  }

  async function loadQueueAndWorkflowData(input?: { bizId?: string; token?: string | null }) {
    const bizId = input?.bizId ?? selectedBizId
    if (!bizId) return
    const token = input?.token ?? activeActorToken
    const [nextQueues, nextReviewQueues, nextReviewItems, nextWorkflows, nextDeliverables] = await Promise.all([
      studioApi.listQueues(bizId, token),
      studioApi.listReviewQueues(bizId, token),
      studioApi.listReviewQueueItems(bizId, token),
      studioApi.listWorkflows(bizId, token),
      studioApi.listAsyncDeliverables(bizId, token),
    ])
    const queueRows = filterRowsBySandbox('queues', asArray(nextQueues))
    setQueues(queueRows)
    setReviewQueues(filterRowsBySandbox('review_queues', asArray(nextReviewQueues)))
    setReviewQueueItems(filterRowsBySandbox('review_queue_items', asArray(nextReviewItems)))
    setWorkflows(asArray(nextWorkflows))
    setAsyncDeliverables(asArray(nextDeliverables))

    const queueId = queueEntryForm.queueId || text(queueRows[0]?.id)
    if (queueId) {
      setQueueEntryForm((v) => ({ ...v, queueId }))
      const nextEntries = await studioApi.listQueueEntries(bizId, queueId, token)
      setQueueEntries(filterRowsBySandbox('queue_entries', asArray(nextEntries)))
    } else {
      setQueueEntries([])
    }
  }

  async function loadDispatchData(input?: { bizId?: string; token?: string | null }) {
    const bizId = input?.bizId ?? selectedBizId
    if (!bizId) return
    const token = input?.token ?? activeActorToken
    const [nextRoutes, nextState] = await Promise.all([
      studioApi.listDispatchRoutes(bizId, token),
      studioApi.getDispatchState(bizId, token),
    ])
    setDispatchRoutes(filterRowsBySandbox('dispatch_routes', asArray(nextRoutes)))
    setDispatchState(nextState)
  }

  async function loadMembershipData(input?: { bizId?: string; token?: string | null }) {
    const bizId = input?.bizId ?? selectedBizId
    if (!bizId) return
    const token = input?.token ?? activeActorToken
    const [nextPlans, nextMemberships, nextWallets] = await Promise.all([
      studioApi.listMembershipPlans(bizId, token),
      studioApi.listMemberships(bizId, token),
      studioApi.listEntitlementWallets(bizId, token),
    ])
    const walletRows = filterRowsBySandbox('entitlement_wallets', asArray(nextWallets))
    setMembershipPlans(filterRowsBySandbox('membership_plans', asArray(nextPlans)))
    setMemberships(filterRowsBySandbox('memberships', asArray(nextMemberships)))
    setEntitlementWallets(walletRows)
    const walletId = selectedWalletId || text(walletRows[0]?.id)
    if (walletId) {
      setSelectedWalletId(walletId)
      const ledger = await studioApi.listEntitlementLedger(bizId, walletId, token)
      setWalletLedger(filterRowsBySandbox('entitlement_ledger_entries', asArray(ledger)))
    } else {
      setWalletLedger([])
    }
  }

  async function loadCrmData(input?: { bizId?: string; token?: string | null }) {
    const bizId = input?.bizId ?? selectedBizId
    if (!bizId) return
    const token = input?.token ?? activeActorToken
    const [nextPipelines, nextContacts, nextLeads, nextOpportunities] = await Promise.all([
      studioApi.listCrmPipelines(bizId, token),
      studioApi.listCrmContacts(bizId, token),
      studioApi.listCrmLeads(bizId, token),
      studioApi.listCrmOpportunities(bizId, token),
    ])
    const pipelines = filterRowsBySandbox('crm_pipelines', asArray(nextPipelines))
    const contacts = filterRowsBySandbox('crm_contacts', asArray(nextContacts))
    setCrmPipelines(pipelines)
    setCrmContacts(contacts)
    setCrmLeads(filterRowsBySandbox('crm_leads', asArray(nextLeads)))
    setCrmOpportunities(filterRowsBySandbox('crm_opportunities', asArray(nextOpportunities)))

    const pipelineId = crmStageForm.pipelineId || text(pipelines[0]?.id)
    if (pipelineId) {
      setCrmStageForm((v) => ({ ...v, pipelineId }))
      const nextStages = await studioApi.listCrmPipelineStages(bizId, pipelineId, token)
      setCrmPipelineStages(asArray(nextStages))
    } else {
      setCrmPipelineStages([])
    }

    const contactId = selectedCrmContactId || text(contacts[0]?.id)
    if (contactId) {
      setSelectedCrmContactId(contactId)
      setCrmLeadForm((v) => ({ ...v, crmContactId: v.crmContactId || contactId }))
      const summary = await studioApi.getCrmContactSummary(bizId, contactId, token)
      setCrmContactSummary(summary)
    } else {
      setCrmContactSummary(null)
    }
  }

  async function loadChannelData(input?: { bizId?: string; token?: string | null }) {
    const bizId = input?.bizId ?? selectedBizId
    if (!bizId) return
    const token = input?.token ?? activeActorToken
    const [nextAccounts, nextStates, nextLinks, nextInsights] = await Promise.all([
      studioApi.listChannelAccounts(bizId, token),
      studioApi.listChannelSyncStates(bizId, token),
      studioApi.listChannelEntityLinks(bizId, token),
      studioApi.getChannelInsights(bizId, token),
    ])
    const accounts = filterRowsBySandbox('channel_accounts', asArray(nextAccounts))
    setChannelAccounts(accounts)
    setChannelSyncStates(filterRowsBySandbox('channel_sync_states', asArray(nextStates)))
    setChannelEntityLinks(filterRowsBySandbox('channel_entity_links', asArray(nextLinks)))
    setChannelInsights(nextInsights)
    if (!channelSyncForm.channelAccountId && accounts[0]) {
      const accountId = text(accounts[0].id)
      setChannelSyncForm((v) => ({ ...v, channelAccountId: accountId }))
      setChannelEntityLinkForm((v) => ({ ...v, channelAccountId: accountId }))
    }
  }

  async function loadBizesForActiveActor() {
    if (!activeActorToken) {
      setBizes([])
      return
    }
    const rows = await studioApi.listBizes(activeActorToken)
    const list = filterRowsBySandbox('bizes', asArray(rows))
    setBizes(list)
    if (!selectedBizId && list[0]) setSelectedBizId(text(list[0].id))
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem('bizing_ops_actor_tokens')
      if (raw) {
        try {
          setActorTokenMap(JSON.parse(raw) as Record<string, StudioActorToken>)
        } catch {
          setActorTokenMap({})
        }
      }
      const sandboxRaw = window.localStorage.getItem(SANDBOX_REGISTRY_KEY)
      if (sandboxRaw) {
        try {
          setSandboxRegistry(JSON.parse(sandboxRaw) as SandboxRegistry)
        } catch {
          setSandboxRegistry({})
        }
      }
    }
    setStudioApiTraceListener((trace) => {
      setApiTraces((prev) => [trace, ...prev].slice(0, 300))
      setSelectedTraceIndex(0)
    })
    void safeRun('Load sandboxes', loadSandboxes)
    void safeRun('Load actors', loadActors)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => setStudioApiTraceListener(null)
  }, [])

  useEffect(() => {
    if (!activeActorToken) return
    void safeRun('Load actor bizes', loadBizesForActiveActor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeActorToken])

  useEffect(() => {
    if (!selectedBizId || !activeActorToken) return
    void safeRun('Load biz data', loadBizScopedData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBizId, activeActorToken])

  useEffect(() => {
    if (!activeSandboxId) return
    const selected = sandboxRegistry[activeSandboxId]?.selectedBizId
    if (selected) setSelectedBizId(selected)
    void safeRun('Load actors', loadActors)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSandboxId, sandboxRegistry])

  useEffect(() => {
    if (!selectedWalletId) return
    setGrantForm((v) => ({ ...v, walletId: selectedWalletId }))
    setConsumeForm((v) => ({ ...v, walletId: selectedWalletId }))
  }, [selectedWalletId])

  async function handleCreateActor() {
    if (!createActorForm.email || !createActorForm.name) return
    await safeRun('Create actor', async () => {
      const created = await studioApi.createImpersonationUser({
        email: createActorForm.email,
        name: createActorForm.name,
        role: createActorForm.role,
      })
      registerSandboxActor(created.user.id)
      await loadActors()
      setCreateActorForm({
        email: '',
        name: '',
        role: 'customer',
      })
    })
  }

  async function handleCreateSandbox() {
    const title = newSandboxTitle.trim()
    if (!title) return
    await safeRun('Create sandbox', async () => {
      const created = (await studioApi.createOodaLoop({
        title,
        objective: 'Ops Studio sandbox context',
        status: 'active',
        priority: 40,
        metadata: {
          opsStudioSandbox: true,
        },
      })) as JsonMap
      const sandboxId = text(created.id)
      setActiveSandboxId(sandboxId)
      setNewSandboxTitle('')
      const next: SandboxRegistry = {
        ...sandboxRegistry,
        [sandboxId]: ensureSandboxRecord(sandboxRegistry, sandboxId),
      }
      saveSandboxRegistry(next)
      await loadSandboxes()
      setSelectedBizId('')
      setBizes([])
      setLocations([])
      setResources([])
      setCalendars([])
      setOffers([])
      setServices([])
      setProducts([])
      setServiceProducts([])
      setQueueEntries([])
    })
  }

  async function handleSeedSandboxUsers() {
    if (!activeSandboxId) return
    const roles: ActorRole[] = ['owner', 'customer', 'staff', 'host', 'manager', 'admin']
    const seedTotal = Math.max(1, Math.min(20, seedUserCount))
    await safeRun('Seed sandbox users', async () => {
      const stamp = Date.now().toString(36)
      for (let index = 0; index < seedTotal; index += 1) {
        const role = roles[index % roles.length]
        const created = await studioApi.createImpersonationUser({
          email: `sandbox.${stamp}.${index + 1}.${role}@example.test`,
          name: `Sandbox ${role} ${index + 1}`,
          role,
        })
        registerSandboxActor(created.user.id)
      }
      await loadActors()
    })
  }

  async function handleIssueToken(userId: string) {
    await safeRun('Issue actor token', async () => {
      registerSandboxActor(userId)
      const issued = await studioApi.issueImpersonationToken({
        targetUserId: userId,
        bizId: selectedBizId || undefined,
        ensureMembership: Boolean(selectedBizId),
        membershipRole: 'customer',
        scopes: ['*'],
        ttlSeconds: 12 * 60 * 60,
      })
      const next = { ...actorTokenMap, [userId]: issued }
      saveTokenMap(next)
      setActiveActorId(userId)
    })
  }

  async function handleCreateBiz() {
    if (!hasActiveActorToken) return
    await safeRun('Create biz', async () => {
      const row = await studioApi.createBiz(
        {
          name: createBizForm.name,
          slug: createBizForm.slug || slugify(createBizForm.name),
          timezone: createBizForm.timezone,
          currency: createBizForm.currency,
          type: 'small_business',
        },
        activeActorToken,
      )
      const bizId = text((row as JsonMap).id)
      registerSandboxEntity('bizes', bizId)
      setSandboxSelectedBiz(bizId)
      setSelectedBizId(bizId)
      await loadBizesForActiveActor()
      await loadBizScopedData()
    })
  }

  async function handleCreateLocation() {
    if (!selectedBizId || !hasActiveActorToken) return
    await safeRun('Create location', async () => {
      const created = (await studioApi.createLocation(
        selectedBizId,
        {
          name: createLocationForm.name,
          slug: createLocationForm.slug || slugify(createLocationForm.name),
          type: createLocationForm.type,
          timezone: 'America/Los_Angeles',
          status: 'active',
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('locations', text(created.id))
      await loadBizScopedData()
    })
  }

  async function handleCreateResource() {
    if (!selectedBizId || !hasActiveActorToken || !createResourceForm.locationId) return
    await safeRun('Create resource', async () => {
      const created = (await studioApi.createResource(
        selectedBizId,
        {
          locationId: createResourceForm.locationId,
          type: createResourceForm.type,
          name: createResourceForm.name,
          slug: createResourceForm.slug || slugify(createResourceForm.name),
          timezone: 'America/Los_Angeles',
          allowSimultaneousBookings: false,
          bufferBeforeMinutes: 5,
          bufferAfterMinutes: 5,
          capacity: 1,
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('resources', text(created.id))
      await loadBizScopedData()
    })
  }

  async function handleCreateCalendar() {
    if (!selectedBizId || !hasActiveActorToken) return
    await safeRun('Create calendar', async () => {
      const created = (await studioApi.createCalendar(
        selectedBizId,
        {
          name: createCalendarForm.name,
          timezone: createCalendarForm.timezone,
          slotDurationMin: createCalendarForm.slotDurationMin,
          slotIntervalMin: createCalendarForm.slotIntervalMin,
          preBufferMin: 0,
          postBufferMin: 0,
          minAdvanceBookingHours: 0,
          maxAdvanceBookingDays: 120,
          defaultMode: 'available_by_default',
          status: 'active',
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('calendars', text(created.id))
      await loadBizScopedData()
    })
  }

  async function handleCreateBinding() {
    if (!selectedBizId || !hasActiveActorToken || !createBindingForm.calendarId) return
    await safeRun('Create calendar binding', async () => {
      const created = (await studioApi.createCalendarBinding(
        selectedBizId,
        {
          calendarId: createBindingForm.calendarId,
          ownerType: createBindingForm.ownerType,
          resourceId: createBindingForm.resourceId || undefined,
          serviceId: createBindingForm.serviceId || undefined,
          serviceProductId: createBindingForm.serviceProductId || undefined,
          offerId: createBindingForm.offerId || undefined,
          locationId: createBindingForm.locationId || undefined,
          ownerUserId: createBindingForm.ownerUserId || undefined,
          isPrimary: true,
          isActive: true,
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('calendar_bindings', text(created.id))
      await loadBizScopedData()
    })
  }

  async function handleLoadTimeline() {
    if (!selectedBizId || !hasActiveActorToken || !createBindingForm.calendarId) return
    await safeRun('Load calendar timeline', async () => {
      const result = await studioApi.fetchCalendarTimeline(
        selectedBizId,
        createBindingForm.calendarId,
        {
          startAt: new Date().toISOString(),
          endAt: isoAfterMinutes(60 * 24 * 7),
        },
        activeActorToken,
      )
      setTimeline(result)
    })
  }

  async function handleCreateServiceGroup() {
    if (!selectedBizId || !hasActiveActorToken) return
    await safeRun('Create service group', async () => {
      const created = (await studioApi.createServiceGroup(
        selectedBizId,
        {
          name: createServiceGroupForm.name,
          slug: createServiceGroupForm.slug || slugify(createServiceGroupForm.name),
          status: 'active',
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('service_groups', text(created.id))
      await loadBizScopedData()
    })
  }

  async function handleCreateService() {
    if (!selectedBizId || !hasActiveActorToken || !createServiceForm.serviceGroupId) return
    await safeRun('Create service', async () => {
      const created = (await studioApi.createService(
        selectedBizId,
        {
          serviceGroupId: createServiceForm.serviceGroupId,
          name: createServiceForm.name,
          slug: createServiceForm.slug || slugify(createServiceForm.name),
          type: createServiceForm.type,
          visibility: 'public',
          allowWaitlist: true,
          requiresApproval: false,
          status: 'active',
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('services', text(created.id))
      await loadBizScopedData()
    })
  }

  async function handleCreateOffer() {
    if (!selectedBizId || !hasActiveActorToken) return
    const serviceGroupId = createOfferForm.serviceGroupId || text(serviceGroups[0]?.id)
    if (!serviceGroupId) return
    await safeRun('Create offer', async () => {
      const created = (await studioApi.createOffer(
        selectedBizId,
        {
          serviceGroupId,
          name: createOfferForm.name,
          slug: createOfferForm.slug || slugify(createOfferForm.name),
          executionMode: createOfferForm.executionMode,
          status: 'active',
          isPublished: false,
          timezone: 'America/Los_Angeles',
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('offers', text(created.id))
      await loadBizScopedData()
    })
  }

  async function handleCreateOfferVersion() {
    if (!selectedBizId || !hasActiveActorToken || !createOfferVersionForm.offerId) return
    await safeRun('Create offer version', async () => {
      await studioApi.createOfferVersion(
        selectedBizId,
        createOfferVersionForm.offerId,
        {
          version: createOfferVersionForm.version,
          status: 'published',
          durationMode: createOfferVersionForm.durationMode,
          defaultDurationMin: createOfferVersionForm.defaultDurationMin,
          durationStepMin: 15,
          basePriceMinor: createOfferVersionForm.basePriceMinor,
          currency: createOfferVersionForm.currency,
        },
        activeActorToken,
      )
      await studioApi.patchOffer(
        selectedBizId,
        createOfferVersionForm.offerId,
        { isPublished: true, status: 'active' },
        activeActorToken,
      )
      await loadBizScopedData()
    })
  }

  async function handleCreateProduct() {
    if (!selectedBizId || !hasActiveActorToken) return
    await safeRun('Create product', async () => {
      const created = (await studioApi.createProduct(
        selectedBizId,
        {
          name: createProductForm.name,
          slug: createProductForm.slug || slugify(createProductForm.name),
          type: createProductForm.type,
          status: 'active',
          basePriceMinor: createProductForm.basePriceMinor,
          currency: createProductForm.currency,
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('products', text(created.id))
      await loadBizScopedData()
    })
  }

  async function handleCreateServiceProduct() {
    if (!selectedBizId || !hasActiveActorToken) return
    await safeRun('Create service product', async () => {
      const created = (await studioApi.createServiceProduct(
        selectedBizId,
        {
          name: createServiceProductForm.name,
          slug: createServiceProductForm.slug || slugify(createServiceProductForm.name),
          kind: createServiceProductForm.kind,
          durationMode: createServiceProductForm.durationMode,
          defaultDurationMinutes: createServiceProductForm.defaultDurationMinutes,
          basePriceAmountMinorUnits: createServiceProductForm.basePriceAmountMinorUnits,
          currency: createServiceProductForm.currency,
          isPublished: true,
          status: 'active',
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('service_products', text(created.id))
      await loadBizScopedData()
    })
  }

  async function handleLoadPublicAvailability() {
    if (!selectedBizId || !customerFlow.offerId) return
    await safeRun('Load offer availability', async () => {
      const data = await studioApi.getPublicOfferAvailability(selectedBizId, customerFlow.offerId, 12)
      setPublicAvailability(data)
    })
  }

  async function handleCustomerBooking() {
    if (!selectedBizId || !activeActorToken || !customerFlow.offerId) return
    await safeRun('Create customer booking + payment', async () => {
      const availability = (publicAvailability ?? {}) as JsonMap
      const offerVersionId = text(availability.offerVersionId)
      if (!offerVersionId) throw new Error('Load availability first to resolve published offer version.')

      const booking = (await studioApi.createPublicBooking(
        selectedBizId,
        {
          offerId: customerFlow.offerId,
          offerVersionId,
          status: 'awaiting_payment',
          currency: 'USD',
          subtotalMinor: 10000,
          taxMinor: 0,
          feeMinor: 0,
          discountMinor: 0,
          totalMinor: 10000,
          requestedStartAt: customerFlow.requestedStartAt,
          requestedEndAt: isoAfterMinutes(180),
        },
        activeActorToken,
      )) as JsonMap

      const bookingId = text(booking.id)
      const totalMinor = numberValue(booking.totalMinor, 10000)
      await studioApi.payPublicBookingAdvanced(
        selectedBizId,
        bookingId,
        {
          currency: text(booking.currency, 'USD'),
          tipMinor: 0,
          tenders: [
            {
              methodType: 'card',
              allocatedMinor: totalMinor,
              provider: 'stripe',
              label: 'Card',
            },
          ],
        },
        activeActorToken,
      )
      const [nextBookings, nextPayments, nextMessages] = await Promise.all([
        studioApi.listPublicBookings(selectedBizId, activeActorToken),
        studioApi.listPaymentIntents(selectedBizId, activeActorToken),
        studioApi.listOutboundMessages(selectedBizId, { bookingOrderId: bookingId }, activeActorToken),
      ])
      setCustomerBookings(asArray(nextBookings))
      setPaymentIntents(asArray(nextPayments))
      setOutboundMessages(asArray(nextMessages))
    })
  }

  async function handleLoadPaymentDetail() {
    if (!selectedBizId || !selectedPaymentIntentId) return
    await safeRun('Load payment intent detail', async () => {
      const detail = await studioApi.getPaymentIntentDetail(selectedBizId, selectedPaymentIntentId, activeActorToken)
      setPaymentIntentDetail(detail)
    })
  }

  async function handleCreateQueue() {
    if (!selectedBizId || !hasActiveActorToken || !queueForm.name) return
    await safeRun('Create queue', async () => {
      const created = (await studioApi.createQueue(
        selectedBizId,
        {
          name: queueForm.name,
          slug: queueForm.slug || slugify(queueForm.name),
          strategy: queueForm.strategy,
          status: 'active',
          isSelfJoinEnabled: true,
          locationId: queueForm.locationId || undefined,
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('queues', text(created.id))
      await loadQueueAndWorkflowData()
    })
  }

  async function handleCreateQueueEntry() {
    if (!selectedBizId || !hasActiveActorToken || !queueEntryForm.queueId || !activeActorId) return
    await safeRun('Create queue entry', async () => {
      const created = (await studioApi.createQueueEntry(
        selectedBizId,
        queueEntryForm.queueId,
        {
          customerUserId: activeActorId,
          priorityScore: queueEntryForm.priorityScore,
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('queue_entries', text(created.id))
      await loadQueueAndWorkflowData()
    })
  }

  async function handleOfferNextQueueEntry() {
    if (!selectedBizId || !hasActiveActorToken || !queueEntryForm.queueId) return
    await safeRun('Offer next queue entry', async () => {
      await studioApi.offerNextQueueEntry(
        selectedBizId,
        queueEntryForm.queueId,
        {
          offerTtlMinutes: 20,
          metadata: { source: 'ops_studio' },
        },
        activeActorToken,
      )
      await loadQueueAndWorkflowData()
    })
  }

  async function handleCreateReviewQueue() {
    if (!selectedBizId || !hasActiveActorToken || !reviewQueueForm.name) return
    await safeRun('Create review queue', async () => {
      const created = (await studioApi.createReviewQueue(
        selectedBizId,
        {
          name: reviewQueueForm.name,
          slug: reviewQueueForm.slug || slugify(reviewQueueForm.name),
          type: reviewQueueForm.type,
          status: 'active',
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('review_queues', text(created.id))
      await loadQueueAndWorkflowData()
    })
  }

  async function handleCreateReviewQueueItem() {
    if (!selectedBizId || !hasActiveActorToken || !reviewQueueItemForm.reviewQueueId || !reviewQueueItemForm.itemRefId) return
    await safeRun('Create review queue item', async () => {
      const created = (await studioApi.createReviewQueueItem(
        selectedBizId,
        {
          reviewQueueId: reviewQueueItemForm.reviewQueueId,
          itemType: reviewQueueItemForm.itemType,
          itemRefId: reviewQueueItemForm.itemRefId,
          status: 'pending',
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('review_queue_items', text(created.id))
      await loadQueueAndWorkflowData()
    })
  }

  async function handleCreateDispatchRoute() {
    if (!selectedBizId || !hasActiveActorToken || !dispatchRouteForm.name) return
    await safeRun('Create dispatch route', async () => {
      const created = (await studioApi.createDispatchRoute(
        selectedBizId,
        {
          name: dispatchRouteForm.name,
          slug: dispatchRouteForm.slug || slugify(dispatchRouteForm.name),
          timezone: dispatchRouteForm.timezone,
          status: 'active',
          policy: {},
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('dispatch_routes', text(created.id))
      await loadDispatchData()
    })
  }

  async function handleCreateDispatchTrip() {
    if (!selectedBizId || !hasActiveActorToken || !dispatchTripForm.routeId) return
    await safeRun('Create dispatch trip', async () => {
      await studioApi.createDispatchTrip(
        selectedBizId,
        {
          routeId: dispatchTripForm.routeId,
          departureAt: dispatchTripForm.departureAt,
          arrivalAt: dispatchTripForm.arrivalAt,
          capacitySeats: dispatchTripForm.capacitySeats,
          overbookSeats: 0,
          status: 'planned',
        },
        activeActorToken,
      )
      await loadDispatchData()
    })
  }

  async function handleCreateDispatchTask() {
    if (!selectedBizId || !hasActiveActorToken || !dispatchTaskForm.title) return
    await safeRun('Create dispatch task', async () => {
      await studioApi.createDispatchTask(
        selectedBizId,
        {
          tripId: dispatchTaskForm.tripId || undefined,
          title: dispatchTaskForm.title,
          status: 'queued',
        },
        activeActorToken,
      )
      await loadDispatchData()
    })
  }

  async function handleCreateMembershipPlan() {
    if (!selectedBizId || !hasActiveActorToken || !membershipPlanForm.name) return
    await safeRun('Create membership plan', async () => {
      const created = (await studioApi.createMembershipPlan(
        selectedBizId,
        {
          name: membershipPlanForm.name,
          slug: membershipPlanForm.slug || slugify(membershipPlanForm.name),
          status: 'active',
          billingIntervalCount: 1,
          billingIntervalUnit: 'month',
          priceMinor: membershipPlanForm.priceMinor,
          currency: membershipPlanForm.currency,
          entitlementType: membershipPlanForm.entitlementType,
          entitlementQuantityPerCycle: membershipPlanForm.entitlementQuantityPerCycle,
          allowRollover: false,
          allowTransfers: true,
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('membership_plans', text(created.id))
      await loadMembershipData()
    })
  }

  async function handleCreateMembership() {
    if (!selectedBizId || !hasActiveActorToken || !membershipForm.membershipPlanId || !activeActorId) return
    await safeRun('Create membership', async () => {
      const created = (await studioApi.createMembership(
        selectedBizId,
        {
          membershipPlanId: membershipForm.membershipPlanId,
          ownerUserId: activeActorId,
          status: 'active',
          startsAt: membershipForm.startsAt,
          currentPeriodStartAt: membershipForm.currentPeriodStartAt,
          currentPeriodEndAt: membershipForm.currentPeriodEndAt,
          autoRenew: true,
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('memberships', text(created.id))
      await loadMembershipData()
    })
  }

  async function handleCreateWallet() {
    if (!selectedBizId || !hasActiveActorToken || !walletForm.name || !activeActorId) return
    await safeRun('Create wallet', async () => {
      const created = (await studioApi.createEntitlementWallet(
        selectedBizId,
        {
          ownerUserId: activeActorId,
          name: walletForm.name,
          entitlementType: walletForm.entitlementType,
          unitCode: walletForm.entitlementType === 'time_allowance' ? 'minutes' : 'credits',
          balanceQuantity: walletForm.balanceQuantity,
          isActive: true,
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('entitlement_wallets', text(created.id))
      await loadMembershipData()
    })
  }

  async function handleCreateGrant() {
    const walletId = grantForm.walletId || selectedWalletId
    if (!selectedBizId || !hasActiveActorToken || !walletId) return
    await safeRun('Create wallet grant', async () => {
      await studioApi.createEntitlementGrant(
        selectedBizId,
        {
          walletId,
          grantType: 'credit',
          quantity: grantForm.quantity,
          validFromAt: grantForm.validFromAt,
        },
        activeActorToken,
      )
      await loadMembershipData()
    })
  }

  async function handleConsumeWallet() {
    const walletId = consumeForm.walletId || selectedWalletId
    if (!selectedBizId || !hasActiveActorToken || !walletId) return
    await safeRun('Consume wallet', async () => {
      await studioApi.consumeEntitlementWallet(
        selectedBizId,
        walletId,
        {
          quantity: consumeForm.quantity,
          reasonCode: 'ops_studio_consume',
        },
        activeActorToken,
      )
      await loadMembershipData()
    })
  }

  async function handleCreateCrmPipeline() {
    if (!selectedBizId || !hasActiveActorToken || !crmPipelineForm.name) return
    await safeRun('Create CRM pipeline', async () => {
      const created = (await studioApi.createCrmPipeline(
        selectedBizId,
        {
          name: crmPipelineForm.name,
          slug: crmPipelineForm.slug || slugify(crmPipelineForm.name),
          status: 'active',
          pipelineType: 'opportunity',
          isDefault: false,
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('crm_pipelines', text(created.id))
      await loadCrmData()
    })
  }

  async function handleCreateCrmStage() {
    if (!selectedBizId || !hasActiveActorToken || !crmStageForm.pipelineId || !crmStageForm.name) return
    await safeRun('Create CRM stage', async () => {
      const created = (await studioApi.createCrmPipelineStage(
        selectedBizId,
        crmStageForm.pipelineId,
        {
          name: crmStageForm.name,
          slug: crmStageForm.slug || slugify(crmStageForm.name),
          status: 'active',
          defaultProbabilityBps: crmStageForm.probabilityBps,
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('crm_pipeline_stages', text(created.id))
      await loadCrmData()
    })
  }

  async function handleCreateCrmContact() {
    if (!selectedBizId || !hasActiveActorToken || !crmContactForm.displayName) return
    await safeRun('Create CRM contact', async () => {
      const created = (await studioApi.createCrmContact(
        selectedBizId,
        {
          status: 'active',
          contactType: 'external',
          externalContactRef: `contact-${Date.now()}`,
          displayName: crmContactForm.displayName,
          email: crmContactForm.email || undefined,
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('crm_contacts', text(created.id))
      await loadCrmData()
    })
  }

  async function handleCreateCrmLead() {
    if (!selectedBizId || !hasActiveActorToken || !crmLeadForm.crmContactId) return
    await safeRun('Create CRM lead', async () => {
      const created = (await studioApi.createCrmLead(
        selectedBizId,
        {
          crmContactId: crmLeadForm.crmContactId,
          sourceType: crmLeadForm.sourceType,
          status: 'new',
          scoreBps: 2500,
          priority: 100,
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('crm_leads', text(created.id))
      await loadCrmData()
    })
  }

  async function handleCreateCrmOpportunity() {
    if (!selectedBizId || !hasActiveActorToken || !crmOpportunityForm.crmPipelineId || !crmOpportunityForm.crmPipelineStageId || !crmOpportunityForm.title) return
    await safeRun('Create CRM opportunity', async () => {
      const created = (await studioApi.createCrmOpportunity(
        selectedBizId,
        {
          crmPipelineId: crmOpportunityForm.crmPipelineId,
          crmPipelineStageId: crmOpportunityForm.crmPipelineStageId,
          title: crmOpportunityForm.title,
          status: 'open',
          estimatedAmountMinor: crmOpportunityForm.estimatedAmountMinor,
          committedAmountMinor: 0,
          weightedAmountMinor: 0,
          probabilityBps: 4000,
          currency: 'USD',
          ownerUserId: activeActorId || undefined,
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('crm_opportunities', text(created.id))
      await loadCrmData()
    })
  }

  async function handleLoadCrmContactSummary() {
    if (!selectedBizId || !selectedCrmContactId) return
    await safeRun('Load CRM contact summary', async () => {
      const data = await studioApi.getCrmContactSummary(selectedBizId, selectedCrmContactId, activeActorToken)
      setCrmContactSummary(data)
    })
  }

  async function handleCreateChannelAccount() {
    if (!selectedBizId || !hasActiveActorToken || !channelAccountForm.name) return
    await safeRun('Create channel account', async () => {
      const created = (await studioApi.createChannelAccount(
        selectedBizId,
        {
          provider: channelAccountForm.provider,
          name: channelAccountForm.name,
          status: 'active',
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('channel_accounts', text(created.id))
      await loadChannelData()
    })
  }

  async function handleUpsertChannelSyncState() {
    if (!selectedBizId || !hasActiveActorToken || !channelSyncForm.channelAccountId) return
    await safeRun('Upsert channel sync state', async () => {
      const created = (await studioApi.upsertChannelSyncState(
        selectedBizId,
        {
          channelAccountId: channelSyncForm.channelAccountId,
          objectType: channelSyncForm.objectType,
          direction: channelSyncForm.direction,
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('channel_sync_states', text(created.id))
      await loadChannelData()
    })
  }

  async function handleCreateChannelEntityLink() {
    if (!selectedBizId || !hasActiveActorToken || !channelEntityLinkForm.channelAccountId || !channelEntityLinkForm.externalObjectId) return
    await safeRun('Create channel entity link', async () => {
      const body: JsonMap = {
        channelAccountId: channelEntityLinkForm.channelAccountId,
        objectType: channelEntityLinkForm.objectType,
        externalObjectId: channelEntityLinkForm.externalObjectId,
      }
      if (channelEntityLinkForm.objectType === 'booking_order' && channelEntityLinkForm.bookingOrderId) {
        body.bookingOrderId = channelEntityLinkForm.bookingOrderId
      }
      if (channelEntityLinkForm.objectType === 'custom') {
        body.localReferenceKey = `ops-${Date.now()}`
      }
      const created = (await studioApi.createChannelEntityLink(selectedBizId, body, activeActorToken)) as JsonMap
      registerSandboxEntity('channel_entity_links', text(created.id))
      await loadChannelData()
    })
  }

  async function handleLoadComplianceControls() {
    if (!selectedBizId) return
    await safeRun('Load compliance controls', async () => {
      const data = await studioApi.getComplianceControls(selectedBizId, activeActorToken)
      setComplianceControls(data)
    })
  }

  async function handleLoadComplianceGate() {
    if (!selectedBizId || !complianceForm.bookingOrderId) return
    await safeRun('Load compliance gate', async () => {
      const data = await studioApi.getBookingComplianceGate(selectedBizId, complianceForm.bookingOrderId, activeActorToken)
      setComplianceGate(data)
    })
  }

  async function handleCreateComplianceConsent() {
    if (!selectedBizId || !hasActiveActorToken || !complianceForm.bookingOrderId || !complianceForm.participantUserId || !complianceForm.policyTemplateId) return
    await safeRun('Create compliance consent', async () => {
      await studioApi.createComplianceConsent(
        selectedBizId,
        complianceForm.bookingOrderId,
        {
          participantUserId: complianceForm.participantUserId,
          policyTemplateId: complianceForm.policyTemplateId,
          signatureRole: 'self',
          stage: 'booking',
        },
        activeActorToken,
      )
      await handleLoadComplianceGate()
    })
  }

  async function ensureActorByRole(role: ActorRole, displayNamePrefix: string): Promise<StudioActorUser> {
    const existing = actors.find((actor) => actor.role === role)
    if (existing) {
      registerSandboxActor(existing.id)
      return existing
    }
    const stamp = Date.now().toString(36)
    const created = await studioApi.createImpersonationUser({
      email: `${slugify(displayNamePrefix)}.${role}.${stamp}@example.test`,
      name: `${displayNamePrefix} ${role} ${stamp}`,
      role,
    })
    const user = created.user
    registerSandboxActor(user.id)
    setActors((prev) => [...prev, user])
    return user
  }

  async function issueActorTokenForBiz(input: {
    user: StudioActorUser
    bizId?: string
    membershipRole?: ActorRole
  }): Promise<StudioActorToken> {
    const issued = await studioApi.issueImpersonationToken({
      targetUserId: input.user.id,
      bizId: input.bizId,
      ensureMembership: Boolean(input.bizId),
      membershipRole: input.membershipRole ?? 'customer',
      scopes: ['*'],
      ttlSeconds: 12 * 60 * 60,
      label: `studio-${input.user.role}-${Date.now().toString(36)}`,
    })
    let base = actorTokenMap
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('bizing_ops_actor_tokens')
        if (raw) base = { ...base, ...(JSON.parse(raw) as Record<string, StudioActorToken>) }
      } catch {
        base = actorTokenMap
      }
    }
    const next = { ...base, [input.user.id]: issued }
    saveTokenMap(next)
    return issued
  }

  async function runMacro(
    name: string,
    runner: (log: (step: string, detail?: string) => void) => Promise<void>,
  ) {
    const localSteps: MacroStep[] = []
    const log = (step: string, detail?: string) => {
      localSteps.push({ at: new Date().toISOString(), status: 'ok', step, detail })
      setMacroSteps([...localSteps])
    }
    setMacroName(name)
    setMacroSteps([])
    await safeRun(`Macro: ${name}`, async () => {
      await runner(log)
      log('Macro completed')
    })
  }

  async function runMacroFullServiceLifecycle() {
    await runMacro('Full service lifecycle', async (log) => {
      const owner = await ensureActorByRole('owner', 'Studio Owner')
      setActiveActorId(owner.id)
      const ownerTokenNoBiz = await issueActorTokenForBiz({ user: owner })
      log('Owner actor ready', owner.email)

      const stamp = Date.now().toString(36)
      const biz = (await studioApi.createBiz(
        {
          name: `Studio Biz ${stamp}`,
          slug: `studio-biz-${stamp}`,
          type: 'small_business',
          timezone: 'America/Los_Angeles',
          currency: 'USD',
        },
        ownerTokenNoBiz.accessToken,
      )) as JsonMap
      const bizId = text(biz.id)
      registerSandboxEntity('bizes', bizId)
      setSandboxSelectedBiz(bizId)
      setSelectedBizId(bizId)
      log('Biz created', bizId)

      const ownerToken = await issueActorTokenForBiz({ user: owner, bizId, membershipRole: 'owner' })

      const location = (await studioApi.createLocation(
        bizId,
        {
          name: `HQ ${stamp}`,
          slug: `hq-${stamp}`,
          type: 'physical',
          timezone: 'America/Los_Angeles',
          status: 'active',
        },
        ownerToken.accessToken,
      )) as JsonMap
      registerSandboxEntity('locations', text(location.id))
      log('Location created', text(location.id))

      const resource = (await studioApi.createResource(
        bizId,
        {
          locationId: text(location.id),
          type: 'host',
          name: `Host ${stamp}`,
          slug: `host-${stamp}`,
          timezone: 'America/Los_Angeles',
          allowSimultaneousBookings: false,
          capacity: 1,
          bufferBeforeMinutes: 5,
          bufferAfterMinutes: 5,
        },
        ownerToken.accessToken,
      )) as JsonMap
      registerSandboxEntity('resources', text(resource.id))
      log('Host resource created', text(resource.id))

      const calendar = (await studioApi.createCalendar(
        bizId,
        {
          name: `Main Calendar ${stamp}`,
          timezone: 'America/Los_Angeles',
          slotDurationMin: 60,
          slotIntervalMin: 30,
          defaultMode: 'available_by_default',
          status: 'active',
        },
        ownerToken.accessToken,
      )) as JsonMap
      registerSandboxEntity('calendars', text(calendar.id))
      log('Calendar created', text(calendar.id))

      const serviceGroup = (await studioApi.createServiceGroup(
        bizId,
        {
          name: `Core Services ${stamp}`,
          slug: `core-services-${stamp}`,
          status: 'active',
        },
        ownerToken.accessToken,
      )) as JsonMap
      registerSandboxEntity('service_groups', text(serviceGroup.id))
      log('Service group created', text(serviceGroup.id))

      const offer = (await studioApi.createOffer(
        bizId,
        {
          serviceGroupId: text(serviceGroup.id),
          name: `Primary Offer ${stamp}`,
          slug: `primary-offer-${stamp}`,
          executionMode: 'slot',
          timezone: 'America/Los_Angeles',
          status: 'active',
          isPublished: false,
        },
        ownerToken.accessToken,
      )) as JsonMap
      registerSandboxEntity('offers', text(offer.id))
      log('Offer created', text(offer.id))

      const offerVersion = (await studioApi.createOfferVersion(
        bizId,
        text(offer.id),
        {
          version: 1,
          status: 'published',
          durationMode: 'fixed',
          defaultDurationMin: 60,
          durationStepMin: 15,
          basePriceMinor: 15000,
          currency: 'USD',
        },
        ownerToken.accessToken,
      )) as JsonMap
      registerSandboxEntity('offer_versions', text(offerVersion.id))
      await studioApi.patchOffer(bizId, text(offer.id), { isPublished: true, status: 'active' }, ownerToken.accessToken)
      log('Offer version created + offer published', text(offerVersion.id))

      const binding = (await studioApi.createCalendarBinding(
        bizId,
        {
          calendarId: text(calendar.id),
          ownerType: 'offer',
          offerId: text(offer.id),
          isPrimary: true,
          isActive: true,
        },
        ownerToken.accessToken,
      )) as JsonMap
      registerSandboxEntity('calendar_bindings', text(binding.id))
      log('Calendar binding created for offer')

      const customer = await ensureActorByRole('customer', 'Studio Customer')
      const customerToken = await issueActorTokenForBiz({
        user: customer,
        bizId,
        membershipRole: 'customer',
      })
      setActiveActorId(customer.id)
      log('Customer actor ready', customer.email)

      const availability = (await studioApi.getPublicOfferAvailability(bizId, text(offer.id), 12)) as JsonMap
      const resolvedOfferVersionId = text(availability.offerVersionId, text(offerVersion.id))
      log('Availability loaded', resolvedOfferVersionId || 'no-offer-version-id')

      const booking = (await studioApi.createPublicBooking(
        bizId,
        {
          offerId: text(offer.id),
          offerVersionId: resolvedOfferVersionId,
          status: 'awaiting_payment',
          currency: 'USD',
          subtotalMinor: 15000,
          totalMinor: 15000,
          taxMinor: 0,
          feeMinor: 0,
          discountMinor: 0,
          requestedStartAt: isoAfterMinutes(180),
          requestedEndAt: isoAfterMinutes(240),
        },
        customerToken.accessToken,
      )) as JsonMap
      registerSandboxEntity('booking_orders', text(booking.id))
      log('Booking created', text(booking.id))

      const totalMinor = numberValue(booking.totalMinor, 15000)
      await studioApi.payPublicBookingAdvanced(
        bizId,
        text(booking.id),
        {
          currency: text(booking.currency, 'USD'),
          tipMinor: 0,
          tenders: [{ methodType: 'card', allocatedMinor: totalMinor, provider: 'stripe', label: 'Card' }],
        },
        customerToken.accessToken,
      )
      log('Advanced payment posted')

      const [messages, payments] = await Promise.all([
        studioApi.listOutboundMessages(bizId, { bookingOrderId: text(booking.id) }, ownerToken.accessToken),
        studioApi.listPaymentIntents(bizId, ownerToken.accessToken),
      ])
      log('Lifecycle evidence fetched', `messages=${asArray(messages).length}, paymentIntents=${asArray(payments).length}`)

      setSelectedBizId(bizId)
      setActiveActorId(owner.id)
      await Promise.all([
        loadBizScopedData({ bizId, token: ownerToken.accessToken }),
        loadQueueAndWorkflowData({ bizId, token: ownerToken.accessToken }),
        loadDispatchData({ bizId, token: ownerToken.accessToken }),
        loadMembershipData({ bizId, token: ownerToken.accessToken }),
        loadCrmData({ bizId, token: ownerToken.accessToken }),
        loadChannelData({ bizId, token: ownerToken.accessToken }),
      ])
    })
  }

  async function runMacroOpsControlTower() {
    await runMacro('Ops control tower', async (log) => {
      if (!selectedBizId || !activeActorToken) throw new Error('Select a biz and actor token before running this macro.')
      const stamp = Date.now().toString(36)
      const queue = (await studioApi.createQueue(
        selectedBizId,
        { name: `Walk-ins ${stamp}`, slug: `walk-ins-${stamp}`, strategy: 'fifo', status: 'active', isSelfJoinEnabled: true },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('queues', text(queue.id))
      log('Queue created', text(queue.id))

      if (activeActorId) {
        const entry = (await studioApi.createQueueEntry(
          selectedBizId,
          text(queue.id),
          { customerUserId: activeActorId, priorityScore: 0 },
          activeActorToken,
        )) as JsonMap
        registerSandboxEntity('queue_entries', text(entry.id))
        await studioApi.offerNextQueueEntry(selectedBizId, text(queue.id), { offerTtlMinutes: 15 }, activeActorToken)
        log('Queue entry added and offered')
      }

      const reviewQueue = (await studioApi.createReviewQueue(
        selectedBizId,
        { name: `Manual Review ${stamp}`, slug: `manual-review-${stamp}`, type: 'manual_approval', status: 'active' },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('review_queues', text(reviewQueue.id))
      const reviewItem = (await studioApi.createReviewQueueItem(
        selectedBizId,
        {
          reviewQueueId: text(reviewQueue.id),
          itemType: 'ops_check',
          itemRefId: `ops-${stamp}`,
          status: 'pending',
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('review_queue_items', text(reviewItem.id))
      log('Review queue and item created')

      const route = (await studioApi.createDispatchRoute(
        selectedBizId,
        { name: `Route ${stamp}`, slug: `route-${stamp}`, timezone: 'America/Los_Angeles', status: 'active', policy: {} },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('dispatch_routes', text(route.id))
      const trip = (await studioApi.createDispatchTrip(
        selectedBizId,
        {
          routeId: text(route.id),
          departureAt: isoAfterMinutes(300),
          arrivalAt: isoAfterMinutes(360),
          capacitySeats: 6,
          overbookSeats: 0,
          status: 'planned',
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('dispatch_trips', text(trip.id))
      const task = (await studioApi.createDispatchTask(
        selectedBizId,
        { tripId: text(trip.id), title: `Prep van ${stamp}`, status: 'queued' },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('dispatch_tasks', text(task.id))
      await studioApi.getDispatchState(selectedBizId, activeActorToken)
      log('Dispatch route/trip/task created and state fetched')

      await loadQueueAndWorkflowData()
      await loadDispatchData()
    })
  }

  async function runMacroRevenueAndGrowth() {
    await runMacro('Revenue and growth stack', async (log) => {
      if (!selectedBizId || !activeActorToken || !activeActorId) throw new Error('Select a biz and active actor token before running this macro.')
      const stamp = Date.now().toString(36)

      const plan = (await studioApi.createMembershipPlan(
        selectedBizId,
        {
          name: `Gold Plan ${stamp}`,
          slug: `gold-plan-${stamp}`,
          status: 'active',
          billingIntervalCount: 1,
          billingIntervalUnit: 'month',
          priceMinor: 12000,
          currency: 'USD',
          entitlementType: 'credit',
          entitlementQuantityPerCycle: 4,
          allowRollover: false,
          allowTransfers: true,
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('membership_plans', text(plan.id))
      const membership = (await studioApi.createMembership(
        selectedBizId,
        {
          membershipPlanId: text(plan.id),
          ownerUserId: activeActorId,
          status: 'active',
          startsAt: isoAfterMinutes(1),
          currentPeriodStartAt: isoAfterMinutes(1),
          currentPeriodEndAt: isoAfterMinutes(60 * 24 * 30),
          autoRenew: true,
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('memberships', text(membership.id))
      log('Membership plan and membership created')

      const wallet = (await studioApi.createEntitlementWallet(
        selectedBizId,
        {
          ownerUserId: activeActorId,
          name: `Credits ${stamp}`,
          entitlementType: 'credit',
          unitCode: 'credits',
          balanceQuantity: 0,
          isActive: true,
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('entitlement_wallets', text(wallet.id))
      const grant = (await studioApi.createEntitlementGrant(
        selectedBizId,
        { walletId: text(wallet.id), grantType: 'credit', quantity: 3, validFromAt: new Date().toISOString() },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('entitlement_grants', text(grant.id))
      await studioApi.consumeEntitlementWallet(
        selectedBizId,
        text(wallet.id),
        { quantity: 1, reasonCode: 'macro-consume' },
        activeActorToken,
      )
      log('Wallet grant and consume completed')

      const pipeline = (await studioApi.createCrmPipeline(
        selectedBizId,
        { name: `Pipeline ${stamp}`, slug: `pipeline-${stamp}`, status: 'active', pipelineType: 'opportunity' },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('crm_pipelines', text(pipeline.id))
      const stage = (await studioApi.createCrmPipelineStage(
        selectedBizId,
        text(pipeline.id),
        { name: `Qualified ${stamp}`, slug: `qualified-${stamp}`, status: 'active', sortOrder: 100, defaultProbabilityBps: 5000 },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('crm_pipeline_stages', text(stage.id))
      const contact = (await studioApi.createCrmContact(
        selectedBizId,
        {
          status: 'active',
          contactType: 'external',
          externalContactRef: `external-${stamp}`,
          displayName: `Prospect ${stamp}`,
          email: `prospect.${stamp}@example.test`,
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('crm_contacts', text(contact.id))
      const lead = (await studioApi.createCrmLead(
        selectedBizId,
        { crmContactId: text(contact.id), sourceType: 'studio', status: 'new', scoreBps: 3000, priority: 120 },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('crm_leads', text(lead.id))
      const opportunity = (await studioApi.createCrmOpportunity(
        selectedBizId,
        {
          crmPipelineId: text(pipeline.id),
          crmPipelineStageId: text(stage.id),
          title: `Opportunity ${stamp}`,
          status: 'open',
          estimatedAmountMinor: 20000,
          committedAmountMinor: 0,
          weightedAmountMinor: 0,
          probabilityBps: 5000,
          currency: 'USD',
        },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('crm_opportunities', text(opportunity.id))
      log('CRM contact/lead/opportunity created')

      const channelAccount = (await studioApi.createChannelAccount(
        selectedBizId,
        { provider: 'google_reserve', name: `Google Reserve ${stamp}`, status: 'active' },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('channel_accounts', text(channelAccount.id))
      const syncState = (await studioApi.upsertChannelSyncState(
        selectedBizId,
        { channelAccountId: text(channelAccount.id), objectType: 'booking_order', direction: 'bidirectional' },
        activeActorToken,
      )) as JsonMap
      registerSandboxEntity('channel_sync_states', text(syncState.id))
      log('Channel account and sync state configured')

      await studioApi.getComplianceControls(selectedBizId, activeActorToken)
      log('Compliance controls snapshot checked')

      await Promise.all([loadMembershipData(), loadCrmData(), loadChannelData(), handleLoadComplianceControls()])
    })
  }

  async function runMacroFullSuite() {
    await runMacroFullServiceLifecycle()
    await runMacroOpsControlTower()
    await runMacroRevenueAndGrowth()
  }

  const timelineSrc = timeline && typeof timeline === 'object' ? (timeline as JsonMap) : { value: timeline }
  const paymentDetailSrc =
    paymentIntentDetail && typeof paymentIntentDetail === 'object'
      ? (paymentIntentDetail as JsonMap)
      : { value: paymentIntentDetail }
  const availabilitySrc =
    publicAvailability && typeof publicAvailability === 'object'
      ? (publicAvailability as JsonMap)
      : { value: publicAvailability }
  const dispatchStateSrc =
    dispatchState && typeof dispatchState === 'object' ? (dispatchState as JsonMap) : { value: dispatchState }
  const crmContactSummarySrc =
    crmContactSummary && typeof crmContactSummary === 'object'
      ? (crmContactSummary as JsonMap)
      : { value: crmContactSummary }
  const channelInsightsSrc =
    channelInsights && typeof channelInsights === 'object'
      ? (channelInsights as JsonMap)
      : { value: channelInsights }
  const complianceControlsSrc =
    complianceControls && typeof complianceControls === 'object'
      ? (complianceControls as JsonMap)
      : { value: complianceControls }
  const complianceGateSrc =
    complianceGate && typeof complianceGate === 'object' ? (complianceGate as JsonMap) : { value: complianceGate }
  const selectedTrace = apiTraces[selectedTraceIndex] ?? null
  const timelineObject = timeline && typeof timeline === 'object' ? (timeline as JsonMap) : null
  const timelineWindow = (timelineObject?.window as JsonMap | undefined) ?? null
  const timelineSummary = (timelineObject?.summary as JsonMap | undefined) ?? null
  const timelineBookings = asArray(timelineObject?.bookings)
  const timelineHolds = asArray(timelineObject?.holds)
  const timelineRules = asArray(timelineObject?.rules)
  const timelineEvents = useMemo(() => {
    const bookingEvents = timelineBookings.map((row) => ({
      kind: 'booking',
      id: text(row.id),
      status: text(row.status, 'unknown'),
      startAt: text(row.confirmedStartAt, text(row.requestedStartAt)),
      endAt: text(row.confirmedEndAt, text(row.requestedEndAt)),
      resourceId: rowRef(row, 'resourceId'),
      locationId: rowRef(row, 'locationId'),
      serviceId: rowRef(row, 'serviceId'),
      offerId: text(row.offerId),
    }))
    const holdEvents = timelineHolds.map((row) => ({
      kind: 'hold',
      id: text(row.id),
      status: text(row.status, 'active'),
      startAt: text(row.startsAt),
      endAt: text(row.endsAt),
      resourceId: rowRef(row, 'resourceId'),
      locationId: rowRef(row, 'locationId'),
      serviceId: rowRef(row, 'serviceId'),
      offerId: rowRef(row, 'offerId'),
    }))
    return [...bookingEvents, ...holdEvents]
      .filter((row) => {
        if (calendarLensType === 'all') return true
        if (!calendarLensId) return true
        if (calendarLensType === 'resource') return row.resourceId === calendarLensId
        if (calendarLensType === 'location') return row.locationId === calendarLensId
        if (calendarLensType === 'service') return row.serviceId === calendarLensId
        if (calendarLensType === 'offer') return row.offerId === calendarLensId
        return true
      })
      .sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)))
  }, [timelineBookings, timelineHolds, calendarLensId, calendarLensType])
  const timelineResourceOptions = resources.map((row) => ({ id: text(row.id), name: text(row.name, text(row.id)) }))
  const timelineLocationOptions = locations.map((row) => ({ id: text(row.id), name: text(row.name, text(row.id)) }))
  const timelineServiceOptions = services.map((row) => ({ id: text(row.id), name: text(row.name, text(row.id)) }))
  const timelineOfferOptions = offers.map((row) => ({ id: text(row.id), name: text(row.name, text(row.id)) }))
  const timelineLensOptions =
    calendarLensType === 'resource'
      ? timelineResourceOptions
      : calendarLensType === 'location'
        ? timelineLocationOptions
        : calendarLensType === 'service'
          ? timelineServiceOptions
          : timelineOfferOptions

  return (
    <div className="flex flex-1 flex-col">
      <PageIntro
        eyebrow="Operations Studio"
        title="Real lifecycle test UI"
        description="Run owner/member/customer journeys with actor impersonation, calendar setup, offer publishing, booking, payments, and outbound messages."
        actions={
          <Button variant="outline" asChild>
            <Link href="/ooda/lab">Open endpoint workbench</Link>
          </Button>
        }
      />
      <TooltipProvider delayDuration={150}>
        <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Active actor</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{activeActor?.name ?? 'none'}</p>
              <p className="text-xs text-muted-foreground">{activeActor?.email ?? 'Select/create an actor'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Selected biz</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{selectedBizId || 'none'}</p>
              <p className="text-xs text-muted-foreground">{bizes.length} bizes visible to actor</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Runtime</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-xs text-muted-foreground">{busy ? `Running: ${busy}` : 'Idle'}</p>
              {success ? (
                <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {success}
                </p>
              ) : null}
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sandbox loop context</CardTitle>
            <CardDescription>
              Isolated testing workspaces. Each sandbox keeps its own actors, created entities, and selected biz context.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-5">
            <div className="space-y-1">
              <FieldTitle label="Active sandbox" help="Switch to another isolated workspace. Only entities registered in this sandbox are shown." />
              <Select value={activeSandboxId} onValueChange={setActiveSandboxId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sandbox loop" />
                </SelectTrigger>
                <SelectContent>
                  {sandboxes.map((sandbox) => (
                    <SelectItem key={text(sandbox.id)} value={text(sandbox.id)}>
                      {text(sandbox.title, text(sandbox.id))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <FieldTitle label="New sandbox title" help="Creates a fresh loop context for one scenario run or experiment." />
              <Input
                placeholder="Ex: Haircut flow sandbox"
                value={newSandboxTitle}
                onChange={(event) => setNewSandboxTitle(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <FieldTitle label="Seed users count" help="Creates owner/customer/staff/host-style users in this sandbox for quick setup." />
              <Input
                type="number"
                min={1}
                max={20}
                value={seedUserCount}
                onChange={(event) => setSeedUserCount(Math.max(1, Math.min(20, Number(event.target.value || 3))))}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => void handleCreateSandbox()} disabled={Boolean(busy) || !newSandboxTitle.trim()}>
                Create sandbox
              </Button>
              <Button variant="outline" onClick={() => void handleSeedSandboxUsers()} disabled={Boolean(busy) || !activeSandboxId}>
                Seed users
              </Button>
            </div>
          </CardContent>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">Actors in sandbox</p>
              <p className="text-xs text-muted-foreground">{activeSandboxId ? (sandboxRegistry[activeSandboxId]?.actorIds ?? []).length : 0}</p>
            </div>
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">Entity kinds tracked</p>
              <p className="text-xs text-muted-foreground">{activeSandboxId ? Object.keys(sandboxRegistry[activeSandboxId]?.entities ?? {}).length : 0}</p>
            </div>
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">Active sandbox objective</p>
              <p className="text-xs text-muted-foreground">{text((activeSandbox?.objective as string) ?? '', 'Ops Studio sandbox context')}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Context navigator</CardTitle>
            <CardDescription>Switch quickly between bizes, locations, resources, services, and offers in the current sandbox.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <FieldTitle label="Bizes" />
              <ScrollArea className="h-40 rounded-md border">
                <div className="space-y-1 p-2">
                  {bizes.length === 0 ? <p className="text-xs text-muted-foreground">No bizes in this sandbox.</p> : null}
                  {bizes.map((biz) => {
                    const id = text(biz.id)
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`w-full rounded-md border px-2 py-1 text-left text-xs ${selectedBizId === id ? 'border-primary bg-primary/10' : 'hover:bg-muted'}`}
                        onClick={() => {
                          setSelectedBizId(id)
                          setSandboxSelectedBiz(id)
                        }}
                      >
                        {text(biz.name, id)}
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>
            <div className="space-y-2">
              <FieldTitle label="Locations" />
              <ScrollArea className="h-40 rounded-md border">
                <div className="space-y-1 p-2">
                  {locations.map((location) => {
                    const id = text(location.id)
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`w-full rounded-md border px-2 py-1 text-left text-xs ${createResourceForm.locationId === id ? 'border-primary bg-primary/10' : 'hover:bg-muted'}`}
                        onClick={() => {
                          setCreateResourceForm((v) => ({ ...v, locationId: id }))
                          setQueueForm((v) => ({ ...v, locationId: id }))
                          setCreateBindingForm((v) => ({ ...v, locationId: id, ownerType: 'location' }))
                        }}
                      >
                        {text(location.name, id)}
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>
            <div className="space-y-2">
              <FieldTitle label="Resources" />
              <ScrollArea className="h-40 rounded-md border">
                <div className="space-y-1 p-2">
                  {resources.map((resource) => {
                    const id = text(resource.id)
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`w-full rounded-md border px-2 py-1 text-left text-xs ${createBindingForm.resourceId === id ? 'border-primary bg-primary/10' : 'hover:bg-muted'}`}
                        onClick={() => setCreateBindingForm((v) => ({ ...v, ownerType: 'resource', resourceId: id }))}
                      >
                        {text(resource.name, id)}
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>
            <div className="space-y-2">
              <FieldTitle label="Services" />
              <ScrollArea className="h-40 rounded-md border">
                <div className="space-y-1 p-2">
                  {services.map((service) => {
                    const id = text(service.id)
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`w-full rounded-md border px-2 py-1 text-left text-xs ${createBindingForm.serviceId === id ? 'border-primary bg-primary/10' : 'hover:bg-muted'}`}
                        onClick={() => {
                          setCreateBindingForm((v) => ({ ...v, ownerType: 'service', serviceId: id }))
                          setCreateServiceProductForm((v) => ({ ...v, name: v.name || `${text(service.name, id)} product` }))
                        }}
                      >
                        {text(service.name, id)}
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>
            <div className="space-y-2">
              <FieldTitle label="Offers" />
              <ScrollArea className="h-40 rounded-md border">
                <div className="space-y-1 p-2">
                  {offers.map((offer) => {
                    const id = text(offer.id)
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`w-full rounded-md border px-2 py-1 text-left text-xs ${customerFlow.offerId === id ? 'border-primary bg-primary/10' : 'hover:bg-muted'}`}
                        onClick={() => {
                          setCustomerFlow((v) => ({ ...v, offerId: id }))
                          setCreateOfferVersionForm((v) => ({ ...v, offerId: id }))
                          setCreateBindingForm((v) => ({ ...v, ownerType: 'offer', offerId: id }))
                        }}
                      >
                        {text(offer.name, id)}
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scenario macros</CardTitle>
            <CardDescription>
              One-click lifecycle scenarios that execute real API calls and leave this screen preloaded with evidence.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={() => void runMacroFullServiceLifecycle()} disabled={Boolean(busy)}>
              Run full service lifecycle
            </Button>
            <Button variant="outline" onClick={() => void runMacroOpsControlTower()} disabled={Boolean(busy)}>
              Run ops control tower
            </Button>
            <Button variant="outline" onClick={() => void runMacroRevenueAndGrowth()} disabled={Boolean(busy)}>
              Run revenue + growth stack
            </Button>
            <Button variant="secondary" onClick={() => void runMacroFullSuite()} disabled={Boolean(busy)}>
              Run full suite
            </Button>
          </CardContent>
          <CardContent className="space-y-2">
            <p className="text-sm font-medium">{macroName ? `Last macro: ${macroName}` : 'No macro run yet.'}</p>
            <div className="max-h-56 overflow-auto rounded-md border">
              {macroSteps.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">Run a macro to see step-by-step execution logs.</p>
              ) : (
                <div className="divide-y">
                  {macroSteps.map((step, index) => (
                    <div key={`${step.at}-${index}`} className="p-2 text-xs">
                      <p className={step.status === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                        {step.status.toUpperCase()} • {step.step}
                      </p>
                      {step.detail ? <p className="text-muted-foreground">{step.detail}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="actors" className="w-full">
          <TabsList className="flex w-full flex-wrap justify-start">
            <TabsTrigger value="actors">Actors</TabsTrigger>
            <TabsTrigger value="setup">Biz Setup</TabsTrigger>
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
            <TabsTrigger value="calendars">Calendars</TabsTrigger>
            <TabsTrigger value="customer">Customer Booking</TabsTrigger>
            <TabsTrigger value="payments">Payments + Messages</TabsTrigger>
            <TabsTrigger value="operations">Queues + Workflows + Dispatch</TabsTrigger>
            <TabsTrigger value="memberships">Memberships + Entitlements</TabsTrigger>
            <TabsTrigger value="crm">CRM</TabsTrigger>
            <TabsTrigger value="integrations">Channels</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>

          <TabsContent value="actors" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Create actor</CardTitle>
                <CardDescription>Create test users for owner/member/customer role simulation.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <div className="space-y-1">
                  <FieldTitle label="Email" help="Sign-in identifier for this simulated actor." />
                  <Input
                    placeholder="sarah@example.test"
                    value={createActorForm.email}
                    onChange={(event) => setCreateActorForm((v) => ({ ...v, email: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <FieldTitle label="Name" help="Display name shown in booking/messaging flows." />
                  <Input
                    placeholder="Sarah"
                    value={createActorForm.name}
                    onChange={(event) => {
                      const name = event.target.value
                      setCreateActorForm((v) => {
                        if (v.email || !name) return { ...v, name }
                        const base = slugify(name).replace(/-/g, '.')
                        return { ...v, name, email: `${base}@example.test` }
                      })
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <FieldTitle label="Role" help="Default access role for this actor in sandbox simulations." />
                  <Select
                    value={createActorForm.role}
                    onValueChange={(value) =>
                      setCreateActorForm((v) => ({ ...v, role: value as typeof createActorForm.role }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['owner', 'admin', 'manager', 'staff', 'host', 'customer'].map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => void handleCreateActor()} disabled={Boolean(busy)}>
                  {busy === 'Create actor' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create actor
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Actor list + impersonation</CardTitle>
                <CardDescription>Mint short-lived bearer tokens and switch context without logging out.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {actors.map((actor) => (
                  <div key={actor.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                    <div>
                      <p className="font-medium">{actor.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {actor.email} • {actor.role}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {actorTokenMap[actor.id] ? 'token ready' : 'no token'}
                      </span>
                      <Button size="sm" variant={activeActorId === actor.id ? 'default' : 'outline'} onClick={() => setActiveActorId(actor.id)}>
                        Use
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void handleIssueToken(actor.id)}>
                        Mint token
                      </Button>
                    </div>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => void safeRun('Reload actors', loadActors)}>
                  Reload actors
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="setup" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Biz bootstrap</CardTitle>
                <CardDescription>Create biz and location as the active actor.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-5">
                <div className="space-y-1">
                  <FieldTitle label="Biz name" />
                  <Input
                    placeholder="Sarah Career Coaching"
                    value={createBizForm.name}
                    onChange={(event) => {
                      const name = event.target.value
                      setCreateBizForm((v) => ({ ...v, name, slug: slugify(name) }))
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <FieldTitle label="Slug" help="Human-readable ID used in URLs and external references." />
                  <Input
                    placeholder="sarah-career-coaching"
                    value={createBizForm.slug}
                    onChange={(event) => setCreateBizForm((v) => ({ ...v, slug: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <FieldTitle label="Timezone" />
                  <Input
                    placeholder="America/Los_Angeles"
                    value={createBizForm.timezone}
                    onChange={(event) => setCreateBizForm((v) => ({ ...v, timezone: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <FieldTitle label="Currency" />
                  <Input
                    placeholder="USD"
                    value={createBizForm.currency}
                    onChange={(event) => setCreateBizForm((v) => ({ ...v, currency: event.target.value.toUpperCase() }))}
                  />
                </div>
                <Button onClick={() => void handleCreateBiz()} disabled={!hasActiveActorToken || Boolean(busy)}>
                  Create biz
                </Button>
              </CardContent>
              <CardContent>
                <FieldTitle label="Selected biz" help="All create/list operations are scoped to this biz." />
                <Select
                  value={selectedBizId}
                  onValueChange={(value) => {
                    setSelectedBizId(value)
                    setSandboxSelectedBiz(value)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a biz visible to active actor" />
                  </SelectTrigger>
                  <SelectContent>
                    {bizes.map((biz) => (
                      <SelectItem key={text(biz.id)} value={text(biz.id)}>
                        {text(biz.name, text(biz.id))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Locations and resources</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <div className="space-y-1">
                  <FieldTitle label="Location name" />
                  <Input
                    placeholder="Main Office"
                    value={createLocationForm.name}
                    onChange={(event) => {
                      const name = event.target.value
                      setCreateLocationForm((v) => ({ ...v, name, slug: slugify(name) }))
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <FieldTitle label="Location slug" />
                  <Input
                    placeholder="main-office"
                    value={createLocationForm.slug}
                    onChange={(event) => setCreateLocationForm((v) => ({ ...v, slug: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <FieldTitle label="Location type" />
                  <Select value={createLocationForm.type} onValueChange={(value) => setCreateLocationForm((v) => ({ ...v, type: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['physical', 'virtual', 'mobile', 'hybrid'].map((value) => (
                        <SelectItem key={value} value={value}>{value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => void handleCreateLocation()} disabled={!selectedBizId || !hasActiveActorToken || Boolean(busy)}>
                  Create location
                </Button>
              </CardContent>
              <CardContent className="grid gap-3 md:grid-cols-5">
                <div className="space-y-1">
                  <FieldTitle label="Resource name" />
                  <Input
                    placeholder="Sarah (Host)"
                    value={createResourceForm.name}
                    onChange={(event) => {
                      const name = event.target.value
                      setCreateResourceForm((v) => ({ ...v, name, slug: slugify(name) }))
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <FieldTitle label="Resource slug" />
                  <Input
                    placeholder="sarah-host"
                    value={createResourceForm.slug}
                    onChange={(event) => setCreateResourceForm((v) => ({ ...v, slug: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <FieldTitle label="Resource type" />
                  <Select value={createResourceForm.type} onValueChange={(value) => setCreateResourceForm((v) => ({ ...v, type: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['host', 'company_host', 'asset', 'venue'].map((value) => (
                        <SelectItem key={value} value={value}>{value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <FieldTitle label="Location" />
                  <Select value={createResourceForm.locationId} onValueChange={(value) => setCreateResourceForm((v) => ({ ...v, locationId: value }))}>
                    <SelectTrigger><SelectValue placeholder="Location" /></SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={text(location.id)} value={text(location.id)}>
                          {text(location.name, text(location.id))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => void handleCreateResource()} disabled={!selectedBizId || !hasActiveActorToken || Boolean(busy)}>
                  Create resource
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="catalog" className="space-y-4 pt-4">
            <Card>
              <CardHeader><CardTitle>Services and offers</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <Input
                  placeholder="Service group name"
                  value={createServiceGroupForm.name}
                  onChange={(event) => {
                    const name = event.target.value
                    setCreateServiceGroupForm((v) => ({ ...v, name, slug: slugify(name) }))
                  }}
                />
                <Input
                  placeholder="Service group slug"
                  value={createServiceGroupForm.slug}
                  onChange={(event) => setCreateServiceGroupForm((v) => ({ ...v, slug: event.target.value }))}
                />
                <Button onClick={() => void handleCreateServiceGroup()} disabled={!selectedBizId || !hasActiveActorToken || Boolean(busy)}>
                  Create group
                </Button>
              </CardContent>
              <CardContent className="grid gap-3 md:grid-cols-5">
                <Select value={createServiceForm.serviceGroupId} onValueChange={(value) => setCreateServiceForm((v) => ({ ...v, serviceGroupId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Service group" /></SelectTrigger>
                  <SelectContent>
                    {serviceGroups.map((group) => (
                      <SelectItem key={text(group.id)} value={text(group.id)}>
                        {text(group.name, text(group.id))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Service name"
                  value={createServiceForm.name}
                  onChange={(event) => {
                    const name = event.target.value
                    setCreateServiceForm((v) => ({ ...v, name, slug: slugify(name) }))
                  }}
                />
                <Input
                  placeholder="Service slug"
                  value={createServiceForm.slug}
                  onChange={(event) => setCreateServiceForm((v) => ({ ...v, slug: event.target.value }))}
                />
                <Select value={createServiceForm.type} onValueChange={(value) => setCreateServiceForm((v) => ({ ...v, type: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['appointment', 'class', 'rental', 'multi_day', 'call'].map((value) => (
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => void handleCreateService()} disabled={!selectedBizId || !hasActiveActorToken || Boolean(busy)}>
                  Create service
                </Button>
              </CardContent>

              <CardContent className="grid gap-3 md:grid-cols-4">
                <Select value={createOfferForm.serviceGroupId} onValueChange={(value) => setCreateOfferForm((v) => ({ ...v, serviceGroupId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Service group" /></SelectTrigger>
                  <SelectContent>
                    {serviceGroups.map((group) => (
                      <SelectItem key={text(group.id)} value={text(group.id)}>
                        {text(group.name, text(group.id))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Offer name"
                  value={createOfferForm.name}
                  onChange={(event) => {
                    const name = event.target.value
                    setCreateOfferForm((v) => ({ ...v, name, slug: slugify(name) }))
                  }}
                />
                <Input
                  placeholder="Offer slug"
                  value={createOfferForm.slug}
                  onChange={(event) => setCreateOfferForm((v) => ({ ...v, slug: event.target.value }))}
                />
                <Select value={createOfferForm.executionMode} onValueChange={(value) => setCreateOfferForm((v) => ({ ...v, executionMode: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['slot', 'queue', 'request', 'auction', 'async', 'route_trip', 'open_access', 'itinerary'].map((value) => (
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => void handleCreateOffer()} disabled={!selectedBizId || !hasActiveActorToken || Boolean(busy)}>
                  Create offer
                </Button>
              </CardContent>

              <CardContent className="grid gap-3 md:grid-cols-6">
                <Select value={createOfferVersionForm.offerId} onValueChange={(value) => setCreateOfferVersionForm((v) => ({ ...v, offerId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Offer" /></SelectTrigger>
                  <SelectContent>
                    {offers.map((offer) => (
                      <SelectItem key={text(offer.id)} value={text(offer.id)}>
                        {text(offer.name, text(offer.id))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={createOfferVersionForm.version}
                  onChange={(event) => setCreateOfferVersionForm((v) => ({ ...v, version: Number(event.target.value || 1) }))}
                />
                <Input
                  type="number"
                  value={createOfferVersionForm.defaultDurationMin}
                  onChange={(event) => setCreateOfferVersionForm((v) => ({ ...v, defaultDurationMin: Number(event.target.value || 60) }))}
                />
                <Input
                  type="number"
                  value={createOfferVersionForm.basePriceMinor}
                  onChange={(event) => setCreateOfferVersionForm((v) => ({ ...v, basePriceMinor: Number(event.target.value || 0) }))}
                />
                <Input
                  value={createOfferVersionForm.currency}
                  onChange={(event) => setCreateOfferVersionForm((v) => ({ ...v, currency: event.target.value.toUpperCase() }))}
                />
                <Button onClick={() => void handleCreateOfferVersion()} disabled={!selectedBizId || !hasActiveActorToken || Boolean(busy)}>
                  Create + publish version
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Products and service products</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-5">
                <Input
                  placeholder="Product name"
                  value={createProductForm.name}
                  onChange={(event) => {
                    const name = event.target.value
                    setCreateProductForm((v) => ({ ...v, name, slug: slugify(name) }))
                  }}
                />
                <Input
                  placeholder="Product slug"
                  value={createProductForm.slug}
                  onChange={(event) => setCreateProductForm((v) => ({ ...v, slug: event.target.value }))}
                />
                <Select value={createProductForm.type} onValueChange={(value) => setCreateProductForm((v) => ({ ...v, type: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['physical', 'digital', 'service', 'membership', 'pass', 'credit_pack', 'fee', 'other'].map((value) => (
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={createProductForm.basePriceMinor}
                  onChange={(event) => setCreateProductForm((v) => ({ ...v, basePriceMinor: Number(event.target.value || 0) }))}
                />
                <Button onClick={() => void handleCreateProduct()} disabled={!selectedBizId || !hasActiveActorToken || Boolean(busy)}>
                  Create product
                </Button>
              </CardContent>
              <CardContent className="grid gap-3 md:grid-cols-6">
                <Input
                  placeholder="Service product name"
                  value={createServiceProductForm.name}
                  onChange={(event) => {
                    const name = event.target.value
                    setCreateServiceProductForm((v) => ({ ...v, name, slug: slugify(name) }))
                  }}
                />
                <Input
                  placeholder="Service product slug"
                  value={createServiceProductForm.slug}
                  onChange={(event) => setCreateServiceProductForm((v) => ({ ...v, slug: event.target.value }))}
                />
                <Input
                  type="number"
                  value={createServiceProductForm.defaultDurationMinutes}
                  onChange={(event) => setCreateServiceProductForm((v) => ({ ...v, defaultDurationMinutes: Number(event.target.value || 60) }))}
                />
                <Input
                  type="number"
                  value={createServiceProductForm.basePriceAmountMinorUnits}
                  onChange={(event) => setCreateServiceProductForm((v) => ({ ...v, basePriceAmountMinorUnits: Number(event.target.value || 0) }))}
                />
                <Input
                  value={createServiceProductForm.currency}
                  onChange={(event) => setCreateServiceProductForm((v) => ({ ...v, currency: event.target.value.toUpperCase() }))}
                />
                <Button onClick={() => void handleCreateServiceProduct()} disabled={!selectedBizId || !hasActiveActorToken || Boolean(busy)}>
                  Create service product
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendars" className="space-y-4 pt-4">
            <Card>
              <CardHeader><CardTitle>Calendar setup and timeline</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-5">
                <div className="space-y-1">
                  <FieldTitle label="Calendar name" />
                  <Input
                    placeholder="Main calendar"
                    value={createCalendarForm.name}
                    onChange={(event) => setCreateCalendarForm((v) => ({ ...v, name: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <FieldTitle label="Timezone" />
                  <Input
                    placeholder="America/Los_Angeles"
                    value={createCalendarForm.timezone}
                    onChange={(event) => setCreateCalendarForm((v) => ({ ...v, timezone: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <FieldTitle label="Slot duration (min)" />
                  <Input
                    type="number"
                    placeholder="30"
                    value={createCalendarForm.slotDurationMin}
                    onChange={(event) => setCreateCalendarForm((v) => ({ ...v, slotDurationMin: Number(event.target.value || 30) }))}
                  />
                </div>
                <div className="space-y-1">
                  <FieldTitle label="Slot interval (min)" />
                  <Input
                    type="number"
                    placeholder="15"
                    value={createCalendarForm.slotIntervalMin}
                    onChange={(event) => setCreateCalendarForm((v) => ({ ...v, slotIntervalMin: Number(event.target.value || 15) }))}
                  />
                </div>
                <Button onClick={() => void handleCreateCalendar()} disabled={!selectedBizId || !hasActiveActorToken || Boolean(busy)}>
                  Create calendar
                </Button>
              </CardContent>
              <CardContent className="grid gap-3 md:grid-cols-5">
                <Select value={createBindingForm.calendarId} onValueChange={(value) => setCreateBindingForm((v) => ({ ...v, calendarId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Calendar" /></SelectTrigger>
                  <SelectContent>
                    {calendars.map((calendar) => (
                      <SelectItem key={text(calendar.id)} value={text(calendar.id)}>{text(calendar.name, text(calendar.id))}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={createBindingForm.ownerType} onValueChange={(value) => setCreateBindingForm((v) => ({ ...v, ownerType: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['biz', 'user', 'resource', 'service', 'service_product', 'offer', 'location'].map((ownerType) => (
                      <SelectItem key={ownerType} value={ownerType}>{ownerType}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="resource/service/user/offer id"
                  value={createBindingForm.ownerType === 'resource'
                    ? createBindingForm.resourceId
                    : createBindingForm.ownerType === 'service'
                      ? createBindingForm.serviceId
                      : createBindingForm.ownerType === 'service_product'
                        ? createBindingForm.serviceProductId
                        : createBindingForm.ownerType === 'offer'
                          ? createBindingForm.offerId
                          : createBindingForm.ownerType === 'location'
                            ? createBindingForm.locationId
                            : createBindingForm.ownerUserId}
                  onChange={(event) => {
                    const value = event.target.value
                    setCreateBindingForm((v) => ({
                      ...v,
                      resourceId: v.ownerType === 'resource' ? value : v.resourceId,
                      serviceId: v.ownerType === 'service' ? value : v.serviceId,
                      serviceProductId: v.ownerType === 'service_product' ? value : v.serviceProductId,
                      offerId: v.ownerType === 'offer' ? value : v.offerId,
                      locationId: v.ownerType === 'location' ? value : v.locationId,
                      ownerUserId: v.ownerType === 'user' ? value : v.ownerUserId,
                    }))
                  }}
                />
                <Button onClick={() => void handleCreateBinding()} disabled={!selectedBizId || !hasActiveActorToken || Boolean(busy)}>
                  Create binding
                </Button>
                <Button variant="outline" onClick={() => void handleLoadTimeline()} disabled={!selectedBizId || !hasActiveActorToken || !createBindingForm.calendarId || Boolean(busy)}>
                  Load timeline
                </Button>
              </CardContent>
              <CardContent>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Rendered timeline view</p>
                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={calendarLensType}
                      onValueChange={(value) => {
                        setCalendarLensType(value as typeof calendarLensType)
                        setCalendarLensId('')
                      }}
                    >
                      <SelectTrigger className="w-[170px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All subjects</SelectItem>
                        <SelectItem value="location">Location view</SelectItem>
                        <SelectItem value="resource">Resource view</SelectItem>
                        <SelectItem value="service">Service view</SelectItem>
                        <SelectItem value="offer">Offer view</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={calendarLensId || 'all'} onValueChange={(value) => setCalendarLensId(value === 'all' ? '' : value)}>
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Optional subject filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All {calendarLensType}</SelectItem>
                        {timelineLensOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-md border p-3 text-sm">
                    <p className="font-medium">Window</p>
                    <p className="text-xs text-muted-foreground">
                      {text(timelineWindow?.startAt, 'n/a')} → {text(timelineWindow?.endAt, 'n/a')}
                    </p>
                  </div>
                  <div className="rounded-md border p-3 text-sm">
                    <p className="font-medium">Rules</p>
                    <p className="text-xs text-muted-foreground">
                      {timelineRules.length} ({numberValue(timelineSummary?.ruleCount, timelineRules.length)} total)
                    </p>
                  </div>
                  <div className="rounded-md border p-3 text-sm">
                    <p className="font-medium">Bookings</p>
                    <p className="text-xs text-muted-foreground">
                      {timelineBookings.length} ({numberValue(timelineSummary?.bookingCount, timelineBookings.length)} total)
                    </p>
                  </div>
                  <div className="rounded-md border p-3 text-sm">
                    <p className="font-medium">Holds</p>
                    <p className="text-xs text-muted-foreground">
                      {timelineHolds.length} ({numberValue(timelineSummary?.holdCount, timelineHolds.length)} total)
                    </p>
                  </div>
                </div>
                <ScrollArea className="mt-3 h-72 rounded-md border">
                  <div className="space-y-2 p-2">
                    {timelineEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No events in current lens/time window.</p>
                    ) : (
                      timelineEvents.map((event) => (
                        <div key={`${event.kind}-${event.id}-${event.startAt}`} className="rounded-md border p-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium">
                              {event.kind.toUpperCase()} • {event.status}
                            </p>
                            <Badge variant={event.kind === 'hold' ? 'outline' : 'secondary'}>{event.kind}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {event.startAt || 'n/a'} → {event.endAt || 'n/a'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            resource: {event.resourceId || '—'} • location: {event.locationId || '—'} • service: {event.serviceId || '—'} • offer: {event.offerId || '—'}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
              <CardContent>
                <p className="mb-2 text-sm font-medium">Timeline payload (raw JSON)</p>
                <div className="overflow-auto rounded-md border p-2">
                  <ReactJson src={timelineSrc} name={null} collapsed={2} displayDataTypes={false} displayObjectSize={false} theme="ashes" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customer" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Customer booking flow</CardTitle>
                <CardDescription>
                  Use a customer actor token, load public availability, create booking, then charge through simulated Stripe-compatible payment routing.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <Select value={customerFlow.offerId} onValueChange={(value) => setCustomerFlow((v) => ({ ...v, offerId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Public offer" /></SelectTrigger>
                  <SelectContent>
                    {publicOffers.map((offer) => (
                      <SelectItem key={text(offer.id)} value={text(offer.id)}>
                        {text(offer.name, text(offer.id))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="datetime-local"
                  value={new Date(customerFlow.requestedStartAt).toISOString().slice(0, 16)}
                  onChange={(event) => setCustomerFlow((v) => ({ ...v, requestedStartAt: new Date(event.target.value).toISOString() }))}
                />
                <Button variant="outline" onClick={() => void handleLoadPublicAvailability()} disabled={!selectedBizId || !customerFlow.offerId || Boolean(busy)}>
                  Load availability
                </Button>
                <Button onClick={() => void handleCustomerBooking()} disabled={!selectedBizId || !activeActorToken || !customerFlow.offerId || Boolean(busy)}>
                  Create booking + pay
                </Button>
              </CardContent>
              <CardContent>
                <p className="mb-2 text-sm font-medium">Public availability payload</p>
                <div className="overflow-auto rounded-md border p-2">
                  <ReactJson src={availabilitySrc} name={null} collapsed={2} displayDataTypes={false} displayObjectSize={false} theme="ashes" />
                </div>
              </CardContent>
              <CardContent>
                <p className="mb-2 text-sm font-medium">Customer bookings</p>
                <div className="space-y-2">
                  {customerBookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No customer bookings yet.</p>
                  ) : (
                    customerBookings.map((booking) => (
                      <div key={text(booking.id)} className="rounded-md border p-2 text-sm">
                        <p className="font-medium">{text(booking.id)}</p>
                        <p className="text-xs text-muted-foreground">
                          status: {text(booking.status)} • total: {numberValue(booking.totalMinor)} {text(booking.currency)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-4 pt-4">
            <Card>
              <CardHeader><CardTitle>Payment intents and outbound messages</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <Select value={selectedPaymentIntentId} onValueChange={setSelectedPaymentIntentId}>
                  <SelectTrigger><SelectValue placeholder="Payment intent" /></SelectTrigger>
                  <SelectContent>
                    {paymentIntents.map((intent) => (
                      <SelectItem key={text(intent.id)} value={text(intent.id)}>
                        {text(intent.id)} • {text(intent.status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => void handleLoadPaymentDetail()} disabled={!selectedBizId || !selectedPaymentIntentId || Boolean(busy)}>
                  Load payment detail
                </Button>
                <Button variant="outline" onClick={() => void safeRun('Refresh payments/messages', loadBizScopedData)} disabled={!selectedBizId || Boolean(busy)}>
                  Refresh
                </Button>
              </CardContent>
              <CardContent>
                <p className="mb-2 text-sm font-medium">Payment detail</p>
                <div className="overflow-auto rounded-md border p-2">
                  <ReactJson src={paymentDetailSrc} name={null} collapsed={2} displayDataTypes={false} displayObjectSize={false} theme="ashes" />
                </div>
              </CardContent>
              <CardContent>
                <p className="mb-2 text-sm font-medium">Outbound messages (email/sms)</p>
                <div className="space-y-2">
                  {outboundMessages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No outbound messages yet.</p>
                  ) : (
                    outboundMessages.map((message) => (
                      <div key={text(message.id)} className="rounded-md border p-2 text-sm">
                        <p className="font-medium">
                          {text(message.channel)} • {text(message.status)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          to: {text(message.recipientRef)} • purpose: {text(message.purpose)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          template: {text((message.metadata as JsonMap | undefined)?.templateSlug)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="operations" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Queues</CardTitle>
                <CardDescription>Create queue, join queue, and offer next entry for waitlist scenarios.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-5">
                <Input
                  placeholder="Queue name"
                  value={queueForm.name}
                  onChange={(event) => {
                    const name = event.target.value
                    setQueueForm((v) => ({ ...v, name, slug: slugify(name) }))
                  }}
                />
                <Input
                  placeholder="Queue slug"
                  value={queueForm.slug}
                  onChange={(event) => setQueueForm((v) => ({ ...v, slug: event.target.value }))}
                />
                <Select value={queueForm.strategy} onValueChange={(value) => setQueueForm((v) => ({ ...v, strategy: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['fifo', 'priority', 'weighted', 'fair_share'].map((value) => (
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={queueForm.locationId || 'none'} onValueChange={(value) => setQueueForm((v) => ({ ...v, locationId: value === 'none' ? '' : value }))}>
                  <SelectTrigger><SelectValue placeholder="Optional location" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No location</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={text(location.id)} value={text(location.id)}>
                        {text(location.name, text(location.id))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button onClick={() => void handleCreateQueue()} disabled={!selectedBizId || Boolean(busy)}>Create</Button>
                  <Button variant="outline" onClick={() => void safeRun('Load queue/workflow data', loadQueueAndWorkflowData)} disabled={!selectedBizId || Boolean(busy)}>Refresh</Button>
                </div>
              </CardContent>
              <CardContent className="grid gap-3 md:grid-cols-5">
                <Select value={queueEntryForm.queueId} onValueChange={(value) => setQueueEntryForm((v) => ({ ...v, queueId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Queue" /></SelectTrigger>
                  <SelectContent>
                    {queues.map((queue) => (
                      <SelectItem key={text(queue.id)} value={text(queue.id)}>
                        {text(queue.name, text(queue.id))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={queueEntryForm.priorityScore}
                  onChange={(event) => setQueueEntryForm((v) => ({ ...v, priorityScore: Number(event.target.value || 0) }))}
                />
                <Button onClick={() => void handleCreateQueueEntry()} disabled={!queueEntryForm.queueId || !activeActorId || Boolean(busy)}>
                  Join queue as active actor
                </Button>
                <Button variant="outline" onClick={() => void handleOfferNextQueueEntry()} disabled={!queueEntryForm.queueId || Boolean(busy)}>
                  Offer next
                </Button>
              </CardContent>
              <CardContent>
                <p className="mb-2 text-sm font-medium">Queue entries</p>
                <div className="space-y-2">
                  {queueEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No entries loaded.</p>
                  ) : (
                    queueEntries.map((entry) => (
                      <div key={text(entry.id)} className="rounded-md border p-2 text-sm">
                        <p className="font-medium">{text(entry.id)}</p>
                        <p className="text-xs text-muted-foreground">
                          status: {text(entry.status)} • priority: {numberValue(entry.priorityScore)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Review queues and workflow runtime</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-5">
                <Input
                  placeholder="Review queue name"
                  value={reviewQueueForm.name}
                  onChange={(event) => {
                    const name = event.target.value
                    setReviewQueueForm((v) => ({ ...v, name, slug: slugify(name) }))
                  }}
                />
                <Input
                  placeholder="Slug"
                  value={reviewQueueForm.slug}
                  onChange={(event) => setReviewQueueForm((v) => ({ ...v, slug: event.target.value }))}
                />
                <Select value={reviewQueueForm.type} onValueChange={(value) => setReviewQueueForm((v) => ({ ...v, type: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['fraud', 'manual_approval', 'compliance', 'moderation', 'risk'].map((value) => (
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => void handleCreateReviewQueue()} disabled={!selectedBizId || Boolean(busy)}>Create review queue</Button>
              </CardContent>
              <CardContent className="grid gap-3 md:grid-cols-5">
                <Select value={reviewQueueItemForm.reviewQueueId} onValueChange={(value) => setReviewQueueItemForm((v) => ({ ...v, reviewQueueId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Review queue" /></SelectTrigger>
                  <SelectContent>
                    {reviewQueues.map((row) => (
                      <SelectItem key={text(row.id)} value={text(row.id)}>
                        {text(row.name, text(row.id))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Item type"
                  value={reviewQueueItemForm.itemType}
                  onChange={(event) => setReviewQueueItemForm((v) => ({ ...v, itemType: event.target.value }))}
                />
                <Input
                  placeholder="Item ref id"
                  value={reviewQueueItemForm.itemRefId}
                  onChange={(event) => setReviewQueueItemForm((v) => ({ ...v, itemRefId: event.target.value }))}
                />
                <Button onClick={() => void handleCreateReviewQueueItem()} disabled={!reviewQueueItemForm.reviewQueueId || !reviewQueueItemForm.itemRefId || Boolean(busy)}>
                  Create review item
                </Button>
                <Button variant="outline" onClick={() => void safeRun('Load queue/workflow data', loadQueueAndWorkflowData)} disabled={!selectedBizId || Boolean(busy)}>
                  Refresh runtime
                </Button>
              </CardContent>
              <CardContent className="grid gap-3 md:grid-cols-3 text-sm">
                <div className="rounded-md border p-3">Review queues: {reviewQueues.length}</div>
                <div className="rounded-md border p-3">Review items: {reviewQueueItems.length}</div>
                <div className="rounded-md border p-3">Workflows + deliverables: {workflows.length} + {asyncDeliverables.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Dispatch state</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-5">
                <Input
                  placeholder="Route name"
                  value={dispatchRouteForm.name}
                  onChange={(event) => {
                    const name = event.target.value
                    setDispatchRouteForm((v) => ({ ...v, name, slug: slugify(name) }))
                  }}
                />
                <Input
                  placeholder="Route slug"
                  value={dispatchRouteForm.slug}
                  onChange={(event) => setDispatchRouteForm((v) => ({ ...v, slug: event.target.value }))}
                />
                <Input
                  placeholder="Timezone"
                  value={dispatchRouteForm.timezone}
                  onChange={(event) => setDispatchRouteForm((v) => ({ ...v, timezone: event.target.value }))}
                />
                <Button onClick={() => void handleCreateDispatchRoute()} disabled={!selectedBizId || Boolean(busy)}>Create route</Button>
                <Button variant="outline" onClick={() => void safeRun('Load dispatch data', loadDispatchData)} disabled={!selectedBizId || Boolean(busy)}>Refresh dispatch</Button>
              </CardContent>
              <CardContent className="grid gap-3 md:grid-cols-5">
                <Select value={dispatchTripForm.routeId} onValueChange={(value) => setDispatchTripForm((v) => ({ ...v, routeId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Route" /></SelectTrigger>
                  <SelectContent>
                    {dispatchRoutes.map((route) => (
                      <SelectItem key={text(route.id)} value={text(route.id)}>
                        {text(route.name, text(route.id))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="datetime-local"
                  value={new Date(dispatchTripForm.departureAt).toISOString().slice(0, 16)}
                  onChange={(event) => setDispatchTripForm((v) => ({ ...v, departureAt: new Date(event.target.value).toISOString() }))}
                />
                <Input
                  type="datetime-local"
                  value={new Date(dispatchTripForm.arrivalAt).toISOString().slice(0, 16)}
                  onChange={(event) => setDispatchTripForm((v) => ({ ...v, arrivalAt: new Date(event.target.value).toISOString() }))}
                />
                <Input
                  type="number"
                  value={dispatchTripForm.capacitySeats}
                  onChange={(event) => setDispatchTripForm((v) => ({ ...v, capacitySeats: Number(event.target.value || 1) }))}
                />
                <Button onClick={() => void handleCreateDispatchTrip()} disabled={!dispatchTripForm.routeId || Boolean(busy)}>Create trip</Button>
              </CardContent>
              <CardContent className="grid gap-3 md:grid-cols-5">
                <Input
                  placeholder="Dispatch task title"
                  value={dispatchTaskForm.title}
                  onChange={(event) => setDispatchTaskForm((v) => ({ ...v, title: event.target.value }))}
                />
                <Input
                  placeholder="Optional trip id"
                  value={dispatchTaskForm.tripId}
                  onChange={(event) => setDispatchTaskForm((v) => ({ ...v, tripId: event.target.value }))}
                />
                <Button onClick={() => void handleCreateDispatchTask()} disabled={!dispatchTaskForm.title || Boolean(busy)}>Create task</Button>
              </CardContent>
              <CardContent>
                <p className="mb-2 text-sm font-medium">Dispatch state payload</p>
                <div className="overflow-auto rounded-md border p-2">
                  <ReactJson src={dispatchStateSrc} name={null} collapsed={2} displayDataTypes={false} displayObjectSize={false} theme="ashes" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="memberships" className="space-y-4 pt-4">
            <Card>
              <CardHeader><CardTitle>Membership plans + memberships</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-6">
                <Input
                  placeholder="Plan name"
                  value={membershipPlanForm.name}
                  onChange={(event) => {
                    const name = event.target.value
                    setMembershipPlanForm((v) => ({ ...v, name, slug: slugify(name) }))
                  }}
                />
                <Input
                  placeholder="Plan slug"
                  value={membershipPlanForm.slug}
                  onChange={(event) => setMembershipPlanForm((v) => ({ ...v, slug: event.target.value }))}
                />
                <Select value={membershipPlanForm.entitlementType} onValueChange={(value) => setMembershipPlanForm((v) => ({ ...v, entitlementType: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['pass', 'credit', 'time_allowance', 'seat_pack', 'custom'].map((value) => (
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={membershipPlanForm.entitlementQuantityPerCycle}
                  onChange={(event) => setMembershipPlanForm((v) => ({ ...v, entitlementQuantityPerCycle: Number(event.target.value || 0) }))}
                />
                <Input
                  type="number"
                  value={membershipPlanForm.priceMinor}
                  onChange={(event) => setMembershipPlanForm((v) => ({ ...v, priceMinor: Number(event.target.value || 0) }))}
                />
                <Button onClick={() => void handleCreateMembershipPlan()} disabled={!selectedBizId || Boolean(busy)}>Create plan</Button>
              </CardContent>
              <CardContent className="grid gap-3 md:grid-cols-5">
                <Select value={membershipForm.membershipPlanId} onValueChange={(value) => setMembershipForm((v) => ({ ...v, membershipPlanId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Plan" /></SelectTrigger>
                  <SelectContent>
                    {membershipPlans.map((plan) => (
                      <SelectItem key={text(plan.id)} value={text(plan.id)}>
                        {text(plan.name, text(plan.id))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="datetime-local"
                  value={new Date(membershipForm.currentPeriodEndAt).toISOString().slice(0, 16)}
                  onChange={(event) => setMembershipForm((v) => ({ ...v, currentPeriodEndAt: new Date(event.target.value).toISOString() }))}
                />
                <Button onClick={() => void handleCreateMembership()} disabled={!membershipForm.membershipPlanId || !activeActorId || Boolean(busy)}>
                  Create membership for actor
                </Button>
                <Button variant="outline" onClick={() => void safeRun('Load membership data', loadMembershipData)} disabled={!selectedBizId || Boolean(busy)}>
                  Refresh memberships
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Entitlement wallets</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-5">
                <Input
                  placeholder="Wallet name"
                  value={walletForm.name}
                  onChange={(event) => setWalletForm((v) => ({ ...v, name: event.target.value }))}
                />
                <Select value={walletForm.entitlementType} onValueChange={(value) => setWalletForm((v) => ({ ...v, entitlementType: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['pass', 'credit', 'time_allowance', 'seat_pack', 'custom'].map((value) => (
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={walletForm.balanceQuantity}
                  onChange={(event) => setWalletForm((v) => ({ ...v, balanceQuantity: Number(event.target.value || 0) }))}
                />
                <Button onClick={() => void handleCreateWallet()} disabled={!activeActorId || Boolean(busy)}>Create wallet</Button>
              </CardContent>
              <CardContent className="grid gap-3 md:grid-cols-6">
                <Select value={selectedWalletId || ''} onValueChange={(value) => setSelectedWalletId(value)}>
                  <SelectTrigger><SelectValue placeholder="Wallet" /></SelectTrigger>
                  <SelectContent>
                    {entitlementWallets.map((wallet) => (
                      <SelectItem key={text(wallet.id)} value={text(wallet.id)}>
                        {text(wallet.name, text(wallet.id))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={grantForm.quantity}
                  onChange={(event) => setGrantForm((v) => ({ ...v, quantity: Number(event.target.value || 1) }))}
                />
                <Button
                  onClick={() => void handleCreateGrant()}
                  disabled={(!grantForm.walletId && !selectedWalletId) || Boolean(busy)}
                >
                  Grant credits
                </Button>
                <Input
                  type="number"
                  value={consumeForm.quantity}
                  onChange={(event) => setConsumeForm((v) => ({ ...v, quantity: Number(event.target.value || 1) }))}
                />
                <Button
                  variant="outline"
                  onClick={() => void handleConsumeWallet()}
                  disabled={(!consumeForm.walletId && !selectedWalletId) || Boolean(busy)}
                >
                  Consume credits
                </Button>
                <Button variant="outline" onClick={() => void safeRun('Load membership data', loadMembershipData)} disabled={!selectedBizId || Boolean(busy)}>
                  Reload wallets
                </Button>
              </CardContent>
              <CardContent className="grid gap-3 md:grid-cols-3 text-sm">
                <div className="rounded-md border p-3">Plans: {membershipPlans.length}</div>
                <div className="rounded-md border p-3">Memberships: {memberships.length}</div>
                <div className="rounded-md border p-3">Ledger rows: {walletLedger.length}</div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="crm" className="space-y-4 pt-4">
            <Card>
              <CardHeader><CardTitle>CRM pipelines + stages</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <Input
                  placeholder="Pipeline name"
                  value={crmPipelineForm.name}
                  onChange={(event) => {
                    const name = event.target.value
                    setCrmPipelineForm((v) => ({ ...v, name, slug: slugify(name) }))
                  }}
                />
                <Input
                  placeholder="Pipeline slug"
                  value={crmPipelineForm.slug}
                  onChange={(event) => setCrmPipelineForm((v) => ({ ...v, slug: event.target.value }))}
                />
                <Button onClick={() => void handleCreateCrmPipeline()} disabled={!selectedBizId || Boolean(busy)}>Create pipeline</Button>
                <Button variant="outline" onClick={() => void safeRun('Load CRM data', loadCrmData)} disabled={!selectedBizId || Boolean(busy)}>Refresh CRM</Button>
              </CardContent>
              <CardContent className="grid gap-3 md:grid-cols-5">
                <Select value={crmStageForm.pipelineId} onValueChange={(value) => setCrmStageForm((v) => ({ ...v, pipelineId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Pipeline" /></SelectTrigger>
                  <SelectContent>
                    {crmPipelines.map((pipeline) => (
                      <SelectItem key={text(pipeline.id)} value={text(pipeline.id)}>
                        {text(pipeline.name, text(pipeline.id))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Stage name"
                  value={crmStageForm.name}
                  onChange={(event) => {
                    const name = event.target.value
                    setCrmStageForm((v) => ({ ...v, name, slug: slugify(name) }))
                  }}
                />
                <Input
                  placeholder="Stage slug"
                  value={crmStageForm.slug}
                  onChange={(event) => setCrmStageForm((v) => ({ ...v, slug: event.target.value }))}
                />
                <Input
                  type="number"
                  value={crmStageForm.probabilityBps}
                  onChange={(event) => setCrmStageForm((v) => ({ ...v, probabilityBps: Number(event.target.value || 0) }))}
                />
                <Button onClick={() => void handleCreateCrmStage()} disabled={!crmStageForm.pipelineId || !crmStageForm.name || Boolean(busy)}>Create stage</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>CRM contacts, leads, opportunities</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <Input
                  placeholder="Contact name"
                  value={crmContactForm.displayName}
                  onChange={(event) => setCrmContactForm((v) => ({ ...v, displayName: event.target.value }))}
                />
                <Input
                  placeholder="Contact email"
                  value={crmContactForm.email}
                  onChange={(event) => setCrmContactForm((v) => ({ ...v, email: event.target.value }))}
                />
                <Button onClick={() => void handleCreateCrmContact()} disabled={!crmContactForm.displayName || Boolean(busy)}>Create contact</Button>
              </CardContent>
              <CardContent className="grid gap-3 md:grid-cols-5">
                <Select value={crmLeadForm.crmContactId} onValueChange={(value) => setCrmLeadForm((v) => ({ ...v, crmContactId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Contact for lead" /></SelectTrigger>
                  <SelectContent>
                    {crmContacts.map((contact) => (
                      <SelectItem key={text(contact.id)} value={text(contact.id)}>
                        {text(contact.displayName, text(contact.id))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Source type"
                  value={crmLeadForm.sourceType}
                  onChange={(event) => setCrmLeadForm((v) => ({ ...v, sourceType: event.target.value }))}
                />
                <Button onClick={() => void handleCreateCrmLead()} disabled={!crmLeadForm.crmContactId || Boolean(busy)}>Create lead</Button>
              </CardContent>
              <CardContent className="grid gap-3 md:grid-cols-6">
                <Select value={crmOpportunityForm.crmPipelineId} onValueChange={(value) => setCrmOpportunityForm((v) => ({ ...v, crmPipelineId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Pipeline" /></SelectTrigger>
                  <SelectContent>
                    {crmPipelines.map((pipeline) => (
                      <SelectItem key={text(pipeline.id)} value={text(pipeline.id)}>
                        {text(pipeline.name, text(pipeline.id))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={crmOpportunityForm.crmPipelineStageId} onValueChange={(value) => setCrmOpportunityForm((v) => ({ ...v, crmPipelineStageId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
                  <SelectContent>
                    {crmPipelineStages.map((stage) => (
                      <SelectItem key={text(stage.id)} value={text(stage.id)}>
                        {text(stage.name, text(stage.id))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Opportunity title"
                  value={crmOpportunityForm.title}
                  onChange={(event) => setCrmOpportunityForm((v) => ({ ...v, title: event.target.value }))}
                />
                <Input
                  type="number"
                  value={crmOpportunityForm.estimatedAmountMinor}
                  onChange={(event) => setCrmOpportunityForm((v) => ({ ...v, estimatedAmountMinor: Number(event.target.value || 0) }))}
                />
                <Button onClick={() => void handleCreateCrmOpportunity()} disabled={!crmOpportunityForm.crmPipelineId || !crmOpportunityForm.crmPipelineStageId || !crmOpportunityForm.title || Boolean(busy)}>
                  Create opportunity
                </Button>
              </CardContent>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <Select value={selectedCrmContactId || ''} onValueChange={setSelectedCrmContactId}>
                  <SelectTrigger><SelectValue placeholder="Contact summary target" /></SelectTrigger>
                  <SelectContent>
                    {crmContacts.map((contact) => (
                      <SelectItem key={text(contact.id)} value={text(contact.id)}>
                        {text(contact.displayName, text(contact.id))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => void handleLoadCrmContactSummary()} disabled={!selectedCrmContactId || Boolean(busy)}>
                  Load contact summary
                </Button>
              </CardContent>
              <CardContent>
                <div className="overflow-auto rounded-md border p-2">
                  <ReactJson src={crmContactSummarySrc} name={null} collapsed={2} displayDataTypes={false} displayObjectSize={false} theme="ashes" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-4 pt-4">
            <Card>
              <CardHeader><CardTitle>Channel accounts and sync</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <Select value={channelAccountForm.provider} onValueChange={(value) => setChannelAccountForm((v) => ({ ...v, provider: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['google_reserve', 'classpass', 'instagram', 'facebook', 'meta_messenger', 'custom'].map((provider) => (
                      <SelectItem key={provider} value={provider}>{provider}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Account name"
                  value={channelAccountForm.name}
                  onChange={(event) => setChannelAccountForm((v) => ({ ...v, name: event.target.value }))}
                />
                <Button onClick={() => void handleCreateChannelAccount()} disabled={!channelAccountForm.name || Boolean(busy)}>Create channel account</Button>
                <Button variant="outline" onClick={() => void safeRun('Load channel data', loadChannelData)} disabled={!selectedBizId || Boolean(busy)}>Refresh channels</Button>
              </CardContent>
              <CardContent className="grid gap-3 md:grid-cols-5">
                <Select value={channelSyncForm.channelAccountId || ''} onValueChange={(value) => {
                  setChannelSyncForm((v) => ({ ...v, channelAccountId: value }))
                  setChannelEntityLinkForm((v) => ({ ...v, channelAccountId: value }))
                }}>
                  <SelectTrigger><SelectValue placeholder="Channel account" /></SelectTrigger>
                  <SelectContent>
                    {channelAccounts.map((account) => (
                      <SelectItem key={text(account.id)} value={text(account.id)}>
                        {text(account.name, text(account.id))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={channelSyncForm.objectType} onValueChange={(value) => setChannelSyncForm((v) => ({ ...v, objectType: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['offer_version', 'availability', 'booking_order', 'customer', 'resource', 'class_session', 'custom'].map((value) => (
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={channelSyncForm.direction} onValueChange={(value) => setChannelSyncForm((v) => ({ ...v, direction: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['inbound', 'outbound', 'bidirectional'].map((value) => (
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => void handleUpsertChannelSyncState()} disabled={!channelSyncForm.channelAccountId || Boolean(busy)}>
                  Upsert sync state
                </Button>
              </CardContent>
              <CardContent className="grid gap-3 md:grid-cols-6">
                <Select value={channelEntityLinkForm.objectType} onValueChange={(value) => setChannelEntityLinkForm((v) => ({ ...v, objectType: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['booking_order', 'custom', 'resource', 'customer', 'offer_version', 'availability', 'class_session'].map((value) => (
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Booking order id (if booking_order)"
                  value={channelEntityLinkForm.bookingOrderId}
                  onChange={(event) => setChannelEntityLinkForm((v) => ({ ...v, bookingOrderId: event.target.value }))}
                />
                <Input
                  placeholder="External object id"
                  value={channelEntityLinkForm.externalObjectId}
                  onChange={(event) => setChannelEntityLinkForm((v) => ({ ...v, externalObjectId: event.target.value }))}
                />
                <Button onClick={() => void handleCreateChannelEntityLink()} disabled={!channelEntityLinkForm.channelAccountId || !channelEntityLinkForm.externalObjectId || Boolean(busy)}>
                  Create entity link
                </Button>
              </CardContent>
              <CardContent>
                <p className="mb-2 text-sm font-medium">Channel insights payload</p>
                <div className="overflow-auto rounded-md border p-2">
                  <ReactJson src={channelInsightsSrc} name={null} collapsed={2} displayDataTypes={false} displayObjectSize={false} theme="ashes" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4 pt-4">
            <Card>
              <CardHeader><CardTitle>Compliance controls and consent gates</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <Button onClick={() => void handleLoadComplianceControls()} disabled={!selectedBizId || Boolean(busy)}>
                  Load controls snapshot
                </Button>
                <Input
                  placeholder="Booking order id"
                  value={complianceForm.bookingOrderId}
                  onChange={(event) => setComplianceForm((v) => ({ ...v, bookingOrderId: event.target.value }))}
                />
                <Button variant="outline" onClick={() => void handleLoadComplianceGate()} disabled={!complianceForm.bookingOrderId || Boolean(busy)}>
                  Load booking gate
                </Button>
              </CardContent>
              <CardContent className="grid gap-3 md:grid-cols-5">
                <Input
                  placeholder="Participant user id"
                  value={complianceForm.participantUserId}
                  onChange={(event) => setComplianceForm((v) => ({ ...v, participantUserId: event.target.value }))}
                />
                <Input
                  placeholder="Policy template id"
                  value={complianceForm.policyTemplateId}
                  onChange={(event) => setComplianceForm((v) => ({ ...v, policyTemplateId: event.target.value }))}
                />
                <Button onClick={() => void handleCreateComplianceConsent()} disabled={!complianceForm.bookingOrderId || !complianceForm.participantUserId || !complianceForm.policyTemplateId || Boolean(busy)}>
                  Record consent
                </Button>
              </CardContent>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="overflow-auto rounded-md border p-2">
                  <p className="mb-2 text-sm font-medium">Controls</p>
                  <ReactJson src={complianceControlsSrc} name={null} collapsed={2} displayDataTypes={false} displayObjectSize={false} theme="ashes" />
                </div>
                <div className="overflow-auto rounded-md border p-2">
                  <p className="mb-2 text-sm font-medium">Booking gate</p>
                  <ReactJson src={complianceGateSrc} name={null} collapsed={2} displayDataTypes={false} displayObjectSize={false} theme="ashes" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>API request inspector</CardTitle>
            <CardDescription>
              Shows the exact API shape used by this UI: URL, method, request body, and response payload.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-5">
            <div className="md:col-span-2">
              <ScrollArea className="h-72 rounded-md border">
                <div className="divide-y">
                  {apiTraces.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No API traces yet. Run any action to capture one.</p>
                  ) : (
                    apiTraces.map((trace, index) => (
                      <button
                        key={`${trace.at}-${index}`}
                        type="button"
                        className={`w-full p-2 text-left ${selectedTraceIndex === index ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                        onClick={() => setSelectedTraceIndex(index)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-medium">
                            {trace.method} {trace.path}
                          </p>
                          <Badge variant={trace.ok ? 'secondary' : 'destructive'}>{trace.status}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(trace.at).toLocaleTimeString()} • {trace.durationMs}ms
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
            <div className="space-y-3 md:col-span-3">
              <div className="rounded-md border p-3 text-xs">
                <p className="font-medium">Endpoint URL</p>
                <p className="break-all text-muted-foreground">
                  {selectedTrace ? apiUrl(selectedTrace.path) : 'No trace selected'}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border p-2">
                  <p className="mb-2 text-xs font-medium">Request body</p>
                  <ScrollArea className="h-52">
                    <ReactJson
                      src={(selectedTrace?.requestBody as JsonMap | undefined) ?? {}}
                      name={null}
                      collapsed={2}
                      displayDataTypes={false}
                      displayObjectSize={false}
                      theme="ashes"
                    />
                  </ScrollArea>
                </div>
                <div className="rounded-md border p-2">
                  <p className="mb-2 text-xs font-medium">Response body</p>
                  <ScrollArea className="h-52">
                    <ReactJson
                      src={(selectedTrace?.responseBody as JsonMap | undefined) ?? { error: selectedTrace?.errorMessage ?? null }}
                      name={null}
                      collapsed={2}
                      displayDataTypes={false}
                      displayObjectSize={false}
                      theme="ashes"
                    />
                  </ScrollArea>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Inventory snapshot
            </CardTitle>
            <CardDescription>Quick visibility for setup completeness in one screen.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-6 text-sm">
            <div className="rounded-md border p-2">Locations: {locations.length}</div>
            <div className="rounded-md border p-2">Resources: {resources.length}</div>
            <div className="rounded-md border p-2">Calendars: {calendars.length}</div>
            <div className="rounded-md border p-2">Services: {services.length}</div>
            <div className="rounded-md border p-2">Offers: {offers.length}</div>
            <div className="rounded-md border p-2">Products: {products.length}</div>
            <div className="rounded-md border p-2">Queues: {queues.length}</div>
            <div className="rounded-md border p-2">Review queues: {reviewQueues.length}</div>
            <div className="rounded-md border p-2">Dispatch routes: {dispatchRoutes.length}</div>
            <div className="rounded-md border p-2">Membership plans: {membershipPlans.length}</div>
            <div className="rounded-md border p-2">CRM contacts: {crmContacts.length}</div>
            <div className="rounded-md border p-2">Channel accounts: {channelAccounts.length}</div>
          </CardContent>
        </Card>
      </div>
      </TooltipProvider>
    </div>
  )
}
