'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { BookOpen, FileStack, Gauge, Orbit, PlayCircle, UserCircle2 } from 'lucide-react'
import { RequireRole } from '@/components/RequireRole'
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/sagas', label: 'OODA Dashboard', icon: Gauge },
  { href: '/sagas/loops', label: 'Missions', icon: Orbit },
  { href: '/sagas/use-cases', label: 'Use Cases', icon: BookOpen },
  { href: '/sagas/personas', label: 'Personas', icon: UserCircle2 },
  { href: '/sagas/definitions', label: 'Definitions', icon: FileStack },
  { href: '/sagas/runs', label: 'Runs', icon: PlayCircle },
] as const

export function SagasShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const activeHref = useMemo(() => {
    const direct = navItems.find((item) => pathname === item.href)
    if (direct) return direct.href
    const nested = navItems.find((item) => item.href !== '/sagas' && pathname.startsWith(`${item.href}/`))
    return nested?.href ?? '/sagas'
  }, [pathname])

  return (
    <RequireRole platformRoles={['admin', 'owner']}>
      <SidebarProvider defaultOpen>
        <Sidebar variant="inset" collapsible="offcanvas">
          <SidebarHeader className="border-b px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">OODA Dashboard</p>
                <p className="text-sm font-medium">Evolution control center</p>
              </div>
              <SidebarTrigger />
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigate</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = activeHref === item.href
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <Link href={item.href} className={cn('flex items-center gap-2')}>
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <div className="flex min-h-svh flex-col">
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
              <SidebarTrigger />
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">OODA Dashboard</p>
                <p className="text-sm font-medium">Evolution control center</p>
              </div>
            </div>
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RequireRole>
  )
}
