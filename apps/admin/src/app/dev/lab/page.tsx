import { RequireRole } from '@/components/RequireRole'
import { CustomersDashboardPage } from '@/components/customer-ui/customers-dashboard-page'

export default function DevLabRoute() {
  return (
    <RequireRole platformRoles={["admin"]} mode="all">
      <CustomersDashboardPage mode="dev" />
    </RequireRole>
  )
}
