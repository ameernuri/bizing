import { sql } from 'drizzle-orm'
import dbPackage from '@bizing/db'
const { db } = dbPackage
const rows = await db.execute(sql`
  with latest as (
    select distinct on (saga_key) saga_key, id, status, started_at
    from saga_runs
    where started_at > now() - interval '45 minutes'
    order by saga_key, started_at desc
  )
  select l.saga_key, srs.step_key, srs.failure_message
  from latest l
  join saga_run_steps srs on srs.saga_run_id = l.id
  where l.status = 'failed'
    and srs.failure_message is not null
  order by l.saga_key asc, srs.started_at asc nulls last
`)
console.log(JSON.stringify(rows.rows, null, 2))
