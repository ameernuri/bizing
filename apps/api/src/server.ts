import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { v4 as uuidv4 } from 'uuid'
import { Hono } from 'hono'
import { OpenAPIHono } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'

// ============================================
// Schema Parser - Extract entities/relationships from Drizzle schemas
// ============================================

interface Column {
  name: string
  type: string
  nullable: boolean
  primaryKey?: boolean
  default?: string
}

interface Entity {
  name: string
  tableName: string
  columns: Column[]
  relationships: Relationship[]
}

interface Relationship {
  type: '1:N' | '1:1' | 'N:1'
  to: string
  field: string
  description: string
}

interface SchemaGraph {
  entities: Entity[]
  relationships: Relationship[]
}

// Parse Drizzle schema files to extract entities
function parseSchema(): SchemaGraph {
  const entities: Entity[] = [
    {
      name: 'Organization',
      tableName: 'organizations',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
        { name: 'name', type: 'varchar(255)', nullable: false },
        { name: 'slug', type: 'varchar(100)', nullable: false },
        { name: 'logoUrl', type: 'varchar(500)', nullable: true },
        { name: 'timezone', type: 'varchar(50)', nullable: true, default: 'UTC' },
        { name: 'currency', type: 'varchar(3)', nullable: true, default: 'USD' },
        { name: 'status', type: 'varchar(20)', nullable: true, default: 'active' },
        { name: 'settings', type: 'jsonb', nullable: true },
        { name: 'createdAt', type: 'timestamp', nullable: true },
        { name: 'updatedAt', type: 'timestamp', nullable: true },
      ],
      relationships: [
        { type: '1:N', to: 'User', field: 'orgId', description: 'Users belong to org' },
        { type: '1:N', to: 'Service', field: 'orgId', description: 'Services belong to org' },
        { type: '1:N', to: 'Product', field: 'orgId', description: 'Products belong to org' },
        { type: '1:N', to: 'Booking', field: 'orgId', description: 'Bookings belong to org' },
      ]
    },
    {
      name: 'User',
      tableName: 'users',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
        { name: 'orgId', type: 'uuid', nullable: false },
        { name: 'email', type: 'varchar(255)', nullable: false },
        { name: 'passwordHash', type: 'varchar(255)', nullable: true },
        { name: 'firstName', type: 'varchar(100)', nullable: true },
        { name: 'lastName', type: 'varchar(100)', nullable: true },
        { name: 'phone', type: 'varchar(50)', nullable: true },
        { name: 'role', type: 'varchar(20)', nullable: true, default: 'staff' },
        { name: 'status', type: 'varchar(20)', nullable: true, default: 'active' },
        { name: 'avatarUrl', type: 'varchar(500)', nullable: true },
        { name: 'emailVerifiedAt', type: 'timestamp', nullable: true },
        { name: 'createdAt', type: 'timestamp', nullable: true },
        { name: 'updatedAt', type: 'timestamp', nullable: true },
      ],
      relationships: [
        { type: 'N:1', to: 'Organization', field: 'orgId', description: 'User belongs to org' },
      ]
    },
    {
      name: 'Service',
      tableName: 'services',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
        { name: 'orgId', type: 'uuid', nullable: false },
        { name: 'categoryId', type: 'uuid', nullable: true },
        { name: 'name', type: 'varchar(255)', nullable: false },
        { name: 'slug', type: 'varchar(100)', nullable: false },
        { name: 'description', type: 'text', nullable: true },
        { name: 'durationMinutes', type: 'integer', nullable: true, default: '60' },
        { name: 'price', type: 'decimal(10,2)', nullable: true, default: '0' },
        { name: 'currency', type: 'varchar(3)', nullable: true, default: 'USD' },
        { name: 'isActive', type: 'boolean', nullable: true, default: 'true' },
        { name: 'isOnlineBookable', type: 'boolean', nullable: true, default: 'true' },
        { name: 'createdAt', type: 'timestamp', nullable: true },
        { name: 'updatedAt', type: 'timestamp', nullable: true },
      ],
      relationships: [
        { type: 'N:1', to: 'Organization', field: 'orgId', description: 'Service belongs to org' },
        { type: '1:N', to: 'Booking', field: 'serviceId', description: 'Bookings reference service' },
      ]
    },
    {
      name: 'Product',
      tableName: 'products',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
        { name: 'orgId', type: 'uuid', nullable: false },
        { name: 'name', type: 'varchar(255)', nullable: false },
        { name: 'slug', type: 'varchar(100)', nullable: false },
        { name: 'description', type: 'text', nullable: true },
        { name: 'price', type: 'decimal(10,2)', nullable: false },
        { name: 'currency', type: 'varchar(3)', nullable: true, default: 'USD' },
        { name: 'type', type: 'varchar(50)', nullable: true, default: 'digital' },
        { name: 'status', type: 'varchar(20)', nullable: true, default: 'draft' },
        { name: 'downloadUrl', type: 'varchar(500)', nullable: true },
        { name: 'createdAt', type: 'timestamp', nullable: true },
        { name: 'updatedAt', type: 'timestamp', nullable: true },
      ],
      relationships: [
        { type: 'N:1', to: 'Organization', field: 'orgId', description: 'Product belongs to org' },
      ]
    },
    {
      name: 'Booking',
      tableName: 'bookings',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
        { name: 'orgId', type: 'uuid', nullable: false },
        { name: 'serviceId', type: 'uuid', nullable: false },
        { name: 'customerId', type: 'uuid', nullable: true },
        { name: 'customerName', type: 'varchar(255)', nullable: true },
        { name: 'customerEmail', type: 'varchar(255)', nullable: true },
        { name: 'customerPhone', type: 'varchar(50)', nullable: true },
        { name: 'startTime', type: 'timestamp', nullable: false },
        { name: 'endTime', type: 'timestamp', nullable: false },
        { name: 'status', type: 'varchar(20)', nullable: true, default: 'pending' },
        { name: 'price', type: 'decimal(10,2)', nullable: true, default: '0' },
        { name: 'source', type: 'varchar(50)', nullable: true, default: 'website' },
        { name: 'confirmationCode', type: 'varchar(20)', nullable: true },
        { name: 'createdAt', type: 'timestamp', nullable: true },
        { name: 'updatedAt', type: 'timestamp', nullable: true },
      ],
      relationships: [
        { type: 'N:1', to: 'Organization', field: 'orgId', description: 'Booking belongs to org' },
        { type: 'N:1', to: 'Service', field: 'serviceId', description: 'Booking references service' },
        { type: 'N:1', to: 'User', field: 'customerId', description: 'Booking has customer' },
      ]
    }
  ]

  // Extract all relationships
  const allRelationships: Relationship[] = []
  entities.forEach(entity => {
    entity.relationships.forEach(rel => {
      allRelationships.push(rel)
    })
  })

  return { entities, relationships: allRelationships }
}

