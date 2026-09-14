import { getStoreQueryScopeSignature } from '@/features/auth/store-query-scope'
import { getRegionManagerDirectory } from '@/features/org/region-manager-directory'
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { AuthSessionSummary } from '@/features/auth/api'
import { getStoreTargetWorkspace, storeTargetWorkspaceQueryKey } from '../api'
import { mergeTargetWorkspacePages } from './model'
import { RegionManagerTargetCommand } from './region-manager-view'
import { ReportViewerTargetCommand } from './report-viewer-view'
import { StoreManagerTargetCommand } from './store-manager-view'
import { TargetCommandFailure, TargetCommandLoading } from './workspace-states'
import { transientQueryRetryOptions } from '@/lib/query-retry'

function currentPeriod() {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Europe/Istanbul' })
    .formatToParts(new Date())
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`
}

export function TargetCommandWorkspaceOwner(input: { authSummary: AuthSessionSummary | null }) {
  const [period, setPeriod] = useState(currentPeriod)
  const [managerId, setManagerId] = useState('all')
  const [page, setPage] = useState(0)
  const historyYear = Number(period.slice(0, 4))
  const user = input.authSummary?.user
  const viewer = user?.roleCodes.some(role => role === 'REPORT_VIEWER' || role === 'SUPER_ADMIN') ?? false
  const scopeSignature = getStoreQueryScopeSignature(input.authSummary)
  const directory = useQuery({ queryKey: ['org-region-manager-directory', scopeSignature], queryFn: getRegionManagerDirectory, enabled: viewer, staleTime: 30_000, ...transientQueryRetryOptions })
  const managerFilter = viewer && managerId !== 'all' ? { regionManagerUserId: managerId } : {}
  const queryIdentity = storeTargetWorkspaceQueryKey({
    period, historyYear, ...managerFilter,
    ...(user?.userId ? { actorUserId: user.userId } : {}),
    ...(user?.roleCodes ? { roleCodes: user.roleCodes } : {}),
  })
  const query = useInfiniteQuery({
    queryKey: queryIdentity,
    enabled: !viewer,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => getStoreTargetWorkspace({ period, historyYear, ...managerFilter, limit: 50, offset: pageParam }),
    getNextPageParam: (page) => page.data.pagination.hasMore
      ? page.data.pagination.offset + page.data.pagination.limit
      : undefined,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
  const pagedQuery = useQuery({
    queryKey: [...queryIdentity, 'complete'], enabled: viewer,
    queryFn: async () => {
      const pages = []
      for (let offset = 0; ; offset += 100) {
        const result = await getStoreTargetWorkspace({ period, historyYear, ...managerFilter, limit: 100, offset })
        pages.push(result)
        if (!result.data.pagination.hasMore) return { ...result, data: mergeTargetWorkspacePages(pages) }
        if (!result.data.companies.some(company => company.regions.some(region => region.stores.length))) throw new Error('Incomplete target workspace')
      }
    },
    placeholderData: keepPreviousData, staleTime: 30_000,
  })
  const workspace = useMemo(
    () => viewer ? pagedQuery.data?.data ?? null : query.data?.pages.length ? mergeTargetWorkspacePages(query.data.pages) : null,
    [viewer, pagedQuery.data, query.data],
  )
  const activeQuery = viewer ? pagedQuery : query
  const backgroundError = activeQuery.error ? new Error(String(activeQuery.error)) : null

  if (!workspace && activeQuery.isPending) return <TargetCommandLoading />
  if (!workspace) return <TargetCommandFailure onRetry={() => void activeQuery.refetch()} />

  const shared = {
    workspace, period, onPeriodChange: (value: string) => { setPage(0); setPeriod(value) },
    managerSelection: { items: directory.data?.items ?? [], value: managerId, onChange: (value: string) => { setPage(0); setManagerId(value) }, loading: directory.isPending, error: directory.isError, onRetry: () => void directory.refetch() },
    isUpdating: viewer ? pagedQuery.isFetching : query.isFetching && !query.isFetchingNextPage,
    backgroundError,
    hasMore: Boolean(query.hasNextPage), isLoadingMore: query.isFetchingNextPage,
    onLoadMore: () => void query.fetchNextPage(), onRetry: () => void activeQuery.refetch(),
  }
  if (workspace.view === 'report_viewer') return <ReportViewerTargetCommand {...shared} pagination={{ page, onPageChange: setPage, disabled: pagedQuery.isFetching || pagedQuery.isPlaceholderData || pagedQuery.isError }} />
  if (workspace.view === 'store_manager') {
    return (
      <StoreManagerTargetCommand
        workspace={workspace}
        period={period}
        onPeriodChange={setPeriod}
        isUpdating={shared.isUpdating}
        backgroundError={backgroundError}
        onRetry={shared.onRetry}
      />
    )
  }
  return <RegionManagerTargetCommand {...shared} queryKey={queryIdentity} />
}
