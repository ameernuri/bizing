import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { apiTools, type ApiToolDefinition } from '../code-mode/tools.js'
import { domainManifestByRouteFile } from '../routes/domain-manifest.js'

export type ExplorerHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type ApiExplorerEndpoint = {
  method: ExplorerHttpMethod
  path: string
  domain: string
  sourceFile: string
  authClass: 'public' | 'session_or_machine' | 'session_only' | 'internal_or_policy'
  summary: string
  codeModeTools: string[]
}

type ParsedRoute = {
  method: ExplorerHttpMethod
  path: string
}

type OpenApiPathOperation = {
  summary: string
  operationId: string
  tags: string[]
  responses: Record<string, { description: string }>
}

type OpenApiPathItem = Partial<Record<'get' | 'post' | 'put' | 'patch' | 'delete', OpenApiPathOperation>>

type OpenApiDocument = {
  openapi: '3.1.0'
  info: {
    title: string
    version: string
    description: string
  }
  servers: Array<{ url: string }>
  paths: Record<string, OpenApiPathItem>
}

const SOURCE_DIR = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const ROUTES_DIR = path.resolve(SOURCE_DIR, 'routes')
const SERVER_FILE = path.resolve(SOURCE_DIR, 'server.ts')
const ROUTE_REGEX =
  /^\s*[A-Za-z_$][A-Za-z0-9_$]*\s*\.\s*(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/gim

const METHOD_ORDER: Record<ExplorerHttpMethod, number> = {
  GET: 1,
  POST: 2,
  PUT: 3,
  PATCH: 4,
  DELETE: 5,
}

const SERVER_LEVEL_ENDPOINTS: ApiExplorerEndpoint[] = [
  {
    method: 'GET',
    path: '/api/v1/health',
    domain: 'server',
    sourceFile: 'server.ts',
    authClass: 'public',
    summary: 'Process health check endpoint (versioned API path).',
    codeModeTools: [],
  },
  {
    method: 'GET',
    path: '/api/v1/health/db',
    domain: 'server',
    sourceFile: 'server.ts',
    authClass: 'public',
    summary: 'Database connectivity health check.',
    codeModeTools: [],
  },
  {
    method: 'GET',
    path: '/api/v1/agent/testing/openapi.json',
    domain: 'agents',
    sourceFile: 'server.ts',
    authClass: 'session_or_machine',
    summary: 'Legacy minimal OpenAPI document for agent tooling.',
    codeModeTools: [],
  },
]

function domainFromFileName(fileName: string) {
  return fileName.replace(/\.ts$/, '').replace(/^_/, '')
}

function normalizeApiPath(rawPath: string): string {
  const base = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  if (base.startsWith('/api/')) return base
  return `/api/v1${base}`
}

function joinMountedPath(prefix: string, routePath: string) {
  const normalizedPrefix = prefix === '/' ? '' : prefix.replace(/\/+$/, '')
  const normalizedRoute = routePath.startsWith('/') ? routePath : `/${routePath}`
  if (normalizedRoute === '/') return normalizedPrefix || '/'
  const combined = `${normalizedPrefix}${normalizedRoute}`
  return combined || '/'
}

function classifyAuth(pathname: string): ApiExplorerEndpoint['authClass'] {
  if (pathname === '/health') return 'public'
  if (pathname === '/api/v1/health') return 'public'
  if (pathname.startsWith('/api/auth/')) return 'public'
  if (pathname.startsWith('/api/v1/public/')) return 'public'
  if (pathname.startsWith('/api/v1/health/')) return 'public'
  if (pathname.startsWith('/api/v1/agents/')) return 'session_or_machine'
  if (pathname.startsWith('/api/v1/auth/')) return 'session_or_machine'
  if (pathname.startsWith('/api/v1/admin/')) return 'session_only'
  return 'internal_or_policy'
}

function extractRoutes(content: string): ParsedRoute[] {
  const routes: ParsedRoute[] = []
  for (const match of content.matchAll(ROUTE_REGEX)) {
    const method = String(match[1] || '').toUpperCase() as ExplorerHttpMethod
    const routePath = String(match[2] || '').trim()
    if (!routePath) continue
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) continue
    routes.push({ method, path: routePath })
  }
  return routes
}

function buildOperationId(method: ExplorerHttpMethod, pathName: string) {
  const tokenized = pathName
    .replace(/\{([^}]+)\}/g, '_by_$1')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return `${method.toLowerCase()}_${tokenized}`
}

function mapToolNamesByEndpoint(tools: ApiToolDefinition[]) {
  const map = new Map<string, string[]>()
  for (const tool of tools) {
    const key = `${tool.method} ${tool.path}`
    const existing = map.get(key) ?? []
    existing.push(tool.name)
    map.set(key, existing)
  }
  return map
}

