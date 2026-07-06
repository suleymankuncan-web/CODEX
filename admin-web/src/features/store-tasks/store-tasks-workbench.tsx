import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  ClipboardList,
  Clock3,
  History,
  Loader2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingDown,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { AuthSessionSummary } from '../auth/api'
import type { AppLocale } from '../../lib/i18n'
import { actionToast } from '../../lib/action-toast'
import { getErrorMessage } from '../../lib/format'
import { cn } from '../../lib/utils'
import { transientQueryRetryOptions } from '../../lib/query-retry'
import {
  cancelStoreActionPlan,
  closeStoreActionPlan,
  createStoreActionPlan,
  getStoreActionPlan,
  updateStoreActionPlanStatus,
  type StoreActionPlan,
} from '../store-actions/api'
import {
  formatPeriodLabel,
  formatUiStatusLabel,
  isActiveStoreActionStatus,
  shiftPeriod,
  type StoreTaskCommandRow,
  type StoreTaskFilter,
  type StoreTasksCommandSummary,
  type StoreTasksPersona,
  type StoreTasksRegionMode,
} from './store-tasks-command-center-model'
import './store-tasks-command-center.css'
export function StoreTasksAccessState(input: {
  authSummary: AuthSessionSummary | null
}) {
  const roleLabel = formatAccessRoleLabel(input.authSummary?.user.roleCodes ?? [])

  return (
    <Card className="tw:border-border/80 tw:bg-card/85 tw:shadow-sm">
      <CardHeader>
        <div className="tw:flex tw:size-10 tw:items-center tw:justify-center tw:rounded-xl tw:bg-secondary tw:text-primary">
          <ShieldCheck className="tw:size-5" />
        </div>
        <CardTitle>
          <h1 className="tw:text-xl tw:font-semibold tw:text-foreground">Görevler açılamadı</h1>
        </CardTitle>
        <CardDescription>Bu sayfa mağaza operasyon rolüyle açılır.</CardDescription>
      </CardHeader>
      <CardContent className="tw:flex tw:flex-wrap tw:gap-2">
        <Badge variant="outline">Mağaza bilgisi alınamadı</Badge>
        <Badge variant="secondary">{roleLabel}</Badge>
      </CardContent>
    </Card>
  )
}
export function StoreTasksCommandCenter(input: {
  rows: readonly StoreTaskCommandRow[]
  allRows: readonly StoreTaskCommandRow[]
  summary: StoreTasksCommandSummary
  persona: StoreTasksPersona
  regionMode: StoreTasksRegionMode
  selectedPeriod: string
  search: string
  activeFilter: StoreTaskFilter
  locale: AppLocale
  canMutate: boolean
  isLoading: boolean
  isFetching: boolean
  error: unknown
  pageMeta: { total: number; limit: number; offset: number; count: number } | undefined
  onSearchChange: (value: string) => void
  onActiveFilterChange: (value: StoreTaskFilter) => void
  onSelectedPeriodChange: (value: string) => void
  onRefresh: () => void
  onActionPlanCreated: () => void
  onRetryActionPlans: () => void
  onPreviousPage: () => void
  onNextPage: () => void
}) {
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const selectedRow = useMemo(
    () => input.allRows.find((row) => row.id === selectedRowId) ?? null,
    [input.allRows, selectedRowId],
  )
  const isRegion = input.persona === 'regionManager'
  const periodLabel = formatPeriodLabel(input.selectedPeriod, input.locale)
  const filters = buildFilters(input.persona)
  return (
    <div className="store-tasks-command">
      <header className="stcc-topbar">
        <div className="stcc-topbar-main">
          <div className="stcc-pills">
            <span className="stcc-pill stcc-pill-primary">Görevler</span>
            <span className="stcc-pill">{periodLabel}</span>
            <span className="stcc-pill stcc-pill-warning">{input.summary.actionable} aksiyon</span>
            {input.summary.carriedOver ? (
              <span className="stcc-pill stcc-pill-danger">{input.summary.carriedOver} devreden</span>
            ) : null}
          </div>
          <h1>Görevler</h1>
          <p>
            {isRegion
              ? 'Mağaza müdürünün bitirdiği süreçler ve sonuç geçmişi.'
              : 'Mağaza aksiyonları, checklist takipleri ve projeksiyon işleri.'}
          </p>
        </div>
        <div className="stcc-actions">
          <div className="stcc-period">
            <button
              type="button"
              className="stcc-period-trigger"
              aria-expanded={periodPickerOpen}
              onClick={() => setPeriodPickerOpen((current) => !current)}
            >
              <Calendar aria-hidden="true" />
              {periodLabel}
            </button>
            {periodPickerOpen ? (
              <div className="stcc-period-popover" role="dialog" aria-label="Dönem seç">
                <div className="stcc-period-head">
                  <button
                    type="button"
                    aria-label="Önceki ay"
                    onClick={() => input.onSelectedPeriodChange(shiftPeriod(input.selectedPeriod, -1))}
                  >
                    <ChevronLeft aria-hidden="true" />
                  </button>
                  <strong>{periodLabel}</strong>
                  <button
                    type="button"
                    aria-label="Sonraki ay"
                    onClick={() => input.onSelectedPeriodChange(shiftPeriod(input.selectedPeriod, 1))}
                  >
                    <ChevronRight aria-hidden="true" />
                  </button>
                </div>
                <MonthGrid
                  selectedPeriod={input.selectedPeriod}
                  locale={input.locale}
                  onSelect={(period) => {
                    input.onSelectedPeriodChange(period)
                    setPeriodPickerOpen(false)
                  }}
                />
              </div>
            ) : null}
          </div>
          <Button type="button" variant="outline" className="stcc-button" onClick={input.onRefresh}>
            {input.isFetching ? <Loader2 data-icon="inline-start" className="tw:animate-spin" /> : <RefreshCw data-icon="inline-start" />}
            Yenile
          </Button>
        </div>
      </header>
      <section className="stcc-metrics" aria-label="Görev özeti">
        <Metric
          label={isRegion && input.regionMode === 'results' ? 'Tamamlanan süreç' : 'Açık iş'}
          value={isRegion && input.regionMode === 'results' ? input.summary.visible : input.summary.actionable}
          note={isRegion && input.regionMode === 'results' ? 'BM tarafından okunur' : 'İşlem bekleyen kayıt'}
          tone="amber"
          icon={<Bell />}
        />
        <Metric label="Devreden iş" value={input.summary.carriedOver} note="Önceki dönemden açık" tone="rose" icon={<History />} />
        <Metric
          label={isRegion ? 'Kapalı kayıt' : 'İşlemde'}
          value={isRegion ? input.summary.closed : input.summary.inProgress}
          note={isRegion ? 'Süreç tamamlandı' : 'Mağaza aksiyonu başladı'}
          tone="cyan"
          icon={<Clock3 />}
        />
        <Metric label="Çözüm bildirildi" value={input.summary.reported} note="Mağaza müdürü bildirir" tone="mint" icon={<CheckCircle2 />} />
      </section>
      <section className="stcc-toolbar" aria-label="Görev filtreleri">
        <label className="stcc-search">
          <Search aria-hidden="true" />
          <Input
            value={input.search}
            onChange={(event) => input.onSearchChange(event.target.value)}
            placeholder="Görev, mağaza veya sorumlu ara"
          />
        </label>
        <div className="stcc-filter-strip">
          {filters.map((filter) => (
            <button
              type="button"
              key={filter.id}
              className={input.activeFilter === filter.id ? 'selected' : ''}
              onClick={() => input.onActiveFilterChange(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>
      <section className="stcc-queue" data-testid="store-action-plans-panel">
        <div className="stcc-queue-head">
          <div>
            <h2>{isRegion && input.regionMode === 'results' ? 'Tamamlanan süreçler' : 'İş kuyruğu'}</h2>
            <span>{input.rows.length} kayıt</span>
          </div>
          {isRegion ? (
            <Badge variant="outline">Sonuç geçmişi</Badge>
          ) : (
            <Button type="button" variant="outline" className="stcc-button" onClick={() => input.onActiveFilterChange('blocked')}>
              Blokeleri göster
            </Button>
          )}
        </div>
        {input.error ? (
          <div className="stcc-error">
            <strong>Aksiyon planları alınamadı</strong>
            <span>Aksiyon planları şu anda listelenemiyor. Diğer görev kayıtları gösterilmeye devam eder.</span>
            <Button type="button" variant="outline" onClick={input.onRetryActionPlans}>
              Tekrar dene
            </Button>
          </div>
        ) : null}
        <div className="stcc-list" role="table" aria-label="Görev listesi">
          <div className="stcc-list-head" role="row">
            <span role="columnheader" aria-label="Kaynak türü" />
            <span role="columnheader">Görev</span>
            <span role="columnheader">Kaynak</span>
            <span role="columnheader">Tarih</span>
            <span role="columnheader">Geçen süre</span>
            <span role="columnheader">Öncelik</span>
            <span role="columnheader">Durum</span>
          </div>
          {input.isLoading && input.rows.length === 0 ? (
            <div className="stcc-empty">
              <Loader2 className="tw:animate-spin" />
              <strong>Görevler yükleniyor</strong>
              <span>Aksiyon planları hazırlanıyor.</span>
            </div>
          ) : null}
          {!input.isLoading && input.rows.length === 0 ? (
            <div className="stcc-empty">
              <ClipboardList />
              <strong>Kayıt yok</strong>
              <span>Seçili dönem ve filtrelerde görev bulunmuyor.</span>
            </div>
          ) : null}
          {input.rows.map((row) => (
            <button
              key={row.id}
              type="button"
              data-testid={row.source === 'plan' ? 'store-action-plan-row' : 'store-task-queue-row'}
              className={cn('stcc-row', `status-${row.uiStatus}`, selectedRow?.id === row.id && 'selected', row.isCarriedOver && 'carried')}
              onClick={() => setSelectedRowId(row.id)}
            >
              <span className={cn('stcc-source-dot', row.sourceGroup)}>{renderSourceIcon(row.sourceGroup)}</span>
              <span className="stcc-row-main">
                <strong>{row.title}</strong>
                <small>
                  {row.storeName}
                  {row.isCarriedOver ? <em>Devreden</em> : null}
                </small>
              </span>
              <span className="stcc-row-value">{row.sourceLabel}</span>
              <span className="stcc-row-value">{row.assignedAtLabel}</span>
              <span className="stcc-row-value">{row.durationLabel}</span>
              <span className={cn('stcc-badge', `priority-${row.priority}`)}>{row.priorityLabel}</span>
              <span className={cn('stcc-badge', `state-${row.uiStatus}`)}>{formatUiStatusLabel(row.uiStatus)}</span>
            </button>
          ))}
        </div>
        <Pagination
          meta={input.pageMeta}
          fetching={input.isFetching}
          onPrevious={input.onPreviousPage}
          onNext={input.onNextPage}
        />
      </section>
      <TaskDetailDrawer
        row={selectedRow}
        persona={input.persona}
        canMutate={input.canMutate}
        locale={input.locale}
        onClose={() => setSelectedRowId(null)}
        onActionPlanCreated={input.onActionPlanCreated}
      />
    </div>
  )
}
function Metric(input: {
  label: string
  value: number
  note: string
  tone: 'amber' | 'rose' | 'cyan' | 'mint'
  icon: ReactNode
}) {
  return (
    <article className={cn('stcc-metric', input.tone)}>
      <span className="stcc-metric-icon">{input.icon}</span>
      <span>
        <small>{input.label}</small>
        <strong>{input.value}</strong>
        <p>{input.note}</p>
      </span>
    </article>
  )
}
function MonthGrid(input: {
  selectedPeriod: string
  locale: AppLocale
  onSelect: (period: string) => void
}) {
  const year = Number(input.selectedPeriod.slice(0, 4))
  return (
    <div className="stcc-month-grid">
      {Array.from({ length: 12 }, (_, monthIndex) => {
        const period = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
        return (
          <button
            type="button"
            key={period}
            className={period === input.selectedPeriod ? 'selected' : ''}
            onClick={() => input.onSelect(period)}
          >
            {formatPeriodLabel(period, input.locale).replace(String(year), '').trim()}
          </button>
        )
      })}
    </div>
  )
}
function TaskDetailDrawer(input: {
  row: StoreTaskCommandRow | null
  persona: StoreTasksPersona
  canMutate: boolean
  locale: AppLocale
  onClose: () => void
  onActionPlanCreated: () => void
}) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [candidateDueOn, setCandidateDueOn] = useState('')
  const row = input.row
  const detailQuery = useQuery({
    queryKey: ['store-action-plans', 'store-tasks', 'detail', row?.plan?.actionPlanId],
    queryFn: () => getStoreActionPlan({ actionPlanId: row?.plan?.actionPlanId ?? '' }),
    enabled: Boolean(row?.plan),
    ...transientQueryRetryOptions,
  })
  const updateStatusMutation = useMutation({
    mutationFn: updateStoreActionPlanStatus,
    onSuccess: (_data, variables) => {
      actionToast.success(variables.body.status === 'blocked' ? 'Bloke edildi' : 'İşleme alındı')
      return invalidateStoreTaskQueries(queryClient)
    },
    onError: (error) => actionToast.error(error, 'Görev durumu kaydedilemedi.'),
  })
  const closePlanMutation = useMutation({
    mutationFn: closeStoreActionPlan,
    onSuccess: () => {
      actionToast.success('Çözüm bildirildi')
      return invalidateStoreTaskQueries(queryClient)
    },
    onError: (error) => actionToast.error(error, 'Çözüm kaydedilemedi.'),
  })
  const cancelPlanMutation = useMutation({
    mutationFn: cancelStoreActionPlan,
    onSuccess: () => {
      actionToast.info('Görev iptal edildi')
      return invalidateStoreTaskQueries(queryClient)
    },
    onError: (error) => actionToast.error(error, 'Görev iptal edilemedi.'),
  })
  const createPlanMutation = useMutation({
    mutationFn: createStoreActionPlan,
    onSuccess: async () => {
      actionToast.success('Aksiyon planı oluşturuldu')
      input.onActionPlanCreated()
      await invalidateStoreTaskQueries(queryClient)
    },
    onError: (error) => actionToast.error(error, 'Aksiyon planı oluşturulamadı.'),
  })
  if (!row) return null
  const currentRow = row
  const detailPlan = detailQuery.data?.data.plan ?? currentRow.plan
  const canMutateActivePlan =
    input.persona === 'storeManager' &&
    input.canMutate &&
    detailPlan !== undefined &&
    isActiveStoreActionStatus(detailPlan.status)
  const mutationError =
    updateStatusMutation.error ??
    closePlanMutation.error ??
    cancelPlanMutation.error ??
    createPlanMutation.error
  const isMutating =
    updateStatusMutation.isPending ||
    closePlanMutation.isPending ||
    cancelPlanMutation.isPending ||
    createPlanMutation.isPending
  const safeSourcePath = currentRow.workflowItem?.deepLink ? getSafeInAppPath(currentRow.workflowItem.deepLink) : detailPlan?.sourceDeepLink ? getSafeInAppPath(detailPlan.sourceDeepLink) : null
  function updateStatus(status: 'in_progress' | 'blocked') {
    if (!detailPlan || isMutating) return
    updateStatusMutation.mutate({
      actionPlanId: detailPlan.actionPlanId,
      body: note.trim() ? { status, note: note.trim() } : { status },
    })
  }
  function closePlan() {
    if (!detailPlan || !note.trim() || isMutating) return
    closePlanMutation.mutate({
      actionPlanId: detailPlan.actionPlanId,
      body: { resolutionNote: note.trim() },
    })
  }
  function cancelPlan() {
    if (!detailPlan || !note.trim() || isMutating) return
    cancelPlanMutation.mutate({
      actionPlanId: detailPlan.actionPlanId,
      body: { cancelReason: note.trim() },
    })
  }
  function createCandidatePlan() {
    if (!currentRow.candidate || !candidateDueOn || isMutating) return
    const sourceDeepLink = getSafeInAppPath(currentRow.candidate.deepLink)
    createPlanMutation.mutate({
      storeId: currentRow.candidate.storeId,
      sourceType: 'kpi_exception',
      sourceId: currentRow.candidate.sourceId,
      ...(sourceDeepLink ? { sourceDeepLink } : {}),
      title: currentRow.candidate.title,
      summary: currentRow.candidate.summary,
      priority: mapUrgencyToPriority(currentRow.candidate.urgency),
      dueOn: candidateDueOn,
    })
  }
  return (
    <div className="stcc-drawer-shell" role="dialog" aria-modal="true" aria-label="Görev detayı">
      <button className="stcc-drawer-scrim" type="button" aria-label="Detayı kapat" onClick={input.onClose} />
      <aside className="stcc-drawer">
        <div className="stcc-drawer-head">
          <div>
            <span className={cn('stcc-source-pill', currentRow.sourceGroup)}>{currentRow.sourceLabel}</span>
            <h2>{currentRow.title}</h2>
            <p>{currentRow.storeName}</p>
          </div>
          <button type="button" className="stcc-icon-button" aria-label="Kapat" onClick={input.onClose}>
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="stcc-drawer-body">
          {detailQuery.isLoading ? (
            <div className="stcc-inline-state">
              <Loader2 className="tw:animate-spin" />
              Detay yükleniyor
            </div>
          ) : null}
          {detailQuery.isError ? (
            <div className="stcc-inline-error">
              <strong>Detay alınamadı</strong>
              <span>{getErrorMessage(detailQuery.error)}</span>
            </div>
          ) : null}
          <div className="stcc-info-grid">
            <Fact label="Öncelik" value={currentRow.priorityLabel} />
            <Fact label="Vade" value={currentRow.dueLabel} />
            <Fact label="Kaynak dönem" value={currentRow.sourcePeriodLabel} />
            <Fact label="Atanma" value={currentRow.assignedAtLabel} />
            <Fact label="Çözüm tarihi" value={currentRow.completionAtLabel} />
            <Fact label={currentRow.completionAt ? 'Tamamlama süresi' : 'Açık süre'} value={currentRow.durationLabel} />
          </div>
          <section className="stcc-detail-section">
            <h3>Kaynak</h3>
            <p>{currentRow.summary}</p>
            {safeSourcePath ? (
              <Button asChild variant="outline" className="stcc-button">
                <Link to={safeSourcePath}>
                  Kaynağı aç
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            ) : null}
          </section>
          <section className="stcc-detail-section">
            <h3>Sonraki adım</h3>
            <p>{currentRow.nextStep}</p>
          </section>
          {input.persona === 'regionManager' ? (
            <section className="stcc-detail-section">
              <h3>Mağaza müdürü notu</h3>
              <p>{currentRow.historyPreview ?? 'Not yok'}</p>
            </section>
          ) : null}
          {canMutateActivePlan ? (
            <section className="stcc-detail-section stcc-command-box">
              <h3>İşlem</h3>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Kısa not yaz"
                maxLength={500}
              />
              {mutationError ? <p className="stcc-form-error">{getErrorMessage(mutationError)}</p> : null}
              <div className="stcc-command-actions">
                <Button
                  type="button"
                  className="stcc-primary-action"
                  disabled={isMutating || detailPlan.status === 'in_progress'}
                  onClick={() => updateStatus('in_progress')}
                >
                  <PlayCircle data-icon="inline-start" />
                  İşleme al
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="stcc-button stcc-danger-action"
                  disabled={isMutating || detailPlan.status === 'blocked'}
                  onClick={() => updateStatus('blocked')}
                >
                  <PauseCircle data-icon="inline-start" />
                  Bloke et
                </Button>
                <Button
                  type="button"
                  className="stcc-primary-action"
                  disabled={isMutating || !note.trim()}
                  onClick={closePlan}
                >
                  <CheckCircle2 data-icon="inline-start" />
                  Çözüm bildir
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="stcc-ghost-danger"
                  disabled={isMutating || !note.trim()}
                  onClick={cancelPlan}
                >
                  <CircleSlash data-icon="inline-start" />
                  İptal et
                </Button>
              </div>
            </section>
          ) : null}
          {!currentRow.plan && currentRow.candidate && input.persona === 'storeManager' && input.canMutate ? (
            <section className="stcc-detail-section stcc-command-box">
              <h3>Aksiyon planı</h3>
              <p>Projeksiyon işini takip planına alın.</p>
              <label className="stcc-field">
                <span>Termin</span>
                <Input
                  type="date"
                  value={candidateDueOn}
                  onChange={(event) => setCandidateDueOn(event.target.value)}
                />
              </label>
              {mutationError ? <p className="stcc-form-error">{getErrorMessage(mutationError)}</p> : null}
              <Button
                type="button"
                className="stcc-primary-action"
                disabled={isMutating || !candidateDueOn}
                onClick={createCandidatePlan}
              >
                Aksiyon planı oluştur
                <ArrowRight data-icon="inline-end" />
              </Button>
            </section>
          ) : null}
          <section className="stcc-detail-section">
            <h3>Geçmiş</h3>
            <div className="stcc-history">
              <span>{currentRow.historyPreview ?? 'Hareket kaydı yok'}</span>
              <small>{currentRow.assignedAtLabel}</small>
            </div>
          </section>
        </div>
      </aside>
    </div>
  )
}
function Fact(input: { label: string; value: string }) {
  return (
    <div className="stcc-fact">
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </div>
  )
}
function Pagination(input: {
  meta: { total: number; limit: number; offset: number; count: number } | undefined
  fetching: boolean
  onPrevious: () => void
  onNext: () => void
}) {
  if (!input.meta || input.meta.total === 0) return null
  const start = input.meta.offset + 1
  const end = input.meta.offset + input.meta.count
  const canGoPrevious = input.meta.offset > 0
  const canGoNext = end < input.meta.total
  return (
    <div className="stcc-pagination">
      <span>{start}-{end} / {input.meta.total}</span>
      <div>
        <Button type="button" variant="outline" disabled={!canGoPrevious || input.fetching} onClick={input.onPrevious}>
          Önceki
        </Button>
        <Button type="button" variant="outline" disabled={!canGoNext || input.fetching} onClick={input.onNext}>
          Sonraki
        </Button>
      </div>
    </div>
  )
}
function buildFilters(persona: StoreTasksPersona): Array<{ id: StoreTaskFilter; label: string }> {
  const base: Array<{ id: StoreTaskFilter; label: string }> = [
    { id: 'all', label: 'Tümü' },
    { id: 'checklist', label: 'Checklist' },
    { id: 'projection', label: 'Projeksiyon' },
  ]
  if (persona === 'regionManager') {
    return [
      ...base,
      { id: 'resolved', label: 'Çözüm bildirildi' },
      { id: 'cancelled', label: 'İptal edildi' },
    ]
  }
  return [
    ...base,
    { id: 'open', label: 'Açık' },
    { id: 'in_progress', label: 'İşlemde' },
    { id: 'blocked', label: 'Bloke' },
    { id: 'resolved', label: 'Çözüm bildirildi' },
  ]
}
function formatAccessRoleLabel(roleCodes: readonly string[]) {
  const labels: string[] = []
  for (const roleCode of roleCodes) {
    switch (roleCode) {
      case 'STORE_MANAGER':
        labels.push('Mağaza müdürü')
        break
      case 'REGION_MANAGER':
        labels.push('Bölge müdürü')
        break
      case 'SUPER_ADMIN':
        labels.push('Admin')
        break
      case 'REPORT_VIEWER':
        labels.push('Rapor kullanıcısı')
        break
    }
  }

  return labels.length > 0 ? labels.join(', ') : 'Rol bilgisi doğrulanamadı'
}
function renderSourceIcon(sourceGroup: StoreTaskCommandRow['sourceGroup']) {
  return sourceGroup === 'checklist' ? <ClipboardList aria-hidden="true" /> : <TrendingDown aria-hidden="true" />
}
function getSafeInAppPath(input: string | null | undefined) {
  if (!input || !input.startsWith('/') || input.startsWith('//')) return null
  for (let index = 0; index < input.length; index += 1) {
    const codePoint = input.charCodeAt(index)
    if (codePoint <= 31 || codePoint === 127) return null
  }
  return input
}
function mapUrgencyToPriority(urgency: StoreTaskCommandRow['priority']): StoreActionPlan['priority'] {
  switch (urgency) {
    case 'high':
      return 'high'
    case 'medium':
      return 'medium'
    case 'low':
      return 'low'
    default:
      return 'medium'
  }
}
async function invalidateStoreTaskQueries(queryClient: ReturnType<typeof useQueryClient>) {
  const keys = [['store-action-plans', 'store-tasks'], ['workflow-inbox']] as const
  await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}
