'use client'

import { useState } from 'react'
import { ArrowLeft, Sun, Moon } from 'lucide-react'
import Link from 'next/link'
import { useTheme } from '@/components/ThemeProvider'
import { RequireRole } from '@/components/RequireRole'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import SchemaGraph from '@/components/SchemaGraph'

interface SchemaSummary {
  totalEntities: number
  totalColumns: number
  totalRelationships: number
  totalPrimaryKeys: number
}

export default function SchemaPage() {
  const { theme, toggleTheme } = useTheme()
  const [summary, setSummary] = useState<SchemaSummary | null>(null)
  
  return (
    <RequireRole permissions={['bizes.read']}>
      <div className="min-h-screen bg-background">
        {/* Header - visible only on mobile */}
        <header className="sticky top-0 z-30 bg-card border-b border-border/20 px-6 py-4 lg:hidden">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <img src="/images/bizing.logo.horizontal.combo.svg" alt="Bizing" className="h-5 dark:invert" />
          </div>
        </header>

        {/* Sidebar - hidden on mobile, visible on desktop */}
        <aside className="hidden lg:block fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border/20 shadow-sm">
          <div className="flex items-center justify-between p-4 border-b border-border/20">
            <img src="/images/bizing.logo.horizontal.combo.svg" alt="Bizing" className="h-5 dark:invert" />
          </div>
          
          <nav className="p-4 space-y-1">
            <Link href="/">
              <Button variant="ghost" className="w-full justify-start gap-3">
                <ArrowLeft className="h-5 w-5" />
                Back to Dashboard
              </Button>
            </Link>
          </nav>

          {/* Theme Toggle */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border/20 bg-card">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="lg:ml-64 p-6">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Bizing Schema</CardTitle>
              <CardDescription>
                Live Drizzle schema graph. Click any table to inspect columns and relationships. Drag to pan and scroll to zoom.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SchemaGraph onLoaded={setSummary} />
            </CardContent>
          </Card>

          {/* Legend */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">1:N</Badge>
                  <span className="text-muted-foreground">One to Many</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-purple-200 text-purple-600">N:1</Badge>
                  <span className="text-muted-foreground">Many to One</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">🔑</Badge>
                  <span className="text-muted-foreground">Primary Key</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-0.5 bg-primary"></div>
                  <span className="text-muted-foreground">Relationship</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-3xl font-bold text-primary">
                  {summary?.totalEntities ?? '...'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Tables</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-3xl font-bold text-purple-600">
                  {summary?.totalColumns ?? '...'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Total Columns</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-3xl font-bold text-green-600">
                  {summary?.totalRelationships ?? '...'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Relationships</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-3xl font-bold text-orange-600">
                  {summary?.totalPrimaryKeys ?? '...'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Primary Key Columns</p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </RequireRole>
  )
}
