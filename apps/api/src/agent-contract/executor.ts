import { randomUUID } from 'node:crypto'
import { type PoolClient } from 'pg'
import dbPackage from '@bizing/db'
import {
  type AgentCommand,
  type AgentRequestScope,
  type CommandFilter,
  type ExecutionTraceStep,
  type MutateCommand,
  type PseudoApiResponse,
  type QueryCommand,
  pseudoApiRequestSchema,
} from './types.js'
import {
  type CatalogTable,
  getSchemaCatalog,
  quoteIdentifier,
  resolveColumnName,
  resolveTableName,
} from './schema-catalog.js'

const { pool } = dbPackage

function resolveCatalogTable(rawTableName: string): CatalogTable {
  const catalog = getSchemaCatalog()
  const resolvedTableName = resolveTableName(rawTableName, catalog) ?? rawTableName
  const table = catalog.tables.get(resolvedTableName)
  if (!table) {
    throw new Error(`Unknown table: ${rawTableName}`)
  }
  return table
}

function normalizeColumns(table: CatalogTable, columns: string[] | undefined): string[] {
  if (!columns || columns.length === 0) {
    return table.columns.map((column) => column.name)
  }

  return columns.map((column) => {
    const resolved = resolveColumnName(table.name, column)
    if (!resolved) {
      throw new Error(`Unknown column \"${column}\" for table \"${table.name}\"`)
    }
    return resolved
  })
}

function withScopedFilters(
  table: CatalogTable,
  filters: CommandFilter[],
  scope: AgentRequestScope,
): CommandFilter[] {
  if (!table.hasBizId) {
    return filters
  }

  if (!scope.bizId) {
    throw new Error(
      `Table \"${table.name}\" is tenant-scoped and requires scope.bizId in pseudo request.`,
    )
  }

  const scopedFilters = [...filters]
  const existingBizFilter = scopedFilters.find((filter) => filter.column === 'biz_id')

  if (existingBizFilter) {
    if (existingBizFilter.op !== 'eq' || existingBizFilter.value !== scope.bizId) {
      throw new Error(
        `Tenant scope mismatch: command uses biz_id filter that does not match scope.bizId.`,
      )
    }
    return scopedFilters
  }

  scopedFilters.push({
    column: 'biz_id',
    op: 'eq',
    value: scope.bizId,
  })

  return scopedFilters
}

function compileFilters(
  table: CatalogTable,
  filters: CommandFilter[],
  params: unknown[],
): string {
  if (filters.length === 0) {
    return ''
  }

  const clauses: string[] = []

  for (const filter of filters) {
    const resolvedColumn = resolveColumnName(table.name, filter.column)
    if (!resolvedColumn) {
      throw new Error(`Unknown filter column \"${filter.column}\" for table \"${table.name}\"`)
    }

    const columnSql = quoteIdentifier(resolvedColumn)

    switch (filter.op) {
      case 'is_null': {
        clauses.push(`${columnSql} IS NULL`)
        break
      }
      case 'not_null': {
        clauses.push(`${columnSql} IS NOT NULL`)
        break
      }
      case 'in': {
        if (!Array.isArray(filter.value)) {
          throw new Error(`IN operator requires array value for column \"${resolvedColumn}\"`)
        }
        if (filter.value.length === 0) {
          // Empty IN list is always false.
          clauses.push('1 = 0')
          break
        }

        const placeholders = filter.value.map((value) => {
          params.push(value)
          return `$${params.length}`
        })
        clauses.push(`${columnSql} IN (${placeholders.join(', ')})`)
        break
      }
      default: {
        const opMap: Record<string, string> = {
          eq: '=',
          neq: '!=',
          gt: '>',
          gte: '>=',
          lt: '<',
          lte: '<=',
          like: 'LIKE',
          ilike: 'ILIKE',
        }

        if (!(filter.op in opMap)) {
          throw new Error(`Unsupported filter operator: ${filter.op}`)
        }

        if (filter.value === undefined) {
          throw new Error(
            `Operator \"${filter.op}\" requires value for column \"${resolvedColumn}\"`,
          )
        }

        if (filter.value === null && filter.op === 'eq') {
          clauses.push(`${columnSql} IS NULL`)
          break
        }

        if (filter.value === null && filter.op === 'neq') {
          clauses.push(`${columnSql} IS NOT NULL`)
          break
        }

        params.push(filter.value)
        clauses.push(`${columnSql} ${opMap[filter.op]} $${params.length}`)
      }
    }
  }

  return `WHERE ${clauses.join(' AND ')}`
}

