import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCircle2, KeyRound, ReceiptText, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  AdminKeyValue as KeyValue,
  AdminKeyValueGrid,
  AdminMetricStrip,
  AdminStatePanel,
  AdminSurfaceBadge,
  AdminSurfaceEmpty as EmptyState,
  AdminSurfaceHeader,
  AdminSurfacePage,
  AdminSurfaceSection,
  type AdminSurfaceTone,
} from './admin-surface-primitives'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import type { AuthSessionSummary } from '../features/auth/api'
import { WorkflowInboxDetail } from '../features/workflow/WorkflowInboxDetail'
import { getWorkflowInbox } from '../features/workflow/api'
import type { WorkflowInboxItem } from '../features/workflow/contracts'
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

type WorkflowSurfaceTone = AdminSurfaceTone | 'calm'

function toSurfaceTone(tone: WorkflowSurfaceTone | undefined): AdminSurfaceTone {
  if (tone === 'calm') {
    return 'success'
  }

  return tone ?? 'neutral'
}

function StatusPill({
  children,
  tone,
}: {
  children: ReactNode
  tone?: WorkflowSurfaceTone
}) {
  return <AdminSurfaceBadge tone={toSurfaceTone(tone)}>{children}</AdminSurfaceBadge>
}

function AdminInboxState({
  copy,
  isLoading = false,
  title,
  tone = 'neutral',
}: {
  copy: ReactNode
  isLoading?: boolean
  title: ReactNode
  tone?: AdminSurfaceTone
}) {
  return (
    <AdminSurfacePage ariaLabel={String(title)}>
      <AdminStatePanel
        title={title}
        description={copy}
        isLoading={isLoading}
        tone={tone}
      />
    </AdminSurfacePage>
  )
}

function mapInboxStatusTone(status: WorkflowInboxItem['inboxStatus']): WorkflowSurfaceTone {
  switch (status) {
    case 'needs_attention':
      return 'warning'
    case 'completed':
      return 'calm'
    case 'informational':
      return 'accent'
    default:
      return 'neutral'
  }
}

