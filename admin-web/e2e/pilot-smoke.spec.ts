import { expect, test, type BrowserContext, type Locator, type Page } from './test-fixtures'

const storeId = '00000000-0000-0000-0000-000000000100'
const employeeId = '00000000-0000-0000-0000-000000000200'
const regionId = '00000000-0000-0000-0000-000000000010'
const companyId = '00000000-0000-0000-0000-000000000001'
const competitionId = '00000000-0000-4000-8000-000000000300'
const competitionStageId = '00000000-0000-4000-8000-000000000301'
const competitionTeamId = '00000000-0000-4000-8000-000000000302'

type SmokeRoute = {
  path: string
  urlPattern: RegExp
  heading: Locator
}

type PilotApiFailureDiagnostic = {
  method: string
  path: string
  status: unknown
  errorCategory: string
  errorMessage: string
  occurredAt: string
}

test.beforeEach(async ({ context, page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'pilot-smoke-user',
        mockRoleCodes:
          'SUPER_ADMIN,INTEGRATION_ADMIN,REPORT_VIEWER,REGION_MANAGER,STORE_MANAGER',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routePilotSmokeApi(context)
})

test('core admin routes open without unavailable states', async ({ page }) => {
  const monitor = watchPilotFailures(page)
  const routes = [
    {
      path: '/admin/integrations',
      urlPattern: /\/admin\/integrations$/,
      heading: page.getByRole('heading', { name: 'Entegrasyon yönetim paneli' }),
    },
    {
      path: '/admin/operations',
      urlPattern: /\/admin\/operations$/,
      heading: page.getByTestId('operations-backend-signal'),
    },
    {
      path: '/admin/master-data',
      urlPattern: /\/admin\/master-data$/,
      heading: page.getByRole('heading', { name: 'Ana Veri Kontrolü' }),
    },
    {
      path: '/admin/targets',
      urlPattern: /\/admin\/targets$/,
      heading: page.getByRole('heading', { name: 'Bekleyen hedef dağıtım talepleri' }),
    },
    {
      path: '/admin/auth',
      urlPattern: /\/admin\/auth$/,
      heading: page.getByRole('heading', { name: 'Erişim Yönetimi' }),
    },
    {
      path: '/admin/audit',
      urlPattern: /\/admin\/audit$/,
      heading: page.locator('a[href="/admin/audit/users/pilot-auth-user/audit"]').first(),
    },
    {
      path: '/admin/competitions',
      urlPattern: /\/admin\/competitions$/,
      heading: page.getByRole('heading', { name: /Bölge yarışma etapları/i }),
    },
    {
      path: '/admin/reports',
      urlPattern: /\/admin\/reports$/,
      heading: page.getByRole('main').getByRole('heading').first(),
    },
    {
      path: '/admin/incentives',
      urlPattern: /\/admin\/incentives$/,
      heading: page.getByTestId('admin-incentives-page'),
    },
    {
      path: '/admin/kpi-config',
      urlPattern: /\/admin\/kpi-config$/,
      heading: page.getByRole('heading', { name: /Skor profilleri/ }),
    },
  ]

  await verifyPilotRoutes(page, routes)

  await monitor.expectClean()
})

test('core store routes open without unavailable states', async ({ page }) => {
  const monitor = watchPilotFailures(page)
  const routes = [
    {
      path: '/store',
      urlPattern: /\/store$/,
      heading: page.locator('.store-command-home'),
    },
    {
      path: '/store/me',
      urlPattern: /\/store\/me$/,
      heading: page.locator('[data-testid="store-me-page"]'),
    },
    {
      path: '/store/checklists',
      urlPattern: /\/store\/checklists$/,
      heading: page.locator('.store-checklists-command-page'),
    },
    {
      path: '/store/tasks',
      urlPattern: /\/store\/tasks$/,
      heading: page.getByTestId('store-action-plans-panel'),
    },
    {
      path: '/store/rankings',
      urlPattern: /\/store\/rankings$/,
      heading: page.getByRole('heading', { name: 'Sıralamalar' }),
    },
    {
      path: '/store/kpis',
      urlPattern: /\/store\/kpis$/,
      heading: page.getByRole('heading', { name: /KPI/ }).first(),
    },
    {
      path: '/store/feed',
      urlPattern: /\/store\/feed$/,
      heading: page.getByRole('heading', { name: 'Duyurular' }),
    },
    {
      path: '/store/competitions',
      urlPattern: /\/store\/competitions$/,
      heading: page.getByRole('heading', { name: /Mağaza yarışmaları/i }),
    },
    {
      path: '/store/incentives',
      urlPattern: /\/store\/incentives$/,
      heading: page.getByRole('heading', { name: /primleri$/i }),
    },
    {
      path: '/store/approvals',
      urlPattern: /\/store\/approvals$/,
      heading: page.getByRole('heading', { name: 'Talep Merkezi' }),
    },
    {
      path: '/store/targets',
      urlPattern: /\/store\/targets$/,
      heading: page.locator('.targets-prototype'),
    },
    {
      path: '/store/workforce',
      urlPattern: /\/store\/workforce$/,
      heading: page.getByTestId('store-workforce-page'),
    },
    {
      path: '/store/reports',
      urlPattern: /\/store\/reports$/,
      heading: page.locator('.store-reports-command'),
    },
  ]

  await verifyPilotRoutes(page, routes)

  await monitor.expectClean()
})

test('protected route refresh returns to the same route', async ({ page }) => {
  const monitor = watchPilotFailures(page)

  await page.goto('/store/rankings')
  await waitForStoreIncentivesRequest(page)
  await page.reload()
  await waitForStoreIncentivesRequest(page)

  await expect(page).toHaveURL(/\/store\/rankings$/)
  await expect(page.getByRole('heading', { name: 'Sıralamalar' })).toBeVisible()
  await expect(page.getByText('Tam görünüm')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Yıl filtresi' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ay filtresi' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Gün filtresi' })).toBeVisible()
  await expect(page.getByLabel('Bölge müdürü filtresi')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Filtreleri temizle' })).toBeVisible()
  await expectHealthySurface(page)
  await monitor.expectClean()
})

async function expectHealthySurface(page: Page) {
  await expect(page.locator('body')).not.toContainText(
    /unavailable|acilamadi|could not load|couldn't load|route not available|session rejected/i,
  )
}

function verifyPilotRoutes(page: Page, routes: SmokeRoute[]) {
  return routes.reduce(
    (chain, route) => chain.then(() => verifyPilotRoute(page, route)),
    Promise.resolve(),
  )
}

async function verifyPilotRoute(page: Page, route: SmokeRoute) {
  await page.goto(route.path)
  await expect(page).toHaveURL(route.urlPattern)
  await expect(route.heading).toBeVisible()
  await expectHealthySurface(page)
}

async function waitForStoreIncentivesRequest(page: Page) {
  await page.waitForResponse(
    (response) =>
      response.url().includes('/api/store/incentives') &&
      response.status() < 400,
    { timeout: 5_000 },
  ).catch(() => undefined)
}

function watchPilotFailures(page: Page) {
  const failedRequests: string[] = []
  const failedResponses: string[] = []
  const navigationAbortKeys = new Map<string, number>()
  const apiFailureDiagnostics: PilotApiFailureDiagnostic[] = []
  const apiFailureDiagnosticReads: Array<Promise<void>> = []
  const pageErrors: string[] = []

  page.on('requestfailed', (request) => {
    if (request.url().includes('/api/')) {
      const failureText = request.failure()?.errorText ?? ''
      if (request.method() === 'GET' && isNavigationAbort(failureText)) {
        incrementMapCount(navigationAbortKeys, buildApiRequestKey(request.method(), request.url()))
        return
      }

      failedRequests.push(
        `${request.method()} ${request.url()}${failureText ? ` (${failureText})` : ''}`,
      )
    }
  })
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`)
    }
  })
  page.on('console', (message) => {
    if (message.type() !== 'warning' || !message.text().includes('[store-ops:api-failure]')) {
      return
    }

    const diagnosticArg = message.args()[1]
    if (!diagnosticArg) {
      apiFailureDiagnostics.push(normalizePilotConsoleFailure(message.text()))
      return
    }

    apiFailureDiagnosticReads.push(
      diagnosticArg
        .jsonValue()
        .then((failure) => {
          apiFailureDiagnostics.push(normalizePilotApiFailure(failure))
        })
        .catch(() => {
          apiFailureDiagnostics.push(normalizePilotConsoleFailure(message.text()))
        }),
    )
  })
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })

  return {
    async expectClean() {
      await Promise.all(apiFailureDiagnosticReads)
      const bufferedApiFailures = await page.evaluate(() => {
        const typedWindow = window as Window & {
          __STORE_OPS_API_FAILURES__?: Array<Record<string, unknown>>
        }

        return typedWindow.__STORE_OPS_API_FAILURES__ ?? []
      })
      const blockingApiFailures = uniquePilotApiFailures([
        ...apiFailureDiagnostics,
        ...bufferedApiFailures.map(normalizePilotApiFailure),
      ])
        .filter((failure) => !consumeNavigationAbort(navigationAbortKeys, failure))
        .map((failure) =>
          [
            failure.method,
            failure.path,
            failure.status ?? 'no-status',
            failure.errorCategory,
            failure.errorMessage,
          ].join(' '),
        )

      expect(failedRequests, 'API requests should not fail at the network layer').toEqual([])
      expect(failedResponses, 'API responses should not return error status codes').toEqual([])
      expect(blockingApiFailures, 'Pilot smoke routes should not buffer API failure diagnostics').toEqual([])
      expect(pageErrors, 'Pilot smoke routes should not raise page errors').toEqual([])
    },
  }
}

function normalizePilotApiFailure(failure: unknown): PilotApiFailureDiagnostic {
  const record =
    typeof failure === 'object' && failure !== null ? (failure as Record<string, unknown>) : {}

  return {
    method: String(record.method ?? 'UNKNOWN'),
    path: String(record.path ?? 'unknown-path'),
    status: record.status ?? null,
    errorCategory: String(record.errorCategory ?? 'unknown-category'),
    errorMessage: String(record.errorMessage ?? ''),
    occurredAt: String(record.occurredAt ?? ''),
  }
}

function normalizePilotConsoleFailure(message: string): PilotApiFailureDiagnostic {
  return {
    method: parseConsoleField(message, 'method') ?? 'UNKNOWN',
    path: parseConsoleField(message, 'path') ?? 'unknown-path',
    status: parseConsoleStatus(message),
    errorCategory: parseConsoleField(message, 'errorCategory') ?? 'network',
    errorMessage: message,
    occurredAt: parseConsoleField(message, 'occurredAt') ?? '',
  }
}

function parseConsoleField(message: string, field: string) {
  const match = message.match(new RegExp(`\\b${field}:\\s*([^,}]+)`))
  return match?.[1]?.trim()
}

function parseConsoleStatus(message: string) {
  const value = parseConsoleField(message, 'status')
  if (!value || value === 'null') {
    return null
  }

  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
}

function uniquePilotApiFailures(failures: PilotApiFailureDiagnostic[]) {
  const seen = new Set<string>()

  return failures.filter((failure) => {
    const key = [
      failure.method,
      failure.path,
      failure.status ?? 'no-status',
      failure.errorCategory,
      failure.errorMessage,
      failure.occurredAt,
    ].join('\0')
    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function isNavigationAbort(failureText: string) {
  const normalizedFailureText = failureText.toLowerCase()

  return (
    normalizedFailureText.includes('err_aborted') ||
    normalizedFailureText.includes('aborted') ||
    normalizedFailureText.includes('cancelled') ||
    normalizedFailureText.includes('canceled')
  )
}

function buildApiRequestKey(method: string, value: string) {
  const parsedUrl = new URL(value, 'https://store-ops.local')
  const apiPath = parsedUrl.pathname.replace(/^\/api(?=\/|$)/, '')

  return `${method.toUpperCase()} ${apiPath}`
}

function incrementMapCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

function consumeNavigationAbort(
  navigationAbortKeys: Map<string, number>,
  failure: {
    method: string
    path: string
    status: unknown
    errorCategory: string
  },
) {
  if (
    failure.method.toUpperCase() !== 'GET' ||
    failure.status !== null ||
    failure.errorCategory !== 'network'
  ) {
    return false
  }

  const key = buildApiRequestKey(failure.method, failure.path)
  const count = navigationAbortKeys.get(key) ?? 0
  if (count <= 0) {
    return false
  }

  if (count === 1) {
    navigationAbortKeys.delete(key)
  } else {
    navigationAbortKeys.set(key, count - 1)
  }

  return true
}

async function routePilotSmokeApi(context: BrowserContext) {
  await context.route('**/api/**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (pathname.endsWith('/api/auth/session')) {
      await route.fulfill({ json: authSessionFixture })
      return
    }

    if (pathname.endsWith('/api/auth/lookups')) {
      await route.fulfill({ json: authLookupsFixture })
      return
    }

    if (pathname.endsWith('/api/auth/users')) {
      await route.fulfill({ json: authUsersFixture })
      return
    }

    if (pathname.endsWith('/api/auth/role-assignments')) {
      await route.fulfill({ json: authRoleAssignmentsFixture })
      return
    }

    if (pathname.endsWith('/api/auth/action-store-assignments')) {
      await route.fulfill({ json: authActionStoreAssignmentsFixture })
      return
    }

    if (/\/api\/auth\/users\/[^/]+\/audit$/.test(pathname)) {
      await route.fulfill({ json: authAuditFixture })
      return
    }

    if (/\/api\/auth\/role-assignments\/[^/]+\/audit$/.test(pathname)) {
      await route.fulfill({ json: authAuditFixture })
      return
    }

    if (pathname.endsWith('/api/feed')) {
      await route.fulfill({ json: feedFixture })
      return
    }

    if (pathname.endsWith('/api/health')) {
      await route.fulfill({ json: healthFixture })
      return
    }

    if (pathname.endsWith('/api/integrations/import-batches/overview')) {
      await route.fulfill({ json: importOverviewFixture })
      return
    }

    if (pathname.endsWith('/api/integrations/import-batches/needs-action')) {
      await route.fulfill({ json: emptyListFixture })
      return
    }

    if (pathname.endsWith('/api/integrations/lookups')) {
      await route.fulfill({ json: integrationLookupsFixture })
      return
    }

    if (pathname.endsWith('/api/integrations/import-payload-templates')) {
      await route.fulfill({ json: importPayloadTemplateFixture })
      return
    }

    if (pathname.endsWith('/api/integrations/master-data-quality/issues')) {
      await route.fulfill({ json: masterDataQualityIssuesFixture })
      return
    }

    if (pathname.endsWith('/api/integrations/master-data-quality/audit')) {
      await route.fulfill({ json: masterDataQualityAuditFixture })
      return
    }

    if (pathname.endsWith('/api/integrations/store-master-lookups')) {
      await route.fulfill({ json: storeMasterLookupsFixture })
      return
    }

    if (pathname.endsWith('/api/integrations/store-master')) {
      await route.fulfill({ json: storeMasterFixture })
      return
    }

    if (pathname.endsWith('/api/integrations/personnel-master-lookups')) {
      await route.fulfill({ json: personnelMasterLookupsFixture })
      return
    }

    if (pathname.endsWith('/api/integrations/personnel-master')) {
      await route.fulfill({ json: personnelMasterFixture })
      return
    }

    if (pathname.endsWith('/api/integrations/master-data-bootstrap/batches')) {
      await route.fulfill({ json: masterDataFixture })
      return
    }

    if (pathname.endsWith('/api/snapshots/runs/needs-action')) {
      await route.fulfill({ json: snapshotNeedsActionFixture })
      return
    }

    if (pathname.endsWith('/api/snapshots/runs/overview')) {
      await route.fulfill({ json: snapshotOverviewFixture })
      return
    }

    if (pathname.endsWith('/api/target-distributions/requests')) {
      await route.fulfill({ json: targetRequestsFixture })
      return
    }

    if (pathname.endsWith('/api/target-distributions/coverage')) {
      await route.fulfill({ json: targetCoverageFixture })
      return
    }

    if (pathname.endsWith('/api/target-distributions/store-personnel')) {
      await route.fulfill({ json: storePersonnelFixture })
      return
    }

    if (pathname.endsWith('/api/workforce/position-options')) {
      await route.fulfill({ json: positionOptionsFixture })
      return
    }

    if (pathname.endsWith('/api/org/stores')) {
      await route.fulfill({ json: orgStoresFixture })
      return
    }

    if (pathname.endsWith('/api/workforce/headcount-gap')) {
      await route.fulfill({ json: headcountGapFixture })
      return
    }

    if (pathname.endsWith('/api/workforce/store-employees')) {
      await route.fulfill({ json: storeEmployeesFixture })
      return
    }

    if (pathname.endsWith('/api/workforce/seller-code-requests')) {
      await route.fulfill({ json: emptyListFixture })
      return
    }

    if (pathname.endsWith('/api/workforce/offboarding-requests')) {
      await route.fulfill({ json: emptyListFixture })
      return
    }

    if (pathname.endsWith('/api/checklists/acknowledgements/list')) {
      await route.fulfill({ json: checklistAcknowledgementsFixture })
      return
    }

    if (pathname.endsWith('/api/mobile/checklists/today')) {
      await route.fulfill({ json: mobileChecklistTodayFixture })
      return
    }

    if (pathname.endsWith('/api/workflow/inbox')) {
      await route.fulfill({ json: workflowInboxFixture })
      return
    }

    if (pathname.endsWith('/api/store-actions/plans')) {
      await route.fulfill({ json: storeActionPlansFixture })
      return
    }

    if (pathname.endsWith('/api/reports/kpi-config')) {
      await route.fulfill({ json: kpiConfigFixture })
      return
    }

    if (pathname.endsWith('/api/reports/kpi-config/editor')) {
      await route.fulfill({ json: kpiConfigEditorFixture })
      return
    }

    if (pathname.endsWith('/api/reports/kpi-config/audit')) {
      await route.fulfill({ json: kpiConfigAuditFixture })
      return
    }

    if (pathname.endsWith('/api/reports/summary')) {
      await route.fulfill({ json: reportingSummaryFixture })
      return
    }

    if (pathname.endsWith('/api/reports/snapshot-runs')) {
      await route.fulfill({ json: reportingSnapshotRunsFixture })
      return
    }

    if (pathname.endsWith('/api/reports/store-monthly-package')) {
      await route.fulfill({ json: storeMonthlyReportPackageFixture })
      return
    }

    if (pathname.endsWith('/api/reports/my-performance')) {
      await route.fulfill({ json: myPerformanceFixture })
      return
    }

    if (pathname.endsWith('/api/admin/incentives')) {
      await route.fulfill({ json: adminIncentivesFixture })
      return
    }

    if (pathname.endsWith('/api/store/incentives')) {
      await route.fulfill({ json: storeIncentivesFixture })
      return
    }

    if (pathname.endsWith('/api/reports/store-kpi-highlights')) {
      await route.fulfill({ json: storeKpiHighlightsFixture })
      return
    }

    if (pathname.endsWith('/api/reports/rankings')) {
      await route.fulfill({ json: rankingsFixture })
      return
    }

    if (pathname.endsWith('/api/competitions/team-templates')) {
      await route.fulfill({ json: competitionTeamTemplatesFixture })
      return
    }

    if (pathname.endsWith(`/api/competitions/${competitionId}/stage-package-plans`)) {
      await route.fulfill({ json: emptyListFixture })
      return
    }

    if (pathname.endsWith(`/api/competitions/${competitionId}`)) {
      await route.fulfill({ json: competitionDetailFixture })
      return
    }

    if (pathname.endsWith('/api/competitions')) {
      await route.fulfill({ json: competitionListFixture })
      return
    }

    await route.fulfill({
      status: 501,
      json: {
        message: `Missing pilot smoke API fixture for ${request.method()} ${pathname}`,
      },
    })
  })
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'pilot-smoke-user',
    employeeId,
    roleCodes: [
      'SUPER_ADMIN',
      'INTEGRATION_ADMIN',
      'REPORT_VIEWER',
      'REGION_MANAGER',
      'STORE_MANAGER',
    ],
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

const authLookupsFixture = {
  scopeTypes: ['company', 'region', 'store'],
  authProviders: ['mock'],
  users: [{ userId: 'pilot-auth-user', username: 'pilot.admin', email: 'pilot.admin@example.com' }],
  roles: [
    {
      roleId: 'pilot-role-super-admin',
      roleCode: 'SUPER_ADMIN',
      roleName: 'Super Admin',
      scopeType: 'company',
    },
  ],
  permissions: [
    {
      permissionId: 'pilot-permission-auth-read',
      permissionCode: 'auth:read',
      resourceName: 'auth',
      actionName: 'read',
    },
  ],
  stores: [
    {
      storeId,
      storeCode: 'PILOT-100',
      storeName: 'Pilot Store',
      companyId,
      regionId,
      regionName: 'Pilot Region',
    },
  ],
  optionGroups: {
    users: [{ userId: 'pilot-auth-user', username: 'pilot.admin', email: 'pilot.admin@example.com' }],
    roles: [
      {
        roleId: 'pilot-role-super-admin',
        roleCode: 'SUPER_ADMIN',
        roleName: 'Super Admin',
        scopeType: 'company',
      },
    ],
    permissions: [
      {
        permissionId: 'pilot-permission-auth-read',
        permissionCode: 'auth:read',
        resourceName: 'auth',
        actionName: 'read',
      },
    ],
    stores: [],
    scopeTypes: [
      { value: 'company', label: 'company' },
      { value: 'region', label: 'region' },
      { value: 'store', label: 'store' },
    ],
    authProviders: [{ value: 'mock', label: 'mock' }],
  },
  meta: {
    totalUsers: 1,
    totalRoles: 1,
    totalPermissions: 1,
    totalStores: 1,
  },
}

const authUsersFixture = {
  items: [
    {
      userId: 'pilot-auth-user',
      employeeId: null,
      username: 'pilot.admin',
      email: 'pilot.admin@example.com',
      authProvider: 'mock',
      providerSubject: 'pilot-admin-subject',
      isActive: true,
      lastLoginAt: '2026-05-01T09:00:00.000Z',
      createdAt: '2026-05-01T08:00:00.000Z',
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const authRoleAssignmentsFixture = {
  items: [
    {
      assignmentId: 'pilot-role-assignment',
      userId: 'pilot-auth-user',
      username: 'pilot.admin',
      email: 'pilot.admin@example.com',
      roleCode: 'SUPER_ADMIN',
      roleName: 'Super Admin',
      scopeType: 'company',
      companyId,
      regionId: null,
      storeId: null,
      effectiveFrom: '2026-05-01',
      effectiveTo: null,
      createdAt: '2026-05-01T08:05:00.000Z',
      active: true,
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const authActionStoreAssignmentsFixture = {
  items: [
    {
      assignmentId: 'pilot-action-store-assignment',
      userId: 'pilot-auth-user',
      username: 'pilot.admin',
      email: 'pilot.admin@example.com',
      storeId,
      storeCode: 'PILOT-100',
      storeName: 'Pilot Store',
      companyId,
      regionId,
      regionName: 'Pilot Region',
      effectiveFrom: '2026-05-01',
      effectiveTo: null,
      createdAt: '2026-05-01T08:10:00.000Z',
      active: true,
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const authAuditFixture = {
  items: [
    {
      eventLogId: 'pilot-auth-audit-event',
      occurredAt: '2026-05-01T08:15:00.000Z',
      eventType: 'auth.assignment.updated',
      actorUserId: 'pilot-smoke-user',
      correlationId: 'pilot-auth-audit-correlation',
      metadata: {
        sourceContext: { module: 'auth', operation: 'update' },
        changedFields: ['roleCode'],
        details: { roleCode: 'SUPER_ADMIN' },
      },
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const emptyListFixture = {
  items: [],
  meta: { count: 0, total: 0, limit: 50, offset: 0 },
}

const storeActionPlansFixture = {
  items: [],
  meta: { count: 0, total: 0, limit: 20, offset: 0 },
}

const feedFixture = {
  items: [
    {
      feedPostId: 'pilot-feed-1',
      postType: 'announcement',
      title: 'Pilot announcement',
      body: 'Pilot store shell announcement.',
      linkLabel: null,
      linkUrl: null,
      visibilityScopeType: 'store',
      visibilityScopeIds: [storeId],
      isPinned: true,
      publishStatus: 'published',
      publishedAt: '2026-05-01T08:00:00.000Z',
      startsAt: null,
      endsAt: null,
      metricCode: null,
      metricLabel: null,
      challengeStartsOn: null,
      challengeEndsOn: null,
      targetRoute: null,
      createdByUserId: 'pilot-smoke-user',
      updatedByUserId: 'pilot-smoke-user',
      createdAt: '2026-05-01T08:00:00.000Z',
      updatedAt: '2026-05-01T08:00:00.000Z',
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const healthFixture = {
  status: 'ok',
  service: 'store-ops-api',
  timestamp: '2026-05-21T09:00:00.000Z',
  queueBackend: 'in-memory',
  queue: {
    backend: 'in-memory',
    durable: false,
    redisRequired: false,
    status: 'process-local',
    message: 'In-memory queue is process-local; acceptable for controlled pilot only.',
  },
  observability: {
    status: 'ok',
    errorTracking: {
      dsnConfigured: false,
      environment: 'staging',
      externalDelivery: 'not-enabled',
      mode: 'log-only',
    },
    logLevel: 'info',
    readinessProfile: 'controlled-pilot',
  },
  checks: {
    database: {
      status: 'ok',
      latencyMs: 4,
    },
    redis: {
      status: 'skipped',
      latencyMs: 0,
      message: 'Redis health check skipped for process-local queue posture.',
    },
  },
}

const importOverviewFixture = {
  totals: {
    all: 3,
    completed: 1,
    failed: 0,
    completedWithErrors: 1,
    pending: 0,
    queued: 1,
    processing: 0,
  },
  healthTotals: {
    healthy: 1,
    inProgress: 1,
    blocked: 0,
    retryReady: 1,
    needsAction: 0,
    stuck: 0,
  },
  actionTotals: {
    blocked: 0,
    retryReady: 1,
    needsAction: 0,
    stuck: 0,
  },
  latest: {
    completedBatchId: 'batch-completed-1',
    failedBatchId: null,
    inProgressBatchId: 'batch-queued-1',
    stuckBatchId: null,
  },
}

const integrationLookupsFixture = {
  activeSources: [
    {
      sourceId: 'source-kpi-1',
      sourceCode: 'power-bi-kpi',
      sourceName: 'Power BI KPI',
      entityType: 'kpi',
      sourceSystem: 'power_bi',
      stateModel: 'closed_period',
    },
  ],
  meta: {
    totalEntityTypes: 7,
    totalActiveSources: 1,
  },
}

const importPayloadTemplateFixture = {
  entityType: 'kpi',
  sourceSystem: 'power_bi',
  requestBody: {
    sourceCode: 'power-bi-kpi',
    entityType: 'kpi',
    fileReference: 'sample.json',
    sourceCapturedAt: '2026-05-01T08:00:00.000Z',
    sourceWindowStartedAt: '2026-05-01T00:00:00.000Z',
    sourceWindowEndedAt: '2026-05-31T23:59:59.000Z',
    rows: [],
  },
}

const masterDataQualityIssuesFixture = {
  items: [
    {
      id: 'pilot-smoke-master-data-issue',
      issueCode: 'store_missing_region_assignment',
      severity: 'warning',
      entityType: 'store',
      entityId: storeId,
      entityLabel: 'Pilot Store',
      secondaryLabel: 'Store master',
      problemLabel: 'Region assignment review',
      recommendedAction: 'Review store region assignment.',
      affectedModules: ['KPI', 'Targets', 'Incentives'],
      lastSeenAt: '2026-06-30T10:00:00.000Z',
      source: 'store-master',
    },
  ],
  summary: {
    severity: { critical: 0, warning: 1, info: 0 },
    entityType: { store: 1, personnel: 0, assignment: 0, import: 0 },
  },
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const masterDataQualityAuditFixture = {
  items: [
    {
      eventId: 'pilot-smoke-master-data-audit',
      eventType: 'store_master_updated',
      entityType: 'store',
      entityId: storeId,
      entityLabel: 'Pilot Store',
      actorLabel: 'Pilot Admin',
      occurredAt: '2026-06-30T10:30:00.000Z',
      summary: 'Store master reviewed.',
      metadata: {},
    },
  ],
  meta: { count: 1, total: 1, limit: 30, offset: 0 },
}

const storeMasterLookupsFixture = {
  storeTypes: [
    { value: 'company', label: 'Company' },
    { value: 'franchise', label: 'Franchise' },
    { value: 'operator', label: 'Operator' },
  ],
  statuses: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'closed', label: 'Closed' },
  ],
  regions: [
    {
      regionId,
      regionCode: 'PILOT',
      regionName: 'Pilot Region',
    },
  ],
}

const storeMasterFixture = {
  items: [
    {
      storeId,
      storeCode: 'PILOT-100',
      storeName: 'Pilot Store',
      storeType: 'company',
      status: 'active',
      kpiImportEnabled: true,
      regionId,
      regionName: 'Pilot Region',
    },
  ],
  meta: { count: 1, total: 1, limit: 200, offset: 0 },
}

const personnelMasterLookupsFixture = {
  stores: [
    {
      storeId,
      storeCode: 'PILOT-100',
      storeName: 'Pilot Store',
      regionId,
      regionName: 'Pilot Region',
    },
  ],
  positions: [
    {
      positionId: '44444444-4444-4444-8444-444444444444',
      positionCode: 'STORE_MANAGER',
      positionName: 'Store Manager',
      isManagerial: true,
    },
  ],
  employmentStatuses: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'terminated', label: 'Terminated' },
  ],
  employmentTypes: [
    { value: 'full_time', label: 'Full time' },
    { value: 'part_time', label: 'Part time' },
    { value: 'temporary', label: 'Temporary' },
  ],
}

const personnelMasterFixture = {
  items: [
    {
      employeeId,
      externalEmployeeRef: 'SM-1',
      firstName: 'Pilot',
      lastName: 'Manager',
      displayName: 'Pilot Store Manager',
      hireDate: '2026-05-01',
      terminationDate: null,
      employmentStatus: 'active',
      employmentType: 'full_time',
      assignmentId: 'pilot-personnel-assignment',
      assignmentStartDate: '2026-05-01',
      storeId,
      storeCode: 'PILOT-100',
      storeName: 'Pilot Store',
      regionId,
      regionName: 'Pilot Region',
      positionId: '44444444-4444-4444-8444-444444444444',
      positionCode: 'STORE_MANAGER',
      positionName: 'Store Manager',
      updatedAt: '2026-06-30T10:00:00.000Z',
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const masterDataFixture = {
  items: [
    {
      batchId: '8a1506af-b043-4968-9d75-d10c8d4432d5',
      companyId,
      bootstrapEntity: 'personnel',
      sourceLabel: 'Accepted personnel baseline',
      fileReference: 'personnel-master-mapping-prep.xlsx#chunk-9',
      uploadedByUserId: 'pilot-smoke-user',
      batchStatus: 'promoted',
      rowCount: 5,
      pendingCount: 0,
      validCount: 0,
      needsReviewCount: 0,
      invalidCount: 0,
      promotedCount: 5,
      createdAt: '2026-05-04T11:51:26.982Z',
      validatedAt: '2026-05-04T11:51:27.289Z',
      promotedAt: '2026-05-04T11:52:42.761Z',
      readiness: 'closed',
      nextAction: 'closed',
    },
  ],
  meta: { count: 1, total: 1, limit: 20, offset: 0 },
}

const snapshotNeedsActionFixture = {
  items: [],
  meta: { count: 0, total: 0, limit: 6, offset: 0 },
}

const snapshotOverviewFixture = {
  totals: {
    all: 1,
    queued: 0,
    running: 0,
    completed: 1,
    failed: 0,
  },
  healthTotals: {
    healthy: 1,
    inProgress: 0,
    retryReady: 0,
    needsAction: 0,
    stuck: 0,
  },
  actionTotals: {
    retryReady: 0,
    stuck: 0,
  },
  latest: {
    completedSnapshotRunId: 'pilot-snapshot-run-1',
    failedSnapshotRunId: null,
    inProgressSnapshotRunId: null,
    stuckSnapshotRunId: null,
  },
}

const targetRequestsFixture = {
  items: [],
  meta: { count: 0, total: 0, limit: 50, offset: 0 },
}

const targetCoverageFixture = {
  items: [
    {
      storeId,
      storeName: 'Pilot Store',
      employeeId,
      displayName: 'Pilot Store Manager',
      externalEmployeeRef: 'SM-1',
      targetReferenceId: 'target-reference-1',
      targetValue: 150000,
      pendingRequestId: null,
      pendingTargetValue: null,
      staleTargetReferenceId: null,
      targetStatus: 'approved',
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
  summary: {
    requestMonth: '2026-05-01',
    totalEmployees: 1,
    coveredEmployees: 1,
    missingEmployees: 0,
    pendingEmployees: 0,
    conflictEmployees: 0,
    staleEmployees: 0,
    uncoveredEmployees: 0,
    coverageRate: 1,
  },
}

const storePersonnelFixture = {
  items: [
    {
      employeeId,
      displayName: 'Pilot Store Manager',
      externalEmployeeRef: 'SM-1',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      netSalesValue: 1000,
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const positionOptionsFixture = {
  items: [
    {
      positionId: '44444444-4444-4444-8444-444444444444',
      positionCode: 'STORE_MANAGER',
      positionName: 'Store Manager',
      jobFamily: 'store',
      isManagerial: true,
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const orgStoresFixture = {
  items: [
    {
      store_id: storeId,
      store_code: 'PILOT-100',
      store_name: 'Pilot Store',
      region_id: regionId,
      company_id: companyId,
      status: 'active',
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const headcountGapFixture = {
  store_id: storeId,
  planned_headcount: '1.00',
  active_headcount: '1.00',
  headcount_gap: '0.00',
  planned_fte: '1.00',
  active_fte: '1.00',
  fte_gap: '0.00',
}

const storeEmployeesFixture = {
  items: [
    {
      employeeId,
      displayName: 'Pilot Store Manager',
      externalEmployeeRef: 'SM-1',
      storeId,
      positionId: '44444444-4444-4444-8444-444444444444',
      positionCode: 'STORE_MANAGER',
      positionName: 'Store Manager',
      assignmentStartDate: '2026-05-01',
      employmentStatus: 'active',
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const checklistAcknowledgementsFixture = {
  items: [
    {
      checklistInstanceId: 'pilot-checklist-instance-bm-1',
      checklistTemplateId: 'pilot-checklist-template-bm-1',
      templateName: 'BM Visit',
      templateType: 'BM_STORE_VISIT',
      category: 'BM',
      storeId,
      storeName: 'Pilot Store',
      completedByUserId: 'pilot-smoke-user',
      completedAt: '2026-05-12T09:00:00.000Z',
      status: 'completed',
      totalScore: 82,
      complianceRate: 0.82,
      responses: [],
      acknowledgement: null,
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const mobileChecklistTodayFixture = {
  data: {
    stores: [{ storeId, storeName: 'Pilot Store' }],
    templates: [
      {
        checklistTemplateId: 'pilot-checklist-template-bm-1',
        templateCode: 'BM_STORE_VISIT_2026',
        templateType: 'BM_STORE_VISIT',
        templateName: 'BM Visit',
        versionNo: 1,
        items: [],
      },
      {
        checklistTemplateId: 'pilot-checklist-template-vm-1',
        templateCode: 'VM_STORE_VISIT_2026',
        templateType: 'VM_STORE_VISIT',
        templateName: 'VM Visit',
        versionNo: 1,
        items: [],
      },
    ],
    activeInstances: [],
    completedThisMonth: [],
    pendingAcknowledgements: [],
    monthlySummaries: [],
  },
}

const workflowInboxFixture = {
  items: [],
  meta: { count: 0, total: 0, limit: 30, offset: 0 },
}

const kpiConfigFixture = {
  metadata: {
    kpiConfigVersionId: null,
    versionNo: null,
    effectiveFrom: null,
    effectiveTo: null,
    publishedAt: null,
    publishedBy: null,
  },
  storeProfile: {
    profileCode: 'store',
    title: 'Store',
    summary: 'Store score',
    futureMetricRule: 'No new metrics in pilot smoke.',
    metrics: [],
  },
  personnelProfile: {
    profileCode: 'personnel',
    title: 'Personnel',
    summary: 'Personnel score',
    futureMetricRule: 'No new metrics in pilot smoke.',
    metrics: [],
  },
  ownershipMatrix: [],
  gradingBands: [
    { code: 'A', label: 'Strong', emoji: 'A', tone: 'calm', minScore: 80 },
    { code: 'B', label: 'Good', emoji: 'B', tone: 'accent', minScore: 60 },
    { code: 'C', label: 'Focus', emoji: 'C', tone: 'warning', minScore: 0 },
  ],
}

const pilotKpiConfig = {
  metadata: {
    kpiConfigVersionId: 'pilot-kpi-config-version',
    versionNo: 1,
    effectiveFrom: '2026-05-01T00:00:00.000Z',
    effectiveTo: null,
    publishedAt: '2026-05-01T08:00:00.000Z',
    publishedBy: 'pilot-smoke-user',
  },
  storeProfile: {
    profileCode: 'store',
    title: 'Store Score',
    summary: 'Published store score profile',
    futureMetricRule: 'Pilot smoke keeps the existing KPI catalog boundary.',
    metrics: [
      {
        code: 'TARGET_ACHIEVEMENT',
        label: 'Target Achievement',
        weightPercent: 100,
        ownerRole: 'STORE_MANAGER',
        scoreBehavior: 'task_candidate',
      },
    ],
  },
  personnelProfile: {
    profileCode: 'personnel',
    title: 'Personnel Score',
    summary: 'Published personnel score profile',
    futureMetricRule: 'Pilot smoke keeps the existing KPI catalog boundary.',
    metrics: [
      {
        code: 'TARGET_ACHIEVEMENT',
        label: 'Target Achievement',
        weightPercent: 100,
        ownerRole: 'STORE_PERSONNEL',
        scoreBehavior: 'warning_first',
      },
    ],
  },
  ownershipMatrix: [
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      visibleTo: ['STORE_MANAGER', 'STORE_PERSONNEL'],
      operationalOwner: 'STORE_MANAGER',
      contributesTo: ['store', 'personnel'],
      taskCandidate: true,
    },
  ],
  gradingBands: [
    { code: 'A', label: 'Strong', emoji: 'A', tone: 'calm', minScore: 80 },
    { code: 'B', label: 'Good', emoji: 'B', tone: 'accent', minScore: 60 },
    { code: 'C', label: 'Focus', emoji: 'C', tone: 'warning', minScore: 0 },
  ],
}

const kpiConfigEditorFixture = {
  draftConfig: pilotKpiConfig,
  publishedConfig: pilotKpiConfig,
  hasUnpublishedChanges: false,
  latestPublishedVersion: {
    kpiConfigVersionId: 'pilot-kpi-config-version',
    versionNo: 1,
    effectiveFrom: '2026-05-01T00:00:00.000Z',
    effectiveTo: null,
    publishedAt: '2026-05-01T08:00:00.000Z',
    publishedBy: 'pilot-smoke-user',
  },
}

const kpiConfigAuditFixture = {
  items: [],
  meta: { count: 0, total: 0, limit: 20, offset: 0 },
}

const reportingSnapshotRun = {
  snapshotRunId: 'pilot-snapshot-run-1',
  snapshotDate: '2026-05-31',
  snapshotType: 'monthly',
  periodStart: '2026-05-01',
  periodEnd: '2026-05-31',
  runStatus: 'completed',
  generatedAt: '2026-06-01T01:00:00.000Z',
  generatedBy: 'pilot-smoke-user',
  kpiConfigVersion: {
    kpiConfigVersionId: 'pilot-kpi-config-version',
    versionNo: 1,
    state: 'versioned',
  },
}

const reportingSummaryFixture = {
  latestCompletedSnapshotRun: reportingSnapshotRun,
  cards: {
    workforceRows: 1,
    kpiRows: 1,
    checklistRows: 1,
    turnoverRows: 0,
  },
}

const reportingSnapshotRunsFixture = {
  items: [reportingSnapshotRun],
  meta: { count: 1, total: 1, limit: 8, offset: 0 },
}

const storeMonthlyReportPackageFixture = {
  period: '2026-06',
  periodLabel: 'Haziran 2026',
  coverageLabel: '1-30 Haziran',
  isCurrentPeriod: true,
  storeCount: 1,
  sections: [
    { code: 'kpis', label: 'KPI kolonlari', value: 'Skor, UPT, ATV, CR, HG%', status: 'ready' },
    { code: 'approval_scores', label: 'Onay skorlari', value: 'GSM, BM, VM', status: 'ready' },
    { code: 'actions', label: 'Aksiyon durumu', value: 'Bitirildi, devam ediyor, bekliyor', status: 'ready' },
    { code: 'targets', label: 'Hedefler', value: 'Magaza ve personel hedef durumu', status: 'ready' },
    { code: 'incentives', label: 'Primler', value: 'Hakedis ve kontrol durumu', status: 'ready' },
    { code: 'workforce', label: 'Norm Kadro', value: 'Aktif, norm, eksik gun, turnover', status: 'ready' },
    { code: 'visits', label: 'Ziyaret', value: 'Son ziyaret ve gecen gun', status: 'ready' },
  ],
  items: [
    {
      regionManager: 'Pilot Region Manager',
      storeName: 'Pilot Store',
      city: 'Istanbul',
      period: 'Haziran 2026',
      reportRange: '1-30 Haziran',
      score: '88,00',
      upt: '4,12',
      atv: '4.850,00',
      cr: '%22,4',
      hg: '%104,5',
      gsm: '%96',
      bmChecklist: '91',
      vmChecklist: '88',
      actionStatus: 'Devam ediyor',
      targetStatus: 'Onaylandi',
      incentiveStatus: 'Kontrol edildi',
      normFiili: '1 / 1',
      missingDays: 'Yok',
      turnover: 'Veri yok',
      lastVisit: '14 Haziran',
      daysSinceVisit: '15 gun',
      dataNote: '',
    },
  ],
}

const myPerformanceFixture = {
  source: { mode: 'live', snapshotRunId: null, snapshotDate: null },
  employee: { employeeId, displayName: 'Pilot Store Manager', storeId, storeName: 'Pilot Store' },
  period: { periodStart: '2026-05-01', periodEnd: '2026-05-31' },
  score: { value: 87, matchedMetrics: 1, totalMetrics: 1 },
  rankings: { turkeyRank: 12, turkeyPopulation: 100, storeRank: 1, storePopulation: 4 },
  availablePeriods: [{ periodType: 'monthly', periodStart: '2026-05-01', periodEnd: '2026-05-31' }],
  partial: {
    isPartial: false,
    missingMetricCodes: [],
    missingMetricLabels: [],
    pendingNormalizationCodes: [],
    pendingNormalizationLabels: [],
  },
  supporting: {
    netSalesValue: 1000,
    targetEntryMode: 'manager_assignment',
    targetEditableByCurrentUser: false,
  },
  metrics: [
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target achievement',
      weightPercent: 100,
      actualValue: 0.87,
      targetValue: 1,
      achievementRate: 0.87,
      benchmarkValue: null,
      benchmarkSource: 'TARGET',
      contributionValue: 87,
      dataStatus: 'reported',
      scoreStatus: 'scored',
      status: 'reported',
    },
  ],
}

const storeIncentivesFixture = {
  data: {
    period: '2026-06',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    periodTimezone: 'Europe/Istanbul',
    roleScope: 'store',
    projections: [
      {
        period: '2026-06',
        periodTimezone: 'Europe/Istanbul',
        closeCutoffAt: null,
        ruleVersionId: 'sales-target-incentive-v1.0.0',
        storeId,
        storeName: 'Pilot Store',
        storeOwnershipType: 'company',
        roleScope: 'store',
        storeTarget: '1000000.00',
        storeActualNetSales: '1000000.00',
        storeAchievementPct: '100.0000',
        storeGatePassed: true,
        calculationState: 'projected',
        blockedReason: null,
        lastImportAt: '2026-06-18T08:00:00.000Z',
        rows: [
          {
            employeeId,
            displayName: 'Pilot Store Manager',
            participantType: 'store_manager',
            positionCode: 'STORE_MANAGER',
            normalizedFromPositionCode: null,
            target: '1000000.00',
            actualPositiveSales: '1000000.00',
            achievementPct: '100.0000',
            storeAchievementPct: '100.0000',
            storeGatePassed: null,
            rate: '0.0070',
            rawEarnedAmount: '7000.000000',
            payableAmount: '7000.00',
            correctionAmount: null,
            adjustmentAmount: null,
            finalAmount: null,
            status: 'projected',
            blockedReason: null,
            rateTableVersion: 'manager-sales-target-v1.0.0',
            explanation: 'Pilot fixture projection.',
          },
        ],
      },
    ],
  },
}

const adminIncentivesFixture = {
  data: {
    period: '2026-06',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    periodTimezone: 'Europe/Istanbul',
    roleScope: 'admin',
    regionWorkflow: null,
    regionPackages: [
      {
        regionId,
        regionName: 'Pilot Region',
        regionManagerUserId: 'region-manager-user',
        regionManagerName: 'Pilot Region Manager',
        submittedByUserId: null,
        submittedByName: null,
        submittedAt: null,
        reviewedByUserId: null,
        reviewedByName: null,
        reviewedAt: null,
        reviewNote: null,
        status: 'not_submitted',
        storeCount: 1,
        reviewedStoreCount: 0,
        submittedStoreCount: 0,
        draftCorrectionCount: 0,
        submittedCorrectionCount: 0,
      },
    ],
    projections: [
      {
        period: '2026-06',
        periodTimezone: 'Europe/Istanbul',
        closeCutoffAt: null,
        ruleVersionId: 'sales-target-incentive-v1.0.0',
        regionId,
        storeId,
        storeName: 'Pilot Store',
        storeOwnershipType: 'company',
        roleScope: 'admin',
        storeTarget: '1000000.00',
        storeActualNetSales: '1000000.00',
        storeAchievementPct: '100.0000',
        storeGatePassed: true,
        calculationState: 'projected',
        blockedReason: null,
        lastImportAt: '2026-06-18T08:00:00.000Z',
        rows: [
          {
            employeeId,
            displayName: 'Pilot Store Manager',
            participantType: 'store_manager',
            positionCode: 'STORE_MANAGER',
            normalizedFromPositionCode: null,
            target: '1000000.00',
            actualPositiveSales: '1000000.00',
            achievementPct: '100.0000',
            storeAchievementPct: '100.0000',
            storeGatePassed: null,
            rate: '0.0070',
            rawEarnedAmount: '7000.000000',
            payableAmount: '7000.00',
            correctionAmount: null,
            adjustmentAmount: null,
            finalAmount: null,
            status: 'projected',
            blockedReason: null,
            rateTableVersion: 'manager-sales-target-v1.0.0',
            explanation: 'Pilot fixture projection.',
            regionCorrection: null,
          },
        ],
      },
    ],
  },
}

const storeKpiHighlightsFixture = {
  source: {
    mode: 'live',
    snapshotRunId: null,
    snapshotDate: null,
    periodType: 'monthly',
  },
  store: {
    storeId,
    storeName: 'Pilot Store',
  },
  period: {
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
  },
  score: {
    value: 88,
    matchedMetrics: 2,
    totalMetrics: 2,
  },
  availablePeriods: [
    {
      periodType: 'monthly',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
    },
  ],
  partial: {
    isPartial: false,
    missingMetricCodes: [],
    missingMetricLabels: [],
    pendingNormalizationCodes: [],
    pendingNormalizationLabels: [],
  },
  metrics: [
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target achievement',
      weightPercent: 60,
      actualValue: 0.92,
      targetValue: 1,
      achievementRate: 0.92,
      benchmarkValue: null,
      benchmarkSource: 'TARGET',
      actualRatio: 0.92,
      scoredRatio: 0.92,
      capRatio: 1.2,
      isCapped: false,
      scoreContribution: 55.2,
      missingReason: null,
      statusBand: 'on_track',
      dataStatus: 'reported',
      scoreStatus: 'scored',
    },
    {
      code: 'UPT',
      label: 'Units per ticket',
      weightPercent: 40,
      actualValue: 1.08,
      targetValue: 1,
      achievementRate: 1.08,
      benchmarkValue: null,
      benchmarkSource: 'TARGET',
      actualRatio: 1.08,
      scoredRatio: 1.08,
      capRatio: 1.2,
      isCapped: false,
      scoreContribution: 43.2,
      missingReason: null,
      statusBand: 'exceeded',
      dataStatus: 'reported',
      scoreStatus: 'scored',
    },
  ],
}

const rankingStoreRow = {
  subject: 'store',
  storeId,
  storeName: 'Pilot Store',
  regionId,
  regionName: 'Pilot Region',
  regionManagerUserId: 'region-manager-user',
  regionManagerName: 'Pilot Region Manager',
  rank: 1,
  population: 100,
  scoreValue: 90,
  visibility: 'detail',
  metrics: [
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target achievement',
      actualValue: 0.9,
      targetValue: 1,
      benchmarkValue: null,
      contributionValue: 90,
    },
  ],
}

const rankingPersonnelRow = {
  subject: 'personnel',
  employeeId,
  displayName: 'Pilot Store Manager',
  storeId,
  storeName: 'Pilot Store',
  regionId,
  regionName: 'Pilot Region',
  regionManagerUserId: 'region-manager-user',
  regionManagerName: 'Pilot Region Manager',
  rank: 1,
  population: 100,
  storeRank: 1,
  storePopulation: 4,
  scoreValue: 87,
  visibility: 'detail',
  metrics: [
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target achievement',
      actualValue: 0.87,
      targetValue: 1,
      benchmarkValue: null,
      contributionValue: 87,
    },
  ],
}

const rankingsFixture = {
  source: { mode: 'live', periodType: 'monthly', periodStart: '2026-05-01', periodEnd: '2026-05-31' },
  access: {
    globalMode: 'full',
    canSeeGlobalDetails: true,
    canSeeManagedStorePersonnelDetails: true,
  },
  filters: {
    regionManagers: [{ id: 'region-manager-user', label: 'Pilot Region Manager' }],
    regions: [{ id: regionId, label: 'Pilot Region' }],
    stores: [{ id: storeId, label: 'Pilot Store' }],
  },
  storeLeaderboard: {
    items: [rankingStoreRow],
    currentStore: rankingStoreRow,
    meta: { total: 1, limit: 100, offset: 0 },
  },
  personnelLeaderboard: {
    items: [rankingPersonnelRow],
    currentEmployee: rankingPersonnelRow,
    managedStorePersonnel: [rankingPersonnelRow],
    meta: { total: 1, limit: 100, offset: 0 },
  },
  availablePeriods: [{ periodType: 'monthly', periodStart: '2026-05-01', periodEnd: '2026-05-31' }],
}

const competitionFixture = {
  competitionId,
  competitionCode: 'PILOT_REGION_CHALLENGE',
  competitionName: 'Pilot Region Challenge',
  description: null,
  competitionType: 'region_challenge',
  lifecycleState: 'active',
  startsOn: '2026-05-01',
  endsOn: '2026-05-31',
}

const competitionListFixture = {
  items: [competitionFixture],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const competitionDetailFixture = {
  competition: competitionFixture,
  stages: [
    {
      competitionStageId,
      competitionId,
      stageCode: 'PILOT_QUALIFIER',
      stageName: 'Pilot Qualifier',
      stageOrder: 1,
      stageType: 'qualifier',
      startsOn: '2026-05-01',
      endsOn: '2026-05-31',
      lifecycleState: 'active',
      finalizationState: null,
    },
  ],
  teams: [
    {
      competitionTeamId,
      teamCode: 'PILOT_TEAM',
      teamName: 'Pilot Team',
      teamOrder: 1,
      stores: [
        {
          storeId,
          storeCode: 'PILOT-100',
          storeName: 'Pilot Store',
          regionId,
        },
      ],
    },
  ],
  latestScores: [
    {
      stageId: competitionStageId,
      teamId: competitionTeamId,
      teamCode: 'PILOT_TEAM',
      teamName: 'Pilot Team',
      snapshotDate: '2026-05-15',
      scoreValue: 91.25,
      validStoreCount: 1,
      totalStoreCount: 1,
      coverageRate: 1,
      rankPosition: 1,
      rankingPopulation: 1,
    },
  ],
  warnings: [],
  storeContributions: [
    {
      stageId: competitionStageId,
      teamId: competitionTeamId,
      teamCode: 'PILOT_TEAM',
      teamName: 'Pilot Team',
      storeId,
      storeCode: 'PILOT-100',
      storeName: 'Pilot Store',
      regionId,
      snapshotDate: '2026-05-15',
      scoreValue: 91.25,
      reportedWeightPercent: 100,
      expectedWeightPercent: 100,
      hasDailyData: true,
      missingKpiCodes: [],
    },
  ],
}

const competitionTeamTemplatesFixture = {
  items: [],
  meta: { count: 0, total: 0, limit: 50, offset: 0 },
}
