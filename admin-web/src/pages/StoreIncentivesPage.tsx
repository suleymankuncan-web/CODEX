import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { canOpenStoreIncentives } from '@/app/store-navigation'
import type { AuthSessionSummary } from '@/features/auth/api'
import {
  getStoreSalesTargetIncentiveWorkspace,
  storeSalesTargetIncentiveWorkspaceQueryKey,
} from '@/features/incentives/api'
import { getSalesTargetIncentiveWorkspaceQueryIdentity } from '@/features/incentives/query-identity'
import { RegionManagerIncentivesOwner } from '@/features/incentives/command-workspace/region-manager-owner'
import { ReportViewerIncentivesView } from '@/features/incentives/command-workspace/report-viewer-view'
import type { IncentiveWorkspace } from '@/features/incentives/command-workspace/types'
import { useLocalization } from '@/features/localization/useLocalization'
import {
  CommandCanvasMetricRail,
  CommandCanvasPage,
  CommandCanvasPageHeader,
} from '@/features/store-command-canvas/primitives'
import { resolveCommandCanvasQueryState } from '@/features/store-command-canvas/query-continuity'
import { getUserFacingErrorMessage } from '@/lib/format'
import { transientQueryRetryOptions } from '@/lib/query-retry'

export function StoreIncentivesPage(input: { authSummary: AuthSessionSummary | null }) {
  const { locale, t } = useLocalization()
  const [period, setPeriod] = useState<string | undefined>()
  const enabled = canOpenStoreIncentives(input.authSummary)
  const identity = useMemo(
    () => getSalesTargetIncentiveWorkspaceQueryIdentity(input.authSummary),
    [input.authSummary],
  )
  const queryKey = useMemo(
    () => storeSalesTargetIncentiveWorkspaceQueryKey(period, identity),
    [identity, period],
  )
  const query = useQuery({
    queryKey,
    queryFn: () => getStoreSalesTargetIncentiveWorkspace(period ? { period } : undefined),
    enabled,
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
    ...transientQueryRetryOptions,
  })
  const state = resolveCommandCanvasQueryState({
    data: query.data,
    previousData: query.data,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error : null,
  })

  if (!enabled) {
    return <IncentiveRouteError title={t('storeIncentives.routeUnavailableTitle')} description={t('storeIncentives.routeUnavailableCopy')} />
  }
  if (state.initialLoading || (!state.visibleData && !state.blockingError)) {
    return <IncentiveRouteLoading title={t('storeIncentives.loadingTitle')} description={t('storeIncentives.loadingCopy')} />
  }
  if (state.blockingError || !state.visibleData) {
    return (
      <IncentiveRouteError
        title={t('storeIncentives.errorTitle')}
        description={getUserFacingErrorMessage(state.blockingError, t('storeIncentives.errorCopy'))}
        retryLabel={t('storeIncentives.command.retry')}
        onRetry={() => void query.refetch()}
      />
    )
  }

  const workspace = state.visibleData.data as IncentiveWorkspace
  const shared = {
    workspace,
    queryKey,
    period: period ?? workspace.period,
    onPeriodChange: setPeriod,
    isUpdating: state.isUpdating,
    backgroundError: state.backgroundError,
    locale,
    t,
  }
  return workspace.view === 'report_viewer'
    ? <ReportViewerIncentivesView {...shared} />
    : <RegionManagerIncentivesOwner {...shared} />
}

function IncentiveRouteLoading(input: { title: string; description: string }) {
  return (
    <CommandCanvasPage ariaLabelledBy="incentive-loading-title" className="incentive-command-page">
      <CommandCanvasPageHeader titleId="incentive-loading-title" title={input.title} description={input.description} />
      <CommandCanvasMetricRail ariaLabel={input.title}>
        {[0, 1, 2, 3].map((item) => <Skeleton className="tw:h-20 tw:w-full" key={item} />)}
      </CommandCanvasMetricRail>
      <Skeleton className="tw:h-80 tw:w-full tw:rounded-xl" />
    </CommandCanvasPage>
  )
}

function IncentiveRouteError(input: { title: string; description: string; retryLabel?: string; onRetry?: () => void }) {
  return (
    <CommandCanvasPage ariaLabelledBy="incentive-error-title" className="incentive-command-page">
      <div className="incentive-route-state">
        <span><AlertCircle aria-hidden="true" size={22} /></span>
        <h1 id="incentive-error-title">{input.title}</h1>
        <p>{input.description}</p>
        {input.onRetry ? <Button onClick={input.onRetry} variant="outline">{input.retryLabel}</Button> : null}
      </div>
    </CommandCanvasPage>
  )
}
