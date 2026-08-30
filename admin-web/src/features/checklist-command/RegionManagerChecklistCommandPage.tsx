import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Eye,
  Search,
  Store,
} from 'lucide-react'
import type { AuthSessionSummary } from '../auth/api'
import { getActionStoreIds } from '../auth/authorization'
import {
  getStoreQueryScopeSignature,
  storeChecklistCommandQueryKey,
  storeChecklistVisitPlanRegionsQueryKey,
} from '../auth/store-query-scope'
import { useLocalization } from '../localization/useLocalization'
import { Input } from '../../components/ui/input'
import { ApiError } from '../../lib/api'
import { getBusinessMonthInputValue } from '../../lib/business-date'
import { getUserFacingErrorMessage } from '../../lib/format'
import { transientQueryRetryOptions } from '../../lib/query-retry'
import { cn } from '../../lib/utils'
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
  getChecklistCommandSortLabel,
  toggleChecklistCommandSort,
  type ChecklistCommandSort,
  type ChecklistCommandSortKey,
  type ChecklistCommandStatus,
} from './model'

const PAGE_SIZE = 30

export function RegionManagerChecklistCommandPage(input: {
  authSummary: AuthSessionSummary | null
  onOpenWorkflow: (storeId: string, tab?: 'visits' | 'inbox' | 'history', directChecklist?: 'bm') => void
  onOpenResult: (checklistInstanceId: string) => void
  readOnlyPreview?: {
    embedded?: boolean
    initialPeriod: string
    managerName: string
    mode?: 'full' | 'stores'
    onBack?: () => void
    regionId: string
    regionName: string
  }
}) {
  const { locale, t } = useLocalization()
  const storesOnly = input.readOnlyPreview?.mode === 'stores'
  const [period, setPeriod] = useState(() => input.readOnlyPreview?.initialPeriod ?? getBusinessMonthInputValue())
  const [status, setStatus] = useState<ChecklistCommandStatus>('all')
  const [sort, setSort] = useState<ChecklistCommandSort>('store_asc')
  const [searchDraft, setSearchDraft] = useState('')
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const actionStoreIds = useMemo(
    () => input.readOnlyPreview ? new Set<string>() : new Set(getActionStoreIds(input.authSummary)),
    [input.authSummary, input.readOnlyPreview],
  )
  const [selectedRecordStore, setSelectedRecordStore] = useState<ChecklistCommandRow | null>(null)
  const historyTriggerRef = useRef<HTMLElement | null>(null)
  const [weekStart, setWeekStart] = useState(() => getIstanbulWeekStart())
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
    enabled: !input.readOnlyPreview,
    ...transientQueryRetryOptions,
  })
  const defaultRegion = regionOptionsQuery.data?.data.page.total === 1
    ? regionOptionsQuery.data.data.items[0] ?? null
    : null
  const activeRegion: ChecklistVisitPlanRegionOption | null = input.readOnlyPreview
    ? { regionId: input.readOnlyPreview.regionId, regionName: input.readOnlyPreview.regionName }
    : selectedRegion?.scopeSignature === scopeSignature ? selectedRegion.option : defaultRegion
  const filters = useMemo(
    () => ({ period, regionId: activeRegion?.regionId ?? '', status, sort, query, limit: PAGE_SIZE, offset }),
    [activeRegion?.regionId, offset, period, query, sort, status],
  )
  const commandQuery = useQuery({
    queryKey: storeChecklistCommandQueryKey(input.authSummary, filters),
    queryFn: () => getChecklistCommandCanvas(filters),
    enabled: Boolean(activeRegion),
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

  function selectStatus(nextStatus: ChecklistCommandStatus) {
    retainCurrentCommand()
    setStatus((current) => current === nextStatus && nextStatus !== 'all' ? 'all' : nextStatus)
    setOffset(0)
  }

  function changeSort(key: ChecklistCommandSortKey) {
    retainCurrentCommand()
    setSort((current) => toggleChecklistCommandSort(current, key))
    setOffset(0)
  }

  if (!input.readOnlyPreview && !regionOptionsQuery.data && regionOptionsQuery.isLoading) {
    return <StoreLoadingState title={t('storeChecklists.loadingTitle')} description={t('storeChecklists.loadingCopy')} />
  }

  if (!input.readOnlyPreview && !regionOptionsQuery.data && regionOptionsQuery.isError) {
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

  if (!input.readOnlyPreview && !activeRegion && (regionOptionsQuery.data?.data.page.total ?? 0) > 1) {
    const selectionPeriodLabel = formatChecklistCommandPeriodLabel(period, locale)
    return (
      <StoreSurfacePage ariaLabel={t('storeChecklists.command.title')} className="checklist-command-parity tw:!max-w-[1280px] tw:!gap-4" data-testid="checklist-command-parity">
        <header className="tw:relative tw:overflow-hidden tw:rounded-[14px] tw:bg-primary tw:px-4 tw:py-4 tw:text-primary-foreground tw:shadow-sm tw:sm:px-5">
          <div aria-hidden className="tw:pointer-events-none tw:absolute tw:right-3 tw:top-3 tw:size-32 tw:rounded-full tw:border tw:border-white/15" />
          <div className="tw:relative tw:flex tw:flex-col tw:gap-4 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between">
            <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
              <span className="tw:grid tw:size-10 tw:shrink-0 tw:place-items-center tw:rounded-xl tw:border tw:border-white/20 tw:bg-white/10"><ClipboardCheck className="tw:size-5" /></span>
              <div><p className="tw:text-[10px] tw:font-semibold tw:uppercase tw:tracking-[0.16em] tw:text-primary-foreground/70">{selectionPeriodLabel} · {t('storeChecklists.command.eyebrow')}</p><h1 className="tw:mt-0.5 tw:text-xl tw:font-semibold tw:tracking-[-0.025em] tw:sm:text-2xl">{t('storeChecklists.command.title')}</h1></div>
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
          <div><strong className="tw:block tw:text-sm tw:text-foreground">{locale === 'tr' ? 'Mağaza sorumluluğunu seçin' : 'Select store responsibility'}</strong><p className="tw:mt-1 tw:text-xs tw:text-muted-foreground">{locale === 'tr' ? 'Haftalık plan ve checklist mağazaları seçiminize göre açılacak.' : 'The weekly plan and checklist stores will open for your selection.'}</p></div>
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
  const firstItem = data.page.total === 0 ? 0 : data.page.offset + 1
  const lastItem = Math.min(data.page.total, data.page.offset + data.items.length)
  const periodLabel = formatChecklistCommandPeriodLabel(period, locale)
  const metrics: Array<{
    key: ChecklistCommandStatus
    label: string
    note: string
    value: number
    icon: typeof Store
    tone: 'plum' | 'danger' | 'active' | 'done'
  }> = [
    {
      key: 'all',
      label: t('storeChecklists.command.totalStores'),
      note: t('storeChecklists.command.totalStoresNote'),
      value: data.metrics.totalStores,
      icon: Store,
      tone: 'plum',
    },
    {
      key: 'needs_visit',
      label: t('storeChecklists.command.needsVisit'),
      note: t('storeChecklists.command.needsVisitNote'),
      value: data.metrics.needsVisit,
      icon: CircleAlert,
      tone: 'danger',
    },
    {
      key: 'active',
      label: t('storeChecklists.command.active'),
      note: t('storeChecklists.command.activeNote'),
      value: data.metrics.active,
      icon: Clock3,
      tone: 'active',
    },
    {
      key: 'completed',
      label: t('storeChecklists.command.completed'),
      note: t('storeChecklists.command.completedNote'),
      value: data.metrics.completed,
      icon: CheckCircle2,
      tone: 'done',
    },
  ]

  const pageNumber = Math.floor(offset / PAGE_SIZE) + 1
  const pageCount = Math.max(1, Math.ceil(data.page.total / PAGE_SIZE))

  if (!input.readOnlyPreview && activeRegion) {
    return (
      <StoreSurfacePage
        ariaLabel={t('storeChecklists.command.title')}
        className="checklist-command-parity tw:!max-w-[1280px] tw:!gap-4 tw:!py-1"
        data-testid="checklist-command-parity"
      >
        <RegionManagerChecklistWorkspace
          actionStoreIds={actionStoreIds}
          annualHistory={(
            <ChecklistAnnualVisitHistoryLauncher
              authSummary={input.authSummary}
              locale={locale}
              period={period}
              regionId={activeRegion.regionId}
              regionName={activeRegion.regionName}
            />
          )}
          data={data}
          hasPartialScoreData={hasPartialScoreData}
          isError={commandQuery.isError}
          isFetching={commandQuery.isFetching}
          offset={offset}
          pageCount={pageCount}
          pageNumber={pageNumber}
          periodLabel={periodLabel}
          periodPicker={<ChecklistCommandPeriodPicker locale={locale} period={period} onChange={changePeriod} />}
          planner={(
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
          )}
          regionName={activeRegion.regionName}
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
            input.onOpenResult(checklistInstanceId)
          }}
        />
      </StoreSurfacePage>
    )
  }

  return (
    <StoreSurfacePage ariaLabel={t('storeChecklists.command.title')} className={cn('checklist-command-parity', input.readOnlyPreview?.embedded && 'tw:py-0', storesOnly && 'checklist-command-stores-only')} data-testid="checklist-command-parity">
      {input.readOnlyPreview && !storesOnly && !input.readOnlyPreview.embedded && input.readOnlyPreview.onBack ? (
        <section className="tw:flex tw:min-w-0 tw:flex-col tw:gap-3 tw:rounded-2xl tw:border tw:border-primary/15 tw:bg-primary/[0.035] tw:p-3 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between" aria-label={locale === 'tr' ? 'Report Viewer önizlemesi' : 'Report Viewer preview'}>
          <button type="button" className="tw:inline-flex tw:min-h-9 tw:w-fit tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-border tw:bg-background tw:px-3 tw:text-xs tw:font-semibold tw:text-foreground tw:transition-colors tw:hover:bg-muted/50 tw:active:translate-y-px" onClick={input.readOnlyPreview.onBack}>
            <ArrowLeft className="tw:size-4" /> {locale === 'tr' ? 'Bölge müdürlerine dön' : 'Back to region managers'}
          </button>
          <div className="tw:min-w-0 tw:sm:text-right">
            <strong className="tw:block tw:truncate tw:text-sm tw:text-foreground">{input.readOnlyPreview.managerName}</strong>
            <small className="tw:text-[10px] tw:font-medium tw:text-muted-foreground">{locale === 'tr' ? 'Bölge Müdürü görünümü, salt okunur' : 'Region Manager view, read only'}</small>
          </div>
        </section>
      ) : null}
      {!storesOnly ? (
        <header className={input.readOnlyPreview?.embedded
          ? 'tw:flex tw:flex-col tw:gap-3 tw:pb-3 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between'
          : 'checklist-command-title'}>
          <div>
            <p className="tw:text-[10px] tw:font-bold tw:uppercase tw:tracking-[0.14em] tw:text-muted-foreground">
              {periodLabel} · {activeRegion?.regionName ?? t('storeChecklists.command.eyebrow')}
            </p>
            <h1 className="tw:mt-1 tw:text-2xl tw:font-semibold tw:tracking-[-0.035em] tw:text-foreground tw:sm:text-3xl">
              {t('storeChecklists.command.title')}
            </h1>
          </div>
          <div className="checklist-command-title-actions">
            {!input.readOnlyPreview && (regionOptionsQuery.data?.data.page.total ?? 0) > 1 ? (
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
            {activeRegion ? (
              <ChecklistAnnualVisitHistoryLauncher
                authSummary={input.authSummary}
                locale={locale}
                period={period}
                regionId={activeRegion.regionId}
                regionName={activeRegion.regionName}
              />
            ) : null}
            <ChecklistCommandPeriodPicker locale={locale} period={period} onChange={changePeriod} />
          </div>
        </header>
      ) : null}

      {!storesOnly && regionOptionsQuery.isError ? (
        <button type="button" className="checklist-region-inline-error" onClick={() => void regionOptionsQuery.refetch()}>
          {locale === 'tr' ? 'Mağaza sorumluluğu alınamadı · Yeniden dene' : 'Store responsibility unavailable · Retry'}
        </button>
      ) : null}

      {!storesOnly && activeRegion ? (
        <section className="checklist-command-unified-plan" aria-label={locale === 'tr' ? 'Haftalık ziyaret planı' : 'Weekly visit plan'}>
          <ChecklistWeeklyVisitPlanner
            authSummary={input.authSummary}
            canMaintain={!input.readOnlyPreview && data.capabilities.canMaintainWeeklyVisitPlan}
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
        </section>
      ) : null}

      {!storesOnly ? <section aria-label={t('storeChecklists.summaryAria')} className="checklist-command-metrics tw:relative tw:grid tw:grid-cols-2 tw:overflow-hidden tw:lg:grid-cols-4" data-testid="checklist-command-metrics">
        <span aria-hidden className="tw:absolute tw:inset-x-0 tw:top-0 tw:h-[3px] tw:bg-gradient-to-r tw:from-primary tw:via-blue-500 tw:to-cyan-500" />
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <button
              type="button"
              key={metric.key}
              aria-pressed={status === metric.key}
              className={cn(
                'checklist-command-metric tw:grid tw:min-h-24 tw:grid-cols-[30px_minmax(0,1fr)] tw:items-center tw:gap-2 tw:border-b tw:border-border tw:p-3 tw:text-left tw:transition-colors tw:hover:bg-muted/30 tw:[&:nth-child(even)]:border-l tw:sm:grid-cols-[34px_1fr_auto] tw:sm:gap-2.5 tw:sm:p-4 tw:lg:min-h-[106px] tw:lg:border-b-0 tw:lg:border-l tw:lg:first-of-type:border-l-0',
                status === metric.key && 'tw:bg-primary/[0.045]',
              )}
              onClick={() => selectStatus(metric.key)}
            >
              <span className={cn('checklist-command-metric-icon tw:grid tw:size-8 tw:place-items-center tw:rounded-lg', `tone-${metric.tone}`, metricToneClasses[metric.tone])}>
                <Icon className="tw:size-4" />
              </span>
              <span className="checklist-command-metric-copy tw:grid tw:min-w-0 tw:gap-1">
                <span className="tw:text-[10px] tw:font-semibold tw:text-muted-foreground">{metric.label}</span>
                <small className="tw:text-[9px] tw:text-muted-foreground/75">{metric.note}</small>
              </span>
              <strong className="tw:col-span-2 tw:text-right tw:text-xl tw:font-semibold tw:tabular-nums tw:text-foreground tw:sm:col-span-1 tw:sm:text-2xl">{metric.value}</strong>
            </button>
          )
        })}
      </section> : null}

      <section className="checklist-command-surface tw:overflow-hidden" data-testid="checklist-command-surface">
        <div className="checklist-command-toolbar tw:flex tw:flex-col tw:gap-2 tw:border-b tw:border-border tw:p-3 tw:sm:flex-row tw:sm:items-center">
          <label className="tw:flex tw:min-h-9 tw:min-w-0 tw:flex-1 tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-input tw:bg-muted/20 tw:px-3 tw:text-muted-foreground tw:sm:max-w-sm">
            <Search className="tw:size-4 tw:shrink-0" />
            <Input
              aria-label={t('storeChecklists.command.search')}
              className="tw:h-auto tw:border-0 tw:bg-transparent tw:p-0 tw:text-center tw:text-xs tw:leading-5 tw:shadow-none tw:focus-visible:ring-0"
              placeholder={t('storeChecklists.command.search')}
              value={searchDraft}
              onChange={(event) => { retainCurrentCommand(); setSearchDraft(event.target.value) }}
            />
          </label>
          {commandQuery.isFetching ? <small className="checklist-command-inline-refresh" aria-live="polite">{locale === 'tr' ? 'Güncelleniyor…' : 'Refreshing…'}</small> : null}
          {commandQuery.isError ? <button type="button" className="checklist-command-inline-error" onClick={() => void commandQuery.refetch()}>{locale === 'tr' ? 'Veriler yenilenemedi · Tekrar dene' : 'Refresh failed · Retry'}</button> : null}
        </div>
        {hasPartialScoreData ? <div className="checklist-command-partial-notice" role="status"><CircleAlert size={13} /><span>{t('storeChecklists.command.partialScoreNotice')}</span></div> : null}

        {data.items.length === 0 ? (
          <div className="tw:grid tw:min-h-52 tw:place-items-center tw:p-8 tw:text-center">
            <div>
              <strong className="tw:text-sm tw:text-foreground">{t('storeChecklists.command.emptyTitle')}</strong>
              <p className="tw:mt-1 tw:max-w-md tw:text-xs tw:leading-5 tw:text-muted-foreground">{t('storeChecklists.command.emptyCopy')}</p>
            </div>
          </div>
        ) : (
          <>
            <ChecklistCommandDesktopTable
              actionStoreIds={actionStoreIds}
              locale={locale}
              rows={data.items}
              sort={sort}
              t={t}
              onOpenHistory={(store, trigger) => { historyTriggerRef.current = trigger; setSelectedRecordStore(store) }}
              onOpenWorkflow={input.onOpenWorkflow}
              onSort={changeSort}
            />
            <ChecklistCommandMobileCards
              actionStoreIds={actionStoreIds}
              locale={locale}
              rows={data.items}
              t={t}
              onOpenHistory={(store, trigger) => { historyTriggerRef.current = trigger; setSelectedRecordStore(store) }}
              onOpenWorkflow={input.onOpenWorkflow}
            />
          </>
        )}

        <footer className="checklist-command-pagination">
          <span>
            {t('storeChecklists.command.page', { start: firstItem, end: lastItem, total: data.page.total })}
          </span>
          <div>
            <button type="button" aria-label={t('storeChecklists.command.previous')} disabled={offset === 0 || commandQuery.isFetching} onClick={() => { retainCurrentCommand(); setOffset(Math.max(0, offset - PAGE_SIZE)) }}><ChevronLeft size={14} /></button>
            <small>{pageNumber} / {pageCount}</small>
            <button type="button" aria-label={t('storeChecklists.command.next')} disabled={!data.page.hasMore || commandQuery.isFetching} onClick={() => { retainCurrentCommand(); setOffset(offset + PAGE_SIZE) }}><ChevronRight size={14} /></button>
          </div>
        </footer>
      </section>
      <ChecklistOperationalHistoryDrawer
        authSummary={input.authSummary}
        open={Boolean(selectedRecordStore)}
        storeId={selectedRecordStore?.storeId ?? null}
        storeName={selectedRecordStore?.storeName ?? null}
        returnFocusRef={historyTriggerRef}
        onClose={() => setSelectedRecordStore(null)}
        onOpenResult={(checklistInstanceId) => {
          setSelectedRecordStore(null)
          input.onOpenResult(checklistInstanceId)
        }}
      />
    </StoreSurfacePage>
  )
}

