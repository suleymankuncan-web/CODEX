export type StorePerformanceReplayReadiness = 'ready' | 'partial'

export type StorePerformanceReplaySourceFamily =
  | 'checklist'
  | 'import'
  | 'kpi_ranking'
  | 'pilot_feedback'
  | 'snapshot'
  | 'store_action'
  | 'target'
  | 'workflow'

export type StorePerformanceReplayScope = {
  companyId?: string
  companyIds?: readonly string[]
  employeeId?: string
  label?: string
  regionId?: string
  routeScope?: string
  storeId?: string
}

export type StorePerformanceReplayEventCandidate = {
  id: string
  occurredAt: string
  readiness: StorePerformanceReplayReadiness
  redactionNotes: readonly string[]
  safeSummary: string
  scope: StorePerformanceReplayScope
  sourceFamily: StorePerformanceReplaySourceFamily
  sourceId: string
  sourceRoute: string
  title: string
}

export type ReplayImportBatchSource = {
  batchId: string
  entityType?: string | null
  finishedAt?: string | null
  lastRetriedAt?: string | null
  sourceCode?: string | null
  sourceWindowEndedAt?: string | null
  sourceWindowStartedAt?: string | null
  startedAt?: string | null
  status: string
}

export type ReplaySnapshotRunSource = {
  companyIds?: readonly string[]
  finishedAt?: string | null
  generatedAt: string
  periodEnd?: string | null
  periodStart?: string | null
  runStatus: string
  snapshotRunId: string
  snapshotType?: string | null
  startedAt?: string | null
}

export type ReplayKpiRankingSource = {
  employeeId?: string | null
  generatedAt: string
  periodEnd?: string | null
  periodStart?: string | null
  snapshotRunId: string
  sourceRoute?: string | null
  storeId?: string | null
}

export type ReplayTargetRequestSource = {
  approvedAt?: string | null
  companyId?: string | null
  createdAt: string
  regionId?: string | null
  requestId: string
  requestMonth?: string | null
  status: string
  storeId?: string | null
  targetLabel?: string | null
}

export type ReplayChecklistSource = {
  acknowledgedAt?: string | null
  checklistInstanceId: string
  completedAt?: string | null
  createdAt?: string | null
  sourceRoute?: string | null
  status: string
  storeId?: string | null
  templateId?: string | null
}

export type ReplayStoreActionSource = {
  actionPlanId: string
  cancelledAt?: string | null
  closedAt?: string | null
  companyId?: string | null
  createdAt: string
  dueOn?: string | null
  priority?: string | null
  regionId?: string | null
  sourceDeepLink?: string | null
  status: string
  storeId?: string | null
  title: string
  updatedAt?: string | null
}

export type ReplayPilotFeedbackSource = {
  classification?: string | null
  classifiedAt?: string | null
  createdAt: string
  feedbackId: string
  feedbackType: string
  routePath?: string | null
  severitySuggestion?: string | null
  status: string
  title: string
  updatedAt?: string | null
}

export type ReplayWorkflowSource = {
  createdAt?: string | null
  deepLink?: string | null
  inboxStatus: string
  needsAttentionAt?: string | null
  sourceId: string
  sourceType: string
  storeId?: string | null
  storeName?: string | null
  title: string
  workflowStatus?: string | null
}

export type BuildStorePerformanceReplayEventsInput = {
  checklistItems?: readonly ReplayChecklistSource[]
  importBatches?: readonly ReplayImportBatchSource[]
  kpiRankingPeriods?: readonly ReplayKpiRankingSource[]
  limit?: number
  pilotFeedbackItems?: readonly ReplayPilotFeedbackSource[]
  snapshotRuns?: readonly ReplaySnapshotRunSource[]
  storeActionPlans?: readonly ReplayStoreActionSource[]
  targetRequests?: readonly ReplayTargetRequestSource[]
  workflowItems?: readonly ReplayWorkflowSource[]
}

export function buildStorePerformanceReplayEvents(
  input: BuildStorePerformanceReplayEventsInput,
): StorePerformanceReplayEventCandidate[] {
  const limit = normalizeReplayLimit(input.limit)

  return [
    ...(input.importBatches ?? []).flatMap(buildImportBatchEvents),
    ...(input.snapshotRuns ?? []).flatMap(buildSnapshotRunEvents),
    ...(input.kpiRankingPeriods ?? []).flatMap(buildKpiRankingEvents),
    ...(input.targetRequests ?? []).flatMap(buildTargetRequestEvents),
    ...(input.checklistItems ?? []).flatMap(buildChecklistEvents),
    ...(input.storeActionPlans ?? []).flatMap(buildStoreActionEvents),
    ...(input.pilotFeedbackItems ?? []).flatMap(buildPilotFeedbackEvents),
    ...(input.workflowItems ?? []).flatMap(buildWorkflowEvents),
  ]
    .toSorted(compareReplayEvents)
    .slice(0, limit)
}

