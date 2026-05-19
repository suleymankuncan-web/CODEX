import { fetchJson, sendJson } from '../../lib/api'
import { fetchOpenApiJson, type ApiGetResponse } from '../../lib/openapi-client'

type ListResponse<T> = {
  items: T[]
  meta: {
    count: number
    total: number
    limit: number
    offset: number
  }
}

export type ReportingSummary = ApiGetResponse<'/api/reports/summary'>

export type ReportingSnapshotRuns = ApiGetResponse<'/api/reports/snapshot-runs'>
export type ReportingSnapshotRun = ReportingSnapshotRuns['items'][number]

export type WorkforceReport = ApiGetResponse<'/api/reports/workforce'>
export type WorkforceRow = WorkforceReport['items'][number]

export type KpiReport = ApiGetResponse<'/api/reports/kpis'>
export type KpiRow = KpiReport['items'][number]

type KpiMetricScoreStatus =
  | 'scored'
  | 'pending_normalization'
  | 'missing_reference'
  | 'missing'

export type KpiConfigResponse = ApiGetResponse<'/api/reports/kpi-config'>
export type KpiConfig = Pick<
  KpiConfigResponse,
  'storeProfile' | 'personnelProfile' | 'ownershipMatrix' | 'gradingBands'
>
export type KpiConfigVersionMetadata = KpiConfigResponse['metadata']
export type KpiConfigEditorState = ApiGetResponse<'/api/reports/kpi-config/editor'>
export type KpiConfigAudit = ApiGetResponse<'/api/reports/kpi-config/audit'>
export type AuditEvent = KpiConfigAudit['items'][number]
export type KpiScoreProfileMetric = KpiConfigResponse['storeProfile']['metrics'][number]
export type KpiOwnerRole = KpiScoreProfileMetric['ownerRole']
export type KpiScoreBehavior = KpiScoreProfileMetric['scoreBehavior']
type KpiBenchmarkSource = NonNullable<KpiScoreProfileMetric['benchmarkSource']>
export type KpiGradingBand = KpiConfigResponse['gradingBands'][number]
export type KpiOwnershipMatrixRow = KpiConfigResponse['ownershipMatrix'][number]

export type MyPerformanceMetric = {
  code: string
  label: string
  weightPercent: number
  actualValue: number | null
  targetValue?: number | null
  achievementRate?: number | null
  benchmarkValue?: number | null
  benchmarkSource?: KpiBenchmarkSource
  actualRatio?: number | null
  scoredRatio?: number | null
  capRatio?: number | null
  isCapped?: boolean
  missingReason?: string | null
  contributionValue: number
  dataStatus?: 'reported' | 'missing'
  scoreStatus?: KpiMetricScoreStatus
  status?: 'reported' | 'missing'
}

export type MyPerformanceSummary = {
  source: {
    mode: 'live' | 'closed'
    snapshotRunId: string | null
    snapshotDate: string | null
  }
  employee: {
    employeeId: string
    displayName: string
    storeId: string | null
    storeName: string | null
  } | null
  period: {
    periodStart: string
    periodEnd: string
  } | null
  score: {
    value: number
    matchedMetrics: number
    totalMetrics: number
  }
  rankings: {
    turkeyRank: number | null
    turkeyPopulation: number
    storeRank: number | null
    storePopulation: number
  }
  availablePeriods: Array<{
    periodType: 'daily' | 'weekly' | 'monthly' | string
    periodStart: string
    periodEnd: string
  }>
  partial: {
    isPartial: boolean
    missingMetricCodes: string[]
    missingMetricLabels: string[]
    pendingNormalizationCodes?: string[]
    pendingNormalizationLabels?: string[]
  }
  supporting: {
    netSalesValue: number | null
    targetEntryMode: 'manager_assignment'
    targetEditableByCurrentUser: boolean
  }
  metrics: MyPerformanceMetric[]
}

type StoreKpiHighlightMetric = {
  code: string
  label: string
  weightPercent: number
  actualValue: number | null
  targetValue: number | null
  achievementRate: number | null
  benchmarkValue?: number | null
  benchmarkSource?: KpiBenchmarkSource
  actualRatio?: number | null
  scoredRatio?: number | null
  capRatio?: number | null
  isCapped?: boolean
  scoreContribution?: number | null
  missingReason?: string | null
  statusBand: string | null
  dataStatus: 'reported' | 'missing'
  scoreStatus: KpiMetricScoreStatus
}

export type StoreKpiHighlightsSummary = {
  source: {
    mode: 'live'
    snapshotRunId: string | null
    snapshotDate: string | null
    periodType: 'daily' | 'weekly' | 'monthly' | string
  }
  store: {
    storeId: string
    storeName: string | null
  } | null
  period: {
    periodStart: string
    periodEnd: string
  } | null
  score: {
    value: number
    matchedMetrics: number
    totalMetrics: number
  }
  availablePeriods: Array<{
    periodType: 'daily' | 'weekly' | 'monthly' | string
    periodStart: string
    periodEnd: string
  }>
  partial: {
    isPartial: boolean
    missingMetricCodes: string[]
    missingMetricLabels: string[]
    pendingNormalizationCodes: string[]
    pendingNormalizationLabels: string[]
  }
  metrics: StoreKpiHighlightMetric[]
}

