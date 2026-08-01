import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, ChevronDown, ChevronUp, CircleAlert, ClipboardCheck, Store } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { ApiError } from '../../lib/api'
import { getBusinessMonthInputValue } from '../../lib/business-date'
import { getUserFacingErrorMessage } from '../../lib/format'
import { cn } from '../../lib/utils'
import { StoreErrorState, StoreLoadingState, StoreSurfacePage } from '../../pages/store-surface-primitives'
import type { AuthSessionSummary } from '../auth/api'
import {
  getStoreQueryScopeSignature,
  retainScopedPlaceholder,
  storeChecklistCommandQueryKey,
  storeChecklistCommandRegionsQueryKey,
  storeChecklistVisitPlanQueryKey,
} from '../auth/store-query-scope'
import { useLocalization } from '../localization/useLocalization'
import {
  getChecklistCommandCanvas,
  getChecklistCommandRegions,
  getChecklistVisitPlan,
  type ChecklistCommandRow,
} from './api'
import { ChecklistOperationalHistoryDrawer } from './ChecklistOperationalHistoryDrawer'
import {
  getChecklistPeriodWeekStart,
  getIstanbulWeekStart,
  type ChecklistCommandSort,
  type ChecklistCommandStatus,
  type ChecklistCommandRegionSort,
  type ChecklistCommandSignal,
} from './model'
import { ChecklistCommandPeriodPicker } from './ChecklistCommandPeriodPicker'

const REGION_PAGE_SIZE = 20
const STORE_PAGE_SIZE = 30

