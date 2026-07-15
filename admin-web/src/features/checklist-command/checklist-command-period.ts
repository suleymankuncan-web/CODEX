export function formatChecklistCommandPeriodLabel(period: string, locale: 'tr' | 'en') {
  const { year, month } = parseChecklistCommandPeriod(period)
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)))
}

export function parseChecklistCommandPeriod(period: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(period)
  if (!match) return { year: 2026, month: 1 }
  return { year: Number(match[1]!), month: Number(match[2]!) }
}
