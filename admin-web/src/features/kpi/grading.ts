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

export const defaultGradingBands: KpiGradingBand[] = [
  { code: 'A', label: 'Mukemmel', emoji: '🏆', tone: 'calm', minScore: 1 },
  { code: 'B', label: 'Iyi', emoji: '🙂', tone: 'accent', minScore: 0.85 },
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
  return `${grade.emoji} ${grade.code} - ${grade.label}`
}

export function resolvePerformanceScoreMeaning(input: {
  grade: PerformanceGrade
  matchedMetrics: number
  totalMetrics: number
  isPartial: boolean
}): PerformanceScoreMeaning {
  const confidence = input.isPartial
    ? `Veri guveni: ${input.matchedMetrics}/${input.totalMetrics} metrik skorlandi; yorum on izlemedir.`
    : `Veri guveni: ${input.matchedMetrics}/${input.totalMetrics} metrik skorlandi.`

  if (input.grade.code === 'A') {
    return {
      title: 'Guclu performans',
      summary: 'Skor ust bantta. Bu sonuc mevcut donemde hedef, ATV ve UPT katkilarinin guclu okundugunu anlatir.',
      focus: 'Ritmi koru; guclu metrikleri surdur ve zayiflayan ilk metrigi erken takip et.',
      confidence,
      tone: input.isPartial ? 'warning' : input.grade.tone,
    }
  }

  if (input.grade.code === 'B') {
    return {
      title: 'Saglikli performans',
      summary: 'Skor iyi bantta. Genel performans saglikli, ama ust banda cikmak icin metrik bazli firsatlar var.',
      focus: 'En dusuk katkili metrigi bul; kucuk iyilestirme toplam skoru yukari tasir.',
      confidence,
      tone: input.isPartial ? 'warning' : input.grade.tone,
    }
  }

  if (input.grade.code === 'C') {
    return {
      title: 'Takip gerekli',
      summary: 'Skor takip bandinda. Performans dusmeden once hangi metriklerin skoru asagi cektigi incelenmeli.',
      focus: 'Hedef, ATV veya UPT icinde dusuk katkili alan icin magaza muduruyle aksiyon belirle.',
      confidence,
      tone: 'warning',
    }
  }

  return {
    title: 'Kritik takip',
    summary: 'Skor kritik bantta. Bu sonuc hizli takip ve net aksiyon gerektiren performans riski oldugunu anlatir.',
    focus: 'Once eksik veya dusuk katkili metrikleri ayir; ardindan hedef ve satis davranisini birlikte ele al.',
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
      ? `Skor guveni: ${formatCoveredWeight(input.coveredWeight)}% agirlik kapsandi; ${formatCoveredWeight(input.missingWeight)}% eksik agirlik yorumu on izleme yapar.`
      : `Skor guveni: ${formatCoveredWeight(input.coveredWeight)}% agirlik kapsandi.`

  if (input.grade.code === 'A') {
    return {
      title: 'Guclu store skoru',
      summary: 'Store score ust bantta. Mevcut donemde KPI katkisi saglikli ve aksiyon dili koruma ritmidir.',
      action: "Aksiyon: ritmi koru; dusuk katkili ilk KPI'yi gunluk izle.",
      confidence,
      tone: input.missingWeight > 0 ? 'warning' : input.grade.tone,
    }
  }

  if (input.grade.code === 'B') {
    return {
      title: 'Saglikli store skoru',
      summary: 'Store score iyi bantta. Temel performans saglikli, ama ust banda cikmak icin net firsat var.',
      action: 'Aksiyon: en dusuk katkili KPI icin kisa takip plani belirle.',
      confidence,
      tone: input.missingWeight > 0 ? 'warning' : input.grade.tone,
    }
  }

  if (input.grade.code === 'C') {
    return {
      title: 'Store takip bandi',
      summary: 'Store score takip bandinda. Bu seviye magaza muduru icin erken uyari dili uretir.',
      action: 'Aksiyon: dusuk katkili KPI icin neden ve sahiplik netlestir.',
      confidence,
      tone: 'warning',
    }
  }

  return {
    title: 'Kritik store skoru',
    summary: 'Store score kritik bantta. Bu seviye hizli aksiyon ve yakin takip gerektirir.',
    action: 'Aksiyon: once eksik veya dusuk KPI satirlarini ayir; sonra operasyon aksiyonunu netlestir.',
    confidence,
    tone: 'danger',
  }
}
