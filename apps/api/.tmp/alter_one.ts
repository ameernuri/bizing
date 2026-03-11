import dbPackage from '@bizing/db'
import { sql } from 'drizzle-orm'
const { db } = dbPackage
await db.execute(sql`alter table knowledge_sources add column if not exists created_by varchar(255)`)
console.log('altered')
const rows = await db.execute(sql`select column_name from information_schema.columns where table_schema='public' and table_name='knowledge_sources' and column_name='created_by'`)
console.log(rows.rows)
