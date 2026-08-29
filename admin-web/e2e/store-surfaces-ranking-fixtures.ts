import { demoStoreId, demoEmployeeId } from './store-surfaces-identities'

export const storeKpiHighlightsFixture = {
  source: {
    mode: 'live',
    snapshotRunId: null,
    snapshotDate: null,
    periodType: 'monthly',
  },
  store: {
    storeId: demoStoreId,
    storeName: 'IstinyePark Demo Store',
  },
  period: {
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  },
  score: {
    value: 91.5,
    matchedMetrics: 2,
    totalMetrics: 2,
  },
  availablePeriods: [
    {
      periodType: 'monthly',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
    },
  ],
  partial: {
    isPartial: false,
    missingMetricCodes: [],
    missingMetricLabels: [],
    pendingNormalizationCodes: [],
    pendingNormalizationLabels: [],
  },
  metrics: [
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      weightPercent: 35,
      actualValue: 0.98,
      targetValue: null,
      achievementRate: 0.98,
      statusBand: 'exceeded',
      dataStatus: 'reported',
      scoreStatus: 'scored',
    },
    {
      code: 'UPT',
      label: 'Units Per Ticket',
      weightPercent: 25,
      actualValue: 95,
      targetValue: null,
      achievementRate: 95,
      statusBand: 'on_track',
      dataStatus: 'reported',
      scoreStatus: 'scored',
    },
    {
      code: 'gsm_approval',
      label: 'GSM Onayı',
      weightPercent: 5,
      actualValue: 91.2052,
      targetValue: null,
      achievementRate: 0.912052,
      statusBand: 'on_track',
      dataStatus: 'reported',
      scoreStatus: 'scored',
    },
  ],
}

export const closedLeaderboardFixture = {
  source: {
    mode: 'closed',
    periodType: 'daily',
    state: 'closed',
    snapshotRunId: 'snapshot-2026-04-24',
    snapshotDate: '2026-04-24',
    periodStart: '2026-04-24',
    periodEnd: '2026-04-24',
  },
  includedSnapshotRuns: [
    {
      snapshotRunId: 'snapshot-2026-04-24',
      snapshotDate: '2026-04-24',
      snapshotType: 'daily',
      periodStart: '2026-04-24',
      periodEnd: '2026-04-24',
      runStatus: 'completed',
      generatedAt: '2026-04-24T08:00:00.000Z',
      generatedBy: 'release-smoke',
    },
  ],
  currentEmployee: {
    employeeId: demoEmployeeId,
    displayName: 'Store Personnel',
    storeId: demoStoreId,
    storeName: 'IstinyePark Demo Store',
    scoreValue: 91.5,
    rankings: {
      turkeyRank: 1,
      turkeyPopulation: 4,
      storeRank: 1,
      storePopulation: 3,
    },
    coverage: {
      closedDaysInPeriod: 1,
      daysWithPerformance: 1,
      minimumRequiredDays: 1,
      isEligibleForRanking: true,
    },
    rankingStatus: 'official',
    eligibilityReason: 'eligible',
    neededPerformanceDays: 0,
    metricRanks: [
      {
        code: 'TARGET_ACHIEVEMENT',
        label: 'Target Achievement',
        actualValue: 0.98,
        storeRank: 1,
        storePopulation: 3,
        turkeyRank: 1,
        turkeyPopulation: 4,
      },
      {
        code: 'ATV',
        label: 'Average Ticket Value',
        actualValue: 96,
        storeRank: 1,
        storePopulation: 3,
        turkeyRank: 2,
        turkeyPopulation: 4,
      },
      {
        code: 'UPT',
        label: 'Units Per Ticket',
        actualValue: 95,
        storeRank: 1,
        storePopulation: 3,
        turkeyRank: 1,
        turkeyPopulation: 4,
      },
    ],
  },
  personnelTop: [
    {
      employeeId: demoEmployeeId,
      displayName: 'Store Personnel',
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      scoreValue: 91.5,
      rankings: {
        turkeyRank: 1,
        turkeyPopulation: 4,
        storeRank: 1,
        storePopulation: 3,
      },
      coverage: {
        closedDaysInPeriod: 1,
        daysWithPerformance: 1,
        minimumRequiredDays: 1,
        isEligibleForRanking: true,
      },
      rankingStatus: 'official',
      eligibilityReason: 'eligible',
      neededPerformanceDays: 0,
      metricRanks: [],
    },
  ],
}

