import { useState } from 'react'
import { FilePenLine, Send, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  type TargetCoverageRow,
  type TargetCoverageSummary,
  type TargetDistributionAllocation,
  type TargetDistributionRequest,
} from '../features/targets/api'
import { normalizeDisplayLabel } from '../lib/display-labels'
import { formatDate, formatDateTime, formatNumber, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import {
  StoreEmptyState,
  StoreErrorState,
  StoreStatusBadge,
  type StoreSurfaceTone,
} from './store-surface-primitives'
export { TargetApprovalQueue } from './store-targets-approval-queue'

export type TargetCopy = {
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
    <section className="targets-command-panel" aria-labelledby="target-distribution-title">
      <div className="targets-command-ledger-summary">
        <div>
          <h2 id="target-distribution-title">{input.copy.targetRequestTitle}</h2>
          <p>{input.copy.targetRequestCopy}</p>
        </div>
        <StoreStatusBadge tone="accent">{input.copy.storeManagerMode}</StoreStatusBadge>
      </div>

      <div className="targets-command-panel-body">
        <div className="targets-command-distribution-grid">
          <label className="targets-command-form-field">
            <span>{input.copy.targetLabel}</span>
            <Input
              value={input.targetLabel}
              onChange={(event) => input.onTargetLabelChange(event.target.value)}
            />
          </label>
          <label className="targets-command-form-field">
            <span>{input.copy.totalTarget}</span>
            <Input
              inputMode="numeric"
              value={formatCurrencyInputValue(totalTargetNumber, input.locale)}
              onChange={(event) =>
                input.onTotalTargetValueChange(String(parseCurrencyInputValue(event.target.value) || ''))
              }
            />
          </label>
          <div className="targets-command-mini-grid">
            <KeyValue
              label={input.copy.allocationTotal}
              value={formatAmount(input.allocationTotal, input.locale, input.copy.emptyValue)}
              tone={input.totalsAligned ? 'good' : 'warning'}
            />
            <KeyValue
              label={input.copy.remainingTarget}
              value={formatAmount(remainingTarget, input.locale, input.copy.emptyValue)}
              tone={remainingTarget === 0 && totalTargetNumber > 0 ? 'good' : 'warning'}
            />
          </div>
        </div>

        <label className="targets-command-form-field">
          <span>{input.copy.requestReason}</span>
          <Textarea
            value={input.requestReason}
            onChange={(event) => input.onRequestReasonChange(event.target.value)}
            rows={3}
          />
        </label>

        {input.personnelLoading ? (
          <div className="targets-command-panel-empty">
            <StoreEmptyState description={input.copy.targetRequestCopy} />
          </div>
        ) : input.personnelErrorVisible ? (
          <div className="targets-command-panel-empty">
            <StoreErrorState
              title={input.copy.targetRequestTitle}
              description={getErrorMessage(input.personnelError)}
            />
          </div>
        ) : input.activeAllocations.length === 0 ? (
          <div className="targets-command-panel-empty">
            <StoreEmptyState title={input.copy.noPersonnelTitle} description={input.copy.noPersonnelCopy} />
          </div>
        ) : (
          <div className="targets-command-allocation-editor">
            <div className="targets-command-allocation-head">
              <span>{input.copy.personnel}</span>
              <span>{input.copy.targetValue}</span>
              <span>{input.copy.share}</span>
              <span>{input.copy.optionalNote}</span>
            </div>
            <div className="targets-command-allocation-list">
              {input.activeAllocations.map((allocation) => (
                <div className="targets-command-allocation-row" key={allocation.employeeId}>
                  <div className="targets-command-target-person">
                    <strong>{allocation.assigneeLabel}</strong>
                  </div>
                  <label className="targets-command-compact-field">
                    <span>{input.copy.targetValue}</span>
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
                  <div className="targets-command-share-pill">
                    {formatTargetShare(Number(allocation.targetValue || 0), totalTargetNumber, input.locale)}
                  </div>
                  <label className="targets-command-compact-field">
                    <span>{input.copy.optionalNote}</span>
                    <Input
                      value={allocation.note ?? ''}
                      onChange={(event) =>
                        input.onAllocationNoteChange(allocation.employeeId, event.target.value)
                      }
                      placeholder={input.copy.optionalNote}
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {!input.totalsAligned && totalTargetNumber > 0 ? (
          <p className="targets-command-warning">{input.copy.allocationMismatch}</p>
        ) : null}
        {input.createVisible ? (
          <p className="targets-command-error">{getErrorMessage(input.createError)}</p>
        ) : null}

        <div className="targets-command-panel-actions">
          <Button
            type="button"
            disabled={!input.submitAllowed || input.createPending}
            onClick={input.onSubmit}
          >
            <Send data-icon="inline-start" />
            {input.createPending ? input.copy.submitting : input.copy.submitTarget}
          </Button>
        </div>
      </div>
    </section>
  )
}

export function TargetCoveragePanel(input: {
  copy: TargetCopy
  coverageRows: TargetCoverageRow[]
  locale: AppLocale
  summary: TargetCoverageSummary
}) {
  return (
    <section
      className="targets-command-ledger targets-command-coverage-ledger"
      aria-labelledby="target-coverage-title"
      title={input.copy.coverageTitle}
    >
      <div className="targets-command-ledger-summary">
        <div>
          <h2 id="target-coverage-title">{input.copy.coverageTitle}</h2>
          <p>{input.copy.coverageCopy}</p>
        </div>
        <StoreStatusBadge tone="accent">{input.summary.totalEmployees}</StoreStatusBadge>
      </div>
      {input.coverageRows.length === 0 ? (
        <div className="targets-command-ledger-empty">
          <StoreEmptyState title={input.copy.noCoverageTitle} description={input.copy.noCoverageCopy} />
        </div>
      ) : (
        <div className="targets-command-coverage-list">
          <div className="targets-command-coverage-head" aria-hidden="true">
            <span>{input.copy.personnel}</span>
            <span>{input.copy.storeName}</span>
            <span>{input.copy.approvedTarget}</span>
            <span>{input.copy.pendingTarget}</span>
            <span>{input.copy.status}</span>
          </div>
          {input.coverageRows.map((row) => (
            <div
              className={cn(
                'targets-command-coverage-row',
                row.targetStatus !== 'approved' ? 'is-attention' : undefined,
              )}
              key={`${row.storeId}-${row.employeeId}`}
            >
              <span className="targets-command-target-person">
                <strong>{row.displayName}</strong>
                <small>{row.externalEmployeeRef ?? input.copy.emptyValue}</small>
              </span>
              <span>{normalizeDisplayLabel(row.storeName, input.copy.emptyValue)}</span>
              <span className="targets-command-money">
                {formatAmount(row.targetValue, input.locale, input.copy.emptyValue)}
              </span>
              <span className="targets-command-money">
                {formatAmount(row.pendingTargetValue, input.locale, input.copy.emptyValue)}
              </span>
              <span>
                <StoreStatusBadge tone={mapTargetCoverageTone(row.targetStatus)}>
                  {formatTargetCoverageStatus(row.targetStatus, input.copy)}
                </StoreStatusBadge>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function TargetApprovedRequestsPanel(input: {
  approvedRequests: TargetDistributionRequest[]
  copy: TargetCopy
  locale: AppLocale
}) {
  return (
    <section
      className="targets-command-ledger targets-command-approved-ledger"
      aria-labelledby="target-approved-title"
      title={input.copy.approvedRequests}
    >
      <div className="targets-command-ledger-summary">
        <div>
          <h2 id="target-approved-title">{input.copy.approvedRequests}</h2>
          <p>{input.copy.approvedRequestsCopy}</p>
        </div>
        <StoreStatusBadge tone="calm">{input.approvedRequests.length}</StoreStatusBadge>
      </div>
      {input.approvedRequests.length === 0 ? (
        <div className="targets-command-ledger-empty">
          <StoreEmptyState title={input.copy.noApprovedTitle} description={input.copy.noApprovedCopy} />
        </div>
      ) : (
        <div className="targets-command-approved-list">
          {input.approvedRequests.map((request) => (
            <ApprovedRequestSnapshot
              key={request.requestId}
              copy={input.copy}
              locale={input.locale}
              request={request}
            />
          ))}
        </div>
      )}
    </section>
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
    <section className="targets-command-panel targets-command-revision-panel" aria-labelledby="target-revision-title">
      <div className="targets-command-ledger-summary">
        <div>
          <h2 id="target-revision-title">{input.copy.revisionRequests}</h2>
          <p>{input.copy.revisionRequestsCopy}</p>
        </div>
        <StoreStatusBadge tone="accent">{input.approvedRequests.length}</StoreStatusBadge>
      </div>
      {input.approvedRequests.length === 0 ? (
        <div className="targets-command-ledger-empty">
          <StoreEmptyState title={input.copy.noApprovedTitle} description={input.copy.noApprovedCopy} />
        </div>
      ) : (
        <div className="targets-command-revision-list">
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
              <article
                className={cn('targets-command-revision-card', isOpen ? 'is-open' : undefined)}
                key={request.requestId}
              >
                <div className="targets-command-revision-card-body">
                  <div className="targets-command-revision-head">
                    <div>
                      <strong>{request.targetLabel}</strong>
                      <p>
                        {normalizeDisplayLabel(request.storeName, input.copy.emptyValue)} - {formatDate(request.requestMonth, input.locale)}
                      </p>
                    </div>
                    <StoreStatusBadge tone="calm">
                      {request.approvedAt
                        ? formatDateTime(request.approvedAt, input.locale)
                        : input.copy.loaded}
                    </StoreStatusBadge>
                  </div>

                  <div className="targets-command-mini-grid">
                    <KeyValue
                      label={input.copy.approvedTotal}
                      value={formatAmount(request.totalTargetValue, input.locale, input.copy.emptyValue)}
                      tone="good"
                    />
                    <KeyValue
                      label={input.copy.revisionTotal}
                      value={formatAmount(revisionTotal, input.locale, input.copy.emptyValue)}
                      tone={difference === 0 ? 'good' : 'warning'}
                    />
                    <KeyValue
                      label={input.copy.difference}
                      value={`${difference < 0 ? '-' : ''}${formatAmount(Math.abs(difference), input.locale, input.copy.emptyValue)}`}
                      tone={difference === 0 ? 'good' : 'warning'}
                    />
                  </div>

                  <div className="targets-command-target-list">
                    {allocations.map((allocation) => (
                      <div
                        key={allocation.employeeId}
                        className={cn(
                          'targets-command-target-row',
                          Number(allocation.targetValue || 0) !==
                            Number(
                              request.allocations.find((item) => item.employeeId === allocation.employeeId)
                                ?.targetValue || 0,
                            )
                            ? 'is-changed'
                            : undefined,
                        )}
                      >
                        <span>
                          <strong>{allocation.assigneeLabel}</strong>
                          <small>{formatTargetShare(Number(allocation.targetValue || 0), revisionTotal, input.locale)}</small>
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
                    <label className="targets-command-form-field">
                      <span>{input.copy.revisionNote}</span>
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
                    <p className="targets-command-warning">{input.copy.revisionMismatch}</p>
                  ) : null}
                  {isOpen && !hasChanged ? (
                    <p className="targets-command-warning">{input.copy.revisionNoChange}</p>
                  ) : null}
                  {input.createVisible && isOpen ? (
                    <p className="targets-command-error">{getErrorMessage(input.createError)}</p>
                  ) : null}

                  <div className="targets-command-panel-actions">
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
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function ApprovedRequestSnapshot(input: {
  copy: TargetCopy
  locale: AppLocale
  request: TargetDistributionRequest
}) {
  return (
    <article className="targets-command-approved-card">
      <div className="targets-command-approved-head">
        <span className="targets-command-store-cell">
          <span className="targets-command-store-icon">
            <Store data-icon="inline-start" />
          </span>
          <span>
            <strong>{normalizeDisplayLabel(input.request.storeName, input.copy.emptyValue)}</strong>
            <small>{input.request.targetLabel}</small>
          </span>
        </span>
        <span className="targets-command-money">
          {formatAmount(input.request.totalTargetValue, input.locale, input.copy.emptyValue)}
        </span>
        <StoreStatusBadge tone="calm">
          {input.request.approvedAt
            ? formatDateTime(input.request.approvedAt, input.locale)
            : formatDate(input.request.requestMonth, input.locale)}
        </StoreStatusBadge>
      </div>
      {input.request.allocations.length > 0 ? (
        <div className="targets-command-approved-allocations">
          {input.request.allocations.map((allocation) => (
            <div className="targets-command-target-row" key={allocation.employeeId}>
              <span>
                <strong>{allocation.assigneeLabel}</strong>
                <small>{input.copy.personnel}</small>
              </span>
              <span className="targets-command-money">
                {formatAmount(Number(allocation.targetValue || 0), input.locale, input.copy.emptyValue)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  )
}

function KeyValue(input: { label: string; value: string; tone?: 'good' | 'warning' | 'danger' }) {
  return (
    <div
      className={cn(
        'targets-command-mini-stat',
        input.tone === 'danger' ? 'is-danger' : undefined,
        input.tone === 'warning' ? 'is-warning' : undefined,
        input.tone === 'good' ? 'is-good' : undefined,
      )}
    >
      <span>{input.label}</span>
      <strong>{input.value}</strong>
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
