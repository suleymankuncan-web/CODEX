import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Target, TrendingUp, UsersRound, WalletCards } from 'lucide-react'
import type { AuthSessionSummary } from '../features/auth/api'
import { hasAnyRole } from '../features/auth/authorization'
import {
  createStoreSalesTargetIncentiveRegionCorrection,
  getStoreSalesTargetIncentives,
  markStoreSalesTargetIncentiveReview,
  storeSalesTargetIncentivesQueryKey,
  submitStoreSalesTargetIncentiveRegionPackage,
  type SalesTargetIncentiveResponse,
  voidStoreSalesTargetIncentiveRegionCorrection,
} from '../features/incentives/api'
import { getSalesTargetIncentiveQueryIdentity } from '../features/incentives/query-identity'
import { useLocalization } from '../features/localization/useLocalization'
import { ApiError } from '../lib/api'
import { getErrorMessage } from '../lib/format'
import { transientQueryRetryOptions } from '../lib/query-retry'
import {
  formatMoneyValue,
  formatPercentValue,
  getManagerRow,
  getPersonnelRows,
  getPrimaryEarnedAmount,
  getRevisionLabel,
} from './store-incentives-model'
import { PeriodPicker } from './store-incentives-period-picker'
import { RegionManagerIncentivesView } from './store-incentives-region-manager-view'
import {
  IncentiveRateTables,
  StoreIncentiveProjectionCard,
} from './store-incentives-widgets'
import {
  StoreErrorState,
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
  const queryClient = useQueryClient()
  const enabled = canReadStoreIncentives(input.authSummary)
  const [period, setPeriod] = useState<string | undefined>(undefined)
  const [periodWasSelected, setPeriodWasSelected] = useState(false)
  const handlePeriodChange = (nextPeriod: string) => {
    setPeriod(nextPeriod)
    setPeriodWasSelected(true)
  }
  const incentivesQueryIdentity = useMemo(
    () => getSalesTargetIncentiveQueryIdentity(input.authSummary),
    [input.authSummary],
  )
  const incentivesQueryKey = useMemo(
    () => storeSalesTargetIncentivesQueryKey(period, incentivesQueryIdentity),
    [period, incentivesQueryIdentity],
  )
  const currentIncentivesQueryKey = useMemo(
    () => storeSalesTargetIncentivesQueryKey(undefined, incentivesQueryIdentity),
    [incentivesQueryIdentity],
  )
  const incentivesQuery = useQuery({
    queryKey: incentivesQueryKey,
    queryFn: () => getStoreSalesTargetIncentives(period ? { period } : undefined),
    enabled,
    ...transientQueryRetryOptions,
  })
  const invalidateCurrentQuery = () => {
    queryClient.invalidateQueries({ queryKey: incentivesQueryKey, exact: true })
    if (period) {
      queryClient.invalidateQueries({ queryKey: currentIncentivesQueryKey, exact: true })
    }
  }

  const reviewMutation = useMutation({
    mutationFn: markStoreSalesTargetIncentiveReview,
    onSuccess: invalidateCurrentQuery,
  })
  const correctionMutation = useMutation({
    mutationFn: createStoreSalesTargetIncentiveRegionCorrection,
    onSuccess: invalidateCurrentQuery,
  })
  const voidCorrectionMutation = useMutation({
    mutationFn: voidStoreSalesTargetIncentiveRegionCorrection,
    onSuccess: invalidateCurrentQuery,
  })
  const submitPackageMutation = useMutation({
    mutationFn: submitStoreSalesTargetIncentiveRegionPackage,
    onSuccess: invalidateCurrentQuery,
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
      <StoreLoadingShell
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
      <StoreLoadingShell
        title={t('storeIncentives.loadingTitle')}
        description={t('storeIncentives.loadingCopy')}
      />
    )
  }

  const data = response.data
  if (data.projections.length === 0) {
    const canBrowseEmptyPeriod = data.roleScope === 'region' || periodWasSelected
    if (!canBrowseEmptyPeriod) {
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
      <StoreIncentivesEmptyPeriod
        onPeriodChange={handlePeriodChange}
        period={period ?? data.period}
      />
    )
  }

  if (data.roleScope === 'region') {
    return (
      <RegionManagerIncentivesView
        data={data}
        locale={locale}
        mutationState={{
          reviewMutation,
          correctionMutation,
          voidCorrectionMutation,
          submitPackageMutation,
        }}
        onPeriodChange={handlePeriodChange}
        selectedPeriod={period ?? data.period}
      />
    )
  }

  return (
    <StoreManagerIncentivesView
      data={data}
      locale={locale}
      onPeriodChange={handlePeriodChange}
      selectedPeriod={period ?? data.period}
      t={t}
    />
  )
}

function StoreIncentivesEmptyPeriod(input: {
  period: string
  onPeriodChange: (period: string) => void
}) {
  return (
    <StoreSurfacePage
      ariaLabel="Primler"
      className="tw:mx-auto tw:w-full tw:max-w-7xl"
      testId="store-incentives-page"
    >
      <div className="tw:flex tw:flex-col tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-card/85 tw:p-4 tw:shadow-sm tw:md:flex-row tw:md:items-start tw:md:justify-between">
        <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-1">
          <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">Primler</span>
          <h1 className="tw:text-xl tw:font-semibold tw:leading-tight tw:text-foreground tw:md:text-2xl">
            Dönem primleri
          </h1>
          <p className="tw:max-w-3xl tw:text-sm tw:leading-6 tw:text-muted-foreground">
            Seçili dönem için prim kaydı bulunamadı.
          </p>
        </div>
        <PeriodPicker
          period={input.period}
          onChange={input.onPeriodChange}
        />
      </div>
      <StoreErrorState
        title="Prim kaydı bulunamadı"
        description="Başka bir dönem seçerek kayıtları görüntüleyebilirsiniz."
      />
    </StoreSurfacePage>
  )
}

