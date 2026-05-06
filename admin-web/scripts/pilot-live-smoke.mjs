import { chromium } from '@playwright/test'

const defaultRoutes = [
  '/admin/integrations',
  '/admin/master-data',
  '/admin/targets',
  '/store',
  '/store/me',
  '/store/rankings',
  '/store/approvals',
]

const unavailablePattern = new RegExp(
  [
    'unavailable',
    'acilamadi',
    'a(?:c|\\u00e7)[i\\u0131]lamad[i\\u0131]',
    'could not load',
    "couldn't load",
    'surface could not load',
    "surface couldn't load",
    'surface couldnt load',
    'route not available',
    'session rejected',
    'KPI config unavailable',
    'Master data bootstrap unavailable',
    'Target approval queue unavailable',
  ].join('|'),
  'i',
)

const args = process.argv.slice(2)
const stagingMode = args.includes('--staging')
const allowUnauthenticated = args.includes('--allow-unauthenticated')
const headed = args.includes('--headed')
const baseUrl = argValue('--base-url') ?? envValue('PILOT_SMOKE_BASE_URL', 'http://127.0.0.1:4174')
const bearerToken = argValue('--bearer-token') ?? envValue('PILOT_SMOKE_BEARER_TOKEN', '')
const routes = parseRoutes(argValue('--routes') ?? envValue('PILOT_SMOKE_ROUTES', defaultRoutes.join(',')))
const routeTimeoutMs = Number(argValue('--timeout-ms') ?? envValue('PILOT_SMOKE_TIMEOUT_MS', '15000'))

function envValue(name, fallback) {
  const value = process.env[name]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function argValue(name) {
  const prefix = `${name}=`
  const arg = args.find((item) => item.startsWith(prefix))
  return arg ? arg.slice(prefix.length).trim() : null
}

function hasExplicitEnv(name) {
  return typeof process.env[name] === 'string' && process.env[name].trim().length > 0
}

function parseRoutes(value) {
  return value
    .split(',')
    .map((route) => route.trim())
    .filter(Boolean)
    .map((route) => (route.startsWith('/') ? route : `/${route}`))
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertConfig() {
  const parsedBaseUrl = parseUrl(baseUrl, 'PILOT_SMOKE_BASE_URL must be a valid URL')

  assert(routes.length > 0, 'pilot live smoke requires at least one route')
  assert(
    Number.isInteger(routeTimeoutMs) && routeTimeoutMs > 0,
    'PILOT_SMOKE_TIMEOUT_MS must be a positive integer',
  )

  const isNonLocalHttps = parsedBaseUrl.protocol === 'https:' && !isLocalHost(parsedBaseUrl.hostname)
  const isNonLocalHttp = parsedBaseUrl.protocol === 'http:' && !isLocalHost(parsedBaseUrl.hostname)

  if (stagingMode) {
    assert(
      hasExplicitEnv('PILOT_SMOKE_BASE_URL') || Boolean(argValue('--base-url')),
      '--staging requires PILOT_SMOKE_BASE_URL or --base-url',
    )
    assert(
      parsedBaseUrl.protocol === 'https:' && !isLocalHost(parsedBaseUrl.hostname),
      '--staging requires a non-local HTTPS base URL',
    )
  }

  if ((stagingMode || isNonLocalHttps || isNonLocalHttp) && !allowUnauthenticated) {
    assert(
      Boolean(bearerToken.trim()),
      'PILOT_SMOKE_BEARER_TOKEN is required for non-local pilot live smoke; pass --allow-unauthenticated only for public-route diagnostics',
    )
  }

  return parsedBaseUrl
}

function normalizePath(inputUrl) {
  const parsed = new URL(inputUrl)
  return parsed.pathname.replace(/\/+$/, '') || '/'
}

function sanitizeBodySample(value) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 180)
}

async function installBearerSession(context, token) {
  const normalized = token.trim()
  if (!normalized) {
    return
  }

  await context.addInitScript((bearer) => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'bearer',
        mockUserId: 'pilot-live-smoke',
        mockRoleCodes: '',
        mockCompanyIds: '',
        bearerToken: '',
      }),
    )
    window.sessionStorage.setItem('store-ops-admin-bearer-token', bearer)
  }, normalized)
}

async function smokeRoute(page, path) {
  const apiFailures = []
  const pageErrors = []

  const onRequestFailed = (request) => {
    if (request.url().includes('/api/')) {
      apiFailures.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`)
    }
  }
  const onResponse = (response) => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      apiFailures.push(`${response.status()} ${response.url()}`)
    }
  }
  const onPageError = (error) => {
    pageErrors.push(error.message)
  }

  page.on('requestfailed', onRequestFailed)
  page.on('response', onResponse)
  page.on('pageerror', onPageError)

  try {
    const response = await page.goto(path, {
      waitUntil: 'domcontentloaded',
      timeout: routeTimeoutMs,
    })
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})

    const finalPath = normalizePath(page.url())
    const expectedPath = path.replace(/\/+$/, '') || '/'
    const bodyText = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '')
    const matchedUnavailable = unavailablePattern.exec(bodyText)
    const failures = []

    if (!response) {
      failures.push('navigation produced no response')
    } else if (response.status() >= 400) {
      failures.push(`document response returned ${response.status()}`)
    }

    if (finalPath === '/auth/login') {
      failures.push('route settled on /auth/login')
    } else if (finalPath !== expectedPath) {
      failures.push(`route settled on ${finalPath}`)
    }

    if (matchedUnavailable) {
      failures.push(`unavailable marker found: ${matchedUnavailable[0]}`)
    }

    for (const failure of apiFailures) {
      failures.push(`api failure: ${failure}`)
    }

    for (const error of pageErrors) {
      failures.push(`page error: ${error}`)
    }

    return {
      path,
      finalPath,
      documentStatus: response?.status() ?? null,
      status: failures.length > 0 ? 'failed' : 'passed',
      failures,
      bodySample: failures.length > 0 ? sanitizeBodySample(bodyText) : undefined,
    }
  } finally {
    page.off('requestfailed', onRequestFailed)
    page.off('response', onResponse)
    page.off('pageerror', onPageError)
  }
}

async function main() {
  const parsedBaseUrl = assertConfig()
  const browser = await chromium.launch({ headless: !headed })
  const context = await browser.newContext({ baseURL: parsedBaseUrl.toString() })
  await installBearerSession(context, bearerToken)
  const page = await context.newPage()
  const results = []

  try {
    for (const route of routes) {
      results.push(await smokeRoute(page, route))
    }
  } finally {
    await context.close()
    await browser.close()
  }

  const failedRoutes = results.filter((route) => route.status !== 'passed')
  const evidence = {
    status: failedRoutes.length > 0 ? 'failed' : 'passed',
    evidenceDate: new Date().toISOString(),
    baseUrl: parsedBaseUrl.origin,
    routeCount: results.length,
    bearerTokenProvided: Boolean(bearerToken.trim()),
    routes: results,
  }

  console.log(JSON.stringify(evidence, null, 2))

  if (failedRoutes.length > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
