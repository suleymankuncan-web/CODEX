import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, ClipboardCheck, Clock3, Search, Store } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { ApiError } from '../../lib/api'
import { getBusinessMonthInputValue } from '../../lib/business-date'
import { getUserFacingErrorMessage } from '../../lib/format'
import { transientQueryRetryOptions } from '../../lib/query-retry'
import { cn } from '../../lib/utils'
import { StoreErrorState, StoreLoadingState, StoreSurfacePage } from '../../pages/store-surface-primitives'
import type { AuthSessionSummary } from '../auth/api'
import { getStoreQueryScopeSignature, retainScopedPlaceholder, storeChecklistCommandQueryKey } from '../auth/store-query-scope'
import { useLocalization } from '../localization/useLocalization'
import { getChecklistCommandCanvas, type ChecklistCommandResponse, type ChecklistCommandRow } from './api'
import { ChecklistCommandPeriodPicker } from './ChecklistCommandPeriodPicker'
import { ChecklistOperationalHistoryDrawer } from './ChecklistOperationalHistoryDrawer'
import { getChecklistCommandSortLabel, toggleChecklistCommandSort, type ChecklistCommandSort, type ChecklistCommandSortKey, type ChecklistCommandStatus } from './model'

const PAGE_SIZE = 30

export function StoreManagerChecklistCommandPage(input: {
  authSummary: AuthSessionSummary | null
  onOpenWorkflow: (storeId: string, tab: 'visits' | 'inbox' | 'history', trigger: HTMLElement, directChecklist?: 'vm') => void
}) {
  return <ChecklistOperatorCommandPage {...input} view="store_manager" />
}

export function VisualMerchandiserChecklistCommandPage(input: {
  authSummary: AuthSessionSummary | null
  onOpenWorkflow: (storeId: string, tab: 'visits' | 'inbox' | 'history', trigger: HTMLElement, directChecklist?: 'vm') => void
}) {
  return <ChecklistOperatorCommandPage {...input} view="visual_merchandiser" />
}

export function SuperAdminChecklistCommandPage(input: {
  authSummary: AuthSessionSummary | null
  onOpenWorkflow: (storeId: string, tab: 'visits' | 'inbox' | 'history', trigger: HTMLElement, directChecklist?: 'vm') => void
}) {
  return <ChecklistOperatorCommandPage {...input} view="super_admin" />
}

