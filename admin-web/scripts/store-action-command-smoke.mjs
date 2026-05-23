const args = process.argv.slice(2)
const stagingMode = args.includes('--staging')

const apiBaseUrl = normalizeApiBaseUrl(
  envValue('STORE_ACTION_SMOKE_API_BASE_URL', 'http://localhost:3000/api'),
)
const bearerToken = envValue('STORE_ACTION_SMOKE_BEARER_TOKEN', '')
const expectedRole = envValue('STORE_ACTION_SMOKE_EXPECTED_ROLE', 'STORE_MANAGER')
const smokeEnvironment = envValue(
  'STORE_ACTION_SMOKE_ENVIRONMENT',
  stagingMode ? 'staging' : 'local',
)
const assignedStoreId = envValue(
  'STORE_ACTION_SMOKE_ASSIGNED_STORE_ID',
  '00000000-0000-0000-0000-000000000100',
)
const unassignedStoreId = envValue(
  'STORE_ACTION_SMOKE_UNASSIGNED_STORE_ID',
  '00000000-0000-0000-0000-000000000101',
)
const mutationAck = envValue('STORE_ACTION_SMOKE_ALLOW_STAGING_MUTATION', '')
const requiredMutationAck = 'I_UNDERSTAND_THIS_CREATES_TERMINAL_STORE_ACTION_PLANS'
const sourcePrefix = envValue('STORE_ACTION_SMOKE_SOURCE_PREFIX', `store-action-smoke:${Date.now()}`)

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
  const parsed = parseUrl(value, 'STORE_ACTION_SMOKE_API_BASE_URL must be a valid URL')
  return parsed.toString().replace(/\/$/, '')
}

function assertHttpsNonLocalUrl(envName, value) {
  assert(hasExplicitEnv(envName), `staging store action smoke requires ${envName} to be set`)
  const parsed = parseUrl(value, `staging store action smoke requires ${envName} to be a valid URL`)

  assert(
    parsed.protocol === 'https:' && !isLocalHost(parsed.hostname),
    `staging store action smoke requires ${envName} to be a non-local HTTPS URL`,
  )
}

function assertExplicitStagingValue(envName) {
  assert(hasExplicitEnv(envName), `staging store action smoke requires ${envName} to be set`)
}

function assertConfig() {
  assert(bearerToken, 'STORE_ACTION_SMOKE_BEARER_TOKEN is required')
  assert(assignedStoreId, 'STORE_ACTION_SMOKE_ASSIGNED_STORE_ID is required')
  assert(unassignedStoreId, 'STORE_ACTION_SMOKE_UNASSIGNED_STORE_ID is required')
  assert(sourcePrefix, 'STORE_ACTION_SMOKE_SOURCE_PREFIX is required')

  if (!stagingMode) {
    return
  }

  assertHttpsNonLocalUrl('STORE_ACTION_SMOKE_API_BASE_URL', apiBaseUrl)
  assertExplicitStagingValue('STORE_ACTION_SMOKE_BEARER_TOKEN')
  assertExplicitStagingValue('STORE_ACTION_SMOKE_EXPECTED_ROLE')
  assertExplicitStagingValue('STORE_ACTION_SMOKE_ENVIRONMENT')
  assertExplicitStagingValue('STORE_ACTION_SMOKE_ASSIGNED_STORE_ID')
  assertExplicitStagingValue('STORE_ACTION_SMOKE_UNASSIGNED_STORE_ID')
  assert(
    mutationAck === requiredMutationAck,
    `staging store action smoke requires STORE_ACTION_SMOKE_ALLOW_STAGING_MUTATION=${requiredMutationAck}`,
  )
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${bearerToken}`,
      accept: 'application/json',
      connection: 'close',
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
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
  const rendered = JSON.stringify(value)
  return bearerToken ? rendered.replaceAll(bearerToken, '<redacted-bearer-token>') : rendered
}

function sanitizeSession(session) {
  return {
    authMode: session?.authMode,
    authenticated: session?.authenticated,
    user: {
      userId: session?.user?.userId,
      employeeId: session?.user?.employeeId ?? null,
      roleCodes: session?.user?.roleCodes ?? [],
      readScope: session?.user?.readScope,
      actionScope: session?.user?.actionScope,
    },
    scopeSummary: session?.scopeSummary,
  }
}

function futureDate(daysFromNow) {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000)
  return date.toISOString().slice(0, 10)
}

function planPayload(input) {
  return {
    storeId: input.storeId,
    sourceType: 'kpi_exception',
    sourceId: input.sourceId,
    sourceDeepLink: '/store/kpis',
    title: input.title,
    summary: 'Store Action command smoke generated this terminal pilot evidence row.',
    priority: 'medium',
    dueOn: futureDate(7),
  }
}

function summarizeCommand(body) {
  return {
    status: body?.command?.status ?? null,
    message: body?.command?.message ?? null,
  }
}

function summarizePlan(body) {
  const plan = body?.data?.plan
  assert(plan?.actionPlanId, `store action response did not include data.plan.actionPlanId: ${sanitizeForError(body)}`)

  return {
    actionPlanId: plan.actionPlanId,
    storeId: plan.storeId,
    sourceType: plan.sourceType,
    sourceId: plan.sourceId,
    status: plan.status,
    priority: plan.priority,
    dueOn: plan.dueOn,
  }
}

async function createPlan(payload) {
  const response = await fetchJson('/store-actions/plans', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  assert(
    response.ok,
    `create store action plan returned ${response.status}: ${sanitizeForError(response.body)}`,
  )

  return {
    command: summarizeCommand(response.body),
    plan: summarizePlan(response.body),
    status: response.status,
  }
}

async function updateStatus(actionPlanId, status) {
  const response = await fetchJson(`/store-actions/plans/${encodeURIComponent(actionPlanId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      note: `Store Action command smoke moved the plan to ${status}.`,
    }),
  })
  assert(
    response.ok,
    `update store action plan status returned ${response.status}: ${sanitizeForError(response.body)}`,
  )

  return {
    command: summarizeCommand(response.body),
    plan: summarizePlan(response.body),
    status: response.status,
  }
}

