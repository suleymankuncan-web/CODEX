import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Dialog as DialogPrimitive } from 'radix-ui'
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Search,
  X,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { AuthSessionSummary } from '../auth/api'
import { storeChecklistVisitPlanPeriodQueryKey } from '../auth/store-query-scope'
import { ApiError } from '../../lib/api'
import { getUserFacingErrorMessage } from '../../lib/format'
import { transientQueryRetryOptions } from '../../lib/query-retry'
import { getChecklistVisitPlanPeriod, type ChecklistVisitPlanPeriodRow } from './api'
import { ChecklistWeeklyVisitPlanner } from './ChecklistWeeklyVisitPlanner'
import {
  type ChecklistVisitPlanRisk,
  type ChecklistVisitPlanStatus,
} from './model'

const PAGE_SIZE = 30

export function ChecklistVisitPlanSurface(input: {
  authSummary: AuthSessionSummary | null
  embedded?: boolean
  locale: 'tr' | 'en'
  period: string
  regionId: string
  regionName: string
  weekStart: string
  onOpenWorkflow: (storeId: string, tab?: 'visits' | 'inbox' | 'history', directChecklist?: 'bm') => void
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchDraft.trim())
      setOffset(0)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchDraft])

  const filters = useMemo(() => ({
    regionId: input.regionId,
    period: input.period,
    query,
    risk: 'all' as const,
    planStatus: 'all' as const,
    sort: 'risk_desc' as const,
    limit: PAGE_SIZE,
    offset,
  }), [input.period, input.regionId, offset, query])
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
    <div className={`checklist-plan-view${input.embedded ? ' checklist-plan-view--embedded' : ''}`}>
      <ChecklistWeeklyVisitPlanner
        authSummary={input.authSummary}
        canMaintain={data.capabilities.canMaintainWeeklyVisitPlan}
        embedded={input.embedded === true}
        locale={input.locale}
        period={input.period}
        planningRequest={planningRequest}
        onPlanningRequestHandled={() => setPlanningRequest(undefined)}
        regionId={input.regionId}
        regionName={data.regionName || input.regionName}
        weekStart={input.weekStart}
        onOpenWorkflow={(storeId) => input.onOpenWorkflow(storeId, 'visits', 'bm')}
        onWeekStartChange={input.onWeekStartChange}
      />

      <section className="canvas-surface canvas-plan-surface">
        <div className="command-row canvas-plan-command">
          <label><Search size={15} /><input value={searchDraft} onChange={(event) => { retainCurrentPeriod(); setSearchDraft(event.target.value) }} placeholder={copy.search} /><kbd>/</kbd></label>
        </div>
        {periodQuery.isFetching ? <div className="plan-inline-refresh" aria-live="polite">{copy.refreshing}</div> : null}
        {periodQuery.isError ? <button type="button" className="plan-inline-error" onClick={() => void periodQuery.refetch()}>{getUserFacingErrorMessage(periodQuery.error, copy.refreshFailed)}</button> : null}
        <div className="canvas-plan-head"><span>{copy.store}</span><span className="visit-count-heading">{copy.visitCount}</span><span>{copy.status}</span><span>{copy.reason}</span><span /></div>
        {data.items.length === 0 ? <div className="plan-empty"><CalendarDays size={20} /><strong>{copy.empty}</strong><button type="button" onClick={() => { retainCurrentPeriod(); setSearchDraft(''); setOffset(0) }}>{copy.clear}</button></div> : <div className="canvas-plan-rows">{data.items.map((row) => {
          const completed = row.planItems.filter((item) => item.status === 'completed')
          const completedChecklist = completed.filter((item) => item.checklistInstanceId)
          return <article className={`canvas-plan-row canvas-plan-row--${row.risk}`} key={row.storeId}>
            <span className="store-cell"><strong>{row.storeName}</strong></span>
            <VisitCountPopover authSummary={input.authSummary} regionId={input.regionId} row={row} locale={input.locale} />
            <span className="plan-status"><b className={`status status--${statusTone(row.planStatus)}`}>{periodRowStatusLabel(row, copy)}</b></span>
            <span className={`plan-result plan-result--${resultStatus(row)}`}><strong>{resultLabel(row, copy)}</strong></span>
            {row.planStatus === 'unplanned' ? <span aria-hidden="true" /> : <button type="button" className="canvas-action" onClick={() => completedChecklist.length === 1 && row.planStatus === 'completed' ? input.onOpenResult(completedChecklist[0]!.checklistInstanceId!) : setSelectedRow(row)}>{completedChecklist.length > 0 && row.planStatus === 'completed' ? (completedChecklist.length === 1 ? copy.result : copy.results) : row.planStatus === 'missed' ? copy.replan : copy.edit}<ChevronRight size={14} /></button>}
          </article>
        })}</div>}
        <footer className="checklist-command-pagination"><span>{copy.range(firstItem, lastItem, data.page.total)}</span><div><button type="button" aria-label={copy.previous} disabled={offset === 0 || periodQuery.isFetching} onClick={() => { retainCurrentPeriod(); setOffset(Math.max(0, offset - PAGE_SIZE)) }}><ChevronLeft size={14} /></button><strong>{pageNumber} / {pageCount}</strong><button type="button" aria-label={copy.next} disabled={!data.page.hasMore || periodQuery.isFetching} onClick={() => { retainCurrentPeriod(); setOffset(offset + PAGE_SIZE) }}><ChevronRight size={14} /></button></div></footer>
      </section>

      {selectedRow ? <PlanVisitDrawer locale={input.locale} row={selectedRow} onClose={() => setSelectedRow(null)} onOpenPlanning={() => openPlanning(selectedRow)} onOpenResult={input.onOpenResult} /> : null}
    </div>
  )
}

