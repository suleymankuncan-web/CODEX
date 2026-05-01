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
  formatWorkflowItemType,
  formatWorkflowSourceType,
  mapInboxStatusTone,
  mapWorkflowUrgencyTone,
  type WorkflowInboxItem,
} from '../features/workflow/contracts'
import {
  approveOffboardingRequest,
  approveSellerCodeRequest,
  getOffboardingRequests,
  getSellerCodeReference,
  getSellerCodeRequests,
  rejectOffboardingRequest,
  rejectSellerCodeRequest,
  type OffboardingAccessClosure,
} from '../features/workforce/api'
import { formatDateTime, formatState, getErrorMessage } from '../lib/format'

function canUseAdminInbox(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('SUPER_ADMIN') || roles.includes('REPORT_VIEWER') || roles.includes('HR_ADMIN')
}

function canUseSellerCodeQueue(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('SUPER_ADMIN') || roles.includes('HR_ADMIN')
}

function formatOffboardingAccessClosure(closure?: OffboardingAccessClosure | null) {
  if (!closure) {
    return null
  }

  if (!closure.userAccessClosed) {
    return 'No linked user account was found. Employee record was terminated.'
  }

  return `User access closed: ${closure.closedRoleAssignments} role grants, ${closure.closedActionStoreAssignments} action store grants, ${closure.revokedMobileSessions} mobile sessions.`
}

