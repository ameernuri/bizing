'use client'

import { useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Trash2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { asArray, asRecord, text } from './types'

type CalendarMode = 'week' | 'month'
type EventKind = 'booking' | 'hold' | 'availability' | 'other'
type EventState = 'available' | 'unavailable' | 'busy' | 'tentative' | 'blocked' | 'unknown'

type WeeklyAvailabilitySlot = {
  ruleId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  name: string
}

type CalendarEvent = {
  id: string
  kind: EventKind
  state: EventState
  title: string
  subtitle: string
  startAt: Date
  endAt: Date
}

const VISIBLE_START_HOUR = 6
const VISIBLE_END_HOUR = 22
const HOURS_COUNT = VISIBLE_END_HOUR - VISIBLE_START_HOUR
const PIXELS_PER_HOUR = 48
const COLUMN_HEIGHT = HOURS_COUNT * PIXELS_PER_HOUR

function parseTimeParts(value: string) {
  const [hoursRaw, minutesRaw] = value.split(':')
  const hours = Number.parseInt(hoursRaw ?? '0', 10)
  const minutes = Number.parseInt(minutesRaw ?? '0', 10)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return { hours, minutes }
}

function atLocalTime(day: Date, timeValue: string) {
  const parsed = parseTimeParts(timeValue)
  if (!parsed) return null
  const next = new Date(day)
  next.setHours(parsed.hours, parsed.minutes, 0, 0)
  return next
}

function formatTime12Hour(date: Date): string {
  return format(date, 'h a')
}

function formatTimeRange(startTime: string, endTime: string): string {
  const start = parseTimeParts(startTime)
  const end = parseTimeParts(endTime)
  if (!start || !end) return `${startTime} - ${endTime}`
  
  const formatTime = (h: number, m: number) => {
    const period = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    return m === 0 ? `${hour12} ${period}` : `${hour12}:${m.toString().padStart(2, '0')} ${period}`
  }
  
  return `${formatTime(start.hours, start.minutes)} - ${formatTime(end.hours, end.minutes)}`
}

function minutesSinceStartOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

function getEventPosition(startAt: Date, endAt: Date): { top: number; height: number } {
  const startMinutes = minutesSinceStartOfDay(startAt)
  const endMinutes = minutesSinceStartOfDay(endAt)
  
  const visibleStartMinutes = VISIBLE_START_HOUR * 60
  const visibleEndMinutes = VISIBLE_END_HOUR * 60
  
  let top = (Math.max(startMinutes, visibleStartMinutes) - visibleStartMinutes) / 60 * PIXELS_PER_HOUR
  let bottom = (Math.min(endMinutes, visibleEndMinutes) - visibleStartMinutes) / 60 * PIXELS_PER_HOUR
  
  top = Math.max(0, Math.min(top, COLUMN_HEIGHT))
  bottom = Math.max(0, Math.min(bottom, COLUMN_HEIGHT))
  
  return {
    top,
    height: Math.max(16, bottom - top)
  }
}

function expandWeeklyRule(row: Record<string, unknown>, index: number): CalendarEvent[] {
  const dayOfWeek = Number(row.dayOfWeek)
  const startTime = text(row.startTime)
  const endTime = text(row.endTime)
  if (!Number.isFinite(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || !startTime || !endTime) return []

  const action = text(row.action, 'unavailable')
  const state = action === 'available' ? ('available' as const) : ('unavailable' as const)
  const horizonStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), -2)
  const horizonEnd = addWeeks(endOfWeek(new Date(), { weekStartsOn: 1 }), 14)
  const events: CalendarEvent[] = []
  let cursor = new Date(horizonStart)

  while (cursor <= horizonEnd) {
    const weekDay = cursor.getDay()
    if (weekDay === dayOfWeek) {
      const startAt = atLocalTime(cursor, startTime)
      const endAt = atLocalTime(cursor, endTime)
      if (startAt && endAt && endAt > startAt) {
        events.push({
          id: `${text(row.id, `rule-${index}`)}-${format(cursor, 'yyyy-MM-dd')}`,
          kind: 'availability',
          state,
          title: text(row.name, action),
          subtitle: 'Recurring weekly rule',
          startAt,
          endAt,
        })
      }
    }
    cursor = addDays(cursor, 1)
  }

  return events
}

function parseState(input: string): EventState {
  const next = input.toLowerCase()
  if (next === 'available') return 'available'
  if (next === 'unavailable') return 'unavailable'
  if (next === 'busy') return 'busy'
  if (next === 'tentative') return 'tentative'
  if (next === 'blocked') return 'blocked'
  return 'unknown'
}

