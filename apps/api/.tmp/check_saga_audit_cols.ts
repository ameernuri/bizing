import dbPackage from '@bizing/db'
import { sql } from 'drizzle-orm'

const { db } = dbPackage
const rows = await db.execute(sql`
  select table_name,
         max(case when column_name='created_by' then 1 else 0 end) as has_created_by,
         max(case when column_name='updated_by' then 1 else 0 end) as has_updated_by,
         max(case when column_name='deleted_by' then 1 else 0 end) as has_deleted_by,
         max(case when column_name='created_by_user_id' then 1 else 0 end) as has_created_by_user_id,
         max(case when column_name='updated_by_user_id' then 1 else 0 end) as has_updated_by_user_id,
         max(case when column_name='deleted_by_user_id' then 1 else 0 end) as has_deleted_by_user_id
  from information_schema.columns
  where table_schema='public' and table_name like 'saga_%'
  group by table_name
  order by table_name
`)
console.log(JSON.stringify(rows.rows, null, 2))
