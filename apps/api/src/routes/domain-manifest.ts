import manifestJson from './domain-manifest.json'

export type DomainAuthClass = 'public' | 'session_only' | 'machine_allowed' | 'internal_only'

export type DomainManifestEntry = {
  key: string
  mountPath: string
  routeFile: string
  schemaModule: string
  authClass: DomainAuthClass
  docsFile: string
}

export type DomainManifest = {
  version: number
  generatedFrom: string
  entries: DomainManifestEntry[]
}

function isDomainAuthClass(value: unknown): value is DomainAuthClass {
  return value === 'public' || value === 'session_only' || value === 'machine_allowed' || value === 'internal_only'
}

function isDomainManifestEntry(value: unknown): value is DomainManifestEntry {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  const schemaModule =
    typeof candidate.schemaModule === 'string' ? candidate.schemaModule.trim() : null
  return (
    typeof candidate.key === 'string' &&
    typeof candidate.mountPath === 'string' &&
    typeof candidate.routeFile === 'string' &&
    typeof schemaModule === 'string' &&
    schemaModule.length > 0 &&
    isDomainAuthClass(candidate.authClass) &&
    typeof candidate.docsFile === 'string'
  )
}

function parseDomainManifest(input: unknown): DomainManifest {
  if (!input || typeof input !== 'object') {
    throw new Error('Domain manifest must be an object.')
  }

  const candidate = input as Record<string, unknown>
  if (typeof candidate.version !== 'number') {
    throw new Error('Domain manifest is missing numeric `version`.')
  }
  if (typeof candidate.generatedFrom !== 'string') {
    throw new Error('Domain manifest is missing string `generatedFrom`.')
  }
  if (!Array.isArray(candidate.entries)) {
    throw new Error('Domain manifest is missing array `entries`.')
  }

  const entries = candidate.entries
  for (const entry of entries) {
    if (!isDomainManifestEntry(entry)) {
      throw new Error(`Domain manifest has invalid entry: ${JSON.stringify(entry)}`)
    }
  }

  return {
    version: candidate.version,
    generatedFrom: candidate.generatedFrom,
    entries,
  }
}

export const domainManifest = parseDomainManifest(manifestJson)

export const domainManifestEntries = domainManifest.entries

export function domainManifestByKey() {
  return new Map(domainManifestEntries.map((entry) => [entry.key, entry] as const))
}

export function domainManifestByRouteFile() {
  return new Map(domainManifestEntries.map((entry) => [entry.routeFile, entry] as const))
}
