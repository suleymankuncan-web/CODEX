export function parseCalendarDate(value: string | undefined): Date | undefined {
  if (!value || !/^\d{4}-\d{2}(?:-\d{2})?$/.test(value)) return undefined
  const [year, month, day = 1] = value.split('-').map(Number)
  const date = new Date(year!, month! - 1, day)
  return date.getFullYear() === year && date.getMonth() === month! - 1 && date.getDate() === day ? date : undefined
}

export function formatCalendarDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
