import { useDeferredValue, useMemo, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Ban,
  CheckCircle2,
  ClipboardCheck,
  ListTodo,
  LoaderCircle,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react'
import { Link } from 'react-router'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  getStoreQueryScopeSignature,
  retainScopedPlaceholder,
  storeWorkflowInboxQueryKey,
} from '../features/auth/store-query-scope'
import {
  CommandCanvasDataList,
  CommandCanvasFilterBar,
  CommandCanvasMetricFilter,
  CommandCanvasMetricRail,
  CommandCanvasMonthYearPicker,
  CommandCanvasOperationalDrawerContent,
  CommandCanvasPage,
  CommandCanvasPageHeader,
  CommandCanvasSortableHeading,
} from '../features/store-command-canvas/primitives'
import {
  getTaskCommandEvents,
  getTaskCommandWorkspace,
  type TaskCommandWorkspaceItem,
} from '../features/store-tasks/api'
import {
  cancelStoreActionPlan,
  closeStoreActionPlan,
  createStoreActionPlan,
  updateStoreActionPlanStatus,
} from '../features/store-actions/api'
import {
  buildReadOnlyStoreActionCandidates,
  type ReadOnlyStoreActionCandidate,
} from '../features/store-actions/candidates'
import { getWorkflowInbox } from '../features/workflow/api'
import type { WorkflowInboxItem } from '../features/workflow/contracts'
import { useLocalization } from '../features/localization/useLocalization'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet'
import { Textarea } from '../components/ui/textarea'
import { actionToast } from '../lib/action-toast'
import './store-tasks-command-canvas.css'

const PAGE_SIZE = 20
type Rail = 'all' | 'completed' | 'cancelled' | 'checklist'
type SortKey = 'task' | 'store' | 'source' | 'date' | 'priority' | 'status'
type Direction = 'ascending' | 'descending'
type TaskRow =
  | { kind: 'plan'; id: string; plan: TaskCommandWorkspaceItem }
  | { kind: 'candidate'; id: string; candidate: ReadOnlyStoreActionCandidate }
  | { kind: 'workflow'; id: string; workflow: WorkflowInboxItem }

export function StoreTasksPage(input: { authSummary: AuthSessionSummary | null }) {
  const scopeSignature = getStoreQueryScopeSignature(input.authSummary)
  return <StoreTasksWorkspace key={scopeSignature} {...input} scopeSignature={scopeSignature} />
}

