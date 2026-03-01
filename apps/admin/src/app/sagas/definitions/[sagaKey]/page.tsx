import { SagaDefinitionDetailPage } from '@/components/sagas/explorer/definition-detail-page'

export default async function SagaDefinitionDetailRoute({ params }: { params: Promise<{ sagaKey: string }> }) {
  const { sagaKey } = await params
  return <SagaDefinitionDetailPage sagaKey={decodeURIComponent(sagaKey)} />
}
