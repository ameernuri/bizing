import dbPackage from '@bizing/db'
import { getTableConfig } from 'drizzle-orm/pg-core'

/**
 * Column metadata used by the pseudo API compiler.
 */
export type CatalogColumn = {
  name: string
  sqlType: string
  notNull: boolean
  primaryKey: boolean
}

/**
 * Table metadata used by translator + executor.
 */
export type CatalogTable = {
  name: string
  columns: CatalogColumn[]
  columnSet: Set<string>
  primaryKeys: string[]
  hasBizId: boolean
}

/**
 * Full schema catalog surfaced to the agent-contract layer.
 *
 * ELI5:
 * This is our runtime dictionary of what tables/columns exist. It lets us keep
 * request translation and SQL compilation safe without hardcoding table lists.
 */
export type SchemaCatalog = {
  generatedAt: string
  tables: Map<string, CatalogTable>
  aliases: Map<string, string>
  summary: {
    tableCount: number
    columnCount: number
  }
}

let cachedCatalog: SchemaCatalog | null = null

function normalizeKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function normalizeDbIdentifier(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

function toSingular(name: string): string {
  if (name.endsWith('ies') && name.length > 3) {
    return `${name.slice(0, -3)}y`
  }
  if (name.endsWith('s') && name.length > 1) {
    return name.slice(0, -1)
  }
  return name
}

function addAlias(aliases: Map<string, string>, alias: string, tableName: string) {
  const normalized = normalizeKey(alias)
  if (!normalized) return
  if (!aliases.has(normalized)) {
    aliases.set(normalized, tableName)
  }
}

/**
 * Builds or returns a cached introspection catalog for the active Drizzle schema.
 */
export function getSchemaCatalog(forceRefresh = false): SchemaCatalog {
  if (cachedCatalog && !forceRefresh) {
    return cachedCatalog
  }

  const { db } = dbPackage
  const fullSchema =
    ((db as unknown as { _: { fullSchema?: Record<string, unknown> } })._?.fullSchema ??
      {}) as Record<string, unknown>

  const tables = new Map<string, CatalogTable>()
  const aliases = new Map<string, string>()

  for (const maybeTable of Object.values(fullSchema)) {
    let config: ReturnType<typeof getTableConfig>
    try {
      config = getTableConfig(maybeTable as never)
    } catch {
      continue
    }

    if (!config?.name || tables.has(config.name)) {
      continue
    }

    const columns: CatalogColumn[] = config.columns.map((column) => ({
      name: column.name,
      sqlType:
        typeof column.getSQLType === 'function'
          ? column.getSQLType()
          : String(column.columnType),
      notNull: Boolean(column.notNull),
      primaryKey: Boolean(column.primary),
    }))

    const columnSet = new Set(columns.map((column) => column.name))
    const primaryKeys = columns.filter((column) => column.primaryKey).map((column) => column.name)

    tables.set(config.name, {
      name: config.name,
      columns,
      columnSet,
      primaryKeys,
      hasBizId: columnSet.has('biz_id'),
    })

    // Alias set intentionally supports common natural-language naming variants.
    addAlias(aliases, config.name, config.name)
    addAlias(aliases, config.name.replace(/_/g, ' '), config.name)

    const singular = toSingular(config.name)
    addAlias(aliases, singular, config.name)
    addAlias(aliases, singular.replace(/_/g, ' '), config.name)

    const noUnderscore = config.name.replace(/_/g, '')
    addAlias(aliases, noUnderscore, config.name)
  }

  const columnCount = Array.from(tables.values()).reduce(
    (sum, table) => sum + table.columns.length,
    0,
  )

  cachedCatalog = {
    generatedAt: new Date().toISOString(),
    tables,
    aliases,
    summary: {
      tableCount: tables.size,
      columnCount,
    },
  }

  return cachedCatalog
}

/**
 * Resolves a table alias (human or machine format) into a canonical table name.
 */
export function resolveTableName(input: string, catalog = getSchemaCatalog()): string | null {
  const normalizedInput = normalizeKey(input)
  if (!normalizedInput) return null

  const direct = catalog.aliases.get(normalizedInput)
  if (direct) return direct

  const normalizedDb = normalizeDbIdentifier(input)
  const fromDb = catalog.aliases.get(normalizeKey(normalizedDb))
  if (fromDb) return fromDb

  return null
}

/**
 * Returns best candidate tables mentioned in free-form text.
 */
export function detectTablesInText(
  text: string,
  limit = 5,
  catalog = getSchemaCatalog(),
): string[] {
  const haystack = ` ${normalizeKey(text)} `
  const scored = new Map<string, number>()

  for (const [alias, tableName] of catalog.aliases.entries()) {
    if (!alias) continue

    // Word-boundary-ish matching on normalized text.
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i')
    if (!regex.test(haystack)) continue

    const score = alias.length
    const current = scored.get(tableName) ?? 0
    if (score > current) {
      scored.set(tableName, score)
    }
  }

  return Array.from(scored.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tableName]) => tableName)
}

/**
 * Resolves a column in tolerant way (snake_case/camelCase/space variants).
 */
export function resolveColumnName(
  tableName: string,
  inputColumn: string,
  catalog = getSchemaCatalog(),
): string | null {
  const table = catalog.tables.get(tableName)
  if (!table) return null

  const direct = normalizeDbIdentifier(inputColumn)
  if (table.columnSet.has(direct)) {
    return direct
  }

  const spaceToUnderscore = inputColumn.toLowerCase().replace(/\s+/g, '_')
  if (table.columnSet.has(spaceToUnderscore)) {
    return spaceToUnderscore
  }

  const camelToSnake = inputColumn
    .replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
    .replace(/^_/, '')
    .toLowerCase()
  if (table.columnSet.has(camelToSnake)) {
    return camelToSnake
  }

  return null
}

/**
 * SQL identifier safety check.
 *
 * The pseudo API only allows simple lowercase snake_case identifiers. This is
 * a deliberate hard boundary to avoid SQL injection through table/column names.
 */
export function assertSafeIdentifier(identifier: string): void {
  if (!/^[a-z][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`)
  }
}

/**
 * Safe identifier quote helper for SQL compilers.
 */
export function quoteIdentifier(identifier: string): string {
  assertSafeIdentifier(identifier)
  return `"${identifier}"`
}

/**
 * Utility for admin tools/routes that need compact catalog snapshots.
 */
export function serializeCatalog(catalog = getSchemaCatalog()) {
  const tables = Array.from(catalog.tables.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((table) => ({
      name: table.name,
      hasBizId: table.hasBizId,
      primaryKeys: table.primaryKeys,
      columns: table.columns,
    }))

  return {
    generatedAt: catalog.generatedAt,
    summary: catalog.summary,
    tables,
  }
}
