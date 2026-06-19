export const monthLabels = [
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

export function parsePeriod(period: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period)
  if (match) {
    return { year: Number(match[1]), month: Number(match[2]) }
  }
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

export function formatPeriodLabel(period: string) {
  const parsed = parsePeriod(period)
  return `${monthLabels[parsed.month - 1]} ${parsed.year}`
}
