import { and, eq, inArray } from 'drizzle-orm'
import { db, bizes, bookings, services, users } from '../src/index'
import type { NewBooking } from '../src/schema/bookings'

const ORG_SLUG = 'mock-bookings-org'
const SOURCE = 'import' as const
const BOOKING_CODES = ['BK1001', 'BK1002', 'BK1003', 'BK1004'] as const

function plusHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000)
}

async function seed() {
  const [biz] = await db
    .insert(bizes)
    .values({
      name: 'Bizing Demo Studio',
      slug: ORG_SLUG,
      timezone: 'America/Los_Angeles',
      currency: 'USD',
      status: 'active',
    })
    .onConflictDoUpdate({
      target: bizes.slug,
      set: {
        name: 'Bizing Demo Studio',
        timezone: 'America/Los_Angeles',
        currency: 'USD',
        status: 'active',
        updatedAt: new Date(),
      },
    })
    .returning({ id: bizes.id })

  const bizId = biz.id

  await db
    .delete(bookings)
    .where(and(eq(bookings.bizId, bizId), inArray(bookings.confirmationCode, [...BOOKING_CODES])))

  const [haircut, color, consultation] = await db
    .insert(services)
    .values([
      {
        bizId,
        name: 'Haircut and Style',
        slug: 'mock-haircut-style',
        description: 'Classic cut and styling session',
        durationMinutes: 60,
        price: '65.00',
        currency: 'USD',
        isActive: true,
        isOnlineBookable: true,
      },
      {
        bizId,
        name: 'Color Treatment',
        slug: 'mock-color-treatment',
        description: 'Single-process color refresh',
        durationMinutes: 90,
        price: '120.00',
        currency: 'USD',
        isActive: true,
        isOnlineBookable: true,
      },
      {
        bizId,
        name: 'Consultation',
        slug: 'mock-consultation',
        description: '15-minute discovery call',
        durationMinutes: 30,
        price: '0.00',
        currency: 'USD',
        isActive: true,
        isOnlineBookable: true,
      },
    ])
    .onConflictDoUpdate({
      target: [services.bizId, services.slug],
      set: {
        updatedAt: new Date(),
      },
    })
    .returning({ id: services.id, name: services.name })

  const [sarah, mike, emma] = await db
    .insert(users)
    .values([
      {
        email: 'sarah.mock@example.com',
        firstName: 'Sarah',
        lastName: 'Johnson',
        phone: '+1-555-0101',
        role: 'customer',
        status: 'active',
      },
      {
        email: 'mike.mock@example.com',
        firstName: 'Mike',
        lastName: 'Chen',
        phone: '+1-555-0102',
        role: 'customer',
        status: 'active',
      },
      {
        email: 'emma.mock@example.com',
        firstName: 'Emma',
        lastName: 'Davis',
        phone: '+1-555-0103',
        role: 'customer',
        status: 'active',
      },
    ])
    .onConflictDoUpdate({
      target: [users.email],
      set: {
        updatedAt: new Date(),
      },
    })
    .returning({ id: users.id, firstName: users.firstName, lastName: users.lastName })

  const now = new Date()

  const seedBookings: NewBooking[] = [
    {
      bizId,
      serviceId: haircut.id,
      customerId: sarah.id,
      customerName: `${sarah.firstName} ${sarah.lastName}`,
      customerEmail: 'sarah.mock@example.com',
      customerPhone: '+1-555-0101',
      startTime: plusHours(now, 24),
      endTime: plusHours(now, 25),
      status: 'confirmed',
      notes: 'Prefers layered style.',
      price: '65.00',
      source: SOURCE,
      confirmationCode: 'BK1001',
    },
    {
      bizId,
      serviceId: color.id,
      customerId: mike.id,
      customerName: `${mike.firstName} ${mike.lastName}`,
      customerEmail: 'mike.mock@example.com',
      customerPhone: '+1-555-0102',
      startTime: plusHours(now, 30),
      endTime: plusHours(now, 31.5),
      status: 'pending',
      notes: 'First-time color service.',
      price: '120.00',
      source: SOURCE,
      confirmationCode: 'BK1002',
    },
    {
      bizId,
      serviceId: haircut.id,
      customerId: emma.id,
      customerName: `${emma.firstName} ${emma.lastName}`,
      customerEmail: 'emma.mock@example.com',
      customerPhone: '+1-555-0103',
      startTime: plusHours(now, -24),
      endTime: plusHours(now, -23),
      status: 'completed',
      notes: 'Requested quick trim.',
      price: '65.00',
      source: SOURCE,
      confirmationCode: 'BK1003',
    },
    {
      bizId,
      serviceId: consultation.id,
      customerId: sarah.id,
      customerName: `${sarah.firstName} ${sarah.lastName}`,
      customerEmail: 'sarah.mock@example.com',
      customerPhone: '+1-555-0101',
      startTime: plusHours(now, 48),
      endTime: plusHours(now, 48.5),
      status: 'cancelled',
      notes: 'Customer rescheduled.',
      price: '0.00',
      source: SOURCE,
      confirmationCode: 'BK1004',
    },
  ]

  await db.insert(bookings).values(seedBookings)

  console.log(`Seeded ${seedBookings.length} bookings for org ${ORG_SLUG}.`)
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to seed bookings:', error)
    process.exit(1)
  })
