import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  formatCapacityReadBaselineSummary,
  parseLevels,
  readCapacityReadBaselineConfig,
  runCapacityReadBaseline,
} from './capacity-read-baseline.mjs'

const workspaceRoot = join(import.meta.dirname, '..')

test('capacity config defaults to public-only and guards accidental high concurrency', () => {
  const config = readCapacityReadBaselineConfig({
    CAPACITY_API_BASE_URL: 'https://api.example.test',
    CAPACITY_LEVELS: '5,1,5',
    CAPACITY_TIMEOUT_MS: '9000',
  })

  assert.equal(config.apiBaseUrl, 'https://api.example.test/api')
  assert.deepEqual(config.levels, [1, 5])
  assert.equal(config.timeoutMs, 9000)
  assert.deepEqual(config.profiles, ['public'])
  assert.equal(config.stopOnFailure, true)

  assert.throws(
    () =>
      readCapacityReadBaselineConfig({
        CAPACITY_LEVELS: '1,100',
        CAPACITY_MAX_LEVEL: '50',
      }),
    /CAPACITY_ALLOW_HIGH_CONCURRENCY=true/,
  )
})

test('parseLevels accepts explicit safe concurrency steps', () => {
  assert.deepEqual(parseLevels('1,10,25'), [1, 10, 25])
  assert.throws(() => parseLevels('1,zero'), /positive integers/)
})

test('capacity baseline measures public concurrency levels without auth', async () => {
  const requestedUrls = []
  const evidence = await runCapacityReadBaseline({
    config: readCapacityReadBaselineConfig({
      CAPACITY_API_BASE_URL: 'https://api.example.test/api',
      CAPACITY_PROFILES: 'public',
      CAPACITY_LEVELS: '1,3',
      CAPACITY_TIMEOUT_MS: '1000',
    }),
    now: () => '2026-06-13T00:00:00.000Z',
    fetchFn: async (url) => {
      requestedUrls.push(url)
      return jsonResponse({ ok: true })
    },
  })

  assert.equal(evidence.status, 'ok')
  assert.equal(evidence.summary.measuredLevels, 2)
  assert.equal(evidence.measurements[0].samples, 2)
  assert.equal(evidence.measurements[1].samples, 6)
  assert.ok(requestedUrls.every((url) => url.startsWith('https://api.example.test/api/health')))
})

test('capacity baseline blocks protected profiles without treating them as passed', async () => {
  let calls = 0
  const evidence = await runCapacityReadBaseline({
    config: readCapacityReadBaselineConfig({
      CAPACITY_API_BASE_URL: 'https://api.example.test/api',
      CAPACITY_PROFILES: 'store-manager,region-manager',
      CAPACITY_LEVELS: '1',
    }),
    env: {},
    now: () => '2026-06-13T00:00:00.000Z',
    fetchFn: async () => {
      calls += 1
      return jsonResponse({ ok: true })
    },
  })

  assert.equal(evidence.status, 'blocked')
  assert.equal(evidence.summary.runnableProfiles, 0)
  assert.equal(evidence.summary.blockedProfiles, 2)
  assert.equal(evidence.measurements.length, 0)
  assert.equal(calls, 0)
  assert.match(evidence.profilePlans[0].reason, /No bearer token/)
})

test('capacity baseline region-manager profile avoids endpoints outside REGION_MANAGER access', async () => {
  const evidence = await runCapacityReadBaseline({
    config: readCapacityReadBaselineConfig({
      CAPACITY_API_BASE_URL: 'https://api.example.test/api',
      CAPACITY_PROFILES: 'region-manager',
      CAPACITY_LEVELS: '1',
    }),
    env: {},
    now: () => '2026-06-13T00:00:00.000Z',
    fetchFn: async () => jsonResponse({ ok: true }),
  })

  const regionManagerPlan = evidence.profilePlans.find((profile) => profile.name === 'region-manager')
  assert.ok(regionManagerPlan)

  const endpointPaths = regionManagerPlan.endpoints.map((endpoint) => endpoint.path)
  assert.equal(evidence.status, 'blocked')
  assert.ok(endpointPaths.includes('/reports/snapshot-runs?limit=10&offset=0'))
  assert.ok(endpointPaths.includes('/reports/store-kpi-highlights?periodType=monthly'))
  assert.ok(endpointPaths.includes('/target-distributions/requests?limit=20&offset=0'))
  assert.ok(endpointPaths.includes('/target-distributions/coverage?requestMonth=2026-06-01'))
  assert.ok(!endpointPaths.some((path) => path.startsWith('/reports/summary')))
  assert.ok(!endpointPaths.some((path) => path.startsWith('/reports/kpis')))
  assert.ok(!endpointPaths.some((path) => path.startsWith('/workforce/headcount-gap')))
})

