'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, addWeeks, endOfDay, format, isSameDay, startOfDay, startOfWeek, subWeeks } from 'date-fns'
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Loader2,
  Moon,
  Search,
  Sparkles,
  Sun,
  Wrench,
} from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { useTheme } from '@/components/ThemeProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { studioApi } from '@/lib/studio-api'
import { asArray, asRecord, numberValue, text, type JsonMap } from './types'

type SagaScreen = 'owner_dashboard' | 'business_directory' | 'analytics_dashboard' | 'booking_details'

type ScheduleEvent = {
  id: string
  title: string
  subtitle: string
  startAt: Date
  endAt: Date
  sourceType: string
  state: string
}

type PublicSlot = {
  startAt: string
  endAt: string
}

type SagaPhase = {
  key: string
  title: string
  done: boolean
}

const GRID_START_HOUR = 8
const GRID_END_HOUR = 19
const ROW_HEIGHT_PX = 56
const GRID_TOTAL_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60
const HOUR_ROWS = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, index) => GRID_START_HOUR + index)

const SCREEN_ITEMS: Array<{ key: SagaScreen; label: string; icon: typeof BookOpen; customerStep: string }> = [
  { key: 'business_directory', label: 'Business Directory', icon: Building2, customerStep: 'Business selection' },
  { key: 'owner_dashboard', label: 'Choose Time', icon: CalendarDays, customerStep: 'Date and time selection' },
  { key: 'booking_details', label: 'Booking Details', icon: ClipboardList, customerStep: 'Booking review' },
  { key: 'analytics_dashboard', label: 'Confirmation', icon: BarChart3, customerStep: 'Confirmation' },
]

