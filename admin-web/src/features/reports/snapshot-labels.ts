import { formatDate } from '../../lib/format'
import { defaultAppLocale, getIntlLocale, type AppLocale } from '../../lib/i18n'

const monthFormatters: Record<AppLocale, Intl.DateTimeFormat> = {
  tr: new Intl.DateTimeFormat(getIntlLocale('tr'), { month: 'long' }),
  en: new Intl.DateTimeFormat(getIntlLocale('en'), { month: 'long' }),
}

export type SnapshotRunLabelInput = {
  snapshotDate: string
  periodStart: string
  periodEnd: string
}

type SnapshotMonthLabelInput = {
  monthStart: string
  latestSnapshotDate: string
}

function parseDateOnly(input: string) {
  if (input.includes('T')) {
    const date = new Date(input)
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  }

  const [year, month, day] = input.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day)
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function isLastDayOfMonth(date: Date) {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  return date.getDate() === lastDay
}

function capitalizeMonth(input: string, locale: AppLocale) {
  return `${input[0]?.toLocaleUpperCase(getIntlLocale(locale))}${input.slice(1)}`
}

function formatMonthName(input: Date, locale: AppLocale) {
  return capitalizeMonth(monthFormatters[locale].format(input), locale)
}

function formatMonthYear(input: string, locale: AppLocale = defaultAppLocale) {
  const date = parseDateOnly(input)
  const formattedMonth = formatMonthName(date, locale)
  return `${formattedMonth} ${date.getFullYear()}`
}

function formatSnapshotPeriodLabel(
  run: SnapshotRunLabelInput,
  locale: AppLocale = defaultAppLocale,
) {
  const periodStart = parseDateOnly(run.periodStart)
  const periodEnd = parseDateOnly(run.periodEnd)

  if (isSameDay(periodStart, periodEnd)) {
    return locale === 'en' ? 'daily close' : 'günlük kapanış'
  }

  if (
    periodStart.getFullYear() === periodEnd.getFullYear() &&
    periodStart.getMonth() === periodEnd.getMonth() &&
    periodStart.getDate() === 1 &&
    isLastDayOfMonth(periodEnd)
  ) {
    const formattedMonth = formatMonthName(periodStart, locale)
    return locale === 'en' ? `${formattedMonth} monthly close` : `${formattedMonth} aylık kapanış`
  }

  const range = `${formatDate(run.periodStart, locale)} - ${formatDate(run.periodEnd, locale)}`
  return locale === 'en' ? `${range} close` : `${range} kapanış`
}

export function formatSnapshotOptionLabel(
  run: SnapshotRunLabelInput,
  locale: AppLocale = defaultAppLocale,
) {
  const periodLabel = formatSnapshotPeriodLabel(run, locale)
  return locale === 'en'
    ? `${formatDate(run.snapshotDate, locale)} close - ${periodLabel}`
    : `${formatDate(run.snapshotDate, locale)} kapanışı - ${periodLabel}`
}

export function formatSnapshotMonthOptionLabel(
  input: SnapshotMonthLabelInput,
  locale: AppLocale = defaultAppLocale,
) {
  return locale === 'en'
    ? `${formatMonthYear(input.monthStart, locale)} monthly close - latest close ${formatDate(
        input.latestSnapshotDate,
        locale,
      )}`
    : `${formatMonthYear(input.monthStart, locale)} aylık kapanış - son kapanış ${formatDate(
        input.latestSnapshotDate,
        locale,
      )}`
}