function compileQuerySql(
  command: QueryCommand,
  scope: AgentRequestScope,
): { sql: string; params: unknown[]; table: string } {
  const table = resolveCatalogTable(command.table)
  const selectedColumns = normalizeColumns(table, command.select)
  const filters = withScopedFilters(table, command.filters, scope)

  const params: unknown[] = []
  const whereSql = compileFilters(table, filters, params)

  const sortSql =
    command.sort.length > 0
      ? `ORDER BY ${command.sort
          .map((entry) => {
            const resolved = resolveColumnName(table.name, entry.column)
            if (!resolved) {
              throw new Error(
                `Unknown sort column \"${entry.column}\" for table \"${table.name}\"`,
              )
            }
            return `${quoteIdentifier(resolved)} ${entry.direction.toUpperCase()}`
          })
          .join(', ')}`
      : ''

  const safeLimit = command.limit ?? 100
  const safeOffset = command.offset ?? 0

  const selectSql = selectedColumns.map((column) => quoteIdentifier(column)).join(', ')
  const sql = [
    `SELECT ${selectSql}`,
    `FROM ${quoteIdentifier(table.name)}`,
    whereSql,
    sortSql,
    `LIMIT ${safeLimit}`,
    safeOffset > 0 ? `OFFSET ${safeOffset}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return {
    sql,
    params,
    table: table.name,
  }
}

function withScopedValues(
  table: CatalogTable,
  values: Record<string, unknown>,
  scope: AgentRequestScope,
): Record<string, unknown> {
  if (!table.hasBizId) {
    return values
  }

  if (!scope.bizId) {
    throw new Error(
      `Table \"${table.name}\" is tenant-scoped and requires scope.bizId in pseudo request.`,
    )
  }

  const nextValues = { ...values }
  if (nextValues.biz_id == null) {
    nextValues.biz_id = scope.bizId
  } else if (nextValues.biz_id !== scope.bizId) {
    throw new Error('Insert/update values include biz_id that mismatches scope.bizId.')
  }

  return nextValues
}

