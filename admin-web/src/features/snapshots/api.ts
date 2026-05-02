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

export type SnapshotKpiConfigVersion = {
  kpiConfigVersionId: string | null
  versionNo: number | null
  state: 'versioned' | 'pre_governance'
}

export type SnapshotOverview = {
  totals: {
    all: number
    queued: number
    running: number
    completed: number
    failed: number
  }
  healthTotals: {
    healthy: number
    inProgress: number
    retryReady: number
    needsAction: number
    stuck: number
  }
  actionTotals: {
    retryReady: number
    stuck: number
  }
  latest: {
    completedSnapshotRunId: string | null
    failedSnapshotRunId: string | null
    inProgressSnapshotRunId: string | null
    stuckSnapshotRunId: string | null
  }
}

export type SnapshotNeedsActionItem = {
  snapshotRunId: string
  snapshotDate: string
  snapshotType: string
  periodStart: string
  periodEnd: string
  runStatus: string
  healthState: string
  generatedAt: string
  generatedBy: string
  startedAt: string | null
  finishedAt: string | null
  failureReason: string | null
  rerunOfSnapshotRunId: string | null
  kpiConfigVersion?: SnapshotKpiConfigVersion | null
  actionReason: string
  recommendedAction: string
  canRerun: boolean
  rerunCount: number
  latestRerunSnapshotRunId: string | null
  isStuck: boolean
}

export type SnapshotRunDetail = {
  snapshotRun: {
    snapshotRunId: string
    snapshotDate: string
    snapshotType: string
    periodStart: string
    periodEnd: string
    runStatus: string
    healthState: string
    generatedAt: string
    generatedBy: string
    startedAt: string | null
    finishedAt: string | null
    failureReason: string | null
    rerunOfSnapshotRunId: string | null
    kpiConfigVersion?: SnapshotKpiConfigVersion | null
  }
  cards: {
    workforceRows: number
    kpiRows: number
    checklistRows: number
    turnoverRows: number
  }
  canRerun: boolean
  rerunAllowed: boolean
  rerunBlockedReason: string | null
  rerunCount: number
  latestRerunSnapshotRunId: string | null
  failureReason: string | null
}

export type SnapshotRunDependencies = {
  snapshotRunId: string
  runStatus: string
  rerunAllowed: boolean
  rerunBlockedReason: string | null
  checks: Array<{
    code: string
    status: 'pass' | 'fail'
    message: string
  }>
}

export type SnapshotRunLineage = {
  snapshotRunId: string
  parent: {
    snapshotRunId: string
    runStatus: string
    snapshotType: string
  } | null
  children: Array<{
    snapshotRunId: string
    runStatus: string
    snapshotType: string
  }>
}

export type SnapshotAuditEvent = {
  eventLogId: string
  occurredAt: string
  actorUserId: string | null
  correlationId: string | null
  eventType: string
  metadata: Record<string, unknown>
}

export type DailyClosureStatus = {
  automationEnabled: boolean
  automationPollMinutes: number
  timezone: string
  referenceAt: string
  localDate: string
  closureDate: string
  healthState: string
  dueNow: boolean
  canQueue: boolean
  canRerun: boolean
  recommendedAction: string
  existingSnapshotRunId: string | null
  existingRunStatus: string | null
  existingFailureReason: string | null
  existingGeneratedAt: string | null
}

type CommandResponse<T> = {
  command: {
    status: string
    message: string
  }
  data: T
}

export async function getSnapshotOverview() {
  return fetchJson<SnapshotOverview>('/snapshots/runs/overview')
}

export async function getDailyClosureStatus() {
  return fetchJson<DailyClosureStatus>('/snapshots/daily-closure')
}

export async function getSnapshotNeedsAction(input?: {
  limit?: number
  offset?: number
  snapshotType?: string
  runStatus?: string
}) {
  const params = new URLSearchParams({
    limit: String(input?.limit ?? 12),
    offset: String(input?.offset ?? 0),
  })

  if (input?.snapshotType) {
    params.set('snapshotType', input.snapshotType)
  }
  if (input?.runStatus) {
    params.set('runStatus', input.runStatus)
  }

  return fetchJson<ListResponse<SnapshotNeedsActionItem>>(
    `/snapshots/runs/needs-action?${params.toString()}`,
  )
}

export async function getSnapshotRunDetail(snapshotRunId: string) {
  return fetchJson<SnapshotRunDetail>(`/snapshots/runs/${snapshotRunId}`)
}

export async function getSnapshotRunDependencies(snapshotRunId: string) {
  return fetchJson<SnapshotRunDependencies>(`/snapshots/runs/${snapshotRunId}/dependencies`)
}

export async function getSnapshotRunLineage(snapshotRunId: string) {
  return fetchJson<SnapshotRunLineage>(`/snapshots/runs/${snapshotRunId}/lineage`)
}

export async function getSnapshotRunAudit(snapshotRunId: string) {
  return fetchJson<ListResponse<SnapshotAuditEvent>>(`/snapshots/runs/${snapshotRunId}/audit`)
}

export async function rerunSnapshotRun(snapshotRunId: string) {
  return sendJson<CommandResponse<{ snapshotRun: { snapshotRunId: string; runStatus: string } }>>(
    `/snapshots/runs/${snapshotRunId}/rerun`,
    { method: 'POST' },
  )
}

export async function runDailyClosure() {
  return sendJson<CommandResponse<{ dailyClosure: DailyClosureStatus }>>('/snapshots/daily-closure/run', {
    method: 'POST',
  })
}
