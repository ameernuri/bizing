import dbPackage from '@bizing/db'
import { sql } from 'drizzle-orm'
const { db } = dbPackage
const keys = ['uc-20','uc-200','uc-201','uc-202','uc-203','uc-204','uc-205','uc-206','uc-207','uc-208','uc-209','uc-210','uc-212','uc-213','uc-214','uc-215','uc-216','uc-217','uc-218','uc-219','uc-22']
const likeSql = sql.join(keys.map((k) => sql`saga_key like ${`${k}-%`}`), sql` or `)
const query = sql`
with latest as (
  select distinct on (saga_key) id, saga_key, status, created_at
  from saga_runs
  where created_at > now() - interval '2 hours'
    and (${likeSql})
  order by saga_key, created_at desc
)
select l.id, l.saga_key, l.status, s.step_key, s.failure_message
from latest l
join saga_run_steps s on s.saga_run_id = l.id
where l.status = 'failed'
  and s.status in ('failed', 'blocked')
order by l.saga_key, s.step_order
`
const result = await db.execute(query)
console.log(JSON.stringify(result.rows, null, 2))
