'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Command,
  Loader2,
  Rocket,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  setStudioApiTraceListener,
  studioApi,
  type StudioActorToken,
  type StudioActorUser,
  type StudioApiTrace,
} from '@/lib/studio-api'
import { AvailabilityRuleManager } from './availability-rule-manager'
import { CalendarTimelineView } from './calendar-timeline-view'
import { FeatureDiscoveryCommand, type FeatureActionItem, type FeatureToggleItem } from './feature-discovery-command'
import { asArray, asRecord, formatDateTime, numberValue, text, type JsonMap } from './types'

const ReactJson = dynamic(() => import('react-json-view'), { ssr: false })

type ActorRole = 'owner' | 'admin' | 'manager' | 'staff' | 'host' | 'customer'
type LensMode = 'all' | 'biz' | 'location' | 'resource' | 'service' | 'offer'
type VisibilityKey = 'actorLab' | 'entityExplorer' | 'availabilityLab' | 'apiTrace' | 'rawData'

type BookingSlot = {
  startAt: string
  endAt: string
}

function findSlots(payload: unknown): BookingSlot[] {
  const root = asRecord(payload)
  const slots = asArray(root.slots)
  if (slots.length > 0) {
    return slots
      .map((row) => ({ startAt: text(row.startAt), endAt: text(row.endAt) }))
      .filter((slot) => slot.startAt && slot.endAt)
  }
  return []
}

function plusMinutes(iso: string, minutes: number) {
  const date = new Date(iso)
  return new Date(date.getTime() + minutes * 60 * 1000).toISOString()
}

/**
 * Customer Experience Page
 *
 * ELI5:
 * - Starts with one simple booking flow (discover offer -> pick slot -> book -> pay)
 * - Advanced controls are hidden by default and discovered with slash command
 * - Admins can impersonate actors to test owner/member/customer perspectives safely
 */
