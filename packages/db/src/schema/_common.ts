import { AnyPgColumn, text, timestamp } from 'drizzle-orm/pg-core'
import { generateId } from '../id'

/** Insert time in UTC with timezone support. */
export const createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull()

/** Last write timestamp; application layer should update this on mutation. */
export const updatedAt = timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()

/** Soft-delete marker; null means active/visible. */
export const deletedAt = timestamp('deleted_at', { withTimezone: true })

/** Reusable text FK helper for ULID/tagged id references. */
export const idRef = (name: string) => text(name)

/** Primary key helper using ULID id generator with optional entity tag. */
export const idWithTag = (tag = '') => idRef('id').primaryKey().$defaultFn(() => generateId(tag))

/** Default PK helper with no tag prefix. */
export const id = idWithTag()

/** Shared created/updated pair to avoid duplicating audit timestamp keys. */
export const withTimestamps = () => withMetaColumns({ timestamps: true, softDelete: false })

/** Shared soft-delete marker key. */
export const withSoftDelete = () => ({
  deletedAt,
})

/** Shared actor id keys (`created_by`, `updated_by`, `deleted_by`) without FK refs. */
export const withActorIds = () => ({
  createdBy: idRef('created_by'),
  updatedBy: idRef('updated_by'),
  deletedBy: idRef('deleted_by'),
})

/**
 * Shared actor id keys with FK refs.
 *
 * Use this when a table should enforce actor linkage to a specific table
 * (typically `users.id`).
 */
export const withActorRefs = (actorIdRef: () => AnyPgColumn) => ({
  createdBy: idRef('created_by').references(actorIdRef),
  updatedBy: idRef('updated_by').references(actorIdRef),
  deletedBy: idRef('deleted_by').references(actorIdRef),
})

type ActorMode = 'none' | 'ids' | 'refs'

export type MetaColumnOptions = {
  /**
   * Include `created_at` + `updated_at`.
   * Default: true
   */
  timestamps?: boolean

  /**
   * Include `deleted_at`.
   * Default: true
   */
  softDelete?: boolean

  /**
   * Include actor columns and how they should be modeled.
   * - `none`: no actor columns
   * - `ids`: plain id fields (no FK)
   * - `refs`: FK-backed actor ids using `actorIdRef`
   * Default: 'none'
   */
  actors?: ActorMode

  /**
   * Required when `actors='refs'`.
   * Usually: `() => users.id`
   */
  actorIdRef?: () => AnyPgColumn
}

/**
 * Configurable metadata column builder with sensible defaults.
 *
 * Defaults:
 * - timestamps: true
 * - softDelete: true
 * - actors: 'none'
 *
 * Examples:
 * - `withMetaColumns()` -> created/updated/deleted
 * - `withMetaColumns({ softDelete: false })` -> created/updated
 * - `withMetaColumns({ actors: 'ids' })` -> lifecycle + actor ids (no FK)
 * - `withMetaColumns({ actors: 'refs', actorIdRef: () => users.id })`
 */
export const withMetaColumns = (options: MetaColumnOptions = {}) => {
  const {
    timestamps = true,
    softDelete = true,
    actors = 'none',
    actorIdRef,
  } = options

  const columns: Record<string, unknown> = {}

  if (timestamps) {
    columns.createdAt = createdAt
    columns.updatedAt = updatedAt
  }

  if (softDelete) {
    columns.deletedAt = deletedAt
  }

  if (actors === 'ids') {
    Object.assign(columns, withActorIds())
  } else if (actors === 'refs') {
    if (!actorIdRef) {
      throw new Error("withMetaColumns: `actorIdRef` is required when actors='refs'")
    }
    Object.assign(columns, withActorRefs(actorIdRef))
  }

  return columns
}

/** Common timestamp lifecycle (created/updated/deleted). */
export const withLifecycleTimestamps = () => withMetaColumns({ timestamps: true, softDelete: true, actors: 'none' })

/**
 * Full audit set with plain actor ids (no FK refs).
 *
 * This is safe for root/cross-cutting tables where strict FK coupling is
 * undesirable (e.g. bootstrap/circular dependency concerns).
 */
export const withAudit = () => ({
  ...withMetaColumns({ timestamps: true, softDelete: true, actors: 'ids' }),
})

/**
 * Full audit set with actor FK refs.
 *
 * Preferred default for most business tables where actor traceability should
 * be enforced by the database.
 */
export const withAuditRefs = (actorIdRef: () => AnyPgColumn) => ({
  ...withMetaColumns({ timestamps: true, softDelete: true, actors: 'refs', actorIdRef }),
})
