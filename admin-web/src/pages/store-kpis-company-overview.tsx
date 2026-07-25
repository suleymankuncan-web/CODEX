import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ArrowRight, BarChart3, ChevronDown, CircleAlert, Store, Users } from 'lucide-react'
import { getRankings, type RankingSummary } from '../features/reports/api'
import { transientQueryRetryOptions } from '../lib/query-retry'
import type { StoreKpiHighlightsPageModel } from './store-kpi-highlights-model'
import { StoreKpisPeriodPicker } from './store-kpis-period-picker'
import { StoreEmptyState, StoreErrorState, StoreLoadingState, StoreSurfacePage } from './store-surface-primitives'

type CompanySort = 'manager' | 'stores' | 'score'
type ManagerSummary = RankingSummary['regionManagerLeaderboard']['items'][number]

// KPI-FR-001 / EC-001: Report Viewer owns the company -> Region Manager ->
// store read-only drill path. Manager summaries and store pages are separately
// bounded so a manager with more than one store page is never split into fake
// duplicate summaries. This component tree contains no mutation control.
export function StoreKpisCompanyOverview({ model }: { model: StoreKpiHighlightsPageModel }) {
  const [expandedManager, setExpandedManager] = useState<string | null>(null)
  const [sort, setSort] = useState<CompanySort>('manager')
  const ranking = model.reportViewerOverviewQuery.data
  const managers = useMemo(() => {
    const source = model.reportViewerRiskOnly
      ? ranking?.regionManagerLeaderboard.riskItems ?? []
      : ranking?.regionManagerLeaderboard.items ?? []
    return [...source].sort((left, right) => {
      if (sort === 'stores') return right.storeCount - left.storeCount || stableManagerKey(left).localeCompare(stableManagerKey(right))
      if (sort === 'score') return compareNullableScore(right.averageScore, left.averageScore) || stableManagerKey(left).localeCompare(stableManagerKey(right))
      return stableManagerKey(left).localeCompare(stableManagerKey(right), 'tr')
    })
  }, [model.reportViewerRiskOnly, ranking?.regionManagerLeaderboard.items, ranking?.regionManagerLeaderboard.riskItems, sort])
  const sourcePeriod = model.reportViewerActivePeriodStart || ranking?.source.periodStart || ''
  const availablePeriods = ranking?.availablePeriods
    .filter((period) => period.periodType === 'monthly')
    .map((period) => period.periodStart) ?? []
  const managerMeta = model.reportViewerRiskOnly
    ? ranking?.regionManagerLeaderboard.riskMeta
    : ranking?.regionManagerLeaderboard.meta
  const totalManagers = ranking?.regionManagerLeaderboard.meta.total ?? 0
  const activeListTotal = managerMeta?.total ?? 0
  const activePage = model.reportViewerRiskOnly ? model.reportViewerRiskPage : model.reportViewerPage
  const setActivePage = model.reportViewerRiskOnly ? model.setReportViewerRiskPage : model.setReportViewerPage
  const hasPrevious = activePage > 0
  const hasNext = (activePage + 1) * model.reportViewerPageSize < activeListTotal
  const selectStandardSort = (nextSort: CompanySort) => {
    model.setReportViewerRiskOnly(false)
    model.setReportViewerPage(0)
    setSort(nextSort)
  }
  const selectRisk = () => {
    const nextRiskOnly = !model.reportViewerRiskOnly
    if (nextRiskOnly) model.setReportViewerRiskPage(0)
    else model.setReportViewerPage(0)
    model.setReportViewerRiskOnly(nextRiskOnly)
  }
  const selectSort = (nextSort: CompanySort) => {
    setActivePage(0)
    setSort(nextSort)
  }

  return (
    <StoreSurfacePage ariaLabel={model.t('storeKpis.companyCommandTitle')} testId="store-kpis-company-overview">
      <div className="tw:mx-auto tw:grid tw:max-w-[1420px] tw:gap-4">
        <header className="tw:grid tw:gap-4 tw:lg:grid-cols-[minmax(0,1fr)_auto] tw:lg:items-end">
          <div>
            <div className="tw:flex tw:flex-wrap tw:gap-2">
              <span className="tw:rounded-full tw:bg-[var(--store-command-plum-soft)] tw:px-3 tw:py-1 tw:text-xs tw:font-semibold tw:text-[var(--store-command-plum-deep)]">{model.t('storeKpis.companyReadOnlyBadge')}</span>
              {sourcePeriod ? <span className="tw:rounded-full tw:bg-[var(--store-command-cyan-soft)] tw:px-3 tw:py-1 tw:text-xs tw:font-semibold tw:text-[var(--store-command-accent-ink)]">{formatMonth(sourcePeriod, model.locale)}</span> : null}
            </div>
            <h1 className="tw:mt-2 tw:text-3xl tw:font-semibold tw:tracking-[-0.04em] tw:text-[var(--store-command-ink)]">{model.t('storeKpis.companyCommandTitle')}</h1>
            <p className="tw:mt-1 tw:text-sm tw:text-[var(--store-command-muted)]">{model.t('storeKpis.companyCommandCopy')}</p>
          </div>
          <StoreKpisPeriodPicker ariaLabel={model.t('storeKpis.companyPeriodSelect')} availablePeriodStarts={availablePeriods} locale={model.locale} onPeriodStartChange={model.setReportViewerPeriodStart} periodStart={sourcePeriod} triggerClassName="tw:min-h-11 tw:rounded-xl tw:border-[var(--store-command-line)] tw:bg-white tw:px-4 tw:text-sm tw:font-semibold tw:text-[var(--store-command-ink)]" />
        </header>
        {(model.reportViewerOverviewQuery.isError || model.reportViewerOverviewQuery.failureCount > 0) && ranking ? <CompanyBackgroundError model={model} onRetry={() => void model.reportViewerOverviewQuery.refetch()} /> : null}

        <nav aria-label={model.t('storeKpis.companyTrailLabel')} className="tw:rounded-xl tw:border tw:border-[var(--store-command-line)] tw:bg-white/80 tw:px-4 tw:py-3 tw:text-xs tw:text-[var(--store-command-muted)]">{model.t('storeKpis.companyTrail')}</nav>

        <section aria-label={model.t('storeKpis.commandDecisionRail')} className="tw:grid tw:overflow-hidden tw:rounded-[1.45rem] tw:border tw:border-[var(--store-command-line)] tw:bg-white/[0.88] tw:shadow-[0_14px_38px_var(--store-command-line)] tw:sm:grid-cols-2 tw:xl:grid-cols-4">
          <CompanyMetric active={!model.reportViewerRiskOnly && sort === 'manager'} icon={Users} label={model.t('storeKpis.companyManagerCount')} onClick={() => selectStandardSort('manager')} value={formatInteger(model.locale, totalManagers)} />
          <CompanyMetric active={!model.reportViewerRiskOnly && sort === 'stores'} icon={Store} label={model.t('storeKpis.companyStoreCount')} onClick={() => selectStandardSort('stores')} value={formatInteger(model.locale, ranking?.scopeSummary.storeCount ?? 0)} tone="cyan" />
          <CompanyMetric active={!model.reportViewerRiskOnly && sort === 'score'} icon={BarChart3} label={model.t('storeKpis.companyAverageScore')} onClick={() => selectStandardSort('score')} value={formatScore(model.locale, ranking?.reference.store.averageScore ?? null, model.t('common.noData'))} tone="blue" />
          <CompanyMetric active={model.reportViewerRiskOnly} icon={CircleAlert} label={model.t('storeKpis.companyRiskCount')} onClick={selectRisk} value={formatInteger(model.locale, ranking?.regionManagerLeaderboard.riskStoreCount ?? 0)} tone="danger" />
        </section>

        <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-2" aria-label={model.t('storeKpis.companySortRail')}>
          {([['manager', model.t('storeKpis.companySortManager')], ['stores', model.t('storeKpis.companySortStores')], ['score', model.t('storeKpis.companySortScore')]] as const).map(([key, label]) => (
            <button key={key} type="button" aria-pressed={sort === key} className={`tw:min-h-11 tw:rounded-xl tw:border tw:px-3 tw:text-xs tw:font-semibold ${sort === key ? 'tw:border-[var(--store-command-focus)] tw:bg-[var(--store-command-plum-soft)] tw:text-[var(--store-command-plum-deep)]' : 'tw:border-[var(--store-command-line)] tw:bg-white tw:text-[var(--store-command-muted)]'}`} onClick={() => selectSort(key)}>{label}</button>
          ))}
        </div>

        <section className="tw:overflow-hidden tw:rounded-[1.45rem] tw:border tw:border-[var(--store-command-line)] tw:bg-white/[0.9] tw:shadow-[0_14px_38px_var(--store-command-line)]">
          <div className="tw:flex tw:items-center tw:justify-between tw:border-b tw:border-[var(--store-command-line)] tw:px-4 tw:py-4">
            <h2 className="tw:text-lg tw:font-semibold tw:text-[var(--store-command-ink)]">{model.t('storeKpis.companyManagersTitle')}</h2>
            <span className="tw:text-xs tw:text-[var(--store-command-muted)]">{model.t('storeKpis.companyVisibleManagerCount', { count: managers.length })}</span>
          </div>
          {managers.length > 0 ? managers.map((manager) => {
            const key = manager.userId ?? 'unassigned'
            return <ManagerAccordion key={`${key}:${sourcePeriod}`} manager={manager} model={model} open={expandedManager === key} onToggle={() => setExpandedManager(expandedManager === key ? null : key)} periodStart={sourcePeriod} />
          }) : <div className="tw:p-5"><StoreEmptyState title={model.t('storeKpis.companyStoresEmptyTitle')} description={model.t('storeKpis.companyStoresEmptyCopy')} /></div>}
        </section>

        {hasPrevious || hasNext ? (
          <nav aria-label={model.t('storeKpis.companyPaginationLabel')} className="tw:flex tw:items-center tw:justify-between tw:gap-3">
            <button type="button" disabled={!hasPrevious} className="tw:min-h-11 tw:rounded-xl tw:border tw:border-[var(--store-command-line)] tw:bg-white tw:px-4 tw:text-sm tw:font-semibold tw:disabled:opacity-40" onClick={() => setActivePage(Math.max(0, activePage - 1))}>{model.t('storeKpis.companyPrevious')}</button>
            <span className="tw:text-xs tw:text-[var(--store-command-muted)]">{model.t('storeKpis.companyPageSummary', { current: activePage + 1, total: Math.max(1, Math.ceil(activeListTotal / model.reportViewerPageSize)) })}</span>
            <button type="button" disabled={!hasNext} className="tw:min-h-11 tw:rounded-xl tw:border tw:border-[var(--store-command-line)] tw:bg-white tw:px-4 tw:text-sm tw:font-semibold tw:disabled:opacity-40" onClick={() => setActivePage(activePage + 1)}>{model.t('storeKpis.companyNext')}</button>
          </nav>
        ) : null}
      </div>
    </StoreSurfacePage>
  )
}

