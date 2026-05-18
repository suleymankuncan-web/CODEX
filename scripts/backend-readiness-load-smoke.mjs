import { pathToFileURL } from 'node:url'

const DEFAULT_API_BASE_URL = 'https://api-staging.hr-axis.com/api'
const DEFAULT_ITERATIONS = 3
const DEFAULT_CONCURRENCY = 2
const DEFAULT_TIMEOUT_MS = 15_000

const ROUTE_GROUPS = [
  {
    name: 'public api health',
    description: 'Public readiness endpoints used by deploy and uptime checks.',
    requiresAuth: false,
    budget: {
      minAvailability: 1,
      maxP50Ms: 500,
      maxP95Ms: 1_200,
      max5xx: 0,
    },
    endpoints: [
      { label: 'live health', method: 'GET', path: '/health/live' },
      { label: 'dependency health', method: 'GET', path: '/health' },
    ],
  },
  {
    name: 'authenticated session',
    description: 'Auth/session contract for real browser users.',
    requiresAuth: true,
    budget: {
      minAvailability: 1,
      maxP50Ms: 700,
      maxP95Ms: 1_500,
      max5xx: 0,
    },
    endpoints: [{ label: 'auth session', method: 'GET', path: '/auth/session' }],
  },
  {
    name: 'store read routes',
    description: 'Store dashboard, score, ranking, and self-performance reads.',
    requiresAuth: true,
    budget: {
      minAvailability: 1,
      maxP50Ms: 900,
      maxP95Ms: 2_000,
      max5xx: 0,
    },
    endpoints: [
      { label: 'kpi config', method: 'GET', path: '/reports/kpi-config' },
      {
        label: 'my performance monthly',
        method: 'GET',
        path: '/reports/my-performance?mode=live&periodType=monthly',
      },
      {
        label: 'rankings monthly',
        method: 'GET',
        path: '/reports/rankings?periodType=monthly&limit=20&offset=0',
      },
      {
        label: 'closed leaderboard monthly',
        method: 'GET',
        path: '/reports/leaderboards/closed?periodType=monthly&limit=10',
      },
      {
        label: 'store kpi highlights',
        method: 'GET',
        path: '/reports/store-kpi-highlights?periodType=monthly',
      },
    ],
  },
  {
    name: 'competition read routes',
    description: 'Competition list surface used by the competitions page.',
    requiresAuth: true,
    budget: {
      minAvailability: 1,
      maxP50Ms: 900,
      maxP95Ms: 2_000,
      max5xx: 0,
    },
    endpoints: [{ label: 'competition list', method: 'GET', path: '/competitions?limit=20&offset=0' }],
  },
  {
    name: 'import read routes',
    description: 'Import and upload-adjacent read surfaces; upload mutations are excluded.',
    requiresAuth: true,
    budget: {
      minAvailability: 1,
      maxP50Ms: 1_000,
      maxP95Ms: 2_500,
      max5xx: 0,
    },
    endpoints: [
      {
        label: 'import overview',
        method: 'GET',
        path: '/integrations/import-batches/overview',
      },
      {
        label: 'import needs action',
        method: 'GET',
        path: '/integrations/import-batches/needs-action?limit=12&offset=0',
      },
    ],
  },
]

const EXCLUDED_MUTATION_ROUTES = [
  {
    method: 'POST',
    path: '/integrations/power-bi-export-upload',
    reason:
      'Upload parsing is file-size, worker-timeout, and queue/resource-risk tested separately; it is not a simple GET latency budget.',
  },
  {
    method: 'POST',
    path: '/integrations/import-batches',
    reason:
      'Import command acceptance and background materialization have separate benchmark/runbook evidence.',
  },
  {
    method: 'POST',
    path: '/snapshots/runs',
    reason:
      'Snapshot command acceptance and background completion are not part of this simple read-load smoke.',
  },
]

