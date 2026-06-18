import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ShieldCheck, Store as StoreIcon, WalletCards } from 'lucide-react'
import type { AuthSessionSummary } from '../features/auth/api'
import { hasAnyRole } from '../features/auth/authorization'
import {
  getStoreSalesTargetIncentives,
  storeSalesTargetIncentivesQueryKey,
} from '../features/incentives/api'
import { useLocalization } from '../features/localization/useLocalization'
import { ApiError } from '../lib/api'
import { getErrorMessage } from '../lib/format'
import { transientQueryRetryOptions } from '../lib/query-retry'
import {
  formatMoneyValue,
  formatPercentValue,
  getIncentiveStatusLabel,
  getIncentiveStatusTone,
  getManagerRow,
  getPersonnelRows,
  getPrimaryEarnedAmount,
} from './store-incentives-model'
import {
  IncentiveRateTables,
  StoreIncentiveProjectionCard,
} from './store-incentives-widgets'
import {
  StoreErrorState,
  StoreLoadingState,
  StoreMetricCard,
  StoreMetricGrid,
  StoreSurfaceHeader,
  StoreSurfacePage,
} from './store-surface-primitives'

function canReadStoreIncentives(authSummary: AuthSessionSummary | null) {
  return hasAnyRole(authSummary, ['STORE_MANAGER', 'REGION_MANAGER'])
}

export function StoreIncentivesPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { locale, t } = useLocalization()
  const enabled = canReadStoreIncentives(input.authSummary)
  const incentivesQuery = useQuery({
    queryKey: storeSalesTargetIncentivesQueryKey(),
    queryFn: () => getStoreSalesTargetIncentives(),
    enabled,
    ...transientQueryRetryOptions,
  })

  if (!enabled) {
    return (
      <StoreSurfacePage ariaLabel={t('storeIncentives.heroEyebrow')}>
        <StoreErrorState
          title={t('storeIncentives.routeUnavailableTitle')}
          description={t('storeIncentives.routeUnavailableCopy')}
        />
      </StoreSurfacePage>
    )
  }

  if (incentivesQuery.isLoading) {
    return (
      <StoreLoadingState
        title={t('storeIncentives.loadingTitle')}
        description={t('storeIncentives.loadingCopy')}
      />
    )
  }

  if (incentivesQuery.isError) {
    const isUnavailable =
      incentivesQuery.error instanceof ApiError &&
      (incentivesQuery.error.status === 403 || incentivesQuery.error.status === 404)

    return (
      <StoreSurfacePage ariaLabel={t('storeIncentives.heroEyebrow')}>
        <StoreErrorState
          title={isUnavailable ? t('storeIncentives.routeUnavailableTitle') : t('storeIncentives.errorTitle')}
          description={isUnavailable ? t('storeIncentives.routeUnavailableCopy') : getErrorMessage(incentivesQuery.error)}
        />
      </StoreSurfacePage>
    )
  }

  const response = incentivesQuery.data
  if (!response) {
    return (
      <StoreLoadingState
        title={t('storeIncentives.loadingTitle')}
        description={t('storeIncentives.loadingCopy')}
      />
    )
  }

  const data = response.data
  const projections = data.projections
  const managerRows = projections.map(getManagerRow).filter((row) => row !== null)
  const personnelRows = projections.flatMap(getPersonnelRows)
  const payableTotal = sumMoney([
    ...managerRows.map(getPrimaryEarnedAmount),
    ...personnelRows.map(getPrimaryEarnedAmount),
  ])
  const blockedCount = projections.filter((projection) => projection.calculationState === 'blocked').length
  const noSourceCount = projections.filter((projection) => projection.calculationState === 'no_source').length
  const firstProjection = projections[0] ?? null

  if (projections.length === 0) {
    return (
      <StoreSurfacePage ariaLabel={t('storeIncentives.heroEyebrow')}>
        <StoreErrorState
          title={t('storeIncentives.routeUnavailableTitle')}
          description={t('storeIncentives.routeUnavailableCopy')}
        />
      </StoreSurfacePage>
    )
  }

  return (
    <StoreSurfacePage
      ariaLabel={t('storeIncentives.heroEyebrow')}
      className="tw:mx-auto tw:w-full tw:max-w-7xl"
      testId="store-incentives-page"
    >
      <StoreSurfaceHeader
        eyebrow={t('storeIncentives.heroEyebrow')}
        title={data.roleScope === 'region' ? t('storeIncentives.regionProjectionTitle') : t('storeIncentives.storeProjectionTitle')}
        description={t('storeIncentives.projectionCopy')}
        badges={[
          { label: `Dönem: ${data.period}`, tone: 'neutral' },
          { label: `Kapsam: ${projections.length} mağaza`, tone: 'accent' },
          {
            label: `Durum: ${getIncentiveStatusLabel(firstProjection?.calculationState ?? 'projected')}`,
            tone: getIncentiveStatusTone(firstProjection?.calculationState ?? 'projected'),
          },
        ]}
      />

      <StoreMetricGrid ariaLabel="Prim üst özeti">
        <StoreMetricCard
          title="Toplam hak ediş"
          value={formatMoneyValue(payableTotal, locale)}
          note="Projeksiyon kapanıştan önce değişebilir."
          icon={<WalletCards size={18} />}
          tone="calm"
        />
        <StoreMetricCard
          title="Mağaza gerçekleşmesi"
          value={formatPercentValue(firstProjection?.storeAchievementPct, locale)}
          note={firstProjection?.storeGatePassed ? '%80 kapısı geçildi.' : '%80 kapısı bekliyor.'}
          icon={<ShieldCheck size={18} />}
          tone={firstProjection?.storeGatePassed ? 'calm' : 'warning'}
        />
        <StoreMetricCard
          title="Kapsamdaki personel"
          value={personnelRows.length}
          note="Kasa sorumlusu V1 kapsamına dahil değildir."
          icon={<StoreIcon size={18} />}
          tone="accent"
        />
        <StoreMetricCard
          title="Kaynak durumu"
          value={blockedCount + noSourceCount}
          note="Bloke veya kaynak bekleyen mağaza sayısı."
          icon={<CalendarDays size={18} />}
          tone={blockedCount + noSourceCount > 0 ? 'warning' : 'calm'}
        />
      </StoreMetricGrid>

      <section className="tw:grid tw:gap-4" aria-label="Mağaza prim kırılımları">
        {projections.map((projection) => (
          <StoreIncentiveProjectionCard
            key={projection.storeId}
            locale={locale}
            projection={projection}
            showStoreName={data.roleScope === 'region'}
          />
        ))}
      </section>

      <IncentiveRateTables />
    </StoreSurfacePage>
  )
}

function sumMoney(values: Array<string | null>) {
  let totalCents = 0n

  for (const value of values) {
    if (!value) continue
    totalCents += decimalStringToCents(value)
  }

  const sign = totalCents < 0n ? '-' : ''
  const absolute = totalCents < 0n ? -totalCents : totalCents
  const integer = absolute / 100n
  const cents = absolute % 100n
  return `${sign}${integer.toString()}.${cents.toString().padStart(2, '0')}`
}

function decimalStringToCents(value: string) {
  const trimmed = value.trim()
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(trimmed)
  if (!match) return 0n
  const integerText = match[2]
  if (!integerText) return 0n
  const sign = match[1] ? -1n : 1n
  const integer = BigInt(integerText)
  const fraction = (match[3] ?? '').padEnd(2, '0').slice(0, 2)
  return sign * ((integer * 100n) + BigInt(fraction || '0'))
}
