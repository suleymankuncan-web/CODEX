import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Dialog as DialogPrimitive } from 'radix-ui'
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Search,
  X,
} from 'lucide-react'
import type { AuthSessionSummary } from '../auth/api'
import { storeChecklistVisitPlanPeriodQueryKey } from '../auth/store-query-scope'
import { ApiError } from '../../lib/api'
import { getUserFacingErrorMessage } from '../../lib/format'
import { transientQueryRetryOptions } from '../../lib/query-retry'
import { getChecklistVisitPlanPeriod, type ChecklistVisitPlanPeriodRow } from './api'
import { ChecklistWeeklyVisitPlanner } from './ChecklistWeeklyVisitPlanner'
import {
  type ChecklistVisitPlanRisk,
  type ChecklistVisitPlanSort,
  type ChecklistVisitPlanStatus,
} from './model'

const PAGE_SIZE = 30

export function ChecklistVisitPlanSurface(input: {
  authSummary: AuthSessionSummary | null
  locale: 'tr' | 'en'
  period: string
  regionId: string
  regionName: string
  weekStart: string
  onOpenResult: (checklistInstanceId: string) => void
  onWeekStartChange: (weekStart: string) => void
}) {
  const copy = getCopy(input.locale)
  const [retainedPeriod, setRetainedPeriod] = useState<{
    scopeSignature: string
    regionId: string
    period: string
    response: Awaited<ReturnType<typeof getChecklistVisitPlanPeriod>>
  } | null>(null)
  const [risk, setRisk] = useState<ChecklistVisitPlanRisk>('all')
  const [planStatus, setPlanStatus] = useState<ChecklistVisitPlanStatus>('all')
  const [sort, setSort] = useState<ChecklistVisitPlanSort>('risk_desc')
  const [searchDraft, setSearchDraft] = useState('')
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const [selectedRow, setSelectedRow] = useState<ChecklistVisitPlanPeriodRow | null>(null)
  const [planningRequest, setPlanningRequest] = useState<{
    requestId: number
    storeId: string
    storeName: string
    plannedDate: string | null
  }>()
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [openMenu, setOpenMenu] = useState<'risk' | 'status' | 'sort' | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchDraft.trim())
      setOffset(0)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchDraft])

  useEffect(() => {
    if (!openMenu) return
    const close = (event: PointerEvent) => {
      if (!toolbarRef.current?.contains(event.target as Node)) setOpenMenu(null)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const trigger = toolbarRef.current?.querySelector<HTMLButtonElement>('[aria-expanded="true"]')
        setOpenMenu(null)
        window.requestAnimationFrame(() => trigger?.focus())
      }
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [openMenu])

  const filters = useMemo(() => ({
    regionId: input.regionId,
    period: input.period,
    query,
    risk,
    planStatus,
    sort,
    limit: PAGE_SIZE,
    offset,
  }), [input.period, input.regionId, offset, planStatus, query, risk, sort])
  const scopeSignature = storeChecklistVisitPlanPeriodQueryKey(input.authSummary, filters)[1]
  const periodQuery = useQuery({
    queryKey: storeChecklistVisitPlanPeriodQueryKey(input.authSummary, filters),
    queryFn: () => getChecklistVisitPlanPeriod(filters),
    placeholderData: (previousData, previousQuery) => {
      const previousFilters = previousQuery?.queryKey[2] as Record<string, unknown> | undefined
      return previousFilters?.regionId === filters.regionId && previousFilters?.period === filters.period
        ? previousData
        : undefined
    },
    ...transientQueryRetryOptions,
  })
  const protectedPeriodFailure = periodQuery.error instanceof ApiError
    && (periodQuery.error.status === 401 || periodQuery.error.status === 403)
  const retainedPeriodResponse = retainedPeriod?.scopeSignature === scopeSignature
    && retainedPeriod.regionId === input.regionId
    && retainedPeriod.period === input.period
    ? retainedPeriod.response
    : undefined
  const periodResponse = protectedPeriodFailure ? undefined : periodQuery.data ?? retainedPeriodResponse
  const retainCurrentPeriod = () => {
    if (!periodResponse) return
    setRetainedPeriod({
      scopeSignature,
      regionId: input.regionId,
      period: input.period,
      response: periodResponse,
    })
  }

  if (!periodResponse && periodQuery.isLoading) {
    return <section className="plan-surface-state" aria-live="polite"><Clock3 size={18} /><strong>{copy.loading}</strong></section>
  }
  if (!periodResponse && periodQuery.isError) {
    const forbidden = periodQuery.error instanceof ApiError && periodQuery.error.status === 403
    return <section className="plan-surface-state" role="alert"><CircleAlert size={18} /><strong>{forbidden ? copy.forbidden : copy.loadFailed}</strong>{forbidden ? null : <button type="button" onClick={() => void periodQuery.refetch()}>{copy.retry}</button>}</section>
  }
  if (!periodResponse) return null

  const data = periodResponse.data
  const pageNumber = Math.floor(data.page.offset / data.page.limit) + 1
  const pageCount = Math.max(1, Math.ceil(data.page.total / data.page.limit))
  const firstItem = data.page.total === 0 ? 0 : data.page.offset + 1
  const lastItem = Math.min(data.page.total, data.page.offset + data.items.length)
  const metricOptions = [
    { key: 'high' as const, label: copy.high, note: copy.highNote, value: data.metrics.high, icon: CircleAlert },
    { key: 'medium' as const, label: copy.medium, note: copy.mediumNote, value: data.metrics.medium, icon: Clock3 },
    { key: 'low' as const, label: copy.low, note: copy.lowNote, value: data.metrics.low, icon: CheckCircle2 },
  ]
  const openPlanning = (row: ChecklistVisitPlanPeriodRow) => {
    const editable = row.planItems.find((item) => item.status !== 'completed') ?? row.planItems[0]
    setSelectedRow(null)
    if (editable?.weekStart && editable.weekStart !== input.weekStart) input.onWeekStartChange(editable.weekStart)
    setPlanningRequest({
      requestId: Date.now(),
      storeId: row.storeId,
      storeName: row.storeName,
      plannedDate: editable?.plannedDate ?? null,
    })
  }

  return (
    <div className="checklist-plan-view">
      <section className="decision-rail decision-rail--plan" aria-label={copy.metrics}>
        {metricOptions.map((metric) => {
          const Icon = metric.icon
          return <button type="button" aria-pressed={risk === metric.key} className={risk === metric.key ? 'is-active' : ''} key={metric.key} onClick={() => { retainCurrentPeriod(); setRisk((current) => current === metric.key ? 'all' : metric.key); setOffset(0) }}><span className={`decision-icon decision-icon--plan-${metric.key}`}><Icon size={15} /></span><span className="decision-copy"><b>{metric.label}</b><small>{metric.note}</small></span><strong>{metric.value}</strong></button>
        })}
      </section>

      <ChecklistWeeklyVisitPlanner
        authSummary={input.authSummary}
        canMaintain={data.capabilities.canMaintainWeeklyVisitPlan}
        locale={input.locale}
        period={input.period}
        planningRequest={planningRequest}
        onPlanningRequestHandled={() => setPlanningRequest(undefined)}
        regionId={input.regionId}
        regionName={data.regionName || input.regionName}
        weekStart={input.weekStart}
        onOpenResult={input.onOpenResult}
        onOpenWorkflow={() => undefined}
        onWeekStartChange={input.onWeekStartChange}
      />

      <section className="canvas-surface canvas-plan-surface">
        <div className="command-row canvas-plan-command" ref={toolbarRef}>
          <label><Search size={15} /><input value={searchDraft} onChange={(event) => { retainCurrentPeriod(); setSearchDraft(event.target.value) }} placeholder={copy.search} /><kbd>/</kbd></label>
          <div className="plan-command-context"><span>{copy.planScope}</span><strong>{input.locale === 'tr' ? `${data.metrics.totalStores} tanımlı bölge mağazası` : `${data.metrics.totalStores} assigned region stores`}</strong></div>
          <i />
          <PlanMenu label={copy.priority} value={riskLabel(risk, copy)} open={openMenu === 'risk'} onToggle={() => setOpenMenu((current) => current === 'risk' ? null : 'risk')}>
            {(['all', 'high', 'medium', 'low'] as const).map((value) => <button role="menuitemradio" aria-checked={risk === value} className={risk === value ? 'is-selected' : ''} key={value} onClick={() => { retainCurrentPeriod(); setRisk(value); setOffset(0); setOpenMenu(null) }}><span>{riskLabel(value, copy)}</span>{risk === value ? <Check size={13} /> : null}</button>)}
          </PlanMenu>
          <PlanMenu label={copy.status} value={statusLabel(planStatus, copy)} open={openMenu === 'status'} onToggle={() => setOpenMenu((current) => current === 'status' ? null : 'status')}>
            {(['all', 'unplanned', 'planned', 'waiting', 'missed', 'completed', 'mixed'] as const).map((value) => <button role="menuitemradio" aria-checked={planStatus === value} className={planStatus === value ? 'is-selected' : ''} key={value} onClick={() => { retainCurrentPeriod(); setPlanStatus(value); setOffset(0); setOpenMenu(null) }}><span>{statusLabel(value, copy)}</span>{planStatus === value ? <Check size={13} /> : null}</button>)}
          </PlanMenu>
          <PlanMenu label={copy.sort} value={sortLabel(sort, copy)} open={openMenu === 'sort'} onToggle={() => setOpenMenu((current) => current === 'sort' ? null : 'sort')}>
            {(['risk_desc', 'store_asc', 'store_desc', 'last_visit_desc', 'next_plan_asc'] as const).map((value) => <button role="menuitemradio" aria-checked={sort === value} className={sort === value ? 'is-selected' : ''} key={value} onClick={() => { retainCurrentPeriod(); setSort(value); setOffset(0); setOpenMenu(null) }}><span>{sortLabel(value, copy)}</span>{sort === value ? <Check size={13} /> : null}</button>)}
          </PlanMenu>
        </div>
        {periodQuery.isFetching ? <div className="plan-inline-refresh" aria-live="polite">{copy.refreshing}</div> : null}
        {periodQuery.isError ? <button type="button" className="plan-inline-error" onClick={() => void periodQuery.refetch()}>{getUserFacingErrorMessage(periodQuery.error, copy.refreshFailed)}</button> : null}
        <div className="canvas-plan-head"><span>{copy.store}</span><span>{copy.priority}</span><span>{copy.planned}</span><span>{copy.status}</span><span>{copy.reason}</span><span /></div>
        {data.items.length === 0 ? <div className="plan-empty"><CalendarDays size={20} /><strong>{copy.empty}</strong><button type="button" onClick={() => { retainCurrentPeriod(); setSearchDraft(''); setRisk('all'); setPlanStatus('all'); setOffset(0) }}>{copy.clear}</button></div> : <div className="canvas-plan-rows">{data.items.map((row) => {
          const completed = row.planItems.filter((item) => item.status === 'completed' && item.checklistInstanceId)
          const partialCompleted = row.planStatus === 'completed' && completed.length === 0
          return <article className={`canvas-plan-row canvas-plan-row--${row.risk}`} key={row.storeId}>
            <span className="store-cell"><strong>{row.storeName}</strong></span>
            <b className={`plan-risk plan-risk--${row.risk}`}>{riskLabel(row.risk, copy)}</b>
            <span className="plan-date"><strong>{formatPlanDates(row, input.locale)}</strong><small>{row.planItems.length > 1 ? copy.occurrences(row.planItems.length) : copy.plannedVisit}</small></span>
            <span className="plan-status"><b className={`status status--${statusTone(row.planStatus)}`}>{partialCompleted ? copy.partial : statusLabel(row.planStatus, copy)}</b></span>
            <span className="plan-reasons"><strong>{reasonLabel(row.reasonCodes[0], copy)}</strong>{row.reasonCodes[1] ? <small>{reasonLabel(row.reasonCodes[1], copy)}</small> : null}</span>
            <button type="button" className="canvas-action" disabled={partialCompleted} onClick={() => completed.length === 1 && row.planStatus === 'completed' ? input.onOpenResult(completed[0]!.checklistInstanceId!) : setSelectedRow(row)}>{partialCompleted ? copy.evidenceMissing : completed.length > 0 && row.planStatus === 'completed' ? (completed.length === 1 ? copy.result : copy.results) : row.planStatus === 'missed' ? copy.replan : row.planStatus === 'unplanned' ? copy.plan : copy.edit}<ChevronRight size={14} /></button>
          </article>
        })}</div>}
        <footer className="checklist-command-pagination"><span>{copy.range(firstItem, lastItem, data.page.total)}</span><div><button type="button" aria-label={copy.previous} disabled={offset === 0 || periodQuery.isFetching} onClick={() => { retainCurrentPeriod(); setOffset(Math.max(0, offset - PAGE_SIZE)) }}><ChevronLeft size={14} /></button><strong>{pageNumber} / {pageCount}</strong><button type="button" aria-label={copy.next} disabled={!data.page.hasMore || periodQuery.isFetching} onClick={() => { retainCurrentPeriod(); setOffset(offset + PAGE_SIZE) }}><ChevronRight size={14} /></button></div></footer>
      </section>

      {selectedRow ? <PlanVisitDrawer locale={input.locale} row={selectedRow} onClose={() => setSelectedRow(null)} onOpenPlanning={() => openPlanning(selectedRow)} onOpenResult={input.onOpenResult} /> : null}
    </div>
  )
}

