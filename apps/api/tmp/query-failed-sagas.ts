import { sql } from 'drizzle-orm'
import dbPackage from '@bizing/db'
const { db } = dbPackage
const rows = await db.execute(sql`
  with latest as (
    select distinct on (saga_key) saga_key, id, status, started_at, ended_at
    from saga_runs
    order by saga_key, started_at desc
  )
  select saga_key, id, status, started_at, ended_at
  from latest
  where status = 'failed'
  order by saga_key
`)
console.log(JSON.stringify(rows.rows, null, 2))
