import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Filter,
  Search,
  SlidersHorizontal,
  Store,
  X,
} from 'lucide-react'
import type { AuthSessionSummary } from '../auth/api'
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
import { ChecklistVisitPlanSurface } from './ChecklistVisitPlanSurface'
import { ChecklistPlanningRegionPicker } from './ChecklistPlanningRegionPicker'
import {
  createChecklistCommandPeriod,
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
  onOpenWorkflow: (storeId: string) => void
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
  const [activeView, setActiveView] = useState<'visits' | 'plan'>('visits')
  const [weekStart, setWeekStart] = useState(() => getIstanbulWeekStart())
  const [openMenu, setOpenMenu] = useState<'status' | 'columns' | null>(null)
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
  const toolbarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchDraft.trim())
      setOffset(0)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchDraft])

  useEffect(() => {
    if (!openMenu) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!toolbarRef.current?.contains(event.target as Node)) setOpenMenu(null)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const trigger = toolbarRef.current?.querySelector<HTMLButtonElement>('[aria-expanded="true"]')
        setOpenMenu(null)
        window.requestAnimationFrame(() => trigger?.focus())
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openMenu])

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

  if (!regionOptionsQuery.data && regionOptionsQuery.isLoading) {
    return <StoreLoadingState title={t('storeChecklists.loadingTitle')} description={t('storeChecklists.loadingCopy')} />
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
    const selectionPeriodLabel = formatPeriodLabel(period, locale)
    return (
      <StoreSurfacePage ariaLabel={t('storeChecklists.command.title')} className="checklist-command-parity" data-testid="checklist-command-parity">
        <header className="checklist-command-title">
          <div><p>{selectionPeriodLabel} · {t('storeChecklists.command.eyebrow')}</p><h1>{t('storeChecklists.command.title')}</h1></div>
          <div className="checklist-command-title-actions">
            <ChecklistPlanningRegionPicker
              authSummary={input.authSummary}
              locale={locale}
              selected={null}
              onSelect={(option) => { setRetainedCommand(null); setSelectedRegion({ option, scopeSignature }) }}
            />
            <ChecklistCommandPeriodPicker locale={locale} period={period} onChange={(value) => { setRetainedCommand(null); setPeriod(value) }} />
          </div>
        </header>
        <section className="week-planner week-planner-state" aria-live="polite">
          <Store size={18} /><strong>{locale === 'tr' ? 'Devam etmek için bölge seçin.' : 'Select a region to continue.'}</strong>
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
  const hasPartialScoreData = data.items.some((row) =>
    (row.bmCompletedAt !== null && row.bmScore === null)
    || (row.vmCompletedAt !== null && row.vmScore === null),
  )
  const firstItem = data.page.total === 0 ? 0 : data.page.offset + 1
  const lastItem = Math.min(data.page.total, data.page.offset + data.items.length)
  const periodLabel = formatPeriodLabel(period, locale)
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
  return (
    <StoreSurfacePage ariaLabel={t('storeChecklists.command.title')} className="checklist-command-parity" data-testid="checklist-command-parity">
      <header className="checklist-command-title">
        <div>
          <p className="tw:text-[10px] tw:font-bold tw:uppercase tw:tracking-[0.14em] tw:text-muted-foreground">
            {periodLabel} · {activeRegion?.regionName ?? t('storeChecklists.command.eyebrow')}
          </p>
          <h1 className="tw:mt-1 tw:text-2xl tw:font-semibold tw:tracking-[-0.035em] tw:text-foreground tw:sm:text-3xl">
            {t('storeChecklists.command.title')}
          </h1>
        </div>
        <div className="checklist-command-title-actions">
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
          <ChecklistCommandPeriodPicker locale={locale} period={period} onChange={(value) => { setRetainedCommand(null); setPeriod(value); setOffset(0) }} />
          {activeRegion ? (
            <div className="canvas-view-switch" data-view={activeView} aria-label={locale === 'tr' ? 'Checklist görünümü' : 'Checklist view'}>
              <span className="canvas-view-glider" aria-hidden />
              <button type="button" className={activeView === 'visits' ? 'is-active' : ''} aria-pressed={activeView === 'visits'} onClick={() => setActiveView('visits')}>{locale === 'tr' ? 'Ziyaretler' : 'Visits'}</button>
              <button type="button" className={activeView === 'plan' ? 'is-active' : ''} aria-pressed={activeView === 'plan'} onClick={() => setActiveView('plan')}>{locale === 'tr' ? 'Ziyaret Planı' : 'Visit Plan'}{data.metrics.needsVisit > 0 ? <span className="canvas-view-count">{data.metrics.needsVisit}</span> : null}</button>
            </div>
          ) : null}
        </div>
      </header>

      {regionOptionsQuery.isError ? (
        <button type="button" className="checklist-region-inline-error" onClick={() => void regionOptionsQuery.refetch()}>
          {locale === 'tr' ? 'Bölge bilgisi alınamadı · Yeniden dene' : 'Region context unavailable · Retry'}
        </button>
      ) : null}

      {activeView === 'visits' ? <><section aria-label={t('storeChecklists.summaryAria')} className="checklist-command-metrics tw:relative tw:grid tw:grid-cols-2 tw:overflow-hidden tw:lg:grid-cols-4" data-testid="checklist-command-metrics">
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
              locale={locale}
              rows={data.items}
              sort={sort}
              columnPreset={columnPreset}
              t={t}
              onOpenWorkflow={input.onOpenWorkflow}
              onSort={changeSort}
            />
            <ChecklistCommandMobileCards locale={locale} rows={data.items} t={t} onOpenWorkflow={input.onOpenWorkflow} />
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
      </section></> : activeRegion ? (
        <ChecklistVisitPlanSurface
          authSummary={input.authSummary}
          locale={locale}
          period={period}
          regionId={activeRegion.regionId}
          regionName={activeRegion.regionName}
          weekStart={weekStart}
          onOpenResult={input.onOpenResult}
          onWeekStartChange={setWeekStart}
        />
      ) : (
        <section className="week-planner week-planner-state"><strong>{locale === 'tr' ? 'Planlanabilir mağaza bulunamadı.' : 'No stores available for planning.'}</strong></section>
      )}
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
  columnPreset: 'all' | 'scores' | 'visit'
  locale: 'tr' | 'en'
  rows: ChecklistCommandRow[]
  sort: ChecklistCommandSort
  t: ReturnType<typeof useLocalization>['t']
  onOpenWorkflow: (storeId: string) => void
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
          <button type="button" className="checklist-command-action" onClick={() => input.onOpenWorkflow(row.storeId)}>
            {getRowActionLabel(row, input.locale)} <ChevronRight size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

function ChecklistCommandMobileCards(input: {
  locale: 'tr' | 'en'
  rows: ChecklistCommandRow[]
  t: ReturnType<typeof useLocalization>['t']
  onOpenWorkflow: (storeId: string) => void
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
          <button type="button" className="checklist-command-action" onClick={() => input.onOpenWorkflow(row.storeId)}>{getRowActionLabel(row, input.locale)} <ChevronRight size={14} /></button>
        </article>
      ))}
    </div>
  )
}

