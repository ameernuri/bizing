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
    select distinct on (sr.saga_key) sr.saga_key, sr.id, sr.status, sr.started_at, sr.ended_at
    from saga_runs sr
    join keys k on k.saga_key = sr.saga_key
    order by sr.saga_key, sr.started_at desc
  )
  select * from latest order by saga_key
`)
console.log(JSON.stringify(rows.rows, null, 2))
