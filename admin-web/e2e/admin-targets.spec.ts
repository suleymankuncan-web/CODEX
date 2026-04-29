import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
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

  await routeAdminTargetsApi(page)
})

test('admin target page shows approved personnel target coverage', async ({ page }) => {
  await page.goto('/admin/targets')

  const coveragePanel = page.getByLabel('Target reference coverage')
  await expect(coveragePanel.getByRole('heading', { name: 'Approved personnel target readiness' })).toBeVisible()
  await expect(coveragePanel.getByText('Coverage rate')).toBeVisible()
  await expect(coveragePanel.getByText('40%')).toBeVisible()
  await expect(coveragePanel.getByText('Missing targets').first()).toBeVisible()
  await expect(coveragePanel.getByText('Ece Demir')).toBeVisible()
  await expect(coveragePanel.getByText('Pending approval').first()).toBeVisible()
  await expect(coveragePanel.getByText('Mert Kaya')).toBeVisible()
  await expect(coveragePanel.getByText('Pending change').first()).toBeVisible()
  await expect(coveragePanel.getByText('Deniz Arslan')).toBeVisible()
  await expect(coveragePanel.getByText('Stale reference').first()).toBeVisible()
  await expect(coveragePanel.getByText('Selin Yurt')).toBeVisible()
  await expect(coveragePanel.getByText('Marmara Park').first()).toBeVisible()
})

async function routeAdminTargetsApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/target-distributions/requests**', async (route) => {
    await route.fulfill({ json: targetDistributionRequestsFixture })
  })

  await page.route('**/api/target-distributions/coverage**', async (route) => {
    await route.fulfill({ json: targetCoverageFixture })
  })
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'super-admin-targets-user',
    roleCodes: ['SUPER_ADMIN'],
    scope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: ['00000000-0000-0000-0000-000000000010'],
      storeIds: [],
    },
    readScope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: ['00000000-0000-0000-0000-000000000010'],
      storeIds: [],
    },
    actionScope: {
      assignedStoreIds: [],
    },
    assignedStoreIds: [],
  },
  scopeSummary: {
    companyCount: 1,
    regionCount: 1,
    storeCount: 0,
    assignedStoreCount: 0,
  },
}

const targetDistributionRequestsFixture = {
  items: [],
  meta: {
    count: 0,
    total: 0,
    limit: 50,
    offset: 0,
  },
}

const targetCoverageFixture = {
  items: [
    {
      storeId: '00000000-0000-0000-0000-000000000100',
      storeName: 'Marmara Park',
      employeeId: '00000000-0000-4000-8000-000000000501',
      displayName: 'Ece Demir',
      externalEmployeeRef: 'FM8376',
      targetReferenceId: null,
      targetValue: null,
      pendingRequestId: null,
      pendingTargetValue: null,
      staleTargetReferenceId: null,
      targetStatus: 'missing',
    },
    {
      storeId: '00000000-0000-0000-0000-000000000100',
      storeName: 'Marmara Park',
      employeeId: '00000000-0000-4000-8000-000000000502',
      displayName: 'Ada Kaya',
      externalEmployeeRef: 'FM8375',
      targetReferenceId: '00000000-0000-4000-8000-000000000601',
      targetValue: 150000,
      pendingRequestId: null,
      pendingTargetValue: null,
      staleTargetReferenceId: null,
      targetStatus: 'approved',
    },
    {
      storeId: '00000000-0000-0000-0000-000000000100',
      storeName: 'Marmara Park',
      employeeId: '00000000-0000-4000-8000-000000000503',
      displayName: 'Mert Kaya',
      externalEmployeeRef: 'FM8377',
      targetReferenceId: null,
      targetValue: null,
      pendingRequestId: '00000000-0000-4000-8000-000000000701',
      pendingTargetValue: 125000,
      staleTargetReferenceId: null,
      targetStatus: 'pending_region_approval',
    },
    {
      storeId: '00000000-0000-0000-0000-000000000100',
      storeName: 'Marmara Park',
      employeeId: '00000000-0000-4000-8000-000000000504',
      displayName: 'Deniz Arslan',
      externalEmployeeRef: 'FM8378',
      targetReferenceId: '00000000-0000-4000-8000-000000000602',
      targetValue: 90000,
      pendingRequestId: '00000000-0000-4000-8000-000000000702',
      pendingTargetValue: 100000,
      staleTargetReferenceId: null,
      targetStatus: 'pending_change_conflict',
    },
    {
      storeId: '00000000-0000-0000-0000-000000000100',
      storeName: 'Marmara Park',
      employeeId: '00000000-0000-4000-8000-000000000505',
      displayName: 'Selin Yurt',
      externalEmployeeRef: 'FM8379',
      targetReferenceId: null,
      targetValue: null,
      pendingRequestId: null,
      pendingTargetValue: null,
      staleTargetReferenceId: '00000000-0000-4000-8000-000000000603',
      targetStatus: 'stale_reference',
    },
  ],
  meta: {
    count: 5,
    total: 5,
    limit: 50,
    offset: 0,
  },
  summary: {
    requestMonth: '2026-04-01',
    totalEmployees: 5,
    coveredEmployees: 2,
    missingEmployees: 1,
    pendingEmployees: 1,
    conflictEmployees: 1,
    staleEmployees: 1,
    uncoveredEmployees: 3,
    coverageRate: 0.4,
  },
}
