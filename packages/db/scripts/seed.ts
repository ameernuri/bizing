import { and, eq, inArray } from 'drizzle-orm'
import {
  bizes,
  bookingOrders,
  db,
  offerVersions,
  offers,
  serviceGroups,
  services,
  users,
} from '../src/index'

const ORG_SLUG = 'mock-bookings-org'

const SEEDED_ORDER_IDS = [
  'seed_booking_order_1',
  'seed_booking_order_2',
  'seed_booking_order_3',
  'seed_booking_order_4',
] as const

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
      },
    })
    .returning({ id: bizes.id })

  const bizId = biz.id

  // Keep legacy service rows for local demo surfaces that still render service lists.
  const [hairGroup, colorGroup, consultGroup] = await db
    .insert(serviceGroups)
    .values([
      {
        bizId,
        name: 'Hair Services',
        slug: 'hair-services',
        description: 'Cuts, styles, and hair treatments',
        status: 'active',
      },
      {
        bizId,
        name: 'Color Services',
        slug: 'color-services',
        description: 'Color treatments and refreshers',
        status: 'active',
      },
      {
        bizId,
        name: 'Consultations',
        slug: 'consultations',
        description: 'Discovery calls and consultations',
        status: 'active',
      },
    ])
    .onConflictDoUpdate({
      target: [serviceGroups.bizId, serviceGroups.slug],
      set: {
        status: 'active',
      },
    })
    .returning({ id: serviceGroups.id })

  await db
    .insert(services)
    .values([
      {
        bizId,
        serviceGroupId: hairGroup.id,
        name: 'Haircut and Style',
        slug: 'mock-haircut-style',
        description: 'Classic cut and styling session',
        type: 'appointment',
        isSelfBookable: true,
        status: 'active',
      },
      {
        bizId,
        serviceGroupId: colorGroup.id,
        name: 'Color Treatment',
        slug: 'mock-color-treatment',
        description: 'Single-process color refresh',
        type: 'appointment',
        isSelfBookable: true,
        status: 'active',
      },
      {
        bizId,
        serviceGroupId: consultGroup.id,
        name: 'Consultation',
        slug: 'mock-consultation',
        description: '15-minute discovery call',
        type: 'appointment',
        isSelfBookable: true,
        status: 'active',
      },
    ])
    .onConflictDoUpdate({
      target: [services.bizId, services.slug],
      set: {
        isSelfBookable: true,
        status: 'active',
      },
    })

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
      target: users.email,
      set: {
        status: 'active',
      },
    })
    .returning({ id: users.id, firstName: users.firstName, lastName: users.lastName })

  const [hairOffer] = await db
    .insert(offers)
    .values({
      bizId,
      name: 'Haircut and Style',
      slug: 'mock-haircut-style-offer',
      description: 'Classic cut and styling session',
      executionMode: 'slot',
      status: 'active',
      isPublished: true,
      timezone: 'America/Los_Angeles',
    })
    .onConflictDoUpdate({
      target: [offers.bizId, offers.slug],
      set: {
        name: 'Haircut and Style',
        status: 'active',
        isPublished: true,
      },
    })
    .returning({ id: offers.id })

  const [colorOffer] = await db
    .insert(offers)
    .values({
      bizId,
      name: 'Color Treatment',
      slug: 'mock-color-treatment-offer',
      description: 'Single-process color refresh',
      executionMode: 'slot',
      status: 'active',
      isPublished: true,
      timezone: 'America/Los_Angeles',
    })
    .onConflictDoUpdate({
      target: [offers.bizId, offers.slug],
      set: {
        name: 'Color Treatment',
        status: 'active',
        isPublished: true,
      },
    })
    .returning({ id: offers.id })

  const [consultOffer] = await db
    .insert(offers)
    .values({
      bizId,
      name: 'Consultation',
      slug: 'mock-consultation-offer',
      description: '15-minute discovery call',
      executionMode: 'slot',
      status: 'active',
      isPublished: true,
      timezone: 'America/Los_Angeles',
    })
    .onConflictDoUpdate({
      target: [offers.bizId, offers.slug],
      set: {
        name: 'Consultation',
        status: 'active',
        isPublished: true,
      },
    })
    .returning({ id: offers.id })

  const [hairOfferVersion] = await db
    .insert(offerVersions)
    .values({
      bizId,
      offerId: hairOffer.id,
      version: 1,
      status: 'published',
      durationMode: 'fixed',
      defaultDurationMin: 60,
      basePriceMinor: 6500,
      currency: 'USD',
    })
    .onConflictDoUpdate({
      target: [offerVersions.offerId, offerVersions.version],
      set: {
        status: 'published',
        defaultDurationMin: 60,
        basePriceMinor: 6500,
      },
    })
    .returning({ id: offerVersions.id })

  const [colorOfferVersion] = await db
    .insert(offerVersions)
    .values({
      bizId,
      offerId: colorOffer.id,
      version: 1,
      status: 'published',
      durationMode: 'fixed',
      defaultDurationMin: 90,
      basePriceMinor: 12000,
      currency: 'USD',
    })
    .onConflictDoUpdate({
      target: [offerVersions.offerId, offerVersions.version],
      set: {
        status: 'published',
        defaultDurationMin: 90,
        basePriceMinor: 12000,
      },
    })
    .returning({ id: offerVersions.id })

  const [consultOfferVersion] = await db
    .insert(offerVersions)
    .values({
      bizId,
      offerId: consultOffer.id,
      version: 1,
      status: 'published',
      durationMode: 'fixed',
      defaultDurationMin: 30,
      basePriceMinor: 0,
      currency: 'USD',
    })
    .onConflictDoUpdate({
      target: [offerVersions.offerId, offerVersions.version],
      set: {
        status: 'published',
        defaultDurationMin: 30,
        basePriceMinor: 0,
      },
    })
    .returning({ id: offerVersions.id })

  await db
    .delete(bookingOrders)
    .where(and(eq(bookingOrders.bizId, bizId), inArray(bookingOrders.id, [...SEEDED_ORDER_IDS])))

  const now = new Date()

  await db.insert(bookingOrders).values([
    {
      id: SEEDED_ORDER_IDS[0],
      bizId,
      offerId: hairOffer.id,
      offerVersionId: hairOfferVersion.id,
      customerUserId: sarah.id,
      status: 'confirmed',
      subtotalMinor: 6500,
      taxMinor: 0,
      feeMinor: 0,
      discountMinor: 0,
      totalMinor: 6500,
      requestedStartAt: plusHours(now, 24),
      requestedEndAt: plusHours(now, 25),
      confirmedStartAt: plusHours(now, 24),
      confirmedEndAt: plusHours(now, 25),
      pricingSnapshot: { source: 'seed', code: 'BK1001' },
      policySnapshot: { notes: 'Prefers layered style' },
    },
    {
      id: SEEDED_ORDER_IDS[1],
      bizId,
      offerId: colorOffer.id,
      offerVersionId: colorOfferVersion.id,
      customerUserId: mike.id,
      status: 'quoted',
      subtotalMinor: 12000,
      taxMinor: 0,
      feeMinor: 0,
      discountMinor: 0,
      totalMinor: 12000,
      requestedStartAt: plusHours(now, 30),
      requestedEndAt: plusHours(now, 31.5),
      pricingSnapshot: { source: 'seed', code: 'BK1002' },
      policySnapshot: { notes: 'First-time color service' },
    },
    {
      id: SEEDED_ORDER_IDS[2],
      bizId,
      offerId: hairOffer.id,
      offerVersionId: hairOfferVersion.id,
      customerUserId: emma.id,
      status: 'completed',
      subtotalMinor: 6500,
      taxMinor: 0,
      feeMinor: 0,
      discountMinor: 0,
      totalMinor: 6500,
      requestedStartAt: plusHours(now, -24),
      requestedEndAt: plusHours(now, -23),
      confirmedStartAt: plusHours(now, -24),
      confirmedEndAt: plusHours(now, -23),
      pricingSnapshot: { source: 'seed', code: 'BK1003' },
      policySnapshot: { notes: 'Requested quick trim' },
    },
    {
      id: SEEDED_ORDER_IDS[3],
      bizId,
      offerId: consultOffer.id,
      offerVersionId: consultOfferVersion.id,
      customerUserId: sarah.id,
      status: 'cancelled',
      subtotalMinor: 0,
      taxMinor: 0,
      feeMinor: 0,
      discountMinor: 0,
      totalMinor: 0,
      requestedStartAt: plusHours(now, 48),
      requestedEndAt: plusHours(now, 48.5),
      pricingSnapshot: { source: 'seed', code: 'BK1004' },
      policySnapshot: { notes: 'Customer rescheduled' },
    },
  ])

  console.log(`Seeded ${SEEDED_ORDER_IDS.length} booking orders for org ${ORG_SLUG}.`)
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to seed booking orders:', error)
    process.exit(1)
  })
