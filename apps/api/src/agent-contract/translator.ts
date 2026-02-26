import { randomUUID } from 'node:crypto'
import {
  type AgentCommand,
  type AgentRequestScope,
  type CommandScalarValue,
  type CommandFilter,
  type MutateCommand,
  type NLTranslationRequest,
  type PseudoApiRequest,
  type QueryCommand,
  nlTranslationRequestSchema,
  pseudoApiRequestSchema,
} from './types.js'
import {
  detectTablesInText,
  getSchemaCatalog,
  resolveColumnName,
  resolveTableName,
} from './schema-catalog.js'

export type TranslationResult = {
  success: boolean
  confidence: number
  notes: string[]
  inferred: {
    action: 'query' | 'insert' | 'update' | 'delete'
    table: string | null
  }
  pseudoRequest?: PseudoApiRequest
  error?: {
    message: string
    suggestions?: string[]
  }
}

function parsePrimitiveToken(token: string): string | number | boolean | null {
  const trimmed = token.trim().replace(/^['"]|['"]$/g, '')

  if (trimmed.toLowerCase() === 'null') return null
  if (trimmed.toLowerCase() === 'true') return true
  if (trimmed.toLowerCase() === 'false') return false

  const maybeNumber = Number(trimmed)
  if (!Number.isNaN(maybeNumber) && trimmed.length > 0 && /^-?\d+(\.\d+)?$/.test(trimmed)) {
    return maybeNumber
  }

  return trimmed
}

function inferAction(input: string): 'query' | 'insert' | 'update' | 'delete' {
  const lower = input.toLowerCase()

  if (/\b(delete|remove)\b/.test(lower)) return 'delete'
  if (/\b(update|set|change|mark)\b/.test(lower)) return 'update'
  if (/\b(create|add|insert|upsert)\b/.test(lower)) return 'insert'
  return 'query'
}

function inferTableName(input: string): string | null {
  const lower = input.toLowerCase()

  // First pass: explicit grammar hints.
  const explicitPatterns = [
    /\bfrom\s+([a-zA-Z_][a-zA-Z0-9_\s-]*)/i,
    /\binto\s+([a-zA-Z_][a-zA-Z0-9_\s-]*)/i,
    /\bupdate\s+([a-zA-Z_][a-zA-Z0-9_\s-]*)/i,
    /\bdelete\s+from\s+([a-zA-Z_][a-zA-Z0-9_\s-]*)/i,
    /\btable\s+([a-zA-Z_][a-zA-Z0-9_\s-]*)/i,
  ]

  for (const pattern of explicitPatterns) {
    const match = lower.match(pattern)
    const raw = match?.[1]?.trim()
    if (!raw) continue

    const resolved = resolveTableName(raw)
    if (resolved) return resolved

    // Sometimes regex captures too much trailing phrase. Try first token only.
    const firstToken = raw.split(/\s+/)[0]
    const resolvedToken = resolveTableName(firstToken)
    if (resolvedToken) return resolvedToken
  }

  // Second pass: fuzzy alias matching over whole sentence.
  const candidates = detectTablesInText(lower, 1)
  if (candidates.length > 0) {
    return candidates[0]
  }

  return null
}

function extractWhereSegment(input: string): string | null {
  const match = input.match(/\bwhere\b([\s\S]+)$/i)
  if (!match) return null
  return match[1].trim()
}

function parseWhereFilters(input: string, tableName: string, notes: string[]): CommandFilter[] {
  const whereSegment = extractWhereSegment(input)
  if (!whereSegment) return []

  const rawParts = whereSegment
    .split(/\s+and\s+/i)
    .map((part) => part.trim())
    .filter(Boolean)

  const filters: CommandFilter[] = []

  for (const part of rawParts) {
    const inMatch = part.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s*\((.+)\)$/i)
    if (inMatch) {
      const column = resolveColumnName(tableName, inMatch[1])
      if (!column) {
        notes.push(`Ignored unknown filter column: ${inMatch[1]}`)
        continue
      }
      const values = inMatch[2]
        .split(',')
        .map((value) => parsePrimitiveToken(value))
      filters.push({ column, op: 'in', value: values })
      continue
    }

    const nullMatch = part.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+is\s+(not\s+)?null$/i)
    if (nullMatch) {
      const column = resolveColumnName(tableName, nullMatch[1])
      if (!column) {
        notes.push(`Ignored unknown filter column: ${nullMatch[1]}`)
        continue
      }
      filters.push({ column, op: nullMatch[2] ? 'not_null' : 'is_null' })
      continue
    }

    const binaryMatch = part.match(
      /^([a-zA-Z_][a-zA-Z0-9_]*)\s*(=|!=|>=|<=|>|<|like|ilike)\s*(.+)$/i,
    )

    if (binaryMatch) {
      const column = resolveColumnName(tableName, binaryMatch[1])
      if (!column) {
        notes.push(`Ignored unknown filter column: ${binaryMatch[1]}`)
        continue
      }

      const opToken = binaryMatch[2].toLowerCase()
      const valueToken = binaryMatch[3]
      const opMap: Record<string, CommandFilter['op']> = {
        '=': 'eq',
        '!=': 'neq',
        '>': 'gt',
        '>=': 'gte',
        '<': 'lt',
        '<=': 'lte',
        like: 'like',
        ilike: 'ilike',
      }

      const op = opMap[opToken]
      if (!op) continue

      filters.push({
        column,
        op,
        value: parsePrimitiveToken(valueToken),
      })
      continue
    }

    // Last chance fallback for patterns like: "id 123".
    const looseMatch = part.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+(.+)$/)
    if (looseMatch) {
      const column = resolveColumnName(tableName, looseMatch[1])
      if (!column) {
        notes.push(`Ignored unknown filter expression: ${part}`)
        continue
      }
      filters.push({
        column,
        op: 'eq',
        value: parsePrimitiveToken(looseMatch[2]),
      })
      notes.push(`Assumed equality filter for loose expression: "${part}"`)
      continue
    }

    notes.push(`Ignored unsupported filter expression: ${part}`)
  }

  return filters
}

