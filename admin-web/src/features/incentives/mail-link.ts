/** Mail links must open the approved month rather than silently showing the current month. */
export function incentivePeriodFromMailLink(search: string): string | undefined {
  const values = new URLSearchParams(search).getAll('period')
  const period = values[0]
  return values.length === 1 && period !== undefined && /^\d{4}-(0[1-9]|1[0-2])$/.test(period) ? period : undefined
}