export function ReportViewerChecklistCommandPage(input: { authSummary: AuthSessionSummary | null }) {
  const { locale } = useLocalization()
  const copy = locale === 'tr' ? trCopy : enCopy
  const [period, setPeriod] = useState(() => getBusinessMonthInputValue())
  const [signal, setSignal] = useState<ChecklistCommandSignal>('all')
  const [sort, setSort] = useState<ChecklistCommandRegionSort>('manager_asc')
  const [regionOffset, setRegionOffset] = useState(0)
  const [openRegion, setOpenRegion] = useState<{ regionId: string; scopeSignature: string } | null>(null)
  const [storeOffset, setStoreOffset] = useState(0)
  const [storeQuery, setStoreQuery] = useState('')
  const [storeStatus, setStoreStatus] = useState<ChecklistCommandStatus>('all')
  const [storeSort, setStoreSort] = useState<ChecklistCommandSort>('store_asc')
  const [weekStart, setWeekStart] = useState(() => getIstanbulWeekStart())
  const [selectedStoreState, setSelectedStoreState] = useState<{ store: ChecklistCommandRow; scopeSignature: string } | null>(null)
  const historyTriggerRef = useRef<HTMLElement | null>(null)
  const scopeSignature = getStoreQueryScopeSignature(input.authSummary)
  const openRegionId = openRegion?.scopeSignature === scopeSignature ? openRegion.regionId : null
  const selectedStore = selectedStoreState?.scopeSignature === scopeSignature ? selectedStoreState.store : null
  const regionFilters = { period, signal, sort, limit: REGION_PAGE_SIZE, offset: regionOffset }
  const regionQuery = useQuery({
    queryKey: storeChecklistCommandRegionsQueryKey(input.authSummary, regionFilters),
    queryFn: () => getChecklistCommandRegions(regionFilters),
    placeholderData: (previous, previousQuery) => retainScopedPlaceholder(
      previous,
      previousQuery?.queryKey,
      scopeSignature,
    ),
  })
  const storeFilters = {
    period,
    regionId: openRegionId ?? '',
    status: storeStatus,
    sort: storeSort,
    query: storeQuery,
    limit: STORE_PAGE_SIZE,
    offset: storeOffset,
  }
  const storesQuery = useQuery({
    queryKey: storeChecklistCommandQueryKey(input.authSummary, storeFilters),
    queryFn: () => getChecklistCommandCanvas(storeFilters),
    enabled: Boolean(openRegionId),
    placeholderData: (previous, previousQuery) => {
      const previousFilters = previousQuery?.queryKey[2] as typeof storeFilters | undefined
      return retainScopedPlaceholder(
        previous,
        previousQuery?.queryKey,
        scopeSignature,
        previousFilters?.regionId === storeFilters.regionId && previousFilters?.period === storeFilters.period,
      )
    },
  })
  const planQuery = useQuery({
    queryKey: storeChecklistVisitPlanQueryKey(input.authSummary, openRegionId ?? 'closed', weekStart),
    queryFn: () => getChecklistVisitPlan({ regionId: openRegionId!, weekStart }),
    enabled: Boolean(openRegionId),
  })

  if (!regionQuery.data && regionQuery.isLoading) {
    return <StoreLoadingState title={copy.loadingTitle} description={copy.loadingCopy} />
  }
  if (!regionQuery.data) {
    const forbidden = regionQuery.error instanceof ApiError && regionQuery.error.status === 403
    return <StoreSurfacePage ariaLabel={copy.aria}><StoreErrorState title={forbidden ? copy.forbiddenTitle : copy.errorTitle} description={forbidden ? copy.forbiddenCopy : getUserFacingErrorMessage(regionQuery.error, copy.errorCopy)} {...(forbidden ? {} : { action: { label: copy.retry, onClick: () => void regionQuery.refetch(), variant: 'outline' as const } })} /></StoreSurfacePage>
  }

  const data = regionQuery.data.data
  const metrics = [
    { key: 'all' as const, label: copy.totalStores, value: data.metrics.totalStores, icon: Store },
    { key: 'missing_visit' as const, label: copy.missingVisits, value: data.metrics.missingVisitStores, icon: CircleAlert },
    { key: 'open_actions' as const, label: copy.openActions, value: data.metrics.storesWithOpenActions, icon: ClipboardCheck },
    { key: 'completed_coverage' as const, label: copy.completedCoverage, value: data.metrics.completedCoverageStores, icon: Building2 },
  ]

  return (
    <>
      <StoreSurfacePage ariaLabel={copy.aria} className="tw:max-w-[1180px] tw:gap-3">
        <header className="tw:flex tw:flex-wrap tw:items-end tw:justify-between tw:gap-3">
          <div className="tw:min-w-0">
            <p className="tw:text-[10px] tw:font-bold tw:uppercase tw:tracking-[.14em] tw:text-muted-foreground">{copy.breadcrumb}</p>
            <h1 className="tw:mt-1 tw:text-2xl tw:font-semibold tw:tracking-[-.035em]">{copy.title}</h1>
            <p className="tw:mt-1 tw:text-xs tw:text-muted-foreground">{copy.scope}</p>
          </div>
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            <span className="tw:rounded-full tw:bg-primary/10 tw:px-3 tw:py-1.5 tw:text-[10px] tw:font-semibold tw:text-primary">{copy.readOnly}</span>
            <ChecklistCommandPeriodPicker locale={locale} period={period} onChange={(value: string) => { setPeriod(value); setWeekStart(getChecklistPeriodWeekStart(value)); setRegionOffset(0); setStoreOffset(0); setOpenRegion(null) }} />
          </div>
        </header>

        <section className="tw:grid tw:grid-cols-2 tw:overflow-hidden tw:rounded-2xl tw:border tw:border-border tw:bg-card tw:lg:grid-cols-4" aria-label={copy.metrics}>
          {metrics.map(({ key, label, value, icon: Icon }) => (
            <button key={key} type="button" aria-pressed={signal === key} className="tw:flex tw:min-h-24 tw:items-center tw:gap-3 tw:border-b tw:border-r tw:border-border tw:p-4 tw:text-left tw:hover:bg-muted/25 tw:aria-pressed:bg-primary/5" onClick={() => { setSignal(key); setRegionOffset(0); setStoreOffset(0); setOpenRegion(null) }}>
              <span className="tw:grid tw:size-9 tw:shrink-0 tw:place-items-center tw:rounded-xl tw:bg-primary/10 tw:text-primary"><Icon className="tw:size-4" /></span>
              <span className="tw:min-w-0"><small className="tw:block tw:text-[9px] tw:font-semibold tw:text-muted-foreground">{label}</small><strong className="tw:text-2xl tw:tabular-nums">{value}</strong></span>
            </button>
          ))}
        </section>

        <nav aria-label={copy.sortAria} className="tw:flex tw:flex-wrap tw:gap-1.5 tw:rounded-xl tw:border tw:border-border tw:bg-muted/20 tw:p-2">
          {([
            ['manager_asc', copy.manager], ['stores_desc', copy.storeCount], ['missing_desc', copy.missingVisits],
            ['open_actions_desc', copy.openActions], ['score_desc', copy.score],
          ] as const).map(([value, label]) => <Button key={value} size="sm" type="button" variant={sort === value ? 'secondary' : 'ghost'} onClick={() => { setSort(value); setRegionOffset(0) }}>{label}</Button>)}
        </nav>

        {regionQuery.isError ? (
          <div role="alert" className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-xl tw:border tw:border-destructive/25 tw:bg-destructive/5 tw:p-3 tw:text-xs tw:text-destructive"><span>{copy.partialError}</span><Button size="sm" variant="outline" onClick={() => void regionQuery.refetch()}>{copy.retry}</Button></div>
        ) : null}

        <section className="tw:overflow-hidden tw:rounded-2xl tw:border tw:border-border tw:bg-card">
          {data.items.length === 0 ? <EmptyState title={copy.emptyTitle} copy={copy.emptyCopy} /> : data.items.map((region) => {
            const expanded = openRegionId === region.regionId
            return (
              <article key={region.regionId} className="tw:border-b tw:border-border tw:last:border-b-0">
                <button type="button" aria-expanded={expanded} className="tw:grid tw:w-full tw:grid-cols-[minmax(0,1fr)_auto] tw:items-center tw:gap-3 tw:bg-transparent tw:p-4 tw:text-left tw:hover:bg-muted/25" onClick={() => { setOpenRegion(expanded ? null : { regionId: region.regionId, scopeSignature }); setStoreOffset(0) }}>
                  <span className="tw:min-w-0"><strong className="tw:block tw:truncate tw:text-sm">{region.regionManagers.map((manager) => manager.displayName).join(', ') || copy.noManager}</strong><small className="tw:text-[10px] tw:text-muted-foreground">{region.regionName} · {region.metrics.totalStores} {copy.stores}</small></span>
                  <span className="tw:flex tw:items-center tw:gap-3"><span className="tw:hidden tw:text-[10px] tw:text-muted-foreground tw:sm:inline">{region.visitAverageScore === null ? '—' : Math.round(region.visitAverageScore)} {copy.points} · {region.metrics.openActionCount} {copy.openShort}</span>{expanded ? <ChevronUp className="tw:size-4" /> : <ChevronDown className="tw:size-4" />}</span>
                </button>
                {expanded ? (
                  <RegionReadback
                    copy={copy}
                    locale={locale}
                    planQuery={planQuery}
                    storesQuery={storesQuery}
                    offset={storeOffset}
                    query={storeQuery}
                    status={storeStatus}
                    sort={storeSort}
                    weekStart={weekStart}
                    onOffset={setStoreOffset}
                    onQuery={(value) => { setStoreQuery(value); setStoreOffset(0) }}
                    onStatus={(value) => { setStoreStatus(value); setStoreOffset(0) }}
                    onSort={(value) => { setStoreSort(value); setStoreOffset(0) }}
                    onWeekStart={setWeekStart}
                    onOpenHistory={(store, trigger) => { historyTriggerRef.current = trigger; setSelectedStoreState({ store, scopeSignature }) }}
                  />
                ) : null}
              </article>
            )
          })}
          <footer className="tw:flex tw:justify-end tw:gap-2 tw:border-t tw:border-border tw:bg-muted/20 tw:p-3"><Button size="sm" variant="outline" disabled={regionOffset === 0} onClick={() => setRegionOffset(Math.max(0, regionOffset - REGION_PAGE_SIZE))}>{copy.previous}</Button><Button size="sm" variant="outline" disabled={!data.page.hasMore} onClick={() => setRegionOffset(regionOffset + REGION_PAGE_SIZE)}>{copy.next}</Button></footer>
        </section>
      </StoreSurfacePage>

      <ChecklistOperationalHistoryDrawer authSummary={input.authSummary} open={Boolean(selectedStore)} storeId={selectedStore?.storeId ?? null} storeName={selectedStore?.storeName ?? null} returnFocusRef={historyTriggerRef} onClose={() => setSelectedStoreState(null)} />
    </>
  )
}

