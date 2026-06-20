import type {
  SalesTargetIncentiveProjection,
  SalesTargetIncentiveRow,
} from '../features/incentives/api'
import type { AppLocale } from '../lib/i18n'
import { formatMoneyValue, formatPercentValue } from './store-incentives-model'
import { getRegionEffectiveEarnedAmount } from './store-incentives-region-manager-model'
import type { StoreSurfaceTone } from './store-surface-primitives'

export const regionManagerPrimaryActionClass =
  'tw:bg-gradient-to-r tw:from-primary tw:to-accent tw:text-primary-foreground tw:shadow-lg tw:shadow-primary/20 tw:hover:from-primary/90 tw:hover:to-accent/90'

export function getStoreGateState(projection: SalesTargetIncentiveProjection) {
  if (projection.storeGatePassed !== null) {
    return { known: true, passed: projection.storeGatePassed }
  }

  const achievement = parseDecimalNumber(projection.storeAchievementPct)
  if (achievement !== null) {
    return { known: true, passed: achievement >= 80 }
  }

  return { known: false, passed: false }
}

export function getStoreGateLabel(projection: SalesTargetIncentiveProjection) {
  const gate = getStoreGateState(projection)
  if (gate.known) return gate.passed ? '%80 kapısı geçildi' : '%80 kapısı bekliyor'
  if (!projection.storeTarget && projection.storeActualNetSales) return 'Hedef bekliyor'
  if (projection.storeTarget && !projection.storeActualNetSales) return 'Satış bekliyor'
  return 'Hedef bekliyor'
}

export function formatTargetMoneyValue(value: string | null | undefined, locale: AppLocale) {
  return value ? formatMoneyValue(value, locale) : 'Hedef yok'
}

export function formatSalesMoneyValue(value: string | null | undefined, locale: AppLocale) {
  return value ? formatMoneyValue(value, locale) : 'Satış verisi yok'
}

export function formatIncentiveMoneyValue(value: string | null | undefined, locale: AppLocale) {
  return value ? formatMoneyValue(value, locale) : formatMoneyValue('0.00', locale)
}

export function formatAchievementState(
  achievementPct: string | null | undefined,
  target: string | null | undefined,
  actual: string | null | undefined,
  locale: AppLocale,
) {
  if (achievementPct) return formatPercentValue(achievementPct, locale)
  if (!target && actual) return 'Hedef bekliyor'
  if (target && !actual) return 'Satış bekliyor'
  if (!target) return 'Hedef yok'
  return 'Bekliyor'
}

export function getFinalChange(row: SalesTargetIncentiveRow, locale: AppLocale) {
  return getFinalChangeFromAmounts(
    row.regionCorrection?.beforeAmount ?? row.payableAmount,
    getRegionEffectiveEarnedAmount(row),
    locale,
  )
}

export function getFinalChangeFromAmounts(
  beforeAmount: string | null | undefined,
  finalAmount: string | null | undefined,
  locale: AppLocale,
): { label: string; tone: StoreSurfaceTone } {
  const beforeCents = decimalStringToCents(beforeAmount ?? '0.00')
  const finalCents = decimalStringToCents(finalAmount ?? '0.00')
  const delta = finalCents - beforeCents

  if (delta === 0n) return { label: 'Yok', tone: 'neutral' }

  const sign = delta > 0n ? '+' : '-'
  const absolute = delta > 0n ? delta : -delta

  return {
    label: `${sign}${formatMoneyValue(centsToDecimalString(absolute), locale)}`,
    tone: delta > 0n ? 'warning' : 'danger',
  }
}

export function toMoneyEditValue(rawValue: string) {
  return formatMoneyEditValue(removeCurrencySuffix(rawValue))
}

export function formatMoneyEditValue(rawValue: string) {
  const parsed = parseMoneyInput(rawValue)
  if (parsed.invalid) return removeCurrencySuffix(rawValue)

  const groupedInteger = groupMoneyInteger(parsed.integer)
  if (parsed.fraction !== undefined) {
    return `${groupedInteger || '0'},${parsed.fraction}`
  }

  return groupedInteger
}

export function formatMoneyDisplayValue(rawValue: string) {
  const parsed = parseMoneyInput(rawValue)
  if (parsed.invalid) return removeCurrencySuffix(rawValue)
  if (!parsed.integer && parsed.fraction === undefined) return ''

  const normalizedInteger = groupMoneyInteger(parsed.integer) || '0'
  const normalizedFraction = (parsed.fraction ?? '').padEnd(2, '0').slice(0, 2)

  return `${normalizedInteger},${normalizedFraction} TL`
}

function removeCurrencySuffix(rawValue: string) {
  return rawValue.replace(/\s*TL\s*$/i, '').trim()
}

function parseMoneyInput(rawValue: string): { integer: string; fraction?: string; invalid: boolean } {
  const compact = removeCurrencySuffix(rawValue).replace(/\s+/g, '')
  if (!compact) return { integer: '', invalid: false }
  if (/[^0-9.,]/.test(compact)) return { integer: compact, invalid: true }

  const lastDot = compact.lastIndexOf('.')
  const lastComma = compact.lastIndexOf(',')

  if (lastDot === -1 && lastComma === -1) {
    return { integer: compact.replace(/^0+(?=\d)/, ''), invalid: false }
  }

  if (lastComma === -1 && /^\d{1,3}(?:\.\d{3})+$/.test(compact)) {
    return { integer: compact.replace(/\./g, '').replace(/^0+(?=\d)/, ''), invalid: false }
  }

  const decimalSeparator = lastDot > lastComma ? '.' : ','
  const groupingSeparator = decimalSeparator === '.' ? ',' : '.'
  const separatorIndex = decimalSeparator === '.' ? lastDot : lastComma
  const integerPart = compact.slice(0, separatorIndex)
  const fractionPart = compact.slice(separatorIndex + 1)

  if (fractionPart.length > 2) return { integer: compact, invalid: true }
  if (!/^\d*$/.test(fractionPart)) return { integer: compact, invalid: true }
  if (integerPart.includes(decimalSeparator)) return { integer: compact, invalid: true }
  if (integerPart.includes(groupingSeparator)) {
    const groupingPattern = new RegExp(`^\\d{1,3}(?:\\${groupingSeparator}\\d{3})*$`)
    if (!groupingPattern.test(integerPart)) return { integer: compact, invalid: true }
  }

  const integerDigits = integerPart.replaceAll(groupingSeparator, '')
  if (!/^\d*$/.test(integerDigits)) return { integer: compact, invalid: true }

  return {
    integer: integerDigits.replace(/^0+(?=\d)/, ''),
    fraction: fractionPart,
    invalid: false,
  }
}

function groupMoneyInteger(integer: string) {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function parseDecimalNumber(value: string | null | undefined) {
  if (!value) return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function decimalStringToCents(value: string) {
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(value.trim().replace(',', '.'))
  if (!match) return 0n
  const integerText = match[2]
  if (!integerText) return 0n
  const sign = match[1] ? -1n : 1n
  const fraction = (match[3] ?? '').padEnd(2, '0').slice(0, 2)
  return sign * ((BigInt(integerText) * 100n) + BigInt(fraction || '0'))
}

function centsToDecimalString(cents: bigint) {
  const integer = cents / 100n
  const fraction = cents % 100n
  return `${integer.toString()}.${fraction.toString().padStart(2, '0')}`
}
