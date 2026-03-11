'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addDays, addWeeks, format, startOfWeek, subWeeks } from 'date-fns'
import { ChevronLeft, ChevronRight, Loader2, Plus, Settings2, Trash2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { studioApi } from '@/lib/studio-api'
import { asArray, asRecord, text } from './types'

type Step = 1 | 2 | 3

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

type AvailabilitySlot = {
  id: string
  start: string
  end: string
}

type DayAvailability = {
  slots: AvailabilitySlot[]
}

const STEP_META: Array<{ step: Step; title: string }> = [
  { step: 1, title: 'Business' },
  { step: 2, title: 'Availability' },
  { step: 3, title: 'Review' },
]

const DAY_ORDER: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const DAY_LABEL: Record<DayKey, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

const DAY_TO_INDEX: Record<DayKey, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 0,
}

const INDEX_TO_DAY: Record<number, DayKey> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
}

const DEFAULT_AVAILABILITY: Record<DayKey, DayAvailability> = {
  mon: { slots: [{ id: 'mon-1', start: '09:00', end: '17:00' }] },
  tue: { slots: [{ id: 'tue-1', start: '09:00', end: '17:00' }] },
  wed: { slots: [{ id: 'wed-1', start: '09:00', end: '17:00' }] },
  thu: { slots: [{ id: 'thu-1', start: '09:00', end: '17:00' }] },
  fri: { slots: [{ id: 'fri-1', start: '09:00', end: '17:00' }] },
  sat: { slots: [] },
  sun: { slots: [] },
}

const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'CAD', 'AUD']

const AVAILABILITY_TEMPLATES: Record<
  'weekday_core' | 'weekday_plus_sat' | 'every_day',
  { label: string; dayOfWeeks: number[]; startTime: string; endTime: string }
