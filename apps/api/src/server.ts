import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { v4 as uuidv4 } from 'uuid'
import { OpenAPIHono, z } from '@hono/zod-openapi'

// ============================================
// Logger
// ============================================

function log(message: string) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  console.log(`[${timestamp}] ${message}`)
}

// ============================================
// API Routes
// ============================================

const app = new OpenAPIHono()

// CORS
app.use('/*', cors())

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  })
})

// ============================================
// Auth Routes
// ============================================

app.post('/api/v1/auth/register', async (c) => {
  const body = await c.req.json()
  return c.json({
    id: 'org_' + uuidv4().slice(0, 8),
    name: body.name,
    email: body.email,
  }, 201)
})

app.post('/api/v1/auth/login', async (c) => {
  const body = await c.req.json()
  return c.json({
    token: 'jwt_' + uuidv4().slice(0, 16),
    user: {
      id: 'user_' + uuidv4().slice(0, 8),
      email: body.email,
      name: 'Test User',
    },
  })
})

// ============================================
// Products Routes
// ============================================

app.get('/api/v1/products', (c) => {
  return c.json({
    data: [
      { id: '1', name: 'E-Book', price: 29.99, type: 'digital' },
      { id: '2', name: 'Consultation', price: 100, type: 'service' },
      { id: '3', name: 'Premium Course', price: 199, type: 'subscription' },
    ],
  })
})

// ============================================
// Stats Routes
// ============================================

app.get('/api/v1/stats', (c) => {
  return c.json({
    totalRevenue: 12500,
    totalBookings: 156,
    totalCustomers: 89,
    pendingOrders: 12,
  })
})

// ============================================
// Bookings Routes
// ============================================

app.get('/api/v1/bookings', (c) => {
  return c.json({
    data: [
      {
        id: 'booking_1',
        serviceName: 'Haircut & Style',
        customerName: 'Sarah Johnson',
        date: '2026-02-12',
        status: 'confirmed',
        price: 65,
      },
      {
        id: 'booking_2',
        serviceName: 'Color Treatment',
        customerName: 'Mike Chen',
        date: '2026-02-12',
        status: 'pending',
        price: 120,
      },
      {
        id: 'booking_3',
        serviceName: 'Beard Trim',
        customerName: 'Alex Rivera',
        date: '2026-02-11',
        status: 'completed',
        price: 25,
      },
      {
        id: 'booking_4',
        serviceName: 'Full Service',
        customerName: 'Emma Davis',
        date: '2026-02-13',
        status: 'confirmed',
        price: 150,
      },
      {
        id: 'booking_5',
        serviceName: 'Consultation',
        customerName: 'James Wilson',
        date: '2026-02-10',
        status: 'cancelled',
        price: 0,
      },
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 5,
    },
  })
})

// ============================================
// Documentation
// ============================================

app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    version: '0.1.0',
    title: 'biz.ing API',
    description: 'API for selling services and digital products',
  },
})

// ============================================
// Error Handling
// ============================================

app.onError((err, c) => {
  log(`ERROR: ${err.message}`)
  return c.json({ success: false, error: { message: err.message } }, 500)
})

app.notFound((c) => {
  return c.json({ success: false, error: { code: 'NOT_FOUND' } }, 404)
})

// ============================================
// Server
// ============================================

const PORT = Number(process.env.PORT) || 6129

serve({
  fetch: app.fetch,
  port: PORT
}, (info) => {
  console.log('')
  console.log(' 🚀 biz.ing API http://localhost:' + info.port)
  console.log('')
})