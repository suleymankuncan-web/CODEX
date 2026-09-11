import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, ChevronLeft, ChevronRight, Search, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { getRankings } from '../features/reports/api'
import { transientQueryRetryOptions } from '../lib/query-retry'
import { ApiError } from '../lib/api'
import { CommandCanvasPage } from '../features/store-command-canvas/primitives'
import type { StoreKpiHighlightsPageModel, StoreKpisRegionSortKey } from './store-kpi-highlights-model'
import { StoreKpisPeriodPicker } from './store-kpis-period-picker'
import { StoreKpisPeriodEmpty } from './store-kpis-period-empty'
import { StoreEmptyState, StoreErrorState, StoreLoadingState } from './store-surface-primitives'
import { CompanyKpiStoreList } from './store-kpis-company-store-list'
import { sortKpiStoreRows } from './store-kpis-command-contract'
import './store-kpis-region-command-canvas.css'
import './store-kpis-company-overview.css'

type ManagerSelection = { key: string; name: string; userId: string | null }

export function StoreKpisCompanyOverview({ model }: { model: StoreKpiHighlightsPageModel }) {
  const [selected, setSelected] = useState<ManagerSelection | null>(null)
  const [managerSearch, setManagerSearch] = useState('')
  const ranking = model.reportViewerOverviewQuery.data
  const period = model.reportViewerActivePeriodStart || ranking?.source.periodStart || ''
  const managers = [...(ranking?.regionManagerLeaderboard.items ?? [])].sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? '', model.locale))
  const managerTotal = ranking?.regionManagerLeaderboard.meta.total ?? 0
  const periodLabel = model.kpiDateRangeEnd ? `${period} – ${model.kpiDateRangeEnd}` : period ? new Intl.DateTimeFormat(model.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${period.slice(0, 10)}T00:00:00Z`)) : ''

  return <CommandCanvasPage ariaLabelledBy="company-kpi-title" className="region-performance company-performance" testId="store-kpis-company-overview">
    <header className="region-performance-hero tw:relative tw:isolate tw:overflow-visible tw:rounded-[14px] tw:bg-primary tw:px-4 tw:py-4 tw:text-primary-foreground tw:shadow-sm tw:sm:px-5">
      <div aria-hidden="true" className="tw:pointer-events-none tw:absolute tw:inset-0 tw:overflow-hidden tw:rounded-[14px]"><span className="tw:absolute tw:right-3 tw:top-3 tw:size-32 tw:rounded-full tw:border tw:border-white/15" /></div>
      <div className="region-performance-heading tw:relative">
        <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
          <span className="tw:grid tw:size-10 tw:shrink-0 tw:place-items-center tw:rounded-xl tw:border tw:border-white/20 tw:bg-white/10"><BarChart3 aria-hidden="true" className="tw:size-5" /></span>
          <div className="tw:min-w-0">
            <p className="tw:text-[10px] tw:font-semibold tw:uppercase tw:tracking-[0.16em] tw:text-primary-foreground/70">{periodLabel}</p>
            <h1 id="company-kpi-title" className="tw:mt-0.5 tw:text-xl tw:font-semibold tw:tracking-[-0.025em] tw:sm:text-2xl">LUFIAN Mağaza Performansı</h1>
            <p className="tw:mt-1 tw:text-xs tw:text-primary-foreground/75">Mağaza KPI değerlerini bölge müdürüne göre inceleyin.</p>
          </div>
        </div>
        <StoreKpisPeriodPicker onRangeChange={(start, end) => { model.setKpiDateRange(start, end); setSelected(null); setManagerSearch('') }} ariaLabel={model.t('storeKpis.companyPeriodSelect')} availablePeriodStarts={ranking?.availablePeriods.filter(p => p.periodType === 'monthly').map(p => p.periodStart) ?? []} locale={model.locale} onPeriodStartChange={value => { model.setReportViewerPeriodStart(value); setSelected(null); setManagerSearch('') }} periodStart={period} triggerClassName="region-performance-period" />
      </div>
    </header>
    {model.reportViewerOverviewQuery.isError && ranking ? <Alert variant="destructive"><AlertDescription>{model.t('storeKpis.backgroundError')}<Button variant="outline" onClick={() => void model.reportViewerOverviewQuery.refetch()}>{model.t('storeKpis.retry')}</Button></AlertDescription></Alert> : null}
    <div className="company-performance-layout">
      <aside className="company-performance-managers" aria-label="Bölge müdürü seçimi">
        <header className="company-performance-directory-header">
          <div><div><p>DİZİN</p><h2>Bölge müdürleri</h2></div><span>{managerTotal}</span></div>
          <InputGroup><InputGroupInput aria-label={managerTotal > managers.length ? 'Bu sayfada bölge müdürü ara' : 'Bölge müdürü ara'} placeholder={managerTotal > managers.length ? 'Bu sayfada ad ile ara' : 'Ad ile ara'} value={managerSearch} onChange={event => setManagerSearch(event.target.value)} /><InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon></InputGroup>
        </header>
        <nav aria-label="Mağaza görünümü">
          <Button variant="ghost" className="company-performance-manager-row" aria-label="Tüm Mağazalar" aria-current={selected === null ? 'true' : undefined} aria-pressed={selected === null} onClick={() => setSelected(null)}>
            <Avatar className="company-performance-manager-avatar"><AvatarFallback><Store aria-hidden="true" /></AvatarFallback></Avatar>
            <span className="company-performance-manager-name"><strong>Tüm Mağazalar</strong><small>Tüm bölge müdürleri</small></span>
          </Button>
          {managers.filter(manager => !managerSearch.trim() || (manager.displayName ?? '').toLocaleLowerCase(model.locale).includes(managerSearch.trim().toLocaleLowerCase(model.locale))).map(manager => {
            const key = manager.userId ?? 'unassigned'
            const name = manager.displayName ?? model.t('storeKpis.companyManagerUnavailable')
            const score = manager.averageScore === null || !Number.isFinite(manager.averageScore) ? model.t('common.noData') : new Intl.NumberFormat(model.locale, { maximumFractionDigits: 1 }).format(manager.averageScore)
            const words = name.trim().split(/\s+/)
            const initials = `${words[0]?.[0] ?? ''}${words.at(-1)?.[0] ?? ''}`.toLocaleUpperCase(model.locale)
            return <Button key={key} variant="ghost" className="company-performance-manager-row" aria-label={`${name} Bölge puanı: ${score}`} aria-current={selected?.key === key ? 'true' : undefined} aria-pressed={selected?.key === key} onClick={() => setSelected({ key, name, userId: manager.userId })}>
              <Avatar className="company-performance-manager-avatar"><AvatarFallback>{initials}</AvatarFallback></Avatar>
              <span className="company-performance-manager-name"><strong>{name}</strong><small>{manager.storeCount} sorumlu mağaza</small></span>
              <strong className="company-performance-manager-score">{score}</strong>
            </Button>
          })}
          {managerSearch && !managers.some(manager => (manager.displayName ?? '').toLocaleLowerCase(model.locale).includes(managerSearch.trim().toLocaleLowerCase(model.locale))) ? <p className="company-performance-manager-empty">Eşleşen bölge müdürü yok.</p> : null}
        </nav>
        <footer className="company-performance-manager-pager">
          <span>{model.reportViewerPage + 1} / {Math.max(1, Math.ceil(managerTotal / model.reportViewerPageSize))}</span>
          <div><Button variant="ghost" size="icon-xs" aria-label="Önceki bölge müdürleri" disabled={model.reportViewerPage === 0} onClick={() => { model.setReportViewerPage(model.reportViewerPage - 1); setManagerSearch('') }}><ChevronLeft /></Button>
          <Button variant="ghost" size="icon-xs" aria-label="Sonraki bölge müdürleri" disabled={(model.reportViewerPage + 1) * model.reportViewerPageSize >= managerTotal} onClick={() => { model.setReportViewerPage(model.reportViewerPage + 1); setManagerSearch('') }}><ChevronRight /></Button></div>
        </footer>
      </aside>
      <CompanyStores key={`${period}:${model.kpiDateRangeEnd}:${selected?.key ?? 'all'}`} model={model} period={period} selected={selected} />
    </div>
  </CommandCanvasPage>
}

function CompanyStores({ model, period, selected }: { model: StoreKpiHighlightsPageModel; period: string; selected: ManagerSelection | null }) {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: StoreKpisRegionSortKey; direction: 'asc' | 'desc' }>({ key: 'score', direction: 'desc' })
  const limit = 50
  const query = useQuery({
    queryKey: ['store-kpis-company-store-list', period, model.kpiDateRangeEnd, selected?.key ?? 'all', page],
    queryFn: () => getRankings({ periodType: model.kpiDateRangeEnd ? 'daily' : 'monthly', ...(model.kpiDateRangeEnd ? { periodEnd: model.kpiDateRangeEnd } : {}), periodStart: period, ...(selected ? selected.userId ? { regionManagerUserId: selected.userId } : { regionManagerUnassigned: true } : {}), limit, offset: page * limit }),
    enabled: Boolean(period),
    ...transientQueryRetryOptions,
    placeholderData: previous => previous,
  })
  const protectedError = query.error instanceof ApiError && (query.error.status === 401 || query.error.status === 403)
  const data = protectedError ? undefined : query.data
  const total = data?.storeLeaderboard.meta.total ?? 0
  const pageScoped = total > (data?.storeLeaderboard.items.length ?? 0)
  const rows = sortKpiStoreRows(data?.storeLeaderboard.items ?? [], sort.key, sort.direction).filter(row => !search.trim() || (row.storeName ?? '').toLocaleLowerCase(model.locale).includes(search.trim().toLocaleLowerCase(model.locale)))
  const changeSort = (key: StoreKpisRegionSortKey, direction?: 'asc' | 'desc') => setSort(current => ({ key, direction: direction ?? (current.key === key && current.direction === 'desc' ? 'asc' : 'desc') }))

  return <section className="region-performance-stores" aria-label={selected?.name ?? 'Tüm Mağazalar'} aria-busy={query.isFetching}>
    <div className="region-performance-toolbar">
      <div className="region-performance-list-heading"><h2>{selected?.name ?? 'Tüm Mağazalar'}</h2>{data ? <Badge variant="secondary">{search ? rows.length : total}</Badge> : null}</div>
      <InputGroup className="region-performance-search"><InputGroupInput aria-label={pageScoped ? 'Bu sayfada mağaza ara' : 'Mağaza ara'} placeholder={pageScoped ? 'Bu sayfada mağaza ara…' : 'Mağaza ara…'} value={search} onChange={event => setSearch(event.target.value)} /><InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon></InputGroup>
    </div>
    {!data && query.isLoading ? <StoreLoadingState title={model.t('storeKpis.loadingTitle')} description={model.t('storeKpis.loadingCopy')} /> : !data && query.isError ? <StoreErrorState title={model.t('storeKpis.rowsErrorTitle')} description={model.t('storeKpis.companyManagerStoresError')} action={{ label: model.t('storeKpis.retry'), onClick: () => void query.refetch() }} /> : <>
      {query.isError && data ? <Alert variant="destructive"><AlertDescription>{model.t('storeKpis.backgroundError')}<Button variant="outline" onClick={() => void query.refetch()}>{model.t('storeKpis.retry')}</Button></AlertDescription></Alert> : null}
      {rows.length > 0 ? <CompanyKpiStoreList rows={rows} model={model} sort={sort} onSort={changeSort} /> : total === 0 ? <StoreKpisPeriodEmpty locale={model.locale} start={period} end={model.kpiDateRangeEnd} /> : <StoreEmptyState title="Mağaza bulunamadı" description="Aramanızı değiştirerek tekrar deneyin." />}
    </>}
    {total > limit ? <nav className="region-performance-pager" aria-label="Mağaza sayfaları"><span>{page * limit + 1}–{Math.min((page + 1) * limit, total)} / {total}</span><Button variant="outline" disabled={page === 0 || query.isFetching} onClick={() => { setPage(page - 1); setSearch('') }}>Önceki</Button><Button variant="outline" disabled={(page + 1) * limit >= total || query.isFetching} onClick={() => { setPage(page + 1); setSearch('') }}>Sonraki</Button></nav> : null}
  </section>
}
