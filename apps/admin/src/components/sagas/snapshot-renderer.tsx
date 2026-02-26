'use client'

import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, BarChart3, Calendar, CheckCircle2, List, Table as TableIcon, User, MousePointerClick } from 'lucide-react'
import { normalizeSnapshotDocument, type SnapshotBlock, type SnapshotDocument } from './snapshot-types'
export type { SnapshotDocument } from './snapshot-types'

function badgeVariantForTone(tone?: string) {
  if (tone === 'success') return 'default' as const
  if (tone === 'error') return 'destructive' as const
  if (tone === 'warning') return 'secondary' as const
  return 'outline' as const
}

function badgeVariantForCalendarStatus(status: string) {
  if (status === 'booked') return 'default' as const
  if (status === 'blocked' || status === 'unavailable') return 'destructive' as const
  if (status === 'hold') return 'secondary' as const
  return 'outline' as const
}

function BlockHeader({ icon: Icon, title, badge }: { icon: any; title: string; badge?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">{title}</span>
      </div>
      {badge}
    </div>
  )
}

function statusBadgeVariant(status?: string) {
  if (status === 'passed') return 'default' as const
  if (status === 'failed' || status === 'blocked') return 'destructive' as const
  if (status === 'skipped') return 'secondary' as const
  return 'outline' as const
}

function actionBadgeVariant(kind?: string) {
  if (kind === 'primary') return 'default' as const
  if (kind === 'danger') return 'destructive' as const
  return 'secondary' as const
}

