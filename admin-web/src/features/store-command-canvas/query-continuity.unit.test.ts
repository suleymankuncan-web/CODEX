import { describe, expect, test } from 'vitest'
import { resolveCommandCanvasQueryState } from './query-continuity'

describe('Command Canvas query continuity', () => {
  test('prefers the newly resolved page over stale previous data', () => {
    const state = resolveCommandCanvasQueryState({
      data: ['store-2'],
      previousData: ['store-1'],
      isFetching: false,
      error: null,
    })

    expect(state.visibleData).toEqual(['store-2'])
    expect(state.isUpdating).toBe(false)
  })

  test('keeps the last successful rows visible while a period refetch is running', () => {
    const state = resolveCommandCanvasQueryState({
      data: undefined,
      previousData: ['store-1', 'store-2'],
      isFetching: true,
      error: null,
    })

    expect(state).toEqual({
      visibleData: ['store-1', 'store-2'],
      initialLoading: false,
      isUpdating: true,
      blockingError: null,
      backgroundError: null,
    })
  })

  test('treats an error as non-blocking when prior authorized data is still available', () => {
    const error = new Error('temporary failure')
    const state = resolveCommandCanvasQueryState({
      data: undefined,
      previousData: ['store-1'],
      isFetching: false,
      error,
    })

    expect(state.visibleData).toEqual(['store-1'])
    expect(state.blockingError).toBeNull()
    expect(state.backgroundError).toBe(error)
  })

  test('fails visibly when no current or previous authorized data exists', () => {
    const error = new Error('forbidden')
    const state = resolveCommandCanvasQueryState<string[]>({
      data: undefined,
      previousData: undefined,
      isFetching: false,
      error,
    })

    expect(state.visibleData).toBeUndefined()
    expect(state.initialLoading).toBe(false)
    expect(state.blockingError).toBe(error)
    expect(state.backgroundError).toBeNull()
  })

  test('reports an initial load only before any authorized data has been resolved', () => {
    const state = resolveCommandCanvasQueryState<string[]>({
      data: undefined,
      previousData: undefined,
      isFetching: true,
      error: null,
    })

    expect(state.initialLoading).toBe(true)
    expect(state.isUpdating).toBe(false)
  })
})
