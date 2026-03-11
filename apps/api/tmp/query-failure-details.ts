import dbPackage from '@bizing/db'
import { desc, eq, inArray } from 'drizzle-orm'

const { db, sagaRuns, sagaRunSteps } = dbPackage
const keys = [
  'uc-102-the-solo-entrepreneur-sarah',
  'uc-40-the-solo-entrepreneur-sarah',
  'uc-40-the-solo-entrepreneur-sarah-medium-pack',
]

for (const sagaKey of keys) {
  const run = await db.query.sagaRuns.findFirst({
    where: eq(sagaRuns.sagaKey, sagaKey),
    orderBy: [desc(sagaRuns.id)],
    columns: { id: true, status: true, createdAt: true },
  })
  if (!run) continue
  const steps = await db.query.sagaRunSteps.findMany({
    where: eq(sagaRunSteps.sagaRunId, run.id),
    orderBy: [sagaRunSteps.phaseOrder, sagaRunSteps.stepOrder],
    columns: {
      stepKey: true,
      status: true,
      failureCode: true,
      failureMessage: true,
      resultPayload: true,
    },
  })
  console.log('\n===', sagaKey, run.status, run.id, '===')
  for (const step of steps.filter((s) => s.status === 'failed' || s.status === 'blocked')) {
    console.log(JSON.stringify(step, null, 2))
  }
}