> = {
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

const VISIBLE_START_HOUR = 6
const VISIBLE_END_HOUR = 22
const VISIBLE_HOURS = VISIBLE_END_HOUR - VISIBLE_START_HOUR
const HOUR_HEIGHT = 48

function slugify(input: string, fallback = 'business') {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

function sameAvailabilityShape(input: Record<DayKey, DayAvailability>) {
  return DAY_ORDER
    .map((day) => {
      const slots = (input[day]?.slots ?? [])
        .map((slot) => `${slot.start}-${slot.end}`)
        .sort()
        .join(',')
      return `${day}:${slots}`
    })
    .join('|')
}

function createSlot(start = '09:00', end = '17:00'): AvailabilitySlot {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    start,
    end,
  }
}

function cloneAvailabilityShape(input: Record<DayKey, DayAvailability>): Record<DayKey, DayAvailability> {
  return DAY_ORDER.reduce<Record<DayKey, DayAvailability>>((acc, day) => {
    acc[day] = {
      slots: (input[day]?.slots ?? []).map((slot) => ({ ...slot })),
    }
    return acc
  }, {} as Record<DayKey, DayAvailability>)
}

function createDefaultAvailability() {
  return cloneAvailabilityShape(DEFAULT_AVAILABILITY)
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function formatHour(hour: number) {
  const period = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display} ${period}`
}

export function OwnerOnboardingPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading, user, switchActiveBiz } = useAuth()

  const defaultFirstName = useMemo(() => {
    const explicit = text(user?.firstName).trim()
    if (explicit) return explicit
    const fromName = text(user?.name).trim().split(/\s+/).filter(Boolean)[0]
    if (fromName) return fromName
    const emailPrefix = text(user?.email).split('@')[0]?.split(/[._-]/)[0]
    return emailPrefix ? `${emailPrefix.slice(0, 1).toUpperCase()}${emailPrefix.slice(1)}` : 'Your'
  }, [user?.email, user?.firstName, user?.name])

  const [checkingExistingWorkspace, setCheckingExistingWorkspace] = useState(true)
  const [step, setStep] = useState<Step>(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [businessName, setBusinessName] = useState(`${defaultFirstName}'s Studio`)
  const [timezone, setTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles'
    } catch {
      return 'America/Los_Angeles'
    }
  })
  const [currency, setCurrency] = useState('USD')
  const [availability, setAvailability] = useState<Record<DayKey, DayAvailability>>(createDefaultAvailability)
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false)
  const [availabilityWeekScope, setAvailabilityWeekScope] = useState<'weekdays' | 'all_week'>('weekdays')
  const [availabilityWeekStartTime, setAvailabilityWeekStartTime] = useState('09:00')
  const [availabilityWeekEndTime, setAvailabilityWeekEndTime] = useState('17:00')
  const [availabilityTemplateKey, setAvailabilityTemplateKey] = useState<'weekday_core' | 'weekday_plus_sat' | 'every_day'>('weekday_core')
  const [availabilityAdvancedOpen, setAvailabilityAdvancedOpen] = useState(false)
  const [availabilityAdvancedDayOfWeek, setAvailabilityAdvancedDayOfWeek] = useState('1')
  const [availabilityAdvancedStartTime, setAvailabilityAdvancedStartTime] = useState('09:00')
  const [availabilityAdvancedEndTime, setAvailabilityAdvancedEndTime] = useState('17:00')
  const [editingSlot, setEditingSlot] = useState<{
    day: DayKey
    slotId?: string
    start: string
    end: string
  } | null>(null)
  const [calendarWeekAnchor, setCalendarWeekAnchor] = useState(() => new Date())

  const timezoneOptions = useMemo(() => {
    const defaults = [
      timezone,
      'America/Los_Angeles',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'Europe/London',
      'UTC',
    ]
    return Array.from(new Set(defaults.filter(Boolean)))
  }, [timezone])

  const enabledDays = useMemo(
    () => DAY_ORDER.filter((day) => (availability[day]?.slots ?? []).length > 0),
    [availability],
  )

  const totalAvailabilitySlots = useMemo(
    () => DAY_ORDER.reduce((sum, day) => sum + (availability[day]?.slots ?? []).length, 0),
    [availability],
  )

  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(calendarWeekAnchor, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  }, [calendarWeekAnchor])

  useEffect(() => {
    if (!defaultFirstName) return
    setBusinessName((current) => {
      if (current.trim().length > 0) return current
      return `${defaultFirstName}'s Studio`
    })
  }, [defaultFirstName])

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false

    void (async () => {
      const rows = await studioApi.listBizes().catch(() => [])
      if (cancelled) return
      if (asArray(rows).length > 0) {
        router.replace('/owner')
        return
      }
      setCheckingExistingWorkspace(false)
    })()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, router])

  function resetAvailabilityToDefaults() {
    setAvailability(createDefaultAvailability())
    setError(null)
  }

  function saveInlineSlot() {
    if (!editingSlot) return
    if (editingSlot.start >= editingSlot.end) {
      setError('End time must be after start time.')
      return
    }
    setAvailability((current) => {
      const next = cloneAvailabilityShape(current)
      const daySlots = next[editingSlot.day].slots
      if (editingSlot.slotId) {
        next[editingSlot.day].slots = daySlots.map((slot) =>
          slot.id === editingSlot.slotId
            ? {
                ...slot,
                start: editingSlot.start,
                end: editingSlot.end,
              }
            : slot,
        )
      } else {
        next[editingSlot.day].slots = [
          ...daySlots,
          createSlot(editingSlot.start, editingSlot.end),
        ]
      }
      next[editingSlot.day].slots.sort((a, b) => a.start.localeCompare(b.start))
      return next
    })
    setEditingSlot(null)
    setError(null)
  }

  function removeSlot(day: DayKey, slotId: string) {
    setAvailability((current) => {
      const next = cloneAvailabilityShape(current)
      next[day].slots = next[day].slots.filter((slot) => slot.id !== slotId)
      return next
    })
  }

  function applyTemplateAvailability(template: { dayOfWeeks: number[]; startTime: string; endTime: string }) {
    const target = new Set(template.dayOfWeeks)
    setAvailability((current) => {
      const next = cloneAvailabilityShape(current)
      for (const day of DAY_ORDER) {
        const dayIndex = DAY_TO_INDEX[day]
        if (target.has(dayIndex)) {
          next[day].slots = [createSlot(template.startTime, template.endTime)]
        } else {
          next[day].slots = []
        }
      }
      return next
    })
    setError(null)
  }

  function applyWeekBaseline() {
    if (availabilityWeekStartTime >= availabilityWeekEndTime) {
      setError('End time must be after start time.')
      return
    }
    const dayIndexes = availabilityWeekScope === 'all_week' ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]
    const target = new Set(dayIndexes)
    setAvailability((current) => {
      const next = cloneAvailabilityShape(current)
      for (const day of DAY_ORDER) {
        const dayIndex = DAY_TO_INDEX[day]
        if (!target.has(dayIndex)) continue
        next[day].slots = [createSlot(availabilityWeekStartTime, availabilityWeekEndTime)]
      }
      return next
    })
    setError(null)
  }

  function addAdvancedSlot() {
    const dayIndex = Number(availabilityAdvancedDayOfWeek)
    if (!Number.isFinite(dayIndex) || dayIndex < 0 || dayIndex > 6) {
      setError('Choose a valid day.')
      return
    }
    if (availabilityAdvancedStartTime >= availabilityAdvancedEndTime) {
      setError('End time must be after start time.')
      return
    }
    const day = INDEX_TO_DAY[dayIndex]
    if (!day) return
    setAvailability((current) => {
      const next = cloneAvailabilityShape(current)
      next[day].slots = [
        ...next[day].slots,
        createSlot(availabilityAdvancedStartTime, availabilityAdvancedEndTime),
      ].sort((a, b) => a.start.localeCompare(b.start))
      return next
    })
    setError(null)
  }

  async function createWorkspaceFromOnboarding() {
    if (!businessName.trim()) {
      setError('Business name is required.')
      return
    }

    if (enabledDays.length === 0) {
      setError('Select at least one available day.')
      return
    }

    const invalidEntry = DAY_ORDER.flatMap((day) =>
      (availability[day]?.slots ?? []).map((slot) => ({ day, slot })),
    ).find(({ slot }) => slot.start >= slot.end)
    if (invalidEntry) {
      setError(`Please set a valid time range for ${DAY_LABEL[invalidEntry.day]}.`)
      return
    }

    setBusy(true)
    setError(null)

    try {
      const stamp = Date.now().toString(36)
      const biz = asRecord(
        await studioApi.createBiz({
          name: businessName.trim(),
          slug: `${slugify(businessName, 'business')}-${stamp.slice(-6)}`,
          timezone,
          currency,
        }),
      )

      const bizId = text(biz.id)
      if (!bizId) throw new Error('Could not create your workspace.')

      const location = asRecord(
        await studioApi.createLocation(bizId, {
          name: 'Main Location',
          slug: `main-location-${stamp}`,
          type: 'physical',
          timezone,
        }),
      )

      const resource = asRecord(
        await studioApi.createResource(bizId, {
          name: 'Default Provider',
          slug: `default-provider-${stamp}`,
          type: 'host',
          status: 'active',
          locationId: text(location.id),
        }),
      )

      const calendar = asRecord(
        await studioApi.createCalendar(bizId, {
          name: 'Main Calendar',
          timezone,
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
        currency,
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

      for (const day of DAY_ORDER) {
        const daySlots = availability[day]?.slots ?? []
        for (const slot of daySlots) {
          await studioApi.createAvailabilityRule(bizId, text(calendar.id), {
            name: `${DAY_LABEL[day]} Hours`,
            mode: 'recurring',
            frequency: 'weekly',
            dayOfWeek: DAY_TO_INDEX[day],
            startTime: slot.start,
            endTime: slot.end,
            action: 'available',
            priority: 100,
            isActive: true,
          })
        }
      }

      await studioApi.patchBiz(bizId, {
        metadata: {
          onboarding: {
            completedAt: new Date().toISOString(),
          },
        },
      })

      await studioApi.sendOwnerWelcomeEmail(bizId).catch(() => null)
      await switchActiveBiz(bizId).catch(() => null)
      router.replace('/owner')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create workspace.')
    } finally {
      setBusy(false)
    }
  }

  if (isLoading || (isAuthenticated && checkingExistingWorkspace)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center p-6">
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>Sign in to continue setup.</CardDescription>
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
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4 md:px-8">
          <Link href="/" className="inline-flex">
            <img src="/images/bizing.logo.horizontal.combo.svg" alt="Bizing" className="h-9 w-auto" />
          </Link>
          <p className="text-sm text-slate-500">Owner setup</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-10 md:px-8 md:py-12">
        <div className="mb-8 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Welcome</p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">Set up your business.</h1>
          <p className="max-w-2xl text-base text-slate-600">
            Start simple. Adjust as you grow.
          </p>
        </div>

        <div className="mb-8 grid grid-cols-3 gap-2 rounded-lg border border-slate-200 p-1">
          {STEP_META.map(({ step: value, title }) => {
            const active = step === value
            const complete = step > value
            return (
              <div
                key={value}
                className={`rounded-md px-3 py-2 text-center text-sm font-medium ${
                  active
                    ? 'bg-slate-900 text-white'
                    : complete
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-500'
                }`}
              >
                {value}. {title}
              </div>
            )
          })}
        </div>

        {error ? (
          <Card className="mb-6 border-rose-300 bg-rose-50">
            <CardContent className="py-3 text-sm text-rose-700">{error}</CardContent>
          </Card>
        ) : null}

        <Dialog open={availabilityDialogOpen} onOpenChange={setAvailabilityDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Availability settings</DialogTitle>
              <DialogDescription>Set your baseline hours. Edit individual days on the calendar.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 py-2">
              <div className="space-y-3 rounded-md border p-4">
                <div>
                  <p className="text-sm font-medium">Quick templates</p>
                  <p className="text-xs text-muted-foreground">Choose a common schedule to start from.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <Select
                    value={availabilityTemplateKey}
                    onValueChange={(value) =>
                      setAvailabilityTemplateKey(value as 'weekday_core' | 'weekday_plus_sat' | 'every_day')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose template" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(AVAILABILITY_TEMPLATES).map(([key, template]) => (
                        <SelectItem key={key} value={key}>
                          {template.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => applyTemplateAvailability(AVAILABILITY_TEMPLATES[availabilityTemplateKey])}>
                    Apply
                  </Button>
                </div>
              </div>

              <div className="space-y-3 rounded-md border p-4">
                <div>
                  <p className="text-sm font-medium">Weekly hours</p>
                  <p className="text-xs text-muted-foreground">Apply hours to weekdays or all days.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <Select
                    value={availabilityWeekScope}
                    onValueChange={(value) => setAvailabilityWeekScope(value as 'weekdays' | 'all_week')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekdays">Monday to Friday</SelectItem>
                      <SelectItem value="all_week">All seven days</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="time" value={availabilityWeekStartTime} onChange={(event) => setAvailabilityWeekStartTime(event.target.value)} />
                  <Input type="time" value={availabilityWeekEndTime} onChange={(event) => setAvailabilityWeekEndTime(event.target.value)} />
                  <Button onClick={applyWeekBaseline}>Save</Button>
                </div>
              </div>

              <details
                className="rounded-md border p-4"
                open={availabilityAdvancedOpen}
                onToggle={(event) => setAvailabilityAdvancedOpen((event.currentTarget as HTMLDetailsElement).open)}
              >
                <summary className="cursor-pointer select-none text-sm font-medium">More options</summary>
                <p className="mt-2 text-xs text-muted-foreground">
                  Add a time block to a specific day. You can have multiple blocks per day.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <Select value={availabilityAdvancedDayOfWeek} onValueChange={setAvailabilityAdvancedDayOfWeek}>
                    <SelectTrigger>
                      <SelectValue placeholder="Day" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_ORDER.map((day) => (
                        <SelectItem key={day} value={String(DAY_TO_INDEX[day])}>
                          {DAY_LABEL[day]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="time"
                    value={availabilityAdvancedStartTime}
                    onChange={(event) => setAvailabilityAdvancedStartTime(event.target.value)}
                  />
                  <Input
                    type="time"
                    value={availabilityAdvancedEndTime}
                    onChange={(event) => setAvailabilityAdvancedEndTime(event.target.value)}
                  />
                  <Button onClick={addAdvancedSlot}>Add</Button>
                </div>
              </details>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAvailabilityDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {step === 1 ? (
          <Card>
            <CardHeader>
              <CardTitle>Business basics</CardTitle>
              <CardDescription>Prefilled from your account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business name</Label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  placeholder="Sarah's Studio"
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {timezoneOptions.map((zone) => (
                        <SelectItem key={zone} value={zone}>
                          {zone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCY_OPTIONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  className="bg-slate-900 text-white hover:bg-slate-800"
                  onClick={() => {
                    if (!businessName.trim()) {
                      setError('Business name is required.')
                      return
                    }
                    setError(null)
                    setStep(2)
                  }}
                >
                  Next: availability
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setCalendarWeekAnchor((current) => subWeeks(current, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setCalendarWeekAnchor(new Date())}>
                    Today
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setCalendarWeekAnchor((current) => addWeeks(current, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-sm font-medium text-slate-900">
                  Week of {format(weekDays[0] ?? new Date(), 'MMM d')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{totalAvailabilitySlots} blocks</span>
                <Button size="sm" variant="outline" onClick={() => setAvailabilityDialogOpen(true)}>
                  <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                  Settings
                </Button>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-md border border-slate-200">
              <div className="grid" style={{ gridTemplateColumns: '48px repeat(7, minmax(0, 1fr))' }}>
                <div className="border-b border-r border-slate-200 bg-slate-50/50" />
                {weekDays.map((dayDate) => {
                  const dayKey = INDEX_TO_DAY[dayDate.getDay()]
                  return (
                    <div key={dayKey} className="border-b border-r border-slate-200 bg-slate-50/50 px-2 py-2 text-center last:border-r-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{DAY_LABEL[dayKey].slice(0, 3)}</p>
                      <p className="text-xs text-slate-400">{format(dayDate, 'MMM d')}</p>
                    </div>
                  )
                })}

                <div className="relative border-r border-slate-200 bg-slate-50/30">
                  {Array.from({ length: VISIBLE_HOURS }, (_, i) => {
                    const hour = VISIBLE_START_HOUR + i
                    return (
                      <div
                        key={`axis-${hour}`}
                        className="relative border-b border-slate-200"
                        style={{ height: `${HOUR_HEIGHT}px` }}
                      >
                        <span className="absolute -top-2 right-2 text-[10px] text-slate-400">
                          {formatHour(hour)}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {weekDays.map((dayDate) => {
                  const dayKey = INDEX_TO_DAY[dayDate.getDay()]
                  const slots = availability[dayKey]?.slots ?? []
                  const editingCurrentDay = editingSlot?.day === dayKey ? editingSlot : null

                  return (
                    <div
                      key={dayKey}
                      className="relative border-r border-slate-200 last:border-r-0"
                      style={{ height: `${VISIBLE_HOURS * HOUR_HEIGHT}px` }}
                    >
                      {Array.from({ length: VISIBLE_HOURS }, (_, i) => {
                        const hour = VISIBLE_START_HOUR + i
                        return (
                          <div
                            key={`grid-${dayKey}-${hour}`}
                            className={`border-b border-slate-100 ${hour % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}
                            style={{ height: `${HOUR_HEIGHT}px` }}
                          />
                        )
                      })}

                      <div className="absolute inset-0">
                        {slots.map((slot) => {
                          const startMin = timeToMinutes(slot.start)
                          const endMin = timeToMinutes(slot.end)
                          const visibleStartMin = VISIBLE_START_HOUR * 60
                          const visibleEndMin = VISIBLE_END_HOUR * 60

                          if (endMin <= visibleStartMin || startMin >= visibleEndMin) return null

                          const clampedStart = Math.max(startMin, visibleStartMin)
                          const clampedEnd = Math.min(endMin, visibleEndMin)
                          const top = ((clampedStart - visibleStartMin) / 60) * HOUR_HEIGHT
                          const height = ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT

                          return (
                            <div
                              key={slot.id}
                              className="absolute left-1 right-1 cursor-pointer overflow-hidden rounded border border-slate-900 bg-slate-900 px-1.5 py-0.5 text-[10px] text-white hover:bg-slate-800"
                              style={{
                                top: `${top}px`,
                                height: `${Math.max(20, height)}px`,
                              }}
                              onClick={() =>
                                setEditingSlot({
                                  day: dayKey,
                                  slotId: slot.id,
                                  start: slot.start,
                                  end: slot.end,
                                })
                              }
                            >
                              <div className="flex items-center justify-between">
                                <span className="truncate">{slot.start} - {slot.end}</span>
                                <button
                                  type="button"
                                  className="ml-1 opacity-70 hover:opacity-100"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    removeSlot(dayKey, slot.id)
                                  }}
                                >
                                  <Trash2 className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {slots.length === 0 && editingCurrentDay === null && (
                        <button
                          type="button"
                          className="absolute inset-0 flex items-center justify-center rounded border border-dashed border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-600"
                          onClick={() =>
                            setEditingSlot({
                              day: dayKey,
                              start: '09:00',
                              end: '17:00',
                            })
                          }
                        >
                          <span className="text-xs">Add time</span>
                        </button>
                      )}

                      {editingCurrentDay && (
                        <div className="absolute inset-x-1 top-1 z-10 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              type="time"
                              value={editingCurrentDay.start}
                              onChange={(event) =>
                                setEditingSlot((current) =>
                                  current && current.day === dayKey
                                    ? { ...current, start: event.target.value }
                                    : current,
                                )
                              }
                              className="h-7 text-xs"
                            />
                            <Input
                              type="time"
                              value={editingCurrentDay.end}
                              onChange={(event) =>
                                setEditingSlot((current) =>
                                  current && current.day === dayKey
                                    ? { ...current, end: event.target.value }
                                    : current,
                                )
                              }
                              className="h-7 text-xs"
                            />
                          </div>
                          <div className="mt-2 flex justify-end gap-2">
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setEditingSlot(null)}>
                              Cancel
                            </Button>
                            <Button size="sm" className="h-6 px-2 text-xs" onClick={saveInlineSlot}>
                              Save
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="ghost" size="sm" className="text-slate-500" onClick={resetAvailabilityToDefaults}>
                Reset to defaults
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  className="bg-slate-900 text-white hover:bg-slate-800"
                  onClick={() => {
                    if (totalAvailabilitySlots === 0) {
                      setError('Select at least one available day.')
                      return
                    }
                    const invalidEntry = DAY_ORDER.flatMap((day) =>
                      (availability[day]?.slots ?? []).map((slot) => ({ day, slot })),
                    ).find(({ slot }) => slot.start >= slot.end)
                    if (invalidEntry) {
                      setError(`Please set a valid time range for ${DAY_LABEL[invalidEntry.day]}.`)
                      return
                    }
                    setError(null)
                    setStep(3)
                  }}
                >
                  Next: review
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <Card>
            <CardHeader>
              <CardTitle>Review and launch</CardTitle>
              <CardDescription>Check and launch.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 rounded-md border p-4 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Business</p>
                  <p className="text-sm font-medium text-slate-900">{businessName}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Timezone</p>
                  <p className="text-sm font-medium text-slate-900">{timezone}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Currency</p>
                  <p className="text-sm font-medium text-slate-900">{currency}</p>
                </div>
              </div>

              <div className="rounded-md border p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Availability summary</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {DAY_ORDER.flatMap((day) =>
                    (availability[day]?.slots ?? []).map((slot) => (
                      <li key={`${day}-${slot.id}`}>
                        {DAY_LABEL[day]} · {slot.start} - {slot.end}
                      </li>
                    )),
                  )}
                </ul>
              </div>

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep(2)} disabled={busy}>
                  Back
                </Button>
                <Button className="bg-slate-900 text-white hover:bg-slate-800" onClick={() => void createWorkspaceFromOnboarding()} disabled={busy}>
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating workspace...
                    </>
                  ) : (
                    'Launch my dashboard'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  )
}
