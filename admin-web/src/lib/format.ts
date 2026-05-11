import type { Tone } from '../components/dashboard-primitives'
import { defaultAppLocale, getIntlLocale, type AppLocale } from './i18n'

const numberFormatters = new Map<string, Intl.NumberFormat>()
const dateFormatters: Record<AppLocale, Intl.DateTimeFormat> = {
  tr: new Intl.DateTimeFormat(getIntlLocale('tr'), {
    dateStyle: 'medium',
  }),
  en: new Intl.DateTimeFormat(getIntlLocale('en'), {
    dateStyle: 'medium',
  }),
}
const dateTimeFormatters: Record<AppLocale, Intl.DateTimeFormat> = {
  tr: new Intl.DateTimeFormat(getIntlLocale('tr'), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }),
  en: new Intl.DateTimeFormat(getIntlLocale('en'), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }),
}

export function formatState(input: string) {
  return input.replaceAll('_', ' ')
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected error'
}

export function formatNumber(
  input: number,
  locale: AppLocale = defaultAppLocale,
  options?: Intl.NumberFormatOptions,
) {
  const cacheKey = `${locale}:${JSON.stringify(options ?? {})}`
  let formatter = numberFormatters.get(cacheKey)

  if (!formatter) {
    formatter = Intl.NumberFormat(getIntlLocale(locale), options)
    numberFormatters.set(cacheKey, formatter)
  }

  return formatter.format(input)
}

export function formatDate(input: string, locale: AppLocale = defaultAppLocale) {
  return dateFormatters[locale].format(new Date(input))
}

export function formatDateTime(input: string, locale: AppLocale = defaultAppLocale) {
  return dateTimeFormatters[locale].format(new Date(input))
}

export function mapHealthTone(state: string): Tone {
  if (state === 'healthy' || state === 'completed') return 'calm'
  if (state === 'ready') return 'accent'
  if (state === 'blocked') return 'warning'
  if (state === 'retry_ready') return 'accent'
  if (state === 'stuck' || state === 'needs_action') return 'danger'
  return 'neutral'
}
