import type { AppLocale } from '@/lib/i18n'

export function formatIncentiveMoney(value: string | null | undefined, locale: AppLocale) {
  if (value === null || value === undefined) return '—'
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '—'
  return new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(parsed)
}

export function formatIncentivePercent(value: string | null | undefined, locale: AppLocale) {
  if (value === null || value === undefined) return '—'
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '—'
  return new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(parsed / 100)
}

export function formatIncentiveRate(value: string | null | undefined, locale: AppLocale) {
  if (value === null || value === undefined) return '—'
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '—'
  return new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(parsed)
}

export function formatIncentivePeriod(period: string, locale: AppLocale) {
  const match = /^(\d{4})-(\d{2})$/.exec(period)
  if (!match) return period
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul',
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)))
}

export function formatSignedIncentiveMoney(value: string | null | undefined, locale: AppLocale) {
  if (value === null || value === undefined || Number(value) === 0) return '—'
  return `${Number(value) > 0 ? '+' : ''}${formatIncentiveMoney(value, locale)}`
}
