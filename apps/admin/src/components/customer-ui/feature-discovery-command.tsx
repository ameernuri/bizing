'use client'

import { useEffect } from 'react'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

export type FeatureToggleItem = {
  key: string
  label: string
  description: string
  enabled: boolean
  hotkey?: string
}

export type FeatureActionItem = {
  key: string
  label: string
  description: string
  hotkey?: string
}

/**
 * Slash-style discovery panel.
 *
 * ELI5:
 * - keep the main screen simple
 * - hide advanced controls until the user asks for them
 * - let users discover features with one command palette instead of exposing all settings up front
 */
export function FeatureDiscoveryCommand(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  toggles: FeatureToggleItem[]
  actions: FeatureActionItem[]
  onToggle: (featureKey: string) => void
  onAction: (actionKey: string) => void
}) {
  const { open, onOpenChange, toggles, actions, onToggle, onAction } = props

  useEffect(() => {
    function handler(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase() ?? ''
      const inInput =
        tag === 'input' || tag === 'textarea' || (target?.isContentEditable ?? false)

      if ((event.key === '/' && !inInput) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault()
        onOpenChange(true)
      }
      if (event.key === 'Escape') {
        onOpenChange(false)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Feature Discovery</DialogTitle>
          <DialogDescription>
            Press <span className="font-medium">/</span> or <span className="font-medium">Cmd/Ctrl+K</span> to open this panel.
            Use it to opt into advanced controls only when you need them.
          </DialogDescription>
        </DialogHeader>
        <Command className="rounded-none border-t">
          <CommandInput placeholder="Search settings or actions..." />
          <CommandList className="max-h-[420px]">
            <CommandEmpty>No matching features.</CommandEmpty>
            <CommandGroup heading="Display Toggles">
              {toggles.map((toggle) => (
                <CommandItem
                  key={toggle.key}
                  value={`${toggle.label} ${toggle.description} ${toggle.key}`}
                  onSelect={() => onToggle(toggle.key)}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="font-medium">{toggle.label}</div>
                    <div className="text-xs text-muted-foreground">{toggle.description}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {toggle.hotkey ? <span className="text-xs text-muted-foreground">{toggle.hotkey}</span> : null}
                    <Badge variant={toggle.enabled ? 'default' : 'outline'}>
                      {toggle.enabled ? 'on' : 'off'}
                    </Badge>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Quick Actions">
              {actions.map((action) => (
                <CommandItem
                  key={action.key}
                  value={`${action.label} ${action.description} ${action.key}`}
                  onSelect={() => onAction(action.key)}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="font-medium">{action.label}</div>
                    <div className="text-xs text-muted-foreground">{action.description}</div>
                  </div>
                  {action.hotkey ? <span className="text-xs text-muted-foreground">{action.hotkey}</span> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
