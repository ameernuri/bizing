import { RequireRole } from '@/components/RequireRole'
import { PersonaInboxLabPage } from '@/components/dev/persona-inbox-lab-page'

export default function DevPersonasRoute() {
  return (
    <RequireRole platformRoles={['admin']} mode="all">
      <PersonaInboxLabPage />
    </RequireRole>
  )
}
