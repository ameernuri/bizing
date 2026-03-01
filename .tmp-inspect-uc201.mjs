import { Client } from 'pg'
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
const run = await client.query(`select id, saga_key, status, created_at from saga_runs where saga_key = 'uc-201-the-solo-entrepreneur-sarah' order by created_at desc limit 1`)
console.log('RUN', JSON.stringify(run.rows[0], null, 2))
if (run.rows[0]) {
  const steps = await client.query(`select step_key, status, coalesce(failure_message,'') as failure_message from saga_run_steps where saga_run_id = $1 and status in ('failed','blocked') order by step_key`, [run.rows[0].id])
  console.log(JSON.stringify(steps.rows, null, 2))
}
await client.end()