type AssignmentValue = CommandScalarValue | CommandScalarValue[]

type AssignmentParseResult = {
  values: Record<string, AssignmentValue>
  unknownColumns: string[]
}

function parseAssignments(
  input: string,
  tableName: string,
  notes: string[],
): AssignmentParseResult {
  const values: Record<string, AssignmentValue> = {}
  const unknownColumns = new Set<string>()

  // Structured assignment parser for pseudo-SQL prompts used in scenario packs.
  // We intentionally support only "=" syntax so ":" punctuation in free text
  // and ISO timestamps is never interpreted as a fake column assignment.
  const assignmentRegex =
    /(?:^|[\s,])([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*("[^"]*"|'[^']*'|[^,\s]+)/g

  let match: RegExpExecArray | null
  while ((match = assignmentRegex.exec(input)) !== null) {
    const rawColumn = match[1]
    const rawValue = match[2]

    const column = resolveColumnName(tableName, rawColumn)
    if (!column) {
      notes.push(`Ignored unknown assignment column: ${rawColumn}`)
      unknownColumns.add(rawColumn)
      continue
    }

    values[column] = parsePrimitiveToken(rawValue)
  }

  return { values, unknownColumns: Array.from(unknownColumns) }
}

function parseQueryCommand(input: string, tableName: string, notes: string[]): QueryCommand {
  const filters = parseWhereFilters(input, tableName, notes)

  const limitMatch = input.match(/\b(?:limit|top|first)\s+(\d+)\b/i)
  const limit = limitMatch ? Number(limitMatch[1]) : undefined

  const sort: QueryCommand['sort'] = []
  const orderMatch = input.match(/\border\s+by\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+(asc|desc))?/i)
  if (orderMatch) {
    const column = resolveColumnName(tableName, orderMatch[1])
    if (column) {
      sort.push({
        column,
        direction: (orderMatch[2]?.toLowerCase() === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc',
      })
    }
  }

  // Optional select parser: "show id,name from ..."
  let select: string[] | undefined
  const selectMatch = input.match(/\b(?:show|list|get|fetch|find)\s+(.+?)\s+from\b/i)
  if (selectMatch) {
    const segment = selectMatch[1].trim().toLowerCase()
    if (!['all', '*', 'everything'].includes(segment)) {
      const requestedColumns = segment
        .split(',')
        .map((part) => part.trim())
        .map((part) => resolveColumnName(tableName, part))
        .filter((value): value is string => Boolean(value))

      if (requestedColumns.length > 0) {
        select = requestedColumns
      } else {
        notes.push('Could not resolve requested select columns; defaulting to all columns.')
      }
    }
  }

  return {
    kind: 'query',
    table: tableName,
    select,
    filters,
    sort,
    limit,
  }
}

function parseInsertCommandWithMeta(
  input: string,
  tableName: string,
  notes: string[],
): { command: MutateCommand; unknownAssignmentColumns: string[] } {
  const { values, unknownColumns } = parseAssignments(input, tableName, notes)
  return {
    command: {
      kind: 'mutate',
      action: 'insert',
      table: tableName,
      values,
      filters: [],
      returning: ['id'],
    },
    unknownAssignmentColumns: unknownColumns,
  }
}

function parseDeleteCommand(input: string, tableName: string, notes: string[]): MutateCommand {
  const filters = parseWhereFilters(input, tableName, notes)

  if (filters.length === 0) {
    notes.push('No WHERE clause detected for delete; executor may reject unsafe mutation.')
  }

  return {
    kind: 'mutate',
    action: 'delete',
    table: tableName,
    filters,
    returning: ['id'],
  }
}

function parseUpdateCommandWithMeta(
  input: string,
  tableName: string,
  notes: string[],
): { command: MutateCommand; unknownAssignmentColumns: string[] } {
  const setSegmentRaw = input.split(/\bset\b/i)[1] ?? input
  const setSegment = setSegmentRaw.split(/\bwhere\b/i)[0] ?? setSegmentRaw
  const { values, unknownColumns } = parseAssignments(setSegment, tableName, notes)
  const filters = parseWhereFilters(input, tableName, notes)

  if (filters.length === 0) {
    notes.push('No WHERE clause detected for update; executor may reject unsafe mutation.')
  }

  return {
    command: {
      kind: 'mutate',
      action: 'update',
      table: tableName,
      values,
      filters,
      returning: ['id'],
    },
    unknownAssignmentColumns: unknownColumns,
  }
}

function scoreColumnSuggestion(unknownColumn: string, candidateColumn: string): number {
  const unknown = unknownColumn.toLowerCase().replace(/[^a-z0-9_]/g, '')
  const candidate = candidateColumn.toLowerCase()

  if (unknown === candidate) return 100
  if (candidate.startsWith(unknown) || unknown.startsWith(candidate)) return 80
  if (candidate.includes(unknown) || unknown.includes(candidate)) return 60

  const unknownTokens = unknown.split('_').filter(Boolean)
  const candidateTokens = candidate.split('_').filter(Boolean)
  const overlap = unknownTokens.filter((token) => candidateTokens.includes(token)).length
  if (overlap > 0) return 40 + overlap

  return 0
}

function suggestColumnsForUnknown(
  tableName: string,
  unknownColumns: string[],
): string[] {
  const catalog = getSchemaCatalog()
  const table = catalog.tables.get(tableName)
  if (!table) return []

  const suggestions: string[] = []

  for (const unknown of unknownColumns) {
    const ranked = table.columns
      .map((column) => ({
        name: column.name,
        score: scoreColumnSuggestion(unknown, column.name),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((entry) => entry.name)

    if (ranked.length > 0) {
      suggestions.push(`Unknown column "${unknown}". Did you mean: ${ranked.join(', ')}?`)
    } else {
      suggestions.push(`Unknown column "${unknown}" for table "${tableName}".`)
    }
  }

  return suggestions
}

function buildCommandFromInput(
  input: string,
  action: 'query' | 'insert' | 'update' | 'delete',
  tableName: string,
  notes: string[],
): { command: AgentCommand; unknownAssignmentColumns: string[] } {
  if (action === 'query') {
    return { command: parseQueryCommand(input, tableName, notes), unknownAssignmentColumns: [] }
  }
  if (action === 'insert') {
    return parseInsertCommandWithMeta(input, tableName, notes)
  }
  if (action === 'update') {
    return parseUpdateCommandWithMeta(input, tableName, notes)
  }
  return { command: parseDeleteCommand(input, tableName, notes), unknownAssignmentColumns: [] }
}

function computeConfidence(
  action: 'query' | 'insert' | 'update' | 'delete',
  tableName: string | null,
  notes: string[],
): number {
  let confidence = 0.45
  if (tableName) confidence += 0.25
  if (action !== 'query') confidence += 0.1
  confidence -= Math.min(0.35, notes.length * 0.05)
  return Math.max(0.05, Math.min(0.99, Number(confidence.toFixed(2))))
}

/**
 * Converts one natural-language sentence into a strict pseudo API request.
 */
export function translateNaturalLanguageRequest(input: unknown): TranslationResult {
  let parsed: NLTranslationRequest
  try {
    parsed = nlTranslationRequestSchema.parse(input)
  } catch (error) {
    return {
      success: false,
      confidence: 0,
      notes: [],
      inferred: { action: 'query', table: null },
      error: {
        message: 'Invalid translation request payload.',
        suggestions: [error instanceof Error ? error.message : 'zod_parse_failed'],
      },
    }
  }

  const notes: string[] = []
  const forcedAction = parsed.options?.forceAction
  const action = forcedAction ?? inferAction(parsed.input)

  const tableName =
    parsed.options?.forceTable != null
      ? resolveTableName(parsed.options.forceTable)
      : inferTableName(parsed.input)

  if (!tableName) {
    const suggestions = detectTablesInText(parsed.input, 8)

    return {
      success: false,
      confidence: computeConfidence(action, null, notes),
      notes,
      inferred: { action, table: null },
      error: {
        message: 'Could not infer target table from natural-language input.',
        suggestions,
      },
    }
  }

  const catalog = getSchemaCatalog()
  if (!catalog.tables.has(tableName)) {
    return {
      success: false,
      confidence: computeConfidence(action, null, notes),
      notes,
      inferred: { action, table: tableName },
      error: {
        message: `Inferred table \"${tableName}\" is not present in the active schema catalog.`,
      },
    }
  }

  const { command, unknownAssignmentColumns } = buildCommandFromInput(
    parsed.input,
    action,
    tableName,
    notes,
  )

  if (
    (action === 'insert' || action === 'update') &&
    unknownAssignmentColumns.length > 0
  ) {
    const suggestions = suggestColumnsForUnknown(tableName, unknownAssignmentColumns)
    return {
      success: false,
      confidence: computeConfidence(action, tableName, notes),
      notes,
      inferred: { action, table: tableName },
      error: {
        message: `Unknown assignment column(s) for table "${tableName}".`,
        suggestions,
      },
    }
  }

  const request: PseudoApiRequest = {
    requestId: randomUUID(),
    dryRun: parsed.dryRun,
    scope: parsed.scope as AgentRequestScope,
    command,
  }

  // Final contract validation ensures translator can never output malformed commands.
  const validatedRequest = pseudoApiRequestSchema.parse(request)

  return {
    success: true,
    confidence: computeConfidence(action, tableName, notes),
    notes,
    inferred: {
      action,
      table: tableName,
    },
    pseudoRequest: validatedRequest,
  }
}
