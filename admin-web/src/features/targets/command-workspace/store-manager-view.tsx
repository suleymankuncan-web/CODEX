import { getTargetStatusMeta } from './status'
import { StoreTargetHistory } from './store-target-history'
import { isDepartedForTarget } from './store-manager-model'
import { useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Check, CircleDollarSign, Clock3, Send, Target, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TargetMonthPicker } from './target-month-picker'
import { StoreOperationsHeader } from '@/pages/store-operations-layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  CommandCanvasPage,
  CommandCanvasPartialDataNotice,
} from '@/features/store-command-canvas/primitives'
import { useLocalization } from '@/features/localization/useLocalization'
import { actionToast } from '@/lib/action-toast'
import {
  createTargetDistributionRequest,
  getStoreTargetWorkspace,
  getTargetRevisionBasis,
  type TargetDistributionAllocation,
} from '../api'
import { flattenTargetStores, mergeTargetWorkspacePages } from './model'
import {
  createStoreTargetDraft,
  distributeTargetByDays,
  hasCompleteDistributionDays,
  isApprovedTargetMonth,
  sanitizeTargetMoneyInput,
  storeTargetDraftSummary,
  targetPrecisionUnits,
  withHistoricalTargetPersonnel,
} from './store-manager-model'
import type { TargetCommandWorkspace } from './types'
import './workspace.css'
import './store-manager.css'

