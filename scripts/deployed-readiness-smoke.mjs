import { pathToFileURL } from 'node:url'

const DEFAULT_FRONTEND_FALLBACK_ROUTE = '/store/me'
const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_ASSET_CHECK_LIMIT = 5
const RATE_LIMIT_HEADERS = [
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
]

export function readDeployedReadinessConfig(env = process.env) {
  const frontendBaseUrl = normalizeBaseUrl(
    requireEnv(env, 'READINESS_FRONTEND_URL'),
    'READINESS_FRONTEND_URL',
  )
  const apiBaseUrl = normalizeBackendApiBaseUrl(
    requireEnv(env, 'READINESS_BACKEND_URL'),
    'READINESS_BACKEND_URL',
  )

  return {
    environment: readEnv(env, 'READINESS_ENVIRONMENT') || 'unspecified',
    frontendBaseUrl,
    apiBaseUrl,
    frontendFallbackRoute: ensureLeadingSlash(
      readEnv(env, 'READINESS_FRONTEND_FALLBACK_ROUTE') || DEFAULT_FRONTEND_FALLBACK_ROUTE,
    ),
    bearerToken: readEnv(env, 'READINESS_BEARER_TOKEN'),
    expectedCommit: readEnv(env, 'READINESS_EXPECTED_COMMIT'),
    timeoutMs: readPositiveInteger(env.READINESS_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    assetCheckLimit: readPositiveInteger(
      env.READINESS_ASSET_CHECK_LIMIT,
      DEFAULT_ASSET_CHECK_LIMIT,
    ),
  }
}

export async function runDeployedReadinessSmoke(input = {}) {
  const config = input.config ?? readDeployedReadinessConfig(input.env ?? process.env)
  const fetchFn = input.fetchFn ?? globalThis.fetch

  if (typeof fetchFn !== 'function') {
    throw new Error('A fetch implementation is required for deployed readiness smoke')
  }

  const checks = []
  const backendResponses = []
  let frontendRootHtml = ''

  const live = await fetchJsonCheck({
    name: 'backend health live',
    url: `${config.apiBaseUrl}/health/live`,
    fetchFn,
    timeoutMs: config.timeoutMs,
  })
  checks.push(live.check)
  backendResponses.push(live)

  const health = await fetchJsonCheck({
    name: 'backend health dependencies',
    url: `${config.apiBaseUrl}/health`,
    fetchFn,
    timeoutMs: config.timeoutMs,
  })
  checks.push(health.check)
  backendResponses.push(health)

  checks.push(checkRateLimitHeaders(backendResponses))
  checks.push(...checkCorrelationHeaders(backendResponses))

  const root = await fetchTextCheck({
    name: 'frontend root',
    url: `${config.frontendBaseUrl}/`,
    fetchFn,
    timeoutMs: config.timeoutMs,
    expectedContentType: 'text/html',
  })
  checks.push(root.check)

  if (root.ok) {
    frontendRootHtml = root.body
  }

  const fallback = await fetchTextCheck({
    name: 'frontend spa fallback',
    url: `${config.frontendBaseUrl}${config.frontendFallbackRoute}`,
    fetchFn,
    timeoutMs: config.timeoutMs,
    expectedContentType: 'text/html',
  })
  checks.push(fallback.check)

  checks.push(
    ...(await checkFrontendAssets({
      html: frontendRootHtml,
      frontendBaseUrl: config.frontendBaseUrl,
      fetchFn,
      timeoutMs: config.timeoutMs,
      assetCheckLimit: config.assetCheckLimit,
    })),
  )

  checks.push(
    ...(await checkAuthSession({
      config,
      fetchFn,
    })),
  )

  if (config.expectedCommit) {
    checks.push({
      name: 'deployed commit',
      status: 'skipped',
      reason:
        'READINESS_EXPECTED_COMMIT was provided, but no deployed commit response header contract exists yet.',
      expectedCommit: config.expectedCommit,
    })
  }

  const summary = summarizeChecks(checks)

  return {
    status: summary.failed > 0 ? 'failed' : 'ok',
    evidenceDate: new Date().toISOString(),
    environment: config.environment,
    frontendBaseUrl: config.frontendBaseUrl,
    apiBaseUrl: config.apiBaseUrl,
    frontendFallbackRoute: config.frontendFallbackRoute,
    expectedCommit: config.expectedCommit || null,
    tokenProvided: Boolean(config.bearerToken),
    summary,
    checks,
    safety: [
      'Raw bearer tokens, cookies, authorization codes, PKCE verifiers, client secrets, and private keys are not printed.',
      'READINESS_BEARER_TOKEN is used only as an Authorization header for /api/auth/session and is reported as tokenProvided only.',
    ],
  }
}

async function fetchJsonCheck({ name, url, fetchFn, timeoutMs }) {
  const fetched = await safeFetch(fetchFn, url, {
    headers: {
      accept: 'application/json',
      'cache-control': 'no-cache',
    },
    timeoutMs,
  })

  if (!fetched.ok) {
    return {
      ok: false,
      response: null,
      check: requestFailureCheck(name, url, fetched.error),
    }
  }

  const response = fetched.value

  if (!response.ok) {
    const body = await readResponseBody(response)
    return {
      ok: false,
      response,
      check: {
        name,
        status: 'failed',
        url,
        httpStatus: response.status,
        reason: `${name} returned ${response.status}`,
        response: sanitizeJsonLike(body),
      },
    }
  }

  const parsed = await readJsonResponse(response)

  if (!parsed.ok) {
    return {
      ok: false,
      response,
      check: {
        name,
        status: 'failed',
        url,
        httpStatus: response.status,
        reason: 'backend response was not valid JSON',
        bodySample: parsed.bodySample,
      },
    }
  }

  return {
    ok: true,
    response,
    body: parsed.body,
    check: {
      name,
      status: 'passed',
      url,
      httpStatus: response.status,
      response: sanitizeJsonLike(parsed.body),
    },
  }
}

async function fetchTextCheck({
  name,
  url,
  fetchFn,
  timeoutMs,
  expectedContentType,
}) {
  const fetched = await safeFetch(fetchFn, url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'cache-control': 'no-cache',
    },
    timeoutMs,
  })

  if (!fetched.ok) {
    return {
      ok: false,
      response: null,
      body: '',
      check: requestFailureCheck(name, url, fetched.error),
    }
  }

  const response = fetched.value
  const body = await response.text()
  const contentType = response.headers.get('content-type') ?? ''

  if (!response.ok) {
    return {
      ok: false,
      response,
      body,
      check: {
        name,
        status: 'failed',
        url,
        httpStatus: response.status,
        reason: `${name} returned ${response.status}`,
        bodySample: sanitizeBodySample(body),
      },
    }
  }

  if (expectedContentType && !contentType.toLowerCase().includes(expectedContentType)) {
    return {
      ok: false,
      response,
      body,
      check: {
        name,
        status: 'failed',
        url,
        httpStatus: response.status,
        reason: `${name} did not return ${expectedContentType}`,
        contentType,
        bodySample: sanitizeBodySample(body),
      },
    }
  }

  return {
    ok: true,
    response,
    body,
    check: {
      name,
      status: 'passed',
      url,
      httpStatus: response.status,
      contentType,
    },
  }
}