function PlanVisitDrawer(input: { locale: 'tr' | 'en'; row: ChecklistVisitPlanPeriodRow; onClose: () => void; onOpenPlanning: () => void; onOpenResult: (checklistInstanceId: string) => void }) {
  const copy = getCopy(input.locale)
  return <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) input.onClose() }}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="plan-drawer-backdrop" /><DialogPrimitive.Content className="plan-drawer" aria-describedby="plan-drawer-copy"><header><div><span className="week-planner-icon"><CalendarDays size={16} /></span><span><small>{copy.visitPlan}</small><DialogPrimitive.Title>{input.row.storeName}</DialogPrimitive.Title></span></div><DialogPrimitive.Close aria-label={copy.close}><X size={17} /></DialogPrimitive.Close></header><main><section className="plan-drawer-intro"><b className={`plan-risk plan-risk--${input.row.risk}`}>{riskLabel(input.row.risk, copy)}</b><h2>{input.row.planStatus === 'missed' ? copy.replanVisit : copy.editVisit}</h2><p id="plan-drawer-copy">{copy.drawerCopy}</p></section><section className="plan-drawer-reason"><small>{copy.reason}</small>{input.row.reasonCodes.map((reason) => <strong key={reason}>{reasonLabel(reason, copy)}</strong>)}</section><section className="plan-drawer-occurrences"><small>{copy.planned}</small>{input.row.planItems.length === 0 ? <strong>{copy.notPlanned}</strong> : input.row.planItems.map((item) => <span key={item.planItemId}><span><b>{formatIsoDate(item.plannedDate, input.locale)}</b><em>{planItemStatusLabel(item, copy)}</em></span>{item.status === 'completed' && item.checklistInstanceId ? <button type="button" onClick={() => input.onOpenResult(item.checklistInstanceId!)}>{copy.result}</button> : null}</span>)}</section></main><footer><DialogPrimitive.Close>{copy.cancel}</DialogPrimitive.Close><button type="button" className="primary" onClick={input.onOpenPlanning}>{copy.openWeek}</button></footer></DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>
}

type VisitCalendarState = 'checklist' | 'visited' | 'planned' | 'missed'

function VisitCountPopover(input: { authSummary: AuthSessionSummary | null; regionId: string; row: ChecklistVisitPlanPeriodRow; locale: 'tr' | 'en' }) {
  if (input.row.planItems.length === 0) return <span className="visit-count-cell"><strong className="visit-count-empty">0</strong></span>
  const year = visitCalendarYear(input.row.planItems)
  return <VisitCountPopoverContent key={`${input.row.storeId}:${year}`} {...input} />
}

