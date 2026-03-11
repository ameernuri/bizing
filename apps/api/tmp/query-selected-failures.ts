import { sql } from 'drizzle-orm'
import dbPackage from '@bizing/db'
const { db } = dbPackage
const rows = await db.execute(sql`
  with keys(saga_key) as (
    values
      ('uc-168-the-front-desk-manager-lisa'),
      ('uc-176-the-solo-entrepreneur-sarah'),
      ('uc-177-the-solo-entrepreneur-sarah'),
      ('uc-19-the-solo-entrepreneur-sarah'),
      ('uc-2-the-solo-entrepreneur-sarah'),
      ('uc-20-the-solo-entrepreneur-sarah')
  ), latest as (
    select distinct on (sr.saga_key) sr.saga_key, sr.id, sr.status, sr.started_at
    from saga_runs sr
    join keys k on k.saga_key = sr.saga_key
    order by sr.saga_key, sr.started_at desc
  )
  select l.saga_key, srs.step_key, srs.failure_message
  from latest l
  join saga_run_steps srs on srs.saga_run_id = l.id
  where l.status = 'failed'
    and srs.failure_message is not null
  order by l.saga_key, srs.started_at asc nulls last
`)
console.log(JSON.stringify(rows.rows, null, 2))
