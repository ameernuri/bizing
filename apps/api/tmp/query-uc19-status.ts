import { sql } from 'drizzle-orm'
import dbPackage from '@bizing/db'
const { db } = dbPackage
const rows = await db.execute(sql`
  select status, started_at, ended_at from saga_runs where id = 'saga_run_3AciPkA7vNaAN7CsEDTqdeYwGjC'
`)
console.log(JSON.stringify(rows.rows, null, 2))
