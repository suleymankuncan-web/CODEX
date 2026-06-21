import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, CircleDollarSign, Target, TrendingUp, UsersRound, WalletCards } from 'lucide-react'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  createStoreSalesTargetIncentiveRegionCorrection,
  getStoreSalesTargetIncentives,
  markStoreSalesTargetIncentiveReview,
  storeSalesTargetIncentivesQueryKey,
  submitStoreSalesTargetIncentiveRegionPackage,
  type SalesTargetIncentiveProjection,
  type SalesTargetIncentiveRegionCorrection,
  type SalesTargetIncentiveResponse,
  type SalesTargetIncentiveRow,
  type StoreSalesTargetIncentiveRegionCorrectionInput,
  type StoreSalesTargetIncentiveReviewInput,
  type StoreSalesTargetIncentiveVoidCorrectionInput,
  voidStoreSalesTargetIncentiveRegionCorrection,
} from '../features/incentives/api'
import { getSalesTargetIncentiveQueryIdentity } from '../features/incentives/query-identity'
import { useLocalization } from '../features/localization/useLocalization'
import { ApiError } from '../lib/api'
import { getErrorMessage } from '../lib/format'
import { transientQueryRetryOptions } from '../lib/query-retry'
import { canOpenStoreIncentives } from '../app/store-navigation'
import {
  formatMoneyValue,
  formatPercentValue,
  getManagerRow,
  getPersonnelRows,
  getPrimaryEarnedAmount,
  getIncentiveStatusLabel,
  getIncentiveStatusTone,
  getRevisionLabel,
} from './store-incentives-model'
import { formatPeriodLabel } from './store-incentives-period-model'
import { PeriodPicker } from './store-incentives-period-picker'
import { RegionManagerIncentivesView } from './store-incentives-region-manager-view'
import {
  IncentiveRateTables,
  StoreIncentiveProjectionCard,
} from './store-incentives-widgets'
import {
  StoreErrorState,
  StoreCommandBar,
  StoreEmptyState,
  StoreFinanceBand,
  StoreMetricCard,
  StoreMetricGrid,
  StoreStepList,
  StoreSurfaceHeader,
  StoreSurfacePage,
  StoreSurfacePanel,
} from './store-surface-primitives'

function canReadStoreIncentives(authSummary: AuthSessionSummary | null) {
  return canOpenStoreIncentives(authSummary)
}

type StoreReviewRollback = {
  attemptedReviewStatus: StoreSalesTargetIncentiveReviewInput['reviewStatus']
  period: string
  previousReview: SalesTargetIncentiveProjection['review']
  storeId: string
}

type RegionCorrectionRollback = {
  attemptedFinalAmount: string
  attemptedReasonNote: string
  employeeId: string
  optimisticCorrectionId: string
  participantType: SalesTargetIncentiveRow['participantType']
  period: string
  previousCorrection: SalesTargetIncentiveRow['regionCorrection']
  storeId: string
}

type VoidCorrectionRollback = {
  correctionId: string
  period: string
  previousCorrection: SalesTargetIncentiveRow['regionCorrection']
}

