import type { AppLocale } from '@/lib/i18n'
import type { TargetCommandStore } from './types'

export function formatTargetMoney(value: string | number | null | undefined, locale: AppLocale) {
  if (value === null || value === undefined || value === '') return '—'
  return new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    style: 'currency', currency: 'TRY', maximumFractionDigits: 0,
  }).format(Number(value))
}

export function formatTargetPeriod(period: string, locale: AppLocale) {
  const [year, month] = period.split('-').map(Number)
  if (!year || !month) return period
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

export function targetDistributed(store: TargetCommandStore) {
  return store.request?.allocations.reduce((sum, allocation) => sum + Number(allocation.targetValue), 0) ?? null
}

export function formatTargetTimestamp(value: string | null | undefined, locale: AppLocale) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul',
  }).format(new Date(value))
}
