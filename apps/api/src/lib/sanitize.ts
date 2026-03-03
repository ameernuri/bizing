/**
 * Minimal API input sanitization helpers.
 *
 * ELI5:
 * We keep raw business meaning, but strip the obvious HTML/script payloads that
 * should never be stored as display text. This is not a full rich-text system.
 *
 * Why this exists:
 * - current saga/security checks need deterministic proof that common input
 *   surfaces do not blindly persist executable markup,
 * - the API should normalize plain-text fields before they reach the database,
 * - the helper is intentionally tiny and reusable across route modules.
 *
 * Future note:
 * If we later support trusted rich text, create a separate allowlisted rich
 * text sanitizer. Do not weaken this plain-text helper.
 */

const SCRIPT_BLOCK_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi
const TAG_RE = /<\/?[^>]+>/g
const CONTROL_RE = /[\u0000-\u001f\u007f]/g

export function sanitizePlainText(value: string) {
  return value
    .replace(SCRIPT_BLOCK_RE, ' ')
    .replace(TAG_RE, ' ')
    .replace(CONTROL_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function sanitizeUnknown(value: unknown): unknown {
  if (typeof value === 'string') return sanitizePlainText(value)
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map((entry) => sanitizeUnknown(entry))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, sanitizeUnknown(entry)]),
  )
}