export function StoreIncentivesPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { locale, t } = useLocalization()
  const queryClient = useQueryClient()
  const enabled = canReadStoreIncentives(input.authSummary)
  const [period, setPeriod] = useState<string | undefined>(undefined)
  const [periodWasSelected, setPeriodWasSelected] = useState(false)
  const [pendingReviewStoreIds, setPendingReviewStoreIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [pendingCorrectionKeys, setPendingCorrectionKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
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
  const readRollbackSource = () =>
    queryClient.getQueryData<SalesTargetIncentiveResponse>(incentivesQueryKey) ??
    (period ? queryClient.getQueryData<SalesTargetIncentiveResponse>(currentIncentivesQueryKey) : undefined)
  const updateIncentiveQueryData = (
    updater: (response: SalesTargetIncentiveResponse) => SalesTargetIncentiveResponse,
  ) => {
    queryClient.setQueryData<SalesTargetIncentiveResponse>(incentivesQueryKey, (current) =>
      current ? updater(current) : current,
    )
    if (period) {
      queryClient.setQueryData<SalesTargetIncentiveResponse>(currentIncentivesQueryKey, (current) =>
        current ? updater(current) : current,
      )
    }
  }

  const reviewMutation = useMutation({
    mutationFn: markStoreSalesTargetIncentiveReview,
    onMutate: async (variables) => {
      setPendingReviewStoreIds((current) => addSetValue(current, variables.storeId))
      await queryClient.cancelQueries({ queryKey: incentivesQueryKey, exact: true })
      if (period) {
        await queryClient.cancelQueries({ queryKey: currentIncentivesQueryKey, exact: true })
      }
      const rollback = buildStoreReviewRollback(readRollbackSource(), variables)
      updateIncentiveQueryData((response) =>
        response.data.period === variables.period ? applyOptimisticStoreReview(response, variables) : response,
      )
      return rollback
    },
    onError: (_error, _variables, rollback) => {
      if (!rollback) return
      updateIncentiveQueryData((response) =>
        response.data.period === rollback.period ? rollbackOptimisticStoreReview(response, rollback) : response,
      )
    },
    onSuccess: invalidateCurrentQuery,
    onSettled: (_data, _error, variables) => {
      if (variables) {
        setPendingReviewStoreIds((current) => removeSetValue(current, variables.storeId))
      }
    },
  })
  const correctionMutation = useMutation({
    mutationFn: createStoreSalesTargetIncentiveRegionCorrection,
    onMutate: async (variables) => {
      setPendingCorrectionKeys((current) => addSetValue(current, getCorrectionPendingKey(variables)))
      await queryClient.cancelQueries({ queryKey: incentivesQueryKey, exact: true })
      if (period) {
        await queryClient.cancelQueries({ queryKey: currentIncentivesQueryKey, exact: true })
      }
      const rollback = buildRegionCorrectionRollback(readRollbackSource(), variables)
      updateIncentiveQueryData((response) =>
        response.data.period === variables.period ? applyOptimisticRegionCorrection(response, variables) : response,
      )
      return rollback
    },
    onError: (_error, _variables, rollback) => {
      if (!rollback) return
      updateIncentiveQueryData((response) =>
        response.data.period === rollback.period ? rollbackOptimisticRegionCorrection(response, rollback) : response,
      )
    },
    onSuccess: invalidateCurrentQuery,
    onSettled: (_data, _error, variables) => {
      if (variables) {
        setPendingCorrectionKeys((current) => removeSetValue(current, getCorrectionPendingKey(variables)))
      }
    },
  })
  const voidCorrectionMutation = useMutation({
    mutationFn: voidStoreSalesTargetIncentiveRegionCorrection,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: incentivesQueryKey, exact: true })
      if (period) {
        await queryClient.cancelQueries({ queryKey: currentIncentivesQueryKey, exact: true })
      }
      const rollback = buildVoidCorrectionRollback(readRollbackSource(), variables)
      updateIncentiveQueryData((response) =>
        response.data.period === variables.period
          ? applyOptimisticVoidRegionCorrection(response, variables.correctionId)
          : response,
      )
      return rollback
    },
    onError: (_error, _variables, rollback) => {
      if (!rollback) return
      updateIncentiveQueryData((response) =>
        response.data.period === rollback.period ? rollbackOptimisticVoidRegionCorrection(response, rollback) : response,
      )
    },
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
        t={t}
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
          pendingReviewStoreIds,
          pendingCorrectionKeys,
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

function addSetValue(current: ReadonlySet<string>, value: string) {
  const next = new Set(current)
  next.add(value)
  return next
}

function removeSetValue(current: ReadonlySet<string>, value: string) {
  const next = new Set(current)
  next.delete(value)
  return next
}

function getCorrectionPendingKey(input: {
  storeId: string
  employeeId: string
  participantType: SalesTargetIncentiveRow['participantType']
}) {
  return `${input.storeId}:${input.employeeId}:${input.participantType}`
}

function StoreIncentivesEmptyPeriod(input: {
  period: string
  onPeriodChange: (period: string) => void
  t: ReturnType<typeof useLocalization>['t']
}) {
  return (
    <StoreSurfacePage
      ariaLabel={input.t('storeIncentives.storeManagerAria')}
      testId="store-incentives-page"
    >
      <StoreCommandBar
        title={input.t('storeIncentives.storeManagerEyebrow')}
        description={input.t('storeIncentives.storeManagerCopy')}
        end={<PeriodPicker period={input.period} onChange={input.onPeriodChange} />}
      />
      <StoreSurfaceHeader
        title={input.t('storeIncentives.storeManagerTitle')}
        description={input.t('storeIncentives.storeManagerCopy')}
        icon={<CircleDollarSign size={23} />}
      />
      <StoreEmptyState
        title={input.t('storeIncentives.emptyTitle')}
        description={input.t('storeIncentives.emptyCopy')}
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
  const managerTotal = sumMoney(managerRows.map(getPrimaryEarnedAmount))
  const personnelTotal = sumMoney(personnelRows.map(getPrimaryEarnedAmount))
  const payableTotal = sumMoney([
    managerTotal,
    personnelTotal,
  ])
  const firstProjection = projections[0] ?? null
  const projectionStatusLabel = firstProjection
    ? getIncentiveStatusLabel(firstProjection.calculationState)
    : input.t('storeIncentives.storeManagerTargetWaiting')

  return (
    <StoreSurfacePage
      ariaLabel={input.t('storeIncentives.storeManagerAria')}
      testId="store-incentives-page"
    >
      <StoreCommandBar
        title={input.t('storeIncentives.storeManagerEyebrow')}
        description={input.t('storeIncentives.storeManagerCopy')}
        end={<PeriodPicker period={input.selectedPeriod} onChange={input.onPeriodChange} />}
      />

      <StoreSurfaceHeader
        title={input.t('storeIncentives.storeManagerTitle')}
        description={input.t('storeIncentives.storeManagerCopy')}
        icon={<CircleDollarSign size={23} />}
        actions={[
          {
            label: input.t('storeIncentives.regionManagerSelectPeriod'),
            icon: <CalendarDays data-icon="inline-start" />,
            onClick: () => undefined,
            variant: 'outline',
          },
        ]}
      />

      <StoreFinanceBand
        label={`${formatPeriodLabel(input.data.period)} hakediş özeti`}
        value={formatMoneyValue(payableTotal, input.locale)}
        description="Mağaza müdürü ve ekip hakedişi aynı dönem üzerinden gösterilir."
        badge={{
          label: projectionStatusLabel,
          tone: firstProjection ? getIncentiveStatusTone(firstProjection.calculationState) : 'neutral',
        }}
        side={(
          <StoreSurfacePanel className="tw:grid tw:content-between tw:gap-4">
            <div>
              <h2 className="tw:text-lg tw:font-semibold tw:text-foreground">Dönem özeti</h2>
              <p className="tw:mt-1 tw:text-xs tw:leading-5 tw:text-muted-foreground">
                Hakediş ay kapanışı sonrası kesinleşir.
              </p>
            </div>
            <StoreStepList
              items={[
                { label: 'Mağaza gerçekleşmesi', value: formatPercentValue(firstProjection?.storeAchievementPct, input.locale) },
                { label: 'Müdür hakedişi', value: managerTotal ? formatMoneyValue(managerTotal, input.locale) : '0,00 TL' },
                { label: 'Ekip hakedişi', value: personnelTotal ? formatMoneyValue(personnelTotal, input.locale) : '0,00 TL' },
              ]}
            />
          </StoreSurfacePanel>
        )}
      />

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
      <StoreCommandBar title="Prim Merkezi" description="Hakediş ekranı hazırlanıyor" />
      <StoreSurfaceHeader
        title={input.title}
        description={input.description}
        icon={<CircleDollarSign size={23} />}
      />
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

function buildStoreReviewRollback(
  response: SalesTargetIncentiveResponse | undefined,
  input: StoreSalesTargetIncentiveReviewInput,
): StoreReviewRollback | null {
  const projection = response?.data.projections.find((item) => item.storeId === input.storeId)
  if (!projection) return null

  return {
    attemptedReviewStatus: input.reviewStatus,
    period: input.period,
    previousReview: projection.review,
    storeId: input.storeId,
  }
}

function buildRegionCorrectionRollback(
  response: SalesTargetIncentiveResponse | undefined,
  input: StoreSalesTargetIncentiveRegionCorrectionInput,
): RegionCorrectionRollback | null {
  const row = findIncentiveRow(response, input)
  if (!row) return null
  const optimisticCorrection = buildOptimisticRegionCorrection(row, input)

  return {
    attemptedFinalAmount: input.finalAmount,
    attemptedReasonNote: input.reasonNote,
    employeeId: input.employeeId,
    optimisticCorrectionId: optimisticCorrection.correctionId,
    participantType: input.participantType,
    period: input.period,
    previousCorrection: row.regionCorrection,
    storeId: input.storeId,
  }
}

function buildVoidCorrectionRollback(
  response: SalesTargetIncentiveResponse | undefined,
  input: StoreSalesTargetIncentiveVoidCorrectionInput,
): VoidCorrectionRollback | null {
  const row = response?.data.projections
    .flatMap((projection) => projection.rows)
    .find((item) => item.regionCorrection?.correctionId === input.correctionId)
  if (!row?.regionCorrection) return null

  return {
    correctionId: input.correctionId,
    period: input.period,
    previousCorrection: row.regionCorrection,
  }
}

function findIncentiveRow(
  response: SalesTargetIncentiveResponse | undefined,
  input: {
    employeeId: string
    participantType: SalesTargetIncentiveRow['participantType']
    storeId: string
  },
) {
  return response?.data.projections
    .find((projection) => projection.storeId === input.storeId)
    ?.rows.find((row) => row.employeeId === input.employeeId && row.participantType === input.participantType) ?? null
}

function applyOptimisticStoreReview(
  response: SalesTargetIncentiveResponse,
  input: StoreSalesTargetIncentiveReviewInput,
): SalesTargetIncentiveResponse {
  const reviewedAt = input.reviewStatus === 'reviewed' ? new Date().toISOString() : null

  return {
    ...response,
    data: {
      ...response.data,
      projections: response.data.projections.map((projection) => {
        if (projection.storeId !== input.storeId) return projection

        return {
          ...projection,
          review: {
            storeReviewStatus: input.reviewStatus,
            reviewedByUserId: projection.review?.reviewedByUserId ?? null,
            reviewedAt,
            periodCloseStatus: projection.review?.periodCloseStatus ?? 'closed',
            workflowLockedReason: projection.review?.workflowLockedReason ?? null,
          },
        }
      }),
    },
  }
}

function rollbackOptimisticStoreReview(
  response: SalesTargetIncentiveResponse,
  input: StoreReviewRollback,
): SalesTargetIncentiveResponse {
  return {
    ...response,
    data: {
      ...response.data,
      projections: response.data.projections.map((projection) => {
        if (
          projection.storeId !== input.storeId ||
          projection.review?.storeReviewStatus !== input.attemptedReviewStatus
        ) {
          return projection
        }

        return {
          ...projection,
          review: input.previousReview,
        }
      }),
    },
  }
}

function applyOptimisticRegionCorrection(
  response: SalesTargetIncentiveResponse,
  input: StoreSalesTargetIncentiveRegionCorrectionInput,
): SalesTargetIncentiveResponse {
  return {
    ...response,
    data: {
      ...response.data,
      projections: response.data.projections.map((projection) => {
        if (projection.storeId !== input.storeId) return projection

        return {
          ...projection,
          rows: projection.rows.map((row) => {
            if (row.employeeId !== input.employeeId || row.participantType !== input.participantType) return row

            return {
              ...row,
              regionCorrection: buildOptimisticRegionCorrection(row, input),
            }
          }),
        }
      }),
    },
  }
}

function rollbackOptimisticRegionCorrection(
  response: SalesTargetIncentiveResponse,
  input: RegionCorrectionRollback,
): SalesTargetIncentiveResponse {
  return {
    ...response,
    data: {
      ...response.data,
      projections: response.data.projections.map((projection) => {
        if (projection.storeId !== input.storeId) return projection

        return {
          ...projection,
          rows: projection.rows.map((row) => {
            if (row.employeeId !== input.employeeId || row.participantType !== input.participantType) {
              return row
            }

            const correction = row.regionCorrection
            if (
              correction?.correctionId !== input.optimisticCorrectionId ||
              correction.finalAmount !== input.attemptedFinalAmount ||
              correction.reasonNote !== input.attemptedReasonNote
            ) {
              return row
            }

            return {
              ...row,
              regionCorrection: input.previousCorrection,
            }
          }),
        }
      }),
    },
  }
}

function applyOptimisticVoidRegionCorrection(
  response: SalesTargetIncentiveResponse,
  correctionId: string,
): SalesTargetIncentiveResponse {
  return {
    ...response,
    data: {
      ...response.data,
      projections: response.data.projections.map((projection) => ({
        ...projection,
        rows: projection.rows.map((row) => {
          if (row.regionCorrection?.correctionId !== correctionId) return row

          return {
            ...row,
            regionCorrection: {
              ...row.regionCorrection,
              status: 'voided',
            },
          }
        }),
      })),
    },
  }
}

function rollbackOptimisticVoidRegionCorrection(
  response: SalesTargetIncentiveResponse,
  input: VoidCorrectionRollback,
): SalesTargetIncentiveResponse {
  return {
    ...response,
    data: {
      ...response.data,
      projections: response.data.projections.map((projection) => ({
        ...projection,
        rows: projection.rows.map((row) => {
          if (
            row.regionCorrection?.correctionId !== input.correctionId ||
            row.regionCorrection.status !== 'voided'
          ) {
            return row
          }

          return {
            ...row,
            regionCorrection: input.previousCorrection,
          }
        }),
      })),
    },
  }
}

function buildOptimisticRegionCorrection(
  row: SalesTargetIncentiveRow,
  input: StoreSalesTargetIncentiveRegionCorrectionInput,
): SalesTargetIncentiveRegionCorrection {
  const beforeAmount = row.regionCorrection?.beforeAmount ?? row.payableAmount ?? row.finalAmount ?? row.rawEarnedAmount ?? '0.00'

  return {
    correctionId:
      row.regionCorrection?.correctionId ??
      `optimistic:${input.storeId}:${input.employeeId}:${input.participantType}`,
    status: 'draft',
    targetScope: 'final_snapshot',
    beforeAmount,
    adjustmentAmount: subtractMoney(input.finalAmount, beforeAmount),
    finalAmount: input.finalAmount,
    reasonNote: input.reasonNote,
    createdByUserId: row.regionCorrection?.createdByUserId ?? 'optimistic',
    createdAt: row.regionCorrection?.createdAt ?? new Date().toISOString(),
    submittedAt: null,
    reviewedAt: null,
    reviewNote: null,
  }
}

function subtractMoney(minuend: string, subtrahend: string) {
  return sumMoney([minuend, `-${subtrahend}`])
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