export const closedLeaderboardMonthlyPreviewFixture = {
  ...closedLeaderboardFixture,
  source: {
    ...closedLeaderboardFixture.source,
    periodType: 'monthly',
    snapshotRunId: null,
    snapshotDate: '2026-04-02',
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  },
  includedSnapshotRuns: [
    {
      snapshotRunId: 'snapshot-2026-04-23',
      snapshotDate: '2026-04-23',
      snapshotType: 'daily',
      periodStart: '2026-04-23',
      periodEnd: '2026-04-23',
      runStatus: 'completed',
      generatedAt: '2026-04-23T08:00:00.000Z',
      generatedBy: 'ranking-closure-job',
    },
    {
      snapshotRunId: 'snapshot-2026-04-24',
      snapshotDate: '2026-04-24',
      snapshotType: 'daily',
      periodStart: '2026-04-24',
      periodEnd: '2026-04-24',
      runStatus: 'completed',
      generatedAt: '2026-04-24T08:00:00.000Z',
      generatedBy: 'ranking-closure-job',
    },
  ],
  currentEmployee: {
    ...closedLeaderboardFixture.currentEmployee,
    rankings: {
      turkeyRank: null,
      turkeyPopulation: 4,
      storeRank: null,
      storePopulation: 3,
    },
    coverage: {
      closedDaysInPeriod: 2,
      daysWithPerformance: 2,
      minimumRequiredDays: 3,
      isEligibleForRanking: false,
    },
    rankingStatus: 'preview_only',
    eligibilityReason: 'needs_more_closed_days',
    neededPerformanceDays: 1,
  },
  personnelTop: [
    {
      ...closedLeaderboardFixture.personnelTop[0],
      rankings: {
        turkeyRank: null,
        turkeyPopulation: 4,
        storeRank: null,
        storePopulation: 3,
      },
      coverage: {
        closedDaysInPeriod: 2,
        daysWithPerformance: 2,
        minimumRequiredDays: 3,
        isEligibleForRanking: false,
      },
      rankingStatus: 'preview_only',
      eligibilityReason: 'needs_more_closed_days',
      neededPerformanceDays: 1,
    },
  ],
}

export const storeRankingSummaryRow = {
  subject: 'store',
  storeId: demoStoreId,
  storeName: 'IstinyePark Demo Store',
  regionId: '00000000-0000-0000-0000-000000000010',
  regionName: 'Marmara',
  regionManagerUserId: 'region-manager-1',
  regionManagerName: 'Region Manager',
  rank: 12,
  population: 240,
  scoreValue: 104.6,
  visibility: 'summary',
}

export const personnelRankingSummaryRow = {
  subject: 'personnel',
  employeeId: demoEmployeeId,
  displayName: 'Store Personnel - 1',
  storeId: demoStoreId,
  storeName: 'IstinyePark Demo Store',
  regionId: '00000000-0000-0000-0000-000000000010',
  regionName: 'Marmara',
  regionManagerUserId: 'region-manager-1',
  regionManagerName: 'Region Manager',
  rank: 7,
  population: 420,
  storeRank: 1,
  storePopulation: 4,
  scoreValue: 96.4,
  canOpenProfile: true,
  visibility: 'summary',
}

export const personnelRankingDetailRow = {
  ...personnelRankingSummaryRow,
  visibility: 'detail',
  metrics: [
    {
      code: 'UPT',
      label: 'UPT',
      actualValue: 4.8,
      benchmarkValue: 4.2,
      contributionValue: 29,
    },
    {
      code: 'ATV',
      label: 'ATV',
      actualValue: 1245,
      benchmarkValue: 1180,
      contributionValue: 28,
    },
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      actualValue: 0.98,
      targetValue: 1,
      contributionValue: 39.2,
    },
  ],
}

export const personnelRankingRawTargetRow = {
  ...personnelRankingDetailRow,
  metrics: personnelRankingDetailRow.metrics.map((metric) =>
    metric.code === 'TARGET_ACHIEVEMENT'
      ? {
          ...metric,
          actualValue: 3710884.57,
          targetValue: 1000000,
          benchmarkValue: 1000000,
        }
      : metric,
  ),
}

export const regionManagerInScopePersonnelRow = {
  ...personnelRankingDetailRow,
  employeeId: demoEmployeeId,
  displayName: 'BM Region Personnel',
  storeId: 'store-in-region',
  storeName: 'BM Region Store',
  regionId: 'region-1',
  regionName: 'BM Region',
  regionManagerUserId: 'region-ranking-user',
  regionManagerName: 'Region Manager',
  canOpenProfile: true,
}

