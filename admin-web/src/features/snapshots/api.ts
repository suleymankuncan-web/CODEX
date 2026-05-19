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

type SnapshotKpiConfigVersion = {
  kpiConfigVersionId: string | null
  versionNo: number | null
  state: 'versioned' | 'pre_governance'
}

export type SnapshotOverview = ApiGetResponse<'/api/snapshots/runs/overview'>

export type SnapshotNeedsAction = ApiGetResponse<'/api/snapshots/runs/needs-action'>
export type SnapshotNeedsActionItem = SnapshotNeedsAction['items'][number]

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

export type DailyClosureStatus = ApiGetResponse<'/api/snapshots/daily-closure'>

type CommandResponse<T> = {
  command: {
    status: string
    message: string
  }
  data: T
}

export async function getSnapshotOverview() {
  return fetchOpenApiJson('/api/snapshots/runs/overview')
}

export async function getDailyClosureStatus() {
  return fetchOpenApiJson('/api/snapshots/daily-closure')
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

  return fetchOpenApiJson('/api/snapshots/runs/needs-action', { query: params })
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
