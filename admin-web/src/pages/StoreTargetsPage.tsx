import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Clock3,
  PieChart,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Store,
  Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  canCreateTargetDistributionRequest,
  canListTargetDistributionRequests,
  getAssignedStoreIds,
  hasAnyRole,
} from '../features/auth/authorization'
import { useLocalization } from '../features/localization/useLocalization'
import {
  approveTargetDistributionRequest,
  createTargetDistributionRequest,
  getAllTargetDistributionRequests,
  getStoreTargetingPersonnel,
  getTargetCoverage,
  type TargetDistributionAllocation,
  type TargetDistributionRequest,
} from '../features/targets/api'
import { getErrorMessage } from '../lib/format'
import {
  TargetApprovalQueue,
  TargetApprovedRequestsPanel,
  TargetCoveragePanel,
  TargetDistributionForm,
  TargetRevisionPanel,
} from './store-targets-contract-sections'
import {
  createAvailableTargetTabs,
  createEmptyCoverageSummary,
  createStoreOptions,
  createStoreTargetReferenceSummary,
  formatCoverageRate,
  formatMonthLabel,
  getCurrentMonthInput,
  isTargetRequestWorkflowVisible,
  isTargetRequestInScope,
  resolveDefaultTargetWorkflowTab,
  resolveTargetUserMode,
  targetCopy,
  type TargetAllocationDraft,
  type TargetStatusFilter,
  type TargetWorkflowTab,
} from './store-targets-page-model'
import { TargetMetricTile, TargetWorkflowTabIcon } from './store-targets-page-widgets'
import {
  StoreEmptyState,
  StoreErrorState,
  StoreLoadingState,
  StoreStatusBadge,
  StoreSurfacePage,
} from './store-surface-primitives'

function getQueryMonthInput(value: string | null) {
  if (!value) {
    return null
  }

  const normalizedValue = value.trim()
  const datePart = normalizedValue.slice(0, 10)

  if (/^\d{4}-\d{2}$/.test(normalizedValue)) {
    return normalizedValue
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart.slice(0, 7)
  }

  return null
}

function getQueryStatusFilter(value: string | null): TargetStatusFilter {
  if (value === 'pending' || value === 'approved') {
    return value
  }

  return 'all'
}

function getQueryWorkflowTab(value: string | null): TargetWorkflowTab | null {
  if (
    value === 'approval' ||
    value === 'distribution' ||
    value === 'revision' ||
    value === 'approved'
  ) {
    return value
  }

  return null
}

function getLatestTargetRequestMonth(requests: TargetDistributionRequest[]) {
  const months = requests
    .filter(isTargetRequestWorkflowVisible)
    .map((request) => getQueryMonthInput(request.requestMonth))
    .filter((month): month is string => Boolean(month))
    .sort((left, right) => right.localeCompare(left))

  return months[0] ?? null
}

