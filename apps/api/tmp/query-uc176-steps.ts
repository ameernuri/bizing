import { sql } from 'drizzle-orm'
import dbPackage from '@bizing/db'
const { db } = dbPackage
const rows = await db.execute(sql`
  select step_key, status, started_at, ended_at, failure_message
  from saga_run_steps
  where saga_run_id = 'saga_run_3AciHyyMzhpv9qZkUHuNQMVjFe6'
  order by started_at desc nulls last
  limit 8
`)
console.log(JSON.stringify(rows.rows, null, 2))
