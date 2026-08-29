export class RequestTimeoutError extends Error {
  readonly timeoutMs: number

  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`)
    this.name = 'RequestTimeoutError'
    this.timeoutMs = timeoutMs
  }
}

export async function withAbortTimeout<T>(
  parentSignal: AbortSignal,
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('Request timeout must be a positive integer')
  }

  const controller = new AbortController()
  let timedOut = false
  const forwardAbort = () => controller.abort(parentSignal.reason)
  const timeout = globalThis.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  if (parentSignal.aborted) forwardAbort()
  else parentSignal.addEventListener('abort', forwardAbort, { once: true })

  try {
    return await operation(controller.signal)
  } catch (error) {
    if (timedOut) throw new RequestTimeoutError(timeoutMs)
    throw error
  } finally {
    globalThis.clearTimeout(timeout)
    parentSignal.removeEventListener('abort', forwardAbort)
  }
}
