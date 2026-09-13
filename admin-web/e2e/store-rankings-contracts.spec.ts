import { expect, test, type Page } from './test-fixtures'
import {
  employeeIds,
  installGenericStoreApiFallbacks,
  installStoreContractSession,
  regionId,
  storeIds,
} from './store-page-contract-fixtures'

test('personnel ranking keeps tab state and exposes no profile navigation', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await routeRankingsContractApi(page)

  await page.goto('/store/rankings?list=personnel&period=2026-07-01')

  await expect(page.getByRole('heading', { name: 'Türkiye personel sıralaması' })).toBeVisible()
  const firstRank = await page.locator('[data-testid="personnel-ranking-rank"]').first().innerText()
  expect(firstRank.trim()).toBe('#6')
  await expect(page.getByRole('button', { name: 'Profile Git' })).toHaveCount(0)
  await expect(page.locator('.store-rankings-board a')).toHaveCount(0)
  await expect(page).toHaveURL(/\/store\/rankings\?list=personnel/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Türkiye personel sıralaması' })).toBeVisible()
  await expect(page.locator('[data-testid="personnel-ranking-rank"]').first()).toHaveText('#6')
})

test('official personnel ranking surface does not render store-manager rows', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await routeRankingsContractApi(page)

  await page.goto('/store/rankings?list=personnel&period=2026-07-01')

  await expect(page.getByText('Satış Danışmanı Ayşe')).toBeVisible()
  await expect(page.getByText('Mağaza Müdürü Mehmet')).toHaveCount(0)
})

async function routeRankingsContractApi(page: Page) {
  await page.route('**/api/reports/rankings**', async (route) => {
    await route.fulfill({ json: createRankingsContractFixture() })
  })
}

function createRankingsContractFixture() {
  const personnelRow = {
    canOpenProfile: true,
    displayName: 'Satış Danışmanı Ayşe',
    employeeId: employeeIds[0],
    metrics: [
      metric('UPT', 'UPT', 3.4),
      metric('ATV', 'ATV', 5400),
      metric('TARGET_ACHIEVEMENT', 'Hedef Gerçekleştirme', 1.18),
    ],
    population: 84,
    rank: 6,
    regionId,
    regionManagerName: 'Onur Kaytan',
    regionManagerUserId: 'region-manager-contract',
    regionName: 'Onur Kaytan Bölgesi',
    scoreValue: 88,
    storeId: storeIds[0],
    storeName: 'İstanbul MOI AVM',
    storePopulation: 5,
    storeRank: 1,
    subject: 'personnel',
    visibility: 'detail',
  }
  const storeRow = {
    metrics: [
      metric('UPT', 'UPT', 3.1),
      metric('ATV', 'ATV', 3600),
      metric('CR', 'CR', 0.18),
      metric('TARGET_ACHIEVEMENT', 'Hedef Gerçekleştirme', 1.05),
      metric('gsm_approval', 'GSM Onayı', 42),
      metric('BM_CHECKLIST', 'BM Checklist', 80),
      metric('VM_CHECKLIST', 'VM Checklist', 91),
    ],
    population: 30,
    rank: 3,
    regionId,
    regionManagerName: 'Onur Kaytan',
    regionManagerUserId: 'region-manager-contract',
    regionName: 'Onur Kaytan Bölgesi',
    scoreValue: 82,
    storeId: storeIds[0],
    storeName: 'İstanbul MOI AVM',
    subject: 'store',
    visibility: 'detail',
  }

  return {
    access: {
      canSeeGlobalDetails: true,
      canSeeManagedStorePersonnelDetails: true,
      globalMode: 'full',
    },
    availablePeriods: [
      { periodEnd: '2026-07-31', periodStart: '2026-07-01', periodType: 'monthly' },
    ],
    filters: {
      regionManagers: [{ id: 'region-manager-contract', label: 'Onur Kaytan' }],
      regions: [{ id: regionId, label: 'Onur Kaytan Bölgesi' }],
      stores: [{ id: storeIds[0], label: 'İstanbul MOI AVM' }],
    },
    personnelLeaderboard: {
      currentEmployee: personnelRow,
      items: [personnelRow],
      managedStorePersonnel: [personnelRow],
      meta: { limit: 100, offset: 0, total: 1 },
    },
    reference: {
      personnel: { averageScore: 72, metrics: [metric('UPT', 'UPT', 2.8)] },
      store: { averageScore: 80, metrics: [metric('gsm_approval', 'GSM Onayı', 38)] },
    },
    scopeSummary: {
      activePersonnelCount: 84,
      storeCount: 30,
    },
    source: {
      mode: 'live',
      periodEnd: '2026-07-31',
      periodStart: '2026-07-01',
      periodType: 'monthly',
    },
    storeLeaderboard: {
      currentStore: storeRow,
      items: [storeRow],
      meta: { limit: 100, offset: 0, total: 1 },
    },
  }
}

function metric(code: string, label: string, actualValue: number) {
  return {
    actualValue,
    benchmarkValue: null,
    code,
    contributionValue: actualValue,
    label,
    targetValue: null,
  }
}
