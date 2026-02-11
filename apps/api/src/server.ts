import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { v4 as uuidv4 } from 'uuid'
import { OpenAPIHono, z } from '@hono/zod-openapi'
import { chatWithLLM, createBizingSystemPrompt } from './services/llm.js'

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
// Schema Routes
// ============================================

app.get('/api/v1/schema/graph', (c) => {
  return c.json({
    entities: [
      {
        name: 'Booking',
        tableName: 'bookings',
        columns: [
          { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
          { name: 'customerId', type: 'uuid', nullable: false, primaryKey: false },
          { name: 'serviceId', type: 'uuid', nullable: false, primaryKey: false },
          { name: 'date', type: 'timestamp', nullable: false, primaryKey: false },
          { name: 'status', type: 'enum', nullable: false, primaryKey: false },
          { name: 'price', type: 'decimal', nullable: false, primaryKey: false },
        ],
        relationships: [
          { type: 'N:1', to: 'Customer', field: 'customerId', description: 'Booking belongs to customer' },
          { type: 'N:1', to: 'Service', field: 'serviceId', description: 'Booking is for a service' },
        ],
      },
      {
        name: 'Customer',
        tableName: 'customers',
        columns: [
          { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
          { name: 'name', type: 'varchar', nullable: false, primaryKey: false },
          { name: 'email', type: 'varchar', nullable: false, primaryKey: false },
          { name: 'phone', type: 'varchar', nullable: true, primaryKey: false },
        ],
        relationships: [
          { type: '1:N', to: 'Booking', field: 'customerId', description: 'Customer has many bookings' },
        ],
      },
      {
        name: 'Service',
        tableName: 'services',
        columns: [
          { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
          { name: 'name', type: 'varchar', nullable: false, primaryKey: false },
          { name: 'description', type: 'text', nullable: true, primaryKey: false },
          { name: 'price', type: 'decimal', nullable: false, primaryKey: false },
          { name: 'duration', type: 'integer', nullable: false, primaryKey: false },
        ],
        relationships: [
          { type: '1:N', to: 'Booking', field: 'serviceId', description: 'Service has many bookings' },
        ],
      },
    ],
    nodes: [
      { 
        id: 'Booking', 
        type: 'entityNode', 
        position: { x: 400, y: 100 }, 
        data: { 
          entity: {
            name: 'Booking',
            tableName: 'bookings',
            columns: [
              { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
              { name: 'customerId', type: 'uuid', nullable: false, primaryKey: false },
              { name: 'serviceId', type: 'uuid', nullable: false, primaryKey: false },
              { name: 'date', type: 'timestamp', nullable: false, primaryKey: false },
              { name: 'status', type: 'enum', nullable: false, primaryKey: false },
              { name: 'price', type: 'decimal', nullable: false, primaryKey: false },
            ],
            relationships: [
              { type: 'N:1', to: 'Customer', field: 'customerId', description: 'Booking belongs to customer' },
              { type: 'N:1', to: 'Service', field: 'serviceId', description: 'Booking is for a service' },
            ],
          }
        } 
      },
      { 
        id: 'Customer', 
        type: 'entityNode', 
        position: { x: 100, y: 100 }, 
        data: { 
          entity: {
            name: 'Customer',
            tableName: 'customers',
            columns: [
              { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
              { name: 'name', type: 'varchar', nullable: false, primaryKey: false },
              { name: 'email', type: 'varchar', nullable: false, primaryKey: false },
              { name: 'phone', type: 'varchar', nullable: true, primaryKey: false },
            ],
            relationships: [
              { type: '1:N', to: 'Booking', field: 'customerId', description: 'Customer has many bookings' },
            ],
          }
        } 
      },
      { 
        id: 'Service', 
        type: 'entityNode', 
        position: { x: 700, y: 100 }, 
        data: { 
          entity: {
            name: 'Service',
            tableName: 'services',
            columns: [
              { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
              { name: 'name', type: 'varchar', nullable: false, primaryKey: false },
              { name: 'description', type: 'text', nullable: true, primaryKey: false },
              { name: 'price', type: 'decimal', nullable: false, primaryKey: false },
              { name: 'duration', type: 'integer', nullable: false, primaryKey: false },
            ],
            relationships: [
              { type: '1:N', to: 'Booking', field: 'serviceId', description: 'Service has many bookings' },
            ],
          }
        } 
      },
    ],
    edges: [
      { id: 'e1', source: 'Booking', sourceHandle: 'source-1', target: 'Customer', targetHandle: 'target-1', label: 'N:1', type: 'smoothstep', animated: true },
      { id: 'e2', source: 'Booking', sourceHandle: 'source-2', target: 'Service', targetHandle: 'target-1', label: 'N:1', type: 'smoothstep', animated: true },
    ],
  })
})

// ============================================
// Bizing AI Routes
// ============================================

app.post('/api/v1/bizing/chat', async (c) => {
  const body = await c.req.json()
  const { message } = body

  try {
    log(`Bizing chat request: ${message.slice(0, 50)}...`)
    
    const response = await chatWithLLM({
      messages: [
        {
          role: 'system',
          content: createBizingSystemPrompt(),
        },
        {
          role: 'user',
          content: message,
        },
      ],
      temperature: 0.7,
      maxTokens: 2000,
    })

    log('Bizing chat response generated successfully')

    return c.json({
      response,
      timestamp: new Date().toISOString(),
      model: 'kimi-k2.5',
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    log(`Bizing chat error: ${errorMessage}`)
    
    return c.json({
      response: 'I apologize, but I am having trouble connecting to my knowledge base right now. Please check that my API key is configured correctly.',
      error: errorMessage,
      timestamp: new Date().toISOString(),
      model: 'error',
    }, 500)
  }
})

app.get('/api/v1/brain/activity', (c) => {
  return c.json({
    activity: [
      {
        id: '1',
        type: 'change',
        title: 'Schema Graph Fixed',
        description: 'Fixed React Flow handle connections with proper IDs',
        timestamp: new Date().toISOString(),
      },
      {
        id: '2',
        type: 'session',
        title: 'Dashboard API Endpoints',
        description: 'Added stats, bookings, and schema graph endpoints',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: '3',
        type: 'decision',
        title: 'Next.js 15 Upgrade',
        description: 'Updated to latest React 19 and Next.js 15.1.6',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: '4',
        type: 'change',
        title: 'Brain Documentation',
        description: 'Created 41 files of comprehensive documentation for Bizing consciousness',
        timestamp: new Date(Date.now() - 10800000).toISOString(),
      },
      {
        id: '5',
        type: 'decision',
        title: '7% Commission Model',
        description: 'Established fair commission structure for all parties',
        timestamp: new Date(Date.now() - 14400000).toISOString(),
      },
    ],
  })
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