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
      label: 'Pending normalization',
      summary: 'Deger geldi, score icin normalizasyon bekliyor.',
      tone: 'warning',
    }
  }

  if (input.scoreStatus === 'missing_reference') {
    return {
      kind: 'missing_reference',
      label: 'Eksik referans',
      summary: 'Deger geldi, ancak hedef veya benchmark referansi eksik.',
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
      label: 'Derived score signal',
      summary: 'Hedef ve gerceklesen performanstan turetilen skor sinyali.',
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
