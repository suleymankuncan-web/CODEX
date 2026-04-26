import { chromium, request } from '@playwright/test'

const args = process.argv.slice(2)
const includeActionSmoke = args.includes('--include-action-smoke')
const stagingMode = args.includes('--staging')
const baseUrl = envValue('AUTH_SMOKE_BASE_URL', 'http://localhost:5173')
const apiBaseUrl = envValue('AUTH_SMOKE_API_BASE_URL', `${baseUrl}/api`)
const username = envValue('AUTH_SMOKE_USERNAME', 'store.manager')
const password = envValue('AUTH_SMOKE_PASSWORD', 'StoreOps123!')
const expectedRole = envValue('AUTH_SMOKE_EXPECTED_ROLE', 'STORE_MANAGER')
const expectedLandingPath = envValue('AUTH_SMOKE_EXPECTED_LANDING', '/store')
const smokeEnvironment = envValue('AUTH_SMOKE_ENVIRONMENT', stagingMode ? 'staging' : 'local-keycloak')
const providerName = envValue('AUTH_SMOKE_PROVIDER_NAME', stagingMode ? 'Staging IdP' : 'Keycloak local')
const providerIssuer = envValue('AUTH_SMOKE_PROVIDER_ISSUER', '')
const providerJwksUrl = envValue('AUTH_SMOKE_JWKS_URL', '')
const acceptedAudience = envValue('AUTH_SMOKE_ACCEPTED_AUDIENCE', stagingMode ? '' : 'account')
const assignedActionStoreId =
  envValue('AUTH_SMOKE_ASSIGNED_STORE_ID', '00000000-0000-0000-0000-000000000100')
const unassignedActionStoreId =
  envValue('AUTH_SMOKE_UNASSIGNED_STORE_ID', '00000000-0000-0000-0000-000000000999')
const actionRequestMonth = envValue('AUTH_SMOKE_ACTION_REQUEST_MONTH', '2026-04-01')

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

function assertHttpsNonLocalUrl(envName, value) {
  assert(hasExplicitEnv(envName), `staging smoke requires ${envName} to be set`)
  const parsed = parseUrl(value, `staging smoke requires ${envName} to be a valid URL`)

  assert(
    parsed.protocol === 'https:' && !isLocalHost(parsed.hostname),
    `staging smoke requires ${envName} to be a non-local HTTPS URL`,
  )
}

function assertExplicitStagingValue(envName) {
  assert(hasExplicitEnv(envName), `staging smoke requires ${envName} to be set`)
}

function assertStagingConfig() {
  if (!stagingMode) {
    return
  }

  assertHttpsNonLocalUrl('AUTH_SMOKE_BASE_URL', baseUrl)
  assertHttpsNonLocalUrl('AUTH_SMOKE_API_BASE_URL', apiBaseUrl)
  assertExplicitStagingValue('AUTH_SMOKE_USERNAME')
  assertExplicitStagingValue('AUTH_SMOKE_PASSWORD')
  assert(username !== 'store.manager', 'staging smoke requires a non-local AUTH_SMOKE_USERNAME')
  assert(password !== 'StoreOps123!', 'staging smoke requires a non-local AUTH_SMOKE_PASSWORD')
  assertExplicitStagingValue('AUTH_SMOKE_EXPECTED_ROLE')
  assertExplicitStagingValue('AUTH_SMOKE_ENVIRONMENT')
  assertExplicitStagingValue('AUTH_SMOKE_PROVIDER_NAME')
  assertExplicitStagingValue('AUTH_SMOKE_PROVIDER_ISSUER')
  assertHttpsNonLocalUrl('AUTH_SMOKE_PROVIDER_ISSUER', providerIssuer)
  assertExplicitStagingValue('AUTH_SMOKE_JWKS_URL')
  assertHttpsNonLocalUrl('AUTH_SMOKE_JWKS_URL', providerJwksUrl)
  assertExplicitStagingValue('AUTH_SMOKE_ACCEPTED_AUDIENCE')

  if (includeActionSmoke) {
    assertExplicitStagingValue('AUTH_SMOKE_ASSIGNED_STORE_ID')
    assertExplicitStagingValue('AUTH_SMOKE_UNASSIGNED_STORE_ID')
    assertExplicitStagingValue('AUTH_SMOKE_ACTION_REQUEST_MONTH')
  }
}