function parseKind(sourceType: string): EventKind {
  if (sourceType === 'fulfillment') return 'booking'
  if (sourceType === 'capacity_hold') return 'hold'
  if (sourceType === 'availability_rule' || sourceType === 'availability_gate') return 'availability'
  return 'other'
}

function parseTimelineEvents(timeline: unknown): CalendarEvent[] {
  const root = asRecord(timeline)
  const projectionRows = asArray(root.timelineEvents)
  if (projectionRows.length > 0) {
    return projectionRows
      .map((row, index) => {
        const payload = asRecord(row.payload)
        const startRaw = text(row.startAt)
        const endRaw = text(row.endAt)
        if (!startRaw || !endRaw) return null
        const sourceType = text(row.sourceType, 'custom_subject')
        return {
          id: text(row.id, `projection-${index}`),
          kind: parseKind(sourceType),
          state: parseState(text(row.state, 'unknown')),
          title: text(row.title, text(payload.title, sourceType)),
          subtitle: text(row.summary, text(payload.summary, '')),
          startAt: parseISO(startRaw),
          endAt: parseISO(endRaw),
        } satisfies CalendarEvent
      })
      .filter((row): row is CalendarEvent => row !== null)
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
  }

  const bookings: Array<CalendarEvent | null> = asArray(root.bookings).map((row, index) => {
    const startRaw = text(row.confirmedStartAt, text(row.requestedStartAt))
    const endRaw = text(row.confirmedEndAt, text(row.requestedEndAt))
    if (!startRaw || !endRaw) return null
    return {
      id: text(row.id, `booking-${index}`),
      kind: 'booking' as const,
      state: 'busy' as const,
      title: text(row.customerName, text(row.status, 'Booking')),
      subtitle: text(row.offerId, ''),
      startAt: parseISO(startRaw),
      endAt: parseISO(endRaw),
    } satisfies CalendarEvent
  })

  const holds: Array<CalendarEvent | null> = asArray(root.holds).map((row, index) => {
    const startRaw = text(row.startsAt)
    const endRaw = text(row.endsAt)
    if (!startRaw || !endRaw) return null
    return {
      id: text(row.id, `hold-${index}`),
      kind: 'hold' as const,
      state: 'blocked' as const,
      title: text(row.reason, 'Capacity hold'),
      subtitle: text(row.status, ''),
      startAt: parseISO(startRaw),
      endAt: parseISO(endRaw),
    } satisfies CalendarEvent
  })

  const ruleRows = asArray(root.rules)
  const rules: CalendarEvent[] = ruleRows.flatMap((rawRow, index) => {
    const row = asRecord(rawRow)
    const startRaw = text(row.startAt)
    const endRaw = text(row.endAt)
    if (startRaw && endRaw) {
      const action = text(row.action, 'unavailable')
      return [
        {
          id: text(row.id, `rule-${index}`),
          kind: 'availability' as const,
          state: action === 'available' ? ('available' as const) : ('unavailable' as const),
          title: text(row.name, action),
          subtitle: text(row.frequency, ''),
          startAt: parseISO(startRaw),
          endAt: parseISO(endRaw),
        },
      ] satisfies CalendarEvent[]
    }
    if (text(row.frequency) === 'weekly' || text(row.mode) === 'recurring') {
      return expandWeeklyRule(row, index)
    }
    return []
  })

  return [...bookings, ...holds, ...rules]
    .filter((row): row is CalendarEvent => row !== null)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
}

function rangeDays(start: Date, end: Date) {
  const days: Date[] = []
  for (let current = new Date(start); current <= end; current = addDays(current, 1)) {
    days.push(new Date(current))
  }
  return days
}

function intersectsDay(event: CalendarEvent, day: Date) {
  const dayStart = new Date(day)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(day)
  dayEnd.setHours(23, 59, 59, 999)
  return event.startAt <= dayEnd && event.endAt >= dayStart
}

function dayEvents(events: CalendarEvent[], day: Date) {
  return events.filter((event) => intersectsDay(event, day)).sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
}

function stateWeight(state: EventState) {
  if (state === 'blocked') return 6
  if (state === 'unavailable') return 5
  if (state === 'busy') return 4
  if (state === 'tentative') return 3
  if (state === 'available') return 2
  return 1
}

