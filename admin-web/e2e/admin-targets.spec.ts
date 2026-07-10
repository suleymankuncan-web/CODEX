import { expect, test, type Page } from './test-fixtures'
import { setStoredLocale } from './locale-test-utils'

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

  const coveragePanel = page.getByLabel('Hedef referans kapsamı')
  await expect(coveragePanel.getByRole('heading', { name: 'Onaylı personel hedef hazırlığı' })).toBeVisible()
  await expect(coveragePanel.getByText('Kapsam oranı')).toBeVisible()
  await expect(coveragePanel.getByText('40%')).toBeVisible()
  await expect(coveragePanel.getByText('Eksik hedefler').first()).toBeVisible()
  await expect(coveragePanel.getByText('Ece Demir')).toBeVisible()
  await expect(coveragePanel.getByText('Onay bekliyor').first()).toBeVisible()
  await expect(coveragePanel.getByText('Mert Kaya')).toBeVisible()
  await expect(coveragePanel.getByText('Bekleyen değişiklik').first()).toBeVisible()
  await expect(coveragePanel.getByText('Deniz Arslan')).toBeVisible()
  await expect(coveragePanel.getByText('Eski referans').first()).toBeVisible()
  await expect(coveragePanel.getByText('Selin Yurt')).toBeVisible()
  await expect(coveragePanel.getByText('Marmara Park').first()).toBeVisible()
})

test('admin target page switches chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/targets')

  await expect(page.getByRole('heading', { name: 'Bekleyen hedef dağıtım talepleri' })).toBeVisible()
  await expect(page.getByText('Hedef onayları', { exact: true })).toBeVisible()
  await expect(page.getByText('Onay kuyruğu', { exact: true })).toBeVisible()
  await expect(page.getByText('Yakın geçmiş', { exact: true })).toBeVisible()
  await expect(page.getByText('Target Approvals')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Pending target distribution requests' })).toBeVisible()
  await expect(page.getByText('Target Approvals', { exact: true })).toBeVisible()
  await expect(page.getByText('Approval Queue', { exact: true })).toBeVisible()
  await expect(page.getByText('Recent History', { exact: true })).toBeVisible()
  await expect(page.getByText('Hedef onayları')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Pending target distribution requests' })).toBeVisible()
})

async function routeAdminTargetsApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/target-distributions/requests**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const status = requestUrl.searchParams.get('status')
    const items = status
      ? targetDistributionRequestsFixture.items.filter((item) => item.status === status)
      : targetDistributionRequestsFixture.items
    await route.fulfill({
      json: {
        items,
        meta: { ...targetDistributionRequestsFixture.meta, count: items.length, total: items.length },
      },
    })
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
