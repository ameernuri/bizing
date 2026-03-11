'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Loader2, RefreshCw, Send } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  studioApi,
  type PersonaInboxMessage,
  type PersonaInboxSummary,
} from '@/lib/studio-api'

type BizOption = {
  id: string
  name: string
}

function asBizOptions(rows: unknown[]): BizOption[] {
  return rows
    .map((row) => {
      const item = row && typeof row === 'object' && !Array.isArray(row) ? (row as Record<string, unknown>) : null
      if (!item) return null
      const id = typeof item.id === 'string' ? item.id : ''
      if (!id) return null
      const name = typeof item.name === 'string' && item.name.trim() ? item.name : id
      return { id, name }
    })
    .filter((item): item is BizOption => item !== null)
}

function safeRelativeTime(value: string | null | undefined) {
  if (!value) return 'never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'unknown'
  return formatDistanceToNow(date, { addSuffix: true })
}

function messagePreview(message: PersonaInboxMessage) {
  const subject = typeof message.payload.subject === 'string' ? message.payload.subject : ''
  const title = typeof message.payload.title === 'string' ? message.payload.title : ''
  const body = typeof message.payload.body === 'string' ? message.payload.body : ''
  return subject || title || body || 'No content'
}

export function PersonaInboxLabPage() {
  const { activeBizId } = useAuth()

  const [bizes, setBizes] = useState<BizOption[]>([])
  const [selectedBizId, setSelectedBizId] = useState('')
  const [personas, setPersonas] = useState<PersonaInboxSummary[]>([])
  const [selectedPersonaKey, setSelectedPersonaKey] = useState('sarah')
  const [messages, setMessages] = useState<PersonaInboxMessage[]>([])

  const [loadingBizes, setLoadingBizes] = useState(false)
  const [loadingPersonas, setLoadingPersonas] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [channelFilter, setChannelFilter] = useState<'all' | 'email' | 'sms' | 'push'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'queued' | 'sent' | 'delivered' | 'failed'>('all')

  const [channel, setChannel] = useState<'email' | 'sms' | 'push'>('email')
  const [purpose, setPurpose] = useState<'transactional' | 'marketing' | 'operational' | 'legal'>('transactional')
  const [status, setStatus] = useState<'queued' | 'sent' | 'delivered' | 'failed'>('delivered')
  const [recipientRef, setRecipientRef] = useState('')
  const [subject, setSubject] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('Test simulation message from internal persona dashboard.')

  const selectedPersona = useMemo(
    () => personas.find((persona) => persona.personaKey === selectedPersonaKey) ?? null,
    [personas, selectedPersonaKey],
  )

  const loadBizes = useCallback(async () => {
    setLoadingBizes(true)
    setError(null)
    try {
      const rows = await studioApi.listBizes()
      const options = asBizOptions(rows)
      setBizes(options)
      if (!options.length) {
        setSelectedBizId('')
        return
      }
      const preferred = activeBizId && options.some((biz) => biz.id === activeBizId) ? activeBizId : options[0].id
      setSelectedBizId((current) => (current && options.some((biz) => biz.id === current) ? current : preferred))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed loading businesses.')
    } finally {
      setLoadingBizes(false)
    }
  }, [activeBizId])

  const loadPersonas = useCallback(async () => {
    if (!selectedBizId) {
      setPersonas([])
      return
    }
    setLoadingPersonas(true)
    setError(null)
    try {
      const rows = await studioApi.listPersonaInboxes(selectedBizId, { limit: 300 })
      setPersonas(rows)
      if (!rows.length) {
        setSelectedPersonaKey('sarah')
        return
      }
      setSelectedPersonaKey((current) => {
        if (current && rows.some((persona) => persona.personaKey === current)) return current
        const sarah = rows.find((persona) => persona.personaKey === 'sarah')
        return sarah?.personaKey ?? rows[0].personaKey
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed loading persona inboxes.')
    } finally {
      setLoadingPersonas(false)
    }
  }, [selectedBizId])

  const loadMessages = useCallback(async () => {
    if (!selectedBizId || !selectedPersonaKey) {
      setMessages([])
      return
    }
    setLoadingMessages(true)
    setError(null)
    try {
      const rows = await studioApi.listPersonaInboxMessages(selectedBizId, selectedPersonaKey, {
        channel: channelFilter === 'all' ? undefined : channelFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 100,
      })
      setMessages(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed loading persona messages.')
    } finally {
      setLoadingMessages(false)
    }
  }, [selectedBizId, selectedPersonaKey, channelFilter, statusFilter])

  useEffect(() => {
    void loadBizes()
  }, [loadBizes])

  useEffect(() => {
    void loadPersonas()
  }, [loadPersonas])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  async function sendSimulation() {
    if (!selectedBizId || !selectedPersonaKey) return
    setSending(true)
    setError(null)
    try {
      await studioApi.sendPersonaInboxSimulation(selectedBizId, selectedPersonaKey, {
        channel,
        purpose,
        status,
        recipientRef: recipientRef.trim() || undefined,
        subject: subject.trim() || undefined,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
        metadata: {
          debugOperatorSurface: 'persona_inbox_lab',
        },
      })
      await Promise.all([loadPersonas(), loadMessages()])
      setRecipientRef('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send simulation.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Persona Inbox Lab</h1>
          <p className="text-sm text-muted-foreground">
            Internal-only simulation surface. Messages are persisted in outbound message tables and events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadBizes()} disabled={loadingBizes}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingBizes ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </header>

      {error ? (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="grid gap-4 py-5 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="persona-biz">Business</Label>
            <Select value={selectedBizId} onValueChange={setSelectedBizId}>
              <SelectTrigger id="persona-biz">
                <SelectValue placeholder={loadingBizes ? 'Loading...' : 'Select business'} />
              </SelectTrigger>
              <SelectContent>
                {bizes.map((biz) => (
                  <SelectItem key={biz.id} value={biz.id}>
                    {biz.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="persona-key">Persona</Label>
            <Select value={selectedPersonaKey} onValueChange={setSelectedPersonaKey} disabled={!personas.length || loadingPersonas}>
              <SelectTrigger id="persona-key">
                <SelectValue placeholder={loadingPersonas ? 'Loading personas...' : 'Select persona'} />
              </SelectTrigger>
              <SelectContent>
                {personas.map((persona) => (
                  <SelectItem key={persona.personaKey} value={persona.personaKey}>
                    {persona.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Last activity</Label>
            <div className="h-10 rounded-md border px-3 text-sm leading-10 text-muted-foreground">
              {selectedPersona ? safeRelativeTime(selectedPersona.lastSentAt) : 'No messages yet'}
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[340px,1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Simulate message</CardTitle>
            <CardDescription>Send email, SMS, or push-style notifications for the selected persona.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Channel</Label>
                <Select value={channel} onValueChange={(value) => setChannel(value as typeof channel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="push">Notification</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="queued">Queued</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Purpose</Label>
              <Select value={purpose} onValueChange={(value) => setPurpose(value as typeof purpose)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transactional">Transactional</SelectItem>
                  <SelectItem value="operational">Operational</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="legal">Legal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Recipient override</Label>
              <Input value={recipientRef} onChange={(event) => setRecipientRef(event.target.value)} placeholder="Leave empty to use persona default" />
            </div>

            {channel === 'email' ? (
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Optional email subject" />
              </div>
            ) : null}
            {channel === 'push' ? (
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional notification title" />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Message body</Label>
              <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={6} />
            </div>

            <Button onClick={() => void sendSimulation()} disabled={!selectedBizId || !selectedPersonaKey || sending} className="w-full">
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send simulation
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Inbox timeline</CardTitle>
                <CardDescription>
                  {selectedPersona ? `${selectedPersona.displayName} message trail` : 'Select a persona'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={channelFilter} onValueChange={(value) => setChannelFilter(value as typeof channelFilter)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All channels</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="push">Notification</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All states</SelectItem>
                    <SelectItem value="queued">Queued</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => void loadMessages()} disabled={loadingMessages}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${loadingMessages ? 'animate-spin' : ''}`} />
                  Reload
                </Button>
              </div>
            </div>
            {selectedPersona ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{selectedPersona.messageCount} total</Badge>
                <Badge variant="outline">{selectedPersona.deliveredCount} delivered</Badge>
                {selectedPersona.failedCount > 0 ? <Badge variant="destructive">{selectedPersona.failedCount} failed</Badge> : null}
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingMessages ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading messages...
              </div>
            ) : null}
            {!loadingMessages && !messages.length ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No simulated messages for this persona yet.
              </div>
            ) : null}
            {messages.map((message) => (
              <article key={message.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="uppercase">
                        {message.channel === 'push' ? 'notification' : message.channel}
                      </Badge>
                      <Badge variant={message.status === 'failed' ? 'destructive' : message.status === 'delivered' ? 'default' : 'secondary'}>
                        {message.status}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{messagePreview(message)}</p>
                    <p className="text-xs text-muted-foreground">{message.recipientRef}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{safeRelativeTime(message.sentAt ?? message.scheduledFor)}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.events.map((event) => (
                    <Badge key={event.id} variant="secondary" className="text-[11px]">
                      {event.eventType}
                    </Badge>
                  ))}
                </div>
              </article>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
