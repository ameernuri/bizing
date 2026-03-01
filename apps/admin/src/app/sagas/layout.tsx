import { SagasShell } from '@/components/sagas/explorer/sagas-shell'

export default function SagasLayout({ children }: { children: React.ReactNode }) {
  return <SagasShell>{children}</SagasShell>
}
