import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  readDeployedReadinessConfig,
  runDeployedReadinessSmoke,
} from './deployed-readiness-smoke.mjs'

const backendHeaders = {
  'content-type': 'application/json',
  'x-correlation-id': 'corr-123',
  'x-ratelimit-limit': '120',
  'x-ratelimit-remaining': '119',
  'x-ratelimit-reset': '2026-05-18T00:00:00.000Z',
}
const frontendSecurityHeaders = {
  'content-security-policy':
    "default-src 'self'; script-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://*.clerk.dev https://challenges.cloudflare.com; connect-src 'self' https://api-staging.hr-axis.com https://api.hr-axis.com https://*.clerk.accounts.dev https://*.clerk.com https://*.clerk.dev https://o4511716657987584.ingest.de.sentry.io; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
}

test('deployed readiness config accepts backend origin or api base url', () => {
  const fromOrigin = readDeployedReadinessConfig({
    READINESS_FRONTEND_URL: 'https://app.example.com/',
    READINESS_BACKEND_URL: 'https://api.example.com/',
  })
  const fromApiBase = readDeployedReadinessConfig({
    READINESS_FRONTEND_URL: 'https://app.example.com/',
    READINESS_BACKEND_URL: 'https://api.example.com/api/',
  })

  assert.equal(fromOrigin.frontendBaseUrl, 'https://app.example.com')
  assert.equal(fromOrigin.apiBaseUrl, 'https://api.example.com/api')
  assert.equal(fromApiBase.apiBaseUrl, 'https://api.example.com/api')
})

test('deployed readiness config requires frontend and backend urls', () => {
  assert.throws(
    () => readDeployedReadinessConfig({ READINESS_BACKEND_URL: 'https://api.example.com' }),
    /READINESS_FRONTEND_URL is required/,
  )
  assert.throws(
    () => readDeployedReadinessConfig({ READINESS_FRONTEND_URL: 'https://app.example.com' }),
    /READINESS_BACKEND_URL is required/,
  )
})

test('deployed readiness smoke passes public deploy checks and skips auth without token', async () => {
  const fetchFn = createFetch({
    'https://api.example.com/api/health/live': () =>
      jsonResponse({ status: 'ok', service: 'api' }, { headers: backendHeaders }),
    'https://api.example.com/api/health': () =>
      jsonResponse(
        {
          status: 'ok',
          dependencies: { database: { status: 'ok' } },
        },
        { headers: backendHeaders },
      ),
    'https://app.example.com/': () =>
      htmlResponse('<html><script type="module" src="/assets/index.js"></script></html>'),
    'https://app.example.com/store/me': () => htmlResponse('<html><main>Store</main></html>'),
    'https://app.example.com/assets/index.js': () =>
      textResponse('console.log("ok")', {
        headers: { 'content-type': 'application/javascript' },
      }),
  })

  const evidence = await runDeployedReadinessSmoke({
    env: {
      READINESS_ENVIRONMENT: 'staging',
      READINESS_FRONTEND_URL: 'https://app.example.com',
      READINESS_BACKEND_URL: 'https://api.example.com',
    },
    fetchFn,
  })

  assert.equal(evidence.status, 'ok')
  assert.equal(evidence.tokenProvided, false)
  assert.equal(evidence.summary.failed, 0)
  assert.ok(evidence.checks.some((check) => check.name === 'backend auth session' && check.status === 'skipped'))
})

test('deployed readiness smoke calls auth session with bearer token and redacts token from evidence', async () => {
  const token = 'header.payload.signature'
  const fetchFn = createFetch({
    'https://api.example.com/api/health/live': () =>
      jsonResponse({ status: 'ok' }, { headers: backendHeaders }),
    'https://api.example.com/api/health': () =>
      jsonResponse({ status: 'ok' }, { headers: backendHeaders }),
    'https://api.example.com/api/auth/session': () =>
      jsonResponse(
        {
          authMode: 'jwt',
          authenticated: true,
          user: {
            userId: '80000000-0000-0000-0000-000000000001',
            employeeId: null,
            roleCodes: ['STORE_MANAGER'],
            readScope: { companyIds: ['company'], regionIds: [], storeIds: ['store'] },
            actionScope: { assignedStoreIds: ['store'] },
          },
          scopeSummary: {
            companyCount: 1,
            regionCount: 0,
            storeCount: 1,
            assignedStoreCount: 1,
          },
        },
        { headers: backendHeaders },
      ),
    'https://app.example.com/': () =>
      htmlResponse('<html><link rel="stylesheet" href="/assets/index.css"></html>'),
    'https://app.example.com/store/me': () => htmlResponse('<html><main>Store</main></html>'),
    'https://app.example.com/assets/index.css': () =>
      textResponse('body { color: #111; }', {
        headers: { 'content-type': 'text/css' },
      }),
  })

  const evidence = await runDeployedReadinessSmoke({
    env: {
      READINESS_FRONTEND_URL: 'https://app.example.com',
      READINESS_BACKEND_URL: 'https://api.example.com/api',
      READINESS_BEARER_TOKEN: token,
    },
    fetchFn,
  })
  const authCall = fetchFn.calls.find((call) => call.url.endsWith('/auth/session'))

  assert.equal(evidence.status, 'ok')
  assert.equal(evidence.tokenProvided, true)
  assert.equal(authCall.options.headers.authorization, `Bearer ${token}`)
  assert.equal(JSON.stringify(evidence).includes(token), false)
})

