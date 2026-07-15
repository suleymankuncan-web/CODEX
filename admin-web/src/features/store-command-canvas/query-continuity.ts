export type CommandCanvasQueryState<T> = {
  visibleData: T | undefined
  initialLoading: boolean
  isUpdating: boolean
  blockingError: Error | null
  backgroundError: Error | null
}

export function resolveCommandCanvasQueryState<T>(input: {
  data: T | undefined
  previousData: T | undefined
  isFetching: boolean
  error: Error | null
}): CommandCanvasQueryState<T> {
  const visibleData = input.data ?? input.previousData
  const hasVisibleData = visibleData !== undefined

  return {
    visibleData,
    initialLoading: input.isFetching && !hasVisibleData,
    isUpdating: input.isFetching && hasVisibleData,
    blockingError: input.error && !hasVisibleData ? input.error : null,
    backgroundError: input.error && hasVisibleData ? input.error : null,
  }
}