function VisitCountPopoverContent(input: {
  authSummary: AuthSessionSummary | null
  calendarTitle?: string
  hideTrigger?: boolean
  initiallyOpen?: boolean
  locale: 'tr' | 'en'
  onOpenChange?: (open: boolean) => void
  regionId: string
  row: ChecklistVisitPlanPeriodRow
  storeSelector?: ReactNode
}) {
  const copy = getCopy(input.locale)
  const [open, setOpen] = useState(input.initiallyOpen === true)
  const changeOpen = (nextOpen: boolean) => {
    setOpen(nextOpen)
    input.onOpenChange?.(nextOpen)
  }
  const count = input.row.planItems.length
  const descriptionId = `visit-dates-description-${input.row.storeId}`
  const visits = input.row.planItems.slice().sort((left, right) => left.plannedDate.localeCompare(right.plannedDate) || left.displayOrder - right.displayOrder)
  const initialYear = visitCalendarYear(visits)
  const [selectedYear, setSelectedYear] = useState(initialYear)
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)

  const yearPeriods = useMemo(() => buildVisitCalendarPeriods(selectedYear), [selectedYear])
  const annualScopeKey = storeChecklistVisitPlanPeriodQueryKey(input.authSummary, {
    regionId: input.regionId,
    period: yearPeriods[0] ?? `${selectedYear}-01`,
    query: '',
    risk: 'all',
    planStatus: 'all',
    sort: 'store_asc',
    limit: 100,
    offset: 0,
  })[1]
  const annualQuery = useQuery({
    queryKey: ['checklist-visit-plan-year', annualScopeKey, input.regionId, selectedYear],
    queryFn: async () => {
      const periodRows = await Promise.all(yearPeriods.map(async (period) => {
        const rows: ChecklistVisitPlanPeriodRow[] = []
        let pageOffset = 0
        while (true) {
          const response = await getChecklistVisitPlanPeriod({
            regionId: input.regionId,
            period,
            query: '',
            risk: 'all',
            planStatus: 'all',
            sort: 'store_asc',
            limit: 100,
            offset: pageOffset,
          })
          rows.push(...response.data.items)
          if (!response.data.page.hasMore) break
          pageOffset += Math.max(1, response.data.page.limit)
        }
        return rows
      }))
      const byStore = new Map<string, { storeCode: string; storeId: string; storeName: string; planItems: Map<string, ChecklistVisitPlanPeriodRow['planItems'][number]> }>()
      for (const rows of periodRows) {
        for (const row of rows) {
          const store = byStore.get(row.storeId) ?? { storeCode: row.storeCode, storeId: row.storeId, storeName: row.storeName, planItems: new Map() }
          for (const item of row.planItems) store.planItems.set(`${item.planItemId}:${item.plannedDate}`, item)
          byStore.set(row.storeId, store)
        }
      }
      return [...byStore.values()].map((store) => ({
        storeCode: store.storeCode,
        storeId: store.storeId,
        storeName: store.storeName,
        planItems: [...store.planItems.values()].sort((left, right) => left.plannedDate.localeCompare(right.plannedDate) || left.displayOrder - right.displayOrder),
      }))
    },
    enabled: open,
    ...transientQueryRetryOptions,
  })
  const annualStores = annualQuery.data ?? (selectedYear === initialYear ? [{ storeCode: input.row.storeCode, storeId: input.row.storeId, storeName: input.row.storeName, planItems: visits }] : [])
  const annualVisits = annualStores.find((store) => store.storeId === input.row.storeId)?.planItems ?? []
  const calendar = buildVisitCalendar(selectedYear, input.locale)
  const visitByDate = new Map<string, VisitCalendarState>()
  const visitsByDate = new Map<string, ChecklistVisitPlanPeriodRow['planItems']>()
  for (const item of annualVisits) {
    visitsByDate.set(item.plannedDate, [...(visitsByDate.get(item.plannedDate) ?? []), item])
    const nextState = visitCalendarState(item)
    const currentState = visitByDate.get(item.plannedDate)
    if (!currentState || visitCalendarStatePriority(nextState) > visitCalendarStatePriority(currentState)) {
      visitByDate.set(item.plannedDate, nextState)
    }
  }
  const visibleVisits = selectedDate
    ? annualVisits.filter((item) => item.plannedDate === selectedDate)
    : selectedMonth === 'all'
      ? annualVisits
      : annualVisits.filter((item) => Number(item.plannedDate.slice(5, 7)) - 1 === selectedMonth)
  const activityScope = selectedDate
    ? formatIsoDateLong(selectedDate, input.locale)
    : selectedMonth === 'all'
      ? `${selectedYear}`
      : `${calendar[selectedMonth]?.label ?? ''} ${selectedYear}`
  const rankingScope = selectedMonth === 'all'
    ? `${selectedYear}`
    : `${calendar[selectedMonth]?.label ?? ''} ${selectedYear}`
  const visitRanking = annualStores
    .map((store) => ({
      storeCode: store.storeCode,
      storeId: store.storeId,
      storeName: store.storeName,
      visitCount: store.planItems.filter((item) => isCompletedVisitPlanItem(item) && (selectedMonth === 'all' || Number(item.plannedDate.slice(5, 7)) - 1 === selectedMonth)).length,
    }))
    .filter((store) => store.visitCount > 0)
    .sort((left, right) => right.visitCount - left.visitCount || left.storeName.localeCompare(right.storeName, input.locale === 'tr' ? 'tr-TR' : 'en-US'))
    .slice(0, 5)
  const inspectedDate = hoveredDate ?? selectedDate
  const inspectedVisits = inspectedDate ? visitsByDate.get(inspectedDate) ?? [] : visibleVisits
  const completedVisitCount = annualVisits.filter(isCompletedVisitPlanItem).length
  const loadingAnnualVisits = open && annualQuery.isFetching && !annualQuery.data
  const annualVisitsError = open && annualQuery.isError

  const calendarDialog = <DialogPrimitive.Root open={open} onOpenChange={changeOpen}>
      {input.hideTrigger ? null : <DialogPrimitive.Trigger type="button" className="visit-count-trigger" aria-haspopup="dialog" aria-label={copy.visitCountLabel(count)}>{copy.visitCountLabel(count)}</DialogPrimitive.Trigger>}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="visit-calendar-backdrop" />
        <DialogPrimitive.Content className="visit-calendar-dialog" aria-describedby={descriptionId}>
          <header className="visit-calendar-header">
            <div><DialogPrimitive.Title>{input.calendarTitle ?? copy.visitDates}</DialogPrimitive.Title><span>{input.row.storeName} · {selectedYear}</span></div>
            <DialogPrimitive.Close aria-label={copy.close}><X size={15} /></DialogPrimitive.Close>
          </header>
          <DialogPrimitive.Description id={descriptionId} className="visit-calendar-description">{copy.visitDatesDescription}</DialogPrimitive.Description>
          <div className="visit-calendar-filters" aria-label={copy.visitCalendarFilters}>
            {input.storeSelector}
            <VisitCalendarFilterPopover
              calendar={calendar}
              copy={copy}
              locale={input.locale}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onApply={(year, month) => { setSelectedYear(year); setSelectedMonth(month); setSelectedDate(null) }}
            />
          </div>
          <div className="visit-calendar-body">
            <section className="visit-calendar-overview" aria-label={copy.visitDates}>
              {loadingAnnualVisits ? <p className="visit-calendar-state" role="status">{copy.visitCalendarLoading}</p> : null}
              {annualVisitsError ? <p className="visit-calendar-state visit-calendar-state--error" role="alert">{copy.visitCalendarLoadError}</p> : null}
              <div className="visit-atlas-card">
                <header className="visit-atlas-heading">
                  <span><strong>{selectedYear} {input.locale === 'tr' ? 'Ziyaret Takvimi' : 'Visit Calendar'}</strong><p>{input.locale === 'tr' ? `${input.row.storeName} · 12 aylık görünüm` : `${input.row.storeName} · 12-month view`}</p></span>
                  <div className="visit-atlas-totals">
                    <span><strong>{annualVisits.length}</strong><small>{input.locale === 'tr' ? 'plan hareketi' : 'plan activities'}</small></span>
                    <span><strong>{completedVisitCount}</strong><small>{input.locale === 'tr' ? 'tamamlanan' : 'completed'}</small></span>
                  </div>
                </header>
                <div className="visit-atlas-workspace">
                  <section className="visit-atlas-map-panel" aria-label={input.locale === 'tr' ? '12 aylık ziyaret takvimi' : '12-month visit calendar'}>
                    <div className="visit-calendar-legend" aria-label={copy.visitCalendarLegend}>
                      <span><i className="visit-calendar-legend-swatch visit-calendar-legend-swatch--checklist" />{copy.visitCalendarChecklist}</span>
                      <span><i className="visit-calendar-legend-swatch visit-calendar-legend-swatch--visited" />{copy.visitCalendarVisited}</span>
                      <span><i className="visit-calendar-legend-swatch visit-calendar-legend-swatch--planned" />{copy.visitCalendarPlanned}</span>
                      <span><i className="visit-calendar-legend-swatch visit-calendar-legend-swatch--missed" />{copy.visitCalendarMissed}</span>
                    </div>
                    <div className="visit-calendar-grid" onPointerLeave={() => setHoveredDate(null)}>
                      {calendar.map((month) => {
                        const monthVisitCount = annualVisits.filter((item) => Number(item.plannedDate.slice(5, 7)) - 1 === month.monthIndex).length
                        return <section className="visit-calendar-month" key={month.monthIndex}>
                          <header><h4>{month.label}</h4>{monthVisitCount > 0 ? <span>{monthVisitCount}</span> : null}</header>
                          <div className="visit-calendar-weekdays" aria-hidden="true">{month.weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
                          <div className="visit-calendar-days">
                            {month.cells.map((cell, cellIndex) => {
                              if (!cell) return <span className="visit-calendar-day visit-calendar-day--empty" aria-hidden="true" key={`empty-${cellIndex}`} />
                              const state = visitByDate.get(cell.isoDate)
                              const label = state ? `${formatIsoDateLong(cell.isoDate, input.locale)}, ${input.row.storeName}, ${visitCalendarStateLabel(state, copy)}` : formatIsoDateLong(cell.isoDate, input.locale)
                              return <button type="button" className={`visit-calendar-day${state ? ` visit-calendar-day--${state}` : ''}${selectedDate === cell.isoDate ? ' is-selected' : ''}`} data-calendar-date={cell.isoDate} aria-label={label} aria-pressed={selectedDate === cell.isoDate} key={cell.isoDate} onPointerEnter={() => setHoveredDate(cell.isoDate)} onFocus={() => setHoveredDate(cell.isoDate)} onBlur={() => setHoveredDate(null)} onClick={() => { setSelectedDate(cell.isoDate); setSelectedMonth(month.monthIndex) }}>{cell.day}</button>
                            })}
                          </div>
                        </section>
                      })}
                    </div>
                    <p className="visit-atlas-hint">{input.locale === 'tr' ? 'Bir güne gelin veya dokunun. Tarih, mağaza ve işlem sağda görünür.' : 'Hover or select a day. Date, store and activity appear on the right.'}</p>
                  </section>
                  <aside className="visit-atlas-inspector" aria-label={copy.visitCalendarListTitle} aria-live="polite">
                    <header className="visit-atlas-feed-header">
                      <span><small>{inspectedDate ? (input.locale === 'tr' ? 'GÜN DETAYI' : 'DAY DETAIL') : (input.locale === 'tr' ? 'HAREKET AKIŞI' : 'ACTIVITY FEED')}</small><h3>{inspectedDate ? formatIsoDateLong(inspectedDate, input.locale) : copy.visitCalendarListTitle}</h3><p>{inspectedDate ? input.row.storeName : activityScope}</p></span>
                      <b>{inspectedVisits.length}</b>
                    </header>
                    {selectedDate ? <button type="button" className="visit-atlas-clear-day" onClick={() => setSelectedDate(null)}>{input.locale === 'tr' ? 'Döneme dön' : 'Back to period'}</button> : null}
                    <ul>{inspectedVisits.length === 0 ? <li className="visit-calendar-list-empty">{inspectedDate ? (input.locale === 'tr' ? 'Bu tarihte ziyaret hareketi yok.' : 'No visit activity on this date.') : copy.visitCalendarEmpty}</li> : inspectedVisits.map((item) => {
                      const state = visitCalendarState(item)
                      return <li key={`${item.planItemId}:${item.plannedDate}`}><span className={`visit-atlas-event-mark visit-atlas-event-mark--${state}`} aria-hidden="true" /><span><time dateTime={item.plannedDate}>{formatIsoDateLong(item.plannedDate, input.locale)}</time><strong>{input.row.storeName}</strong><small>{visitCalendarStateLabel(state, copy)}</small></span></li>
                    })}</ul>
                  </aside>
                </div>
                <section className="visit-atlas-ranking" aria-label={input.locale === 'tr' ? 'En çok ziyaret edilen mağazalar' : 'Most visited stores'}>
                  <header><span><h3>{input.locale === 'tr' ? 'En çok ziyaret edilen mağazalar' : 'Most visited stores'}</h3><p>{rankingScope}</p></span><b>{input.locale === 'tr' ? 'İlk 5' : 'Top 5'}</b></header>
                  {visitRanking.length === 0 ? <p className="visit-atlas-ranking-empty">{input.locale === 'tr' ? 'Bu dönemde tamamlanan ziyaret bulunmuyor.' : 'No completed visits in this period.'}</p> : <ol>{visitRanking.map((store, index) => <li key={store.storeId}><strong className="visit-atlas-rank">{index + 1}</strong><span><b>{store.storeName}</b><small>{store.storeCode}</small></span><strong className="visit-atlas-rank-count">{store.visitCount}<small>{input.locale === 'tr' ? ' ziyaret' : ' visits'}</small></strong></li>)}</ol>}
                </section>
              </div>
            </section>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  return input.hideTrigger ? calendarDialog : <span className="visit-count-cell">{calendarDialog}</span>
}