test('capacity baseline uses role-specific tokens and never records token material', async () => {
  const authHeaders = []
  const evidence = await runCapacityReadBaseline({
    config: readCapacityReadBaselineConfig({
      CAPACITY_API_BASE_URL: 'https://api.example.test/api',
      CAPACITY_PROFILES: 'store-manager,region-manager',
      CAPACITY_LEVELS: '2',
      CAPACITY_TIMEOUT_MS: '1000',
    }),
    env: {
      CAPACITY_STORE_MANAGER_TOKEN: 'store-secret-token',
      CAPACITY_REGION_MANAGER_TOKEN: 'region-secret-token',
    },
    now: () => '2026-06-13T00:00:00.000Z',
    fetchFn: async (_url, init) => {
      authHeaders.push(init.headers.authorization)
      return jsonResponse({ ok: true })
    },
  })

  assert.equal(evidence.status, 'ok')
  assert.ok(authHeaders.includes('Bearer store-secret-token'))
  assert.ok(authHeaders.includes('Bearer region-secret-token'))
  assert.equal(evidence.profilePlans[0].tokenSource, 'CAPACITY_STORE_MANAGER_TOKEN')
  assert.equal(evidence.profilePlans[1].tokenSource, 'CAPACITY_REGION_MANAGER_TOKEN')
  assert.doesNotMatch(JSON.stringify(evidence), /store-secret-token|region-secret-token/)
})

test('capacity baseline redacts opaque bearer tokens echoed in failure bodies', async () => {
  const evidence = await runCapacityReadBaseline({
    config: readCapacityReadBaselineConfig({
      CAPACITY_API_BASE_URL: 'https://api.example.test/api',
      CAPACITY_PROFILES: 'store-manager',
      CAPACITY_LEVELS: '1',
      CAPACITY_TIMEOUT_MS: '1000',
    }),
    env: {
      CAPACITY_STORE_MANAGER_TOKEN: 'opaque-secret-token',
    },
    now: () => '2026-06-13T00:00:00.000Z',
    fetchFn: async () =>
      jsonResponse(
        {
          error: 'upstream failure',
          authorization: 'Bearer opaque-secret-token',
          token: 'opaque-secret-token',
        },
        500,
      ),
  })

  const serializedEvidence = JSON.stringify(evidence)
  assert.equal(evidence.status, 'failed')
  assert.doesNotMatch(serializedEvidence, /opaque-secret-token/)
  assert.match(serializedEvidence, /<redacted-token>/)
})

test('capacity baseline admin profile ignores role-specific admin tokens that cannot cover all reads', async () => {
  let calls = 0
  const evidence = await runCapacityReadBaseline({
    config: readCapacityReadBaselineConfig({
      CAPACITY_API_BASE_URL: 'https://api.example.test/api',
      CAPACITY_PROFILES: 'admin',
      CAPACITY_LEVELS: '1',
    }),
    env: {
      BACKEND_LOAD_HR_ADMIN_TOKEN: 'hr-admin-only-token',
      BACKEND_LOAD_IMPORT_TOKEN: 'import-only-token',
      PROTECTED_PERF_ADMIN_TOKEN: 'generic-admin-token',
      CAPACITY_BEARER_TOKEN: 'shared-diagnostic-token',
    },
    now: () => '2026-06-13T00:00:00.000Z',
    fetchFn: async () => {
      calls += 1
      return jsonResponse({ ok: true })
    },
  })

  assert.equal(evidence.status, 'blocked')
  assert.equal(evidence.summary.runnableProfiles, 0)
  assert.equal(calls, 0)
  assert.deepEqual(evidence.profilePlans[0].requiredEnv, [
    'CAPACITY_SUPER_ADMIN_TOKEN',
    'CAPACITY_ADMIN_READS_TOKEN',
    'PROTECTED_PERF_SUPER_ADMIN_TOKEN',
  ])
  assert.doesNotMatch(
    JSON.stringify(evidence),
    /hr-admin-only-token|import-only-token|generic-admin-token|shared-diagnostic-token/,
  )
})

