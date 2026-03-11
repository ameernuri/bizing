import { Suspense } from 'react'
import { CanvasciiPage } from '@/components/sagas/explorer/asciip-page'

export const dynamic = 'force-dynamic'

export default function OodaCanvasciiPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">Loading Canvascii...</div>}>
      <CanvasciiPage />
    </Suspense>
  )
}