function ChecklistOperatorCommandPage(input: {
  authSummary: AuthSessionSummary | null
  onOpenWorkflow: (storeId: string, tab: 'visits' | 'inbox' | 'history', trigger: HTMLElement, directChecklist?: 'vm') => void
  view: 'store_manager' | 'visual_merchandiser' | 'super_admin'
}) {
  const { locale } = useLocalization()
  const copy = getOperatorCopy(locale === 'tr' ? trCopy : enCopy, input.view, locale)
  const [period, setPeriod] = useState(() => getBusinessMonthInputValue())
  const [status, setStatus] = useState<ChecklistCommandStatus>('all')
  const [sort, setSort] = useState<ChecklistCommandSort>('store_asc')
  const [searchDraft, setSearchDraft] = useState('')
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const [selectedStoreState, setSelectedStoreState] = useState<{ store: ChecklistCommandRow; scopeSignature: string } | null>(null)
  const [retained, setRetained] = useState<{ scopeSignature: string; period: string; response: ChecklistCommandResponse } | null>(null)
  const historyTriggerRef = useRef<HTMLElement | null>(null)
  const scopeSignature = getStoreQueryScopeSignature(input.authSummary)
  const selectedStore = selectedStoreState?.scopeSignature === scopeSignature ? selectedStoreState.store : null
  const filters = { period, status, sort, query, limit: PAGE_SIZE, offset }

  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(searchDraft.trim()); setOffset(0) }, 300)
    return () => window.clearTimeout(timer)
  }, [searchDraft])

  const commandQuery = useQuery({
    queryKey: storeChecklistCommandQueryKey(input.authSummary, filters),
    queryFn: () => getChecklistCommandCanvas(filters),
    placeholderData: (previous, previousQuery) => {
      const previousFilters = previousQuery?.queryKey[2] as typeof filters | undefined
      return retainScopedPlaceholder(previous, previousQuery?.queryKey, scopeSignature, previousFilters?.period === period)
    },
    ...transientQueryRetryOptions,
  })
  const protectedFailure = commandQuery.error instanceof ApiError && (commandQuery.error.status === 401 || commandQuery.error.status === 403)
  const retainedResponse = retained?.scopeSignature === scopeSignature && retained.period === period ? retained.response : undefined
  const response = protectedFailure ? undefined : commandQuery.data ?? retainedResponse

  function retainCurrent() {
    const current = commandQuery.data ?? retainedResponse
    if (current) setRetained({ scopeSignature, period, response: current })
  }

  function selectStatus(next: ChecklistCommandStatus) {
    retainCurrent()
    setStatus(next)
    setOffset(0)
  }

  function selectSort(key: ChecklistCommandSortKey) {
    retainCurrent()
    setSort((current) => toggleChecklistCommandSort(current, key))
    setOffset(0)
  }

  if (!response && commandQuery.isLoading) return <StoreLoadingState title={copy.loading} description={copy.loadingCopy} />
  if (!response) {
    const forbidden = commandQuery.error instanceof ApiError && commandQuery.error.status === 403
    return <StoreSurfacePage ariaLabel={copy.aria}><StoreErrorState title={forbidden ? copy.forbidden : copy.error} description={forbidden ? copy.forbiddenCopy : getUserFacingErrorMessage(commandQuery.error, copy.errorCopy)} {...(forbidden ? {} : { action: { label: copy.retry, onClick: () => void commandQuery.refetch(), variant: 'outline' as const } })} /></StoreSurfacePage>
  }

  if (response.data.view !== input.view) {
    return <StoreSurfacePage ariaLabel={copy.aria}><StoreErrorState title={copy.forbidden} description={copy.scopeMismatch} /></StoreSurfacePage>
  }

  const data = response.data
  const firstItem = data.page.total === 0 ? 0 : data.page.offset + 1
  const lastItem = Math.min(data.page.total, data.page.offset + data.items.length)
  const pageCount = Math.max(1, Math.ceil(data.page.total / PAGE_SIZE))
  const pageNumber = Math.floor(offset / PAGE_SIZE) + 1
  const metrics = [
    { key: 'all' as const, label: copy.total, value: data.metrics.totalStores, icon: Store, tone: 'plum' },
    { key: 'needs_visit' as const, label: copy.needsVisit, value: data.metrics.needsVisit, icon: CircleAlert, tone: 'danger' },
    { key: 'active' as const, label: copy.active, value: data.metrics.active, icon: Clock3, tone: 'active' },
    { key: 'completed' as const, label: copy.completed, value: data.metrics.completed, icon: CheckCircle2, tone: 'done' },
  ] as const

  return <>
    <StoreSurfacePage ariaLabel={copy.aria} className="checklist-command-parity" data-testid={`${input.view}-checklist-command`}>
      <header className="checklist-command-title">
        <div><p>{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.scope}</p></div>
        <div className="checklist-command-title-actions"><ChecklistCommandPeriodPicker locale={locale} period={period} onChange={(value) => { setRetained(null); setPeriod(value); setOffset(0) }} /></div>
      </header>

      <section aria-label={copy.metrics} className="checklist-command-metrics">
        {metrics.map(({ key, label, value, icon: Icon, tone }) => <button key={key} type="button" aria-pressed={status === key} className="checklist-command-metric" onClick={() => selectStatus(key)}><span className={cn('checklist-command-metric-icon', `tone-${tone}`)}><Icon size={15} /></span><span className="checklist-command-metric-copy"><small>{label}</small></span><strong>{value}</strong></button>)}
      </section>

      <section className="checklist-command-surface tw:overflow-hidden">
        <div className="tw:flex tw:flex-col tw:gap-2 tw:border-b tw:border-border tw:p-3 tw:sm:flex-row tw:sm:items-center">
          <label className="checklist-operator-search tw:flex tw:min-h-9 tw:min-w-0 tw:flex-1 tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-input tw:bg-muted/20 tw:px-3 tw:text-muted-foreground tw:sm:max-w-sm"><Search className="tw:size-4" /><Input aria-label={copy.search} className="tw:h-auto tw:border-0 tw:bg-transparent tw:p-0 tw:text-xs tw:shadow-none tw:focus-visible:ring-0" value={searchDraft} placeholder={copy.search} onChange={(event) => { retainCurrent(); setSearchDraft(event.target.value) }} /></label>
          {commandQuery.isFetching ? <small className="checklist-command-inline-refresh" aria-live="polite">{copy.refreshing}</small> : null}
          {commandQuery.isError && response ? <button type="button" className="checklist-command-inline-error" onClick={() => void commandQuery.refetch()}>{copy.partial}</button> : null}
          <div className="tw:flex tw:flex-wrap tw:gap-1.5 tw:sm:ml-auto" aria-label={copy.sort}><Button size="sm" variant="ghost" onClick={() => selectSort('store')}>{getChecklistCommandSortLabel(copy.store, 'store', sort)}</Button><Button size="sm" variant="ghost" onClick={() => selectSort('last_visit')}>{getChecklistCommandSortLabel(copy.lastVisit, 'last_visit', sort)}</Button><Button size="sm" variant="ghost" onClick={() => selectSort('status')}>{getChecklistCommandSortLabel(copy.status, 'status', sort)}</Button></div>
        </div>

        {data.items.length === 0 ? <div className="tw:grid tw:min-h-56 tw:place-items-center tw:p-8 tw:text-center"><div><Store className="tw:mx-auto tw:size-5 tw:text-muted-foreground" /><strong className="tw:mt-2 tw:block tw:text-sm">{copy.empty}</strong><p className="tw:mt-1 tw:text-xs tw:text-muted-foreground">{copy.emptyCopy}</p></div></div> : <div className="tw:grid tw:gap-3 tw:p-3 tw:md:grid-cols-2">
          {data.items.map((row) => <article key={row.storeId} className="tw:grid tw:min-w-0 tw:gap-3 tw:rounded-2xl tw:border tw:border-border tw:bg-card tw:p-4 tw:shadow-sm">
            <header className="tw:flex tw:min-w-0 tw:items-start tw:justify-between tw:gap-3"><span className="tw:min-w-0"><small className="tw:text-[9px] tw:font-bold tw:uppercase tw:tracking-[.1em] tw:text-muted-foreground">{row.storeCode} · {row.regionName}</small><strong className="tw:mt-1 tw:block tw:truncate tw:text-base">{row.storeName}</strong></span><span className={cn('tw:rounded-full tw:px-2.5 tw:py-1 tw:text-[9px] tw:font-semibold', row.status === 'completed' ? 'tw:bg-emerald-500/10 tw:text-emerald-700' : row.status === 'active' ? 'tw:bg-blue-500/10 tw:text-blue-700' : 'tw:bg-amber-500/10 tw:text-amber-700')}>{statusLabel(row.status, copy)}</span></header>
            <div className="tw:grid tw:grid-cols-2 tw:gap-2">{input.view !== 'visual_merchandiser' ? <Score label="BM" value={row.bmScore} /> : null}<Score label="VM" value={row.vmScore} /><Signal label={copy.pendingAcknowledgements} value={row.pendingAcknowledgementCount} /><Signal label={copy.openTasks} value={row.openActionCount} /></div>
            <p className="tw:text-[10px] tw:text-muted-foreground">{row.lastCompletedVisitAt ? `${formatDate(row.lastCompletedVisitAt, locale)} · ${row.elapsedDaysSinceLastVisit ?? 0} ${copy.days}` : copy.noVisit}</p>
            <div className="tw:flex tw:flex-wrap tw:gap-2"><Button size="sm" onClick={(event) => input.onOpenWorkflow(row.storeId, 'visits', event.currentTarget, input.view === 'visual_merchandiser' ? 'vm' : undefined)}><ClipboardCheck />{copy.openControls}</Button><Button size="sm" variant="outline" onClick={(event) => input.onOpenWorkflow(row.storeId, row.pendingAcknowledgementCount > 0 ? 'inbox' : 'history', event.currentTarget)}>{row.pendingAcknowledgementCount > 0 ? copy.openApprovals : copy.openResults}</Button>{input.view === 'store_manager' ? <Button size="sm" variant="outline" onClick={(event) => { historyTriggerRef.current = event.currentTarget; setSelectedStoreState({ store: row, scopeSignature }) }}>{copy.openRecord}</Button> : null}{input.view === 'store_manager' && row.openActionCount > 0 ? <Button asChild size="sm" variant="ghost"><Link to="/store/tasks">{copy.openTasksLink}</Link></Button> : null}</div>
          </article>)}
        </div>}

        <footer className="checklist-command-pagination"><span>{firstItem}–{lastItem} / {data.page.total}</span><div><button type="button" aria-label={copy.previous} disabled={offset === 0 || commandQuery.isFetching} onClick={() => { retainCurrent(); setOffset(Math.max(0, offset - PAGE_SIZE)) }}><ChevronLeft size={14} /></button><small>{pageNumber} / {pageCount}</small><button type="button" aria-label={copy.next} disabled={!data.page.hasMore || commandQuery.isFetching} onClick={() => { retainCurrent(); setOffset(offset + PAGE_SIZE) }}><ChevronRight size={14} /></button></div></footer>
      </section>
    </StoreSurfacePage>
    {input.view === 'store_manager' ? <ChecklistOperationalHistoryDrawer authSummary={input.authSummary} open={Boolean(selectedStore)} storeId={selectedStore?.storeId ?? null} storeName={selectedStore?.storeName ?? null} returnFocusRef={historyTriggerRef} onClose={() => setSelectedStoreState(null)} /> : null}
  </>
}

