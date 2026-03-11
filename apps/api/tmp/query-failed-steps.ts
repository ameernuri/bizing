import { sql } from 'drizzle-orm'
import dbPackage from '@bizing/db'
const { db } = dbPackage
const rows = await db.execute(sql`
  select sr.saga_key, srs.step_key, srs.failure_message
  from saga_runs sr
  join saga_run_steps srs on srs.saga_run_id = sr.id
  where sr.status = 'failed'
    and sr.started_at > now() - interval '45 minutes'
    and srs.failure_message is not null
  order by sr.started_at desc, srs.started_at asc nulls last
`)
console.log(JSON.stringify(rows.rows, null, 2))