function mapWorkflowUrgencyTone(urgency: WorkflowInboxItem['urgency']): WorkflowSurfaceTone {
  switch (urgency) {
    case 'high':
      return 'danger'
    case 'medium':
      return 'warning'
    case 'low':
      return 'accent'
    default:
      return 'neutral'
  }
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
      <AdminInboxState
        title={t('adminInbox.unavailableTitle')}
        copy={t('adminInbox.unavailableCopy')}
        tone="danger"
      />
    )
  }

  if (inboxQuery.isLoading) {
    return (
      <AdminInboxState
        title={t('adminInbox.loadingTitle')}
        copy={t('adminInbox.loadingCopy')}
        isLoading
      />
    )
  }

  if (inboxQuery.isError) {
    return (
      <AdminInboxState
        title={t('adminInbox.unavailableTitle')}
        copy={getErrorMessage(inboxQuery.error)}
        tone="danger"
      />
    )
  }

  return (
    <AdminSurfacePage ariaLabel={t('adminInbox.heroTitle')}>
      <AdminSurfaceHeader
        eyebrow={t('adminInbox.heroEyebrow')}
        title={t('adminInbox.heroTitle')}
        description={t('adminInbox.heroCopy')}
        icon={<Bell size={18} />}
        meta={
          <>
            <AdminSurfaceBadge tone={pendingItems.length > 0 ? 'warning' : 'success'}>
              {t('adminInbox.needsAttention')}: {pendingItems.length}
            </AdminSurfaceBadge>
            <AdminSurfaceBadge tone="cyan">{regionScope}</AdminSurfaceBadge>
          </>
        }
      />

      <AdminMetricStrip
        className="tw:xl:grid-cols-3"
        items={[
          {
            id: 'queueItems',
            label: t('adminInbox.queueItems'),
            value: String(items.length),
            description: t('adminInbox.regionScope'),
            trend: regionScope,
            tone: 'cyan',
          },
          {
            id: 'needsAttention',
            label: t('adminInbox.needsAttention'),
            value: pendingItems.length,
            description: t('adminInbox.needsAttentionNote'),
            icon: <Bell size={18} />,
            tone: pendingItems.length > 0 ? 'warning' : 'success',
          },
          {
            id: 'approvals',
            label: t('adminInbox.approvals'),
            value: approvalItems.length,
            description: t('adminInbox.approvalsNote'),
            icon: <ReceiptText size={18} />,
            tone: approvalItems.length > 0 ? 'accent' : 'neutral',
          },
          {
            id: 'kpiTasks',
            label: t('adminInbox.kpiTasks'),
            value: taskItems.length,
            description: t('adminInbox.kpiTasksNote'),
            icon: <TrendingUp size={18} />,
            tone: taskItems.length > 0 ? 'warning' : 'neutral',
          },
          {
            id: 'completed',
            label: t('adminInbox.completed'),
            value: items.filter((item) => item.inboxStatus === 'completed').length,
            description: t('adminInbox.completedNote'),
            icon: <CheckCircle2 size={18} />,
            tone: 'success',
          },
          {
            id: 'sellerCode',
            label: t('adminInbox.sellerCode'),
            value: sellerCodeRequests.length,
            description: t('adminInbox.sellerCodeNote'),
            icon: <KeyRound size={18} />,
            tone: sellerCodeRequests.length > 0 ? 'warning' : 'neutral',
          },
          {
            id: 'offboarding',
            label: t('adminInbox.offboarding'),
            value: offboardingRequests.length,
            description: t('adminInbox.offboardingNote'),
            icon: <KeyRound size={18} />,
            tone: offboardingRequests.length > 0 ? 'warning' : 'neutral',
          },
        ]}
      />

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

      <AdminSurfaceSection
        eyebrow={t('adminInbox.adminQueueEyebrow')}
        title={t('adminInbox.adminQueueTitle')}
        badge={
          <StatusPill tone={sortedItems.length > 0 ? 'warning' : 'calm'}>
            {sortedItems.length}
          </StatusPill>
        }
      >
        {sortedItems.length === 0 ? (
          <EmptyState
            title={t('adminInbox.emptyQueueTitle')}
            copy={t('adminInbox.emptyQueueCopy')}
          />
        ) : (
          <div className="tw:grid tw:gap-3">
            {sortedItems.map((item) => (
              <AdminInboxRow key={`${item.sourceType}:${item.sourceId}`} item={item} />
            ))}
          </div>
        )}
      </AdminSurfaceSection>
    </AdminSurfacePage>
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
    <AdminSurfaceSection
      ariaLabel={t('adminInbox.sellerQueueAria')}
      eyebrow={t('adminInbox.workforceEyebrow')}
      title={t('adminInbox.sellerQueueTitle')}
      description={t('adminInbox.sellerQueueCopy')}
      badge={
        <StatusPill tone={input.requests.length > 0 ? 'warning' : 'calm'}>
          {input.requests.length}
        </StatusPill>
      }
      actions={
        <AdminKeyValueGrid className="tw:min-w-[18rem] tw:grid-cols-2 tw:sm:grid-cols-2 tw:lg:grid-cols-2">
          <KeyValue
            label={t('adminInbox.lastFranchiseCode')}
            value={input.reference?.lastSellerCode ?? t('adminInbox.noFmCode')}
          />
          <KeyValue
            label={t('adminInbox.nextPreview')}
            value={input.reference?.nextSellerCodePreview ?? t('adminInbox.notAvailable')}
          />
        </AdminKeyValueGrid>
      }
    >

      {input.notice ? (
        <AdminStatePanel title={input.notice} tone="accent" />
      ) : null}

      {input.referenceLoading || input.requestsLoading ? (
        <AdminStatePanel title={t('adminInbox.loadingSellerRequests')} isLoading />
      ) : input.referenceError ? (
        <AdminStatePanel title={getErrorMessage(input.referenceError)} tone="danger" />
      ) : input.requestsError ? (
        <AdminStatePanel title={getErrorMessage(input.requestsError)} tone="danger" />
      ) : input.requests.length === 0 ? (
        <EmptyState
          title={t('adminInbox.noSellerRequestsTitle')}
          copy={t('adminInbox.noSellerRequestsCopy')}
        />
      ) : (
        <div className="tw:grid tw:gap-3">
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
    </AdminSurfaceSection>
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
    <article className="tw:grid tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-background/65 tw:p-3">
      <div className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-start tw:md:justify-between">
        <div>
          <strong className="tw:text-sm tw:font-semibold tw:text-foreground">{displayName}</strong>
          <p className="tw:mt-1 tw:text-xs tw:leading-5 tw:text-muted-foreground">
            {t('adminInbox.referenceLine', {
              storeName: input.item.storeName,
              storeType: input.item.storeType,
              reference: input.item.lastReferenceSellerCode ?? t('adminInbox.none'),
            })}
          </p>
        </div>
        <StatusPill tone="warning">{formatTranslatedState(input.item.status, t)}</StatusPill>
      </div>

      <AdminKeyValueGrid>
        <KeyValue label={t('adminInbox.position')} value={input.item.positionName} />
        <KeyValue label={t('adminInbox.nationalIdLast4')} value={input.item.nationalIdLast4} />
        <KeyValue label={t('adminInbox.phone')} value={input.item.phoneNumber} />
        <KeyValue label={t('adminInbox.hireDate')} value={input.item.hireDate} />
      </AdminKeyValueGrid>

      <div className="tw:grid tw:gap-3 tw:md:grid-cols-[minmax(0,1fr)_auto] tw:md:items-end">
        <label className="tw:grid tw:gap-1.5 tw:text-xs tw:font-medium tw:text-muted-foreground">
          {t('adminInbox.sellerCodeField')}
          <Input
            aria-label={t('adminInbox.sellerCodeInputAria', { displayName })}
            value={input.draftCode}
            onChange={(event) => input.onDraftChange(input.item.requestId, event.target.value)}
          />
        </label>
        <div className="tw:grid tw:gap-1.5 tw:text-xs tw:font-medium tw:text-muted-foreground">
          <span>{t('adminInbox.manualControl')}</span>
          <Button
            type="button"
            disabled={input.approvePending || !input.draftCode.trim()}
            onClick={() => input.onApprove(input.item.requestId, input.draftCode.trim())}
          >
            {t('adminInbox.approveSellerCode')}
          </Button>
        </div>
      </div>

      <div className="tw:grid tw:gap-3 tw:md:grid-cols-[minmax(0,1fr)_auto] tw:md:items-end">
        <label className="tw:grid tw:gap-1.5 tw:text-xs tw:font-medium tw:text-muted-foreground">
          {t('adminInbox.returnNote')}
          <Textarea
            aria-label={t('adminInbox.returnNoteForAria', { displayName })}
            rows={2}
            value={input.returnNote}
            onChange={(event) => input.onReturnNoteChange(input.item.requestId, event.target.value)}
          />
        </label>
        <div className="tw:grid tw:gap-1.5 tw:text-xs tw:font-medium tw:text-muted-foreground">
          <span>{t('adminInbox.storeCorrection')}</span>
          <Button
            type="button"
            variant="outline"
            disabled={input.rejectPending || !input.returnNote.trim()}
            onClick={() => input.onReject(input.item.requestId, input.returnNote.trim())}
          >
            {t('adminInbox.returnSellerCode')}
          </Button>
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
    <AdminSurfaceSection
      ariaLabel={t('adminInbox.offboardingQueueAria')}
      eyebrow={t('adminInbox.workforceEyebrow')}
      title={t('adminInbox.offboardingQueueTitle')}
      description={t('adminInbox.offboardingQueueCopy')}
      badge={
        <StatusPill tone={input.requests.length > 0 ? 'warning' : 'calm'}>
          {input.requests.length}
        </StatusPill>
      }
    >

      {input.loading ? (
        <AdminStatePanel title={t('adminInbox.loadingOffboardingRequests')} isLoading />
      ) : input.error ? (
        <AdminStatePanel title={getErrorMessage(input.error)} tone="danger" />
      ) : input.requests.length === 0 ? (
        <EmptyState
          title={t('adminInbox.noOffboardingRequestsTitle')}
          copy={t('adminInbox.noOffboardingRequestsCopy')}
        />
      ) : (
        <div className="tw:grid tw:gap-3">
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
    </AdminSurfaceSection>
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
    <article className="tw:grid tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-background/65 tw:p-3">
      <div className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-start tw:md:justify-between">
        <div>
          <strong className="tw:text-sm tw:font-semibold tw:text-foreground">{input.item.displayName}</strong>
          <p className="tw:mt-1 tw:text-xs tw:leading-5 tw:text-muted-foreground">
            {input.item.storeName} / {input.item.externalEmployeeRef ?? t('adminInbox.noSellerCode')}
          </p>
        </div>
        <StatusPill tone="warning">{formatTranslatedState(input.item.status, t)}</StatusPill>
      </div>

      <AdminKeyValueGrid>
        <KeyValue label={t('adminInbox.position')} value={input.item.positionName ?? t('adminInbox.noPosition')} />
        <KeyValue label={t('adminInbox.exitDate')} value={input.item.terminationDate} />
        <KeyValue label={t('adminInbox.reason')} value={input.item.terminationReason} />
        <KeyValue label={t('adminInbox.requestNote')} value={input.item.requestReason ?? t('adminInbox.noNote')} />
      </AdminKeyValueGrid>

      <div className="tw:grid tw:gap-3 tw:lg:grid-cols-[auto_minmax(0,1fr)_auto] tw:lg:items-end">
        <div className="tw:grid tw:gap-1.5 tw:text-xs tw:font-medium tw:text-muted-foreground">
          <span>{t('adminInbox.manualControl')}</span>
          <Button
            type="button"
            disabled={input.approvePending}
            onClick={() => input.onApprove(input.item.requestId)}
          >
            {t('adminInbox.approveOffboarding')}
          </Button>
        </div>
        <label className="tw:grid tw:gap-1.5 tw:text-xs tw:font-medium tw:text-muted-foreground">
          {t('adminInbox.returnNote')}
          <Textarea
            aria-label={t('adminInbox.returnNoteForAria', { displayName: input.item.displayName })}
            rows={2}
            value={input.returnNote}
            onChange={(event) => input.onReturnNoteChange(input.item.requestId, event.target.value)}
          />
        </label>
        <div className="tw:grid tw:gap-1.5 tw:text-xs tw:font-medium tw:text-muted-foreground">
          <span>{t('adminInbox.storeCorrection')}</span>
          <Button
            type="button"
            variant="outline"
            disabled={input.rejectPending || !input.returnNote.trim()}
            onClick={() => input.onReject(input.item.requestId, input.returnNote.trim())}
          >
            {t('adminInbox.returnOffboarding')}
          </Button>
        </div>
      </div>
    </article>
  )
}

function AdminInboxRow(input: { item: WorkflowInboxItem }) {
  const { locale, t } = useLocalization()

  return (
    <article className="tw:grid tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-background/65 tw:p-3">
      <div className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-start tw:md:justify-between">
        <div>
          <strong className="tw:text-sm tw:font-semibold tw:text-foreground">{input.item.title}</strong>
          <p className="tw:mt-1 tw:text-xs tw:leading-5 tw:text-muted-foreground">{input.item.summary}</p>
        </div>
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          <StatusPill tone="accent">{formatWorkflowSourceTypeLabel(input.item.sourceType, t)}</StatusPill>
          <StatusPill tone={mapInboxStatusTone(input.item.inboxStatus)}>
            {formatTranslatedState(input.item.inboxStatus, t)}
          </StatusPill>
          <StatusPill tone={mapWorkflowUrgencyTone(input.item.urgency)}>
            {formatTranslatedState(input.item.urgency, t)}
          </StatusPill>
        </div>
      </div>

      <AdminKeyValueGrid>
        <KeyValue label={t('storeTasks.workType')} value={formatWorkflowItemTypeLabel(input.item.itemType, t)} />
        <KeyValue label={t('storeTasks.actorRole')} value={formatState(input.item.actorRole)} />
        <KeyValue label={t('storeTasks.store')} value={input.item.storeName || input.item.storeId} />
        <KeyValue
          label={t('storeTasks.actionTime')}
          value={input.item.needsAttentionAt ? formatDateTime(input.item.needsAttentionAt, locale) : t('storeTasks.now')}
        />
      </AdminKeyValueGrid>

      {input.item.historyPreview ? (
        <p className="tw:text-xs tw:leading-5 tw:text-muted-foreground">{input.item.historyPreview}</p>
      ) : null}

      <WorkflowInboxDetail item={input.item} />

      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <Button asChild>
          <Link to={input.item.deepLink}>{input.item.primaryActionLabel}</Link>
        </Button>
      </div>
    </article>
  )
}
