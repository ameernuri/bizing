'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  Calendar,
  CalendarDays,
  CircuitBoard,
  Loader2,
  MessageSquare,
  Moon,
  Package,
  Plus,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sun,
  UserRoundCog,
  Users,
  Warehouse,
} from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { useTheme } from '@/components/ThemeProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { studioApi } from '@/lib/studio-api'
import { CalendarTimelineView } from './calendar-timeline-view'
import { asArray, asRecord, formatDateTime, numberValue, text, type JsonMap } from './types'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type DashboardSection =
  | 'my_calendar'
  | 'appointments'
  | 'bookings'
  | 'team'
  | 'catalog'
  | 'resources'
  | 'workflows'
  | 'customers'
  | 'services'
  | 'products'
  | 'communications'
  | 'reports'
  | 'settings'

type NavItem = {
  key: DashboardSection
  label: string
  icon: React.ComponentType<{ className?: string }>
}

type Slot = {
  startAt: string
  endAt: string
}

type CoverageAlert = {
  laneId: string
  severity: 'critical' | 'warning' | 'notice'
  title: string
  description: string
}

const DAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
]

const DAY_LABEL_BY_VALUE = DAY_OPTIONS.reduce<Record<number, string>>((acc, day) => {
  acc[day.value] = day.label
  return acc
}, {})

const AVAILABILITY_TEMPLATES: Record<string, { label: string; dayOfWeeks: number[]; startTime: string; endTime: string }> = {
  weekday_core: {
    label: 'Weekdays, 9:00 AM to 5:00 PM',
    dayOfWeeks: [1, 2, 3, 4, 5],
    startTime: '09:00',
    endTime: '17:00',
  },
  weekday_plus_sat: {
    label: 'Monday to Saturday, 9:00 AM to 5:00 PM',
    dayOfWeeks: [1, 2, 3, 4, 5, 6],
    startTime: '09:00',
    endTime: '17:00',
  },
  every_day: {
    label: 'Every day, 9:00 AM to 5:00 PM',
    dayOfWeeks: [0, 1, 2, 3, 4, 5, 6],
    startTime: '09:00',
    endTime: '17:00',
  },
}

function isSameDayIso(iso: string, compare: Date) {
  const d = new Date(iso)
  return (
    d.getFullYear() === compare.getFullYear() &&
    d.getMonth() === compare.getMonth() &&
    d.getDate() === compare.getDate()
  )
}

function plusMinutes(iso: string, minutes: number) {
  const d = new Date(iso)
  return new Date(d.getTime() + minutes * 60 * 1000).toISOString()
}

function slugify(input: string, fallback = 'item') {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

function toTimeInputValue(value: string) {
  const raw = value.trim()
  if (!raw) return ''
  const [hours, minutes] = raw.split(':')
  if (!hours || !minutes) return raw
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
}

function locationIdFromRow(row: JsonMap | null | undefined) {
  if (!row) return ''
  const direct = text(row.locationId)
  if (direct) return direct
  return text(asRecord(row.metadata).locationId)
}

function formatMinutesAsHours(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0h'
  const hours = value / 60
  return `${hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)}h`
}

function toDateTimeLocalValue(value: string | Date | null | undefined) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function fromDateTimeLocalValue(value: string) {
  if (!value.trim()) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
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

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
  )
}

function StatCard({ title, value, description }: { title: string; value: string | number; description?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  )
}

function BookingRow({ row }: { row: JsonMap }) {
  const status = text(row.status, 'unknown')
  const statusVariant = status === 'confirmed' ? 'default' : status === 'cancelled' ? 'destructive' : 'secondary'
  
  return (
    <TableRow>
      <TableCell className="font-medium">{text(row.id).slice(0, 8)}...</TableCell>
      <TableCell>{formatDateTime(text(row.confirmedStartAt, text(row.requestedStartAt)))}</TableCell>
      <TableCell>
        <Badge variant={statusVariant}>{status}</Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm">View</Button>
      </TableCell>
    </TableRow>
  )
}

function CustomerRow({ row }: { row: JsonMap }) {
  const initials = text(row.displayName, text(row.fullName, 'U')).slice(0, 2).toUpperCase()
  
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{text(row.displayName, text(row.fullName, text(row.id)))}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>{text(row.primaryEmail, '-')}</TableCell>
      <TableCell>{text(row.primaryPhone, '-')}</TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm">View</Button>
      </TableCell>
    </TableRow>
  )
}

function MemberRow({ row }: { row: JsonMap }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{text(row.name, '-')}</TableCell>
      <TableCell>{text(row.email, '-')}</TableCell>
      <TableCell>
        <Badge variant="outline">{text(row.role, 'customer')}</Badge>
      </TableCell>
      <TableCell>{formatDateTime(text(row.joinedAt, ''))}</TableCell>
    </TableRow>
  )
}

function ProductRow({ row }: { row: JsonMap }) {
  const price = (numberValue(row.basePriceMinor, 0) / 100).toFixed(2)
  
  return (
    <TableRow>
      <TableCell className="font-medium">{text(row.name, text(row.slug, text(row.id)))}</TableCell>
      <TableCell>
        <Badge variant="outline">{text(row.status, 'unknown')}</Badge>
      </TableCell>
      <TableCell className="text-right">${price}</TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm">Edit</Button>
      </TableCell>
    </TableRow>
  )
}

