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

type SourceInput = {
  code: string
  actualValue?: number | string | null
  dataStatus?: 'reported' | 'missing'
  scoreStatus?: 'scored' | 'pending_normalization' | 'missing_reference' | 'missing'
  status?: 'reported' | 'missing'
}

function hasNoValue(input: SourceInput) {
  return input.actualValue === null || input.actualValue === undefined
}

export function resolveKpiSourceSemantics(input: SourceInput): KpiSourceSemantics {
  const code = input.code.trim().toUpperCase()

  if (input.scoreStatus === 'pending_normalization') {
    return {
      kind: 'pending_normalization',
      label: 'Normalizasyon bekliyor',
      summary: 'Değer geldi, skor için normalizasyon bekliyor.',
      tone: 'warning',
    }
  }

  if (input.scoreStatus === 'missing_reference') {
    return {
      kind: 'missing_reference',
      label: 'Eksik referans',
      summary: 'Değer geldi, ancak skor hedefi referansı eksik.',
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
      label: 'Veri yok',
      summary: 'Bu metrik için henüz kullanılabilir veri yok.',
      tone: 'danger',
    }
  }

  if (code === 'BM_CHECKLIST' || code === 'VM_CHECKLIST') {
    return {
      kind: 'checklist_fed',
      label: 'Checklist katkısı',
      summary: 'Checklist sonucundan beslenen uyum katkısı.',
      tone: 'calm',
    }
  }

  if (code === 'TARGET_ACHIEVEMENT') {
    return {
      kind: 'derived',
      label: 'Hedef bazlı skor',
      summary: 'Girilen hedef ve gerçekleşen performanstan türetilen skor sinyali.',
      tone: 'accent',
    }
  }

  return {
    kind: 'imported',
    label: 'Operasyon verisi',
    summary: 'Operasyon veya satış kaynağından gelen raporlanmış KPI değeri.',
    tone: 'accent',
  }
}
