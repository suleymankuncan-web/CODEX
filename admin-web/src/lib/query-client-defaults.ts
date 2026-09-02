export const PLAYWRIGHT_BUILD_PROFILE = 'playwright-e2e'

type QueryClientDefaultOptions = {
  queries: {
    refetchOnWindowFocus: false
    staleTime: 60_000
    retryDelay?: number
  }
}

export function createQueryClientDefaultOptions(
  buildProfile: unknown,
): QueryClientDefaultOptions {
  const queries = {
    refetchOnWindowFocus: false as const,
    staleTime: 60_000 as const,
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
