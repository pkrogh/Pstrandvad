import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'

export interface AdoSettings {
  /** e.g. https://dev.azure.com/my-org (or an Azure DevOps Server collection URL) */
  baseUrl: string
  project: string
  pat: string
  hoursPerPoint: number
  defaultCapacity: number
}

/** Public, non-secret settings exposed to the browser bundle. */
export interface AdoClientConfig {
  enabled: boolean
  project: string
  webUrl: string
  hoursPerPoint: number
  defaultCapacity: number
}

export function readAdoSettings(env: Record<string, string>): AdoSettings | null {
  const pat = env.ADO_PAT?.trim()
  const project = env.ADO_PROJECT?.trim()
  const baseUrl = (env.ADO_BASE_URL?.trim() || (env.ADO_ORG ? `https://dev.azure.com/${env.ADO_ORG.trim()}` : '')).replace(/\/+$/, '')
  if (!pat || !project || !baseUrl) return null
  return {
    baseUrl,
    project,
    pat,
    hoursPerPoint: Number(env.ADO_HOURS_PER_POINT) || 6,
    defaultCapacity: Number(env.ADO_DEFAULT_CAPACITY) || 40,
  }
}

export function clientConfig(s: AdoSettings | null): AdoClientConfig {
  return s
    ? { enabled: true, project: s.project, webUrl: s.baseUrl, hoursPerPoint: s.hoursPerPoint, defaultCapacity: s.defaultCapacity }
    : { enabled: false, project: '', webUrl: '', hoursPerPoint: 6, defaultCapacity: 40 }
}

// Read-only allowlist: the app only ever needs these endpoints. POST is allowed
// solely for the two query endpoints, which don't modify anything.
const ALLOWED: { method: string; pattern: RegExp }[] = [
  { method: 'GET', pattern: /^\/_apis\/connectionData(\?|$)/ },
  { method: 'GET', pattern: /^\/[^/]+\/_apis\/wit\/classificationnodes\/iterations(\?|$)/ },
  { method: 'GET', pattern: /^\/[^/]+\/_apis\/wit\/workitemtypes(\/[^/?]+\/states)?(\?|$)/ },
  { method: 'POST', pattern: /^\/[^/]+\/_apis\/wit\/wiql(\?|$)/ },
  { method: 'POST', pattern: /^\/[^/]+\/_apis\/wit\/workitemsbatch(\?|$)/ },
]

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => {
      data += c
      if (data.length > 1_000_000) reject(new Error('Body too large'))
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function deny(res: ServerResponse, status: number, message: string) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ message }))
}

/**
 * Forwards /ado/* to Azure DevOps, adding the PAT server-side so it never reaches
 * the browser. Only same-origin requests to an allowlist of read endpoints pass.
 */
function middleware(settings: AdoSettings | null): Connect.NextHandleFunction {
  const auth = settings ? 'Basic ' + Buffer.from(':' + settings.pat).toString('base64') : ''
  return async (req, res) => {
    if (!settings) return deny(res, 503, 'Azure DevOps is not configured. Set ADO_ORG, ADO_PROJECT and ADO_PAT in .env.local.')

    // Block other websites from using this proxy through the developer's browser.
    const site = req.headers['sec-fetch-site']
    const origin = req.headers.origin
    if ((site && site !== 'same-origin') || (origin && new URL(origin).host !== req.headers.host)) {
      return deny(res, 403, 'Cross-origin requests are not allowed')
    }

    const path = req.url ?? '/'
    const method = req.method ?? 'GET'
    if (!ALLOWED.some((a) => a.method === method && a.pattern.test(path))) {
      return deny(res, 403, `Not allowed by the read-only proxy: ${method} ${path.split('?')[0]}`)
    }

    try {
      const upstream = await fetch(settings.baseUrl + path, {
        method,
        headers: { Authorization: auth, Accept: 'application/json', ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
        body: method === 'POST' ? await readBody(req) : undefined,
        redirect: 'manual',
      })
      res.statusCode = upstream.status
      // A redirect to a sign-in page means the token was rejected.
      if (upstream.status >= 300 && upstream.status < 400) return deny(res, 401, 'Azure DevOps rejected the token (redirected to sign-in)')
      res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json')
      res.end(Buffer.from(await upstream.arrayBuffer()))
    } catch (e) {
      deny(res, 502, `Could not reach Azure DevOps: ${(e as Error).message}`)
    }
  }
}

export function adoProxy(settings: AdoSettings | null): Plugin {
  return {
    name: 'ado-proxy',
    configureServer(server) {
      server.middlewares.use('/ado', middleware(settings))
    },
    configurePreviewServer(server) {
      server.middlewares.use('/ado', middleware(settings))
    },
  }
}
