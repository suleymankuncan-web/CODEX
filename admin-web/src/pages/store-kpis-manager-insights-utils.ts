/** Shift calendar dates without JavaScript month-end overflow (31 March -> 28 February). */
export function comparisonPeriod(start: string, end: string, months: number) {
  const shift = (value: string) => {
    const [year,month,day] = value.split('-').map(Number)
    const first = new Date(Date.UTC(year!,month!-1+months,1))
    const lastDay = new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate()
    return `${first.getUTCFullYear()}-${String(first.getUTCMonth()+1).padStart(2,'0')}-${String(Math.min(day!,lastDay)).padStart(2,'0')}`
  }
  return { start: shift(start), end: end ? shift(end) : '' }
}
export function metricGrowth(current: number | null, previous: number | null) {
  return current === null || previous === null || previous === 0 || !Number.isFinite(current) || !Number.isFinite(previous) ? null : (current-previous)/Math.abs(previous)*100
}
