import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock3, ReceiptText, ShieldCheck } from 'lucide-react'
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
import {
  canCreateTargetDistributionRequest,
  canListTargetDistributionRequests,
  getAssignedStoreIds,
  getReadStoreIds,
} from '../features/auth/authorization'
import {
  createTargetDistributionRequest,
  getStoreTargetingPersonnel,
  getTargetDistributionRequests,
  type TargetDistributionAllocation,
} from '../features/targets/api'
import { formatDate, formatDateTime, formatState, getErrorMessage } from '../lib/format'

export function StoreApprovalsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const queryClient = useQueryClient()
  const user = input.authSummary?.user
  const assignedStoreIds = getAssignedStoreIds(input.authSummary)
  const readStoreIds = getReadStoreIds(input.authSummary)
  const primaryStoreId = assignedStoreIds[0] ?? null
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const storeId = selectedStoreId || primaryStoreId || ''
  const canListRequests = canListTargetDistributionRequests(input.authSummary)
  const canCreateForStore = canCreateTargetDistributionRequest(input.authSummary, storeId || null)
  const [requestMonth, setRequestMonth] = useState(new Date().toISOString().slice(0, 7))
  const [targetLabel, setTargetLabel] = useState('Aylik personel hedef dagitimi')
  const [totalTargetValue, setTotalTargetValue] = useState('0')
  const [requestReason, setRequestReason] = useState('')
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null)
  const [allocations, setAllocations] = useState<Array<TargetDistributionAllocation>>([
    { assigneeLabel: '', targetValue: 0, note: '' },
  ])

  const requestsQuery = useQuery({
    queryKey: ['target-distribution-requests', 'store-shell'],
    queryFn: () => getTargetDistributionRequests(),
    enabled: canListRequests,
  })
  const personnelQuery = useQuery({
    queryKey: ['store-targeting-personnel', storeId],
    queryFn: () => getStoreTargetingPersonnel(storeId),
    enabled: canCreateForStore,
  })

  const createMutation = useMutation({
    mutationFn: createTargetDistributionRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['target-distribution-requests'] })
      setTargetLabel('Aylik personel hedef dagitimi')
      setTotalTargetValue('0')
      setRequestReason('')
      setAllocations([{ assigneeLabel: '', targetValue: 0, note: '' }])
      setSubmissionNotice(result.command.message)
    },
  })

  const activeAllocations = useMemo(() => {
    const personnel = personnelQuery.data?.items ?? []
    const canHydrateFromPersonnel =
      personnel.length > 0 &&
      allocations.every(
        (item) =>
          !item.assigneeLabel.trim() &&
          Number(item.targetValue) === 0 &&
          !(item.note ?? '').trim(),
      )

    if (!canHydrateFromPersonnel) {
      return allocations
    }

    return personnel.map((person) => ({
      assigneeLabel: person.displayName,
      targetValue: 0,
      note: '',
    }))
  }, [allocations, personnelQuery.data?.items])

  const personnelByName = useMemo(
    () =>
      new Map(
        (personnelQuery.data?.items ?? []).map((person) => [person.displayName, person] as const),
      ),
    [personnelQuery.data?.items],
  )

  if (canListRequests && requestsQuery.isLoading && !requestsQuery.data) {
    return (
      <ScreenState
        title="Loading store approvals"
        copy="Pulling target distribution requests already submitted for this store scope."
      />
    )
  }

  if (canListRequests && requestsQuery.isError) {
    return (
      <ScreenState
        title="Store approvals unavailable"
        copy={getErrorMessage(requestsQuery.error)}
        tone="error"
      />
    )
  }

  const requests = requestsQuery.data?.items ?? []
  const pendingCount = requests.filter((item) => item.status === 'pending_region_approval').length
  const approvedCount = requests.filter((item) => item.status === 'approved').length
  const allocationTotal = activeAllocations.reduce((sum, item) => sum + Number(item.targetValue || 0), 0)
  const totalsAligned = allocationTotal === Number(totalTargetValue || 0)
  const canSubmit =
    canCreateForStore &&
    Boolean(storeId) &&
    Boolean(targetLabel.trim()) &&
    Number(totalTargetValue) > 0 &&
    totalsAligned &&
    activeAllocations.every((item) => item.assigneeLabel.trim() && Number(item.targetValue) > 0)

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">Store Approvals</div>
          <h2 className="hero-title">
            Store-side target distribution requests should be submitted here, then flow to region
            approval.
          </h2>
          <p className="hero-copy">
            This is the first real write flow inside the store shell. A store manager prepares the
            person-level target split, attaches a short reason when needed, and sends it to the
            region approval queue without leaving the store-facing workflow surface.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Route" value="/store/approvals" />
          <MetricAccent label="Action store" value={primaryStoreId ?? 'No action store'} />
          <MetricAccent label="State" value="Live request flow" />
        </div>
      </section>

      <section className="metric-grid store-metric-grid">
        <MetricCard
          title="Pending approvals"
          value={pendingCount}
          note="Requests still waiting on region-side approval."
          icon={<ReceiptText size={18} />}
          tone={pendingCount > 0 ? 'warning' : 'accent'}
        />
        <MetricCard
          title="Approval intent"
          value={canCreateForStore ? 1 : 0}
          note="Submission requires a store manager or super admin role on an assigned action store."
          icon={<ShieldCheck size={18} />}
          tone={canCreateForStore ? 'calm' : 'warning'}
        />
        <MetricCard
          title="Approved requests"
          value={approvedCount}
          note="Requests already accepted on the region side."
          icon={<Clock3 size={18} />}
          tone="accent"
        />
        <MetricCard
          title="Store personnel"
          value={personnelQuery.data?.items.length ?? 0}
          note="Current personnel rows imported for this store and ready for target entry."
          icon={<CheckCircle2 size={18} />}
          tone="calm"
        />
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Future Inbox</div>
              <h3>Submit a target distribution request</h3>
            </div>
            <StatusPill tone="accent">Write flow</StatusPill>
          </div>

          {!canCreateForStore ? (
            <EmptyState
              title="Assigned action store required"
              copy="Target distribution submission is available only to STORE_MANAGER or SUPER_ADMIN sessions with this store in actionScope.assignedStoreIds."
            />
          ) : (
            <div className="stacked-table">
              <div className="stacked-row">
                <label className="eyebrow" htmlFor="store-id">
                  Store id
                </label>
                {assignedStoreIds.length > 1 ? (
                  <select
                    id="store-id"
                    value={storeId}
                    onChange={(event) => setSelectedStoreId(event.target.value)}
                  >
                    {assignedStoreIds.map((assignedStoreId) => (
                      <option key={assignedStoreId} value={assignedStoreId}>
                        {assignedStoreId}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="store-id"
                    value={storeId}
                    onChange={(event) => setSelectedStoreId(event.target.value)}
                    placeholder="Scoped store id"
                    readOnly={Boolean(primaryStoreId)}
                  />
                )}
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="request-month">
                  Request month
                </label>
                <input
                  id="request-month"
                  type="month"
                  value={requestMonth}
                  onChange={(event) => {
                    setSubmissionNotice(null)
                    setRequestMonth(event.target.value)
                  }}
                />
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="target-label">
                  Target label
                </label>
                <input
                  id="target-label"
                  value={targetLabel}
                  onChange={(event) => {
                    setSubmissionNotice(null)
                    setTargetLabel(event.target.value)
                  }}
                  placeholder="April target distribution"
                />
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="total-target-value">
                  Total target value
                </label>
                <input
                  id="total-target-value"
                  type="number"
                  min="0"
                  value={totalTargetValue}
                  onChange={(event) => {
                    setSubmissionNotice(null)
                    setTotalTargetValue(event.target.value)
                  }}
                />
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="request-reason">
                  Request reason
                </label>
                <textarea
                  id="request-reason"
                  rows={3}
                  value={requestReason}
                  onChange={(event) => {
                    setSubmissionNotice(null)
                    setRequestReason(event.target.value)
                  }}
                  placeholder="Optional note for the region approver"
                />
              </div>

              <div className="stacked-row">
                <div className="stacked-row-head">
                  <strong>Person-level target entry</strong>
                  <StatusPill tone={totalsAligned ? 'calm' : 'warning'}>
                    {`${allocationTotal}/${Number(totalTargetValue || 0)}`}
                  </StatusPill>
                </div>
                {personnelQuery.isError ? (
                  <p className="queue-subtitle">{getErrorMessage(personnelQuery.error)}</p>
                ) : null}
                {personnelQuery.isLoading ? (
                  <p className="queue-subtitle">Store personnel listesi hazirlaniyor.</p>
                ) : null}
                {!personnelQuery.isLoading && !personnelQuery.isError ? (
                  <p className="queue-subtitle">
                    Personel hedefleri magaza muduru tarafindan girilir. Personel bu alani
                    degistiremez; gonderim sonrasi bolge onayina gider.
                  </p>
                ) : null}

                <div className="stacked-table">
                  {activeAllocations.map((allocation, index) => (
                    <div className="stacked-row" key={`allocation-${index}`}>
                      {personnelByName.has(allocation.assigneeLabel) ? (
                        <div className="key-grid">
                          <KeyValue label="Personel" value={allocation.assigneeLabel || 'Unassigned'} />
                          <KeyValue
                            label="Mevcut satis"
                            value={
                              personnelByName.get(allocation.assigneeLabel)?.netSalesValue !== null &&
                              personnelByName.get(allocation.assigneeLabel)?.netSalesValue !== undefined
                                ? new Intl.NumberFormat('tr-TR', {
                                    style: 'currency',
                                    currency: 'TRY',
                                    maximumFractionDigits: 0,
                                  }).format(personnelByName.get(allocation.assigneeLabel)?.netSalesValue ?? 0)
                                : 'Veri yok'
                            }
                          />
                        </div>
                      ) : (
                        <input
                          value={allocation.assigneeLabel}
                          onChange={(event) => {
                            setSubmissionNotice(null)
                            setAllocations(
                              activeAllocations.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, assigneeLabel: event.target.value }
                                  : item,
                              ),
                            )
                          }}
                          placeholder="Personel veya rol etiketi"
                        />
                      )}
                      <input
                        type="number"
                        min="0"
                        value={allocation.targetValue}
                        onChange={(event) => {
                          setSubmissionNotice(null)
                          setAllocations(
                            activeAllocations.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, targetValue: Number(event.target.value) }
                                : item,
                            ),
                          )
                        }}
                        placeholder="Hedef degeri"
                      />
                      <input
                        value={allocation.note ?? ''}
                        onChange={(event) => {
                          setSubmissionNotice(null)
                          setAllocations(
                            activeAllocations.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, note: event.target.value } : item,
                            ),
                          )
                        }}
                        placeholder="Opsiyonel not"
                      />
                      {activeAllocations.length > 1 ? (
                        <button
                          className="control-button"
                          type="button"
                          onClick={() =>
                            setAllocations(activeAllocations.filter((_, itemIndex) => itemIndex !== index))
                          }
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>

                {!totalsAligned ? (
                  <p className="queue-subtitle">
                    Allocation toplami, toplam hedef ile ayni olmali.
                  </p>
                ) : null}

              <div className="action-cluster">
                <button
                  className="control-button"
                  type="button"
                  disabled={!canCreateForStore}
                  onClick={() => {
                    setSubmissionNotice(null)
                    setAllocations([
                      ...activeAllocations,
                      { assigneeLabel: `Ek satir ${activeAllocations.length + 1}`, targetValue: 0, note: '' },
                    ])
                  }}
                >
                  Add allocation
                </button>
              </div>
              </div>

              <div className="action-cluster">
                <button
                  className="control-button"
                  type="button"
                  disabled={!canSubmit || createMutation.isPending}
                  onClick={() =>
                    createMutation.mutate({
                      storeId,
                      requestMonth: `${requestMonth}-01`,
                      targetLabel,
                      totalTargetValue: Number(totalTargetValue),
                      requestReason: requestReason || undefined,
                      allocations: activeAllocations,
                    })
                  }
                >
                  {createMutation.isPending ? 'Submitting...' : 'Submit for region approval'}
                </button>
              </div>

              {createMutation.isError ? (
                <p className="queue-subtitle">{getErrorMessage(createMutation.error)}</p>
              ) : null}
              {submissionNotice ? <p className="queue-subtitle">{submissionNotice}</p> : null}
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Resolved Session</div>
              <h3>Why this request flow belongs in the store shell</h3>
            </div>
          </div>

          <div className="key-grid">
            <KeyValue label="User id" value={user?.userId ?? 'Session not resolved'} />
            <KeyValue label="Roles" value={user?.roleCodes.join(', ') || 'No resolved roles'} />
            <KeyValue label="Read store ids" value={readStoreIds.join(', ') || 'none'} />
            <KeyValue label="Action store ids" value={assignedStoreIds.join(', ') || 'none'} />
            <KeyValue
              label="Approval route fit"
              value={
                canCreateForStore
                  ? 'Store submission belongs here'
                  : 'Boundary is ready before role contract'
              }
            />
          </div>

          <div className="action-cluster">
            <Link className="control-button store-shell-link" to="/admin/targets">
              Region approval queue
            </Link>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Submitted Requests</div>
            <h3>What already left the store shell</h3>
          </div>
        </div>

        {requests.length === 0 ? (
          <EmptyState
            title="No requests submitted yet"
            copy="Once the store submits a target split, the request will appear here with its current approval state."
          />
        ) : (
          <div className="stacked-table">
            {requests.map((item) => (
              <article className="stacked-row" key={item.requestId}>
                <div className="stacked-row-head">
                  <strong>{item.targetLabel}</strong>
                  <StatusPill tone={item.status === 'approved' ? 'calm' : 'warning'}>
                    {formatState(item.status)}
                  </StatusPill>
                </div>
                <p>
                  {item.storeName || item.storeId} - {formatDate(item.requestMonth)} - toplam hedef{' '}
                  {item.totalTargetValue}
                </p>
                <div className="key-grid">
                  <KeyValue label="Allocation count" value={String(item.allocationCount)} />
                  <KeyValue label="Created" value={formatDateTime(item.createdAt)} />
                  <KeyValue
                    label="Approved at"
                    value={item.approvedAt ? formatDateTime(item.approvedAt) : 'Pending'}
                  />
                  <KeyValue label="Request id" value={item.requestId} />
                </div>
                {item.requestReason ? (
                  <p className="queue-subtitle">Reason: {item.requestReason}</p>
                ) : null}
                {item.approvalNote ? (
                  <p className="queue-subtitle">Approval note: {item.approvalNote}</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">This Flow Now</div>
              <h3>What this page already handles</h3>
            </div>
          </div>
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Store submission</strong>
                <CheckCircle2 size={16} />
              </div>
              <p>
                Store managers can now send a person-level target split into a real approval queue.
              </p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Region review</strong>
                <CheckCircle2 size={16} />
              </div>
              <p>
                The region-side queue can approve the request and attach a short note without
                leaking governance controls into the store shell.
              </p>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Boundary Rule</div>
              <h3>What stays outside `/store/approvals`</h3>
            </div>
          </div>
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Workflow governance</strong>
                <CheckCircle2 size={16} />
              </div>
              <p>
                Approval policy design, cross-store investigation, and region override controls
                should remain admin-side.
              </p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Store consumption</strong>
                <CheckCircle2 size={16} />
              </div>
              <p>
                Store users should prepare the split and then watch approval state without turning
                this route into a region console.
              </p>
            </div>
          </div>
        </article>
      </section>

      <div className="action-cluster">
        <Link className="control-button store-shell-link" to="/store">
          Back to store home
        </Link>
        <Link className="control-button store-shell-link" to="/admin/targets">
          Open region approval queue
        </Link>
      </div>
    </section>
  )
}
