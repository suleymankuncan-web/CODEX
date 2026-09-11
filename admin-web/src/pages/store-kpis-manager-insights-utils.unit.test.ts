import { describe, expect, it } from 'vitest'
import { comparisonPeriod, metricGrowth } from './store-kpis-manager-insights-utils'

describe('manager KPI comparisons', () => {
  it('preserves single days and inclusive ranges, clamping short months and leap years', () => {
    expect(comparisonPeriod('2026-09-02','2026-09-04',-1)).toEqual({start:'2026-08-02',end:'2026-08-04'})
    expect(comparisonPeriod('2026-03-31','2026-03-31',-1)).toEqual({start:'2026-02-28',end:'2026-02-28'})
    expect(comparisonPeriod('2024-02-29','2024-02-29',-12)).toEqual({start:'2023-02-28',end:'2023-02-28'})
    expect(comparisonPeriod('2026-01-01','',-1)).toEqual({start:'2025-12-01',end:''})
  })
  it('reports increases, declines and zeros without inventing missing growth', () => {
    expect(metricGrowth(120,100)).toBe(20)
    expect(metricGrowth(80,100)).toBe(-20)
    expect(metricGrowth(0,100)).toBe(-100)
    expect(metricGrowth(10,0)).toBeNull()
    expect(metricGrowth(null,100)).toBeNull()
    expect(metricGrowth(100,null)).toBeNull()
  })
})