async function readRouteEndpoints(): Promise<ApiExplorerEndpoint[]> {
  const mountPrefixes = readCoreRouteMountPrefixes()
  const files = (await fs.readdir(ROUTES_DIR)).filter((file) => file.endsWith('.ts'))
  const endpoints: ApiExplorerEndpoint[] = []
  for (const fileName of files) {
    const filePath = path.resolve(ROUTES_DIR, fileName)
    const content = await fs.readFile(filePath, 'utf8')
    const domain = domainFromFileName(fileName)
    const mountPrefix = mountPrefixes.get(fileName) ?? '/'
    for (const parsed of extractRoutes(content)) {
      const mountedPath = parsed.path.startsWith('/api/')
        ? parsed.path
        : joinMountedPath(mountPrefix, parsed.path)
      const fullPath = normalizeApiPath(mountedPath)
      endpoints.push({
        method: parsed.method,
        path: fullPath,
        domain,
        sourceFile: `routes/${fileName}`,
        authClass: classifyAuth(fullPath),
        summary: `${domain} ${parsed.method} ${fullPath}`,
        codeModeTools: [],
      })
    }
  }
  return endpoints
}

function readCoreRouteMountPrefixes() {
  const byRouteFile = domainManifestByRouteFile()
  const fileToPrefix = new Map<string, string>()
  for (const [routeFile, entry] of byRouteFile.entries()) {
    fileToPrefix.set(routeFile, entry.mountPath)
  }
  return fileToPrefix
}

async function readServerEndpoints(): Promise<ApiExplorerEndpoint[]> {
  const content = await fs.readFile(SERVER_FILE, 'utf8')
  const parsed = extractRoutes(content)
  const runtime = parsed
    .filter((route) => {
      if (route.path.startsWith('/api/v1/')) return true
      if (route.path.startsWith('/api/auth/')) return true
      return false
    })
    .map<ApiExplorerEndpoint>((route) => {
      const fullPath = route.path
      return {
        method: route.method,
        path: fullPath,
        domain: 'server',
        sourceFile: 'server.ts',
        authClass: classifyAuth(fullPath),
        summary: `server ${route.method} ${fullPath}`,
        codeModeTools: [],
      }
    })

  return [...runtime, ...SERVER_LEVEL_ENDPOINTS]
}

function dedupeEndpoints(endpoints: ApiExplorerEndpoint[], tools: ApiToolDefinition[]) {
  const toolMap = mapToolNamesByEndpoint(tools)
  const map = new Map<string, ApiExplorerEndpoint>()

  for (const endpoint of endpoints) {
    const key = `${endpoint.method} ${endpoint.path}`
    const existing = map.get(key)
    const toolNames = toolMap.get(key) ?? []
    if (!existing) {
      map.set(key, {
        ...endpoint,
        codeModeTools: toolNames,
      })
      continue
    }

    map.set(key, {
      ...existing,
      codeModeTools: Array.from(new Set([...(existing.codeModeTools ?? []), ...toolNames])),
    })
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.path !== b.path) return a.path.localeCompare(b.path)
    return METHOD_ORDER[a.method] - METHOD_ORDER[b.method]
  })
}

function buildOpenApiDocument(endpoints: ApiExplorerEndpoint[]): OpenApiDocument {
  const paths: Record<string, OpenApiPathItem> = {}

  for (const endpoint of endpoints) {
    if (!paths[endpoint.path]) {
      paths[endpoint.path] = {}
    }
    const methodKey = endpoint.method.toLowerCase() as keyof OpenApiPathItem
    paths[endpoint.path][methodKey] = {
      summary: endpoint.summary,
      operationId: buildOperationId(endpoint.method, endpoint.path),
      tags: [endpoint.domain, endpoint.authClass],
      responses: {
        '200': { description: 'Successful response' },
      },
    }
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Bizing Unified API Explorer',
      version: '0.3.0',
      description:
        'Runtime-generated OpenAPI-style catalog for all API endpoints plus code-mode interfaces.',
    },
    servers: [
      {
        url: process.env.CODE_MODE_BASE_URL || process.env.API_BASE_URL || 'http://localhost:6129',
      },
    ],
    paths,
  }
}

export async function buildApiExplorerCatalog() {
  const [routeEndpoints, serverEndpoints] = await Promise.all([readRouteEndpoints(), readServerEndpoints()])
  const endpoints = dedupeEndpoints([...routeEndpoints, ...serverEndpoints], apiTools)
  const openapi = buildOpenApiDocument(endpoints)

  return {
    generatedAt: new Date().toISOString(),
    endpointCount: endpoints.length,
    codeModeToolCount: apiTools.length,
    endpoints,
    codeMode: {
      manifestPath: '/api/v1/agents/manifest',
      toolsPath: '/api/v1/agents/tools',
      searchPath: '/api/v1/agents/search',
      executePath: '/api/v1/agents/execute',
      tools: apiTools,
    },
    openapi,
  }
}

export async function buildApiExplorerOpenApiDocument() {
  const catalog = await buildApiExplorerCatalog()
  return catalog.openapi
}
