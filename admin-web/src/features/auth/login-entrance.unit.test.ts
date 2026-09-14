import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const key = 'hr-axis-login-entrance-start'

describe('login entrance continuity', () => {
  let saved: string | null
  let now: number
  let storage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> }
  beforeEach(() => {
    vi.resetModules()
    saved = null
    now = 10000
    storage = {
      getItem: vi.fn(() => saved),
      setItem: vi.fn((_key: string, value: string) => { saved = value }),
    }
    vi.stubGlobal('sessionStorage', storage)
    vi.spyOn(Date, 'now').mockImplementation(() => now)
  })
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('keeps the same presentation timestamp through a React remount', async () => {
    const { prepareLoginEntrance } = await import('./login-entrance')
    const setProperty = vi.fn()
    const element = { style: { setProperty } } as unknown as HTMLElement
    prepareLoginEntrance(element)
    expect(storage.setItem).toHaveBeenLastCalledWith(key, '10000')
    now += 250
    prepareLoginEntrance(element)
    expect(setProperty).toHaveBeenLastCalledWith('--login-motion-offset', '-250ms')
    expect(storage.setItem).toHaveBeenLastCalledWith(key, '10000')
  })

  it('starts afresh for a new application visit even after an earlier sign-in', async () => {
    saved = '1000'
    const { prepareLoginEntrance } = await import('./login-entrance')
    prepareLoginEntrance({ style: { setProperty: vi.fn() } } as unknown as HTMLElement)
    expect(saved).toBe('10000')
  })

  it('keeps the entry usable when presentation storage is blocked', async () => {
    storage.setItem.mockImplementation(() => { throw new Error('Storage disabled') })
    storage.getItem.mockImplementation(() => { throw new Error('Storage disabled') })
    const { prepareLoginEntrance } = await import('./login-entrance')
    const setProperty = vi.fn()
    prepareLoginEntrance({ style: { setProperty } } as unknown as HTMLElement)
    expect(setProperty).toHaveBeenCalledWith('--login-motion-offset', '-0ms')
  })
})
