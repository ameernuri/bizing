import dbPkg from '@bizing/db'
import { sql } from 'drizzle-orm'

const runId = process.argv[2] ?? 'saga_run_3AP54kuhODYiJpJizZzC5HVsx8Y'
const run = await dbPkg.db.execute(sql`select id,saga_key,status,passed_steps,total_steps from saga_runs where id=${runId}`)
console.log('run', run.rows)
const steps = await dbPkg.db.execute(sql`select step_key,status,failure_message from saga_run_steps where run_id=${runId} and status in ('failed','blocked') order by order_index limit 120`)
console.log('bad steps', steps.rows)
process.exit(0)
