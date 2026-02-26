import type { Context } from 'hono'

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

export function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return Math.floor(parsed)
}