async function closePlan(actionPlanId) {
  const response = await fetchJson(`/store-actions/plans/${encodeURIComponent(actionPlanId)}/close`, {
    method: 'PATCH',
    body: JSON.stringify({
      resolutionNote: 'Store Action command smoke closed this approved staging proof row.',
    }),
  })
  assert(
    response.ok,
    `close store action plan returned ${response.status}: ${sanitizeForError(response.body)}`,
  )

  return {
    command: summarizeCommand(response.body),
    plan: summarizePlan(response.body),
    status: response.status,
  }
}

async function cancelPlan(actionPlanId) {
  const response = await fetchJson(`/store-actions/plans/${encodeURIComponent(actionPlanId)}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({
      cancelReason: 'Store Action command smoke cleanup for an approved staging proof row.',
    }),
  })
  assert(
    response.ok,
    `cancel store action plan returned ${response.status}: ${sanitizeForError(response.body)}`,
  )

  return {
    command: summarizeCommand(response.body),
    plan: summarizePlan(response.body),
    status: response.status,
  }
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
    session.user.actionScope?.assignedStoreIds?.includes(assignedStoreId),
    'session action scope does not include STORE_ACTION_SMOKE_ASSIGNED_STORE_ID',
  )

  const closeSourceId = `${sourcePrefix}:close`
  const cancelSourceId = `${sourcePrefix}:cancel`
  const unassignedSourceId = `${sourcePrefix}:unassigned`

  const createdForClose = await createPlan(planPayload({
    sourceId: closeSourceId,
    storeId: assignedStoreId,
    title: 'Store Action smoke - close lifecycle',
  }))
  const statusUpdate = await updateStatus(createdForClose.plan.actionPlanId, 'in_progress')
  const closed = await closePlan(createdForClose.plan.actionPlanId)

  const createdForCancel = await createPlan(planPayload({
    sourceId: cancelSourceId,
    storeId: assignedStoreId,
    title: 'Store Action smoke - cancel lifecycle',
  }))
  const cancelled = await cancelPlan(createdForCancel.plan.actionPlanId)

  const unassignedCreate = await fetchJson('/store-actions/plans', {
    method: 'POST',
    body: JSON.stringify(planPayload({
      sourceId: unassignedSourceId,
      storeId: unassignedStoreId,
      title: 'Store Action smoke - unassigned negative',
    })),
  })
  assert(
    unassignedCreate.status === 403,
    `unassigned-store create returned ${unassignedCreate.status} instead of 403: ${sanitizeForError(
      unassignedCreate.body,
    )}`,
  )

  const evidence = {
    evidenceStatus: `${smokeEnvironment}-store-action-command-smoke-passed`,
    evidenceDate: new Date().toISOString(),
    apiBaseUrl,
    trace: {
      sourcePrefix,
      expectedRole,
    },
    session,
    storeActionCommandSmoke: {
      assignedStore: {
        storeId: assignedStoreId,
        createForClose: createdForClose,
        statusUpdate,
        close: closed,
        createForCancel: createdForCancel,
        cancel: cancelled,
      },
      unassignedStore: {
        storeId: unassignedStoreId,
        createStatus: unassignedCreate.status,
        message: unassignedCreate.body?.message ?? null,
        dbWriteExpected: false,
      },
    },
    limitations: [
      'Bearer token was supplied through local environment and was not printed.',
      'This smoke intentionally creates terminal Store Action plan rows in the target environment.',
      'Staging mode requires an explicit mutation acknowledgement before network access.',
      'Password, Clerk cookie, provider subject, email, and raw token are intentionally excluded.',
    ],
  }

  console.log(JSON.stringify(evidence, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
