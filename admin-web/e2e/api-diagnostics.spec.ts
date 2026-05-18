import { expect, test, type Page } from './test-fixtures'

type ApiFailureDiagnostic = {
  event: string
  route: string
  method: string
  path: string
  queryKeys: string[]
  status: number | null
  durationMs: number
  retryable: boolean
  requestAttempt: number
  errorCategory: string
  errorMessage: string
  requestId: string | null
}

const companyId = '00000000-0000-0000-0000-000000000001'
const regionId = '00000000-0000-0000-0000-000000000010'
const storeId = '00000000-0000-0000-0000-000000000100'
const routeSecret = 'secret-route-value'
const responseBodySecret = 'seeded-body-secret'

test('emits sanitized API failure diagnostics for feed API outages', async ({ page }) => {
  await seedStoreSession(page)
  await captureApiFailureEvents(page)
  await routeFeedApi(page, {
    status: 503,
    headers: {
      'x-request-id': 'req-feed-503',
    },
    json: {
      message: 'Temporary feed outage',
      secret: responseBodySecret,
    },
  })

  await page.goto(`/store/feed?deepLink=${routeSecret}`)

  await expect.poll(() => readFeedFailureCount(page)).toBeGreaterThan(0)

  const diagnostic = await readLastFeedFailure(page)
  expect(diagnostic).toMatchObject({
    event: 'api.failure',
    route: '/store/feed?deepLink=:value',
    method: 'GET',
    path: '/feed',
    queryKeys: ['limit', 'offset'],
    status: 503,
    retryable: true,
    errorCategory: 'http',
    errorMessage: 'Request failed with status 503',
    requestId: 'req-feed-503',
  })
  expect(diagnostic?.durationMs).toEqual(expect.any(Number))
  expect(diagnostic?.requestAttempt).toBeGreaterThanOrEqual(1)

  const serializedDiagnostic = JSON.stringify(diagnostic)
  expect(serializedDiagnostic).not.toContain(routeSecret)
  expect(serializedDiagnostic).not.toContain(responseBodySecret)
  expect(serializedDiagnostic).not.toContain('Authorization')

  const capturedEvents = await readCapturedApiFailureEvents(page)
  expect(capturedEvents.some((event) => event.path === '/feed')).toBe(true)
})

test('keeps API diagnostics quiet when feed API requests succeed', async ({ page }) => {
  await seedStoreSession(page)
  await captureApiFailureEvents(page)
  await routeFeedApi(page, {
    json: storeFeedFixture,
  })

  await page.goto('/store/feed')

  await expect(page.getByText('Pilot announcement')).toBeVisible()
  expect(await readApiFailures(page)).toEqual([])
  expect(await readCapturedApiFailureEvents(page)).toEqual([])
})

async function seedStoreSession(page: Page) {
  await page.addInitScript(
    ({ seededCompanyId }) => {
      window.localStorage.setItem(
        'store-ops-admin-session',
        JSON.stringify({
          mode: 'mock',
          mockUserId: 'store-api-diagnostics-user',
          mockRoleCodes: 'STORE_PERSONNEL',
          mockCompanyIds: seededCompanyId,
          bearerToken: '',
        }),
      )
    },
    { seededCompanyId: companyId },
  )
}

async function captureApiFailureEvents(page: Page) {
  await page.addInitScript(() => {
    const typedWindow = window as Window & {
      __CAPTURED_STORE_OPS_API_FAILURES__?: ApiFailureDiagnostic[]
    }
    typedWindow.__CAPTURED_STORE_OPS_API_FAILURES__ = []
    window.addEventListener('store-ops-api-failure', (event) => {
      typedWindow.__CAPTURED_STORE_OPS_API_FAILURES__?.push(
        (event as CustomEvent<ApiFailureDiagnostic>).detail,
      )
    })
  })
}

async function routeFeedApi(
  page: Page,
  feedResponse: {
    status?: number
    headers?: Record<string, string>
    json: unknown
  },
) {
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (pathname.endsWith('/api/auth/session')) {
      await route.fulfill({ json: storeSessionFixture })
      return
    }

    if (request.method() === 'GET' && pathname.endsWith('/api/feed')) {
      await route.fulfill(feedResponse)
      return
    }

    await route.fulfill({ json: {} })
  })
}

async function readFeedFailureCount(page: Page) {
  const failures = await readApiFailures(page)
  return failures.filter((failure) => failure.path === '/feed').length
}

async function readLastFeedFailure(page: Page) {
  const failures = await readApiFailures(page)
  return failures.filter((failure) => failure.path === '/feed').at(-1) ?? null
}

async function readApiFailures(page: Page) {
  return page.evaluate(() => {
    const typedWindow = window as Window & {
      __STORE_OPS_API_FAILURES__?: ApiFailureDiagnostic[]
    }
    return typedWindow.__STORE_OPS_API_FAILURES__ ?? []
  })
}

async function readCapturedApiFailureEvents(page: Page) {
  return page.evaluate(() => {
    const typedWindow = window as Window & {
      __CAPTURED_STORE_OPS_API_FAILURES__?: ApiFailureDiagnostic[]
    }
    return typedWindow.__CAPTURED_STORE_OPS_API_FAILURES__ ?? []
  })
}

const storeFeedFixture = {
  items: [
    {
      feedPostId: '11111111-1111-4111-8111-111111111111',
      postType: 'challenge',
      title: 'Pilot announcement',
      body: 'UPT focus window for the current month.',
      linkLabel: 'Open rankings',
      linkUrl: '/store/rankings',
      visibilityScopeType: 'company',
      visibilityScopeIds: [],
      isPinned: true,
      publishStatus: 'published',
      publishedAt: '2026-04-26T09:00:00.000Z',
      startsAt: null,
      endsAt: null,
      metricCode: 'upt',
      metricLabel: 'UPT',
      challengeStartsOn: '2026-05-01',
      challengeEndsOn: '2026-05-31',
      targetRoute: '/store/rankings',
      createdByUserId: companyId,
      updatedByUserId: companyId,
      createdAt: '2026-04-26T09:00:00.000Z',
      updatedAt: '2026-04-26T09:00:00.000Z',
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const storeSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'store-api-diagnostics-user',
    employeeId: '00000000-0000-0000-0000-000000000202',
    roleCodes: ['STORE_PERSONNEL'],
    scope: {
      companyIds: [companyId],
      regionIds: [regionId],
      storeIds: [storeId],
    },
    readScope: {
      companyIds: [companyId],
      regionIds: [regionId],
      storeIds: [storeId],
    },
    actionScope: {
      assignedStoreIds: [storeId],
    },
    assignedStoreIds: [storeId],
  },
  scopeSummary: {
    companyCount: 1,
    regionCount: 1,
    storeCount: 1,
    assignedStoreCount: 1,
  },
}
