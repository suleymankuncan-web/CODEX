import { useState } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import { BadgeCheck, ChevronDown, FilePenLine, Send, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { AuthSessionSummary } from '../features/auth/api'
import { canApproveTargetDistributionRequest } from '../features/auth/authorization'
import {
  approveTargetDistributionRequest,
  type TargetCoverageRow,
  type TargetCoverageSummary,
  type TargetDistributionAllocation,
  type TargetDistributionRequest,
} from '../features/targets/api'
import { formatDate, formatDateTime, formatNumber, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import {
  StoreEmptyState,
  StoreErrorState,
  StoreSectionCard,
  StoreStackedList,
  StoreStackedRow,
  StoreStatusBadge,
  type StoreSurfaceTone,
} from './store-surface-primitives'

type TargetCopy = {
  allocationCount: string
  allocationMismatch: string
  allocationTotal: string
  approvalNote: string
  approvalQueueCopy: string
  approve: string
  approveAdjusted: string
  approvedTarget: string
  approving: string
  approvalEditedNoteRequired: string
  approvalPositiveTargets: string
  cannotApprove: string
  coverageCopy: string
  coverageRisk: string
  coverageTitle: string
  createdAt: string
  emptyValue: string
  loaded: string
  noCoverageCopy: string
  noCoverageTitle: string
  noPendingCopy: string
  noPendingTitle: string
  noPersonnelCopy: string
  noPersonnelTitle: string
  optionalNote: string
  pendingStatus: string
  pendingRequests: string
  pendingTarget: string
  personnel: string
  reason: string
  regionMode: string
  remainingTarget: string
  requestOwner: string
  requestReason: string
  share: string
  status: string
  storeManagerMode: string
  storeName: string
  submitting: string
  submitTarget: string
  targetApprovalQueue: string
  targetLabel: string
  targetRequestCopy: string
  targetRequestTitle: string
  targetValue: string
  totalTarget: string
  approvedRequests: string
  approvedRequestsCopy: string
  revisionRequests: string
  revisionRequestsCopy: string
  revisionCreate: string
  revisionSubmit: string
  revisionNote: string
  approvedTotal: string
  revisionTotal: string
  difference: string
  noApprovedTitle: string
  noApprovedCopy: string
  revisionMismatch: string
  revisionNoChange: string
  resetApprovalDraft: string
  adjustedStatus: string
}

export function TargetDistributionForm(input: {
  activeAllocations: TargetDistributionAllocation[]
  allocationTotal: number
  copy: TargetCopy
  createError: unknown
  createPending: boolean
  createVisible: boolean
  locale: AppLocale
  onAllocationNoteChange: (employeeId: string, note: string) => void
  onAllocationValueChange: (employeeId: string, targetValue: number) => void
  onRequestReasonChange: (value: string) => void
  onSubmit: () => void
  onTargetLabelChange: (value: string) => void
  onTotalTargetValueChange: (value: string) => void
  personnelError: unknown
  personnelErrorVisible: boolean
  personnelLoading: boolean
  requestReason: string
  submitAllowed: boolean
  targetLabel: string
  totalTargetValue: string
  totalsAligned: boolean
}) {
  const totalTargetNumber = Number(input.totalTargetValue || 0)
  const remainingTarget = totalTargetNumber - input.allocationTotal

  return (
    <StoreSectionCard
      title={input.copy.targetRequestTitle}
      description={input.copy.targetRequestCopy}
      badge={{ label: input.copy.storeManagerMode, tone: 'accent' }}
      className="tw:w-full tw:max-w-[820px] tw:overflow-hidden tw:bg-card/90 tw:shadow-[0_16px_44px_rgba(23,30,58,0.06)]"
    >
      <div className="tw:grid tw:gap-3 tw:lg:grid-cols-3">
        <label className="tw:flex tw:flex-col tw:gap-1 tw:text-xs tw:font-medium tw:text-muted-foreground">
          {input.copy.targetLabel}
          <Input
            value={input.targetLabel}
            onChange={(event) => input.onTargetLabelChange(event.target.value)}
          />
        </label>
        <label className="tw:flex tw:flex-col tw:gap-1 tw:text-xs tw:font-medium tw:text-muted-foreground">
          {input.copy.totalTarget}
          <Input
            inputMode="numeric"
            value={formatCurrencyInputValue(totalTargetNumber, input.locale)}
            onChange={(event) =>
              input.onTotalTargetValueChange(String(parseCurrencyInputValue(event.target.value) || ''))
            }
          />
        </label>
        <div className="tw:grid tw:grid-cols-2 tw:gap-2">
          <StoreStackedRow tone={input.totalsAligned ? 'calm' : 'warning'}>
            <span className="tw:text-xs tw:text-muted-foreground">{input.copy.allocationTotal}</span>
            <strong className="tw:block tw:text-sm">
              {formatAmount(input.allocationTotal, input.locale, input.copy.emptyValue)}
            </strong>
          </StoreStackedRow>
          <StoreStackedRow tone={remainingTarget === 0 && totalTargetNumber > 0 ? 'calm' : 'warning'}>
            <span className="tw:text-xs tw:text-muted-foreground">{input.copy.remainingTarget}</span>
            <strong className="tw:block tw:text-sm">
              {formatAmount(remainingTarget, input.locale, input.copy.emptyValue)}
            </strong>
          </StoreStackedRow>
        </div>
      </div>

      <label className="tw:mt-3 tw:flex tw:flex-col tw:gap-1 tw:text-xs tw:font-medium tw:text-muted-foreground">
        {input.copy.requestReason}
        <Textarea
          value={input.requestReason}
          onChange={(event) => input.onRequestReasonChange(event.target.value)}
          rows={3}
        />
      </label>

      {input.personnelLoading ? (
        <StoreEmptyState description={input.copy.targetRequestCopy} />
      ) : input.personnelErrorVisible ? (
        <StoreErrorState
          title={input.copy.targetRequestTitle}
          description={getErrorMessage(input.personnelError)}
        />
      ) : input.activeAllocations.length === 0 ? (
        <StoreEmptyState title={input.copy.noPersonnelTitle} description={input.copy.noPersonnelCopy} />
      ) : (
        <div className="tw:mt-3 tw:flex tw:flex-col tw:gap-2">
          <div className="tw:hidden tw:grid-cols-[minmax(0,1fr)_220px_80px_minmax(0,1fr)] tw:gap-3 tw:px-3 tw:text-xs tw:font-medium tw:text-muted-foreground tw:lg:grid">
            <span>{input.copy.personnel}</span>
            <span>{input.copy.targetValue}</span>
            <span>{input.copy.share}</span>
            <span>{input.copy.optionalNote}</span>
          </div>
          {input.activeAllocations.map((allocation) => (
            <StoreStackedRow
              key={allocation.employeeId}
              className="tw:border-border/80 tw:bg-white/72 tw:shadow-[0_8px_22px_rgba(23,30,58,0.035)]"
            >
              <div className="tw:grid tw:gap-3 tw:lg:grid-cols-[minmax(0,1fr)_220px_80px_minmax(0,1fr)] tw:lg:items-center">
                <div className="tw:min-w-0">
                  <strong className="tw:block tw:text-sm tw:font-medium tw:text-foreground">
                    {allocation.assigneeLabel}
                  </strong>
                </div>
                <label className="tw:flex tw:flex-col tw:gap-1 tw:text-xs tw:font-medium tw:text-muted-foreground tw:lg:contents">
                  <span className="tw:lg:hidden">{input.copy.targetValue}</span>
                  <Input
                    aria-label={`${allocation.assigneeLabel} ${input.copy.targetValue}`}
                    inputMode="numeric"
                    value={formatCurrencyInputValue(Number(allocation.targetValue || 0), input.locale)}
                    onChange={(event) =>
                      input.onAllocationValueChange(
                        allocation.employeeId,
                        parseCurrencyInputValue(event.target.value),
                      )
                    }
                  />
                </label>
                <div className="tw:flex tw:items-center tw:gap-2 tw:text-xs tw:text-muted-foreground">
                  <span className="tw:lg:hidden">{input.copy.share}</span>
                  <StoreStatusBadge tone="neutral">
                    {formatTargetShare(Number(allocation.targetValue || 0), totalTargetNumber, input.locale)}
                  </StoreStatusBadge>
                </div>
                <label className="tw:flex tw:flex-col tw:gap-1 tw:text-xs tw:font-medium tw:text-muted-foreground tw:lg:contents">
                  <span className="tw:lg:hidden">{input.copy.optionalNote}</span>
                  <Input
                    value={allocation.note ?? ''}
                    onChange={(event) =>
                      input.onAllocationNoteChange(allocation.employeeId, event.target.value)
                    }
                    placeholder={input.copy.optionalNote}
                  />
                </label>
              </div>
            </StoreStackedRow>
          ))}
        </div>
      )}

      {!input.totalsAligned && totalTargetNumber > 0 ? (
        <p className="tw:mt-3 tw:text-xs tw:font-medium tw:text-muted-foreground">
          {input.copy.allocationMismatch}
        </p>
      ) : null}
      {input.createVisible ? (
        <p className="tw:mt-3 tw:text-sm tw:text-destructive">{getErrorMessage(input.createError)}</p>
      ) : null}

      <div className="tw:mt-4 tw:flex tw:justify-end">
        <Button
          type="button"
          disabled={!input.submitAllowed || input.createPending}
          onClick={input.onSubmit}
        >
          <Send data-icon="inline-start" />
          {input.createPending ? input.copy.submitting : input.copy.submitTarget}
        </Button>
      </div>
    </StoreSectionCard>
  )
}

export function TargetApprovalQueue(input: {
  approvalNotes: Record<string, string>
  approveMutation: UseMutationResult<
    Awaited<ReturnType<typeof approveTargetDistributionRequest>>,
    Error,
    Parameters<typeof approveTargetDistributionRequest>[0]
  >
  authSummary: AuthSessionSummary | null
  copy: TargetCopy
  locale: AppLocale
  onApprovalNoteChange: (requestId: string, value: string) => void
  pendingRequests: TargetDistributionRequest[]
}) {
  const [openRequestId, setOpenRequestId] = useState<string | null>(null)
  const [approvalDrafts, setApprovalDrafts] = useState<Record<string, Record<string, number>>>({})
  const firstRequestId = input.pendingRequests[0]?.requestId ?? null
  const effectiveOpenRequestId =
    openRequestId === null ? firstRequestId : openRequestId

  const resetApprovalDraft = (requestId: string) => {
    setApprovalDrafts((current) => {
      const next = { ...current }
      delete next[requestId]
      return next
    })
  }

  return (
    <StoreSectionCard
      title={input.copy.targetApprovalQueue}
      description={input.copy.approvalQueueCopy}
      badge={{ label: `${input.pendingRequests.length} ${input.copy.storeName.toLowerCase()}`, tone: 'warning' }}
      className="tw:w-full tw:max-w-[820px] tw:overflow-hidden tw:bg-card/90 tw:shadow-[0_16px_44px_rgba(23,30,58,0.06)]"
    >
      {input.pendingRequests.length === 0 ? (
        <StoreEmptyState title={input.copy.noPendingTitle} description={input.copy.noPendingCopy} />
      ) : (
        <StoreStackedList>
          {input.pendingRequests.map((request) => {
            const canApprove = canApproveTargetDistributionRequest(input.authSummary, request.storeId)
            const isApproving =
              input.approveMutation.isPending &&
              input.approveMutation.variables?.requestId === request.requestId
            const approvalNote = input.approvalNotes[request.requestId]?.trim() ?? ''
            const isOpen = effectiveOpenRequestId === request.requestId
            const originalTotal = Number(request.totalTargetValue || 0)
            const draftValues = approvalDrafts[request.requestId] ?? {}
            const allocations = request.allocations.map((allocation) => ({
              ...allocation,
              targetValue:
                draftValues[allocation.employeeId] ?? Number(allocation.targetValue || 0),
            }))
            const allocationTotal = allocations.reduce(
              (sum, allocation) => sum + Number(allocation.targetValue || 0),
              0,
            )
            const difference = allocationTotal - originalTotal
            const hasEditedTargets = allocations.some(
              (allocation) =>
                Number(allocation.targetValue || 0) !==
                Number(
                  request.allocations.find((item) => item.employeeId === allocation.employeeId)
                    ?.targetValue || 0,
                ),
            )
            const hasEveryTarget = allocations.every(
              (allocation) => Number(allocation.targetValue || 0) > 0,
            )
            const totalsAligned = Math.abs(difference) < 0.0001
            const canSubmit =
              canApprove &&
              !isApproving &&
              (!hasEditedTargets || (hasEveryTarget && totalsAligned && Boolean(approvalNote)))

            return (
              <StoreStackedRow
                key={request.requestId}
                tone={canApprove ? 'warning' : 'neutral'}
                className="tw:w-fit tw:max-w-full tw:overflow-hidden tw:border-border/80 tw:bg-white/90 tw:p-0 tw:shadow-[inset_3px_0_0_rgba(245,158,11,0.28),0_10px_28px_rgba(23,30,58,0.04)]"
              >
                <div className="tw:flex tw:flex-col">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    className="tw:grid tw:w-full tw:border-0 tw:bg-transparent tw:gap-3 tw:p-3 tw:text-left tw:text-inherit tw:lg:grid-cols-[minmax(230px,300px)_auto_24px] tw:lg:items-center"
                    onClick={() => setOpenRequestId(isOpen ? '' : request.requestId)}
                  >
                    <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
                      <span className="tw:grid tw:size-10 tw:shrink-0 tw:place-items-center tw:rounded-lg tw:bg-primary/10 tw:text-primary">
                        <Store data-icon="inline-start" />
                      </span>
                      <div className="tw:min-w-0">
                        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
                          <strong className="tw:text-sm tw:font-medium tw:text-foreground">
                            {request.storeName || request.storeId}
                          </strong>
                          <StoreStatusBadge tone="warning">{input.copy.pendingStatus}</StoreStatusBadge>
                        </div>
                        <p className="tw:mt-1 tw:text-xs tw:leading-5 tw:text-muted-foreground">
                          {formatDate(request.requestMonth, input.locale)} - {request.targetLabel}
                        </p>
                      </div>
                    </div>
                    <div className="tw:grid tw:gap-2 tw:sm:grid-cols-3">
                      <KeyValue
                        label={input.copy.totalTarget}
                        value={formatAmount(request.totalTargetValue, input.locale, input.copy.emptyValue)}
                      />
                      <KeyValue label={input.copy.allocationCount} value={String(request.allocationCount)} />
                      <KeyValue
                        label={input.copy.createdAt}
                        value={formatDateTime(request.createdAt, input.locale)}
                      />
                    </div>
                    <span
                      className={cn(
                        'tw:grid tw:size-6 tw:place-items-center tw:rounded-full tw:bg-primary/10 tw:text-primary tw:transition-transform',
                        isOpen ? 'tw:rotate-180' : undefined,
                      )}
                    >
                      <ChevronDown data-icon="inline-start" />
                    </span>
                  </button>

                  {isOpen && request.allocations.length > 0 ? (
                    <div className="tw:mx-3 tw:mb-3 tw:w-fit tw:max-w-full tw:overflow-hidden tw:rounded-lg tw:border tw:border-border/80">
                      <div className="tw:grid tw:grid-cols-[minmax(0,1fr)_92px_64px] tw:gap-2 tw:bg-muted/55 tw:px-3 tw:py-2 tw:text-xs tw:font-medium tw:text-muted-foreground tw:md:grid-cols-[minmax(180px,260px)_110px_72px_96px]">
                        <span>{input.copy.personnel}</span>
                        <span>{input.copy.targetValue}</span>
                        <span>{input.copy.share}</span>
                        <span className="tw:hidden tw:md:block">{input.copy.status}</span>
                      </div>
                      {allocations.map((allocation) => {
                        const originalValue = Number(
                          request.allocations.find((item) => item.employeeId === allocation.employeeId)
                            ?.targetValue || 0,
                        )
                        const isEdited =
                          Number(allocation.targetValue || 0) !== originalValue

                        return (
                        <div
                          key={allocation.employeeId}
                          className="tw:grid tw:grid-cols-[minmax(0,1fr)_92px_64px] tw:items-center tw:gap-2 tw:border-t tw:border-border/70 tw:bg-white/80 tw:px-3 tw:py-2 tw:md:grid-cols-[minmax(180px,260px)_110px_72px_96px]"
                        >
                          <div className="tw:min-w-0">
                            <strong className="tw:block tw:text-sm tw:font-medium tw:text-foreground">
                              {allocation.assigneeLabel}
                            </strong>
                          </div>
                          {canApprove ? (
                            <Input
                              aria-label={`${allocation.assigneeLabel} ${input.copy.targetValue}`}
                              disabled={isApproving}
                              inputMode="numeric"
                              value={formatCurrencyInputValue(Number(allocation.targetValue || 0), input.locale)}
                              onChange={(event) =>
                                setApprovalDrafts((current) => ({
                                  ...current,
                                  [request.requestId]: {
                                    ...(current[request.requestId] ?? {}),
                                    [allocation.employeeId]: parseCurrencyInputValue(event.target.value),
                                  },
                                }))
                              }
                              className="tw:h-9 tw:text-sm tw:font-medium"
                            />
                          ) : (
                            <span className="tw:text-sm tw:font-medium">
                              {formatAmount(
                                Number(allocation.targetValue || 0),
                                input.locale,
                                input.copy.emptyValue,
                              )}
                            </span>
                          )}
                          <StoreStatusBadge tone="calm">
                            {formatTargetShare(Number(allocation.targetValue || 0), originalTotal, input.locale)}
                          </StoreStatusBadge>
                          <StoreStatusBadge
                            tone={isEdited ? 'accent' : 'warning'}
                            className="tw:hidden tw:md:inline-flex"
                          >
                            {isEdited ? input.copy.adjustedStatus : input.copy.pendingStatus}
                          </StoreStatusBadge>
                        </div>
                        )
                      })}
                    </div>
                  ) : null}

                  {isOpen && request.allocations.length > 0 ? (
                    <div className="tw:mx-3 tw:mb-3 tw:grid tw:gap-2 tw:sm:grid-cols-3">
                      <KeyValue
                        label={input.copy.totalTarget}
                        value={formatAmount(originalTotal, input.locale, input.copy.emptyValue)}
                      />
                      <KeyValue
                        label={input.copy.allocationTotal}
                        value={formatAmount(allocationTotal, input.locale, input.copy.emptyValue)}
                      />
                      <KeyValue
                        label={input.copy.difference}
                        value={`${difference < 0 ? '-' : ''}${formatAmount(
                          Math.abs(difference),
                          input.locale,
                          input.copy.emptyValue,
                        )}`}
                      />
                    </div>
                  ) : null}

                  {isOpen && request.requestReason ? (
                    <p className="tw:px-3 tw:pb-2 tw:text-xs tw:leading-5 tw:text-muted-foreground">
                      {input.copy.reason}: {request.requestReason}
                    </p>
                  ) : null}
                  {isOpen ? (
                    <div className="tw:grid tw:gap-2 tw:border-t tw:border-border/70 tw:bg-white/62 tw:p-3 tw:md:grid-cols-[minmax(0,1fr)_auto] tw:md:items-end">
                      <label className="tw:flex tw:flex-col tw:gap-1 tw:text-xs tw:font-medium tw:text-muted-foreground">
                        {input.copy.approvalNote}
                        <Textarea
                          rows={2}
                          value={input.approvalNotes[request.requestId] ?? ''}
                          onChange={(event) =>
                            input.onApprovalNoteChange(request.requestId, event.target.value)
                          }
                          disabled={!canApprove}
                          className="tw:min-h-12"
                        />
                        {hasEditedTargets && !approvalNote ? (
                          <span className="tw:text-xs tw:font-medium tw:text-destructive">
                            {input.copy.approvalEditedNoteRequired}
                          </span>
                        ) : null}
                      </label>
                      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-end tw:gap-2">
                        {!canApprove ? (
                          <span className="tw:text-xs tw:text-muted-foreground">
                            {input.copy.cannotApprove}
                          </span>
                        ) : null}
                        {hasEditedTargets && !hasEveryTarget ? (
                          <span className="tw:text-xs tw:font-medium tw:text-destructive">
                            {input.copy.approvalPositiveTargets}
                          </span>
                        ) : null}
                        {hasEditedTargets && hasEveryTarget && !totalsAligned ? (
                          <span className="tw:text-xs tw:font-medium tw:text-destructive">
                            {input.copy.allocationMismatch}
                          </span>
                        ) : null}
                        {hasEditedTargets ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isApproving}
                            onClick={() => resetApprovalDraft(request.requestId)}
                          >
                            {input.copy.resetApprovalDraft}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          disabled={!canSubmit}
                          onClick={() =>
                            input.approveMutation.mutate({
                              requestId: request.requestId,
                              ...(approvalNote ? { approvalNote } : {}),
                              ...(hasEditedTargets
                                ? {
                                    approvedTotalTargetValue: originalTotal,
                                    approvedAllocations: allocations.map((allocation) => ({
                                      employeeId: allocation.employeeId,
                                      assigneeLabel: allocation.assigneeLabel,
                                      targetValue: Number(allocation.targetValue || 0),
                                      ...(allocation.note ? { note: allocation.note } : {}),
                                    })),
                                  }
                                : {}),
                            })
                          }
                        >
                          <BadgeCheck data-icon="inline-start" />
                          {isApproving
                            ? input.copy.approving
                            : hasEditedTargets
                              ? input.copy.approveAdjusted
                              : input.copy.approve}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </StoreStackedRow>
            )
          })}
        </StoreStackedList>
      )}
      {input.approveMutation.isError ? (
        <p className="tw:mt-3 tw:text-sm tw:text-destructive">
          {getErrorMessage(input.approveMutation.error)}
        </p>
      ) : null}
    </StoreSectionCard>
  )
}

export function TargetCoveragePanel(input: {
  copy: TargetCopy
  coverageRows: TargetCoverageRow[]
  locale: AppLocale
  summary: TargetCoverageSummary
}) {
  return (
    <StoreSectionCard
      title={input.copy.coverageTitle}
      description={input.copy.coverageCopy}
      badge={{ label: String(input.summary.totalEmployees), tone: 'accent' }}
    >
      {input.coverageRows.length === 0 ? (
        <StoreEmptyState title={input.copy.noCoverageTitle} description={input.copy.noCoverageCopy} />
      ) : (
        <div className="tw:rounded-lg tw:border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{input.copy.personnel}</TableHead>
                <TableHead>{input.copy.storeName}</TableHead>
                <TableHead>{input.copy.approvedTarget}</TableHead>
                <TableHead>{input.copy.pendingTarget}</TableHead>
                <TableHead>{input.copy.status}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {input.coverageRows.map((row) => (
                <TableRow
                  key={`${row.storeId}-${row.employeeId}`}
                  className={cn(row.targetStatus !== 'approved' ? 'tw:bg-muted/25' : undefined)}
                >
                  <TableCell>
                    <strong>{row.displayName}</strong>
                    <span className="tw:block tw:text-xs tw:text-muted-foreground">
                      {row.externalEmployeeRef ?? input.copy.emptyValue}
                    </span>
                  </TableCell>
                  <TableCell>{row.storeName || row.storeId}</TableCell>
                  <TableCell>{formatAmount(row.targetValue, input.locale, input.copy.emptyValue)}</TableCell>
                  <TableCell>{formatAmount(row.pendingTargetValue, input.locale, input.copy.emptyValue)}</TableCell>
                  <TableCell>
                    <StoreStatusBadge tone={mapTargetCoverageTone(row.targetStatus)}>
                      {formatTargetCoverageStatus(row.targetStatus, input.copy)}
                    </StoreStatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </StoreSectionCard>
  )
}

export function TargetApprovedRequestsPanel(input: {
  approvedRequests: TargetDistributionRequest[]
  copy: TargetCopy
  locale: AppLocale
}) {
  return (
    <StoreSectionCard
      title={input.copy.approvedRequests}
      description={input.copy.approvedRequestsCopy}
      badge={{ label: String(input.approvedRequests.length), tone: 'calm' }}
      className="tw:w-full tw:max-w-[820px] tw:overflow-hidden tw:bg-card/90 tw:shadow-[0_16px_44px_rgba(23,30,58,0.06)]"
    >
      {input.approvedRequests.length === 0 ? (
        <StoreEmptyState title={input.copy.noApprovedTitle} description={input.copy.noApprovedCopy} />
      ) : (
        <StoreStackedList>
          {input.approvedRequests.map((request) => (
            <ApprovedRequestSnapshot
              key={request.requestId}
              copy={input.copy}
              locale={input.locale}
              request={request}
            />
          ))}
        </StoreStackedList>
      )}
    </StoreSectionCard>
  )
}

export function TargetRevisionPanel(input: {
  approvedRequests: TargetDistributionRequest[]
  copy: TargetCopy
  createError: unknown
  createPending: boolean
  createVisible: boolean
  locale: AppLocale
  onSubmitRevision: (
    request: TargetDistributionRequest,
    allocations: TargetDistributionAllocation[],
    note: string,
  ) => void
}) {
  const [openRequestId, setOpenRequestId] = useState<string | null>(null)
  const [revisionDrafts, setRevisionDrafts] = useState<Record<string, Record<string, number>>>({})
  const [revisionNotes, setRevisionNotes] = useState<Record<string, string>>({})

  const openRevision = (request: TargetDistributionRequest) => {
    setOpenRequestId(request.requestId)
    setRevisionDrafts((current) => {
      if (current[request.requestId]) {
        return current
      }

      return {
        ...current,
        [request.requestId]: Object.fromEntries(
          request.allocations.map((allocation) => [
            allocation.employeeId,
            Number(allocation.targetValue || 0),
          ]),
        ),
      }
    })
  }

  return (
    <StoreSectionCard
      title={input.copy.revisionRequests}
      description={input.copy.revisionRequestsCopy}
      badge={{ label: String(input.approvedRequests.length), tone: 'accent' }}
      className="tw:w-full tw:max-w-[820px] tw:overflow-hidden tw:bg-card/90 tw:shadow-[0_16px_44px_rgba(23,30,58,0.06)]"
    >
      {input.approvedRequests.length === 0 ? (
        <StoreEmptyState title={input.copy.noApprovedTitle} description={input.copy.noApprovedCopy} />
      ) : (
        <StoreStackedList>
          {input.approvedRequests.map((request) => {
            const isOpen = openRequestId === request.requestId
            const draftValues = revisionDrafts[request.requestId] ?? {}
            const note = revisionNotes[request.requestId] ?? ''
            const allocations = request.allocations.map((allocation) => ({
              ...allocation,
              targetValue:
                draftValues[allocation.employeeId] ?? Number(allocation.targetValue || 0),
            }))
            const revisionTotal = allocations.reduce(
              (sum, allocation) => sum + Number(allocation.targetValue || 0),
              0,
            )
            const difference = revisionTotal - Number(request.totalTargetValue || 0)
            const hasChanged = allocations.some(
              (allocation) =>
                Number(allocation.targetValue || 0) !==
                Number(
                  request.allocations.find((item) => item.employeeId === allocation.employeeId)
                    ?.targetValue || 0,
                ),
            )
            const hasEveryTarget = allocations.every(
              (allocation) => Number(allocation.targetValue || 0) > 0,
            )
            const canSubmit =
              isOpen &&
              hasChanged &&
              hasEveryTarget &&
              difference === 0 &&
              Boolean(note.trim()) &&
              !input.createPending

            return (
              <StoreStackedRow key={request.requestId} tone={isOpen ? 'accent' : 'calm'}>
                <div className="tw:flex tw:flex-col tw:gap-3">
                  <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-start tw:md:justify-between">
                    <div>
                      <strong className="tw:text-sm">{request.targetLabel}</strong>
                      <p className="tw:mt-1 tw:text-xs tw:text-muted-foreground">
                        {request.storeName || request.storeId} - {formatDate(request.requestMonth, input.locale)}
                      </p>
                    </div>
                    <StoreStatusBadge tone="calm">
                      {request.approvedAt
                        ? formatDateTime(request.approvedAt, input.locale)
                        : input.copy.loaded}
                    </StoreStatusBadge>
                  </div>

                  <div className="tw:grid tw:gap-2 tw:sm:grid-cols-3">
                    <KeyValue
                      label={input.copy.approvedTotal}
                      value={formatAmount(request.totalTargetValue, input.locale, input.copy.emptyValue)}
                    />
                    <KeyValue
                      label={input.copy.revisionTotal}
                      value={formatAmount(revisionTotal, input.locale, input.copy.emptyValue)}
                    />
                    <KeyValue
                      label={input.copy.difference}
                      value={`${difference < 0 ? '-' : ''}${formatAmount(Math.abs(difference), input.locale, input.copy.emptyValue)}`}
                    />
                  </div>

                  <div className="tw:flex tw:flex-col tw:gap-2">
                    {allocations.map((allocation) => (
                      <div
                        key={allocation.employeeId}
                        className="tw:grid tw:items-center tw:gap-2 tw:border-t tw:pt-2 tw:sm:grid-cols-[minmax(0,220px)_140px]"
                      >
                        <span className="tw:text-xs tw:text-muted-foreground">
                          {allocation.assigneeLabel}
                        </span>
                        <Input
                          aria-label={`${allocation.assigneeLabel} ${input.copy.revisionSubmit}`}
                          disabled={!isOpen}
                          inputMode="numeric"
                          value={formatCurrencyInputValue(
                            Number(allocation.targetValue || 0),
                            input.locale,
                          )}
                          onChange={(event) =>
                            setRevisionDrafts((current) => ({
                              ...current,
                              [request.requestId]: {
                                ...(current[request.requestId] ?? {}),
                                [allocation.employeeId]: parseCurrencyInputValue(event.target.value),
                              },
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>

                  {isOpen ? (
                    <label className="tw:flex tw:flex-col tw:gap-1 tw:text-xs tw:font-medium tw:text-muted-foreground">
                      {input.copy.revisionNote}
                      <Textarea
                        rows={3}
                        value={note}
                        onChange={(event) =>
                          setRevisionNotes((current) => ({
                            ...current,
                            [request.requestId]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  ) : null}

                  {isOpen && difference !== 0 ? (
                    <p className="tw:text-xs tw:font-medium tw:text-muted-foreground">
                      {input.copy.revisionMismatch}
                    </p>
                  ) : null}
                  {isOpen && !hasChanged ? (
                    <p className="tw:text-xs tw:font-medium tw:text-muted-foreground">
                      {input.copy.revisionNoChange}
                    </p>
                  ) : null}
                  {input.createVisible && isOpen ? (
                    <p className="tw:text-sm tw:text-destructive">
                      {getErrorMessage(input.createError)}
                    </p>
                  ) : null}

                  <div className="tw:flex tw:justify-end tw:gap-2">
                    {!isOpen ? (
                      <Button type="button" variant="outline" onClick={() => openRevision(request)}>
                        <FilePenLine data-icon="inline-start" />
                        {input.copy.revisionCreate}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        disabled={!canSubmit}
                        onClick={() => input.onSubmitRevision(request, allocations, note)}
                      >
                        <Send data-icon="inline-start" />
                        {input.createPending ? input.copy.submitting : input.copy.revisionSubmit}
                      </Button>
                    )}
                  </div>
                </div>
              </StoreStackedRow>
            )
          })}
        </StoreStackedList>
      )}
    </StoreSectionCard>
  )
}

function ApprovedRequestSnapshot(input: {
  copy: TargetCopy
  locale: AppLocale
  request: TargetDistributionRequest
}) {
  return (
    <StoreStackedRow tone="calm">
      <div className="tw:flex tw:flex-col tw:gap-3">
        <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-start tw:md:justify-between">
          <div>
            <strong className="tw:text-sm">{input.request.targetLabel}</strong>
            <p className="tw:mt-1 tw:text-xs tw:text-muted-foreground">
              {input.request.storeName || input.request.storeId} -{' '}
              {formatDate(input.request.requestMonth, input.locale)}
            </p>
          </div>
          <StoreStatusBadge tone="calm">
            {formatAmount(input.request.totalTargetValue, input.locale, input.copy.emptyValue)}
          </StoreStatusBadge>
        </div>
        {input.request.allocations.length > 0 ? (
          <div className="tw:flex tw:flex-col tw:gap-2">
            {input.request.allocations.map((allocation) => (
              <div
                key={allocation.employeeId}
                className="tw:grid tw:items-center tw:gap-2 tw:border-t tw:pt-2 tw:sm:grid-cols-[minmax(0,220px)_120px]"
              >
                <span className="tw:text-xs tw:text-muted-foreground">
                  {allocation.assigneeLabel}
                </span>
                <strong className="tw:text-xs tw:font-medium tw:text-foreground">
                  {formatAmount(Number(allocation.targetValue || 0), input.locale, input.copy.emptyValue)}
                </strong>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </StoreStackedRow>
  )
}

function KeyValue(input: { label: string; value: string }) {
  return (
    <div className="tw:min-w-[72px] tw:rounded-lg tw:border tw:border-border/70 tw:bg-card/70 tw:p-2">
      <span className="tw:text-[11px] tw:text-muted-foreground">{input.label}</span>
      <strong className="tw:mt-1 tw:block tw:text-xs tw:font-medium tw:text-foreground">{input.value}</strong>
    </div>
  )
}

function formatAmount(value: number | null, locale: AppLocale, emptyValue: string) {
  if (value === null || !Number.isFinite(value)) {
    return emptyValue
  }

  return formatNumber(value, locale, { maximumFractionDigits: 0 })
}

function formatCurrencyInputValue(value: number, locale: AppLocale) {
  if (!Number.isFinite(value) || value <= 0) {
    return ''
  }

  return `${formatNumber(value, locale, { maximumFractionDigits: 0 })} TL`
}

function parseCurrencyInputValue(value: string) {
  return Number(value.replace(/\D/g, '')) || 0
}

function formatTargetShare(value: number, total: number, locale: AppLocale) {
  if (!Number.isFinite(total) || total <= 0) {
    return '0%'
  }

  return `${formatNumber((value / total) * 100, locale, { maximumFractionDigits: 1 })}%`
}

function mapTargetCoverageTone(status: string): StoreSurfaceTone {
  switch (status) {
    case 'approved':
      return 'calm'
    case 'pending_region_approval':
      return 'warning'
    case 'missing':
    case 'pending_change_conflict':
    case 'stale_reference':
      return 'danger'
    default:
      return 'neutral'
  }
}

function formatTargetCoverageStatus(status: string, copy: TargetCopy) {
  switch (status) {
    case 'approved':
      return copy.loaded
    case 'pending_region_approval':
      return copy.pendingRequests
    case 'pending_change_conflict':
      return copy.coverageRisk
    case 'stale_reference':
      return copy.coverageRisk
    case 'missing':
      return copy.emptyValue
    default:
      return status.replaceAll('_', ' ')
  }
}
