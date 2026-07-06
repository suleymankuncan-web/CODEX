import { expect, test, type Page } from './test-fixtures'
import {
  installGenericStoreApiFallbacks,
  installStoreContractSession,
  storeIds,
} from './store-page-contract-fixtures'

test('store KPI score source renders configured GSM and checklist contributors without raw metric ids', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)

  await page.goto('/store/kpis')

  await expect(page.getByRole('heading', { name: 'Mağaza KPI katkı kırılımı' })).toBeVisible()
  await expect(page.getByText('GSM Onayı').first()).toBeVisible()
  await expect(page.getByText('BM Checklist').first()).toBeVisible()
  await expect(page.getByText('VM Checklist').first()).toBeVisible()
  await expect(page.locator('body')).not.toContainText('gsm_approval')
  await expect(page.locator('body')).not.toContainText('TARGET_ACHIEVEMENT')
})

test('store KPI period picker opens as floating month-year picker without pushing content', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)

  await page.goto('/store/kpis')

  const sourceHeading = page.getByRole('heading', { name: 'Mağaza KPI katkı kırılımı' })
  await expect(sourceHeading).toBeVisible()
  const before = await sourceHeading.boundingBox()
  expect(before).not.toBeNull()

  await page.getByRole('button', { name: /KPI dönemi/ }).first().click()

  const pickerDialog = page.getByRole('dialog')
  await expect(pickerDialog.getByText('Dönem seç')).toBeVisible()
  await expect(pickerDialog.getByRole('button', { name: 'Haz' })).toBeVisible()
  await expect(pickerDialog.getByRole('button', { name: 'Gün' })).toHaveCount(0)
  const after = await sourceHeading.boundingBox()
  expect(after).not.toBeNull()
  expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThanOrEqual(2)
})

async function routeKpiContractApi(page: Page) {
  await page.route('**/api/reports/kpi-config', async (route) => {
    await route.fulfill({ json: createKpiConfigFixture() })
  })
  await page.route('**/api/reports/store-kpi-highlights**', async (route) => {
    await route.fulfill({ json: createStoreKpiHighlightsFixture() })
  })
  await page.route('**/api/reports/rankings**', async (route) => {
    await route.fulfill({ json: createEmptyRankingsFixture() })
  })
}

function createKpiConfigFixture() {
  const metrics = [
    profileMetric('TARGET_ACHIEVEMENT', 'Hedef gerçekleşme', 35, ['STORE_SALES', 'SALES_TARGET_ACHIEVEMENT']),
    profileMetric('UPT', 'Fiş başı ürün', 15),
    profileMetric('ATV', 'Ortalama sepet', 15),
    profileMetric('CR', 'CR', 20),
    profileMetric('GSM_ONAY', 'GSM Onayı', 5, ['gsm_approval']),
    profileMetric('BM_CHECKLIST', 'BM Checklist', 5),
    profileMetric('VM_CHECKLIST', 'VM Checklist', 5),
  ]

  return {
    gradingBands: [
      { code: 'strong', emoji: '', label: 'Güçlü', minScore: 80, tone: 'calm' },
    ],
    metadata: {
      effectiveFrom: null,
      effectiveTo: null,
      kpiConfigVersionId: null,
      publishedAt: null,
      publishedBy: null,
      versionNo: null,
    },
    ownershipMatrix: [],
    personnelProfile: {
      futureMetricRule: 'Yeni metrikler katalog üzerinden eklenir.',
      metrics: [],
      profileCode: 'personnel',
      summary: 'Personel skoru',
      title: 'Personel skoru',
    },
    storeProfile: {
      futureMetricRule: 'Yeni metrikler katalog üzerinden eklenir.',
      metrics,
      profileCode: 'store',
      summary: 'Mağaza skoru',
      title: 'Mağaza skoru',
    },
  }
}