function Score({ label, value }: { label: string; value: number | null }) { return <span className="tw:rounded-xl tw:bg-primary/[.045] tw:p-3"><small className="tw:block tw:text-[9px] tw:text-muted-foreground">{label}</small><strong className="tw:mt-1 tw:block tw:text-lg tw:tabular-nums">{value === null ? '—' : Math.round(value)}</strong></span> }
function Signal({ label, value }: { label: string; value: number }) { return <span className="tw:rounded-xl tw:bg-muted/35 tw:p-3"><small className="tw:block tw:text-[9px] tw:text-muted-foreground">{label}</small><strong className="tw:mt-1 tw:block tw:text-lg tw:tabular-nums">{value}</strong></span> }
function formatDate(value: string, locale: 'tr' | 'en') { return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'medium', timeZone: 'Europe/Istanbul' }).format(new Date(value)) }
function statusLabel(status: ChecklistCommandRow['status'], copy: { statusCompleted: string; statusActive: string; statusPending: string; statusNeedsVisit: string }) { return status === 'completed' ? copy.statusCompleted : status === 'active' ? copy.statusActive : status === 'pending' ? copy.statusPending : copy.statusNeedsVisit }

function getOperatorCopy(base: typeof trCopy | typeof enCopy, view: 'store_manager' | 'visual_merchandiser' | 'super_admin', locale: 'tr' | 'en') {
  if (view === 'visual_merchandiser') return { ...base, aria: locale === 'tr' ? 'VM checklist görünümü' : 'Visual Merchandiser checklist view', eyebrow: locale === 'tr' ? 'Atanmış mağazalar · VM kontrolü' : 'Assigned stores · VM control', title: locale === 'tr' ? 'VM Kontrol Merkezi' : 'VM Control Center', scope: locale === 'tr' ? 'Yalnız atanmış mağazalardaki VM checklistleri ve sonuçları' : 'VM checklists and results for assigned stores only', scopeMismatch: locale === 'tr' ? 'Sunucu yanıtı VM kapsamıyla eşleşmedi.' : 'The server response did not match the Visual Merchandiser scope.', total: locale === 'tr' ? 'Atanmış mağaza' : 'Assigned stores', search: locale === 'tr' ? 'Atanmış mağaza ara' : 'Search assigned stores', openControls: locale === 'tr' ? 'VM checklistini aç' : 'Open VM checklist' }
  if (view === 'super_admin') return { ...base, aria: locale === 'tr' ? 'Super Admin checklist görünümü' : 'Super Admin checklist view', eyebrow: locale === 'tr' ? 'Yönetim kapsamı · Checklist kontrolü' : 'Administrative scope · Checklist control', title: locale === 'tr' ? 'Checklist Yönetim Merkezi' : 'Checklist Administration Center', scope: locale === 'tr' ? 'Yetkili yönetim kapsamındaki mağaza checklistleri ve sonuçları' : 'Store checklists and results in the authorized administrative scope', scopeMismatch: locale === 'tr' ? 'Sunucu yanıtı Super Admin kapsamıyla eşleşmedi.' : 'The server response did not match the Super Admin scope.', total: locale === 'tr' ? 'Kapsamdaki mağaza' : 'Stores in scope', search: locale === 'tr' ? 'Kapsamdaki mağaza ara' : 'Search stores in scope' }
  return base
}

