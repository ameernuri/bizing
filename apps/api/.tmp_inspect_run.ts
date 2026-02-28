import { Client } from 'pg'
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
const runId = process.argv[2]
const res = await client.query(`select phase_key, phase_order, step_key, step_order, status, instruction, expected_result, failure_message from saga_run_steps where saga_run_id = $1 order by phase_order, step_order`, [runId])
for (const row of res.rows) console.log(JSON.stringify(row, null, 2))
await client.end()