export const regionManagerOutOfScopePersonnelRow = {
  ...personnelRankingDetailRow,
  employeeId: '99999999-9999-4999-8999-999999999999',
  displayName: 'Other Region Personnel',
  storeId: 'store-out-region',
  storeName: 'Other Region Store',
  regionId: 'region-2',
  regionName: 'Other Region',
  regionManagerUserId: 'other-region-manager',
  regionManagerName: 'Other Region Manager',
  canOpenProfile: false,
}

export const rankingsPrivilegedDetailStoreRow = {
  subject: 'store',
  storeId: 'store-high-hg',
  storeName: 'High HG Store',
  regionId: '00000000-0000-0000-0000-000000000010',
  regionName: 'Marmara',
  regionManagerUserId: 'region-manager-1',
  regionManagerName: 'Region Manager',
  rank: 1,
  population: 2,
  scoreValue: 91.4,
  visibility: 'detail',
  metrics: [
    {
      code: 'UPT',
      label: 'UPT',
      actualValue: 4.75,
      benchmarkValue: 4.2,
      contributionValue: 15,
    },
    {
      code: 'ATV',
      label: 'ATV',
      actualValue: 1580,
      benchmarkValue: 1320,
      contributionValue: 15,
    },
    {
      code: 'CR',
      label: 'CR',
      actualValue: 0.197,
      benchmarkValue: 0.185,
      contributionValue: 20,
    },
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      actualValue: 3710884.57,
      targetValue: 1000000,
      contributionValue: 40,
    },
    {
      code: 'gsm_approval',
      label: 'GSM Onayı',
      actualValue: 91.2052,
      contributionValue: 4.56,
    },
    {
      code: 'BM_CHECKLIST',
      label: 'BM Checklist',
      actualValue: 86,
      contributionValue: 4.3,
    },
    {
      code: 'VM_CHECKLIST',
      label: 'VM Checklist',
      actualValue: 92,
      contributionValue: 4.6,
    },
  ],
}

export const rankingsPrivilegedLowHgStoreRow = {
  ...rankingsPrivilegedDetailStoreRow,
  storeId: 'store-low-hg',
  storeName: 'Low HG Store',
  rank: 2,
  scoreValue: 64.2,
  metrics: rankingsPrivilegedDetailStoreRow.metrics.map((metric) =>
    metric.code === 'TARGET_ACHIEVEMENT'
      ? {
          ...metric,
          actualValue: 640000,
          targetValue: 1000000,
          contributionValue: 25.6,
        }
      : metric,
  ),
}

export const rankingsPrivilegedMissingChecklistStoreRow = {
  ...rankingsPrivilegedDetailStoreRow,
  metrics: rankingsPrivilegedDetailStoreRow.metrics.filter(
    (metric) => metric.code !== 'BM_CHECKLIST' && metric.code !== 'gsm_approval',
  ),
}

export const scoreDisplayLeaderStoreRow = {
  ...rankingsPrivilegedDetailStoreRow,
  storeId: 'store-score-display-leader',
  storeName: 'Weighted Score Leader With Long Store Name',
  rank: 1,
  scoreValue: 112.3,
  metrics: [
    {
      code: 'UPT',
      label: 'UPT',
      actualValue: 4,
      benchmarkValue: 4,
      contributionValue: 15,
    },
    {
      code: 'ATV',
      label: 'ATV',
      actualValue: 1500,
      benchmarkValue: 1500,
      contributionValue: 15,
    },
    {
      code: 'CR',
      label: 'CR',
      actualValue: 0.2,
      benchmarkValue: 0.2,
      contributionValue: 20,
    },
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      actualValue: 1000000,
      targetValue: 1000000,
      contributionValue: 40,
    },
    {
      code: 'gsm_approval',
      label: 'GSM Onayı',
      actualValue: 96.4,
      contributionValue: 4.8,
    },
    {
      code: 'BM_CHECKLIST',
      label: 'BM Checklist',
      actualValue: 95,
      contributionValue: 11.15,
    },
    {
      code: 'VM_CHECKLIST',
      label: 'VM Checklist',
      actualValue: 95,
      contributionValue: 11.15,
    },
  ],
}

