import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ReceiptText, TimerReset } from 'lucide-react'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusPill,
  type Tone,
} from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  canApproveTargetDistributionRequest,
  getAssignedStoreIds,
} from '../features/auth/authorization'
import {
  approveTargetDistributionRequest,
  getTargetCoverage,
  getTargetDistributionRequests,
  type TargetCoverageRow,
  type TargetDistributionRequest,
} from '../features/targets/api'
import {
  mapInboxStatusTone,
  mapWorkflowUrgencyTone,
  toTargetApprovalInboxItem,
} from '../features/workflow/contracts'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { formatDate, formatDateTime, formatNumber, formatState, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'

export function TargetApprovalQueuePage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { locale, t } = useLocalization()
  const queryClient = useQueryClient()
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({})
  const [approvalNotice, setApprovalNotice] = useState<string | null>(null)
  const currentRequestMonth = getCurrentRequestMonth()
  const approvalsQuery = useQuery({
    queryKey: ['target-distribution-requests', 'approval-queue'],
    queryFn: () => getTargetDistributionRequests(),
    staleTime: 30_000,
  })
  const coverageQuery = useQuery({
    queryKey: ['target-distribution-coverage', currentRequestMonth],
    queryFn: () => getTargetCoverage({ requestMonth: currentRequestMonth }),
    staleTime: 30_000,
  })
  const approveMutation = useMutation({
    mutationFn: approveTargetDistributionRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['target-distribution-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['target-distribution-coverage'] })
      setApprovalNotice(result.command.message)
    },
  })

  if (approvalsQuery.isLoading) {
    return (
      <ScreenState
        title={t('adminTargets.loadingTitle')}
        copy={t('adminTargets.loadingCopy')}
      />
    )
  }

  if (approvalsQuery.isError) {
    return (
      <ScreenState
        title={t('adminTargets.errorTitle')}
        copy={getErrorMessage(approvalsQuery.error)}
        tone="error"
      />
    )
  }

  const items = approvalsQuery.data?.items ?? []
  const inboxItems = items.map((item) => toTargetApprovalInboxItem(item))
  const pendingItems = items.filter((item) => item.status === 'pending_region_approval')
  const approvedItems = items.filter((item) => item.status === 'approved').slice(0, 5)
  const pendingCount = inboxItems.filter((item) => item.inboxStatus === 'needs_attention').length
  const approvedCount = inboxItems.filter((item) => item.inboxStatus === 'completed').length
  const coverageRows = coverageQuery.data?.items ?? []
  const coverageSummary = coverageQuery.data?.summary ?? createEmptyCoverageSummary(currentRequestMonth)
  const attentionCoverageRows = coverageRows
    .filter((item) => item.targetStatus !== 'approved')
    .slice(0, 8)
  const regionScope = input.authSummary?.user.readScope.regionIds.join(', ') || t('adminTargets.noRegionScope')
  const assignedStoreScope = getAssignedStoreIds(input.authSummary)

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">{t('adminTargets.heroEyebrow')}</div>
          <h2 className="hero-title">{t('adminTargets.title')}</h2>
          <p className="hero-copy">{t('adminTargets.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('adminTargets.route')} value="/admin/targets" />
          <MetricAccent label={t('adminTargets.pending')} value={String(pendingCount)} />
          <MetricAccent label={t('adminTargets.regionScope')} value={regionScope} />
          <MetricAccent
            label={t('adminTargets.actionStores')}
            value={assignedStoreScope.length ? String(assignedStoreScope.length) : t('adminTargets.none')}
          />
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard
          title={t('adminTargets.pendingApprovals')}
          value={pendingCount}
          note={t('adminTargets.pendingApprovalsNote')}
          icon={<ReceiptText size={18} />}
          tone="warning"
        />
        <MetricCard
          title={t('adminTargets.recentlyApproved')}
          value={approvedCount}
          note={t('adminTargets.recentlyApprovedNote')}
          icon={<CheckCircle2 size={18} />}
          tone="calm"
        />
        <MetricCard
          title={t('adminTargets.queueModel')}
          value={1}
          note={t('adminTargets.queueModelNote')}
          icon={<TimerReset size={18} />}
          tone="accent"
        />
      </section>

      <section className="panel" aria-label={t('adminTargets.coverageEyebrow')}>
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('adminTargets.coverageEyebrow')}</div>
            <h3>{t('adminTargets.coverageTitle')}</h3>
          </div>
          <StatusPill tone={mapCoverageSummaryTone(coverageSummary)}>
            {coverageSummary.uncoveredEmployees > 0
              ? t('adminTargets.needsReview')
              : t('adminTargets.complete')}
          </StatusPill>
        </div>

        {coverageQuery.isLoading ? (
          <p className="queue-subtitle">{t('adminTargets.coverageLoading')}</p>
        ) : coverageQuery.isError ? (
          <p className="queue-subtitle">{getErrorMessage(coverageQuery.error)}</p>
        ) : (
          <>
            <div className="key-grid">
              <KeyValue label={t('adminTargets.coveredPersonnel')} value={String(coverageSummary.coveredEmployees)} />
              <KeyValue label={t('adminTargets.pendingApproval')} value={String(coverageSummary.pendingEmployees)} />
              <KeyValue label={t('adminTargets.pendingChanges')} value={String(coverageSummary.conflictEmployees)} />
              <KeyValue label={t('adminTargets.staleReferences')} value={String(coverageSummary.staleEmployees)} />
              <KeyValue label={t('adminTargets.missingTargets')} value={String(coverageSummary.missingEmployees)} />
              <KeyValue label={t('adminTargets.coverageRate')} value={formatCoverageRate(coverageSummary.coverageRate)} />
              <KeyValue label={t('adminTargets.personnelInScope')} value={String(coverageSummary.totalEmployees)} />
            </div>

            {attentionCoverageRows.length === 0 ? (
              <EmptyState
                title={t('adminTargets.noCoverageIssuesTitle')}
                copy={t('adminTargets.noCoverageIssuesCopy')}
              />
            ) : (
              <div className="stacked-table">
                {attentionCoverageRows.map((item) => (
                  <TargetCoverageAttentionRow key={`${item.storeId}-${item.employeeId}`} item={item} />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('adminTargets.approvalQueue')}</div>
            <h3>{t('adminTargets.pendingRequestsTitle')}</h3>
          </div>
          <StatusPill tone={pendingCount > 0 ? 'warning' : 'calm'}>
            {pendingCount > 0 ? t('adminTargets.needsAttention') : t('adminTargets.clear')}
          </StatusPill>
        </div>

        {pendingItems.length === 0 ? (
          <EmptyState
            title={t('adminTargets.noPendingTitle')}
            copy={t('adminTargets.noPendingCopy')}
          />
        ) : (
          <div className="stacked-table">
            {pendingItems.map((item) => (
              (() => {
                const canApprove = canApproveTargetDistributionRequest(input.authSummary, item.storeId)

                return (
                  <TargetApprovalRow
                    key={item.requestId}
                    item={item}
                    approvalNote={approvalNotes[item.requestId] ?? ''}
                    canApprove={canApprove}
                    onApprovalNoteChange={(next) =>
                      setApprovalNotes((current) => ({ ...current, [item.requestId]: next }))
                    }
                    onApprove={() => {
                      if (!canApprove) {
                        return
                      }

                      approveMutation.mutate({
                        requestId: item.requestId,
                        ...(approvalNotes[item.requestId]
                          ? { approvalNote: approvalNotes[item.requestId] }
                          : {}),
                      })
                    }}
                    approving={
                      approveMutation.isPending &&
                      approveMutation.variables?.requestId === item.requestId
                    }
                  />
                )
              })()
            ))}
          </div>
        )}

        {approvalNotice ? <p className="queue-subtitle">{approvalNotice}</p> : null}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('adminTargets.recentHistory')}</div>
            <h3>{t('adminTargets.recentlyApprovedTitle')}</h3>
          </div>
          <StatusPill tone={approvedItems.length > 0 ? 'calm' : 'accent'}>
            {approvedItems.length > 0
              ? t('adminTargets.visible')
              : t('adminTargets.noHistoryYet')}
          </StatusPill>
        </div>

        {approvedItems.length === 0 ? (
          <EmptyState
            title={t('adminTargets.noApprovedTitle')}
            copy={t('adminTargets.noApprovedCopy')}
          />
        ) : (
          <div className="stacked-table">
            {approvedItems.map((item) => (
              <article className="stacked-row" key={item.requestId}>
                <div className="stacked-row-head">
                  <strong>{item.targetLabel}</strong>
                  <StatusPill tone={mapInboxStatusTone(toTargetApprovalInboxItem(item).inboxStatus)}>
                    {formatTargetDistributionStatus(item.status, t)}
                  </StatusPill>
                </div>
                <p>
                  {t('adminTargets.requestSummary', {
                    store: item.storeName || item.storeId,
                    month: formatDate(item.requestMonth, locale),
                  })}
                </p>
                <div className="key-grid">
                  <KeyValue
                    label={t('adminTargets.totalTarget')}
                    value={formatTargetAmount(item.totalTargetValue, locale)}
                  />
                  <KeyValue label={t('adminTargets.allocationCount')} value={String(item.allocationCount)} />
                  <KeyValue
                    label={t('adminTargets.approvedAt')}
                    value={item.approvedAt ? formatDateTime(item.approvedAt, locale) : t('adminTargets.unknown')}
                  />
                  <KeyValue label={t('adminTargets.approver')} value={item.approvedByUserId ?? t('adminTargets.unknown')} />
                </div>
                {item.approvalNote ? <p className="queue-subtitle">{item.approvalNote}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

function TargetCoverageAttentionRow(input: { item: TargetCoverageRow }) {
  const { t } = useLocalization()

  return (
    <article className="stacked-row">
      <div className="stacked-row-head">
        <strong>{input.item.displayName}</strong>
        <StatusPill tone={mapTargetCoverageStatusTone(input.item.targetStatus)}>
          {formatTargetCoverageStatus(input.item.targetStatus, t)}
        </StatusPill>
      </div>
      <p>{input.item.storeName || input.item.storeId}</p>
      <div className="key-grid">
        <KeyValue label={t('adminTargets.sellerCode')} value={input.item.externalEmployeeRef ?? t('adminTargets.unknown')} />
        <KeyValue label={t('adminTargets.approvedTarget')} value={formatTargetValue(input.item.targetValue, t)} />
        <KeyValue label={t('adminTargets.pendingTarget')} value={formatTargetValue(input.item.pendingTargetValue, t)} />
        <KeyValue
          label={t('adminTargets.referenceState')}
          value={formatTargetCoverageReferenceState(input.item, t)}
        />
      </div>
    </article>
  )
}

function TargetApprovalRow(input: {
  item: TargetDistributionRequest
  approvalNote: string
  canApprove: boolean
  onApprovalNoteChange: (next: string) => void
  onApprove: () => void
  approving: boolean
}) {
  const { locale, t } = useLocalization()
  const allocations = Array.isArray(input.item.allocations) ? input.item.allocations : []

  return (
    <article className="stacked-row">
      <div className="stacked-row-head">
        <strong>{input.item.targetLabel}</strong>
        <StatusPill tone={mapInboxStatusTone(toTargetApprovalInboxItem(input.item).inboxStatus)}>
          {formatTargetDistributionStatus(input.item.status, t)}
        </StatusPill>
      </div>
      <p>
        {t('adminTargets.requestSummary', {
          store: input.item.storeName || input.item.storeId,
          month: formatDate(input.item.requestMonth, locale),
        })}
      </p>
      <div className="key-grid">
        <KeyValue
          label={t('adminTargets.totalTarget')}
          value={formatTargetAmount(input.item.totalTargetValue, locale)}
        />
        <KeyValue label={t('adminTargets.allocationCount')} value={String(input.item.allocationCount)} />
        <KeyValue label={t('adminTargets.submission')} value={formatDateTime(input.item.createdAt, locale)} />
        <KeyValue label={t('adminTargets.requestOwner')} value={input.item.submittedByUserId} />
      </div>
      {input.item.requestReason ? (
        <p className="queue-subtitle">
          {t('adminTargets.reason', { reason: input.item.requestReason })}
        </p>
      ) : null}
      <div className="action-cluster">
        <StatusPill tone={mapWorkflowUrgencyTone(toTargetApprovalInboxItem(input.item).urgency)}>
          {t('adminTargets.urgency', {
            urgency: formatTargetUrgency(toTargetApprovalInboxItem(input.item).urgency, t),
          })}
        </StatusPill>
      </div>
      {allocations.length ? (
        <div className="stacked-table">
          {allocations.map((allocation) => {
            const targetValue = Number(allocation.targetValue || 0)

            return (
              <div className="stacked-row" key={`${input.item.requestId}-${allocation.employeeId}`}>
                <div className="stacked-row-head">
                  <strong>{allocation.assigneeLabel}</strong>
                  <span className="status-pill status-pill-neutral">
                    {formatTargetAmount(targetValue, locale)} /{' '}
                    {formatTargetShare(targetValue, input.item.totalTargetValue, locale)}
                  </span>
                </div>
                {allocation.note ? <p>{allocation.note}</p> : null}
              </div>
            )
          })}
        </div>
      ) : null}
      {input.item.status !== 'approved' && input.canApprove ? (
        <>
          <label className="eyebrow" htmlFor={`approval-note-${input.item.requestId}`}>
            {t('adminTargets.approvalNote')}
          </label>
          <textarea
            id={`approval-note-${input.item.requestId}`}
            value={input.approvalNote}
            onChange={(event) => input.onApprovalNoteChange(event.target.value)}
            rows={3}
            placeholder={t('adminTargets.optionalRegionNote')}
          />
          <div className="action-cluster">
            <button
              className="control-button"
              type="button"
              onClick={input.onApprove}
              disabled={input.approving || !input.canApprove}
            >
              {input.approving ? t('adminTargets.approving') : t('adminTargets.approveRequest')}
            </button>
          </div>
        </>
      ) : input.item.status !== 'approved' ? (
        <p className="queue-subtitle">
          {t('adminTargets.assignedStoreOnly')}
        </p>
      ) : input.item.approvedAt ? (
        <p className="queue-subtitle">
          {input.item.approvalNote
            ? t('adminTargets.approvedAtMessageWithNote', {
                date: formatDateTime(input.item.approvedAt, locale),
                note: input.item.approvalNote,
              })
            : t('adminTargets.approvedAtMessage', {
                date: formatDateTime(input.item.approvedAt, locale),
              })}
        </p>
      ) : null}
    </article>
  )
}

function getCurrentRequestMonth() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')

  return `${now.getFullYear()}-${month}-01`
}

function createEmptyCoverageSummary(requestMonth: string) {
  return {
    requestMonth,
    totalEmployees: 0,
    coveredEmployees: 0,
    missingEmployees: 0,
    pendingEmployees: 0,
    conflictEmployees: 0,
    staleEmployees: 0,
    uncoveredEmployees: 0,
    coverageRate: 0,
  }
}

function formatCoverageRate(rate: number) {
  if (!Number.isFinite(rate)) {
    return '0%'
  }

  return `${Math.round(rate * 100)}%`
}

function formatTargetAmount(value: number, locale: AppLocale) {
  return formatNumber(value, locale, {
    maximumFractionDigits: 0,
  })
}

function formatTargetShare(value: number, total: number, locale: AppLocale) {
  if (total <= 0) {
    return '0%'
  }

  return `${formatNumber((value / total) * 100, locale, {
    maximumFractionDigits: 1,
  })}%`
}

function mapCoverageSummaryTone(summary: {
  missingEmployees: number
  pendingEmployees: number
  conflictEmployees: number
  staleEmployees: number
  uncoveredEmployees: number
}): Tone {
  if (summary.conflictEmployees > 0 || summary.staleEmployees > 0) {
    return 'danger'
  }

  if (
    summary.missingEmployees > 0 ||
    summary.pendingEmployees > 0 ||
    summary.uncoveredEmployees > 0
  ) {
    return 'warning'
  }

  return 'calm'
}

function formatTargetDistributionStatus(status: string, t: TranslateFunction) {
  switch (status) {
    case 'pending_region_approval':
      return t('adminTargets.status.pending_region_approval')
    case 'approved':
      return t('adminTargets.status.approved')
    default:
      return formatState(status)
  }
}

function formatTargetCoverageStatus(status: string, t: TranslateFunction) {
  switch (status) {
    case 'pending_region_approval':
      return t('adminTargets.status.pending_region_approval')
    case 'pending_change_conflict':
      return t('adminTargets.status.pending_change_conflict')
    case 'stale_reference':
      return t('adminTargets.status.stale_reference')
    case 'missing':
      return t('adminTargets.status.missing')
    case 'approved':
      return t('adminTargets.status.approved')
    default:
      return formatState(status)
  }
}

function mapTargetCoverageStatusTone(status: string): Tone {
  switch (status) {
    case 'pending_change_conflict':
    case 'stale_reference':
      return 'danger'
    case 'pending_region_approval':
    case 'missing':
      return 'warning'
    case 'approved':
      return 'calm'
    default:
      return 'neutral'
  }
}

function formatTargetValue(value: number | null, t: TranslateFunction) {
  return value === null ? t('adminTargets.value.none') : String(value)
}

function formatTargetCoverageReferenceState(item: TargetCoverageRow, t: TranslateFunction) {
  if (item.staleTargetReferenceId) {
    return t('adminTargets.reference.storeMismatch')
  }

  if (item.targetReferenceId) {
    return t('adminTargets.reference.approved')
  }

  if (item.pendingRequestId) {
    return t('adminTargets.reference.waitingApproval')
  }

  return t('adminTargets.reference.none')
}

function formatTargetUrgency(urgency: string, t: TranslateFunction) {
  switch (urgency) {
    case 'high':
      return t('adminTargets.urgency.high')
    case 'medium':
      return t('adminTargets.urgency.medium')
    case 'low':
      return t('adminTargets.urgency.low')
    default:
      return formatState(urgency)
  }
}
