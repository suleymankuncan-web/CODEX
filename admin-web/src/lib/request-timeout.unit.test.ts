import { describe, expect, it, vi } from 'vitest'
import { RequestTimeoutError, withAbortTimeout } from './request-timeout'

describe('withAbortTimeout', () => {
  it('turns a hanging request into a typed timeout failure', async () => {
    vi.useFakeTimers()
    try {
      const request = withAbortTimeout(new AbortController().signal, 5_000, (signal) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      }))
      const rejection = expect(request).rejects.toBeInstanceOf(RequestTimeoutError)

      await vi.advanceTimersByTimeAsync(5_000)
      await rejection
    } finally {
      vi.useRealTimers()
    }
  })

  it('forwards caller cancellation without relabeling it as a timeout', async () => {
    const parent = new AbortController()
    const request = withAbortTimeout(parent.signal, 5_000, (signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))

    parent.abort()
    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('returns a completed request and clears its timeout', async () => {
    await expect(withAbortTimeout(new AbortController().signal, 5_000, async () => 'ok')).resolves.toBe('ok')
  })
})