function StoreManagerIncentivesView(input: {
  data: SalesTargetIncentiveResponse['data']
  locale: ReturnType<typeof useLocalization>['locale']
  selectedPeriod: string
  onPeriodChange: (period: string) => void
  t: ReturnType<typeof useLocalization>['t']
}) {
  const projections = input.data.projections
  const managerRows = projections.map(getManagerRow).filter((row) => row !== null)
  const personnelRows = projections.flatMap(getPersonnelRows)
  const payableTotal = sumMoney([
    ...managerRows.map(getPrimaryEarnedAmount),
    ...personnelRows.map(getPrimaryEarnedAmount),
  ])
  const firstProjection = projections[0] ?? null

  return (
    <StoreSurfacePage
      ariaLabel={input.t('storeIncentives.storeManagerAria')}
      className="tw:mx-auto tw:w-full tw:max-w-7xl"
      testId="store-incentives-page"
    >
      <div className="tw:flex tw:flex-col tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-card/85 tw:p-4 tw:shadow-sm tw:md:flex-row tw:md:items-start tw:md:justify-between">
        <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-1">
          <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">
            {input.t('storeIncentives.storeManagerEyebrow')}
          </span>
          <h1 className="tw:text-xl tw:font-semibold tw:leading-tight tw:text-foreground tw:md:text-2xl">
            {input.t('storeIncentives.storeManagerTitle')}
          </h1>
          <p className="tw:max-w-3xl tw:text-sm tw:leading-6 tw:text-muted-foreground">
            {input.t('storeIncentives.storeManagerCopy')}
          </p>
        </div>
        <PeriodPicker
          period={input.selectedPeriod}
          onChange={input.onPeriodChange}
        />
      </div>

      <StoreMetricGrid ariaLabel={input.t('storeIncentives.storeManagerSummaryAria')}>
        <StoreMetricCard
          title={input.t('storeIncentives.storeManagerTotalTitle')}
          value={formatMoneyValue(payableTotal, input.locale)}
          note={input.t('storeIncentives.storeManagerTotalNote')}
          icon={<WalletCards size={18} />}
          tone="calm"
        />
        <StoreMetricCard
          title={input.t('storeIncentives.storeManagerAchievementTitle')}
          value={formatPercentValue(firstProjection?.storeAchievementPct, input.locale)}
          note={firstProjection?.storeGatePassed
            ? input.t('storeIncentives.storeManagerGatePassed')
            : input.t('storeIncentives.storeManagerGateWaiting')}
          icon={<TrendingUp size={18} />}
          tone={firstProjection?.storeGatePassed ? 'calm' : 'warning'}
        />
        <StoreMetricCard
          title={input.t('storeIncentives.storeManagerPersonnelTitle')}
          value={personnelRows.length}
          note={input.t('storeIncentives.storeManagerPersonnelNote')}
          icon={<UsersRound size={18} />}
          tone="accent"
        />
        <StoreMetricCard
          title={input.t('storeIncentives.storeManagerTargetTitle')}
          value={formatMoneyValue(firstProjection?.storeTarget, input.locale)}
          note={firstProjection ? getRevisionLabel(firstProjection) : input.t('storeIncentives.storeManagerTargetWaiting')}
          icon={<Target size={18} />}
          tone={firstProjection?.storeTarget ? 'neutral' : 'warning'}
        />
      </StoreMetricGrid>

      <section className="tw:grid tw:gap-4" aria-label={input.t('storeIncentives.storeManagerBreakdownAria')}>
        {projections.map((projection) => (
          <StoreIncentiveProjectionCard
            key={projection.storeId}
            locale={input.locale}
            projection={projection}
            showStoreName={false}
          />
        ))}
      </section>

      <IncentiveRateTables />
    </StoreSurfacePage>
  )
}

function StoreLoadingShell(input: { title: string; description: string }) {
  return (
    <StoreSurfacePage>
      <StoreSurfaceHeader title={input.title} description={input.description} />
      <StoreMetricGrid>
        {[0, 1, 2, 3].map((item) => (
          <StoreMetricCard
            icon={<WalletCards size={18} />}
            key={item}
            note="Yükleniyor"
            title="Prim"
            value="..."
          />
        ))}
      </StoreMetricGrid>
    </StoreSurfacePage>
  )
}

function sumMoney(values: Array<string | null | undefined>) {
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
  const trimmed = value.trim().replace(',', '.')
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(trimmed)
  if (!match) return 0n
  const integerText = match[2]
  if (!integerText) return 0n
  const sign = match[1] ? -1n : 1n
  const integer = BigInt(integerText)
  const fraction = (match[3] ?? '').padEnd(2, '0').slice(0, 2)
  return sign * ((integer * 100n) + BigInt(fraction || '0'))
}
