import { useState } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import { ArrowRight, BadgeCheck, RotateCcw, Store, X } from 'lucide-react'
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
import { formatDateTime, formatNumber, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { StoreEmptyState, StoreStatusBadge } from './store-surface-primitives'
import type { TargetCopy } from './store-targets-contract-sections'

type TargetApprovalDraft = {
  allocations?: Record<string, number>
  totalTargetValue?: number
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
  const [approvalDrafts, setApprovalDrafts] = useState<Record<string, TargetApprovalDraft>>({})
  const selectedRequest =
    input.pendingRequests.find((request) => request.requestId === openRequestId) ?? null

  const resetApprovalDraft = (requestId: string) => {
    setApprovalDrafts((current) => {
      const next = { ...current }
      delete next[requestId]
      return next
    })
  }

  const updateTotalDraft = (requestId: string, totalTargetValue: number) => {
    setApprovalDrafts((current) => ({
      ...current,
      [requestId]: {
        ...(current[requestId] ?? {}),
        totalTargetValue,
      },
    }))
  }

  const updateAllocationDraft = (requestId: string, employeeId: string, targetValue: number) => {
    setApprovalDrafts((current) => ({
      ...current,
      [requestId]: {
        ...(current[requestId] ?? {}),
        allocations: {
          ...(current[requestId]?.allocations ?? {}),
          [employeeId]: targetValue,
        },
      },
    }))
  }

  const submitApproval = (request: TargetDistributionRequest) => {
    const approvalState = resolveApprovalState(request, approvalDrafts[request.requestId], input.locale)
    const approvalNote = input.approvalNotes[request.requestId]?.trim() ?? ''

    input.approveMutation.mutate({
      requestId: request.requestId,
      ...(approvalNote ? { approvalNote } : {}),
      ...(approvalState.hasEditedTargets
        ? {
            approvedTotalTargetValue: approvalState.effectiveTotal,
            approvedAllocations: approvalState.allocations.map((allocation) => ({
              employeeId: allocation.employeeId,
              assigneeLabel: allocation.assigneeLabel,
              targetValue: Number(allocation.targetValue || 0),
              ...(allocation.note ? { note: allocation.note } : {}),
            })),
          }
        : {}),
    })
  }

  return (
    <section className="targets-command-ledger" aria-labelledby="target-approval-title">
      <div className="targets-command-ledger-summary">
        <div>
          <h2 id="target-approval-title">{input.copy.targetApprovalQueue}</h2>
          <p>{input.copy.approvalQueueCopy}</p>
        </div>
        <StoreStatusBadge tone={input.pendingRequests.length > 0 ? 'warning' : 'neutral'}>
          {input.pendingRequests.length} {input.copy.storeName.toLowerCase()}
        </StoreStatusBadge>
      </div>

      {input.pendingRequests.length === 0 ? (
        <div className="targets-command-ledger-empty">
          <StoreEmptyState title={input.copy.noPendingTitle} description={input.copy.noPendingCopy} />
        </div>
      ) : (
        <>
          <div className="targets-command-ledger-head" aria-hidden="true">
            <span>{input.copy.storeName}</span>
            <span>{input.copy.totalTarget}</span>
            <span>{input.copy.allocationTotal}</span>
            <span>{input.copy.personnel}</span>
            <span>{input.copy.status}</span>
            <span>{input.copy.approve}</span>
          </div>
          <div className="targets-command-ledger-list">
            {input.pendingRequests.map((request) => {
              const approvalState = resolveApprovalState(
                request,
                approvalDrafts[request.requestId],
                input.locale,
              )
              const canApprove = canApproveTargetDistributionRequest(input.authSummary, request.storeId)
              const isSelected = selectedRequest?.requestId === request.requestId

              return (
                <button
                  key={request.requestId}
                  type="button"
                  className={cn(
                    'targets-command-ledger-row',
                    isSelected ? 'is-selected' : undefined,
                    !canApprove ? 'is-readonly' : undefined,
                  )}
                  onClick={() => setOpenRequestId(request.requestId)}
                >
                  <span className="targets-command-store-cell">
                    <span className="targets-command-store-icon">
                      <Store data-icon="inline-start" />
                    </span>
                    <span>
                      <strong>{request.storeName || request.storeId}</strong>
                      <small>{formatRequestPeriod(request.requestMonth, input.locale)}</small>
                    </span>
                  </span>
                  <span className="targets-command-money">
                    {formatMoney(approvalState.effectiveTotal, input.locale, input.copy.emptyValue)}
                  </span>
                  <span className="targets-command-money">
                    {formatMoney(approvalState.allocationTotal, input.locale, input.copy.emptyValue)}
                  </span>
                  <span>{request.allocationCount}</span>
                  <span>
                    <StoreStatusBadge tone={canApprove ? 'warning' : 'neutral'}>
                      {canApprove ? input.copy.pendingStatus : input.copy.cannotApprove}
                    </StoreStatusBadge>
                  </span>
                  <span className="targets-command-row-cta">
                    {approvalState.hasEditedTargets ? input.copy.approveAdjusted : input.copy.approve}
                    <ArrowRight data-icon="inline-end" />
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {selectedRequest ? (
        <TargetApprovalDrawer
          approvalDraft={approvalDrafts[selectedRequest.requestId]}
          approvalNote={input.approvalNotes[selectedRequest.requestId] ?? ''}
          approveMutation={input.approveMutation}
          canApprove={canApproveTargetDistributionRequest(input.authSummary, selectedRequest.storeId)}
          copy={input.copy}
          locale={input.locale}
          onAllocationChange={(employeeId, value) =>
            updateAllocationDraft(selectedRequest.requestId, employeeId, value)
          }
          onClose={() => setOpenRequestId(null)}
          onNoteChange={(value) => input.onApprovalNoteChange(selectedRequest.requestId, value)}
          onReset={() => resetApprovalDraft(selectedRequest.requestId)}
          onSubmit={() => submitApproval(selectedRequest)}
          onTotalChange={(value) => updateTotalDraft(selectedRequest.requestId, value)}
          request={selectedRequest}
        />
      ) : null}

      {input.approveMutation.isError ? (
        <p className="targets-command-error">{getErrorMessage(input.approveMutation.error)}</p>
      ) : null}
    </section>
  )
}

function TargetApprovalDrawer(input: {
  approvalDraft: TargetApprovalDraft | undefined
  approvalNote: string
  approveMutation: UseMutationResult<
    Awaited<ReturnType<typeof approveTargetDistributionRequest>>,
    Error,
    Parameters<typeof approveTargetDistributionRequest>[0]
  >
  canApprove: boolean
  copy: TargetCopy
  locale: AppLocale
  onAllocationChange: (employeeId: string, value: number) => void
  onClose: () => void
  onNoteChange: (value: string) => void
  onReset: () => void
  onSubmit: () => void
  onTotalChange: (value: number) => void
  request: TargetDistributionRequest
}) {
  const approvalState = resolveApprovalState(input.request, input.approvalDraft, input.locale)
  const isApproving =
    input.approveMutation.isPending &&
    input.approveMutation.variables?.requestId === input.request.requestId
  const hasNote = Boolean(input.approvalNote.trim())
  const canSubmit =
    input.canApprove &&
    !isApproving &&
    (!approvalState.hasEditedTargets ||
      (approvalState.hasEveryTarget && approvalState.totalsAligned && hasNote))

  return (
    <div className="targets-command-drawer-layer">
      <button
        type="button"
        className="targets-command-drawer-backdrop"
        aria-label="Kapat"
        onClick={input.onClose}
      />
      <aside className="targets-command-detail-drawer" aria-label={`${input.request.storeName} hedef kararı`}>
        <header className="targets-command-detail-head">
          <div>
            <StoreStatusBadge tone="warning">{input.copy.pendingStatus}</StoreStatusBadge>
            <h3>{input.request.storeName || input.request.storeId}</h3>
            <p>
              {formatRequestPeriod(input.request.requestMonth, input.locale)}
              {input.request.targetLabel ? ` · ${input.request.targetLabel}` : ''}
            </p>
          </div>
          <Button type="button" variant="outline" size="icon" onClick={input.onClose} aria-label="Kapat">
            <X data-icon="inline-start" />
          </Button>
        </header>

        <div className="targets-command-detail-body">
          <div className="targets-command-mini-grid">
            <MiniStat
              label={input.copy.totalTarget}
              value={formatMoney(approvalState.effectiveTotal, input.locale, input.copy.emptyValue)}
            />
            <MiniStat
              label={input.copy.allocationTotal}
              value={formatMoney(approvalState.allocationTotal, input.locale, input.copy.emptyValue)}
              tone={approvalState.totalsAligned ? 'good' : 'warning'}
            />
            <MiniStat label={input.copy.allocationCount} value={String(input.request.allocationCount)} />
            <MiniStat
              label={input.copy.difference}
              value={formatSignedMoney(approvalState.difference, input.locale, input.copy.emptyValue)}
              tone={approvalState.totalsAligned ? 'good' : 'danger'}
            />
          </div>

          <section className="targets-command-decision-card">
            <div className="targets-command-card-title">
              <h4>{input.copy.totalTarget}</h4>
              {approvalState.hasEditedTargets ? (
                <StoreStatusBadge tone="accent">{input.copy.adjustedStatus}</StoreStatusBadge>
              ) : (
                <StoreStatusBadge tone="neutral">{input.copy.pendingStatus}</StoreStatusBadge>
              )}
            </div>
            <label className="targets-command-money-field">
              <span>{input.copy.totalTarget}</span>
              <Input
                aria-label={input.copy.totalTarget}
                disabled={!input.canApprove || isApproving}
                inputMode="numeric"
                value={formatCurrencyInputValue(approvalState.effectiveTotal, input.locale)}
                onChange={(event) => input.onTotalChange(parseCurrencyInputValue(event.target.value))}
              />
            </label>
            {input.request.requestReason ? (
              <p className="targets-command-muted">
                {input.copy.reason}: {input.request.requestReason}
              </p>
            ) : null}
          </section>

          <section className="targets-command-target-editor">
            <div className="targets-command-card-title">
              <h4>{input.copy.personnel}</h4>
              <span>{input.copy.targetValue}</span>
            </div>
            <div className="targets-command-target-list">
              {approvalState.allocations.map((allocation) => (
                <div
                  key={allocation.employeeId}
                  className={cn(
                    'targets-command-target-row',
                    allocation.isEdited ? 'is-changed' : undefined,
                  )}
                >
                  <div>
                    <strong>{allocation.assigneeLabel}</strong>
                    <small>
                      {input.copy.share}: {formatTargetShare(allocation.targetValue, approvalState.effectiveTotal, input.locale)}
                    </small>
                  </div>
                  <Input
                    aria-label={`${allocation.assigneeLabel} ${input.copy.targetValue}`}
                    disabled={!input.canApprove || isApproving}
                    inputMode="numeric"
                    value={formatCurrencyInputValue(allocation.targetValue, input.locale)}
                    onChange={(event) =>
                      input.onAllocationChange(
                        allocation.employeeId,
                        parseCurrencyInputValue(event.target.value),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="targets-command-decision-card">
            <div className="targets-command-card-title">
              <h4>{input.copy.approvalNote}</h4>
              <span>{input.copy.createdAt}: {formatDateTime(input.request.createdAt, input.locale)}</span>
            </div>
            <Textarea
              aria-label={input.copy.approvalNote}
              rows={4}
              value={input.approvalNote}
              onChange={(event) => input.onNoteChange(event.target.value)}
              disabled={!input.canApprove || isApproving}
              placeholder={input.copy.optionalNote}
            />
            {approvalState.hasEditedTargets && !hasNote ? (
              <p className="targets-command-error">{input.copy.approvalEditedNoteRequired}</p>
            ) : null}
            {approvalState.hasEditedTargets && !approvalState.hasEveryTarget ? (
              <p className="targets-command-error">{input.copy.approvalPositiveTargets}</p>
            ) : null}
            {approvalState.hasEditedTargets &&
            approvalState.hasEveryTarget &&
            !approvalState.totalsAligned ? (
              <p className="targets-command-error">{input.copy.allocationMismatch}</p>
            ) : null}
            {!input.canApprove ? (
              <p className="targets-command-muted">{input.copy.cannotApprove}</p>
            ) : null}
          </section>
        </div>

        <footer className="targets-command-drawer-footer">
          {approvalState.hasEditedTargets ? (
            <Button type="button" variant="outline" onClick={input.onReset} disabled={isApproving}>
              <RotateCcw data-icon="inline-start" />
              {input.copy.resetApprovalDraft}
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={input.onClose}>
            Kapat
          </Button>
          <Button type="button" onClick={input.onSubmit} disabled={!canSubmit}>
            <BadgeCheck data-icon="inline-start" />
            {isApproving
              ? input.copy.approving
              : approvalState.hasEditedTargets
                ? input.copy.approveAdjusted
                : input.copy.approve}
          </Button>
        </footer>
      </aside>
    </div>
  )
}

function MiniStat(input: { label: string; tone?: 'danger' | 'good' | 'warning'; value: string }) {
  return (
    <div className={cn('targets-command-mini-stat', input.tone ? `is-${input.tone}` : undefined)}>
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </div>
  )
}

function resolveApprovalState(
  request: TargetDistributionRequest,
  draft: TargetApprovalDraft | undefined,
  locale: AppLocale,
) {
  const originalTotal = Number(request.totalTargetValue || 0)
  const draftTotal = draft?.totalTargetValue
  const effectiveTotal =
    draftTotal !== undefined && Number.isFinite(draftTotal) ? draftTotal : originalTotal
  const allocations = request.allocations.map((allocation) => {
    const originalValue = Number(allocation.targetValue || 0)
    const draftValue = draft?.allocations?.[allocation.employeeId]
    const targetValue =
      draftValue !== undefined && Number.isFinite(draftValue) ? draftValue : originalValue

    return {
      ...allocation,
      isEdited: !areAmountsEqual(targetValue, originalValue),
      targetValue,
    }
  })
  const allocationTotal = allocations.reduce(
    (sum, allocation) => sum + Number(allocation.targetValue || 0),
    0,
  )
  const difference = allocationTotal - effectiveTotal
  const hasEditedTotal = !areAmountsEqual(effectiveTotal, originalTotal)
  const hasEditedTargets = hasEditedTotal || allocations.some((allocation) => allocation.isEdited)
  const hasEveryTarget = allocations.every((allocation) => Number(allocation.targetValue || 0) > 0)
  const totalsAligned = areAmountsEqual(difference, 0)

  return {
    allocationTotal,
    allocations,
    difference,
    effectiveTotal,
    hasEditedTargets,
    hasEveryTarget,
    locale,
    totalsAligned,
  }
}

function areAmountsEqual(left: number, right: number) {
  return Math.abs(Number(left || 0) - Number(right || 0)) < 0.0001
}

function formatMoney(value: number | null, locale: AppLocale, emptyValue: string) {
  if (value === null || !Number.isFinite(value)) {
    return emptyValue
  }

  return `${formatNumber(value, locale, { maximumFractionDigits: 0 })} TL`
}

function formatSignedMoney(value: number, locale: AppLocale, emptyValue: string) {
  if (!Number.isFinite(value) || areAmountsEqual(value, 0)) {
    return emptyValue
  }

  return `${value > 0 ? '+' : '-'}${formatMoney(Math.abs(value), locale, emptyValue)}`
}

function formatCurrencyInputValue(value: number, locale: AppLocale) {
  if (!Number.isFinite(value) || value <= 0) {
    return ''
  }

  return formatNumber(value, locale, { maximumFractionDigits: 0 })
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

function formatRequestPeriod(value: string, locale: AppLocale) {
  const [year, month] = value.slice(0, 7).split('-')
  const monthIndex = Number(month) - 1

  if (!year || !Number.isFinite(monthIndex)) {
    return value
  }

  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(Number(year), monthIndex, 1))
}
