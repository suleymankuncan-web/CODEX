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
import { formatDate, formatDateTime, formatState, getErrorMessage } from '../lib/format'

export function TargetApprovalQueuePage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const queryClient = useQueryClient()
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({})
  const [approvalNotice, setApprovalNotice] = useState<string | null>(null)
  const currentRequestMonth = getCurrentRequestMonth()
  const approvalsQuery = useQuery({
    queryKey: ['target-distribution-requests', 'approval-queue'],
    queryFn: () => getTargetDistributionRequests(),
  })
  const coverageQuery = useQuery({
    queryKey: ['target-distribution-coverage', currentRequestMonth],
    queryFn: () => getTargetCoverage({ requestMonth: currentRequestMonth }),
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
        title="Loading target approvals"
        copy="Pulling store-submitted target distribution requests that are waiting on region approval."
      />
    )
  }

  if (approvalsQuery.isError) {
    return (
      <ScreenState
        title="Target approval queue unavailable"
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
  const regionScope = input.authSummary?.user.readScope.regionIds.join(', ') || 'No resolved region scope'
  const assignedStoreScope = getAssignedStoreIds(input.authSummary)

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">Target Approvals</div>
          <h2 className="hero-title">
            Region approval queue for store-submitted target distribution requests.
          </h2>
          <p className="hero-copy">
            This is the first real approval surface wired to the domain blueprint. Stores submit
            target distribution requests here, and region-side operators approve them with a short
            note and audit trace.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Route" value="/admin/targets" />
          <MetricAccent label="Pending" value={String(pendingCount)} />
          <MetricAccent label="Region scope" value={regionScope} />
          <MetricAccent
            label="Action stores"
            value={assignedStoreScope.length ? String(assignedStoreScope.length) : 'None'}
          />
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard
          title="Pending approvals"
          value={pendingCount}
          note="Requests still waiting on region-side approval."
          icon={<ReceiptText size={18} />}
          tone="warning"
        />
        <MetricCard
          title="Recently approved"
          value={approvedCount}
          note="Approved requests visible in the current queue slice."
          icon={<CheckCircle2 size={18} />}
          tone="calm"
        />
        <MetricCard
          title="Queue model"
          value={1}
          note="First real write flow aligned with approval engine work."
          icon={<TimerReset size={18} />}
          tone="accent"
        />
      </section>

      <section className="panel" aria-label="Target reference coverage">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Target Reference Coverage</div>
            <h3>Approved personnel target readiness</h3>
          </div>
          <StatusPill tone={mapCoverageSummaryTone(coverageSummary)}>
            {coverageSummary.uncoveredEmployees > 0 ? 'Needs review' : 'Complete'}
          </StatusPill>
        </div>

        {coverageQuery.isLoading ? (
          <p className="queue-subtitle">Loading target coverage...</p>
        ) : coverageQuery.isError ? (
          <p className="queue-subtitle">{getErrorMessage(coverageQuery.error)}</p>
        ) : (
          <>
            <div className="key-grid">
              <KeyValue label="Covered personnel" value={String(coverageSummary.coveredEmployees)} />
              <KeyValue label="Pending approval" value={String(coverageSummary.pendingEmployees)} />
              <KeyValue label="Pending changes" value={String(coverageSummary.conflictEmployees)} />
              <KeyValue label="Stale references" value={String(coverageSummary.staleEmployees)} />
              <KeyValue label="Missing targets" value={String(coverageSummary.missingEmployees)} />
              <KeyValue label="Coverage rate" value={formatCoverageRate(coverageSummary.coverageRate)} />
              <KeyValue label="Personnel in scope" value={String(coverageSummary.totalEmployees)} />
            </div>

            {attentionCoverageRows.length === 0 ? (
              <EmptyState
                title="No target coverage issues"
                copy="Approved personnel target references cover the current month without pending or stale items."
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
            <div className="eyebrow">Approval Queue</div>
            <h3>Pending target distribution requests</h3>
          </div>
          <StatusPill tone={pendingCount > 0 ? 'warning' : 'calm'}>
            {pendingCount > 0 ? 'Needs attention' : 'Clear'}
          </StatusPill>
        </div>

        {pendingItems.length === 0 ? (
          <EmptyState
            title="No pending requests"
            copy="Store managers have not submitted any target distribution requests that require region approval yet."
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
                        approvalNote: approvalNotes[item.requestId] || undefined,
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
            <div className="eyebrow">Recent History</div>
            <h3>Recently approved target requests</h3>
          </div>
          <StatusPill tone={approvedItems.length > 0 ? 'calm' : 'accent'}>
            {approvedItems.length > 0 ? 'Visible' : 'No history yet'}
          </StatusPill>
        </div>

        {approvedItems.length === 0 ? (
          <EmptyState
            title="No approved requests yet"
            copy="Approved requests will remain visible here so region-side operators can review the latest decisions."
          />
        ) : (
          <div className="stacked-table">
            {approvedItems.map((item) => (
              <article className="stacked-row" key={item.requestId}>
                <div className="stacked-row-head">
                  <strong>{item.targetLabel}</strong>
                  <StatusPill tone={mapInboxStatusTone(toTargetApprovalInboxItem(item).inboxStatus)}>
                    {formatState(item.status)}
                  </StatusPill>
                </div>
                <p>
                  {item.storeName || item.storeId} icin {formatDate(item.requestMonth)} ayi hedef
                  dagitim talebi.
                </p>
                <div className="key-grid">
                  <KeyValue label="Toplam hedef" value={String(item.totalTargetValue)} />
                  <KeyValue label="Dagitim sayisi" value={String(item.allocationCount)} />
                  <KeyValue
                    label="Approved at"
                    value={item.approvedAt ? formatDateTime(item.approvedAt) : 'Unknown'}
                  />
                  <KeyValue label="Approver" value={item.approvedByUserId ?? 'Unknown'} />
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
  return (
    <article className="stacked-row">
      <div className="stacked-row-head">
        <strong>{input.item.displayName}</strong>
        <StatusPill tone={mapTargetCoverageStatusTone(input.item.targetStatus)}>
          {formatTargetCoverageStatus(input.item.targetStatus)}
        </StatusPill>
      </div>
      <p>{input.item.storeName || input.item.storeId}</p>
      <div className="key-grid">
        <KeyValue label="Seller code" value={input.item.externalEmployeeRef ?? 'Unknown'} />
        <KeyValue label="Approved target" value={formatTargetValue(input.item.targetValue)} />
        <KeyValue label="Pending target" value={formatTargetValue(input.item.pendingTargetValue)} />
        <KeyValue
          label="Reference state"
          value={formatTargetCoverageReferenceState(input.item)}
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
  const allocations = Array.isArray(input.item.allocations) ? input.item.allocations : []

  return (
    <article className="stacked-row">
      <div className="stacked-row-head">
        <strong>{input.item.targetLabel}</strong>
        <StatusPill tone={mapInboxStatusTone(toTargetApprovalInboxItem(input.item).inboxStatus)}>
          {formatState(input.item.status)}
        </StatusPill>
      </div>
      <p>
        {input.item.storeName || input.item.storeId} icin {formatDate(input.item.requestMonth)} ayi
        hedef dagitim talebi.
      </p>
      <div className="key-grid">
        <KeyValue label="Toplam hedef" value={String(input.item.totalTargetValue)} />
        <KeyValue label="Dagitim sayisi" value={String(input.item.allocationCount)} />
        <KeyValue label="Gonderim" value={formatDateTime(input.item.createdAt)} />
        <KeyValue label="Talep sahibi" value={input.item.submittedByUserId} />
      </div>
      {input.item.requestReason ? (
        <p className="queue-subtitle">Gerekce: {input.item.requestReason}</p>
      ) : null}
      <div className="action-cluster">
        <StatusPill tone={mapWorkflowUrgencyTone(toTargetApprovalInboxItem(input.item).urgency)}>
          {`Urgency: ${formatState(toTargetApprovalInboxItem(input.item).urgency)}`}
        </StatusPill>
      </div>
      {allocations.length ? (
        <div className="stacked-table">
          {allocations.map((allocation, index) => (
            <div className="stacked-row" key={`${input.item.requestId}-${index}`}>
              <div className="stacked-row-head">
                <strong>{allocation.assigneeLabel}</strong>
                <span className="status-pill status-pill-neutral">{allocation.targetValue}</span>
              </div>
              {allocation.note ? <p>{allocation.note}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
      {input.item.status !== 'approved' && input.canApprove ? (
        <>
          <label className="eyebrow" htmlFor={`approval-note-${input.item.requestId}`}>
            Approval note
          </label>
          <textarea
            id={`approval-note-${input.item.requestId}`}
            value={input.approvalNote}
            onChange={(event) => input.onApprovalNoteChange(event.target.value)}
            rows={3}
            placeholder="Optional region-side note"
          />
          <div className="action-cluster">
            <button
              className="control-button"
              type="button"
              onClick={input.onApprove}
              disabled={input.approving || !input.canApprove}
            >
              {input.approving ? 'Approving...' : 'Approve request'}
            </button>
          </div>
        </>
      ) : input.item.status !== 'approved' ? (
        <p className="queue-subtitle">
          This session can review the request, but approval is limited to assigned action stores.
        </p>
      ) : input.item.approvedAt ? (
        <p className="queue-subtitle">
          Approved at {formatDateTime(input.item.approvedAt)}
          {input.item.approvalNote ? ` - ${input.item.approvalNote}` : ''}
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

function formatTargetCoverageStatus(status: string) {
  switch (status) {
    case 'pending_region_approval':
      return 'Pending approval'
    case 'pending_change_conflict':
      return 'Pending change'
    case 'stale_reference':
      return 'Stale reference'
    case 'missing':
      return 'Missing target'
    case 'approved':
      return 'Approved'
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

function formatTargetValue(value: number | null) {
  return value === null ? 'None' : String(value)
}

function formatTargetCoverageReferenceState(item: TargetCoverageRow) {
  if (item.staleTargetReferenceId) {
    return 'Store mismatch'
  }

  if (item.targetReferenceId) {
    return 'Approved reference'
  }

  if (item.pendingRequestId) {
    return 'Waiting approval'
  }

  return 'No approved reference'
}
