export const BUSINESS_TIME_ZONE = 'Europe/Istanbul'

export type BusinessDateParts = {
  year: number
  month: number
  day: number
}

const businessDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function getBusinessDateParts(now: Date = new Date()): BusinessDateParts {
  if (!Number.isFinite(now.getTime())) {
    throw new Error('Invalid business-date instant')
  }

  const values = new Map(
    businessDateFormatter
      .formatToParts(now)
      .filter((part) => part.type === 'year' || part.type === 'month' || part.type === 'day')
      .map((part) => [part.type, Number(part.value)]),
  )

  return {
    year: requireDatePart(values, 'year'),
    month: requireDatePart(values, 'month'),
    day: requireDatePart(values, 'day'),
  }
}

export function getBusinessDateInputValue(now: Date = new Date()) {
  const { year, month, day } = getBusinessDateParts(now)
  return `${year}-${padDatePart(month)}-${padDatePart(day)}`
}

export function getBusinessMonthInputValue(now: Date = new Date()) {
  const { year, month } = getBusinessDateParts(now)
  return `${year}-${padDatePart(month)}`
}

export function addCalendarDaysToDateInput(value: string, days: number) {
  if (!Number.isInteger(days)) {
    throw new Error('Calendar-day offset must be an integer')
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    throw new Error(`Invalid date-only value: ${value}`)
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date-only value: ${value}`)
  }

  date.setUTCDate(date.getUTCDate() + days)
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    padDatePart(date.getUTCMonth() + 1),
    padDatePart(date.getUTCDate()),
  ].join('-')
}

function requireDatePart(parts: Map<string, number>, key: 'year' | 'month' | 'day') {
  const value = parts.get(key)
  if (!Number.isInteger(value)) {
    throw new Error(`Missing ${key} in business-date formatter output`)
  }
  return value as number
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0')
}