const trCopy = { aria: 'Mağaza müdürü checklist görünümü', eyebrow: 'Yetkili mağazalar · Güncel kontrol', title: 'Mağaza Kontrol Merkezi', scope: 'Yalnız sorumlu olduğunuz mağazaların checklist, onay ve görev durumu', loading: 'Mağaza kontrolleri yükleniyor', loadingCopy: 'Yetkili mağaza kapsamı hazırlanıyor.', error: 'Mağaza kontrolleri açılamadı', errorCopy: 'Checklist verileri okunamadı.', forbidden: 'Mağaza kapsamına erişilemiyor', forbiddenCopy: 'Bu hesap için yetkili mağaza kapsamı bulunamadı.', scopeMismatch: 'Sunucu yanıtı mağaza müdürü kapsamıyla eşleşmedi.', retry: 'Tekrar dene', metrics: 'Mağaza kontrol özeti', total: 'Yetkili mağaza', needsVisit: 'Kontrol gerekli', active: 'Aktif checklist', completed: 'Tamamlanan', search: 'Yetkili mağaza ara', refreshing: 'Güncelleniyor…', partial: 'Yeni veri alınamadı · Tekrar dene', sort: 'Mağazaları sırala', store: 'Mağaza', lastVisit: 'Son ziyaret', status: 'Durum', empty: 'Bu kapsamda mağaza yok', emptyCopy: 'Atama veya seçili filtre mağaza üretmedi.', pendingAcknowledgements: 'Bekleyen onay', openTasks: 'Açık görev', days: 'gün önce', noVisit: 'Tamamlanmış ziyaret yok', openControls: 'Checklistleri aç', openApprovals: 'Bekleyen onaylar', openResults: 'Sonuç geçmişi', openRecord: 'Mağaza kaydı', openTasksLink: 'Görevleri aç', previous: 'Önceki sayfa', next: 'Sonraki sayfa', statusCompleted: 'Tamamlandı', statusActive: 'Devam ediyor', statusPending: 'Kabul bekliyor', statusNeedsVisit: 'Kontrol gerekli' } as const
const enCopy = { aria: 'Store manager checklist view', eyebrow: 'Authorized stores · Current control', title: 'Store Control Center', scope: 'Checklist, acknowledgement and task state for only your managed stores', loading: 'Loading store controls', loadingCopy: 'Preparing authorized store scope.', error: 'Store controls unavailable', errorCopy: 'Checklist data could not be read.', forbidden: 'Store scope unavailable', forbiddenCopy: 'No authorized store scope is assigned to this account.', scopeMismatch: 'The server response did not match the Store Manager scope.', retry: 'Retry', metrics: 'Store control summary', total: 'Authorized stores', needsVisit: 'Control required', active: 'Active checklist', completed: 'Completed', search: 'Search authorized stores', refreshing: 'Refreshing…', partial: 'New data unavailable · Retry', sort: 'Sort stores', store: 'Store', lastVisit: 'Last visit', status: 'Status', empty: 'No stores in this scope', emptyCopy: 'The assignment or selected filter returned no stores.', pendingAcknowledgements: 'Pending acknowledgements', openTasks: 'Open tasks', days: 'days ago', noVisit: 'No completed visit', openControls: 'Open checklists', openApprovals: 'Pending acknowledgements', openResults: 'Result history', openRecord: 'Store record', openTasksLink: 'Open tasks', previous: 'Previous page', next: 'Next page', statusCompleted: 'Completed', statusActive: 'In progress', statusPending: 'Awaiting acknowledgement', statusNeedsVisit: 'Control required' } as const
