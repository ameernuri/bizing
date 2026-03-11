import { and, eq } from 'drizzle-orm'
import dbPackage from '@bizing/db'
const { db, queues, queueEntries } = dbPackage
const bizId = '3AcezIufaw0iyI9SdBtzQwc9Mmo'
const queueId = 'queue_3Acf0wzwj817o7x02KYU2vGZK9m'
const queue = await db.query.queues.findFirst({ where: and(eq(queues.bizId, bizId), eq(queues.id, queueId)) })
const entries = await db.query.queueEntries.findMany({ where: and(eq(queueEntries.bizId, bizId), eq(queueEntries.queueId, queueId)) })
console.log(JSON.stringify({ queue, entries }, null, 2))
