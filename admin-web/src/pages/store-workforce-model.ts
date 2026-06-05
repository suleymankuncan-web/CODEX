import type { AppLocale } from '../lib/i18n'
import type {
  OffboardingRequest,
  SellerCodeRequest,
  StoreEmployee,
} from '../features/workforce/api'

export type WorkforceRequestSummary = {
  key: string
  kind: 'sellerCode' | 'offboarding'
  title: string
  subtitle: string
  status: string
  updatedAt: string
}

export function deriveWorkforceSummary(
  employees: StoreEmployee[],
  now: Date,
  locale: AppLocale,
) {
  const missingPositionLabel = locale === 'en' ? 'No position' : 'Pozisyon bilgisi yok'
  const positionCounts = new Map<string, number>()
  let zeroToThreeMonths = 0
  let threeToTwelveMonths = 0
  let oneToThreeYears = 0
  let threePlusYears = 0
  const validTenureMonths: number[] = []
  let missingTenureCount = 0

  for (const employee of employees) {
    const positionLabel = employee.positionName || missingPositionLabel
    positionCounts.set(positionLabel, (positionCounts.get(positionLabel) ?? 0) + 1)

    const tenure = getTenureFromDate(employee.assignmentStartDate, now, locale)
    if (tenure.months === null) {
      missingTenureCount += 1
      continue
    }

    validTenureMonths.push(tenure.months)
    if (tenure.months < 3) {
      zeroToThreeMonths += 1
    } else if (tenure.months < 12) {
      threeToTwelveMonths += 1
    } else if (tenure.months < 36) {
      oneToThreeYears += 1
    } else {
      threePlusYears += 1
    }
  }

  const averageTenureMonths =
    validTenureMonths.length === 0
      ? null
      : validTenureMonths.reduce((sum, value) => sum + value, 0) / validTenureMonths.length

  return {
    averageTenureLabel:
      averageTenureMonths === null
        ? locale === 'en'
          ? 'Cannot calculate'
          : 'Hesaplanamadi'
        : formatTenureLabel(Math.round(averageTenureMonths), locale),
    missingTenureCount,
    positionRows: Array.from(positionCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)),
    tenureBuckets: [
      { key: '0-3', label: '0-3 ay', count: zeroToThreeMonths },
      { key: '3-12', label: '3-12 ay', count: threeToTwelveMonths },
      { key: '1-3', label: '1-3 yil', count: oneToThreeYears },
      { key: '3+', label: '3+ yil', count: threePlusYears },
    ],
  }
}

export function buildWorkforceRequestSummaries(input: {
  offboardingRequests: OffboardingRequest[]
  sellerCodeRequests: SellerCodeRequest[]
}): WorkforceRequestSummary[] {
  const sellerCodeRows = input.sellerCodeRequests.map((item) => ({
    key: `seller:${item.requestId}`,
    kind: 'sellerCode' as const,
    title: `${item.firstName} ${item.lastName}`.trim() || item.requestId,
    subtitle: item.positionName,
    status: item.status,
    updatedAt: item.updatedAt,
  }))
  const offboardingRows = input.offboardingRequests.map((item) => ({
    key: `offboarding:${item.requestId}`,
    kind: 'offboarding' as const,
    title: item.displayName,
    subtitle: item.externalEmployeeRef ?? item.storeName,
    status: item.status,
    updatedAt: item.updatedAt,
  }))

  return [...sellerCodeRows, ...offboardingRows].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  )
}

export function getTenureFromDate(value: string, now: Date, locale: AppLocale = 'tr') {
  const startDate = parseDateOnly(value)
  if (!startDate) {
    return {
      label: locale === 'en' ? 'Cannot calculate' : 'Hesaplanamadi',
      months: null,
    }
  }

  const months = Math.max(0, getCompletedMonthDiff(startDate, now))
  return {
    label: formatTenureLabel(months, locale),
    months,
  }
}

export function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function isClosedWorkforceStatus(status: string) {
  return status === 'approved'
}

function getCompletedMonthDiff(startDate: Date, now: Date) {
  const monthDiff =
    (now.getFullYear() - startDate.getFullYear()) * 12 +
    now.getMonth() -
    startDate.getMonth()
  return now.getDate() < startDate.getDate() ? monthDiff - 1 : monthDiff
}

function formatTenureLabel(months: number, locale: AppLocale = 'tr') {
  if (months < 1) {
    return locale === 'en' ? '<1 mo' : '<1 ay'
  }

  if (months < 12) {
    return locale === 'en' ? `${months} mo` : `${months} ay`
  }

  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  if (remainingMonths === 0) {
    return locale === 'en' ? `${years} yr` : `${years} yil`
  }

  return locale === 'en'
    ? `${years} yr ${remainingMonths} mo`
    : `${years} yil ${remainingMonths} ay`
}
