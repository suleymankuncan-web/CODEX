import { useMemo, useRef, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { ChevronRight, Clock3, History, RefreshCw, X } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { ApiError } from '../../lib/api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { getUserFacingErrorMessage } from '../../lib/format'
import type { AuthSessionSummary } from '../auth/api'
import { storeChecklistOperationalHistoryQueryKey } from '../auth/store-query-scope'
import { useLocalization } from '../localization/useLocalization'
import {
  getChecklistOperationalHistory,
  type ChecklistOperationalHistoryResponse,
} from './api'
import {
  checklistOperationalHistoryKinds,
  checklistOperationalHistoryRanges,
  type ChecklistOperationalHistoryKind,
  type ChecklistOperationalHistoryRange,
} from './model'

type HistoryEvent = ChecklistOperationalHistoryResponse['data']['items'][number]
export function ChecklistOperationalHistoryDrawer(input: {
  authSummary: AuthSessionSummary | null
  open: boolean
  storeId: string | null
  storeName: string | null
  returnFocusRef: React.RefObject<HTMLElement | null>
  onClose: () => void
}) {
  const { locale } = useLocalization()
  const copy = locale === 'tr' ? trCopy : enCopy
  const [range, setRange] = useState<ChecklistOperationalHistoryRange>('6m')
  const [kinds, setKinds] = useState<ChecklistOperationalHistoryKind[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const detailReturnFocusRef = useRef<HTMLElement | null>(null)
  const effectiveKinds = useMemo(
    () => kinds.length === 0 ? [...checklistOperationalHistoryKinds] : kinds,
    [kinds],
  )
  const baseKey = storeChecklistOperationalHistoryQueryKey(
    input.authSummary,
    input.storeId ?? 'closed',
    range,
    effectiveKinds,
  )
  const historyQuery = useInfiniteQuery({
    queryKey: baseKey,
    queryFn: ({ pageParam }) => getChecklistOperationalHistory({
      storeId: input.storeId!,
      query: { range, kinds: effectiveKinds, ...(pageParam ? { cursor: pageParam } : {}) },
    }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.data.page.hasMore ? lastPage.data.page.nextCursor ?? undefined : undefined,
    enabled: input.open && Boolean(input.storeId),
  })
  const forbidden = historyQuery.error instanceof ApiError && historyQuery.error.status === 403
  const summary = historyQuery.data?.pages[0]?.data.summary ?? null
  const events = useMemo(() => {
    const byId = new Map<string, HistoryEvent>()
    for (const page of historyQuery.data?.pages ?? []) {
      for (const event of page.data.items) byId.set(event.id, event)
    }
    return [...byId.values()]
  }, [historyQuery.data])
  const monthGroups = useMemo(() => {
    const groups = new Map<string, HistoryEvent[]>()
    for (const event of events) {
      const key = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(new Date(event.occurredAt))
      groups.set(key, [...(groups.get(key) ?? []), event])
    }
    return [...groups.entries()]
  }, [events, locale])

  return (
    <Dialog open={input.open} onOpenChange={(open) => { if (!open) input.onClose() }}>
      <DialogContent
        className="tw:h-dvh tw:max-h-dvh tw:max-w-none tw:min-w-0 tw:overflow-y-auto tw:rounded-none tw:p-0 tw:sm:h-auto tw:sm:max-h-[min(820px,calc(100dvh-2rem))] tw:sm:max-w-[min(650px,calc(100vw-2rem))] tw:sm:rounded-xl"
        closeLabel={copy.close}
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          input.returnFocusRef.current?.focus()
        }}
      >
        <DialogHeader className="tw:sticky tw:top-0 tw:z-20 tw:grid tw:min-w-0 tw:grid-cols-[minmax(0,1fr)_auto] tw:gap-3 tw:border-b tw:border-border tw:bg-background/95 tw:px-5 tw:py-4 tw:text-left tw:backdrop-blur">
          <div className="tw:min-w-0">
            <DialogTitle className="tw:truncate tw:text-lg tw:font-semibold tw:tracking-[-0.02em]">
              {input.storeName ?? copy.store} {copy.recordSuffix}
            </DialogTitle>
            <DialogDescription className="tw:mt-1 tw:text-xs">{copy.description}</DialogDescription>
          </div>
          <Button aria-label={copy.close} size="icon-sm" type="button" variant="ghost" onClick={input.onClose}>
            <X />
          </Button>
        </DialogHeader>

        <div className="tw:grid tw:min-w-0 tw:gap-4 tw:p-5">
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            {checklistOperationalHistoryRanges.map((value) => (
              <Button key={value} size="sm" type="button" variant={range === value ? 'secondary' : 'outline'} onClick={() => { setSelectedEventId(null); setRange(value) }}>
                {value === 'all' ? copy.all : value}
              </Button>
            ))}
          </div>

          <div className="tw:flex tw:flex-wrap tw:gap-1.5" aria-label={copy.eventFilters}>
            {checklistOperationalHistoryKinds.map((kind) => {
              const selected = kinds.includes(kind)
              return (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={selected}
                  className="tw:rounded-full tw:border tw:border-border tw:bg-background tw:px-2.5 tw:py-1.5 tw:text-[10px] tw:font-semibold tw:text-muted-foreground tw:aria-pressed:bg-primary/10 tw:aria-pressed:text-primary"
                  onClick={() => { setSelectedEventId(null); setKinds((current) => selected ? current.filter((value) => value !== kind) : [...current, kind]) }}
                >
                  {copy.kindLabels[kind]}
                </button>
              )
            })}
          </div>

          {summary ? (
            <section className="tw:grid tw:grid-cols-2 tw:overflow-hidden tw:rounded-xl tw:border tw:border-border tw:bg-card tw:sm:grid-cols-4" aria-label={copy.summary}>
              <SummaryMetric label={copy.events} value={summary.eventCount} />
              <SummaryMetric label={copy.visits} value={summary.completedVisitCount} />
              <SummaryMetric label={copy.assignedTasks} value={summary.assignedTaskCount} />
              <SummaryMetric label={copy.openTasks} value={summary.openTaskCount} />
            </section>
          ) : null}

          {historyQuery.isLoading && events.length === 0 ? <HistoryState title={copy.loading} /> : null}
          {historyQuery.isError && events.length === 0 ? (
            <HistoryState
              title={forbidden ? copy.forbidden : copy.error}
              copy={forbidden ? copy.forbiddenCopy : getUserFacingErrorMessage(historyQuery.error, copy.errorCopy)}
              {...(forbidden ? {} : { action: <Button size="sm" variant="outline" onClick={() => void historyQuery.refetch()}><RefreshCw />{copy.retry}</Button> })}
            />
          ) : null}
          {!historyQuery.isLoading && !historyQuery.isError && events.length === 0 ? <HistoryState title={copy.empty} copy={copy.emptyCopy} /> : null}

          {events.length > 0 ? (
            <section className="tw:grid tw:gap-2" aria-label={copy.timeline}>
              {monthGroups.map(([month, monthEvents]) => <div key={month} className="tw:grid tw:gap-2">
                <h3 className="tw:sticky tw:top-[73px] tw:z-10 tw:bg-background/95 tw:py-1 tw:text-[10px] tw:font-bold tw:capitalize tw:tracking-[.08em] tw:text-muted-foreground tw:backdrop-blur">{month}</h3>
                {monthEvents.map((event) => <div key={event.id} className="tw:grid tw:gap-2">
                  <button type="button" aria-expanded={selectedEventId === event.id} className="tw:grid tw:min-w-0 tw:grid-cols-[auto_minmax(0,1fr)_auto] tw:items-center tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-card tw:p-3 tw:text-left tw:hover:bg-muted/25" onClick={(clickEvent) => setSelectedEventId((current) => { const next = current === event.id ? null : event.id; if (next) detailReturnFocusRef.current = clickEvent.currentTarget; return next })}>
                    <span className="tw:grid tw:size-9 tw:place-items-center tw:rounded-lg tw:bg-primary/10 tw:text-primary"><History className="tw:size-4" /></span>
                    <span className="tw:min-w-0"><strong className="tw:block tw:truncate tw:text-xs">{event.title}</strong><small className="tw:mt-1 tw:block tw:text-[10px] tw:text-muted-foreground">{formatDate(event.occurredAt, locale)} · {event.actorSnapshot.displayName ?? copy.unknownActor}</small></span>
                    <ChevronRight className={selectedEventId === event.id ? 'tw:size-4 tw:rotate-90 tw:text-primary' : 'tw:size-4 tw:text-muted-foreground'} />
                  </button>
                  {selectedEventId === event.id ? <EventDetail event={event} copy={copy} locale={locale} onClose={() => { setSelectedEventId(null); queueMicrotask(() => detailReturnFocusRef.current?.focus()) }} /> : null}
                </div>)}
              </div>)}
              {historyQuery.hasNextPage ? (
                <Button disabled={historyQuery.isFetchingNextPage} type="button" variant="outline" onClick={() => void historyQuery.fetchNextPage()}>
                  {historyQuery.isFetchingNextPage ? copy.loadingMore : copy.loadMore}
                </Button>
              ) : null}
              {historyQuery.isFetchNextPageError && events.length > 0 ? (
                <div role="alert" className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-xl tw:border tw:border-destructive/25 tw:bg-destructive/5 tw:p-3 tw:text-xs tw:text-destructive">
                  <span>{copy.partialError}</span><Button size="sm" variant="outline" onClick={() => void historyQuery.fetchNextPage()}>{copy.retry}</Button>
                </div>
              ) : null}
            </section>
          ) : null}

        </div>
      </DialogContent>
    </Dialog>
  )
}

function EventDetail(input: { event: HistoryEvent; copy: typeof trCopy | typeof enCopy; locale: 'tr' | 'en'; onClose: () => void }) {
  return <section className="tw:rounded-xl tw:border tw:border-primary/15 tw:bg-primary/[.025] tw:p-4" aria-label={input.copy.eventDetail}>
    <div className="tw:flex tw:items-start tw:justify-between tw:gap-3"><div className="tw:min-w-0"><strong className="tw:block tw:text-sm">{input.event.title}</strong><small className="tw:text-[10px] tw:text-muted-foreground">{formatDate(input.event.occurredAt, input.locale)}</small></div><Button size="icon-sm" variant="ghost" aria-label={input.copy.closeDetail} onClick={input.onClose}><X /></Button></div>
    {input.event.detail ? <p className="tw:mt-3 tw:text-xs tw:text-muted-foreground">{input.event.detail}</p> : null}
    <dl className="tw:mt-3 tw:grid tw:gap-2">{input.event.details.map((detail) => <div key={`${detail.label}:${detail.value}`} className="tw:grid tw:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] tw:gap-3 tw:text-xs"><dt className="tw:text-muted-foreground">{detail.label}</dt><dd className="tw:break-words tw:text-right tw:font-medium">{detail.value}</dd></div>)}</dl>
  </section>
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return <span className="tw:grid tw:min-h-20 tw:content-center tw:border-b tw:border-r tw:border-border tw:p-3"><small className="tw:text-[9px] tw:text-muted-foreground">{label}</small><strong className="tw:mt-1 tw:text-xl tw:tabular-nums">{value}</strong></span>
}

function HistoryState(input: { title: string; copy?: string; action?: React.ReactNode }) {
  return <div className="tw:grid tw:min-h-44 tw:place-items-center tw:rounded-xl tw:border tw:border-border tw:bg-muted/15 tw:p-6 tw:text-center"><div><Clock3 className="tw:mx-auto tw:size-5 tw:text-muted-foreground"/><strong className="tw:mt-2 tw:block tw:text-sm">{input.title}</strong>{input.copy ? <p className="tw:mt-1 tw:text-xs tw:text-muted-foreground">{input.copy}</p> : null}{input.action ? <div className="tw:mt-3">{input.action}</div> : null}</div></div>
}

function formatDate(value: string, locale: 'tr' | 'en') {
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

const trCopy = {
  store: 'Mağaza', recordSuffix: 'mağaza kaydı', description: 'Denetim, görev ve ziyaret planı geçmişi.', close: 'Mağaza kaydını kapat', all: 'Tümü', eventFilters: 'Kayıt türleri', summary: 'Mağaza kayıt özeti', events: 'Kayıt', visits: 'Ziyaret', assignedTasks: 'Atanan görev', openTasks: 'Açık görev', loading: 'Mağaza kaydı yükleniyor', error: 'Mağaza kaydı açılamadı', errorCopy: 'Kayıtlar okunamadı.', forbidden: 'Bu mağaza kaydına erişilemiyor', forbiddenCopy: 'Mağaza yetkili okuma kapsamınızda değil.', retry: 'Tekrar dene', empty: 'Bu aralıkta kayıt yok', emptyCopy: 'Seçili dönem ve türler için olay bulunamadı.', timeline: 'Mağaza denetim geçmişi', loadMore: '20 kayıt daha yükle', loadingMore: 'Yükleniyor', partialError: 'Yeni kayıtlar yüklenemedi; mevcut kayıtlar korunuyor.', unknownActor: 'Bilinmeyen kullanıcı', eventDetail: 'Kayıt detayı', closeDetail: 'Kayıt detayını kapat', kindLabels: { checklist_completed: 'Checklist', acknowledgement: 'Kabul', task_assigned: 'Görev atandı', task_resolved: 'Görev çözüldü', visit_plan_revised: 'Plan revize edildi' },
} as const
const enCopy = {
  store: 'Store', recordSuffix: 'store record', description: 'Audit, task and visit-plan history.', close: 'Close store record', all: 'All', eventFilters: 'Record types', summary: 'Store record summary', events: 'Events', visits: 'Visits', assignedTasks: 'Assigned tasks', openTasks: 'Open tasks', loading: 'Loading store record', error: 'Store record unavailable', errorCopy: 'Records could not be read.', forbidden: 'This store record is unavailable', forbiddenCopy: 'The store is outside your authorized read scope.', retry: 'Retry', empty: 'No records in this range', emptyCopy: 'No events matched the selected period and types.', timeline: 'Store audit history', loadMore: 'Load 20 more', loadingMore: 'Loading', partialError: 'New records could not load; existing records are retained.', unknownActor: 'Unknown user', eventDetail: 'Record detail', closeDetail: 'Close record detail', kindLabels: { checklist_completed: 'Checklist', acknowledgement: 'Acknowledgement', task_assigned: 'Task assigned', task_resolved: 'Task resolved', visit_plan_revised: 'Plan revised' },
} as const
