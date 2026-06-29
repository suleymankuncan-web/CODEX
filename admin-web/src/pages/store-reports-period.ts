export const reportMonthLabels = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
]

export function formatReportPeriodLabel(period: string) {
  const { year, month } = parseReportPeriod(period)
  return `${reportMonthLabels[month - 1]} ${year}`
}

export function formatReportCoverageLabel(input: { period: string; today: Date }) {
  const { year, month } = parseReportPeriod(input.period)
  const todayParts = getIstanbulDateParts(input.today)
  const isCurrentPeriod = todayParts.year === year && todayParts.month === month
  const endDay = isCurrentPeriod ? todayParts.day : new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `1-${endDay} ${reportMonthLabels[month - 1]}`
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
