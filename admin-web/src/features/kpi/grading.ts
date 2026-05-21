import type { Tone } from '../../components/dashboard-primitives'
import type { KpiGradingBand } from '../reports/api'

export type PerformanceGradeCode = 'A' | 'B' | 'C' | 'D'

export type PerformanceGrade = {
  code: PerformanceGradeCode
  label: string
  emoji: string
  tone: Tone
}

const defaultGradingBands: KpiGradingBand[] = [
  { code: 'A', label: 'Mükemmel', emoji: '🏆', tone: 'calm', minScore: 1 },
  { code: 'B', label: 'İyi', emoji: '🙂', tone: 'accent', minScore: 0.85 },
  { code: 'C', label: 'Takip gerekli', emoji: '👀', tone: 'warning', minScore: 0.75 },
  { code: 'D', label: 'Kritik', emoji: '🚨', tone: 'danger', minScore: 0 },
]

export function resolvePerformanceGrade(
  score: number,
  gradingBands: KpiGradingBand[] = defaultGradingBands,
): PerformanceGrade {
  if (!Number.isFinite(score)) {
    return { code: 'D', label: 'Kritik', emoji: '🚨', tone: 'danger' }
  }

  const fallbackBand = defaultGradingBands[defaultGradingBands.length - 1] as KpiGradingBand
  const band =
    gradingBands
      .toSorted((left, right) => right.minScore - left.minScore)
      .find((item) => score >= item.minScore) ?? fallbackBand

  return {
    code: band.code as PerformanceGradeCode,
    label: band.label,
    emoji: band.emoji,
    tone: band.tone,
  }
}

export function formatBenchmarkRatio(ratio: number | null | undefined, placement: 'prefix' | 'suffix' = 'suffix') {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) {
    return '-'
  }

  const value = Math.round(ratio * 100)
  return placement === 'prefix' ? `%${value}` : `${value}%`
}
