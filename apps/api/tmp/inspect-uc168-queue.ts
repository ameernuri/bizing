import { and, eq } from 'drizzle-orm'
import dbPackage from '@bizing/db'
const { db, queueEntries } = dbPackage
const bizId = '3AceR3fVmCaZ2HhOlJGDbYGhd0T'
const queueId = 'queue_3AceSb80g1kEyCvNPBqrbkYQcSg'
const entries = await db.query.queueEntries.findMany({ where: and(eq(queueEntries.bizId, bizId), eq(queueEntries.queueId, queueId)) })
console.log(JSON.stringify(entries, null, 2))
