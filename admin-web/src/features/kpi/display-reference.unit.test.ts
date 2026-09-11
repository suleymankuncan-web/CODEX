import { describe, expect, it } from 'vitest'
import { resolveLocalizedKpiScoreReference } from './display'
import type { TranslateFunction } from '../localization/dictionary'
const t = ((key: string) => key) as TranslateFunction
const keys = { target: 'storeKpis.reference.target', turkeyAverage: 'storeKpis.reference.turkeyAverage', checklistScore: 'storeKpis.reference.checklistScore', default: 'storeKpis.reference.default', pending: 'storeKpis.reference.pending', targetBenchmark: 'storeKpis.reference.target' } as const

describe('score reference source', () => {
  it('uses the Turkey benchmark even when an imported target exists', () => {
    expect(resolveLocalizedKpiScoreReference(t, keys, {targetValue: 2800, benchmarkValue: 2600, benchmarkSource: 'TURKEY_AVERAGE'}).value).toBe(2600)
  })
  it('keeps a missing Turkey benchmark unavailable and retains target-based HG', () => {
    expect(resolveLocalizedKpiScoreReference(t, keys, {targetValue: 2800, benchmarkValue: null, benchmarkSource: 'TURKEY_AVERAGE'}).value).toBeNull()
    expect(resolveLocalizedKpiScoreReference(t, keys, {targetValue: 2800, benchmarkValue: 2600, benchmarkSource: 'TARGET'}).value).toBe(2800)
  })
})
