'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { JsonMap } from './types'
import { asArray, text } from './types'

export function AvailabilityRuleManager(props: {
  rules: unknown
  creating: boolean
  onCreateRule: (body: Record<string, unknown>) => Promise<void>
  onDeactivateRule: (ruleId: string) => Promise<void>
}) {
  const [form, setForm] = useState({
    name: 'Business hours',
    mode: 'recurring',
    action: 'available',
    dayOfWeek: '1',
    startTime: '09:00',
    endTime: '17:00',
    priority: '100',
  })

  const rows = useMemo(() => asArray(props.rules), [props.rules])

  async function submit() {
    const priority = Number(form.priority)
    const dayOfWeek = Number(form.dayOfWeek)
    await props.onCreateRule({
      name: form.name,
      mode: form.mode,
      frequency: 'weekly',
      dayOfWeek: Number.isFinite(dayOfWeek) ? dayOfWeek : 1,
      startTime: form.startTime,
      endTime: form.endTime,
      action: form.action,
      priority: Number.isFinite(priority) ? priority : 100,
      isActive: true,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Availability Rules</CardTitle>
        <CardDescription>
          Granular controls for business hours, blackout periods, surge pricing, and capacity changes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Action</Label>
            <Select value={form.action} onValueChange={(value) => setForm((prev) => ({ ...prev, action: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">available</SelectItem>
                <SelectItem value="unavailable">unavailable</SelectItem>
                <SelectItem value="special_pricing">special pricing</SelectItem>
                <SelectItem value="capacity_adjustment">capacity adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Mode</Label>
            <Select value={form.mode} onValueChange={(value) => setForm((prev) => ({ ...prev, mode: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recurring">recurring</SelectItem>
                <SelectItem value="date_range">date range</SelectItem>
                <SelectItem value="timestamp_range">timestamp range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Input
              type="number"
              value={form.priority}
              onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Day of week (0-6)</Label>
            <Input
              type="number"
              min={0}
              max={6}
              value={form.dayOfWeek}
              onChange={(event) => setForm((prev) => ({ ...prev, dayOfWeek: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Start time</Label>
            <Input
              value={form.startTime}
              onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>End time</Label>
            <Input
              value={form.endTime}
              onChange={(event) => setForm((prev) => ({ ...prev, endTime: event.target.value }))}
            />
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={() => void submit()} disabled={props.creating || !form.name.trim()}>
              {props.creating ? 'Saving...' : 'Add rule'}
            </Button>
          </div>
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">Current rules ({rows.length})</p>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rules yet. Add one to control calendar behavior.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((row: JsonMap) => (
                <div key={text(row.id)} className="flex items-center justify-between gap-3 rounded-md border p-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{text(row.name, 'unnamed')}</p>
                      <Badge variant={row.isActive === false ? 'outline' : 'default'}>
                        {row.isActive === false ? 'inactive' : 'active'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {text(row.mode)} • {text(row.action)} • priority {String(row.priority ?? '-')}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void props.onDeactivateRule(text(row.id))}>
                    Deactivate
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
