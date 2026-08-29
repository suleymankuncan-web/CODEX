import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
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
  Store,
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
  const label = input.locale === 'tr' ? 'Yıllık Ziyaretler' : 'Annual Visits'

  return <>
    <button type="button" className="annual-visit-trigger" aria-label={label} aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <CalendarCheck2 size={15} />
      <span><small>{input.locale === 'tr' ? 'ZİYARET GEÇMİŞİ' : 'VISIT HISTORY'}</small><strong>{label}</strong></span>
    </button>
    {open ? <AnnualVisitHistoryDialog {...input} onClose={() => setOpen(false)} /> : null}
  </>
}

function AnnualVisitHistoryDialog(input: {
  authSummary: AuthSessionSummary | null
  locale: 'tr' | 'en'
  period: string
  regionId: string
  regionName: string
  onClose: () => void
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
  const groupedVisits = groupVisitsByMonth(visibleVisits, monthNames)
  const monthCounts = monthNames.map((_month, monthIndex) => visits.filter((visit) => Number(visit.visitDate.slice(5, 7)) - 1 === monthIndex).length)
  const maxMonthCount = Math.max(1, ...monthCounts)
  const checklistCount = periodVisits.filter((visit) => visit.checklistInstanceId).length
  const storeCounts = countStores(periodVisits, input.locale)
  const scopeLabel = selectedMonth === 'all' ? `${selectedYear}` : `${monthNames[selectedMonth]} ${selectedYear}`
  const descriptionId = 'annual-visit-history-description'

  return <DialogPrimitive.Root open onOpenChange={(nextOpen) => { if (!nextOpen) input.onClose() }}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="annual-visit-history-backdrop" />
      <DialogPrimitive.Content className="annual-visit-history-dialog" aria-describedby={descriptionId}>
        <header className="annual-visit-history-header">
          <div>
            <small>{copy.eyebrow}</small>
            <DialogPrimitive.Title>{selectedYear} {copy.title}</DialogPrimitive.Title>
            <span>{input.regionName}</span>
          </div>
          <div className="annual-visit-history-header-actions">
            <Button variant="outline" size="icon" aria-label={copy.previousYear} onClick={() => { setSelectedYear((year) => year - 1); setSelectedMonth('all') }}><ChevronLeft /></Button>
            <strong>{selectedYear}</strong>
            <Button variant="outline" size="icon" aria-label={copy.nextYear} onClick={() => { setSelectedYear((year) => year + 1); setSelectedMonth('all') }}><ChevronRight /></Button>
            <DialogPrimitive.Close asChild><Button variant="ghost" size="icon" aria-label={copy.close}><X /></Button></DialogPrimitive.Close>
          </div>
        </header>
        <DialogPrimitive.Description id={descriptionId} className="annual-visit-history-description">{copy.description}</DialogPrimitive.Description>

        {annualQuery.isLoading ? <HistoryState icon={<Clock3 />} label={copy.loading} /> : null}
        {annualQuery.isError ? <HistoryState error icon={<CircleAlert />} label={copy.error} action={<Button variant="outline" onClick={() => void annualQuery.refetch()}>{copy.retry}</Button>} /> : null}
        {annualQuery.data ? <div className="annual-visit-history-content">
          <section className="annual-visit-history-summary" aria-label={copy.summaryLabel}>
            <div className="annual-visit-history-total">
              <span><CalendarCheck2 /></span>
              <div><strong>{periodVisits.length}</strong><small>{copy.totalVisits}</small></div>
            </div>
            <dl>
              <div><dt><Store />{copy.visitedStores}</dt><dd>{storeCounts.length}</dd></div>
              <div><dt><ClipboardCheck />{copy.withChecklist}</dt><dd>{checklistCount}</dd></div>
              <div><dt><MapPinCheck />{copy.visitOnly}</dt><dd>{periodVisits.length - checklistCount}</dd></div>
            </dl>
          </section>

          <section className="annual-visit-history-months" aria-label={copy.monthDistribution}>
            <header><div><h3>{copy.yearRhythm}</h3><p>{copy.yearRhythmCopy}</p></div><Button size="sm" variant={selectedMonth === 'all' ? 'secondary' : 'ghost'} onClick={() => setSelectedMonth('all')}>{copy.allYear}</Button></header>
            <div role="group" aria-label={copy.monthDistribution}>
              {monthNames.map((month, monthIndex) => {
                const count = monthCounts[monthIndex] ?? 0
                const level = count === 0 ? 0 : Math.max(18, Math.round((count / maxMonthCount) * 100))
                return <button
                  type="button"
                  aria-label={copy.monthLabel(month, count)}
                  aria-pressed={selectedMonth === monthIndex}
                  className={selectedMonth === monthIndex ? 'is-active' : ''}
                  key={month}
                  onClick={() => setSelectedMonth((current) => current === monthIndex ? 'all' : monthIndex)}
                >
                  <span className="annual-visit-history-month-bar" style={{ '--visit-month-level': `${level}%` } as CSSProperties}><i /></span>
                  <strong>{shortMonth(month, input.locale)}</strong>
                  <small>{count}</small>
                </button>
              })}
            </div>
          </section>

          <div className="annual-visit-history-workspace">
            <section className="annual-visit-history-log" aria-label={copy.visitLog}>
              <header>
                <div><h3>{copy.visitLog}</h3><p>{scopeLabel} · {periodVisits.length} {copy.visitSuffix}</p></div>
                <label><Search /><Input aria-label={copy.searchLabel} placeholder={copy.searchPlaceholder} value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} /></label>
              </header>
              {groupedVisits.length === 0 ? <div className="annual-visit-history-empty"><CalendarCheck2 /><strong>{normalizedSearch ? copy.searchEmpty : copy.empty}</strong></div> : <div className="annual-visit-history-groups">
                {groupedVisits.map((group) => <section key={group.monthIndex}>
                  <header><h4>{group.label}</h4><span>{group.visits.length} {copy.visitSuffix}</span></header>
                  <ol>{group.visits.map((visit) => <li key={`${visit.storeId}:${visit.planItemId}:${visit.visitDate}`}>
                    <time dateTime={visit.visitDate}><strong>{Number(visit.visitDate.slice(8, 10))}</strong><span>{shortMonth(monthNames[Number(visit.visitDate.slice(5, 7)) - 1]!, input.locale)}</span></time>
                    <span className="annual-visit-history-row-store"><strong>{visit.storeName}</strong><small>{visit.storeCode} · {formatLongDate(visit.visitDate, input.locale)}</small></span>
                    <span className={`annual-visit-history-kind${visit.checklistInstanceId ? ' is-checklist' : ''}`}>{visit.checklistInstanceId ? <ClipboardCheck /> : <MapPinCheck />}<span>{visit.checklistInstanceId ? copy.checklistVisit : copy.completedVisit}</span></span>
                  </li>)}</ol>
                </section>)}
              </div>}
            </section>

            <aside className="annual-visit-history-stores" aria-label={copy.storeDistribution}>
              <header><h3>{copy.storeDistribution}</h3><span>{scopeLabel}</span></header>
              {storeCounts.length === 0 ? <p>{copy.empty}</p> : <ol>{storeCounts.map((store, index) => <li key={store.storeId}>
                <span className="annual-visit-history-store-rank">{String(index + 1).padStart(2, '0')}</span>
                <span><strong>{store.storeName}</strong><small>{store.storeCode}</small></span>
                <b>{store.count}<small>{copy.visitSuffix}</small></b>
              </li>)}</ol>}
            </aside>
          </div>
        </div> : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
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

function countStores(visits: AnnualVisit[], locale: 'tr' | 'en') {
  const stores = new Map<string, { count: number; storeCode: string; storeId: string; storeName: string }>()
  for (const visit of visits) {
    const current = stores.get(visit.storeId) ?? { count: 0, storeCode: visit.storeCode, storeId: visit.storeId, storeName: visit.storeName }
    current.count += 1
    stores.set(visit.storeId, current)
  }
  return [...stores.values()].sort((left, right) => right.count - left.count || left.storeName.localeCompare(right.storeName, locale === 'tr' ? 'tr-TR' : 'en-US'))
}

function groupVisitsByMonth(visits: AnnualVisit[], monthNames: string[]) {
  const groups = new Map<number, AnnualVisit[]>()
  for (const visit of visits) {
    const monthIndex = Number(visit.visitDate.slice(5, 7)) - 1
    groups.set(monthIndex, [...(groups.get(monthIndex) ?? []), visit])
  }
  return [...groups.entries()].sort(([left], [right]) => right - left).map(([monthIndex, monthVisits]) => ({ label: monthNames[monthIndex]!, monthIndex, visits: monthVisits }))
}

function buildYearPeriods(year: number) {
  return Array.from({ length: 12 }, (_value, monthIndex) => `${year}-${String(monthIndex + 1).padStart(2, '0')}`)
}

function buildMonthNames(year: number, locale: 'tr' | 'en') {
  const formatter = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', timeZone: 'UTC' })
  return Array.from({ length: 12 }, (_value, monthIndex) => formatter.format(new Date(Date.UTC(year, monthIndex, 1))))
}

function shortMonth(month: string, locale: 'tr' | 'en') {
  return locale === 'tr' ? month.slice(0, 3) : month.slice(0, 3)
}

function formatLongDate(isoDate: string, locale: 'tr' | 'en') {
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00.000Z`))
}

function historyCopy(locale: 'tr' | 'en') {
  return locale === 'tr' ? {
    allYear: 'Tüm yıl', checklistVisit: 'Checklist ile tamamlandı', close: 'Kapat', completedVisit: 'Ziyaret tamamlandı', description: 'Sorumlu mağazalarda yıl içinde tamamlanan ziyaretler.', empty: 'Bu dönemde tamamlanmış ziyaret bulunmuyor.', error: 'Yıllık ziyaret geçmişi yüklenemedi.', eyebrow: 'YILLIK ZİYARET GEÇMİŞİ', loading: 'Ziyaret geçmişi yükleniyor…', monthDistribution: 'Aylara göre ziyaret dağılımı', monthLabel: (month: string, count: number) => `${month}, ${count} ziyaret`, nextYear: 'Sonraki yıl', previousYear: 'Önceki yıl', retry: 'Tekrar dene', searchEmpty: 'Aramanızla eşleşen ziyaret bulunamadı.', searchLabel: 'Ziyaretlerde mağaza ara', searchPlaceholder: 'Mağaza adı veya kodu ara', storeDistribution: 'Ziyaret edilen mağazalar', summaryLabel: 'Yıllık ziyaret özeti', title: 'Ziyaret Geçmişi', totalVisits: 'Toplam ziyaret', visitLog: 'Ziyaretler', visitedStores: 'Ziyaret edilen mağaza', visitOnly: 'Sadece ziyaret', visitSuffix: 'ziyaret', withChecklist: 'Checklist ile', yearRhythm: 'Yılın ziyaret ritmi', yearRhythmCopy: 'Bir ayı seçerek ziyaret listesini daraltın.',
  } : {
    allYear: 'Full year', checklistVisit: 'Completed with checklist', close: 'Close', completedVisit: 'Visit completed', description: 'Completed store visits in the selected region during the year.', empty: 'No completed visits in this period.', error: 'Annual visit history could not be loaded.', eyebrow: 'ANNUAL VISIT HISTORY', loading: 'Loading visit history…', monthDistribution: 'Visits by month', monthLabel: (month: string, count: number) => `${month}, ${count} visits`, nextYear: 'Next year', previousYear: 'Previous year', retry: 'Try again', searchEmpty: 'No visits match your search.', searchLabel: 'Search stores in visits', searchPlaceholder: 'Search store name or code', storeDistribution: 'Visited stores', summaryLabel: 'Annual visit summary', title: 'Visit History', totalVisits: 'Total visits', visitLog: 'Visits', visitedStores: 'Visited stores', visitOnly: 'Visit only', visitSuffix: 'visits', withChecklist: 'With checklist', yearRhythm: 'Visit rhythm', yearRhythmCopy: 'Select a month to narrow the visit list.',
  }
}
