import type { Tone } from '../../components/dashboard-primitives'
import type { KpiGradingBand } from '../reports/api'

export type PerformanceGradeCode = 'A' | 'B' | 'C' | 'D'

export type PerformanceGrade = {
  code: PerformanceGradeCode
  label: string
  emoji: string
  tone: Tone
}

export type PerformanceScoreMeaning = {
  title: string
  summary: string
  focus: string
  confidence: string
  tone: Tone
}

export type StoreScoreThresholdMeaning = {
  title: string
  summary: string
  action: string
  confidence: string
  tone: Tone
}

const performanceGradeLabels: Record<PerformanceGradeCode, string> = {
  A: 'Mükemmel',
  B: 'İyi',
  C: 'Takip gerekli',
  D: 'Kritik',
}

export const defaultGradingBands: KpiGradingBand[] = [
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

  const band =
    [...gradingBands]
      .sort((left, right) => right.minScore - left.minScore)
      .find((item) => score >= item.minScore) ?? defaultGradingBands[defaultGradingBands.length - 1]

  return {
    code: band.code as PerformanceGradeCode,
    label: band.label,
    emoji: band.emoji,
    tone: band.tone,
  }
}

export function formatPerformanceGrade(grade: PerformanceGrade) {
  return `${grade.emoji} ${grade.code} - ${performanceGradeLabels[grade.code] ?? grade.label}`
}

export function resolvePerformanceScoreMeaning(input: {
  grade: PerformanceGrade
  matchedMetrics: number
  totalMetrics: number
  isPartial: boolean
}): PerformanceScoreMeaning {
  const confidence = input.isPartial
    ? `Veri güveni: ${input.matchedMetrics}/${input.totalMetrics} metrik skorlandı; yorum ön izlemedir.`
    : `Veri güveni: ${input.matchedMetrics}/${input.totalMetrics} metrik skorlandı.`

  if (input.grade.code === 'A') {
    return {
      title: 'Güçlü performans',
      summary: 'Skor üst bantta. Bu sonuç mevcut dönemde hedef, ATV ve UPT katkılarının güçlü okunduğunu anlatır.',
      focus: 'Ritmi koru; güçlü metrikleri sürdür ve zayıflayan ilk metriği erken takip et.',
      confidence,
      tone: input.isPartial ? 'warning' : input.grade.tone,
    }
  }

  if (input.grade.code === 'B') {
    return {
      title: 'Sağlıklı performans',
      summary: 'Skor iyi bantta. Genel performans sağlıklı, ama üst banda çıkmak için metrik bazlı fırsatlar var.',
      focus: 'En düşük katkılı metriği bul; küçük iyileştirme toplam skoru yukarı taşır.',
      confidence,
      tone: input.isPartial ? 'warning' : input.grade.tone,
    }
  }

  if (input.grade.code === 'C') {
    return {
      title: 'Takip gerekli',
      summary: 'Skor takip bandında. Performans düşmeden önce hangi metriklerin skoru aşağı çektiği incelenmeli.',
      focus: 'Hedef, ATV veya UPT içinde düşük katkılı alan için mağaza müdürüyle aksiyon belirle.',
      confidence,
      tone: 'warning',
    }
  }

  return {
    title: 'Kritik takip',
    summary: 'Skor kritik bantta. Bu sonuç hızlı takip ve net aksiyon gerektiren performans riski olduğunu anlatır.',
    focus: 'Önce eksik veya düşük katkılı metrikleri ayır; ardından hedef ve satış davranışını birlikte ele al.',
    confidence,
    tone: 'danger',
  }
}

function formatCoveredWeight(input: number) {
  if (!Number.isFinite(input)) {
    return '0'
  }

  return Number.isInteger(input) ? String(input) : input.toFixed(1)
}

export function resolveStoreScoreThresholdMeaning(input: {
  grade: PerformanceGrade
  coveredWeight: number
  missingWeight: number
  matchedMetrics: number
  totalMetrics: number
}): StoreScoreThresholdMeaning {
  const confidence =
    input.missingWeight > 0 || input.matchedMetrics < input.totalMetrics
      ? `Skor güveni: ${formatCoveredWeight(input.coveredWeight)}% ağırlık kapsandı; ${formatCoveredWeight(input.missingWeight)}% eksik ağırlık yorumu ön izleme yapar.`
      : `Skor güveni: ${formatCoveredWeight(input.coveredWeight)}% ağırlık kapsandı.`

  if (input.grade.code === 'A') {
    return {
      title: 'Güçlü mağaza skoru',
      summary: 'Mağaza skoru üst bantta. Mevcut dönemde KPI katkısı sağlıklı ve aksiyon dili koruma ritmidir.',
      action: "Aksiyon: ritmi koru; düşük katkılı ilk KPI'yi günlük izle.",
      confidence,
      tone: input.missingWeight > 0 ? 'warning' : input.grade.tone,
    }
  }

  if (input.grade.code === 'B') {
    return {
      title: 'Sağlıklı mağaza skoru',
      summary: 'Mağaza skoru iyi bantta. Temel performans sağlıklı, ama üst banda çıkmak için net fırsat var.',
      action: 'Aksiyon: en düşük katkılı KPI için kısa takip planı belirle.',
      confidence,
      tone: input.missingWeight > 0 ? 'warning' : input.grade.tone,
    }
  }

  if (input.grade.code === 'C') {
    return {
      title: 'Mağaza takip bandı',
      summary: 'Mağaza skoru takip bandında. Bu seviye mağaza müdürü için erken uyarı dili üretir.',
      action: 'Aksiyon: düşük katkılı KPI için neden ve sahiplik netleştir.',
      confidence,
      tone: 'warning',
    }
  }

  return {
    title: 'Kritik mağaza skoru',
    summary: 'Mağaza skoru kritik bantta. Bu seviye hızlı aksiyon ve yakın takip gerektirir.',
    action: 'Aksiyon: önce eksik veya düşük KPI satırlarını ayır; sonra operasyon aksiyonunu netleştir.',
    confidence,
    tone: 'danger',
  }
}

export function formatBenchmarkRatio(ratio: number | null | undefined, placement: 'prefix' | 'suffix' = 'suffix') {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) {
    return '-'
  }

  const value = Math.round(ratio * 100)
  return placement === 'prefix' ? `%${value}` : `${value}%`
}

export function describeBenchmarkCap(input: {
  actualRatio?: number | null
  scoredRatio?: number | null
  isCapped?: boolean
}) {
  if (!input.isCapped || !input.actualRatio || !input.scoredRatio) {
    return null
  }

  return `Gerçek oran ${formatBenchmarkRatio(input.actualRatio, 'prefix')}. Skor limiti ${formatBenchmarkRatio(
    input.scoredRatio,
  )}+ ile hesaplandı.`
}
