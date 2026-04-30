import { formatDate } from '../../lib/format'

export type SnapshotRunLabelInput = {
  snapshotDate: string
  periodStart: string
  periodEnd: string
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

export function formatSnapshotPeriodLabel(run: SnapshotRunLabelInput) {
  const periodStart = parseDateOnly(run.periodStart)
  const periodEnd = parseDateOnly(run.periodEnd)

  if (isSameDay(periodStart, periodEnd)) {
    return 'günlük snapshot'
  }

  if (
    periodStart.getFullYear() === periodEnd.getFullYear() &&
    periodStart.getMonth() === periodEnd.getMonth() &&
    periodStart.getDate() === 1 &&
    isLastDayOfMonth(periodEnd)
  ) {
    const monthName = new Intl.DateTimeFormat('tr-TR', { month: 'long' }).format(
      periodStart,
    )
    return `${monthName[0]?.toLocaleUpperCase('tr-TR')}${monthName.slice(1)} aylık snapshot`
  }

  return `${formatDate(run.periodStart)} - ${formatDate(run.periodEnd)} snapshot`
}

export function formatSnapshotOptionLabel(run: SnapshotRunLabelInput) {
  return `${formatDate(run.snapshotDate)} kapanışı - ${formatSnapshotPeriodLabel(run)}`
}
