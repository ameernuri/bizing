import { OodaLoopDetailPage } from '@/components/sagas/explorer/loop-detail-page'

export default async function SagaLoopDetailRoute({
  params,
}: {
  params: Promise<{ loopId: string }>
}) {
  const { loopId } = await params
  return <OodaLoopDetailPage loopId={loopId} />
}