function renderBlock(block: SnapshotBlock, index: number) {
  // Alert block - uses shadcn semantic colors for theming
  if (block.type === 'alert') {
    const Icon = block.tone === 'success' ? CheckCircle2 : block.tone === 'error' ? AlertCircle : AlertCircle
    const toneStyles = {
      success: 'border-l-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
      error: 'border-l-red-500 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100',
      warning: 'border-l-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
      info: 'border-l-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100',
    }
    const iconColors = {
      success: 'text-emerald-600 dark:text-emerald-400',
      error: 'text-red-600 dark:text-red-400',
      warning: 'text-amber-600 dark:text-amber-400',
      info: 'text-blue-600 dark:text-blue-400',
    }
    const style = toneStyles[block.tone as keyof typeof toneStyles] || toneStyles.info
    const iconColor = iconColors[block.tone as keyof typeof iconColors] || iconColors.info
    
    return (
      <div key={index} className={`rounded-md border border-l-4 p-4 ${style}`}>
        <div className="flex items-start gap-3">
          <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${iconColor}`} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{block.title}</p>
            {block.message && <p className="text-sm opacity-90 mt-1">{block.message}</p>}
          </div>
          {block.tone && <Badge variant={badgeVariantForTone(block.tone)}>{block.tone}</Badge>}
        </div>
      </div>
    )
  }

  // Stats block
  if (block.type === 'stats') {
    return (
      <div key={index} className="space-y-3">
        <BlockHeader icon={BarChart3} title={block.title || 'Stats'} />
        <div className="grid grid-cols-3 gap-3">
          {block.items.map((item, i) => (
            <div key={i} className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-xl font-semibold mt-1">{item.value}</p>
              {item.hint && <p className="text-xs text-muted-foreground mt-1">{item.hint}</p>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Key-value block
  if (block.type === 'key_value') {
    return (
      <div key={index} className="space-y-3">
        <BlockHeader icon={List} title={block.title || 'Details'} />
        <div className="grid grid-cols-2 gap-3">
          {block.items.map((item, i) => (
            <div key={i} className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">{item.label}</Label>
              <Input readOnly value={item.value} className="h-9 text-sm bg-background" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Form block
  if (block.type === 'form') {
    return (
      <div key={index} className="space-y-4 rounded-lg border p-4">
        <BlockHeader icon={User} title={block.title || 'Form'} />
        <div className="space-y-3">
          {block.fields.map((field, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{field.label}</Label>
                {field.state && field.state !== 'default' && <Badge variant="outline" className="text-[10px]">{field.state}</Badge>}
              </div>
              <Input readOnly value={field.value || ''} className="h-9 text-sm bg-background" />
              {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
            </div>
          ))}
        </div>
        {block.submitLabel && (
          <div className="pt-2 border-t">
            <Badge>{block.submitLabel}</Badge>
          </div>
        )}
      </div>
    )
  }

  // List block
  if (block.type === 'list') {
    return (
      <div key={index} className="space-y-3">
        <BlockHeader icon={List} title={block.title || 'List'} badge={<Badge variant="outline">{block.items.length}</Badge>} />
        {block.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{block.emptyMessage || 'No items'}</p>
        ) : (
          <div className="space-y-2">
            {block.items.map((item, i) => (
              <div key={i} className="rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm">{item.primary}</p>
                  <div className="flex gap-1">
                    {item.badges?.map((badge, j) => <Badge key={j} variant="outline" className="text-[10px]">{badge}</Badge>)}
                  </div>
                </div>                
                {item.secondary && <p className="text-xs text-muted-foreground mt-1">{item.secondary}</p>}
                {item.detail && <p className="text-xs mt-2">{item.detail}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Actions block
  if (block.type === 'actions') {
    return (
      <div key={index} className="space-y-3">
        <BlockHeader icon={MousePointerClick} title={block.title || 'Actions'} badge={<Badge variant="outline">{block.items.length}</Badge>} />
        <div className="flex flex-wrap gap-2">
          {block.items.map((item, i) => (
            <div
              key={i}
              className={`rounded-md border px-3 py-1.5 text-xs ${
                item.enabled === false ? 'opacity-50 line-through' : ''
              }`}
            >
              <Badge variant={actionBadgeVariant(item.kind)} className="text-[10px]">
                {item.label}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Table block
  if (block.type === 'table') {
    return (
      <div key={index} className="space-y-3">
        <BlockHeader icon={TableIcon} title={block.title || 'Table'} badge={<Badge variant="outline">{block.rows.length} rows</Badge>} />
        {block.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{block.emptyMessage || 'No rows'}</p>
        ) : (
          <ScrollArea className="h-64 rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {block.columns.map((col) => <TableHead key={col} className="text-xs">{col}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {block.rows.map((row, i) => (
                  <TableRow key={i}>
                    {block.columns.map((_, j) => <TableCell key={j} className="text-xs">{String(row[j] ?? '')}</TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </div>
    )
  }

  // Calendar block
  if (block.type === 'calendar') {
    return (
      <div key={index} className="space-y-3">
        <BlockHeader icon={Calendar} title={block.title || 'Calendar'} />
        <div className="flex flex-wrap gap-2">
          {block.rangeLabel && <Badge variant="outline">{block.rangeLabel}</Badge>}
          {block.timezone && <Badge variant="secondary">{block.timezone}</Badge>}
        </div>
        
        {block.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events</p>
        ) : (
          <div className="space-y-2">
            {block.events.map((event, i) => (
              <div key={i} className="rounded-lg border p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{event.title}</p>
                  <p className="text-xs text-muted-foreground">{event.timeRange}</p>
                </div>
                <Badge variant={badgeVariantForCalendarStatus(event.status)}>{event.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Fallback - raw JSON
  return (
    <div key={index} className="space-y-2">
      <p className="font-medium text-sm">{block.title || 'Raw JSON'}</p>
      <Textarea readOnly className="min-h-40 font-mono text-xs" value={JSON.stringify(block.data, null, 2)} />
    </div>
  )
}

export function SnapshotRenderer({ doc }: { doc: SnapshotDocument }) {
  const normalized = normalizeSnapshotDocument(doc)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{normalized.title}</h3>
          {normalized.view.subtitle && <p className="text-sm text-muted-foreground">{normalized.view.subtitle}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{normalized.screenKey}</Badge>
          {normalized.status && <Badge variant={statusBadgeVariant(normalized.status)}>{normalized.status}</Badge>}
        </div>
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {normalized.actorKey && (
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {normalized.actorKey}
          </div>
        )}
        {normalized.view.route && (
          <div className="flex items-center gap-1">
            <span className="font-mono">{normalized.view.route}</span>
          </div>
        )}
        {normalized.generatedAt && <span>{normalized.generatedAt}</span>}
      </div>

      <Separator />

      {/* Blocks - Flat, no card wrapper */}
      <div className="space-y-6">
        {normalized.view.blocks.map((block, index) => renderBlock(block, index))}
      </div>
    </div>
  )
}
