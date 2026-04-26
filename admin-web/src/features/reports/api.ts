import { fetchJson, sendJson } from '../../lib/api'

type ListResponse<T> = {
  items: T[]
  meta: {
    count: number
    total: number
    limit: number
    offset: number
  }
}

export type AuditEvent = {
  eventLogId: string
  occurredAt: string
  actorUserId: string | null
  correlationId: string | null
  eventType: string
  metadata: Record<string, unknown>
}

export type ReportingSummary = {
  latestCompletedSnapshotRun: {
    snapshotRunId: string
    snapshotDate: string
    snapshotType: string
    periodStart: string
    periodEnd: string
    runStatus: string
    generatedAt: string
    generatedBy: string
  } | null
  cards: {
    workforceRows: number
    kpiRows: number
    checklistRows: number
    turnoverRows: number
  }
}

export type ReportingSnapshotRun = {
  snapshotRunId: string
  snapshotDate: string
  snapshotType: string
  periodStart: string
  periodEnd: string
  runStatus: string
  generatedAt: string
  generatedBy: string
  kpiConfigVersion?: SnapshotKpiConfigVersion | null
}

export type SnapshotKpiConfigVersion = {
  kpiConfigVersionId: string | null
  versionNo: number | null
  state: 'versioned' | 'pre_governance'
}

export type WorkforceRow = {
  snapshotRunId: string
  storeId: string
  positionId: string
  activeHeadcount: string
  activeFte: string
  plannedHeadcount: string
  plannedFte: string
  gapHeadcount: string
  gapFte: string
}

export type KpiRow = {
  snapshotRunId: string
  storeId: string
  kpiId: string
  kpiCode: string
  kpiName: string
  periodStart: string
  periodEnd: string
  targetValue: string | null
  actualValue: string | null
  achievementRate: string | null
  statusBand: string | null
}

export type KpiOwnerRole =
  | 'DEPUTY_GM'
  | 'REGION_MANAGER'
  | 'STORE_MANAGER'
  | 'STORE_PERSONNEL'
  | 'VISUAL_TEAM'

export type KpiScoreBehavior = 'score_only' | 'warning_first' | 'task_candidate'

export type KpiScoreProfileMetric = {
  code: string
  label: string
  weightPercent: number
  ownerRole: KpiOwnerRole
  scoreBehavior: KpiScoreBehavior
  aliases?: string[]
  notes?: string
}

export type KpiScoreProfile = {
  profileCode: 'store' | 'personnel'
  title: string
  summary: string
  metrics: KpiScoreProfileMetric[]
  futureMetricRule: string
}

export type KpiGradingBand = {
  code: string
  label: string
  emoji: string
  tone: 'calm' | 'accent' | 'warning' | 'danger' | 'neutral'
  minScore: number
}

export type KpiOwnershipMatrixRow = {
  code: string
  label: string
  visibleTo: KpiOwnerRole[]
  operationalOwner: KpiOwnerRole
  contributesTo: Array<'store' | 'personnel'>
  taskCandidate: boolean
}

export type KpiConfig = {
  storeProfile: KpiScoreProfile
  personnelProfile: KpiScoreProfile
  ownershipMatrix: KpiOwnershipMatrixRow[]
  gradingBands: KpiGradingBand[]
}

export type KpiConfigVersionMetadata = {
  kpiConfigVersionId: string | null
  versionNo: number | null
  effectiveFrom: string | null
  effectiveTo: string | null
  publishedAt: string | null
  publishedBy: string | null
}

export type KpiConfigResponse = KpiConfig & {
  metadata: KpiConfigVersionMetadata
}

export type KpiConfigEditorState = {
  draftConfig: KpiConfig
  publishedConfig: KpiConfig
  hasUnpublishedChanges: boolean
  latestPublishedVersion: KpiConfigVersionMetadata
}

