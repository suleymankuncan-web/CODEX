import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog as DialogPrimitive } from 'radix-ui'
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Plus,
  Search,
  X,
} from 'lucide-react'
import type { AuthSessionSummary } from '../auth/api'
import {
  storeChecklistCommandQueryKey,
  storeChecklistVisitPlanQueryKey,
} from '../auth/store-query-scope'
import { actionToast } from '../../lib/action-toast'
import { getUserFacingErrorMessage } from '../../lib/format'
import { transientQueryRetryOptions } from '../../lib/query-retry'
import {
  getAllChecklistCommandRowsForRegion,
  getChecklistVisitPlan,
  saveChecklistVisitPlan,
  type ChecklistCommandRow,
  type ChecklistVisitPlan,
} from './api'
import {
  buildChecklistPlanningDays,
  buildVisitPlanDraftFingerprint,
  shiftChecklistWeek,
  type VisitPlanDraftItem,
} from './model'

type Copy = ReturnType<typeof getCopy>

export function ChecklistWeeklyVisitPlanner(input: {
  authSummary: AuthSessionSummary | null
  canMaintain: boolean
  locale: 'tr' | 'en'
  period: string
  regionId: string
  regionName: string
  weekStart: string
  onOpenWorkflow: (storeId: string) => void
  onWeekStartChange: (weekStart: string) => void
}) {
  const queryClient = useQueryClient()
  const [planningOpen, setPlanningOpen] = useState(false)
  const copy = getCopy(input.locale)
  const planKey = storeChecklistVisitPlanQueryKey(input.authSummary, input.regionId, input.weekStart)
  const planQuery = useQuery({
    queryKey: planKey,
    queryFn: () => getChecklistVisitPlan({ regionId: input.regionId, weekStart: input.weekStart }),
    ...transientQueryRetryOptions,
  })
  const storesQuery = useQuery({
    queryKey: storeChecklistCommandQueryKey(input.authSummary, {
      period: input.period,
      regionId: input.regionId,
      purpose: 'weekly-planner-store-picker',
    }),
    queryFn: () => getAllChecklistCommandRowsForRegion({ period: input.period, regionId: input.regionId }),
    enabled: planningOpen && input.canMaintain,
    ...transientQueryRetryOptions,
  })
  const saveMutation = useMutation({
    mutationFn: (items: VisitPlanDraftItem[]) =>
      saveChecklistVisitPlan({
        regionId: input.regionId,
        weekStart: input.weekStart,
        body: {
          expectedRevision: planQuery.data?.data.revision ?? 0,
          idempotencyKey: createIdempotencyKey(),
          items: normalizeDraft(items),
        },
      }),
    onSuccess: async (response) => {
      queryClient.setQueryData(planKey, response)
      await queryClient.invalidateQueries({ queryKey: ['checklist-command'] })
      actionToast.success(copy.saved)
    },
    onError: (error) => actionToast.error(error, copy.saveFailed),
  })

  if (planQuery.isLoading) {
    return <section className="week-planner week-planner-state"><Clock3 size={18} /><strong>{copy.loading}</strong></section>
  }
  if (planQuery.isError || !planQuery.data) {
    return <section className="week-planner week-planner-state"><CircleAlert size={18} /><strong>{copy.loadFailed}</strong><button type="button" onClick={() => void planQuery.refetch()}>{copy.retry}</button></section>
  }

  const plan = planQuery.data.data
  const days = buildChecklistPlanningDays(plan.weekStart, input.locale)
  const metrics = countStatuses(plan)
  const firstDay = days[0]
  const lastDay = days.at(-1)
  const weekLabel = firstDay && lastDay
    ? `${firstDay.dateLabel} – ${lastDay.dateLabel} ${plan.weekStart.slice(0, 4)}`
    : plan.weekStart

  return (
    <>
      <section className="checklist-plan-metrics" aria-label={copy.summary}>
        <PlanMetric icon={CircleAlert} label={copy.missed} tone="missed" value={metrics.missed} />
        <PlanMetric icon={Clock3} label={copy.waiting} tone="waiting" value={metrics.waiting} />
        <PlanMetric icon={CheckCircle2} label={copy.completed} tone="completed" value={metrics.completed} />
      </section>
      <section className="week-planner" aria-labelledby="week-planner-title">
        <header className="week-planner-header">
          <div>
            <span className="week-planner-icon"><CalendarDays size={16} /></span>
            <span><small>{copy.weeklyPlan}</small><strong id="week-planner-title">{copy.placeVisits}</strong></span>
          </div>
          <div className="week-planner-actions">
            <div className="week-planner-range">
              <button type="button" aria-label={copy.previousWeek} onClick={() => input.onWeekStartChange(shiftChecklistWeek(input.weekStart, -1))}><ChevronLeft size={14} /></button>
              <span><strong>{weekLabel}</strong><small>{copy.visitCount(plan.items.length)}</small></span>
              <button type="button" aria-label={copy.nextWeek} onClick={() => input.onWeekStartChange(shiftChecklistWeek(input.weekStart, 1))}><ChevronRight size={14} /></button>
            </div>
            {plan.capabilities.canMaintainWeeklyVisitPlan ? (
              <button type="button" className="week-planner-primary" onClick={() => setPlanningOpen(true)}><CalendarDays size={14} /> {copy.planWeek}</button>
            ) : null}
          </div>
        </header>
        <div className="week-planner-grid">
          {days.map((day) => {
            const items = plan.items.filter((item) => item.plannedDate === day.isoDate)
            return (
              <article className="week-day" key={day.isoDate}>
                <header><span><strong>{day.dayLabel}</strong><small>{day.dateLabel}</small></span><b>{items.length}</b></header>
                <div className="week-day-visits">
                  {items.length === 0 ? <span className="week-day-empty">{copy.noVisit}</span> : items.map((item) => {
                    const presentation = getStatusPresentation(item.status, copy)
                    const Icon = presentation.icon
                    return (
                      <button type="button" className={`week-visit week-visit--${item.status}`} key={item.planItemId} onClick={() => input.onOpenWorkflow(item.storeId)}>
                        <span className="week-visit-main"><strong>{item.storeName}</strong><small>{item.storeCode} · {plan.regionName}</small></span>
                        <span className={`week-visit-outcome week-visit-outcome--${item.status}`}><Icon size={11} />{presentation.label}</span>
                      </button>
                    )
                  })}
                </div>
              </article>
            )
          })}
        </div>
      </section>
      {planningOpen ? (
        <WeeklyPlanDialog
          copy={copy}
          days={days}
          initialPlan={plan}
          locale={input.locale}
          saveError={saveMutation.isError ? getUserFacingErrorMessage(saveMutation.error, copy.saveFailed) : null}
          saving={saveMutation.isPending}
          stores={storesQuery.data ?? []}
          storesError={storesQuery.isError}
          storesLoading={storesQuery.isLoading}
          onClose={() => { saveMutation.reset(); setPlanningOpen(false) }}
          onRetryStores={() => void storesQuery.refetch()}
          onSave={async (items) => { await saveMutation.mutateAsync(items); setPlanningOpen(false) }}
        />
      ) : null}
    </>
  )
}

