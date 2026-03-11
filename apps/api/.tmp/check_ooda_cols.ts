import dbPackage from '@bizing/db'
import { sql } from 'drizzle-orm'

const { db } = dbPackage
const result = await db.execute(sql`
  select table_name, column_name
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('ooda_loops','ooda_loop_links','ooda_loop_entries','ooda_loop_actions')
  order by table_name, ordinal_position
`)
console.log(JSON.stringify(result.rows, null, 2))