async function checkFrontendAssets({
  html,
  frontendBaseUrl,
  fetchFn,
  timeoutMs,
  assetCheckLimit,
}) {
  const assetUrls = extractAssetUrls(html, frontendBaseUrl).slice(0, assetCheckLimit)

  if (assetUrls.length === 0) {
    return [
      {
        name: 'frontend static assets',
        status: 'skipped',
        reason: 'No script or stylesheet assets were discovered in the frontend root document.',
      },
    ]
  }

  const checks = []

  for (const url of assetUrls) {
    const fetched = await safeFetch(fetchFn, url, {
      headers: {
        accept: '*/*',
        'cache-control': 'no-cache',
      },
      timeoutMs,
    })

    if (!fetched.ok) {
      checks.push(requestFailureCheck('frontend static asset', url, fetched.error))
      continue
    }

    const response = fetched.value
    const contentType = response.headers.get('content-type') ?? ''
    const body = await response.text()
    const lowerBody = body.trimStart().toLowerCase()
    const returnedHtml =
      contentType.toLowerCase().includes('text/html') ||
      lowerBody.startsWith('<!doctype html') ||
      lowerBody.startsWith('<html')

    if (!response.ok || returnedHtml) {
      checks.push({
        name: 'frontend static asset',
        status: 'failed',
        url,
        httpStatus: response.status,
        contentType,
        reason: !response.ok
          ? `asset returned ${response.status}`
          : 'asset URL returned HTML, which usually means the SPA fallback caught a stale or missing asset',
        bodySample: sanitizeBodySample(body),
      })
      continue
    }

    checks.push({
      name: 'frontend static asset',
      status: 'passed',
      url,
      httpStatus: response.status,
      contentType,
      bytes: Buffer.byteLength(body, 'utf8'),
    })
  }

  return checks
}

