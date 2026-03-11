import dbPackage from '@bizing/db'
import { sql } from 'drizzle-orm'

const { db } = dbPackage
const rows = await db.execute(sql`
  select table_name,
         max(case when column_name='created_by' then 1 else 0 end) as has_created_by
  from information_schema.columns
  where table_schema='public' and (table_name like 'auth_%' or table_name in ('users','accounts','sessions','verifications','members','invitations','organizations','api_credentials','api_tokens','auth_events','auth_principals','auth_machine_sessions'))
  group by table_name
  order by table_name
`)
console.log(JSON.stringify(rows.rows, null, 2))