function createStoreKpiHighlightsFixture() {
  return {
    availablePeriods: [
      { periodEnd: '2026-06-30', periodStart: '2026-06-01', periodType: 'monthly' },
      { periodEnd: '2026-07-31', periodStart: '2026-07-01', periodType: 'monthly' },
    ],
    metrics: [
      metricRow('TARGET_ACHIEVEMENT', 'Hedef gerçekleşme', 3_049_207.79, 2_750_000, 1.1088, 38.8),
      metricRow('UPT', 'Fiş başı ürün', 4.15, 3.09, 1.34, 18),
      metricRow('ATV', 'Ortalama sepet', 5503.99, 3628.54, 1.52, 18),
      metricRow('CR', 'CR', 0.1834, 0.1405, 1.31, 24),
      metricRow('gsm_approval', 'GSM Onayı', 40, 40, 1, 5),
      metricRow('BM_CHECKLIST', 'BM Checklist', 80, 100, 0.8, 4),
      metricRow('VM_CHECKLIST', 'VM Checklist', 90, 100, 0.9, 4.5),
    ],
    partial: {
      isPartial: false,
      missingMetricCodes: [],
      missingMetricLabels: [],
      pendingNormalizationCodes: [],
      pendingNormalizationLabels: [],
    },
    period: { periodEnd: '2026-07-31', periodStart: '2026-07-01' },
    score: { matchedMetrics: 7, totalMetrics: 7, value: 92 },
    source: { mode: 'live', periodType: 'monthly', snapshotDate: null, snapshotRunId: null },
    store: { storeId: storeIds[0], storeName: 'İstanbul MOI AVM' },
  }
}

function createEmptyRankingsFixture() {
  return {
    access: {
      canSeeGlobalDetails: false,
      canSeeManagedStorePersonnelDetails: true,
      globalMode: 'summary',
    },
    availablePeriods: [
      { periodEnd: '2026-07-31', periodStart: '2026-07-01', periodType: 'monthly' },
    ],
    filters: { regionManagers: [], regions: [], stores: [] },
    personnelLeaderboard: {
      currentEmployee: null,
      items: [],
      managedStorePersonnel: [],
      meta: { limit: 100, offset: 0, total: 0 },
    },
    reference: {
      personnel: { averageScore: null, metrics: [] },
      store: { averageScore: null, metrics: [] },
    },
    scopeSummary: { activePersonnelCount: 0, storeCount: 1 },
    source: {
      mode: 'live',
      periodEnd: '2026-07-31',
      periodStart: '2026-07-01',
      periodType: 'monthly',
    },
    storeLeaderboard: {
      currentStore: null,
      items: [],
      meta: { limit: 100, offset: 0, total: 0 },
    },
  }
}

function profileMetric(code: string, label: string, weightPercent: number, aliases: string[] = []) {
  return {
    aliases,
    benchmarkSource: code.includes('CHECKLIST') ? 'CHECKLIST_SCORE' : code === 'TARGET_ACHIEVEMENT' ? 'TARGET' : 'TURKEY_AVERAGE',
    capRatio: 1.2,
    code,
    direction: 'HIGHER_IS_BETTER',
    label,
    ownerRole: 'STORE_MANAGER',
    scoreBehavior: code === 'GSM_ONAY' ? 'warning_first' : 'task_candidate',
    weightPercent,
  }
}

function metricRow(
  code: string,
  label: string,
  actualValue: number,
  benchmarkValue: number,
  achievementRate: number,
  scoreContribution: number,
) {
  return {
    achievementRate,
    actualRatio: achievementRate,
    actualValue,
    benchmarkSource: code.includes('CHECKLIST') ? 'CHECKLIST_SCORE' : 'TURKEY_AVERAGE',
    benchmarkValue,
    capRatio: 1.2,
    code,
    dataStatus: 'reported',
    isCapped: false,
    label,
    scoredRatio: achievementRate,
    scoreContribution,
    scoreStatus: 'scored',
    statusBand: 'on_track',
    targetValue: benchmarkValue,
    weightPercent: code === 'TARGET_ACHIEVEMENT' ? 35 : code === 'CR' ? 20 : code === 'GSM_ONAY' || code === 'gsm_approval' || code.includes('CHECKLIST') ? 5 : 15,
  }
}