async function checkAuthSession({ config, fetchFn }) {
  if (!config.bearerToken) {
    return [
      {
        name: 'backend auth session',
        status: 'skipped',
        reason: 'READINESS_BEARER_TOKEN was not provided; real auth/session smoke was not executed.',
      },
    ]
  }

  const url = `${config.apiBaseUrl}/auth/session`
  const fetched = await safeFetch(fetchFn, url, {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${config.bearerToken}`,
      'cache-control': 'no-cache',
    },
    timeoutMs: config.timeoutMs,
  })

  if (!fetched.ok) {
    return [requestFailureCheck('backend auth session', url, fetched.error)]
  }

  const response = fetched.value

  if (!response.ok) {
    const body = await readResponseBody(response)
    return [
      {
        name: 'backend auth session',
        status: 'failed',
        httpStatus: response.status,
        reason: `auth session returned ${response.status}`,
        response: sanitizeJsonLike(body),
      },
    ]
  }

  const parsed = await readJsonResponse(response)

  if (!parsed.ok) {
    return [
      {
        name: 'backend auth session',
        status: 'failed',
        httpStatus: response.status,
        reason: 'auth session response was not valid JSON',
        bodySample: parsed.bodySample,
      },
    ]
  }

  const session = parsed.body
  const roleCodes = session?.user?.roleCodes
  const hasRoles = Array.isArray(roleCodes) && roleCodes.length > 0
  const hasReadScope = Boolean(session?.user?.readScope)
  const hasActionScope = Boolean(session?.user?.actionScope)

  if (session?.authenticated !== true || !hasRoles || !hasReadScope || !hasActionScope) {
    return [
      {
        name: 'backend auth session',
        status: 'failed',
        httpStatus: response.status,
        reason: 'auth session did not include authenticated user role/read/action scope data',
        response: sanitizeSession(session),
      },
    ]
  }

  return [
    {
      name: 'backend auth session',
      status: 'passed',
      httpStatus: response.status,
      response: sanitizeSession(session),
    },
  ]
}

function checkRateLimitHeaders(results) {
  const matched = results.find(({ response }) =>
    RATE_LIMIT_HEADERS.every((header) => response?.headers?.get(header)),
  )

  if (!matched) {
    return {
      name: 'backend rate limit headers',
      status: 'failed',
      reason: `No backend response contained all required rate limit headers: ${RATE_LIMIT_HEADERS.join(', ')}`,
    }
  }

  return {
    name: 'backend rate limit headers',
    status: 'passed',
    source: matched.check.name,
    headers: Object.fromEntries(
      RATE_LIMIT_HEADERS.map((header) => [header, matched.response.headers.get(header)]),
    ),
  }
}

function checkCorrelationHeaders(results) {
  return results.map(({ response, check }) => {
    const correlationId = response?.headers?.get('x-correlation-id')

    if (!correlationId) {
      return {
        name: `${check.name} correlation header`,
        status: 'failed',
        reason: 'backend response did not include x-correlation-id',
      }
    }

    return {
      name: `${check.name} correlation header`,
      status: 'passed',
      correlationId,
    }
  })
}

async function safeFetch(fetchFn, url, options) {
  try {
    return {
      ok: true,
      value: await fetchWithTimeout(fetchFn, url, options),
    }
  } catch (caught) {
    return {
      ok: false,
      error: caught,
    }
  }
}

async function fetchWithTimeout(fetchFn, url, { headers, timeoutMs }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetchFn(url, {
      headers,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

function requestFailureCheck(name, url, error) {
  return {
    name,
    status: 'failed',
    url,
    reason: `request failed: ${errorMessage(error)}`,
  }
}

function errorMessage(error) {
  if (error instanceof Error) {
    return error.name === 'AbortError' ? 'request timed out' : error.message
  }

  return String(error)
}

async function readJsonResponse(response) {
  const bodyText = await response.text()

  try {
    return {
      ok: true,
      body: JSON.parse(bodyText),
    }
  } catch {
    return {
      ok: false,
      bodySample: sanitizeBodySample(bodyText),
    }
  }
}

async function readResponseBody(response) {
  const bodyText = await response.text()

  try {
    return JSON.parse(bodyText)
  } catch {
    return {
      bodySample: sanitizeBodySample(bodyText),
    }
  }
}

function sanitizeSession(session) {
  return {
    authMode: session?.authMode,
    authenticated: session?.authenticated,
    user: {
      userId: session?.user?.userId ?? null,
      employeeId: session?.user?.employeeId ?? null,
      roleCodes: Array.isArray(session?.user?.roleCodes) ? session.user.roleCodes : [],
      readScope: session?.user?.readScope ?? null,
      actionScope: session?.user?.actionScope ?? null,
    },
    scopeSummary: session?.scopeSummary ?? null,
  }
}

function sanitizeJsonLike(value) {
  if (!value || typeof value !== 'object') {
    return value
  }

  return JSON.parse(
    JSON.stringify(value, (key, nestedValue) => {
      if (/authorization|cookie|token|secret|password|credential|private/i.test(key)) {
        return '<redacted>'
      }

      if (typeof nestedValue === 'string') {
        return nestedValue.replace(
          /\b(?:Bearer\s+)?[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
          '<redacted-jwt>',
        )
      }

      return nestedValue
    }),
  )
}

function summarizeChecks(checks) {
  return checks.reduce(
    (summary, check) => {
      summary.total += 1
      summary[check.status] = (summary[check.status] ?? 0) + 1
      return summary
    },
    {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
    },
  )
}

function extractAssetUrls(html, frontendBaseUrl) {
  if (!html) {
    return []
  }

  const urls = []
  const matches = html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)

  for (const match of matches) {
    const rawUrl = match[1]
    urls.push(new URL(rawUrl, frontendBaseUrl).toString())
  }

  return [...new Set(urls)]
}

function requireEnv(env, name) {
  const value = readEnv(env, name)

  if (!value) {
    throw new Error(`${name} is required`)
  }

  return value
}

function readEnv(env, name) {
  const value = env[name]
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function normalizeBaseUrl(value, envName) {
  const parsed = parseHttpUrl(value, envName)
  parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/'
  parsed.search = ''
  parsed.hash = ''

  return parsed.toString().replace(/\/$/, '')
}

function normalizeBackendApiBaseUrl(value, envName) {
  const parsed = parseHttpUrl(value, envName)
  const path = parsed.pathname.replace(/\/+$/, '')

  if (!path || path === '/') {
    parsed.pathname = '/api'
  } else {
    parsed.pathname = path
  }

  parsed.search = ''
  parsed.hash = ''

  return parsed.toString().replace(/\/$/, '')
}

function parseHttpUrl(value, envName) {
  let parsed

  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${envName} must be a valid HTTP(S) URL`)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${envName} must be an HTTP(S) URL`)
  }

  return parsed
}

function ensureLeadingSlash(value) {
  return value.startsWith('/') ? value : `/${value}`
}

function readPositiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function sanitizeBodySample(value) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 240)
}

function isMainModule() {
  return import.meta.url === pathToFileURL(process.argv[1]).href
}

if (isMainModule()) {
  try {
    const evidence = await runDeployedReadinessSmoke()
    console.log(JSON.stringify(evidence, null, 2))

    if (evidence.status !== 'ok') {
      process.exitCode = 1
    }
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught)
    console.error(
      JSON.stringify(
        {
          status: 'failed',
          evidenceDate: new Date().toISOString(),
          reason: message,
        },
        null,
        2,
      ),
    )
    process.exitCode = 1
  }
}