export function StoreManagerTargetCommand(input: {
  workspace: TargetCommandWorkspace
  period: string
  onPeriodChange: (period: string) => void
  isUpdating: boolean
  backgroundError: Error | null
  onRetry: () => void
}) {
  const { locale } = useLocalization()
  const queryClient = useQueryClient()
  const [entryPeriod, setEntryPeriod] = useState(input.period)
  const [previewYear, setPreviewYear] = useState(Number(input.period.slice(0, 4)))
  const [draftState, setDraftState] = useState(() => ({
    identity: 'none',
    value: createStoreTargetDraft(null),
  }))
  const copy = locale === 'tr' ? tr : en
  const entryQuery = useQuery({
    queryKey: ['store-target-entry-workspace', entryPeriod, previewYear],
    queryFn: () =>
      getStoreTargetWorkspace({
        period: entryPeriod,
        historyYear: previewYear,
        limit: 50,
        offset: 0,
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
  const entryWorkspace = useMemo(
    () => (entryQuery.data ? mergeTargetWorkspacePages([entryQuery.data]) : null),
    [entryQuery.data],
  )
  const entrySectionsUnavailable = Boolean(
    entryWorkspace && Object.values(entryWorkspace.sections).some((section) => section.status === 'unavailable'),
  )
  const entryStore = entryWorkspace ? (flattenTargetStores(entryWorkspace)[0]?.store ?? null) : null
  const ambiguousStoreScope = (entryWorkspace?.pagination.total ?? 0) > 1
  const summary = input.workspace.summary
  const approvedCount = (summary?.approvedStores ?? 0) + (summary?.adjustedApprovedStores ?? 0)
  const pending = entryStore?.request?.status === 'pending_region_approval'
  const revisionBasis = useQuery({
    queryKey: ['target-revision-basis', 'command-canvas', entryStore?.storeId, entryPeriod],
    queryFn: () =>
      getTargetRevisionBasis({
        storeId: entryStore!.storeId,
        requestMonth: `${entryPeriod}-01`,
      }),
    enabled: Boolean(entryStore?.storeId),
    staleTime: 30_000,
  })
  const basisItems = useMemo(() => revisionBasis.data?.items ?? [], [revisionBasis.data])
  const editableStore = useMemo(() => withHistoricalTargetPersonnel(entryStore, basisItems), [basisItems, entryStore])
  const revision =
    isApprovedTargetMonth(entryStore, entryPeriod) ||
    entryStore?.request?.status === 'approved' ||
    basisItems.length > 0
  const basisIdentity = basisItems
    .map((item) => item.targetReferenceId)
    .sort()
    .join('|')
  const nextDraftIdentity = `${entryPeriod}:${entryStore?.storeId ?? 'none'}:${entryStore?.request?.requestId ?? 'none'}:${basisIdentity}`
  const authoritativeDraftReady =
    !entryQuery.isError &&
    !entryQuery.isPlaceholderData &&
    !entryQuery.isFetching &&
    !entrySectionsUnavailable &&
    revisionBasis.isSuccess &&
    !revisionBasis.isFetching &&
    Boolean(editableStore)
  const authoritativeDraft = authoritativeDraftReady
    ? createStoreTargetDraft(editableStore, basisItems, {
        clearRequestNote: revision,
        ...(revision ? { revisionPeriod: entryPeriod } : {}),
      })
    : null
  const draft = draftState.identity === nextDraftIdentity ? draftState.value : (authoritativeDraft ?? draftState.value)
  const updateDraft = (update: (current: typeof draft) => typeof draft) => {
    setDraftState((current) => ({
      identity: nextDraftIdentity,
      value: update(current.identity === nextDraftIdentity ? current.value : (authoritativeDraft ?? current.value)),
    }))
  }
  const draftSummary = storeTargetDraftSummary(editableStore, draft)
  const basisReady = revisionBasis.isSuccess && !revisionBasis.isFetching
  const revisionReady =
    !revision || Boolean(basisReady && basisItems.length && !revisionBasis.data?.periodClosed && draft.note.trim())
  const statusAllowsSubmission =
    entryStore?.status === 'missing' ||
    entryStore?.status === 'returned' ||
    entryStore?.status === 'approved' ||
    entryStore?.status === 'adjusted_approved'
  const formLocked =
    pending ||
    !statusAllowsSubmission ||
    entryQuery.isError ||
    entryQuery.isFetching ||
    entryQuery.isPlaceholderData ||
    entrySectionsUnavailable ||
    !basisReady
  const canSubmit = !ambiguousStoreScope && draftSummary.valid && hasCompleteDistributionDays(draft, editableStore?.personnel ?? []) && !formLocked && basisReady && revisionReady
  const mutation = useMutation({
    mutationFn: createTargetDistributionRequest,
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['store-target-workspace'] }),
        queryClient.invalidateQueries({
          queryKey: ['store-target-entry-workspace'],
        }),
      ])
      actionToast.success(result.command.message || copy.saved)
    },
    onError: (error) => actionToast.error(error, copy.failed),
  })
  const submit = () => {
    if (!editableStore || !canSubmit) return
    const allocations: TargetDistributionAllocation[] = editableStore.personnel
      .filter((person) => targetPrecisionUnits(draft.allocations[person.employeeId]) > 0)
      .map((person) => ({
        employeeId: person.employeeId,
        assigneeLabel: person.displayName,
        targetValue: targetPrecisionUnits(draft.allocations[person.employeeId]) / 10_000,
        distributionDays: Number(draft.distributionDays?.[person.employeeId] ?? 0),
      }))
    const basis = basisItems
    const finalIds = new Set(allocations.map((item) => item.employeeId))
    mutation.mutate({
      storeId: editableStore.storeId,
      requestMonth: `${entryPeriod}-01`,
      targetLabel: revision
        ? `${editableStore.request?.targetLabel ?? copy.defaultLabel} ${copy.revisionSuffix}`
        : copy.defaultLabel,
      totalTargetValue: draftSummary.totalUnits / 10_000,
      ...(draft.note.trim() ? { requestReason: draft.note.trim() } : {}),
      ...(revision
        ? {
            revision: {
              baseReferenceIds: basis.map((item) => item.targetReferenceId),
              removedEmployeeIds: basis.filter((item) => !finalIds.has(item.employeeId)).map((item) => item.employeeId),
            },
          }
        : {}),
      allocations,
    })
  }
  const partial =
    input.backgroundError !== null ||
    entryQuery.isError ||
    revisionBasis.isError ||
    Object.values(input.workspace.sections).some((section) => section.status === 'unavailable') ||
    entrySectionsUnavailable
  const retryScoped = () => {
    input.onRetry()
    void entryQuery.refetch()
    if (entryStore?.storeId) void revisionBasis.refetch()
  }

  return (
    <CommandCanvasPage ariaLabelledBy="store-targets-store-manager-title" className="target-store-manager-page">
      <StoreOperationsHeader
        icon={Target}
        titleId="store-targets-store-manager-title"
        eyebrow={copy.title}
        title={editableStore?.storeName ?? copy.title}
        description={copy.description}
        actions={
          <div className="target-command-period">
            {editableStore && <StoreTargetHistory storeId={editableStore.storeId} storeName={editableStore.storeName} period={entryPeriod} locale={locale} onSelect={period => { input.onPeriodChange(period); setEntryPeriod(period); setPreviewYear(Number(period.slice(0, 4))) }} />}
            <span className={`target-store-state is-${entryStore?.status ?? 'unknown'}`}>
              {entryStore?.status === 'approved' || entryStore?.status === 'adjusted_approved' ? <><Check size={13} aria-hidden="true" />{getTargetStatusMeta(locale)[entryStore.status].label}</> : storeStatusLabel(entryStore?.status, copy)}
            </span>
            <TargetMonthPicker
              triggerClassName="operations-period"
              ariaLabel={copy.viewedPeriod}
              onMonthPreview={(month) => setPreviewYear(month.getFullYear())}
              monthDescription={(month) => {
                const period = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
                const status = entryStore?.monthStatuses.find(item => item.period === period)
                return <p className="tw:m-0 tw:text-xs tw:text-muted-foreground">{status?.isApproved ? copy.approved : status?.status === 'pending' ? copy.pending : status?.status === 'returned' ? copy.returned : copy.missingStatus}</p>
              }}
              locale={locale}
              onValueChange={(period) => { input.onPeriodChange(period); setEntryPeriod(period); setPreviewYear(Number(period.slice(0, 4))) }}
              value={input.period}
            />
          </div>
        }
      />
      <div className="operations-metrics" role="group" aria-label={copy.summary}>
        {[
          { id: 'total', label: copy.totalTarget, value: formatMoney(summary?.totalTargetValue, locale), icon: CircleDollarSign },
          { id: 'approved', label: copy.approved, value: String(approvedCount), icon: BadgeCheck },
          { id: 'pending', label: copy.pending, value: String(summary?.pendingStores ?? 0), icon: Clock3 },
          { id: 'missing', label: copy.missing, value: String(summary?.missingStores ?? 0), icon: TriangleAlert },
        ].map(item => <div className="operations-metric command-canvas-metric" key={item.id}><span><item.icon aria-hidden="true" />{item.label}</span><strong>{item.value}</strong></div>)}
      </div>
      {input.isUpdating ? (
        <div aria-live="polite" className="target-store-update">
          {copy.updating}
        </div>
      ) : null}
      {partial ? (
        <CommandCanvasPartialDataNotice
          title={copy.partial}
          description={copy.partialCopy}
          retry={{ label: copy.retry, onClick: retryScoped }}
        />
      ) : null}
      {ambiguousStoreScope ? (
        <CommandCanvasPartialDataNotice title={copy.scopeAmbiguous} description={copy.scopeAmbiguousCopy} />
      ) : (
        <section className="target-store-distribution">

          {entryQuery.isPending && !entryWorkspace ? (
            <div className="target-store-message">{copy.loading}</div>
          ) : entryQuery.isError && !entryWorkspace ? (
            <div className="target-store-message">{copy.entryError}</div>
          ) : !editableStore ? (
            <div className="target-store-message">{copy.noStore}</div>
          ) : (
            <>
              {entryStore?.status === 'adjusted_approved' && <div className="target-store-approval-notice" role="status"><BadgeCheck size={20} aria-hidden="true"/><div><strong>{locale === 'tr' ? 'Bölge müdürü hedef dağılımını düzenleyerek onayladı.' : 'The region manager approved this distribution with adjustments.'}</strong>{entryStore.request?.approvalNote && <p>{locale === 'tr' ? 'Onay notu: ' : 'Approval note: '}{entryStore.request.approvalNote}</p>}</div></div>}
              <div className="target-store-allocations">
              <div className="target-store-position-reference">
                <div>
                  <strong>Pozisyona göre örnek günler</strong>
                  <ul aria-label="Pozisyonlara göre örnek hedef dağıtım günleri">
                    <li><span>Mağaza Müdürü</span><b>0 gün</b></li>
                    <li><span>Mağaza Müdür Yardımcısı</span><b>22 gün</b></li>
                    <li><span>Uzman Satış Danışmanı</span><b>30 gün</b></li>
                    <li><span>Satış Danışmanı</span><b>26 gün</b></li>
                    <li><span>Kasa Sorumlusu</span><b>10 gün</b></li>
                    <li><span>Depo Sorumlusu</span><b>10 gün</b></li>
                  </ul>
                  <small>Örnek değerlerdir; günleri mağaza müdürü belirler.</small>
                </div>
              </div>
              <div className="target-store-distribution-guide">
              <div className="target-store-balance-grid">
                <label>
                  <span>{copy.storeTarget}</span>
                  <span className="target-store-money-input">
                    <Input
                      aria-label={copy.storeTarget}
                      disabled={formLocked || revision}
                      inputMode="decimal"
                      value={draft.total}
                      onChange={(event) =>
                        updateDraft((current) => distributeTargetByDays({
                          ...current,
                          total: sanitizeTargetMoneyInput(event.target.value),
                        }, editableStore.personnel))
                      }
                    />
                    <b>TL</b>
                  </span>
                  <small>{revision ? 'Onaylı mağaza hedefi' : 'Günleri girdikçe personel hedefleri hesaplanır.'}</small>
                </label>
                <div>
                  <small>{copy.distributed}</small>
                  <strong>{formatMoney(draftSummary.allocationUnits / 10_000, locale)}</strong>
                  <span>
                    {draftSummary.totalUnits > 0
                      ? `%${Math.round((draftSummary.allocationUnits / draftSummary.totalUnits) * 100)}`
                      : '%0'}
                  </span>
                </div>
                <div
                  data-tone={
                    draftSummary.balanceUnits === 0 ? 'good' : draftSummary.balanceUnits < 0 ? 'danger' : 'warning'
                  }
                >
                  <small>{copy.balance}</small>
                  <strong>{formatMoney(draftSummary.balanceUnits / 10_000, locale)}</strong>
                  <span>
                    {draftSummary.balanceUnits === 0
                      ? copy.complete
                      : draftSummary.balanceUnits < 0
                        ? copy.exceeded
                        : copy.mustDistribute}
                  </span>
                </div>
              </div>

              </div>
                {Object.values(draft.fixedSales ?? {}).some(value => value === null || Number(value) < 0) && <p role="alert">Ayrılan personelin satış verisi eksik veya negatif. Revizyon göndermeden önce satış verilerini kontrol edin.</p>}
                <div className={`target-store-allocation-head${revision ? ' is-revision' : ''}`}>
                  <span>İsim</span>
                  <span>Pozisyon</span>
                  <span>Hedef dağıtım günü</span>
                  <span>Gerçekleşen satış</span>
                  {revision && <span>Önceki hedef</span>}
                  <span>{revision ? 'Yeni hedef' : copy.monthlyTarget}</span>
                  <span>{copy.share}</span>
                </div>
                {editableStore.personnel.length ? (
                  editableStore.personnel.map((person) => {
                    const value = draft.allocations[person.employeeId] ?? ''
                    const previousTarget = basisItems.find(item => item.employeeId === person.employeeId)?.targetValue ?? 0
                    const difference = (targetPrecisionUnits(value) - targetPrecisionUnits(previousTarget)) / 10000
                    return (
                      <div className={`target-store-allocation-row${revision ? ' is-revision' : ''}`} key={person.employeeId}>
                        <span className="target-person-name">
                          <strong>{person.displayName}</strong>
                          {isDepartedForTarget(person.terminationDate, entryPeriod) ? (
                            <small className="target-person-departed">İşten ayrıldı</small>
                          ) : person.hireDate?.slice(0, 7) === entryPeriod ? (
                            <small className="target-person-new">Yeni Personel</small>
                          ) : null}
                        </span>
                        <span className="target-store-person-position">{person.positionLabel ?? '—'}</span>
                        <label className="target-store-money-input">
                          <Input
                            aria-label={`${person.displayName} hedef dağıtım günü`}
                            type="number" min={0} step={1}
                            disabled={formLocked || person.employeeId in (draft.fixedSales ?? {})}
                            inputMode="decimal"
                            value={draft.distributionDays?.[person.employeeId] ?? ''}
                            onChange={(event) =>
                              updateDraft((current) => distributeTargetByDays({
                                ...current,
                                distributionDays: {
                                  ...current.distributionDays,
                                  [person.employeeId]: event.target.value,
                                },
                              }, editableStore.personnel))
                            }
                          />
                          <b>gün</b>
                        </label>
                        <strong>{person.actualSales == null ? '—' : formatMoney(person.actualSales, locale)}</strong>
                        {revision && <span className="target-previous-value"><small className="target-mobile-heading">Önceki hedef</small><strong>{formatMoney(previousTarget, locale)}</strong></span>}
                        <span className="target-next-value">
                          {revision && <small className="target-mobile-heading">Yeni hedef</small>}
                          <strong>{formatMoney(value, locale)}</strong>
                          {revision && <small className={`target-difference ${difference > 0 ? 'is-positive' : difference < 0 ? 'is-negative' : ''}`}>
                            {difference === 0 ? 'Değişmedi' : `${difference > 0 ? '+' : '−'}${formatMoney(Math.abs(difference), locale)}`}
                          </small>}
                          {person.employeeId in (draft.fixedSales ?? {}) && <small>Satış tutarına sabitlendi</small>}
                        </span>
                        <span>
                          <strong>
                            {draftSummary.totalUnits > 0
                              ? `%${Math.round((targetPrecisionUnits(value) / draftSummary.totalUnits) * 100)}`
                              : '%0'}
                          </strong>
                          <small>{entryPeriod}</small>
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <div className="target-store-allocation-empty">{copy.noPersonnel}</div>
                )}
              </div>
              {revision && editableStore.request?.requestReason ? (
                <div className="target-store-origin-note">
                  <small>{copy.originalNote}</small>
                  <p>{editableStore.request.requestReason}</p>
                </div>
              ) : null}
              <label className="target-store-note">
                <Label htmlFor="target-store-note">{revision ? copy.revisionNote : copy.note}</Label>
                <Textarea
                  disabled={formLocked}
                  id="target-store-note"
                  placeholder={revision ? copy.revisionNotePlaceholder : copy.notePlaceholder}
                  value={draft.note}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                />
                <small>{revision ? copy.revisionRequired : copy.noteHelp}</small>
              </label>
              <footer>
                <div>
                  <strong>
                    {pending
                      ? copy.pending
                      : canSubmit
                        ? revision
                          ? copy.revisionReady
                          : copy.ready
                        : copy.balanceRequired}
                  </strong>
                  <span>{pending ? copy.pendingHelp : canSubmit ? copy.readyHelp : copy.balanceHelp}</span>
                </div>
                <Button disabled={!canSubmit || mutation.isPending} onClick={submit}>
                  <Send />
                  {mutation.isPending ? copy.saving : pending ? copy.pending : revision ? copy.sendRevision : copy.send}
                </Button>
              </footer>
            </>
          )}
        </section>
      )}
    </CommandCanvasPage>
  )
}
function formatMoney(value: string | number | null | undefined, locale: 'tr' | 'en') {
  return value === null || value === undefined || value === ''
    ? '—'
    : new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      }).format(Number(value))
}

