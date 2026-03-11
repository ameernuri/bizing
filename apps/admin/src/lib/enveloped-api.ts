import { apiUrl } from '@/lib/api'

export type ApiEnvelope<T> = {
  success: boolean
  data: T
  meta?: Record<string, unknown>
  error?: { message?: string }
}

export class EnvelopedApiError extends Error {
  status: number
  payload: unknown

  constructor(status: number, message: string, payload: unknown) {
    super(message)
    this.name = 'EnvelopedApiError'
    this.status = status
    this.payload = payload
  }
}

export type EnvelopedApiSuccess<T> = {
  data: T
  payload: ApiEnvelope<T>
  status: number
}

export async function requestEnvelopedApiResponse<T>(path: string, init?: RequestInit): Promise<EnvelopedApiSuccess<T>> {
  const response = await fetch(apiUrl(path), {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  })

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!response.ok || !payload?.success) {
    throw new EnvelopedApiError(response.status, payload?.error?.message || `Request failed (${response.status})`, payload)
  }

  return {
    data: payload.data,
    payload,
    status: response.status,
  }
}

export async function requestEnvelopedApi<T>(path: string, init?: RequestInit): Promise<T> {
  const result = await requestEnvelopedApiResponse<T>(path, init)
  return result.data
}

export function unwrapEnvelopedData<T>(payload: unknown, fallbackMessage = 'API response was not successful.'): T {
  if (!payload || typeof payload !== 'object') {
    throw new Error(fallbackMessage)
  }
  const envelope = payload as Partial<ApiEnvelope<T>>
  if (envelope.success !== true) {
    throw new Error(fallbackMessage)
  }
  return envelope.data as T
}
