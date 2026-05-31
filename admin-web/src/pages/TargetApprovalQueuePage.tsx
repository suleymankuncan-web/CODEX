import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  ClipboardCheck,
  ReceiptText,
  Store,
  Target,
  UsersRound,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Textarea } from '../components/ui/textarea'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  canApproveTargetDistributionRequest,
  getAssignedStoreIds,
} from '../features/auth/authorization'
import {
  approveTargetDistributionRequest,
  getAllTargetDistributionRequests,
  getTargetCoverage,
  type TargetCoverageRow,
  type TargetDistributionRequest,
} from '../features/targets/api'
import { toTargetApprovalInboxItem } from '../features/workflow/contracts'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { formatDate, formatDateTime, formatNumber, formatState, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { cn } from '../lib/utils'
import {
  AdminActionRow,
  AdminKeyValue,
  AdminKeyValueGrid,
  AdminMetricStrip,
  AdminStatePanel,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
  AdminSurfaceHeader,
  AdminSurfacePage,
  AdminSurfaceSection,
  type AdminSurfaceTone,
} from './admin-surface-primitives'

export function TargetApprovalQueuePage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { locale, t } = useLocalization()
  const queryClient = useQueryClient()
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({})
  const [approvalNotice, setApprovalNotice] = useState<string | null>(null)
  const currentRequestMonth = getCurrentRequestMonth()
  const approvalsQuery = useQuery({
    queryKey: ['target-distribution-requests', 'approval-queue'],
    queryFn: () => getAllTargetDistributionRequests(),
    staleTime: 30_000,
  })
  const coverageQuery = useQuery({
    queryKey: ['target-distribution-coverage', currentRequestMonth],
    queryFn: () => getTargetCoverage({ requestMonth: currentRequestMonth }),
    staleTime: 30_000,
  })
  const approveMutation = useMutation({
    mutationFn: approveTargetDistributionRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['target-distribution-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['target-distribution-coverage'] })
      setApprovalNotice(result.command.message)
    },
  })

  if (approvalsQuery.isLoading) {
    return (
      <AdminSurfacePage ariaLabel={t('adminTargets.loadingTitle')}>
        <AdminStatePanel
          title={t('adminTargets.loadingTitle')}
          description={t('adminTargets.loadingCopy')}
          isLoading
        />
      </AdminSurfacePage>
    )
  }

  if (approvalsQuery.isError) {
    return (
      <AdminSurfacePage ariaLabel={t('adminTargets.errorTitle')}>
        <AdminStatePanel
          title={t('adminTargets.errorTitle')}
          description={getErrorMessage(approvalsQuery.error)}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }

  const items = approvalsQuery.data?.items ?? []
  const inboxItems = items.map((item) => toTargetApprovalInboxItem(item))
  const pendingItems = items.filter((item) => item.status === 'pending_region_approval')
  const approvedItems = items.filter((item) => item.status === 'approved').slice(0, 5)
  const pendingCount = inboxItems.filter((item) => item.inboxStatus === 'needs_attention').length
  const approvedCount = inboxItems.filter((item) => item.inboxStatus === 'completed').length
  const coverageRows = coverageQuery.data?.items ?? []
  const coverageSummary = coverageQuery.data?.summary ?? createEmptyCoverageSummary(currentRequestMonth)
  const attentionCoverageRows = coverageRows
    .filter((item) => item.targetStatus !== 'approved')
    .slice(0, 8)
  const assignedStoreScope = getAssignedStoreIds(input.authSummary)

  return (
    <AdminSurfacePage ariaLabel={t('adminTargets.title')}>
      <AdminSurfaceHeader
        icon={<ClipboardCheck size={20} />}
        eyebrow={t('adminTargets.heroEyebrow')}
        title={t('adminTargets.title')}
        description={t('adminTargets.heroCopy')}
        meta={
          <>
            <AdminSurfaceBadge tone={pendingCount > 0 ? 'warning' : 'success'}>
              {pendingCount > 0 ? t('adminTargets.needsAttention') : t('adminTargets.clear')}
            </AdminSurfaceBadge>
            <AdminSurfaceBadge tone="neutral">
              {t('adminTargets.actionStores')}: {assignedStoreScope.length || t('adminTargets.none')}
            </AdminSurfaceBadge>
          </>
        }
      />

      <AdminMetricStrip
        items={[
          {
            id: 'pending-target-approvals',
            label: t('adminTargets.pendingApprovals'),
            value: pendingCount,
            description: t('adminTargets.pendingApprovalsNote'),
            icon: <ReceiptText size={18} />,
            tone: pendingCount > 0 ? 'warning' : 'success',
          },
          {
            id: 'approved-target-requests',
            label: t('adminTargets.recentlyApproved'),
            value: approvedCount,
            description: t('adminTargets.recentlyApprovedNote'),
            icon: <CheckCircle2 size={18} />,
            tone: approvedCount > 0 ? 'success' : 'neutral',
          },
          {
            id: 'target-coverage-rate',
            label: t('adminTargets.coverageRate'),
            value: formatCoverageRate(coverageSummary.coverageRate),
            description: `${coverageSummary.coveredEmployees} / ${coverageSummary.totalEmployees}`,
            icon: <Target size={18} />,
            tone: mapCoverageSummaryTone(coverageSummary),
          },
          {
            id: 'personnel-in-target-scope',
            label: t('adminTargets.personnelInScope'),
            value: coverageSummary.totalEmployees,
            description: t('adminTargets.coverageEyebrow'),
            icon: <UsersRound size={18} />,
            tone: 'cyan',
          },
        ]}
      />

      <AdminSurfaceSection
        ariaLabel={t('adminTargets.coverageEyebrow')}
        eyebrow={t('adminTargets.coverageEyebrow')}
        title={t('adminTargets.coverageTitle')}
        badge={
          <AdminSurfaceBadge tone={mapCoverageSummaryTone(coverageSummary)}>
            {coverageSummary.uncoveredEmployees > 0
              ? t('adminTargets.needsReview')
              : t('adminTargets.complete')}
          </AdminSurfaceBadge>
        }
      >
        {coverageQuery.isLoading ? (
          <AdminStatePanel title={t('adminTargets.coverageLoading')} isLoading />
        ) : coverageQuery.isError ? (
          <AdminStatePanel title={getErrorMessage(coverageQuery.error)} tone="danger" />
        ) : (
          <>
            <AdminKeyValueGrid className="tw:lg:grid-cols-4">
              <AdminKeyValue label={t('adminTargets.coveredPersonnel')} value={String(coverageSummary.coveredEmployees)} />
              <AdminKeyValue label={t('adminTargets.pendingApproval')} value={String(coverageSummary.pendingEmployees)} />
              <AdminKeyValue label={t('adminTargets.pendingChanges')} value={String(coverageSummary.conflictEmployees)} />
              <AdminKeyValue label={t('adminTargets.staleReferences')} value={String(coverageSummary.staleEmployees)} />
              <AdminKeyValue label={t('adminTargets.missingTargets')} value={String(coverageSummary.missingEmployees)} />
              <AdminKeyValue label={t('adminTargets.coverageRate')} value={formatCoverageRate(coverageSummary.coverageRate)} />
              <AdminKeyValue label={t('adminTargets.personnelInScope')} value={String(coverageSummary.totalEmployees)} />
            </AdminKeyValueGrid>

            {attentionCoverageRows.length === 0 ? (
              <AdminSurfaceEmpty
                title={t('adminTargets.noCoverageIssuesTitle')}
                copy={t('adminTargets.noCoverageIssuesCopy')}
              />
            ) : (
              <div className="tw:grid tw:gap-2">
                {attentionCoverageRows.map((item) => (
                  <TargetCoverageAttentionRow key={`${item.storeId}-${item.employeeId}`} item={item} />
                ))}
              </div>
            )}
          </>
        )}
      </AdminSurfaceSection>

      <AdminSurfaceSection
        eyebrow={t('adminTargets.approvalQueue')}
        title={t('adminTargets.pendingRequestsTitle')}
        badge={
          <AdminSurfaceBadge tone={pendingCount > 0 ? 'warning' : 'success'}>
            {pendingCount > 0 ? t('adminTargets.needsAttention') : t('adminTargets.clear')}
          </AdminSurfaceBadge>
        }
      >
        {pendingItems.length === 0 ? (
          <AdminSurfaceEmpty
            title={t('adminTargets.noPendingTitle')}
            copy={t('adminTargets.noPendingCopy')}
          />
        ) : (
          <div className="tw:grid tw:gap-3">
            {pendingItems.map((item) => {
              const canApprove = canApproveTargetDistributionRequest(input.authSummary, item.storeId)

              return (
                <TargetApprovalRow
                  key={item.requestId}
                  item={item}
                  approvalNote={approvalNotes[item.requestId] ?? ''}
                  canApprove={canApprove}
                  onApprovalNoteChange={(next) =>
                    setApprovalNotes((current) => ({ ...current, [item.requestId]: next }))
                  }
                  onApprove={() => {
                    if (!canApprove) {
                      return
                    }

                    approveMutation.mutate({
                      requestId: item.requestId,
                      ...(approvalNotes[item.requestId]
                        ? { approvalNote: approvalNotes[item.requestId] }
                        : {}),
                    })
                  }}
                  approving={
                    approveMutation.isPending &&
                    approveMutation.variables?.requestId === item.requestId
                  }
                />
              )
            })}
          </div>
        )}

        {approvalNotice ? <AdminStatePanel title={approvalNotice} tone="success" /> : null}
      </AdminSurfaceSection>

      <AdminSurfaceSection
        eyebrow={t('adminTargets.recentHistory')}
        title={t('adminTargets.recentlyApprovedTitle')}
        badge={
          <AdminSurfaceBadge tone={approvedItems.length > 0 ? 'success' : 'accent'}>
            {approvedItems.length > 0
              ? t('adminTargets.visible')
              : t('adminTargets.noHistoryYet')}
          </AdminSurfaceBadge>
        }
      >
        {approvedItems.length === 0 ? (
          <AdminSurfaceEmpty
            title={t('adminTargets.noApprovedTitle')}
            copy={t('adminTargets.noApprovedCopy')}
          />
        ) : (
          <div className="tw:grid tw:gap-3">
            {approvedItems.map((item) => (
              <ApprovedTargetRequestRow key={item.requestId} item={item} locale={locale} t={t} />
            ))}
          </div>
        )}
      </AdminSurfaceSection>
    </AdminSurfacePage>
  )
}

function TargetCoverageAttentionRow(input: { item: TargetCoverageRow }) {
  const { t } = useLocalization()

  return (
    <Card className={cn('tw:border tw:bg-background/70', rowToneClass(mapTargetCoverageStatusTone(input.item.targetStatus)))} size="sm">
      <CardContent className="tw:grid tw:gap-3 tw:pt-0">
        <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
          <div className="tw:min-w-0">
            <div className="tw:flex tw:items-center tw:gap-2">
              <Store size={16} className="tw:text-primary" />
              <h3 className="tw:m-0 tw:text-base tw:font-medium tw:text-foreground">
                {input.item.displayName}
              </h3>
            </div>
            <p className="tw:mt-1 tw:text-sm tw:text-muted-foreground">
              {input.item.storeName || input.item.storeId}
            </p>
          </div>
          <AdminSurfaceBadge tone={mapTargetCoverageStatusTone(input.item.targetStatus)}>
            {formatTargetCoverageStatus(input.item.targetStatus, t)}
          </AdminSurfaceBadge>
        </div>
        <AdminKeyValueGrid>
          <AdminKeyValue label={t('adminTargets.sellerCode')} value={input.item.externalEmployeeRef ?? t('adminTargets.unknown')} />
          <AdminKeyValue label={t('adminTargets.approvedTarget')} value={formatTargetValue(input.item.targetValue, t)} />
          <AdminKeyValue label={t('adminTargets.pendingTarget')} value={formatTargetValue(input.item.pendingTargetValue, t)} />
          <AdminKeyValue
            label={t('adminTargets.referenceState')}
            value={formatTargetCoverageReferenceState(input.item, t)}
          />
        </AdminKeyValueGrid>
      </CardContent>
    </Card>
  )
}

function TargetApprovalRow(input: {
  item: TargetDistributionRequest
  approvalNote: string
  canApprove: boolean
  onApprovalNoteChange: (next: string) => void
  onApprove: () => void
  approving: boolean
}) {
  const { locale, t } = useLocalization()
  const allocations = Array.isArray(input.item.allocations) ? input.item.allocations : []
  const inboxItem = toTargetApprovalInboxItem(input.item)

  return (
    <Card className={cn('tw:border tw:bg-background/75', rowToneClass(mapTargetDistributionStatusTone(input.item.status)))} size="sm">
      <CardContent className="tw:grid tw:gap-3 tw:pt-0">
        <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
          <div className="tw:min-w-0">
            <h3 className="tw:m-0 tw:text-base tw:font-medium tw:text-foreground">{input.item.targetLabel}</h3>
            <p className="tw:mt-1 tw:text-sm tw:text-muted-foreground">
              {t('adminTargets.requestSummary', {
                store: input.item.storeName || input.item.storeId,
                month: formatDate(input.item.requestMonth, locale),
              })}
            </p>
          </div>
          <AdminSurfaceBadge tone={mapInboxStatusToSurfaceTone(inboxItem.inboxStatus)}>
            {formatTargetDistributionStatus(input.item.status, t)}
          </AdminSurfaceBadge>
        </div>
        <AdminKeyValueGrid>
          <AdminKeyValue
            label={t('adminTargets.totalTarget')}
            value={formatTargetAmount(input.item.totalTargetValue, locale)}
          />
          <AdminKeyValue label={t('adminTargets.allocationCount')} value={String(input.item.allocationCount)} />
          <AdminKeyValue label={t('adminTargets.submission')} value={formatDateTime(input.item.createdAt, locale)} />
          <AdminKeyValue label={t('adminTargets.requestOwner')} value={input.item.submittedByUserId} />
        </AdminKeyValueGrid>
        {input.item.requestReason ? (
          <p className="tw:text-sm tw:text-muted-foreground">
            {t('adminTargets.reason', { reason: input.item.requestReason })}
          </p>
        ) : null}
        <AdminActionRow>
          <AdminSurfaceBadge tone={mapTargetUrgencyTone(inboxItem.urgency)}>
            {t('adminTargets.urgency', {
              urgency: formatTargetUrgency(inboxItem.urgency, t),
            })}
          </AdminSurfaceBadge>
        </AdminActionRow>
        {allocations.length ? (
          <div className="tw:grid tw:gap-2">
            {allocations.map((allocation) => {
              const targetValue = Number(allocation.targetValue || 0)

              return (
                <div
                  className="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border tw:bg-card/75 tw:p-3 tw:sm:grid-cols-[minmax(0,1fr)_auto] tw:sm:items-center"
                  key={`${input.item.requestId}-${allocation.employeeId}`}
                >
                  <div className="tw:min-w-0">
                    <div className="tw:text-sm tw:font-medium tw:text-foreground">{allocation.assigneeLabel}</div>
                    {allocation.note ? <p className="tw:mt-1 tw:text-xs tw:text-muted-foreground">{allocation.note}</p> : null}
                  </div>
                  <AdminSurfaceBadge tone="neutral">
                    {formatTargetAmount(targetValue, locale)} /{' '}
                    {formatTargetShare(targetValue, input.item.totalTargetValue, locale)}
                  </AdminSurfaceBadge>
                </div>
              )
            })}
          </div>
        ) : null}
        {input.item.status !== 'approved' && input.canApprove ? (
          <div className="tw:grid tw:gap-2">
            <label
              className="tw:text-xs tw:font-medium tw:tracking-[0.08em] tw:text-muted-foreground tw:uppercase"
              htmlFor={`approval-note-${input.item.requestId}`}
            >
              {t('adminTargets.approvalNote')}
            </label>
            <Textarea
              id={`approval-note-${input.item.requestId}`}
              value={input.approvalNote}
              onChange={(event) => input.onApprovalNoteChange(event.target.value)}
              rows={3}
              placeholder={t('adminTargets.optionalRegionNote')}
            />
            <AdminActionRow className="tw:justify-end">
              <Button
                type="button"
                onClick={input.onApprove}
                disabled={input.approving || !input.canApprove}
              >
                <CheckCircle2 size={16} />
                {input.approving ? t('adminTargets.approving') : t('adminTargets.approveRequest')}
              </Button>
            </AdminActionRow>
          </div>
        ) : input.item.status !== 'approved' ? (
          <AdminStatePanel title={t('adminTargets.assignedStoreOnly')} tone="warning" />
        ) : input.item.approvedAt ? (
          <AdminStatePanel
            title={
              input.item.approvalNote
                ? t('adminTargets.approvedAtMessageWithNote', {
                    date: formatDateTime(input.item.approvedAt, locale),
                    note: input.item.approvalNote,
                  })
                : t('adminTargets.approvedAtMessage', {
                    date: formatDateTime(input.item.approvedAt, locale),
                  })
            }
            tone="success"
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

function ApprovedTargetRequestRow(input: {
  item: TargetDistributionRequest
  locale: AppLocale
  t: TranslateFunction
}) {
  const inboxItem = toTargetApprovalInboxItem(input.item)

  return (
    <Card className="tw:border tw:border-border tw:bg-background/75" size="sm">
      <CardContent className="tw:grid tw:gap-3 tw:pt-0">
        <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
          <div className="tw:min-w-0">
            <h3 className="tw:m-0 tw:text-base tw:font-medium tw:text-foreground">{input.item.targetLabel}</h3>
            <p className="tw:mt-1 tw:text-sm tw:text-muted-foreground">
              {input.t('adminTargets.requestSummary', {
                store: input.item.storeName || input.item.storeId,
                month: formatDate(input.item.requestMonth, input.locale),
              })}
            </p>
          </div>
          <AdminSurfaceBadge tone={mapInboxStatusToSurfaceTone(inboxItem.inboxStatus)}>
            {formatTargetDistributionStatus(input.item.status, input.t)}
          </AdminSurfaceBadge>
        </div>
        <AdminKeyValueGrid>
          <AdminKeyValue
            label={input.t('adminTargets.totalTarget')}
            value={formatTargetAmount(input.item.totalTargetValue, input.locale)}
          />
          <AdminKeyValue label={input.t('adminTargets.allocationCount')} value={String(input.item.allocationCount)} />
          <AdminKeyValue
            label={input.t('adminTargets.approvedAt')}
            value={input.item.approvedAt ? formatDateTime(input.item.approvedAt, input.locale) : input.t('adminTargets.unknown')}
          />
          <AdminKeyValue label={input.t('adminTargets.approver')} value={input.item.approvedByUserId ?? input.t('adminTargets.unknown')} />
        </AdminKeyValueGrid>
        {input.item.approvalNote ? (
          <p className="tw:text-sm tw:text-muted-foreground">{input.item.approvalNote}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function getCurrentRequestMonth() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')

  return `${now.getFullYear()}-${month}-01`
}

function createEmptyCoverageSummary(requestMonth: string) {
  return {
    requestMonth,
    totalEmployees: 0,
    coveredEmployees: 0,
    missingEmployees: 0,
    pendingEmployees: 0,
    conflictEmployees: 0,
    staleEmployees: 0,
    uncoveredEmployees: 0,
    coverageRate: 0,
  }
}

function formatCoverageRate(rate: number) {
  if (!Number.isFinite(rate)) {
    return '0%'
  }

  return `${Math.round(rate * 100)}%`
}

function formatTargetAmount(value: number, locale: AppLocale) {
  return formatNumber(value, locale, {
    maximumFractionDigits: 0,
  })
}

function formatTargetShare(value: number, total: number, locale: AppLocale) {
  if (total <= 0) {
    return '0%'
  }

  return `${formatNumber((value / total) * 100, locale, {
    maximumFractionDigits: 1,
  })}%`
}

function mapCoverageSummaryTone(summary: {
  missingEmployees: number
  pendingEmployees: number
  conflictEmployees: number
  staleEmployees: number
  uncoveredEmployees: number
}): AdminSurfaceTone {
  if (summary.conflictEmployees > 0 || summary.staleEmployees > 0) {
    return 'danger'
  }

  if (
    summary.missingEmployees > 0 ||
    summary.pendingEmployees > 0 ||
    summary.uncoveredEmployees > 0
  ) {
    return 'warning'
  }

  return 'success'
}

function formatTargetDistributionStatus(status: string, t: TranslateFunction) {
  switch (status) {
    case 'pending_region_approval':
      return t('adminTargets.status.pending_region_approval')
    case 'approved':
      return t('adminTargets.status.approved')
    default:
      return formatState(status)
  }
}

function formatTargetCoverageStatus(status: string, t: TranslateFunction) {
  switch (status) {
    case 'pending_region_approval':
      return t('adminTargets.status.pending_region_approval')
    case 'pending_change_conflict':
      return t('adminTargets.status.pending_change_conflict')
    case 'stale_reference':
      return t('adminTargets.status.stale_reference')
    case 'missing':
      return t('adminTargets.status.missing')
    case 'approved':
      return t('adminTargets.status.approved')
    default:
      return formatState(status)
  }
}

function mapTargetCoverageStatusTone(status: string): AdminSurfaceTone {
  switch (status) {
    case 'pending_change_conflict':
    case 'stale_reference':
      return 'danger'
    case 'pending_region_approval':
    case 'missing':
      return 'warning'
    case 'approved':
      return 'success'
    default:
      return 'neutral'
  }
}

function mapTargetDistributionStatusTone(status: string): AdminSurfaceTone {
  switch (status) {
    case 'pending_region_approval':
      return 'warning'
    case 'approved':
      return 'success'
    default:
      return 'neutral'
  }
}

function mapInboxStatusToSurfaceTone(status: string): AdminSurfaceTone {
  switch (status) {
    case 'needs_attention':
      return 'warning'
    case 'completed':
      return 'success'
    case 'informational':
      return 'accent'
    default:
      return 'neutral'
  }
}

function mapTargetUrgencyTone(urgency: string): AdminSurfaceTone {
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

function rowToneClass(tone: AdminSurfaceTone) {
  switch (tone) {
    case 'danger':
      return 'tw:border-rose-200'
    case 'warning':
      return 'tw:border-amber-200'
    case 'success':
      return 'tw:border-emerald-200'
    case 'cyan':
      return 'tw:border-cyan-200'
    case 'accent':
      return 'tw:border-violet-200'
    default:
      return 'tw:border-border'
  }
}

function formatTargetValue(value: number | null, t: TranslateFunction) {
  return value === null ? t('adminTargets.value.none') : String(value)
}

function formatTargetCoverageReferenceState(item: TargetCoverageRow, t: TranslateFunction) {
  if (item.staleTargetReferenceId) {
    return t('adminTargets.reference.storeMismatch')
  }

  if (item.targetReferenceId) {
    return t('adminTargets.reference.approved')
  }

  if (item.pendingRequestId) {
    return t('adminTargets.reference.waitingApproval')
  }

  return t('adminTargets.reference.none')
}

function formatTargetUrgency(urgency: string, t: TranslateFunction) {
  switch (urgency) {
    case 'high':
      return t('adminTargets.urgency.high')
    case 'medium':
      return t('adminTargets.urgency.medium')
    case 'low':
      return t('adminTargets.urgency.low')
    default:
      return formatState(urgency)
  }
}
