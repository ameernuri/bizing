/**
 * Purge saga-generated runtime data.
 *
 * Purpose:
 * - Remove all saga run sessions/evidence rows.
 * - Remove test business data created by rerun script (`name LIKE 'Saga %'`).
 * - Remove test users created by runner (`email LIKE '%@example.com'`).
 *
 * Why this exists:
 * - v0 design/testing loop needs deterministic clean-room reruns.
 * - We want "fresh run truth" with no leftover side effects.
 */

import { Client } from 'pg'

type RowCount = { rowCount: number | null }
type DeletePlan = { tableName: string; columns: string[] }

function quoteIdent(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values))
}

async function executeDeletePlansWithRetries(
  client: Client,
  plans: DeletePlan[],
  ids: string[],
) {
  const pending = [...plans]
  let rounds = 0

  while (pending.length > 0 && rounds < plans.length * 5) {
    rounds += 1
    let progressed = 0

    for (let index = pending.length - 1; index >= 0; index -= 1) {
      const plan = pending[index]
      const predicates = plan.columns
        .map((column) => `${quoteIdent(column)} = ANY($1::text[])`)
        .join(' OR ')
      const query = `DELETE FROM ${quoteIdent(plan.tableName)} WHERE ${predicates}`
      const savepoint = `sp_delete_${rounds}_${index}`

      try {
        await client.query(`SAVEPOINT ${savepoint}`)
        await client.query(query, [ids])
        await client.query(`RELEASE SAVEPOINT ${savepoint}`)
        pending.splice(index, 1)
        progressed += 1
      } catch (error) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`)
        await client.query(`RELEASE SAVEPOINT ${savepoint}`)
        const code = (error as { code?: string })?.code
        // FK dependencies may require child-first ordering; retry next pass.
        if (code === '23503') continue
        throw error
      }
    }

    if (progressed === 0) {
      const unresolved = pending.map((plan) => plan.tableName)
      throw new Error(
        `Could not resolve delete dependency order for tables: ${unresolved.join(', ')}`,
      )
    }
  }

  if (pending.length > 0) {
    const unresolved = pending.map((plan) => plan.tableName)
    throw new Error(`Delete retry limit reached. Remaining tables: ${unresolved.join(', ')}`)
  }

  return rounds
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required.')
  }

  const client = new Client({ connectionString })
  await client.connect()

  const summary: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
  }

  try {
    await client.query('BEGIN')

    // 1) Clear all run-state tables first.
    await client.query(`
      TRUNCATE TABLE
        saga_run_artifacts,
        saga_run_actor_messages,
        saga_run_actor_profiles,
        saga_run_steps,
        saga_runs
      RESTART IDENTITY CASCADE
    `)
    summary.runStatePurged = true

    // 2) Identify test biz rows created by rerun script.
    const bizRows = await client.query<{ id: string }>(
      `SELECT id FROM bizes WHERE name LIKE 'Saga %'`,
    )
    const sagaBizIds = bizRows.rows.map((row) => row.id)
    summary.sagaBizCount = sagaBizIds.length

    if (sagaBizIds.length > 0) {
      // Delete all rows in tables carrying biz_id or organization_id scope refs.
      const scopedCols = await client.query<{
        table_name: string
        column_name: string
      }>(`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name IN ('biz_id', 'organization_id')
          AND table_name NOT IN ('bizes')
      `)

      const scopedByTable = new Map<string, string[]>()
      for (const row of scopedCols.rows) {
        const list = scopedByTable.get(row.table_name) ?? []
        list.push(row.column_name)
        scopedByTable.set(row.table_name, unique(list))
      }

      const scopedPlans: DeletePlan[] = []
      for (const [tableName, columns] of scopedByTable.entries()) {
        if (columns.length === 0) continue
        scopedPlans.push({ tableName, columns })
      }
      summary.bizScopedTablesTouched = scopedPlans.length
      summary.bizScopeDeleteRounds = await executeDeletePlansWithRetries(
        client,
        scopedPlans,
        sagaBizIds,
      )

      const deletedBizes = (await client.query(
        `DELETE FROM bizes WHERE id = ANY($1::text[])`,
        [sagaBizIds],
      )) as RowCount
      summary.deletedBizes = deletedBizes.rowCount ?? 0
    } else {
      summary.bizScopedTablesTouched = 0
      summary.deletedBizes = 0
    }

    // 3) Purge runner-generated users and user-linked rows.
    const userRows = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE email LIKE '%@example.com'`,
    )
    const testUserIds = userRows.rows.map((row) => row.id)
    summary.testUserCount = testUserIds.length

    if (testUserIds.length > 0) {
      const userCols = await client.query<{
        table_name: string
        column_name: string
      }>(`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (
            column_name = 'user_id'
            OR column_name LIKE '%_user_id'
            OR column_name IN ('created_by', 'updated_by', 'deleted_by')
          )
          AND table_name NOT IN (
            'users',
            'saga_definitions',
            'saga_definition_revisions',
            'saga_use_cases',
            'saga_use_case_versions',
            'saga_personas',
            'saga_persona_versions',
            'saga_definition_links',
            'saga_coverage_reports',
            'saga_coverage_items',
            'saga_tags',
            'saga_tag_bindings'
          )
      `)

      const userByTable = new Map<string, string[]>()
      for (const row of userCols.rows) {
        const list = userByTable.get(row.table_name) ?? []
        list.push(row.column_name)
        userByTable.set(row.table_name, unique(list))
      }

      const userPlans: DeletePlan[] = []
      for (const [tableName, columns] of userByTable.entries()) {
        if (columns.length === 0) continue
        userPlans.push({ tableName, columns })
      }
      summary.userLinkedTablesTouched = userPlans.length
      summary.userScopeDeleteRounds = await executeDeletePlansWithRetries(
        client,
        userPlans,
        testUserIds,
      )

      /**
       * Do not hard-delete users here:
       * - user table is referenced by many audit FK columns across the schema.
       * - hard delete becomes slow/high-risk during iterative test loops.
       *
       * We soft-delete and deactivate test identities instead.
       */
      const softDeletedUsers = (await client.query(
        `
        UPDATE users
        SET
          deleted_at = now(),
          email = CONCAT('purged+', id, '@invalid.local'),
          updated_at = now()
        WHERE id = ANY($1::text[])
          AND deleted_at IS NULL
      `,
        [testUserIds],
      )) as RowCount
      summary.softDeletedUsers = softDeletedUsers.rowCount ?? 0
    } else {
      summary.userLinkedTablesTouched = 0
      summary.softDeletedUsers = 0
    }

    await client.query('COMMIT')
    summary.completedAt = new Date().toISOString()
    console.log(JSON.stringify(summary, null, 2))
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

void main().catch((error) => {
  console.error('[purge-saga-generated-data] failed')
  console.error(error)
  process.exit(1)
})