function PlanMetric(input: { icon: typeof Clock3; label: string; tone: string; value: number }) {
  const Icon = input.icon
  return <article className={`checklist-plan-metric tone-${input.tone}`}><span><Icon size={15} /></span><small>{input.label}</small><strong>{input.value}</strong></article>
}

function WeeklyPlanDialog(input: {
  copy: Copy
  days: ReturnType<typeof buildChecklistPlanningDays>
  initialPlan: ChecklistVisitPlan
  locale: 'tr' | 'en'
  saveError: string | null
  saving: boolean
  stores: ChecklistCommandRow[]
  storesError: boolean
  storesLoading: boolean
  onClose: () => void
  onRetryStores: () => void
  onSave: (items: VisitPlanDraftItem[]) => Promise<void>
}) {
  const initialDraft = useMemo(() => input.initialPlan.items.map((item) => ({
    storeId: item.storeId,
    plannedDate: item.plannedDate,
    displayOrder: item.displayOrder,
  })), [input.initialPlan])
  const [dayIndex, setDayIndex] = useState(0)
  const [query, setQuery] = useState('')
  const [drafts, setDrafts] = useState(initialDraft)
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const selectedDay = input.days[dayIndex]
  const dirty = buildVisitPlanDraftFingerprint(initialDraft) !== buildVisitPlanDraftFingerprint(drafts)
  const normalizedQuery = query.trim().toLocaleLowerCase(input.locale === 'tr' ? 'tr-TR' : 'en-US')
  const stores = normalizedQuery ? input.stores.filter((store) => [store.storeName, store.storeCode, store.regionName].some((value) => value.toLocaleLowerCase(input.locale === 'tr' ? 'tr-TR' : 'en-US').includes(normalizedQuery))) : input.stores
  const requestClose = () => dirty ? setConfirmDiscard(true) : input.onClose()
  const addStore = (storeId: string) => {
    if (!selectedDay || drafts.some((item) => item.storeId === storeId && item.plannedDate === selectedDay.isoDate)) return
    const next = { storeId, plannedDate: selectedDay.isoDate, displayOrder: drafts.length }
    setDrafts((current) => [...current, next])
    setRecentlyAdded(`${storeId}:${selectedDay.isoDate}`)
    setQuery('')
  }
  const updateDay = (index: number, plannedDate: string) => setDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, plannedDate } : item))
  const removeDraft = (index: number) => setDrafts((current) => current.filter((_item, itemIndex) => itemIndex !== index))

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) requestClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="week-plan-dialog-backdrop" />
        <DialogPrimitive.Content className="week-plan-dialog" aria-describedby={undefined} onEscapeKeyDown={(event) => { if (dirty) { event.preventDefault(); setConfirmDiscard(true) } }}>
          <header><div><span className="week-planner-icon"><CalendarDays size={16} /></span><span><small>{input.copy.weeklyPlanning}</small><DialogPrimitive.Title>{input.copy.createPlan}</DialogPrimitive.Title></span></div><button type="button" aria-label={input.copy.close} onClick={requestClose}><X size={17} /></button></header>
          <div className="week-plan-dialog-days" aria-label={input.copy.visitDay}>{input.days.map((day, index) => <button type="button" className={dayIndex === index ? 'is-active' : ''} aria-label={`${day.dayLabel}, ${day.dateLabel}`} aria-pressed={dayIndex === index} key={day.isoDate} onClick={() => setDayIndex(index)}><strong>{day.shortLabel}</strong><small>{day.dateLabel}</small></button>)}</div>
          <main className="week-plan-workspace">
            <section className="week-plan-picker">
              <label className="week-plan-search"><Search size={16} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={input.copy.searchStore} /><kbd>/</kbd></label>
              <div className="week-plan-assignment-bar"><span><small>{input.copy.addDay}</small><strong>{selectedDay ? `${selectedDay.dayLabel} · ${selectedDay.dateLabel}` : input.copy.chooseDay}</strong></span><span><small>{input.copy.planOwner}</small><strong>{input.initialPlan.regionName}</strong></span></div>
              <div className="week-plan-results-title"><span><strong>{input.copy.stores}</strong><small>{input.copy.suitableStores(stores.length)}</small></span><b>{input.copy.chooseStore}</b></div>
              <div className="week-plan-results">
                {input.storesLoading ? <PlannerState label={input.copy.loadingStores} /> : input.storesError ? <PlannerState label={input.copy.storeLoadFailed} action={input.copy.retry} onAction={input.onRetryStores} /> : stores.length === 0 ? <PlannerState label={input.copy.noStores} /> : stores.map((store) => {
                  const planned = Boolean(selectedDay && drafts.some((item) => item.storeId === store.storeId && item.plannedDate === selectedDay.isoDate))
                  return <article className="week-plan-result-row" key={store.storeId}><span><strong>{store.storeName}</strong><small>{store.storeCode} · {store.regionName}</small></span><b className={`plan-risk plan-risk--${getRiskTone(store)}`}>{getRiskLabel(store, input.copy)}</b><button type="button" aria-label={planned ? input.copy.storeAddedLabel(store.storeName, selectedDay?.dayLabel ?? '') : input.copy.addStoreLabel(store.storeName, selectedDay?.dayLabel ?? '')} disabled={planned} onClick={() => addStore(store.storeId)}>{planned ? <Check size={13} /> : <Plus size={13} />}{planned ? input.copy.added : input.copy.add}</button></article>
                })}
              </div>
            </section>
            <aside className="week-plan-draft"><header><span><strong>{input.copy.weeklyDraft}</strong><small>{input.copy.notApplied}</small></span><b>{drafts.length}</b></header><div>{drafts.length === 0 ? <PlannerState label={input.copy.noDraft} /> : drafts.map((draft, index) => {
              const store = input.stores.find((candidate) => candidate.storeId === draft.storeId) ?? input.initialPlan.items.find((candidate) => candidate.storeId === draft.storeId)
              if (!store) return null
              return <article className={recentlyAdded === `${draft.storeId}:${draft.plannedDate}` ? 'is-recent' : ''} key={`${draft.storeId}:${draft.plannedDate}:${index}`}><header><span><strong>{store.storeName}</strong><small>{store.storeCode}</small></span><button type="button" aria-label={input.copy.removeStore(store.storeName)} onClick={() => removeDraft(index)}><X size={13} /></button></header><label><span>{input.copy.day}</span><select value={draft.plannedDate} onChange={(event) => updateDay(index, event.target.value)}>{input.days.map((day) => <option key={day.isoDate} value={day.isoDate} disabled={drafts.some((candidate, candidateIndex) => candidateIndex !== index && candidate.storeId === draft.storeId && candidate.plannedDate === day.isoDate)}>{day.shortLabel} · {day.dateLabel}</option>)}</select></label></article>
            })}</div></aside>
          </main>
          <footer className="week-plan-dialog-footer"><button type="button" onClick={requestClose}>{input.copy.cancel}</button><span><strong>{input.copy.visitTotal(drafts.length)}</strong><small>{dirty ? input.copy.unsaved : input.copy.current}</small></span><button type="button" className="week-plan-submit" disabled={!dirty || input.saving} onClick={() => void input.onSave(drafts)}><Check size={14} />{input.saving ? input.copy.saving : input.copy.save}</button>{input.saveError ? <p role="alert">{input.saveError}</p> : null}</footer>
          {confirmDiscard ? <div className="week-plan-discard" role="alertdialog" aria-modal="true"><section><span className="week-planner-icon"><CircleAlert size={16} /></span><h3>{input.copy.discardTitle}</h3><p>{input.copy.discardCopy}</p><div><button type="button" onClick={() => setConfirmDiscard(false)}>{input.copy.returnToPlan}</button><button type="button" className="danger" onClick={input.onClose}>{input.copy.discard}</button></div></section></div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function PlannerState(input: { label: string; action?: string; onAction?: () => void }) {
  return <div className="week-plan-no-results"><Search size={18} /><strong>{input.label}</strong>{input.action ? <button type="button" onClick={input.onAction}>{input.action}</button> : null}</div>
}

function countStatuses(plan: ChecklistVisitPlan) {
  return plan.items.reduce((counts, item) => ({ ...counts, [item.status]: counts[item.status] + 1 }), { waiting: 0, missed: 0, completed: 0 })
}

function getStatusPresentation(status: ChecklistVisitPlan['items'][number]['status'], copy: Copy) {
  if (status === 'completed') return { label: copy.completedVisit, icon: CheckCircle2 }
  if (status === 'missed') return { label: copy.checklistMissed, icon: CircleAlert }
  return { label: copy.waitingVisit, icon: Clock3 }
}

function getRiskTone(row: ChecklistCommandRow) { return row.status === 'needs_visit' ? 'high' : row.status === 'completed' ? 'low' : 'medium' }
function getRiskLabel(row: ChecklistCommandRow, copy: Copy) { return row.status === 'needs_visit' ? copy.high : row.status === 'completed' ? copy.noAction : copy.following }
function normalizeDraft(items: VisitPlanDraftItem[]) { return [...items].sort((a, b) => a.plannedDate.localeCompare(b.plannedDate) || a.displayOrder - b.displayOrder).map((item, index) => ({ ...item, displayOrder: index })) }
function createIdempotencyKey() { return crypto.randomUUID() }

function getCopy(locale: 'tr' | 'en') {
  return locale === 'tr' ? {
    add: 'Takvime ekle', added: 'Bu güne eklendi', addDay: 'Takvime eklenecek gün', addStoreLabel: (name: string, day: string) => `${name} mağazasını ${day} gününe ekle`, cancel: 'Vazgeç', checklistMissed: 'Checklist yapılmadı', chooseDay: 'Gün seçin', chooseStore: 'Eklemek için mağazayı seçin', close: 'Kapat', completed: 'Tamamlanan', completedVisit: 'Ziyaret Tamamlandı', createPlan: 'Ziyaret planını oluşturun', current: 'Plan güncel', day: 'Gün', discard: 'Taslağı sil', discardCopy: 'Haftalık taslak henüz kaydedilmedi.', discardTitle: 'Değişiklikler kaybolsun mu?', following: 'Aksiyon Takipte', high: 'Yüksek', loadFailed: 'Ziyaret planı yüklenemedi.', loading: 'Ziyaret planı yükleniyor', loadingStores: 'Mağazalar yükleniyor', missed: 'Checklist yapılmadı', nextWeek: 'Sonraki hafta', noAction: 'Aksiyon Yok', noDraft: 'Henüz ziyaret yok', noStores: 'Mağaza bulunamadı', noVisit: 'Planlanan ziyaret yok', notApplied: 'Kaydetmeden plana yansımaz', placeVisits: 'Saha ziyaretlerini günlere yerleştirin', planOwner: 'Plan kapsamı', planWeek: 'Haftayı Planla', previousWeek: 'Önceki hafta', removeStore: (name: string) => `${name} ziyaretini taslaktan kaldır`, retry: 'Tekrar dene', returnToPlan: 'Planlamaya dön', save: 'Ziyaret Planını Kaydet', saveFailed: 'Ziyaret planı kaydedilemedi.', saved: 'Ziyaret planı kaydedildi', saving: 'Kaydediliyor', searchStore: 'Mağaza ara', storeAddedLabel: (name: string, day: string) => `${name} mağazası ${day} planında`, storeLoadFailed: 'Mağazalar yüklenemedi', stores: 'Mağazalar', suitableStores: (count: number) => `${count} uygun mağaza`, summary: 'Haftalık ziyaret planı özeti', unsaved: 'Kaydedilmemiş değişiklik var', visitCount: (count: number) => `${count} ziyaret · Pazar plan dışı`, visitDay: 'Ziyaret günü', visitTotal: (count: number) => `${count} ziyaret`, waiting: 'Bekleyen', waitingVisit: 'Ziyaret Bekleniyor', weeklyDraft: 'Haftalık taslak', weeklyPlan: 'HAFTALIK PLAN', weeklyPlanning: 'HAFTALIK PLANLAMA',
  } : {
    add: 'Add to calendar', added: 'Added to this day', addDay: 'Day to add', addStoreLabel: (name: string, day: string) => `Add ${name} to ${day}`, cancel: 'Cancel', checklistMissed: 'Checklist not completed', chooseDay: 'Choose a day', chooseStore: 'Choose a store to add', close: 'Close', completed: 'Completed', completedVisit: 'Visit Completed', createPlan: 'Create the visit plan', current: 'Plan is current', day: 'Day', discard: 'Discard draft', discardCopy: 'The weekly draft has not been saved.', discardTitle: 'Discard changes?', following: 'Action in progress', high: 'High', loadFailed: 'Visit plan could not be loaded.', loading: 'Loading visit plan', loadingStores: 'Loading stores', missed: 'Checklist not completed', nextWeek: 'Next week', noAction: 'No Action', noDraft: 'No visits yet', noStores: 'No stores found', noVisit: 'No planned visit', notApplied: 'Changes apply only after saving', placeVisits: 'Place field visits on days', planOwner: 'Plan scope', planWeek: 'Plan the Week', previousWeek: 'Previous week', removeStore: (name: string) => `Remove ${name} from draft`, retry: 'Try again', returnToPlan: 'Return to planning', save: 'Save Visit Plan', saveFailed: 'Visit plan could not be saved.', saved: 'Visit plan saved', saving: 'Saving', searchStore: 'Search stores', storeAddedLabel: (name: string, day: string) => `${name} is planned for ${day}`, storeLoadFailed: 'Stores could not be loaded', stores: 'Stores', suitableStores: (count: number) => `${count} eligible stores`, summary: 'Weekly visit plan summary', unsaved: 'There are unsaved changes', visitCount: (count: number) => `${count} visits · Sunday excluded`, visitDay: 'Visit day', visitTotal: (count: number) => `${count} visits`, waiting: 'Waiting', waitingVisit: 'Visit Waiting', weeklyDraft: 'Weekly draft', weeklyPlan: 'WEEKLY PLAN', weeklyPlanning: 'WEEKLY PLANNING',
  }
}
