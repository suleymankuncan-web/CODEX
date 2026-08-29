import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, LoaderCircle, Search, UsersRound } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { ApiError } from '../../lib/api'
import { getBusinessMonthInputValue } from '../../lib/business-date'
import { getUserFacingErrorMessage } from '../../lib/format'
import { StoreErrorState, StoreLoadingState, StoreSurfacePage } from '../../pages/store-surface-primitives'
import type { AuthSessionSummary } from '../auth/api'
import { getStoreQueryScopeSignature, retainScopedPlaceholder, storeChecklistCommandQueryKey, storeChecklistCommandRegionsQueryKey } from '../auth/store-query-scope'
import { useLocalization } from '../localization/useLocalization'
import { getChecklistCommandCanvas, getChecklistCommandRegions, type ChecklistCommandRegion } from './api'
import { ReportViewerManagerWorkspace } from './ReportViewerManagerWorkspace'
import { ReportViewerPeriodPicker } from './ReportViewerPeriodPicker'
import { ReportViewerVisitCalendarDialog, type ReportViewerManagerOption } from './ReportViewerVisitCalendarDialog'

const REGION_PAGE_SIZE = 20

export function ReportViewerChecklistCommandPage(input: {
  authSummary: AuthSessionSummary | null
  onOpenResult: (checklistInstanceId: string) => void
}) {
  const { locale } = useLocalization()
  const copy = locale === 'tr' ? trCopy : enCopy
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState(() => getBusinessMonthInputValue())
  const [search, setSearch] = useState('')
  const [regionOffset, setRegionOffset] = useState(0)
  const [selectedManagerKey, setSelectedManagerKey] = useState<string | null>(null)
  const [pendingManagerKey, setPendingManagerKey] = useState<string | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const selectionRequestRef = useRef(0)
  const scopeSignature = getStoreQueryScopeSignature(input.authSummary)
  const regionFilters = { period, signal: 'all' as const, sort: 'manager_asc' as const, limit: REGION_PAGE_SIZE, offset: regionOffset }
  const regionQuery = useQuery({
    queryKey: storeChecklistCommandRegionsQueryKey(input.authSummary, regionFilters),
    queryFn: async () => {
      const response = await getChecklistCommandRegions(regionFilters)
      return response.data.items.some(regionHasUnresolvedManagerIdentity)
        ? getChecklistCommandRegions(regionFilters)
        : response
    },
    placeholderData: (previous, previousQuery) => retainScopedPlaceholder(previous, previousQuery?.queryKey, scopeSignature),
  })
  if (!regionQuery.data && regionQuery.isLoading) return <StoreLoadingState title={copy.loadingTitle} description={copy.loadingCopy} />
  if (!regionQuery.data) {
    const forbidden = regionQuery.error instanceof ApiError && regionQuery.error.status === 403
    return (
      <StoreSurfacePage ariaLabel={copy.aria}>
        <StoreErrorState
          title={forbidden ? copy.forbiddenTitle : copy.errorTitle}
          description={forbidden ? copy.forbiddenCopy : getUserFacingErrorMessage(regionQuery.error, copy.errorCopy)}
          {...(forbidden ? {} : { action: { label: copy.retry, onClick: () => void regionQuery.refetch(), variant: 'outline' as const } })}
        />
      </StoreSurfacePage>
    )
  }

  const data = regionQuery.data.data
  const managerRows = flattenManagers(data.items, copy.noManager)
  const searchValue = search.trim().toLocaleLowerCase(locale)
  const visibleManagerRows = searchValue.length === 0 ? managerRows : managerRows.filter((manager) => manager.managerName.toLocaleLowerCase(locale).includes(searchValue))
  const activeManager = managerRows.find((manager) => manager.key === selectedManagerKey) ?? visibleManagerRows[0]
  const calendarManagers: ReportViewerManagerOption[] = managerRows.map((manager) => ({ key: manager.key, managerName: manager.managerName, managerUserId: manager.region.managerUserId, storeCount: manager.region.metrics.totalStores }))

  const prefetchManager = (manager: (typeof managerRows)[number]) => {
    const filters = createManagerStoreFilters(period, manager.region.managerUserId)
    void queryClient.prefetchQuery({
      queryKey: storeChecklistCommandQueryKey(input.authSummary, filters),
      queryFn: () => getChecklistCommandCanvas(filters),
      staleTime: 30_000,
    })
  }

  const selectManager = async (manager: (typeof managerRows)[number]) => {
    if (manager.key === activeManager?.key) return
    const requestId = ++selectionRequestRef.current
    const filters = createManagerStoreFilters(period, manager.region.managerUserId)
    setPendingManagerKey(manager.key)
    try {
      await queryClient.ensureQueryData({
        queryKey: storeChecklistCommandQueryKey(input.authSummary, filters),
        queryFn: () => getChecklistCommandCanvas(filters),
        staleTime: 30_000,
      })
    } catch {
      // Select the requested manager so the workspace can render its scoped retry state.
    } finally {
      if (selectionRequestRef.current === requestId) {
        setSelectedManagerKey(manager.key)
        setPendingManagerKey(null)
      }
    }
  }

  return (
    <StoreSurfacePage ariaLabel={copy.aria} className="tw:max-w-[1320px] tw:gap-3 tw:font-sans">
      <header className="tw:relative tw:flex tw:overflow-hidden tw:flex-col tw:gap-3 tw:rounded-2xl tw:border tw:border-primary/30 tw:bg-primary tw:px-4 tw:py-3.5 tw:text-primary-foreground tw:shadow-[0_18px_45px_color-mix(in_oklab,var(--primary)_24%,transparent)] tw:lg:flex-row tw:lg:items-center tw:lg:justify-between">
        <span aria-hidden className="tw:pointer-events-none tw:absolute tw:-top-20 tw:right-24 tw:size-52 tw:rounded-full tw:border tw:border-primary-foreground/10" />
        <div className="tw:relative tw:flex tw:min-w-0 tw:items-center tw:gap-3">
          <span className="tw:grid tw:size-10 tw:shrink-0 tw:place-items-center tw:rounded-xl tw:border tw:border-primary-foreground/20 tw:bg-primary-foreground/12 tw:shadow-inner">
            <ClipboardCheck aria-hidden className="tw:size-5" />
          </span>
          <div className="tw:min-w-0">
            <p className="tw:m-0 tw:text-[9px] tw:font-bold tw:uppercase tw:tracking-[0.14em] tw:text-primary-foreground/75">{copy.eyebrow}</p>
            <h1 className="tw:mt-1 tw:mb-0 tw:text-2xl tw:leading-none tw:font-semibold tw:tracking-[-0.035em] tw:text-primary-foreground">{copy.title}</h1>
            <p className="tw:mt-1.5 tw:mb-0 tw:text-xs tw:text-primary-foreground/78">{copy.scope}</p>
          </div>
        </div>
        <div className="tw:relative tw:flex tw:flex-wrap tw:items-center tw:gap-2">
          <ReportViewerPeriodPicker locale={locale} period={period} onChange={(value) => { setPeriod(value); setRegionOffset(0); setSelectedManagerKey(null) }} />
          <Button className="tw:border-primary-foreground tw:bg-primary-foreground tw:text-primary tw:shadow-sm tw:hover:bg-primary-foreground/90 tw:hover:text-primary" type="button" onClick={() => setCalendarOpen(true)} disabled={managerRows.length === 0}><CalendarDays aria-hidden /> {copy.calendar}</Button>
        </div>
      </header>

      {regionQuery.isError ? <div role="alert" className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-xl tw:border tw:border-destructive/25 tw:bg-destructive/5 tw:p-3 tw:text-xs tw:text-destructive"><span>{copy.partialError}</span><Button size="sm" variant="outline" onClick={() => void regionQuery.refetch()}>{copy.retry}</Button></div> : null}

      {visibleManagerRows.length === 0 ? <EmptyState title={searchValue ? copy.searchEmptyTitle : copy.emptyTitle} copy={searchValue ? copy.searchEmptyCopy : copy.emptyCopy} /> : (
        <div className="tw:grid tw:min-w-0 tw:gap-3 tw:xl:grid-cols-[264px_minmax(0,1fr)]">
          <aside className="tw:min-w-0 tw:self-start tw:overflow-hidden tw:rounded-2xl tw:border tw:border-border tw:bg-card tw:shadow-sm" aria-labelledby="report-viewer-manager-list-title">
            <header className="tw:border-b tw:border-border tw:p-3">
              <div className="tw:mb-2.5 tw:flex tw:items-end tw:justify-between tw:gap-3"><div><p className="tw:m-0 tw:text-[9px] tw:font-bold tw:uppercase tw:tracking-[0.14em] tw:text-muted-foreground">{copy.directoryEyebrow}</p><h2 id="report-viewer-manager-list-title" className="tw:mt-0.5 tw:mb-0 tw:text-base tw:font-semibold tw:tracking-[-0.015em]">{copy.listTitle}</h2></div><span className="tw:text-[11px] tw:font-medium tw:text-muted-foreground">{visibleManagerRows.length}</span></div>
              <label className="tw:relative tw:block"><Search aria-hidden className="tw:absolute tw:top-1/2 tw:left-2.5 tw:size-3.5 tw:-translate-y-1/2 tw:text-muted-foreground" /><span className="tw:sr-only">{copy.search}</span><Input className="tw:bg-muted/30 tw:pl-8 tw:text-xs tw:shadow-none" value={search} placeholder={copy.searchPlaceholder} onChange={(event) => { setSelectedManagerKey(activeManager?.key ?? null); setSearch(event.target.value) }} /></label>
            </header>
            <div aria-label={copy.listTitle} className="tw:max-h-[520px] tw:overflow-y-auto tw:px-2 tw:py-1.5">
              {visibleManagerRows.map((manager) => (
                <button type="button" key={manager.key} aria-busy={pendingManagerKey === manager.key || undefined} aria-current={activeManager?.key === manager.key ? 'true' : undefined} className="tw:group tw:relative tw:flex tw:w-full tw:appearance-none tw:items-center tw:gap-2.5 tw:border-0 tw:border-b tw:border-border tw:bg-transparent tw:px-2 tw:py-2 tw:text-left tw:shadow-none tw:transition tw:last:border-b-0 tw:hover:bg-muted/50 tw:aria-current:bg-accent/25 tw:aria-current:before:absolute tw:aria-current:before:top-2 tw:aria-current:before:bottom-2 tw:aria-current:before:left-0 tw:aria-current:before:w-0.5 tw:aria-current:before:rounded-full tw:aria-current:before:bg-primary" onFocus={() => prefetchManager(manager)} onPointerEnter={() => prefetchManager(manager)} onClick={() => void selectManager(manager)}>
                  <span aria-hidden className="tw:grid tw:size-8 tw:shrink-0 tw:place-items-center tw:rounded-lg tw:bg-muted tw:text-[10px] tw:font-bold tw:text-primary tw:group-aria-current:bg-primary tw:group-aria-current:text-primary-foreground">{getInitials(manager.managerName)}</span>
                  <span className="tw:min-w-0 tw:flex-1"><strong className="tw:block tw:truncate tw:text-[13px] tw:font-semibold">{manager.managerName}</strong><small className="tw:block tw:text-[11px] tw:text-muted-foreground">{manager.region.metrics.totalStores} {copy.assignedStores}</small></span>
                  <strong className="tw:min-w-9 tw:shrink-0 tw:text-right tw:text-[17px] tw:leading-none tw:font-semibold tw:tracking-[-0.04em] tw:tabular-nums tw:text-primary" aria-label={copy.averageScoreAria(manager.managerName, formatAverageScore(manager.region.visitAverageScore, locale))}>
                    {formatAverageScore(manager.region.visitAverageScore, locale)}
                  </strong>
                  <LoaderCircle aria-hidden className={`tw:size-3.5 tw:shrink-0 tw:text-primary ${pendingManagerKey === manager.key ? 'tw:animate-spin tw:opacity-100' : 'tw:opacity-0'}`} />
                </button>
              ))}
            </div>
            <footer className="tw:flex tw:items-center tw:justify-between tw:border-t tw:border-border tw:px-3 tw:py-2"><span className="tw:text-[11px] tw:font-medium tw:text-muted-foreground">{Math.floor(regionOffset / REGION_PAGE_SIZE) + 1}</span><div className="tw:flex tw:gap-1"><Button size="icon-xs" variant="ghost" aria-label={copy.previous} disabled={regionOffset === 0} onClick={() => { setRegionOffset(Math.max(0, regionOffset - REGION_PAGE_SIZE)); setSelectedManagerKey(null) }}><ChevronLeft /></Button><Button size="icon-xs" variant="ghost" aria-label={copy.next} disabled={!data.page.hasMore} onClick={() => { setRegionOffset(regionOffset + REGION_PAGE_SIZE); setSelectedManagerKey(null) }}><ChevronRight /></Button></div></footer>
          </aside>

          {activeManager ? <ReportViewerManagerWorkspace authSummary={input.authSummary} locale={locale} managerName={activeManager.managerName} managerUserId={activeManager.region.managerUserId} onOpenResult={input.onOpenResult} period={period} /> : null}
        </div>
      )}

      <ReportViewerVisitCalendarDialog authSummary={input.authSummary} initialManagerKey={activeManager?.key ?? null} locale={locale} managers={calendarManagers} open={calendarOpen} period={period} onOpenChange={setCalendarOpen} />
    </StoreSurfacePage>
  )
}

function createManagerStoreFilters(period: string, managerUserId: string) {
  return { period, managerUserId, status: 'all' as const, sort: 'store_asc' as const, query: '', limit: 20, offset: 0 }
}

function flattenManagers(regions: ChecklistCommandRegion[], noManager: string) {
  return regions.flatMap((region) => {
    const resolvedManagers = region.regionManagers.filter((manager) => isResolvedManagerDisplayName(manager.displayName))
    const managers = resolvedManagers.length > 0 ? resolvedManagers : [{ displayName: noManager }]
    return managers.map((manager, index) => ({ key: `${region.managerUserId}:${manager.displayName}:${index}`, managerName: manager.displayName, region }))
  })
}

function regionHasUnresolvedManagerIdentity(region: ChecklistCommandRegion) {
  return region.regionManagers.length === 0 || region.regionManagers.some((manager) => !isResolvedManagerDisplayName(manager.displayName))
}

function isResolvedManagerDisplayName(value: string) {
  const normalized = value.trim().toLocaleLowerCase('tr-TR')
  return normalized.length > 0 && !['bilinmiyor', 'unknown', 'bölge müdürü tanımlı değil', 'no region manager assigned'].includes(normalized)
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return <div className="tw:grid tw:min-h-40 tw:place-items-center tw:rounded-2xl tw:border tw:border-border tw:bg-card tw:p-5 tw:text-center"><div><UsersRound className="tw:mx-auto tw:mb-2 tw:size-5 tw:text-primary" /><strong className="tw:text-sm tw:text-foreground">{title}</strong><p className="tw:mt-1 tw:text-xs tw:text-muted-foreground">{copy}</p></div></div>
}

function getInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'BM'
  return `${words[0]?.[0] ?? ''}${words.at(-1)?.[0] ?? ''}`.toLocaleUpperCase('tr-TR')
}

