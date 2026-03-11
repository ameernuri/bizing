import dbPackage from '@bizing/db'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'

const { db, sagaRuns } = dbPackage

const latest = db.$with('latest').as(
  db.select({
    sagaKey: sagaRuns.sagaKey,
    maxId: sql<number>`max(${sagaRuns.id})`.mapWith(Number).as('max_id'),
  })
    .from(sagaRuns)
    .groupBy(sagaRuns.sagaKey),
)

const rows = await db
  .with(latest)
  .select({
    sagaKey: sagaRuns.sagaKey,
    id: sagaRuns.id,
    status: sagaRuns.status,
    startedAt: sagaRuns.startedAt,
    endedAt: sagaRuns.endedAt,
    createdAt: sagaRuns.createdAt,
  })
  .from(sagaRuns)
  .innerJoin(latest, and(eq(sagaRuns.sagaKey, latest.sagaKey), eq(sagaRuns.id, latest.maxId)))
  .where(inArray(sagaRuns.status, ['failed', 'running']))
  .orderBy(desc(sagaRuns.id))

console.log(JSON.stringify(rows, null, 2))
