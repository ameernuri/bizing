import { SagaRunDetailPage } from '@/components/sagas/explorer/run-detail-page'

export default async function SagaRunDetailRoute({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params
  return <SagaRunDetailPage runId={decodeURIComponent(runId)} />
}
