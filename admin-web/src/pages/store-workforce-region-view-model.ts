import type { StoreEmployee } from '../features/workforce/api'
import { formatNumber } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import type { NormStaffingStatusKind } from './store-workforce-headcount'
import { getTenureFromDate } from './store-workforce-model'
import type { RegionStoreRow } from './store-workforce-region-model'

export type StoreStatus = NormStaffingStatusKind
export type StatusFilter = 'all' | Exclude<StoreStatus, 'notConfigured'>
export type SortDirection = 'asc' | 'desc'
export type SortKey = 'name' | 'active' | 'norm' | 'status' | 'shortage' | 'turnover'
export type DetailTab = 'history' | 'people' | 'positions'

export type RegionStoreViewModel = RegionStoreRow & {
  activeHeadcount: number | null
  averageTenureMonths: number | null
  managerName: string | null
  normLabel: string
  openHeadcount: number | null
  overHeadcount: number | null
  plannedHeadcount: number | null
  shortageDays: number | null
  status: StoreStatus
  turnover: number | null
}

export const copy = {
  actionColumn: 'Aksiyon',
  activeColumn: 'Aktif personel',
  allStatuses: 'Tüm durumlar',
  averageTenureMetric: 'Ortalama kıdem',
  close: 'Kapat',
  detailAction: 'Detay',
  emptyCopy: 'Bu oturum için mağaza bulunamadı.',
  emptyTitle: 'Mağaza yok',
  exportAction: 'Excel dışa aktar',
  gapMetric: 'Eksik kadro',
  managerBadge: 'Bölge müdürü',
  normActualColumn: 'Norm / Fiili',
  pageSubtitle: 'Mağaza norm dengesi, eksik kadro süresi ve personel görünümü.',
  pageTitle: 'Norm Kadro',
  refreshAction: 'Yenile',
  requestsTab: 'Talep',
  searchAria: 'Mağaza ara',
  searchPlaceholder: 'Mağaza veya müdür ara',
  shortageColumn: 'Eksik gün',
  statusColumn: 'Durum',
  storeColumn: 'Mağaza',
  totalStoresMetric: 'Toplam mağaza',
  turnoverColumn: 'Turnover',
  turnoverMetric: 'Yıl geneli turnover',
  yearAria: 'Güncel görünüm',
} as const

export const statusCopy: Record<
  StoreStatus,
  { helper: string; label: string; tone: 'rose' | 'mint' | 'blue' | 'neutral' }
> = {
  balanced: { helper: 'Norm dengede', label: 'Tam', tone: 'mint' },
  notConfigured: { helper: 'Norm tanımı yok', label: 'Tanımsız', tone: 'neutral' },
  over: { helper: 'Norm üstünde', label: 'Fazla', tone: 'blue' },
  short: { helper: 'Norm altında çalışıyor', label: 'Eksik', tone: 'rose' },
}

export function compareRows(left: RegionStoreViewModel, right: RegionStoreViewModel, key: SortKey) {
  const primary = compareRowsPrimary(left, right, key)
  if (primary !== 0) return primary
  const byName = left.storeLabel.localeCompare(right.storeLabel, 'tr-TR')
  if (byName !== 0) return byName
  return left.storeId.localeCompare(right.storeId)
}

export function formatGapLabel(row: RegionStoreViewModel) {
  if (row.openHeadcount !== null && row.openHeadcount > 0) return `${formatNumber(row.openHeadcount, 'tr')} açık`
  if (row.overHeadcount !== null && row.overHeadcount > 0) return `${formatNumber(row.overHeadcount, 'tr')} fazla`
  if (row.plannedHeadcount === null) return 'Tanımlı değil'
  return 'tam'
}

export function formatNormLabel(input: { actual: number | null; locale: AppLocale; planned: number | null }) {
  const actual = formatNullableNumber(input.actual, input.locale)
  if (input.planned === null) return `Tanımlı değil / ${actual}`
  return `${formatNumber(input.planned, input.locale, { maximumFractionDigits: 1, minimumFractionDigits: 0 })} / ${actual}`
}

export function formatNullableNumber(value: number | null, locale: AppLocale) {
  if (value === null) return '-'
  return formatNumber(value, locale, {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
    minimumFractionDigits: 0,
  })
}

export function formatShortage(row: RegionStoreViewModel) {
  if (row.status !== 'short') return 'Yok'
  if (row.shortageDays === null) return 'Veri yok'
  return `${formatNumber(row.shortageDays, 'tr')} gündür`
}

export function formatTurnover(value: number | null) {
  if (value === null) return 'Veri yok'
  return `%${value.toLocaleString('tr-TR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}`
}

export function getAverageTenureMonths(employees: StoreEmployee[], now: Date) {
  const values = employees
    .map((employee) => getTenureFromDate(employee.assignmentStartDate, now).months)
    .filter((value): value is number => value !== null)
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function resolveManagerName(employees: StoreEmployee[]) {
  const manager = employees.find((employee) => {
    const label = employee.positionName.toLocaleLowerCase('tr-TR')
    return (label.includes('mağaza müdürü') || label.includes('magaza muduru') || label.includes('store manager')) &&
      !label.includes('yard')
  })
  return manager?.displayName ?? null
}

export function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return 'Tarih yok'
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

export function getYearOptions(now: Date) {
  const currentYear = now.getFullYear()
  return [currentYear, currentYear - 1, currentYear - 2].map(String)
}

export function toFiniteNumber(value: string | undefined) {
  if (value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function getUniqueIds(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean))).sort((left, right) => left.localeCompare(right))
}

export function downloadCsv(filename: string, rows: string[][]) {
  const content = rows
    .map((row) =>
      row
        .map((cell) => `"${cell.replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n')
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function statusRank(status: StoreStatus) {
  if (status === 'short') return 0
  if (status === 'balanced') return 1
  if (status === 'over') return 2
  return 3
}

function compareRowsPrimary(left: RegionStoreViewModel, right: RegionStoreViewModel, key: SortKey) {
  if (key === 'name') return left.storeLabel.localeCompare(right.storeLabel, 'tr-TR')
  if (key === 'active') return compareNullable(left.activeHeadcount, right.activeHeadcount)
  if (key === 'norm') return compareNullable(getNormSortValue(left), getNormSortValue(right))
  if (key === 'status') return statusRank(left.status) - statusRank(right.status)
  if (key === 'shortage') return compareNullable(left.shortageDays, right.shortageDays)
  return compareNullable(left.turnover, right.turnover)
}

function compareNullable(left: number | null, right: number | null) {
  const leftValue = left ?? Number.NEGATIVE_INFINITY
  const rightValue = right ?? Number.NEGATIVE_INFINITY
  return leftValue - rightValue
}

function getNormSortValue(row: RegionStoreViewModel) {
  if (row.plannedHeadcount === null) return null
  return (row.openHeadcount ?? 0) - (row.overHeadcount ?? 0)
}
