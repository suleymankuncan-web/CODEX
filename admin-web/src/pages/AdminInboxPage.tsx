import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCircle2, Inbox, ReceiptText, RefreshCw } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Skeleton } from '../components/ui/skeleton'
import { AdminStatePanel, AdminSurfacePage } from './admin-surface-primitives'
import { AdminAzureHeader } from './admin-azure-header'
import { AdminInboxWorkflow } from './admin-inbox-workflow'
import { InboxQueueError, OffboardingQueuePanel, SellerCodeQueuePanel } from './admin-inbox-workforce'
import { PersonnelCorrectionQueue } from '../features/workforce/personnel-corrections'
import { getStoreQueryScopeSignature } from '../features/auth/store-query-scope'
import type { AuthSessionSummary } from '../features/auth/api'
import { getWorkflowInbox } from '../features/workflow/api'
import { useLocalization } from '../features/localization/useLocalization'
import type { TranslateFunction } from '../features/localization/dictionary'
import {
  approveOffboardingRequest, approveSellerCodeRequest, getOffboardingRequests,
  getSellerCodeReference, getSellerCodeRequests, rejectOffboardingRequest,
  rejectSellerCodeRequest, type OffboardingAccessClosure,
} from '../features/workforce/api'
import { transientQueryRetryOptions } from '../lib/query-retry'
import { actionToast } from '../lib/action-toast'
import './admin-inbox.css'

function canUseAdminInbox(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('SUPER_ADMIN') || roles.includes('REPORT_VIEWER') || roles.includes('HR_ADMIN')
}