function evidenceStatus() {
  if (stagingMode) {
    return includeActionSmoke
      ? 'staging-provider-action-smoke-passed'
      : 'staging-provider-smoke-passed'
  }

  return includeActionSmoke ? 'local-provider-action-smoke-passed' : 'local-provider-smoke-passed'
}

function evidenceLimitations() {
  if (stagingMode) {
    return includeActionSmoke
      ? ['Staging IdP and seeded staging DB-backed positive/negative action smoke passed.']
      : ['Staging IdP smoke passed; seeded staging DB-backed action smoke remains pending.']
  }

  return [
    'This is local Keycloak real-provider smoke evidence, not staging IdP sign-off.',
    includeActionSmoke
      ? 'Positive and negative DB-backed action smoke passed locally; seeded staging action smoke remains pending.'
      : 'Positive and negative DB-backed action smoke remain pending for a seeded staging environment.',
  ]
}

function isProviderLogoutRequest(inputUrl, providerLogoutUrl) {
  if (!providerLogoutUrl) {
    return inputUrl.includes('/protocol/openid-connect/logout')
  }

  try {
    const observed = new URL(inputUrl)
    const expected = new URL(providerLogoutUrl)

    return observed.origin === expected.origin && observed.pathname === expected.pathname
  } catch {
    return false
  }
}

function deriveKeycloakIssuer(authorizationUrl) {
  return authorizationUrl.replace('/protocol/openid-connect/auth', '')
}

function evidenceIssuer(authorizationUrl) {
  return providerIssuer || deriveKeycloakIssuer(authorizationUrl)
}

function evidenceJwksUrl(authorizationUrl) {
  return providerJwksUrl || `${deriveKeycloakIssuer(authorizationUrl)}/protocol/openid-connect/certs`
}

function decodeJwtPayload(token) {
  const [, payload] = token.split('.')
  assert(payload, 'JWT payload is missing')
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
}

function pickArray(value) {
  if (Array.isArray(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }

  return []
}

function sanitizeJwtPayload(payload) {
  return {
    iss: payload.iss,
    sub: payload.sub,
    aud: payload.aud,
    exp: payload.exp,
    iat: payload.iat,
    preferred_username: payload.preferred_username,
    email: payload.email,
    employee_id: payload.employee_id,
    roles: pickArray(payload.roles),
    read_company_ids: pickArray(payload.read_company_ids),
    read_region_ids: pickArray(payload.read_region_ids),
    read_store_ids: pickArray(payload.read_store_ids),
    assigned_store_ids: pickArray(payload.assigned_store_ids),
  }
}

function sanitizeSession(session) {
  return {
    authMode: session.authMode,
    authenticated: session.authenticated,
    user: {
      userId: session.user?.userId,
      employeeId: session.user?.employeeId ?? null,
      roleCodes: session.user?.roleCodes ?? [],
      readScope: session.user?.readScope,
      actionScope: session.user?.actionScope,
    },
    scopeSummary: session.scopeSummary,
  }
}

function sanitizeUrl(inputUrl) {
  const url = new URL(inputUrl)

  for (const sensitive of [
    'access_token',
    'client_secret',
    'code',
    'code_challenge',
    'code_verifier',
    'id_token_hint',
    'refresh_token',
    'session_state',
    'state',
    'token',
  ]) {
    if (url.searchParams.has(sensitive)) {
      url.searchParams.set(sensitive, '<present-redacted>')
    }
  }

  return url.toString()
}

function makeExpiredJwt() {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({
      iss: 'expired-smoke',
      sub: 'expired-smoke-user',
      aud: 'account',
      exp: Math.floor(Date.now() / 1000) - 120,
      iat: Math.floor(Date.now() / 1000) - 3600,
    }),
  ).toString('base64url')

  return `${header}.${payload}.`
}