export function buildImportBatchEvents(
  batch: ReplayImportBatchSource,
): StorePerformanceReplayEventCandidate[] {
  const sourceId = safePublicId(batch.batchId)
  const occurredAt = firstValidTimestamp(
    batch.finishedAt,
    batch.lastRetriedAt,
    batch.startedAt,
    batch.sourceWindowEndedAt,
    batch.sourceWindowStartedAt,
  )

  if (!sourceId || !occurredAt) {
    return []
  }

  const statusLabel = labelize(batch.status)
  const sourceLabel = safeLabel(batch.sourceCode, 'integration source')
  const entityLabel = safeLabel(batch.entityType, 'entity')

  return [
    replayEvent({
      id: replayId('import', sourceId, batch.status, occurredAt),
      occurredAt,
      readiness: 'partial',
      redactionNotes: [
        'Import terminal status should be shown from row status until audit catalog alignment is verified.',
        'Import facts do not prove store performance impact by themselves.',
      ],
      safeSummary: `${entityLabel} import from ${sourceLabel} is recorded with ${statusLabel} status.`,
      scope: { routeScope: sourceLabel },
      sourceFamily: 'import',
      sourceId,
      sourceRoute: `/admin/integrations/${sourceId}`,
      title: `Import batch ${statusLabel}`,
    }),
  ]
}

export function buildSnapshotRunEvents(
  run: ReplaySnapshotRunSource,
): StorePerformanceReplayEventCandidate[] {
  const sourceId = safePublicId(run.snapshotRunId)
  const occurredAt = firstValidTimestamp(run.finishedAt, run.startedAt, run.generatedAt)

  if (!sourceId || !occurredAt) {
    return []
  }

  const snapshotLabel = safeLabel(run.snapshotType, 'snapshot')
  const statusLabel = labelize(run.runStatus)

  return [
    replayEvent({
      id: replayId('snapshot', sourceId, run.runStatus, occurredAt),
      occurredAt,
      readiness: 'ready',
      redactionNotes: [],
      safeSummary: `${snapshotLabel} snapshot run is the official freshness anchor for its reporting period.`,
      scope: scopeFrom({
        companyIds: run.companyIds,
        routeScope: periodLabel(run.periodStart, run.periodEnd) ?? snapshotLabel,
      }),
      sourceFamily: 'snapshot',
      sourceId,
      sourceRoute: `/admin/snapshots/${sourceId}`,
      title: `Snapshot run ${statusLabel}`,
    }),
  ]
}

export function buildKpiRankingEvents(
  period: ReplayKpiRankingSource,
): StorePerformanceReplayEventCandidate[] {
  const sourceId = safePublicId(period.snapshotRunId)
  const occurredAt = firstValidTimestamp(period.generatedAt)

  if (!sourceId || !occurredAt) {
    return []
  }

  return [
    replayEvent({
      id: replayId('kpi-ranking', sourceId, 'generated', occurredAt),
      occurredAt,
      readiness: 'partial',
      redactionNotes: [
        'KPI and ranking facts are derived from an official snapshot run; do not invent a separate ranking event.',
        'Rank movement needs explicit before/after snapshot comparison before any impact wording.',
      ],
      safeSummary: 'KPI and ranking views can cite this official snapshot period without claiming causality.',
      scope: scopeFrom({
        employeeId: period.employeeId,
        routeScope: periodLabel(period.periodStart, period.periodEnd) ?? 'reporting period',
        storeId: period.storeId,
      }),
      sourceFamily: 'kpi_ranking',
      sourceId,
      sourceRoute: period.sourceRoute ?? `/admin/reports/kpis/${sourceId}`,
      title: 'KPI and ranking period available',
    }),
  ]
}

