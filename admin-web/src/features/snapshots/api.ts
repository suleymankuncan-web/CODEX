import { sendJson } from '../../lib/api'
import { fetchOpenApiJson, type ApiGetResponse } from '../../lib/openapi-client'

export type SnapshotOverview = ApiGetResponse<'/api/snapshots/runs/overview'>

export type SnapshotNeedsAction = ApiGetResponse<'/api/snapshots/runs/needs-action'>
export type SnapshotNeedsActionItem = SnapshotNeedsAction['items'][number]

export type SnapshotRunDetail = ApiGetResponse<'/api/snapshots/runs/{snapshotRunId}'>
export type SnapshotRunDependencies = ApiGetResponse<
  '/api/snapshots/runs/{snapshotRunId}/dependencies'
>
export type SnapshotRunLineage = ApiGetResponse<'/api/snapshots/runs/{snapshotRunId}/lineage'>
export type SnapshotRunAudit = ApiGetResponse<'/api/snapshots/runs/{snapshotRunId}/audit'>
export type SnapshotAuditEvent = SnapshotRunAudit['items'][number]

export type SnapshotAuditListInput = {
  limit?: number
  offset?: number
}

export function buildSnapshotAuditQuery(
  input: SnapshotAuditListInput = {},
  fallbackLimit = 50,
) {
  return new URLSearchParams({
    limit: String(input.limit ?? fallbackLimit),
    offset: String(input.offset ?? 0),
  })
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
  return fetchOpenApiJson('/api/snapshots/runs/{snapshotRunId}', {
    params: { snapshotRunId },
  })
}

export async function getSnapshotRunDependencies(snapshotRunId: string) {
  return fetchOpenApiJson('/api/snapshots/runs/{snapshotRunId}/dependencies', {
    params: { snapshotRunId },
  })
}

export async function getSnapshotRunLineage(snapshotRunId: string) {
  return fetchOpenApiJson('/api/snapshots/runs/{snapshotRunId}/lineage', {
    params: { snapshotRunId },
  })
}

export async function getSnapshotRunAudit(
  snapshotRunId: string,
  input?: SnapshotAuditListInput,
) {
  return fetchOpenApiJson('/api/snapshots/runs/{snapshotRunId}/audit', {
    params: { snapshotRunId },
    query: buildSnapshotAuditQuery(input),
  })
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