export const scoreDisplayFollowerStoreRow = {
  ...rankingsPrivilegedDetailStoreRow,
  storeId: 'store-score-display-follower',
  storeName: 'Raw Delta Trap',
  rank: 2,
  scoreValue: 104.2,
  metrics: [
    {
      code: 'UPT',
      label: 'UPT',
      actualValue: 7,
      benchmarkValue: 4,
      contributionValue: 18,
    },
    {
      code: 'ATV',
      label: 'ATV',
      actualValue: 1500,
      benchmarkValue: 1500,
      contributionValue: 15,
    },
    {
      code: 'CR',
      label: 'CR',
      actualValue: 0.2,
      benchmarkValue: 0.2,
      contributionValue: 20,
    },
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      actualValue: 1000000,
      targetValue: 1000000,
      contributionValue: 40,
    },
    {
      code: 'gsm_approval',
      label: 'GSM Onayı',
      actualValue: 88.3,
      contributionValue: 4.4,
    },
    {
      code: 'BM_CHECKLIST',
      label: 'BM Checklist',
      actualValue: 56,
      contributionValue: 5.6,
    },
    {
      code: 'VM_CHECKLIST',
      label: 'VM Checklist',
      actualValue: 56,
      contributionValue: 5.6,
    },
  ],
}

export const rankingsAvailablePeriods = [
  {
    periodType: 'monthly',
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  },
  {
    periodType: 'daily',
    periodStart: '2026-04-15',
    periodEnd: '2026-04-15',
  },
] as const

export const rankingsPrivilegedDetailFixture = {
  source: {
    mode: 'live',
    periodType: 'monthly',
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  },
  access: {
    globalMode: 'full',
    canSeeGlobalDetails: true,
    canSeeManagedStorePersonnelDetails: true,
  },
  filters: {
    regionManagers: [{ id: 'region-manager-1', label: 'Region Manager' }],
    regions: [{ id: '00000000-0000-0000-0000-000000000010', label: 'Marmara' }],
    stores: [{ id: 'store-high-hg', label: 'High HG Store' }],
  },
  reference: {
    store: {
      averageScore: 83.6,
      metrics: [
        { code: 'UPT', label: 'UPT', value: 4.22 },
        { code: 'ATV', label: 'ATV', value: 1320 },
        { code: 'CR', label: 'CR', value: 0.185 },
        { code: 'TARGET_ACHIEVEMENT', label: 'Target Achievement', value: 0.94 },
        { code: 'gsm_approval', label: 'GSM Onayı', value: 91.2 },
        { code: 'BM_CHECKLIST', label: 'BM Checklist', value: 81 },
        { code: 'VM_CHECKLIST', label: 'VM Checklist', value: 84 },
      ],
    },
    personnel: {
      averageScore: 79.2,
      metrics: [
        { code: 'UPT', label: 'UPT', value: 4.1 },
        { code: 'ATV', label: 'ATV', value: 1180 },
        { code: 'TARGET_ACHIEVEMENT', label: 'Target Achievement', value: 0.88 },
      ],
    },
  },
  storeLeaderboard: {
    items: [rankingsPrivilegedDetailStoreRow],
    currentStore: rankingsPrivilegedDetailStoreRow,
    meta: {
      total: 2,
      limit: 100,
      offset: 0,
    },
  },
  personnelLeaderboard: {
    items: [],
    currentEmployee: null,
    managedStorePersonnel: [],
    meta: {
      total: 0,
      limit: 100,
      offset: 0,
    },
  },
  availablePeriods: rankingsAvailablePeriods,
}

export const rankingsFixture = {
  source: {
    mode: 'live',
    periodType: 'monthly',
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  },
  access: {
    globalMode: 'top100',
    canSeeGlobalDetails: false,
    canSeeManagedStorePersonnelDetails: true,
  },
  filters: {
    regionManagers: [],
    regions: [],
    stores: [],
  },
  storeLeaderboard: {
    items: [storeRankingSummaryRow],
    currentStore: {
      ...storeRankingSummaryRow,
      visibility: 'detail',
      metrics: [
        {
          code: 'TARGET_ACHIEVEMENT',
          label: 'Target Achievement',
          actualValue: 1.12,
          targetValue: 1,
          contributionValue: 70,
        },
      ],
    },
    meta: {
      total: 240,
      limit: 100,
      offset: 0,
    },
  },
  personnelLeaderboard: {
    items: [personnelRankingSummaryRow],
    currentEmployee: {
      ...personnelRankingSummaryRow,
      visibility: 'detail',
      metrics: [
        {
          code: 'ATV',
          label: 'ATV',
          actualValue: 1245,
          benchmarkValue: 1180,
          contributionValue: 28,
        },
      ],
    },
    managedStorePersonnel: [],
    meta: {
      total: 420,
      limit: 100,
      offset: 0,
    },
  },
  availablePeriods: rankingsAvailablePeriods,
}

export const rankingsDailyFixture = {
  ...rankingsFixture,
  source: {
    mode: 'live',
    periodType: 'daily',
    periodStart: '2026-04-15',
    periodEnd: '2026-04-15',
  },
}
