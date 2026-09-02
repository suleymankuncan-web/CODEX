import { describe, expect, it } from 'vitest'
import {
  createQueryClientDefaultOptions,
  PLAYWRIGHT_BUILD_PROFILE,
} from './query-client-defaults'

const productionDefaults = {
  queries: {
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  },
}

describe('query client defaults', () => {
  it('keeps production defaults and retry count untouched for non-Playwright markers', () => {
    for (const marker of [undefined, null, '', 'production', 'playwright-e2e-unknown', 0]) {
      const options = createQueryClientDefaultOptions(marker)

      expect(options).toEqual(productionDefaults)
      expect('retry' in options.queries).toBe(false)
      expect('retryDelay' in options.queries).toBe(false)
    }
  })

  it('removes only the retry delay for the exact Playwright marker', () => {
    const options = createQueryClientDefaultOptions(PLAYWRIGHT_BUILD_PROFILE)

    expect(options).toEqual({
      ...productionDefaults,
      queries: {
        ...productionDefaults.queries,
        retryDelay: 0,
      },
    })
    expect('retry' in options.queries).toBe(false)
    expect(options.queries.retryDelay).toBe(0)
  })
})
