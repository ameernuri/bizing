/**
 * Customer library routes.
 *
 * ELI5:
 * Customers do not care which table something came from.
 * They ask one simple question:
 * "What do I own, what is still usable, and when does it expire?"
 *
 * The canonical answer lives in `access_library_items`.
 * That table is a rebuildable read model:
 * - source truth still lives in normalized artifact/membership/grant/event rows,
 * - library items are the fast, portal-friendly snapshot,
 * - rebuilding it should always produce the same answer from the same source facts.
 *
 * Why this route matters for the larger platform:
 * - customer portal pages need a very fast owner-centric query path,
 * - support/agents need one read contract instead of joining many domains,
 * - saga/compliance/debug flows need to prove "what the user saw" deterministically.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import dbPackage from '@bizing/db'
import { getCurrentUser, requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { fail, ok } from './_api.js'

const {
  db,
  accessArtifacts,
  accessArtifactEvents,
  accessArtifactLinks,
  accessLibraryItems,
  memberships,
  entitlementGrants,
  entitlementLedgerEntries,
  entitlementWallets,
  sellables,
  bookingOrders,
} = dbPackage

export const customerLibraryRoutes = new Hono()

function computeAvailabilityState(input: {
  status?: string | null
  availableUntil?: Date | null
  usageRemaining?: number | null
}) {
  const now = Date.now()
  if (input.status === 'suspended') return 'suspended'
  if (input.status === 'revoked' || input.status === 'cancelled' || input.status === 'expired') return 'expired'
  if (typeof input.usageRemaining === 'number' && input.usageRemaining <= 0) return 'consumed'
  if (input.availableUntil && input.availableUntil.getTime() < now) return 'expired'
  if (input.availableUntil && input.availableUntil.getTime() - now < 72 * 60 * 60 * 1000) return 'expiring'
  return 'available'
}

async function rebuildCustomerLibraryForOwner(input: {
  bizId: string
  ownerUserId?: string | null
  ownerGroupAccountId?: string | null
}) {
  if (!input.ownerUserId && !input.ownerGroupAccountId) {
    throw new Error('OWNER_REQUIRED')
  }

  const artifactRows = await db.query.accessArtifacts.findMany({
    where: and(
      eq(accessArtifacts.bizId, input.bizId),
      input.ownerUserId ? eq(accessArtifacts.holderUserId, input.ownerUserId) : undefined,
      input.ownerGroupAccountId ? eq(accessArtifacts.holderGroupAccountId, input.ownerGroupAccountId) : undefined,
    ),
    orderBy: [desc(accessArtifacts.issuedAt)],
  })

  const membershipRows = await db.query.memberships.findMany({
    where: and(
      eq(memberships.bizId, input.bizId),
      input.ownerUserId ? eq(memberships.ownerUserId, input.ownerUserId) : undefined,
      input.ownerGroupAccountId ? eq(memberships.ownerGroupAccountId, input.ownerGroupAccountId) : undefined,
    ),
    orderBy: [desc(memberships.currentPeriodStartAt)],
  })

  const walletRows = await db.query.entitlementWallets.findMany({
    where: and(
      eq(entitlementWallets.bizId, input.bizId),
      input.ownerUserId ? eq(entitlementWallets.ownerUserId, input.ownerUserId) : undefined,
      input.ownerGroupAccountId ? eq(entitlementWallets.ownerGroupAccountId, input.ownerGroupAccountId) : undefined,
    ),
    orderBy: [asc(entitlementWallets.name)],
  })

  const artifactIds = artifactRows.map((row) => row.id)
  const membershipIds = membershipRows.map((row) => row.id)
  const walletIds = walletRows.map((row) => row.id)

  const [artifactEventRows, artifactLinkRows, grantRows, ledgerRows, sellableRows] = await Promise.all([
    artifactIds.length
      ? db.query.accessArtifactEvents.findMany({
          where: and(eq(accessArtifactEvents.bizId, input.bizId), inArray(accessArtifactEvents.accessArtifactId, artifactIds)),
          orderBy: [desc(accessArtifactEvents.happenedAt)],
        })
      : Promise.resolve([]),
    artifactIds.length
      ? db.query.accessArtifactLinks.findMany({
          where: and(eq(accessArtifactLinks.bizId, input.bizId), inArray(accessArtifactLinks.accessArtifactId, artifactIds)),
          orderBy: [asc(accessArtifactLinks.relationKey)],
        })
      : Promise.resolve([]),
    walletIds.length
      ? db.query.entitlementGrants.findMany({
          where: and(eq(entitlementGrants.bizId, input.bizId), inArray(entitlementGrants.walletId, walletIds)),
          orderBy: [desc(entitlementGrants.validFromAt)],
        })
      : Promise.resolve([]),
    walletIds.length
      ? db.query.entitlementLedgerEntries.findMany({
          where: and(eq(entitlementLedgerEntries.bizId, input.bizId), inArray(entitlementLedgerEntries.walletId, walletIds)),
          orderBy: [desc(entitlementLedgerEntries.occurredAt)],
        })
      : Promise.resolve([]),
    (() => {
      const sellableIds = Array.from(
        new Set(
          artifactRows.map((row) => row.sellableId).filter((value): value is string => Boolean(value)),
        ),
      )
      return sellableIds.length
        ? db.query.sellables.findMany({
            where: and(eq(sellables.bizId, input.bizId), inArray(sellables.id, sellableIds)),
          })
        : Promise.resolve([])
    })(),
  ])

  const eventsByArtifact = new Map<string, Array<(typeof artifactEventRows)[number]>>()
  for (const row of artifactEventRows) {
    const bucket = eventsByArtifact.get(row.accessArtifactId) ?? []
    bucket.push(row)
    eventsByArtifact.set(row.accessArtifactId, bucket)
  }

  const linksByArtifact = new Map<string, Array<(typeof artifactLinkRows)[number]>>()
  for (const row of artifactLinkRows) {
    const bucket = linksByArtifact.get(row.accessArtifactId) ?? []
    bucket.push(row)
    linksByArtifact.set(row.accessArtifactId, bucket)
  }

  const grantsByWallet = new Map<string, Array<(typeof grantRows)[number]>>()
  for (const row of grantRows) {
    const bucket = grantsByWallet.get(row.walletId) ?? []
    bucket.push(row)
    grantsByWallet.set(row.walletId, bucket)
  }

  const ledgerByWallet = new Map<string, Array<(typeof ledgerRows)[number]>>()
  for (const row of ledgerRows) {
    const bucket = ledgerByWallet.get(row.walletId) ?? []
    bucket.push(row)
    ledgerByWallet.set(row.walletId, bucket)
  }

  const sellablesById = new Map(sellableRows.map((row) => [row.id, row] as const))
  const now = new Date()
  const upserts: Array<Record<string, unknown>> = []

  for (const artifact of artifactRows) {
    const artifactEventsForRow = eventsByArtifact.get(artifact.id) ?? []
    const artifactLinksForRow = linksByArtifact.get(artifact.id) ?? []
    const latestUsageEvent = artifactEventsForRow.find((row) => ['usage_debited', 'consumed', 'verified', 'transferred'].includes(row.eventType))
    const linkedSellable =
      (artifact.sellableId ? sellablesById.get(artifact.sellableId) : null) ??
      (() => {
        const link = artifactLinksForRow.find((row) => row.sellableId)
        return link?.sellableId ? sellablesById.get(link.sellableId) : null
      })()

    upserts.push({
      bizId: input.bizId,
      ownerUserId: artifact.holderUserId ?? input.ownerUserId ?? null,
      ownerGroupAccountId: artifact.holderGroupAccountId ?? input.ownerGroupAccountId ?? null,
      ownerSubjectType: artifact.holderSubjectType ?? null,
      ownerSubjectId: artifact.holderSubjectId ?? null,
      projectionKey: `artifact:${artifact.id}`,
      status: 'active',
      availabilityState: computeAvailabilityState({
        status: artifact.status,
        availableUntil: artifact.expiresAt ?? null,
        usageRemaining: artifact.usageRemaining ?? null,
      }),
      accessArtifactId: artifact.id,
      sellableId: linkedSellable?.id ?? artifact.sellableId ?? null,
      availableFrom: artifact.activatedAt ?? artifact.issuedAt ?? now,
      availableUntil: artifact.expiresAt ?? null,
      lastUsedAt: latestUsageEvent?.happenedAt ?? null,
      usageGranted: artifact.usageGranted ?? null,
      usageRemaining: artifact.usageRemaining ?? null,
      sourceUpdatedAt: artifact.expiresAt ?? artifact.activatedAt ?? artifact.issuedAt ?? now,
      refreshedAt: now,
      projectionVersion: 1,
      snapshot: {
        itemType: artifact.artifactType,
        title: linkedSellable?.displayName ?? artifact.publicCode ?? artifact.id,
        publicCode: artifact.publicCode,
        artifactStatus: artifact.status,
        latestEventType: latestUsageEvent?.eventType ?? null,
        linkTypes: artifactLinksForRow.map((row) => row.linkType),
      },
      metadata: {
        source: 'access_artifact',
        linkCount: artifactLinksForRow.length,
      },
    })
  }

  for (const membership of membershipRows) {
    const relatedWallet = walletRows.find((row) => row.membershipId === membership.id) ?? null
    const latestLedger = relatedWallet ? (ledgerByWallet.get(relatedWallet.id) ?? [])[0] ?? null : null
    const relatedGrant = relatedWallet ? (grantsByWallet.get(relatedWallet.id) ?? [])[0] ?? null : null

    upserts.push({
      bizId: input.bizId,
      ownerUserId: membership.ownerUserId ?? input.ownerUserId ?? null,
      ownerGroupAccountId: membership.ownerGroupAccountId ?? input.ownerGroupAccountId ?? null,
      ownerSubjectType: null,
      ownerSubjectId: null,
      projectionKey: `membership:${membership.id}`,
      status: 'active',
      availabilityState: computeAvailabilityState({
        status: membership.status,
        availableUntil: membership.currentPeriodEndAt ?? null,
        usageRemaining: relatedWallet?.balanceQuantity ?? null,
      }),
      membershipId: membership.id,
      entitlementGrantId: relatedGrant?.id ?? null,
      availableFrom: membership.startsAt ?? membership.currentPeriodStartAt ?? now,
      availableUntil: membership.endedAt ?? membership.currentPeriodEndAt ?? null,
      lastUsedAt: latestLedger?.occurredAt ?? null,
      usageGranted: relatedGrant?.quantity ?? null,
      usageRemaining: relatedWallet?.balanceQuantity ?? null,
      sourceUpdatedAt: membership.endedAt ?? membership.cancelledAt ?? membership.currentPeriodEndAt ?? membership.currentPeriodStartAt ?? membership.startsAt ?? now,
      refreshedAt: now,
      projectionVersion: 1,
      snapshot: {
        itemType: 'membership',
        membershipPlanId: membership.membershipPlanId,
        membershipStatus: membership.status,
        autoRenew: membership.autoRenew,
      },
      metadata: {
        source: 'membership',
        walletId: relatedWallet?.id ?? null,
      },
    })
  }

  for (const wallet of walletRows) {
    if (membershipIds.includes(wallet.membershipId ?? '')) continue
    const latestLedger = (ledgerByWallet.get(wallet.id) ?? [])[0] ?? null
    const latestGrant = (grantsByWallet.get(wallet.id) ?? [])[0] ?? null
    if (!latestGrant) continue

    upserts.push({
      bizId: input.bizId,
      ownerUserId: wallet.ownerUserId ?? input.ownerUserId ?? null,
      ownerGroupAccountId: wallet.ownerGroupAccountId ?? input.ownerGroupAccountId ?? null,
      ownerSubjectType: null,
      ownerSubjectId: null,
      projectionKey: `wallet:${wallet.id}`,
      status: wallet.isActive ? 'active' : 'archived',
      availabilityState: computeAvailabilityState({
        status: wallet.isActive ? 'active' : 'suspended',
        availableUntil: wallet.expiresAt ?? null,
        usageRemaining: wallet.balanceQuantity ?? null,
      }),
      entitlementGrantId: latestGrant?.id ?? null,
      availableFrom: latestGrant?.validFromAt ?? now,
      availableUntil: wallet.expiresAt ?? latestGrant?.validUntilAt ?? null,
      lastUsedAt: latestLedger?.occurredAt ?? null,
      usageGranted: latestGrant?.quantity ?? null,
      usageRemaining: wallet.balanceQuantity ?? null,
      sourceUpdatedAt: wallet.expiresAt ?? latestGrant.validUntilAt ?? latestGrant.validFromAt ?? now,
      refreshedAt: now,
      projectionVersion: 1,
      snapshot: {
        itemType: 'entitlement_wallet',
        walletId: wallet.id,
        entitlementType: wallet.entitlementType,
        unitCode: wallet.unitCode,
        walletName: wallet.name,
      },
      metadata: {
        source: 'entitlement_wallet',
      },
    })
  }

  if (upserts.length === 0) {
    return { rebuiltCount: 0, rows: [] as Array<Record<string, unknown>> }
  }

  const touchedProjectionKeys = upserts.map((row) => row.projectionKey as string)
  await db.delete(accessLibraryItems).where(
    and(
      eq(accessLibraryItems.bizId, input.bizId),
      input.ownerUserId ? eq(accessLibraryItems.ownerUserId, input.ownerUserId) : undefined,
      input.ownerGroupAccountId ? eq(accessLibraryItems.ownerGroupAccountId, input.ownerGroupAccountId) : undefined,
      inArray(accessLibraryItems.projectionKey, touchedProjectionKeys),
    ),
  )
  const touched = await db
    .insert(accessLibraryItems)
    .values(upserts as Array<typeof accessLibraryItems.$inferInsert>)
    .returning()

  const rows = await db.query.accessLibraryItems.findMany({
    where: and(
      eq(accessLibraryItems.bizId, input.bizId),
      input.ownerUserId ? eq(accessLibraryItems.ownerUserId, input.ownerUserId) : undefined,
      input.ownerGroupAccountId ? eq(accessLibraryItems.ownerGroupAccountId, input.ownerGroupAccountId) : undefined,
      inArray(accessLibraryItems.projectionKey, touchedProjectionKeys),
    ),
    orderBy: [desc(accessLibraryItems.lastUsedAt), desc(accessLibraryItems.availableUntil), asc(accessLibraryItems.projectionKey)],
  })

  return { rebuiltCount: touched.length, rows }
}

customerLibraryRoutes.get('/me/library', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const bizId = c.req.query('bizId')

  let rows = await db.query.accessLibraryItems.findMany({
    where: and(
      bizId ? eq(accessLibraryItems.bizId, bizId) : undefined,
      eq(accessLibraryItems.ownerUserId, user.id),
    ),
    orderBy: [desc(accessLibraryItems.lastUsedAt), desc(accessLibraryItems.availableUntil), asc(accessLibraryItems.projectionKey)],
  })

  if (bizId && rows.length === 0) {
    await rebuildCustomerLibraryForOwner({
      bizId,
      ownerUserId: user.id,
      ownerGroupAccountId: null,
    })
    rows = await db.query.accessLibraryItems.findMany({
      where: and(eq(accessLibraryItems.bizId, bizId), eq(accessLibraryItems.ownerUserId, user.id)),
      orderBy: [desc(accessLibraryItems.lastUsedAt), desc(accessLibraryItems.availableUntil), asc(accessLibraryItems.projectionKey)],
    })
  }

  const bookings = bizId
    ? await db.query.bookingOrders.findMany({
        where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.customerUserId, user.id)),
        orderBy: [desc(bookingOrders.confirmedStartAt), desc(bookingOrders.requestedStartAt)],
      })
    : []

  const artifacts = rows
    .filter((row) => row.accessArtifactId)
    .map((row) => ({
      id: row.accessArtifactId,
      availabilityState: row.availabilityState,
      usageRemaining: row.usageRemaining,
      usageGranted: row.usageGranted,
      availableUntil: row.availableUntil,
      lastUsedAt: row.lastUsedAt,
      projectionKey: row.projectionKey,
      snapshot: row.snapshot,
    }))

  const membershipRows = rows
    .filter((row) => row.membershipId)
    .map((row) => {
      const snapshot = row.snapshot as Record<string, unknown> | null
      return {
        id: row.membershipId,
        membershipPlanId: typeof snapshot?.membershipPlanId === 'string' ? snapshot.membershipPlanId : null,
        status: typeof snapshot?.membershipStatus === 'string' ? snapshot.membershipStatus : row.availabilityState,
        availabilityState: row.availabilityState,
        availableUntil: row.availableUntil,
        lastUsedAt: row.lastUsedAt,
        usageRemaining: row.usageRemaining,
        projectionKey: row.projectionKey,
        snapshot,
      }
    })

  return ok(c, {
    items: rows,
    artifacts,
    memberships: membershipRows,
    bookings,
    counts: {
      items: rows.length,
      artifacts: artifacts.length,
      memberships: membershipRows.length,
      bookings: bookings.length,
    },
  })
})

customerLibraryRoutes.get(
  '/bizes/:bizId/customer-library/items',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('entitlements.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const ownerUserId = c.req.query('ownerUserId') ?? undefined
    const ownerGroupAccountId = c.req.query('ownerGroupAccountId') ?? undefined
    if (!ownerUserId && !ownerGroupAccountId) {
      return fail(c, 'VALIDATION_ERROR', 'ownerUserId or ownerGroupAccountId is required.', 400)
    }
    const rows = await db.query.accessLibraryItems.findMany({
      where: and(
        eq(accessLibraryItems.bizId, bizId),
        ownerUserId ? eq(accessLibraryItems.ownerUserId, ownerUserId) : undefined,
        ownerGroupAccountId ? eq(accessLibraryItems.ownerGroupAccountId, ownerGroupAccountId) : undefined,
      ),
      orderBy: [desc(accessLibraryItems.lastUsedAt), desc(accessLibraryItems.availableUntil), asc(accessLibraryItems.projectionKey)],
    })
    return ok(c, rows)
  },
)

customerLibraryRoutes.post(
  '/bizes/:bizId/customer-library/rebuild',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('entitlements.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const body = (await c.req.json().catch(() => ({}))) as {
      ownerUserId?: string
      ownerGroupAccountId?: string
    }
    if (!body.ownerUserId && !body.ownerGroupAccountId) {
      return fail(c, 'VALIDATION_ERROR', 'ownerUserId or ownerGroupAccountId is required.', 400)
    }
    try {
      const rebuilt = await rebuildCustomerLibraryForOwner({
        bizId,
        ownerUserId: body.ownerUserId ?? null,
        ownerGroupAccountId: body.ownerGroupAccountId ?? null,
      })
      return ok(c, rebuilt, 201)
    } catch (error) {
      if (error instanceof Error && error.message === 'OWNER_REQUIRED') {
        return fail(c, 'VALIDATION_ERROR', 'ownerUserId or ownerGroupAccountId is required.', 400)
      }
      throw error
    }
  },
)
