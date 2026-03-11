import dbPackage from '@bizing/db'
import { desc, eq } from 'drizzle-orm'

const { db, sagaRuns } = dbPackage

const rows = await db.query.sagaRuns.findMany({
  where: eq(sagaRuns.sagaKey, 'uc-19-the-solo-entrepreneur-sarah'),
  orderBy: [desc(sagaRuns.id)],
  limit: 5,
  columns: {
    id: true,
    status: true,
    startedAt: true,
    endedAt: true,
    createdAt: true,
  },
})

console.log(JSON.stringify(rows, null, 2))