function canUseSellerCodeQueue(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('SUPER_ADMIN') || roles.includes('HR_ADMIN')
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
  const [sellerCodeDrafts, setSellerCodeDrafts] = useState<Record<string, string>>({})
  const [sellerCodeReturnNotes, setSellerCodeReturnNotes] = useState<Record<string, string>>({})
  const [offboardingReturnNotes, setOffboardingReturnNotes] = useState<Record<string, string>>({})

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
      actionToast.success(response.command.message)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['seller-code-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['seller-code-reference'] }),
      ])
    },
    onError: (error) => {
      actionToast.error(error, t('adminInbox.commandFailed'))
    },
  })
  const approveOffboardingMutation = useMutation({
    mutationFn: approveOffboardingRequest,
    onSuccess: async (response) => {
      const accessClosureCopy = formatOffboardingAccessClosure(response.data.accessClosure, t)
      actionToast.success(
        accessClosureCopy
          ? `İşten ayrılma talebi onaylandı. ${accessClosureCopy}`
          : 'İşten ayrılma talebi onaylandı.',
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['offboarding-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['workforce-store-employees'] }),
      ])
    },
    onError: (error) => {
      actionToast.error(error, t('adminInbox.commandFailed'))
    },
  })
  const rejectSellerCodeMutation = useMutation({
    mutationFn: rejectSellerCodeRequest,
    onSuccess: async (response) => {
      actionToast.success(response.command.message)
      await queryClient.invalidateQueries({ queryKey: ['seller-code-requests'] })
    },
    onError: (error) => {
      actionToast.error(error, t('adminInbox.commandFailed'))
    },
  })
  const rejectOffboardingMutation = useMutation({
    mutationFn: rejectOffboardingRequest,
    onSuccess: async (response) => {
      actionToast.success(response.command.message)
      await queryClient.invalidateQueries({ queryKey: ['offboarding-requests'] })
    },
    onError: (error) => {
      actionToast.error(error, t('adminInbox.commandFailed'))
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

  const sellerCodeRequests = sellerCodeRequestsQuery.data?.items ?? []
  const offboardingRequests = offboardingRequestsQuery.data?.items ?? []
  const metrics = [
    { id: 'queueItems', label: t('adminInbox.queueItems'), value: items.length, icon: Inbox },
    { id: 'needsAttention', label: t('adminInbox.needsAttention'), value: items.filter(item => item.inboxStatus === 'needs_attention').length, icon: Bell },
    { id: 'approvals', label: t('adminInbox.approvals'), value: items.filter(item => item.itemType === 'approval').length, icon: ReceiptText },
    { id: 'completed', label: t('adminInbox.completed'), value: items.filter(item => item.inboxStatus === 'completed').length, icon: CheckCircle2 },
  ]

  if (!inboxEnabled) return <AdminSurfacePage className="admin-inbox-page" ariaLabel={t('adminInbox.unavailableTitle')}><AdminStatePanel title={t('adminInbox.unavailableTitle')} description={t('adminInbox.unavailableCopy')} tone="danger" /></AdminSurfacePage>

  return <AdminSurfacePage className="admin-inbox-page" ariaLabel={t('adminInbox.heroTitle')}>
    <AdminAzureHeader title={t('adminInbox.heroTitle')} description={t('adminInbox.heroCopy')} icon={<Inbox aria-hidden="true" />} actions={
      <Button variant="outline" disabled={inboxQuery.isFetching || sellerCodeRequestsQuery.isFetching || offboardingRequestsQuery.isFetching || sellerCodeReferenceQuery.isFetching} onClick={() => {
        void inboxQuery.refetch()
        if (sellerCodeEnabled) { void sellerCodeReferenceQuery.refetch(); void sellerCodeRequestsQuery.refetch(); void offboardingRequestsQuery.refetch(); void queryClient.invalidateQueries({ queryKey: ['personnel-corrections'] }) }
      }}><RefreshCw data-icon="inline-start" />{t('adminInbox.refresh')}</Button>
    } />
    <div className="admin-inbox-metrics" aria-label={t('adminInbox.summary')}>
      {metrics.map(metric => <div key={metric.id} className="admin-inbox-metric" data-testid={`admin-metric-${metric.id}`}><metric.icon aria-hidden="true" /><div><h2>{metric.label}</h2>{inboxQuery.isPending ? <Skeleton className="tw:h-7 tw:w-10" /> : <strong>{inboxQuery.isError ? t('adminInbox.unavailableValue') : metric.value}</strong>}</div></div>)}
    </div>
    <div className="admin-inbox-board"><Tabs defaultValue="workflow">
      <TabsList aria-label={t('adminInbox.queues')} className="admin-inbox-tabs">
        <TabsTrigger value="workflow">{t('adminInbox.workflowTab')}</TabsTrigger>
        {sellerCodeEnabled ? <><TabsTrigger value="seller-code">{t('adminInbox.sellerCode')}</TabsTrigger><TabsTrigger value="offboarding">{t('adminInbox.offboarding')}</TabsTrigger><TabsTrigger value="corrections">{t('adminInbox.correctionsTab')}</TabsTrigger></> : null}
      </TabsList>
      <TabsContent forceMount value="workflow" className="admin-inbox-tab-panel">
        {inboxQuery.isPending ? <AdminStatePanel title={t('adminInbox.loadingTitle')} description={t('adminInbox.loadingCopy')} isLoading /> : inboxQuery.isError ? <InboxQueueError error={inboxQuery.error} onRetry={() => { void inboxQuery.refetch() }} /> : <AdminInboxWorkflow items={sortedItems} />}
      </TabsContent>
      {sellerCodeEnabled ? <>
        <TabsContent forceMount value="seller-code" className="admin-inbox-tab-panel">
        <SellerCodeQueuePanel
          onRetry={() => { void sellerCodeRequestsQuery.refetch(); void sellerCodeReferenceQuery.refetch() }}
          approvePending={approveSellerCodeMutation.isPending}
          drafts={sellerCodeDrafts}
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
        </TabsContent>
        <TabsContent forceMount value="offboarding" className="admin-inbox-tab-panel">
        <OffboardingQueuePanel
          onRetry={() => { void offboardingRequestsQuery.refetch() }}
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
        </TabsContent>
        <TabsContent forceMount value="corrections" className="admin-inbox-tab-panel admin-inbox-corrections"><PersonnelCorrectionQueue key={getStoreQueryScopeSignature(input.authSummary)} scopeKey={getStoreQueryScopeSignature(input.authSummary)} review /></TabsContent>
      </> : null}
    </Tabs></div>
  </AdminSurfacePage>
}