export function CustomerAppPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading, user, activeBizId } = useAuth()

  const [section, setSection] = useState<DashboardSection>('my_calendar')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [bizes, setBizes] = useState<JsonMap[]>([])
  const [selectedBizId, setSelectedBizId] = useState<string>(activeBizId ?? '')
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')

  const [locations, setLocations] = useState<JsonMap[]>([])
  const [resources, setResources] = useState<JsonMap[]>([])
  const [services, setServices] = useState<JsonMap[]>([])
  const [products, setProducts] = useState<JsonMap[]>([])
  const [offers, setOffers] = useState<JsonMap[]>([])
  const [publicOffers, setPublicOffers] = useState<JsonMap[]>([])
  const [calendars, setCalendars] = useState<JsonMap[]>([])
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('')
  const [calendarTimeline, setCalendarTimeline] = useState<unknown>(null)
  const [coverageLanes, setCoverageLanes] = useState<JsonMap[]>([])
  const [coverageLaneReport, setCoverageLaneReport] = useState<JsonMap | null>(null)
  const [coverageLaneAlertRows, setCoverageLaneAlertRows] = useState<JsonMap[]>([])
  const [bookingOrders, setBookingOrders] = useState<JsonMap[]>([])
  const [paymentIntents, setPaymentIntents] = useState<JsonMap[]>([])
  const [crmContacts, setCrmContacts] = useState<JsonMap[]>([])
  const [bizMembers, setBizMembers] = useState<JsonMap[]>([])
  const [availabilityRules, setAvailabilityRules] = useState<JsonMap[]>([])
  const [bizVisibility, setBizVisibility] = useState<'published' | 'unpublished' | 'private'>('published')
  const [newServiceName, setNewServiceName] = useState('')
  const [newOfferName, setNewOfferName] = useState('')
  const [newOfferPrice, setNewOfferPrice] = useState('120')
  const [newOfferDurationMode, setNewOfferDurationMode] = useState<'fixed' | 'variable'>('fixed')
  const [newOfferDefaultDurationMin, setNewOfferDefaultDurationMin] = useState('60')
  const [newOfferMinDurationMin, setNewOfferMinDurationMin] = useState('30')
  const [newOfferMaxDurationMin, setNewOfferMaxDurationMin] = useState('240')
  const [newOfferDurationStepMin, setNewOfferDurationStepMin] = useState('15')
  const [outboundMessages, setOutboundMessages] = useState<JsonMap[]>([])
  const [reportDefinitions, setReportDefinitions] = useState<JsonMap[]>([])
  const [workflows, setWorkflows] = useState<JsonMap[]>([])
  const [selectedReportId, setSelectedReportId] = useState('')
  const [lastRenderedReport, setLastRenderedReport] = useState<JsonMap | null>(null)
  const [firstSaleDismissedByBiz, setFirstSaleDismissedByBiz] = useState<Record<string, true>>({})
  const [didAutoProvisionCalendar, setDidAutoProvisionCalendar] = useState(false)
  const [calendarLoadAttemptedByBiz, setCalendarLoadAttemptedByBiz] = useState<Record<string, true>>({})

  const [bookingDialogOpen, setBookingDialogOpen] = useState(false)
  const [bookingOfferId, setBookingOfferId] = useState<string>('')
  const [bookingOfferVersionId, setBookingOfferVersionId] = useState<string>('')
  const [bookingSlots, setBookingSlots] = useState<Slot[]>([])
  const [bookingSlotStartAt, setBookingSlotStartAt] = useState<string>('')
  const [offerVersionsByOffer, setOfferVersionsByOffer] = useState<Record<string, JsonMap[]>>({})
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false)
  const [availabilityWeekScope, setAvailabilityWeekScope] = useState<'weekdays' | 'all_week'>('weekdays')
  const [availabilityWeekStartTime, setAvailabilityWeekStartTime] = useState('09:00')
  const [availabilityWeekEndTime, setAvailabilityWeekEndTime] = useState('17:00')
  const [availabilityTemplateKey, setAvailabilityTemplateKey] = useState<keyof typeof AVAILABILITY_TEMPLATES>('weekday_core')
  const [availabilityAdvancedOpen, setAvailabilityAdvancedOpen] = useState(false)
  const [availabilityAdvancedDayOfWeek, setAvailabilityAdvancedDayOfWeek] = useState('1')
  const [availabilityAdvancedStartTime, setAvailabilityAdvancedStartTime] = useState('09:00')
  const [availabilityAdvancedEndTime, setAvailabilityAdvancedEndTime] = useState('17:00')
  const [coverageLaneDialogOpen, setCoverageLaneDialogOpen] = useState(false)
  const [coverageLaneDialogMode, setCoverageLaneDialogMode] = useState<'create' | 'edit'>('create')
  const [coverageLaneEditingId, setCoverageLaneEditingId] = useState('')
  const [coverageLaneName, setCoverageLaneName] = useState('')
  const [coverageLaneSlug, setCoverageLaneSlug] = useState('')
  const [coverageLaneType, setCoverageLaneType] = useState('front_desk')
  const [coverageLanePresenceMode, setCoverageLanePresenceMode] = useState('onsite')
  const [coverageLaneLocationId, setCoverageLaneLocationId] = useState('')
  const [coverageLaneRequiredHeadcount, setCoverageLaneRequiredHeadcount] = useState('1')
  const [coverageLaneStatus, setCoverageLaneStatus] = useState('active')
  const [coverageLaneEscalationEnabled, setCoverageLaneEscalationEnabled] = useState(false)
  const [coverageLaneEscalationAfterMinutes, setCoverageLaneEscalationAfterMinutes] = useState('15')
  const [coverageLanePolicyExtra, setCoverageLanePolicyExtra] = useState<Record<string, unknown>>({})
  const [coverageLaneMembershipsByLane, setCoverageLaneMembershipsByLane] = useState<Record<string, JsonMap[]>>({})
  const [coverageShiftTemplatesByLane, setCoverageShiftTemplatesByLane] = useState<Record<string, JsonMap[]>>({})
  const [coverageMembershipDialogOpen, setCoverageMembershipDialogOpen] = useState(false)
  const [coverageMembershipLaneId, setCoverageMembershipLaneId] = useState('')
  const [coverageMembershipResourceId, setCoverageMembershipResourceId] = useState('')
  const [coverageMembershipRole, setCoverageMembershipRole] = useState('primary')
  const [coverageMembershipParticipationMode, setCoverageMembershipParticipationMode] = useState('onsite')
  const [coverageMembershipStatus, setCoverageMembershipStatus] = useState('active')
  const [coverageShiftDialogOpen, setCoverageShiftDialogOpen] = useState(false)
  const [coverageShiftLaneId, setCoverageShiftLaneId] = useState('')
  const [coverageShiftTitle, setCoverageShiftTitle] = useState('')
  const [coverageShiftStartsAt, setCoverageShiftStartsAt] = useState('')
  const [coverageShiftEndsAt, setCoverageShiftEndsAt] = useState('')
  const [coverageShiftResourceId, setCoverageShiftResourceId] = useState('')
  const [coverageTemplateDialogOpen, setCoverageTemplateDialogOpen] = useState(false)
  const [coverageTemplateLaneId, setCoverageTemplateLaneId] = useState('')
  const [coverageTemplateName, setCoverageTemplateName] = useState('')
  const [coverageTemplateStartTime, setCoverageTemplateStartTime] = useState('09:00')
  const [coverageTemplateEndTime, setCoverageTemplateEndTime] = useState('17:00')
  const [coverageTemplateDayOfWeeks, setCoverageTemplateDayOfWeeks] = useState<number[]>([1, 2, 3, 4, 5])
  const [coverageTemplateResourceId, setCoverageTemplateResourceId] = useState('')
  const [coverageTemplateAutoPublishEnabled, setCoverageTemplateAutoPublishEnabled] = useState(true)
  const [coverageTemplatePublishWindowDays, setCoverageTemplatePublishWindowDays] = useState('14')

  const selectedBiz = useMemo(
    () => bizes.find((row) => text((row as JsonMap).id) === selectedBizId) ?? null,
    [bizes, selectedBizId],
  )

  const selectedLocation = useMemo(
    () => locations.find((row) => text(row.id) === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  )

  useEffect(() => {
    const visibility = text((selectedBiz as JsonMap | null)?.visibility, 'published')
    if (visibility === 'published' || visibility === 'unpublished' || visibility === 'private') {
      setBizVisibility(visibility)
    } else {
      setBizVisibility('published')
    }
  }, [selectedBiz])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem('owner-first-sale-dismissed')
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as Record<string, true>
      setFirstSaleDismissedByBiz(parsed)
    } catch {
      setFirstSaleDismissedByBiz({})
    }
  }, [])

  const navItems = useMemo<NavItem[]>(
    () => [
      { key: 'my_calendar', label: 'Calendar', icon: CalendarDays },
      { key: 'bookings', label: 'Bookings', icon: Calendar },
      { key: 'team', label: 'Team', icon: UserRoundCog },
      { key: 'catalog', label: 'Catalog', icon: Package },
      { key: 'resources', label: 'Resources', icon: Warehouse },
      { key: 'customers', label: 'Customers', icon: Users },
    ],
    [],
  )
  const footerNavItems = useMemo<NavItem[]>(
    () => [
      { key: 'workflows', label: 'Workflows', icon: CircuitBoard },
      { key: 'settings', label: 'Settings', icon: Settings },
    ],
    [],
  )
  const activeNavItem = useMemo(
    () => [...navItems, ...footerNavItems].find((item) => item.key === section) ?? null,
    [footerNavItems, navItems, section],
  )

  const selectedOfferVersions = useMemo(
    () => offerVersionsByOffer[bookingOfferId] ?? [],
    [offerVersionsByOffer, bookingOfferId],
  )
  const coverageLaneByCalendarId = useMemo(() => {
    const map = new Map<string, JsonMap>()
    coverageLanes.forEach((row) => {
      const calendarId = text(row.primaryCalendarId)
      if (calendarId) map.set(calendarId, row)
    })
    return map
  }, [coverageLanes])
  const bookingCalendars = useMemo(
    () => calendars.filter((row) => !coverageLaneByCalendarId.has(text(row.id))),
    [calendars, coverageLaneByCalendarId],
  )
  const selectedCoverageLane = useMemo(
    () => coverageLaneByCalendarId.get(selectedCalendarId) ?? null,
    [coverageLaneByCalendarId, selectedCalendarId],
  )
  const scheduleOptions = useMemo(
    () =>
      calendars.map((row) => {
        const calendarId = text(row.id)
        const lane = coverageLaneByCalendarId.get(calendarId)
        return {
          calendarId,
          label: lane ? text(lane.name, text(row.name, calendarId)) : text(row.name, calendarId),
          subtitle: lane ? 'Coverage lane' : 'Booking calendar',
          kind: lane ? ('coverage_lane' as const) : ('calendar' as const),
        }
      }),
    [calendars, coverageLaneByCalendarId],
  )
  const selectedScheduleOption = useMemo(
    () => scheduleOptions.find((row) => row.calendarId === selectedCalendarId) ?? null,
    [scheduleOptions, selectedCalendarId],
  )
  const coverageLaneSummaries = useMemo(
    () => asArray(asRecord(coverageLaneReport).lanes),
    [coverageLaneReport],
  )
  const coverageLaneSummaryById = useMemo(() => {
    const map = new Map<string, JsonMap>()
    coverageLaneSummaries.forEach((row) => {
      const lane = asRecord(row.lane)
      const laneId = text(lane.id)
      if (laneId) map.set(laneId, row)
    })
    return map
  }, [coverageLaneSummaries])

  const selectedOfferVersion = useMemo(
    () => selectedOfferVersions.find((row) => text(row.id) === bookingOfferVersionId) ?? null,
    [selectedOfferVersions, bookingOfferVersionId],
  )
  const selectedReportDefinition = useMemo(
    () => reportDefinitions.find((row) => text(row.id) === selectedReportId) ?? null,
    [reportDefinitions, selectedReportId],
  )
  const renderedReportDataset = useMemo(() => {
    const rendered = asRecord(lastRenderedReport?.renderedData)
    return asRecord(rendered.dataset)
  }, [lastRenderedReport])
  const renderedReportSummary = useMemo(
    () => asRecord(renderedReportDataset.summary),
    [renderedReportDataset],
  )

  const now = new Date()

  const todayBookings = useMemo(
    () =>
      bookingOrders.filter((row) => {
        const start = text(row.confirmedStartAt, text(row.requestedStartAt))
        return start ? isSameDayIso(start, now) : false
      }),
    [bookingOrders, now],
  )

  const upcomingBookings = useMemo(
    () =>
      bookingOrders.filter((row) => {
        const start = text(row.confirmedStartAt, text(row.requestedStartAt))
        return start ? new Date(start).getTime() > Date.now() : false
      }),
    [bookingOrders],
  )
  const hasSuccessfulSale = useMemo(
    () =>
      paymentIntents.some((row) => {
        const status = text(row.status).toLowerCase()
        return status === 'succeeded' || status === 'captured'
      }),
    [paymentIntents],
  )
  const showFirstSaleBanner = Boolean(selectedBizId && hasSuccessfulSale && !firstSaleDismissedByBiz[selectedBizId])
  const filteredResources = useMemo(
    () => (selectedLocationId ? resources.filter((row) => locationIdFromRow(row) === selectedLocationId) : resources),
    [resources, selectedLocationId],
  )
  const filteredCoverageLanes = useMemo(
    () => (selectedLocationId ? coverageLanes.filter((row) => text(row.locationId) === selectedLocationId) : coverageLanes),
    [coverageLanes, selectedLocationId],
  )
  const filteredBookings = useMemo(
    () => (selectedLocationId ? bookingOrders.filter((row) => locationIdFromRow(row) === selectedLocationId) : bookingOrders),
    [bookingOrders, selectedLocationId],
  )
  const filteredTodayBookings = useMemo(
    () =>
      filteredBookings.filter((row) => {
        const start = text(row.confirmedStartAt, text(row.requestedStartAt))
        return start ? isSameDayIso(start, now) : false
      }),
    [filteredBookings, now],
  )
  const filteredUpcomingBookings = useMemo(
    () =>
      filteredBookings.filter((row) => {
        const start = text(row.confirmedStartAt, text(row.requestedStartAt))
        return start ? new Date(start).getTime() > Date.now() : false
      }),
    [filteredBookings],
  )
  const teamMembers = useMemo(
    () => bizMembers.filter((row) => text(row.role).toLowerCase() !== 'customer'),
    [bizMembers],
  )
  const customerMembers = useMemo(
    () => bizMembers.filter((row) => text(row.role).toLowerCase() === 'customer'),
    [bizMembers],
  )
  const weeklyAvailabilitySlots = useMemo(
    () =>
      availabilityRules
        .filter((row) => {
          const mode = text(row.mode).toLowerCase()
          const frequency = text(row.frequency).toLowerCase()
          const action = text(row.action).toLowerCase()
          const dayOfWeek = Number(row.dayOfWeek)
          return (
            row.isActive !== false &&
            action === 'available' &&
            (mode === 'recurring' || frequency === 'weekly') &&
            Number.isFinite(dayOfWeek) &&
            dayOfWeek >= 0 &&
            dayOfWeek <= 6 &&
            text(row.startTime) &&
            text(row.endTime)
          )
        })
        .map((row) => ({
          ruleId: text(row.id),
          dayOfWeek: Number(row.dayOfWeek),
          startTime: toTimeInputValue(text(row.startTime)),
          endTime: toTimeInputValue(text(row.endTime)),
          name: text(row.name, 'Hours'),
        }))
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)),
    [availabilityRules],
  )
  const availabilityBusy = Boolean(busyKey?.startsWith('availability.'))
  const coverageReportSummary = useMemo(
    () => asRecord(asRecord(coverageLaneReport).summary),
    [coverageLaneReport],
  )
  const coverageMembershipLane = useMemo(
    () => coverageLanes.find((row) => text(row.id) === coverageMembershipLaneId) ?? null,
    [coverageLanes, coverageMembershipLaneId],
  )
  const coverageShiftLane = useMemo(
    () => coverageLanes.find((row) => text(row.id) === coverageShiftLaneId) ?? null,
    [coverageLanes, coverageShiftLaneId],
  )
  const coverageMembershipsForActiveLane = useMemo(
    () => coverageLaneMembershipsByLane[coverageMembershipLaneId] ?? [],
    [coverageMembershipLaneId, coverageLaneMembershipsByLane],
  )
  const coverageTemplateLane = useMemo(
    () => coverageLanes.find((row) => text(row.id) === coverageTemplateLaneId) ?? null,
    [coverageLanes, coverageTemplateLaneId],
  )
  const coverageTemplatesForActiveLane = useMemo(
    () => coverageShiftTemplatesByLane[coverageTemplateLaneId] ?? [],
    [coverageShiftTemplatesByLane, coverageTemplateLaneId],
  )
  const coverageResourceOptions = useMemo(() => {
    const locationId = text(
      coverageMembershipLane?.locationId,
      text(coverageShiftLane?.locationId, text(coverageTemplateLane?.locationId, selectedLocationId)),
    )
    const scopedResources = resources.filter((row) => !locationId || locationIdFromRow(row) === locationId)
    if (!coverageShiftLaneId) return scopedResources
    const memberships = coverageLaneMembershipsByLane[coverageShiftLaneId] ?? []
    const eligibleIds = new Set(
      memberships
        .filter((row) => text(row.status, 'active') === 'active')
        .map((row) => text(row.resourceId))
        .filter(Boolean),
    )
    return eligibleIds.size === 0 ? scopedResources : scopedResources.filter((row) => eligibleIds.has(text(row.id)))
  }, [coverageMembershipLane, coverageShiftLane, coverageTemplateLane, coverageShiftLaneId, coverageLaneMembershipsByLane, resources, selectedLocationId])
  const coverageAlerts = useMemo<CoverageAlert[]>(() => {
    const alerts: CoverageAlert[] = []
    const nowTs = Date.now()
    for (const row of coverageLaneSummaries) {
      const lane = asRecord(row.lane)
      const stats = asRecord(row.stats)
      const laneId = text(lane.id)
      if (!laneId) continue
      const laneName = text(lane.name, text(lane.slug, laneId))
      const currentCovered = Boolean(stats.currentCovered)
      const nextGapStartAt = text(stats.nextGapStartAt)
      const nextGapTs = nextGapStartAt ? new Date(nextGapStartAt).getTime() : Number.NaN
      if (!currentCovered) {
        alerts.push({
          laneId,
          severity: 'critical',
          title: `${laneName} is uncovered now`,
          description: `This duty currently has ${numberValue(stats.currentCoverageCount, 0)} of ${numberValue(lane.requiredHeadcount, 1)} required responders assigned.`,
        })
        continue
      }
      if (Number.isFinite(nextGapTs) && nextGapTs <= nowTs + 24 * 60 * 60 * 1000) {
        alerts.push({
          laneId,
          severity: 'warning',
          title: `${laneName} has an upcoming gap`,
          description: `Coverage drops at ${formatDateTime(nextGapStartAt)} unless another shift is assigned.`,
        })
        continue
      }
      if (numberValue(stats.openDemandCount, 0) > 0) {
        alerts.push({
          laneId,
          severity: 'notice',
          title: `${laneName} still has open staffing demand`,
          description: `${numberValue(stats.openDemandCount, 0)} demand item(s) are still open for this lane.`,
        })
      }
    }
    return alerts.sort((a, b) => {
      const weight = { critical: 0, warning: 1, notice: 2 }
      return weight[a.severity] - weight[b.severity]
    })
  }, [coverageLaneSummaries])
  const persistedCoverageAlertByLane = useMemo(() => {
    const map = new Map<string, JsonMap[]>()
    coverageLaneAlertRows.forEach((row) => {
      const laneId = text(row.coverageLaneId)
      if (!laneId) return
      const bucket = map.get(laneId) ?? []
      bucket.push(row)
      map.set(laneId, bucket)
    })
    return map
  }, [coverageLaneAlertRows])

  async function withBusy<T>(key: string, task: () => Promise<T>): Promise<T | null> {
    setBusyKey(key)
    setError(null)
    setSuccess(null)
    try {
      return await task()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
      return null
    } finally {
      setBusyKey(null)
    }
  }

  async function loadBizes() {
    const rows = await withBusy('load.bizes', () => studioApi.listBizes())
    if (!rows) return
    const mapped = asArray(rows)
    if (mapped.length === 0) {
      setBizes([])
      setSelectedBizId('')
      router.replace('/owner/onboarding')
      return
    }
    setBizes(mapped)
    const selectedStillExists = mapped.some((row) => text((row as JsonMap).id) === selectedBizId)
    if ((!selectedBizId || !selectedStillExists) && mapped[0]) {
      setSelectedBizId(text(mapped[0].id))
    }
  }

  async function loadBizData(bizId: string) {
    if (!bizId) return

    const result = await withBusy('load.bizData', async () => {
      const responses = await Promise.allSettled([
        studioApi.listLocations(bizId),
        studioApi.listResources(bizId),
        studioApi.listCoverageLanes(bizId),
        studioApi.listServices(bizId),
        studioApi.listProducts(bizId),
        studioApi.listOffers(bizId),
        studioApi.listPublicOffers(bizId),
        studioApi.listCalendars(bizId),
        studioApi.listBookingOrders(bizId),
        studioApi.listPaymentIntents(bizId),
        studioApi.listCrmContacts(bizId),
        studioApi.listBizMembers(bizId),
        studioApi.listOutboundMessages(bizId),
        studioApi.listAnalyticsReports(bizId),
        studioApi.listWorkflows(bizId),
        studioApi.getCoverageLaneReportSummary(bizId),
      ])
      return responses
    })

    if (!result) return

    const pick = (index: number) => {
      const item = result[index]
      return item.status === 'fulfilled' ? asArray(item.value as unknown[]) : []
    }
    const pickRecord = (index: number) => {
      const item = result[index]
      return item.status === 'fulfilled' ? asRecord(item.value) : {}
    }

    const nextLocations = pick(0)
    setLocations(nextLocations)
    setResources(pick(1))
    const nextCoverageLanes = pick(2)
    setCoverageLanes(nextCoverageLanes)
    setServices(pick(3))
    setProducts(pick(4))
    const nextOffers = pick(5)
    setOffers(nextOffers)
    const nextPublicOffers = pick(6)
    setPublicOffers(nextPublicOffers)
    const nextCalendars = pick(7)
    setCalendars(nextCalendars)
    setCalendarLoadAttemptedByBiz((current) => ({
      ...current,
      [bizId]: true,
    }))
    setBookingOrders(pick(8))
    setPaymentIntents(pick(9))
    setCrmContacts(pick(10))
    setBizMembers(pick(11))
    const nextOutbound = pick(12)
    setOutboundMessages(nextOutbound)
    const nextReports = pick(13)
    setReportDefinitions(nextReports)
    const nextWorkflows = pick(14)
    setWorkflows(nextWorkflows)
    setCoverageLaneReport(pickRecord(15))

    setSelectedLocationId((current) =>
      current && nextLocations.some((row) => text(row.id) === current) ? current : '',
    )

    const selectedStillExists = nextCalendars.some((row) => text((row as JsonMap).id) === selectedCalendarId)
    if (!selectedStillExists) {
      const laneCalendarIds = new Set(nextCoverageLanes.map((row) => text(row.primaryCalendarId)).filter(Boolean))
      const preferredCalendar = nextCalendars.find((row) => !laneCalendarIds.has(text(row.id))) ?? nextCalendars[0]
      setSelectedCalendarId(text(preferredCalendar?.id))
    }
    setDidAutoProvisionCalendar(false)

    if (!bookingOfferId && nextPublicOffers[0]) {
      setBookingOfferId(text(nextPublicOffers[0].id))
    }
    setSelectedReportId((current) => {
      if (nextReports.some((row) => text(row.id) === current)) return current
      return text(nextReports[0]?.id)
    })

    if (nextOffers[0]) {
      const offerId = text(nextOffers[0].id)
      if (offerId && !offerVersionsByOffer[offerId]) {
        await loadOfferVersions(offerId)
      }
    }
  }

  async function loadCalendarTimeline(bizId: string, calendarId: string) {
    if (!bizId || !calendarId) return

    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setMonth(end.getMonth() + 2)
    end.setDate(0)
    end.setHours(23, 59, 59, 999)

    const timeline = await withBusy('load.calendarTimeline', () =>
      studioApi.fetchCalendarTimeline(
        bizId,
        calendarId,
        {
          startAt: start.toISOString(),
          endAt: end.toISOString(),
        },
      ),
    )
    if (!timeline) return
    setCalendarTimeline(timeline)
  }

  async function loadAvailabilityRules(bizId: string, calendarId: string) {
    if (!bizId || !calendarId) {
      setAvailabilityRules([])
      return
    }
    const rows = await withBusy('load.availabilityRules', () => studioApi.listAvailabilityRules(bizId, calendarId))
    if (!rows) return
    setAvailabilityRules(asArray(rows))
  }

  async function loadCoverageLaneReport(bizId: string) {
    if (!bizId) return
    await withBusy('coverageAlerts.evaluate', () =>
      studioApi.evaluateCoverageLaneAlerts(bizId, {
        locationId: selectedLocationId || undefined,
      }),
    )
    const report = await withBusy('load.coverageReport', () =>
      studioApi.getCoverageLaneReportSummary(bizId, {
        locationId: selectedLocationId || undefined,
      }),
    )
    if (!report) return
    setCoverageLaneReport(asRecord(report))
    await loadCoverageLaneAlertsRows(bizId)
  }

  async function loadCoverageLaneMemberships(laneId: string) {
    if (!selectedBizId || !laneId) return
    const rows = await withBusy('load.coverageMemberships', () => studioApi.listCoverageLaneMemberships(selectedBizId, laneId))
    if (!rows) return
    setCoverageLaneMembershipsByLane((current) => ({
      ...current,
      [laneId]: asArray(rows),
    }))
  }

  async function loadCoverageLaneAlertsRows(bizId: string) {
    if (!bizId) return
    const rows = await withBusy('load.coverageAlerts', () =>
      studioApi.listCoverageLaneAlerts(bizId, { status: 'active' }),
    )
    if (!rows) return
    setCoverageLaneAlertRows(asArray(rows))
  }

  async function loadCoverageLaneShiftTemplates(laneId: string) {
    if (!selectedBizId || !laneId) return
    const rows = await withBusy('load.coverageTemplates', () => studioApi.listCoverageLaneShiftTemplates(selectedBizId, laneId))
    if (!rows) return
    setCoverageShiftTemplatesByLane((current) => ({
      ...current,
      [laneId]: asArray(rows),
    }))
  }

  function resetCoverageLaneForm() {
    setCoverageLaneEditingId('')
    setCoverageLaneName('')
    setCoverageLaneSlug('')
    setCoverageLaneType('front_desk')
    setCoverageLanePresenceMode('onsite')
    setCoverageLaneLocationId(selectedLocationId || text(locations[0]?.id))
    setCoverageLaneRequiredHeadcount('1')
    setCoverageLaneStatus('active')
    setCoverageLaneEscalationEnabled(false)
    setCoverageLaneEscalationAfterMinutes('15')
    setCoverageLanePolicyExtra({})
  }

  function openCreateCoverageLaneDialog() {
    setCoverageLaneDialogMode('create')
    resetCoverageLaneForm()
    setCoverageLaneDialogOpen(true)
  }

  function openEditCoverageLaneDialog(lane: JsonMap) {
    const policy = asRecord(lane.policy)
    const escalation = asRecord(policy.escalation)
    const { escalation: _ignoredEscalation, ...policyExtra } = policy
    setCoverageLaneDialogMode('edit')
    setCoverageLaneEditingId(text(lane.id))
    setCoverageLaneName(text(lane.name, ''))
    setCoverageLaneSlug(text(lane.slug, slugify(text(lane.name, 'lane'))))
    setCoverageLaneType(text(lane.laneType, 'front_desk'))
    setCoverageLanePresenceMode(text(lane.presenceMode, 'onsite'))
    setCoverageLaneLocationId(text(lane.locationId))
    setCoverageLaneRequiredHeadcount(String(numberValue(lane.requiredHeadcount, 1)))
    setCoverageLaneStatus(text(lane.status, 'active'))
    setCoverageLaneEscalationEnabled(escalation.enabled === true)
    setCoverageLaneEscalationAfterMinutes(String(numberValue(escalation.afterMinutes, 15)))
    setCoverageLanePolicyExtra(policyExtra)
    setCoverageLaneDialogOpen(true)
  }

  async function submitCoverageLaneDialog() {
    if (!selectedBizId || !coverageLaneName.trim()) {
      setError('Coverage lane name is required.')
      return
    }
    const slug = slugify(coverageLaneSlug || coverageLaneName, 'coverage-lane')
    const payload = {
      name: coverageLaneName.trim(),
      slug,
      locationId: coverageLaneLocationId || null,
      laneType: coverageLaneType,
      presenceMode: coverageLanePresenceMode,
      requiredHeadcount: Math.max(1, Number.parseInt(coverageLaneRequiredHeadcount || '1', 10) || 1),
      status: coverageLaneStatus,
      policy: {
        ...coverageLanePolicyExtra,
        escalation: {
          enabled: coverageLaneEscalationEnabled,
          afterMinutes: Math.max(1, Number.parseInt(coverageLaneEscalationAfterMinutes || '15', 10) || 15),
        },
      },
    }
    const result = await withBusy(
      coverageLaneDialogMode === 'create' ? 'coverageLane.create' : 'coverageLane.patch',
      () =>
        coverageLaneDialogMode === 'create'
          ? studioApi.createCoverageLane(selectedBizId, payload)
          : studioApi.patchCoverageLane(selectedBizId, coverageLaneEditingId, payload),
    )
    if (!result) return
    setCoverageLaneDialogOpen(false)
    await loadBizData(selectedBizId)
    await loadCoverageLaneReport(selectedBizId)
    setSuccess(coverageLaneDialogMode === 'create' ? 'Coverage lane created.' : 'Coverage lane updated.')
  }

  async function openCoverageMembershipDialog(lane: JsonMap) {
    const laneId = text(lane.id)
    setCoverageMembershipLaneId(laneId)
    setCoverageMembershipResourceId('')
    setCoverageMembershipRole('primary')
    setCoverageMembershipParticipationMode(text(lane.presenceMode, 'onsite'))
    setCoverageMembershipStatus('active')
    setCoverageMembershipDialogOpen(true)
    await loadCoverageLaneMemberships(laneId)
  }

  async function submitCoverageMembershipDialog() {
    if (!selectedBizId || !coverageMembershipLaneId || !coverageMembershipResourceId) {
      setError('Select a lane member first.')
      return
    }
    const result = await withBusy('coverageMembership.create', () =>
      studioApi.createCoverageLaneMembership(selectedBizId, coverageMembershipLaneId, {
        resourceId: coverageMembershipResourceId,
        membershipRole: coverageMembershipRole,
        participationMode: coverageMembershipParticipationMode,
        status: coverageMembershipStatus,
      }),
    )
    if (!result) return
    await loadCoverageLaneMemberships(coverageMembershipLaneId)
    setCoverageMembershipResourceId('')
    setSuccess('Coverage lane member added.')
  }

  async function toggleCoverageMembershipStatus(membership: JsonMap) {
    if (!selectedBizId) return
    const membershipId = text(membership.id)
    if (!membershipId) return
    const nextStatus = text(membership.status) === 'active' ? 'inactive' : 'active'
    const updated = await withBusy('coverageMembership.patch', () =>
      studioApi.patchCoverageLaneMembership(selectedBizId, membershipId, { status: nextStatus }),
    )
    if (!updated) return
    if (coverageMembershipLaneId) {
      await loadCoverageLaneMemberships(coverageMembershipLaneId)
    }
    setSuccess(nextStatus === 'active' ? 'Coverage member reactivated.' : 'Coverage member deactivated.')
  }

  function openCoverageShiftDialog(lane: JsonMap) {
    const laneId = text(lane.id)
    const start = new Date()
    start.setMinutes(0, 0, 0)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    setCoverageShiftLaneId(laneId)
    setCoverageShiftTitle(`${text(lane.name, 'Coverage')} on-call`)
    setCoverageShiftStartsAt(toDateTimeLocalValue(start))
    setCoverageShiftEndsAt(toDateTimeLocalValue(end))
    setCoverageShiftResourceId('')
    setCoverageShiftDialogOpen(true)
    void loadCoverageLaneMemberships(laneId)
  }

  async function openCoverageTemplateDialog(lane: JsonMap) {
    const laneId = text(lane.id)
    setCoverageTemplateLaneId(laneId)
    setCoverageTemplateName(`${text(lane.name, 'Coverage')} weekdays`)
    setCoverageTemplateStartTime('09:00')
    setCoverageTemplateEndTime('17:00')
    setCoverageTemplateDayOfWeeks([1, 2, 3, 4, 5])
    setCoverageTemplateResourceId('')
    setCoverageTemplateAutoPublishEnabled(true)
    setCoverageTemplatePublishWindowDays('14')
    setCoverageTemplateDialogOpen(true)
    await loadCoverageLaneShiftTemplates(laneId)
  }

  async function submitCoverageTemplateDialog() {
    if (!selectedBizId || !coverageTemplateLaneId || !coverageTemplateName.trim()) {
      setError('Template name is required.')
      return
    }
    const created = await withBusy('coverageTemplate.create', () =>
      studioApi.createCoverageLaneShiftTemplate(selectedBizId, coverageTemplateLaneId, {
        name: coverageTemplateName.trim(),
        dayOfWeeks: coverageTemplateDayOfWeeks,
        startTime: coverageTemplateStartTime,
        endTime: coverageTemplateEndTime,
        defaultResourceId: coverageTemplateResourceId || null,
        autoPublishEnabled: coverageTemplateAutoPublishEnabled,
        publishWindowDays: Math.max(1, Number.parseInt(coverageTemplatePublishWindowDays || '14', 10) || 14),
        fillMode: coverageTemplateResourceId ? 'direct_assign' : 'invite_accept',
      }),
    )
    if (!created) return
    await loadCoverageLaneShiftTemplates(coverageTemplateLaneId)
    setSuccess('Coverage template created.')
  }

  async function publishCoverageTemplate(templateId: string) {
    if (!selectedBizId) return
    const result = await withBusy('coverageTemplate.publish', () =>
      studioApi.publishCoverageLaneShiftTemplate(selectedBizId, templateId, {}),
    )
    if (!result) return
    if (coverageTemplateLaneId) {
      await loadCoverageLaneShiftTemplates(coverageTemplateLaneId)
    }
    await loadCoverageLaneReport(selectedBizId)
    setSuccess('Coverage template published.')
  }

  async function submitCoverageShiftDialog() {
    if (!selectedBizId || !coverageShiftLaneId) {
      setError('Select a coverage lane first.')
      return
    }
    const startsAt = fromDateTimeLocalValue(coverageShiftStartsAt)
    const endsAt = fromDateTimeLocalValue(coverageShiftEndsAt)
    if (!startsAt || !endsAt) {
      setError('Start and end time are required.')
      return
    }
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      setError('Shift end must be after shift start.')
      return
    }
    const created = await withBusy('coverageShift.create', () =>
      studioApi.createCoverageLaneOnCallShift(selectedBizId, coverageShiftLaneId, {
        title: coverageShiftTitle.trim() || undefined,
        startsAt,
        endsAt,
        resourceId: coverageShiftResourceId || undefined,
      }),
    )
    if (!created) return
    setCoverageShiftDialogOpen(false)
    await loadCoverageLaneReport(selectedBizId)
    if (coverageMembershipDialogOpen && coverageMembershipLaneId === coverageShiftLaneId) {
      await loadCoverageLaneMemberships(coverageShiftLaneId)
    }
    setSuccess(coverageShiftResourceId ? 'Coverage shift assigned.' : 'Coverage demand created.')
  }

  async function loadOfferVersions(offerId: string) {
    if (!selectedBizId || !offerId) return
    const versions = await withBusy('load.offerVersions', () => studioApi.listOfferVersions(selectedBizId, offerId))
    if (!versions) return
    const mapped = asArray(versions)
    setOfferVersionsByOffer((prev) => ({ ...prev, [offerId]: mapped }))
    if (!bookingOfferVersionId && mapped[0]) {
      setBookingOfferVersionId(text(mapped[0].id))
    }
  }

  async function loadBookingSlots(offerId: string, offerVersionId?: string) {
    if (!selectedBizId || !offerId) return
    const availability = await withBusy('load.slots', () =>
      studioApi.getPublicOfferAvailability(selectedBizId, offerId, 30, { offerVersionId }),
    )
    if (!availability) return
    const nextSlots = asArray(asRecord(availability).slots)
      .map((row) => ({ startAt: text(row.startAt), endAt: text(row.endAt) }))
      .filter((slot) => slot.startAt && slot.endAt)
    setBookingSlots(nextSlots)
    setBookingSlotStartAt(nextSlots[0]?.startAt ?? '')
  }

  async function openBookingDialog() {
    setBookingDialogOpen(true)
    if (!bookingOfferId) {
      const first = publicOffers[0]
      if (first) {
        const offerId = text(first.id)
        setBookingOfferId(offerId)
        await loadOfferVersions(offerId)
      }
      return
    }
    if (!offerVersionsByOffer[bookingOfferId]) {
      await loadOfferVersions(bookingOfferId)
    }
    if (bookingOfferVersionId) {
      await loadBookingSlots(bookingOfferId, bookingOfferVersionId)
    }
  }

  async function createBookingFromDialog() {
    if (!selectedBizId || !bookingOfferId || !bookingOfferVersionId || !bookingSlotStartAt) {
      setError('Select offer, version, and slot first.')
      return
    }

    const durationMin = numberValue(selectedOfferVersion?.defaultDurationMin, 60)
    const basePriceMinor = numberValue(selectedOfferVersion?.basePriceMinor, 0)

    const created = await withBusy('booking.create', () =>
      studioApi.createBookingOrder(selectedBizId, {
        offerId: bookingOfferId,
        offerVersionId: bookingOfferVersionId,
        customerUserId: user?.id,
        status: 'confirmed',
        currency: text(selectedOfferVersion?.currency, 'USD'),
        subtotalMinor: basePriceMinor,
        taxMinor: 0,
        feeMinor: 0,
        discountMinor: 0,
        totalMinor: basePriceMinor,
        requestedStartAt: bookingSlotStartAt,
        requestedEndAt: plusMinutes(bookingSlotStartAt, durationMin),
        confirmedStartAt: bookingSlotStartAt,
        confirmedEndAt: plusMinutes(bookingSlotStartAt, durationMin),
        locationId: text(locations[0]?.id),
        metadata: {
          source: 'customer_dashboard',
        },
      }),
    )

    if (!created) return
    setBookingDialogOpen(false)
    await loadBizData(selectedBizId)
    setSuccess('Booking created.')
  }

  async function createStarterWorkspace(options?: { silent?: boolean; postRefresh?: boolean }) {
    const result = await withBusy('seed.starter', async () => {
      const stamp = Date.now().toString(36)
      const ownerName = text(user?.name, '').trim()
      const ownerEmailLocal = text(user?.email, '').split('@')[0] ?? ''
      const ownerEmailToken = ownerEmailLocal.split(/[^a-zA-Z]+/).filter(Boolean)[0] ?? ''
      const fallbackName = ownerEmailToken
        ? `${ownerEmailToken.slice(0, 1).toUpperCase()}${ownerEmailToken.slice(1).toLowerCase()}`
        : 'Starter'
      const firstName = ownerName.split(/\s+/).filter(Boolean)[0] ?? fallbackName
      const businessName = `${firstName}'s Studio`
      const biz = asRecord(
        await studioApi.createBiz({
          name: businessName,
          slug: `starter-biz-${stamp}`,
          timezone: 'America/Los_Angeles',
          currency: 'USD',
        }),
      )
      const bizId = text(biz.id)
      if (!bizId) throw new Error('Failed to create starter biz.')

      const location = asRecord(
        await studioApi.createLocation(bizId, {
          name: 'Main Location',
          slug: `main-location-${stamp}`,
          type: 'physical',
          timezone: 'America/Los_Angeles',
        }),
      )

      const resource = asRecord(
        await studioApi.createResource(bizId, {
          name: 'Default Agent',
          slug: `default-agent-${stamp}`,
          type: 'host',
          locationId: text(location.id),
          status: 'active',
        }),
      )

      const calendar = asRecord(
        await studioApi.createCalendar(bizId, {
          name: 'Main Calendar',
          timezone: 'America/Los_Angeles',
          slotDurationMin: 30,
          slotIntervalMin: 15,
          defaultMode: 'available_by_default',
        }),
      )

      const ownerUserId = text(user?.id)
      if (ownerUserId) {
        await studioApi.createCalendarBinding(bizId, {
          calendarId: text(calendar.id),
          ownerType: 'user',
          ownerUserId,
          locationId: text(location.id),
          isPrimary: true,
          isActive: true,
        })
      }

      await studioApi.createCalendarBinding(bizId, {
        calendarId: text(calendar.id),
        ownerType: 'resource',
        resourceId: text(resource.id),
        locationId: text(location.id),
        isPrimary: !ownerUserId,
        isActive: true,
      })

      const serviceGroup = asRecord(
        await studioApi.createServiceGroup(bizId, {
          name: 'General Services',
          slug: `general-services-${stamp}`,
        }),
      )

      const offer = asRecord(
        await studioApi.createOffer(bizId, {
          serviceGroupId: text(serviceGroup.id),
          name: 'Consultation 60m',
          slug: `consultation-60-${stamp}`,
          executionMode: 'slot',
        }),
      )

      const offerVersion = asRecord(await studioApi.createOfferVersion(bizId, text(offer.id), {
        version: 1,
        status: 'published',
        durationMode: 'fixed',
        defaultDurationMin: 60,
        basePriceMinor: 12000,
        currency: 'USD',
      }))

      await studioApi.createCalendarBinding(bizId, {
        calendarId: text(calendar.id),
        ownerType: 'offer_version',
        offerVersionId: text(offerVersion.id),
        isPrimary: true,
        isRequired: true,
        isActive: true,
      })

      await studioApi.patchOffer(bizId, text(offer.id), {
        isPublished: true,
        status: 'active',
      })

      for (const dayOfWeek of [1, 2, 3, 4, 5]) {
        await studioApi.createAvailabilityRule(bizId, text(calendar.id), {
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

      // Fire first-run owner welcome email via the same outbound pipeline,
      // but keep it out of the owner-facing dashboard surface.
      await studioApi.sendOwnerWelcomeEmail(bizId).catch(() => null)

      return { bizId }
    })

    if (!result) return null

    setSelectedBizId(result.bizId)
    const postRefresh = options?.postRefresh ?? true
    if (postRefresh) {
      await loadBizes()
      await loadBizData(result.bizId)
    }
    if (!options?.silent) {
      setSuccess('Starter workspace created.')
    }
    return result.bizId
  }

  async function saveBizVisibility() {
    if (!selectedBizId) return
    const updated = await withBusy('biz.visibility', () =>
      studioApi.patchBiz(selectedBizId, { visibility: bizVisibility }),
    )
    if (!updated) return
    await loadBizes()
    await loadBizData(selectedBizId)
    setSuccess('Business visibility updated.')
  }

  async function ensureCalendarResource(bizId: string) {
    const existingResourceId = text(resources[0]?.id)
    if (existingResourceId) return existingResourceId

    const timezone = text((selectedBiz as JsonMap | null)?.timezone, 'America/Los_Angeles')
    let locationId = text(locations[0]?.id)
    if (!locationId) {
      const location = await withBusy('calendar.seed.location', () =>
        studioApi.createLocation(bizId, {
          name: 'Main Location',
          slug: `main-location-${Date.now().toString(36)}`,
          type: 'physical',
          timezone,
        }),
      )
      if (!location) return null
      locationId = text(asRecord(location).id)
    }
    if (!locationId) return null

    const resource = await withBusy('calendar.seed.resource', () =>
      studioApi.createResource(bizId, {
        name: 'Default Provider',
        slug: `default-provider-${Date.now().toString(36)}`,
        type: 'host',
        status: 'active',
        locationId,
      }),
    )
    if (!resource) return null
    return text(asRecord(resource).id)
  }

  async function createOwnerCalendar(options?: { silent?: boolean }) {
    if (!selectedBizId) return
    const stamp = Date.now().toString(36)
    const timezone = text((selectedBiz as JsonMap | null)?.timezone, 'America/Los_Angeles')
    const resourceId = await ensureCalendarResource(selectedBizId)
    if (!resourceId) {
      setError('Unable to provision a provider for this calendar.')
      return
    }

    const calendar = await withBusy('calendar.create', () =>
      studioApi.createCalendar(selectedBizId, {
        name: `Main Calendar ${stamp.slice(-4)}`,
        timezone,
        slotDurationMin: 60,
        slotIntervalMin: 15,
        defaultMode: 'available_by_default',
      }),
    )
    if (!calendar) return

    const calendarId = text(asRecord(calendar).id)
    if (!calendarId) return
    await withBusy('calendar.bindResource', () =>
      studioApi.createCalendarBinding(selectedBizId, {
        calendarId,
        ownerType: 'resource',
        resourceId,
        isPrimary: true,
        isActive: true,
      }),
    )

    for (const dayOfWeek of [1, 2, 3, 4, 5]) {
      await withBusy(`availability.seed.${dayOfWeek}`, () =>
        studioApi.createAvailabilityRule(selectedBizId, calendarId, {
          name: `Business Hours ${dayOfWeek}`,
          mode: 'recurring',
          frequency: 'weekly',
          dayOfWeek,
          startTime: '09:00',
          endTime: '17:00',
          action: 'available',
          priority: 100,
          isActive: true,
        }),
      )
    }

    await loadBizData(selectedBizId)
    setSelectedCalendarId(calendarId)
    setDidAutoProvisionCalendar(false)
    if (!options?.silent) {
      setSuccess('Booking calendar created.')
    }
  }

  async function createQuickService() {
    if (!selectedBizId) return
    const name = newServiceName.trim()
    if (!name) {
      setError('Service name is required.')
      return
    }
    const stamp = Date.now().toString(36)
    const groupSlug = `general-services-${stamp}`
    const groupRows = await withBusy('serviceGroups.load', () => studioApi.listServiceGroups(selectedBizId))
    if (!groupRows) return

    let serviceGroupId = text(asArray(groupRows)[0]?.id)
    if (!serviceGroupId) {
      const createdGroup = await withBusy('serviceGroups.create', () =>
        studioApi.createServiceGroup(selectedBizId, {
          name: 'General Services',
          slug: groupSlug,
        }),
      )
      if (!createdGroup) return
      serviceGroupId = text(asRecord(createdGroup).id)
    }

    const created = await withBusy('serviceGroups.create', () =>
      studioApi.createServiceGroup(selectedBizId, {
        name,
        slug: `${slugify(name, 'group')}-${stamp.slice(-4)}`,
        status: 'active',
      }),
    )
    if (!created) return

    setNewServiceName('')
    await loadBizData(selectedBizId)
    setSuccess('Service group created.')
  }

  async function createQuickOffer() {
    if (!selectedBizId) return
    const name = newOfferName.trim()
    if (!name) {
      setError('Offer name is required.')
      return
    }
    const priceMinor = Math.max(0, Math.round(Number(newOfferPrice || '0') * 100))
    const defaultDurationMin = Math.max(5, Math.round(Number(newOfferDefaultDurationMin || '60')))
    const minDurationMin = Math.max(5, Math.round(Number(newOfferMinDurationMin || '30')))
    const maxDurationMin = Math.max(minDurationMin, Math.round(Number(newOfferMaxDurationMin || '240')))
    const durationStepMin = Math.max(5, Math.round(Number(newOfferDurationStepMin || '15')))
    const stamp = Date.now().toString(36)
    let serviceGroupId = text(services[0]?.id)
    if (!serviceGroupId) {
      const createdGroup = await withBusy('serviceGroups.create', () =>
        studioApi.createServiceGroup(selectedBizId, {
          name: 'General Services',
          slug: `general-services-${stamp}`,
        }),
      )
      if (!createdGroup) return
      serviceGroupId = text(asRecord(createdGroup).id)
    }
    if (!serviceGroupId) return
    const offer = await withBusy('offers.create', () =>
      studioApi.createOffer(selectedBizId, {
        serviceGroupId,
        name,
        slug: `${slugify(name, 'offer')}-${stamp.slice(-4)}`,
        executionMode: 'slot',
        status: 'active',
      }),
    )
    if (!offer) return

    const offerId = text(asRecord(offer).id)
    if (!offerId) return
    const version = await withBusy('offers.createVersion', () =>
      studioApi.createOfferVersion(selectedBizId, offerId, {
        version: 1,
        status: 'published',
        durationMode: newOfferDurationMode,
        defaultDurationMin,
        minDurationMin: newOfferDurationMode === 'variable' ? minDurationMin : undefined,
        maxDurationMin: newOfferDurationMode === 'variable' ? maxDurationMin : undefined,
        durationStepMin,
        basePriceMinor: priceMinor,
        currency: text((selectedBiz as JsonMap | null)?.currency, 'USD'),
      }),
    )
    if (!version) return

    if (selectedCalendarId) {
      await withBusy('calendarBindings.offerVersion.create', () =>
        studioApi.createCalendarBinding(selectedBizId, {
          calendarId: selectedCalendarId,
          ownerType: 'offer_version',
          offerVersionId: text(asRecord(version).id),
          isPrimary: true,
          isRequired: true,
          isActive: true,
        }),
      )
    }

    await withBusy('offers.publish', () =>
      studioApi.patchOffer(selectedBizId, offerId, { isPublished: true, status: 'active' }),
    )
    setNewOfferName('')
    setNewOfferDurationMode('fixed')
    setNewOfferDefaultDurationMin('60')
    setNewOfferMinDurationMin('30')
    setNewOfferMaxDurationMin('240')
    setNewOfferDurationStepMin('15')
    await loadBizData(selectedBizId)
    setSuccess('Offer created and published.')
  }

  async function applyRecurringAvailability(params: {
    dayOfWeeks: number[]
    startTime: string
    endTime: string
    resetOthers?: boolean
    successMessage: string
  }) {
    if (!selectedBizId || !selectedCalendarId) {
      setError('Select a calendar first.')
      return false
    }
    if (params.startTime >= params.endTime) {
      setError('End time must be after start time.')
      return false
    }

    const result = await withBusy('availability.quickApply', async () => {
      const rows = asArray(await studioApi.listAvailabilityRules(selectedBizId, selectedCalendarId))
      const targetDays = new Set(params.dayOfWeeks)

      for (const row of rows) {
        const mode = text(row.mode).toLowerCase()
        const frequency = text(row.frequency).toLowerCase()
        const action = text(row.action).toLowerCase()
        const dayOfWeek = Number(row.dayOfWeek)
        const isActive = row.isActive !== false
        if (!isActive) continue
        if (action !== 'available') continue
        if (mode !== 'recurring' && frequency !== 'weekly') continue
        if (!Number.isFinite(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) continue
        if (!params.resetOthers && !targetDays.has(dayOfWeek)) continue

        await studioApi.deactivateAvailabilityRule(selectedBizId, selectedCalendarId, text(row.id))
      }

      for (const dayOfWeek of params.dayOfWeeks) {
        await studioApi.createAvailabilityRule(selectedBizId, selectedCalendarId, {
          name: `${DAY_LABEL_BY_VALUE[dayOfWeek] ?? 'Open'} Hours`,
          mode: 'recurring',
          frequency: 'weekly',
          dayOfWeek,
          startTime: params.startTime,
          endTime: params.endTime,
          action: 'available',
          priority: 100,
          isActive: true,
        })
      }
    })

    if (!result) return false
    await loadAvailabilityRules(selectedBizId, selectedCalendarId)
    await loadCalendarTimeline(selectedBizId, selectedCalendarId)
    setSuccess(params.successMessage)
    return true
  }

  async function submitWeekAvailability() {
    const dayOfWeeks = availabilityWeekScope === 'all_week' ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]
    const ok = await applyRecurringAvailability({
      dayOfWeeks,
      startTime: availabilityWeekStartTime,
      endTime: availabilityWeekEndTime,
      successMessage: availabilityWeekScope === 'all_week' ? 'Weekly availability set for all days.' : 'Weekday availability updated.',
    })
    if (ok) setAvailabilityDialogOpen(false)
  }

  async function submitTemplateAvailability() {
    const template = AVAILABILITY_TEMPLATES[availabilityTemplateKey]
    if (!template) return
    const ok = await applyRecurringAvailability({
      dayOfWeeks: template.dayOfWeeks,
      startTime: template.startTime,
      endTime: template.endTime,
      resetOthers: true,
      successMessage: `Applied: ${template.label}.`,
    })
    if (ok) setAvailabilityDialogOpen(false)
  }

  async function saveWeeklyAvailabilitySlot(input: {
    dayOfWeek: number
    ruleId?: string
    startTime: string
    endTime: string
  }): Promise<boolean> {
    if (!selectedBizId || !selectedCalendarId) {
      setError('Select a calendar first.')
      return false
    }
    if (input.startTime >= input.endTime) {
      setError('End time must be after start time.')
      return false
    }

    const saved = await withBusy('availability.slot.save', async () => {
      if (input.ruleId) {
        await studioApi.patchAvailabilityRule(selectedBizId, selectedCalendarId, input.ruleId, {
          startTime: input.startTime,
          endTime: input.endTime,
          isActive: true,
        })
        return
      }
      await studioApi.createAvailabilityRule(selectedBizId, selectedCalendarId, {
        name: `${DAY_LABEL_BY_VALUE[input.dayOfWeek] ?? 'Open'} Hours`,
        mode: 'recurring',
        frequency: 'weekly',
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        action: 'available',
        priority: 100,
        isActive: true,
      })
    })
    if (!saved) return false
    await loadAvailabilityRules(selectedBizId, selectedCalendarId)
    await loadCalendarTimeline(selectedBizId, selectedCalendarId)
    setSuccess('Availability updated.')
    return true
  }

  async function removeWeeklyAvailabilitySlot(ruleId: string) {
    if (!selectedBizId || !selectedCalendarId) return
    const removed = await withBusy('availability.slot.remove', () =>
      studioApi.deactivateAvailabilityRule(selectedBizId, selectedCalendarId, ruleId),
    )
    if (!removed) return
    await loadAvailabilityRules(selectedBizId, selectedCalendarId)
    await loadCalendarTimeline(selectedBizId, selectedCalendarId)
    setSuccess('Availability removed.')
  }

  async function submitAdvancedAvailabilitySlot() {
    const dayOfWeek = Number(availabilityAdvancedDayOfWeek)
    if (!Number.isFinite(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      setError('Choose a valid day.')
      return
    }
    const ok = await saveWeeklyAvailabilitySlot({
      dayOfWeek,
      startTime: availabilityAdvancedStartTime,
      endTime: availabilityAdvancedEndTime,
    })
    if (ok) setAvailabilityAdvancedOpen(false)
  }

  async function ensureAnalyticsReport() {
    if (!selectedBizId) return null
    if (selectedReportDefinition) return text(selectedReportDefinition.id)

    const created = await withBusy('reports.create', () =>
      studioApi.createAnalyticsReport(selectedBizId, {
        projectionKey: `owner_overview_${Date.now().toString(36)}`,
        name: 'Owner Overview',
        description: 'Bookings, revenue, cancellations, and message performance.',
        spec: {
          type: 'owner_overview',
        },
      }),
    )
    if (!created) return null
    await loadBizData(selectedBizId)
    return text(asRecord(created).id)
  }

  async function renderSelectedReport() {
    if (!selectedBizId) return
    const reportId = text(selectedReportDefinition?.id) || (await ensureAnalyticsReport())
    if (!reportId) return
    const rendered = await withBusy('reports.render', () =>
      studioApi.renderAnalyticsReport(selectedBizId, reportId, {
        documentKey: `owner-overview-${Date.now().toString(36)}`,
        subjectType: 'biz',
        subjectId: selectedBizId,
      }),
    )
    if (!rendered) return
    setLastRenderedReport(asRecord(rendered))
    setSuccess('Report rendered.')
  }

  async function exportSelectedReport() {
    if (!selectedBizId) return
    const reportId = text(selectedReportDefinition?.id) || (await ensureAnalyticsReport())
    if (!reportId) return
    const exported = await withBusy('reports.export', () =>
      studioApi.exportAnalyticsReport(selectedBizId, {
        projectionId: reportId,
        format: 'csv',
        reason: 'Owner dashboard export',
      }),
    )
    if (!exported) return
    const exportId = text(asRecord(exported).exportId, text(asRecord(exported).documentId, ''))
    setSuccess(exportId ? `Export generated (${exportId}).` : 'Export generated.')
  }

  function dismissFirstSaleBanner() {
    if (!selectedBizId) return
    setFirstSaleDismissedByBiz((current) => {
      const next = { ...current, [selectedBizId]: true as const }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('owner-first-sale-dismissed', JSON.stringify(next))
      }
      return next
    })
  }

  useEffect(() => {
    if (!isAuthenticated) return
    void loadBizes()
  }, [isAuthenticated])

  useEffect(() => {
    if (!selectedBizId) return
    void loadBizData(selectedBizId)
  }, [selectedBizId])

  useEffect(() => {
    if (!selectedBizId || !selectedCalendarId) {
      setCalendarTimeline(null)
      setAvailabilityRules([])
      return
    }
    void loadCalendarTimeline(selectedBizId, selectedCalendarId)
    void loadAvailabilityRules(selectedBizId, selectedCalendarId)
  }, [selectedBizId, selectedCalendarId])

  useEffect(() => {
    if (!selectedBizId) {
      setCoverageLaneReport(null)
      return
    }
    void loadCoverageLaneReport(selectedBizId)
  }, [selectedBizId, selectedLocationId])

  useEffect(() => {
    if (!selectedBizId) return
    if (calendars.length > 0) return
    if (!calendarLoadAttemptedByBiz[selectedBizId]) return
    if (didAutoProvisionCalendar) return
    if (!bizes.some((row) => text(row.id) === selectedBizId)) return
    if (busyKey?.startsWith('load.')) return

    setDidAutoProvisionCalendar(true)
    void createOwnerCalendar({ silent: true })
  }, [bizes, busyKey, calendarLoadAttemptedByBiz, calendars.length, didAutoProvisionCalendar, selectedBizId])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center p-6">
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>Use your account to access the dashboard</CardDescription>
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
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create booking</DialogTitle>
              <DialogDescription>Select an offer, version, and time slot</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Offer</Label>
                <Select
                  value={bookingOfferId || '__none__'}
                  onValueChange={(value) => {
                    const nextValue = value === '__none__' ? '' : value
                    setBookingOfferId(nextValue)
                    setBookingOfferVersionId('')
                    setBookingSlots([])
                    setBookingSlotStartAt('')
                    if (nextValue) {
                      void loadOfferVersions(nextValue)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select offer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select offer</SelectItem>
                    {publicOffers.map((offer) => (
                      <SelectItem key={text(offer.id)} value={text(offer.id)}>
                        {text(offer.name, text(offer.slug, text(offer.id)))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Version</Label>
                <Select
                  value={bookingOfferVersionId || '__none__'}
                  onValueChange={(value) => {
                    const nextValue = value === '__none__' ? '' : value
                    setBookingOfferVersionId(nextValue)
                    if (bookingOfferId && nextValue) {
                      void loadBookingSlots(bookingOfferId, nextValue)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select version</SelectItem>
                    {selectedOfferVersions.map((version) => (
                      <SelectItem key={text(version.id)} value={text(version.id)}>
                        v{String(version.version ?? '?')} • {text(version.status, 'unknown')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Time slot</Label>
                <Select
                  value={bookingSlotStartAt || '__none__'}
                  onValueChange={(value) => setBookingSlotStartAt(value === '__none__' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select slot" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select slot</SelectItem>
                    {bookingSlots.map((slot) => (
                      <SelectItem key={slot.startAt} value={slot.startAt}>
                        {formatDateTime(slot.startAt)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setBookingDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void createBookingFromDialog()} disabled={!bookingSlotStartAt || busyKey !== null}>
                Create booking
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={availabilityDialogOpen} onOpenChange={setAvailabilityDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Availability</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-2">
              <div className="space-y-3">
                <label className="text-sm font-medium">Template</label>
                <div className="flex gap-2">
                  <Select
                    value={availabilityTemplateKey}
                    onValueChange={(value) => setAvailabilityTemplateKey(value as keyof typeof AVAILABILITY_TEMPLATES)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(AVAILABILITY_TEMPLATES).map(([key, template]) => (
                        <SelectItem key={key} value={key}>
                          {template.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => void submitTemplateAvailability()} disabled={availabilityBusy}>
                    Apply
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium">Weekly hours</label>
                <div className="flex gap-2">
                  <Select
                    value={availabilityWeekScope}
                    onValueChange={(value) => setAvailabilityWeekScope(value as 'weekdays' | 'all_week')}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekdays">Mon–Fri</SelectItem>
                      <SelectItem value="all_week">All days</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="time"
                    value={availabilityWeekStartTime}
                    onChange={(event) => setAvailabilityWeekStartTime(event.target.value)}
                    className="w-[100px]"
                  />
                  <span className="flex items-center text-muted-foreground">–</span>
                  <Input
                    type="time"
                    value={availabilityWeekEndTime}
                    onChange={(event) => setAvailabilityWeekEndTime(event.target.value)}
                    className="w-[100px]"
                  />
                  <Button onClick={() => void submitWeekAvailability()} disabled={availabilityBusy}>
                    Save
                  </Button>
                </div>
              </div>

              <button
                onClick={() => setAvailabilityAdvancedOpen(!availabilityAdvancedOpen)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className={availabilityAdvancedOpen ? 'rotate-90' : ''}>›</span>
                Add specific day
              </button>

              {availabilityAdvancedOpen ? (
                <div className="flex gap-2 border-t pt-2">
                  <Select value={availabilityAdvancedDayOfWeek} onValueChange={setAvailabilityAdvancedDayOfWeek}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Day" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_OPTIONS.map((day) => (
                        <SelectItem key={day.value} value={String(day.value)}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="time"
                    value={availabilityAdvancedStartTime}
                    onChange={(event) => setAvailabilityAdvancedStartTime(event.target.value)}
                    className="w-[100px]"
                  />
                  <span className="flex items-center text-muted-foreground">–</span>
                  <Input
                    type="time"
                    value={availabilityAdvancedEndTime}
                    onChange={(event) => setAvailabilityAdvancedEndTime(event.target.value)}
                    className="w-[100px]"
                  />
                  <Button onClick={() => void submitAdvancedAvailabilitySlot()} disabled={availabilityBusy}>
                    Add
                  </Button>
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={coverageLaneDialogOpen} onOpenChange={setCoverageLaneDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{coverageLaneDialogMode === 'create' ? 'New coverage lane' : 'Edit coverage lane'}</DialogTitle>
              <DialogDescription>Define the operational duty, where it belongs, and how much live coverage it needs.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Name</Label>
                <Input value={coverageLaneName} onChange={(event) => setCoverageLaneName(event.target.value)} placeholder="Front Desk" />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={coverageLaneSlug} onChange={(event) => setCoverageLaneSlug(event.target.value)} placeholder="front-desk" />
              </div>
              <div className="space-y-2">
                <Label>Required headcount</Label>
                <Input
                  type="number"
                  min="1"
                  value={coverageLaneRequiredHeadcount}
                  onChange={(event) => setCoverageLaneRequiredHeadcount(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Lane type</Label>
                <Select value={coverageLaneType} onValueChange={setCoverageLaneType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="front_desk">Front desk</SelectItem>
                    <SelectItem value="phone_response">Phone response</SelectItem>
                    <SelectItem value="remote_response">Remote response</SelectItem>
                    <SelectItem value="triage">Triage</SelectItem>
                    <SelectItem value="dispatch">Dispatch</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Presence mode</Label>
                <Select value={coverageLanePresenceMode} onValueChange={setCoverageLanePresenceMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="onsite">Onsite</SelectItem>
                    <SelectItem value="remote">Remote</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Select value={coverageLaneLocationId || '__none__'} onValueChange={(value) => setCoverageLaneLocationId(value === '__none__' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">All locations</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={text(location.id)} value={text(location.id)}>
                        {text(location.name, text(location.slug, text(location.id)))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={coverageLaneStatus} onValueChange={setCoverageLaneStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Escalation workflow</Label>
                <div className="flex items-center gap-3 rounded-md border p-3">
                  <Button
                    type="button"
                    variant={coverageLaneEscalationEnabled ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCoverageLaneEscalationEnabled((value) => !value)}
                  >
                    {coverageLaneEscalationEnabled ? 'Enabled' : 'Disabled'}
                  </Button>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Escalate if uncovered for</span>
                    <Input
                      type="number"
                      min="1"
                      className="h-8 w-24"
                      value={coverageLaneEscalationAfterMinutes}
                      onChange={(event) => setCoverageLaneEscalationAfterMinutes(event.target.value)}
                      disabled={!coverageLaneEscalationEnabled}
                    />
                    <span>minutes</span>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCoverageLaneDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void submitCoverageLaneDialog()} disabled={busyKey !== null}>
                {coverageLaneDialogMode === 'create' ? 'Create lane' : 'Save lane'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={coverageMembershipDialogOpen} onOpenChange={setCoverageMembershipDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add coverage member</DialogTitle>
              <DialogDescription>
                {coverageMembershipLane ? `Manage eligible responders for ${text(coverageMembershipLane.name, 'this lane')}.` : 'Select which resources can cover this duty.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-3">
                  <Label>Resource</Label>
                  <Select value={coverageMembershipResourceId || '__none__'} onValueChange={(value) => setCoverageMembershipResourceId(value === '__none__' ? '' : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select resource" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select resource</SelectItem>
                      {coverageResourceOptions.map((resource) => (
                        <SelectItem key={text(resource.id)} value={text(resource.id)}>
                          {text(resource.name, text(resource.slug, text(resource.id)))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={coverageMembershipRole} onValueChange={setCoverageMembershipRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">Primary</SelectItem>
                      <SelectItem value="backup">Backup</SelectItem>
                      <SelectItem value="overflow">Overflow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Mode</Label>
                  <Select value={coverageMembershipParticipationMode} onValueChange={setCoverageMembershipParticipationMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="onsite">Onsite</SelectItem>
                      <SelectItem value="remote">Remote</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={coverageMembershipStatus} onValueChange={setCoverageMembershipStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Current members</p>
                    <p className="text-xs text-muted-foreground">Use active memberships for the roster and inactive to pause someone without removing the lane history.</p>
                  </div>
                  <Button variant="secondary" onClick={() => void submitCoverageMembershipDialog()} disabled={busyKey !== null}>
                    Add member
                  </Button>
                </div>
                {coverageMembershipsForActiveLane.length === 0 ? (
                  <EmptyState title="No members yet" description="Add the first eligible responder for this lane." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Resource</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coverageMembershipsForActiveLane.map((membership) => {
                        const resource = resources.find((row) => text(row.id) === text(membership.resourceId))
                        const active = text(membership.status) === 'active'
                        return (
                          <TableRow key={text(membership.id)}>
                            <TableCell className="font-medium">{text(resource?.name, text(membership.resourceId, '-'))}</TableCell>
                            <TableCell>{text(membership.membershipRole, 'primary')}</TableCell>
                            <TableCell>{text(membership.participationMode, 'onsite')}</TableCell>
                            <TableCell>
                              <Badge variant={active ? 'outline' : 'secondary'}>{text(membership.status, 'unknown')}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => void toggleCoverageMembershipStatus(membership)}>
                                {active ? 'Deactivate' : 'Reactivate'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCoverageMembershipDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={coverageShiftDialogOpen} onOpenChange={setCoverageShiftDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Schedule coverage shift</DialogTitle>
              <DialogDescription>
                {coverageShiftLane ? `Create a direct assignment or open demand for ${text(coverageShiftLane.name, 'this lane')}.` : 'Create the next coverage block.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={coverageShiftTitle} onChange={(event) => setCoverageShiftTitle(event.target.value)} placeholder="Front Desk evening coverage" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Starts</Label>
                  <Input type="datetime-local" value={coverageShiftStartsAt} onChange={(event) => setCoverageShiftStartsAt(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Ends</Label>
                  <Input type="datetime-local" value={coverageShiftEndsAt} onChange={(event) => setCoverageShiftEndsAt(event.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Assign now</Label>
                <Select value={coverageShiftResourceId || '__none__'} onValueChange={(value) => setCoverageShiftResourceId(value === '__none__' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Leave empty to create open demand" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Create open demand</SelectItem>
                    {coverageResourceOptions.map((resource) => (
                      <SelectItem key={text(resource.id)} value={text(resource.id)}>
                        {text(resource.name, text(resource.slug, text(resource.id)))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCoverageShiftDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void submitCoverageShiftDialog()} disabled={busyKey !== null}>
                {coverageShiftResourceId ? 'Assign shift' : 'Create demand'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={coverageTemplateDialogOpen} onOpenChange={setCoverageTemplateDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Coverage templates</DialogTitle>
              <DialogDescription>
                {coverageTemplateLane
                  ? `Create recurring shift templates for ${text(coverageTemplateLane.name, 'this lane')}.`
                  : 'Create and publish recurring coverage windows.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Name</Label>
                  <Input value={coverageTemplateName} onChange={(event) => setCoverageTemplateName(event.target.value)} placeholder="Weekday front desk" />
                </div>
                <div className="space-y-2">
                  <Label>Start time</Label>
                  <Input type="time" value={coverageTemplateStartTime} onChange={(event) => setCoverageTemplateStartTime(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End time</Label>
                  <Input type="time" value={coverageTemplateEndTime} onChange={(event) => setCoverageTemplateEndTime(event.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Days</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAY_OPTIONS.map((day) => {
                      const active = coverageTemplateDayOfWeeks.includes(day.value)
                      return (
                        <Button
                          key={day.value}
                          type="button"
                          variant={active ? 'default' : 'outline'}
                          size="sm"
                          onClick={() =>
                            setCoverageTemplateDayOfWeeks((current) =>
                              current.includes(day.value)
                                ? current.filter((value) => value !== day.value)
                                : [...current, day.value].sort((a, b) => a - b),
                            )
                          }
                        >
                          {day.label.slice(0, 3)}
                        </Button>
                      )
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Default assignee</Label>
                  <Select value={coverageTemplateResourceId || '__none__'} onValueChange={(value) => setCoverageTemplateResourceId(value === '__none__' ? '' : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Open demand" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Open demand</SelectItem>
                      {coverageResourceOptions.map((resource) => (
                        <SelectItem key={text(resource.id)} value={text(resource.id)}>
                          {text(resource.name, text(resource.slug, text(resource.id)))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Publish horizon (days)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={coverageTemplatePublishWindowDays}
                    onChange={(event) => setCoverageTemplatePublishWindowDays(event.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Auto publish</Label>
                  <Button
                    type="button"
                    variant={coverageTemplateAutoPublishEnabled ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCoverageTemplateAutoPublishEnabled((value) => !value)}
                  >
                    {coverageTemplateAutoPublishEnabled ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Existing templates</p>
                    <p className="text-xs text-muted-foreground">Publish any template with one click to create future coverage demand and assignments.</p>
                  </div>
                  <Button variant="secondary" onClick={() => void submitCoverageTemplateDialog()} disabled={busyKey !== null}>
                    Create template
                  </Button>
                </div>
                {coverageTemplatesForActiveLane.length === 0 ? (
                  <EmptyState title="No templates yet" description="Create the first recurring shift recipe for this lane." />
                ) : (
                  <div className="grid gap-3">
                    {coverageTemplatesForActiveLane.map((template) => {
                      const rule = asRecord(template.recurrenceRule)
                      const days = asArray(rule.dayOfWeeks).map((value) => DAY_LABEL_BY_VALUE[numberValue(value, -1)]).filter(Boolean)
                      return (
                        <div key={text(template.id)} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{text(template.name, text(template.id))}</p>
                              <Badge variant="outline">{text(template.status, 'active')}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {days.join(', ')} · {text(rule.startTime)}-{text(rule.endTime)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Last published through {text(template.lastPublishedThrough) ? formatDateTime(text(template.lastPublishedThrough)) : 'never'}
                            </p>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => void publishCoverageTemplate(text(template.id))}>
                            Publish now
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCoverageTemplateDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="hidden w-64 shrink-0 border-r bg-card md:block">
            <div className="space-y-3 border-b px-4 py-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Biz Name</Label>
                <Select value={selectedBizId || '__none__'} onValueChange={(value) => setSelectedBizId(value === '__none__' ? '' : value)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select business" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select business</SelectItem>
                    {bizes.map((biz) => (
                      <SelectItem key={text(biz.id)} value={text(biz.id)}>
                        {text(biz.name, text(biz.slug, text(biz.id)))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {locations.length > 0 ? (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Location</Label>
                  <Select
                    value={selectedLocationId || '__all__'}
                    onValueChange={(value) => setSelectedLocationId(value === '__all__' ? '' : value)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All locations</SelectItem>
                      {locations.map((location) => (
                        <SelectItem key={text(location.id)} value={text(location.id)}>
                          {text(location.name, text(location.slug, text(location.id)))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
            <ScrollArea className="h-[calc(100vh-126px)]">
              <div className="flex min-h-full flex-col justify-between p-3">
                <div className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon
                    const active = section === item.key
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setSection(item.key)}
                        className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                          active
                            ? 'bg-primary text-primary-foreground font-medium'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="border-t pt-3">
                  <div className="space-y-1">
                    {footerNavItems.map((item) => {
                      const Icon = item.icon
                      const active = section === item.key
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setSection(item.key)}
                          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                            active
                              ? 'bg-primary text-primary-foreground font-medium'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </aside>

          {/* Main content */}
          <div className="min-w-0 flex-1">
            {/* Header */}
            {section === 'my_calendar' ? null : (
              <header className="border-b bg-card">
                <div className="flex h-14 items-center justify-between gap-4 px-6">
                  <div>
                    <h1 className="text-lg font-semibold">{activeNavItem?.label ?? section.replace('_', ' ')}</h1>
                    {selectedLocation ? (
                      <p className="text-xs text-muted-foreground">{text(selectedLocation.name, 'Selected location')}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <Button onClick={() => void openBookingDialog()}>
                      <Plus className="mr-2 h-4 w-4" />
                      New booking
                    </Button>
                  </div>
                </div>
              </header>
            )}

            {/* Content */}
            <main className={section === 'my_calendar' ? 'p-0' : 'space-y-6 p-6'}>
              {/* Alerts */}
              {error && (
                <Card className="border-destructive">
                  <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
                </Card>
              )}
              {success && (
                <Card className="border-green-500 bg-green-50 dark:bg-green-950">
                  <CardContent className="py-3 text-sm text-green-700 dark:text-green-300">{success}</CardContent>
                </Card>
              )}
              {showFirstSaleBanner && (
                <Card className="border-emerald-500/70 bg-emerald-50 dark:bg-emerald-950/40">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div>
                      <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">Yay! You got your first sale.</p>
                      <p className="text-sm text-emerald-700/90 dark:text-emerald-200/80">
                        Your booking page is live, payment worked, and your customer is on the calendar.
                      </p>
                    </div>
                    <Button variant="outline" className="border-emerald-300 bg-white/80" onClick={dismissFirstSaleBanner}>
                      Celebrate and continue
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* My Calendar */}
              {section === 'my_calendar' ? (
                selectedCalendarId ? (
                  <div className="space-y-4 p-4">
                    <Card className="border-border/70">
                      <CardContent className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={selectedScheduleOption?.kind === 'coverage_lane' ? 'secondary' : 'outline'}>
                              {selectedScheduleOption?.subtitle ?? 'Schedule'}
                            </Badge>
                            {selectedCoverageLane ? (
                              <Badge variant="outline">{text(selectedCoverageLane.presenceMode, 'onsite')}</Badge>
                            ) : null}
                          </div>
                          <p className="text-sm font-medium">{selectedScheduleOption?.label ?? 'Schedule'}</p>
                          <p className="text-xs text-muted-foreground">
                            {selectedCoverageLane
                              ? 'This lane shows who is currently carrying the duty and where support gaps remain.'
                              : 'Use the main booking calendars to manage customer-facing availability and internal schedule flow.'}
                          </p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <Select value={selectedCalendarId} onValueChange={setSelectedCalendarId}>
                            <SelectTrigger className="min-w-[260px]">
                              <SelectValue placeholder="Select schedule" />
                            </SelectTrigger>
                            <SelectContent>
                              {scheduleOptions.map((option) => (
                                <SelectItem key={option.calendarId} value={option.calendarId}>
                                  {option.label} · {option.subtitle}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedCoverageLane ? (
                            <div className="flex gap-2">
                              <Button variant="outline" onClick={() => openCoverageShiftDialog(selectedCoverageLane)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Schedule shift
                              </Button>
                              <Button variant="outline" onClick={() => setSection('team')}>
                                <Users className="mr-2 h-4 w-4" />
                                View coverage roster
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                    {selectedCoverageLane ? (
                      <Card>
                        <CardContent className="grid gap-4 py-4 sm:grid-cols-3">
                          {(() => {
                            const laneSummary = asRecord(coverageLaneSummaryById.get(text(selectedCoverageLane.id)))
                            const stats = asRecord(laneSummary.stats)
                            return (
                              <>
                                <div>
                                  <p className="text-xs text-muted-foreground">Current coverage</p>
                                  <p className="text-xl font-semibold">
                                    {numberValue(stats.currentCoverageCount, 0)} / {numberValue(selectedCoverageLane.requiredHeadcount, 1)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Upcoming gaps</p>
                                  <p className="text-xl font-semibold">{numberValue(stats.upcomingGapCount, 0)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Staffed time</p>
                                  <p className="text-xl font-semibold">{formatMinutesAsHours(numberValue(stats.staffedMinutes, 0))}</p>
                                </div>
                              </>
                            )
                          })()}
                        </CardContent>
                      </Card>
                    ) : null}
                    <CalendarTimelineView
                      timeline={calendarTimeline}
                      weeklyAvailabilitySlots={weeklyAvailabilitySlots}
                      availabilityBusy={availabilityBusy}
                      onOpenAvailabilityDialog={() => setAvailabilityDialogOpen(true)}
                      onSaveWeeklyAvailabilitySlot={saveWeeklyAvailabilitySlot}
                      onRemoveWeeklyAvailabilitySlot={removeWeeklyAvailabilitySlot}
                    />
                  </div>
                ) : (
                  <div className="p-6 space-y-4">
                    <EmptyState title="No calendar yet" description="Create your calendar to open booking hours." />
                    <div className="flex justify-center">
                      <Button onClick={() => void createOwnerCalendar()} disabled={busyKey !== null}>
                        {busyKey === 'calendar.create' ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating calendar...
                          </>
                        ) : (
                          'Create calendar'
                        )}
                      </Button>
                    </div>
                  </div>
                )
              ) : null}

              {/* Bookings */}
              {section === 'bookings' ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <StatCard title="Today's Bookings" value={filteredTodayBookings.length} />
                    <StatCard title="Upcoming" value={filteredUpcomingBookings.length} />
                    <StatCard title="Total" value={filteredBookings.length} />
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Bookings</CardTitle>
                      <CardDescription>Manage bookings and schedule</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {filteredBookings.length === 0 ? (
                        <EmptyState title="No bookings" description="Create your first booking to get started" />
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredBookings.map((row) => (
                              <BookingRow key={text(row.id)} row={row} />
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : null}

              {/* Team */}
              {section === 'team' ? (
                <div className="grid gap-6">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <StatCard title="Team members" value={teamMembers.length} />
                    <StatCard title="Coverage lanes" value={filteredCoverageLanes.length} />
                    <StatCard title="Current coverage gaps" value={numberValue(coverageReportSummary.currentGapCount, 0)} />
                  </div>
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle>Coverage Alerts</CardTitle>
                          <CardDescription>Act on current gaps and near-term risk before coverage drops.</CardDescription>
                        </div>
                        <Button variant="outline" onClick={() => setSection('reports')}>
                          <Activity className="mr-2 h-4 w-4" />
                          Open adherence view
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {coverageAlerts.length === 0 ? (
                        <EmptyState title="No active alerts" description="All tracked lanes are covered or have no near-term escalation risk." />
                      ) : (
                        <div className="grid gap-3">
                          {coverageAlerts.map((alert) => {
                            const lane = coverageLanes.find((row) => text(row.id) === alert.laneId)
                            const persisted = (persistedCoverageAlertByLane.get(alert.laneId) ?? []).find((row) =>
                              text(row.alertType) === (alert.severity === 'critical' ? 'uncovered_now' : alert.severity === 'warning' ? 'upcoming_gap' : 'open_demand'),
                            )
                            const variant = alert.severity === 'critical' ? 'destructive' : alert.severity === 'warning' ? 'secondary' : 'outline'
                            return (
                              <div key={`${alert.laneId}-${alert.severity}`} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant={variant}>{alert.severity}</Badge>
                                    {text(persisted?.workflowInstanceId) ? <Badge variant="outline">Escalated</Badge> : null}
                                    <p className="font-medium">{alert.title}</p>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{alert.description}</p>
                                </div>
                                {lane ? (
                                  <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => openCoverageShiftDialog(lane)}>
                                      Schedule shift
                                    </Button>
                                    {text(lane.primaryCalendarId) ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedCalendarId(text(lane.primaryCalendarId))
                                          setSection('my_calendar')
                                        }}
                                      >
                                        Open calendar
                                      </Button>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle>Coverage Lanes</CardTitle>
                          <CardDescription>Front desk, phone response, and other operational duties with live coverage state.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setSection('reports')}>
                            <Activity className="mr-2 h-4 w-4" />
                            Open coverage report
                          </Button>
                          <Button onClick={openCreateCoverageLaneDialog}>
                            <Plus className="mr-2 h-4 w-4" />
                            New lane
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {filteredCoverageLanes.length === 0 ? (
                        <EmptyState title="No coverage lanes yet" description="Coverage lanes appear here once support duties are configured." />
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {filteredCoverageLanes.map((lane) => {
                            const laneSummary = asRecord(coverageLaneSummaryById.get(text(lane.id)))
                            const stats = asRecord(laneSummary.stats)
                            const currentCovered = Boolean(stats.currentCovered)
                            return (
                              <Card key={text(lane.id)} className="border-border/70">
                                <CardContent className="space-y-3 py-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1">
                                      <p className="font-medium">{text(lane.name, text(lane.slug, text(lane.id)))}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {text(lane.laneType, 'custom').replace(/_/g, ' ')} · {text(lane.presenceMode, 'onsite')}
                                      </p>
                                    </div>
                                    <Badge variant={currentCovered ? 'outline' : 'destructive'}>
                                      {currentCovered ? (
                                        <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Covered</span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1"><ShieldAlert className="h-3.5 w-3.5" /> Gap</span>
                                      )}
                                    </Badge>
                                  </div>
                                  <div className="grid gap-2 sm:grid-cols-3">
                                    <div>
                                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Now</p>
                                      <p className="text-base font-semibold">
                                        {numberValue(stats.currentCoverageCount, 0)} / {numberValue(lane.requiredHeadcount, 1)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Open demands</p>
                                      <p className="text-base font-semibold">{numberValue(stats.openDemandCount, 0)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Next gap</p>
                                      <p className="text-sm font-semibold">
                                        {text(stats.nextGapStartAt) ? formatDateTime(text(stats.nextGapStartAt)) : 'None'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap justify-end gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => openEditCoverageLaneDialog(lane)}>
                                      Edit lane
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => void openCoverageMembershipDialog(lane)}>
                                      Add member
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => void openCoverageTemplateDialog(lane)}>
                                      Templates
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => openCoverageShiftDialog(lane)}>
                                      Schedule shift
                                    </Button>
                                    {text(lane.primaryCalendarId) ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedCalendarId(text(lane.primaryCalendarId))
                                          setSection('my_calendar')
                                        }}
                                      >
                                        View lane calendar
                                      </Button>
                                    ) : null}
                                  </div>
                                </CardContent>
                              </Card>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Team</CardTitle>
                      <CardDescription>Owners, managers, and staff attached to this business.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {teamMembers.length === 0 ? (
                        <EmptyState title="No team yet" description="Invite members to share operations across this business." />
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Joined</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {teamMembers.map((row) => (
                              <MemberRow key={text(row.memberId, text(row.id))} row={row} />
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              {/* Customers */}
              {section === 'customers' ? (
                <div className="grid gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Business Visibility</CardTitle>
                      <CardDescription>
                        Control how customers discover this business.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <Select
                          value={bizVisibility}
                          onValueChange={(value) => setBizVisibility(value as 'published' | 'unpublished' | 'private')}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select visibility" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="published">Published (publicly discoverable)</SelectItem>
                            <SelectItem value="unpublished">Unpublished (hidden)</SelectItem>
                            <SelectItem value="private">Private (invite-only)</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button onClick={() => void saveBizVisibility()} disabled={busyKey !== null}>
                          {busyKey === 'biz.visibility' ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Save visibility'
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        `Published` is the default customer mode. `Private` requires an invited member account.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Customer Accounts</CardTitle>
                      <CardDescription>Accounts currently attached to this business</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {customerMembers.length === 0 ? (
                        <EmptyState title="No customer accounts" description="Customer accounts appear here after invitations or bookings." />
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Joined</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {customerMembers.map((row) => (
                              <MemberRow key={text(row.memberId, text(row.id))} row={row} />
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>CRM Contacts</CardTitle>
                      <CardDescription>Customer profiles captured from bookings and CRM</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {crmContacts.length === 0 ? (
                        <EmptyState title="No contacts yet" description="Contacts appear here after booking activity" />
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Phone</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {crmContacts.map((row) => (
                              <CustomerRow key={text(row.id)} row={row} />
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              {/* Catalog */}
              {section === 'catalog' ? (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Catalog</CardTitle>
                      <CardDescription>Products and services managed from one surface.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 rounded-md border p-4">
                        <p className="text-sm font-medium">New service</p>
                        <Input
                          value={newServiceName}
                          onChange={(event) => setNewServiceName(event.target.value)}
                          placeholder="Service name"
                        />
                        <Button onClick={() => void createQuickService()} disabled={busyKey !== null || !newServiceName.trim()}>
                          {busyKey === 'services.create' ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            'Create service'
                          )}
                        </Button>
                      </div>

                      <div className="space-y-2 rounded-md border p-4">
                        <p className="text-sm font-medium">New offer</p>
                        <Input
                          value={newOfferName}
                          onChange={(event) => setNewOfferName(event.target.value)}
                          placeholder="Offer name"
                        />
                        <Select
                          value={newOfferDurationMode}
                          onValueChange={(value) => setNewOfferDurationMode(value as 'fixed' | 'variable')}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Duration mode" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">Fixed duration</SelectItem>
                            <SelectItem value="variable">Variable duration</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min={5}
                          step={5}
                          value={newOfferDefaultDurationMin}
                          onChange={(event) => setNewOfferDefaultDurationMin(event.target.value)}
                          placeholder="Default duration (minutes)"
                        />
                        {newOfferDurationMode === 'variable' ? (
                          <div className="grid gap-2 sm:grid-cols-3">
                            <Input type="number" min={5} step={5} value={newOfferMinDurationMin} onChange={(event) => setNewOfferMinDurationMin(event.target.value)} placeholder="Min" />
                            <Input type="number" min={5} step={5} value={newOfferMaxDurationMin} onChange={(event) => setNewOfferMaxDurationMin(event.target.value)} placeholder="Max" />
                            <Input type="number" min={5} step={5} value={newOfferDurationStepMin} onChange={(event) => setNewOfferDurationStepMin(event.target.value)} placeholder="Step" />
                          </div>
                        ) : null}
                        <Input
                          type="number"
                          min={0}
                          step="1"
                          value={newOfferPrice}
                          onChange={(event) => setNewOfferPrice(event.target.value)}
                          placeholder="Price (USD)"
                        />
                        <Button onClick={() => void createQuickOffer()} disabled={busyKey !== null || !newOfferName.trim()}>
                          {busyKey === 'offers.create' ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            'Create and publish offer'
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Tabs defaultValue="services" className="w-full">
                    <TabsList>
                      <TabsTrigger value="services">Services</TabsTrigger>
                      <TabsTrigger value="offers">Offers</TabsTrigger>
                      <TabsTrigger value="products">Products</TabsTrigger>
                    </TabsList>
                    <TabsContent value="services" className="space-y-4">
                      {services.length === 0 ? (
                        <EmptyState title="No services" description="Create services to offer" />
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          {services.map((row) => (
                            <Card key={text(row.id)}>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base">{text(row.name, text(row.slug, text(row.id)))}</CardTitle>
                                <CardDescription>{text(row.type, '-')}</CardDescription>
                              </CardHeader>
                            </Card>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="offers" className="space-y-4">
                      {offers.length === 0 ? (
                        <EmptyState title="No offers" description="Create offers for services" />
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          {offers.map((row) => (
                            <Card key={text(row.id)}>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base">{text(row.name, text(row.slug, text(row.id)))}</CardTitle>
                                <CardDescription>
                                  <Badge variant="outline">{text(row.status, '-')}</Badge>
                                </CardDescription>
                              </CardHeader>
                            </Card>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="products" className="space-y-4">
                      {products.length === 0 ? (
                        <EmptyState title="No products" description="Add products to your catalog" />
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Price</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {products.map((row) => (
                              <ProductRow key={text(row.id)} row={row} />
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              ) : null}

              {/* Resources */}
              {section === 'resources' ? (
                <div className="grid gap-6">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <StatCard title="Resources" value={filteredResources.length} description={selectedLocation ? text(selectedLocation.name, '') : 'All locations'} />
                    <StatCard title="Locations" value={locations.length} />
                    <StatCard title="Booking calendars" value={bookingCalendars.length} />
                  </div>
                  <Card>
                    <CardHeader>
                      <CardTitle>Resources</CardTitle>
                      <CardDescription>Resources, assets, and venues all roll up here.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {filteredResources.length === 0 ? (
                        <EmptyState title="No resources yet" description="Resources appear here after you add providers, assets, or venues." />
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Location</TableHead>
                              <TableHead className="text-right">Capacity</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredResources.map((row) => {
                              const rowLocation = locations.find((location) => text(location.id) === locationIdFromRow(row))
                              return (
                                <TableRow key={text(row.id)}>
                                  <TableCell className="font-medium">{text(row.name, text(row.slug, text(row.id)))}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{text(row.type, 'resource')}</Badge>
                                  </TableCell>
                                  <TableCell>{text(rowLocation?.name, '-')}</TableCell>
                                  <TableCell className="text-right">{numberValue(row.capacity, 0)}</TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              {/* Workflows */}
              {section === 'workflows' ? (
                <div className="grid gap-6">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <StatCard title="Workflows" value={workflows.length} />
                    <StatCard title="Messages" value={outboundMessages.length} />
                    <StatCard title="Reports" value={reportDefinitions.length} />
                  </div>
                  <Card>
                    <CardHeader>
                      <CardTitle>Workflows</CardTitle>
                      <CardDescription>Automation and review pipelines configured for this business.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {workflows.length === 0 ? (
                        <EmptyState title="No workflows yet" description="Workflow definitions will appear here once they are configured." />
                      ) : (
                        <div className="grid gap-3">
                          {workflows.map((row) => (
                            <div key={text(row.id)} className="rounded-md border p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium">{text(row.name, text(row.key, text(row.id)))}</p>
                                  <p className="text-sm text-muted-foreground">{text(row.triggerMode, 'manual')}</p>
                                </div>
                                <Badge variant="outline">{text(row.status, 'unknown')}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              {/* Services */}
              {section === 'services' ? (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Setup Services and Offers</CardTitle>
                      <CardDescription>Create customer-facing services and published offers.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 rounded-md border p-4">
                        <p className="text-sm font-medium">New service</p>
                        <Input
                          value={newServiceName}
                          onChange={(event) => setNewServiceName(event.target.value)}
                          placeholder="Service name"
                        />
                        <Button onClick={() => void createQuickService()} disabled={busyKey !== null || !newServiceName.trim()}>
                          {busyKey === 'services.create' ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            'Create service'
                          )}
                        </Button>
                      </div>

                      <div className="space-y-2 rounded-md border p-4">
                        <p className="text-sm font-medium">New offer</p>
                        <Input
                          value={newOfferName}
                          onChange={(event) => setNewOfferName(event.target.value)}
                          placeholder="Offer name"
                        />
                        <Select
                          value={newOfferDurationMode}
                          onValueChange={(value) => setNewOfferDurationMode(value as 'fixed' | 'variable')}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Duration mode" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">Fixed duration</SelectItem>
                            <SelectItem value="variable">Variable duration</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min={5}
                          step={5}
                          value={newOfferDefaultDurationMin}
                          onChange={(event) => setNewOfferDefaultDurationMin(event.target.value)}
                          placeholder="Default duration (minutes)"
                        />
                        {newOfferDurationMode === 'variable' ? (
                          <div className="grid gap-2 sm:grid-cols-3">
                            <Input
                              type="number"
                              min={5}
                              step={5}
                              value={newOfferMinDurationMin}
                              onChange={(event) => setNewOfferMinDurationMin(event.target.value)}
                              placeholder="Min"
                            />
                            <Input
                              type="number"
                              min={5}
                              step={5}
                              value={newOfferMaxDurationMin}
                              onChange={(event) => setNewOfferMaxDurationMin(event.target.value)}
                              placeholder="Max"
                            />
                            <Input
                              type="number"
                              min={5}
                              step={5}
                              value={newOfferDurationStepMin}
                              onChange={(event) => setNewOfferDurationStepMin(event.target.value)}
                              placeholder="Step"
                            />
                          </div>
                        ) : null}
                        <Input
                          type="number"
                          min={0}
                          step="1"
                          value={newOfferPrice}
                          onChange={(event) => setNewOfferPrice(event.target.value)}
                          placeholder="Price (USD)"
                        />
                        <Button onClick={() => void createQuickOffer()} disabled={busyKey !== null || !newOfferName.trim()}>
                          {busyKey === 'offers.create' ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            'Create and publish offer'
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                <Tabs defaultValue="services" className="w-full">
                  <TabsList>
                    <TabsTrigger value="services">Services</TabsTrigger>
                    <TabsTrigger value="offers">Offers</TabsTrigger>
                  </TabsList>
                  <TabsContent value="services" className="space-y-4">
                    {services.length === 0 ? (
                      <EmptyState title="No services" description="Create services to offer" />
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                        {services.map((row) => (
                          <Card key={text(row.id)}>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base">{text(row.name, text(row.slug, text(row.id)))}</CardTitle>
                              <CardDescription>{text(row.type, '-')}</CardDescription>
                            </CardHeader>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="offers" className="space-y-4">
                    {offers.length === 0 ? (
                      <EmptyState title="No offers" description="Create offers for services" />
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                        {offers.map((row) => (
                          <Card key={text(row.id)}>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base">{text(row.name, text(row.slug, text(row.id)))}</CardTitle>
                              <CardDescription>
                                <Badge variant="outline">{text(row.status, '-')}</Badge>
                              </CardDescription>
                            </CardHeader>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
                </div>
              ) : null}

              {/* Products */}
              {section === 'products' ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Products</CardTitle>
                    <CardDescription>Manage products and pricing</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {products.length === 0 ? (
                      <EmptyState title="No products" description="Add products to your catalog" />
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {products.map((row) => (
                            <ProductRow key={text(row.id)} row={row} />
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              ) : null}

              {/* Communications */}
              {section === 'communications' ? (
                <div className="grid gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Customer messages</CardTitle>
                      <CardDescription>Recent confirmations, reminders, and updates sent to customers.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {outboundMessages.length === 0 ? (
                        <EmptyState
                          title="No customer messages yet"
                          description="Messages will appear here once bookings and follow-ups begin."
                        />
                      ) : (
                        outboundMessages.slice(0, 8).map((row) => (
                          <div key={text(row.id)} className="rounded-md border p-3 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium">
                                {text(asRecord(row.payload).subject, text(asRecord(row.payload).title, 'Customer update'))}
                              </p>
                              <p className="text-xs text-muted-foreground">{formatDateTime(text(row.scheduledFor))}</p>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {(() => {
                                const status = text(row.status, 'sent').toLowerCase()
                                if (status === 'failed' || status === 'bounced') return 'Needs attention'
                                if (status === 'queued' || status === 'processing') return 'Scheduled'
                                return 'Sent'
                              })()}
                            </p>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              {/* Reports */}
              {section === 'reports' ? (
                <div className="grid gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Coverage Adherence</CardTitle>
                      <CardDescription>Track whether operational support lanes stay covered when the business needs them.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">Lanes tracked</p>
                          <p className="text-xl font-semibold">{numberValue(coverageReportSummary.laneCount, 0)}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">Covered now</p>
                          <p className="text-xl font-semibold">{numberValue(coverageReportSummary.currentCoveredCount, 0)}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">Current gaps</p>
                          <p className="text-xl font-semibold">{numberValue(coverageReportSummary.currentGapCount, 0)}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">Uncovered demand</p>
                          <p className="text-xl font-semibold">{formatMinutesAsHours(numberValue(coverageReportSummary.uncoveredDemandMinutes, 0))}</p>
                        </div>
                      </div>

                      {coverageLaneSummaries.length === 0 ? (
                        <EmptyState title="No coverage data yet" description="Coverage adherence will appear once duty lanes and on-call shifts are configured." />
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Lane</TableHead>
                              <TableHead>State</TableHead>
                              <TableHead>Staffed</TableHead>
                              <TableHead>Uncovered</TableHead>
                              <TableHead>Next gap</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {coverageLaneSummaries.map((row) => {
                              const lane = asRecord(row.lane)
                              const stats = asRecord(row.stats)
                              const currentCovered = Boolean(stats.currentCovered)
                              return (
                                <TableRow key={text(lane.id)}>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">{text(lane.name, text(lane.id))}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {text(lane.laneType, 'custom').replace(/_/g, ' ')} · {text(lane.presenceMode, 'onsite')}
                                      </p>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={currentCovered ? 'outline' : 'destructive'}>
                                      {currentCovered ? 'Covered' : 'Gap'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{formatMinutesAsHours(numberValue(stats.staffedMinutes, 0))}</TableCell>
                                  <TableCell>{formatMinutesAsHours(numberValue(stats.uncoveredDemandMinutes, 0))}</TableCell>
                                  <TableCell>{text(stats.nextGapStartAt) ? formatDateTime(text(stats.nextGapStartAt)) : 'None scheduled'}</TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Business Reporting</CardTitle>
                      <CardDescription>Render analytics snapshots from bookings, payments, and communications.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                        {reportDefinitions.length > 0 ? (
                          <Select
                            value={selectedReportId || '__none__'}
                            onValueChange={(value) => setSelectedReportId(value === '__none__' ? '' : value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select report definition" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Select report definition</SelectItem>
                              {reportDefinitions.map((row) => (
                                <SelectItem key={text(row.id)} value={text(row.id)}>
                                  {text(asRecord(row.metadata).name, text(row.projectionKey, text(row.id)))}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Button variant="outline" onClick={() => void ensureAnalyticsReport()} disabled={busyKey !== null}>
                            Create default report
                          </Button>
                        )}
                        <Button onClick={() => void renderSelectedReport()} disabled={busyKey !== null}>
                          {busyKey === 'reports.render' ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Rendering...
                            </>
                          ) : (
                            'Render report'
                          )}
                        </Button>
                        <Button variant="outline" onClick={() => void exportSelectedReport()} disabled={busyKey !== null}>
                          Export CSV
                        </Button>
                      </div>

                      {lastRenderedReport ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-lg border p-3">
                            <p className="text-xs text-muted-foreground">Bookings</p>
                            <p className="text-xl font-semibold">{numberValue(renderedReportSummary.bookingCount, 0)}</p>
                          </div>
                          <div className="rounded-lg border p-3">
                            <p className="text-xs text-muted-foreground">Revenue</p>
                            <p className="text-xl font-semibold">
                              ${(numberValue(renderedReportSummary.totalRevenueMinor, 0) / 100).toFixed(2)}
                            </p>
                          </div>
                          <div className="rounded-lg border p-3">
                            <p className="text-xs text-muted-foreground">Cancellation Rate</p>
                            <p className="text-xl font-semibold">
                              {(numberValue(renderedReportSummary.cancellationRate, 0) * 100).toFixed(1)}%
                            </p>
                          </div>
                          <div className="rounded-lg border p-3">
                            <p className="text-xs text-muted-foreground">No-show Rate</p>
                            <p className="text-xl font-semibold">
                              {(numberValue(renderedReportSummary.noShowRate, 0) * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      ) : (
                        <EmptyState title="No rendered report yet" description="Render a report to see analytics metrics." />
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              {/* Settings */}
              {section === 'settings' ? (
                <div className="grid gap-6 max-w-2xl">
                  <Card>
                    <CardHeader>
                      <CardTitle>Availability</CardTitle>
                      <CardDescription>Manage booking hours from your calendar view.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Use the calendar view to set weekly hours and day-specific availability.
                      </p>
                      {selectedCalendarId ? (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSection('my_calendar')
                            setAvailabilityDialogOpen(true)
                          }}
                        >
                          Open weekly schedule
                        </Button>
                      ) : (
                        <Button onClick={() => void createOwnerCalendar()} disabled={busyKey !== null}>
                          {busyKey === 'calendar.create' ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating calendar...
                            </>
                          ) : (
                            'Create calendar'
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Appearance</CardTitle>
                      <CardDescription>Customize your dashboard experience</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Theme</p>
                          <p className="text-sm text-muted-foreground">Choose light or dark mode</p>
                        </div>
                        <ThemeToggle />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Account</CardTitle>
                      <CardDescription>Your account information</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">{user?.email ?? 'unknown'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Today's Bookings</p>
                        <p className="font-medium">{todayBookings.length}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Upcoming</p>
                        <p className="font-medium">{upcomingBookings.length}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </main>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
