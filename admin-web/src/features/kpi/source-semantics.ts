import type { Tone } from '../../components/dashboard-primitives'

export type KpiSourceKind =
  | 'imported'
  | 'derived'
  | 'checklist_fed'
  | 'pending_normalization'
  | 'missing_reference'
  | 'missing'

export type KpiSourceSemantics = {
  kind: KpiSourceKind
  label: string
  summary: string
  tone: Tone
}

export type KpiScoreReference<T extends number | string> = {
  value: T | null
  sourceLabel: string
}

type SourceInput = {
  code: string
  actualValue?: number | string | null
  dataStatus?: 'reported' | 'missing'
  scoreStatus?: 'scored' | 'pending_normalization' | 'missing_reference' | 'missing'
  status?: 'reported' | 'missing'
}

type ScoreReferenceInput<T extends number | string> = {
  targetValue?: T | null
  benchmarkValue?: T | null
  benchmarkSource?: string | null
}

function hasNoValue(input: SourceInput) {
  return input.actualValue === null || input.actualValue === undefined
}

function hasReferenceValue<T extends number | string>(
  input: T | null | undefined,
): input is T {
  return input !== null && input !== undefined && input !== ''
}

function formatReferenceSource(input: string | null | undefined) {
  if (input === 'TURKEY_AVERAGE') {
    return 'Turkiye ortalamasi'
  }

  if (input === 'CHECKLIST_SCORE') {
    return 'Checklist skoru'
  }

  if (input === 'TARGET') {
    return 'Magaza/personel hedefi'
  }

  return 'Skor referansi'
}

export function resolveKpiScoreReference<T extends number | string>(
  input: ScoreReferenceInput<T>,
): KpiScoreReference<T> {
  if (hasReferenceValue(input.targetValue)) {
    return {
      value: input.targetValue,
      sourceLabel: 'Magaza/personel hedefi',
    }
  }

  if (hasReferenceValue(input.benchmarkValue)) {
    return {
      value: input.benchmarkValue,
      sourceLabel: formatReferenceSource(input.benchmarkSource),
    }
  }

  return {
    value: null,
    sourceLabel: 'Referans bekleniyor',
  }
}

export function resolveKpiSourceSemantics(input: SourceInput): KpiSourceSemantics {
  const code = input.code.trim().toUpperCase()

  if (input.scoreStatus === 'pending_normalization') {
    return {
      kind: 'pending_normalization',
      label: 'Pending normalization',
      summary: 'Deger geldi, score icin normalizasyon bekliyor.',
      tone: 'warning',
    }
  }

  if (input.scoreStatus === 'missing_reference') {
    return {
      kind: 'missing_reference',
      label: 'Eksik referans',
      summary: 'Deger geldi, ancak skor hedefi referansi eksik.',
      tone: 'warning',
    }
  }

  if (
    input.scoreStatus === 'missing' ||
    input.dataStatus === 'missing' ||
    input.status === 'missing' ||
    hasNoValue(input)
  ) {
    return {
      kind: 'missing',
      label: 'Missing',
      summary: 'Bu metrik icin henuz kullanilabilir veri yok.',
      tone: 'danger',
    }
  }

  if (code === 'BM_CHECKLIST' || code === 'VM_CHECKLIST') {
    return {
      kind: 'checklist_fed',
      label: 'Checklist-fed',
      summary: 'Checklist sonucundan beslenen compliance katkisi.',
      tone: 'calm',
    }
  }

  if (code === 'TARGET_ACHIEVEMENT') {
    return {
      kind: 'derived',
      label: 'Hedef bazli skor',
      summary: 'Girilen hedef ve gerceklesen performanstan turetilen skor sinyali.',
      tone: 'accent',
    }
  }

  return {
    kind: 'imported',
    label: 'Imported operational data',
    summary: 'Operasyon veya satis kaynagindan gelen reported KPI degeri.',
    tone: 'accent',
  }
}