const metricToneClasses = {
  active: 'tw:bg-blue-500/10 tw:text-blue-600',
  danger: 'tw:bg-destructive/10 tw:text-destructive',
  done: 'tw:bg-emerald-500/10 tw:text-emerald-600',
  plum: 'tw:bg-primary/10 tw:text-primary',
}

function ChecklistCommandDesktopTable(input: {
  actionStoreIds: ReadonlySet<string>
  locale: 'tr' | 'en'
  rows: ChecklistCommandRow[]
  sort: ChecklistCommandSort
  t: ReturnType<typeof useLocalization>['t']
  onOpenHistory: (store: ChecklistCommandRow, trigger: HTMLElement) => void
  onOpenWorkflow: (storeId: string, tab?: 'visits' | 'inbox' | 'history', directChecklist?: 'bm') => void
  onSort: (key: ChecklistCommandSortKey) => void
}) {
  const heading = (label: string, key: ChecklistCommandSortKey) => (
    <button type="button" className="tw:border-0 tw:bg-transparent tw:p-0 tw:text-left tw:font-[inherit] tw:tracking-[inherit] tw:text-[inherit] tw:uppercase" onClick={() => input.onSort(key)}>
      {getChecklistCommandSortLabel(label, key, input.sort)}
    </button>
  )
  return (
    <div className="checklist-command-desktop-list">
      <div className="checklist-command-table-head columns-all">
        {heading(input.t('storeChecklists.command.store'), 'store')}
        {heading(input.locale === 'tr' ? 'PUAN' : 'SCORE', 'bm')}
        {heading(input.t('storeChecklists.command.visit'), 'last_visit')}
        {heading(input.t('storeChecklists.command.elapsed'), 'elapsed')}
        {heading(input.t('storeChecklists.status'), 'status')}
        <span />
      </div>
      {input.rows.map((row) => (
        <div key={row.storeId} data-testid="checklist-command-row" className={cn('checklist-command-row columns-all', row.status === 'needs_visit' && 'tone-late')}>
          <StoreIdentity row={row} />
          <ChecklistScore className="score-bm" value={row.bmScore} completedAt={row.bmCompletedAt} t={input.t} />
          <VisitDate className="visit-date" value={row.lastCompletedVisitAt} locale={input.locale} t={input.t} />
          <ElapsedDays className="elapsed-days" value={row.elapsedDaysSinceLastVisit} t={input.t} />
          <StatusPill locale={input.locale} row={row} />
          <div className="checklist-command-row-actions">
            <button type="button" className="checklist-command-action is-secondary" onClick={(event) => input.onOpenHistory(row, event.currentTarget)}><Eye size={13} />{input.locale === 'tr' ? 'Sonuçlar' : 'Results'}</button>
            {input.actionStoreIds.has(row.storeId) ? <button type="button" className="checklist-command-action is-primary" onClick={() => input.onOpenWorkflow(row.storeId, getPrimaryWorkflowTab(row, true), getDirectChecklist(true))}>
              {getRowActionLabel(row, input.locale)} <ChevronRight size={14} />
            </button> : null}
          </div>
        </div>
      ))}
    </div>
  )
}

