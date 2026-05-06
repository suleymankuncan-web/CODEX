import type { Tone } from '../components/dashboard-primitives'
import { defaultAppLocale, getIntlLocale, type AppLocale } from './i18n'

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
  return new Intl.NumberFormat(getIntlLocale(locale), options).format(input)
}

export function formatDate(input: string, locale: AppLocale = defaultAppLocale) {
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    dateStyle: 'medium',
  }).format(new Date(input))
}

export function formatDateTime(input: string, locale: AppLocale = defaultAppLocale) {
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(input))
}

export function mapHealthTone(state: string): Tone {
  if (state === 'healthy' || state === 'completed') return 'calm'
  if (state === 'ready') return 'accent'
  if (state === 'blocked') return 'warning'
  if (state === 'retry_ready') return 'accent'
  if (state === 'stuck' || state === 'needs_action') return 'danger'
  return 'neutral'
}
