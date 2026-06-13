import type { StoreHeadcountGap } from '../features/workforce/api'
import { formatNumber } from '../lib/format'
import type { AppLocale } from '../lib/i18n'

export type NormStaffingStatusKind = 'short' | 'balanced' | 'over' | 'notConfigured'

export function getMonthRange(now: Date) {
  const year = now.getFullYear()
  const month = now.getMonth()
  return {
    periodStart: formatDateOnly(new Date(year, month, 1)),
    periodEnd: formatDateOnly(new Date(year, month + 1, 0)),
  }
}

export function formatNormActualLabel(input: {
  actualFallback: number
  headcountGap: StoreHeadcountGap | null
  locale?: AppLocale
  notConfiguredLabel: string
  separator?: string
}) {
  const separator = input.separator ?? ' / '
  const plannedHeadcount = toFiniteNumber(input.headcountGap?.plannedHeadcount)
  const actualHeadcount = toFiniteNumber(input.headcountGap?.activeHeadcount) ?? input.actualFallback
  const actualLabel = formatHeadcount(actualHeadcount, input.locale)
  if (plannedHeadcount === null || plannedHeadcount <= 0) {
    return `${input.notConfiguredLabel}${separator}${actualLabel}`
  }

  return `${formatHeadcount(plannedHeadcount, input.locale)}${separator}${actualLabel}`
}

export function hasPlannedHeadcount(input: StoreHeadcountGap | null) {
  const plannedHeadcount = toFiniteNumber(input?.plannedHeadcount)
  return plannedHeadcount !== null && plannedHeadcount > 0
}

export function interpretNormStaffingStatus(input: {
  actualFallback: number
  headcountGap: StoreHeadcountGap | null
}): NormStaffingStatusKind {
  const plannedHeadcount = toFiniteNumber(input.headcountGap?.plannedHeadcount)
  const activeHeadcount = toFiniteNumber(input.headcountGap?.activeHeadcount) ?? input.actualFallback
  if (plannedHeadcount === null || plannedHeadcount <= 0 || !Number.isFinite(activeHeadcount)) return 'notConfigured'
  if (plannedHeadcount > activeHeadcount) return 'short'
  if (activeHeadcount > plannedHeadcount) return 'over'
  return 'balanced'
}

export function formatNormStaffingStatusLabel(input: {
  kind: NormStaffingStatusKind
  locale: AppLocale
  notConfiguredLabel: string
}) {
  if (input.kind === 'short') return input.locale === 'en' ? 'Short' : 'Eksik'
  if (input.kind === 'balanced') return input.locale === 'en' ? 'Balanced' : 'Tam'
  if (input.kind === 'over') return input.locale === 'en' ? 'Over' : 'Fazla'
  return input.notConfiguredLabel
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatHeadcount(value: number, locale?: AppLocale) {
  return formatNumber(value, locale ?? 'tr', {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
    minimumFractionDigits: 0,
  })
}

function toFiniteNumber(value: string | undefined) {
  if (value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
