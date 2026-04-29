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
import { formatDisplayRoles } from '../features/auth/display'
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
import {
  createOffboardingRequest,
  createSellerCodeRequest,
  getOffboardingRequests,
  getPositionOptions,
  getSellerCodeRequests,
  getStoreEmployees,
  resubmitOffboardingRequest,
  resubmitSellerCodeRequest,
  type OffboardingRequest,
  type SellerCodeRequest,
  type SellerEmploymentType,
} from '../features/workforce/api'
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
  const [sellerFirstName, setSellerFirstName] = useState('')
  const [sellerLastName, setSellerLastName] = useState('')
  const [sellerNationalId, setSellerNationalId] = useState('')
  const [sellerPhoneNumber, setSellerPhoneNumber] = useState('')
  const [sellerHireDate, setSellerHireDate] = useState(new Date().toISOString().slice(0, 10))
  const [sellerPositionId, setSellerPositionId] = useState('')
  const [sellerEmploymentType, setSellerEmploymentType] =
    useState<SellerEmploymentType>('full_time')
  const [sellerRequestReason, setSellerRequestReason] = useState('')
  const [sellerRequestNotice, setSellerRequestNotice] = useState<string | null>(null)
  const [editingSellerRequestId, setEditingSellerRequestId] = useState<string | null>(null)
  const [offboardingEmployeeId, setOffboardingEmployeeId] = useState('')
  const [offboardingTerminationDate, setOffboardingTerminationDate] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [offboardingTerminationReason, setOffboardingTerminationReason] = useState('resignation')
  const [offboardingRequestReason, setOffboardingRequestReason] = useState('')
  const [offboardingNotice, setOffboardingNotice] = useState<string | null>(null)
  const [editingOffboardingRequestId, setEditingOffboardingRequestId] = useState<string | null>(null)
  const [allocations, setAllocations] = useState<Array<TargetDistributionAllocation>>([
    { employeeId: '', assigneeLabel: '', targetValue: 0, note: '' },
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
  const positionOptionsQuery = useQuery({
    queryKey: ['workforce-position-options', storeId],
    queryFn: () => getPositionOptions(storeId),
    enabled: canCreateForStore,
  })
  const storeEmployeesQuery = useQuery({
    queryKey: ['workforce-store-employees', storeId],
    queryFn: () => getStoreEmployees(storeId),
    enabled: canCreateForStore,
  })
  const rejectedSellerCodeRequestsQuery = useQuery({
    queryKey: ['seller-code-requests', 'rejected', storeId],
    queryFn: () => getSellerCodeRequests({ status: 'rejected' }),
    enabled: canCreateForStore,
  })
  const rejectedOffboardingRequestsQuery = useQuery({
    queryKey: ['offboarding-requests', 'rejected', storeId],
    queryFn: () => getOffboardingRequests({ status: 'rejected' }),
    enabled: canCreateForStore,
  })

  const createMutation = useMutation({
    mutationFn: createTargetDistributionRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['target-distribution-requests'] })
      setTargetLabel('Aylik personel hedef dagitimi')
      setTotalTargetValue('0')
      setRequestReason('')
      setAllocations([{ employeeId: '', assigneeLabel: '', targetValue: 0, note: '' }])
      setSubmissionNotice(result.command.message)
    },
  })

  const sellerCodeMutation = useMutation({
    mutationFn: createSellerCodeRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['seller-code-requests'] })
      setEditingSellerRequestId(null)
      setSellerFirstName('')
      setSellerLastName('')
      setSellerNationalId('')
      setSellerPhoneNumber('')
      setSellerHireDate(new Date().toISOString().slice(0, 10))
      setSellerPositionId('')
      setSellerEmploymentType('full_time')
      setSellerRequestReason('')
      setSellerRequestNotice(result.command.message)
    },
  })
  const resubmitSellerCodeMutation = useMutation({
    mutationFn: resubmitSellerCodeRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['seller-code-requests'] })
      setEditingSellerRequestId(null)
      setSellerFirstName('')
      setSellerLastName('')
      setSellerNationalId('')
      setSellerPhoneNumber('')
      setSellerHireDate(new Date().toISOString().slice(0, 10))
      setSellerPositionId('')
      setSellerEmploymentType('full_time')
      setSellerRequestReason('')
      setSellerRequestNotice(result.command.message)
    },
  })
  const offboardingMutation = useMutation({
    mutationFn: createOffboardingRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['offboarding-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['workforce-store-employees'] })
      setEditingOffboardingRequestId(null)
      setOffboardingEmployeeId('')
      setOffboardingTerminationDate(new Date().toISOString().slice(0, 10))
      setOffboardingTerminationReason('resignation')
      setOffboardingRequestReason('')
      setOffboardingNotice(result.command.message)
    },
  })
  const resubmitOffboardingMutation = useMutation({
    mutationFn: resubmitOffboardingRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['offboarding-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['workforce-store-employees'] })
      setEditingOffboardingRequestId(null)
      setOffboardingEmployeeId('')
      setOffboardingTerminationDate(new Date().toISOString().slice(0, 10))
      setOffboardingTerminationReason('resignation')
      setOffboardingRequestReason('')
      setOffboardingNotice(result.command.message)
    },
  })

  const activeAllocations = useMemo(() => {
    const personnel = personnelQuery.data?.items ?? []
    const canHydrateFromPersonnel =
      personnel.length > 0 &&
      allocations.every(
        (item) =>
          !item.employeeId.trim() &&
          !item.assigneeLabel.trim() &&
          Number(item.targetValue) === 0 &&
          !(item.note ?? '').trim(),
      )

    if (!canHydrateFromPersonnel) {
      return allocations
    }

    return personnel.map((person) => ({
      employeeId: person.employeeId,
      assigneeLabel: person.displayName,
      targetValue: 0,
      note: '',
    }))
  }, [allocations, personnelQuery.data?.items])

  const personnelById = useMemo(
    () =>
      new Map(
        (personnelQuery.data?.items ?? []).map((person) => [person.employeeId, person] as const),
      ),
    [personnelQuery.data?.items],
  )
  const returnedSellerCodeRequests = rejectedSellerCodeRequestsQuery.data?.items ?? []
  const returnedOffboardingRequests = rejectedOffboardingRequestsQuery.data?.items ?? []

  const startEditingSellerRequest = (item: SellerCodeRequest) => {
    setEditingSellerRequestId(item.requestId)
    setSellerFirstName(item.firstName)
    setSellerLastName(item.lastName)
    setSellerNationalId('')
    setSellerPhoneNumber(item.phoneNumber)
    setSellerHireDate(item.hireDate)
    setSellerPositionId(item.requestedPositionId)
    setSellerEmploymentType(item.employmentType as SellerEmploymentType)
    setSellerRequestReason('')
    setSellerRequestNotice(
      item.reviewNote
        ? `Returned by HR: ${item.reviewNote}. Re-enter full TC before resubmitting.`
        : 'Returned request loaded. Re-enter full TC before resubmitting.',
    )
  }

  const startEditingOffboardingRequest = (item: OffboardingRequest) => {
    setEditingOffboardingRequestId(item.requestId)
    setOffboardingEmployeeId(item.employeeId)
    setOffboardingTerminationDate(item.terminationDate)
    setOffboardingTerminationReason(item.terminationReason)
    setOffboardingRequestReason(item.requestReason ?? '')
    setOffboardingNotice(
      item.reviewNote
        ? `Returned by HR: ${item.reviewNote}. Review and resubmit when corrected.`
        : 'Returned request loaded. Review and resubmit when corrected.',
    )
  }

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
    activeAllocations.every(
      (item) => item.employeeId.trim() && item.assigneeLabel.trim() && Number(item.targetValue) > 0,
    )
  const canSubmitSellerCodeRequest =
    canCreateForStore &&
    Boolean(storeId) &&
    Boolean(sellerFirstName.trim()) &&
    Boolean(sellerLastName.trim()) &&
    /^[0-9]{11}$/.test(sellerNationalId.trim()) &&
    Boolean(sellerPhoneNumber.trim()) &&
    Boolean(sellerHireDate) &&
    Boolean(sellerPositionId.trim())
  const canSubmitOffboardingRequest =
    canCreateForStore &&
    Boolean(storeId) &&
    Boolean(offboardingEmployeeId.trim()) &&
    Boolean(offboardingTerminationDate) &&
    Boolean(offboardingTerminationReason.trim()) &&
    Boolean(offboardingRequestReason.trim())
  const sellerRequestPending = sellerCodeMutation.isPending || resubmitSellerCodeMutation.isPending
  const offboardingRequestPending = offboardingMutation.isPending || resubmitOffboardingMutation.isPending

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

      <section className="panel" aria-label="Returned workforce requests">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Returned Requests</div>
            <h3>Duzeltme bekleyen personel talepleri</h3>
          </div>
          <StatusPill
            tone={returnedSellerCodeRequests.length + returnedOffboardingRequests.length > 0 ? 'warning' : 'calm'}
          >
            {String(returnedSellerCodeRequests.length + returnedOffboardingRequests.length)}
          </StatusPill>
        </div>

        {rejectedSellerCodeRequestsQuery.isError || rejectedOffboardingRequestsQuery.isError ? (
          <div className="inline-state inline-state-danger">
            {getErrorMessage(rejectedSellerCodeRequestsQuery.error ?? rejectedOffboardingRequestsQuery.error)}
          </div>
        ) : returnedSellerCodeRequests.length + returnedOffboardingRequests.length === 0 ? (
          <EmptyState
            title="Duzeltme bekleyen personel talebi yok"
            copy="HR tarafindan iade edilen satici kodu veya cikis talepleri burada duzenlenebilir hale gelir."
          />
        ) : (
          <div className="stacked-table">
            {returnedSellerCodeRequests.map((item) => (
              <article className="stacked-row" key={item.requestId}>
                <div className="stacked-row-head">
                  <div>
                    <strong>{`${item.firstName} ${item.lastName}`.trim()}</strong>
                    <p className="queue-subtitle">
                      Satici kodu talebi / {item.storeName} / TC son 4 {item.nationalIdLast4}
                    </p>
                  </div>
                  <StatusPill tone="warning">{formatState(item.status)}</StatusPill>
                </div>
                <div className="key-grid">
                  <KeyValue label="Pozisyon" value={item.positionName} />
                  <KeyValue label="Iade notu" value={item.reviewNote ?? 'No note'} />
                  <KeyValue label="Guncellendi" value={formatDateTime(item.updatedAt)} />
                  <KeyValue label="Request id" value={item.requestId} />
                </div>
                <div className="action-cluster">
                  <button
                    className="control-button"
                    type="button"
                    onClick={() => startEditingSellerRequest(item)}
                  >
                    Edit seller code request
                  </button>
                </div>
              </article>
            ))}

            {returnedOffboardingRequests.map((item) => (
              <article className="stacked-row" key={item.requestId}>
                <div className="stacked-row-head">
                  <div>
                    <strong>{item.displayName}</strong>
                    <p className="queue-subtitle">
                      Personel cikis talebi / {item.storeName} / {item.externalEmployeeRef ?? 'no seller code'}
                    </p>
                  </div>
                  <StatusPill tone="warning">{formatState(item.status)}</StatusPill>
                </div>
                <div className="key-grid">
                  <KeyValue label="Cikis tarihi" value={item.terminationDate} />
                  <KeyValue label="Sebep" value={item.terminationReason} />
                  <KeyValue label="Iade notu" value={item.reviewNote ?? 'No note'} />
                  <KeyValue label="Request id" value={item.requestId} />
                </div>
                <div className="action-cluster">
                  <button
                    className="control-button"
                    type="button"
                    onClick={() => startEditingOffboardingRequest(item)}
                  >
                    Edit offboarding request
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="two-up-grid">
        <article className="panel" aria-label="Target distribution request form">
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
                  {activeAllocations.map((allocation, index) => {
                    const selectedPerson = personnelById.get(allocation.employeeId)

                    return (
                      <div className="stacked-row" key={`allocation-${allocation.employeeId || index}`}>
                        {selectedPerson ? (
                          <div className="key-grid">
                            <KeyValue label="Personel" value={allocation.assigneeLabel || 'Unassigned'} />
                            <KeyValue
                              label="Mevcut satis"
                              value={
                                selectedPerson.netSalesValue !== null &&
                                selectedPerson.netSalesValue !== undefined
                                  ? new Intl.NumberFormat('tr-TR', {
                                      style: 'currency',
                                      currency: 'TRY',
                                      maximumFractionDigits: 0,
                                    }).format(selectedPerson.netSalesValue)
                                  : 'Veri yok'
                              }
                            />
                          </div>
                        ) : (
                          <select
                            value={allocation.employeeId}
                            onChange={(event) => {
                              const selected = personnelById.get(event.target.value)
                              setSubmissionNotice(null)
                              setAllocations(
                                activeAllocations.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        employeeId: event.target.value,
                                        assigneeLabel: selected?.displayName ?? '',
                                      }
                                    : item,
                                ),
                              )
                            }}
                          >
                            <option value="">Personel sec</option>
                            {(personnelQuery.data?.items ?? []).map((person) => (
                              <option key={person.employeeId} value={person.employeeId}>
                                {person.displayName}
                              </option>
                            ))}
                          </select>
                        )}
                        <input
                          aria-label="Personel target value"
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
                    )
                  })}
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
                      { employeeId: '', assigneeLabel: '', targetValue: 0, note: '' },
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

        <article className="panel" aria-label="Seller code request form">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Personnel Request</div>
              <h3>Satici kodu talebi</h3>
            </div>
            <StatusPill tone="calm">HR queue</StatusPill>
          </div>

          {!canCreateForStore ? (
            <EmptyState
              title="Assigned action store required"
              copy="Seller code requests are available only to STORE_MANAGER or SUPER_ADMIN sessions with this store in actionScope.assignedStoreIds."
            />
          ) : (
            <div className="stacked-table">
              <div className="stacked-row">
                <label className="eyebrow" htmlFor="seller-store-id">
                  Store id
                </label>
                <input id="seller-store-id" value={storeId} readOnly />
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="seller-first-name">
                  First name
                </label>
                <input
                  id="seller-first-name"
                  value={sellerFirstName}
                  onChange={(event) => {
                    setSellerRequestNotice(null)
                    setSellerFirstName(event.target.value)
                  }}
                  placeholder="Ayse"
                />
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="seller-last-name">
                  Last name
                </label>
                <input
                  id="seller-last-name"
                  value={sellerLastName}
                  onChange={(event) => {
                    setSellerRequestNotice(null)
                    setSellerLastName(event.target.value)
                  }}
                  placeholder="Yilmaz"
                />
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="seller-position-id">
                  Position
                </label>
                <select
                  id="seller-position-id"
                  value={sellerPositionId}
                  disabled={positionOptionsQuery.isLoading || positionOptionsQuery.isError}
                  onChange={(event) => {
                    setSellerRequestNotice(null)
                    setSellerPositionId(event.target.value)
                  }}
                >
                  <option value="">Select position</option>
                  {(positionOptionsQuery.data?.items ?? []).map((position) => (
                    <option key={position.positionId} value={position.positionId}>
                      {position.positionName} ({position.positionCode})
                    </option>
                  ))}
                </select>
                {positionOptionsQuery.isLoading ? (
                  <p className="queue-subtitle">Position listesi hazirlaniyor.</p>
                ) : null}
                {positionOptionsQuery.isError ? (
                  <p className="queue-subtitle">{getErrorMessage(positionOptionsQuery.error)}</p>
                ) : null}
                {!positionOptionsQuery.isLoading &&
                !positionOptionsQuery.isError &&
                (positionOptionsQuery.data?.items.length ?? 0) === 0 ? (
                  <p className="queue-subtitle">Bu magaza icin secilebilir position yok.</p>
                ) : null}
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="seller-national-id">
                  TC kimlik no
                </label>
                <input
                  id="seller-national-id"
                  inputMode="numeric"
                  maxLength={11}
                  value={sellerNationalId}
                  onChange={(event) => {
                    setSellerRequestNotice(null)
                    setSellerNationalId(event.target.value.replace(/\D/g, '').slice(0, 11))
                  }}
                  placeholder="12345678901"
                />
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="seller-phone-number">
                  Phone number
                </label>
                <input
                  id="seller-phone-number"
                  type="tel"
                  value={sellerPhoneNumber}
                  onChange={(event) => {
                    setSellerRequestNotice(null)
                    setSellerPhoneNumber(event.target.value)
                  }}
                  placeholder="05551234567"
                />
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="seller-hire-date">
                  Hire date
                </label>
                <input
                  id="seller-hire-date"
                  type="date"
                  value={sellerHireDate}
                  onChange={(event) => {
                    setSellerRequestNotice(null)
                    setSellerHireDate(event.target.value)
                  }}
                />
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="seller-employment-type">
                  Employment type
                </label>
                <select
                  id="seller-employment-type"
                  value={sellerEmploymentType}
                  onChange={(event) => {
                    setSellerRequestNotice(null)
                    setSellerEmploymentType(event.target.value as SellerEmploymentType)
                  }}
                >
                  <option value="full_time">Full time</option>
                  <option value="part_time">Part time</option>
                  <option value="temporary">Temporary</option>
                </select>
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="seller-request-reason">
                  Request reason
                </label>
                <textarea
                  id="seller-request-reason"
                  rows={3}
                  value={sellerRequestReason}
                  onChange={(event) => {
                    setSellerRequestNotice(null)
                    setSellerRequestReason(event.target.value)
                  }}
                  placeholder="Yeni personel"
                />
              </div>

              <div className="action-cluster">
                <button
                  className="control-button"
                  type="button"
                  disabled={!canSubmitSellerCodeRequest || sellerRequestPending}
                  onClick={() => {
                    const payload = {
                      firstName: sellerFirstName.trim(),
                      lastName: sellerLastName.trim(),
                      nationalId: sellerNationalId.trim(),
                      phoneNumber: sellerPhoneNumber.trim(),
                      hireDate: sellerHireDate,
                      requestedPositionId: sellerPositionId.trim(),
                      employmentType: sellerEmploymentType,
                      requestReason: sellerRequestReason.trim() || undefined,
                    }

                    if (editingSellerRequestId) {
                      resubmitSellerCodeMutation.mutate({
                        requestId: editingSellerRequestId,
                        ...payload,
                      })
                      return
                    }

                    sellerCodeMutation.mutate({
                      storeId,
                      requestType: 'create_code',
                      ...payload,
                    })
                  }}
                >
                  {sellerRequestPending
                    ? 'Submitting...'
                    : editingSellerRequestId
                      ? 'Resubmit seller code request'
                      : 'Submit seller code request'}
                </button>
                {editingSellerRequestId ? (
                  <button
                    className="control-button"
                    type="button"
                    disabled={sellerRequestPending}
                    onClick={() => {
                      setEditingSellerRequestId(null)
                      setSellerFirstName('')
                      setSellerLastName('')
                      setSellerNationalId('')
                      setSellerPhoneNumber('')
                      setSellerHireDate(new Date().toISOString().slice(0, 10))
                      setSellerPositionId('')
                      setSellerEmploymentType('full_time')
                      setSellerRequestReason('')
                      setSellerRequestNotice(null)
                    }}
                  >
                    Cancel edit
                  </button>
                ) : null}
              </div>

              {sellerCodeMutation.isError ? (
                <p className="queue-subtitle">{getErrorMessage(sellerCodeMutation.error)}</p>
              ) : null}
              {resubmitSellerCodeMutation.isError ? (
                <p className="queue-subtitle">{getErrorMessage(resubmitSellerCodeMutation.error)}</p>
              ) : null}
              {sellerRequestNotice ? (
                <p className="queue-subtitle">{sellerRequestNotice}</p>
              ) : null}
            </div>
          )}
        </article>

        <article className="panel" aria-label="Offboarding request form">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Personnel Request</div>
              <h3>Personel cikis talebi</h3>
            </div>
            <StatusPill tone="warning">HR queue</StatusPill>
          </div>

          {!canCreateForStore ? (
            <EmptyState
              title="Assigned action store required"
              copy="Offboarding requests are available only to STORE_MANAGER or SUPER_ADMIN sessions with this store in actionScope.assignedStoreIds."
            />
          ) : (
            <div className="stacked-table">
              <div className="stacked-row">
                <label className="eyebrow" htmlFor="offboarding-employee-id">
                  Employee
                </label>
                <select
                  id="offboarding-employee-id"
                  value={offboardingEmployeeId}
                  disabled={storeEmployeesQuery.isLoading || storeEmployeesQuery.isError}
                  onChange={(event) => {
                    setOffboardingNotice(null)
                    setOffboardingEmployeeId(event.target.value)
                  }}
                >
                  <option value="">Select employee</option>
                  {(storeEmployeesQuery.data?.items ?? []).map((employee) => (
                    <option key={employee.employeeId} value={employee.employeeId}>
                      {employee.displayName} ({employee.externalEmployeeRef ?? employee.positionName})
                    </option>
                  ))}
                </select>
                {storeEmployeesQuery.isLoading ? (
                  <p className="queue-subtitle">Aktif personel listesi hazirlaniyor.</p>
                ) : null}
                {storeEmployeesQuery.isError ? (
                  <p className="queue-subtitle">{getErrorMessage(storeEmployeesQuery.error)}</p>
                ) : null}
                {!storeEmployeesQuery.isLoading &&
                !storeEmployeesQuery.isError &&
                (storeEmployeesQuery.data?.items.length ?? 0) === 0 ? (
                  <p className="queue-subtitle">Bu magazada aktif personel bulunamadi.</p>
                ) : null}
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="offboarding-termination-date">
                  Termination date
                </label>
                <input
                  id="offboarding-termination-date"
                  type="date"
                  value={offboardingTerminationDate}
                  onChange={(event) => {
                    setOffboardingNotice(null)
                    setOffboardingTerminationDate(event.target.value)
                  }}
                />
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="offboarding-termination-reason">
                  Termination reason
                </label>
                <input
                  id="offboarding-termination-reason"
                  value={offboardingTerminationReason}
                  onChange={(event) => {
                    setOffboardingNotice(null)
                    setOffboardingTerminationReason(event.target.value)
                  }}
                  placeholder="resignation"
                />
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="offboarding-request-reason">
                  Request reason
                </label>
                <textarea
                  id="offboarding-request-reason"
                  rows={3}
                  value={offboardingRequestReason}
                  onChange={(event) => {
                    setOffboardingNotice(null)
                    setOffboardingRequestReason(event.target.value)
                  }}
                  placeholder="Personel istifa etti"
                />
              </div>

              <div className="action-cluster">
                <button
                  className="control-button"
                  type="button"
                  disabled={!canSubmitOffboardingRequest || offboardingRequestPending}
                  onClick={() => {
                    const payload = {
                      employeeId: offboardingEmployeeId,
                      terminationDate: offboardingTerminationDate,
                      terminationReason: offboardingTerminationReason.trim(),
                      requestReason: offboardingRequestReason.trim(),
                    }

                    if (editingOffboardingRequestId) {
                      resubmitOffboardingMutation.mutate({
                        requestId: editingOffboardingRequestId,
                        ...payload,
                      })
                      return
                    }

                    offboardingMutation.mutate({
                      storeId,
                      ...payload,
                    })
                  }}
                >
                  {offboardingRequestPending
                    ? 'Submitting...'
                    : editingOffboardingRequestId
                      ? 'Resubmit offboarding request'
                      : 'Submit offboarding request'}
                </button>
                {editingOffboardingRequestId ? (
                  <button
                    className="control-button"
                    type="button"
                    disabled={offboardingRequestPending}
                    onClick={() => {
                      setEditingOffboardingRequestId(null)
                      setOffboardingEmployeeId('')
                      setOffboardingTerminationDate(new Date().toISOString().slice(0, 10))
                      setOffboardingTerminationReason('resignation')
                      setOffboardingRequestReason('')
                      setOffboardingNotice(null)
                    }}
                  >
                    Cancel edit
                  </button>
                ) : null}
              </div>

              {offboardingMutation.isError ? (
                <p className="queue-subtitle">{getErrorMessage(offboardingMutation.error)}</p>
              ) : null}
              {resubmitOffboardingMutation.isError ? (
                <p className="queue-subtitle">{getErrorMessage(resubmitOffboardingMutation.error)}</p>
              ) : null}
              {offboardingNotice ? <p className="queue-subtitle">{offboardingNotice}</p> : null}
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
          <KeyValue label="Roles" value={formatDisplayRoles(user?.roleCodes, 'No resolved roles')} />
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
