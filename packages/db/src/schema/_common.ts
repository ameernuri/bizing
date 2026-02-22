import { AnyPgColumn, text, timestamp } from 'drizzle-orm/pg-core'
import { generateId } from '../id'

/** Row creation timestamp (UTC timestamptz). */
export const createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull()

/** Last update timestamp (application should refresh on mutation). */
export const updatedAt = timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()

/** Soft-delete marker; null means active. */
export const deletedAt = timestamp('deleted_at', { withTimezone: true })

/** Text FK helper for ULID/tagged ids. */
export const idRef = (name: string) => text(name)

/** Primary key helper using tagged ULID generation. */
export const idWithTag = (tag = '') => idRef('id').primaryKey().$defaultFn(() => generateId(tag))

/** Default primary key helper (no tag). */
export const id = idWithTag()

/** Actor columns without FK constraints. */
export const withActorIds = () => ({
  createdBy: idRef('created_by'),
  updatedBy: idRef('updated_by'),
  deletedBy: idRef('deleted_by'),
})

/**
 * Actor columns with FK constraints (typically to `users.id`).
 */
export const withActorRefs = (actorIdRef: () => AnyPgColumn) => ({
  createdBy: idRef('created_by').references(actorIdRef),
  updatedBy: idRef('updated_by').references(actorIdRef),
  deletedBy: idRef('deleted_by').references(actorIdRef),
})

type ActorMode = 'none' | 'ids' | 'refs'

export type MetaColumnOptions = {
  /** Include `created_at` + `updated_at` (default: true). */
  timestamps?: boolean

  /** Include `deleted_at` (default: true). */
  softDelete?: boolean

  /**
   * Actor column mode:
   * - `none`: no actor columns
   * - `ids`: actor ids without FKs
   * - `refs`: FK-backed actor ids via `actorIdRef`
   * Default: `none`
   */
  actors?: ActorMode

  /** Required when `actors='refs'`. */
  actorIdRef?: () => AnyPgColumn
}

/**
 * Configurable lifecycle/audit column helper.
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

/**
 * Full audit set with actor ids (no FK constraints).
 * Useful for root tables where FK coupling is undesirable.
 */
export const withAudit = () => ({
  ...withMetaColumns({ timestamps: true, softDelete: true, actors: 'ids' }),
})

/**
 * Full audit set with actor FK constraints.
 * Preferred default for business-domain tables.
 */
export const withAuditRefs = (actorIdRef: () => AnyPgColumn) => ({
  ...withMetaColumns({ timestamps: true, softDelete: true, actors: 'refs', actorIdRef }),
})