function PlanMenu(input: { label: string; value: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <div className="toolbar-menu"><button type="button" aria-haspopup="menu" aria-expanded={input.open} onClick={input.onToggle}>{input.label} <span>{input.value}</span><ChevronDown size={12} /></button>{input.open ? <div className="toolbar-popover plan-toolbar-popover" role="menu">{input.children}</div> : null}</div>
}

function PlanVisitDrawer(input: { locale: 'tr' | 'en'; row: ChecklistVisitPlanPeriodRow; onClose: () => void; onOpenPlanning: () => void; onOpenResult: (checklistInstanceId: string) => void }) {
  const copy = getCopy(input.locale)
  return <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) input.onClose() }}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="plan-drawer-backdrop" /><DialogPrimitive.Content className="plan-drawer" aria-describedby="plan-drawer-copy"><header><div><span className="week-planner-icon"><CalendarDays size={16} /></span><span><small>{copy.visitPlan}</small><DialogPrimitive.Title>{input.row.storeName}</DialogPrimitive.Title></span></div><DialogPrimitive.Close aria-label={copy.close}><X size={17} /></DialogPrimitive.Close></header><main><section className="plan-drawer-intro"><b className={`plan-risk plan-risk--${input.row.risk}`}>{riskLabel(input.row.risk, copy)}</b><h2>{input.row.planStatus === 'missed' ? copy.replanVisit : copy.editVisit}</h2><p id="plan-drawer-copy">{copy.drawerCopy}</p></section><section className="plan-drawer-reason"><small>{copy.reason}</small>{input.row.reasonCodes.map((reason) => <strong key={reason}>{reasonLabel(reason, copy)}</strong>)}</section><section className="plan-drawer-occurrences"><small>{copy.planned}</small>{input.row.planItems.length === 0 ? <strong>{copy.notPlanned}</strong> : input.row.planItems.map((item) => <span key={item.planItemId}><span><b>{formatIsoDate(item.plannedDate, input.locale)}</b><em>{statusLabel(item.status, copy)}</em></span>{item.status === 'completed' && item.checklistInstanceId ? <button type="button" onClick={() => input.onOpenResult(item.checklistInstanceId!)}>{copy.result}</button> : null}</span>)}</section></main><footer><DialogPrimitive.Close>{copy.cancel}</DialogPrimitive.Close><button type="button" className="primary" onClick={input.onOpenPlanning}>{copy.openWeek}</button></footer></DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>
}