function ManagerAccordion(input: { manager: ManagerSummary; model: StoreKpiHighlightsPageModel; onToggle: () => void; open: boolean; periodStart: string }) {
  const [page, setPage] = useState(0)
  const pageSize = 50
  const query = useQuery({
    queryKey: ['store-kpis-company-manager-stores', input.manager.userId ?? 'unassigned', input.periodStart || 'latest', page, pageSize],
    queryFn: () => getRankings({ periodType: 'monthly', ...(input.periodStart ? { periodStart: input.periodStart } : {}), ...(input.manager.userId ? { regionManagerUserId: input.manager.userId } : { regionManagerUnassigned: true }), limit: pageSize, offset: page * pageSize }),
    enabled: input.open,
    ...transientQueryRetryOptions,
    placeholderData: (previous) => previous,
  })
  const managerName = input.manager.displayName ?? input.model.t('storeKpis.companyManagerUnavailable')
  const stores = query.data?.storeLeaderboard.items ?? []
  const total = query.data?.storeLeaderboard.meta.total ?? input.manager.storeCount
  const hasPrevious = page > 0
  const hasNext = (page + 1) * pageSize < total

  return (
    <article className="tw:border-b tw:border-[var(--store-command-line)] last:tw:border-b-0">
      <button type="button" aria-expanded={input.open} className="tw:flex tw:min-h-16 tw:w-full tw:items-center tw:gap-3 tw:bg-transparent tw:px-4 tw:text-left" onClick={input.onToggle}>
        <span className="tw:grid tw:size-9 tw:shrink-0 tw:place-items-center tw:rounded-full tw:bg-[var(--store-command-plum-soft)] tw:text-xs tw:font-bold tw:text-[var(--store-command-plum-deep)]">{initials(managerName)}</span>
        <span className="tw:min-w-0 tw:flex-1"><strong className="tw:block tw:truncate tw:text-sm tw:font-semibold tw:text-[var(--store-command-ink)]">{managerName}</strong><span className="tw:text-xs tw:text-[var(--store-command-muted)]">{input.model.t('storeKpis.companyManagerStoreCount', { count: input.manager.storeCount })} · {input.model.t('storeKpis.companyManagerRiskStoreCount', { count: input.manager.riskStoreCount })}</span></span>
        <strong className="tw:text-base tw:font-semibold tw:text-[var(--store-command-ink)]">{formatScore(input.model.locale, input.manager.averageScore, input.model.t('common.noData'))}</strong>
        <ChevronDown className={`tw:size-4 tw:transition ${input.open ? 'tw:rotate-180' : ''}`} />
      </button>
      {input.open ? (
        <div className="tw:bg-[var(--store-command-surface-soft)] tw:px-4 tw:pb-3 tw:sm:pl-14">
          {query.isLoading && !query.data ? <StoreLoadingState title={input.model.t('storeKpis.loadingTitle')} description={input.model.t('storeKpis.loadingCopy')} /> : query.isError && !query.data ? <StoreErrorState title={input.model.t('storeKpis.rowsErrorTitle')} description={input.model.t('storeKpis.companyManagerStoresError')} action={{ label: input.model.t('storeKpis.retry'), onClick: () => void query.refetch() }} /> : stores.length > 0 ? <>{query.isError ? <CompanyBackgroundError model={input.model} onRetry={() => void query.refetch()} /> : null}{stores.map((store) => {
            const storeName = store.storeName ?? input.model.t('storeKpis.noStoreScope')
            return <Link key={store.storeId} aria-label={input.model.t('storeKpis.companyOpenStoreLabel', { store: storeName })} className="tw:flex tw:min-h-14 tw:items-center tw:gap-3 tw:border-t tw:border-[var(--store-command-line)] tw:px-2 tw:text-[var(--store-command-ink)]" to={input.model.getCompanyStoreDetailPath(store.storeId)}><span className="tw:grid tw:size-8 tw:place-items-center tw:rounded-lg tw:bg-[var(--store-command-plum-soft)] tw:text-[var(--store-command-plum-deep)]"><Store className="tw:size-4" /></span><strong className="tw:min-w-0 tw:flex-1 tw:text-sm tw:font-semibold">{storeName}</strong><span className={`tw:text-xs tw:font-semibold ${store.scoreValue < 75 ? 'tw:text-[var(--store-command-danger)]' : 'tw:text-[var(--store-command-ink)]'}`}>{formatScore(input.model.locale, store.scoreValue, input.model.t('common.noData'))}</span><ArrowRight className="tw:size-4" /></Link>
          })}{hasPrevious || hasNext ? <nav aria-label={input.model.t('storeKpis.companyManagerStorePaginationLabel')} className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:py-3"><button type="button" disabled={!hasPrevious} className="tw:min-h-11 tw:rounded-xl tw:border tw:border-[var(--store-command-line)] tw:bg-white tw:px-3 tw:text-xs tw:font-semibold tw:disabled:opacity-40" onClick={() => setPage(Math.max(0, page - 1))}>{input.model.t('storeKpis.companyPrevious')}</button><span className="tw:text-xs tw:text-[var(--store-command-muted)]">{input.model.t('storeKpis.companyPageSummary', { current: page + 1, total: Math.max(1, Math.ceil(total / pageSize)) })}</span><button type="button" disabled={!hasNext} className="tw:min-h-11 tw:rounded-xl tw:border tw:border-[var(--store-command-line)] tw:bg-white tw:px-3 tw:text-xs tw:font-semibold tw:disabled:opacity-40" onClick={() => setPage(page + 1)}>{input.model.t('storeKpis.companyNext')}</button></nav> : null}</> : <StoreEmptyState title={input.model.t('storeKpis.companyStoresEmptyTitle')} description={input.model.t('storeKpis.companyStoresEmptyCopy')} />}
        </div>
      ) : null}
    </article>
  )
}

function CompanyBackgroundError(input: { model: StoreKpiHighlightsPageModel; onRetry: () => void }) {
  return <div role="alert" className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:rounded-xl tw:border tw:border-destructive/20 tw:bg-destructive/5 tw:p-3 tw:text-sm"><span>{input.model.t('storeKpis.backgroundError')}</span><button type="button" className="tw:min-h-11 tw:rounded-xl tw:border tw:border-border tw:bg-white tw:px-3 tw:font-semibold" onClick={input.onRetry}>{input.model.t('storeKpis.retry')}</button></div>
}

function CompanyMetric(input: { active: boolean; icon: typeof Users; label: string; onClick: () => void; value: string; tone?: 'plum' | 'cyan' | 'blue' | 'danger' }) {
  const Icon = input.icon
  const tone = input.tone ?? 'plum'
  const toneClass = tone === 'cyan' ? 'tw:bg-[var(--store-command-cyan-soft)] tw:text-[var(--store-command-accent-ink)]' : tone === 'blue' ? 'tw:bg-[var(--store-command-blue-soft)] tw:text-[var(--store-command-blue)]' : tone === 'danger' ? 'tw:bg-[var(--store-command-danger-soft)] tw:text-[var(--store-command-danger)]' : 'tw:bg-[var(--store-command-plum-soft)] tw:text-[var(--store-command-plum-deep)]'
  return <button type="button" aria-pressed={input.active} onClick={input.onClick} className={`tw:flex tw:min-h-[82px] tw:items-center tw:gap-3 tw:border-b tw:border-[var(--store-command-line)] tw:p-4 tw:text-left tw:transition tw:sm:border-r tw:xl:border-b-0 tw:last:border-r-0 ${input.active ? 'tw:bg-[linear-gradient(135deg,var(--store-command-plum-soft),var(--store-command-cyan-soft))]' : 'tw:bg-transparent tw:hover:bg-[var(--store-command-surface-soft)]'}`}><span className={`tw:grid tw:size-10 tw:place-items-center tw:rounded-xl ${toneClass}`}><Icon className="tw:size-5" /></span><span className="tw:min-w-0 tw:flex-1"><span className="tw:block tw:text-xs tw:text-[var(--store-command-muted)]">{input.label}</span><strong className="tw:mt-1 tw:block tw:text-2xl tw:font-semibold tw:text-[var(--store-command-ink)]">{input.value}</strong></span></button>
}

function stableManagerKey(manager: ManagerSummary) { return manager.displayName ?? `zzzz-${manager.userId ?? 'unassigned'}` }
function compareNullableScore(left: number | null, right: number | null) { if (left === null) return right === null ? 0 : 1; if (right === null) return -1; return left - right }
function formatScore(locale: string, value: number | null, unavailable: string) { return value === null || !Number.isFinite(value) ? unavailable : `%${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}` }
function formatInteger(locale: string, value: number) { return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value) }
function formatMonth(periodStart: string, locale: string) { return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(`${periodStart.slice(0, 10)}T00:00:00Z`)) }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '—' }
