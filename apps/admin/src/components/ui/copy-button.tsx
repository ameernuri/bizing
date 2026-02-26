'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CopyButtonProps {
  value: string
  className?: string
  size?: 'sm' | 'md'
}

export function CopyButton({ value, className, size = 'sm' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <span
      onClick={handleCopy}
      role="button"
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-mono text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer',
        size === 'md' && 'px-2 py-1 text-sm',
        className
      )}
      title="Click to copy"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-green-500" />
          <span className="text-green-500">copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          <span className="truncate max-w-[200px]">{value}</span>
        </>
      )}
    </span>
  )
}