function compileMutateSql(
  command: MutateCommand,
  scope: AgentRequestScope,
): { sql: string; params: unknown[]; table: string } {
  const table = resolveCatalogTable(command.table)

  if (command.action === 'insert') {
    const providedValues = command.values ?? {}
    const scopedValues = withScopedValues(table, providedValues, scope)
    const entries = Object.entries(scopedValues)

    if (entries.length === 0) {
      throw new Error('Insert command requires at least one value.')
    }

    const columns: string[] = []
    const placeholders: string[] = []
    const params: unknown[] = []

    for (const [rawColumn, value] of entries) {
      const resolved = resolveColumnName(table.name, rawColumn)
      if (!resolved) {
        throw new Error(`Unknown insert column \"${rawColumn}\" for table \"${table.name}\"`)
      }
      columns.push(quoteIdentifier(resolved))
      params.push(value)
      placeholders.push(`$${params.length}`)
    }

    const returningColumns = normalizeColumns(table, command.returning ?? table.primaryKeys)

    const sql = [
      `INSERT INTO ${quoteIdentifier(table.name)} (${columns.join(', ')})`,
      `VALUES (${placeholders.join(', ')})`,
      returningColumns.length > 0
        ? `RETURNING ${returningColumns.map((column) => quoteIdentifier(column)).join(', ')}`
        : '',
    ]
      .filter(Boolean)
      .join(' ')

    return {
      sql,
      params,
      table: table.name,
    }
  }

  if (command.action === 'update') {
    const providedValues = command.values ?? {}
    const scopedValues = withScopedValues(table, providedValues, scope)
    const entries = Object.entries(scopedValues)

    if (entries.length === 0) {
      throw new Error('Update command requires at least one value.')
    }

    const params: unknown[] = []
    const setClauses = entries.map(([rawColumn, value]) => {
      const resolved = resolveColumnName(table.name, rawColumn)
      if (!resolved) {
        throw new Error(`Unknown update column \"${rawColumn}\" for table \"${table.name}\"`)
      }
      params.push(value)
      return `${quoteIdentifier(resolved)} = $${params.length}`
    })

    const scopedFilters = withScopedFilters(table, command.filters, scope)
    if (scopedFilters.length === 0) {
      throw new Error('Unsafe update blocked: mutation requires at least one filter condition.')
    }

    const whereSql = compileFilters(table, scopedFilters, params)
    const returningColumns = normalizeColumns(table, command.returning ?? table.primaryKeys)

    const sql = [
      `UPDATE ${quoteIdentifier(table.name)}`,
      `SET ${setClauses.join(', ')}`,
      whereSql,
      returningColumns.length > 0
        ? `RETURNING ${returningColumns.map((column) => quoteIdentifier(column)).join(', ')}`
        : '',
    ]
      .filter(Boolean)
      .join(' ')

    return {
      sql,
      params,
      table: table.name,
    }
  }

  // Delete branch.
  const params: unknown[] = []
  const scopedFilters = withScopedFilters(table, command.filters, scope)
  if (scopedFilters.length === 0) {
    throw new Error('Unsafe delete blocked: mutation requires at least one filter condition.')
  }

  const whereSql = compileFilters(table, scopedFilters, params)
  const returningColumns = normalizeColumns(table, command.returning ?? table.primaryKeys)

  const sql = [
    `DELETE FROM ${quoteIdentifier(table.name)}`,
    whereSql,
    returningColumns.length > 0
      ? `RETURNING ${returningColumns.map((column) => quoteIdentifier(column)).join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join(' ')

  return {
    sql,
    params,
    table: table.name,
  }
}

async function executeSingleCommand(
  client: PoolClient,
  command: Extract<AgentCommand, { kind: 'query' | 'mutate' }>,
  scope: AgentRequestScope,
  dryRun: boolean,
  trace: ExecutionTraceStep[],
  stepIndex: number,
): Promise<unknown> {
  const compiled =
    command.kind === 'query' ? compileQuerySql(command, scope) : compileMutateSql(command, scope)

  const result = await client.query(compiled.sql, compiled.params)

  trace.push({
    stepIndex,
    kind: command.kind,
    table: compiled.table,
    sqlPreview: compiled.sql,
    params: compiled.params,
    rowCount: result.rowCount ?? 0,
    dryRun,
  })

  if (command.kind === 'query') {
    return {
      table: compiled.table,
      rowCount: result.rowCount ?? result.rows.length,
      rows: result.rows,
    }
  }

  return {
    table: compiled.table,
    action: command.action,
    rowCount: result.rowCount ?? 0,
    rows: result.rows,
  }
}

async function executeCommandRecursive(
  client: PoolClient,
  command: AgentCommand,
  scope: AgentRequestScope,
  dryRun: boolean,
  trace: ExecutionTraceStep[],
  stepCounter: { value: number },
): Promise<unknown> {
  if (command.kind === 'batch') {
    const stepResults: unknown[] = []
    for (const step of command.steps) {
      stepResults.push(
        await executeCommandRecursive(client, step, scope, dryRun, trace, stepCounter),
      )
    }
    return {
      kind: 'batch',
      steps: stepResults,
    }
  }

  const currentStep = stepCounter.value
  stepCounter.value += 1

  return executeSingleCommand(client, command, scope, dryRun, trace, currentStep)
}

/**
 * Executes one pseudo API request against the real schema.
 *
 * Important behavior:
 * - `dryRun: true` executes inside a transaction and rolls back at the end.
 * - `dryRun: false` commits writes.
 *
 * This gives us production-like validation while keeping schema tests safe.
 */
export async function executePseudoApiRequest(rawInput: unknown): Promise<PseudoApiResponse> {
  const parsed = pseudoApiRequestSchema.parse(rawInput)
  const requestId = parsed.requestId ?? randomUUID()

  const trace: ExecutionTraceStep[] = []
  const warnings: string[] = []

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const result = await executeCommandRecursive(
      client,
      parsed.command,
      parsed.scope,
      parsed.dryRun,
      trace,
      { value: 0 },
    )

    if (parsed.dryRun) {
      await client.query('ROLLBACK')
      warnings.push('Request executed in dry-run mode; all writes were rolled back.')
    } else {
      await client.query('COMMIT')
    }

    return {
      requestId,
      dryRun: parsed.dryRun,
      success: true,
      commandKind: parsed.command.kind,
      warnings,
      trace,
      result,
    }
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // Ignore rollback failures and surface original error.
    }

    return {
      requestId,
      dryRun: parsed.dryRun,
      success: false,
      commandKind: parsed.command.kind,
      warnings,
      trace,
      result: null,
      error: {
        message: error instanceof Error ? error.message : 'unknown_execution_error',
      },
    }
  } finally {
    client.release()
  }
}

/**
 * Executes one pseudo request inside an already-open SQL transaction.
 *
 * Important:
 * - This helper does NOT BEGIN/COMMIT/ROLLBACK the outer transaction.
 * - It is intended for higher-level batch runners that need scenario-step
 *   state to persist across multiple requests.
 */
export async function executePseudoApiRequestInOpenTransaction(
  rawInput: unknown,
  client: PoolClient,
): Promise<PseudoApiResponse> {
  const parsed = pseudoApiRequestSchema.parse(rawInput)
  const requestId = parsed.requestId ?? randomUUID()

  const trace: ExecutionTraceStep[] = []
  const warnings: string[] = []

  try {
    const result = await executeCommandRecursive(
      client,
      parsed.command,
      parsed.scope,
      false,
      trace,
      { value: 0 },
    )

    return {
      requestId,
      dryRun: false,
      success: true,
      commandKind: parsed.command.kind,
      warnings,
      trace,
      result,
    }
  } catch (error) {
    return {
      requestId,
      dryRun: false,
      success: false,
      commandKind: parsed.command.kind,
      warnings,
      trace,
      result: null,
      error: {
        message: error instanceof Error ? error.message : 'unknown_execution_error',
      },
    }
  }
}
