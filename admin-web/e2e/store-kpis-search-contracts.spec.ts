import { expect, test, type Page } from './test-fixtures'
import { installGenericStoreApiFallbacks, installStoreContractSession, storeIds } from './store-page-contract-fixtures'

const stores = [
  { subject: 'store', storeId: storeIds[0], storeName: 'İstanbul MOI AVM', regionId: 'region-1', regionName: 'Marmara', regionManagerUserId: 'rm-1', regionManagerName: 'Onur Kaytan', rank: 1, population: 51, scoreValue: 86, visibility: 'detail', metrics: [] },
  { subject: 'store', storeId: storeIds[1], storeName: 'Bursa Marka Park', regionId: 'region-1', regionName: 'Marmara', regionManagerUserId: 'rm-1', regionManagerName: 'Onur Kaytan', rank: 51, population: 51, scoreValue: 70, visibility: 'detail', metrics: [] },
]
const onur = { userId: 'rm-1', displayName: 'Onur Kaytan', storeCount: 51, riskStoreCount: 1, averageScore: 78 }
const zeynep = { ...onur, userId: 'rm-2', displayName: 'Zeynep Ak' }

function rankings(url: URL) {
  const search = url.searchParams.get('search') ?? ''
  const managerSearch = url.searchParams.get('regionManagerSearch') ?? ''
  const offset = Number(url.searchParams.get('offset') ?? 0)
  const selectedManager = managerSearch ? zeynep : onur
  return {
    access: { canSeeGlobalDetails: true, canSeeManagedStorePersonnelDetails: true, globalMode: 'full' },
    availablePeriods: [{ periodEnd: '2026-07-31', periodStart: '2026-07-01', periodType: 'monthly' }],
    filters: { regionManagers: [{ id: 'rm-1', label: 'Onur Kaytan' }], regions: [{ id: 'region-1', label: 'Marmara' }], stores: stores.map(store => ({ id: store.storeId, label: store.storeName })) },
    personnelLeaderboard: { currentEmployee: null, items: [], managedStorePersonnel: [], managedStorePersonnelMeta: { limit: 50, offset: 0, total: 0 }, meta: { limit: 50, offset: 0, total: 0 } },
    reference: { personnel: { averageScore: null, metrics: [] }, store: { averageScore: null, metrics: [] } },
    regionManagerLeaderboard: {
      items: [selectedManager], meta: { limit: 20, offset: 0, total: managerSearch ? 1 : 21 },
      riskItems: [selectedManager], riskMeta: { limit: 20, offset: 0, total: managerSearch ? 1 : 21 }, riskStoreCount: 1,
    },
    scopeSummary: { activePersonnelCount: 12, storeCount: 51 },
    source: { mode: 'live', periodEnd: '2026-07-31', periodStart: '2026-07-01', periodType: 'monthly' },
    storeLeaderboard: { currentStore: null, items: search ? [stores[1]] : [stores[0]], meta: { limit: 50, offset, total: search ? 1 : 51 } },
  }
}

async function routeRankings(page: Page, reads: URL[]) {
  await page.route('**/api/reports/rankings**', async route => {
    const url = new URL(route.request().url())
    reads.push(url)
    await route.fulfill({ json: rankings(url) })
  })
}

test('Region Manager search finds a store beyond page one and resets pagination', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  const reads: URL[] = []
  await routeRankings(page, reads)

  await page.goto('/store/kpis?periodStart=2026-07-01')
  const overview = page.getByTestId('store-kpis-region-overview')
  await page.getByTestId('store-kpis-region-next-page').click()
  await expect.poll(() => reads.some(url => url.searchParams.get('offset') === '50')).toBe(true)
  await overview.getByRole('textbox', { name: 'Mağaza ara' }).fill('Bursa')
  await expect.poll(() => reads.some(url => url.searchParams.get('search') === 'Bursa' && (url.searchParams.get('offset') ?? '0') === '0')).toBe(true)
  await expect(overview.getByRole('row', { name: /Bursa Marka Park/ })).toBeVisible()
})

test('Report Viewer store search reaches other pages without manually paging', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  const reads: URL[] = []
  await routeRankings(page, reads)

  await page.goto('/store/kpis?periodStart=2026-07-01')
  const company = page.getByTestId('store-kpis-company-overview')
  await company.getByRole('textbox', { name: 'Mağaza ara' }).fill('Bursa')
  await expect.poll(() => reads.some(url => url.searchParams.get('search') === 'Bursa' && (url.searchParams.get('offset') ?? '0') === '0')).toBe(true)
  await expect(company.getByRole('link', { name: /Bursa Marka Park/ })).toBeVisible()
})

test('Report Viewer manager search finds a manager beyond the current directory page', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  const reads: URL[] = []
  await routeRankings(page, reads)

  await page.goto('/store/kpis?periodStart=2026-07-01')
  const company = page.getByTestId('store-kpis-company-overview')
  await company.getByRole('textbox', { name: 'Bölge müdürü ara' }).fill('Zeynep')
  await expect.poll(() => reads.some(url => url.searchParams.get('regionManagerSearch') === 'Zeynep' && (url.searchParams.get('regionManagerOffset') ?? '0') === '0')).toBe(true)
  await expect(company.getByRole('button', { name: /Zeynep Ak Bölge puanı/ })).toBeVisible()
})