function StoreTasksWorkspace(input: {
  authSummary: AuthSessionSummary | null
  scopeSignature: string
}) {
  const { locale } = useLocalization()
  const queryClient = useQueryClient()
  const scopeSignature = input.scopeSignature
  const [period, setPeriod] = useState(currentMonth())
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [status, setStatus] = useState('all')
  const [rail, setRail] = useState<Rail>('all')
  const [sort, setSort] = useState<SortKey>('date')
  const [direction, setDirection] = useState<Direction>('descending')
  const [selection, setSelection] = useState<{ row: TaskRow; scopeSignature: string } | null>(null)
  const selected = selection?.scopeSignature === scopeSignature ? selection.row : null
  const range = useMemo(() => monthRange(period), [period])
  const queryKey = ['store-tasks-command-workspace', scopeSignature, period, offset] as const
  const workspaceQuery = useQuery({
    queryKey,
    queryFn: () => getTaskCommandWorkspace({ ...range, limit: PAGE_SIZE, offset }),
    placeholderData: (previousData, previousQuery) =>
      retainScopedPlaceholder(previousData, previousQuery?.queryKey, scopeSignature),
  })
  const workspace = workspaceQuery.data
  const canMutate = Boolean(workspace?.capabilities.canUpdate)
  const inboxQuery = useQuery({
    queryKey: storeWorkflowInboxQueryKey(input.authSummary),
    queryFn: getWorkflowInbox,
    enabled: canMutate,
  })
  const candidates = useMemo(
    () => canMutate ? buildReadOnlyStoreActionCandidates(inboxQuery.data?.items ?? []) : [],
    [canMutate, inboxQuery.data?.items],
  )
  const workflowReadOnly = useMemo(
    () => canMutate
      ? (inboxQuery.data?.items ?? []).filter((item) =>
          item.itemType === 'acknowledgement' && item.sourceType === 'checklist_receipt',
        )
      : [],
    [canMutate, inboxQuery.data?.items],
  )
  const persistedSources = useMemo(
    () => new Set((workspace?.items ?? []).map((item) => `${item.source.type}:${item.source.id}`)),
    [workspace?.items],
  )
  const rows = useMemo<TaskRow[]>(() => [
    ...(workspace?.items ?? []).map((plan) => ({ kind: 'plan', id: plan.actionPlanId, plan }) as const),
    ...candidates
      .filter((candidate) => !persistedSources.has(`${candidate.sourceType}:${candidate.sourceId}`))
      .map((candidate) => ({ kind: 'candidate', id: candidate.candidateId, candidate }) as const),
    ...workflowReadOnly.map((workflow) => ({
      kind: 'workflow', id: `workflow:${workflow.sourceType}:${workflow.sourceId}`, workflow,
    }) as const),
  ], [candidates, persistedSources, workflowReadOnly, workspace?.items])
  const visibleRows = useMemo(
    () => filterAndSort(rows, { search: deferredSearch, status, rail, sort, direction }),
    [deferredSearch, direction, rail, rows, sort, status],
  )

  function selectSort(next: SortKey) {
    if (sort === next) setDirection((value) => value === 'ascending' ? 'descending' : 'ascending')
    else {
      setSort(next)
      setDirection(next === 'task' || next === 'store' || next === 'source' ? 'ascending' : 'descending')
    }
  }

  function selectMobileSort(value: string) {
    const [nextSort = 'date', nextDirection = 'descending'] = value.split(':')
    setSort(nextSort as SortKey)
    setDirection(nextDirection as Direction)
  }

  if (workspaceQuery.isError) {
    return <TaskState title="Görevler açılamadı" description="Bu rol için görev alanı şu anda açılamıyor. Tekrar deneyin." onRetry={() => void workspaceQuery.refetch()} />
  }

  return (
    <CommandCanvasPage ariaLabelledBy="tasks-command-title" className="tasks-command-page" testId="store-tasks-page">
      <CommandCanvasPageHeader
        title="Görevler"
        titleId="tasks-command-title"
        eyebrow={workspace?.view === 'report_viewer' ? 'RAPOR GÖRÜNÜMÜ' : workspace?.view === 'region_manager' ? 'BÖLGE GÖRÜNÜMÜ' : 'MAĞAZA ÇALIŞMA ALANI'}
        description={workspace?.view === 'store_manager' ? 'Aksiyonları başlatın, takip edin ve sonucu kaydedin.' : 'Tamamlanan mağaza aksiyonlarını ve denetlenebilir sonuç geçmişini inceleyin.'}
        actions={<>
          <CommandCanvasMonthYearPicker ariaLabel="Görev dönemini seç" locale={locale} value={period} maxValue={currentMonth()} onValueChange={(value) => { setPeriod(value.slice(0, 7)); setOffset(0); setSelection(null) }} />
          <Button variant="outline" onClick={() => void workspaceQuery.refetch()}>
            {workspaceQuery.isFetching ? <LoaderCircle className="tw:animate-spin" data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
            Yenile
          </Button>
        </>}
      />
      <CommandCanvasMetricRail ariaLabel="Görev sonuç özeti">
        <CommandCanvasMetricFilter label="Toplam sonuç" value={String(workspace?.summary.retained ?? 0)} note="Bu sayfadaki kayıt" icon={<ListTodo />} tone="plum" active={rail === 'all'} onClick={() => setRail('all')} />
        <CommandCanvasMetricFilter label="Çözüm bildirildi" value={String(workspace?.summary.completed ?? 0)} note="Bu sayfadaki tamamlanan" icon={<CheckCircle2 />} tone="mint" active={rail === 'completed'} onClick={() => setRail('completed')} />
        <CommandCanvasMetricFilter label="İptal edildi" value={String(workspace?.summary.cancelled ?? 0)} note="Bu sayfadaki iptal" icon={<Ban />} tone="rose" active={rail === 'cancelled'} onClick={() => setRail('cancelled')} />
        <CommandCanvasMetricFilter label="Checklist kaynağı" value={String(workspace?.summary.checklist ?? 0)} note="Bu sayfadaki denetim" icon={<ClipboardCheck />} tone="cyan" active={rail === 'checklist'} onClick={() => setRail('checklist')} />
      </CommandCanvasMetricRail>
      <CommandCanvasFilterBar
        search={<label className="tasks-command-search"><Search aria-hidden="true" /><Input aria-label="Görev veya mağaza ara" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Görev veya mağaza ara" /></label>}
        controls={<><Select value={status} onValueChange={setStatus}><SelectTrigger aria-label="Duruma göre filtrele"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm durumlar</SelectItem>{canMutate ? <><SelectItem value="open">Açık</SelectItem><SelectItem value="in_progress">İşlemde</SelectItem><SelectItem value="blocked">Bloke</SelectItem></> : null}<SelectItem value="closed">Çözüm bildirildi</SelectItem><SelectItem value="cancelled">İptal edildi</SelectItem></SelectContent></Select><Select value={`${sort}:${direction}`} onValueChange={selectMobileSort}><SelectTrigger className="tasks-command-mobile-sort" aria-label="Görevleri sırala"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="date:descending">En güncel</SelectItem><SelectItem value="task:ascending">Görev adına göre</SelectItem><SelectItem value="store:ascending">Mağazaya göre</SelectItem><SelectItem value="source:ascending">Kaynağa göre</SelectItem><SelectItem value="priority:ascending">Önceliğe göre</SelectItem><SelectItem value="status:ascending">Duruma göre</SelectItem></SelectContent></Select></>}
        context={<span>{workspace?.page.total ?? 0} kayıt</span>}
        isUpdating={workspaceQuery.isFetching}
        updatingLabel="Görevler güncelleniyor"
      />
      <CommandCanvasDataList
        ariaLabel="Görev ve sonuç listesi"
        testId="store-action-plans-panel"
        className="tasks-command-list"
        header={<div className="tasks-command-grid tasks-command-list-head">
          <CommandCanvasSortableHeading label="Görev" direction={sort === 'task' ? direction : 'none'} onClick={() => selectSort('task')} semantic={false} />
          <CommandCanvasSortableHeading label="Mağaza" direction={sort === 'store' ? direction : 'none'} onClick={() => selectSort('store')} semantic={false} />
          <CommandCanvasSortableHeading label="Kaynak" direction={sort === 'source' ? direction : 'none'} onClick={() => selectSort('source')} semantic={false} />
          <CommandCanvasSortableHeading label="Tarih" direction={sort === 'date' ? direction : 'none'} onClick={() => selectSort('date')} semantic={false} />
          <CommandCanvasSortableHeading label="Öncelik" direction={sort === 'priority' ? direction : 'none'} onClick={() => selectSort('priority')} semantic={false} />
          <CommandCanvasSortableHeading label="Durum" direction={sort === 'status' ? direction : 'none'} onClick={() => selectSort('status')} semantic={false} />
        </div>}
        footer={<Pager {...(workspace?.page ? { page: workspace.page } : {})} fetching={workspaceQuery.isFetching} onOffset={setOffset} />}
      >
        {workspaceQuery.isLoading ? <TaskInlineState icon={<LoaderCircle className="tw:animate-spin" />} title="Görevler yükleniyor" description="Rol kapsamındaki sonuçlar hazırlanıyor." /> : null}
        {!workspaceQuery.isLoading && visibleRows.length === 0 ? <TaskInlineState icon={<ListTodo />} title="Kayıt bulunamadı" description="Seçili dönem ve filtrelerde görev yok." /> : null}
        {visibleRows.map((row) => <TaskListRow key={row.id} row={row} onClick={() => setSelection({ row, scopeSignature })} />)}
      </CommandCanvasDataList>
      <TaskDrawer
        key={`${scopeSignature}:${selected?.id ?? 'closed'}`}
        row={selected}
        scopeSignature={scopeSignature}
        canMutate={canMutate}
        onOpenChange={(open) => { if (!open) setSelection(null) }}
        onChanged={async (close) => {
          if (close) setSelection(null)
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['store-tasks-command-workspace'] }),
            queryClient.invalidateQueries({ queryKey: ['workflow-inbox'] }),
          ])
        }}
      />
    </CommandCanvasPage>
  )
}

