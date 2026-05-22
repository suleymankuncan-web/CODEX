import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCircle2, KeyRound, ReceiptText, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusPill,
} from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'
import { WorkflowInboxDetail } from '../features/workflow/WorkflowInboxDetail'
import { getWorkflowInbox } from '../features/workflow/api'
import {
  mapInboxStatusTone,
  mapWorkflowUrgencyTone,
  type WorkflowInboxItem,
} from '../features/workflow/contracts'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import {
  approveOffboardingRequest,
  approveSellerCodeRequest,
  getOffboardingRequests,
  getSellerCodeReference,
  getSellerCodeRequests,
  rejectOffboardingRequest,
  rejectSellerCodeRequest,
  type OffboardingAccessClosure,
  type OffboardingRequest,
  type SellerCodeReference,
  type SellerCodeRequest,
} from '../features/workforce/api'
import { formatDateTime, formatState, getErrorMessage } from '../lib/format'
import { transientQueryRetryOptions } from '../lib/query-retry'

function canUseAdminInbox(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('SUPER_ADMIN') || roles.includes('REPORT_VIEWER') || roles.includes('HR_ADMIN')
}

function canUseSellerCodeQueue(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('SUPER_ADMIN') || roles.includes('HR_ADMIN')
}

const workflowItemTypeLabelKeys: Record<WorkflowInboxItem['itemType'], TranslationKey> = {
  approval: 'storeTasks.itemType.approval',
  acknowledgement: 'storeTasks.itemType.acknowledgement',
  task: 'storeTasks.itemType.task',
  notification: 'storeTasks.itemType.notification',
}

const workflowSourceTypeLabelKeys: Record<WorkflowInboxItem['sourceType'], TranslationKey> = {
  target_distribution_request: 'storeTasks.sourceType.target_distribution_request',
  checklist_receipt: 'storeTasks.sourceType.checklist_receipt',
  kpi_exception: 'storeTasks.sourceType.kpi_exception',
  store_action_plan: 'storeTasks.sourceType.store_action_plan',
}

const workflowStateLabelKeys: Record<string, TranslationKey> = {
  needs_attention: 'storeTasks.inboxStatus.needs_attention',
  completed: 'storeTasks.inboxStatus.completed',
  informational: 'storeTasks.inboxStatus.informational',
  high: 'storeTasks.urgency.high',
  medium: 'storeTasks.urgency.medium',
  low: 'storeTasks.urgency.low',
  pending_hr_approval: 'adminInbox.status.pendingHrApproval',
  pending_region_approval: 'adminInbox.status.pendingRegionApproval',
}

function formatTranslatedState(state: string, t: TranslateFunction) {
  const key = workflowStateLabelKeys[state]
  return key ? t(key) : formatState(state)
}

function formatWorkflowItemTypeLabel(itemType: WorkflowInboxItem['itemType'], t: TranslateFunction) {
  return t(workflowItemTypeLabelKeys[itemType])
}

function formatWorkflowSourceTypeLabel(sourceType: WorkflowInboxItem['sourceType'], t: TranslateFunction) {
  return t(workflowSourceTypeLabelKeys[sourceType])
}

function formatOffboardingAccessClosure(
  closure: OffboardingAccessClosure | null | undefined,
  t: TranslateFunction,
) {
  if (!closure) {
    return null
  }

  if (!closure.userAccessClosed) {
    return t('adminInbox.noLinkedUserAccess')
  }

  return t('adminInbox.userAccessClosed', {
    closedRoleAssignments: closure.closedRoleAssignments,
    closedActionStoreAssignments: closure.closedActionStoreAssignments,
    revokedMobileSessions: closure.revokedMobileSessions,
  })
}