// Generate React Flow nodes from entities
function generateFlowNodes(entities: Entity[]) {
  return entities.map((entity, index) => {
    const x = 100 + (index % 3) * 350
    const y = 100 + Math.floor(index / 3) * 250
    
    return {
      id: entity.name,
      type: 'entityNode',
      position: { x, y },
      data: { entity }
    }
  })
}

// Generate React Flow edges from relationships
function generateFlowEdges(entities: Entity[]) {
  const edges: Array<{
    id: string
    source: string
    target: string
    label: string
    type: string
    animated: boolean
  }> = []
  
  entities.forEach(entity => {
    entity.relationships.forEach(rel => {
      if (entities.find(e => e.name === rel.to)) {
        edges.push({
          id: `${entity.name}-${rel.to}`,
          source: rel.type === '1:N' || rel.type === '1:1' ? entity.name : rel.to,
          target: rel.type === '1:N' || rel.type === '1:1' ? rel.to : entity.name,
          label: rel.type,
          type: 'smoothstep',
          animated: true
        })
      }
    })
  })
  
  return edges
}

// ============================================
// Simple Logger
// ============================================

const colors: Record<string, string> = {
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m'
}
const reset = '\x1b[0m'

function log(level: string, message: string) {
  const color = colors[level] || colors.info
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  const levelStr = level.toUpperCase().padEnd(5)
  console.log(`${color}[${timestamp}] [${levelStr}] ${message}${reset}`)
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

// Demo
app.get('/api/demo', (c) => {
  return c.json({ message: 'biz.ing API' })
})

// ============================================
// Dashboard Routes
// ============================================

// Dashboard Stats
app.get('/api/v1/stats', (c) => {
  return c.json({
    totalRevenue: 15420,
    totalBookings: 156,
    totalCustomers: 89,
    pendingOrders: 12
  })
})

// Bookings List
app.get('/api/v1/bookings', (c) => {
  return c.json({
    data: [
      { id: '1', serviceName: 'Consultation', customerName: 'John Doe', date: '2026-02-15', status: 'confirmed' as const, price: 100 },
      { id: '2', serviceName: 'Therapy Session', customerName: 'Jane Smith', date: '2026-02-16', status: 'pending' as const, price: 150 },
      { id: '3', serviceName: 'Coaching Call', customerName: 'Bob Wilson', date: '2026-02-17', status: 'completed' as const, price: 200 }
    ],
    pagination: { page: 1, limit: 20, total: 3 }
  })
})

// Products List
app.get('/api/v1/products', (c) => {
  return c.json({
    data: [
      { id: '1', name: 'E-Book', description: 'Complete Guide', price: 29.99, type: 'digital' as const },
      { id: '2', name: 'Consultation', description: '1-hour call', price: 100, type: 'service' as const },
      { id: '3', name: 'Premium Course', description: 'Video course', price: 199, type: 'subscription' as const }
    ]
  })
})

// ============================================
// Auth Routes
// ============================================

// Auth Register
app.post('/api/v1/auth/register', async (c) => {
  const body = await c.req.json() as { name: string; email: string }
  return c.json({
    id: 'org_' + uuidv4().slice(0, 8),
    name: body.name,
    email: body.email
  }, 201)
})

// Auth Login
app.post('/api/v1/auth/login', async (c) => {
  const body = await c.req.json() as { email: string }
  return c.json({
    token: 'jwt_' + uuidv4().slice(0, 16),
    user: {
      id: 'user_' + uuidv4().slice(0, 8),
      email: body.email,
      name: 'Test User'
    }
  })
})

// ============================================
// Schema Routes
// ============================================

// Schema Graph Endpoint
app.get('/api/v1/schema/graph', (c) => {
  const schema = parseSchema()
  const nodes = generateFlowNodes(schema.entities)
  const edges = generateFlowEdges(schema.entities)
  
  return c.json({
    ...schema,
    nodes,
    edges
  })
})

// Entity Detail Endpoint
app.get('/api/v1/schema/entity/:name', (c) => {
  const name = c.req.param('name')
  const schema = parseSchema()
  const entity = schema.entities.find(e => e.name.toLowerCase() === name.toLowerCase())
  
  if (!entity) {
    return c.json({ error: 'Entity not found' }, 404)
  }
  
  return c.json(entity)
})

// ============================================
// Documentation
// ============================================

// OpenAPI Docs
app.doc('/doc', {
  openapi: '3.0.0',
  info: { version: '0.1.0', title: 'Bizing API', description: 'Bizing API - Sell your services online' }
})

app.get('/reference', Scalar({}))

// ============================================
// Error Handling
// ============================================

app.onError((err, c) => {
  log('error', err.message)
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
  console.log(' 🚀 Bizing API http://localhost:' + info.port)
  console.log('')
  console.log(' 📊 Dashboard:')
  console.log('   GET  /api/v1/stats       - Stats')
  console.log('   GET  /api/v1/bookings   - Bookings')
  console.log('   GET  /api/v1/products   - Products')
  console.log('')
  console.log(' 🔐 Auth:')
  console.log('   POST /api/v1/auth/register - Register')
  console.log('   POST /api/v1/auth/login    - Login')
  console.log('')
  console.log(' 🗺️  Schema:')
  console.log('   GET  /api/v1/schema/graph      - Entity graph')
  console.log('   GET  /api/v1/schema/entity/:name - Entity detail')
  console.log('')
  console.log(' 📚 Docs:')
  console.log('   GET  /reference          - API Docs')
  console.log('')
})
