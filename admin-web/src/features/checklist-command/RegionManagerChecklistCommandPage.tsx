import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Filter,
  Search,
  SlidersHorizontal,
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
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { ApiError } from '../../lib/api'
import { getBusinessMonthInputValue } from '../../lib/business-date'
import { getUserFacingErrorMessage } from '../../lib/format'
import { transientQueryRetryOptions } from '../../lib/query-retry'
import { cn } from '../../lib/utils'
import { StoreErrorState, StoreSurfacePage } from '../../pages/store-surface-primitives'
import {
  getChecklistCommandCanvas,
  getChecklistVisitPlanRegionOptions,
  type ChecklistCommandRow,
  type ChecklistVisitPlanRegionOption,
} from './api'
import { ChecklistVisitPlanSurface } from './ChecklistVisitPlanSurface'
import { ChecklistCommandPeriodPicker } from './ChecklistCommandPeriodPicker'
import { formatChecklistCommandPeriodLabel } from './checklist-command-period'
import { ChecklistOperationalHistoryDrawer } from './ChecklistOperationalHistoryDrawer'
import { RegionManagerRecordsSurface } from './RegionManagerRecordsSurface'
import { ChecklistPlanningRegionPicker } from './ChecklistPlanningRegionPicker'
import {
  ChecklistCommandDesktopTable as SharedChecklistCommandDesktopTable,
  ChecklistCommandFilterPopover,
  ChecklistCommandLoadingState,
  ChecklistCommandMetricStrip,
  ChecklistCommandMobileCards as SharedChecklistCommandMobileCards,
  ChecklistCommandPageHeader,
  ChecklistCommandPagination,
  ChecklistCommandState,
  ChecklistCommandToolbar,
  type ChecklistCommandMetric,
} from './ChecklistCommandSurface'
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
  activeView?: 'visits' | 'plan' | 'records'
  onActiveViewChange?: (view: 'visits' | 'plan' | 'records') => void
  onOpenWorkflow: (storeId: string, tab?: 'visits' | 'inbox' | 'history', directChecklist?: 'bm') => void
  onOpenResult: (checklistInstanceId: string) => void
}) {
  const { locale, t } = useLocalization()
  const [period, setPeriod] = useState(() => getBusinessMonthInputValue())
  const [status, setStatus] = useState<ChecklistCommandStatus>('all')
  const [sort, setSort] = useState<ChecklistCommandSort>('store_asc')
  const [searchDraft, setSearchDraft] = useState('')
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const [columnPreset, setColumnPreset] = useState<'all' | 'scores' | 'visit'>('all')
  const [localActiveView, setLocalActiveView] = useState<'visits' | 'plan' | 'records'>('visits')
  const actionStoreIds = useMemo(() => new Set(getActionStoreIds(input.authSummary)), [input.authSummary])
  const activeView = input.activeView ?? localActiveView
  const setActiveView = (view: 'visits' | 'plan' | 'records') => {
    setLocalActiveView(view)
    input.onActiveViewChange?.(view)
  }
  const [selectedRecordStore, setSelectedRecordStore] = useState<ChecklistCommandRow | null>(null)
  const historyTriggerRef = useRef<HTMLElement | null>(null)
  const [openMenu, setOpenMenu] = useState<'status' | 'columns' | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
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
    ...transientQueryRetryOptions,
  })
  const defaultRegion = regionOptionsQuery.data?.data.page.total === 1
    ? regionOptionsQuery.data.data.items[0] ?? null
    : null
  const activeRegion = selectedRegion?.scopeSignature === scopeSignature ? selectedRegion.option : defaultRegion
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

  function selectCompactSort(nextSort: ChecklistCommandSort) {
    retainCurrentCommand()
    setSort(nextSort)
    setOffset(0)
  }

  if (!regionOptionsQuery.data && regionOptionsQuery.isLoading) {
    return <ChecklistCommandLoadingState />
  }

  if (!regionOptionsQuery.data && regionOptionsQuery.isError) {
    return (
      <StoreSurfacePage ariaLabel={t('storeChecklists.errorTitle')}>
        <StoreErrorState
          title={locale === 'tr' ? 'Bölge kapsamı alınamadı' : 'Region scope unavailable'}
          description={getUserFacingErrorMessage(regionOptionsQuery.error, t('storeChecklists.errorCopy'))}
          action={{ label: t('storeChecklists.retryAction'), onClick: () => void regionOptionsQuery.refetch(), variant: 'outline' }}
        />
      </StoreSurfacePage>
    )
  }

  if (!activeRegion && (regionOptionsQuery.data?.data.page.total ?? 0) > 1) {
    const selectionPeriodLabel = formatChecklistCommandPeriodLabel(period, locale)
    return (
      <StoreSurfacePage ariaLabel={t('storeChecklists.command.title')} className="checklist-command-parity tw:max-w-[1065px] tw:gap-3" data-testid="checklist-command-parity">
        <ChecklistCommandPageHeader
          eyebrow={`${selectionPeriodLabel} · ${t('storeChecklists.command.eyebrow')}`}
          title={t('storeChecklists.command.title')}
          actions={<>
          <div className="tw:hidden">
          <div><p>{selectionPeriodLabel} · {t('storeChecklists.command.eyebrow')}</p><h1>{t('storeChecklists.command.title')}</h1></div>
          </div>
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            <ChecklistPlanningRegionPicker
              authSummary={input.authSummary}
              locale={locale}
              selected={null}
              onSelect={(option) => { setRetainedCommand(null); setSelectedRegion({ option, scopeSignature }) }}
            />
            <ChecklistCommandPeriodPicker locale={locale} period={period} onChange={changePeriod} />
          </div>
          </>
        }
        />
        <section className="week-planner week-planner-state" aria-live="polite">
          <Store size={18} /><strong>{locale === 'tr' ? 'Devam etmek için bölge seçin.' : 'Select a region to continue.'}</strong>
        </section>
      </StoreSurfacePage>
    )
  }

  if (!commandResponse && commandQuery.isLoading) {
    return <ChecklistCommandLoadingState />
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
  const hasPartialScoreData = data.items.some((row) =>
    (row.bmCompletedAt !== null && row.bmScore === null)
    || (row.vmCompletedAt !== null && row.vmScore === null),
  )
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

  const statusOptions: Array<{ key: ChecklistCommandStatus; label: string; count: number }> = [
    { key: 'all', label: t('storeChecklists.command.all'), count: data.metrics.totalStores },
    { key: 'needs_visit', label: t('storeChecklists.command.needsVisit'), count: data.metrics.needsVisit },
    { key: 'active', label: t('storeChecklists.command.active'), count: data.metrics.active },
    { key: 'pending', label: t('storeChecklists.pendingAcknowledgements'), count: data.metrics.pending },
    { key: 'completed', label: t('storeChecklists.command.completed'), count: data.metrics.completed },
  ]
  const statusLabel = statusOptions.find((option) => option.key === status)?.label ?? t('storeChecklists.command.all')
  const columnLabel = columnPreset === 'all' ? (locale === 'tr' ? 'Tümü' : 'All') : columnPreset === 'scores' ? (locale === 'tr' ? 'Skorlar' : 'Scores') : (locale === 'tr' ? 'Ziyaret' : 'Visit')
  const pageNumber = Math.floor(offset / PAGE_SIZE) + 1
  const pageCount = Math.max(1, Math.ceil(data.page.total / PAGE_SIZE))
  if (String(activeView) === 'visits') {
    const sharedMetrics: ChecklistCommandMetric[] = metrics.map((metric) => ({ ...metric }))
    return (
      <StoreSurfacePage ariaLabel={t('storeChecklists.command.title')} className="checklist-command-parity tw:font-['DM_Sans',sans-serif] tw:max-w-[1065px] tw:gap-3" data-testid="checklist-command-parity">
        <ChecklistCommandPageHeader eyebrow={`${periodLabel} · ${activeRegion?.regionName ?? t('storeChecklists.command.eyebrow')}`} title={t('storeChecklists.command.title')} actions={<><ChecklistPlanningRegionPicker authSummary={input.authSummary} locale={locale} selected={activeRegion} onSelect={(option) => { setRetainedCommand(null); setSelectedRegion({ option, scopeSignature }); setOffset(0) }} /><ChecklistCommandPeriodPicker locale={locale} period={period} onChange={changePeriod} /><div className="canvas-view-switch tw:flex tw:flex-wrap tw:gap-1 tw:rounded-lg tw:border tw:border-border tw:bg-muted/30 tw:p-1" data-view={activeView} aria-label={locale === 'tr' ? 'Checklist görünümü' : 'Checklist view'}><Button type="button" size="sm" variant={activeView === 'visits' ? 'secondary' : 'ghost'} aria-pressed={activeView === 'visits'} onClick={() => setActiveView('visits')}>{locale === 'tr' ? 'Ziyaretler' : 'Visits'}</Button><Button type="button" size="sm" variant={activeView === 'plan' ? 'secondary' : 'ghost'} aria-pressed={activeView === 'plan'} onClick={() => setActiveView('plan')}>{locale === 'tr' ? 'Ziyaret Planı' : 'Visit Plan'}{data.metrics.needsVisit > 0 ? <span className="tw:ml-1 tw:rounded-full tw:bg-destructive/10 tw:px-1.5 tw:text-[10px] tw:text-destructive">{data.metrics.needsVisit}</span> : null}</Button><Button type="button" size="sm" variant={activeView === 'records' ? 'secondary' : 'ghost'} aria-pressed={activeView === 'records'} onClick={() => setActiveView('records')}>{locale === 'tr' ? 'Mağaza Kayıtları' : 'Store Records'}</Button></div></>} />
        {regionOptionsQuery.isError ? <ChecklistCommandState kind="error" title={locale === 'tr' ? 'Bölge bilgisi alınamadı' : 'Region context unavailable'} description={locale === 'tr' ? 'Bölge bilgisi yenilenemedi.' : 'Region information could not be refreshed.'} retryLabel={t('storeChecklists.retryAction')} onRetry={() => void regionOptionsQuery.refetch()} /> : null}
        <ChecklistCommandMetricStrip ariaLabel={t('storeChecklists.summaryAria')} metrics={sharedMetrics} selectedKey={status} onSelect={(key) => selectStatus(key as ChecklistCommandStatus)} testId="checklist-command-metrics" />
        <section className="checklist-command-surface tw:overflow-hidden tw:rounded-[15px] tw:border tw:border-border tw:bg-card tw:shadow-sm" data-testid="checklist-command-surface">
          <ChecklistCommandToolbar searchLabel={t('storeChecklists.command.search')} searchValue={searchDraft} onSearchChange={(value) => { retainCurrentCommand(); setSearchDraft(value) }} refreshing={commandQuery.isFetching ? (locale === 'tr' ? 'Güncelleniyor…' : 'Refreshing…') : undefined} errorLabel={commandQuery.isError ? (locale === 'tr' ? 'Veriler yenilenemedi' : 'Data could not refresh') : undefined} retryLabel={commandQuery.isError ? (locale === 'tr' ? 'Tekrar dene' : 'Retry') : undefined} onRetry={commandQuery.isError ? () => void commandQuery.refetch() : undefined}>
            <ChecklistCommandFilterPopover label={locale === 'tr' ? 'Durum' : 'Status'} valueLabel={statusLabel} ariaLabel={locale === 'tr' ? 'Durum filtresi' : 'Status filter'} icon={Filter} value={status} onValueChange={(value) => selectStatus(value as ChecklistCommandStatus)} options={statusOptions.map((option) => ({ value: option.key, label: option.label, count: option.count, note: locale === 'tr' ? `${option.count} mağaza` : `${option.count} stores` }))} />
            <ChecklistCommandFilterPopover label={locale === 'tr' ? 'Kolonlar' : 'Columns'} valueLabel={columnLabel} ariaLabel={locale === 'tr' ? 'Kolon görünümü' : 'Column view'} icon={SlidersHorizontal} value={columnPreset} onValueChange={(value) => setColumnPreset(value as typeof columnPreset)} options={[{ value: 'all', label: locale === 'tr' ? 'Tümü' : 'All' }, { value: 'scores', label: locale === 'tr' ? 'Skorlar' : 'Scores' }, { value: 'visit', label: locale === 'tr' ? 'Ziyaret' : 'Visit' }]} />
            <div className="tw:min-w-40"><Select value={sort} onValueChange={(value) => selectCompactSort(value as ChecklistCommandSort)}><SelectTrigger aria-label={locale === 'tr' ? 'Mağazaları sırala' : 'Sort stores'}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="store_asc">{locale === 'tr' ? 'Mağaza A-Z' : 'Store A-Z'}</SelectItem><SelectItem value="store_desc">{locale === 'tr' ? 'Mağaza Z-A' : 'Store Z-A'}</SelectItem><SelectItem value="bm_score_desc">{locale === 'tr' ? 'BM puanı yüksek' : 'Highest BM score'}</SelectItem><SelectItem value="vm_score_desc">{locale === 'tr' ? 'VM puanı yüksek' : 'Highest VM score'}</SelectItem><SelectItem value="last_visit_desc">{locale === 'tr' ? 'Son ziyaret yeni' : 'Newest visit'}</SelectItem><SelectItem value="last_visit_asc">{locale === 'tr' ? 'Son ziyaret eski' : 'Oldest visit'}</SelectItem><SelectItem value="open_actions_desc">{locale === 'tr' ? 'Açık aksiyon çok' : 'Most open actions'}</SelectItem><SelectItem value="status_asc">{locale === 'tr' ? 'Durum A-Z' : 'Status A-Z'}</SelectItem><SelectItem value="status_desc">{locale === 'tr' ? 'Durum Z-A' : 'Status Z-A'}</SelectItem></SelectContent></Select></div>
          </ChecklistCommandToolbar>
          {hasPartialScoreData ? <div className="checklist-command-partial-notice tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-border tw:bg-secondary tw:px-3 tw:py-2 tw:text-xs tw:text-secondary-foreground" role="status"><CircleAlert className="tw:size-3.5" aria-hidden="true" />{t('storeChecklists.command.partialScoreNotice')}</div> : null}
          {data.items.length === 0 ? <ChecklistCommandState kind="empty" title={t('storeChecklists.command.emptyTitle')} description={t('storeChecklists.command.emptyCopy')} /> : <><SharedChecklistCommandDesktopTable actionStoreIds={actionStoreIds} locale={locale} rows={data.items} sort={sort} columnPreset={columnPreset} t={t} onOpenWorkflow={input.onOpenWorkflow} onSort={changeSort} /><SharedChecklistCommandMobileCards actionStoreIds={actionStoreIds} locale={locale} rows={data.items} t={t} onOpenWorkflow={input.onOpenWorkflow} /></>}
          <ChecklistCommandPagination firstItem={firstItem} lastItem={lastItem} total={data.page.total} pageNumber={pageNumber} pageCount={pageCount} previousLabel={t('storeChecklists.command.previous')} nextLabel={t('storeChecklists.command.next')} summary={t('storeChecklists.command.page', { start: firstItem, end: lastItem, total: data.page.total })} previousDisabled={offset === 0 || commandQuery.isFetching} nextDisabled={!data.page.hasMore || commandQuery.isFetching} onPrevious={() => { retainCurrentCommand(); setOffset(Math.max(0, offset - PAGE_SIZE)) }} onNext={() => { retainCurrentCommand(); setOffset(offset + PAGE_SIZE) }} />
        </section>
      </StoreSurfacePage>
    )
  }
  return (
    <StoreSurfacePage ariaLabel={t('storeChecklists.command.title')} className="checklist-command-parity checklist-command-legacy tw:max-w-[1065px] tw:gap-3" data-testid="checklist-command-parity">
      <ChecklistCommandPageHeader
        eyebrow={`${periodLabel} · ${activeRegion?.regionName ?? t('storeChecklists.command.eyebrow')}`}
        title={t('storeChecklists.command.title')}
        actions={<>
        <div className="tw:hidden">
        <div>
          <p className="tw:text-[10px] tw:font-bold tw:uppercase tw:tracking-[0.14em] tw:text-muted-foreground">
            {periodLabel} · {activeRegion?.regionName ?? t('storeChecklists.command.eyebrow')}
          </p>
          <h1 className="tw:mt-1 tw:text-2xl tw:font-semibold tw:tracking-[-0.035em] tw:text-foreground tw:sm:text-3xl">
            {t('storeChecklists.command.title')}
          </h1>
        </div>
        </div>
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
          {(regionOptionsQuery.data?.data.page.total ?? 0) > 1 ? (
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
          <ChecklistCommandPeriodPicker locale={locale} period={period} onChange={changePeriod} />
          {activeRegion ? (
            <div className="canvas-view-switch" data-view={activeView} aria-label={locale === 'tr' ? 'Checklist görünümü' : 'Checklist view'}>
              <span className="canvas-view-glider" aria-hidden />
              <button type="button" className={activeView === 'visits' ? 'is-active' : ''} aria-pressed={activeView === 'visits'} onClick={() => setActiveView('visits')}>{locale === 'tr' ? 'Ziyaretler' : 'Visits'}</button>
              <button type="button" className={activeView === 'plan' ? 'is-active' : ''} aria-pressed={activeView === 'plan'} onClick={() => setActiveView('plan')}>{locale === 'tr' ? 'Ziyaret Planı' : 'Visit Plan'}{data.metrics.needsVisit > 0 ? <span className="canvas-view-count">{data.metrics.needsVisit}</span> : null}</button>
              <button type="button" className={activeView === 'records' ? 'is-active' : ''} aria-pressed={activeView === 'records'} onClick={() => setActiveView('records')}>{locale === 'tr' ? 'Mağaza Kayıtları' : 'Store Records'}</button>
            </div>
          ) : null}
        </div>
        </>
        }
      />

      {regionOptionsQuery.isError ? (
        <button type="button" className="checklist-region-inline-error" onClick={() => void regionOptionsQuery.refetch()}>
          {locale === 'tr' ? 'Bölge bilgisi alınamadı · Yeniden dene' : 'Region context unavailable · Retry'}
        </button>
      ) : null}

      {activeView === 'visits' ? <><section aria-label={t('storeChecklists.summaryAria')} className="checklist-command-metrics tw:relative tw:grid tw:grid-cols-2 tw:overflow-hidden tw:lg:grid-cols-4" data-testid="checklist-command-metrics">
              <span aria-hidden className="tw:absolute tw:inset-x-0 tw:top-0 tw:h-[3px] tw:bg-gradient-to-r tw:from-primary tw:via-accent tw:to-primary" />
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
      </section>

      <section className="checklist-command-surface tw:overflow-hidden" data-testid="checklist-command-surface">
        <div className="checklist-command-toolbar tw:flex tw:flex-col tw:gap-2 tw:border-b tw:border-border tw:p-3 tw:sm:flex-row tw:sm:items-center" ref={toolbarRef}>
          <label className="tw:flex tw:min-h-9 tw:min-w-0 tw:flex-1 tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-input tw:bg-muted/20 tw:px-3 tw:text-muted-foreground tw:sm:max-w-sm">
            <Search className="tw:size-4 tw:shrink-0" />
            <Input
              aria-label={t('storeChecklists.command.search')}
              className="tw:h-auto tw:border-0 tw:bg-transparent tw:p-0 tw:text-xs tw:shadow-none tw:focus-visible:ring-0"
              placeholder={t('storeChecklists.command.search')}
              value={searchDraft}
              onChange={(event) => { retainCurrentCommand(); setSearchDraft(event.target.value) }}
            />
          </label>
          {commandQuery.isFetching ? <small className="checklist-command-inline-refresh" aria-live="polite">{locale === 'tr' ? 'Güncelleniyor…' : 'Refreshing…'}</small> : null}
          {commandQuery.isError ? <button type="button" className="checklist-command-inline-error" onClick={() => void commandQuery.refetch()}>{locale === 'tr' ? 'Veriler yenilenemedi · Tekrar dene' : 'Refresh failed · Retry'}</button> : null}
          <div className="checklist-command-menu">
            <button type="button" aria-haspopup="menu" aria-expanded={openMenu === 'status'} onClick={() => setOpenMenu((current) => current === 'status' ? null : 'status')}>
              <Filter size={15} /> {locale === 'tr' ? 'Durum' : 'Status'} <span>{statusLabel}</span><ChevronDown size={12} />
            </button>
            {openMenu === 'status' ? <div className="checklist-command-popover" role="menu" aria-label={locale === 'tr' ? 'Durum filtresi' : 'Status filter'}>
              <header><small>{locale === 'tr' ? 'DURUM' : 'STATUS'}</small><strong>{locale === 'tr' ? 'Checklist akışı' : 'Checklist flow'}</strong></header>
              {statusOptions.map((option) => <button type="button" role="menuitemradio" aria-checked={status === option.key} className={status === option.key ? 'is-selected' : ''} key={option.key} onClick={() => { selectStatus(option.key); setOpenMenu(null) }}><span><strong>{option.label}</strong><small>{option.count} {locale === 'tr' ? 'mağaza' : 'stores'}</small></span><b>{option.count}</b>{status === option.key ? <Check size={14} /> : null}</button>)}
            </div> : null}
          </div>
          <i className="checklist-command-toolbar-spacer" />
          <div className="checklist-command-menu checklist-command-menu-end">
            <button type="button" aria-haspopup="menu" aria-expanded={openMenu === 'columns'} onClick={() => setOpenMenu((current) => current === 'columns' ? null : 'columns')}>
              <SlidersHorizontal size={15} /> {locale === 'tr' ? 'Kolonlar' : 'Columns'} <span>{columnLabel}</span><ChevronDown size={12} />
            </button>
            {openMenu === 'columns' ? <div className="checklist-command-popover" role="menu" aria-label={locale === 'tr' ? 'Kolon görünümü' : 'Column view'}>
              <header><small>{locale === 'tr' ? 'KOLONLAR' : 'COLUMNS'}</small><strong>{locale === 'tr' ? 'Görünüm yoğunluğu' : 'View density'}</strong></header>
              {([['all', locale === 'tr' ? 'Tümü' : 'All', locale === 'tr' ? 'Skor, ziyaret süresi ve durum' : 'Scores, visit age and status'], ['scores', locale === 'tr' ? 'Skorlar' : 'Scores', locale === 'tr' ? 'BM, VM ve durum' : 'BM, VM and status'], ['visit', locale === 'tr' ? 'Ziyaret' : 'Visit', locale === 'tr' ? 'Tarih, geçen süre ve durum' : 'Date, elapsed and status']] as const).map(([key, label, note]) => <button type="button" role="menuitemradio" aria-checked={columnPreset === key} className={columnPreset === key ? 'is-selected' : ''} key={key} onClick={() => { setColumnPreset(key); setOpenMenu(null) }}><span><strong>{label}</strong><small>{note}</small></span>{columnPreset === key ? <Check size={14} /> : null}</button>)}
            </div> : null}
          </div>
          <div className="checklist-command-compact-sort">
            <Select value={sort} onValueChange={(value) => selectCompactSort(value as ChecklistCommandSort)}>
              <SelectTrigger aria-label={locale === 'tr' ? 'Mağazaları sırala' : 'Sort stores'}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="store_asc">{locale === 'tr' ? 'Mağaza A-Z' : 'Store A-Z'}</SelectItem>
                <SelectItem value="store_desc">{locale === 'tr' ? 'Mağaza Z-A' : 'Store Z-A'}</SelectItem>
                <SelectItem value="bm_score_desc">{locale === 'tr' ? 'BM puanı yüksek' : 'Highest BM score'}</SelectItem>
                <SelectItem value="vm_score_desc">{locale === 'tr' ? 'VM puanı yüksek' : 'Highest VM score'}</SelectItem>
                <SelectItem value="last_visit_desc">{locale === 'tr' ? 'Son ziyaret yeni' : 'Newest visit'}</SelectItem>
                <SelectItem value="last_visit_asc">{locale === 'tr' ? 'Son ziyaret eski' : 'Oldest visit'}</SelectItem>
                <SelectItem value="open_actions_desc">{locale === 'tr' ? 'Açık aksiyon çok' : 'Most open actions'}</SelectItem>
                <SelectItem value="status_asc">{locale === 'tr' ? 'Durum A-Z' : 'Status A-Z'}</SelectItem>
                <SelectItem value="status_desc">{locale === 'tr' ? 'Durum Z-A' : 'Status Z-A'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
              columnPreset={columnPreset}
              t={t}
              onOpenWorkflow={input.onOpenWorkflow}
              onSort={changeSort}
            />
            <ChecklistCommandMobileCards actionStoreIds={actionStoreIds} locale={locale} rows={data.items} t={t} onOpenWorkflow={input.onOpenWorkflow} />
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
      </section></> : activeView === 'records' ? (
        <RegionManagerRecordsSurface
          data={data}
          isError={commandQuery.isError}
          isFetching={commandQuery.isFetching}
          locale={locale}
          offset={offset}
          query={searchDraft}
          sort={sort}
          status={status}
          onOpenHistory={(store, trigger) => { historyTriggerRef.current = trigger; setSelectedRecordStore(store) }}
          onOffset={(nextOffset) => { retainCurrentCommand(); setOffset(nextOffset) }}
          onQuery={(value) => { retainCurrentCommand(); setSearchDraft(value) }}
          onRetry={() => void commandQuery.refetch()}
          onSort={changeSort}
          onStatus={selectStatus}
        />
      ) : activeRegion ? (
        <ChecklistVisitPlanSurface
          authSummary={input.authSummary}
          locale={locale}
          period={period}
          regionId={activeRegion.regionId}
          regionName={activeRegion.regionName}
          weekStart={weekStart}
          onOpenResult={input.onOpenResult}
          onWeekStartChange={changePlanningWeek}
        />
      ) : (
        <section className="week-planner week-planner-state"><strong>{locale === 'tr' ? 'Planlanabilir mağaza bulunamadı.' : 'No stores available for planning.'}</strong></section>
      )}
      <ChecklistOperationalHistoryDrawer
        authSummary={input.authSummary}
        open={Boolean(selectedRecordStore)}
        storeId={selectedRecordStore?.storeId ?? null}
        storeName={selectedRecordStore?.storeName ?? null}
        returnFocusRef={historyTriggerRef}
        onClose={() => setSelectedRecordStore(null)}
      />
    </StoreSurfacePage>
  )
}

const metricToneClasses = {
  active: 'tw:bg-accent/10 tw:text-accent',
  danger: 'tw:bg-destructive/10 tw:text-destructive',
  done: 'tw:bg-accent/10 tw:text-accent',
  plum: 'tw:bg-primary/10 tw:text-primary',
}

function ChecklistCommandDesktopTable(input: {
  actionStoreIds: ReadonlySet<string>
  columnPreset: 'all' | 'scores' | 'visit'
  locale: 'tr' | 'en'
  rows: ChecklistCommandRow[]
  sort: ChecklistCommandSort
  t: ReturnType<typeof useLocalization>['t']
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
      <div className={cn('checklist-command-table-head', `columns-${input.columnPreset}`)}>
        {heading(input.t('storeChecklists.command.store'), 'store')}
        {input.columnPreset !== 'visit' ? heading('BM', 'bm') : null}
        {input.columnPreset !== 'visit' ? heading('VM', 'vm') : null}
        {input.columnPreset !== 'scores' ? heading(input.t('storeChecklists.command.visit'), 'last_visit') : null}
        {input.columnPreset !== 'scores' ? <span>{input.t('storeChecklists.command.elapsed')}</span> : null}
        {heading(input.t('storeChecklists.status'), 'status')}
        <span />
      </div>
      {input.rows.map((row) => (
        <div key={row.storeId} data-testid="checklist-command-row" className={cn('checklist-command-row', `columns-${input.columnPreset}`, row.status === 'needs_visit' && 'tone-late')}>
          <StoreIdentity row={row} />
          {input.columnPreset !== 'visit' ? <ChecklistScore className="score-bm" value={row.bmScore} completedAt={row.bmCompletedAt} t={input.t} /> : null}
          {input.columnPreset !== 'visit' ? <ChecklistScore className="score-vm" value={row.vmScore} completedAt={row.vmCompletedAt} t={input.t} /> : null}
          {input.columnPreset !== 'scores' ? <VisitDate className="visit-date" value={row.lastCompletedVisitAt} locale={input.locale} t={input.t} /> : null}
          {input.columnPreset !== 'scores' ? <ElapsedDays className="elapsed-days" value={row.elapsedDaysSinceLastVisit} t={input.t} /> : null}
          <StatusPill locale={input.locale} row={row} />
          <div className="tw:flex tw:items-center tw:justify-end tw:gap-1">
            {row.bmCompletedAt ? <button type="button" className="checklist-command-action" onClick={() => input.onOpenWorkflow(row.storeId, row.pendingBmAcknowledgementCount > 0 ? 'inbox' : 'history')}>{input.locale === 'tr' ? 'Sonuçlar' : 'Results'}</button> : null}
            <button type="button" className="checklist-command-action" onClick={() => input.onOpenWorkflow(row.storeId, getPrimaryWorkflowTab(row, input.actionStoreIds.has(row.storeId)), getDirectChecklist(input.actionStoreIds.has(row.storeId)))}>
              {getRowActionLabel(row, input.locale, input.actionStoreIds.has(row.storeId))} <ChevronRight size={14} />
            </button>
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
  onOpenWorkflow: (storeId: string, tab?: 'visits' | 'inbox' | 'history', directChecklist?: 'bm') => void
}) {
  return (
    <div className="checklist-command-mobile-list">
      {input.rows.map((row) => (
        <article key={row.storeId} className={cn('checklist-command-mobile-card', row.status === 'needs_visit' && 'tone-late')}>
          <StoreIdentity row={row} />
          <div className="checklist-command-mobile-scores">
            <ChecklistScore className="score-bm" value={row.bmScore} completedAt={row.bmCompletedAt} t={input.t} />
            <ChecklistScore className="score-vm" value={row.vmScore} completedAt={row.vmCompletedAt} t={input.t} />
          </div>
          <div className="checklist-command-mobile-visit">
            <VisitDate value={row.lastCompletedVisitAt} locale={input.locale} t={input.t} />
            <ElapsedDays value={row.elapsedDaysSinceLastVisit} t={input.t} />
          </div>
          <StatusPill locale={input.locale} row={row} />
          <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-1">
            {row.bmCompletedAt ? <button type="button" className="checklist-command-action" onClick={() => input.onOpenWorkflow(row.storeId, row.pendingBmAcknowledgementCount > 0 ? 'inbox' : 'history')}>{input.locale === 'tr' ? 'Sonuçlar' : 'Results'}</button> : null}
            <button type="button" className="checklist-command-action" onClick={() => input.onOpenWorkflow(row.storeId, getPrimaryWorkflowTab(row, input.actionStoreIds.has(row.storeId)), getDirectChecklist(input.actionStoreIds.has(row.storeId)))}>{getRowActionLabel(row, input.locale, input.actionStoreIds.has(row.storeId))} <ChevronRight size={14} /></button>
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

function getRowActionLabel(row: ChecklistCommandRow, locale: 'tr' | 'en', authorized: boolean) {
  if (!authorized) return locale === 'tr' ? 'Sonuçları gör' : 'View results'
  if (row.activeBmChecklistCount > 0) return locale === 'tr' ? 'Devam et' : 'Continue'
  return locale === 'tr' ? 'Checklist yap' : 'Run checklist'
}

function getPrimaryWorkflowTab(row: ChecklistCommandRow, authorized: boolean): 'visits' | 'inbox' | 'history' {
  if (authorized) return 'visits'
  return row.pendingBmAcknowledgementCount > 0 ? 'inbox' : 'history'
}

function getDirectChecklist(authorized: boolean): 'bm' | undefined {
  return authorized ? 'bm' : undefined
}
