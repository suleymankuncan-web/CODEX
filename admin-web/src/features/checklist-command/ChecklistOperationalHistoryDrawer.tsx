import { useMemo } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  BadgeCheck,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ListTodo,
  RefreshCw,
  Store,
  X,
  type LucideIcon,
} from 'lucide-react'
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
import { RequestTimeoutError, withAbortTimeout } from '../../lib/request-timeout'
import type { AuthSessionSummary } from '../auth/api'
import { storeChecklistAcknowledgementsQueryKey, storeChecklistOperationalHistoryQueryKey } from '../auth/store-query-scope'
import { useLocalization } from '../localization/useLocalization'
import {
  getChecklistOperationalHistory,
  type ChecklistOperationalHistoryResponse,
} from './api'
import { getChecklistAcknowledgements, type ChecklistAcknowledgementItem } from '../checklists/api'
import {
  type ChecklistOperationalHistoryKind,
} from './model'

type HistoryEvent = ChecklistOperationalHistoryResponse['data']['items'][number]
const recordHistoryKinds = [
  'checklist_completed',
  'visit_completed',
  'task_assigned',
  'task_resolved',
] as const satisfies readonly ChecklistOperationalHistoryKind[]
const HISTORY_REQUEST_TIMEOUT_MS = 15_000