function dominantState(events: CalendarEvent[]): EventState {
  if (events.length === 0) return 'unknown'
  return events.slice().sort((a, b) => stateWeight(b.state) - stateWeight(a.state))[0]?.state ?? 'unknown'
}

function dayBackground(state: EventState, inCurrentMonth: boolean) {
  const base = inCurrentMonth ? 'bg-background' : 'bg-muted/35'
  if (state === 'available') return `${inCurrentMonth ? 'bg-emerald-50/30' : 'bg-emerald-50/20'} border-emerald-500/20`
  if (state === 'busy') return `${base} border-blue-500/30`
  if (state === 'blocked') return `${base} border-red-500/35`
  if (state === 'unavailable') return `${base} border-amber-500/30`
  if (state === 'tentative') return `${base} border-sky-500/30`
  return `${base} border-border/60`
}

function eventCardClasses(event: CalendarEvent) {
  if (event.kind === 'hold') return 'border-red-300 bg-red-50 text-red-700'
  if (event.kind === 'availability') {
    if (event.state === 'available') return 'border-emerald-300 bg-emerald-50 text-emerald-700'
    return 'border-amber-300 bg-amber-50 text-amber-700'
  }
  return 'border-blue-300 bg-blue-50 text-blue-700'
}

function monthLabel(mode: CalendarMode, cursor: Date) {
  if (mode === 'month') return format(cursor, 'MMMM yyyy')
  const weekStart = startOfWeek(cursor, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(cursor, { weekStartsOn: 1 })
  return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
}

export function CalendarTimelineView(props: {
  timeline: unknown
  weeklyAvailabilitySlots?: WeeklyAvailabilitySlot[]
  availabilityBusy?: boolean
  onOpenAvailabilityDialog?: () => void
  onSaveWeeklyAvailabilitySlot?: (input: {
    dayOfWeek: number
    ruleId?: string
    startTime: string
    endTime: string
  }) => Promise<boolean | void> | boolean | void
  onRemoveWeeklyAvailabilitySlot?: (ruleId: string) => Promise<void> | void
  lens?: string
  onLensChange?: (next: string) => void
}) {
  const [mode, setMode] = useState<CalendarMode>('week')
  const [cursor, setCursor] = useState(() => new Date())
  const [editingSlot, setEditingSlot] = useState<{
    dayOfWeek: number
    ruleId?: string
    startTime: string
    endTime: string
  } | null>(null)

  const events = useMemo(() => parseTimelineEvents(props.timeline), [props.timeline])
  const hasEvents = events.length > 0

  const monthGridDays = useMemo(() => {
    const monthStart = startOfMonth(cursor)
    const monthEnd = endOfMonth(cursor)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return rangeDays(gridStart, gridEnd)
  }, [cursor])

  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(cursor, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(cursor, { weekStartsOn: 1 })
    return rangeDays(weekStart, weekEnd)
  }, [cursor])

  const weeklySlotsByDay = useMemo(() => {
    const grouped: Record<number, WeeklyAvailabilitySlot[]> = {}
    for (const slot of props.weeklyAvailabilitySlots ?? []) {
      if (!Number.isFinite(slot.dayOfWeek)) continue
      const day = slot.dayOfWeek
      grouped[day] = grouped[day] ?? []
      grouped[day].push(slot)
    }
    for (const key of Object.keys(grouped)) {
      const day = Number(key)
      grouped[day]?.sort((a, b) => a.startTime.localeCompare(b.startTime))
    }
    return grouped
  }, [props.weeklyAvailabilitySlots])

  const slotCount = (props.weeklyAvailabilitySlots ?? []).length

  const hourLabels = useMemo(() => {
    const labels: { hour: number; label: string }[] = []
    for (let h = VISIBLE_START_HOUR; h <= VISIBLE_END_HOUR; h++) {
      const date = new Date()
      date.setHours(h, 0, 0, 0)
      labels.push({ hour: h, label: formatTime12Hour(date) })
    }
    return labels
  }, [])

  function moveNext() {
    setCursor((prev) => (mode === 'month' ? addMonths(prev, 1) : addWeeks(prev, 1)))
  }

  function movePrev() {
    setCursor((prev) => (mode === 'month' ? subMonths(prev, 1) : subWeeks(prev, 1)))
  }

  function moveToday() {
    setCursor(new Date())
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-2xl font-semibold">{monthLabel(mode, cursor)}</h2>
          <p className="text-xs text-muted-foreground">{slotCount} weekly availability slots configured</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={props.onOpenAvailabilityDialog}>
            Availability
          </Button>
          <div className="rounded-md border p-1">
            <Button
              type="button"
              size="sm"
              variant={mode === 'week' ? 'default' : 'ghost'}
              onClick={() => setMode('week')}
            >
              Week
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'month' ? 'default' : 'ghost'}
              onClick={() => setMode('month')}
            >
              Month
            </Button>
          </div>
          <Button type="button" variant="outline" size="icon" onClick={movePrev} aria-label="Previous period">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={moveToday}>
            Today
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={moveNext} aria-label="Next period">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!hasEvents ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No availability or bookings yet.
        </div>
      ) : null}

      {mode === 'month' ? (
        <div className="rounded-lg border">
          <div className="grid grid-cols-7 border-b bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div key={day} className="border-r p-2 text-center last:border-r-0">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {monthGridDays.map((day) => {
              const dayItems = dayEvents(events, day)
              const inCurrentMonth = isSameMonth(day, cursor)
              const state = dominantState(dayItems)
              const bookingItems = dayItems.filter((event) => event.kind !== 'availability')
              const hasOpenAvailability = dayItems.some(
                (event) => event.kind === 'availability' && event.state === 'available',
              )
              const dayOfWeek = day.getDay()
              const slots = weeklySlotsByDay[dayOfWeek] ?? []
              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[128px] border-r border-b p-2 last:border-r-0 ${dayBackground(state, inCurrentMonth)}`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className={`text-xs ${inCurrentMonth ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {format(day, 'd')}
                    </span>
                    {isSameDay(day, new Date()) ? (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">Today</span>
                    ) : null}
                  </div>
                  {hasOpenAvailability ? <div className="mb-2 h-1 rounded-full bg-emerald-500/35" /> : null}
                  <div className="space-y-1">
                    {slots.slice(0, 2).map((slot) => (
                      <p key={slot.ruleId} className="text-[11px] text-muted-foreground">
                        {formatTimeRange(slot.startTime, slot.endTime)}
                      </p>
                    ))}
                    {bookingItems.slice(0, 2).map((event) => (
                      <div key={event.id} className={`rounded px-2 py-1 text-[11px] leading-tight ${eventCardClasses(event)}`}>
                        <p className="font-semibold">{format(event.startAt, 'h:mm a')} {event.title}</p>
                      </div>
                    ))}
                    {bookingItems.length === 0 && hasOpenAvailability ? (
                      <p className="text-[11px] text-muted-foreground">Open</p>
                    ) : null}
                    {bookingItems.length > 2 ? (
                      <p className="text-[11px] text-muted-foreground">+{bookingItems.length - 2} more</p>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="grid" style={{ gridTemplateColumns: '64px repeat(7, 1fr)' }}>
            <div className="border-r border-b bg-muted/30 p-3">
              <Clock className="h-4 w-4 text-muted-foreground mx-auto" />
            </div>
            {weekDays.map((day) => (
              <div key={day.toISOString()} className="border-r border-b bg-muted/30 p-3 text-center last:border-r-0">
                <p className="text-xs font-semibold uppercase text-muted-foreground">{format(day, 'EEE')}</p>
                <p className={`text-sm font-medium ${isSameDay(day, new Date()) ? 'text-primary' : 'text-foreground'}`}>
                  {format(day, 'd MMM')}
                </p>
              </div>
            ))}
          </div>

          <div className="grid relative" style={{ gridTemplateColumns: '64px repeat(7, 1fr)', height: COLUMN_HEIGHT }}>
            <div className="border-r bg-muted/20 relative">
              {hourLabels.map(({ label }, index) => (
                <div
                  key={index}
                  className="absolute right-2 text-[11px] text-muted-foreground font-medium"
                  style={{ top: index * PIXELS_PER_HOUR - 6 }}
                >
                  {label}
                </div>
              ))}
            </div>

            {weekDays.map((day) => {
              const items = dayEvents(events, day)
              const bookingItems = items.filter((event) => event.kind !== 'availability')
              const availabilityItems = items.filter((event) => event.kind === 'availability')
              const dayOfWeek = day.getDay()
              const slots = weeklySlotsByDay[dayOfWeek] ?? []
              const editingCurrentDay = editingSlot?.dayOfWeek === dayOfWeek ? editingSlot : null

              return (
                <div
                  key={day.toISOString()}
                  className="border-r last:border-r-0 relative"
                  style={{ height: COLUMN_HEIGHT }}
                >
                  {hourLabels.map((_, hourIndex) => (
                    <div
                      key={hourIndex}
                      className="absolute w-full border-b border-border/40"
                      style={{ top: hourIndex * PIXELS_PER_HOUR, height: PIXELS_PER_HOUR }}
                    />
                  ))}

                  {availabilityItems.map((event) => {
                    const pos = getEventPosition(event.startAt, event.endAt)
                    return (
                      <div
                        key={event.id}
                        className="absolute left-1 right-1 rounded-sm bg-emerald-100/60 border border-emerald-200/50"
                        style={{ top: pos.top, height: pos.height }}
                        title={`${formatTimeRange(format(event.startAt, 'HH:mm'), format(event.endAt, 'HH:mm'))}`}
                      />
                    )
                  })}

                  {slots.map((slot) => {
                    const startAt = atLocalTime(day, slot.startTime)
                    const endAt = atLocalTime(day, slot.endTime)
                    if (!startAt || !endAt) return null
                    const pos = getEventPosition(startAt, endAt)
                    return (
                      <div
                        key={slot.ruleId}
                        className="absolute left-1 right-1 rounded-sm bg-emerald-100/80 border border-emerald-300/60 group"
                        style={{ top: pos.top, height: Math.max(24, pos.height) }}
                      >
                        <div className="absolute inset-0 flex flex-col justify-start p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-emerald-50/90">
                          <p className="text-[10px] font-medium text-emerald-800 truncate">
                            {formatTimeRange(slot.startTime, slot.endTime)}
                          </p>
                          <div className="flex gap-1 mt-auto">
                            <button
                              type="button"
                              className="p-0.5 rounded hover:bg-emerald-200 text-emerald-700"
                              onClick={() =>
                                setEditingSlot({
                                  dayOfWeek,
                                  ruleId: slot.ruleId,
                                  startTime: slot.startTime,
                                  endTime: slot.endTime,
                                })
                              }
                              aria-label="Edit availability"
                            >
                              <Plus className="h-3 w-3 rotate-45" />
                            </button>
                            <button
                              type="button"
                              className="p-0.5 rounded hover:bg-red-200 text-red-600"
                              onClick={() => {
                                if (!props.onRemoveWeeklyAvailabilitySlot) return
                                void props.onRemoveWeeklyAvailabilitySlot(slot.ruleId)
                              }}
                              aria-label="Remove availability"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {bookingItems.map((event) => {
                    const pos = getEventPosition(event.startAt, event.endAt)
                    return (
                      <div
                        key={event.id}
                        className={`absolute left-1 right-1 rounded border px-2 py-1 text-xs shadow-sm ${eventCardClasses(event)}`}
                        style={{ top: pos.top, height: Math.max(40, pos.height) }}
                      >
                        <p className="font-semibold truncate">{format(event.startAt, 'h:mm a')}</p>
                        <p className="font-medium truncate leading-tight">{event.title}</p>
                        {pos.height > 48 && event.subtitle ? (
                          <p className="text-[10px] opacity-80 truncate">{event.subtitle}</p>
                        ) : null}
                      </div>
                    )
                  })}

                  <div className="absolute bottom-2 left-1 right-1">
                    {editingCurrentDay ? (
                      <div className="rounded-md border bg-background p-2 shadow-lg z-10 relative">
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="time"
                            value={editingCurrentDay.startTime}
                            onChange={(event) =>
                              setEditingSlot((current) =>
                                current && current.dayOfWeek === dayOfWeek
                                  ? { ...current, startTime: event.target.value }
                                  : current,
                              )
                            }
                            aria-label="Start time"
                          />
                          <Input
                            type="time"
                            value={editingCurrentDay.endTime}
                            onChange={(event) =>
                              setEditingSlot((current) =>
                                current && current.dayOfWeek === dayOfWeek
                                  ? { ...current, endTime: event.target.value }
                                  : current,
                              )
                            }
                            aria-label="End time"
                          />
                        </div>
                        <div className="mt-2 flex justify-end gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => setEditingSlot(null)}>
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={props.availabilityBusy}
                            onClick={() => {
                              if (!props.onSaveWeeklyAvailabilitySlot) return
                              const saved = props.onSaveWeeklyAvailabilitySlot(editingCurrentDay)
                              void Promise.resolve(saved).then((result) => {
                                if (result !== false) {
                                  setEditingSlot(null)
                                }
                              })
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="w-full h-8 text-xs hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                        onClick={() =>
                          setEditingSlot({
                            dayOfWeek,
                            startTime: '09:00',
                            endTime: '17:00',
                          })
                        }
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Add time
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
