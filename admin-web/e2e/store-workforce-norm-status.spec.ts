import { expect, test, type Page } from './test-fixtures'
import { installStoreContractSession } from './store-page-contract-fixtures'

const regionId = '12121212-1212-4121-8121-121212121212'
const companyId = '00000000-0000-0000-0000-000000000001'
const stores = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Short Store', norm: 5, active: 3, gap: 2 },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Balanced Store', norm: 3, active: 3, gap: 0 },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Over Store', norm: 2, active: 4, gap: -2 },
  { id: '44444444-4444-4444-8444-444444444444', name: 'Missing Plan Store', norm: null, active: 4, gap: null },
]

test('region workforce keeps missing norm distinct from zero and reports truthful status', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => route.fulfill({ json: createAuthSession() }))
  await page.route('**/api/store/workforce/workspace**', async (route) => route.fulfill({ json: { data: createWorkspace() } }))
  await page.goto('/store/workforce')

  await expectRow(page, 'Short Store', 'Eksik')
  await expectRow(page, 'Balanced Store', 'Tam')
  await expectRow(page, 'Over Store', 'Fazla')
  await expectRow(page, 'Missing Plan Store', 'Tanımsız')
  await expect(page.getByRole('button', { name: /Missing Plan Store/ })).toContainText('Tanımsız / 4')
})

async function expectRow(page: Page, storeName: string, status: string) {
  const row = page.getByRole('button', { name: new RegExp(storeName) })
  await expect(row).toBeVisible()
  await expect(row).toContainText(status)
}

function createAuthSession() {
  return { authMode: 'mock', authenticated: true, user: { userId: 'region-workforce-user', roleCodes: ['REGION_MANAGER'], scope: { companyIds: [companyId], regionIds: [regionId], storeIds: [] }, readScope: { companyIds: [companyId], regionIds: [regionId], storeIds: stores.map((store) => store.id) }, actionScope: { assignedStoreIds: stores.map((store) => store.id) }, assignedStoreIds: stores.map((store) => store.id), roleScopes: { REGION_MANAGER: { companyIds: [companyId], regionIds: [regionId], storeIds: stores.map((store) => store.id) } } }, scopeSummary: { assignedStoreCount: 4, companyCount: 1, regionCount: 1, storeCount: 4 } }
}

function createWorkspace() {
  return { view: 'region_manager', summary: { totalStores: 4, activePersonnel: 14, shortageStores: 1, openPositions: 2, averageTenureDays: null }, stores: { items: stores.map((store) => ({ companyId, companyName: 'Company', regionId, regionName: 'Region', regionManagerName: 'Manager', storeId: store.id, storeCode: store.id, storeName: store.name, storeStatus: 'active', norm: store.norm, active: store.active, averageTenureDays: null, gap: store.gap, shortageDays: store.gap && store.gap > 0 ? 7 : null, personnel: [], personnelTotal: 0, personnelLimit: 50, personnelOffset: 0, personnelHasMore: false })), total: 4, limit: 50, offset: 0, hasMore: false }, history: null, capabilities: { canCreateSellerCodeRequest: false, canCreateOffboardingRequest: false } }
}
