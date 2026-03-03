import { SagaUseCaseDetailPage } from '@/components/sagas/explorer/use-case-detail-page'

export default async function SagaUseCaseDetailRoute({ params }: { params: Promise<{ ucKey: string }> }) {
  const { ucKey } = await params
  return <SagaUseCaseDetailPage ucKey={decodeURIComponent(ucKey)} />
}