export function ChecklistOperationalHistoryDrawer(input: {
  authSummary: AuthSessionSummary | null
  open: boolean
  storeId: string | null
  storeName: string | null
  returnFocusRef: React.RefObject<HTMLElement | null>
  onClose: () => void
  onOpenResult?: (checklistInstanceId: string) => void
}) {
  const { locale } = useLocalization()
  const copy = locale === 'tr' ? trCopy : enCopy
  const baseKey = storeChecklistOperationalHistoryQueryKey(
    input.authSummary,
    input.storeId ?? 'closed',
    'all',
    recordHistoryKinds,
  )
  const historyQuery = useInfiniteQuery({
    queryKey: baseKey,
    queryFn: ({ pageParam, signal }) => withAbortTimeout(signal, HISTORY_REQUEST_TIMEOUT_MS, (requestSignal) => getChecklistOperationalHistory({
      storeId: input.storeId!,
      query: { range: 'all', kinds: recordHistoryKinds, ...(pageParam ? { cursor: pageParam } : {}) },
      signal: requestSignal,
    })),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.data.page.hasMore ? lastPage.data.page.nextCursor ?? undefined : undefined,
    enabled: input.open && Boolean(input.storeId),
  })
  const checklistResultsQuery = useQuery({
    queryKey: [...storeChecklistAcknowledgementsQueryKey(input.authSummary), 'store-record-results', input.storeId ?? 'closed'],
    queryFn: () => getChecklistAcknowledgements({ storeId: input.storeId!, limit: 50, offset: 0 }),
    enabled: input.open && Boolean(input.storeId) && Boolean(input.onOpenResult),
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
        className="checklist-record-history-drawer tw:h-dvh tw:max-h-dvh tw:max-w-none tw:min-w-0 tw:overflow-y-auto tw:rounded-none tw:p-0"
        closeLabel={copy.close}
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          input.returnFocusRef.current?.focus()
        }}
      >
        <DialogHeader className="checklist-record-history-header">
          <div className="checklist-record-history-heading">
            <span className="checklist-record-history-store-icon" aria-hidden><Store /></span>
            <div className="tw:min-w-0">
              <span className="checklist-record-history-eyebrow">{copy.recordEyebrow}</span>
              <DialogTitle className="tw:truncate tw:text-xl tw:font-semibold tw:tracking-[-0.03em]">
                <span className="tw:sr-only">{input.storeName ?? copy.store} {copy.recordSuffix}</span>
                <span aria-hidden>{input.storeName ?? copy.store}</span>
              </DialogTitle>
              <DialogDescription>{copy.description}</DialogDescription>
            </div>
          </div>
          <Button className="checklist-record-history-close" aria-label={copy.close} size="icon-sm" type="button" variant="ghost" onClick={input.onClose}>
            <X />
          </Button>
        </DialogHeader>

        <div className="checklist-record-history-body">
          {summary ? (
            <section className="checklist-record-history-totals" aria-label={copy.summary}>
              <HistoryTotal icon={CalendarCheck2} label={copy.totalVisits} value={summary.completedVisitCount} tone="cyan" />
              <HistoryTotal icon={ClipboardCheck} label={copy.totalAudits} value={summary.completedAuditCount} tone="plum" />
              <HistoryTotal icon={ListTodo} label={copy.totalTasks} value={summary.assignedTaskCount} tone="blue" />
              <HistoryTotal icon={CheckCircle2} label={copy.resolvedTasks} value={summary.resolvedTaskCount} tone="success" />
              <HistoryTotal icon={Clock3} label={copy.openTasks} value={summary.openTaskCount} tone={summary.openTaskCount > 0 ? 'danger' : 'success'} />
            </section>
          ) : null}

          {historyQuery.isLoading && events.length === 0 ? <HistoryState title={copy.loading} /> : null}
          {historyQuery.isError && events.length === 0 ? (
            <HistoryState
              title={forbidden ? copy.forbidden : copy.error}
              copy={forbidden ? copy.forbiddenCopy : historyQuery.error instanceof RequestTimeoutError ? copy.timeoutCopy : getUserFacingErrorMessage(historyQuery.error, copy.errorCopy)}
              {...(forbidden ? {} : { action: <Button size="sm" variant="outline" onClick={() => void historyQuery.refetch()}><RefreshCw />{copy.retry}</Button> })}
            />
          ) : null}
          {!historyQuery.isLoading && !historyQuery.isError && events.length === 0 ? <HistoryState title={copy.empty} copy={copy.emptyCopy} /> : null}

          {events.length > 0 ? (
            <section className="checklist-record-history-timeline" aria-label={copy.timeline}>
              <header><div><h2>{copy.timeline}</h2><p>{copy.timelineCopy}</p></div><span>{copy.recordCount(events.length)}</span></header>
              {monthGroups.map(([month, monthEvents]) => <div key={month} className="checklist-record-history-month">
                <h3>{month}</h3>
                <div className="checklist-record-history-events">
                  {monthEvents.map((event) => {
                    const presentation = historyEventPresentation[event.kind]
                    const EventIcon = presentation.icon
                    const result = findChecklistResultForEvent(event, checklistResultsQuery.data?.items ?? [])
                    const exposesResult = event.kind === 'checklist_completed' && Boolean(input.onOpenResult)
                    return <article key={event.id} className="checklist-record-history-event-wrap" data-tone={presentation.tone}>
                      <div className="checklist-record-history-event">
                        <span className="checklist-record-history-event-icon" aria-hidden><EventIcon /></span>
                        <span className="tw:min-w-0"><strong>{event.title}</strong><small><time>{formatDate(event.occurredAt, locale)}</time><span>{event.actorSnapshot.displayName ?? copy.unknownActor}</span></small></span>
                        {exposesResult ? (
                          <span className="checklist-record-history-result-access">
                            {checklistResultsQuery.isLoading ? <span className="checklist-record-history-score-loading">{copy.scoreLoading}</span> : null}
                            {result ? (
                              <>
                                {result.totalScore === null ? (
                                  <span className="checklist-record-history-score-empty">{copy.noScore}</span>
                                ) : (
                                  <span className="checklist-record-history-score" aria-label={copy.scoreAria(formatScore(result.totalScore, locale))}>
                                    <strong>{formatScore(result.totalScore, locale)}</strong><small>{copy.points}</small>
                                  </span>
                                )}
                                <Button className="checklist-record-history-result-action" size="sm" type="button" onClick={() => input.onOpenResult?.(result.checklistInstanceId)}>
                                  <ClipboardCheck />{copy.viewResult}
                                </Button>
                              </>
                            ) : null}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  })}
                </div>
              </div>)}
              {historyQuery.hasNextPage ? (
                <Button className="tw:w-full" disabled={historyQuery.isFetchingNextPage} type="button" variant="outline" onClick={() => void historyQuery.fetchNextPage()}>
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

function findChecklistResultForEvent(event: HistoryEvent, results: ChecklistAcknowledgementItem[]) {
  if (event.kind !== 'checklist_completed') return null
  const typeLabel = event.details.find((detail) => detail.label === 'Denetim türü')?.value ?? ''
  const expectedTemplateType = typeLabel.includes('Görsel')
    ? 'VM_STORE_VISIT'
    : typeLabel.includes('Bölge')
      ? 'BM_STORE_VISIT'
      : null
  const eventTime = Date.parse(event.occurredAt)
  if (!Number.isFinite(eventTime)) return null
  return results
    .filter((item) => item.status === 'completed' && item.completedAt && (!expectedTemplateType || item.templateType === expectedTemplateType))
    .map((item) => ({ item, distance: Math.abs(Date.parse(item.completedAt!) - eventTime) }))
    .filter(({ distance }) => Number.isFinite(distance) && distance <= 15 * 60 * 1000)
    .sort((left, right) => left.distance - right.distance)[0]?.item ?? null
}

function HistoryTotal({ icon: Icon, label, tone, value }: { icon: LucideIcon; label: string; tone: 'plum' | 'cyan' | 'blue' | 'success' | 'danger'; value: number }) {
  return <span className="checklist-record-history-total" data-tone={tone}><span aria-hidden><Icon /></span><span><small>{label}</small><strong>{value}</strong></span></span>
}

function HistoryState(input: { title: string; copy?: string; action?: React.ReactNode }) {
  return <div className="checklist-record-history-state"><div><Clock3 /><strong>{input.title}</strong>{input.copy ? <p>{input.copy}</p> : null}{input.action ? <div>{input.action}</div> : null}</div></div>
}

function formatDate(value: string, locale: 'tr' | 'en') {
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatScore(value: number, locale: 'tr' | 'en') {
  return new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { maximumFractionDigits: 1 }).format(value)
}

const trCopy = {
  store: 'Mağaza', recordEyebrow: 'Mağaza kayıtları', recordSuffix: 'mağaza kaydı', description: 'Denetim, ziyaret ve görev hareketleri.', close: 'Mağaza kaydını kapat', summary: 'Mağaza faaliyet özeti', totalVisits: 'Toplam Ziyaret Sayısı', totalAudits: 'Toplam Denetim Sayısı', totalTasks: 'Toplam Görev Sayısı', resolvedTasks: 'Toplam Çözülen Görev Sayısı', openTasks: 'Açık Görev Sayısı', loading: 'Mağaza kaydı yükleniyor', error: 'Mağaza kaydı açılamadı', errorCopy: 'Kayıtlar okunamadı.', timeoutCopy: 'Mağaza kaydı zamanında yanıt vermedi. Tekrar deneyin.', forbidden: 'Bu mağaza kaydına erişilemiyor', forbiddenCopy: 'Mağaza yetkili okuma kapsamınızda değil.', retry: 'Tekrar dene', empty: 'Henüz kayıt yok', emptyCopy: 'Bu mağaza için tamamlanmış bir hareket bulunamadı.', timeline: 'Kayıt akışı', timelineCopy: 'En yeni hareketten geçmişe doğru sıralanır.', recordCount: (count: number) => `${count} kayıt`, loadMore: '20 kayıt daha yükle', loadingMore: 'Yükleniyor', partialError: 'Yeni kayıtlar yüklenemedi; mevcut kayıtlar korunuyor.', unknownActor: 'Bilinmeyen kullanıcı', scoreLoading: 'Puan yükleniyor', noScore: 'Puan yok', points: 'puan', scoreAria: (score: string) => `Checklist puanı: ${score} puan`, viewResult: 'Sonucu Gör',
} as const
const enCopy = {
  store: 'Store', recordEyebrow: 'Store records', recordSuffix: 'store record', description: 'Audit, visit and task activity.', close: 'Close store record', summary: 'Store activity summary', totalVisits: 'Total Visits', totalAudits: 'Total Audits', totalTasks: 'Total Tasks', resolvedTasks: 'Total Resolved Tasks', openTasks: 'Open Tasks', loading: 'Loading store record', error: 'Store record unavailable', errorCopy: 'Records could not be read.', timeoutCopy: 'The store record did not respond in time. Try again.', forbidden: 'This store record is unavailable', forbiddenCopy: 'The store is outside your authorized read scope.', retry: 'Retry', empty: 'No records yet', emptyCopy: 'No completed activity was found for this store.', timeline: 'Record activity', timelineCopy: 'Ordered from the newest activity to the oldest.', recordCount: (count: number) => `${count} records`, loadMore: 'Load 20 more', loadingMore: 'Loading', partialError: 'New records could not load; existing records are retained.', unknownActor: 'Unknown user', scoreLoading: 'Loading score', noScore: 'No score', points: 'points', scoreAria: (score: string) => `Checklist score: ${score} points`, viewResult: 'View result',
} as const

const historyEventPresentation: Record<ChecklistOperationalHistoryKind, { icon: LucideIcon; tone: 'plum' | 'cyan' | 'blue' | 'success' }> = {
  checklist_completed: { icon: ClipboardCheck, tone: 'plum' },
  visit_completed: { icon: CalendarCheck2, tone: 'cyan' },
  acknowledgement: { icon: BadgeCheck, tone: 'cyan' },
  task_assigned: { icon: ListTodo, tone: 'blue' },
  task_resolved: { icon: CheckCircle2, tone: 'success' },
  visit_plan_revised: { icon: CalendarClock, tone: 'plum' },
}