function TaskListRow(input: { row: TaskRow; onClick: () => void }) {
  const values = rowValues(input.row)
  return (
    <button type="button" className="tasks-command-grid tasks-command-row" onClick={input.onClick} data-testid={input.row.kind === 'plan' ? 'store-action-plan-row' : 'store-task-queue-row'}>
      <span className="tasks-command-primary"><b>{values.title}</b><small>{values.summary}</small></span>
      <span>{values.store}</span>
      <span>{values.source}</span>
      <span>{formatDate(values.date)}</span>
      <span><i data-priority={values.priority}>{priorityLabel(values.priority)}</i></span>
      <span><i data-status={values.status}>{statusLabel(values.status)}</i></span>
    </button>
  )
}

function TaskDrawer(input: {
  row: TaskRow | null
  scopeSignature: string
  canMutate: boolean
  onOpenChange: (open: boolean) => void
  onChanged: (close: boolean) => Promise<void>
}) {
  const row = input.row
  const plan = row?.kind === 'plan' ? row.plan : null
  const candidate = row?.kind === 'candidate' ? row.candidate : null
  const workflow = row?.kind === 'workflow' ? row.workflow : null
  const [note, setNote] = useState('')
  const [dueOn, setDueOn] = useState('')
  const eventsQuery = useInfiniteQuery({
    queryKey: ['store-task-events', input.scopeSignature, plan?.actionPlanId],
    queryFn: ({ pageParam }) => getTaskCommandEvents({
      actionPlanId: plan!.actionPlanId,
      limit: 20,
      offset: pageParam,
    }),
    initialPageParam: 0,
    getNextPageParam: (page) => page.offset + page.items.length < page.total
      ? page.offset + page.items.length
      : undefined,
    enabled: Boolean(plan),
  })
  const auditEvents = eventsQuery.data?.pages.flatMap((page) => page.items) ?? plan?.events.items ?? []
  const mutation = useMutation({
    mutationFn: async (command: 'start' | 'block' | 'complete' | 'cancel' | 'create') => {
      if (command === 'create' && candidate) {
        if (!dueOn) throw new Error('Termin tarihi zorunludur.')
        const sourceDeepLink = safeSource(candidate.deepLink, 'kpi_exception')
        if (!sourceDeepLink) throw new Error('Görev kaynağı artık kullanılamıyor.')
        return createStoreActionPlan({
          storeId: candidate.storeId, sourceType: 'kpi_exception', sourceId: candidate.sourceId,
          sourceDeepLink, title: candidate.title, summary: candidate.summary,
          priority: candidate.urgency, dueOn,
        })
      }
      if (!plan) throw new Error('Görev kaydı bulunamadı.')
      if (command === 'start' || command === 'block') {
        return updateStoreActionPlanStatus({
          actionPlanId: plan.actionPlanId,
          body: note.trim() ? { status: command === 'start' ? 'in_progress' : 'blocked', note: note.trim() } : { status: command === 'start' ? 'in_progress' : 'blocked' },
        })
      }
      if (!note.trim()) throw new Error('Açıklama zorunludur.')
      return command === 'complete'
        ? closeStoreActionPlan({ actionPlanId: plan.actionPlanId, body: { resolutionNote: note.trim() } })
        : cancelStoreActionPlan({ actionPlanId: plan.actionPlanId, body: { cancelReason: note.trim() } })
    },
    onSuccess: async (_response, command) => {
      actionToast.success(command === 'create' ? 'Aksiyon planı oluşturuldu' : command === 'complete' ? 'Çözüm bildirildi' : command === 'cancel' ? 'Görev iptal edildi' : 'Görev durumu güncellendi')
      await input.onChanged(true)
    },
    onError: (error) => actionToast.error(error, 'Görev işlemi kaydedilemedi.'),
  })
  const values = row ? rowValues(row) : null
  const active = plan && ['open', 'in_progress', 'blocked'].includes(plan.status)
  const sourceLink = plan
    ? plan.source.deepLink
    : candidate
      ? safeSource(candidate.deepLink, 'kpi_exception')
      : workflow
        ? safeSource(workflow.deepLink, 'checklist_remediation')
        : null
  return (
    <Sheet open={Boolean(row)} onOpenChange={input.onOpenChange}>
      <CommandCanvasOperationalDrawerContent aria-label="Görev detayı" className="tasks-command-drawer">
        {row && values ? <>
          <SheetHeader>
            <SheetTitle className="tw:sr-only">Görev detayı</SheetTitle>
            <h2>{values.title}</h2>
            <SheetDescription>{values.store} · {values.source}</SheetDescription>
          </SheetHeader>
          <div className="tasks-command-drawer-body">
            <section className="tasks-command-facts"><Fact label="Durum" value={statusLabel(values.status)} /><Fact label="Öncelik" value={priorityLabel(values.priority)} /><Fact label="Tarih" value={formatDate(values.date)} /></section>
            {!input.canMutate && plan ? <section><h3>Mağaza müdürü notu</h3><p>{plan.resultNote ?? 'Not eklenmemiş.'}</p></section> : null}
            <section><h3>Kaynak ve sonuç</h3><p>{values.summary}</p>{plan?.resultNote ? <p className="tasks-command-result">{plan.resultNote}</p> : null}{sourceLink ? <Button asChild variant="outline"><Link to={sourceLink}>Kaynağı aç</Link></Button> : <p className="tasks-command-source-unavailable">Kaynak artık kullanılamıyor.</p>}</section>
            {input.canMutate && (active || candidate) ? <section className="tasks-command-actions"><h3>Görev işlemi</h3>{candidate ? <Input aria-label="Termin tarihi" type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} /> : <Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="Kısa not yaz" />}<div>{candidate ? <Button disabled={!dueOn || mutation.isPending} onClick={() => mutation.mutate('create')}>Aksiyon planı oluştur</Button> : <><Button disabled={mutation.isPending || plan?.status === 'in_progress'} onClick={() => mutation.mutate('start')}><PlayCircle data-icon="inline-start" />İşleme al</Button><Button variant="outline" disabled={mutation.isPending || plan?.status === 'blocked'} onClick={() => mutation.mutate('block')}><ShieldAlert data-icon="inline-start" />Bloke et</Button><Button disabled={mutation.isPending || !note.trim()} onClick={() => mutation.mutate('complete')}><CheckCircle2 data-icon="inline-start" />Çözüm bildir</Button><Button variant="ghost" disabled={mutation.isPending || !note.trim()} onClick={() => mutation.mutate('cancel')}><Ban data-icon="inline-start" />İptal et</Button></>}</div></section> : null}
            {plan ? <section><h3>Denetim geçmişi</h3>{eventsQuery.isLoading ? <p>Geçmiş yükleniyor…</p> : null}<div className="tasks-command-timeline">{auditEvents.map((event) => <article key={event.eventId}><span /><div><b>{eventLabel(event.eventType)}</b><p>{event.actorDisplayName}{event.actorRoleLabel ? ` · ${event.actorRoleLabel}` : ''}</p>{event.note ? <em>{event.note}</em> : null}<time>{formatDateTime(event.occurredAt)}</time></div></article>)}</div>{eventsQuery.hasNextPage ? <Button variant="outline" disabled={eventsQuery.isFetchingNextPage} onClick={() => void eventsQuery.fetchNextPage()}>{eventsQuery.isFetchingNextPage ? 'Yükleniyor…' : 'Daha fazla göster'}</Button> : null}</section> : null}
          </div>
        </> : null}
      </CommandCanvasOperationalDrawerContent>
    </Sheet>
  )
}

