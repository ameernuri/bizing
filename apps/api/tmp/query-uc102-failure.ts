import dbPackage from '@bizing/db'
import { desc, eq } from 'drizzle-orm'

const { db, sagaRuns, sagaRunSteps } = dbPackage
const run = await db.query.sagaRuns.findFirst({
  where: eq(sagaRuns.sagaKey, 'uc-102-the-solo-entrepreneur-sarah'),
  orderBy: [desc(sagaRuns.id)],
  columns: { id: true, status: true },
})
if (!run) throw new Error('run missing')
const step = await db.query.sagaRunSteps.findFirst({
  where: eq(sagaRunSteps.sagaRunId, run.id),
  columns: { stepKey: true, status: true, failureMessage: true, resultPayload: true },
})
const steps = await db.query.sagaRunSteps.findMany({
  where: eq(sagaRunSteps.sagaRunId, run.id),
  columns: { stepKey: true, status: true, failureMessage: true, resultPayload: true },
})
console.log(JSON.stringify(steps.filter((s) => s.status === 'failed' || s.status === 'blocked'), null, 2))