type StoreScoreBreakdownComponent = {
  included: boolean
  score: number | null
  weight: number
  contribution: number | null
  status: string
  missingReason?: string
}

type StoreScoreWeights = {
  kpiPerformanceWeight: number
  bmChecklistWeight: number
  vmChecklistWeight: number
}

export type StoreMonthlyScoreBreakdown = {
  snapshotRunId: string
  storeId: string
  scoreStatus: 'preview' | 'final'
  totalScore: number | null
  missingWeightPolicy: 'return_missing_weight_to_kpi'
  configuredWeights: StoreScoreWeights
  effectiveWeights: StoreScoreWeights
  components: {
    kpi: StoreScoreBreakdownComponent
    bmChecklist: StoreScoreBreakdownComponent & {
      visitCount: number
    }
    vmChecklist: StoreScoreBreakdownComponent & {
      visitCount: number
    }
  }
}

type RankingVisibility = 'summary' | 'detail'

export type RankingMetricValue = {
  code: string
  label: string
  actualValue: number | null
  targetValue?: number | null
  benchmarkValue?: number | null
  contributionValue?: number | null
}

export type StoreRankingRow = {
  subject: 'store'
  storeId: string
  storeName: string | null
  regionId: string | null
  regionName: string | null
  regionManagerUserId: string | null
  regionManagerName: string | null
  rank: number
  population: number
  scoreValue: number
  visibility: RankingVisibility
  metrics?: RankingMetricValue[]
}

export type PersonnelRankingRow = {
  subject: 'personnel'
  employeeId: string
  displayName: string
  storeId: string | null
  storeName: string | null
  regionId: string | null
  regionName: string | null
  regionManagerUserId: string | null
  regionManagerName: string | null
  rank: number
  population: number
  storeRank: number | null
  storePopulation: number
  scoreValue: number
  visibility: RankingVisibility
  metrics?: RankingMetricValue[]
}

type RankingFilterOption = {
  id: string
  label: string
}

type RankingReferenceMetric = {
  code: string
  label: string
  value: number | null
}

export type RankingReferenceGroup = {
  averageScore: number | null
  metrics: RankingReferenceMetric[]
}

export type RankingSummary = {
  source: {
    mode: 'live'
    periodType: 'monthly'
    periodStart: string | null
    periodEnd: string | null
  }
  access: {
    globalMode: 'top100' | 'full'
    canSeeGlobalDetails: boolean
    canSeeManagedStorePersonnelDetails: boolean
  }
  filters: {
    regionManagers: RankingFilterOption[]
    regions: RankingFilterOption[]
    stores: RankingFilterOption[]
  }
  reference?: {
    store: RankingReferenceGroup
    personnel: RankingReferenceGroup
  }
  storeLeaderboard: {
    items: StoreRankingRow[]
    currentStore: StoreRankingRow | null
    meta: {
      total: number
      limit: number
      offset: number
    }
  }
  personnelLeaderboard: {
    items: PersonnelRankingRow[]
    currentEmployee: PersonnelRankingRow | null
    managedStorePersonnel: PersonnelRankingRow[]
    meta: {
      total: number
      limit: number
      offset: number
    }
  }
  availablePeriods: Array<{
    periodType: 'monthly'
    periodStart: string
    periodEnd: string
  }>
}

export type ChecklistRow = {
  snapshotRunId: string
  storeId: string
  checklistTemplateId: string
  auditCount: number
  avgScore: string | null
  complianceRate: string | null
  criticalIssueCount: number
}

export type TurnoverRow = {
  snapshotRunId: string
  scopeType: string
  companyId: string | null
  regionId: string | null
  storeId: string | null
  periodStart: string
  periodEnd: string
  openingHeadcount: string
  closingHeadcount: string
  avgHeadcount: string
  leaverCount: number
  turnoverRate: string
}

export async function getReportingSummary() {
  return fetchOpenApiJson('/api/reports/summary')
}

export async function getReportingSnapshotRuns(input?: {
  runStatus?: string
  snapshotType?: string
  snapshotDate?: string
  limit?: number
  offset?: number
}) {
  const params = new URLSearchParams()
  if (input?.runStatus) {
    params.set('runStatus', input.runStatus)
  }
  if (input?.snapshotType) {
    params.set('snapshotType', input.snapshotType)
  }
  if (input?.snapshotDate) {
    params.set('snapshotDate', input.snapshotDate)
  }
  params.set('limit', String(input?.limit ?? 8))
  params.set('offset', String(input?.offset ?? 0))

  return fetchOpenApiJson('/api/reports/snapshot-runs', { query: params })
}

export async function getWorkforceReport(snapshotRunId: string) {
  return fetchOpenApiJson('/api/reports/workforce', {
    query: new URLSearchParams({
      snapshotRunId,
      limit: '50',
      offset: '0',
    }),
  })
}