function storeStatusLabel(
  status: TargetCommandWorkspace['companies'][number]['regions'][number]['stores'][number]['status'] | undefined,
  copy: Pick<
    Record<keyof typeof tr, string>,
    'approved' | 'pending' | 'returned' | 'stale' | 'conflict' | 'missingStatus' | 'unknown' | 'draft'
  >,
) {
  if (status === 'approved' || status === 'adjusted_approved') return copy.approved
  if (status === 'pending') return copy.pending
  if (status === 'returned') return copy.returned
  if (status === 'stale_reference') return copy.stale
  if (status === 'revision_conflict') return copy.conflict
  if (status === 'missing') return copy.missingStatus
  if (status === 'unknown') return copy.unknown
  return copy.draft
}

const tr = {
  eyebrow: 'Store · Hedefler',
  title: 'Mağaza Hedef Dağılımı',
  description: 'Mağaza hedefini personele dağıtın ve onaya gönderin.',
  viewedPeriod: 'Görüntülenen dönem',
  summary: 'Hedef özeti',
  totalTarget: 'Toplam hedef',
  approved: 'Onaylanan',
  completed: 'Kararı tamamlanan',
  pending: 'Onay bekleyen',
  awaitingDecision: 'Gönderildi · karar bekliyor',
  missing: 'Hedef bekleniyor',
  notSubmitted: 'Henüz gönderilmedi',
  partial: 'Bazı hedef bilgileri eksik',
  partialCopy: 'Kullanılabilen veriler gösteriliyor.',
  retry: 'Tekrar dene',
  updating: 'Dönem verileri güncelleniyor…',
  entryError: 'Hedef giriş dönemi yüklenemedi. Tekrar deneyin.',
  scopeAmbiguous: 'Mağaza kapsamı doğrulanamadı',
  scopeAmbiguousCopy:
    'Mağaza müdürü hedef işlemi için tek bir yetkili mağaza beklenir. Kapsam düzeltilmeden hedef gönderilemez.',
  draft: 'Dağıtım taslağı',
  returned: 'İade edildi',
  stale: 'Referans güncel değil',
  conflict: 'Revizyon çakışması',
  unknown: 'Durum doğrulanamadı',
  missingStatus: 'Hedef bekleniyor',
  store: 'Mağaza',
  personnelDistribution: 'personel hedef dağılımı',
  loading: 'Hedef dönemi yükleniyor…',
  noStore: 'Yetkili mağaza kaydı bulunamadı.',
  storeTarget: 'Toplam mağaza hedefi',
  targetLimit: 'Girdiğiniz tutar dağıtım günlerine göre otomatik paylaştırılır',
  distributed: 'Dağıtılan',
  balance: 'Kalan bakiye',
  complete: 'Dağılım tamamlandı',
  exceeded: 'Hedef aşıldı',
  mustDistribute: 'Personele dağıtılmalı',
  personnel: 'Personel',
  noPersonnel: 'Hedef girilebilecek aktif personel bulunmuyor.',
  monthlyTarget: 'Aylık hedef',
  share: 'Toplam payı',
  note: 'Onay notu',
  notePlaceholder: 'Bölge müdürünün görmesi gereken açıklama (opsiyonel)',
  noteHelp: 'Bu not hedef paketiyle birlikte bölge müdürüne gönderilir.',
  revisionNote: 'Revizyon notu',
  originalNote: 'Önceki talep notu',
  revisionNotePlaceholder: 'Revizyon gerekçesini yazın',
  revisionRequired: 'Onaylı hedef revizyonunda gerekçe zorunludur.',
  ready: 'Dağılım onaya hazır',
  revisionReady: 'Revizyon onaya hazır',
  balanceRequired: 'Hedef tutarını ve dağıtım günlerini girin',
  pendingHelp: 'Bölge müdürü kararı bekleniyor.',
  readyHelp: 'Toplam mağaza hedefi personel hedefleriyle eşleşiyor.',
  balanceHelp: 'Her personele dağıtım günü girin. En az bir personelin günü sıfırdan büyük olmalıdır.',
  send: 'Onaya gönder',
  sendRevision: 'Revizyonu gönder',
  saving: 'Gönderiliyor',
  saved: 'Hedef paketi kaydedildi.',
  failed: 'Hedef kaydedilemedi.',
  defaultLabel: 'Aylık personel hedef dağıtımı',
  revisionSuffix: 'revize',
} as const
const en: Record<keyof typeof tr, string> = {
  eyebrow: 'Store · Targets',
  title: 'Store Target Distribution',
  description: 'Distribute the store target and submit it for approval.',
  viewedPeriod: 'Viewed period',
  summary: 'Target summary',
  totalTarget: 'Total target',
  approved: 'Approved',
  completed: 'Decision completed',
  pending: 'Awaiting approval',
  awaitingDecision: 'Submitted · awaiting decision',
  missing: 'Target awaited',
  notSubmitted: 'Not submitted yet',
  partial: 'Some target data is unavailable',
  partialCopy: 'Available data remains visible.',
  retry: 'Retry',
  updating: 'Period data is updating…',
  entryError: 'The target-entry period could not be loaded. Retry.',
  scopeAmbiguous: 'Store scope could not be verified',
  scopeAmbiguousCopy:
    'A Store Manager target action requires exactly one authorized store. Submission is unavailable until scope is corrected.',
  draft: 'Distribution draft',
  returned: 'Returned',
  stale: 'Reference is stale',
  conflict: 'Revision conflict',
  unknown: 'Status unavailable',
  missingStatus: 'Target awaited',
  store: 'Store',
  personnelDistribution: 'personnel target distribution',
  loading: 'Loading target period…',
  noStore: 'No authorized store record found.',
  storeTarget: 'Total store target',
  targetLimit: 'Upper limit for personnel targets',
  distributed: 'Distributed',
  balance: 'Remaining balance',
  complete: 'Distribution complete',
  exceeded: 'Target exceeded',
  mustDistribute: 'Must be distributed',
  personnel: 'Personnel',
  noPersonnel: 'No active personnel are eligible for a target.',
  monthlyTarget: 'Monthly target',
  share: 'Total share',
  note: 'Approval note',
  notePlaceholder: 'Optional context for the Region Manager',
  noteHelp: 'This note is sent with the target package.',
  revisionNote: 'Revision note',
  originalNote: 'Previous request note',
  revisionNotePlaceholder: 'Explain the revision',
  revisionRequired: 'A reason is required for an approved target revision.',
  ready: 'Ready for approval',
  revisionReady: 'Revision ready for approval',
  balanceRequired: 'Balance must be zero',
  pendingHelp: 'Awaiting the Region Manager decision.',
  readyHelp: 'The store target matches personnel targets.',
  balanceHelp: 'Enter a positive target for every person and clear the balance.',
  send: 'Submit for approval',
  sendRevision: 'Submit revision',
  saving: 'Submitting',
  saved: 'Target package saved.',
  failed: 'Target could not be saved.',
  defaultLabel: 'Monthly personnel target distribution',
  revisionSuffix: 'revision',
}
