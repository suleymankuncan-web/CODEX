import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  formatBackendReadinessLoadSummary,
  readBackendReadinessLoadConfig,
  runBackendReadinessLoadSmoke,
} from './backend-readiness-load-smoke.mjs'

const workspaceRoot = join(import.meta.dirname, '..')

test('backend load config normalizes backend origins and keeps protected routes optional by default', () => {
  const config = readBackendReadinessLoadConfig({
    BACKEND_LOAD_API_BASE_URL: 'https://api.example.test',
    BACKEND_LOAD_ITERATIONS: '2',
    BACKEND_LOAD_CONCURRENCY: '4',
    BACKEND_LOAD_TIMEOUT_MS: '9000',
  })

  assert.equal(config.apiBaseUrl, 'https://api.example.test/api')
  assert.equal(config.iterations, 2)
  assert.equal(config.concurrency, 4)
  assert.equal(config.timeoutMs, 9000)
  assert.equal(config.requireProtected, false)
})

test('backend load smoke measures public health and blocks protected budgets without a token', async () => {
  const requestedUrls = []
  const evidence = await runBackendReadinessLoadSmoke({
    config: {
      environment: 'test',
      apiBaseUrl: 'https://api.example.test/api',
      iterations: 1,
      concurrency: 2,
      timeoutMs: 1000,
      tokens: emptyTokens(),
      allowSharedToken: false,
      requireProtected: false,
      output: 'json',
    },
    now: () => '2026-05-18T00:00:00.000Z',
    fetchFn: async (url) => {
      requestedUrls.push(url)
      return jsonResponse({ ok: true })
    },
  })

  assert.equal(evidence.status, 'blocked')
  assert.equal(evidence.summary.passed, 1)
  assert.equal(evidence.summary.skipped, 4)
  assert.equal(evidence.groups[0].status, 'passed')
  assert.ok(evidence.groups.slice(1).every((group) => group.status === 'skipped'))
  assert.deepEqual(requestedUrls.sort(), [
    'https://api.example.test/api/health',
    'https://api.example.test/api/health/live',
  ])
})

test('backend load smoke does not reuse a shared token across role-specific groups by default', async () => {
  const requestedUrls = []
  const evidence = await runBackendReadinessLoadSmoke({
    config: {
      environment: 'test',
      apiBaseUrl: 'https://api.example.test/api',
      iterations: 1,
      concurrency: 2,
      timeoutMs: 1000,
      tokens: {
        ...emptyTokens(),
        shared: { source: 'BACKEND_LOAD_BEARER_TOKEN', value: 'shared-token-value' },
        session: { source: 'BACKEND_LOAD_BEARER_TOKEN', value: 'shared-token-value' },
      },
      allowSharedToken: false,
      requireProtected: false,
      output: 'json',
    },
    now: () => '2026-05-18T00:00:00.000Z',
    fetchFn: async (url) => {
      requestedUrls.push(url)
      return jsonResponse({ ok: true, data: [] })
    },
  })

  assert.equal(evidence.status, 'blocked')
  assert.equal(evidence.summary.passed, 2)
  assert.equal(evidence.summary.skipped, 3)
  assert.ok(requestedUrls.some((url) => url.endsWith('/auth/session')))
  assert.ok(!requestedUrls.some((url) => url.includes('/integrations/import-batches/overview')))
  assert.doesNotMatch(JSON.stringify(evidence), /shared-token-value/)
  assert.match(
    evidence.groups.find((group) => group.name === 'import read routes').reason,
    /BACKEND_LOAD_ALLOW_SHARED_TOKEN=true/,
  )
})

test('backend load smoke runs protected groups with role-specific tokens and redacts token material', async () => {
  const authHeaders = []
  const evidence = await runBackendReadinessLoadSmoke({
    config: {
      environment: 'test',
      apiBaseUrl: 'https://api.example.test/api',
      iterations: 1,
      concurrency: 3,
      timeoutMs: 1000,
      tokens: {
        shared: null,
        session: { source: 'BACKEND_LOAD_SESSION_TOKEN', value: 'session-token-value' },
        store: { source: 'BACKEND_LOAD_STORE_TOKEN', value: 'store-token-value' },
        competition: { source: 'BACKEND_LOAD_COMPETITION_TOKEN', value: 'competition-token-value' },
        import: { source: 'BACKEND_LOAD_IMPORT_TOKEN', value: 'import-token-value' },
      },
      allowSharedToken: false,
      requireProtected: true,
      output: 'json',
    },
    now: () => '2026-05-18T00:00:00.000Z',
    fetchFn: async (_url, init) => {
      authHeaders.push(init.headers.authorization ?? '')
      return jsonResponse({ ok: true, data: [] })
    },
  })

  assert.equal(evidence.status, 'ok')
  assert.equal(evidence.summary.passed, 5)
  assert.equal(evidence.summary.skipped, 0)
  assert.ok(authHeaders.includes('Bearer store-token-value'))
  assert.ok(authHeaders.includes('Bearer import-token-value'))
  assert.equal(evidence.tokenSources.store, 'BACKEND_LOAD_STORE_TOKEN')
  assert.equal(evidence.tokenSources.import, 'BACKEND_LOAD_IMPORT_TOKEN')
  assert.doesNotMatch(JSON.stringify(evidence), /session-token-value|store-token-value|competition-token-value|import-token-value/)
  assert.equal(evidence.excludedMutationRoutes[0].path, '/integrations/power-bi-export-upload')
})

