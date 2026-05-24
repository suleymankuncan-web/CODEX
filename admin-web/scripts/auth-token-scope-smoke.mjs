const args = process.argv.slice(2)
const stagingMode = args.includes('--staging')

const apiBaseUrl = normalizeApiBaseUrl(envValue('AUTH_SMOKE_API_BASE_URL', 'http://localhost:3000/api'))
const bearerToken = envValue('AUTH_SMOKE_BEARER_TOKEN', '')
const expectedRole = envValue('AUTH_SMOKE_EXPECTED_ROLE', 'STORE_MANAGER')
const smokeEnvironment = envValue('AUTH_SMOKE_ENVIRONMENT', stagingMode ? 'staging' : 'local')
const assignedActionStoreId = envValue(
  'AUTH_SMOKE_ASSIGNED_STORE_ID',
  '00000000-0000-0000-0000-000000000100',
)
const unassignedActionStoreId = envValue(
  'AUTH_SMOKE_UNASSIGNED_STORE_ID',
  '00000000-0000-0000-0000-000000000999',
)

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function envValue(name, fallback) {
  const value = process.env[name]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function hasExplicitEnv(name) {
  return typeof process.env[name] === 'string' && process.env[name].trim().length > 0
}

function parseUrl(value, message) {
  try {
    return new URL(value)
  } catch {
    throw new Error(message)
  }
}

function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

function normalizeApiBaseUrl(value) {
  const parsed = parseUrl(value, 'AUTH_SMOKE_API_BASE_URL must be a valid URL')
  return parsed.toString().replace(/\/$/, '')
}

function assertHttpsNonLocalUrl(envName, value) {
  assert(hasExplicitEnv(envName), `staging token smoke requires ${envName} to be set`)
  const parsed = parseUrl(value, `staging token smoke requires ${envName} to be a valid URL`)

  assert(
    parsed.protocol === 'https:' && !isLocalHost(parsed.hostname),
    `staging token smoke requires ${envName} to be a non-local HTTPS URL`,
  )
}

function assertExplicitStagingValue(envName) {
  assert(hasExplicitEnv(envName), `staging token smoke requires ${envName} to be set`)
}

function assertConfig() {
  assert(bearerToken, 'AUTH_SMOKE_BEARER_TOKEN is required')
  assert(assignedActionStoreId, 'AUTH_SMOKE_ASSIGNED_STORE_ID is required')
  assert(unassignedActionStoreId, 'AUTH_SMOKE_UNASSIGNED_STORE_ID is required')

  if (!stagingMode) {
    return
  }

  assertHttpsNonLocalUrl('AUTH_SMOKE_API_BASE_URL', apiBaseUrl)
  assertExplicitStagingValue('AUTH_SMOKE_BEARER_TOKEN')
  assertExplicitStagingValue('AUTH_SMOKE_EXPECTED_ROLE')
  assertExplicitStagingValue('AUTH_SMOKE_ENVIRONMENT')
  assertExplicitStagingValue('AUTH_SMOKE_ASSIGNED_STORE_ID')
  assertExplicitStagingValue('AUTH_SMOKE_UNASSIGNED_STORE_ID')
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${bearerToken}`,
      accept: 'application/json',
      connection: 'close',
      ...(options.headers ?? {}),
    },
  })
  const text = await response.text()
  let body = null

  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = { raw: '<non-json-response-redacted>' }
    }
  }

  return {
    body,
    ok: response.ok,
    status: response.status,
  }
}

function sanitizeForError(value) {
  return JSON.stringify(value).replaceAll(bearerToken, '<redacted-bearer-token>')
}

function sanitizeSession(session) {
  return {
    authMode: session?.authMode,
    authenticated: session?.authenticated,
    user: {
      userIdPresent: typeof session?.user?.userId === 'string' && session.user.userId.length > 0,
      employeeLinked: typeof session?.user?.employeeId === 'string' && session.user.employeeId.length > 0,
      roleCodes: session?.user?.roleCodes ?? [],
      readScope: session?.user?.readScope,
      actionScope: session?.user?.actionScope,
    },
    scopeSummary: session?.scopeSummary,
  }
}

function summarizeRows(body) {
  const candidates = [
    body,
    body?.data,
    body?.data?.items,
    body?.data?.personnel,
    body?.items,
    body?.personnel,
  ]
  const rows = candidates.find((candidate) => Array.isArray(candidate))

  if (rows) {
    return { rowCount: rows.length }
  }

  return { rowCount: null }
}

async function main() {
  assertConfig()

  const sessionResponse = await fetchJson('/auth/session')
  assert(
    sessionResponse.ok,
    `GET /auth/session returned ${sessionResponse.status}: ${sanitizeForError(sessionResponse.body)}`,
  )

  const session = sanitizeSession(sessionResponse.body)
  assert(
    session.user.roleCodes.includes(expectedRole),
    `session roleCodes does not include ${expectedRole}`,
  )
  assert(
    session.user.actionScope?.assignedStoreIds?.includes(assignedActionStoreId),
    'session action scope does not include AUTH_SMOKE_ASSIGNED_STORE_ID',
  )

  const assignedPath = `/target-distributions/store-personnel?storeId=${encodeURIComponent(
    assignedActionStoreId,
  )}`
  const assignedResponse = await fetchJson(assignedPath)
  assert(
    assignedResponse.ok,
    `assigned-store action-scope smoke returned ${assignedResponse.status}: ${sanitizeForError(
      assignedResponse.body,
    )}`,
  )

  const unassignedPath = `/target-distributions/store-personnel?storeId=${encodeURIComponent(
    unassignedActionStoreId,
  )}`
  const unassignedResponse = await fetchJson(unassignedPath)
  assert(
    unassignedResponse.status === 403,
    `unassigned-store action-scope smoke returned ${unassignedResponse.status} instead of 403: ${sanitizeForError(
      unassignedResponse.body,
    )}`,
  )

  const evidence = {
    evidenceStatus: `${smokeEnvironment}-clerk-token-action-scope-smoke-passed`,
    evidenceDate: new Date().toISOString(),
    apiBaseUrl,
    session,
    actionScopeSmoke: {
      endpoint: 'GET /target-distributions/store-personnel',
      assignedStore: {
        status: assignedResponse.status,
        storeId: assignedActionStoreId,
        result: summarizeRows(assignedResponse.body),
      },
      unassignedStore: {
        status: unassignedResponse.status,
        storeId: unassignedActionStoreId,
        message: unassignedResponse.body?.message ?? null,
        dbWriteExpected: false,
      },
    },
    limitations: [
      'Bearer token was supplied through local environment and was not printed.',
      'This smoke uses a read-only RequireActionScope("store") endpoint; it does not create a target request.',
      'Password, Clerk cookie, provider subject, email, and raw token are intentionally excluded.',
    ],
  }

  console.log(JSON.stringify(evidence, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