function VisitCalendarFilterPopover(input: {
  calendar: ReturnType<typeof buildVisitCalendar>
  copy: Copy
  locale: 'tr' | 'en'
  selectedMonth: number | 'all'
  selectedYear: number
  onApply: (year: number, month: number | 'all') => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<{ year: number; month: number | 'all' }>({ year: input.selectedYear, month: input.selectedMonth })
  const draftCalendar = useMemo(() => buildVisitCalendar(draft.year, input.locale), [draft.year, input.locale])
  const selectedLabel = visitCalendarFilterLabel(input.selectedYear, input.selectedMonth, input.calendar, input.copy)
  const draftLabel = visitCalendarFilterLabel(draft.year, draft.month, draftCalendar, input.copy)
  const currentPeriod = getCurrentVisitCalendarPeriod()
  const resetDraft = () => setDraft({ year: input.selectedYear, month: input.selectedMonth })

  return <div className={`checklist-command-period visit-calendar-filter${open ? ' is-open' : ''}`}>
    <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (nextOpen) resetDraft() }}>
      <PopoverTrigger asChild>
        <button type="button" className="checklist-command-period-trigger visit-calendar-filter-trigger" aria-haspopup="dialog" aria-expanded={open}>
          <CalendarDays size={15} />
          <span><small>{input.copy.visitCalendarFilters}</small><strong>{selectedLabel}</strong></span>
          <ChevronDown size={13} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} aria-label={input.copy.visitCalendarFilters} className="visit-calendar-filter-popover">
        <div className="checklist-command-period-popover">
          <header>
            <div><span className="checklist-command-period-icon"><CalendarDays size={16} /></span><span><small>{input.locale === 'tr' ? 'TAKVİM GÖRÜNÜMÜ' : 'CALENDAR VIEW'}</small><strong>{input.locale === 'tr' ? 'Yıl ve ay seçin' : 'Select year and month'}</strong></span></div>
            <button type="button" aria-label={input.copy.close} onClick={() => setOpen(false)}><X size={15} /></button>
          </header>
          <div className="checklist-command-period-presets visit-calendar-filter-presets">
            <button type="button" className={draft.month === 'all' ? 'is-active' : ''} onClick={() => setDraft((current) => ({ ...current, month: 'all' }))}>{input.copy.visitCalendarAllMonths}</button>
            <button type="button" className={draft.year === currentPeriod.year && draft.month === currentPeriod.month ? 'is-active' : ''} onClick={() => setDraft(currentPeriod)}>{input.copy.visitCalendarCurrentMonth}</button>
          </div>
          <div className="checklist-command-period-year">
            <button type="button" aria-label={input.locale === 'tr' ? 'Önceki yıl' : 'Previous year'} onClick={() => setDraft((current) => ({ ...current, year: current.year - 1 }))}><ChevronLeft size={15} /></button>
            <span><small>{input.copy.visitCalendarYear}</small><strong>{draft.year}</strong></span>
            <button type="button" aria-label={input.locale === 'tr' ? 'Sonraki yıl' : 'Next year'} onClick={() => setDraft((current) => ({ ...current, year: current.year + 1 }))}><ChevronRight size={15} /></button>
          </div>
          <div className="checklist-command-period-months" role="group" aria-label={input.copy.visitCalendarMonth}>
            {draftCalendar.map((month) => <button type="button" aria-pressed={draft.month === month.monthIndex} className={draft.month === month.monthIndex ? 'is-active' : ''} key={month.monthIndex} onClick={() => setDraft((current) => ({ ...current, month: month.monthIndex }))}><span>{month.label}</span>{draft.month === month.monthIndex ? <Check size={13} /> : null}</button>)}
          </div>
          <footer>
            <button type="button" onClick={() => { resetDraft(); setOpen(false) }}>{input.copy.cancel}</button>
            <span>{draftLabel}</span>
            <button type="button" className="primary visit-calendar-filter-apply" onClick={() => { input.onApply(draft.year, draft.month); setOpen(false) }}><Check size={14} /> {input.copy.apply}</button>
          </footer>
        </div>
      </PopoverContent>
    </Popover>
  </div>
}

