import { Client } from 'pg'
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
const q1 = await client.query(`
select rs.saga_key, st.step_key, st.status, coalesce(st.failure_message,'') as failure_message
from saga_run_steps st
join saga_runs rs on rs.id = st.saga_run_id
where rs.saga_key in ('uc-201-the-solo-entrepreneur-sarah','uc-204-the-solo-entrepreneur-sarah','uc-205-the-solo-entrepreneur-sarah','uc-206-the-solo-entrepreneur-sarah')
  and rs.created_at >= now() - interval '30 minutes'
  and st.status in ('failed','blocked')
order by rs.created_at desc, rs.saga_key
`)
console.log(JSON.stringify(q1.rows, null, 2))
await client.end()