export function readBackendReadinessLoadConfig(env = process.env) {
  const apiBaseUrl = normalizeBackendApiBaseUrl(
    readEnv(env, 'BACKEND_LOAD_API_BASE_URL') ||
      readEnv(env, 'READINESS_BACKEND_URL') ||
      DEFAULT_API_BASE_URL,
    'BACKEND_LOAD_API_BASE_URL',
  )

  return {
    environment:
      readEnv(env, 'BACKEND_LOAD_ENVIRONMENT') || readEnv(env, 'READINESS_ENVIRONMENT') || 'staging',
    apiBaseUrl,
    iterations: readPositiveInteger(env.BACKEND_LOAD_ITERATIONS, DEFAULT_ITERATIONS),
    concurrency: readPositiveInteger(env.BACKEND_LOAD_CONCURRENCY, DEFAULT_CONCURRENCY),
    timeoutMs: readPositiveInteger(env.BACKEND_LOAD_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    bearerToken: readBearerToken(env),
    requireProtected: env.BACKEND_LOAD_REQUIRE_PROTECTED === 'true',
    output: readEnv(env, 'BACKEND_LOAD_OUTPUT') || 'both',
  }
}

export async function runBackendReadinessLoadSmoke(input = {}) {
  const config = input.config ?? readBackendReadinessLoadConfig(input.env ?? process.env)
  const fetchFn = input.fetchFn ?? globalThis.fetch
  const now = input.now ?? (() => new Date().toISOString())

  if (typeof fetchFn !== 'function') {
    throw new Error('A fetch implementation is required for backend readiness load smoke')
  }

  const groups = []

  for (const group of ROUTE_GROUPS) {
    if (group.requiresAuth && !config.bearerToken) {
      groups.push({
        name: group.name,
        description: group.description,
        status: 'skipped',
        reason:
          'No BACKEND_LOAD_BEARER_TOKEN or READINESS_BEARER_TOKEN was provided; protected route budget was not executed.',
        requiresAuth: true,
        budget: group.budget,
        endpoints: group.endpoints.map(({ label, method, path }) => ({ label, method, path })),
      })
      continue
    }

    groups.push(
      await measureGroup({
        group,
        config,
        fetchFn,
      }),
    )
  }

  const summary = summarizeGroups(groups)
  const status = summary.failed > 0 ? 'failed' : summary.skipped > 0 ? 'blocked' : 'ok'

  return {
    status,
    evidenceDate: now(),
    environment: config.environment,
    apiBaseUrl: config.apiBaseUrl,
    iterations: config.iterations,
    concurrency: config.concurrency,
    timeoutMs: config.timeoutMs,
    tokenProvided: Boolean(config.bearerToken),
    summary,
    groups,
    excludedMutationRoutes: EXCLUDED_MUTATION_ROUTES,
    safety: [
      'Raw bearer tokens, Clerk cookies, authorization codes, PKCE verifiers, client secrets, and private keys are not printed.',
      'Protected route groups are skipped, not marked as passed, when no real bearer token is provided.',
      'API correctness requires non-HTML JSON responses; SPA fallback HTML from API routes is treated as a failure.',
    ],
  }
}

export function formatBackendReadinessLoadSummary(evidence) {
  const lines = [
    `Backend readiness load smoke: ${evidence.status}`,
    `Environment: ${evidence.environment}`,
    `API: ${evidence.apiBaseUrl}`,
    `Iterations: ${evidence.iterations}, concurrency: ${evidence.concurrency}`,
  ]

  for (const group of evidence.groups) {
    if (group.status === 'skipped') {
      lines.push(`- ${group.name}: skipped (${group.reason})`)
      continue
    }

    lines.push(
      `- ${group.name}: ${group.status}, availability ${formatPercent(group.availability)}, p50 ${group.p50Ms}ms, p95 ${group.p95Ms}ms, 5xx ${group.fiveXxCount}`,
    )
  }

  if (evidence.excludedMutationRoutes.length > 0) {
    lines.push(
      `Excluded mutation routes: ${evidence.excludedMutationRoutes
        .map((route) => `${route.method} ${route.path}`)
        .join(', ')}`,
    )
  }

  return lines.join('\n')
}

async function measureGroup({ group, config, fetchFn }) {
  const tasks = []

  for (const endpoint of group.endpoints) {
    for (let iteration = 1; iteration <= config.iterations; iteration += 1) {
      tasks.push(() =>
        measureEndpoint({
          endpoint,
          iteration,
          config,
          fetchFn,
        }),
      )
    }
  }

  const samples = await runWithConcurrency(tasks, config.concurrency)
  const endpointSummaries = summarizeEndpoints(samples)
  const durations = samples.map((sample) => sample.durationMs).sort((left, right) => left - right)
  const passedCount = samples.filter((sample) => sample.passed).length
  const fiveXxCount = samples.filter((sample) => typeof sample.status === 'number' && sample.status >= 500).length
  const availability = samples.length > 0 ? passedCount / samples.length : 0
  const p50Ms = percentile(durations, 0.5)
  const p95Ms = percentile(durations, 0.95)
  const failures = evaluateBudget({
    budget: group.budget,
    availability,
    p50Ms,
    p95Ms,
    fiveXxCount,
    samples,
  })

  return {
    name: group.name,
    description: group.description,
    status: failures.length > 0 ? 'failed' : 'passed',
    requiresAuth: group.requiresAuth,
    budget: group.budget,
    samples: samples.length,
    availability,
    p50Ms,
    p95Ms,
    maxMs: round(durations[durations.length - 1] ?? 0, 2),
    fiveXxCount,
    failures,
    endpoints: endpointSummaries,
  }
}

async function measureEndpoint({ endpoint, iteration, config, fetchFn }) {
  const url = `${config.apiBaseUrl}${ensureLeadingSlash(endpoint.path)}`
  const startedAt = performance.now()

  try {
    const response = await fetchWithTimeout(fetchFn, url, {
      headers: buildHeaders(config),
      timeoutMs: config.timeoutMs,
    })
    const durationMs = round(performance.now() - startedAt, 2)
    const contentType = response.headers.get('content-type') ?? ''
    const body = await response.text()
    const bytes = Buffer.byteLength(body, 'utf8')
    const bodyLooksHtml = looksLikeHtml(body, contentType)
    const jsonOk = isJsonResponse(body, contentType)
    const passed = response.ok && jsonOk && !bodyLooksHtml

    return {
      label: endpoint.label,
      method: endpoint.method,
      path: endpoint.path,
      iteration,
      status: response.status,
      durationMs,
      contentType,
      bytes,
      passed,
      ...(passed
        ? {}
        : {
            reason: sampleFailureReason({
              response,
              bodyLooksHtml,
              jsonOk,
            }),
            bodySample: sanitizeBodySample(body),
          }),
    }
  } catch (caught) {
    return {
      label: endpoint.label,
      method: endpoint.method,
      path: endpoint.path,
      iteration,
      status: null,
      durationMs: round(performance.now() - startedAt, 2),
      contentType: null,
      bytes: 0,
      passed: false,
      reason: `request failed: ${errorMessage(caught)}`,
    }
  }
}

function summarizeEndpoints(samples) {
  const groups = new Map()

  for (const sample of samples) {
    const key = `${sample.method} ${sample.path}`
    const current = groups.get(key) ?? []
    current.push(sample)
    groups.set(key, current)
  }

  return [...groups.entries()].map(([key, group]) => {
    const durations = group.map((sample) => sample.durationMs).sort((left, right) => left - right)
    const passedCount = group.filter((sample) => sample.passed).length
    const fiveXxCount = group.filter(
      (sample) => typeof sample.status === 'number' && sample.status >= 500,
    ).length
    const [method, ...rest] = key.split(' ')

    return {
      label: group[0]?.label ?? key,
      method,
      path: rest.join(' '),
      samples: group.length,
      availability: group.length > 0 ? passedCount / group.length : 0,
      statuses: [...new Set(group.map((sample) => sample.status ?? 'request-error'))],
      p50Ms: percentile(durations, 0.5),
      p95Ms: percentile(durations, 0.95),
      maxMs: round(durations[durations.length - 1] ?? 0, 2),
      fiveXxCount,
      failures: group
        .filter((sample) => !sample.passed)
        .slice(0, 3)
        .map(({ iteration, status, reason, bodySample }) => ({
          iteration,
          status,
          reason,
          ...(bodySample ? { bodySample } : {}),
        })),
    }
  })
}

function evaluateBudget({ budget, availability, p50Ms, p95Ms, fiveXxCount, samples }) {
  const failures = []

  if (availability < budget.minAvailability) {
    failures.push(
      `availability ${formatPercent(availability)} is below ${formatPercent(budget.minAvailability)}`,
    )
  }

  if (p50Ms > budget.maxP50Ms) {
    failures.push(`p50 ${p50Ms}ms is above ${budget.maxP50Ms}ms`)
  }

  if (p95Ms > budget.maxP95Ms) {
    failures.push(`p95 ${p95Ms}ms is above ${budget.maxP95Ms}ms`)
  }

  if (fiveXxCount > budget.max5xx) {
    failures.push(`5xx count ${fiveXxCount} is above ${budget.max5xx}`)
  }

  const nonJsonFailures = samples.filter((sample) => !sample.passed && /non-JSON|HTML/i.test(sample.reason ?? ''))

  if (nonJsonFailures.length > 0) {
    failures.push(`${nonJsonFailures.length} API samples returned non-JSON or HTML responses`)
  }

  return failures
}

function summarizeGroups(groups) {
  return groups.reduce(
    (summary, group) => {
      summary.total += 1
      summary[group.status] = (summary[group.status] ?? 0) + 1
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

async function runWithConcurrency(tasks, concurrency) {
  const results = []
  let nextIndex = 0

  async function worker() {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await tasks[currentIndex]()
    }
  }

  const workerCount = Math.min(concurrency, tasks.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

async function fetchWithTimeout(fetchFn, url, { headers, timeoutMs }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetchFn(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

function buildHeaders(config) {
  const headers = {
    accept: 'application/json',
    'cache-control': 'no-cache',
  }

  if (config.bearerToken) {
    headers.authorization = `Bearer ${config.bearerToken}`
  }

  return headers
}

function readBearerToken(env) {
  return (
    readEnv(env, 'BACKEND_LOAD_BEARER_TOKEN') ||
    readEnv(env, 'READINESS_BEARER_TOKEN') ||
    readEnv(env, 'PROTECTED_PERF_TOKEN') ||
    readEnv(env, 'PERF_AUTH_TOKEN') ||
    ''
  )
}

function sampleFailureReason({ response, bodyLooksHtml, jsonOk }) {
  if (!response.ok) {
    return `HTTP ${response.status}`
  }

  if (bodyLooksHtml) {
    return 'API returned HTML instead of JSON'
  }

  if (!jsonOk) {
    return 'API returned non-JSON response'
  }

  return 'API response failed readiness checks'
}

function looksLikeHtml(body, contentType) {
  const lowerType = contentType.toLowerCase()
  const lowerBody = body.trimStart().toLowerCase()

  return (
    lowerType.includes('text/html') ||
    lowerBody.startsWith('<!doctype html') ||
    lowerBody.startsWith('<html')
  )
}

function isJsonResponse(body, contentType) {
  if (!contentType.toLowerCase().includes('application/json')) {
    return false
  }

  try {
    JSON.parse(body)
    return true
  } catch {
    return false
  }
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

function readEnv(env, name) {
  const value = env[name]
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function readPositiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function percentile(values, ratio) {
  if (values.length === 0) {
    return 0
  }

  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * ratio) - 1))
  return round(values[index] ?? 0, 2)
}

function round(value, digits) {
  return Number(value.toFixed(digits))
}

function formatPercent(value) {
  return `${round(value * 100, 2)}%`
}

function sanitizeBodySample(value) {
  return value
    .replace(/\b(?:Bearer\s+)?[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '<redacted-jwt>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240)
}

function errorMessage(error) {
  if (error instanceof Error) {
    return error.name === 'AbortError' ? 'request timed out' : error.message
  }

  return String(error)
}

function isMainModule() {
  return import.meta.url === pathToFileURL(process.argv[1]).href
}

if (isMainModule()) {
  try {
    const config = readBackendReadinessLoadConfig()
    const evidence = await runBackendReadinessLoadSmoke({ config })
    const output = config.output.toLowerCase()

    if (output === 'text' || output === 'both') {
      console.log(formatBackendReadinessLoadSummary(evidence))
    }

    if (output === 'json' || output === 'both') {
      console.log(JSON.stringify(evidence, null, 2))
    }

    if (evidence.status === 'failed') {
      process.exitCode = 1
    } else if (evidence.status === 'blocked' && config.requireProtected) {
      process.exitCode = 2
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