function filterAndSort(rows: TaskRow[], input: { search: string; status: string; rail: Rail; sort: SortKey; direction: Direction }) {
  const needle = input.search.trim().toLocaleLowerCase('tr-TR')
  return rows.filter((row) => {
    const value = rowValues(row)
    if (needle && !`${value.title} ${value.summary} ${value.store}`.toLocaleLowerCase('tr-TR').includes(needle)) return false
    if (input.status !== 'all' && value.status !== input.status) return false
    if (input.rail === 'completed' && value.status !== 'closed') return false
    if (input.rail === 'cancelled' && value.status !== 'cancelled') return false
    if (input.rail === 'checklist' && value.source !== 'Checklist') return false
    return true
  }).toSorted((left, right) => {
    const a = rowValues(left)
    const b = rowValues(right)
    const value = input.sort === 'task' ? a.title.localeCompare(b.title, 'tr')
      : input.sort === 'store' ? a.store.localeCompare(b.store, 'tr')
        : input.sort === 'source' ? a.source.localeCompare(b.source, 'tr')
          : input.sort === 'date' ? a.date.localeCompare(b.date)
            : input.sort === 'priority' ? priorityRank(a.priority) - priorityRank(b.priority)
              : a.status.localeCompare(b.status)
    return input.direction === 'ascending' ? value : -value
  })
}

