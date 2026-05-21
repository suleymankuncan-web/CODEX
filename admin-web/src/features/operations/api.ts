import { fetchJson } from '../../lib/api'

type DependencyCheck = {
  status: 'ok' | 'error' | 'skipped' | string
  latencyMs: number
  message?: string
}

export type OperationsHealth = {
  status: 'ok' | 'error' | string
  service: string
  timestamp?: string
  queueBackend?: 'in-memory' | 'bullmq' | string
  queue?: {
    backend: 'in-memory' | 'bullmq' | string
    durable: boolean
    redisRequired: boolean
    status: 'process-local' | 'durable' | 'error' | string
    message: string
  }
  observability?: {
    status: 'ok' | 'degraded' | string
    errorTracking: {
      dsnConfigured: boolean
      environment: string
      externalDelivery: string
      mode: string
      release?: string
    }
    logLevel: string
    readinessProfile: string
  }
  checks?: {
    database?: DependencyCheck
    redis?: DependencyCheck
  }
}

export async function getOperationsHealth() {
  return fetchJson<OperationsHealth>('/health')
}
