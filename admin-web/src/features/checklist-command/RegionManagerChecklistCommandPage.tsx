import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { AuthSessionSummary } from '../auth/api'
import { getActionStoreIds } from '../auth/authorization'
import {
  getStoreQueryScopeSignature,
  storeChecklistCommandQueryKey,
} from '../auth/store-query-scope'
import { useLocalization } from '../localization/useLocalization'
import { ApiError } from '../../lib/api'
import { getBusinessMonthInputValue } from '../../lib/business-date'
import { getUserFacingErrorMessage } from '../../lib/format'
import { transientQueryRetryOptions } from '../../lib/query-retry'
import { StoreErrorState, StoreLoadingState, StoreSurfacePage } from '../../pages/store-surface-primitives'
import {
  getChecklistCommandCanvas,
  type ChecklistCommandRow,
} from './api'
import { ChecklistAnnualVisitHistoryLauncher } from './ChecklistAnnualVisitHistoryLauncher'
import { ChecklistWeeklyVisitPlanner } from './ChecklistWeeklyVisitPlanner'
import { ChecklistCommandPeriodPicker } from './ChecklistCommandPeriodPicker'
import { formatChecklistCommandPeriodLabel } from './checklist-command-period'
import { ChecklistOperationalHistoryDrawer } from './ChecklistOperationalHistoryDrawer'
import { RegionManagerChecklistWorkspace } from './RegionManagerChecklistWorkspace'
import {
  getChecklistPeriodWeekStart,
  getIstanbulWeekStart,
  toggleChecklistCommandSort,
  type ChecklistCommandSort,
  type ChecklistCommandSortKey,
} from './model'

const PAGE_SIZE = 30