function ChecklistCommandMobileCards(input: {
  actionStoreIds: ReadonlySet<string>
  locale: 'tr' | 'en'
  rows: ChecklistCommandRow[]
  t: ReturnType<typeof useLocalization>['t']
  onOpenHistory: (store: ChecklistCommandRow, trigger: HTMLElement) => void
  onOpenWorkflow: (storeId: string, tab?: 'visits' | 'inbox' | 'history', directChecklist?: 'bm') => void
}) {
  return (
    <div className="checklist-command-mobile-list">
      {input.rows.map((row) => (
        <article key={row.storeId} className={cn('checklist-command-mobile-card', row.status === 'needs_visit' && 'tone-late')}>
          <StoreIdentity row={row} />
          <div className="checklist-command-mobile-scores">
            <ChecklistScore className="score-bm" value={row.bmScore} completedAt={row.bmCompletedAt} t={input.t} />
          </div>
          <div className="checklist-command-mobile-visit">
            <VisitDate value={row.lastCompletedVisitAt} locale={input.locale} t={input.t} />
            <ElapsedDays value={row.elapsedDaysSinceLastVisit} t={input.t} />
          </div>
          <StatusPill locale={input.locale} row={row} />
          <div className="checklist-command-row-actions">
            <button type="button" className="checklist-command-action is-secondary" onClick={(event) => input.onOpenHistory(row, event.currentTarget)}><Eye size={13} />{input.locale === 'tr' ? 'Sonuçlar' : 'Results'}</button>
            {input.actionStoreIds.has(row.storeId) ? <button type="button" className="checklist-command-action is-primary" onClick={() => input.onOpenWorkflow(row.storeId, getPrimaryWorkflowTab(row, true), getDirectChecklist(true))}>{getRowActionLabel(row, input.locale)} <ChevronRight size={14} /></button> : null}
          </div>
        </article>
      ))}
    </div>
  )
}