async function maybeReadJson(response) {
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return { raw: '<non-json-response-redacted>' }
  }
}

function sanitizeActionResponse(body) {
  return {
    command: body?.command,
    request: body?.data?.request
      ? {
          requestId: body.data.request.requestId,
          storeId: body.data.request.storeId,
          requestMonth: body.data.request.requestMonth,
          targetLabel: body.data.request.targetLabel,
          totalTargetValue: body.data.request.totalTargetValue,
          allocationCount: body.data.request.allocationCount,
          status: body.data.request.status,
        }
      : null,
  }
}

async function runActionSmoke(sessionRequest) {
  const positiveTargetLabel = `Auth Smoke Assigned Store ${Date.now()}`
  const negativeTargetLabel = `Auth Smoke Unassigned Store ${Date.now()}`
  const positivePayload = {
    storeId: assignedActionStoreId,
    requestMonth: actionRequestMonth,
    targetLabel: positiveTargetLabel,
    totalTargetValue: 1000,
    requestReason: 'Auth action scope positive smoke',
    allocations: [
      {
        assigneeLabel: 'Auth smoke assignee',
        targetValue: 1000,
      },
    ],
  }

  const positiveResponse = await sessionRequest.post(`${apiBaseUrl}/target-distributions/requests`, {
    data: positivePayload,
  })
  const positiveBody = await maybeReadJson(positiveResponse)
  assert(
    positiveResponse.ok(),
    `assigned-store action smoke returned ${positiveResponse.status()}: ${JSON.stringify(
      sanitizeActionResponse(positiveBody),
    )}`,
  )
  assert(
    positiveBody?.command?.status === 'submitted',
    'assigned-store action smoke did not submit a request',
  )
  assert(
    positiveBody?.data?.request?.storeId === assignedActionStoreId,
    'assigned-store action smoke returned an unexpected storeId',
  )

  const negativePayload = {
    ...positivePayload,
    storeId: unassignedActionStoreId,
    targetLabel: negativeTargetLabel,
    requestReason: 'Auth action scope negative smoke',
  }
  const negativeResponse = await sessionRequest.post(`${apiBaseUrl}/target-distributions/requests`, {
    data: negativePayload,
  })
  const negativeBody = await maybeReadJson(negativeResponse)
  assert(
    negativeResponse.status() === 403,
    `unassigned-store action smoke returned ${negativeResponse.status()} instead of 403: ${JSON.stringify(
      negativeBody,
    )}`,
  )

  return {
    operation: 'target-distribution-request-create',
    assignedStore: {
      status: positiveResponse.status(),
      storeId: assignedActionStoreId,
      result: sanitizeActionResponse(positiveBody),
    },
    unassignedStore: {
      status: negativeResponse.status(),
      storeId: unassignedActionStoreId,
      message: negativeBody?.message ?? null,
      dbWriteExpected: false,
    },
  }
}

