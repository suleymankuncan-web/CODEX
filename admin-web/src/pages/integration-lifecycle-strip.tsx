import { ArrowRight, AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button } from '../components/ui/button'
import type { ImportOverview, NeedsActionItem } from '../features/integrations/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { formatState, mapHealthTone } from '../lib/format'
import {
  AdminActionRow,
  AdminKeyValue,
  AdminKeyValueGrid,
  AdminSurfaceBadge,
  AdminSurfaceSection,
} from './admin-surface-primitives'
import { toAdminTone } from '../features/integrations/integration-surface-tone'

const numberFormatter = new Intl.NumberFormat('tr-TR')

function formatNumber(value: number) {
  return numberFormatter.format(value)
}

function formatOptionalBatch(value: string | null, t: TranslateFunction) {
  return value ?? t('adminIntegrations.none')
}

export function IntegrationLifecycleStrip(input: {
  actionCount: number
  overview: ImportOverview
  primaryItem: NeedsActionItem | undefined
  t: TranslateFunction
  onOpenIssues: () => void
}) {
  const hasIssue = input.actionCount > 0
  const primaryItem = input.primaryItem

  return (
    <AdminSurfaceSection
      eyebrow={input.t('adminIntegrations.operatorHandoffEyebrow')}
      title={
        hasIssue
          ? input.t('adminIntegrations.operatorHandoffTitle')
          : input.t('adminIntegrations.operatorHandoffClearTitle')
      }
      description={
        primaryItem?.actionReason ??
        (hasIssue
          ? input.t('adminIntegrations.operatorHandoffCopy')
          : input.t('adminIntegrations.operatorHandoffClearCopy'))
      }
      badge={
        <AdminSurfaceBadge tone={hasIssue ? 'warning' : 'success'}>
          {hasIssue
            ? input.t('adminIntegrations.actionCount', { count: input.actionCount })
            : input.t('adminIntegrations.noCriticalBlock')}
        </AdminSurfaceBadge>
      }
      actions={
        hasIssue ? (
          <AdminActionRow className="tw:justify-start tw:sm:justify-end">
            <Button type="button" variant="outline" onClick={input.onOpenIssues}>
              {input.t('adminIntegrations.reviewIssues')}
              <ArrowRight aria-hidden="true" />
            </Button>
          </AdminActionRow>
        ) : null
      }
    >
      <AdminKeyValueGrid className="tw:lg:grid-cols-4">
        <AdminKeyValue
          label={input.t('adminIntegrations.latestCompleted')}
          value={formatOptionalBatch(input.overview.latest.completedBatchId, input.t)}
        />
        <AdminKeyValue
          label={input.t('adminIntegrations.primaryIssue')}
          value={
            primaryItem ? (
              <span className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
                <span>{primaryItem.sourceCode} / {primaryItem.entityType}</span>
                <AdminSurfaceBadge tone={toAdminTone(mapHealthTone(primaryItem.healthState))}>
                  {formatState(primaryItem.healthState)}
                </AdminSurfaceBadge>
              </span>
            ) : (
              input.t('adminIntegrations.noCriticalBlock')
            )
          }
        />
        <AdminKeyValue
          label={input.t('adminIntegrations.retryableBatches')}
          value={
            <span className="tw:inline-flex tw:items-center tw:gap-2">
              <RefreshCw className="tw:size-4 tw:text-muted-foreground" aria-hidden="true" />
              {formatNumber(input.overview.healthTotals.retryReady)}
            </span>
          }
        />
        <AdminKeyValue
          label={input.t('adminIntegrations.blockedBatches')}
          value={
            <span className="tw:inline-flex tw:items-center tw:gap-2">
              {input.overview.healthTotals.blocked > 0 ? (
                <AlertTriangle className="tw:size-4 tw:text-rose-600" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="tw:size-4 tw:text-emerald-600" aria-hidden="true" />
              )}
              {formatNumber(input.overview.healthTotals.blocked)}
            </span>
          }
        />
      </AdminKeyValueGrid>
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <AdminSurfaceBadge tone="cyan">
          <ShieldCheck className="tw:size-3.5" aria-hidden="true" />
          {input.t('adminIntegrations.evidence')}: {formatOptionalBatch(input.overview.latest.completedBatchId, input.t)}
        </AdminSurfaceBadge>
        {primaryItem?.recommendedAction ? (
          <AdminSurfaceBadge tone="warning">
            {input.t('adminIntegrations.issueReason')}: {primaryItem.recommendedAction}
          </AdminSurfaceBadge>
        ) : null}
      </div>
    </AdminSurfaceSection>
  )
}
