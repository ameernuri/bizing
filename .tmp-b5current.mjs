import { config } from 'dotenv';
import pg from 'pg';
config({ path: '/Users/ameer/projects/bizing/apps/api/.env' });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const q = `select d.saga_key, r.id as run_id, r.status as run_status, s.step_key,
       s.failure_message,
       s.status as step_status
from saga_definitions d
join saga_runs r on r.saga_definition_id=d.id
join saga_run_steps s on s.saga_run_id=r.id
where d.saga_key = any($1)
and s.status in ('failed','blocked')
and r.created_at = (
  select max(r2.created_at) from saga_runs r2 where r2.saga_definition_id=d.id
)
order by d.saga_key, s.step_order
limit 50`;
const keys = ['uc-20-the-solo-entrepreneur-sarah','uc-200-the-solo-entrepreneur-sarah','uc-201-the-solo-entrepreneur-sarah','uc-202-the-solo-entrepreneur-sarah'];
const { rows } = await pool.query(q, [keys]);
for (const row of rows) console.log(`${row.saga_key}\t${row.run_id}\t${row.run_status}\t${row.step_key}\t${row.step_status}\t${row.failure_message ?? ''}`);
await pool.end();
