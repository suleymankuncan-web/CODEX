import type { Page } from './test-fixtures'
import { storeIds } from './store-page-contract-fixtures'
import { createEmptyRankingsFixture } from './store-kpis-empty-rankings-fixture'

export async function routeKpiContractApi(
  page: Page,
  options: {
    highlightResponse?: ReturnType<typeof createStoreKpiHighlightsFixture>
    onHighlightRead?: () => void
  } = {},
) {
  await page.route('**/api/reports/kpi-config', async (route) => {
    await route.fulfill({ json: createKpiConfigFixture() })
  })
  await page.route('**/api/reports/store-kpi-highlights**', async (route) => {
    options.onHighlightRead?.()
    await route.fulfill({ json: options.highlightResponse ?? createStoreKpiHighlightsFixture() })
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

export function createStoreKpiHighlightsFixture() {
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
      metricRow('gsm_approval', 'GSM Onayı', 40, 56.2, 0.4, 2, { targetValue: null }),
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
  options: { targetValue?: number | null } = {},
) {
  const targetValue = Object.prototype.hasOwnProperty.call(options, 'targetValue')
    ? options.targetValue
    : benchmarkValue

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
    targetValue,
    weightPercent: code === 'TARGET_ACHIEVEMENT' ? 35 : code === 'CR' ? 20 : code === 'GSM_ONAY' || code === 'gsm_approval' || code.includes('CHECKLIST') ? 5 : 15,
  }
}