export function StoreTargetsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { locale } = useLocalization()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const copy = targetCopy[locale]
  const queryRequestMonth = getQueryMonthInput(searchParams.get('requestMonth'))
  const assignedStoreIds = useMemo(
    () => getAssignedStoreIds(input.authSummary),
    [input.authSummary],
  )
  const targetQueryScopeKey = useMemo(() => {
    const user = input.authSummary?.user

    return [
      user?.userId ?? 'anonymous',
      [...(user?.roleCodes ?? [])].sort().join('|') || 'no-roles',
      [...assignedStoreIds].sort().join('|') || 'no-action-stores',
    ]
  }, [assignedStoreIds, input.authSummary])
  const defaultStoreId = useMemo(() => {
    if (!hasAnyRole(input.authSummary, ['STORE_MANAGER'])) {
      return ''
    }

    return assignedStoreIds[0] ?? ''
  }, [assignedStoreIds, input.authSummary])
  const [requestMonth, setRequestMonth] = useState(
    () => queryRequestMonth ?? getCurrentMonthInput(),
  )
  const [monthTouched, setMonthTouched] = useState(() => Boolean(queryRequestMonth))
  const [selectedStoreId, setSelectedStoreId] = useState(() => {
    const queryStoreId = searchParams.get('storeId')?.trim() ?? ''

    if (queryStoreId && (!defaultStoreId || assignedStoreIds.includes(queryStoreId))) {
      return queryStoreId
    }

    if (defaultStoreId) {
      return ''
    }

    return queryStoreId
  })
  const [targetLabel, setTargetLabel] = useState<string>(copy.targetLabelDefault)
  const [totalTargetValue, setTotalTargetValue] = useState('')
  const [requestReason, setRequestReason] = useState('')
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({})
  const [allocationDrafts, setAllocationDrafts] = useState<Record<string, TargetAllocationDraft>>({})
  const [formNotice, setFormNotice] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TargetWorkflowTab | null>(() =>
    getQueryWorkflowTab(searchParams.get('tab')),
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<TargetStatusFilter>(() =>
    getQueryStatusFilter(searchParams.get('status')),
  )
  const requestMonthStart = `${requestMonth}-01`
  const hasExplicitRequestMonth = Boolean(queryRequestMonth)
  const effectiveSelectedStoreId = selectedStoreId || defaultStoreId
  const canSelectAllStores = !defaultStoreId
  const canReadTargets = canListTargetDistributionRequests(input.authSummary)
  const coverageStoreId = effectiveSelectedStoreId || undefined
  const canCreateForStore = canCreateTargetDistributionRequest(
    input.authSummary,
    effectiveSelectedStoreId || null,
  )

  const requestsQuery = useQuery({
    queryKey: [
      'target-distribution-requests',
      'store-targets',
      ...targetQueryScopeKey,
      hasExplicitRequestMonth ? requestMonthStart : 'auto-month',
      effectiveSelectedStoreId || 'all',
    ],
    queryFn: () =>
      getAllTargetDistributionRequests({
        ...(hasExplicitRequestMonth ? { requestMonth: requestMonthStart } : {}),
        ...(effectiveSelectedStoreId ? { storeId: effectiveSelectedStoreId } : {}),
      }),
    enabled: canReadTargets,
    staleTime: 30_000,
  })
  const targetRequests = requestsQuery.data?.items ?? []
  const latestTargetRequestMonth =
    !hasExplicitRequestMonth &&
    !monthTouched &&
    targetRequests.length > 0
      ? getLatestTargetRequestMonth(targetRequests)
      : null
  const activeRequestMonth = latestTargetRequestMonth ?? requestMonth
  const activeRequestMonthStart = `${activeRequestMonth}-01`

  const coverageQuery = useQuery({
    queryKey: [
      'target-distribution-coverage',
      'store-targets',
      ...targetQueryScopeKey,
      activeRequestMonthStart,
      coverageStoreId ?? 'all',
    ],
    queryFn: () =>
      getTargetCoverage({
        requestMonth: activeRequestMonthStart,
        ...(coverageStoreId ? { storeId: coverageStoreId } : {}),
      }),
    enabled: canReadTargets,
    staleTime: 30_000,
  })
  const personnelQuery = useQuery({
    queryKey: ['store-targeting-personnel', 'store-targets', effectiveSelectedStoreId],
    queryFn: () => getStoreTargetingPersonnel(effectiveSelectedStoreId),
    enabled: canCreateForStore,
    staleTime: 30_000,
  })
  const createMutation = useMutation({
    mutationFn: createTargetDistributionRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['target-distribution-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['target-distribution-coverage'] })
      setAllocationDrafts({})
      setTotalTargetValue('')
      setRequestReason('')
      setFormNotice(result.command.message || copy.success)
    },
  })
  const approveMutation = useMutation({
    mutationFn: approveTargetDistributionRequest,
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['target-distribution-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['target-distribution-coverage'] })
      setApprovalNotes((current) => {
        const next = { ...current }
        delete next[variables.requestId]
        return next
      })
      setFormNotice(result.command.message || copy.success)
    },
  })

  if (!canReadTargets) {
    return (
      <StoreSurfacePage ariaLabel={copy.aria}>
        <StoreEmptyState
          title={copy.readOnlyTitle}
          titleAsHeading
          description={copy.readOnlyCopy}
        />
      </StoreSurfacePage>
    )
  }

  if (
    (requestsQuery.isLoading && !requestsQuery.data) ||
    (coverageQuery.isLoading && !coverageQuery.data)
  ) {
    return (
      <StoreLoadingState
        title={copy.title}
        description={copy.description}
      />
    )
  }

  if (requestsQuery.isError) {
    return (
      <StoreSurfacePage ariaLabel={copy.aria}>
        <StoreErrorState title={copy.title} description={getErrorMessage(requestsQuery.error)} />
      </StoreSurfacePage>
    )
  }

  if (coverageQuery.isError) {
    return (
      <StoreSurfacePage ariaLabel={copy.aria}>
        <StoreErrorState title={copy.coverageTitle} description={getErrorMessage(coverageQuery.error)} />
      </StoreSurfacePage>
    )
  }

  const coverageRows = coverageQuery.data?.items ?? []
  const coverageSummary =
    coverageQuery.data?.summary ?? createEmptyCoverageSummary(activeRequestMonthStart)
  const scopedTargetRequests = targetRequests.filter((request) =>
    isTargetRequestInScope({
      effectiveSelectedStoreId,
      request,
      requestMonthStart: activeRequestMonthStart,
      searchQuery,
      statusFilter,
    }),
  )
  const pendingRequests = scopedTargetRequests.filter(
    (request) => request.status === 'pending_region_approval',
  )
  const approvedRequests = scopedTargetRequests.filter((request) => request.status === 'approved')
  const storeOptions = createStoreOptions({
    assignedStoreIds,
    coverageRows,
    targetRequests,
  })
  const storeTargetReferenceSummary = createStoreTargetReferenceSummary({
    coverageRows,
    storeOptions,
  })
  const activeAllocations = (personnelQuery.data?.items ?? []).map((person) => {
    const draft = allocationDrafts[person.employeeId]

    return {
      employeeId: person.employeeId,
      assigneeLabel: person.displayName,
      targetValue: draft?.targetValue ?? 0,
      note: draft?.note ?? '',
    }
  })
  const allocationTotal = activeAllocations.reduce(
    (sum, allocation) => sum + Number(allocation.targetValue || 0),
    0,
  )
  const totalTargetNumber = Number(totalTargetValue || 0)
  const totalsAligned = totalTargetNumber > 0 && allocationTotal === totalTargetNumber
  const canSubmitTarget =
    canCreateForStore &&
    Boolean(effectiveSelectedStoreId) &&
    Boolean(targetLabel.trim()) &&
    totalTargetNumber > 0 &&
    activeAllocations.length > 0 &&
    activeAllocations.every((allocation) => Number(allocation.targetValue) > 0) &&
    totalsAligned
  const userMode = resolveTargetUserMode(input.authSummary, canCreateForStore)
  const canApproveTargets = hasAnyRole(input.authSummary, ['REGION_MANAGER', 'SUPER_ADMIN'])
  const availableTabs = createAvailableTargetTabs({
    approvedCount: approvedRequests.length,
    canApproveTargets,
    canCreateForStore,
    copy,
    pendingCount: pendingRequests.length,
  })
  const selectedTab: TargetWorkflowTab = activeTab && availableTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : resolveDefaultTargetWorkflowTab(availableTabs)

  const submitTargetRequest = () => {
    if (!canSubmitTarget) {
      return
    }

    createMutation.mutate({
      storeId: effectiveSelectedStoreId,
      requestMonth: activeRequestMonthStart,
      targetLabel: targetLabel.trim(),
      totalTargetValue: totalTargetNumber,
      ...(requestReason.trim() ? { requestReason: requestReason.trim() } : {}),
      allocations: activeAllocations.map((allocation) => {
        const note = allocation.note?.trim()
        const payload: TargetDistributionAllocation = {
          employeeId: allocation.employeeId,
          assigneeLabel: allocation.assigneeLabel,
          targetValue: Number(allocation.targetValue),
        }

        if (note) {
          payload.note = note
        }

        return payload
      }),
    })
  }

  const submitRevisionRequest = (
    request: TargetDistributionRequest,
    allocations: TargetDistributionAllocation[],
    note: string,
  ) => {
    const revisionTotal = allocations.reduce(
      (sum, allocation) => sum + Number(allocation.targetValue || 0),
      0,
    )

    if (
      !canCreateForStore ||
      !note.trim() ||
      revisionTotal !== Number(request.totalTargetValue || 0)
    ) {
      return
    }

    createMutation.mutate({
      storeId: request.storeId,
      requestMonth: request.requestMonth,
      targetLabel: `${request.targetLabel} ${copy.revisionLabelSuffix}`,
      totalTargetValue: Number(request.totalTargetValue),
      requestReason: note.trim(),
      allocations: allocations.map((allocation) => {
        const payload: TargetDistributionAllocation = {
          employeeId: allocation.employeeId,
          assigneeLabel: allocation.assigneeLabel,
          targetValue: Number(allocation.targetValue),
        }

        if (allocation.note?.trim()) {
          payload.note = allocation.note.trim()
        }

        return payload
      }),
    })
  }

  const resetFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setSelectedStoreId('')
    setMonthTouched(true)
    setRequestMonth(getCurrentMonthInput())
  }

  return (
    <StoreSurfacePage
      ariaLabel={copy.aria}
      ariaLabelledBy="store-targets-title"
      testId="store-targets-contract-surface"
      className="tw:gap-3"
    >
      <header className="tw:overflow-hidden tw:rounded-lg tw:border tw:border-border/80 tw:bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(238,232,255,0.72)_48%,rgba(214,249,252,0.72))] tw:p-4 tw:shadow-[0_18px_50px_rgba(23,30,58,0.08)] tw:md:p-5">
        <div className="tw:grid tw:gap-4 tw:lg:grid-cols-[minmax(0,1fr)_auto] tw:lg:items-start">
          <div className="tw:min-w-0">
            <div className="tw:flex tw:flex-wrap tw:gap-2">
              <StoreStatusBadge tone="accent">
                <Target data-icon="inline-start" />
                {copy.eyebrow}
              </StoreStatusBadge>
              <StoreStatusBadge tone="calm">
                {formatMonthLabel(activeRequestMonth, locale)} {copy.periodBadge}
              </StoreStatusBadge>
              <StoreStatusBadge tone={pendingRequests.length > 0 ? 'warning' : 'neutral'}>
                {pendingRequests.length} {copy.pendingRequests.toLowerCase()}
              </StoreStatusBadge>
            </div>
            <h1
              id="store-targets-title"
              className="tw:mt-4 tw:max-w-4xl tw:text-[clamp(30px,4vw,52px)] tw:font-semibold tw:leading-[0.96] tw:text-foreground"
            >
              {copy.title}
            </h1>
            <p className="tw:mt-3 tw:max-w-3xl tw:text-sm tw:leading-6 tw:text-muted-foreground">
              {copy.description}
            </p>
          </div>

          <div className="tw:flex tw:flex-wrap tw:gap-2 tw:lg:justify-end">
            <StoreStatusBadge tone="accent">{copy.contractReady}</StoreStatusBadge>
            <StoreStatusBadge tone={userMode.tone}>{copy[userMode.badgeKey]}</StoreStatusBadge>
          </div>
        </div>

        <div className="tw:mt-5 tw:grid tw:gap-3 tw:md:grid-cols-2 tw:xl:grid-cols-4">
          <TargetMetricTile
            icon={<PieChart data-icon="inline-start" />}
            label={copy.personnelMetric}
            value={formatCoverageRate(coverageSummary.coverageRate)}
            note={`${coverageSummary.coveredEmployees} / ${coverageSummary.totalEmployees} ${copy.personnelWithTargets}`}
            tone="plum"
            testId="store-targets-personnel-metric"
          />
          <TargetMetricTile
            icon={<Store data-icon="inline-start" />}
            label={copy.storeMetric}
            value={formatCoverageRate(storeTargetReferenceSummary.coverageRate)}
            note={`${storeTargetReferenceSummary.coveredStores} / ${storeTargetReferenceSummary.totalStores} ${copy.storesWithTargets.toLowerCase()}`}
            tone="cyan"
            testId="store-targets-store-metric"
          />
          <TargetMetricTile
            icon={<Clock3 data-icon="inline-start" />}
            label={copy.decisionMetric}
            value={String(storeTargetReferenceSummary.pendingStores)}
            note={copy.pendingStoreNote}
            tone="amber"
            testId="store-targets-decision-metric"
          />
          <TargetMetricTile
            icon={<AlertTriangle data-icon="inline-start" />}
            label={copy.noRequestMetric}
            value={String(storeTargetReferenceSummary.missingStores)}
            note={copy.storesWithoutTargets}
            tone="rose"
            testId="store-targets-no-request-metric"
          />
        </div>
      </header>

      <section
        aria-label="Hedef filtreleri"
        className="tw:grid tw:gap-2 tw:lg:grid-cols-[minmax(260px,420px)_180px_180px_180px_auto]"
      >
        <label className="tw:flex tw:min-h-11 tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-border/80 tw:bg-card/85 tw:px-3 tw:text-xs tw:font-medium tw:text-muted-foreground tw:shadow-sm">
          <Search data-icon="inline-start" />
          <span className="tw:sr-only">{copy.search}</span>
          <Input
            aria-label={copy.searchPlaceholder}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
            className="tw:h-auto tw:border-0 tw:bg-transparent tw:p-0 tw:text-sm tw:font-medium tw:shadow-none tw:focus-visible:ring-0"
          />
        </label>
        <label className="tw:flex tw:min-h-11 tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-border/80 tw:bg-card/85 tw:px-3 tw:text-xs tw:font-medium tw:text-muted-foreground tw:shadow-sm">
          <Clock3 data-icon="inline-start" />
          <span className="tw:sr-only">{copy.period}</span>
          <Input
            aria-label={copy.period}
            type="month"
            value={activeRequestMonth}
            onChange={(event) => {
              const nextMonth = event.target.value

              if (/^\d{4}-\d{2}$/.test(nextMonth)) {
                setMonthTouched(true)
                setRequestMonth(nextMonth)
              }
            }}
            className="tw:h-auto tw:border-0 tw:bg-transparent tw:p-0 tw:text-sm tw:font-medium tw:shadow-none tw:focus-visible:ring-0"
          />
        </label>
        <label className="tw:flex tw:min-h-11 tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-border/80 tw:bg-card/85 tw:px-3 tw:text-xs tw:font-medium tw:text-muted-foreground tw:shadow-sm">
          <Store data-icon="inline-start" />
          <span className="tw:sr-only">{copy.store}</span>
          <Select
            value={effectiveSelectedStoreId || 'all'}
            onValueChange={(next) => setSelectedStoreId(next === 'all' ? '' : next)}
          >
            <SelectTrigger
              aria-label={copy.store}
              className="tw:h-auto tw:border-0 tw:bg-transparent tw:p-0 tw:text-sm tw:font-medium tw:shadow-none tw:focus:ring-0"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {canSelectAllStores ? <SelectItem value="all">{copy.allStores}</SelectItem> : null}
                {storeOptions.map((store) => (
                  <SelectItem key={store.storeId} value={store.storeId}>
                    {store.storeName}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </label>
        <label className="tw:flex tw:min-h-11 tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-border/80 tw:bg-card/85 tw:px-3 tw:text-xs tw:font-medium tw:text-muted-foreground tw:shadow-sm">
          <SlidersHorizontal data-icon="inline-start" />
          <span className="tw:sr-only">{copy.statusFilter}</span>
          <Select
            value={statusFilter}
            onValueChange={(next) => setStatusFilter(next as TargetStatusFilter)}
          >
            <SelectTrigger
              aria-label={copy.statusFilter}
              className="tw:h-auto tw:border-0 tw:bg-transparent tw:p-0 tw:text-sm tw:font-medium tw:shadow-none tw:focus:ring-0"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">{copy.allStatuses}</SelectItem>
                <SelectItem value="pending">{copy.pendingStatus}</SelectItem>
                <SelectItem value="approved">{copy.approvedStatus}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </label>
        <Button
          type="button"
          variant="outline"
          onClick={resetFilters}
          className="tw:min-h-11 tw:justify-center tw:gap-2 tw:rounded-lg tw:bg-card/85 tw:px-4 tw:shadow-sm"
        >
          <RefreshCcw data-icon="inline-start" />
          {copy.resetFilters}
        </Button>
      </section>

      <ToggleGroup
        type="single"
        value={selectedTab}
        onValueChange={(next) => {
          if (next) {
            setActiveTab(next as TargetWorkflowTab)
          }
        }}
        variant="outline"
        className="tw:flex tw:w-full tw:flex-wrap tw:items-center tw:gap-2"
        aria-label={copy.currentScope}
      >
        {availableTabs.map((tab) => (
          <ToggleGroupItem
            key={tab.id}
            value={tab.id}
            aria-label={tab.label}
            className={cn(
              'tw:min-h-10 tw:gap-2 tw:rounded-lg tw:bg-card/85 tw:text-muted-foreground tw:shadow-sm',
              selectedTab === tab.id
                ? 'tw:border-primary/25 tw:bg-primary/10 tw:text-primary'
                : undefined,
            )}
          >
            <TargetWorkflowTabIcon tab={tab.id} />
            {tab.label}
            <StoreStatusBadge tone={selectedTab === tab.id ? 'neutral' : tab.tone}>
              {tab.count}
            </StoreStatusBadge>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {selectedTab === 'distribution' && canCreateForStore ? (
        <TargetDistributionForm
          activeAllocations={activeAllocations}
          allocationTotal={allocationTotal}
          copy={copy}
          createError={createMutation.error}
          createPending={createMutation.isPending}
          createVisible={createMutation.isError}
          locale={locale}
          onAllocationNoteChange={(employeeId, note) =>
            setAllocationDrafts((current) => ({
              ...current,
              [employeeId]: {
                targetValue: current[employeeId]?.targetValue ?? 0,
                note,
              },
            }))
          }
          onAllocationValueChange={(employeeId, targetValue) =>
            setAllocationDrafts((current) => ({
              ...current,
              [employeeId]: {
                targetValue,
                note: current[employeeId]?.note ?? '',
              },
            }))
          }
          onRequestReasonChange={setRequestReason}
          onSubmit={submitTargetRequest}
          onTargetLabelChange={setTargetLabel}
          onTotalTargetValueChange={setTotalTargetValue}
          personnelLoading={personnelQuery.isLoading}
          personnelError={personnelQuery.error}
          personnelErrorVisible={personnelQuery.isError}
          requestReason={requestReason}
          submitAllowed={canSubmitTarget}
          targetLabel={targetLabel}
          totalTargetValue={totalTargetValue}
          totalsAligned={totalsAligned}
        />
      ) : null}

      {selectedTab === 'approval' ? (
        <TargetApprovalQueue
          approvalNotes={approvalNotes}
          approveMutation={approveMutation}
          authSummary={input.authSummary}
          copy={copy}
          locale={locale}
          onApprovalNoteChange={(requestId, value) =>
            setApprovalNotes((current) => ({ ...current, [requestId]: value }))
          }
          pendingRequests={pendingRequests}
        />
      ) : null}

      {selectedTab === 'revision' && canCreateForStore ? (
        <TargetRevisionPanel
          approvedRequests={approvedRequests}
          copy={copy}
          createError={createMutation.error}
          createPending={createMutation.isPending}
          createVisible={createMutation.isError}
          locale={locale}
          onSubmitRevision={submitRevisionRequest}
        />
      ) : null}

      {selectedTab === 'approved' ? (
        <div className="tw:flex tw:flex-col tw:gap-3">
          {coverageRows.length > 0 ? (
            <TargetCoveragePanel
              copy={copy}
              coverageRows={coverageRows}
              locale={locale}
              summary={coverageSummary}
            />
          ) : null}
          <TargetApprovedRequestsPanel
            approvedRequests={approvedRequests}
            copy={copy}
            locale={locale}
          />
        </div>
      ) : null}

      {formNotice ? (
        <StoreStatusBadge tone="calm" className="tw:w-fit">
          {formNotice}
        </StoreStatusBadge>
      ) : null}
    </StoreSurfacePage>
  )
}
