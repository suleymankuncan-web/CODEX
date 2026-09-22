import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck, Store } from 'lucide-react'
import type { AuthSessionSummary } from '../auth/api'
import { getActionStoreIds } from '../auth/authorization'
import {
  getStoreQueryScopeSignature,
  storeChecklistCommandQueryKey,
  storeChecklistVisitPlanRegionsQueryKey,
} from '../auth/store-query-scope'
import { useLocalization } from '../localization/useLocalization'
import { ApiError } from '../../lib/api'
import { getBusinessMonthInputValue } from '../../lib/business-date'
import { getUserFacingErrorMessage } from '../../lib/format'
import { transientQueryRetryOptions } from '../../lib/query-retry'
import { StoreErrorState, StoreLoadingState, StoreSurfacePage } from '../../pages/store-surface-primitives'
import {
  getChecklistCommandCanvas,
  getChecklistVisitPlanRegionOptions,
  type ChecklistCommandRow,
  type ChecklistVisitPlanRegionOption,
} from './api'
import { ChecklistAnnualVisitHistoryLauncher } from './ChecklistAnnualVisitHistoryLauncher'
import { ChecklistWeeklyVisitPlanner } from './ChecklistWeeklyVisitPlanner'
import { ChecklistCommandPeriodPicker } from './ChecklistCommandPeriodPicker'
import { formatChecklistCommandPeriodLabel } from './checklist-command-period'
import { ChecklistOperationalHistoryDrawer } from './ChecklistOperationalHistoryDrawer'
import { ChecklistPlanningRegionPicker } from './ChecklistPlanningRegionPicker'
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
    regionId: string
    period: string
    response: Awaited<ReturnType<typeof getChecklistCommandCanvas>>
  } | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<{
    option: ChecklistVisitPlanRegionOption
    scopeSignature: string
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
  const regionFilters = useMemo(() => ({ query: '', limit: 20, offset: 0 }), [])
  const regionOptionsQuery = useQuery({
    queryKey: storeChecklistVisitPlanRegionsQueryKey(input.authSummary, regionFilters),
    queryFn: () => getChecklistVisitPlanRegionOptions(regionFilters),
    ...transientQueryRetryOptions,
  })
  const defaultRegion = regionOptionsQuery.data?.data.page.total === 1
    ? regionOptionsQuery.data.data.items[0] ?? null
    : null
  const activeRegion: ChecklistVisitPlanRegionOption | null = selectedRegion?.scopeSignature === scopeSignature
    ? selectedRegion.option
    : defaultRegion
  const filters = useMemo(
    () => ({ period, regionId: activeRegion?.regionId ?? '', status: 'all' as const, sort, query, limit: PAGE_SIZE, offset }),
    [activeRegion?.regionId, offset, period, query, sort],
  )
  const commandQuery = useQuery({
    queryKey: storeChecklistCommandQueryKey(input.authSummary, filters),
    queryFn: () => getChecklistCommandCanvas(filters),
    enabled: Boolean(activeRegion || regionOptionsQuery.data?.data.page.total === 0),
    placeholderData: (previousData, previousQuery) => {
      const previousFilters = previousQuery?.queryKey[2] as Record<string, unknown> | undefined
      return previousQuery?.queryKey[1] === scopeSignature
        && previousFilters?.regionId === filters.regionId
        && previousFilters?.period === filters.period
        ? previousData
        : undefined
    },
    ...transientQueryRetryOptions,
  })
  const protectedCommandFailure = commandQuery.error instanceof ApiError
    && (commandQuery.error.status === 401 || commandQuery.error.status === 403)
  const retainedResponse = retainedCommand?.scopeSignature === scopeSignature
    && retainedCommand.regionId === activeRegion?.regionId
    && retainedCommand.period === period
    ? retainedCommand.response
    : undefined
  const commandResponse = protectedCommandFailure
    ? undefined
    : commandQuery.data ?? retainedResponse

  function retainCurrentCommand() {
    if (commandResponse && activeRegion) {
      setRetainedCommand({
        scopeSignature,
        regionId: activeRegion.regionId,
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

  if (!regionOptionsQuery.data && regionOptionsQuery.isLoading) {
    return <StoreLoadingState title={t('storeChecklists.loadingTitle')} description={t('storeChecklists.loadingCopy')} />
  }

  if (!regionOptionsQuery.data && regionOptionsQuery.isError) {
    return (
      <StoreSurfacePage ariaLabel={t('storeChecklists.errorTitle')}>
        <StoreErrorState
          title={locale === 'tr' ? 'Mağaza sorumluluğu alınamadı' : 'Store responsibility unavailable'}
          description={getUserFacingErrorMessage(regionOptionsQuery.error, t('storeChecklists.errorCopy'))}
          action={{ label: t('storeChecklists.retryAction'), onClick: () => void regionOptionsQuery.refetch(), variant: 'outline' }}
        />
      </StoreSurfacePage>
    )
  }

  if (!activeRegion && (regionOptionsQuery.data?.data.page.total ?? 0) > 1) {
    const selectionPeriodLabel = formatChecklistCommandPeriodLabel(period, locale)
    return (
      <StoreSurfacePage ariaLabel={t('storeChecklists.command.title')} className="checklist-command-parity tw:!max-w-[1280px] tw:!gap-4" data-testid="checklist-command-parity">
        <header className="tw:relative tw:z-[1] tw:isolate tw:overflow-visible tw:rounded-[14px] tw:bg-primary tw:px-4 tw:py-4 tw:text-primary-foreground tw:shadow-sm tw:sm:px-5">
          <div aria-hidden className="tw:pointer-events-none tw:absolute tw:inset-0 tw:overflow-hidden tw:rounded-[14px]"><span className="tw:absolute tw:right-3 tw:top-3 tw:size-32 tw:rounded-full tw:border tw:border-white/15" /></div>
          <div className="tw:relative tw:flex tw:flex-col tw:gap-4 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between">
            <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
              <span className="tw:grid tw:size-10 tw:shrink-0 tw:place-items-center tw:rounded-xl tw:border tw:border-white/20 tw:bg-white/10"><ClipboardCheck className="tw:size-5" /></span>
              <div>
                <p className="tw:text-[10px] tw:font-semibold tw:uppercase tw:tracking-[0.16em] tw:text-primary-foreground/70">{selectionPeriodLabel} · {t('storeChecklists.command.eyebrow')}</p>
                <h1 className="tw:mt-0.5 tw:text-xl tw:font-semibold tw:tracking-[-0.025em] tw:sm:text-2xl">{t('storeChecklists.command.title')}</h1>
              </div>
            </div>
            <div className="checklist-command-title-actions tw:[&>*>button]:!border-white/20 tw:[&>*>button]:!bg-white/10 tw:[&>*>button]:!text-white">
              <ChecklistPlanningRegionPicker
                authSummary={input.authSummary}
                locale={locale}
                selected={null}
                onSelect={(option) => { setRetainedCommand(null); setSelectedRegion({ option, scopeSignature }) }}
              />
              <ChecklistCommandPeriodPicker locale={locale} period={period} onChange={changePeriod} />
            </div>
          </div>
        </header>
        <section className="tw:flex tw:min-h-36 tw:flex-col tw:items-center tw:justify-center tw:gap-3 tw:rounded-[14px] tw:border tw:border-dashed tw:border-primary/25 tw:bg-primary/[0.025] tw:p-6 tw:text-center" aria-live="polite">
          <span className="tw:grid tw:size-10 tw:place-items-center tw:rounded-xl tw:bg-primary/10 tw:text-primary"><Store className="tw:size-5" /></span>
          <div>
            <strong className="tw:block tw:text-sm tw:text-foreground">{locale === 'tr' ? 'Mağaza sorumluluğunu seçin' : 'Select store responsibility'}</strong>
            <p className="tw:mt-1 tw:text-xs tw:text-muted-foreground">{locale === 'tr' ? 'Haftalık plan ve checklist mağazaları seçiminize göre açılacak.' : 'The weekly plan and checklist stores will open for your selection.'}</p>
          </div>
        </section>
      </StoreSurfacePage>
    )
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
        annualHistory={activeRegion ? (
          <ChecklistAnnualVisitHistoryLauncher
            authSummary={input.authSummary}
            locale={locale}
            period={period}
            regionId={activeRegion.regionId}
            regionName={activeRegion.regionName}
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
        planner={activeRegion ? (
          <ChecklistWeeklyVisitPlanner
            authSummary={input.authSummary}
            canMaintain={actionStoreIds.size > 0}
            embedded
            locale={locale}
            period={period}
            planningRequest={undefined}
            regionId={activeRegion.regionId}
            regionName={activeRegion.regionName}
            weekStart={weekStart}
            onOpenWorkflow={(storeId) => input.onOpenWorkflow(storeId, 'visits', 'bm')}
            onPlanningRequestHandled={() => undefined}
            onWeekStartChange={changePlanningWeek}
          />
        ) : null}
        regionName={activeRegion?.regionName ?? assignedStoresLabel}
        regionPicker={(regionOptionsQuery.data?.data.page.total ?? 0) > 1 ? (
          <ChecklistPlanningRegionPicker
            authSummary={input.authSummary}
            locale={locale}
            selected={activeRegion}
            onSelect={(option) => {
              setRetainedCommand(null)
              setSelectedRegion({ option, scopeSignature })
              setOffset(0)
            }}
          />
        ) : null}
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
