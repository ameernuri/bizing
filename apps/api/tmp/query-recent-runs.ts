import { sql } from 'drizzle-orm'
import dbPackage from '@bizing/db'
const { db } = dbPackage
const rows = await db.execute(sql`
  select saga_key, id, status, started_at, ended_at
  from saga_runs
  where started_at > now() - interval '45 minutes'
  order by started_at desc
  limit 80
`)
console.log(JSON.stringify(rows.rows, null, 2))