export type MyPerformanceMetric = {
  code: string
  label: string
  weightPercent: number
  actualValue: number | null
  targetValue?: number | null
  achievementRate?: number | null
  contributionValue: number
  dataStatus?: 'reported' | 'missing'
  scoreStatus?: 'scored' | 'pending_normalization' | 'missing'
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

export type StoreKpiHighlightMetric = {
  code: string
  label: string
  weightPercent: number
  actualValue: number | null
  targetValue: number | null
  achievementRate: number | null
  statusBand: string | null
  dataStatus: 'reported' | 'missing'
  scoreStatus: 'scored' | 'pending_normalization' | 'missing'
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

export type ClosedRankingMetricRank = {
  code: string
  label: string
  actualValue: number | null
  storeRank: number | null
  storePopulation: number
  turkeyRank: number | null
  turkeyPopulation: number
}

export type ClosedRankingCoverage = {
  closedDaysInPeriod: number
  daysWithPerformance: number
  minimumRequiredDays: number
  isEligibleForRanking: boolean
}

export type ClosedRankingStatus = 'official' | 'preview_only'
export type ClosedRankingEligibilityReason = 'eligible' | 'needs_more_closed_days'

export type ClosedRankingEmployee = {
  employeeId: string
  displayName: string
  storeId: string | null
  storeName: string | null
  scoreValue: number
  rankingStatus: ClosedRankingStatus
  eligibilityReason: ClosedRankingEligibilityReason
  neededPerformanceDays: number
  rankings: {
    turkeyRank: number | null
    turkeyPopulation: number
    storeRank: number | null
    storePopulation: number
  }
  coverage: ClosedRankingCoverage
  metricRanks: ClosedRankingMetricRank[]
}

export type ClosedLeaderboardSummary = {
  source: {
    mode: 'closed'
    periodType: 'daily' | 'monthly'
    state: 'closed' | 'not_closed' | 'no_data'
    snapshotRunId: string | null
    snapshotDate: string | null
    periodStart: string | null
    periodEnd: string | null
  }
  currentEmployee: ClosedRankingEmployee | null
  personnelTop: ClosedRankingEmployee[]
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
  return fetchJson<ReportingSummary>('/reports/summary')
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

  return fetchJson<ListResponse<ReportingSnapshotRun>>(
    `/reports/snapshot-runs?${params.toString()}`,
  )
}

export async function getWorkforceReport(snapshotRunId: string) {
  return fetchJson<ListResponse<WorkforceRow>>(
    `/reports/workforce?snapshotRunId=${encodeURIComponent(snapshotRunId)}&limit=50&offset=0`,
  )
}

export async function getKpiReport(snapshotRunId: string) {
  return fetchJson<ListResponse<KpiRow>>(
    `/reports/kpis?snapshotRunId=${encodeURIComponent(snapshotRunId)}`,
  )
}

export async function getKpiConfig() {
  return fetchJson<KpiConfigResponse>('/reports/kpi-config')
}

export async function getKpiConfigEditor() {
  return fetchJson<KpiConfigEditorState>('/reports/kpi-config/editor')
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
  return fetchJson<ListResponse<AuditEvent>>('/reports/kpi-config/audit')
}

export async function getMyPerformance(input?: {
  mode?: 'live' | 'closed'
  snapshotDate?: string
  periodType?: 'daily' | 'weekly' | 'monthly'
  periodStart?: string
}) {
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

  const query = params.toString()
  return fetchJson<MyPerformanceSummary>(`/reports/my-performance${query ? `?${query}` : ''}`)
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

export async function getClosedLeaderboard(input?: {
  periodType?: 'daily' | 'monthly'
  periodStart?: string
  snapshotDate?: string
  storeId?: string
  limit?: number
}) {
  const params = new URLSearchParams()
  if (input?.periodType) {
    params.set('periodType', input.periodType)
  }
  if (input?.periodStart) {
    params.set('periodStart', input.periodStart)
  }
  if (input?.snapshotDate) {
    params.set('snapshotDate', input.snapshotDate)
  }
  if (input?.storeId) {
    params.set('storeId', input.storeId)
  }
  if (input?.limit) {
    params.set('limit', String(input.limit))
  }

  const query = params.toString()
  return fetchJson<ClosedLeaderboardSummary>(
    `/reports/leaderboards/closed${query ? `?${query}` : ''}`,
  )
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