export function AdminInboxPage(input: { authSummary: AuthSessionSummary | null }) {
  const { t } = useLocalization()
  const queryClient = useQueryClient()
  const inboxEnabled = canUseAdminInbox(input.authSummary)
  const sellerCodeEnabled = canUseSellerCodeQueue(input.authSummary)
  const regionScope = input.authSummary?.user.scope.regionIds.join(', ') || t('adminInbox.noRegionScope')
  const [sellerCodeDrafts, setSellerCodeDrafts] = useState<Record<string, string>>({})
  const [sellerCodeReturnNotes, setSellerCodeReturnNotes] = useState<Record<string, string>>({})
  const [offboardingReturnNotes, setOffboardingReturnNotes] = useState<Record<string, string>>({})
  const [sellerCodeNotice, setSellerCodeNotice] = useState<string | null>(null)

  const inboxQuery = useQuery({
    queryKey: ['workflow-inbox', 'admin'],
    queryFn: getWorkflowInbox,
    enabled: inboxEnabled,
    staleTime: 30_000,
    ...transientQueryRetryOptions,
  })
  const sellerCodeReferenceQuery = useQuery({
    queryKey: ['seller-code-reference', 'franchise'],
    queryFn: getSellerCodeReference,
    enabled: sellerCodeEnabled,
    staleTime: 30_000,
  })
  const sellerCodeRequestsQuery = useQuery({
    queryKey: ['seller-code-requests', 'pending_hr_approval'],
    queryFn: () => getSellerCodeRequests({ status: 'pending_hr_approval' }),
    enabled: sellerCodeEnabled,
    staleTime: 30_000,
  })
  const offboardingRequestsQuery = useQuery({
    queryKey: ['offboarding-requests', 'pending_hr_approval'],
    queryFn: () => getOffboardingRequests({ status: 'pending_hr_approval' }),
    enabled: sellerCodeEnabled,
    staleTime: 30_000,
  })
  const approveSellerCodeMutation = useMutation({
    mutationFn: approveSellerCodeRequest,
    onSuccess: async (response) => {
      setSellerCodeNotice(response.command.message)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['seller-code-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['seller-code-reference'] }),
      ])
    },
    onError: (error) => {
      setSellerCodeNotice(getErrorMessage(error))
    },
  })
  const approveOffboardingMutation = useMutation({
    mutationFn: approveOffboardingRequest,
    onSuccess: async (response) => {
      const accessClosureCopy = formatOffboardingAccessClosure(response.data.accessClosure, t)
      setSellerCodeNotice(
        accessClosureCopy
          ? `${response.command.message}. ${accessClosureCopy}`
          : response.command.message,
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['offboarding-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['workforce-store-employees'] }),
      ])
    },
    onError: (error) => {
      setSellerCodeNotice(getErrorMessage(error))
    },
  })
  const rejectSellerCodeMutation = useMutation({
    mutationFn: rejectSellerCodeRequest,
    onSuccess: async (response) => {
      setSellerCodeNotice(response.command.message)
      await queryClient.invalidateQueries({ queryKey: ['seller-code-requests'] })
    },
    onError: (error) => {
      setSellerCodeNotice(getErrorMessage(error))
    },
  })
  const rejectOffboardingMutation = useMutation({
    mutationFn: rejectOffboardingRequest,
    onSuccess: async (response) => {
      setSellerCodeNotice(response.command.message)
      await queryClient.invalidateQueries({ queryKey: ['offboarding-requests'] })
    },
    onError: (error) => {
      setSellerCodeNotice(getErrorMessage(error))
    },
  })

  const items = useMemo(() => inboxQuery.data?.items ?? [], [inboxQuery.data?.items])
  const sortedItems = useMemo(() => {
    const urgencyRank = { high: 0, medium: 1, low: 2 }
    const statusRank = { needs_attention: 0, informational: 1, completed: 2 }

    return items.toSorted((left, right) => {
      const statusDelta = statusRank[left.inboxStatus] - statusRank[right.inboxStatus]
      if (statusDelta !== 0) return statusDelta

      const urgencyDelta = urgencyRank[left.urgency] - urgencyRank[right.urgency]
      if (urgencyDelta !== 0) return urgencyDelta

      const leftTime = new Date(left.needsAttentionAt ?? left.createdAt ?? 0).getTime()
      const rightTime = new Date(right.needsAttentionAt ?? right.createdAt ?? 0).getTime()
      return rightTime - leftTime
    })
  }, [items])

  const pendingItems = items.filter((item) => item.inboxStatus === 'needs_attention')
  const approvalItems = items.filter((item) => item.itemType === 'approval')
  const taskItems = items.filter((item) => item.itemType === 'task')
  const sellerCodeRequests = sellerCodeRequestsQuery.data?.items ?? []
  const offboardingRequests = offboardingRequestsQuery.data?.items ?? []

  if (!inboxEnabled) {
    return (
      <ScreenState
        title={t('adminInbox.unavailableTitle')}
        copy={t('adminInbox.unavailableCopy')}
        tone="error"
      />
    )
  }

  if (inboxQuery.isLoading) {
    return (
      <ScreenState
        title={t('adminInbox.loadingTitle')}
        copy={t('adminInbox.loadingCopy')}
      />
    )
  }

  if (inboxQuery.isError) {
    return (
      <ScreenState
        title={t('adminInbox.unavailableTitle')}
        copy={getErrorMessage(inboxQuery.error)}
        tone="error"
      />
    )
  }

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">{t('adminInbox.heroEyebrow')}</div>
          <h2 className="hero-title">{t('adminInbox.heroTitle')}</h2>
          <p className="hero-copy">{t('adminInbox.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('adminInbox.route')} value="/admin/inbox" />
          <MetricAccent label={t('adminInbox.regionScope')} value={regionScope} />
          <MetricAccent label={t('adminInbox.queueItems')} value={String(items.length)} />
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard
          title={t('adminInbox.needsAttention')}
          value={pendingItems.length}
          note={t('adminInbox.needsAttentionNote')}
          icon={<Bell size={18} />}
          tone={pendingItems.length > 0 ? 'warning' : 'calm'}
        />
        <MetricCard
          title={t('adminInbox.approvals')}
          value={approvalItems.length}
          note={t('adminInbox.approvalsNote')}
          icon={<ReceiptText size={18} />}
          tone={approvalItems.length > 0 ? 'accent' : 'neutral'}
        />
        <MetricCard
          title={t('adminInbox.kpiTasks')}
          value={taskItems.length}
          note={t('adminInbox.kpiTasksNote')}
          icon={<TrendingUp size={18} />}
          tone={taskItems.length > 0 ? 'warning' : 'neutral'}
        />
        <MetricCard
          title={t('adminInbox.completed')}
          value={items.filter((item) => item.inboxStatus === 'completed').length}
          note={t('adminInbox.completedNote')}
          icon={<CheckCircle2 size={18} />}
          tone="calm"
        />
        <MetricCard
          title={t('adminInbox.sellerCode')}
          value={sellerCodeRequests.length}
          note={t('adminInbox.sellerCodeNote')}
          icon={<KeyRound size={18} />}
          tone={sellerCodeRequests.length > 0 ? 'warning' : 'neutral'}
        />
        <MetricCard
          title={t('adminInbox.offboarding')}
          value={offboardingRequests.length}
          note={t('adminInbox.offboardingNote')}
          icon={<KeyRound size={18} />}
          tone={offboardingRequests.length > 0 ? 'warning' : 'neutral'}
        />
      </section>

      {sellerCodeEnabled ? (
        <SellerCodeQueuePanel
          approvePending={approveSellerCodeMutation.isPending}
          drafts={sellerCodeDrafts}
          notice={sellerCodeNotice}
          onApprove={(requestId, sellerCode) =>
            approveSellerCodeMutation.mutate({
              requestId,
              sellerCode,
              reviewNote: 'Approved from admin inbox',
            })
          }
          onDraftChange={(requestId, value) =>
            setSellerCodeDrafts((current) => ({
              ...current,
              [requestId]: value.toUpperCase(),
            }))
          }
          onReject={(requestId, reviewNote) =>
            rejectSellerCodeMutation.mutate({
              requestId,
              reviewNote,
            })
          }
          onReturnNoteChange={(requestId, value) =>
            setSellerCodeReturnNotes((current) => ({
              ...current,
              [requestId]: value,
            }))
          }
          reference={sellerCodeReferenceQuery.data}
          referenceError={sellerCodeReferenceQuery.error}
          referenceLoading={sellerCodeReferenceQuery.isLoading}
          rejectPending={rejectSellerCodeMutation.isPending}
          requests={sellerCodeRequests}
          requestsError={sellerCodeRequestsQuery.error}
          requestsLoading={sellerCodeRequestsQuery.isLoading}
          returnNotes={sellerCodeReturnNotes}
        />
      ) : null}

      {sellerCodeEnabled ? (
        <OffboardingQueuePanel
          approvePending={approveOffboardingMutation.isPending}
          error={offboardingRequestsQuery.error}
          loading={offboardingRequestsQuery.isLoading}
          onApprove={(requestId) =>
            approveOffboardingMutation.mutate({
              requestId,
              reviewNote: 'Approved from admin inbox',
            })
          }
          onReject={(requestId, reviewNote) =>
            rejectOffboardingMutation.mutate({
              requestId,
              reviewNote,
            })
          }
          onReturnNoteChange={(requestId, value) =>
            setOffboardingReturnNotes((current) => ({
              ...current,
              [requestId]: value,
            }))
          }
          rejectPending={rejectOffboardingMutation.isPending}
          requests={offboardingRequests}
          returnNotes={offboardingReturnNotes}
        />
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('adminInbox.adminQueueEyebrow')}</div>
            <h3>{t('adminInbox.adminQueueTitle')}</h3>
          </div>
        </div>

        {sortedItems.length === 0 ? (
          <EmptyState
            title={t('adminInbox.emptyQueueTitle')}
            copy={t('adminInbox.emptyQueueCopy')}
          />
        ) : (
          <div className="stacked-table">
            {sortedItems.map((item) => (
              <AdminInboxRow key={`${item.sourceType}:${item.sourceId}`} item={item} />
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

function SellerCodeQueuePanel(input: {
  approvePending: boolean
  drafts: Record<string, string>
  notice: string | null
  onApprove: (requestId: string, sellerCode: string) => void
  onDraftChange: (requestId: string, value: string) => void
  onReject: (requestId: string, reviewNote: string) => void
  onReturnNoteChange: (requestId: string, value: string) => void
  reference: SellerCodeReference | undefined
  referenceError: Error | null
  referenceLoading: boolean
  rejectPending: boolean
  requests: SellerCodeRequest[]
  requestsError: Error | null
  requestsLoading: boolean
  returnNotes: Record<string, string>
}) {
  const { t } = useLocalization()

  return (
    <section className="panel" aria-label={t('adminInbox.sellerQueueAria')}>
      <div className="panel-heading panel-heading-spread">
        <div>
          <div className="eyebrow">{t('adminInbox.workforceEyebrow')}</div>
          <h3>{t('adminInbox.sellerQueueTitle')}</h3>
          <p className="panel-copy">{t('adminInbox.sellerQueueCopy')}</p>
        </div>
        <div className="hero-metrics compact-metrics">
          <MetricAccent
            label={t('adminInbox.lastFranchiseCode')}
            value={input.reference?.lastSellerCode ?? t('adminInbox.noFmCode')}
          />
          <MetricAccent
            label={t('adminInbox.nextPreview')}
            value={input.reference?.nextSellerCodePreview ?? t('adminInbox.notAvailable')}
          />
        </div>
      </div>

      {input.notice ? <div className="inline-state inline-state-accent">{input.notice}</div> : null}

      {input.referenceLoading || input.requestsLoading ? (
        <div className="inline-state inline-state-neutral">{t('adminInbox.loadingSellerRequests')}</div>
      ) : input.referenceError ? (
        <div className="inline-state inline-state-danger">{getErrorMessage(input.referenceError)}</div>
      ) : input.requestsError ? (
        <div className="inline-state inline-state-danger">{getErrorMessage(input.requestsError)}</div>
      ) : input.requests.length === 0 ? (
        <EmptyState
          title={t('adminInbox.noSellerRequestsTitle')}
          copy={t('adminInbox.noSellerRequestsCopy')}
        />
      ) : (
        <div className="stacked-table">
          {input.requests.map((item) => (
            <SellerCodeRequestRow
              approvePending={input.approvePending}
              draftCode={
                input.drafts[item.requestId] ??
                item.requestedSellerCode ??
                input.reference?.nextSellerCodePreview ??
                ''
              }
              item={item}
              key={item.requestId}
              onApprove={input.onApprove}
              onDraftChange={input.onDraftChange}
              onReject={input.onReject}
              onReturnNoteChange={input.onReturnNoteChange}
              rejectPending={input.rejectPending}
              returnNote={input.returnNotes[item.requestId] ?? ''}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function SellerCodeRequestRow(input: {
  approvePending: boolean
  draftCode: string
  item: SellerCodeRequest
  onApprove: (requestId: string, sellerCode: string) => void
  onDraftChange: (requestId: string, value: string) => void
  onReject: (requestId: string, reviewNote: string) => void
  onReturnNoteChange: (requestId: string, value: string) => void
  rejectPending: boolean
  returnNote: string
}) {
  const { t } = useLocalization()
  const displayName = `${input.item.firstName} ${input.item.lastName}`.trim()

  return (
    <article className="stacked-row">
      <div className="stacked-row-head">
        <div>
          <strong>{displayName}</strong>
          <p className="queue-subtitle">
            {t('adminInbox.referenceLine', {
              storeName: input.item.storeName,
              storeType: input.item.storeType,
              reference: input.item.lastReferenceSellerCode ?? t('adminInbox.none'),
            })}
          </p>
        </div>
        <StatusPill tone="warning">{formatTranslatedState(input.item.status, t)}</StatusPill>
      </div>

      <div className="key-grid">
        <KeyValue label={t('adminInbox.position')} value={input.item.positionName} />
        <KeyValue label={t('adminInbox.nationalIdLast4')} value={input.item.nationalIdLast4} />
        <KeyValue label={t('adminInbox.phone')} value={input.item.phoneNumber} />
        <KeyValue label={t('adminInbox.hireDate')} value={input.item.hireDate} />
      </div>

      <div className="form-grid">
        <label className="field-block">
          <span>{t('adminInbox.sellerCodeField')}</span>
          <input
            aria-label={t('adminInbox.sellerCodeInputAria', { displayName })}
            value={input.draftCode}
            onChange={(event) => input.onDraftChange(input.item.requestId, event.target.value)}
          />
        </label>
        <div className="field-block">
          <span>{t('adminInbox.manualControl')}</span>
          <button
            className="control-button"
            type="button"
            disabled={input.approvePending || !input.draftCode.trim()}
            onClick={() => input.onApprove(input.item.requestId, input.draftCode.trim())}
          >
            {t('adminInbox.approveSellerCode')}
          </button>
        </div>
      </div>

      <div className="form-grid">
        <label className="field-block">
          <span>{t('adminInbox.returnNote')}</span>
          <textarea
            aria-label={t('adminInbox.returnNoteForAria', { displayName })}
            rows={2}
            value={input.returnNote}
            onChange={(event) => input.onReturnNoteChange(input.item.requestId, event.target.value)}
          />
        </label>
        <div className="field-block">
          <span>{t('adminInbox.storeCorrection')}</span>
          <button
            className="control-button"
            type="button"
            disabled={input.rejectPending || !input.returnNote.trim()}
            onClick={() => input.onReject(input.item.requestId, input.returnNote.trim())}
          >
            {t('adminInbox.returnSellerCode')}
          </button>
        </div>
      </div>
    </article>
  )
}

function OffboardingQueuePanel(input: {
  approvePending: boolean
  error: Error | null
  loading: boolean
  onApprove: (requestId: string) => void
  onReject: (requestId: string, reviewNote: string) => void
  onReturnNoteChange: (requestId: string, value: string) => void
  rejectPending: boolean
  requests: OffboardingRequest[]
  returnNotes: Record<string, string>
}) {
  const { t } = useLocalization()

  return (
    <section className="panel" aria-label={t('adminInbox.offboardingQueueAria')}>
      <div className="panel-heading panel-heading-spread">
        <div>
          <div className="eyebrow">{t('adminInbox.workforceEyebrow')}</div>
          <h3>{t('adminInbox.offboardingQueueTitle')}</h3>
          <p className="panel-copy">{t('adminInbox.offboardingQueueCopy')}</p>
        </div>
      </div>

      {input.loading ? (
        <div className="inline-state inline-state-neutral">{t('adminInbox.loadingOffboardingRequests')}</div>
      ) : input.error ? (
        <div className="inline-state inline-state-danger">{getErrorMessage(input.error)}</div>
      ) : input.requests.length === 0 ? (
        <EmptyState
          title={t('adminInbox.noOffboardingRequestsTitle')}
          copy={t('adminInbox.noOffboardingRequestsCopy')}
        />
      ) : (
        <div className="stacked-table">
          {input.requests.map((item) => (
            <OffboardingRequestRow
              approvePending={input.approvePending}
              item={item}
              key={item.requestId}
              onApprove={input.onApprove}
              onReject={input.onReject}
              onReturnNoteChange={input.onReturnNoteChange}
              rejectPending={input.rejectPending}
              returnNote={input.returnNotes[item.requestId] ?? ''}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function OffboardingRequestRow(input: {
  approvePending: boolean
  item: OffboardingRequest
  onApprove: (requestId: string) => void
  onReject: (requestId: string, reviewNote: string) => void
  onReturnNoteChange: (requestId: string, value: string) => void
  rejectPending: boolean
  returnNote: string
}) {
  const { t } = useLocalization()

  return (
    <article className="stacked-row">
      <div className="stacked-row-head">
        <div>
          <strong>{input.item.displayName}</strong>
          <p className="queue-subtitle">
            {input.item.storeName} / {input.item.externalEmployeeRef ?? t('adminInbox.noSellerCode')}
          </p>
        </div>
        <StatusPill tone="warning">{formatTranslatedState(input.item.status, t)}</StatusPill>
      </div>

      <div className="key-grid">
        <KeyValue label={t('adminInbox.position')} value={input.item.positionName ?? t('adminInbox.noPosition')} />
        <KeyValue label={t('adminInbox.exitDate')} value={input.item.terminationDate} />
        <KeyValue label={t('adminInbox.reason')} value={input.item.terminationReason} />
        <KeyValue label={t('adminInbox.requestNote')} value={input.item.requestReason ?? t('adminInbox.noNote')} />
      </div>

      <div className="form-grid">
        <div className="field-block">
          <span>{t('adminInbox.manualControl')}</span>
          <button
            className="control-button"
            type="button"
            disabled={input.approvePending}
            onClick={() => input.onApprove(input.item.requestId)}
          >
            {t('adminInbox.approveOffboarding')}
          </button>
        </div>
        <label className="field-block">
          <span>{t('adminInbox.returnNote')}</span>
          <textarea
            aria-label={t('adminInbox.returnNoteForAria', { displayName: input.item.displayName })}
            rows={2}
            value={input.returnNote}
            onChange={(event) => input.onReturnNoteChange(input.item.requestId, event.target.value)}
          />
        </label>
        <div className="field-block">
          <span>{t('adminInbox.storeCorrection')}</span>
          <button
            className="control-button"
            type="button"
            disabled={input.rejectPending || !input.returnNote.trim()}
            onClick={() => input.onReject(input.item.requestId, input.returnNote.trim())}
          >
            {t('adminInbox.returnOffboarding')}
          </button>
        </div>
      </div>
    </article>
  )
}

function AdminInboxRow(input: { item: WorkflowInboxItem }) {
  const { locale, t } = useLocalization()

  return (
    <article className="stacked-row">
      <div className="stacked-row-head">
        <div>
          <strong>{input.item.title}</strong>
          <p className="queue-subtitle">{input.item.summary}</p>
        </div>
        <div className="action-cluster">
          <StatusPill tone="accent">{formatWorkflowSourceTypeLabel(input.item.sourceType, t)}</StatusPill>
          <StatusPill tone={mapInboxStatusTone(input.item.inboxStatus)}>
            {formatTranslatedState(input.item.inboxStatus, t)}
          </StatusPill>
          <StatusPill tone={mapWorkflowUrgencyTone(input.item.urgency)}>
            {formatTranslatedState(input.item.urgency, t)}
          </StatusPill>
        </div>
      </div>

      <div className="key-grid">
        <KeyValue label={t('storeTasks.workType')} value={formatWorkflowItemTypeLabel(input.item.itemType, t)} />
        <KeyValue label={t('storeTasks.actorRole')} value={formatState(input.item.actorRole)} />
        <KeyValue label={t('storeTasks.store')} value={input.item.storeName || input.item.storeId} />
        <KeyValue
          label={t('storeTasks.actionTime')}
          value={input.item.needsAttentionAt ? formatDateTime(input.item.needsAttentionAt, locale) : t('storeTasks.now')}
        />
      </div>

      {input.item.historyPreview ? <p className="queue-subtitle">{input.item.historyPreview}</p> : null}

      <WorkflowInboxDetail item={input.item} />

      <div className="action-cluster">
        <Link className="control-button" to={input.item.deepLink}>
          {input.item.primaryActionLabel}
        </Link>
      </div>
    </article>
  )
}
