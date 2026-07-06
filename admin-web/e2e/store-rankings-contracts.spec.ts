import { expect, test, type Page } from './test-fixtures'
import {
  employeeIds,
  installGenericStoreApiFallbacks,
  installStoreContractSession,
  regionId,
  storeIds,
} from './store-page-contract-fixtures'

test('personnel ranking keeps tab state and list rank after profile navigation', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await routeRankingsContractApi(page)

  await page.goto('/store/rankings?list=personnel&period=2026-07-01')

  await expect(page.getByRole('heading', { name: 'Türkiye personel sıralaması' })).toBeVisible()
  const firstRank = await page.locator('[data-testid="personnel-ranking-rank"]').first().innerText()
  expect(firstRank.trim()).toBe('#6')

  await page.getByRole('button', { name: 'Profile Git' }).first().click()

  await expect(page).toHaveURL(/\/store\/personnel\/employee-contract-1/)
  await expect(page.getByText(firstRank.trim()).first()).toBeVisible()

  await page.goBack()

  await expect(page).toHaveURL(/\/store\/rankings\?list=personnel/)
  await expect(page.getByRole('heading', { name: 'Türkiye personel sıralaması' })).toBeVisible()
  await expect(page.locator('[data-testid="personnel-ranking-rank"]').first()).toHaveText(firstRank)
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
  await page.route('**/api/reports/personnel-performance/**', async (route) => {
    await route.fulfill({ json: createPersonnelPerformanceFixture() })
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

function createPersonnelPerformanceFixture() {
  return {
    availablePeriods: [
      { periodEnd: '2026-07-31', periodStart: '2026-07-01', periodType: 'monthly' },
    ],
    employee: {
      displayName: 'Satış Danışmanı Ayşe',
      employeeId: employeeIds[0],
      positionName: 'Satış danışmanı',
      storeId: storeIds[0],
      storeName: 'İstanbul MOI AVM',
    },
    metricRanks: [
      {
        actualValue: 3.4,
        code: 'UPT',
        label: 'UPT',
        regionPopulation: 20,
        regionRank: 4,
        storePopulation: 5,
        storeRank: 1,
        turkeyPopulation: 84,
        turkeyRank: 6,
      },
    ],
    metrics: [
      {
        achievementRate: 1.18,
        actualValue: 118,
        code: 'TARGET_ACHIEVEMENT',
        contributionValue: 41,
        dataStatus: 'reported',
        label: 'Hedef Gerçekleştirme',
        scoreStatus: 'scored',
        statusBand: 'on_track',
        targetValue: 100,
        weightPercent: 35,
      },
      {
        achievementRate: 1.1,
        actualValue: 3.4,
        code: 'UPT',
        contributionValue: 16,
        dataStatus: 'reported',
        label: 'UPT',
        scoreStatus: 'scored',
        statusBand: 'on_track',
        targetValue: 3.1,
        weightPercent: 15,
      },
    ],
    partial: {
      isPartial: false,
      missingMetricCodes: [],
      missingMetricLabels: [],
      pendingNormalizationCodes: [],
      pendingNormalizationLabels: [],
    },
    period: { periodEnd: '2026-07-31', periodStart: '2026-07-01' },
    rankings: {
      storePopulation: 5,
      storeRank: 1,
      turkeyPopulation: 84,
      turkeyRank: 6,
    },
    score: { matchedMetrics: 2, totalMetrics: 2, value: 88 },
    source: { mode: 'live', periodType: 'monthly', snapshotDate: null, snapshotRunId: null },
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