export function AdminInboxPage(input: { authSummary: AuthSessionSummary | null }) {
  const queryClient = useQueryClient()
  const inboxEnabled = canUseAdminInbox(input.authSummary)
  const sellerCodeEnabled = canUseSellerCodeQueue(input.authSummary)
  const regionScope = input.authSummary?.user.scope.regionIds.join(', ') || 'No region scope'
  const [sellerCodeDrafts, setSellerCodeDrafts] = useState<Record<string, string>>({})
  const [sellerCodeReturnNotes, setSellerCodeReturnNotes] = useState<Record<string, string>>({})
  const [offboardingReturnNotes, setOffboardingReturnNotes] = useState<Record<string, string>>({})
  const [sellerCodeNotice, setSellerCodeNotice] = useState<string | null>(null)

  const inboxQuery = useQuery({
    queryKey: ['workflow-inbox', 'admin'],
    queryFn: getWorkflowInbox,
    enabled: inboxEnabled,
    retry: false,
  })
  const sellerCodeReferenceQuery = useQuery({
    queryKey: ['seller-code-reference', 'franchise'],
    queryFn: getSellerCodeReference,
    enabled: sellerCodeEnabled,
  })
  const sellerCodeRequestsQuery = useQuery({
    queryKey: ['seller-code-requests', 'pending_hr_approval'],
    queryFn: () => getSellerCodeRequests({ status: 'pending_hr_approval' }),
    enabled: sellerCodeEnabled,
  })
  const offboardingRequestsQuery = useQuery({
    queryKey: ['offboarding-requests', 'pending_hr_approval'],
    queryFn: () => getOffboardingRequests({ status: 'pending_hr_approval' }),
    enabled: sellerCodeEnabled,
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
      const accessClosureCopy = formatOffboardingAccessClosure(response.data.accessClosure)
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

    return [...items].sort((left, right) => {
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
        title="Admin inbox unavailable"
        copy="Bu yüzey raporlama veya yönetici rolü gerektirir."
        tone="error"
      />
    )
  }

  if (inboxQuery.isLoading) {
    return (
      <ScreenState
        title="Loading admin inbox"
        copy="Approvals ve KPI exception item'lari tek kuyrukta toplanıyor."
      />
    )
  }

  if (inboxQuery.isError) {
    return (
      <ScreenState
        title="Admin inbox unavailable"
        copy={getErrorMessage(inboxQuery.error)}
        tone="error"
      />
    )
  }

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">Admin Inbox</div>
          <h2 className="hero-title">One queue for admin-side approvals and KPI follow-up.</h2>
          <p className="hero-copy">
            Store tarafında kullandığımız ortak workflow dili şimdi admin yüzeyine de taşındı.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Route" value="/admin/inbox" />
          <MetricAccent label="Region scope" value={regionScope} />
          <MetricAccent label="Queue items" value={String(items.length)} />
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard
          title="Needs attention"
          value={pendingItems.length}
          note="Şu an aksiyon bekleyen iş sayısı."
          icon={<Bell size={18} />}
          tone={pendingItems.length > 0 ? 'warning' : 'calm'}
        />
        <MetricCard
          title="Approvals"
          value={approvalItems.length}
          note="Region onayı bekleyen target dağıtım talepleri."
          icon={<ReceiptText size={18} />}
          tone={approvalItems.length > 0 ? 'accent' : 'neutral'}
        />
        <MetricCard
          title="KPI tasks"
          value={taskItems.length}
          note="KPI exception’dan üretilen takip işleri."
          icon={<TrendingUp size={18} />}
          tone={taskItems.length > 0 ? 'warning' : 'neutral'}
        />
        <MetricCard
          title="Completed"
          value={items.filter((item) => item.inboxStatus === 'completed').length}
          note="Bu queue slice içinde kapanmış işler."
          icon={<CheckCircle2 size={18} />}
          tone="calm"
        />
        <MetricCard
          title="Seller code"
          value={sellerCodeRequests.length}
          note="HR onayi bekleyen satici kodu talepleri."
          icon={<KeyRound size={18} />}
          tone={sellerCodeRequests.length > 0 ? 'warning' : 'neutral'}
        />
        <MetricCard
          title="Offboarding"
          value={offboardingRequests.length}
          note="HR onayi bekleyen personel cikis talepleri."
          icon={<KeyRound size={18} />}
          tone={offboardingRequests.length > 0 ? 'warning' : 'neutral'}
        />
      </section>

      {sellerCodeEnabled ? (
        <section className="panel" aria-label="Seller code approval queue">
          <div className="panel-heading panel-heading-spread">
            <div>
              <div className="eyebrow">Workforce master data</div>
              <h3>Seller code approval queue</h3>
              <p className="panel-copy">
                Franchise codes stay manual. The latest FM code is shown as a reference, then HR enters the approved code.
              </p>
            </div>
            <div className="hero-metrics compact-metrics">
              <MetricAccent
                label="Last franchise code"
                value={sellerCodeReferenceQuery.data?.lastSellerCode ?? 'No FM code'}
              />
              <MetricAccent
                label="Next preview"
                value={sellerCodeReferenceQuery.data?.nextSellerCodePreview ?? 'n/a'}
              />
            </div>
          </div>

          {sellerCodeNotice ? (
            <div className="inline-state inline-state-accent">{sellerCodeNotice}</div>
          ) : null}

          {sellerCodeReferenceQuery.isLoading || sellerCodeRequestsQuery.isLoading ? (
            <div className="inline-state inline-state-neutral">Loading seller code requests...</div>
          ) : sellerCodeReferenceQuery.isError ? (
            <div className="inline-state inline-state-danger">{getErrorMessage(sellerCodeReferenceQuery.error)}</div>
          ) : sellerCodeRequestsQuery.isError ? (
            <div className="inline-state inline-state-danger">{getErrorMessage(sellerCodeRequestsQuery.error)}</div>
          ) : sellerCodeRequests.length === 0 ? (
            <EmptyState
              title="No seller code requests are pending."
              copy="Store manager requests will land here before HR approval."
            />
          ) : (
            <div className="stacked-table">
              {sellerCodeRequests.map((item) => {
                const displayName = `${item.firstName} ${item.lastName}`.trim()
                const draftCode =
                  sellerCodeDrafts[item.requestId] ??
                  item.requestedSellerCode ??
                  sellerCodeReferenceQuery.data?.nextSellerCodePreview ??
                  ''
                const returnNote = sellerCodeReturnNotes[item.requestId] ?? ''

                return (
                  <article className="stacked-row" key={item.requestId}>
                    <div className="stacked-row-head">
                      <div>
                        <strong>{displayName}</strong>
                        <p className="queue-subtitle">
                          {item.storeName} / {item.storeType} / reference {item.lastReferenceSellerCode ?? 'none'}
                        </p>
                      </div>
                      <StatusPill tone="warning">{formatState(item.status)}</StatusPill>
                    </div>

                    <div className="key-grid">
                      <KeyValue label="Pozisyon" value={item.positionName} />
                      <KeyValue label="TC son 4" value={item.nationalIdLast4} />
                      <KeyValue label="Telefon" value={item.phoneNumber} />
                      <KeyValue label="Ise giris" value={item.hireDate} />
                    </div>

                    <div className="form-grid">
                      <label className="field-block">
                        <span>Seller code</span>
                        <input
                          aria-label={`${displayName} seller code`}
                          value={draftCode}
                          onChange={(event) =>
                            setSellerCodeDrafts((current) => ({
                              ...current,
                              [item.requestId]: event.target.value.toUpperCase(),
                            }))
                          }
                        />
                      </label>
                      <div className="field-block">
                        <span>Manual control</span>
                        <button
                          className="control-button"
                          type="button"
                          disabled={approveSellerCodeMutation.isPending || !draftCode.trim()}
                          onClick={() =>
                            approveSellerCodeMutation.mutate({
                              requestId: item.requestId,
                              sellerCode: draftCode.trim(),
                              reviewNote: 'Approved from admin inbox',
                            })
                          }
                        >
                          Approve seller code
                        </button>
                      </div>
                    </div>

                    <div className="form-grid">
                      <label className="field-block">
                        <span>Return note</span>
                        <textarea
                          aria-label={`Return note for ${displayName}`}
                          rows={2}
                          value={returnNote}
                          onChange={(event) =>
                            setSellerCodeReturnNotes((current) => ({
                              ...current,
                              [item.requestId]: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <div className="field-block">
                        <span>Store correction</span>
                        <button
                          className="control-button"
                          type="button"
                          disabled={rejectSellerCodeMutation.isPending || !returnNote.trim()}
                          onClick={() =>
                            rejectSellerCodeMutation.mutate({
                              requestId: item.requestId,
                              reviewNote: returnNote.trim(),
                            })
                          }
                        >
                          Return seller code request
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      ) : null}

      {sellerCodeEnabled ? (
        <section className="panel" aria-label="Offboarding approval queue">
          <div className="panel-heading panel-heading-spread">
            <div>
              <div className="eyebrow">Workforce master data</div>
              <h3>Offboarding approval queue</h3>
              <p className="panel-copy">
                Store manager requests close only after HR approval. Approval terminates the employee and closes the active assignment.
              </p>
            </div>
          </div>

          {offboardingRequestsQuery.isLoading ? (
            <div className="inline-state inline-state-neutral">Loading offboarding requests...</div>
          ) : offboardingRequestsQuery.isError ? (
            <div className="inline-state inline-state-danger">{getErrorMessage(offboardingRequestsQuery.error)}</div>
          ) : offboardingRequests.length === 0 ? (
            <EmptyState
              title="No offboarding requests are pending."
              copy="Store manager exit requests will land here before HR approval."
            />
          ) : (
            <div className="stacked-table">
              {offboardingRequests.map((item) => {
                const returnNote = offboardingReturnNotes[item.requestId] ?? ''

                return (
                  <article className="stacked-row" key={item.requestId}>
                    <div className="stacked-row-head">
                      <div>
                        <strong>{item.displayName}</strong>
                        <p className="queue-subtitle">
                          {item.storeName} / {item.externalEmployeeRef ?? 'no seller code'}
                        </p>
                      </div>
                      <StatusPill tone="warning">{formatState(item.status)}</StatusPill>
                    </div>

                    <div className="key-grid">
                      <KeyValue label="Pozisyon" value={item.positionName ?? 'No position'} />
                      <KeyValue label="Cikis tarihi" value={item.terminationDate} />
                      <KeyValue label="Sebep" value={item.terminationReason} />
                      <KeyValue label="Talep notu" value={item.requestReason ?? 'No note'} />
                    </div>

                    <div className="form-grid">
                      <div className="field-block">
                        <span>Manual control</span>
                        <button
                          className="control-button"
                          type="button"
                          disabled={approveOffboardingMutation.isPending}
                          onClick={() =>
                            approveOffboardingMutation.mutate({
                              requestId: item.requestId,
                              reviewNote: 'Approved from admin inbox',
                            })
                          }
                        >
                          Approve offboarding
                        </button>
                      </div>
                      <label className="field-block">
                        <span>Return note</span>
                        <textarea
                          aria-label={`Return note for ${item.displayName}`}
                          rows={2}
                          value={returnNote}
                          onChange={(event) =>
                            setOffboardingReturnNotes((current) => ({
                              ...current,
                              [item.requestId]: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <div className="field-block">
                        <span>Store correction</span>
                        <button
                          className="control-button"
                          type="button"
                          disabled={rejectOffboardingMutation.isPending || !returnNote.trim()}
                          onClick={() =>
                            rejectOffboardingMutation.mutate({
                              requestId: item.requestId,
                              reviewNote: returnNote.trim(),
                            })
                          }
                        >
                          Return offboarding request
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Admin Queue</div>
            <h3>Shared workflow contract in admin shell</h3>
          </div>
        </div>

        {sortedItems.length === 0 ? (
          <EmptyState
            title="No admin-side queue items"
            copy="Approval veya KPI review işi düştüğünde burada görünecek."
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

function AdminInboxRow(input: { item: WorkflowInboxItem }) {
  return (
    <article className="stacked-row">
      <div className="stacked-row-head">
        <div>
          <strong>{input.item.title}</strong>
          <p className="queue-subtitle">{input.item.summary}</p>
        </div>
        <div className="action-cluster">
          <StatusPill tone="accent">{formatWorkflowSourceType(input.item.sourceType)}</StatusPill>
          <StatusPill tone={mapInboxStatusTone(input.item.inboxStatus)}>
            {formatState(input.item.inboxStatus)}
          </StatusPill>
          <StatusPill tone={mapWorkflowUrgencyTone(input.item.urgency)}>
            {formatState(input.item.urgency)}
          </StatusPill>
        </div>
      </div>

      <div className="key-grid">
        <KeyValue label="İş tipi" value={formatWorkflowItemType(input.item.itemType)} />
        <KeyValue label="Actor role" value={formatState(input.item.actorRole)} />
        <KeyValue label="Store" value={input.item.storeName || input.item.storeId} />
        <KeyValue
          label="Aksiyon zamanı"
          value={input.item.needsAttentionAt ? formatDateTime(input.item.needsAttentionAt) : 'Now'}
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
