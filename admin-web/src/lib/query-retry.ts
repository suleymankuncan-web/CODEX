import { ApiError } from './api'

const TRANSIENT_QUERY_RETRY_LIMIT = 2

export function shouldRetryTransientQuery(failureCount: number, error: unknown) {
  if (error instanceof ApiError) {
    const isTransientStatus = error.status === 408 || error.status === 429 || error.status >= 500
    return isTransientStatus && failureCount < TRANSIENT_QUERY_RETRY_LIMIT
  }

  return failureCount < TRANSIENT_QUERY_RETRY_LIMIT
}

export function transientQueryRetryDelay(attemptIndex: number) {
  return Math.min(250 * (attemptIndex + 1), 1_000)
}

export const transientQueryRetryOptions = {
  retry: shouldRetryTransientQuery,
  retryDelay: transientQueryRetryDelay,
}
