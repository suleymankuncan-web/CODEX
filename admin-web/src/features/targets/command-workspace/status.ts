import type { TargetCommandStore } from './types'
import type { AppLocale } from '@/lib/i18n'

const tr: Record<TargetCommandStore['status'], { label: string; tone: string }> = {
  pending: { label: 'Onay bekliyor', tone: 'amber' },
  approved: { label: 'Onaylandı', tone: 'mint' },
  adjusted_approved: { label: 'Düzenlenerek onaylandı', tone: 'plum' },
  returned: { label: 'İade edildi', tone: 'rose' },
  revision_conflict: { label: 'Revizyon çakışması', tone: 'rose' },
  stale_reference: { label: 'Güncel olmayan referans', tone: 'rose' },
  missing: { label: 'Hedef bekleniyor', tone: 'rose' },
  unknown: { label: 'Durum bilinmiyor', tone: 'neutral' },
}

const en: Record<TargetCommandStore['status'], { label: string; tone: string }> = {
  pending: { label: 'Awaiting approval', tone: 'amber' },
  approved: { label: 'Approved', tone: 'mint' },
  adjusted_approved: { label: 'Approved with adjustments', tone: 'plum' },
  returned: { label: 'Returned', tone: 'rose' },
  revision_conflict: { label: 'Revision conflict', tone: 'rose' },
  stale_reference: { label: 'Outdated reference', tone: 'rose' },
  missing: { label: 'Target awaited', tone: 'rose' },
  unknown: { label: 'Status unavailable', tone: 'neutral' },
}

export function getTargetStatusMeta(locale: AppLocale) { return locale === 'tr' ? tr : en }