function StoreIdentity({ row }: { row: ChecklistCommandRow }) {
  return <span className="tw:grid tw:min-w-0 tw:gap-0.5"><strong className="tw:truncate tw:text-xs tw:text-foreground">{row.storeName}</strong><small className="tw:truncate tw:text-[9px] tw:text-muted-foreground">{row.storeCode} · {row.regionName}</small></span>
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
  if (row.status === 'active') return { label: locale === 'tr' ? 'Aktif taslak' : 'Active draft', tone: 'active' }
  if (row.status === 'needs_visit') return { label: locale === 'tr' ? 'Bu ay eksik' : 'Missing this month', tone: 'late' }
  if (row.status === 'pending') return { label: locale === 'tr' ? 'Kabul bekliyor' : 'Awaiting acknowledgement', tone: 'review' }
  if (row.openActionCount > 0) return { label: locale === 'tr' ? 'Aksiyon Takipte' : 'Action in progress', tone: 'review' }
  return { label: locale === 'tr' ? 'Aksiyon Yok' : 'No action', tone: 'done' }
}

function getRowActionLabel(row: ChecklistCommandRow, locale: 'tr' | 'en') {
  if (row.status === 'active') return locale === 'tr' ? 'Devam et' : 'Continue'
  if (row.status === 'needs_visit') return locale === 'tr' ? 'Checklist yap' : 'Run checklist'
  return locale === 'tr' ? 'Sonucu gör' : 'View result'
}

