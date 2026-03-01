import { Client } from 'pg'
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
const res = await client.query(`
  select r.saga_key, s.step_key, s.status, s.failure_message
  from saga_runs r
  join saga_run_steps s on s.saga_run_id = r.id
  where r.saga_key in ('uc-200-the-solo-entrepreneur-sarah','uc-201-the-solo-entrepreneur-sarah')
    and r.created_at = (
      select max(r2.created_at) from saga_runs r2 where r2.saga_key = r.saga_key
    )
    and s.status in ('failed','blocked')
  order by r.saga_key, s.step_key
`)
console.log(JSON.stringify(res.rows, null, 2))
await client.end()