export function buildTargetRequestEvents(
  request: ReplayTargetRequestSource,
): StorePerformanceReplayEventCandidate[] {
  const sourceId = safePublicId(request.requestId)
  const approvedAt = firstValidTimestamp(request.approvedAt)
  const createdAt = firstValidTimestamp(request.createdAt)
  const isApproved = request.status === 'approved' && Boolean(approvedAt)
  const occurredAt = isApproved ? approvedAt : createdAt

  if (!sourceId || !occurredAt) {
    return []
  }

  const statusLabel = isApproved ? 'approved' : 'submitted'
  const targetLabel = safeLabel(request.targetLabel, 'target distribution')

  return [
    replayEvent({
      id: replayId('target', sourceId, statusLabel, occurredAt),
      occurredAt,
      readiness: 'ready',
      redactionNotes: [],
      safeSummary: `${targetLabel} request was ${statusLabel} for the scoped store or region.`,
      scope: scopeFrom({
        companyId: request.companyId,
        regionId: request.regionId,
        routeScope: request.requestMonth ?? null,
        storeId: request.storeId,
      }),
      sourceFamily: 'target',
      sourceId,
      sourceRoute: '/admin/targets',
      title: `Target request ${statusLabel}`,
    }),
  ]
}

export function buildChecklistEvents(
  checklist: ReplayChecklistSource,
): StorePerformanceReplayEventCandidate[] {
  const sourceId = safePublicId(checklist.checklistInstanceId)
  const acknowledgedAt = firstValidTimestamp(checklist.acknowledgedAt)
  const completedAt = firstValidTimestamp(checklist.completedAt)
  const createdAt = firstValidTimestamp(checklist.createdAt)
  const status = acknowledgedAt
    ? 'acknowledged'
    : completedAt
      ? 'completed'
      : 'created'
  const occurredAt = acknowledgedAt ?? completedAt ?? createdAt

  if (!sourceId || !occurredAt) {
    return []
  }

  return [
    replayEvent({
      id: replayId('checklist', sourceId, status, occurredAt),
      occurredAt,
      readiness: 'partial',
      redactionNotes: [
        'Checklist replay must respect checklist route guards and mobile completion audit parity.',
      ],
      safeSummary: `Checklist instance was ${status}; use reporting views for score details.`,
      scope: scopeFrom({
        routeScope: checklist.templateId,
        storeId: checklist.storeId,
      }),
      sourceFamily: 'checklist',
      sourceId,
      sourceRoute: checklist.sourceRoute ?? '/store/checklists',
      title: `Checklist ${status}`,
    }),
  ]
}

export function buildStoreActionEvents(
  plan: ReplayStoreActionSource,
): StorePerformanceReplayEventCandidate[] {
  const sourceId = safePublicId(plan.actionPlanId)
  const occurredAt = firstValidTimestamp(
    plan.closedAt,
    plan.cancelledAt,
    plan.updatedAt,
    plan.createdAt,
  )

  if (!sourceId || !occurredAt) {
    return []
  }

  const statusLabel = labelize(plan.status)

  return [
    replayEvent({
      id: replayId('store-action', sourceId, plan.status, occurredAt),
      occurredAt,
      readiness: 'ready',
      redactionNotes: [],
      safeSummary: `Store Action plan is ${statusLabel}; use source links for evidence before judging impact.`,
      scope: scopeFrom({
        companyId: plan.companyId,
        regionId: plan.regionId,
        routeScope: plan.priority ?? null,
        storeId: plan.storeId,
      }),
      sourceFamily: 'store_action',
      sourceId,
      sourceRoute: plan.sourceDeepLink ?? '/store/tasks',
      title: `Store Action ${statusLabel}: ${safeLabel(plan.title, 'action plan')}`,
    }),
  ]
}

export function buildPilotFeedbackEvents(
  feedback: ReplayPilotFeedbackSource,
): StorePerformanceReplayEventCandidate[] {
  const sourceId = safePublicId(feedback.feedbackId)
  const classifiedAt = firstValidTimestamp(feedback.classifiedAt)
  const createdAt = firstValidTimestamp(feedback.createdAt)
  const isClassified = Boolean(feedback.classification && classifiedAt)
  const occurredAt = isClassified ? classifiedAt : createdAt

  if (!sourceId || !occurredAt) {
    return []
  }

  const statusLabel = isClassified ? 'classified' : 'submitted'

  return [
    replayEvent({
      id: replayId('pilot-feedback', sourceId, statusLabel, occurredAt),
      occurredAt,
      readiness: 'ready',
      redactionNotes: ['Pilot feedback is operator context, not store or personnel performance evidence.'],
      safeSummary: `Pilot feedback was ${statusLabel} from an application route.`,
      scope: { routeScope: feedback.routePath ?? '/admin/pilot-feedback' },
      sourceFamily: 'pilot_feedback',
      sourceId,
      sourceRoute: '/admin/pilot-feedback',
      title: `Pilot feedback ${statusLabel}: ${safeLabel(feedback.title, feedback.feedbackType)}`,
    }),
  ]
}

