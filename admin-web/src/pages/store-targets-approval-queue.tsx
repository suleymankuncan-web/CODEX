import { useState } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import { BadgeCheck, ChevronDown, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { AuthSessionSummary } from '../features/auth/api'
import { canApproveTargetDistributionRequest } from '../features/auth/authorization'
import {
  approveTargetDistributionRequest,
  type TargetDistributionRequest,
} from '../features/targets/api'
import { formatDate, formatDateTime, formatNumber, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import {
  StoreEmptyState,
  StoreSectionCard,
  StoreStackedList,
  StoreStackedRow,
  StoreStatusBadge,
} from './store-surface-primitives'
import type { TargetCopy } from './store-targets-contract-sections'

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