type Copy = ReturnType<typeof getCopy>
function getCopy(locale: 'tr' | 'en') {
  return locale === 'tr' ? {
    cancel: 'Vazgeç', clear: 'Filtreleri temizle', close: 'Kapat', drawerCopy: 'Bu mağazanın planını haftalık snapshot içinde güvenli biçimde düzenleyin.', edit: 'Planı düzenle', editVisit: 'Ziyaret planını düzenle', empty: 'Bu filtrelerde plan kaydı bulunamadı.', evidenceMissing: 'Kanıt eksik', forbidden: 'Bu bölgenin ziyaret planına erişiminiz yok.', high: 'Yüksek risk', highNote: 'Bu ay ziyaret eksik', loadFailed: 'Ziyaret planı yüklenemedi.', loading: 'Ziyaret planı yükleniyor', low: 'Aksiyon Yok', lowNote: 'Aksiyon gerekmiyor', medium: 'Aksiyon Takipte', mediumNote: 'Sonuç izlenmeli', metrics: 'Ziyaret planı öncelik özeti', next: 'Sonraki sayfa', notPlanned: 'Henüz planlanmadı', occurrences: (count: number) => `${count} ayrı ziyaret`, openWeek: 'Haftalık planı aç', partial: 'Kanıt eksik', plan: 'Planla', planned: 'Planlanan', plannedVisit: 'Planlanan ziyaret', planScope: 'ZİYARET PLANI', previous: 'Önceki sayfa', priority: 'Öncelik', range: (first: number, last: number, total: number) => `${first}-${last} / ${total} mağaza`, reason: 'Neden', refreshFailed: 'Plan güncellenemedi · tekrar dene', refreshing: 'Plan güncelleniyor…', replan: 'Yeniden planla', replanVisit: 'Ziyareti yeniden planla', result: 'Sonucu gör', results: 'Sonuçları gör', retry: 'Tekrar dene', scopeCount: (count: number) => `${count} mağaza plan kapsamında`, search: 'Mağaza veya plan ara', sort: 'Sırala', status: 'Durum', store: 'Mağaza', visitPlan: 'ZİYARET PLANI',
  } : {
    cancel: 'Cancel', clear: 'Clear filters', close: 'Close', drawerCopy: 'Edit this store inside the weekly snapshot safely.', edit: 'Edit plan', editVisit: 'Edit visit plan', empty: 'No plan record matches these filters.', evidenceMissing: 'Evidence missing', forbidden: 'You cannot access this region plan.', high: 'High risk', highNote: 'Visit missing this month', loadFailed: 'Visit plan could not be loaded.', loading: 'Loading visit plan', low: 'No Action', lowNote: 'No action required', medium: 'Action in progress', mediumNote: 'Outcome should be monitored', metrics: 'Visit-plan priority summary', next: 'Next page', notPlanned: 'Not planned yet', occurrences: (count: number) => `${count} separate visits`, openWeek: 'Open weekly plan', partial: 'Evidence missing', plan: 'Plan', planned: 'Planned', plannedVisit: 'Planned visit', planScope: 'VISIT PLAN', previous: 'Previous page', priority: 'Priority', range: (first: number, last: number, total: number) => `${first}-${last} / ${total} stores`, reason: 'Reason', refreshFailed: 'Could not refresh plan · retry', refreshing: 'Refreshing plan…', replan: 'Replan', replanVisit: 'Replan visit', result: 'View result', results: 'View results', retry: 'Try again', scopeCount: (count: number) => `${count} stores in plan scope`, search: 'Search store or plan', sort: 'Sort', status: 'Status', store: 'Store', visitPlan: 'VISIT PLAN',
  }
}