test('backend load smoke fails API routes that return HTML or 5xx responses', async () => {
  const evidence = await runBackendReadinessLoadSmoke({
    config: {
      environment: 'test',
      apiBaseUrl: 'https://api.example.test/api',
      iterations: 1,
      concurrency: 2,
      timeoutMs: 1000,
      tokens: {
        shared: null,
        session: { source: 'BACKEND_LOAD_SESSION_TOKEN', value: 'session-token' },
        store: { source: 'BACKEND_LOAD_STORE_TOKEN', value: 'store-token' },
        competition: { source: 'BACKEND_LOAD_COMPETITION_TOKEN', value: 'competition-token' },
        import: { source: 'BACKEND_LOAD_IMPORT_TOKEN', value: 'import-token' },
      },
      allowSharedToken: false,
      requireProtected: true,
      output: 'json',
    },
    now: () => '2026-05-18T00:00:00.000Z',
    fetchFn: async (url) => {
      if (url.endsWith('/competitions?limit=20&offset=0')) {
        return new Response('<html>wrong edge fallback</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })
      }

      if (url.endsWith('/integrations/import-batches/overview')) {
        return jsonResponse({ error: 'boom' }, 503)
      }

      return jsonResponse({ ok: true })
    },
  })

  assert.equal(evidence.status, 'failed')
  const competitionGroup = evidence.groups.find((group) => group.name === 'competition read routes')
  const importGroup = evidence.groups.find((group) => group.name === 'import read routes')

  assert.equal(competitionGroup.status, 'failed')
  assert.match(competitionGroup.failures.join(' '), /HTML|non-JSON/)
  assert.equal(importGroup.status, 'failed')
  assert.match(importGroup.failures.join(' '), /5xx|availability/)
})

test('backend load smoke summary and docs expose the production readiness command', () => {
  const pkg = JSON.parse(readFileSync(join(workspaceRoot, 'package.json'), 'utf8'))
  const checklist = readFileSync(
    join(workspaceRoot, 'docs/plans/production-environment-readiness-checklist.md'),
    'utf8',
  )
  const plan = readFileSync(join(workspaceRoot, 'docs/plans/performance-baseline.md'), 'utf8')

  assert.equal(
    pkg.scripts['smoke:backend-readiness-load'],
    'node scripts/backend-readiness-load-smoke.mjs',
  )

  for (const expected of [
    'npm.cmd run smoke:backend-readiness-load',
    'BACKEND_LOAD_BEARER_TOKEN',
    'BACKEND_LOAD_STORE_TOKEN',
    'BACKEND_LOAD_IMPORT_TOKEN',
    'BACKEND_LOAD_ALLOW_SHARED_TOKEN=true',
    'public api health',
    'competition read routes',
    'Upload/import mutations are excluded',
  ]) {
    assert.ok(checklist.includes(expected) || plan.includes(expected), `Missing ${expected}`)
  }

  const summary = formatBackendReadinessLoadSummary({
    status: 'blocked',
    environment: 'test',
    apiBaseUrl: 'https://api.example.test/api',
    iterations: 1,
    concurrency: 2,
    groups: [
      {
        name: 'public api health',
        status: 'passed',
        availability: 1,
        p50Ms: 10,
        p95Ms: 20,
        fiveXxCount: 0,
      },
      {
        name: 'authenticated session',
        status: 'skipped',
        reason: 'missing token',
      },
    ],
    excludedMutationRoutes: [{ method: 'POST', path: '/integrations/power-bi-export-upload' }],
  })

  assert.match(summary, /Backend readiness load smoke: blocked/)
  assert.match(summary, /public api health: passed/)
  assert.match(summary, /Excluded mutation routes/)
})

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function emptyTokens() {
  return {
    shared: null,
    session: null,
    store: null,
    competition: null,
    import: null,
  }
}