test('capacity baseline samples every ready profile when the level is below profile count', async () => {
  const evidence = await runCapacityReadBaseline({
    config: readCapacityReadBaselineConfig({
      CAPACITY_API_BASE_URL: 'https://api.example.test/api',
      CAPACITY_PROFILES: 'store-manager,region-manager,admin',
      CAPACITY_LEVELS: '1',
      CAPACITY_TIMEOUT_MS: '1000',
    }),
    env: {
      CAPACITY_STORE_MANAGER_TOKEN: 'store-secret-token',
      CAPACITY_REGION_MANAGER_TOKEN: 'region-secret-token',
      CAPACITY_SUPER_ADMIN_TOKEN: 'admin-secret-token',
    },
    now: () => '2026-06-13T00:00:00.000Z',
    fetchFn: async () => jsonResponse({ ok: true }),
  })

  assert.equal(evidence.status, 'ok')
  assert.equal(evidence.measurements[0].concurrency, 1)
  assert.equal(evidence.measurements[0].virtualUsers, 3)
  assert.ok(evidence.measurements[0].profiles.every((profile) => profile.samples > 0))
  assert.doesNotMatch(JSON.stringify(evidence), /store-secret-token|region-secret-token|admin-secret-token/)
})

test('capacity baseline fails and stops on rate limits, 5xx, and non-json responses', async () => {
  const evidence = await runCapacityReadBaseline({
    config: readCapacityReadBaselineConfig({
      CAPACITY_API_BASE_URL: 'https://api.example.test/api',
      CAPACITY_PROFILES: 'public',
      CAPACITY_LEVELS: '1,2',
      CAPACITY_TIMEOUT_MS: '1000',
    }),
    now: () => '2026-06-13T00:00:00.000Z',
    fetchFn: async (url) => {
      if (url.endsWith('/health/live')) {
        return jsonResponse({ error: 'too many requests' }, 429)
      }

      return new Response('<html>fallback</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    },
  })

  assert.equal(evidence.status, 'failed')
  assert.equal(evidence.summary.measuredLevels, 1)
  assert.equal(evidence.measurements[0].rateLimitedCount, 1)
  assert.match(evidence.measurements[0].failures.join(' '), /429|HTML|non-JSON/)
})

test('capacity baseline package script and summary are explicit', () => {
  const pkg = JSON.parse(readFileSync(join(workspaceRoot, 'package.json'), 'utf8'))

  assert.equal(pkg.scripts['capacity:read'], 'node scripts/capacity-read-baseline.mjs')

  const summary = formatCapacityReadBaselineSummary({
    status: 'blocked',
    environment: 'staging',
    apiBaseUrl: 'https://api.example.test/api',
    targetRegisteredUsers: 700,
    requestedProfiles: ['public', 'store-manager'],
    profilePlans: [
      {
        name: 'store-manager',
        status: 'blocked',
        reason: 'No bearer token was provided for store-manager.',
      },
    ],
    measurements: [
      {
        concurrency: 1,
        virtualUsers: 1,
        status: 'passed',
        samples: 2,
        availability: 1,
        p50Ms: 50,
        p95Ms: 75,
        rateLimitedCount: 0,
        fiveXxCount: 0,
      },
    ],
    excludedMutationRoutes: [{ method: 'POST', path: '/checklists' }],
  })

  assert.match(summary, /Capacity read baseline: blocked/)
  assert.match(summary, /Target registered users: 700/)
  assert.match(summary, /store-manager: blocked/)
  assert.match(summary, /concurrency 1: passed/)
  assert.match(summary, /Excluded mutations/)
})

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
