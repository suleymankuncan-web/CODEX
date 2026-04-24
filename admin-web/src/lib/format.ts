import type { Tone } from '../components/dashboard-primitives'
import { getIntlLocale } from './i18n'

export function formatState(input: string) {
  return input.replaceAll('_', ' ')
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected error'
}

export function formatDate(input: string) {
  return new Intl.DateTimeFormat(getIntlLocale(), {
    dateStyle: 'medium',
  }).format(new Date(input))
}

export function formatDateTime(input: string) {
  return new Intl.DateTimeFormat(getIntlLocale(), {
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
