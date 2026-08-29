import { ChevronLeft, ChevronRight, CircleAlert, Clock3, History, Search, Store } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { cn } from '../../lib/utils'
import type { ChecklistCommandData, ChecklistCommandRow } from './api'
import {
  getChecklistCommandSortLabel,
  type ChecklistCommandSort,
  type ChecklistCommandSortKey,
  type ChecklistCommandStatus,
} from './model'

const PAGE_SIZE = 30

export function RegionManagerRecordsSurface(input: {
  data: ChecklistCommandData
  isError: boolean
  isFetching: boolean
  locale: 'tr' | 'en'
  offset: number
  query: string
  sort: ChecklistCommandSort
  status: ChecklistCommandStatus
  onOpenHistory: (store: ChecklistCommandRow, trigger: HTMLElement) => void
  onOffset: (offset: number) => void
  onQuery: (query: string) => void
  onRetry: () => void
  onSort: (key: ChecklistCommandSortKey) => void
  onStatus: (status: ChecklistCommandStatus) => void
}) {
  const copy = input.locale === 'tr' ? recordsTr : recordsEn
  const metrics = [
    { key: 'all' as const, label: copy.total, note: copy.totalNote, value: input.data.metrics.totalStores, icon: Store, tone: 'plum' as const },
    { key: 'needs_visit' as const, label: copy.missing, note: copy.missingNote, value: input.data.metrics.needsVisit, icon: CircleAlert, tone: 'danger' as const },
    { key: 'active' as const, label: copy.active, note: copy.activeNote, value: input.data.metrics.active, icon: Clock3, tone: 'active' as const },
    { key: 'completed' as const, label: copy.current, note: copy.currentNote, value: input.data.metrics.completed, icon: History, tone: 'done' as const },
  ]
  const firstItem = input.data.page.total === 0 ? 0 : input.data.page.offset + 1
  const lastItem = Math.min(input.data.page.total, input.data.page.offset + input.data.items.length)
  const pageNumber = Math.floor(input.offset / PAGE_SIZE) + 1
  const pageCount = Math.max(1, Math.ceil(input.data.page.total / PAGE_SIZE))

  return <div className="tw:grid tw:min-w-0 tw:gap-3">
    <section aria-label={copy.metrics} className="checklist-command-metrics checklist-records-metrics tw:relative tw:grid tw:grid-cols-2 tw:overflow-hidden tw:lg:grid-cols-4">
      <span aria-hidden className="tw:absolute tw:inset-x-0 tw:top-0 tw:h-[3px] tw:bg-gradient-to-r tw:from-primary tw:via-blue-500 tw:to-cyan-500" />
      {metrics.map((metric) => {
        const Icon = metric.icon
        return <button key={metric.key} type="button" aria-pressed={input.status === metric.key} className={cn('checklist-command-metric tw:grid tw:min-h-24 tw:grid-cols-[30px_minmax(0,1fr)_auto] tw:items-center tw:gap-2 tw:border-b tw:border-border tw:p-3 tw:text-left tw:hover:bg-muted/30 tw:lg:min-h-[106px] tw:lg:border-b-0 tw:lg:border-l tw:lg:first-of-type:border-l-0', input.status === metric.key && 'tw:bg-primary/[0.045]')} onClick={() => input.onStatus(metric.key)}>
          <span className={cn('tw:grid tw:size-8 tw:place-items-center tw:rounded-lg', metricToneClasses[metric.tone])}><Icon className="tw:size-4" /></span>
          <span className="checklist-command-metric-copy tw:min-w-0"><b>{metric.label}</b><small>{metric.note}</small></span>
          <strong className="tw:text-xl tw:font-semibold tw:tabular-nums">{metric.value}</strong>
        </button>
      })}
    </section>

    <section className="checklist-command-surface checklist-records-surface tw:overflow-hidden">
      <div className="checklist-records-toolbar">
        <label className="checklist-records-search">
          <Search className="tw:size-4 tw:shrink-0" />
          <Input aria-label={copy.search} className="tw:h-auto tw:border-0 tw:bg-transparent tw:p-0 tw:text-center tw:text-xs tw:leading-5 tw:shadow-none tw:focus-visible:ring-0" placeholder={copy.search} value={input.query} onChange={(event) => input.onQuery(event.target.value)} />
        </label>
        {input.isFetching ? <small className="checklist-command-inline-refresh" aria-live="polite">{copy.refreshing}</small> : null}
        {input.isError ? <button type="button" className="checklist-command-inline-error" onClick={input.onRetry}>{copy.retry}</button> : null}
        <div className="checklist-records-sort" aria-label={copy.sort}>
          {([['store', copy.store], ['last_visit', copy.lastVisit], ['status', copy.status]] as const).map(([key, label]) => <Button key={key} size="sm" type="button" variant="ghost" onClick={() => input.onSort(key)}>{getChecklistCommandSortLabel(label, key, input.sort)}</Button>)}
        </div>
      </div>

      {input.data.items.length === 0 ? <div className="tw:grid tw:min-h-52 tw:place-items-center tw:p-8 tw:text-center"><div><strong className="tw:text-sm">{copy.empty}</strong><p className="tw:mt-1 tw:text-xs tw:text-muted-foreground">{copy.emptyCopy}</p></div></div> : (
        <div className="checklist-records-list">
          {input.data.items.map((row) => <article key={row.storeId} className="checklist-records-row" data-action-state={row.openActionCount > 0 ? 'pending' : 'clear'}>
            <span className="checklist-records-store">
              <span className="checklist-records-store-mark" aria-hidden>{getStoreMark(row.storeName)}</span>
              <span className="tw:grid tw:min-w-0"><strong className="tw:truncate tw:text-sm tw:text-foreground">{row.storeName}</strong><small className="tw:truncate">{row.storeCode}</small></span>
            </span>
            <span className="checklist-records-data"><small>{copy.lastRecord}</small><strong>{formatRecordDate(row.lastOperationalAt, input.locale, copy.noRecord)}</strong></span>
            <span className="checklist-records-data"><small>{copy.taskState}</small><strong className={row.openActionCount > 0 ? 'is-pending' : 'is-clear'}>{row.openActionCount > 0 ? copy.taskPending : copy.noAction}</strong></span>
            <Button className="checklist-records-open" size="sm" type="button" variant="outline" onClick={(event) => input.onOpenHistory(row, event.currentTarget)}>{copy.open}<ChevronRight /></Button>
          </article>)}
        </div>
      )}

      <footer className="checklist-command-pagination"><span>{firstItem}-{lastItem} / {input.data.page.total}</span><div><button type="button" aria-label={copy.previous} disabled={input.offset === 0 || input.isFetching} onClick={() => input.onOffset(Math.max(0, input.offset - PAGE_SIZE))}><ChevronLeft size={14} /></button><small>{pageNumber} / {pageCount}</small><button type="button" aria-label={copy.next} disabled={!input.data.page.hasMore || input.isFetching} onClick={() => input.onOffset(input.offset + PAGE_SIZE)}><ChevronRight size={14} /></button></div></footer>
    </section>
  </div>
}

