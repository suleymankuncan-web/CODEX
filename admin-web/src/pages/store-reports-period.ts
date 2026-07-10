import { getIntlLocale, type AppLocale } from '../lib/i18n'

export function getReportMonthLabels(locale: AppLocale, width: 'long' | 'short' = 'long') {
  return Array.from({ length: 12 }, (_, index) => formatReportMonth(index + 1, locale, width))
}

export function formatReportPeriodLabel(period: string, locale: AppLocale) {
  const { year, month } = parseReportPeriod(period)
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

export function formatReportCoverageLabel(input: {
  period: string
  today: Date
  locale: AppLocale
}) {
  const { year, month } = parseReportPeriod(input.period)
  const todayParts = getIstanbulDateParts(input.today)
  const isCurrentPeriod = todayParts.year === year && todayParts.month === month
  const endDay = isCurrentPeriod ? todayParts.day : new Date(Date.UTC(year, month, 0)).getUTCDate()
  return formatReportDayRange({ startDay: 1, endDay, month, locale: input.locale })
}

export function formatSourceReportCoverageLabel(input: {
  coverageLabel: string | null | undefined
  period: string
  locale: AppLocale
}) {
  const match = input.coverageLabel?.match(/(\d+)\s*[-–]\s*(\d+)/)
  if (!match) return input.coverageLabel?.trim() || null

  const { month } = parseReportPeriod(input.period)
  return formatReportDayRange({
    startDay: Number(match[1]),
    endDay: Number(match[2]),
    month,
    locale: input.locale,
  })
}

export function isFutureReportPeriod(input: { period: string; today: Date }) {
  const { year, month } = parseReportPeriod(input.period)
  const todayParts = getIstanbulDateParts(input.today)
  return year > todayParts.year || (year === todayParts.year && month > todayParts.month)
}

export function listReportYearOptions(today: Date) {
  const { year } = getIstanbulDateParts(today)
  return Array.from({ length: 5 }, (_, index) => year - 4 + index)
}

export function getCurrentReportPeriod(today = new Date()) {
  const { year, month } = getIstanbulDateParts(today)
  return `${year}-${String(month).padStart(2, '0')}`
}

export function parseReportPeriod(period: string) {
  const [yearText, monthText] = period.split('-')
  const year = Number(yearText)
  const month = Number(monthText)

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid report period: ${period}`)
  }

  return { year, month }
}

function formatReportMonth(month: number, locale: AppLocale, width: 'long' | 'short') {
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    timeZone: 'UTC',
    month: width,
  }).format(new Date(Date.UTC(2026, month - 1, 1)))
}

function formatReportDayRange(input: {
  startDay: number
  endDay: number
  month: number
  locale: AppLocale
}) {
  const monthLabel = formatReportMonth(input.month, input.locale, 'long')
  return input.locale === 'en'
    ? `${monthLabel} ${input.startDay}–${input.endDay}`
    : `${input.startDay}-${input.endDay} ${monthLabel}`
}

function getIstanbulDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value),
  }
}
