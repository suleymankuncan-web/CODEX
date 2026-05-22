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
      path: '/admin/master-data',
      urlPattern: /\/admin\/master-data$/,
      heading: page.getByRole('heading', { name: 'Ana Veri Yönetim Paneli' }),
    },
    {
      path: '/admin/targets',
      urlPattern: /\/admin\/targets$/,
      heading: page.getByRole('heading', { name: 'Bekleyen hedef dağıtım talepleri' }),
    },
    {
      path: '/admin/auth',
      urlPattern: /\/admin\/auth$/,
      heading: page.locator('a[href="/admin/auth/catalog"]').first(),
    },
    {
      path: '/admin/audit',
      urlPattern: /\/admin\/audit$/,
      heading: page.locator('a[href="/admin/audit/users/pilot-auth-user/audit"]').first(),
    },
    {
      path: '/admin/competitions',
      urlPattern: /\/admin\/competitions$/,
      heading: page.getByText('/admin/competitions'),
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
      heading: page.locator('.store-me-v2-page'),
    },
    {
      path: '/store/checklists',
      urlPattern: /\/store\/checklists$/,
      heading: page.locator('.store-checklists-command-page'),
    },
    {
      path: '/store/tasks',
      urlPattern: /\/store\/tasks$/,
      heading: page.locator('.store-metric-grid'),
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
      heading: page.getByText('/store/feed', { exact: true }),
    },
    {
      path: '/store/competitions',
      urlPattern: /\/store\/competitions$/,
      heading: page.getByText('/store/competitions'),
    },
    {
      path: '/store/incentives',
      urlPattern: /\/store\/incentives$/,
      heading: page.getByText('/store/incentives', { exact: true }),
    },
    {
      path: '/store/approvals',
      urlPattern: /\/store\/approvals$/,
      heading: page.getByRole('heading', { name: 'Talepler / Onaylar' }),
    },
  ]

  await verifyPilotRoutes(page, routes)

  await monitor.expectClean()
})

test('protected route refresh returns to the same route', async ({ page }) => {
  const monitor = watchPilotFailures(page)

  await page.goto('/store/rankings')
  await page.reload()

  await expect(page).toHaveURL(/\/store\/rankings$/)
  await expect(page.getByRole('heading', { name: 'Sıralamalar' })).toBeVisible()
  await expect(page.getByText('Tam kapsam')).toBeVisible()
  await expect(page.getByLabel('Bölge müdürü filtresi')).toBeVisible()
  await expect(page.getByLabel('Mağaza filtresi')).toBeVisible()
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

function watchPilotFailures(page: Page) {
  const failedRequests: string[] = []
  const failedResponses: string[] = []
  const apiFailureDiagnostics: string[] = []
  const pageErrors: string[] = []

  page.on('requestfailed', (request) => {
    if (request.url().includes('/api/')) {
      failedRequests.push(`${request.method()} ${request.url()}`)
    }
  })
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`)
    }
  })
  page.on('console', (message) => {
    if (message.type() === 'warning' && message.text().includes('[store-ops:api-failure]')) {
      apiFailureDiagnostics.push(message.text())
    }
  })
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })

  return {
    async expectClean() {
      const bufferedApiFailures = await page.evaluate(() => {
        const typedWindow = window as Window & {
          __STORE_OPS_API_FAILURES__?: Array<Record<string, unknown>>
        }

        return (typedWindow.__STORE_OPS_API_FAILURES__ ?? []).map((failure) =>
          [
            String(failure.method ?? 'UNKNOWN'),
            String(failure.path ?? 'unknown-path'),
            String(failure.status ?? 'no-status'),
            String(failure.errorCategory ?? 'unknown-category'),
          ].join(' '),
        )
      })

      expect(failedRequests, 'API requests should not fail at the network layer').toEqual([])
      expect(failedResponses, 'API responses should not return error status codes').toEqual([])
      expect(apiFailureDiagnostics, 'Pilot smoke routes should not emit API failure diagnostics').toEqual([])
      expect(bufferedApiFailures, 'Pilot smoke routes should not buffer API failure diagnostics').toEqual([])
      expect(pageErrors, 'Pilot smoke routes should not raise page errors').toEqual([])
    },
  }
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

    if (pathname.endsWith('/api/integrations/store-master-lookups')) {
      await route.fulfill({ json: storeMasterLookupsFixture })
      return
    }

    if (pathname.endsWith('/api/integrations/store-master')) {
      await route.fulfill({ json: storeMasterFixture })
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

    if (pathname.endsWith('/api/reports/my-performance')) {
      await route.fulfill({ json: myPerformanceFixture })
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
