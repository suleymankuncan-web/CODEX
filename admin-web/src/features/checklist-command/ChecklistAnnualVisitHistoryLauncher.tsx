import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Dialog as DialogPrimitive } from 'radix-ui'
import {
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  MapPinCheck,
  Search,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AuthSessionSummary } from '../auth/api'
import { storeChecklistVisitPlanPeriodQueryKey } from '../auth/store-query-scope'
import { transientQueryRetryOptions } from '../../lib/query-retry'
import { getChecklistVisitPlanPeriod, type ChecklistVisitPlanPeriodRow } from './api'

type VisitPlanItem = ChecklistVisitPlanPeriodRow['planItems'][number]

type AnnualVisit = {
  checklistInstanceId: string | null
  planItemId: string
  storeCode: string
  storeId: string
  storeName: string
  visitDate: string
}

type AnnualVisitStore = {
  planItems: VisitPlanItem[]
  storeCode: string
  storeId: string
  storeName: string
}

export function ChecklistAnnualVisitHistoryLauncher(input: {
  authSummary: AuthSessionSummary | null
  locale: 'tr' | 'en'
  period: string
  regionId: string
  regionName: string
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const label = input.locale === 'tr' ? 'Yıllık Ziyaretler' : 'Annual Visits'

  return <>
    <button ref={triggerRef} type="button" className="annual-visit-trigger tw:!border-white/20 tw:!bg-[#20407c] tw:!bg-none tw:!text-white tw:!shadow-none tw:[&_*]:!text-white" aria-label={label} aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <CalendarCheck2 size={15} />
      <span><small>{input.locale === 'tr' ? 'ZİYARET GEÇMİŞİ' : 'VISIT HISTORY'}</small><strong>{label}</strong></span>
    </button>
    {open ? <AnnualVisitHistoryDialog {...input} onClose={() => setOpen(false)} onCloseAutoFocus={(event) => { event.preventDefault(); triggerRef.current?.focus() }} /> : null}
  </>
}

function AnnualVisitHistoryDialog(input: {
  authSummary: AuthSessionSummary | null
  locale: 'tr' | 'en'
  period: string
  regionId: string
  regionName: string
  onClose: () => void
  onCloseAutoFocus: (event: Event) => void
}) {
  const initialYear = Number(input.period.slice(0, 4)) || new Date().getUTCFullYear()
  const [selectedYear, setSelectedYear] = useState(initialYear)
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all')
  const [searchDraft, setSearchDraft] = useState('')
  const copy = historyCopy(input.locale)
  const monthNames = useMemo(() => buildMonthNames(selectedYear, input.locale), [input.locale, selectedYear])
  const yearPeriods = useMemo(() => buildYearPeriods(selectedYear), [selectedYear])
  const annualScopeKey = storeChecklistVisitPlanPeriodQueryKey(input.authSummary, {
    regionId: input.regionId,
    period: yearPeriods[0]!,
    query: '',
    risk: 'all',
    planStatus: 'all',
    sort: 'store_asc',
    limit: 100,
    offset: 0,
  })[1]
  const annualQuery = useQuery({
    queryKey: ['checklist-region-annual-visit-history', annualScopeKey, input.regionId, selectedYear],
    queryFn: () => loadAnnualVisitStores(input.regionId, yearPeriods),
    ...transientQueryRetryOptions,
  })
  const visits = useMemo(() => toCompletedVisits(annualQuery.data ?? []), [annualQuery.data])
  const periodVisits = selectedMonth === 'all'
    ? visits
    : visits.filter((visit) => Number(visit.visitDate.slice(5, 7)) - 1 === selectedMonth)
  const normalizedSearch = searchDraft.trim().toLocaleLowerCase(input.locale === 'tr' ? 'tr-TR' : 'en-US')
  const visibleVisits = periodVisits.filter((visit) => {
    if (!normalizedSearch) return true
    return `${visit.storeName} ${visit.storeCode}`.toLocaleLowerCase(input.locale === 'tr' ? 'tr-TR' : 'en-US').includes(normalizedSearch)
  })
  const monthCounts = monthNames.map((_month, monthIndex) => visits.filter((visit) => Number(visit.visitDate.slice(5, 7)) - 1 === monthIndex).length)
  const checklistCount = periodVisits.filter((visit) => visit.checklistInstanceId).length
  const storeCount = new Set(periodVisits.map((visit) => visit.storeId)).size
  const scopeLabel = selectedMonth === 'all' ? `${selectedYear}` : `${monthNames[selectedMonth]} ${selectedYear}`
  const descriptionId = 'annual-visit-history-description'

  return <DialogPrimitive.Root open onOpenChange={(nextOpen) => { if (!nextOpen) input.onClose() }}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="annual-visit-history-backdrop" />
      <DialogPrimitive.Content className="annual-visit-history-dialog tw:!rounded-[18px] tw:!border-primary/20 tw:!bg-card" aria-describedby={descriptionId} onCloseAutoFocus={input.onCloseAutoFocus}>
        <header className="tw:relative tw:flex tw:min-h-[88px] tw:items-center tw:justify-between tw:gap-4 tw:overflow-hidden tw:bg-primary tw:px-4 tw:py-4 tw:text-primary-foreground tw:sm:px-5">
          <div className="tw:pointer-events-none tw:absolute tw:-right-10 tw:-top-16 tw:size-44 tw:rounded-full tw:border tw:border-primary-foreground/15" />
          <div className="tw:relative tw:flex tw:min-w-0 tw:items-center tw:gap-3">
            <span className="tw:grid tw:size-10 tw:shrink-0 tw:place-items-center tw:rounded-xl tw:border tw:border-primary-foreground/20 tw:bg-primary-foreground/10"><CalendarCheck2 className="tw:size-5" /></span>
            <div className="tw:min-w-0">
              <small className="tw:block tw:text-[9px] tw:font-bold tw:uppercase tw:tracking-[0.16em] tw:text-primary-foreground">{copy.eyebrow}</small>
              <DialogPrimitive.Title className="tw:mt-0.5 tw:text-xl tw:font-semibold tw:tracking-[-0.025em] tw:sm:text-2xl">{selectedYear} {copy.title}</DialogPrimitive.Title>
              <span className="tw:block tw:truncate tw:text-[11px] tw:font-medium tw:text-primary-foreground">{input.regionName}</span>
            </div>
          </div>
          <div className="tw:relative tw:flex tw:shrink-0 tw:items-center tw:gap-1">
            <Button className="tw:border-primary-foreground/20 tw:bg-primary-foreground/10 tw:text-primary-foreground tw:hover:bg-primary-foreground/20 tw:hover:text-primary-foreground" variant="outline" size="icon" aria-label={copy.previousYear} onClick={() => { setSelectedYear((year) => year - 1); setSelectedMonth('all') }}><ChevronLeft /></Button>
            <strong className="tw:min-w-11 tw:text-center tw:text-sm tw:font-semibold tw:tabular-nums">{selectedYear}</strong>
            <Button className="tw:border-primary-foreground/20 tw:bg-primary-foreground/10 tw:text-primary-foreground tw:hover:bg-primary-foreground/20 tw:hover:text-primary-foreground" variant="outline" size="icon" aria-label={copy.nextYear} onClick={() => { setSelectedYear((year) => year + 1); setSelectedMonth('all') }}><ChevronRight /></Button>
            <DialogPrimitive.Close asChild><Button className="tw:ml-0.5 tw:text-primary-foreground tw:hover:bg-primary-foreground/15 tw:hover:text-primary-foreground" variant="ghost" size="icon" aria-label={copy.close}><X /></Button></DialogPrimitive.Close>
          </div>
        </header>
        <DialogPrimitive.Description id={descriptionId} className="annual-visit-history-description">{copy.description}</DialogPrimitive.Description>

        {annualQuery.isLoading ? <HistoryState icon={<Clock3 />} label={copy.loading} /> : null}
        {annualQuery.isError ? <HistoryState error icon={<CircleAlert />} label={copy.error} action={<Button variant="outline" onClick={() => void annualQuery.refetch()}>{copy.retry}</Button>} /> : null}
        {annualQuery.data ? <div className="tw:min-h-0 tw:overflow-y-auto tw:bg-muted/25 tw:p-3 tw:sm:p-4">
          <section className="tw:mb-3 tw:flex tw:flex-col tw:gap-3 tw:rounded-2xl tw:border tw:border-border tw:bg-card tw:p-3 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between" aria-label={copy.summaryLabel}>
            <dl className="tw:grid tw:grid-cols-3 tw:divide-x tw:divide-border">
              <SummaryValue label={copy.totalVisits} value={periodVisits.length} first />
              <SummaryValue label={copy.visitedStores} value={storeCount} />
              <SummaryValue label={copy.withChecklist} value={checklistCount} />
            </dl>
            <Button className="tw:self-start tw:sm:self-center" size="sm" variant={selectedMonth === 'all' ? 'secondary' : 'outline'} onClick={() => setSelectedMonth('all')}>{copy.allYear}</Button>
          </section>

          <div className="tw:grid tw:min-h-0 tw:gap-3 tw:lg:grid-cols-[minmax(0,1fr)_300px]">
            <section className="tw:rounded-2xl tw:border tw:border-border tw:bg-card tw:p-3 tw:sm:p-4" aria-label={copy.monthDistribution}>
              <header className="tw:mb-3 tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-end tw:sm:justify-between">
                <div><h3 className="tw:text-base tw:font-semibold tw:tracking-[-0.02em]">{copy.yearRhythm}</h3><p className="tw:mt-0.5 tw:text-[11px] tw:text-muted-foreground">{copy.yearRhythmCopy}</p></div>
                <div className="tw:flex tw:items-center tw:gap-3 tw:text-[9px] tw:font-semibold tw:text-muted-foreground"><span className="tw:flex tw:items-center tw:gap-1"><i className="tw:size-2 tw:rounded-full tw:bg-primary" />{copy.checklistVisit}</span><span className="tw:flex tw:items-center tw:gap-1"><i className="tw:size-2 tw:rounded-full tw:bg-sky-200" />{copy.completedVisit}</span></div>
              </header>
              <div className="tw:grid tw:grid-cols-2 tw:gap-2 tw:md:grid-cols-3 tw:xl:grid-cols-4" role="group" aria-label={copy.monthDistribution}>
                {monthNames.map((month, monthIndex) => <MonthCalendar
                  count={monthCounts[monthIndex] ?? 0}
                  key={month}
                  label={month}
                  locale={input.locale}
                  monthIndex={monthIndex}
                  selected={selectedMonth === monthIndex}
                  visits={visits}
                  weekdays={copy.weekdays}
                  year={selectedYear}
                  onSelect={() => setSelectedMonth((current) => current === monthIndex ? 'all' : monthIndex)}
                />)}
              </div>
            </section>

            <aside className="tw:flex tw:min-h-[360px] tw:flex-col tw:overflow-hidden tw:rounded-2xl tw:border tw:border-border tw:bg-card" aria-label={copy.visitLog}>
              <header className="tw:border-b tw:border-border tw:p-3">
                <div className="tw:mb-2 tw:flex tw:items-end tw:justify-between tw:gap-2"><div><h3 className="tw:text-sm tw:font-semibold">{copy.visitLog}</h3><p className="tw:text-[10px] tw:text-muted-foreground">{scopeLabel}</p></div><span className="tw:text-xs tw:font-semibold tw:text-primary tw:tabular-nums">{visibleVisits.length}</span></div>
                <label className="tw:relative tw:block"><Search className="tw:absolute tw:left-2.5 tw:top-1/2 tw:size-3.5 tw:-translate-y-1/2 tw:text-muted-foreground" /><Input className="tw:h-8 tw:rounded-lg tw:pl-8 tw:text-xs" aria-label={copy.searchLabel} placeholder={copy.searchPlaceholder} value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} /></label>
              </header>
              {visibleVisits.length === 0 ? <div className="tw:grid tw:flex-1 tw:place-items-center tw:p-6 tw:text-center"><span><CalendarCheck2 className="tw:mx-auto tw:mb-2 tw:size-5 tw:text-muted-foreground" /><strong className="tw:block tw:text-xs">{normalizedSearch ? copy.searchEmpty : copy.empty}</strong></span></div> : <ol className="tw:min-h-0 tw:flex-1 tw:divide-y tw:divide-border tw:overflow-y-auto">
                {visibleVisits.map((visit) => <li className="tw:grid tw:grid-cols-[36px_minmax(0,1fr)] tw:gap-2 tw:p-3" key={`${visit.storeId}:${visit.planItemId}:${visit.visitDate}`}>
                  <time className="tw:grid tw:size-9 tw:place-items-center tw:rounded-lg tw:bg-muted tw:text-center" dateTime={visit.visitDate}><span><strong className="tw:block tw:text-xs tw:leading-none tw:tabular-nums">{Number(visit.visitDate.slice(8, 10))}</strong><small className="tw:text-[7px] tw:font-bold tw:uppercase tw:text-muted-foreground">{shortMonth(monthNames[Number(visit.visitDate.slice(5, 7)) - 1]!)}</small></span></time>
                  <span className="tw:min-w-0"><strong className="tw:block tw:truncate tw:text-[11px] tw:font-semibold">{visit.storeName}</strong><small className="tw:block tw:truncate tw:text-[9px] tw:text-muted-foreground">{formatLongDate(visit.visitDate, input.locale)}</small><span className={`tw:mt-1 tw:inline-flex tw:items-center tw:gap-1 tw:text-[8px] tw:font-semibold ${visit.checklistInstanceId ? 'tw:text-primary' : 'tw:text-sky-700'}`}>{visit.checklistInstanceId ? <ClipboardCheck className="tw:size-3" /> : <MapPinCheck className="tw:size-3" />}{visit.checklistInstanceId ? copy.checklistVisit : copy.completedVisit}</span></span>
                </li>)}
              </ol>}
            </aside>
          </div>
        </div> : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
}

function SummaryValue(input: { first?: boolean; label: string; value: number }) {
  return <div className={`tw:px-3 ${input.first ? 'tw:pl-0' : ''}`}><dt className="tw:text-[9px] tw:font-bold tw:uppercase tw:tracking-[0.1em] tw:text-muted-foreground">{input.label}</dt><dd className="tw:mt-1 tw:text-xl tw:font-semibold tw:tracking-tight tw:text-foreground tw:tabular-nums">{input.value}</dd></div>
}

function MonthCalendar(input: {
  count: number
  label: string
  locale: 'tr' | 'en'
  monthIndex: number
  selected: boolean
  visits: AnnualVisit[]
  weekdays: string[]
  year: number
  onSelect: () => void
}) {
  const monthVisits = input.visits.filter((visit) => Number(visit.visitDate.slice(5, 7)) - 1 === input.monthIndex)
  const visitsByDay = new Map<number, AnnualVisit[]>()
  for (const visit of monthVisits) {
    const day = Number(visit.visitDate.slice(8, 10))
    visitsByDay.set(day, [...(visitsByDay.get(day) ?? []), visit])
  }
  const ariaLabel = input.locale === 'tr' ? `${input.label}, ${input.count} ziyaret` : `${input.label}, ${input.count} visits`
  return <button
    type="button"
    aria-label={ariaLabel}
    aria-pressed={input.selected}
    className={`tw:rounded-xl tw:border tw:p-2.5 tw:text-left tw:transition-colors tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring ${input.selected ? 'tw:border-primary tw:bg-primary/[0.045]' : 'tw:border-border tw:bg-background tw:hover:border-primary/35 tw:hover:bg-muted/20'}`}
    onClick={input.onSelect}
  >
    <span className="tw:mb-2 tw:flex tw:items-center tw:justify-between"><strong className="tw:text-[12px] tw:font-semibold tw:text-foreground">{input.label}</strong><small className="tw:rounded-full tw:bg-muted tw:px-1.5 tw:py-0.5 tw:text-[9px] tw:font-bold tw:text-muted-foreground tw:tabular-nums">{input.count}</small></span>
    <span className="tw:grid tw:grid-cols-7 tw:gap-0.5" aria-hidden="true">
      {input.weekdays.map((day) => <small className="tw:text-center tw:text-[7px] tw:font-bold tw:text-muted-foreground" key={day}>{day}</small>)}
      {buildMonthCalendarDays(input.year, input.monthIndex).map((day, index) => {
        if (day === null) return <i className="tw:aspect-square" key={`blank-${index}`} />
        const dayVisits = visitsByDay.get(day) ?? []
        const hasChecklist = dayVisits.some((visit) => visit.checklistInstanceId)
        return <i className={`tw:grid tw:aspect-square tw:place-items-center tw:rounded-[5px] tw:text-[8px] tw:font-semibold tw:not-italic tw:tabular-nums ${dayVisits.length === 0 ? 'tw:text-muted-foreground' : hasChecklist ? 'tw:bg-primary tw:text-primary-foreground' : 'tw:bg-sky-200 tw:text-sky-950'}`} key={day}>{day}</i>
      })}
    </span>
  </button>
}

function HistoryState(input: { action?: ReactNode; error?: boolean; icon: ReactNode; label: string }) {
  return <div className={`annual-visit-history-state${input.error ? ' is-error' : ''}`} role={input.error ? 'alert' : 'status'}>{input.icon}<strong>{input.label}</strong>{input.action}</div>
}

async function loadAnnualVisitStores(regionId: string, periods: string[]): Promise<AnnualVisitStore[]> {
  const periodRows = await Promise.all(periods.map(async (period) => {
    const rows: ChecklistVisitPlanPeriodRow[] = []
    let offset = 0
    while (true) {
      const response = await getChecklistVisitPlanPeriod({ regionId, period, query: '', risk: 'all', planStatus: 'all', sort: 'store_asc', limit: 100, offset })
      rows.push(...response.data.items)
      if (!response.data.page.hasMore) break
      offset += Math.max(1, response.data.page.limit)
    }
    return rows
  }))
  const stores = new Map<string, { storeCode: string; storeId: string; storeName: string; planItems: Map<string, VisitPlanItem> }>()
  for (const rows of periodRows) {
    for (const row of rows) {
      const store = stores.get(row.storeId) ?? { storeCode: row.storeCode, storeId: row.storeId, storeName: row.storeName, planItems: new Map() }
      for (const item of row.planItems) store.planItems.set(`${item.planItemId}:${item.plannedDate}`, item)
      stores.set(row.storeId, store)
    }
  }
  return [...stores.values()].map((store) => ({ ...store, planItems: [...store.planItems.values()] }))
}

function toCompletedVisits(stores: AnnualVisitStore[]): AnnualVisit[] {
  return stores.flatMap((store) => store.planItems.filter(isCompletedVisit).map((item) => ({
    checklistInstanceId: item.checklistInstanceId,
    planItemId: item.planItemId,
    storeCode: store.storeCode,
    storeId: store.storeId,
    storeName: store.storeName,
    visitDate: (item.visitCompletedAt ?? item.completedAt)?.slice(0, 10) ?? item.plannedDate,
  }))).sort((left, right) => right.visitDate.localeCompare(left.visitDate) || right.storeName.localeCompare(left.storeName, 'tr-TR'))
}

function isCompletedVisit(item: VisitPlanItem) {
  return Boolean(item.checklistInstanceId || item.visitCompletedAt || item.completedAt || item.status === 'completed')
}

function buildYearPeriods(year: number) {
  return Array.from({ length: 12 }, (_value, monthIndex) => `${year}-${String(monthIndex + 1).padStart(2, '0')}`)
}

function buildMonthNames(year: number, locale: 'tr' | 'en') {
  const formatter = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', timeZone: 'UTC' })
  return Array.from({ length: 12 }, (_value, monthIndex) => formatter.format(new Date(Date.UTC(year, monthIndex, 1))))
}

function buildMonthCalendarDays(year: number, monthIndex: number) {
  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay()
  const mondayOffset = (firstWeekday + 6) % 7
  const dayCount = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  return [
    ...Array.from({ length: mondayOffset }, () => null),
    ...Array.from({ length: dayCount }, (_value, dayIndex) => dayIndex + 1),
  ]
}

function shortMonth(month: string) {
  return month.slice(0, 3)
}

function formatLongDate(isoDate: string, locale: 'tr' | 'en') {
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00.000Z`))
}

function historyCopy(locale: 'tr' | 'en') {
  return locale === 'tr' ? {
    allYear: 'Tüm yıl', checklistVisit: 'Checklist yapıldı', close: 'Kapat', completedVisit: 'Ziyaret yapıldı', description: 'Sorumlu mağazalarda yıl içinde tamamlanan ziyaretler.', empty: 'Bu dönemde tamamlanmış ziyaret bulunmuyor.', error: 'Yıllık ziyaret geçmişi yüklenemedi.', eyebrow: 'YILLIK ZİYARET TAKVİMİ', loading: 'Ziyaret geçmişi yükleniyor…', monthDistribution: '12 aylık ziyaret takvimi', nextYear: 'Sonraki yıl', previousYear: 'Önceki yıl', retry: 'Tekrar dene', searchEmpty: 'Aramanızla eşleşen ziyaret bulunamadı.', searchLabel: 'Ziyaretlerde mağaza ara', searchPlaceholder: 'Mağaza ara', summaryLabel: 'Yıllık ziyaret özeti', title: 'Ziyaret Takvimi', totalVisits: 'Toplam ziyaret', visitLog: 'Ziyaret akışı', visitedStores: 'Ziyaret edilen mağaza', weekdays: ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'], withChecklist: 'Checklist ile', yearRhythm: 'Yıllık görünüm', yearRhythmCopy: 'Bir ayı seçerek sağdaki ziyaret akışını daraltın.',
  } : {
    allYear: 'Full year', checklistVisit: 'Checklist completed', close: 'Close', completedVisit: 'Visit completed', description: 'Completed store visits during the year.', empty: 'No completed visits in this period.', error: 'Annual visit history could not be loaded.', eyebrow: 'ANNUAL VISIT CALENDAR', loading: 'Loading visit history…', monthDistribution: '12-month visit calendar', nextYear: 'Next year', previousYear: 'Previous year', retry: 'Try again', searchEmpty: 'No visits match your search.', searchLabel: 'Search stores in visits', searchPlaceholder: 'Search stores', summaryLabel: 'Annual visit summary', title: 'Visit Calendar', totalVisits: 'Total visits', visitLog: 'Visit activity', visitedStores: 'Visited stores', weekdays: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'], withChecklist: 'With checklist', yearRhythm: 'Year overview', yearRhythmCopy: 'Select a month to filter the activity on the right.',
  }
}
