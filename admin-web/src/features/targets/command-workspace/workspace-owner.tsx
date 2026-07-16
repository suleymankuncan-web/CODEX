import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { AuthSessionSummary } from '@/features/auth/api'
import { getStoreTargetWorkspace, storeTargetWorkspaceQueryKey } from '../api'
import { mergeTargetWorkspacePages } from './model'
import { RegionManagerTargetCommand } from './region-manager-view'
import { ReportViewerTargetCommand } from './report-viewer-view'
import { TargetCommandFailure, TargetCommandLoading } from './workspace-states'

function currentPeriod() {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Europe/Istanbul' })
    .formatToParts(new Date())
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`
}

export function TargetCommandWorkspaceOwner(input: { authSummary: AuthSessionSummary | null }) {
  const [period, setPeriod] = useState(currentPeriod)
  const historyYear = Number(period.slice(0, 4))
  const user = input.authSummary?.user
  const queryIdentity = storeTargetWorkspaceQueryKey({
    period, historyYear,
    ...(user?.userId ? { actorUserId: user.userId } : {}),
    ...(user?.roleCodes ? { roleCodes: user.roleCodes } : {}),
  })
  const query = useInfiniteQuery({
    queryKey: queryIdentity,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => getStoreTargetWorkspace({ period, historyYear, limit: 50, offset: pageParam }),
    getNextPageParam: (page) => page.data.pagination.hasMore
      ? page.data.pagination.offset + page.data.pagination.limit
      : undefined,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
  const workspace = useMemo(
    () => query.data?.pages.length ? mergeTargetWorkspacePages(query.data.pages) : null,
    [query.data],
  )
  const backgroundError = query.error ? new Error(String(query.error)) : null

  if (!workspace && query.isPending) return <TargetCommandLoading />
  if (!workspace) return <TargetCommandFailure onRetry={() => void query.refetch()} />

  const shared = {
    workspace, period, onPeriodChange: setPeriod,
    isUpdating: query.isFetching && !query.isFetchingNextPage,
    backgroundError,
    hasMore: Boolean(query.hasNextPage), isLoadingMore: query.isFetchingNextPage,
    onLoadMore: () => void query.fetchNextPage(), onRetry: () => void query.refetch(),
  }
  return workspace.view === 'report_viewer'
    ? <ReportViewerTargetCommand {...shared} />
    : <RegionManagerTargetCommand {...shared} queryKey={queryIdentity} />
}
