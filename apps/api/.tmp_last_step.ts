import { Client } from 'pg'
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
const runId = process.argv[2]
const stepKey = process.argv[3]
const res = await client.query(`select result_payload from saga_run_steps where saga_run_id=$1 and step_key=$2`, [runId, stepKey])
console.log(JSON.stringify(res.rows[0]?.result_payload ?? null, null, 2))
await client.end()