function formatAverageScore(value: number | null, locale: 'tr' | 'en') {
  if (value === null) return '—'
  return new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 1 }).format(value)
}

const trCopy = { aria: 'Bölge müdürleri görünümü', assignedStores: 'sorumlu mağaza', averageScoreAria: (manager: string, score: string) => `${manager} ortalama checklist puanı: ${score}`, calendar: 'Ziyaret Takvimi', directoryEyebrow: 'Dizin', emptyCopy: 'Şirket kapsamı veya seçili filtre sonuç üretmedi.', emptyTitle: 'Bu filtrede bölge müdürü yok', eyebrow: 'Rapor görüntüleyici', errorCopy: 'Bölge müdürü verileri okunamadı.', errorTitle: 'Bölge müdürleri açılamadı', forbiddenCopy: 'Report Viewer hesabına yetkili şirket kapsamı tanımlanmamış.', forbiddenTitle: 'Şirket kapsamına erişilemiyor', listTitle: 'Bölge müdürleri', loadingCopy: 'Bölge müdürleri ve sorumlu mağazaları hazırlanıyor.', loadingTitle: 'Bölge müdürleri yükleniyor', next: 'Sonraki bölge müdürü sayfası', noManager: 'Bölge müdürü tanımlı değil', partialError: 'Yeni bölge müdürü verileri alınamadı; mevcut görünüm korunuyor.', previous: 'Önceki bölge müdürü sayfası', retry: 'Tekrar dene', search: 'Bölge müdürü ara', searchEmptyCopy: 'Arama ifadenizi değiştirerek yeniden deneyin.', searchEmptyTitle: 'Eşleşen bölge müdürü yok', searchPlaceholder: 'Ad ile ara', scope: 'Bölge müdürünü seçin ve sorumlu mağazalarının sonuçlarını inceleyin.', title: 'Checklist Raporları' } as const
const enCopy = { aria: 'Region managers view', assignedStores: 'assigned stores', averageScoreAria: (manager: string, score: string) => `${manager} average checklist score: ${score}`, calendar: 'Visit Calendar', directoryEyebrow: 'Directory', emptyCopy: 'The company scope or selected filter returned no results.', emptyTitle: 'No region managers for this filter', eyebrow: 'Report viewer', errorCopy: 'Region manager data could not be read.', errorTitle: 'Region managers unavailable', forbiddenCopy: 'No authorized company scope is assigned to this Report Viewer account.', forbiddenTitle: 'Company scope unavailable', listTitle: 'Region managers', loadingCopy: 'Preparing region managers and their assigned stores.', loadingTitle: 'Loading region managers', next: 'Next region manager page', noManager: 'No region manager assigned', partialError: 'New region manager data could not load; the current view is retained.', previous: 'Previous region manager page', retry: 'Retry', search: 'Search region managers', searchEmptyCopy: 'Change your search and try again.', searchEmptyTitle: 'No matching region manager', searchPlaceholder: 'Search by name', scope: 'Select a region manager and review assigned store results.', title: 'Checklist Reports' } as const