function RegionReadback(input: {
  copy: typeof trCopy | typeof enCopy
  locale: 'tr' | 'en'
  offset: number
  query: string
  status: ChecklistCommandStatus
  sort: ChecklistCommandSort
  weekStart: string
  onOffset: (value: number) => void
  onQuery: (value: string) => void
  onStatus: (value: ChecklistCommandStatus) => void
  onSort: (value: ChecklistCommandSort) => void
  onWeekStart: (value: string) => void
  onOpenHistory: (store: ChecklistCommandRow, trigger: HTMLElement) => void
  planQuery: ReturnType<typeof useQuery<Awaited<ReturnType<typeof getChecklistVisitPlan>>>>
  storesQuery: ReturnType<typeof useQuery<Awaited<ReturnType<typeof getChecklistCommandCanvas>>>>
}) {
  const plan = input.planQuery.data?.data
  const [retainedStores, setRetainedStores] = useState<Awaited<ReturnType<typeof getChecklistCommandCanvas>>['data'] | null>(null)
  const stores = input.storesQuery.data?.data ?? retainedStores
  const changeOffset = (value: number) => {
    if (stores) setRetainedStores(stores)
    input.onOffset(value)
  }
  return <div className="tw:grid tw:min-w-0 tw:gap-3 tw:bg-muted/15 tw:p-3">
    <section className="tw:rounded-xl tw:border tw:border-border tw:bg-card tw:p-3" aria-label={input.copy.weeklyPlan}>
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
        <strong className="tw:text-xs">{input.copy.weeklyPlan}</strong>
        <span className="tw:flex tw:items-center tw:gap-1">
          <Button size="sm" variant="ghost" aria-label={input.locale === 'tr' ? 'Önceki hafta' : 'Previous week'} onClick={() => input.onWeekStart(addIsoDays(input.weekStart, -7))}>‹</Button>
          <small className="tw:min-w-24 tw:text-center tw:text-[9px] tw:font-semibold tw:text-muted-foreground">{formatWeekRange(input.weekStart, input.locale)}</small>
          <Button size="sm" variant="ghost" aria-label={input.locale === 'tr' ? 'Sonraki hafta' : 'Next week'} onClick={() => input.onWeekStart(addIsoDays(input.weekStart, 7))}>›</Button>
        </span>
      </div>
      <p className="tw:mt-1 tw:text-[10px] tw:text-muted-foreground">{input.planQuery.isLoading ? input.copy.planLoading : `${plan?.items.length ?? 0} ${input.copy.plannedVisits}`}</p>
      {input.planQuery.isError ? <InlineReadError error={input.planQuery.error} copy={input.copy} fallback={input.copy.planError} onRetry={() => void input.planQuery.refetch()} /> : null}
      {plan && plan.items.length > 0 ? <div className="tw:mt-3 tw:grid tw:gap-1.5 tw:sm:grid-cols-2">
        {plan.items.map((item) => <span key={item.planItemId} className="tw:grid tw:min-w-0 tw:grid-cols-[minmax(0,1fr)_auto] tw:gap-2 tw:rounded-lg tw:bg-muted/30 tw:px-2.5 tw:py-2"><span className="tw:min-w-0"><strong className="tw:block tw:truncate tw:text-[10px]">{item.storeName}</strong><small className="tw:text-[9px] tw:text-muted-foreground">{new Intl.DateTimeFormat(input.locale === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul' }).format(new Date(`${item.plannedDate}T12:00:00+03:00`))}</small></span><small className={cn('tw:self-center tw:rounded-full tw:px-2 tw:py-1 tw:text-[8px] tw:font-semibold', item.status === 'completed' ? 'tw:bg-emerald-500/10 tw:text-emerald-700' : item.status === 'missed' ? 'tw:bg-destructive/10 tw:text-destructive' : 'tw:bg-amber-500/10 tw:text-amber-700')}>{item.status === 'completed' ? input.copy.visitDone : item.status === 'missed' ? input.copy.checklistMissing : input.copy.visitWaiting}</small></span>)}
      </div> : null}
    </section>
    <div className="tw:grid tw:min-w-0 tw:gap-2 tw:rounded-xl tw:border tw:border-border tw:bg-card tw:p-2 tw:sm:grid-cols-[minmax(180px,1fr)_150px_170px]">
      <Input
        aria-label={input.locale === 'tr' ? 'Mağaza ara' : 'Search stores'}
        className="tw:min-w-0 tw:text-base tw:sm:text-xs"
        placeholder={input.locale === 'tr' ? 'Mağaza ara' : 'Search stores'}
        value={input.query}
        onChange={(event) => input.onQuery(event.target.value)}
      />
      <Select value={input.status} onValueChange={(value) => input.onStatus(value as ChecklistCommandStatus)}>
        <SelectTrigger aria-label={input.locale === 'tr' ? 'Mağaza durumu' : 'Store status'}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{input.locale === 'tr' ? 'Tüm mağazalar' : 'All stores'}</SelectItem>
          <SelectItem value="needs_visit">{input.copy.missingVisits}</SelectItem>
          <SelectItem value="active">{input.locale === 'tr' ? 'Devam eden' : 'Active'}</SelectItem>
          <SelectItem value="pending">{input.locale === 'tr' ? 'Onay bekleyen' : 'Pending acknowledgement'}</SelectItem>
          <SelectItem value="completed">{input.locale === 'tr' ? 'Tamamlanan' : 'Completed'}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={input.sort} onValueChange={(value) => input.onSort(value as ChecklistCommandSort)}>
        <SelectTrigger aria-label={input.locale === 'tr' ? 'Mağazaları sırala' : 'Sort stores'}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="store_asc">{input.locale === 'tr' ? 'Mağaza A-Z' : 'Store A-Z'}</SelectItem>
          <SelectItem value="store_desc">{input.locale === 'tr' ? 'Mağaza Z-A' : 'Store Z-A'}</SelectItem>
          <SelectItem value="last_visit_desc">{input.locale === 'tr' ? 'Son ziyaret yeni' : 'Newest visit'}</SelectItem>
          <SelectItem value="last_visit_asc">{input.locale === 'tr' ? 'Son ziyaret eski' : 'Oldest visit'}</SelectItem>
          <SelectItem value="open_actions_desc">{input.locale === 'tr' ? 'Açık aksiyon çok' : 'Most open actions'}</SelectItem>
          <SelectItem value="status_asc">{input.locale === 'tr' ? 'Durum A-Z' : 'Status A-Z'}</SelectItem>
          <SelectItem value="status_desc">{input.locale === 'tr' ? 'Durum Z-A' : 'Status Z-A'}</SelectItem>
        </SelectContent>
      </Select>
    </div>
    {input.storesQuery.isLoading && !stores ? <p className="tw:p-3 tw:text-xs tw:text-muted-foreground">{input.copy.storesLoading}</p> : null}
    {input.storesQuery.isError && !stores ? <InlineReadError error={input.storesQuery.error} copy={input.copy} fallback={input.copy.storesError} onRetry={() => void input.storesQuery.refetch()} /> : null}
    {input.storesQuery.isError && stores ? <InlineReadError error={input.storesQuery.error} copy={input.copy} fallback={input.copy === trCopy ? 'Yeni mağaza sayfası alınamadı; mevcut satırlar korunuyor.' : 'The next store page could not load; current rows are retained.'} onRetry={() => void input.storesQuery.refetch()} /> : null}
    {stores?.items.map((store) => <article key={store.storeId} className="tw:grid tw:min-w-0 tw:grid-cols-[minmax(0,1fr)_auto] tw:items-center tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-card tw:p-3"><span className="tw:min-w-0"><strong className="tw:block tw:truncate tw:text-xs">{store.storeName}</strong><small className="tw:block tw:text-[9px] tw:text-muted-foreground">BM {formatScore(store.bmScore)} · VM {formatScore(store.vmScore)}</small><small className="tw:block tw:text-[9px] tw:text-muted-foreground">{store.lastCompletedVisitAt ? `${formatCompactDate(store.lastCompletedVisitAt, input.locale)} · ${store.elapsedDaysSinceLastVisit ?? 0} ${input.copy.days}` : input.copy.noVisit} · {store.openActionCount} {input.copy.openShort}</small></span><Button size="sm" variant="outline" onClick={(event) => input.onOpenHistory(store, event.currentTarget)}>{input.copy.openRecord}</Button></article>)}
    {stores && stores.items.length === 0 ? <EmptyState title={input.copy.noStores} copy={input.copy.noStoresCopy} /> : null}
    {stores ? <div className="tw:flex tw:justify-end tw:gap-2"><Button size="sm" variant="outline" disabled={input.offset === 0} onClick={() => changeOffset(Math.max(0, input.offset - STORE_PAGE_SIZE))}>{input.copy.previous}</Button><Button size="sm" variant="outline" disabled={!stores.page.hasMore} onClick={() => changeOffset(input.offset + STORE_PAGE_SIZE)}>{input.copy.next}</Button></div> : null}
  </div>
}

function InlineReadError(input: { error: unknown; copy: typeof trCopy | typeof enCopy; fallback: string; onRetry: () => void }) {
  const forbidden = input.error instanceof ApiError && input.error.status === 403
  const message = forbidden
    ? input.copy === trCopy ? 'Bu alt kayıt yetkili şirket kapsamında değil.' : 'This nested record is outside the authorized company scope.'
    : input.fallback
  return <div role="alert" className="tw:mt-2 tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-lg tw:border tw:border-destructive/20 tw:bg-destructive/5 tw:p-2.5 tw:text-[10px] tw:text-destructive"><span>{message}</span>{forbidden ? null : <Button size="sm" variant="outline" onClick={input.onRetry}>{input.copy.retry}</Button>}</div>
}

function EmptyState({ title, copy }: { title: string; copy: string }) { return <div className="tw:grid tw:min-h-40 tw:place-items-center tw:p-6 tw:text-center"><div><strong className="tw:text-sm">{title}</strong><p className="tw:mt-1 tw:text-xs tw:text-muted-foreground">{copy}</p></div></div> }
function formatScore(value: number | null) { return value === null ? '—' : Math.round(value) }
function formatCompactDate(value: string, locale: 'tr' | 'en') { return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul' }).format(new Date(value)) }
function addIsoDays(value: string, amount: number) { const date = new Date(`${value}T12:00:00+03:00`); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10) }
function formatWeekRange(value: string, locale: 'tr' | 'en') { const formatter = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul' }); return `${formatter.format(new Date(`${value}T12:00:00+03:00`))} – ${formatter.format(new Date(`${addIsoDays(value, 5)}T12:00:00+03:00`))}` }

const trCopy = { aria: 'Şirket kontrol görünümü', breadcrumb: 'Şirket · Bölge müdürleri · Mağazalar', title: 'Şirket Saha Görünümü', scope: 'Yetkili şirket kapsamındaki tüm bölge müdürleri ve mağazalar', readOnly: 'Salt okunur', loadingTitle: 'Şirket görünümü yükleniyor', loadingCopy: 'Bölge ve mağaza kapsamı hazırlanıyor.', errorTitle: 'Şirket görünümü açılamadı', errorCopy: 'Bölge verileri okunamadı.', forbiddenTitle: 'Şirket kapsamına erişilemiyor', forbiddenCopy: 'Report Viewer hesabına yetkili şirket kapsamı tanımlanmamış.', retry: 'Tekrar dene', metrics: 'Şirket kontrol özeti', totalStores: 'Toplam mağaza', missingVisits: 'Ziyaret eksiği', openActions: 'Açık aksiyonlu', completedCoverage: 'Kapsam tamam', sortAria: 'Bölgeleri sırala', manager: 'Bölge müdürü', storeCount: 'Mağaza sayısı', score: 'Ortalama puan', partialError: 'Yeni bölge verileri alınamadı; mevcut görünüm korunuyor.', emptyTitle: 'Bu filtrede bölge yok', emptyCopy: 'Şirket kapsamı veya seçili filtre sonuç üretmedi.', noManager: 'Bölge müdürü tanımlı değil', stores: 'mağaza', points: 'puan', openShort: 'açık aksiyon', previous: 'Önceki', next: 'Sonraki', weeklyPlan: 'Haftalık ziyaret planı', planLoading: 'Plan okunuyor…', planError: 'Haftalık plan okunamadı.', plannedVisits: 'planlı ziyaret', visitDone: 'Ziyaret Tamamlandı', checklistMissing: 'Checklist yapılmadı', visitWaiting: 'Ziyaret Bekleniyor', storesLoading: 'Mağazalar yükleniyor…', storesError: 'Mağazalar okunamadı.', openRecord: 'Mağaza kaydını aç', noStores: 'Bu bölgede mağaza yok', noStoresCopy: 'Seçili filtreye uyan mağaza bulunamadı.', noVisit: 'tamamlanmış ziyaret yok', days: 'gün', } as const
const enCopy = { aria: 'Company control view', breadcrumb: 'Company · Region managers · Stores', title: 'Company Field View', scope: 'All region managers and stores in the authorized company scope', readOnly: 'Read only', loadingTitle: 'Loading company view', loadingCopy: 'Preparing region and store scope.', errorTitle: 'Company view unavailable', errorCopy: 'Region data could not be read.', forbiddenTitle: 'Company scope unavailable', forbiddenCopy: 'No authorized company scope is assigned to this Report Viewer account.', retry: 'Retry', metrics: 'Company control summary', totalStores: 'Total stores', missingVisits: 'Missing visits', openActions: 'With open actions', completedCoverage: 'Coverage complete', sortAria: 'Sort regions', manager: 'Region manager', storeCount: 'Store count', score: 'Average score', partialError: 'New region data could not load; existing results are retained.', emptyTitle: 'No regions for this filter', emptyCopy: 'The company scope or selected filter returned no regions.', noManager: 'No region manager assigned', stores: 'stores', points: 'points', openShort: 'open actions', previous: 'Previous', next: 'Next', weeklyPlan: 'Weekly visit plan', planLoading: 'Loading plan…', planError: 'Weekly plan unavailable.', plannedVisits: 'planned visits', visitDone: 'Visit completed', checklistMissing: 'Checklist not completed', visitWaiting: 'Visit pending', storesLoading: 'Loading stores…', storesError: 'Stores could not be read.', openRecord: 'Open store record', noStores: 'No stores in this region', noStoresCopy: 'No stores matched the selected filter.', noVisit: 'no completed visit', days: 'days', } as const