async function main() {
  assertStagingConfig()

  const apiRequest = await request.newContext()
  const bootstrapResponse = await apiRequest.get(`${apiBaseUrl}/auth/bootstrap`)
  assert(bootstrapResponse.ok(), `GET /auth/bootstrap returned ${bootstrapResponse.status()}`)

  const bootstrap = await bootstrapResponse.json()
  assert(bootstrap.authMode === 'jwt', 'bootstrap authMode is not jwt')
  assert(bootstrap.provider?.configured === true, 'bootstrap provider is not configured')
  assert(bootstrap.provider?.responseType === 'code', 'bootstrap responseType is not code')
  assert(Boolean(bootstrap.provider?.tokenUrl), 'bootstrap tokenUrl is missing')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ baseURL: baseUrl })
  const page = await context.newPage()
  const logoutRequests = []

  page.on('request', (requestEvent) => {
    const url = requestEvent.url()
    if (isProviderLogoutRequest(url, bootstrap.provider.logoutUrl)) {
      logoutRequests.push(sanitizeUrl(url))
    }
  })

  await page.goto(`/auth/login?returnTo=${encodeURIComponent(expectedLandingPath)}`)
  await page.getByRole('link', { name: /Start provider login/i }).click()
  await page.waitForURL((url) => url.href.includes('/protocol/openid-connect/auth'), {
    timeout: 15_000,
  })

  const authorizationUrl = new URL(page.url())
  assert(authorizationUrl.searchParams.get('response_type') === 'code', 'login response_type is not code')
  assert(authorizationUrl.searchParams.get('client_id') === bootstrap.provider.clientId, 'login client_id mismatch')
  assert(authorizationUrl.searchParams.get('code_challenge_method') === 'S256', 'PKCE S256 is missing')
  assert(Boolean(authorizationUrl.searchParams.get('code_challenge')), 'code_challenge is missing')
  assert(Boolean(authorizationUrl.searchParams.get('state')), 'state is missing')

  await page.locator('input[name="username"]').fill(username)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('input[type="submit"], button[type="submit"]').click()
  await page.waitForURL((url) => url.origin === new URL(baseUrl).origin && url.pathname.startsWith(expectedLandingPath), {
    timeout: 30_000,
  })
  await page.getByRole('main', { name: 'Store workspace' }).waitFor({ timeout: 15_000 })

  const accessToken = await page.evaluate(() =>
    window.sessionStorage.getItem('store-ops-admin-bearer-token') ?? '',
  )
  assert(accessToken, 'bearer token was not stored after login')

  const idTokenStored = await page.evaluate(() =>
    Boolean(window.sessionStorage.getItem('store-ops-admin-provider-id-token')),
  )
  const sanitizedPayload = sanitizeJwtPayload(decodeJwtPayload(accessToken))
  assert(sanitizedPayload.sub, 'access token direct sub is missing')
  assert(sanitizedPayload.aud, 'access token direct aud is missing')
  assert(sanitizedPayload.roles.includes(expectedRole), `access token does not include ${expectedRole}`)

  const sessionRequest = await request.newContext({
    extraHTTPHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  const sessionResponse = await sessionRequest.get(`${apiBaseUrl}/auth/session`)
  assert(sessionResponse.ok(), `GET /auth/session returned ${sessionResponse.status()}`)
  const session = await sessionResponse.json()
  assert(session.user?.roleCodes?.includes(expectedRole), `session roleCodes does not include ${expectedRole}`)
  assert(session.user?.readScope?.companyIds?.length > 0, 'session read company scope is empty')
  assert(session.user?.actionScope?.assignedStoreIds?.length > 0, 'session action scope is empty')

  const actionSmoke = includeActionSmoke ? await runActionSmoke(sessionRequest) : null

  await page.goto('/auth/logout')
  await page.waitForURL((url) => url.origin === new URL(baseUrl).origin && url.pathname === '/auth/login', {
    timeout: 30_000,
  })

  const storageAfterLogout = await page.evaluate(() => ({
    bearerTokenStored: Boolean(window.sessionStorage.getItem('store-ops-admin-bearer-token')),
    providerIdTokenStored: Boolean(window.sessionStorage.getItem('store-ops-admin-provider-id-token')),
  }))

  assert(!storageAfterLogout.bearerTokenStored, 'bearer token remained after logout')
  assert(!storageAfterLogout.providerIdTokenStored, 'provider id token remained after logout')

  const expiredContext = await browser.newContext({ baseURL: baseUrl })
  const expiredPage = await expiredContext.newPage()
  let authSessionRequestCount = 0
  let authorizationHeaderSent = false

  await expiredPage.route('**/api/auth/session', async (route) => {
    authSessionRequestCount += 1
    authorizationHeaderSent = Boolean(route.request().headers().authorization)
    await route.fulfill({ status: 401, json: { message: 'expired token smoke' } })
  })

  await expiredPage.addInitScript((expiredJwt) => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'bearer',
        mockUserId: 'expired-smoke-user',
        mockRoleCodes: '',
        mockCompanyIds: '',
        bearerToken: '',
      }),
    )
    window.sessionStorage.setItem('store-ops-admin-bearer-token', expiredJwt)
    window.sessionStorage.setItem('store-ops-admin-provider-id-token', 'expired-id-token-redacted')
  }, makeExpiredJwt())

  await expiredPage.goto('/store')
  await expiredPage.waitForURL((url) => url.pathname === '/auth/login', { timeout: 15_000 })

  const expiredStorage = await expiredPage.evaluate(() => ({
    bearerTokenStored: Boolean(window.sessionStorage.getItem('store-ops-admin-bearer-token')),
    providerIdTokenStored: Boolean(window.sessionStorage.getItem('store-ops-admin-provider-id-token')),
  }))

  await expiredContext.close()
  await context.close()
  await browser.close()
  await apiRequest.dispose()
  await sessionRequest.dispose()

  const evidence = {
    evidenceStatus: evidenceStatus(),
    environment: smokeEnvironment,
    evidenceDate: new Date().toISOString(),
    frontendOrigin: baseUrl,
    apiBaseUrl,
    provider: {
      name: providerName,
      issuer: evidenceIssuer(bootstrap.provider.authorizationUrl),
      clientId: bootstrap.provider.clientId,
      jwksUrl: evidenceJwksUrl(bootstrap.provider.authorizationUrl),
      authorizationUrl: bootstrap.provider.authorizationUrl,
      tokenUrl: bootstrap.provider.tokenUrl,
      logoutUrl: bootstrap.provider.logoutUrl,
      acceptedAudience,
      pkceMethod: authorizationUrl.searchParams.get('code_challenge_method'),
      refreshTokenRequested: false,
    },
    bootstrap: {
      authMode: bootstrap.authMode,
      provider: {
        configured: bootstrap.provider.configured,
        clientId: bootstrap.provider.clientId,
        scope: bootstrap.provider.scope,
        responseType: bootstrap.provider.responseType,
        callbackPath: bootstrap.provider.callbackPath,
        tokenUrl: bootstrap.provider.tokenUrl,
        logoutUrl: bootstrap.provider.logoutUrl,
        postLogoutRedirectPath: bootstrap.provider.postLogoutRedirectPath,
      },
    },
    loginRedirect: {
      sanitizedAuthorizationUrl: sanitizeUrl(authorizationUrl.toString()),
      responseType: authorizationUrl.searchParams.get('response_type'),
      codeChallengePresent: Boolean(authorizationUrl.searchParams.get('code_challenge')),
      codeChallengeMethod: authorizationUrl.searchParams.get('code_challenge_method'),
      statePresent: Boolean(authorizationUrl.searchParams.get('state')),
      redirectUri: authorizationUrl.searchParams.get('redirect_uri'),
      scope: authorizationUrl.searchParams.get('scope'),
    },
    accessTokenPayload: sanitizedPayload,
    idTokenStoredForLogout: idTokenStored,
    session: sanitizeSession(session),
    actionSmoke,
    logout: {
      sanitizedObservedLogoutUrl: logoutRequests[0] ?? null,
      returnedToLogin: page.url().startsWith(`${baseUrl}/auth/login`),
      bearerTokenStoredAfterLogout: storageAfterLogout.bearerTokenStored,
      providerIdTokenStoredAfterLogout: storageAfterLogout.providerIdTokenStored,
    },
    expiredToken: {
      expiredJwtCleared: !expiredStorage.bearerTokenStored,
      idTokenCleared: !expiredStorage.providerIdTokenStored,
      authSessionRequestCount,
      authorizationHeaderSent,
      landingRoute: new URL(expiredPage.url()).pathname,
      browserRefreshTokenUsed: false,
    },
    limitations: evidenceLimitations(),
  }

  console.log(JSON.stringify(evidence, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
})
