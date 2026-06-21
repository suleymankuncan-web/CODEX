import { expect, test, type Page } from './test-fixtures'

const regionId = '12121212-1212-4121-8121-121212121212'
const companyId = '00000000-0000-0000-0000-000000000001'
const stores = [
  { id: '11111111-1111-4111-8111-111111111111', code: 'SHORT', name: 'Short Store' },
  { id: '22222222-2222-4222-8222-222222222222', code: 'BALANCED', name: 'Balanced Store' },
  { id: '33333333-3333-4333-8333-333333333333', code: 'OVER', name: 'Over Store' },
  { id: '44444444-4444-4444-8444-444444444444', code: 'MISSING', name: 'Missing Plan Store' },
]

test('region workforce norm status uses planned and active headcount without fake shortage duration', async ({ page }) => {
  await page.addInitScript(({ companyId, storeIds }) => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'region-workforce-user',
        mockRoleCodes: 'REGION_MANAGER',
        mockCompanyIds: companyId,
        mockStoreIds: storeIds.join(','),
        bearerToken: '',
      }),
    )
  }, { companyId, storeIds: stores.map((store) => store.id) })
  await routeNormStatusApi(page)

  await page.goto('/store/workforce')

  await expectStatus(page, 'Short Store', 'Eksik')
  await expectStatus(page, 'Balanced Store', 'Tam')
  await expectStatus(page, 'Over Store', 'Fazla')
  await expectStatus(page, 'Missing Plan Store', 'Tanımlı değil')
  await expect(page.getByText(/gundur eksik|gündür eksik|days short|short since/i)).toHaveCount(0)
})

async function expectStatus(page: Page, storeName: string, status: string) {
  const row = page.getByTestId('store-workforce-region-row').filter({ hasText: storeName })
  await expect(row).toBeVisible()
  await expect(row).toContainText(status)
  await expect(row).not.toContainText('Gercek veri')
}

async function routeNormStatusApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => route.fulfill({ json: createAuthSession() }))
  await page.route('**/api/org/stores', async (route) => {
    await route.fulfill({
      json: {
        items: stores.map((store) => ({
          store_id: store.id,
          store_code: store.code,
          store_name: store.name,
          region_id: regionId,
          company_id: companyId,
          status: 'active',
        })),
        meta: { count: stores.length, limit: stores.length, offset: 0, total: stores.length },
      },
    })
  })
  await page.route('**/api/workforce/store-employees**', async (route) => {
    const storeId = new URL(route.request().url()).searchParams.get('storeId') ?? stores[0].id
    await route.fulfill({ json: createEmployees(storeId) })
  })
  await page.route('**/api/workforce/headcount-gap**', async (route) => {
    const storeId = new URL(route.request().url()).searchParams.get('storeId') ?? stores[0].id
    await route.fulfill({ json: createHeadcountGap(storeId) })
  })
  await page.route('**/api/workforce/position-options**', async (route) => route.fulfill({ status: 403, json: {} }))
  await page.route('**/api/workforce/seller-code-requests**', async (route) => route.fulfill({ status: 403, json: {} }))
  await page.route('**/api/workforce/offboarding-requests**', async (route) => route.fulfill({ status: 403, json: {} }))
}

function createAuthSession() {
  const storeIds = stores.map((store) => store.id)
  return {
    authMode: 'mock',
    authenticated: true,
    user: {
      userId: 'region-workforce-user',
      roleCodes: ['REGION_MANAGER'],
      scope: { companyIds: [companyId], regionIds: [regionId], storeIds: [] },
      readScope: { companyIds: [companyId], regionIds: [regionId], storeIds },
      actionScope: { assignedStoreIds: [] },
      assignedStoreIds: [],
    },
    scopeSummary: { assignedStoreCount: 0, companyCount: 1, regionCount: 1, storeCount: storeIds.length },
  }
}

function createEmployees(storeId: string) {
  return {
    items: [
      {
        employeeId: `${storeId}-employee`,
        displayName: 'Store Personnel',
        externalEmployeeRef: 'FM8001',
        storeId,
        positionId: '55555555-5555-4555-8555-555555555555',
        positionCode: 'SALES_CONSULTANT',
        positionName: 'Sales Consultant',
        assignmentStartDate: '2026-04-01',
        employmentStatus: 'active',
      },
    ],
    meta: { count: 1, limit: 1, offset: 0, total: 1 },
  }
}

function createHeadcountGap(storeId: string) {
  const values = new Map([
    [stores[0].id, ['5.00', '3.00']],
    [stores[1].id, ['3.00', '3.00']],
    [stores[2].id, ['2.00', '4.00']],
    [stores[3].id, ['0.00', '4.00']],
  ])
  const [planned, active] = values.get(storeId) ?? ['0.00', '0.00']
  const gap = (Number(planned) - Number(active)).toFixed(2)
  return {
    store_id: storeId,
    planned_headcount: planned,
    active_headcount: active,
    headcount_gap: gap,
    planned_fte: planned,
    active_fte: active,
    fte_gap: gap,
  }
}
