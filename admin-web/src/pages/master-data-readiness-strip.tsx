import { AlertTriangle, CheckCircle2, DatabaseZap, ShieldCheck } from 'lucide-react'
import type { MasterDataBootstrapBatchItem } from '../features/integrations/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import {
  AdminKeyValue,
  AdminKeyValueGrid,
  AdminSurfaceBadge,
  AdminSurfaceSection,
} from './admin-surface-primitives'
import { formatNumber } from './master-data-bootstrap-model'

function getReadinessBucket(batch: MasterDataBootstrapBatchItem) {
  const value = String(batch.readiness ?? batch.batchStatus)

  if (
    value === 'ready_to_promote' ||
    value === 'promote_ready_rows' ||
    value === 'valid' ||
    value === 'ready'
  ) {
    return 'ready'
  }

  if (value === 'needs_review' || value === 'review_rows' || value === 'blocked' || value === 'invalid') {
    return 'review'
  }

  if (value === 'closed' || value === 'promoted' || value === 'already_closed' || value === 'already_promoted') {
    return 'closed'
  }

  return 'validation'
}

export function MasterDataReadinessStrip(input: {
  batches: MasterDataBootstrapBatchItem[]
  t: TranslateFunction
}) {
  const counts = input.batches.reduce(
    (result, batch) => {
      result[getReadinessBucket(batch)] += 1
      return result
    },
    { closed: 0, ready: 0, review: 0, validation: 0 },
  )
  const actionableCount = counts.ready + counts.review + counts.validation
  const statusTone = actionableCount === 0 ? 'success' : counts.review > 0 ? 'warning' : 'cyan'

  return (
    <AdminSurfaceSection
      eyebrow={input.t('adminMasterData.readinessHandoffEyebrow')}
      title={input.t('adminMasterData.readinessHandoffTitle')}
      description={input.t('adminMasterData.readinessHandoffCopy')}
      badge={
        <AdminSurfaceBadge tone={statusTone}>
          {input.batches.length === 0
            ? input.t('adminMasterData.readinessNoBatch')
            : input.t('adminMasterData.rowsSuffix', { count: input.batches.length })}
        </AdminSurfaceBadge>
      }
    >
      <AdminKeyValueGrid className="tw:lg:grid-cols-4">
        <AdminKeyValue
          label={input.t('adminMasterData.readinessReady')}
          value={
            <span className="tw:inline-flex tw:items-center tw:gap-2">
              <ShieldCheck className="tw:size-4 tw:text-cyan-600" aria-hidden="true" />
              {formatNumber(counts.ready)}
            </span>
          }
        />
        <AdminKeyValue
          label={input.t('adminMasterData.readinessValidation')}
          value={
            <span className="tw:inline-flex tw:items-center tw:gap-2">
              <DatabaseZap className="tw:size-4 tw:text-amber-600" aria-hidden="true" />
              {formatNumber(counts.validation)}
            </span>
          }
        />
        <AdminKeyValue
          label={input.t('adminMasterData.readinessReview')}
          value={
            <span className="tw:inline-flex tw:items-center tw:gap-2">
              <AlertTriangle className="tw:size-4 tw:text-rose-600" aria-hidden="true" />
              {formatNumber(counts.review)}
            </span>
          }
        />
        <AdminKeyValue
          label={input.t('adminMasterData.readinessClosed')}
          value={
            <span className="tw:inline-flex tw:items-center tw:gap-2">
              <CheckCircle2 className="tw:size-4 tw:text-emerald-600" aria-hidden="true" />
              {formatNumber(counts.closed)}
            </span>
          }
        />
      </AdminKeyValueGrid>
    </AdminSurfaceSection>
  )
}