export async function getKpiReport(snapshotRunId: string) {
  return fetchOpenApiJson('/api/reports/kpis', {
    query: new URLSearchParams({ snapshotRunId }),
  })
}

export async function getKpiConfig() {
  return fetchOpenApiJson('/api/reports/kpi-config')
}

export async function getKpiConfigEditor() {
  return fetchOpenApiJson('/api/reports/kpi-config/editor')
}

export async function updateKpiConfigDraft(input: KpiConfig) {
  return sendJson<KpiConfigEditorState>('/reports/kpi-config', {
    method: 'PATCH',
    body: input,
  })
}

export async function publishKpiConfig() {
  return sendJson<KpiConfigEditorState>('/reports/kpi-config/publish', {
    method: 'PATCH',
  })
}

export async function getKpiConfigAudit() {
  return fetchOpenApiJson('/api/reports/kpi-config/audit')
}

export type MyPerformanceQueryInput = {
  mode?: 'live' | 'closed'
  snapshotDate?: string
  periodType?: 'daily' | 'weekly' | 'monthly'
  periodStart?: string
}

function buildMyPerformanceQuery(input?: MyPerformanceQueryInput) {
  const params = new URLSearchParams()
  if (input?.mode) {
    params.set('mode', input.mode)
  }
  if (input?.snapshotDate) {
    params.set('snapshotDate', input.snapshotDate)
  }
  if (input?.periodType) {
    params.set('periodType', input.periodType)
  }
  if (input?.periodStart) {
    params.set('periodStart', input.periodStart)
  }

  return params.toString()
}

export async function getMyPerformance(input?: MyPerformanceQueryInput) {
  const query = buildMyPerformanceQuery(input)
  return fetchJson<MyPerformanceSummary>(`/reports/my-performance${query ? `?${query}` : ''}`)
}

export async function getPersonnelPerformance(
  employeeId: string,
  input?: MyPerformanceQueryInput,
) {
  const query = buildMyPerformanceQuery(input)
  return fetchJson<MyPerformanceSummary>(
    `/reports/personnel-performance/${encodeURIComponent(employeeId)}${query ? `?${query}` : ''}`,
  )
}

export async function getStoreKpiHighlights(input?: {
  periodType?: 'daily' | 'weekly' | 'monthly'
  periodStart?: string
}) {
  const params = new URLSearchParams()
  if (input?.periodType) {
    params.set('periodType', input.periodType)
  }
  if (input?.periodStart) {
    params.set('periodStart', input.periodStart)
  }

  const query = params.toString()
  return fetchJson<StoreKpiHighlightsSummary>(
    `/reports/store-kpi-highlights${query ? `?${query}` : ''}`,
  )
}

export async function getStoreScoreBreakdown(input: {
  snapshotRunId: string
  storeId: string
}) {
  const params = new URLSearchParams({
    snapshotRunId: input.snapshotRunId,
    storeId: input.storeId,
  })

  return fetchJson<StoreMonthlyScoreBreakdown>(
    `/reports/store-score-breakdown?${params.toString()}`,
  )
}

export async function getRankings(input?: {
  periodStart?: string
  regionManagerUserId?: string
  regionId?: string
  storeId?: string
  search?: string
  sortKey?: string
  sortDirection?: 'asc' | 'desc'
  limit?: number
  offset?: number
}) {
  const params = new URLSearchParams()
  params.set('periodType', 'monthly')
  if (input?.periodStart) {
    params.set('periodStart', input.periodStart)
  }
  if (input?.regionManagerUserId) {
    params.set('regionManagerUserId', input.regionManagerUserId)
  }
  if (input?.regionId) {
    params.set('regionId', input.regionId)
  }
  if (input?.storeId) {
    params.set('storeId', input.storeId)
  }
  if (input?.search) {
    params.set('search', input.search)
  }
  if (input?.sortKey) {
    params.set('sortKey', input.sortKey)
  }
  if (input?.sortDirection) {
    params.set('sortDirection', input.sortDirection)
  }
  if (input?.limit) {
    params.set('limit', String(input.limit))
  }
  if (input?.offset) {
    params.set('offset', String(input.offset))
  }

  return fetchJson<RankingSummary>(`/reports/rankings?${params.toString()}`)
}

export async function getChecklistReport(input: {
  snapshotRunId: string
  storeId?: string
  checklistTemplateId?: string
}) {
  const params = new URLSearchParams({
    snapshotRunId: input.snapshotRunId,
    limit: '50',
    offset: '0',
  })

  if (input.storeId) {
    params.set('storeId', input.storeId)
  }

  if (input.checklistTemplateId) {
    params.set('checklistTemplateId', input.checklistTemplateId)
  }

  return fetchJson<ListResponse<ChecklistRow>>(`/reports/checklists?${params.toString()}`)
}

export async function getTurnoverReport(snapshotRunId: string) {
  return fetchJson<ListResponse<TurnoverRow>>(
    `/reports/turnover?snapshotRunId=${encodeURIComponent(snapshotRunId)}&limit=50&offset=0`,
  )
}
