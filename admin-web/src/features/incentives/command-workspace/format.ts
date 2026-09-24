import type { AppLocale } from '@/lib/i18n'

export function formatIncentivePosition(code: string | null, locale: AppLocale) {
  const labels: Record<string, [string, string]> = {
    STORE_MANAGER: ['Mağaza Müdürü', 'Store Manager'],
    ASSISTANT_MANAGER: ['Mağaza Müdür Yardımcısı', 'Assistant Manager'],
    SENIOR_SALES_CONSULTANT: ['Uzman Satış Danışmanı', 'Senior Sales Consultant'],
    SALES_ASSOCIATE: ['Satış Danışmanı', 'Sales Associate'],
    CASHIER: ['Kasa Sorumlusu', 'Cashier'],
    STOCKROOM: ['Depo Sorumlusu', 'Stockroom Associate'],
  }
  return code ? labels[code]?.[locale === 'tr' ? 0 : 1] ?? code : '—'
}

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

export function formatIncentiveDay(date: string, locale: AppLocale) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul',
  }).format(new Date(`${date}T12:00:00Z`))
}

export function formatSignedIncentiveMoney(value: string | null | undefined, locale: AppLocale) {
  if (value === null || value === undefined || Number(value) === 0) return '—'
  return `${Number(value) > 0 ? '+' : ''}${formatIncentiveMoney(value, locale)}`
}
