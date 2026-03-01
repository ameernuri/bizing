import { Client } from 'pg';
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const keys = [
  'uc-221-the-solo-entrepreneur-sarah',
  'uc-223-the-solo-entrepreneur-sarah',
  'uc-224-the-solo-entrepreneur-sarah',
  'uc-225-the-solo-entrepreneur-sarah',
  'uc-226-the-solo-entrepreneur-sarah',
  'uc-227-the-solo-entrepreneur-sarah',
  'uc-228-the-solo-entrepreneur-sarah',
  'uc-229-the-solo-entrepreneur-sarah',
  'uc-230-the-solo-entrepreneur-sarah',
  'uc-23-the-franchisee-priya',
];
const q = `
select sd.saga_key, sr.id as run_id, srs.step_key, srs.status, srs.step_order,
       coalesce(srs.failure_message,'') as failure_message,
       left(coalesce(srs.instruction,''), 180) as instruction
from saga_runs sr
join saga_definitions sd on sd.id = sr.saga_definition_id
join saga_run_steps srs on srs.saga_run_id = sr.id
where sd.saga_key = any($1)
  and sr.created_at = (
    select max(sr2.created_at)
    from saga_runs sr2
    where sr2.saga_definition_id = sr.saga_definition_id
  )
  and srs.status in ('failed','blocked')
order by sd.saga_key, srs.step_order;
`;
const r = await client.query(q, [keys]);
console.log(JSON.stringify(r.rows, null, 2));
await client.end();
