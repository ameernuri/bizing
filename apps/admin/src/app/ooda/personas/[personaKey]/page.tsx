import { SagaPersonaDetailPage } from '@/components/sagas/explorer/persona-detail-page'

export default async function SagaPersonaDetailRoute({ params }: { params: Promise<{ personaKey: string }> }) {
  const { personaKey } = await params
  return <SagaPersonaDetailPage personaKey={decodeURIComponent(personaKey)} />
}