export function CustomerExperiencePage() {
  const { isAuthenticated, isLoading, user } = useAuth()

  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [actors, setActors] = useState<StudioActorUser[]>([])
  const [tokens, setTokens] = useState<Record<string, StudioActorToken>>({})
  const [activeActorId, setActiveActorId] = useState<string>('')
  const [createActorForm, setCreateActorForm] = useState({
    name: '',
    email: '',
    role: 'customer' as ActorRole,
  })

  const [bizes, setBizes] = useState<JsonMap[]>([])
  const [selectedBizId, setSelectedBizId] = useState<string>('')
  const [locations, setLocations] = useState<JsonMap[]>([])
  const [resources, setResources] = useState<JsonMap[]>([])
  const [calendars, setCalendars] = useState<JsonMap[]>([])
  const [services, setServices] = useState<JsonMap[]>([])
  const [offers, setOffers] = useState<JsonMap[]>([])
  const [publicOffers, setPublicOffers] = useState<JsonMap[]>([])
  const [offerVersionsByOffer, setOfferVersionsByOffer] = useState<Record<string, JsonMap[]>>({})

  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('')
  const [calendarLens, setCalendarLens] = useState<LensMode>('all')
  const [timeline, setTimeline] = useState<unknown>(null)
  const [availabilityRules, setAvailabilityRules] = useState<unknown[]>([])

  const [selectedOfferId, setSelectedOfferId] = useState<string>('')
  const [selectedOfferVersionId, setSelectedOfferVersionId] = useState<string>('')
  const [slots, setSlots] = useState<BookingSlot[]>([])
  const [selectedSlotStartAt, setSelectedSlotStartAt] = useState<string>('')
  const [bookingOrder, setBookingOrder] = useState<JsonMap | null>(null)
  const [bookingMessages, setBookingMessages] = useState<JsonMap[]>([])

  const [featureCommandOpen, setFeatureCommandOpen] = useState(false)
  const [visiblePanels, setVisiblePanels] = useState<Record<VisibilityKey, boolean>>({
    actorLab: false,
    entityExplorer: false,
    availabilityLab: false,
    apiTrace: false,
    rawData: false,
  })

  const [apiTraces, setApiTraces] = useState<StudioApiTrace[]>([])
  const [selectedTraceIndex, setSelectedTraceIndex] = useState(0)

  const activeActor = useMemo(() => actors.find((actor) => actor.id === activeActorId) ?? null, [actors, activeActorId])
  const activeToken = activeActor ? tokens[activeActor.id]?.accessToken ?? null : null
  const selectedBiz = useMemo(() => bizes.find((row) => text((row as JsonMap).id) === selectedBizId) ?? null, [bizes, selectedBizId])

  const selectedOffer = useMemo(
    () => publicOffers.find((row) => text((row as JsonMap).id) === selectedOfferId) ?? null,
    [publicOffers, selectedOfferId],
  )

  const selectedOfferVersions = useMemo(
    () => offerVersionsByOffer[selectedOfferId] ?? [],
    [offerVersionsByOffer, selectedOfferId],
  )

  const selectedOfferVersion = useMemo(
    () => selectedOfferVersions.find((row) => text(row.id) === selectedOfferVersionId) ?? null,
    [selectedOfferVersions, selectedOfferVersionId],
  )

  useEffect(() => {
    setStudioApiTraceListener((trace) => {
      setApiTraces((prev) => [trace, ...prev].slice(0, 120))
      setSelectedTraceIndex(0)
    })
    return () => setStudioApiTraceListener(null)
  }, [])

  async function withBusy<T>(key: string, task: () => Promise<T>): Promise<T | null> {
    setBusyKey(key)
    setError(null)
    setSuccess(null)
    try {
      const result = await task()
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
      return null
    } finally {
      setBusyKey(null)
    }
  }

  async function loadActors() {
    const rows = await withBusy('actors.load', () => studioApi.listImpersonationUsers())
    if (!rows) return
    setActors(rows)
    if (!activeActorId && rows[0]) setActiveActorId(rows[0].id)
  }

  async function mintToken(actorId: string) {
    const actor = actors.find((row) => row.id === actorId)
    if (!actor) return
    const token = await withBusy('actors.token', () =>
      studioApi.issueImpersonationToken({
        targetUserId: actor.id,
        targetRole: actor.role as ActorRole,
        ttlSeconds: 60 * 60 * 6,
        label: `experience-${actor.role}-${Date.now().toString(36)}`,
      }),
    )
    if (!token) return
    setTokens((prev) => ({ ...prev, [actor.id]: token }))
    setSuccess(`Token ready for ${actor.name}`)
  }

  async function createActor() {
    if (!createActorForm.email.trim() || !createActorForm.name.trim()) {
      setError('Name and email are required.')
      return
    }
    const created = await withBusy('actors.create', () =>
      studioApi.createImpersonationUser({
        name: createActorForm.name.trim(),
        email: createActorForm.email.trim(),
        role: createActorForm.role,
      }),
    )
    if (!created) return
    setCreateActorForm({ name: '', email: '', role: 'customer' })
    await loadActors()
    setSuccess('Actor created.')
  }

  async function ensureStarterActors() {
    const ownerEmail = `owner-${Date.now()}@example.com`
    const customerEmail = `customer-${Date.now()}@example.com`
    const owner = await withBusy('actors.seed', () =>
      studioApi.createImpersonationUser({ name: 'Default Owner', email: ownerEmail, role: 'owner' }),
    )
    if (!owner) return
    await studioApi.createImpersonationUser({ name: 'Default Customer', email: customerEmail, role: 'customer' })
    await loadActors()
    const ownerId = text(asRecord(owner).user ? asRecord(asRecord(owner).user).id : '')
    if (ownerId) {
      setActiveActorId(ownerId)
      await mintToken(ownerId)
    }
    setSuccess('Starter actors ready.')
  }

  async function loadBizes() {
    if (!activeToken) {
      setBizes([])
      setSelectedBizId('')
      return
    }
    const rows = await withBusy('biz.load', () => studioApi.listBizes(activeToken))
    if (!rows) return
    const mapped = asArray(rows)
    setBizes(mapped)
    if (!selectedBizId && mapped[0]) {
      setSelectedBizId(text(mapped[0].id))
    }
  }

  async function loadBizContext(bizId: string) {
    if (!bizId || !activeToken) return
    const result = await withBusy('biz.context', () =>
      Promise.all([
        studioApi.listLocations(bizId, activeToken),
        studioApi.listResources(bizId, activeToken),
        studioApi.listCalendars(bizId, activeToken),
        studioApi.listServices(bizId, activeToken),
        studioApi.listOffers(bizId, activeToken),
        studioApi.listPublicOffers(bizId),
      ]),
    )
    if (!result) return
    const [nextLocations, nextResources, nextCalendars, nextServices, nextOffers, nextPublicOffers] = result
    setLocations(asArray(nextLocations))
    setResources(asArray(nextResources))
    setCalendars(asArray(nextCalendars))
    setServices(asArray(nextServices))
    setOffers(asArray(nextOffers))
    setPublicOffers(asArray(nextPublicOffers))

    const firstCalendarId = text(asArray(nextCalendars)[0]?.id)
    if (firstCalendarId) setSelectedCalendarId(firstCalendarId)

    const firstOfferId = text(asArray(nextPublicOffers)[0]?.id)
    if (firstOfferId) setSelectedOfferId(firstOfferId)

    const versionPairs = await Promise.all(
      asArray(nextOffers).slice(0, 30).map(async (offer) => {
        const offerId = text(offer.id)
        if (!offerId) return [offerId, [] as JsonMap[]] as const
        const versions = await studioApi.listOfferVersions(bizId, offerId, activeToken)
        return [offerId, asArray(versions)] as const
      }),
    )

    setOfferVersionsByOffer(Object.fromEntries(versionPairs))
  }

  async function loadCalendarData(calendarId: string) {
    if (!selectedBizId || !calendarId || !activeToken) return
    const result = await withBusy('calendar.load', () =>
      Promise.all([
        studioApi.fetchCalendarTimeline(
          selectedBizId,
          calendarId,
          {
            startAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
            endAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
          },
          activeToken,
        ),
        studioApi.listAvailabilityRules(selectedBizId, calendarId, activeToken),
      ]),
    )
    if (!result) return
    setTimeline(result[0])
    setAvailabilityRules(asArray(result[1]))
  }

  async function createDefaultWorkspace() {
    const actor = activeActor
    if (!actor) {
      setError('Select an owner actor first.')
      return
    }
    if (!activeToken) {
      setError('Mint a token for the active actor first.')
      return
    }

    const isOwnerLike = ['owner', 'admin', 'manager'].includes(actor.role)
    if (!isOwnerLike) {
      setError('Default workspace setup requires an owner/admin actor token.')
      return
    }

    await withBusy('seed.defaults', async () => {
      const stamp = Date.now().toString(36)
      const biz = asRecord(
        await studioApi.createBiz(
          {
            name: 'My First Biz',
            slug: `my-first-biz-${stamp}`,
            timezone: 'America/Los_Angeles',
            currency: 'USD',
          },
          activeToken,
        ),
      )
      const bizId = text(biz.id)
      if (!bizId) throw new Error('Failed to create default biz.')

      const location = asRecord(
        await studioApi.createLocation(
          bizId,
          { name: 'Main Location', slug: `main-${stamp}`, type: 'physical', timezone: 'America/Los_Angeles' },
          activeToken,
        ),
      )
      const locationId = text(location.id)

      const resource = asRecord(
        await studioApi.createResource(
          bizId,
          {
            name: 'Default Host',
            slug: `default-host-${stamp}`,
            type: 'host',
            locationId,
            status: 'active',
            capacityDefault: 1,
            bufferBeforeMin: 10,
            bufferAfterMin: 10,
          },
          activeToken,
        ),
      )
      const resourceId = text(resource.id)

      const calendar = asRecord(
        await studioApi.createCalendar(
          bizId,
          {
            name: 'Main Calendar',
            timezone: 'America/Los_Angeles',
            slotDurationMin: 30,
            slotIntervalMin: 15,
            defaultMode: 'available_by_default',
          },
          activeToken,
        ),
      )
      const calendarId = text(calendar.id)

      await studioApi.createCalendarBinding(
        bizId,
        {
          calendarId,
          ownerType: 'resource',
          resourceId,
          locationId,
          isPrimary: true,
          isActive: true,
        },
        activeToken,
      )

      const serviceGroup = asRecord(
        await studioApi.createServiceGroup(
          bizId,
          { name: 'General Services', slug: `general-services-${stamp}` },
          activeToken,
        ),
      )

      const offerOne = asRecord(
        await studioApi.createOffer(
          bizId,
          {
            serviceGroupId: text(serviceGroup.id),
            name: 'Consultation 60m',
            slug: `consultation-60-${stamp}`,
            executionMode: 'slot',
          },
          activeToken,
        ),
      )
      const offerTwo = asRecord(
        await studioApi.createOffer(
          bizId,
          {
            serviceGroupId: text(serviceGroup.id),
            name: 'Quick Intro 30m',
            slug: `intro-30-${stamp}`,
            executionMode: 'slot',
          },
          activeToken,
        ),
      )

      const offerOneVersion = asRecord(
        await studioApi.createOfferVersion(
          bizId,
          text(offerOne.id),
          {
            version: 1,
            status: 'published',
            durationMode: 'fixed',
            defaultDurationMin: 60,
            basePriceMinor: 15000,
            currency: 'USD',
            policyModel: {
              slotVisibility: {
                defaultVisibleSlotCount: 12,
              },
            },
            pricingModel: {
              basePriceMinor: 15000,
            },
          },
          activeToken,
        ),
      )

      await studioApi.createOfferVersion(
        bizId,
        text(offerTwo.id),
        {
          version: 1,
          status: 'published',
          durationMode: 'fixed',
          defaultDurationMin: 30,
          basePriceMinor: 7000,
          currency: 'USD',
          pricingModel: {
            basePriceMinor: 7000,
          },
        },
        activeToken,
      )

      await studioApi.patchOffer(bizId, text(offerOne.id), { isPublished: true, status: 'active' }, activeToken)
      await studioApi.patchOffer(bizId, text(offerTwo.id), { isPublished: true, status: 'active' }, activeToken)

      for (const dayOfWeek of [1, 2, 3, 4, 5]) {
        await studioApi.createAvailabilityRule(
          bizId,
          calendarId,
          {
            name: `Weekday hours ${dayOfWeek}`,
            mode: 'recurring',
            frequency: 'weekly',
            dayOfWeek,
            startTime: '09:00',
            endTime: '17:00',
            action: 'available',
            priority: 100,
            isActive: true,
          },
          activeToken,
        )
      }

      for (const dayOfWeek of [0, 6]) {
        await studioApi.createAvailabilityRule(
          bizId,
          calendarId,
          {
            name: `Weekend closed ${dayOfWeek}`,
            mode: 'recurring',
            frequency: 'weekly',
            dayOfWeek,
            startTime: '00:00',
            endTime: '23:59',
            action: 'unavailable',
            priority: 10,
            isActive: true,
          },
          activeToken,
        )
      }

      setSelectedBizId(bizId)
      setSelectedCalendarId(calendarId)
      setSelectedOfferId(text(offerOne.id))
      setSelectedOfferVersionId(text(offerOneVersion.id))
      setSuccess('Smart defaults are ready. You can start booking now.')

      await loadBizes()
      await loadBizContext(bizId)
      await loadCalendarData(calendarId)
    })
  }

  async function loadOfferAvailability() {
    if (!selectedBizId || !selectedOfferId) {
      setError('Select a biz and an offer first.')
      return
    }
    const result = await withBusy('booking.slots', () => studioApi.getPublicOfferAvailability(selectedBizId, selectedOfferId, 24))
    if (!result) return
    const nextSlots = findSlots(result)
    setSlots(nextSlots)
    setSelectedSlotStartAt(nextSlots[0]?.startAt ?? '')
    setSuccess(`Loaded ${nextSlots.length} slots.`)
  }

  async function createBooking() {
    if (!activeToken || !activeActor) {
      setError('Choose a customer actor and mint a token first.')
      return
    }
    if (!selectedBizId || !selectedOfferId || !selectedOfferVersionId || !selectedSlotStartAt) {
      setError('Select offer, version, and slot first.')
      return
    }

    await withBusy('booking.create', async () => {
      const durationMin = numberValue(selectedOfferVersion?.defaultDurationMin, 60)
      const basePriceMinor = numberValue(selectedOfferVersion?.basePriceMinor, 10000)
      const startAt = selectedSlotStartAt
      const endAt = plusMinutes(startAt, durationMin)
      const locationId = text(locations[0]?.id)

      const created = asRecord(
        await studioApi.createPublicBooking(
          selectedBizId,
          {
            offerId: selectedOfferId,
            offerVersionId: selectedOfferVersionId,
            status: 'awaiting_payment',
            currency: text(selectedOfferVersion?.currency, 'USD'),
            subtotalMinor: basePriceMinor,
            taxMinor: 0,
            feeMinor: 0,
            discountMinor: 0,
            totalMinor: basePriceMinor,
            requestedStartAt: startAt,
            requestedEndAt: endAt,
            confirmedStartAt: startAt,
            confirmedEndAt: endAt,
            locationId,
            metadata: {
              source: 'experience_ui',
              actorEmail: activeActor.email,
            },
          },
          activeToken,
        ),
      )

      setBookingOrder(created)

      const messages = await studioApi.listOutboundMessages(
        selectedBizId,
        { bookingOrderId: text(created.id) },
        activeToken,
      )
      setBookingMessages(asArray(messages))
      setSuccess('Booking created.')
    })
  }

  async function payBooking(kind: 'advanced' | 'stripe') {
    if (!activeToken || !selectedBizId || !bookingOrder) {
      setError('Create a booking first.')
      return
    }
    const bookingOrderId = text(bookingOrder.id)
    if (!bookingOrderId) {
      setError('Invalid booking order id.')
      return
    }

    await withBusy(`booking.pay.${kind}`, async () => {
      if (kind === 'advanced') {
        await studioApi.payPublicBookingAdvanced(
          selectedBizId,
          bookingOrderId,
          {
            currency: text(bookingOrder.currency, 'USD'),
            tenders: [{ provider: 'cash', amountMinor: numberValue(bookingOrder.totalMinor, 0) }],
            metadata: { source: 'experience_ui' },
          },
          activeToken,
        )
      } else {
        await studioApi.createPublicStripePaymentIntent(
          selectedBizId,
          bookingOrderId,
          {
            confirmNow: true,
            amountMinor: numberValue(bookingOrder.totalMinor, 0),
            tipMinor: 0,
            metadata: { source: 'experience_ui' },
          },
          activeToken,
        )
      }

      const messages = await studioApi.listOutboundMessages(
        selectedBizId,
        { bookingOrderId },
        activeToken,
      )
      setBookingMessages(asArray(messages))
      setSuccess(kind === 'stripe' ? 'Stripe payment intent created.' : 'Payment captured.')
    })
  }

  async function addAvailabilityRule(body: Record<string, unknown>) {
    if (!selectedBizId || !selectedCalendarId || !activeToken) {
      setError('Select biz + calendar first.')
      return
    }
    await withBusy('rules.create', async () => {
      await studioApi.createAvailabilityRule(selectedBizId, selectedCalendarId, body, activeToken)
      const rows = await studioApi.listAvailabilityRules(selectedBizId, selectedCalendarId, activeToken)
      setAvailabilityRules(asArray(rows))
      setSuccess('Availability rule saved.')
    })
  }

  async function deactivateAvailabilityRule(ruleId: string) {
    if (!selectedBizId || !selectedCalendarId || !activeToken || !ruleId) return
    await withBusy('rules.deactivate', async () => {
      await studioApi.deactivateAvailabilityRule(selectedBizId, selectedCalendarId, ruleId, activeToken)
      const rows = await studioApi.listAvailabilityRules(selectedBizId, selectedCalendarId, activeToken)
      setAvailabilityRules(asArray(rows))
      setSuccess('Availability rule deactivated.')
    })
  }

  const featureToggles: FeatureToggleItem[] = [
    {
      key: 'actorLab',
      label: 'Actor Impersonation Lab',
      description: 'Create users and switch context as owner, member, host, or customer.',
      enabled: visiblePanels.actorLab,
      hotkey: '/ actors',
    },
    {
      key: 'entityExplorer',
      label: 'Entity Explorer',
      description: 'Inspect every biz/location/calendar/service/offer and switch quickly.',
      enabled: visiblePanels.entityExplorer,
      hotkey: '/ entities',
    },
    {
      key: 'availabilityLab',
      label: 'Availability Controls',
      description: 'Manage granular calendar rules for hours, blackout windows, pricing, and capacity.',
      enabled: visiblePanels.availabilityLab,
      hotkey: '/ availability',
    },
    {
      key: 'apiTrace',
      label: 'API Request Trace',
      description: 'See request URL, method, body, and response payload for every action.',
      enabled: visiblePanels.apiTrace,
      hotkey: '/ trace',
    },
    {
      key: 'rawData',
      label: 'Raw Data JSON',
      description: 'Inspect raw payloads for timeline, bookings, and outbound messages.',
      enabled: visiblePanels.rawData,
      hotkey: '/ json',
    },
  ]

  const featureActions: FeatureActionItem[] = [
    {
      key: 'seedDefaults',
      label: 'Quick Start Workspace',
      description: 'Create default biz, location, host, calendar, and two offers with weekday rules.',
    },
    {
      key: 'seedActors',
      label: 'Seed Starter Actors',
      description: 'Create owner and customer actors automatically.',
    },
    {
      key: 'loadSlots',
      label: 'Load Offer Slots',
      description: 'Refresh publicly visible availability slots for selected offer.',
    },
    {
      key: 'hideAdvanced',
      label: 'Hide Advanced Panels',
      description: 'Return to the simple default view.',
    },
  ]

  function toggleVisibility(featureKey: string) {
    if (!Object.prototype.hasOwnProperty.call(visiblePanels, featureKey)) return
    setVisiblePanels((prev) => ({ ...prev, [featureKey as VisibilityKey]: !prev[featureKey as VisibilityKey] }))
  }

  async function runFeatureAction(actionKey: string) {
    if (actionKey === 'seedDefaults') {
      await createDefaultWorkspace()
      return
    }
    if (actionKey === 'seedActors') {
      await ensureStarterActors()
      return
    }
    if (actionKey === 'loadSlots') {
      await loadOfferAvailability()
      return
    }
    if (actionKey === 'hideAdvanced') {
      setVisiblePanels({ actorLab: false, entityExplorer: false, availabilityLab: false, apiTrace: false, rawData: false })
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return
    void loadActors()
  }, [isAuthenticated])

  useEffect(() => {
    if (!activeActorId) return
    if (tokens[activeActorId]) return
    void mintToken(activeActorId)
  }, [activeActorId])

  useEffect(() => {
    if (!activeToken) return
    void loadBizes()
  }, [activeToken])

  useEffect(() => {
    if (!selectedBizId || !activeToken) return
    void loadBizContext(selectedBizId)
  }, [selectedBizId, activeToken])

  useEffect(() => {
    if (!selectedCalendarId || !selectedBizId || !activeToken) return
    void loadCalendarData(selectedCalendarId)
  }, [selectedCalendarId, selectedBizId, activeToken, calendarLens])

  useEffect(() => {
    if (!selectedOfferId) {
      setSelectedOfferVersionId('')
      return
    }
    const first = offerVersionsByOffer[selectedOfferId]?.[0]
    if (first) setSelectedOfferVersionId(text(first.id))
  }, [selectedOfferId, offerVersionsByOffer])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center p-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>You need a session before testing customer-facing flows.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/sign-in">
              <Button>Go to sign in</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const selectedTrace = apiTraces[selectedTraceIndex] ?? null

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <FeatureDiscoveryCommand
        open={featureCommandOpen}
        onOpenChange={setFeatureCommandOpen}
        toggles={featureToggles}
        actions={featureActions}
        onToggle={toggleVisibility}
        onAction={(key) => {
          setFeatureCommandOpen(false)
          void runFeatureAction(key)
        }}
      />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Bizing Experience</h1>
            <p className="text-sm text-muted-foreground">
              Simple by default. Use slash discovery to reveal advanced controls only when needed.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">Signed in as {user?.email ?? 'unknown'}</Badge>
              <Badge variant="outline">Press / for discovery</Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setFeatureCommandOpen(true)}>
              <Command className="mr-2 h-4 w-4" />
              Discover
            </Button>
            <Button variant="secondary" onClick={() => void createDefaultWorkspace()} disabled={busyKey !== null}>
              <Rocket className="mr-2 h-4 w-4" />
              Quick start
            </Button>
          </div>
        </div>

        {error ? (
          <Card className="border-destructive/60">
            <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}
        {success ? (
          <Card className="border-emerald-500/50">
            <CardContent className="py-3 text-sm text-emerald-600 dark:text-emerald-400">{success}</CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="h-4 w-4" />
                Active Actor
              </CardTitle>
              <CardDescription>
                Switch perspective for owner/member/customer testing without sign-out.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Actor</Label>
                <Select value={activeActorId || undefined} onValueChange={setActiveActorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select actor" />
                  </SelectTrigger>
                  <SelectContent>
                    {actors.map((actor) => (
                      <SelectItem key={actor.id} value={actor.id}>
                        {actor.name} ({actor.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-md border p-3 text-xs text-muted-foreground">
                {activeActor ? (
                  <>
                    <p className="font-medium text-foreground">{activeActor.name}</p>
                    <p>{activeActor.email}</p>
                    <p>role: {activeActor.role}</p>
                    <p>token: {tokens[activeActor.id] ? 'ready' : 'not minted'}</p>
                  </>
                ) : (
                  <p>No actor selected yet.</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="w-full" onClick={() => void loadActors()} disabled={busyKey !== null}>
                  Refresh actors
                </Button>
                <Button className="w-full" onClick={() => activeActorId && void mintToken(activeActorId)} disabled={!activeActorId || busyKey !== null}>
                  Mint token
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BadgeCheck className="h-4 w-4" />
                Current Biz
              </CardTitle>
              <CardDescription>
                Pick the business context where this actor is operating.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Biz</Label>
                <Select value={selectedBizId || undefined} onValueChange={setSelectedBizId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select biz" />
                  </SelectTrigger>
                  <SelectContent>
                    {bizes.map((biz) => (
                      <SelectItem key={text(biz.id)} value={text(biz.id)}>
                        {text(biz.name, text(biz.slug, text(biz.id)))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-md border p-3 text-xs text-muted-foreground">
                {selectedBiz ? (
                  <>
                    <p className="font-medium text-foreground">{text(selectedBiz.name, 'Unnamed biz')}</p>
                    <p>timezone: {text(selectedBiz.timezone, 'unknown')}</p>
                    <p>currency: {text(selectedBiz.currency, 'USD')}</p>
                  </>
                ) : (
                  <p>No biz selected yet.</p>
                )}
              </div>
              <Button variant="outline" className="w-full" onClick={() => void loadBizes()} disabled={!activeToken || busyKey !== null}>
                Refresh bizes
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" />
                First View
              </CardTitle>
              <CardDescription>
                Keep it minimal: setup defaults, pick an offer, choose a slot, and book.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>1. Create quick defaults</p>
              <p>2. Load available slots</p>
              <p>3. Create booking as customer</p>
              <p>4. Pay via advanced flow or Stripe</p>
              <Button className="mt-1 w-full" onClick={() => setFeatureCommandOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Open discovery
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Simple Booking Flow</CardTitle>
            <CardDescription>
              Designed to feel simpler than complex scheduler dashboards while still using full platform power.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Offer</Label>
                <Select value={selectedOfferId || undefined} onValueChange={setSelectedOfferId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select offer" />
                  </SelectTrigger>
                  <SelectContent>
                    {publicOffers.map((offer) => (
                      <SelectItem key={text(offer.id)} value={text(offer.id)}>
                        {text(offer.name, text(offer.slug, text(offer.id)))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Offer version</Label>
                <Select value={selectedOfferVersionId || undefined} onValueChange={setSelectedOfferVersionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedOfferVersions.map((version) => (
                      <SelectItem key={text(version.id)} value={text(version.id)}>
                        v{String(version.version ?? '?')} • {text(version.status, 'unknown')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Selected slot</Label>
                <Select value={selectedSlotStartAt || undefined} onValueChange={setSelectedSlotStartAt}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {slots.map((slot) => (
                      <SelectItem key={slot.startAt} value={slot.startAt}>
                        {formatDateTime(slot.startAt)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button className="w-full" variant="secondary" onClick={() => void loadOfferAvailability()} disabled={!selectedOfferId || busyKey !== null}>
                  <CalendarClock className="mr-2 h-4 w-4" />
                  Load slots
                </Button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <Button onClick={() => void createBooking()} disabled={!activeToken || !selectedSlotStartAt || busyKey !== null}>
                Create booking
              </Button>
              <Button variant="outline" onClick={() => void payBooking('advanced')} disabled={!bookingOrder || busyKey !== null}>
                Pay (advanced)
              </Button>
              <Button variant="outline" onClick={() => void payBooking('stripe')} disabled={!bookingOrder || busyKey !== null}>
                Pay (Stripe)
              </Button>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">Booking summary</p>
                {bookingOrder ? (
                  <div className="mt-2 space-y-1 text-muted-foreground">
                    <p>id: {text(bookingOrder.id)}</p>
                    <p>status: {text(bookingOrder.status)}</p>
                    <p>total: {String(bookingOrder.totalMinor ?? 0)} {text(bookingOrder.currency, 'USD')}</p>
                    <p>start: {text(bookingOrder.confirmedStartAt, text(bookingOrder.requestedStartAt)) || '-'}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-muted-foreground">No booking created yet.</p>
                )}
              </div>
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">Messages sent to user</p>
                {bookingMessages.length === 0 ? (
                  <p className="mt-2 text-muted-foreground">No outbound messages yet.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {bookingMessages.slice(0, 5).map((row) => (
                      <div key={text(row.id)} className="rounded-sm border p-2">
                        <p className="font-medium">{text(row.channel).toUpperCase()} • {text(row.status, 'queued')}</p>
                        <p className="text-xs text-muted-foreground">{text(row.subject, text(row.templateSlug, 'message'))}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(text(row.createdAt))}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <CalendarTimelineView
          lens={calendarLens}
          onLensChange={(next) => setCalendarLens(next as LensMode)}
          timeline={timeline}
        />

        {visiblePanels.availabilityLab ? (
          <AvailabilityRuleManager
            rules={availabilityRules}
            creating={busyKey === 'rules.create'}
            onCreateRule={addAvailabilityRule}
            onDeactivateRule={deactivateAvailabilityRule}
          />
        ) : null}

        {visiblePanels.actorLab ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actor Lab</CardTitle>
              <CardDescription>
                Create and impersonate users so you can test UI behavior from each role perspective.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input
                    value={createActorForm.name}
                    onChange={(event) => setCreateActorForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Alex Customer"
                  />
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                  <Label>Email</Label>
                  <Input
                    value={createActorForm.email}
                    onChange={(event) => setCreateActorForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="alex@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select
                    value={createActorForm.role}
                    onValueChange={(value) => setCreateActorForm((prev) => ({ ...prev, role: value as ActorRole }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">owner</SelectItem>
                      <SelectItem value="admin">admin</SelectItem>
                      <SelectItem value="manager">manager</SelectItem>
                      <SelectItem value="staff">staff</SelectItem>
                      <SelectItem value="host">host</SelectItem>
                      <SelectItem value="customer">customer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void createActor()} disabled={busyKey !== null}>Create actor</Button>
                <Button variant="outline" onClick={() => void ensureStarterActors()} disabled={busyKey !== null}>
                  Seed owner + customer
                </Button>
              </div>
              <ScrollArea className="h-64 rounded-md border p-2">
                <div className="space-y-2">
                  {actors.map((actor) => (
                    <div key={actor.id} className="flex items-center justify-between rounded-md border p-2">
                      <div>
                        <p className="text-sm font-medium">{actor.name}</p>
                        <p className="text-xs text-muted-foreground">{actor.email} • {actor.role}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setActiveActorId(actor.id)}>
                          Use
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => void mintToken(actor.id)}>
                          Mint token
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : null}

        {visiblePanels.entityExplorer ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Entity Explorer</CardTitle>
              <CardDescription>
                Switch between all current bizes, locations, hosts, calendars, services, and offers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="bizes">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="bizes">Bizes</TabsTrigger>
                  <TabsTrigger value="locations">Locations</TabsTrigger>
                  <TabsTrigger value="resources">Resources</TabsTrigger>
                  <TabsTrigger value="calendars">Calendars</TabsTrigger>
                  <TabsTrigger value="services">Services</TabsTrigger>
                  <TabsTrigger value="offers">Offers</TabsTrigger>
                </TabsList>
                <TabsContent value="bizes" className="mt-3 space-y-2">
                  {bizes.map((biz) => (
                    <div key={text(biz.id)} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <div>
                        <p className="font-medium">{text(biz.name, text(biz.slug, text(biz.id)))}</p>
                        <p className="text-xs text-muted-foreground">{text(biz.id)}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setSelectedBizId(text(biz.id))}>Select</Button>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="locations" className="mt-3 space-y-2">
                  {locations.map((row) => (
                    <div key={text(row.id)} className="rounded-md border p-2 text-sm">
                      <p className="font-medium">{text(row.name, text(row.slug, text(row.id)))}</p>
                      <p className="text-xs text-muted-foreground">{text(row.id)}</p>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="resources" className="mt-3 space-y-2">
                  {resources.map((row) => (
                    <div key={text(row.id)} className="rounded-md border p-2 text-sm">
                      <p className="font-medium">{text(row.name, text(row.slug, text(row.id)))}</p>
                      <p className="text-xs text-muted-foreground">{text(row.type)} • {text(row.id)}</p>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="calendars" className="mt-3 space-y-2">
                  {calendars.map((row) => (
                    <div key={text(row.id)} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <div>
                        <p className="font-medium">{text(row.name, text(row.id))}</p>
                        <p className="text-xs text-muted-foreground">{text(row.id)}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setSelectedCalendarId(text(row.id))}>Lens this</Button>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="services" className="mt-3 space-y-2">
                  {services.map((row) => (
                    <div key={text(row.id)} className="rounded-md border p-2 text-sm">
                      <p className="font-medium">{text(row.name, text(row.slug, text(row.id)))}</p>
                      <p className="text-xs text-muted-foreground">{text(row.id)}</p>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="offers" className="mt-3 space-y-2">
                  {publicOffers.map((row) => (
                    <div key={text(row.id)} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <div>
                        <p className="font-medium">{text(row.name, text(row.slug, text(row.id)))}</p>
                        <p className="text-xs text-muted-foreground">{text(row.id)}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setSelectedOfferId(text(row.id))}>Use in flow</Button>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : null}

        {visiblePanels.apiTrace ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">API Trace</CardTitle>
              <CardDescription>
                Every UI action here calls real endpoints. Inspect exact URL, request, and response.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-md border p-3 text-sm">
                  <p className="text-muted-foreground">Requests captured</p>
                  <p className="text-2xl font-semibold">{apiTraces.length}</p>
                </div>
                <div className="rounded-md border p-3 text-sm">
                  <p className="text-muted-foreground">Last status</p>
                  <p className="text-2xl font-semibold">{selectedTrace ? selectedTrace.status : '-'}</p>
                </div>
                <div className="rounded-md border p-3 text-sm">
                  <p className="text-muted-foreground">Last endpoint</p>
                  <p className="truncate text-sm font-medium">{selectedTrace?.path ?? '-'}</p>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                <ScrollArea className="h-[320px] rounded-md border p-2">
                  <div className="space-y-2">
                    {apiTraces.map((trace, index) => (
                      <button
                        key={`${trace.at}-${trace.path}-${index}`}
                        type="button"
                        className="w-full rounded-md border p-2 text-left text-xs hover:bg-muted"
                        onClick={() => setSelectedTraceIndex(index)}
                      >
                        <p className="font-medium">{trace.method} {trace.path}</p>
                        <p className="text-muted-foreground">{trace.status} • {trace.durationMs}ms</p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
                <div className="lg:col-span-2 rounded-md border p-2">
                  {selectedTrace ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        {selectedTrace.method} {selectedTrace.path} • {selectedTrace.status} • {selectedTrace.durationMs}ms
                      </p>
                      <Separator />
                      <div className="grid gap-2 lg:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs font-medium">Request</p>
                          <div className="max-h-[360px] overflow-auto rounded border p-2">
                            <ReactJson src={(selectedTrace.requestBody as object) ?? {}} name={false} collapsed={2} enableClipboard={false} displayDataTypes={false} />
                          </div>
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-medium">Response</p>
                          <div className="max-h-[360px] overflow-auto rounded border p-2">
                            <ReactJson src={(selectedTrace.responseBody as object) ?? {}} name={false} collapsed={2} enableClipboard={false} displayDataTypes={false} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Run a flow to generate traces.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {visiblePanels.rawData ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Raw Data</CardTitle>
              <CardDescription>Optional deep inspection for timeline, slots, booking, and messages.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="timeline">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="slots">Slots</TabsTrigger>
                  <TabsTrigger value="booking">Booking</TabsTrigger>
                  <TabsTrigger value="messages">Messages</TabsTrigger>
                </TabsList>
                <TabsContent value="timeline" className="mt-3 rounded-md border p-2">
                  <ReactJson src={(timeline as object) ?? {}} name={false} collapsed={2} enableClipboard={false} displayDataTypes={false} />
                </TabsContent>
                <TabsContent value="slots" className="mt-3 rounded-md border p-2">
                  <ReactJson src={(slots as object) ?? []} name={false} collapsed={2} enableClipboard={false} displayDataTypes={false} />
                </TabsContent>
                <TabsContent value="booking" className="mt-3 rounded-md border p-2">
                  <ReactJson src={(bookingOrder as object) ?? {}} name={false} collapsed={2} enableClipboard={false} displayDataTypes={false} />
                </TabsContent>
                <TabsContent value="messages" className="mt-3 rounded-md border p-2">
                  <ReactJson src={(bookingMessages as object) ?? []} name={false} collapsed={2} enableClipboard={false} displayDataTypes={false} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-3.5 w-3.5" />
              Start simple, then discover complexity only when you need it.
            </div>
            <div className="flex items-center gap-2">
              <Link href="/ooda/studio" className="underline">
                Open full Operations Studio
              </Link>
              <span>•</span>
              <Link href="/ooda/api" className="underline">
                Open API Explorer
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