function riskLabel(value: ChecklistVisitPlanRisk | Exclude<ChecklistVisitPlanRisk, 'all'>, copy: Copy) {
  return value === 'high' ? copy.high : value === 'medium' ? copy.medium : value === 'low' ? copy.low : (copy.visitPlan === 'ZİYARET PLANI' ? 'Tümü' : 'All')
}
function statusLabel(value: ChecklistVisitPlanStatus | 'planned' | 'waiting' | 'missed' | 'completed', copy: Copy) {
  const tr = copy.visitPlan === 'ZİYARET PLANI'
  return ({ all: tr ? 'Tümü' : 'All', unplanned: tr ? 'Plan yapılmadı' : 'Not planned', planned: tr ? 'Ziyaret Planlandı' : 'Visit Planned', waiting: tr ? 'Ziyaret Bekleniyor' : 'Visit Waiting', missed: tr ? 'Checklist yapılmadı' : 'Checklist not completed', completed: tr ? 'Ziyaret Tamamlandı' : 'Visit Completed', mixed: tr ? 'Karma plan' : 'Mixed plan' })[value]
}
function sortLabel(value: ChecklistVisitPlanSort, copy: Copy) {
  const tr = copy.visitPlan === 'ZİYARET PLANI'
  return ({ risk_desc: tr ? 'Risk önceliği' : 'Risk priority', store_asc: tr ? 'Mağaza A-Z' : 'Store A-Z', store_desc: tr ? 'Mağaza Z-A' : 'Store Z-A', last_visit_asc: tr ? 'En eski ziyaret' : 'Oldest visit', last_visit_desc: tr ? 'En yeni ziyaret' : 'Newest visit', next_plan_asc: tr ? 'En yakın plan' : 'Next plan', next_plan_desc: tr ? 'En uzak plan' : 'Latest plan' })[value]
}
function statusTone(value: ChecklistVisitPlanPeriodRow['planStatus']) { return value === 'completed' ? 'done' : value === 'missed' ? 'late' : value === 'planned' ? 'planned' : 'review' }
function reasonLabel(value: ChecklistVisitPlanPeriodRow['reasonCodes'][number] | undefined, copy: Copy) {
  const tr = copy.visitPlan === 'ZİYARET PLANI'
  if (!value) return tr ? 'Neden bilgisi yok' : 'No reason available'
  const labels = tr ? {
    missing_current_month_visit: 'Bu ay ziyaret eksik', low_checklist_score: 'Checklist skoru düşük', watch_checklist_result: 'Sonuç takip edilmeli', active_draft: 'Aktif checklist taslağı', pending_acknowledgement: 'Onay bekliyor', visit_completed: 'Ziyaret tamamlandı', strong_score: 'Güçlü checklist sonucu', insufficient_signal: 'Yetersiz sinyal',
  } : {
    missing_current_month_visit: 'Visit missing this month', low_checklist_score: 'Low checklist score', watch_checklist_result: 'Result needs monitoring', active_draft: 'Active checklist draft', pending_acknowledgement: 'Acknowledgement pending', visit_completed: 'Visit completed', strong_score: 'Strong checklist result', insufficient_signal: 'Insufficient signal',
  }
  return labels[value]
}
function formatPlanDates(row: ChecklistVisitPlanPeriodRow, locale: 'tr' | 'en') {
  if (row.planItems.length === 0) return locale === 'tr' ? 'Plan yapılmadı' : 'Not planned'
  const labels = row.planItems.slice(0, 2).map((item) => formatIsoDate(item.plannedDate, locale))
  return row.planItems.length > 2 ? `${labels.join(', ')} +${row.planItems.length - 2}` : labels.join(', ')
}
function formatIsoDate(value: string, locale: 'tr' | 'en') {
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00.000Z`)).replace('.', '')
}