function StoreIdentity({ row }: { row: ChecklistCommandRow }) {
  return <span className="tw:grid tw:min-w-0"><strong className="tw:truncate tw:text-xs tw:text-foreground">{row.storeName}</strong></span>
}

function ChecklistScore(input: { className?: string; completedAt: string | null; value: number | null; t: ReturnType<typeof useLocalization>['t'] }) {
  if (input.value === null && input.completedAt) return <span className={cn('checklist-command-score is-partial', input.className)}>{input.t('storeChecklists.command.scoreUnavailable')}</span>
  if (input.value === null) return <span className={cn('checklist-command-score is-missing', input.className)}>{input.t('storeChecklists.command.notDone')}</span>
  return <span className={cn('checklist-command-score is-done', input.className)}><strong>{Math.round(input.value)}</strong><small>{input.t('storeChecklists.command.points')}</small></span>
}

function VisitDate(input: { className?: string; value: string | null; locale: 'tr' | 'en'; t: ReturnType<typeof useLocalization>['t'] }) {
  if (!input.value) return <span className={cn('checklist-command-date', input.className)}>{input.t('storeChecklists.command.neverVisited')}</span>
  return <span className={cn('checklist-command-date', input.className)}><strong>{new Intl.DateTimeFormat(input.locale === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul' }).format(new Date(input.value))}</strong><small>{input.t('storeChecklists.command.lastCompleted')}</small></span>
}

function ElapsedDays(input: { className?: string; value: number | null; t: ReturnType<typeof useLocalization>['t'] }) {
  return <span className={cn('checklist-command-elapsed', input.className)}><strong>{input.value === null ? '—' : input.t('storeChecklists.command.days', { count: input.value })}</strong><small>{input.t('storeChecklists.command.lastCompleted')}</small></span>
}

function StatusPill(input: { locale: 'tr' | 'en'; row: ChecklistCommandRow }) {
  const presentation = getRowStatusPresentation(input.row, input.locale)
  return <span className={cn('checklist-command-status', `tone-${presentation.tone}`)}>{presentation.label}</span>
}

function getRowStatusPresentation(row: ChecklistCommandRow, locale: 'tr' | 'en') {
  if (row.pendingBmAcknowledgementCount > 0) return { label: locale === 'tr' ? 'Mağaza Müdürü Onayı Bekliyor' : 'Awaiting Store Manager acknowledgement', tone: 'review' }
  if (row.activeBmChecklistCount > 0) return { label: locale === 'tr' ? 'Aktif taslak' : 'Active draft', tone: 'active' }
  if (row.status === 'needs_visit') return { label: locale === 'tr' ? 'Bu ay eksik' : 'Missing this month', tone: 'late' }
  if (row.status === 'pending') return { label: locale === 'tr' ? 'Kabul bekliyor' : 'Awaiting acknowledgement', tone: 'review' }
  if (row.openActionCount > 0) return { label: locale === 'tr' ? 'Aksiyon Takipte' : 'Action in progress', tone: 'review' }
  return { label: locale === 'tr' ? 'Aksiyon Yok' : 'No action', tone: 'done' }
}

function getRowActionLabel(row: ChecklistCommandRow, locale: 'tr' | 'en') {
  if (row.activeBmChecklistCount > 0) return locale === 'tr' ? 'Devam et' : 'Continue'
  return locale === 'tr' ? 'Checklist Başlat' : 'Start checklist'
}

function getPrimaryWorkflowTab(row: ChecklistCommandRow, authorized: boolean): 'visits' | 'inbox' | 'history' {
  if (authorized) return 'visits'
  return row.pendingBmAcknowledgementCount > 0 ? 'inbox' : 'history'
}

function getDirectChecklist(authorized: boolean): 'bm' | undefined {
  return authorized ? 'bm' : undefined
}