export function RegionManagerChecklistCommandPage(input: {
  authSummary: AuthSessionSummary | null
  onOpenWorkflow: (storeId: string, tab?: 'visits' | 'inbox' | 'history', directChecklist?: 'bm') => void
  onOpenResult: (checklistInstanceId: string, trigger: HTMLElement | null) => void
}) {
  const { locale, t } = useLocalization()
  const [period, setPeriod] = useState(() => getBusinessMonthInputValue())
  const [sort, setSort] = useState<ChecklistCommandSort>('store_asc')
  const [searchDraft, setSearchDraft] = useState('')
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const actionStoreIds = useMemo(
    () => new Set(getActionStoreIds(input.authSummary)),
    [input.authSummary],
  )
  const [selectedRecordStore, setSelectedRecordStore] = useState<ChecklistCommandRow | null>(null)
  const historyTriggerRef = useRef<HTMLElement | null>(null)
  const [weekStart, setWeekStart] = useState(() => getIstanbulWeekStart())
  const [retainedCommand, setRetainedCommand] = useState<{
    scopeSignature: string
    period: string
    response: Awaited<ReturnType<typeof getChecklistCommandCanvas>>
  } | null>(null)

  const changePeriod = (nextPeriod: string) => {
    setRetainedCommand(null)
    setPeriod(nextPeriod)
    setWeekStart(getChecklistPeriodWeekStart(nextPeriod))
    setOffset(0)
  }
  const changePlanningWeek = (nextWeekStart: string) => {
    setWeekStart(nextWeekStart)
    const nextPeriod = nextWeekStart.slice(0, 7)
    if (nextPeriod !== period) {
      setRetainedCommand(null)
      setPeriod(nextPeriod)
      setOffset(0)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchDraft.trim())
      setOffset(0)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchDraft])

  const scopeSignature = getStoreQueryScopeSignature(input.authSummary)
  const filters = useMemo(
    () => ({ period, status: 'all' as const, sort, query, limit: PAGE_SIZE, offset }),
    [offset, period, query, sort],
  )
  const commandQuery = useQuery({
    queryKey: storeChecklistCommandQueryKey(input.authSummary, filters),
    queryFn: () => getChecklistCommandCanvas(filters),
    placeholderData: (previousData, previousQuery) => {
      const previousFilters = previousQuery?.queryKey[2] as Record<string, unknown> | undefined
      return previousQuery?.queryKey[1] === scopeSignature
        && previousFilters?.period === filters.period
        ? previousData
        : undefined
    },
    ...transientQueryRetryOptions,
  })
  const protectedCommandFailure = commandQuery.error instanceof ApiError
    && (commandQuery.error.status === 401 || commandQuery.error.status === 403)
  const retainedResponse = retainedCommand?.scopeSignature === scopeSignature
    && retainedCommand.period === period
    ? retainedCommand.response
    : undefined
  const commandResponse = protectedCommandFailure
    ? undefined
    : commandQuery.data ?? retainedResponse

  function retainCurrentCommand() {
    if (commandResponse) {
      setRetainedCommand({
        scopeSignature,
        period,
        response: commandResponse,
      })
    }
  }

  function changeSort(key: ChecklistCommandSortKey) {
    retainCurrentCommand()
    setSort((current) => toggleChecklistCommandSort(current, key))
    setOffset(0)
  }

  if (!commandResponse && commandQuery.isLoading) {
    return <StoreLoadingState title={t('storeChecklists.loadingTitle')} description={t('storeChecklists.loadingCopy')} />
  }

  if (!commandResponse) {
    return (
      <StoreSurfacePage ariaLabel={t('storeChecklists.errorTitle')}>
        <StoreErrorState
          title={t('storeChecklists.errorTitle')}
          description={getUserFacingErrorMessage(commandQuery.error, t('storeChecklists.errorCopy'))}
          action={{
            disabled: commandQuery.isFetching,
            label: commandQuery.isFetching ? t('storeChecklists.retryingAction') : t('storeChecklists.retryAction'),
            onClick: () => void commandQuery.refetch(),
            variant: 'outline',
          }}
        />
      </StoreSurfacePage>
    )
  }

  const data = commandResponse.data
  const hasPartialScoreData = data.items.some((row) => row.bmCompletedAt !== null && row.bmScore === null)
  const periodLabel = formatChecklistCommandPeriodLabel(period, locale)
  const pageNumber = Math.floor(offset / PAGE_SIZE) + 1
  const pageCount = Math.max(1, Math.ceil(data.page.total / PAGE_SIZE))
  const assignedStoresLabel = locale === 'tr' ? 'Sorumlu mağazalar' : 'Assigned stores'

  return (
    <StoreSurfacePage
      ariaLabel={t('storeChecklists.command.title')}
      className="checklist-command-parity tw:!max-w-[1280px] tw:!gap-4 tw:!py-1"
      data-testid="checklist-command-parity"
    >
      <RegionManagerChecklistWorkspace
        actionStoreIds={actionStoreIds}
        annualHistory={actionStoreIds.size > 0 ? (
          <ChecklistAnnualVisitHistoryLauncher
            authSummary={input.authSummary}
            locale={locale}
            period={period}
            regionName={assignedStoresLabel}
          />
        ) : null}
        data={data}
        hasPartialScoreData={hasPartialScoreData}
        isError={commandQuery.isError}
        isFetching={commandQuery.isFetching}
        offset={offset}
        pageCount={pageCount}
        pageNumber={pageNumber}
        periodLabel={periodLabel}
        periodPicker={<ChecklistCommandPeriodPicker locale={locale} period={period} onChange={changePeriod} />}
        planner={actionStoreIds.size > 0 ? (
          <ChecklistWeeklyVisitPlanner
            authSummary={input.authSummary}
            canMaintain={actionStoreIds.size > 0}
            embedded
            locale={locale}
            period={period}
            planningRequest={undefined}
            regionName={assignedStoresLabel}
            weekStart={weekStart}
            onOpenWorkflow={(storeId) => input.onOpenWorkflow(storeId, 'visits', 'bm')}
            onPlanningRequestHandled={() => undefined}
            onWeekStartChange={changePlanningWeek}
          />
        ) : null}
        regionName={assignedStoresLabel}
        regionPicker={null}
        searchDraft={searchDraft}
        sort={sort}
        onNextPage={() => { retainCurrentCommand(); setOffset(offset + PAGE_SIZE) }}
        onOpenHistory={(store, trigger) => { historyTriggerRef.current = trigger; setSelectedRecordStore(store) }}
        onOpenWorkflow={input.onOpenWorkflow}
        onPreviousPage={() => { retainCurrentCommand(); setOffset(Math.max(0, offset - PAGE_SIZE)) }}
        onRetry={() => void commandQuery.refetch()}
        onSearchChange={(value) => { retainCurrentCommand(); setSearchDraft(value) }}
        onSort={changeSort}
      />
      <ChecklistOperationalHistoryDrawer
        authSummary={input.authSummary}
        open={Boolean(selectedRecordStore)}
        storeId={selectedRecordStore?.storeId ?? null}
        storeName={selectedRecordStore?.storeName ?? null}
        returnFocusRef={historyTriggerRef}
        onClose={() => setSelectedRecordStore(null)}
        onOpenResult={(checklistInstanceId) => {
          setSelectedRecordStore(null)
          input.onOpenResult(checklistInstanceId, historyTriggerRef.current)
        }}
      />
    </StoreSurfacePage>
  )
}
