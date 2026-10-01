import { afterEach, describe, expect, it, vi } from 'vitest'
import { listenForForegroundActivity } from './foreground-activity'

function fixture() {
  const listeners = new Map<string, (event: Event) => void>()
  const target = { addEventListener: (name: string, handler: (event: Event) => void) => listeners.set(name, handler),
    removeEventListener: (name: string) => listeners.delete(name) }
  const document = { ...target, visibilityState: 'visible', hasFocus: () => true }
  const send = vi.fn().mockResolvedValue(undefined)
  const stop = listenForForegroundActivity(send, target as unknown as Window, document as unknown as Document)
  const signal = (name = 'pointerdown', isTrusted = true) => listeners.get(name)?.({ isTrusted } as Event)
  return { send, document, signal, stop, listeners }
}

describe('foreground activity', () => {
  afterEach(() => vi.useRealTimers())
  it('never emits activity while idle or from synthetic/background events', async () => {
    vi.useFakeTimers()
    const { send, signal, document, stop } = fixture()
    await vi.advanceTimersByTimeAsync(3_600_000)
    signal('pointerdown', false)
    document.visibilityState = 'hidden'; signal('keydown')
    document.visibilityState = 'visible'; document.hasFocus = () => false; signal('focus')
    expect(send).not.toHaveBeenCalled()
    stop()
  })
  it('throttles genuine foreground signals and removes all listeners on identity disposal', async () => {
    vi.useFakeTimers()
    const { send, signal, stop, listeners } = fixture()
    signal(); signal('keydown'); signal('wheel')
    expect(send).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(send).toHaveBeenCalledTimes(1)
    signal('visibilitychange')
    expect(send).toHaveBeenCalledTimes(2)
    stop(); expect(listeners.size).toBe(0)
    await vi.advanceTimersByTimeAsync(120_000); signal()
    expect(send).toHaveBeenCalledTimes(2)
  })
  it('retries an unavailable write only on a later genuine signal', async () => {
    vi.useFakeTimers()
    const { send, signal, stop } = fixture()
    send.mockRejectedValueOnce(new Error('temporary'))
    signal(); await Promise.resolve()
    signal(); expect(send).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(5000)
    expect(send).toHaveBeenCalledTimes(1)
    signal(); expect(send).toHaveBeenCalledTimes(2)
    stop()
  })
})
