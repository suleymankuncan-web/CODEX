import { ApiError } from '../../lib/api-error'

export function canRetrySessionRead(error: unknown) {
  if (error instanceof ApiError) return error.status === 429 || error.status >= 500
  return error instanceof TypeError
}
