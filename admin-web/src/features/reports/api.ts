import {
  fetchOpenApiJson,
  sendOpenApiJson,
  type ApiGetResponse,
  type ApiMutationBody,
} from '../../lib/openapi-client'

export type ReportingSummary = ApiGetResponse<'/api/reports/summary'>

export type ReportingSnapshotRuns = ApiGetResponse<'/api/reports/snapshot-runs'>
export type ReportingSnapshotRun = ReportingSnapshotRuns['items'][number]

export type WorkforceReport = ApiGetResponse<'/api/reports/workforce'>
export type WorkforceRow = WorkforceReport['items'][number]

export type KpiReport = ApiGetResponse<'/api/reports/kpis'>
export type KpiRow = KpiReport['items'][number]

export type KpiConfigResponse = ApiGetResponse<'/api/reports/kpi-config'>
export type KpiConfig = ApiMutationBody<'/api/reports/kpi-config', 'PATCH'>
export type KpiConfigVersionMetadata = KpiConfigResponse['metadata']
export type KpiConfigEditorState = ApiGetResponse<'/api/reports/kpi-config/editor'>
export type KpiConfigAudit = ApiGetResponse<'/api/reports/kpi-config/audit'>
export type AuditEvent = KpiConfigAudit['items'][number]
export type KpiScoreProfileMetric = KpiConfigResponse['storeProfile']['metrics'][number]
export type KpiOwnerRole = KpiScoreProfileMetric['ownerRole']
export type KpiScoreBehavior = KpiScoreProfileMetric['scoreBehavior']
export type KpiGradingBand = KpiConfigResponse['gradingBands'][number]
export type KpiOwnershipMatrixRow = KpiConfigResponse['ownershipMatrix'][number]

export type MyPerformanceSummary = ApiGetResponse<'/api/reports/my-performance'>
export type MyPerformanceMetric = MyPerformanceSummary['metrics'][number]

export type StoreKpiHighlightsSummary = ApiGetResponse<'/api/reports/store-kpi-highlights'>
export type StoreMonthlyScoreBreakdown = ApiGetResponse<'/api/reports/store-score-breakdown'>

export type RankingSummary = ApiGetResponse<'/api/reports/rankings'>
export type StoreRankingRow = RankingSummary['storeLeaderboard']['items'][number]
export type PersonnelRankingRow =
  RankingSummary['personnelLeaderboard']['items'][number]
export type RankingMetricValue = NonNullable<StoreRankingRow['metrics']>[number]
export type RankingReferenceGroup = RankingSummary['reference']['store']

export type ChecklistReport = ApiGetResponse<'/api/reports/checklists'>
export type ChecklistRow = ChecklistReport['items'][number]

export type TurnoverReport = ApiGetResponse<'/api/reports/turnover'>
export type TurnoverRow = TurnoverReport['items'][number]

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
  return sendOpenApiJson('/api/reports/kpi-config', {
    method: 'PATCH',
    body: input,
  })
}

export async function publishKpiConfig() {
  return sendOpenApiJson('/api/reports/kpi-config/publish', {
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
  return fetchOpenApiJson('/api/reports/my-performance', { query })
}

export async function getPersonnelPerformance(
  employeeId: string,
  input?: MyPerformanceQueryInput,
) {
  const query = buildMyPerformanceQuery(input)
  return fetchOpenApiJson('/api/reports/personnel-performance/{employeeId}', {
    params: { employeeId },
    query,
  })
}

export async function getStoreKpiHighlights(input?: {
  periodType?: 'daily' | 'weekly' | 'monthly'
  periodStart?: string
  storeId?: string
}) {
  const params = new URLSearchParams()
  if (input?.periodType) {
    params.set('periodType', input.periodType)
  }
  if (input?.periodStart) {
    params.set('periodStart', input.periodStart)
  }
  if (input?.storeId) {
    params.set('storeId', input.storeId)
  }

  const query = params.toString()
  return fetchOpenApiJson('/api/reports/store-kpi-highlights', { query })
}

export async function getStoreScoreBreakdown(input: {
  snapshotRunId: string
  storeId: string
}) {
  const params = new URLSearchParams({
    snapshotRunId: input.snapshotRunId,
    storeId: input.storeId,
  })

  return fetchOpenApiJson('/api/reports/store-score-breakdown', { query: params })
}

export async function getRankings(input?: {
  periodType?: 'daily' | 'monthly'
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
  params.set('periodType', input?.periodType ?? 'monthly')
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

  return fetchOpenApiJson('/api/reports/rankings', { query: params })
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

  return fetchOpenApiJson('/api/reports/checklists', { query: params })
}

export async function getTurnoverReport(snapshotRunId: string) {
  return fetchOpenApiJson('/api/reports/turnover', {
    query: new URLSearchParams({
      snapshotRunId,
      limit: '50',
      offset: '0',
    }),
  })
}