function rowValues(row: TaskRow) {
  if (row.kind === 'workflow') return {
    title: row.workflow.title, summary: row.workflow.summary,
    store: row.workflow.storeName ?? 'Mağaza', source: 'Checklist',
    date: row.workflow.needsAttentionAt ?? row.workflow.createdAt ?? '',
    priority: row.workflow.urgency, status: 'candidate',
  }
  if (row.kind === 'candidate') return {
    title: row.candidate.title, summary: row.candidate.summary, store: row.candidate.storeName ?? 'Mağaza',
    source: 'KPI', date: row.candidate.needsAttentionAt ?? row.candidate.createdAt ?? '',
    priority: row.candidate.urgency, status: 'candidate',
  }
  return {
    title: row.plan.title, summary: row.plan.summary ?? row.plan.resultNote ?? 'Açıklama yok',
    store: row.plan.storeName ?? 'Mağaza', source: row.plan.source.type === 'checklist_remediation' ? 'Checklist' : 'KPI',
    date: row.plan.completedAt ?? row.plan.updatedAt, priority: row.plan.priority, status: row.plan.status,
  }
}

function Pager(input: { page?: { total: number; limit: number; offset: number; count: number; hasMore: boolean }; fetching: boolean; onOffset: (value: number) => void }) {
  if (!input.page || input.page.total === 0) return null
  return <div className="tasks-command-pager"><span>{input.page.offset + 1}-{input.page.offset + input.page.count} / {input.page.total}</span><div><Button variant="outline" disabled={input.fetching || input.page.offset === 0} onClick={() => input.onOffset(Math.max(0, input.page!.offset - input.page!.limit))}>Önceki</Button><Button variant="outline" disabled={input.fetching || !input.page.hasMore} onClick={() => input.onOffset(input.page!.offset + input.page!.limit)}>Sonraki</Button></div></div>
}
function TaskInlineState(input: { icon: React.ReactNode; title: string; description: string }) { return <div className="tasks-command-empty">{input.icon}<b>{input.title}</b><span>{input.description}</span></div> }
function TaskState(input: { title: string; description: string; onRetry: () => void }) { return <CommandCanvasPage ariaLabelledBy="tasks-state-title"><CommandCanvasPageHeader title="Görevler" titleId="tasks-state-title" description="Mağaza operasyon görevleri" /><TaskInlineState icon={<ShieldAlert />} title={input.title} description={input.description} /><Button onClick={input.onRetry}>Tekrar dene</Button></CommandCanvasPage> }
function Fact(input: { label: string; value: string }) { return <div><span>{input.label}</span><b>{input.value}</b></div> }
function currentMonth() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find((part) => part.type === 'year')?.value ?? '2026'
  const month = parts.find((part) => part.type === 'month')?.value ?? '01'
  return `${year}-${month}`
}
function monthRange(period: string) { const [yearText = '2026', monthText = '01'] = period.split('-'); const last = new Date(Date.UTC(Number(yearText), Number(monthText), 0)).getUTCDate(); return { periodStart: `${period}-01`, periodEnd: `${period}-${String(last).padStart(2, '0')}` } }
function formatDate(value: string) { if (!value) return '—'; return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function priorityLabel(value: string) { return value === 'high' ? 'Yüksek' : value === 'medium' ? 'Orta' : 'Düşük' }
function priorityRank(value: string) { return value === 'high' ? 0 : value === 'medium' ? 1 : 2 }
function statusLabel(value: string) { return value === 'candidate' ? 'Plan bekliyor' : value === 'open' ? 'Açık' : value === 'in_progress' ? 'İşlemde' : value === 'blocked' ? 'Bloke' : value === 'closed' ? 'Çözüm bildirildi' : 'İptal edildi' }
function eventLabel(value: string) { return value.endsWith('.created') ? 'Görev oluşturuldu' : value.endsWith('.status_updated') ? 'Durum güncellendi' : value.endsWith('.closed') ? 'Çözüm bildirildi' : value.endsWith('.cancelled') ? 'Görev iptal edildi' : 'Görev güncellendi' }
function safeSource(value: string | null | undefined, sourceType: 'kpi_exception' | 'checklist_remediation') {
  if (!value?.startsWith('/') || value.startsWith('//')) return null
  const expectedRoute = sourceType === 'checklist_remediation' ? '/store/checklists' : '/store/kpis'
  return isApprovedSource(value, expectedRoute) ? value : null
}
function isApprovedSource(value: string, route: string) { return value === route || value.startsWith(`${route}?`) }