export function buildWorkflowEvents(
  item: ReplayWorkflowSource,
): StorePerformanceReplayEventCandidate[] {
  if (item.inboxStatus !== 'needs_attention') {
    return []
  }

  const sourceId = safePublicId(item.sourceId)
  const occurredAt = firstValidTimestamp(item.needsAttentionAt, item.createdAt)

  if (!sourceId || !occurredAt) {
    return []
  }

  return [
    replayEvent({
      id: replayId('workflow', sourceId, item.sourceType, occurredAt),
      occurredAt,
      readiness: 'partial',
      redactionNotes: [
        'Workflow inbox is an aggregation surface; replay should link to the source entity.',
      ],
      safeSummary: `Workflow item needs attention; verify the source route before action.`,
      scope: scopeFrom({
        label: item.storeName,
        routeScope: item.workflowStatus,
        storeId: item.storeId,
      }),
      sourceFamily: 'workflow',
      sourceId,
      sourceRoute: item.deepLink ?? '/admin/inbox',
      title: `Workflow attention: ${safeLabel(item.title, item.sourceType)}`,
    }),
  ]
}

function replayEvent(
  event: StorePerformanceReplayEventCandidate,
): StorePerformanceReplayEventCandidate {
  return event
}

function compareReplayEvents(
  left: StorePerformanceReplayEventCandidate,
  right: StorePerformanceReplayEventCandidate,
) {
  const dateDelta = Date.parse(right.occurredAt) - Date.parse(left.occurredAt)
  if (dateDelta !== 0 && Number.isFinite(dateDelta)) return dateDelta

  const readinessDelta = readinessRank(left.readiness) - readinessRank(right.readiness)
  if (readinessDelta !== 0) return readinessDelta

  const familyDelta = left.sourceFamily.localeCompare(right.sourceFamily)
  if (familyDelta !== 0) return familyDelta

  return left.id.localeCompare(right.id)
}

function readinessRank(readiness: StorePerformanceReplayReadiness) {
  return readiness === 'ready' ? 0 : 1
}

function normalizeReplayLimit(limit: number | undefined) {
  if (limit === undefined || !Number.isFinite(limit)) {
    return 50
  }

  return Math.max(0, Math.trunc(limit))
}

function firstValidTimestamp(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (value && Number.isFinite(Date.parse(value))) {
      return value
    }
  }

  return null
}

function replayId(
  family: string,
  sourceId: string,
  status: string,
  occurredAt: string,
) {
  return [family, sourceId, status, occurredAt].map(safeIdPart).join(':')
}

function safeIdPart(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
  return normalized.replace(/^-+|-+$/g, '').slice(0, 80) || 'unknown'
}

function safePublicId(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed || isSecretLike(trimmed)) {
    return null
  }

  return trimmed
}

function isSecretLike(value: string) {
  const lower = value.toLowerCase()
  return (
    lower.startsWith('sk-') ||
    lower.startsWith('sk_') ||
    lower.startsWith('token.') ||
    /bearer\s+[a-z0-9._-]{20,}/iu.test(value) ||
    /^[a-z0-9_-]+\.[a-z0-9_-]{20,}\.[a-z0-9_-]+$/iu.test(value) ||
    (value.length > 80 && /[._-]/u.test(value))
  )
}

function safeLabel(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim()
  if (!trimmed || isSecretLike(trimmed)) {
    return fallback
  }

  return trimmed.slice(0, 80)
}

function labelize(value: string) {
  return safeLabel(value.replace(/_/g, ' '), 'unknown')
}

function periodLabel(start: string | null | undefined, end: string | null | undefined) {
  if (!start && !end) {
    return null
  }

  if (start && end) {
    return `${start} - ${end}`
  }

  return start ?? end ?? null
}

function scopeFrom(input: {
  companyId?: string | null | undefined
  companyIds?: readonly string[] | undefined
  employeeId?: string | null | undefined
  label?: string | null | undefined
  regionId?: string | null | undefined
  routeScope?: string | null | undefined
  storeId?: string | null | undefined
}): StorePerformanceReplayScope {
  const scope: StorePerformanceReplayScope = {}

  if (input.companyId) scope.companyId = input.companyId
  if (input.companyIds && input.companyIds.length > 0) scope.companyIds = input.companyIds
  if (input.employeeId) scope.employeeId = input.employeeId
  if (input.label) scope.label = input.label
  if (input.regionId) scope.regionId = input.regionId
  if (input.routeScope) scope.routeScope = input.routeScope
  if (input.storeId) scope.storeId = input.storeId

  return scope
}
