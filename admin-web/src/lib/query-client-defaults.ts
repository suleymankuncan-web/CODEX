import { ApiError } from './api-error'

export const PLAYWRIGHT_BUILD_PROFILE = 'playwright-e2e'

type QueryClientDefaultOptions = {
  queries: {
    refetchOnWindowFocus: false
    staleTime: 60_000
    retry: (failureCount: number, error: unknown) => boolean
    retryDelay?: number
  }
}

export function createQueryClientDefaultOptions(
  buildProfile: unknown,
): QueryClientDefaultOptions {
  const queries = {
    refetchOnWindowFocus: false as const,
    staleTime: 60_000 as const,
    retry: (failureCount: number, error: unknown) => !(error instanceof ApiError && error.status === 429) && failureCount < 3,
  }

  if (buildProfile !== PLAYWRIGHT_BUILD_PROFILE) {
    return { queries }
  }

  return {
    queries: {
      ...queries,
      retryDelay: 0,
    },
  }
}