type Copy = ReturnType<typeof getCopy>

function visitCalendarYear(items: ChecklistVisitPlanPeriodRow['planItems']) {
  const year = items.map((item) => Number(item.plannedDate.slice(0, 4))).find((value) => Number.isFinite(value) && value > 0)
  return year ?? new Date().getUTCFullYear()
}

function buildVisitCalendar(year: number, locale: 'tr' | 'en') {
  const monthFormatter = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', timeZone: 'UTC' })
  const weekdays = locale === 'tr' ? ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'] : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
  return Array.from({ length: 12 }, (_value, monthIndex) => {
    const firstWeekday = (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7
    const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
    const cells = Array.from({ length: 42 }, (_cell, index) => {
      if (index < firstWeekday || index >= firstWeekday + daysInMonth) return null
      const day = index - firstWeekday + 1
      return { day, isoDate: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` }
    })
    return { monthIndex, label: monthFormatter.format(new Date(Date.UTC(year, monthIndex, 1))), weekdays, cells }
  })
}

function buildVisitCalendarPeriods(year: number) {
  return Array.from({ length: 12 }, (_value, monthIndex) => `${year}-${String(monthIndex + 1).padStart(2, '0')}`)
}

function visitCalendarFilterLabel(year: number, month: number | 'all', calendar: ReturnType<typeof buildVisitCalendar>, copy: Copy) {
  return month === 'all' ? `${year} · ${copy.visitCalendarAllMonths}` : `${calendar[month]?.label ?? ''} ${year}`
}

function getCurrentVisitCalendarPeriod() {
  const now = new Date()
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() }
}

function visitCalendarState(item: ChecklistVisitPlanPeriodRow['planItems'][number]): VisitCalendarState {
  if (item.checklistInstanceId) return 'checklist'
  if (isCompletedVisitPlanItem(item)) return 'visited'
  if (item.status === 'missed') return 'missed'
  return 'planned'
}

function isCompletedVisitPlanItem(item: ChecklistVisitPlanPeriodRow['planItems'][number]) {
  return Boolean(item.checklistInstanceId || item.visitCompletedAt || item.status === 'completed')
}

function visitCalendarStatePriority(state: VisitCalendarState) {
  return ({ missed: 1, planned: 2, visited: 3, checklist: 4 })[state]
}

function visitCalendarStateLabel(state: VisitCalendarState, copy: Copy) {
  return state === 'checklist'
    ? copy.visitCalendarChecklist
    : state === 'visited'
      ? copy.visitCalendarVisited
      : state === 'missed'
        ? copy.visitCalendarMissed
        : copy.visitCalendarPlanned
}

function getCopy(locale: 'tr' | 'en') {
  return locale === 'tr' ? {
    visitCalendarChecklist: 'Checklist Yapıldı',
    visitCalendarVisited: 'Ziyaret Yapıldı',
    apply: 'Uygula', cancel: 'Vazgeç', clear: 'Filtreleri temizle', close: 'Kapat', drawerCopy: 'Bu mağazanın planını haftalık snapshot içinde güvenli biçimde düzenleyin.', edit: 'Planı düzenle', editVisit: 'Ziyaret planını düzenle', empty: 'Bu filtrelerde plan kaydı bulunamadı.', evidenceMissing: 'Kanıt eksik', forbidden: 'Bu ziyaret planına erişiminiz yok.', high: 'Yüksek risk', highNote: 'Bu ay ziyaret eksik', loadFailed: 'Ziyaret planı yüklenemedi.', loading: 'Ziyaret planı yükleniyor', low: 'Aksiyon Yok', lowNote: 'Aksiyon gerekmiyor', medium: 'Aksiyon Takipte', mediumNote: 'Sonuç izlenmeli', metrics: 'Ziyaret planı öncelik özeti', next: 'Sonraki sayfa', notPlanned: 'Henüz planlanmadı', openWeek: 'Haftalık planı aç', partial: 'Kanıt eksik', plan: 'Planla', planned: 'Planlanan', planScope: 'ZİYARET PLANI', previous: 'Önceki sayfa', priority: 'Öncelik', range: (first: number, last: number, total: number) => `${first}-${last} / ${total} mağaza`, reason: 'Sonuç', resultApproved: 'Onaylandı', resultPending: 'Onay Bekliyor', refreshFailed: 'Plan güncellenemedi · tekrar dene', refreshing: 'Plan güncelleniyor…', replan: 'Yeniden planla', replanVisit: 'Ziyareti yeniden planla', result: 'Sonucu gör', results: 'Sonuçları gör', retry: 'Tekrar dene', scopeCount: (count: number) => `${count} mağaza plan kapsamında`, search: 'Mağaza veya plan ara', sort: 'Sırala', status: 'Durum', store: 'Mağaza', visitCalendarAllMonths: 'Tüm aylar', visitCalendarCompleted: 'Tamamlandı', visitCalendarCurrentMonth: 'Bu ay', visitCalendarEmpty: 'Bu görünümde ziyaret hareketi yok.', visitCalendarFilters: 'Takvim filtreleri', visitCalendarLegend: 'Takvim açıklaması', visitCalendarListTitle: 'Ziyaret akışı', visitCalendarLoadError: 'Yıllık ziyaretler yüklenemedi.', visitCalendarLoading: 'Yıllık ziyaretler yükleniyor…', visitCalendarMissed: 'Yapılmadı', visitCalendarMonth: 'Ay', visitCalendarPlanned: 'Planlandı', visitCalendarYear: 'Yıl', visitCount: 'Ziyaret Sayısı', visitCountLabel: (count: number) => `${count} Ziyaret`, visitDates: 'Ziyaret tarihleri', visitDatesDescription: 'Seçili mağazanın yıllık ziyaret hareket haritası.', visitPlan: 'ZİYARET PLANI',
  } : {
    visitCalendarChecklist: 'Checklist Completed',
    visitCalendarVisited: 'Visit Completed',
    apply: 'Apply', cancel: 'Cancel', clear: 'Clear filters', close: 'Close', drawerCopy: 'Edit this store inside the weekly snapshot safely.', edit: 'Edit plan', editVisit: 'Edit visit plan', empty: 'No plan record matches these filters.', evidenceMissing: 'Evidence missing', forbidden: 'You cannot access this region plan.', high: 'High risk', highNote: 'Visit missing this month', loadFailed: 'Visit plan could not be loaded.', loading: 'Loading visit plan', low: 'No Action', lowNote: 'No action required', medium: 'Action in progress', mediumNote: 'Outcome should be monitored', metrics: 'Visit-plan priority summary', next: 'Next page', notPlanned: 'Not planned yet', openWeek: 'Open weekly plan', partial: 'Evidence missing', plan: 'Plan', planned: 'Planned', planScope: 'VISIT PLAN', previous: 'Previous page', priority: 'Priority', range: (first: number, last: number, total: number) => `${first}-${last} / ${total} stores`, reason: 'Result', resultApproved: 'Approved', resultPending: 'Awaiting approval', refreshFailed: 'Could not refresh plan · retry', refreshing: 'Refreshing plan…', replan: 'Replan', replanVisit: 'Replan visit', result: 'View result', results: 'View results', retry: 'Try again', scopeCount: (count: number) => `${count} stores in scope`, search: 'Search store or plan', sort: 'Sort', status: 'Status', store: 'Store', visitCalendarAllMonths: 'All months', visitCalendarCompleted: 'Completed', visitCalendarCurrentMonth: 'This month', visitCalendarEmpty: 'No visit activity in this view.', visitCalendarFilters: 'Calendar filters', visitCalendarLegend: 'Calendar legend', visitCalendarListTitle: 'Visit activity', visitCalendarLoadError: 'Annual visits could not be loaded.', visitCalendarLoading: 'Loading annual visits…', visitCalendarMissed: 'Not completed', visitCalendarMonth: 'Month', visitCalendarPlanned: 'Planned', visitCalendarYear: 'Year', visitCount: 'Visit count', visitCountLabel: (count: number) => `${count} visits`, visitDates: 'Visit dates', visitDatesDescription: 'Annual visit activity map for the selected store.', visitPlan: 'VISIT PLAN',
  }
}

function riskLabel(value: ChecklistVisitPlanRisk | Exclude<ChecklistVisitPlanRisk, 'all'>, copy: Copy) {
  return value === 'high' ? copy.high : value === 'medium' ? copy.medium : value === 'low' ? copy.low : (copy.visitPlan === 'ZİYARET PLANI' ? 'Tümü' : 'All')
}
function statusLabel(value: ChecklistVisitPlanStatus | 'planned' | 'waiting' | 'missed' | 'completed', copy: Copy) {
  const tr = copy.visitPlan === 'ZİYARET PLANI'
  return ({ all: tr ? 'Tümü' : 'All', unplanned: tr ? 'Plan yapılmadı' : 'Not planned', planned: tr ? 'Ziyaret Bekleniyor' : 'Visit Waiting', waiting: tr ? 'Ziyaret Bekleniyor' : 'Visit Waiting', missed: tr ? 'Ziyaret Yapılmadı' : 'Visit Not Completed', completed: tr ? 'Ziyaret Tamamlandı' : 'Visit Completed', mixed: tr ? 'Karma plan' : 'Mixed plan' })[value]
}
function planItemStatusLabel(item: ChecklistVisitPlanPeriodRow['planItems'][number], copy: Copy) {
  const tr = copy.visitPlan === 'ZİYARET PLANI'
  if (item.checklistInstanceId) return tr ? 'Checklist Yapıldı · Ziyaret Tamamlandı' : 'Checklist Done · Visit Completed'
  if (item.visitCompletedAt || item.status === 'completed') return tr ? 'Ziyaret Tamamlandı' : 'Visit Completed'
  return statusLabel(item.status, copy)
}
function periodRowStatusLabel(row: ChecklistVisitPlanPeriodRow, copy: Copy) {
  if (row.planStatus === 'completed' && row.planItems.some((item) => item.checklistInstanceId)) {
    return copy.visitPlan === 'ZİYARET PLANI' ? 'Checklist Yapıldı · Ziyaret Tamamlandı' : 'Checklist Done · Visit Completed'
  }
  return statusLabel(row.planStatus, copy)
}
function statusTone(value: ChecklistVisitPlanPeriodRow['planStatus']) { return value === 'completed' ? 'done' : value === 'missed' ? 'late' : value === 'planned' ? 'planned' : 'review' }
function resultStatus(row: ChecklistVisitPlanPeriodRow) {
  return row.reasonCodes.includes('pending_acknowledgement') || !row.planItems.some((item) => item.checklistInstanceId)
    ? 'pending'
    : 'approved'
}
function resultLabel(row: ChecklistVisitPlanPeriodRow, copy: Copy) {
  return resultStatus(row) === 'pending' ? copy.resultPending : copy.resultApproved
}
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
function formatIsoDate(value: string, locale: 'tr' | 'en') {
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00.000Z`)).replace('.', '')
}
function formatIsoDateLong(value: string, locale: 'tr' | 'en') {
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00.000Z`))
}
