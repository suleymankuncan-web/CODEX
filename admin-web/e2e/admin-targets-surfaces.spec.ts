import { expect, test, type Page } from './test-fixtures'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'super-admin-targets-user',
        mockRoleCodes: 'SUPER_ADMIN',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })
})

test('admin target queue uses AdminSurface primitives without legacy page classes', async ({ page }) => {
  await routeAdminTargetSurfaceApi(page)

  await page.goto('/admin/targets')

  await expect(page.getByRole('heading', { name: 'Region approval queue for store-submitted target distribution requests.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Visible approval request and coverage impact' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Approved personnel target readiness' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pending target distribution requests' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recently approved target requests' })).toBeVisible()
  await expect(page.getByTestId('admin-metric-pending-target-approvals')).toContainText('1')
  await expect(page.getByTestId('admin-metric-target-coverage-rate')).toContainText('67%')
  await expect(page.getByText('Approval action available')).toBeVisible()
  await expect(page.getByText('1 / 1')).toBeVisible()
  await expect(page.getByText('May target distribution')).toBeVisible()
  await expect(page.getByText('Store plan update')).toBeVisible()
  await expect(page.locator('.hero-panel, .metric-card, .dashboard-card, .status-pill')).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()

  await expect(page.getByRole('heading', { name: 'Visible approval request and coverage impact' })).toBeVisible()
  const hasNoHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )
  expect(hasNoHorizontalOverflow).toBe(true)
})

test('admin target approval keeps approve payload shape unchanged', async ({ page }) => {
  let approvalPayload: unknown = null
  await routeAdminTargetSurfaceApi(page, {
    onApprove: async (request) => {
      approvalPayload = request.postDataJSON()
    },
  })

  await page.goto('/admin/targets')
  await page.getByLabel('Approval note').fill('Region approved after coverage review')
  await page.getByRole('button', { name: 'Approve request' }).click()

  await expect(page.getByText('Target distribution request approved')).toBeVisible()
  expect(approvalPayload).toEqual({
    approvalNote: 'Region approved after coverage review',
  })
})

async function routeAdminTargetSurfaceApi(
  page: Page,
  input?: {
    onApprove?: (request: import('@playwright/test').Request) => Promise<void>
  },
) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/target-distributions/requests**', async (route) => {
    await route.fulfill({ json: targetDistributionRequestsFixture })
  })

  await page.route('**/api/target-distributions/coverage**', async (route) => {
    await route.fulfill({ json: targetCoverageFixture })
  })

  await page.route('**/api/target-distributions/requests/target-request-1/approve', async (route) => {
    await input?.onApprove?.(route.request())
    await route.fulfill({
      json: {
        command: {
          status: 'accepted',
          message: 'Target distribution request approved',
        },
        data: {
          request: {
            ...pendingTargetDistributionRequest,
            status: 'approved',
            approvedByUserId: 'super-admin-targets-user',
            approvedAt: '2026-05-20T14:00:00.000Z',
            approvalNote: 'Region approved after coverage review',
          },
        },
      },
    })
  })
}

const storeId = '00000000-0000-0000-0000-000000000100'

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'super-admin-targets-user',
    roleCodes: ['SUPER_ADMIN'],
    scope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: ['00000000-0000-0000-0000-000000000010'],
      storeIds: [storeId],
    },
    readScope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: ['00000000-0000-0000-0000-000000000010'],
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

const pendingTargetDistributionRequest = {
  requestId: 'target-request-1',
  companyId: '00000000-0000-0000-0000-000000000001',
  regionId: '00000000-0000-0000-0000-000000000010',
  storeId,
  storeName: 'Marmara Park',
  requestMonth: '2026-05-01',
  targetLabel: 'May target distribution',
  totalTargetValue: 250000,
  allocationCount: 2,
  status: 'pending_region_approval',
  requestReason: 'Store plan update',
  allocations: [
    {
      employeeId: '00000000-0000-4000-8000-000000000501',
      assigneeLabel: 'Ece Demir',
      targetValue: 150000,
      note: 'Senior sales',
    },
    {
      employeeId: '00000000-0000-4000-8000-000000000502',
      assigneeLabel: 'Deniz Arslan',
      targetValue: 100000,
      note: 'New season ramp',
    },
  ],
  submittedByUserId: 'store-manager-1',
  approvedByUserId: null,
  approvedAt: null,
  approvalNote: null,
  createdAt: '2026-05-18T09:00:00.000Z',
  updatedAt: '2026-05-18T09:00:00.000Z',
}

const approvedTargetDistributionRequest = {
  ...pendingTargetDistributionRequest,
  requestId: 'target-request-2',
  targetLabel: 'April target distribution',
  status: 'approved',
  approvedByUserId: 'region-manager-1',
  approvedAt: '2026-04-19T10:30:00.000Z',
  approvalNote: 'April approved',
  createdAt: '2026-04-18T09:00:00.000Z',
  updatedAt: '2026-04-19T10:30:00.000Z',
}

const targetDistributionRequestsFixture = {
  items: [pendingTargetDistributionRequest, approvedTargetDistributionRequest],
  meta: {
    count: 2,
    total: 2,
    limit: 200,
    offset: 0,
  },
}

const targetCoverageFixture = {
  items: [
    {
      storeId,
      storeName: 'Marmara Park',
      employeeId: '00000000-0000-4000-8000-000000000501',
      displayName: 'Ece Demir',
      externalEmployeeRef: 'FM8376',
      targetReferenceId: '00000000-0000-4000-8000-000000000601',
      targetValue: 150000,
      pendingRequestId: null,
      pendingTargetValue: null,
      staleTargetReferenceId: null,
      targetStatus: 'approved',
    },
    {
      storeId,
      storeName: 'Marmara Park',
      employeeId: '00000000-0000-4000-8000-000000000502',
      displayName: 'Deniz Arslan',
      externalEmployeeRef: 'FM8377',
      targetReferenceId: null,
      targetValue: null,
      pendingRequestId: 'target-request-1',
      pendingTargetValue: 100000,
      staleTargetReferenceId: null,
      targetStatus: 'pending_region_approval',
    },
    {
      storeId,
      storeName: 'Marmara Park',
      employeeId: '00000000-0000-4000-8000-000000000503',
      displayName: 'Selin Yurt',
      externalEmployeeRef: 'FM8378',
      targetReferenceId: null,
      targetValue: null,
      pendingRequestId: null,
      pendingTargetValue: null,
      staleTargetReferenceId: null,
      targetStatus: 'missing',
    },
  ],
  meta: {
    count: 3,
    total: 3,
    limit: 50,
    offset: 0,
  },
  summary: {
    requestMonth: '2026-05-01',
    totalEmployees: 3,
    coveredEmployees: 2,
    missingEmployees: 1,
    pendingEmployees: 1,
    conflictEmployees: 0,
    staleEmployees: 0,
    uncoveredEmployees: 1,
    coverageRate: 0.67,
  },
}
