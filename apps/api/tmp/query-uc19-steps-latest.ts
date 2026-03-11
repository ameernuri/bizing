import { sql } from 'drizzle-orm'
import dbPackage from '@bizing/db'
const { db } = dbPackage
const rows = await db.execute(sql`
  select step_key, status, started_at, ended_at, failure_message
  from saga_run_steps
  where saga_run_id = (select id from saga_runs where saga_key='uc-19-the-solo-entrepreneur-sarah' order by started_at desc limit 1)
  order by started_at desc nulls last
  limit 12
`)
console.log(JSON.stringify(rows.rows, null, 2))
