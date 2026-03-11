import type { Context } from 'hono'
import type { ZodTypeAny, output } from 'zod'

export function requestMeta(c: Context) {
  return {
    requestId: c.get('requestId') ?? crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  }
}

export function ok<T>(c: Context, data: T, status = 200, extra?: Record<string, unknown>) {
  return c.json(
    {
      success: true,
      data,
      meta: requestMeta(c),
      ...(extra ?? {}),
    },
    status as 200,
  )
}

export function fail(
  c: Context,
  code: string,
  message: string,
  status = 400,
  details?: unknown,
) {
  return c.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
      meta: requestMeta(c),
    },
    status as 400,
  )
}

export function parseQuery<TSchema extends ZodTypeAny>(
  c: Context,
  schema: TSchema,
  invalidMessage = 'Invalid query parameters.',
) {
  const parsed = schema.safeParse(c.req.query())
  if (!parsed.success) {
    return {
      ok: false as const,
      response: fail(c, 'VALIDATION_ERROR', invalidMessage, 400, parsed.error.flatten()),
    }
  }
  return {
    ok: true as const,
    data: parsed.data as output<TSchema>,
  }
}

export async function parseJsonBody<TSchema extends ZodTypeAny>(
  c: Context,
  schema: TSchema,
  invalidMessage = 'Invalid request body.',
) {
  const contentType = c.req.header('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return {
      ok: false as const,
      response: fail(c, 'UNSUPPORTED_MEDIA_TYPE', 'Request body must be application/json.', 415, {
        contentType: contentType || null,
      }),
    }
  }

  const raw = await c.req.json().catch(() => undefined)
  if (raw === undefined) {
    return {
      ok: false as const,
      response: fail(c, 'INVALID_JSON', 'Request body must be valid JSON.', 400),
    }
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false as const,
      response: fail(c, 'VALIDATION_ERROR', invalidMessage, 400, parsed.error.flatten()),
    }
  }

  return {
    ok: true as const,
    data: parsed.data as output<TSchema>,
  }
}

export function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return Math.floor(parsed)
}
