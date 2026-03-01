import dbPackage from '@bizing/db'
const rows = await dbPackage.db.query.sagaRuns.findMany({
  orderBy: (table, { desc }) => [desc(table.createdAt)],
  limit: 12,
  columns: { id: true, sagaKey: true, status: true, createdAt: true, passedSteps: true, totalSteps: true },
})
for (const row of rows) console.log(JSON.stringify(row))
await dbPackage.pool.end()
