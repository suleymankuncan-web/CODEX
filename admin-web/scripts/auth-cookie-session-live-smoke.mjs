import { chromium, request } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const appRoot = dirname(scriptDir)

loadEnvFile(join(appRoot, '.env.local'))

const args = process.argv.slice(2)
const stagingMode = args.includes('--staging')
const useSystemChrome = process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === '1'
const headless = !args.includes('--headful')

const baseUrl = normalizeBaseUrl(
  envValue('AUTH_SMOKE_BASE_URL', stagingMode ? 'https://staging.hr-axis.com' : 'http://localhost:5173'),
  'AUTH_SMOKE_BASE_URL must be a valid URL',
)
const apiBaseUrl = normalizeBaseUrl(
  envValue(
    'AUTH_SMOKE_API_BASE_URL',
    stagingMode ? 'https://api-staging.hr-axis.com/api' : `${baseUrl}/api`,
  ),
  'AUTH_SMOKE_API_BASE_URL must be a valid URL',
)
const username = envValue('AUTH_SMOKE_USERNAME', '')
const password = envValue('AUTH_SMOKE_PASSWORD', '')
const otp = envValue('AUTH_SMOKE_OTP', '')
const expectedRole = envValue('AUTH_SMOKE_EXPECTED_ROLE', 'REGION_MANAGER')
const expectedLandingPath = normalizePath(envValue('AUTH_SMOKE_EXPECTED_LANDING', '/admin/competitions'))
const productReadOnly = envFlag('AUTH_SMOKE_PRODUCT_READ_ONLY', false)
const readOnlyPaths = envValue('AUTH_SMOKE_READ_PATHS', '')
  .split(',')
  .map((value) => normalizePath(value))
  .filter((value) => value !== '/')
const cookieName = envValue('AUTH_SMOKE_COOKIE_NAME', 'hr_axis_browser_session')
const expectedCookieDomain = envValue(
  'AUTH_SMOKE_EXPECTED_COOKIE_DOMAIN',
  new URL(apiBaseUrl).hostname,
)
const smokeEnvironment = envValue('AUTH_SMOKE_ENVIRONMENT', stagingMode ? 'staging' : 'local')
const storeScopedExpectedRoles = new Set([
  'REGION_MANAGER',
  'STORE_MANAGER',
  'STORE_PERSONNEL',
  'VISUAL_MERCHANDISER',
])

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return
  }

  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const match = trimmed.match(/^(?:\$env:|export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match || process.env[match[1]] !== undefined) {
      continue
    }

    process.env[match[1]] = stripEnvQuotes(match[2].trim())
  }
}

function stripEnvQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function envValue(name, fallback) {
  const value = process.env[name]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function envFlag(name, fallback) {
  const value = process.env[name]
  if (typeof value !== 'string' || !value.trim()) return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function hasExplicitEnv(name) {
  return typeof process.env[name] === 'string' && process.env[name].trim().length > 0
}

function normalizeBaseUrl(value, message) {
  try {
    const parsed = new URL(value)
    parsed.hash = ''
    return parsed.toString().replace(/\/$/, '')
  } catch {
    throw new Error(message)
  }
}

function normalizePath(value) {
  const trimmed = value.trim()
  if (!trimmed) {
    return '/'
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

function assertHttpsNonLocalUrl(envName, value) {
  const parsed = new URL(value)
  assert(
    parsed.protocol === 'https:' && !isLocalHost(parsed.hostname),
    `staging cookie-session smoke requires ${envName} to be a non-local HTTPS URL`,
  )
}

function assertConfig() {
  assert(username, 'AUTH_SMOKE_USERNAME is required')
  assert(password, 'AUTH_SMOKE_PASSWORD is required')
  assert(expectedRole, 'AUTH_SMOKE_EXPECTED_ROLE is required')
  assert(expectedLandingPath, 'AUTH_SMOKE_EXPECTED_LANDING is required')
  assert(cookieName, 'AUTH_SMOKE_COOKIE_NAME is required')
  for (const path of readOnlyPaths) {
    assert(path.startsWith('/store/'), `AUTH_SMOKE_READ_PATHS contains an unsupported path: ${path}`)
  }

  if (!stagingMode) {
    return
  }

  assertHttpsNonLocalUrl('AUTH_SMOKE_BASE_URL', baseUrl)
  assertHttpsNonLocalUrl('AUTH_SMOKE_API_BASE_URL', apiBaseUrl)
  assert(hasExplicitEnv('AUTH_SMOKE_USERNAME'), 'staging cookie-session smoke requires AUTH_SMOKE_USERNAME to be set')
  assert(hasExplicitEnv('AUTH_SMOKE_PASSWORD'), 'staging cookie-session smoke requires AUTH_SMOKE_PASSWORD to be set')
}

function chromiumLaunchOptions(options = {}) {
  return useSystemChrome ? { ...options, channel: 'chrome' } : options
}

function apiRequestBaseUrl() {
  return `${apiBaseUrl}/`
}

function apiPath(path) {
  return path.replace(/^\/+/, '')
}

function evidenceStatus() {
  if (stagingMode) {
    return 'protected_staging_cookie_session_passed'
  }

  return `${smokeEnvironment}_protected_cookie_session_passed`
}

async function maybeReadJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function expectJson(response, label) {
  const body = await maybeReadJson(response)
  assert(response.ok(), `${label} returned ${response.status()}: ${redactSensitiveOutput(JSON.stringify(body))}`)
  return body
}

async function firstVisible(page, locator, label, timeout = 15_000) {
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    const count = await locator.count().catch(() => 0)
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index)
      if (await candidate.isVisible().catch(() => false)) {
        return candidate
      }
    }

    await page.waitForTimeout(250)
  }

  throw new Error(`${label} was not visible before timeout`)
}

async function firstVisibleEnabled(page, locator, label, timeout = 15_000) {
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    const count = await locator.count().catch(() => 0)
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index)
      const visible = await candidate.isVisible().catch(() => false)
      const enabled = await candidate.isEnabled().catch(() => false)
      if (visible && enabled) {
        return candidate
      }
    }

    await page.waitForTimeout(250)
  }

  throw new Error(`${label} was not enabled before timeout`)
}

async function clickSubmit(page, timeout = 15_000) {
  const namedButton = page.getByRole('button', {
    name: /(Continue|Sign in|Verify|Submit|Devam|Giri(?:s|\u015f)|Do(?:g|\u011f)rula)/i,
  })

  try {
    const button = await firstVisibleEnabled(page, namedButton, 'submit button', Math.min(timeout, 5_000))
    await button.click()
    return
  } catch {
    const fallback = page.locator('button[type="submit"], button.cl-formButtonPrimary, button.auth-login-clerk-submit')
    const button = await firstVisibleEnabled(page, fallback, 'submit button', timeout)
    await button.click()
  }
}

async function fillFirstVisible(page, locator, value, label, timeout = 30_000) {
  const input = await firstVisible(page, locator, label, timeout)
  await input.fill(value)
  return input
}

async function maybeSubmitOtp(page) {
  const otpLocator = page.locator(
    [
      'input[name="code"]',
      'input[name^="code"]',
      'input[name*="code" i]',
      'input[name*="otp" i]',
      'input[autocomplete="one-time-code"]',
      'input[inputmode="numeric"]',
      'input[type="tel"]',
      'input[aria-label*="code" i]',
      'input[aria-label*="verification" i]',
      'input[data-otp-input]',
    ].join(', '),
  )

  let visibleInputs = []
  const deadline = Date.now() + 12_000
  while (Date.now() < deadline) {
    const count = await otpLocator.count().catch(() => 0)
    visibleInputs = []

    for (let index = 0; index < count; index += 1) {
      const candidate = otpLocator.nth(index)
      if (await candidate.isVisible().catch(() => false)) {
        visibleInputs.push(candidate)
      }
    }

    if (visibleInputs.length > 0) {
      break
    }

    await page.waitForTimeout(250)
  }

  if (visibleInputs.length === 0) {
    return false
  }

  assert(otp, 'OTP required but AUTH_SMOKE_OTP is not set')

  try {
    await visibleInputs[0].fill('')
    await visibleInputs[0].pressSequentially(otp, { delay: 40 })
  } catch {
    if (visibleInputs.length > 1 && otp.length >= visibleInputs.length) {
      for (let index = 0; index < visibleInputs.length; index += 1) {
        await visibleInputs[index].fill(otp[index] ?? '')
      }
    } else {
      await visibleInputs[0].fill(otp)
    }
  }

  try {
    await clickSubmit(page, 5_000)
  } catch {
    await visibleInputs.at(-1)?.press('Enter').catch(() => undefined)
  }
  return true
}