test('deployed readiness smoke fails when backend rate limit headers are absent', async () => {
  const headersWithoutRateLimit = {
    'content-type': 'application/json',
    'x-correlation-id': 'corr-123',
  }
  const fetchFn = createFetch({
    'https://api.example.com/api/health/live': () =>
      jsonResponse({ status: 'ok' }, { headers: headersWithoutRateLimit }),
    'https://api.example.com/api/health': () =>
      jsonResponse({ status: 'ok' }, { headers: headersWithoutRateLimit }),
    'https://app.example.com/': () => htmlResponse('<html></html>'),
    'https://app.example.com/store/me': () => htmlResponse('<html></html>'),
  })

  const evidence = await runDeployedReadinessSmoke({
    env: {
      READINESS_FRONTEND_URL: 'https://app.example.com',
      READINESS_BACKEND_URL: 'https://api.example.com',
    },
    fetchFn,
  })

  assert.equal(evidence.status, 'failed')
  assert.ok(
    evidence.checks.some(
      (check) => check.name === 'backend rate limit headers' && check.status === 'failed',
    ),
  )
})

test('deployed readiness smoke fails on non-json backend health responses', async () => {
  const fetchFn = createFetch({
    'https://api.example.com/api/health/live': () =>
      textResponse('<html>not json</html>', {
        headers: backendHeaders,
      }),
    'https://api.example.com/api/health': () =>
      jsonResponse({ status: 'ok' }, { headers: backendHeaders }),
    'https://app.example.com/': () => htmlResponse('<html></html>'),
    'https://app.example.com/store/me': () => htmlResponse('<html></html>'),
  })

  const evidence = await runDeployedReadinessSmoke({
    env: {
      READINESS_FRONTEND_URL: 'https://app.example.com',
      READINESS_BACKEND_URL: 'https://api.example.com',
    },
    fetchFn,
  })

  assert.equal(evidence.status, 'failed')
  assert.ok(
    evidence.checks.some(
      (check) =>
        check.name === 'backend health live' &&
        check.status === 'failed' &&
        check.reason === 'backend response was not valid JSON',
    ),
  )
})

test('deployed readiness smoke fails when a discovered asset returns html', async () => {
  const fetchFn = createFetch({
    'https://api.example.com/api/health/live': () =>
      jsonResponse({ status: 'ok' }, { headers: backendHeaders }),
    'https://api.example.com/api/health': () =>
      jsonResponse({ status: 'ok' }, { headers: backendHeaders }),
    'https://app.example.com/': () =>
      htmlResponse('<html><script type="module" src="/assets/missing.js"></script></html>'),
    'https://app.example.com/store/me': () => htmlResponse('<html></html>'),
    'https://app.example.com/assets/missing.js': () =>
      htmlResponse('<html><main>fallback</main></html>'),
  })

  const evidence = await runDeployedReadinessSmoke({
    env: {
      READINESS_FRONTEND_URL: 'https://app.example.com',
      READINESS_BACKEND_URL: 'https://api.example.com',
    },
    fetchFn,
  })

  assert.equal(evidence.status, 'failed')
  assert.ok(
    evidence.checks.some(
      (check) =>
        check.name === 'frontend static asset' &&
        check.status === 'failed' &&
        check.reason.includes('asset URL returned HTML'),
    ),
  )
})

test('deployed readiness smoke fails when frontend security headers are missing', async () => {
  const fetchFn = createFetch({
    'https://api.example.com/api/health/live': () =>
      jsonResponse({ status: 'ok' }, { headers: backendHeaders }),
    'https://api.example.com/api/health': () =>
      jsonResponse({ status: 'ok' }, { headers: backendHeaders }),
    'https://app.example.com/': () =>
      textResponse('<html></html>', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    'https://app.example.com/store/me': () => htmlResponse('<html></html>'),
  })

  const evidence = await runDeployedReadinessSmoke({
    env: {
      READINESS_FRONTEND_URL: 'https://app.example.com',
      READINESS_BACKEND_URL: 'https://api.example.com',
    },
    fetchFn,
  })

  assert.equal(evidence.status, 'failed')
  assert.ok(
    evidence.checks.some(
      (check) =>
        check.name === 'frontend security headers' &&
        check.status === 'failed' &&
        check.missing.includes('content-security-policy'),
    ),
  )
})

test('deployed readiness smoke reports request failures as failed checks', async () => {
  const fetchFn = createFetch({
    'https://api.example.com/api/health/live': () =>
      jsonResponse({ status: 'ok' }, { headers: backendHeaders }),
    'https://api.example.com/api/health': () =>
      jsonResponse({ status: 'ok' }, { headers: backendHeaders }),
    'https://app.example.com/': () => {
      throw new DOMException('The operation was aborted', 'AbortError')
    },
    'https://app.example.com/store/me': () => htmlResponse('<html></html>'),
  })

  const evidence = await runDeployedReadinessSmoke({
    env: {
      READINESS_FRONTEND_URL: 'https://app.example.com',
      READINESS_BACKEND_URL: 'https://api.example.com',
    },
    fetchFn,
  })

  assert.equal(evidence.status, 'failed')
  assert.ok(
    evidence.checks.some(
      (check) =>
        check.name === 'frontend root' &&
        check.status === 'failed' &&
        check.reason === 'request failed: request timed out',
    ),
  )
})

function createFetch(routes) {
  const calls = []
  const fetchFn = async (url, options = {}) => {
    const normalizedUrl = String(url)
    calls.push({ url: normalizedUrl, options })
    const route = routes[normalizedUrl]

    if (!route) {
      throw new Error(`Unexpected fetch: ${normalizedUrl}`)
    }

    return route({ url: normalizedUrl, options })
  }
  fetchFn.calls = calls

  return fetchFn
}

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  })
}

function htmlResponse(body, { status = 200, headers = {} } = {}) {
  return textResponse(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      ...frontendSecurityHeaders,
      ...headers,
    },
  })
}

function textResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(body, {
    status,
    headers,
  })
}