function hourLabel(hour24: number) {
  const suffix = hour24 >= 12 ? 'pm' : 'am'
  const base = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${base} ${suffix}`
}

function parseEventDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function displayTimeRange(start: Date, end: Date) {
  return `${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`
}

function bookingStartAt(row: JsonMap) {
  return text(row.confirmedStartAt, text(row.requestedStartAt))
}

function bookingEndAt(row: JsonMap) {
  return text(row.confirmedEndAt, text(row.requestedEndAt))
}

function formatMoney(minor: number, currency = 'USD') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(minor / 100)
}

function parseTimelineEvents(timeline: unknown): ScheduleEvent[] {
  const root = asRecord(timeline)

  const projectionRows = asArray(root.timelineEvents)
  if (projectionRows.length > 0) {
    return projectionRows
      .map((row, index) => {
        const payload = asRecord(row.payload)
        const startAt = parseEventDate(text(row.startAt))
        const endAt = parseEventDate(text(row.endAt))
        if (!startAt || !endAt || endAt <= startAt) return null

        const sourceType = text(row.sourceType, text(payload.sourceType, 'event'))
        const title = text(row.title, text(payload.title, sourceType === 'fulfillment' ? 'Booking' : 'Calendar event'))
        const subtitle = text(row.summary, text(payload.summary, sourceType))

        return {
          id: text(row.id, `timeline-${index}`),
          title,
          subtitle,
          startAt,
          endAt,
          sourceType,
          state: text(row.state, 'unknown'),
        } satisfies ScheduleEvent
      })
      .filter((row): row is ScheduleEvent => row !== null)
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
  }

  const bookingRows = asArray(root.bookings)
  return bookingRows
    .map((row, index) => {
      const startAt = parseEventDate(text(row.startAt, text(row.confirmedStartAt, text(row.requestedStartAt))))
      const endAt = parseEventDate(text(row.endAt, text(row.confirmedEndAt, text(row.requestedEndAt))))
      if (!startAt || !endAt || endAt <= startAt) return null

      return {
        id: text(row.id, `booking-${index}`),
        title: text(row.title, text(row.status, 'Booking')),
        subtitle: text(row.summary, 'Fulfillment booking'),
        startAt,
        endAt,
        sourceType: 'fulfillment',
        state: text(row.state, 'busy'),
      } satisfies ScheduleEvent
    })
    .filter((row): row is ScheduleEvent => row !== null)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
}

function eventCardClasses(event: ScheduleEvent) {
  if (event.sourceType === 'capacity_hold' || event.state === 'blocked') {
    return 'border-red-300 bg-red-100/95 text-red-900 dark:border-red-700 dark:bg-red-950/60 dark:text-red-200'
  }
  if (event.sourceType === 'availability_rule') {
    return 'border-emerald-300 bg-emerald-100/95 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200'
  }
  return 'border-sky-300 bg-sky-100/95 text-sky-900 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-200'
}

function bookingStatusTone(status: string) {
  if (status === 'completed') return 'default' as const
  if (status === 'cancelled') return 'destructive' as const
  if (status === 'in_progress' || status === 'checked_in') return 'secondary' as const
  return 'outline' as const
}

function humanize(value: string) {
  return value.replaceAll('_', ' ')
}

function compactId(value: string) {
  if (!value) return '-'
  if (value.length <= 14) return value
  return `${value.slice(0, 7)}...${value.slice(-4)}`
}

function plusMinutes(iso: string, minutes: number) {
  const d = new Date(iso)
  return new Date(d.getTime() + minutes * 60 * 1000).toISOString()
}

function slotDateKey(iso: string) {
  return format(new Date(iso), 'yyyy-MM-dd')
}

function ThemeToggle() {
  const { setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Sun className="h-[1.15rem] w-[1.15rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.15rem] w-[1.15rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>Dark</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function CustomersDashboardPage({ mode = 'dev' }: { mode?: 'dev' | 'customer' }) {
  const { isAuthenticated, isLoading, user, activeBizId } = useAuth()

  const [screen, setScreen] = useState<SagaScreen>('business_directory')
  const [cursor, setCursor] = useState(() => new Date())
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)

  const [bizes, setBizes] = useState<JsonMap[]>([])
  const [selectedBizId, setSelectedBizId] = useState('')
  const [selectedCalendarId, setSelectedCalendarId] = useState('')
  const [selectedBookingId, setSelectedBookingId] = useState('')
  const [directoryQuery, setDirectoryQuery] = useState('')

  const [locations, setLocations] = useState<JsonMap[]>([])
  const [resources, setResources] = useState<JsonMap[]>([])
  const [calendars, setCalendars] = useState<JsonMap[]>([])
  const [offers, setOffers] = useState<JsonMap[]>([])
  const [publicOffers, setPublicOffers] = useState<JsonMap[]>([])
  const [selectedOfferId, setSelectedOfferId] = useState('')
  const [selectedOfferVersionId, setSelectedOfferVersionId] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [publicSlots, setPublicSlots] = useState<PublicSlot[]>([])
  const [selectedSlotDate, setSelectedSlotDate] = useState('')
  const [selectedSlotStartAt, setSelectedSlotStartAt] = useState('')
  const [selectedWalkUpOffer, setSelectedWalkUpOffer] = useState<JsonMap | null>(null)
  const [crmContacts, setCrmContacts] = useState<JsonMap[]>([])
  const [bookings, setBookings] = useState<JsonMap[]>([])
  const [calendarTimeline, setCalendarTimeline] = useState<unknown>(null)

  const [isLoadingBizes, setIsLoadingBizes] = useState(false)
  const [isLoadingContext, setIsLoadingContext] = useState(false)
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [isCreatingBooking, setIsCreatingBooking] = useState(false)
  const [isCreatingStripeIntent, setIsCreatingStripeIntent] = useState(false)
  const [isCreatingCalendar, setIsCreatingCalendar] = useState(false)
  const [didAutoSelectBizWithCalendar, setDidAutoSelectBizWithCalendar] = useState(false)
  const [latestStripeIntent, setLatestStripeIntent] = useState<JsonMap | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [customerBizSearch, setCustomerBizSearch] = useState('')

  const ownerName = useMemo(() => {
    const name = text(user?.name)
    if (name) return name
    const email = text(user?.email)
    if (!email) return 'Owner'
    return email.split('@')[0] || 'Owner'
  }, [user?.email, user?.name])
  useEffect(() => {
    if (mode !== 'customer') {
      setCustomerBizSearch('')
      return
    }
    if (typeof window === 'undefined') return
    const query = new URLSearchParams(window.location.search).get('search') ?? ''
    setCustomerBizSearch(query.trim())
  }, [mode])

  const selectedBiz = useMemo(
    () => bizes.find((row) => text(row.id) === selectedBizId) ?? null,
    [bizes, selectedBizId],
  )

  const selectedCalendar = useMemo(
    () => calendars.find((row) => text(row.id) === selectedCalendarId) ?? calendars[0] ?? null,
    [calendars, selectedCalendarId],
  )

  const weekStart = useMemo(() => startOfWeek(cursor, { weekStartsOn: 0 }), [cursor])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart])
  const weekRangeLabel = `${format(weekDays[0], 'MMM d')} - ${format(weekDays[6], 'MMM d, yyyy')}`

  const timelineEvents = useMemo(() => parseTimelineEvents(calendarTimeline), [calendarTimeline])
  const eventsByDay = useMemo(
    () =>
      weekDays.map((day) =>
        timelineEvents
          .filter((event) => isSameDay(day, event.startAt))
          .sort((a, b) => a.startAt.getTime() - b.startAt.getTime()),
      ),
    [timelineEvents, weekDays],
  )

  const selectedDay = weekDays[selectedDayIndex] ?? weekDays[0]
  const selectedDayEvents = eventsByDay[selectedDayIndex] ?? []

  const gridHeight = HOUR_ROWS.length * ROW_HEIGHT_PX

  const selectedBooking = useMemo(
    () => bookings.find((row) => text(row.id) === selectedBookingId) ?? bookings[0] ?? null,
    [bookings, selectedBookingId],
  )

  const selectedPublicOffer = useMemo(
    () => publicOffers.find((row) => text(row.id) === selectedOfferId) ?? null,
    [publicOffers, selectedOfferId],
  )

  const selectedSlot = useMemo(
    () => publicSlots.find((slot) => slot.startAt === selectedSlotStartAt) ?? null,
    [publicSlots, selectedSlotStartAt],
  )

  const availableSlotDates = useMemo(() => {
    const unique = new Set(publicSlots.map((slot) => slotDateKey(slot.startAt)))
    return Array.from(unique).sort()
  }, [publicSlots])

  const visibleSlots = useMemo(() => {
    if (!selectedSlotDate) return publicSlots
    return publicSlots.filter((slot) => slotDateKey(slot.startAt) === selectedSlotDate)
  }, [publicSlots, selectedSlotDate])

  const completedRevenueMinor = useMemo(
    () =>
      bookings.reduce((sum, row) => {
        if (text(row.status) !== 'completed') return sum
        return sum + numberValue(row.totalMinor, 0)
      }, 0),
    [bookings],
  )

  const bookingsByStatus = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of bookings) {
      const key = text(row.status, 'unknown')
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [bookings])

  const sagaPhases = useMemo(() => {
    const bootstrapDone = Boolean(selectedBizId) && locations.length > 0 && resources.length > 0 && calendars.length > 0
    const serviceDone = offers.length > 0 || publicOffers.length > 0
    const discoveryDone = (offers.length > 0 || publicOffers.length > 0) && bizes.length > 0
    const bookingDone = bookings.length > 0
    const fulfillmentDone = bookings.some((row) => ['checked_in', 'in_progress', 'completed'].includes(text(row.status)))
    const edgeDone = bookings.some((row) => text(row.status) === 'cancelled') || bookings.length >= 2
    const analyticsDone = bookings.length > 0 || timelineEvents.length > 0

    return [
      { key: 'phase-1', title: 'Bootstrap', done: bootstrapDone },
      { key: 'phase-2', title: 'Service Setup', done: serviceDone },
      { key: 'phase-3', title: 'Client Discovery', done: discoveryDone },
      { key: 'phase-4', title: 'Booking', done: bookingDone },
      { key: 'phase-5', title: 'Fulfillment', done: fulfillmentDone },
      { key: 'phase-6', title: 'Edge Cases', done: edgeDone },
      { key: 'phase-7', title: 'Analytics', done: analyticsDone },
    ] satisfies SagaPhase[]
  }, [bizes.length, bookings, calendars.length, locations.length, offers.length, publicOffers.length, resources.length, selectedBizId, timelineEvents.length])

  const completedPhaseCount = useMemo(
    () => sagaPhases.filter((phase) => phase.done).length,
    [sagaPhases],
  )

  const directoryRows = useMemo(() => {
    const query = directoryQuery.trim().toLowerCase()
    if (!query) return bizes
    return bizes.filter((row) => {
      const name = text(row.name).toLowerCase()
      const slug = text(row.slug).toLowerCase()
      const id = text(row.id).toLowerCase()
      return name.includes(query) || slug.includes(query) || id.includes(query)
    })
  }, [bizes, directoryQuery])

  const findBizWithCalendar = useCallback(
    async (excludeBizId: string) => {
      const candidateBizIds = bizes
        .map((row) => text(row.id))
        .filter((bizId) => bizId && bizId !== excludeBizId)
        .slice(0, 40)

      for (const bizId of candidateBizIds) {
        try {
          const rows = asArray(await studioApi.listCalendars(bizId))
          if (rows.length > 0) return bizId
        } catch {
          // continue
        }
      }
      return null
    },
    [bizes],
  )

  const findBookableCustomerBiz = useCallback(
    async (excludeBizId: string) => {
      const candidateBizIds = bizes
        .map((row) => text(row.id))
        .filter((bizId) => bizId && bizId !== excludeBizId)
        .slice(0, 40)

      let firstWithOffer: string | null = null
      for (const bizId of candidateBizIds) {
        try {
          const offers = asArray(await studioApi.listPublicOffers(bizId))
          if (offers.length === 0) continue
          if (!firstWithOffer) firstWithOffer = bizId

          const offerId = text(offers[0]?.id)
          if (!offerId) continue
          const publicLocations = asArray(await studioApi.listPublicLocations(bizId))
          const locationIds = publicLocations.map((row) => text(row.id)).filter(Boolean)
          if (locationIds.length === 0) locationIds.push('')

          for (const locationId of locationIds) {
            const availability = asRecord(
              await studioApi.getPublicOfferAvailability(
                bizId,
                offerId,
                1,
                locationId ? { locationId } : undefined,
              ),
            )
            const slots = asArray(availability.slots)
            if (slots.length > 0) return bizId
          }
        } catch {
          // continue
        }
      }
      return firstWithOffer
    },
    [bizes],
  )

  const createDefaultCalendar = useCallback(async () => {
    if (!selectedBizId) return

    setIsCreatingCalendar(true)
    setError(null)
    try {
      const timezone = text(selectedBiz?.timezone, 'America/Los_Angeles')
      const created = asRecord(
        await studioApi.createCalendar(selectedBizId, {
          name: `${text(selectedBiz?.name, 'Main')} Calendar`,
          timezone,
          slotDurationMin: 50,
          slotIntervalMin: 10,
          minAdvanceBookingHours: 24,
          maxAdvanceBookingDays: 60,
          defaultMode: 'available_by_default',
        }),
      )
      const calendarId = text(created.id)

      if (calendarId) {
        for (const dayOfWeek of [1, 2, 3, 4, 5]) {
          await studioApi.createAvailabilityRule(selectedBizId, calendarId, {
            name: `Business Hours ${dayOfWeek}`,
            mode: 'recurring',
            frequency: 'weekly',
            dayOfWeek,
            startTime: '09:00',
            endTime: '17:00',
            action: 'available',
            priority: 100,
            isActive: true,
          })
        }

        let resourceId = text(resources[0]?.id)
        if (!resourceId) {
          let locationId = text(locations[0]?.id)
          if (!locationId) {
            const seededLocation = asRecord(
              await studioApi.createLocation(selectedBizId, {
                name: 'Main Location',
                slug: `main-location-${Date.now().toString(36)}`,
                type: 'physical',
                timezone,
              }),
            )
            locationId = text(seededLocation.id)
          }
          if (locationId) {
            const seededResource = asRecord(
              await studioApi.createResource(selectedBizId, {
                name: 'Default Provider',
                slug: `default-provider-${Date.now().toString(36)}`,
                type: 'host',
                status: 'active',
                locationId,
              }),
            )
            resourceId = text(seededResource.id)
          }
        }
        if (resourceId) {
          await studioApi.createCalendarBinding(selectedBizId, {
            calendarId,
            ownerType: 'resource',
            resourceId,
            isPrimary: true,
            isActive: true,
          })
        }
      }

      const refreshedCalendars = asArray(await studioApi.listCalendars(selectedBizId))
      setCalendars(refreshedCalendars)
      setSelectedCalendarId(calendarId || text(refreshedCalendars[0]?.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create default calendar.')
    } finally {
      setIsCreatingCalendar(false)
    }
  }, [locations, resources, selectedBiz?.name, selectedBiz?.timezone, selectedBizId])

  useEffect(() => {
    if (mode !== 'customer' && !isAuthenticated) return

    let cancelled = false
    const run = async () => {
      setIsLoadingBizes(true)
      setError(null)
      try {
        const rows = asArray(
          mode === 'customer'
            ? await studioApi.listPublicBizes({ limit: 200, search: customerBizSearch || undefined })
            : await studioApi.listBizes(),
        )
        if (cancelled) return
        setBizes(rows)
        setDidAutoSelectBizWithCalendar(false)

        const preferredBizId =
          (activeBizId && rows.some((row) => text(row.id) === activeBizId) ? activeBizId : '') || text(rows[0]?.id)
        setSelectedBizId(preferredBizId)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load businesses.')
      } finally {
        if (!cancelled) setIsLoadingBizes(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [activeBizId, customerBizSearch, isAuthenticated, mode])

  useEffect(() => {
    if (!selectedBizId) {
      setLocations([])
      setResources([])
      setCalendars([])
      setOffers([])
      setPublicOffers([])
      setSelectedOfferId('')
      setSelectedOfferVersionId('')
      setSelectedLocationId('')
      setPublicSlots([])
      setSelectedSlotDate('')
      setSelectedSlotStartAt('')
      setSelectedWalkUpOffer(null)
      setCrmContacts([])
      setBookings([])
      setLatestStripeIntent(null)
      setSelectedCalendarId('')
      setSelectedBookingId('')
      setCalendarTimeline(null)
      return
    }

    let cancelled = false
    const run = async () => {
      setIsLoadingContext(true)
      setError(null)

      try {
        const result = await Promise.allSettled([
          mode === 'customer' ? studioApi.listPublicLocations(selectedBizId) : studioApi.listLocations(selectedBizId),
          mode === 'customer' ? Promise.resolve([]) : studioApi.listResources(selectedBizId),
          mode === 'customer' ? Promise.resolve([]) : studioApi.listCalendars(selectedBizId),
          mode === 'customer' ? Promise.resolve([]) : studioApi.listOffers(selectedBizId),
          studioApi.listPublicOffers(selectedBizId),
          mode === 'customer' ? Promise.resolve([]) : studioApi.listCrmContacts(selectedBizId),
          mode === 'customer' ? Promise.resolve([]) : studioApi.listBookingOrders(selectedBizId),
          studioApi.listPublicBookings(selectedBizId),
        ])
        if (cancelled) return

        const pick = (index: number) => {
          const row = result[index]
          if (!row || row.status !== 'fulfilled') return []
          return asArray(row.value)
        }

        const nextLocations = pick(0)
        const nextResources = pick(1)
        const nextCalendars = pick(2)
        const nextOffers = pick(3)
        const nextPublicOffers = pick(4)
        const nextContacts = pick(5)
        const nextBookingsPrivate = pick(6)
        const nextBookingsPublic = pick(7)
        const nextBookings = mode === 'customer'
          ? nextBookingsPublic
          : (nextBookingsPrivate.length > 0 ? nextBookingsPrivate : nextBookingsPublic)

        if (!didAutoSelectBizWithCalendar && bizes.length > 1) {
          if (mode === 'customer' && nextPublicOffers.length === 0) {
            const fallbackBizId = await findBookableCustomerBiz(selectedBizId)
            if (!cancelled) {
              setDidAutoSelectBizWithCalendar(true)
              if (fallbackBizId) {
                setSelectedBizId(fallbackBizId)
                return
              }
            }
          } else if (mode !== 'customer' && nextCalendars.length === 0) {
            const fallbackBizId = await findBizWithCalendar(selectedBizId)
            if (!cancelled) {
              setDidAutoSelectBizWithCalendar(true)
              if (fallbackBizId) {
                setSelectedBizId(fallbackBizId)
                return
              }
            }
          }
        }

        setLocations(nextLocations)
        setResources(nextResources)
        setCalendars(nextCalendars)
        setOffers(nextOffers)
        setPublicOffers(nextPublicOffers)
        setCrmContacts(nextContacts)
        setBookings(nextBookings)

        setSelectedOfferId((current) => {
          if (nextPublicOffers.some((row) => text(row.id) === current)) return current
          return text(nextPublicOffers[0]?.id)
        })
        setSelectedLocationId((current) => {
          if (nextLocations.some((row) => text(row.id) === current)) return current
          return text(nextLocations[0]?.id)
        })

        setSelectedCalendarId((current) => {
          if (nextCalendars.some((row) => text(row.id) === current)) return current
          return text(nextCalendars[0]?.id)
        })

        setSelectedBookingId((current) => {
          const stillExists = nextBookings.some((row) => text(row.id) === current)
          if (stillExists) return current
          return text(nextBookings[0]?.id)
        })
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load business context.')
        }
      } finally {
        if (!cancelled) setIsLoadingContext(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [bizes.length, didAutoSelectBizWithCalendar, findBizWithCalendar, findBookableCustomerBiz, mode, selectedBizId])

  useEffect(() => {
    if (!selectedBizId || !selectedCalendarId) {
      setCalendarTimeline(null)
      return
    }

    let cancelled = false
    const run = async () => {
      setIsLoadingTimeline(true)
      setError(null)
      try {
        const timeline = await studioApi.fetchCalendarTimeline(selectedBizId, selectedCalendarId, {
          startAt: startOfDay(weekStart).toISOString(),
          endAt: endOfDay(addDays(weekStart, 6)).toISOString(),
        })
        if (!cancelled) setCalendarTimeline(timeline)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load calendar timeline.')
        }
      } finally {
        if (!cancelled) setIsLoadingTimeline(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [selectedBizId, selectedCalendarId, weekStart])

  useEffect(() => {
    setSelectedDayIndex(0)
  }, [weekStart])

  useEffect(() => {
    if (mode === 'customer' && screen === 'business_directory') {
      setScreen('owner_dashboard')
    }
  }, [mode, screen])

  useEffect(() => {
    if (!selectedBizId || !selectedOfferId) {
      setPublicSlots([])
      setSelectedSlotDate('')
      setSelectedSlotStartAt('')
      setSelectedOfferVersionId('')
      setSelectedWalkUpOffer(null)
      return
    }

    let cancelled = false
    const run = async () => {
      setIsLoadingSlots(true)
      setError(null)
      try {
        const loadWalkUpAndAvailability = async (locationId?: string) => {
          const walkUpPayload = asRecord(
            await studioApi.getPublicOfferWalkUp(
              selectedBizId,
              selectedOfferId,
              locationId ? { locationId } : undefined,
            ),
          )
          const walkUpVersionId = text(asRecord(walkUpPayload.offerVersion).id)
          const availabilityPayload = asRecord(
            await studioApi.getPublicOfferAvailability(
              selectedBizId,
              selectedOfferId,
              40,
              walkUpVersionId
                ? { offerVersionId: walkUpVersionId, locationId: locationId || undefined }
                : { locationId: locationId || undefined },
            ),
          )
          const slots = asArray(availabilityPayload.slots)
            .map((row) => ({
              startAt: text(row.startAt),
              endAt: text(row.endAt),
            }))
            .filter((row) => row.startAt && row.endAt)
          return { walkUpPayload, availabilityPayload, slots, walkUpVersionId }
        }

        let loaded = await loadWalkUpAndAvailability(selectedLocationId || undefined)
        if (loaded.slots.length === 0 && selectedLocationId) {
          loaded = await loadWalkUpAndAvailability(undefined)
        }

        const { walkUpPayload, availabilityPayload, slots: nextSlots, walkUpVersionId } = loaded

        if (cancelled) return

        if (mode === 'customer' && nextSlots.length === 0 && !didAutoSelectBizWithCalendar && bizes.length > 1) {
          const fallbackBizId = await findBookableCustomerBiz(selectedBizId)
          if (!cancelled) {
            setDidAutoSelectBizWithCalendar(true)
            if (fallbackBizId && fallbackBizId !== selectedBizId) {
              setSelectedBizId(fallbackBizId)
              return
            }
          }
        }

        setSelectedWalkUpOffer(walkUpPayload)
        setPublicSlots(nextSlots)
        setSelectedOfferVersionId(text(availabilityPayload.offerVersionId, walkUpVersionId))
        const firstDate = nextSlots[0]?.startAt ? slotDateKey(nextSlots[0].startAt) : ''
        setSelectedSlotDate((current) => {
          if (current && nextSlots.some((slot) => slotDateKey(slot.startAt) === current)) return current
          return firstDate
        })
        setSelectedSlotStartAt((current) => {
          if (nextSlots.some((slot) => slot.startAt === current)) return current
          return nextSlots[0]?.startAt ?? ''
        })
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load public booking slots.')
        }
      } finally {
        if (!cancelled) setIsLoadingSlots(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [bizes.length, didAutoSelectBizWithCalendar, findBookableCustomerBiz, mode, selectedBizId, selectedLocationId, selectedOfferId])

  useEffect(() => {
    if (!selectedSlotDate) return
    if (selectedSlotStartAt && slotDateKey(selectedSlotStartAt) === selectedSlotDate) return
    const fallback = publicSlots.find((slot) => slotDateKey(slot.startAt) === selectedSlotDate)
    if (fallback) setSelectedSlotStartAt(fallback.startAt)
  }, [publicSlots, selectedSlotDate, selectedSlotStartAt])

  const createCustomerBooking = useCallback(async () => {
    if (!isAuthenticated) {
      if (typeof window !== 'undefined') {
        window.location.href = '/sign-in?next=/book'
      }
      return
    }

    if (!selectedBizId || !selectedOfferId || !selectedOfferVersionId || !selectedSlot) {
      setError('Select service and time slot first.')
      return
    }

    const offerVersion = asRecord(selectedWalkUpOffer?.offerVersion)
    const bookingTemplate = asRecord(selectedWalkUpOffer?.bookingTemplate)
    const durationMin = Math.max(numberValue(offerVersion.defaultDurationMin, 60), 1)
    const subtotalMinor = numberValue(offerVersion.basePriceMinor, 0)
    const currency = text(offerVersion.currency, text(selectedBiz?.currency, 'USD'))
    const requestedEndAt = selectedSlot.endAt || plusMinutes(selectedSlot.startAt, durationMin)

    setIsCreatingBooking(true)
    setError(null)
    try {
      await studioApi.createPublicBooking(selectedBizId, {
        offerId: selectedOfferId,
        offerVersionId: selectedOfferVersionId,
        status: 'confirmed',
        currency,
        subtotalMinor,
        taxMinor: 0,
        feeMinor: 0,
        discountMinor: 0,
        totalMinor: subtotalMinor,
        requestedStartAt: selectedSlot.startAt,
        requestedEndAt,
        confirmedStartAt: selectedSlot.startAt,
        confirmedEndAt: requestedEndAt,
        locationId: selectedLocationId || text(bookingTemplate.locationId) || undefined,
        metadata: {
          source: 'customer_surface',
        },
      })

      const nextBookings = asArray(await studioApi.listPublicBookings(selectedBizId))
      setBookings(nextBookings)
      setSelectedBookingId(text(nextBookings[0]?.id))
      setScreen('booking_details')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create booking.')
    } finally {
      setIsCreatingBooking(false)
    }
  }, [isAuthenticated, selectedBiz, selectedBizId, selectedLocationId, selectedOfferId, selectedOfferVersionId, selectedSlot, selectedWalkUpOffer])

  const paySelectedBookingWithStripe = useCallback(async () => {
    const bookingId = text(selectedBooking?.id)
    if (!selectedBizId || !bookingId) {
      setError('Select a booking before paying.')
      return
    }

    setIsCreatingStripeIntent(true)
    setError(null)
    try {
      const intent = asRecord(
        await studioApi.createPublicStripePaymentIntent(selectedBizId, bookingId, {
          confirmNow: true,
          tipMinor: 0,
        }),
      )
      setLatestStripeIntent(intent)

      const refreshed = asArray(await studioApi.listPublicBookings(selectedBizId))
      setBookings(refreshed)
      setSelectedBookingId((current) => {
        if (current && refreshed.some((row) => text(row.id) === current)) return current
        return bookingId
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process card payment.')
    } finally {
      setIsCreatingStripeIntent(false)
    }
  }, [selectedBizId, selectedBooking])

  const currentScreen = SCREEN_ITEMS.find((item) => item.key === screen) ?? SCREEN_ITEMS[0]
  const isDevView = mode === 'dev'
  const isCustomerView = mode === 'customer'
  const customerHeaderTitle = text(selectedBiz?.name, 'Book an appointment')
  const customerSubtitle =
    screen === 'owner_dashboard'
      ? 'Choose a service and time.'
      : screen === 'booking_details'
        ? 'Review details and complete payment.'
        : 'Your reservation is confirmed.'

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated && mode !== 'customer') {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center p-6">
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>Sign in to access booking.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/sign-in" className="w-full">
              <Button className="w-full">Go to sign in</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div
      className={
        isCustomerView
          ? 'min-h-screen bg-slate-50'
          : 'min-h-screen bg-background'
      }
    >
      <header
        className={
          isCustomerView
            ? 'sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur'
            : 'sticky top-0 z-20 border-b bg-background/95 backdrop-blur'
        }
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            {isCustomerView ? (
              <img src="/images/bizing.logo.horizontal.combo.svg" alt="Bizing" className="h-7 w-auto" />
            ) : (
              <img src="/images/bizing.logo.icon.svg" alt="Bizing logo" className="h-6 w-6" />
            )}
            <div>
              <p className={isCustomerView ? 'text-base font-semibold text-slate-900' : 'text-sm font-semibold'}>
                {customerHeaderTitle}
              </p>
              <p className="text-xs text-muted-foreground">
                {isDevView ? currentScreen.customerStep : customerSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {mode === 'customer' ? (
              bizes.length > 1 ? (
                <Select value={selectedBizId || undefined} onValueChange={setSelectedBizId}>
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Choose business" />
                  </SelectTrigger>
                  <SelectContent>
                    {bizes.map((biz) => {
                      const bizId = text(biz.id)
                      return (
                        <SelectItem key={bizId} value={bizId}>
                          {text(biz.name, 'Untitled business')}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              ) : bizes.length === 1 ? (
                <Badge variant="outline">{text(bizes[0]?.name, 'Business')}</Badge>
              ) : (
                <Badge variant="outline">No published businesses</Badge>
              )
            ) : (
              <Badge variant="outline">{text(selectedBiz?.name, 'Choose business')}</Badge>
            )}
            {isDevView ? <ThemeToggle /> : null}
          </div>
        </div>
      </header>

      <main className={isCustomerView ? 'mx-auto max-w-6xl space-y-5 px-4 py-7 md:px-6' : 'mx-auto max-w-6xl space-y-5 px-4 py-5 md:px-6'}>
        {error ? (
          <Card className="border-destructive">
            <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </CardContent>
          </Card>
        ) : null}

        {screen === 'business_directory' && isDevView ? (
          <Card>
            <CardHeader>
              <CardTitle>Select a business</CardTitle>
              <CardDescription>Choose the business you want to work with.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={directoryQuery}
                  onChange={(event) => setDirectoryQuery(event.target.value)}
                  placeholder="Search businesses by name"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {directoryRows.map((biz) => {
                  const bizId = text(biz.id)
                  const active = bizId === selectedBizId
                  return (
                    <button
                      key={bizId}
                      type="button"
                      onClick={() => {
                        setSelectedBizId(bizId)
                        setScreen('owner_dashboard')
                      }}
                      className={`rounded-xl border p-4 text-left transition-colors ${
                        active ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                    >
                      <p className="text-base font-semibold">{text(biz.name, 'Untitled business')}</p>
                      <p className="text-xs text-muted-foreground">{text(biz.slug, bizId)}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{text(biz.type, 'small_business')}</Badge>
                        <Badge variant="outline">{text(biz.timezone, 'UTC')}</Badge>
                        <Badge variant={text(biz.status) === 'active' ? 'default' : 'outline'}>{text(biz.status, 'unknown')}</Badge>
                      </div>
                    </button>
                  )
                })}
                {directoryRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground md:col-span-2">
                    No businesses match your search.
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {screen === 'owner_dashboard' ? (
          <Card className={isCustomerView ? 'border-slate-200 bg-white shadow-sm' : ''}>
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className={isCustomerView ? 'text-2xl text-slate-900' : ''}>
                    {isCustomerView ? 'Choose a time' : 'Choose your session time'}
                  </CardTitle>
                  <CardDescription>
                    {isCustomerView ? 'Pick a service, date, and time that works for your schedule.' : weekRangeLabel}
                  </CardDescription>
                </div>
                {!isCustomerView ? (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCursor((prev) => subWeeks(prev, 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
                      Today
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCursor((prev) => addWeeks(prev, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            </CardHeader>

            <CardContent>
              {isLoadingContext ? (
                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading availability...
                </div>
              ) : mode === 'customer' ? (
                bizes.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-sm text-muted-foreground">
                      No published businesses are available right now. Please check back soon.
                    </CardContent>
                  </Card>
                ) : (
                <div className="mx-auto w-full max-w-2xl">
                  <Card className="border-slate-200 bg-white shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base">Book a time</CardTitle>
                      <CardDescription>Choose service, date, and time.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Service</p>
                        {publicOffers.length === 0 ? (
                          <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-slate-600">
                            No services are available yet.
                          </div>
                        ) : (
                          <Select
                            value={selectedOfferId || undefined}
                            onValueChange={(value) => {
                              setSelectedOfferId(value)
                              setSelectedSlotDate('')
                              setSelectedSlotStartAt('')
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a service" />
                            </SelectTrigger>
                            <SelectContent>
                              {publicOffers.map((offer) => {
                                const offerId = text(offer.id)
                                return (
                                  <SelectItem key={offerId} value={offerId}>
                                    {text(offer.name, text(offer.slug, offerId))}
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {locations.length > 1 ? (
                        <div className="space-y-2">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Location</p>
                          <Select
                            value={selectedLocationId || undefined}
                            onValueChange={(value) => {
                              setSelectedLocationId(value)
                              setSelectedSlotDate('')
                              setSelectedSlotStartAt('')
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a location" />
                            </SelectTrigger>
                            <SelectContent>
                              {locations.map((location) => {
                                const locationId = text(location.id)
                                return (
                                  <SelectItem key={locationId} value={locationId}>
                                    {text(location.name, text(location.slug, locationId))}
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Date</p>
                        {availableSlotDates.length > 0 ? (
                          <Input
                            type="date"
                            value={selectedSlotDate}
                            min={availableSlotDates[0]}
                            max={availableSlotDates[availableSlotDates.length - 1]}
                            onChange={(event) => setSelectedSlotDate(event.target.value)}
                            disabled={isLoadingSlots}
                          />
                        ) : (
                          <div className="rounded-md border border-dashed px-3 py-2 text-sm text-slate-600">
                            No dates are open for online booking right now.
                            {bizes.length > 1 ? ' Try another business from the selector above.' : ''}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Time</p>
                        {isLoadingSlots ? (
                          <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading times...
                          </div>
                        ) : visibleSlots.length === 0 ? (
                          <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-slate-600">
                            No times available for this business right now.
                            {bizes.length > 1 ? ' Try another business from the selector above.' : ''}
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {visibleSlots.map((slot) => {
                              const active = slot.startAt === selectedSlotStartAt
                              return (
                                <button
                                  key={slot.startAt}
                                  type="button"
                                  onClick={() => setSelectedSlotStartAt(slot.startAt)}
                                  className={`rounded-md border px-3 py-2 text-left text-sm ${
                                    active
                                      ? 'border-slate-900 bg-slate-900 text-white'
                                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                  }`}
                                >
                                  {format(new Date(slot.startAt), 'h:mm a')}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {text(selectedPublicOffer?.name, 'Select a service')}
                        {' • '}
                        {selectedSlot ? format(new Date(selectedSlot.startAt), 'EEE, MMM d • h:mm a') : 'Select time'}
                        {' • '}
                        {formatMoney(
                          numberValue(asRecord(selectedWalkUpOffer?.offerVersion).basePriceMinor, 0),
                          text(asRecord(selectedWalkUpOffer?.offerVersion).currency, text(selectedBiz?.currency, 'USD')),
                        )}
                      </div>

                      <Button
                        className="w-full bg-slate-900 text-white hover:bg-slate-800"
                        onClick={() => void createCustomerBooking()}
                        disabled={!selectedSlot || isLoadingSlots || isCreatingBooking}
                      >
                        {isCreatingBooking ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Reserving...
                          </>
                        ) : (
                          selectedSlot ? 'Continue' : 'Select a time to continue'
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
                )
              ) : calendars.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <p className="text-lg font-medium">No appointment times available yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">This business has not published a booking calendar yet.</p>
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="overflow-x-auto rounded-xl border bg-card">
                    <div className="min-w-[980px]">
                      <div className="grid grid-cols-[92px_repeat(7,minmax(0,1fr))] border-b">
                        <div className="border-r bg-muted/20" />
                        {weekDays.map((day, index) => (
                          <button
                            key={day.toISOString()}
                            type="button"
                            onClick={() => setSelectedDayIndex(index)}
                            className={`border-r px-3 py-2 text-center text-sm last:border-r-0 ${
                              selectedDayIndex === index ? 'bg-primary/15' : isSameDay(day, new Date()) ? 'bg-primary/5' : ''
                            }`}
                          >
                            <p className="font-medium">{format(day, 'EEE')}</p>
                            <p className="text-xs text-muted-foreground">{format(day, 'MMM d')}</p>
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-[92px_repeat(7,minmax(0,1fr))]">
                        <div className="border-r bg-muted/20" style={{ height: `${gridHeight}px` }}>
                          {HOUR_ROWS.map((hour) => (
                            <div key={hour} className="border-b px-3 pt-1 text-xs text-muted-foreground" style={{ height: `${ROW_HEIGHT_PX}px` }}>
                              {hourLabel(hour)}
                            </div>
                          ))}
                        </div>

                        {weekDays.map((day, dayIndex) => (
                          <div
                            key={`col-${day.toISOString()}`}
                            className={`relative border-r last:border-r-0 ${selectedDayIndex === dayIndex ? 'bg-primary/5' : ''}`}
                            style={{ height: `${gridHeight}px` }}
                          >
                            {HOUR_ROWS.map((hour) => (
                              <div key={`${day.toISOString()}-${hour}`} className="border-b" style={{ height: `${ROW_HEIGHT_PX}px` }} />
                            ))}

                            {eventsByDay[dayIndex]?.map((event) => {
                              const startMinutes = (event.startAt.getHours() - GRID_START_HOUR) * 60 + event.startAt.getMinutes()
                              const endMinutes = (event.endAt.getHours() - GRID_START_HOUR) * 60 + event.endAt.getMinutes()
                              const clampedStart = Math.max(0, Math.min(startMinutes, GRID_TOTAL_MINUTES - 30))
                              const clampedEnd = Math.max(clampedStart + 30, Math.min(endMinutes, GRID_TOTAL_MINUTES))
                              const top = (clampedStart / 60) * ROW_HEIGHT_PX
                              const height = Math.max(((clampedEnd - clampedStart) / 60) * ROW_HEIGHT_PX, 44)

                              return (
                                <div
                                  key={event.id}
                                  className={`absolute left-2 right-2 rounded-md border p-2 text-xs shadow-sm ${eventCardClasses(event)}`}
                                  style={{ top: `${top}px`, height: `${height}px` }}
                                >
                                  <p className="font-semibold leading-tight">{event.title}</p>
                                  <p className="line-clamp-1 text-[11px] opacity-85">{event.subtitle}</p>
                                  <p className="mt-1 text-[11px] opacity-85">{displayTimeRange(event.startAt, event.endAt)}</p>
                                </div>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">{format(selectedDay, 'EEEE')}</CardTitle>
                        <CardDescription>{format(selectedDay, 'MMMM d')}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {selectedDayEvents.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No events in this day view.</p>
                        ) : (
                          selectedDayEvents.map((event) => (
                            <div key={event.id} className="rounded-lg border p-3 text-sm">
                              <p className="font-medium">{event.title}</p>
                              <p className="text-xs text-muted-foreground">{displayTimeRange(event.startAt, event.endAt)}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{event.subtitle}</p>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    {isLoadingTimeline ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading timeline...
                      </div>
                    ) : null}

                    <Button className="w-full" onClick={() => setScreen('booking_details')}>Continue to booking details</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {screen === 'booking_details' ? (
          isCustomerView ? (
            <div className="mx-auto w-full max-w-2xl">
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>Review and pay</CardTitle>
                  <CardDescription>Confirm your booking details.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedBooking ? (
                    <>
                      <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {text(selectedBiz?.name, 'Business')}
                        {' • '}
                        {bookingStartAt(selectedBooking) ? new Date(bookingStartAt(selectedBooking)).toLocaleString() : 'Time pending'}
                        {' • '}
                        {formatMoney(numberValue(selectedBooking.totalMinor, 0), text(selectedBooking.currency, text(selectedBiz?.currency, 'USD')))}
                      </div>

                      <Button
                        className="w-full bg-slate-900 text-white hover:bg-slate-800"
                        onClick={() => void paySelectedBookingWithStripe()}
                        disabled={isCreatingStripeIntent}
                      >
                        {isCreatingStripeIntent ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing payment...
                          </>
                        ) : (
                          'Pay with card'
                        )}
                      </Button>

                      {latestStripeIntent ? (
                        <p className="text-sm text-slate-600">Payment status: {text(latestStripeIntent.status, 'pending')}</p>
                      ) : null}

                      <Button className="w-full" variant="outline" onClick={() => setScreen('analytics_dashboard')}>
                        View confirmation
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No booking selected.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[350px_minmax(0,1fr)]">
              <Card>
                <CardHeader>
                  <CardTitle>My Bookings</CardTitle>
                  <CardDescription>Select a booking to review details.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[560px]">
                    <div className="divide-y">
                      {bookings.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">No bookings found yet.</div>
                      ) : (
                        bookings.map((row) => {
                          const bookingId = text(row.id)
                          const active = bookingId === text(selectedBooking?.id)
                          const status = text(row.status, 'unknown')
                          const start = bookingStartAt(row)
                          return (
                            <button
                              key={bookingId}
                              type="button"
                              onClick={() => setSelectedBookingId(bookingId)}
                              className={`w-full px-4 py-3 text-left ${active ? 'bg-primary/10' : 'hover:bg-muted/60'}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-medium">{compactId(bookingId)}</p>
                                <Badge variant={bookingStatusTone(status)}>{status}</Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">{start ? new Date(start).toLocaleString() : 'No start time'}</p>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Booking Summary</CardTitle>
                  <CardDescription>Review your booking and complete payment.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {selectedBooking ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border p-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Booking ID</p>
                          <p className="mt-1 font-medium">{text(selectedBooking.id)}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                          <p className="mt-1 font-medium">{humanize(text(selectedBooking.status, 'unknown'))}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Session Time</p>
                          <p className="mt-1 text-sm">{bookingStartAt(selectedBooking) ? new Date(bookingStartAt(selectedBooking)).toLocaleString() : 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">to {bookingEndAt(selectedBooking) ? new Date(bookingEndAt(selectedBooking)).toLocaleString() : 'N/A'}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
                          <p className="mt-1 font-medium">{formatMoney(numberValue(selectedBooking.totalMinor, 0), text(selectedBooking.currency, text(selectedBiz?.currency, 'USD')))}</p>
                        </div>
                      </div>

                      <Button className="w-full" variant="outline" onClick={() => void paySelectedBookingWithStripe()} disabled={isCreatingStripeIntent}>
                        {isCreatingStripeIntent ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing payment...
                          </>
                        ) : (
                          'Pay with card'
                        )}
                      </Button>

                      {latestStripeIntent ? (
                        <div className="rounded-lg border p-3 text-sm">
                          <p className="font-medium">Latest payment</p>
                          <p className="mt-1 text-muted-foreground">Status: {text(latestStripeIntent.status, 'unknown')}</p>
                          <p className="text-muted-foreground">Provider ref: {text(latestStripeIntent.providerIntentRef, '-')}</p>
                        </div>
                      ) : null}

                      <Button className="w-full" onClick={() => setScreen('analytics_dashboard')}>
                        Continue to confirmation
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Select a booking to view details.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )
        ) : null}

        {screen === 'analytics_dashboard' ? (
          <div className="grid gap-4">
            <Card className={isCustomerView ? 'border-slate-200 bg-white shadow-sm' : ''}>
              <CardHeader>
                <CardTitle>{isCustomerView ? "You're all set" : 'Booking Confirmation'}</CardTitle>
                <CardDescription>
                  {isCustomerView
                    ? 'Your reservation is confirmed. A receipt and confirmation are on the way.'
                    : 'Your booking details and confirmation status.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className={`rounded-xl border p-4 ${
                  isCustomerView
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
                }`}>
                  <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
                    <CheckCircle2 className="h-5 w-5" />
                    <p className="font-semibold">{isCustomerView ? 'Booking confirmed.' : 'Your session is confirmed'}</p>
                  </div>
                  <p className="mt-1 text-sm text-emerald-900/80 dark:text-emerald-200/80">
                    {selectedBooking
                      ? `${bookingStartAt(selectedBooking) ? new Date(bookingStartAt(selectedBooking)).toLocaleString() : 'Scheduled soon'} with ${text(selectedBiz?.name, 'this business')}`
                      : 'Once a booking exists, confirmation details appear here.'}
                  </p>
                </div>

                {isDevView ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Total bookings</p>
                      <p className="text-xl font-semibold">{bookings.length}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Completed sessions</p>
                      <p className="text-xl font-semibold">{bookings.filter((row) => text(row.status) === 'completed').length}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Contacts</p>
                      <p className="text-xl font-semibold">{crmContacts.length}</p>
                    </div>
                  </div>
                ) : null}

                <Button variant="outline" onClick={() => setScreen(mode === 'customer' ? 'owner_dashboard' : 'business_directory')}>
                  Book another session
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </main>

      {isDevView ? (
      <div className="fixed bottom-5 right-5 z-40">
        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" className="h-14 w-14 rounded-full shadow-xl" aria-label="Open developer controls">
              <Wrench className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-[370px] p-0">
            <div className="space-y-4 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Developer Controls</p>
                  <p className="text-xs text-muted-foreground">Visible only in the admin lab</p>
                </div>
                <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" /> FAB</Badge>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Business</p>
                {isLoadingBizes ? (
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading businesses...
                  </div>
                ) : bizes.length > 0 ? (
                  <Select value={selectedBizId || undefined} onValueChange={setSelectedBizId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select business" />
                    </SelectTrigger>
                    <SelectContent>
                      {bizes.map((biz) => {
                        const bizId = text(biz.id)
                        return (
                          <SelectItem key={bizId} value={bizId}>
                            {`${text(biz.name, 'Untitled')} (${bizId.slice(-6)})`}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">No businesses found.</div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Customer journey stage</p>
                <Select value={screen} onValueChange={(value) => setScreen(value as SagaScreen)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {SCREEN_ITEMS.map((item) => (
                      <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">View switch</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href="/owner">Biz owner</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/book">Customer</Link>
                  </Button>
                </div>
              </div>

              {screen === 'owner_dashboard' && calendars.length > 1 ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Calendar</p>
                  <Select value={selectedCalendarId || undefined} onValueChange={setSelectedCalendarId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select calendar" />
                    </SelectTrigger>
                    <SelectContent>
                      {calendars.map((calendar) => {
                        const id = text(calendar.id)
                        return <SelectItem key={id} value={id}>{text(calendar.name, compactId(id))}</SelectItem>
                      })}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {calendars.length === 0 ? (
                <div className="space-y-2 rounded-lg border border-dashed p-3">
                  <p className="text-sm font-medium">No calendar configured</p>
                  <p className="text-xs text-muted-foreground">Create a default calendar to make this business bookable.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void createDefaultCalendar()} disabled={isCreatingCalendar}>
                      {isCreatingCalendar ? (
                        <>
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Creating...
                        </>
                      ) : (
                        'Create default calendar'
                      )}
                    </Button>
                    {bizes.length > 1 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void (async () => {
                            const fallbackBizId = await findBizWithCalendar(selectedBizId)
                            if (fallbackBizId) setSelectedBizId(fallbackBizId)
                          })()
                        }}
                      >
                        Find existing calendar
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Journey progress</p>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.round((completedPhaseCount / Math.max(sagaPhases.length, 1)) * 100)}%` }} />
                </div>
                <div className="grid gap-1">
                  {sagaPhases.map((phase) => (
                    <div key={phase.key} className="flex items-center justify-between rounded-md border px-2 py-1 text-xs">
                      <span>{phase.title}</span>
                      {phase.done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <span className="text-muted-foreground">pending</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border p-2">
                  <p className="text-muted-foreground">Owner</p>
                  <p className="font-medium">{ownerName}</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-muted-foreground">Week</p>
                  <p className="font-medium">{format(weekStart, 'MMM d')}</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-muted-foreground">Bookings</p>
                  <p className="font-medium">{bookings.length}</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-muted-foreground">Revenue</p>
                  <p className="font-medium">{formatMoney(completedRevenueMinor, text(selectedBiz?.currency, 'USD'))}</p>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      ) : null}
    </div>
  )
}
