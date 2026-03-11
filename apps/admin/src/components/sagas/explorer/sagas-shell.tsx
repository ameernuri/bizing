'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { BookOpen, BrainCircuit, Code, FileSpreadsheet, FileStack, FlaskConical, Gauge, Orbit, PlayCircle, Settings2, UserCircle2, Workflow } from 'lucide-react'
import { RequireRole } from '@/components/RequireRole'
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/ooda', label: 'Dashboard', icon: Gauge, shortLabel: 'Dash' },
  { href: '/ooda/studio', label: 'Operations Studio', icon: Settings2, shortLabel: 'Studio' },
  { href: '/ooda/lab', label: 'QA Lab', icon: FlaskConical, shortLabel: 'Lab' },
  { href: '/ooda/loops', label: 'Missions', icon: Orbit, shortLabel: 'Missions' },
  { href: '/ooda/use-cases', label: 'Use Cases', icon: BookOpen, shortLabel: 'Cases' },
  { href: '/ooda/personas', label: 'Personas', icon: UserCircle2, shortLabel: 'Personas' },
  { href: '/ooda/definitions', label: 'Definitions', icon: FileStack, shortLabel: 'Defs' },
  { href: '/ooda/runs', label: 'Runs', icon: PlayCircle, shortLabel: 'Runs' },
  { href: '/ooda/knowledge', label: 'Knowledge Sync', icon: BrainCircuit, shortLabel: 'Knowledge' },
  { href: '/ooda/canvascii', label: 'Canvascii', icon: Workflow, shortLabel: 'Canvascii' },
  { href: '/ooda/api', label: 'API Explorer', icon: Code, shortLabel: 'API' },
  { href: '/ooda/coverage', label: 'Coverage Report', icon: FileSpreadsheet, shortLabel: 'Coverage' },
] as const

export function SagasShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const activeHref = useMemo(() => {
    const direct = navItems.find((item) => pathname === item.href)
    if (direct) return direct.href
    const nested = navItems.find((item) => item.href !== '/ooda' && pathname.startsWith(`${item.href}/`))
    return nested?.href ?? '/ooda'
  }, [pathname])

  return (
    <RequireRole platformRoles={['admin', 'owner']}>
      <SidebarProvider defaultOpen>
        <Sidebar variant="inset" collapsible="offcanvas" className="border-r border-border/50">
          <SidebarHeader className="border-b border-border/50 bg-gradient-to-r from-background to-muted/20 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                  <Gauge className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold tracking-tight">OODash</p>
                  <p className="text-[11px] text-muted-foreground">Evolution Control</p>
                </div>
              </div>
              <SidebarTrigger className="h-8 w-8" />
            </div>
          </SidebarHeader>
          <SidebarContent className="px-2 py-3">
            <SidebarGroup>
              <SidebarGroupLabel className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent className="mt-1 space-y-0.5">
                <SidebarMenu>
                  {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = activeHref === item.href
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton 
                          asChild 
                          isActive={isActive}
                          className={cn(
                            'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                            isActive 
                              ? 'bg-primary/10 text-primary shadow-sm' 
                              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                          )}
                        >
                          <Link href={item.href} className="flex items-center gap-3">
                            <div className={cn(
                              'flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-200',
                              isActive 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-muted/50 text-muted-foreground group-hover:bg-muted group-hover:text-foreground'
                            )}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <span className="flex-1">{item.label}</span>
                            {isActive && (
                              <div className="absolute right-2 h-1.5 w-1.5 rounded-full bg-primary" />
                            )}
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
        <SidebarInset className="bg-gradient-to-br from-background via-background to-muted/10">
          <div className="flex min-h-svh flex-col">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border/50 bg-background/80 px-6 py-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="h-9 w-9 rounded-lg border border-border/50 bg-background shadow-sm hover:bg-muted/50" />
                <div className="hidden sm:block">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">OODash</p>
                  <p className="text-sm font-medium text-foreground/90">Evolution Control Center</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-muted-foreground">System Online</span>
              </div>
            </div>
            <div className="flex-1">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RequireRole>
  )
}
