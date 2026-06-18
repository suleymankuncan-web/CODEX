import type { StoreSurfaceTone } from './store-surface-primitives'
import type {
  SalesTargetIncentiveProjection,
  SalesTargetIncentiveRow,
  SalesTargetIncentiveStatus,
} from '../features/incentives/api'
import type { AppLocale } from '../lib/i18n'

export type IncentiveRateBracket = {
  range: string
  rate: string
}

export const managerRateBrackets: IncentiveRateBracket[] = [
  { range: '< 80,0000%', rate: '0,0000' },
  { range: '80,0000% - 84,9999%', rate: '0,0020' },
  { range: '85,0000% - 89,9999%', rate: '0,0030' },
  { range: '90,0000% - 94,9999%', rate: '0,0040' },
  { range: '95,0000% - 99,9999%', rate: '0,0050' },
  { range: '100,0000% - 109,9999%', rate: '0,0070' },
  { range: '110,0000% ve üzeri', rate: '0,0100' },
]

export const personnelRateBrackets: IncentiveRateBracket[] = [
  { range: '< 80,0000%', rate: '0,0000' },
  { range: '80,0000% - 84,9999%', rate: '0,0050' },
  { range: '85,0000% - 89,9999%', rate: '0,0050' },
  { range: '90,0000% - 94,9999%', rate: '0,0065' },
  { range: '95,0000% - 99,9999%', rate: '0,0075' },
  { range: '100,0000% - 109,9999%', rate: '0,0150' },
  { range: '110,0000% ve üzeri', rate: '0,0165' },
]

const statusTone: Record<SalesTargetIncentiveStatus, StoreSurfaceTone> = {
  adjusted: 'accent',
  blocked: 'danger',
  closed: 'calm',
  corrected: 'accent',
  no_source: 'warning',
  projected: 'calm',
}

const positionLabel: Record<SalesTargetIncentiveRow['positionCode'], string> = {
  ASSISTANT_MANAGER: 'Müdür yardımcısı',
  SALES_ASSOCIATE: 'Satış danışmanı',
  SENIOR_SALES_CONSULTANT: 'Kıdemli satış danışmanı',
  STORE_MANAGER: 'Mağaza müdürü',
}

const statusLabel: Record<SalesTargetIncentiveStatus, string> = {
  adjusted: 'Düzeltmeli',
  blocked: 'Bloke',
  closed: 'Kapanmış',
  corrected: 'Düzeltilmiş',
  no_source: 'Kaynak bekliyor',
  projected: 'Güncel',
}

export function getIncentiveStatusTone(status: SalesTargetIncentiveStatus): StoreSurfaceTone {
  return statusTone[status] ?? 'neutral'
}

export function getIncentiveStatusLabel(status: SalesTargetIncentiveStatus) {
  return statusLabel[status] ?? status
}

export function getIncentivePositionLabel(positionCode: SalesTargetIncentiveRow['positionCode']) {
  return positionLabel[positionCode] ?? positionCode
}

export function getManagerRow(projection: SalesTargetIncentiveProjection) {
  return projection.rows.find((row) => row.participantType === 'store_manager') ?? null
}

export function getPersonnelRows(projection: SalesTargetIncentiveProjection) {
  return projection.rows.filter((row) => row.participantType === 'personnel')
}

export function getPrimaryEarnedAmount(row: SalesTargetIncentiveRow | null) {
  return row?.finalAmount ?? row?.payableAmount ?? row?.rawEarnedAmount ?? null
}

export function getRevisionLabel(projection: SalesTargetIncentiveProjection) {
  if (projection.storeTarget) {
    return 'Onaylı hedef'
  }

  if (projection.calculationState === 'blocked') {
    return 'Hedef bekleniyor'
  }

  return 'Revizyon yok'
}

export function formatMoneyValue(value: string | null | undefined, locale: AppLocale) {
  if (!value) return 'Kaynak yok'
  const normalized = normalizeDecimal(value)
  if (!normalized) return 'Kaynak yok'
  const sign = normalized.sign ? '-' : ''
  const grouped = groupInteger(normalized.integer, locale)
  const decimalSeparator = locale === 'tr' ? ',' : '.'
  return `${sign}${grouped}${decimalSeparator}${normalized.fraction.padEnd(2, '0').slice(0, 2)} TL`
}

export function formatPercentValue(value: string | null | undefined, locale: AppLocale) {
  if (!value) return 'Kaynak yok'
  const normalized = normalizeDecimal(value)
  if (!normalized) return 'Kaynak yok'
  const sign = normalized.sign ? '-' : ''
  const grouped = groupInteger(normalized.integer, locale)
  const decimalSeparator = locale === 'tr' ? ',' : '.'
  return `%${sign}${grouped}${decimalSeparator}${normalized.fraction.padEnd(2, '0').slice(0, 2)}`
}

export function formatRateValue(value: string | null | undefined, locale: AppLocale) {
  if (!value) return '0,0000'
  const normalized = normalizeDecimal(value)
  if (!normalized) return '0,0000'
  const decimalSeparator = locale === 'tr' ? ',' : '.'
  return `${normalized.sign ? '-' : ''}${normalized.integer}${decimalSeparator}${normalized.fraction.padEnd(4, '0').slice(0, 4)}`
}

export function formatDateTimeValue(value: string | null | undefined, locale: AppLocale) {
  if (!value) return 'Kaynak yok'
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return 'Kaynak yok'
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function toProgressPercent(value: string | null | undefined) {
  if (!value) return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  return Math.max(0, Math.min(100, parsed))
}

function normalizeDecimal(value: string) {
  const trimmed = value.trim().replace(',', '.')
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(trimmed)
  if (!match) return null
  const integer = match[2]
  if (!integer) return null
  return {
    sign: Boolean(match[1]),
    integer: integer.replace(/^0+(?=\d)/, '') || '0',
    fraction: match[3] ?? '',
  }
}

function groupInteger(value: string, locale: AppLocale) {
  const separator = locale === 'tr' ? '.' : ','
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
}
