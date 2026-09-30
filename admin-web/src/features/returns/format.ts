import type { StoreReturnRow } from './api'

export function returnMoney(value: string | null | undefined, locale: 'tr' | 'en') {
  if (value == null || value.trim() === '' || !Number.isFinite(Number(value))) return '—'
  return new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(Number(value))
}

export function returnDate(value: string, locale: 'tr' | 'en') {
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(new Date(`${value}T00:00:00Z`))
}

export function returnStatus(row: StoreReturnRow, locale: 'tr' | 'en') {
  if (row.direction === 'external') return locale === 'tr' ? 'Dış mağazada iade · Bilgi' : 'Returned externally · Information'
  const labels = locale === 'tr'
    ? { in_store: 'Mağaza İçi İade', out_of_norm: 'Norm Dışı İade', cross_store: 'Mağaza Dışı İade', review_required: 'Kontrol Gerekli' }
    : { in_store: 'In-store Return', out_of_norm: 'Outside Norm', cross_store: 'Cross-store Return', review_required: 'Review Required' }
  return labels[row.category]
}