function ChecklistCommandPeriodPicker(input: { locale: 'tr' | 'en'; period: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const { year: periodYear, month: periodMonth } = parsePeriod(input.period)
  const [draft, setDraft] = useState({ year: periodYear, month: periodMonth })
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const monthNames = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat(input.locale === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, index, 1))))
  const currentPeriod = parsePeriod(getBusinessMonthInputValue())
  const previousPeriod = currentPeriod.month === 1 ? { year: currentPeriod.year - 1, month: 12 } : { year: currentPeriod.year, month: currentPeriod.month - 1 }

  useEffect(() => {
    if (!open) return
    const close = (restoreFocus: boolean) => {
      setDraft({ year: periodYear, month: periodMonth })
      setOpen(false)
      if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus())
    }
    const handlePointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) close(false) }
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') close(true) }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => { document.removeEventListener('pointerdown', handlePointerDown); document.removeEventListener('keydown', handleKeyDown) }
  }, [open, periodMonth, periodYear])

  const closeWithoutApply = (restoreFocus = true) => {
    setDraft({ year: periodYear, month: periodMonth })
    setOpen(false)
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus())
  }
  return (
    <div ref={rootRef} className={cn('checklist-command-period', open && 'is-open')}>
      <button ref={triggerRef} type="button" className="checklist-command-period-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => { if (open) closeWithoutApply(false); else { setDraft({ year: periodYear, month: periodMonth }); setOpen(true) } }}><CalendarDays size={15} /><span><small>{input.locale === 'tr' ? 'DÖNEM' : 'PERIOD'}</small><strong>{formatPeriodLabel(input.period, input.locale)}</strong></span><ChevronDown size={13} /></button>
      {open ? <div className="checklist-command-period-popover" role="dialog" aria-label={input.locale === 'tr' ? 'Raporlama dönemi' : 'Reporting period'}>
        <header><div><span className="checklist-command-period-icon"><CalendarDays size={16} /></span><span><small>{input.locale === 'tr' ? 'RAPORLAMA DÖNEMİ' : 'REPORTING PERIOD'}</small><strong>{input.locale === 'tr' ? 'Ay ve yıl seçin' : 'Select month and year'}</strong></span></div><button type="button" aria-label={input.locale === 'tr' ? 'Tarih filtresini kapat' : 'Close date filter'} onClick={() => closeWithoutApply()}><X size={15} /></button></header>
        <div className="checklist-command-period-presets"><button type="button" className={draft.year === currentPeriod.year && draft.month === currentPeriod.month ? 'is-active' : ''} onClick={() => setDraft(currentPeriod)}>{input.locale === 'tr' ? 'Bu ay' : 'This month'}</button><button type="button" className={draft.year === previousPeriod.year && draft.month === previousPeriod.month ? 'is-active' : ''} onClick={() => setDraft(previousPeriod)}>{input.locale === 'tr' ? 'Geçen ay' : 'Last month'}</button></div>
        <div className="checklist-command-period-year"><button type="button" aria-label={input.locale === 'tr' ? 'Önceki yıl' : 'Previous year'} onClick={() => setDraft((current) => ({ ...current, year: current.year - 1 }))}><ChevronLeft size={15} /></button><span><small>{input.locale === 'tr' ? 'YIL' : 'YEAR'}</small><strong>{draft.year}</strong></span><button type="button" aria-label={input.locale === 'tr' ? 'Sonraki yıl' : 'Next year'} onClick={() => setDraft((current) => ({ ...current, year: current.year + 1 }))}><ChevronRight size={15} /></button></div>
        <div className="checklist-command-period-months">{monthNames.map((label, index) => <button type="button" className={draft.month === index + 1 ? 'is-active' : ''} key={label} onClick={() => setDraft((current) => ({ ...current, month: index + 1 }))}><span>{label}</span>{draft.month === index + 1 ? <Check size={13} /> : null}</button>)}</div>
        <footer><button type="button" onClick={() => setDraft(currentPeriod)}>{input.locale === 'tr' ? 'Sıfırla' : 'Reset'}</button><span>{formatPeriodLabel(createChecklistCommandPeriod(draft.year, draft.month), input.locale)}</span><button type="button" className="primary" onClick={() => { input.onChange(createChecklistCommandPeriod(draft.year, draft.month)); setOpen(false) }}><Check size={14} /> {input.locale === 'tr' ? 'Uygula' : 'Apply'}</button></footer>
      </div> : null}
    </div>
  )
}

function formatPeriodLabel(period: string, locale: 'tr' | 'en') {
  const { year, month } = parsePeriod(period)
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)))
}

function parsePeriod(period: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(period)
  if (!match) return { year: 2026, month: 1 }
  return { year: Number(match[1]!), month: Number(match[2]!) }
}