async function signIn(page) {
  const loginUrl = `${baseUrl}/auth/login?returnTo=${encodeURIComponent(expectedLandingPath)}`
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' })

  await fillFirstVisible(
    page,
    page.locator(
      'input[name="identifier"], input[name="emailAddress"], input[name="username"], input[type="email"], input[autocomplete="username"]',
    ),
    username,
    'identifier input',
    45_000,
  )
  await clickSubmit(page)

  await fillFirstVisible(
    page,
    page.locator('input[name="password"], input[type="password"], input[autocomplete="current-password"]'),
    password,
    'password input',
    45_000,
  )

  const browserSessionResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/auth/browser-session') &&
      response.request().method().toUpperCase() === 'POST',
    { timeout: 75_000 },
  )

  await clickSubmit(page)
  await maybeSubmitOtp(page)

  let createResponse = null
  try {
    createResponse = await browserSessionResponsePromise
  } catch (error) {
    throw new Error(
      `POST /api/auth/browser-session was not observed after sign-in submit. ${await describePageState(page)}. Cause: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
  assert(
    createResponse.status() >= 200 && createResponse.status() < 300,
    `POST /api/auth/browser-session returned ${createResponse.status()}`,
  )

  const expectedOrigin = new URL(baseUrl).origin
  await page.waitForURL(
    (url) => url.origin === expectedOrigin && url.pathname.startsWith(expectedLandingPath),
    { timeout: 75_000 },
  )
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined)

  return createResponse.status()
}

async function proveReadOnlyRoutes(page) {
  const proofs = []
  await page.setViewportSize({ width: 390, height: 844 })

  for (const path of readOnlyPaths) {
    const mutationRequests = []
    const workspaceResponses = []
    const responseReaders = []
    const onRequest = (request) => {
      const url = request.url()
      if (
        isStoreCommandApiUrl(url) &&
        !['GET', 'HEAD', 'OPTIONS'].includes(request.method().toUpperCase())
      ) {
        mutationRequests.push(`${request.method().toUpperCase()} ${new URL(url).pathname}`)
      }
    }
    const onResponse = (response) => {
      if (!isReadWorkspaceUrl(response.url(), path)) return
      responseReaders.push(
        response
          .json()
          .catch(() => null)
          .then((body) => {
            workspaceResponses.push({
              status: response.status(),
              period: typeof body?.data?.period === 'string' ? body.data.period : null,
              contract: readContractLabel(response.url()),
            })
          }),
      )
    }

    page.on('request', onRequest)
    page.on('response', onResponse)
    const navigation = await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined)
    await Promise.all(responseReaders)
    const visible = await page.evaluate(() => ({
      heading: document.querySelector('main h1')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      routeErrorVisible: Boolean(document.querySelector('[data-route-error], .store-route-error')),
    }))
    page.off('request', onRequest)
    page.off('response', onResponse)

    assert(navigation?.ok(), `${path} navigation returned ${navigation?.status() ?? 'no response'}`)
    assert(visible.heading, `${path} did not render a visible route heading`)
    assert(isExpectedReadOnlyHeading(path, visible.heading), `${path} rendered an unexpected heading: ${visible.heading}`)
    assert(!visible.horizontalOverflow, `${path} overflowed the 390 px viewport`)
    assert(!visible.routeErrorVisible, `${path} rendered a route error`)
    const successfulReads = workspaceResponses.filter(
      (response) => response.status >= 200 && response.status < 300,
    )
    assert(successfulReads.length > 0, `${path} read contract did not return a successful response`)
    if (path === '/store/incentives' || path === '/store/targets') {
      assert(
        successfulReads.some((response) => response.period),
        `${path} workspace read did not return a successful period projection`,
      )
    }
    assert(mutationRequests.length === 0, `${path} emitted mutation requests: ${mutationRequests.join(', ')}`)
    proofs.push({
      path,
      navigationStatus: navigation.status(),
      heading: visible.heading,
      workspaceResponses,
      mutationRequestCount: mutationRequests.length,
      viewport: { width: 390, height: 844, horizontalOverflow: visible.horizontalOverflow },
    })
  }

  return proofs
}

function isReadWorkspaceUrl(value, routePath) {
  try {
    const pathname = new URL(value).pathname
    const patterns = {
      '/store/incentives': /\/api\/store\/incentives\/workspace\/?$/,
      '/store/targets': /\/api\/store\/targets\/workspace\/?$/,
      '/store/kpis': /\/api\/reports\/(?:kpi-config|rankings|store-kpi-highlights)\/?$/,
      '/store/approvals': /\/api\/workflow\/request-center\/?$/,
      '/store/workforce': /\/api\/store\/workforce\/workspace\/?$/,
      '/store/tasks': /\/api\/store\/tasks\/workspace\/?$/,
    }
    return patterns[routePath]?.test(pathname) ?? false
  } catch {
    return false
  }
}

function isStoreCommandApiUrl(value) {
  try {
    return /\/api\/(?:store\/(?:incentives|targets|workforce|tasks)(?:\/|$)|workflow\/request-center\/?$|reports\/(?:kpi-config|rankings|store-kpi-highlights)\/?$)/.test(
      new URL(value).pathname,
    )
  } catch {
    return false
  }
}

function isExpectedReadOnlyHeading(path, heading) {
  const common = {
    '/store/kpis': ['KPI Özetleri', 'KPI Overview'],
    '/store/approvals': ['Talep Merkezi', 'Request Center'],
    '/store/workforce': ['Norm Kadro', 'Workforce'],
    '/store/tasks': ['Görevler', 'Tasks'],
  }
  if (common[path]) return common[path].includes(heading)

  const expected = {
    REGION_MANAGER: {
      '/store/incentives': ['Prim Kontrol Merkezi', 'Incentive Control Center'],
      '/store/targets': ['Hedef Kontrol Masası', 'Target Control Desk'],
    },
    REPORT_VIEWER: {
      '/store/incentives': ['Şirket Prim Görünümü', 'Company Incentive View'],
      '/store/targets': ['Şirket hedef görünümü', 'Company target view'],
    },
    STORE_MANAGER: {
      '/store/targets': ['Mağaza Hedef Dağılımı', 'Store Target Distribution'],
    },
  }
  return expected[expectedRole]?.[path]?.includes(heading) ?? false
}

function readContractLabel(value) {
  try {
    const pathname = new URL(value).pathname
    if (pathname.endsWith('/store/incentives/workspace')) return 'incentives_workspace'
    if (pathname.endsWith('/store/targets/workspace')) return 'targets_workspace'
    if (pathname.endsWith('/reports/kpi-config')) return 'kpi_config'
    if (pathname.endsWith('/reports/rankings')) return 'kpi_rankings'
    if (pathname.endsWith('/reports/store-kpi-highlights')) return 'kpi_highlights'
    if (pathname.endsWith('/workflow/request-center')) return 'request_center'
    if (pathname.endsWith('/store/workforce/workspace')) return 'workforce_workspace'
    if (pathname.endsWith('/store/tasks/workspace')) return 'tasks_workspace'
  } catch {
    return 'unknown'
  }
  return 'unknown'
}

async function describePageState(page) {
  const state = await page.evaluate(() => {
    function visible(element) {
      const rect = element.getBoundingClientRect()
      const style = window.getComputedStyle(element)
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    }

    return {
      url: window.location.href,
      title: document.title,
      inputs: Array.from(document.querySelectorAll('input'))
        .filter(visible)
        .slice(0, 8)
        .map((input) => ({
          autocomplete: input.getAttribute('autocomplete') ?? '',
          inputmode: input.getAttribute('inputmode') ?? '',
          name: input.getAttribute('name') ?? '',
          type: input.getAttribute('type') ?? '',
        })),
      buttons: Array.from(document.querySelectorAll('button'))
        .filter(visible)
        .slice(0, 8)
        .map((button) => ({
          disabled: button.hasAttribute('disabled'),
          text: (button.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
          type: button.getAttribute('type') ?? '',
        })),
      alerts: Array.from(document.querySelectorAll('[role="alert"], .cl-formFieldErrorText, .cl-alertText'))
        .filter(visible)
        .slice(0, 4)
        .map((alert) => (alert.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)),
    }
  })

  return redactSensitiveOutput(JSON.stringify({
    page: {
      ...state,
      url: sanitizeUrl(state.url),
    },
  }))
}

function sanitizeBootstrap(bootstrap) {
  return {
    authMode: bootstrap?.authMode ?? null,
    providerConfigured: Boolean(bootstrap?.provider?.configured),
    responseType: bootstrap?.provider?.responseType ?? null,
    tokenUrlPresent: typeof bootstrap?.provider?.tokenUrl === 'string' && bootstrap.provider.tokenUrl.length > 0,
  }
}

function sanitizeSession(session) {
  const roleCodes = Array.isArray(session?.user?.roleCodes) ? session.user.roleCodes : []
  const readCompanyIds = Array.isArray(session?.user?.readScope?.companyIds)
    ? session.user.readScope.companyIds
    : []
  const assignedStoreIds = Array.isArray(session?.user?.actionScope?.assignedStoreIds)
    ? session.user.actionScope.assignedStoreIds
    : Array.isArray(session?.user?.assignedStoreIds)
      ? session.user.assignedStoreIds
      : []

  return {
    authStatus: 200,
    authenticated: Boolean(session?.authenticated),
    roleCodes,
    companyScopeCount: readCompanyIds.length,
    assignedStoreCount: assignedStoreIds.length,
  }
}

async function readStorageProof(page) {
  return page.evaluate(() => {
    const tokenRegex = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\b/
    const suspiciousKeyRegex = /(bearer|id[-_]?token|access[-_]?token|refresh[-_]?token|jwt|secret|credential)/i

    function inspectStorage(storage, area) {
      const tokenShapedStorageKeys = []
      const suspiciousStorageKeys = []

      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index)
        if (!key) {
          continue
        }

        const value = storage.getItem(key) ?? ''
        const evidenceKey = `${area}:${key}`
        if (tokenRegex.test(value)) {
          tokenShapedStorageKeys.push(evidenceKey)
        }

        if (suspiciousKeyRegex.test(key)) {
          suspiciousStorageKeys.push(evidenceKey)
        }
      }

      return {
        suspiciousStorageKeys,
        tokenShapedStorageKeys,
      }
    }

    let appSession = null
    try {
      const raw = window.localStorage.getItem('store-ops-admin-session')
      appSession = raw ? JSON.parse(raw) : null
    } catch {
      appSession = null
    }

    const local = inspectStorage(window.localStorage, 'localStorage')
    const session = inspectStorage(window.sessionStorage, 'sessionStorage')

    return {
      appBearerStored: Boolean(window.sessionStorage.getItem('store-ops-admin-bearer-token')),
      appProviderIdTokenStored: Boolean(window.sessionStorage.getItem('store-ops-admin-provider-id-token')),
      appSessionBearerTokenStored:
        typeof appSession?.bearerToken === 'string' && appSession.bearerToken.trim().length > 0,
      appSessionBrowserSessionKeyPresent:
        typeof appSession?.browserSessionKey === 'string' && appSession.browserSessionKey.trim().length > 0,
      appSessionMode: appSession?.mode ?? null,
      appSessionTransport: appSession?.browserSessionTransport ?? null,
      csrfNoncePresent:
        typeof window.__storeOpsBrowserSessionCsrfToken === 'string' &&
        window.__storeOpsBrowserSessionCsrfToken.trim().length > 0,
      suspiciousStorageKeys: [...local.suspiciousStorageKeys, ...session.suspiciousStorageKeys],
      tokenShapedStorageKeys: [...local.tokenShapedStorageKeys, ...session.tokenShapedStorageKeys],
    }
  })
}

function assertStorageProof(storage) {
  assert(storage.appSessionMode === 'bearer', `app session mode was ${storage.appSessionMode}`)
  assert(
    storage.appSessionTransport === 'cookie',
    `app browser-session transport was ${storage.appSessionTransport}`,
  )
  assert(storage.appSessionBrowserSessionKeyPresent, 'app browser-session cache key was missing')
  assert(!storage.appSessionBearerTokenStored, 'app session persisted a bearer token')
  assert(!storage.appBearerStored, 'store-ops-admin-bearer-token was present')
  assert(!storage.appProviderIdTokenStored, 'store-ops-admin-provider-id-token was present')
  assert(storage.tokenShapedStorageKeys.length === 0, 'token-shaped values were found in browser storage')
  assert(storage.csrfNoncePresent, 'runtime CSRF nonce was missing')
}

function summarizeStorageProof(storage) {
  return {
    appBearerStored: storage.appBearerStored,
    appProviderIdTokenStored: storage.appProviderIdTokenStored,
    appSessionBrowserSessionKeyPresent: storage.appSessionBrowserSessionKeyPresent,
    appSessionTransport: storage.appSessionTransport,
    tokenShapedStorageKeys: storage.tokenShapedStorageKeys,
    suspiciousKeyCount: storage.suspiciousStorageKeys.length,
    csrfNoncePresent: storage.csrfNoncePresent,
  }
}

function summarizeCookie(cookie) {
  return {
    name: cookie.name,
    domain: cookie.domain,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    hostOnly: !cookie.domain.startsWith('.'),
  }
}

async function assertBrowserCookie(context) {
  const cookies = await context.cookies([apiBaseUrl, baseUrl])
  const cookie = cookies.find((candidate) => candidate.name === cookieName)

  assert(cookie, `${cookieName} cookie was not present`)
  assert(cookie.httpOnly === true, `${cookieName} cookie was not HttpOnly`)
  assert(cookie.secure === true, `${cookieName} cookie was not Secure`)
  assert(cookie.sameSite === 'Lax', `${cookieName} cookie SameSite was ${cookie.sameSite}`)
  assert(!cookie.domain.startsWith('.'), `${cookieName} cookie had a leading-dot broad domain`)

  if (expectedCookieDomain) {
    assert(
      cookie.domain === expectedCookieDomain,
      `${cookieName} cookie domain was ${cookie.domain}; expected ${expectedCookieDomain}`,
    )
  }

  return summarizeCookie(cookie)
}

function assertSessionProof(session) {
  assert(session.authenticated, 'GET /auth/session did not return an authenticated session')
  assert(
    session.roleCodes.includes(expectedRole),
    `session roleCodes did not include ${expectedRole}`,
  )
  assert(session.companyScopeCount > 0, 'session read company scope was empty')
  if (storeScopedExpectedRoles.has(expectedRole)) {
    assert(session.assignedStoreCount > 0, 'session assigned action store scope was empty')
  }
}

function sanitizeUrl(inputUrl) {
  try {
    const url = new URL(inputUrl)
    for (const sensitive of [
      '__clerk_ticket',
      'access_token',
      'client_secret',
      'code',
      'code_challenge',
      'code_verifier',
      'id_token',
      'id_token_hint',
      'refresh_token',
      'session_state',
      'state',
      'ticket',
      'token',
    ]) {
      if (url.searchParams.has(sensitive)) {
        url.searchParams.set(sensitive, '<present-redacted>')
      }
    }

    return url.toString()
  } catch {
    return redactSensitiveOutput(inputUrl)
  }
}

async function assertLogout(page, context) {
  const clearResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/auth/browser-session') &&
      response.request().method().toUpperCase() === 'DELETE',
    { timeout: 45_000 },
  )

  await page.goto(`${baseUrl}/auth/logout`, { waitUntil: 'domcontentloaded' })
  const clearResponse = await clearResponsePromise
  assert(
    clearResponse.status() >= 200 && clearResponse.status() < 300,
    `DELETE /api/auth/browser-session returned ${clearResponse.status()}`,
  )

  await page.waitForURL((url) => url.origin === new URL(baseUrl).origin && url.pathname === '/auth/login', {
    timeout: 45_000,
  }).catch(() => undefined)
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined)

  const cookies = await context.cookies([apiBaseUrl, baseUrl])
  const appCookiePresentAfterLogout = cookies.some(
    (candidate) => candidate.name === cookieName && candidate.value.length > 0,
  )
  assert(!appCookiePresentAfterLogout, `${cookieName} cookie was still present after logout`)

  const storage = await readStorageProof(page)
  assert(!storage.appBearerStored, 'store-ops-admin-bearer-token was present after logout')
  assert(!storage.appProviderIdTokenStored, 'store-ops-admin-provider-id-token was present after logout')

  return {
    clearStatus: clearResponse.status(),
    appCookiePresentAfterLogout,
  }
}

async function main() {
  assertConfig()

  const api = await request.newContext({ baseURL: apiRequestBaseUrl() })
  let browser = null
  let context = null
  let sessionApi = null

  try {
    const healthResponse = await api.get(apiPath('health'))
    assert(healthResponse.ok(), `GET /health returned ${healthResponse.status()}`)

    const bootstrap = await expectJson(await api.get(apiPath('auth/bootstrap')), 'GET /auth/bootstrap')
    const bootstrapProof = sanitizeBootstrap(bootstrap)
    assert(bootstrapProof.authMode === 'jwt', `bootstrap authMode was ${bootstrapProof.authMode}`)
    assert(bootstrapProof.providerConfigured, 'bootstrap provider was not configured')
    assert(bootstrapProof.responseType === 'code', `bootstrap responseType was ${bootstrapProof.responseType}`)
    assert(bootstrapProof.tokenUrlPresent, 'bootstrap token URL was missing')

    const noBearerResponse = await api.post(apiPath('auth/browser-session'))
    assert(
      noBearerResponse.status() === 401,
      `POST /auth/browser-session without bearer returned ${noBearerResponse.status()}`,
    )

    browser = await chromium.launch(chromiumLaunchOptions({ headless }))
    context = await browser.newContext()
    const page = await context.newPage()

    const createStatus = await signIn(page)
    const storageProof = await readStorageProof(page)
    assertStorageProof(storageProof)
    const cookieProof = await assertBrowserCookie(context)

    const storageState = await context.storageState()
    sessionApi = await request.newContext({
      baseURL: apiRequestBaseUrl(),
      extraHTTPHeaders: { Accept: 'application/json' },
      storageState,
    })

    const sessionResponse = await sessionApi.get(apiPath('auth/session'))
    const sessionProof = sanitizeSession(await expectJson(sessionResponse, 'GET /auth/session'))
    assertSessionProof(sessionProof)

    const csrfResponse = productReadOnly
      ? null
      : await sessionApi.post(apiPath('target-distributions/requests'), { data: {} })
    if (csrfResponse) {
      assert(
        csrfResponse.status() === 403,
        `unsafe cookie-authenticated request without X-CSRF-Token returned ${csrfResponse.status()}`,
      )
    }

    const readOnlyRouteProof = await proveReadOnlyRoutes(page)

    const logoutProof = await assertLogout(page, context)

    const evidence = {
      evidenceStatus: evidenceStatus(),
      status: 'passed',
      baseUrl,
      apiBaseUrl,
      expectedLanding: expectedLandingPath,
      expectedRole,
      bootstrap: bootstrapProof,
      browserSession: {
        createStatus,
        clearStatus: logoutProof.clearStatus,
        noBearerStatus: noBearerResponse.status(),
      },
      cookie: cookieProof,
      session: sessionProof,
      storage: summarizeStorageProof(storageProof),
      csrf: {
        mode: productReadOnly ? 'skipped_read_only' : 'negative_write_probe',
        unsafeMissingHeaderStatus: csrfResponse?.status() ?? null,
      },
      readOnlyRoutes: readOnlyRouteProof,
      logout: {
        appCookiePresentAfterLogout: logoutProof.appCookiePresentAfterLogout,
      },
      limitations: [
        'Password, one-time code, bearer token, provider token, cookie value, provider subject, and raw storage values are intentionally excluded.',
        'This smoke proves the configured persona session and does not approve broad production.',
      ],
    }

    console.log(JSON.stringify(evidence, null, 2))
  } finally {
    await sessionApi?.dispose().catch(() => undefined)
    await context?.close().catch(() => undefined)
    await browser?.close().catch(() => undefined)
    await api.dispose().catch(() => undefined)
  }
}

function redactSensitiveOutput(value) {
  let output = String(value)

  for (const exactValue of [username, password, otp]) {
    if (exactValue) {
      output = output.replaceAll(exactValue, '<redacted>')
    }
  }

  output = output.replace(
    /([?&#](?:__clerk_ticket|access_token|client_secret|code|code_challenge|code_verifier|id_token|id_token_hint|refresh_token|session_state|state|ticket|token)=)[^&#\s)]+/gi,
    '$1<present-redacted>',
  )
  output = output.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, 'Bearer <redacted>')
  output = output.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\b/g, '<redacted-jwt>')
  output = output.replace(/((?:Set-Cookie|Cookie):\s*)[^\r\n]+/gi, '$1<redacted-cookie-header>')

  return output
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  console.error(`SMOKE_FAIL ${redactSensitiveOutput(message)}`)
  process.exit(1)
})
