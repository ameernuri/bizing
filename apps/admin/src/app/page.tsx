'use client'

import { useState, useEffect, useRef, ChangeEvent, ReactNode } from 'react'
import { 
  Calendar, 
  Users, 
  DollarSign, 
  ShoppingCart, 
  TrendingUp,
  Menu,
  X,
  Trash2,
  Bug,
  Database,
  Sun,
  Moon,
  Brain
} from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { apiUrl } from '@/lib/api'
import Link from 'next/link'

// Types
interface LogEntry {
  id: string
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  data?: unknown
}

interface Stats {
  totalRevenue: number
  totalBookings: number
  totalCustomers: number
  pendingOrders: number
}

interface Booking {
  id: string
  serviceName: string
  customerName: string
  date: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  price: number
}

interface BookingsResponse {
  data: Booking[]
  pagination: {
    page: number
    limit: number
    total: number
  }
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { theme, toggleTheme, setTheme } = useTheme()
  
  // Logging state
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [showLogs, setShowLogs] = useState(true)
  const [logFilter, setLogFilter] = useState<'all' | 'debug' | 'info' | 'warn' | 'error'>('all')
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Add log entry
  const addLog = (level: LogEntry['level'], message: string, data?: unknown) => {
    const log: LogEntry = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      timestamp: new Date().toISOString().split('T')[1].slice(0, 8),
      level,
      message,
      data
    }
    setLogs(prev => [...prev.slice(-99), log])
  }

  // Fetch data with logging
  useEffect(() => {
    addLog('info', 'Initializing dashboard...')
    
    async function fetchData() {
      try {
        addLog('debug', 'Fetching stats from API...')
        const statsRes = await fetch(apiUrl('/api/v1/stats'))
        
        if (!statsRes.ok) {
          throw new Error(`HTTP ${statsRes.status}: ${statsRes.statusText}`)
        }
        
        const statsData = await statsRes.json() as Stats
        setStats(statsData)
        addLog('info', `Stats loaded: $${statsData.totalRevenue.toLocaleString()} revenue`)
        
        addLog('debug', 'Fetching bookings...')
        const bookingsRes = await fetch(apiUrl('/api/v1/bookings'))
        
        if (!bookingsRes.ok) {
          throw new Error(`HTTP ${bookingsRes.status}: ${bookingsRes.statusText}`)
        }
        
        const bookingsData = await bookingsRes.json() as BookingsResponse
        setBookings(bookingsData.data || [])
        addLog('info', `Bookings loaded: ${bookingsData.data.length} total`)
        
        addLog('debug', 'Initial fetch complete')
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        addLog('error', `Fetch error: ${message}`)
        setError(message)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [])

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Filtered logs
  const filteredLogs = logs.filter(log => 
    logFilter === 'all' || log.level === logFilter
  )

  // Handle filter change
  const handleFilterChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setLogFilter(e.target.value as LogEntry['level'])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-6">
        <Card className="max-w-md border-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Connection Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">{error}</p>
            <code className="bg-muted p-3 rounded text-sm block">
              cd apps/api && node src/server.ts
            </code>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border/20 shadow-sm
        transform transition-transform duration-200 ease-in-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between p-4 border-b border-border/20">
          <img src="/images/bizing.logo.horizontal.combo.svg" alt="Bizing" className="h-5 dark:invert" />
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <nav className="p-4 space-y-1">
          <Button variant="secondary" className="w-full justify-start gap-3">
            <TrendingUp className="h-5 w-5" />
            Dashboard
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3">
            <Calendar className="h-5 w-5" />
            Bookings
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3">
            <Users className="h-5 w-5" />
            Customers
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3">
            <ShoppingCart className="h-5 w-5" />
            Products
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3">
            <DollarSign className="h-5 w-5" />
            Payments
          </Button>
          <Link href="/schema">
            <Button variant="outline" className="w-full justify-start gap-3 border-purple-200 text-purple-600 hover:bg-purple-50 dark:border-purple-900/50 dark:text-purple-400">
              <Database className="h-5 w-5" />
              Schema
            </Button>
          </Link>
          <Link href="/bizing">
            <Button variant="outline" className="w-full justify-start gap-3 border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-900/50 dark:text-indigo-400">
              <Brain className="h-5 w-5" />
              Bizing AI
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
      <div className="lg:ml-64">
        {/* Header - visible only on mobile */}
        <header className="sticky top-0 z-30 bg-card border-b border-border/20 px-6 py-4 lg:hidden">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <img src="/images/bizing.logo.horizontal.combo.svg" alt="Bizing" className="h-5 dark:invert" />
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="p-6 pb-32">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats?.totalRevenue.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">+12% from last month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalBookings}</div>
                <p className="text-xs text-muted-foreground">+8% from last month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalCustomers}</div>
                <p className="text-xs text-muted-foreground">+15% from last month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.pendingOrders}</div>
                <p className="text-xs text-muted-foreground">-5% from last month</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Bookings */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Bookings</CardTitle>
              <CardDescription>{bookings.length} total bookings</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium">{booking.serviceName}</TableCell>
                      <TableCell>{booking.customerName}</TableCell>
                      <TableCell className="text-muted-foreground">{booking.date}</TableCell>
                      <TableCell>
                        <Badge variant={
                          booking.status === 'confirmed' ? 'default' :
                          booking.status === 'pending' ? 'secondary' :
                          booking.status === 'completed' ? 'outline' :
                          'destructive'
                        }>
                          {booking.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">${booking.price}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Log Overlay */}
      <div className={`
        fixed bottom-0 right-0 left-0 lg:left-auto z-50
        bg-card border border-border/20 shadow-lg rounded-t-xl
        transition-all duration-300 ease-in-out
        ${showLogs ? 'h-64' : 'h-12'}
      `}>
        {/* Toggle Bar */}
        <Button
          variant="ghost"
          className="w-full h-12 px-4 flex items-center justify-between rounded-t-xl"
          onClick={() => setShowLogs(!showLogs)}
        >
          <div className="flex items-center gap-3">
            <Bug className="h-4 w-4 text-green-500" />
            <span className="font-medium text-sm">Logs</span>
            <Badge variant="secondary">{logs.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={logFilter}
              onChange={handleFilterChange}
              onClick={(e) => e.stopPropagation()}
              className="bg-background border border-border/20 rounded px-2 py-1 text-xs"
            >
              <option value="all">All</option>
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </select>
            
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setLogs([]) }}>
              <Trash2 className="h-4 w-4" />
            </Button>
            
            {showLogs ? <ChevronDownIcon /> : <ChevronUpIcon />}
          </div>
        </Button>

        {/* Log Content */}
        {showLogs && (
          <div className="h-48 overflow-y-auto p-4 font-mono text-xs">
            {filteredLogs.length === 0 ? (
              <div className="text-muted-foreground italic">No logs yet...</div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="mb-1 flex gap-3">
                  <span className="text-muted-foreground shrink-0">{log.timestamp}</span>
                  <span className={getLogColor(log.level)}>{log.message}</span>
                  {log.data ? (
                    <span className="text-muted-foreground">{JSON.stringify(log.data)}</span>
                  ) : null}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}

function ChevronDownIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6"/>
    </svg>
  )
}

function ChevronUpIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m18 15-6-6-6 6"/>
    </svg>
  )
}

// Log color helper
function getLogColor(level: LogEntry['level']): string {
  switch (level) {
    case 'debug': return 'text-muted-foreground'
    case 'info': return 'text-foreground'
    case 'warn': return 'text-yellow-500'
    case 'error': return 'text-red-500'
    default: return 'text-foreground'
  }
}
