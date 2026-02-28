import dbPackage from '@bizing/db'
const runs = await dbPackage.db.query.sagaRuns.findMany({
  orderBy: (table, { desc }) => [desc(table.createdAt)],
  limit: 12,
  columns: { id: true, sagaKey: true, status: true },
})
for (const run of runs) {
  const steps = await dbPackage.db.query.sagaRunSteps.findMany({
    where: (table, helpers) => helpers.and(helpers.eq(table.sagaRunId, run.id), helpers.inArray(table.status, ['failed','blocked'])),
    columns: { stepKey: true, status: true, instruction: true, failureMessage: true },
  })
  if (steps.length > 0) {
    console.log('RUN', run.id, run.sagaKey, run.status)
    for (const step of steps) console.log(JSON.stringify(step))
  }
}
await dbPackage.pool.end()
