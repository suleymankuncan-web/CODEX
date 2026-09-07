export function observationDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function initialObservationRange(today: Date) {
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const from = new Date(to)
  from.setDate(from.getDate() - 29)
  return { from, to }
}

export function validObservationRange(fromDate: string, toDate: string): boolean {
  if (!fromDate || !toDate) return false
  const days = (Date.parse(toDate) - Date.parse(fromDate)) / 86_400_000
  return Number.isFinite(days) && days >= 0 && days < 366
}