function formatRecordDate(value: string | null, locale: 'tr' | 'en', fallback: string) {
  if (!value) return fallback
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function getStoreMark(storeName: string) {
  const words = storeName.trim().split(/\s+/).filter(Boolean)
  return words.slice(0, 2).map((word) => word[0]).join('').toLocaleUpperCase('tr-TR') || 'M'
}

const metricToneClasses = { active: 'tw:bg-blue-500/10 tw:text-blue-600', danger: 'tw:bg-destructive/10 tw:text-destructive', done: 'tw:bg-emerald-500/10 tw:text-emerald-600', plum: 'tw:bg-primary/10 tw:text-primary' }
const recordsTr = { metrics: 'Mağaza kayıt özeti', total: 'Toplam mağaza kaydı', totalNote: 'Yetkili mağazalar', missing: 'Ziyaret kaydı eksik', missingNote: 'Ziyaret hareketi bulunmayan', active: 'Aktif checklist', activeNote: 'Devam eden checklist', current: 'Güncel kayıt', currentNote: 'Kaydı güncel mağazalar', search: 'Mağaza veya kayıt ara', refreshing: 'Güncelleniyor…', retry: 'Veriler yenilenemedi · Tekrar dene', sort: 'Mağaza kayıtlarını sırala', store: 'Mağaza', lastVisit: 'Son ziyaret', status: 'Durum', empty: 'Bu filtrede mağaza kaydı yok', emptyCopy: 'Seçili dönem ve filtreler kayıt üretmedi.', lastRecord: 'Son kayıt hareketi', noRecord: 'Henüz kayıt yok', taskState: 'Görev durumu', taskPending: 'Görev atandı, çözülmesi bekleniyor', noAction: 'Aksiyon Yok', open: 'Kaydı görüntüle', previous: 'Önceki sayfa', next: 'Sonraki sayfa' } as const
const recordsEn = { metrics: 'Store record summary', total: 'Total store records', totalNote: 'Stores in the region', missing: 'Missing visit record', missingNote: 'No recorded visit activity', active: 'Active checklist', activeNote: 'Checklist in progress', current: 'Current record', currentNote: 'Stores with a current record', search: 'Search store or record', refreshing: 'Refreshing…', retry: 'Refresh failed · Retry', sort: 'Sort store records', store: 'Store', lastVisit: 'Last visit', status: 'Status', empty: 'No store records for this filter', emptyCopy: 'The selected period and filters returned no records.', lastRecord: 'Last record activity', noRecord: 'No record yet', taskState: 'Task state', taskPending: 'Task assigned, awaiting resolution', noAction: 'No action', open: 'View record', previous: 'Previous page', next: 'Next page' } as const
