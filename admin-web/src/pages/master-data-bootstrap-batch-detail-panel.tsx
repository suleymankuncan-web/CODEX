import type { ReactNode } from 'react'
import { CheckCircle2, DatabaseZap, ListChecks, ShieldCheck } from 'lucide-react'
import { Button } from '../components/ui/button'
import type {
  MasterDataBootstrapBatchDetail,
  MasterDataBootstrapPromotionReadinessResponse,
  MasterDataBootstrapRow,
} from '../features/integrations/api'
import { useLocalization } from '../features/localization/useLocalization'
import { getErrorMessage } from '../lib/format'
import {
  AdminActionRow,
  AdminKeyValue,
  AdminKeyValueGrid,
  AdminMetricStrip,
  AdminStatePanel,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
  AdminSurfaceSection,
  type AdminSurfaceTone,
} from './admin-surface-primitives'
import {
  formatMasterDataEntity,
  formatMasterDataState,
  formatNumber,
  mapPromotionReadinessTone,
  mapReadinessTone,
  mapValidationTone,
  resolveDryRunRowLabel,
  resolveRowName,
} from './master-data-bootstrap-model'

export function BatchDetailPanel(input: {
  batchId: string
  detailLoading: boolean
  detailError: unknown
  detailIsError: boolean
  readinessLoading: boolean
  readinessError: unknown
  readinessIsError: boolean
  summary: MasterDataBootstrapBatchDetail['summary'] | null
  readiness: MasterDataBootstrapPromotionReadinessResponse['summary'] | null
  readinessRows: MasterDataBootstrapPromotionReadinessResponse['rows']['items']
  rows: MasterDataBootstrapRow[]
  validating: boolean
  promoting: boolean
  onValidate: () => void
  onPromote: () => void
}) {
  const { t } = useLocalization()

  if (input.detailLoading || input.readinessLoading) {
    return (
      <AdminStatePanel
        isLoading
        title={t('adminMasterData.detailLoadingTitle')}
        description={t('adminMasterData.detailLoadingCopy')}
      />
    )
  }

  if (input.detailIsError) {
    return (
      <AdminStatePanel
        title={t('adminMasterData.batchUnavailableTitle')}
        description={getErrorMessage(input.detailError)}
        tone="danger"
      />
    )
  }

  if (input.readinessIsError) {
    return (
      <AdminStatePanel
        title={t('adminMasterData.readinessUnavailableTitle')}
        description={getErrorMessage(input.readinessError)}
        tone="danger"
      />
    )
  }

  if (!input.summary || !input.readiness) {
    return (
      <AdminStatePanel
        title={t('adminMasterData.batchUnavailableTitle')}
        description={t('adminMasterData.missingEvidenceCopy')}
        tone="danger"
      />
    )
  }

  const promoteLabel =
    input.summary.bootstrapEntity === 'store'
      ? t('adminMasterData.promoteStores')
      : t('adminMasterData.promotePersonnel')
  const promotedLabel = input.summary.promotedCount + ' / ' + input.summary.rowCount

  return (
    <div className="tw:grid tw:gap-3">
      <AdminMetricStrip
        className="tw:xl:grid-cols-4"
        items={[
          {
            id: 'readyRows',
            label: t('adminMasterData.readyRows'),
            value: formatNumber(input.readiness.readyCount),
            description: t('adminMasterData.nextAction', {
              action: formatMasterDataState(input.readiness.nextAction, t),
            }),
            icon: <ListChecks size={18} />,
            tone: 'accent',
          },
          {
            id: 'promotedRows',
            label: t('adminMasterData.promotedRows'),
            value: formatNumber(input.summary.promotedCount),
            description: promotedLabel,
            icon: <ShieldCheck size={18} />,
            tone: 'success',
          },
          {
            id: 'needsValidation',
            label: t('adminMasterData.needsValidationMetric'),
            value: formatNumber(input.readiness.needsValidationCount),
            description: formatMasterDataState(input.readiness.nextAction, t),
            icon: <DatabaseZap size={18} />,
            tone: 'warning',
          },
          {
            id: 'blockedRows',
            label: t('adminMasterData.blockedRows'),
            value: formatNumber(input.readiness.blockedCount + input.readiness.needsReviewCount),
            description: formatMasterDataState(input.readiness.nextAction, t),
            icon: <CheckCircle2 size={18} />,
            tone: 'danger',
          },
        ]}
      />

      <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:xl:grid-cols-2">
        <AdminSurfaceSection
          eyebrow={t('adminMasterData.selectedBatch')}
          title={input.summary.sourceLabel}
          badge={
            <MasterDataEvidencePill tone={mapReadinessTone(input.readiness.nextAction)}>
              {formatMasterDataState(input.readiness.nextAction, t)}
            </MasterDataEvidencePill>
          }
        >
          <AdminKeyValueGrid className="tw:lg:grid-cols-2">
            <AdminKeyValue label={t('adminMasterData.batch')} value={input.batchId} />
            <AdminKeyValue label={t('adminMasterData.entity')} value={formatMasterDataEntity(input.summary.bootstrapEntity, t)} />
            <AdminKeyValue label={t('adminMasterData.status')} value={formatMasterDataState(input.summary.batchStatus, t)} />
            <AdminKeyValue
              label={t('adminMasterData.readiness')}
              value={input.readiness.canPromote ? t('adminMasterData.canPromote') : t('adminMasterData.blocked')}
            />
            <AdminKeyValue label={t('adminMasterData.promotedRows')} value={promotedLabel} />
            <AdminKeyValue label={t('adminMasterData.file')} value={input.summary.fileReference ?? t('adminMasterData.noFileReference')} />
          </AdminKeyValueGrid>
        </AdminSurfaceSection>

        <AdminSurfaceSection
          eyebrow={t('adminMasterData.actions')}
          title={t('adminMasterData.commandPanelTitle')}
          description={t('adminMasterData.commandPanelCopy')}
        >
          <AdminActionRow>
            <Button type="button" disabled={input.validating} onClick={input.onValidate}>
              {input.validating ? t('adminMasterData.validating') : t('adminMasterData.validateBatch')}
            </Button>
            <Button type="button" disabled={!input.readiness.canPromote || input.promoting} onClick={input.onPromote}>
              {input.promoting ? t('adminMasterData.promoting') : promoteLabel}
            </Button>
          </AdminActionRow>
          {!input.readiness.canPromote ? (
            <AdminStatePanel title={t('adminMasterData.promotionDisabled')} tone="warning" />
          ) : null}
        </AdminSurfaceSection>
      </div>

      <EvidenceList
        ariaLabel={t('adminMasterData.promotionDryRunEvidenceAria')}
        eyebrow={t('adminMasterData.dryRun')}
        title={t('adminMasterData.dryRunTitle')}
        copy={t('adminMasterData.dryRunCopy')}
        emptyCopy={t('adminMasterData.dryRunEmpty')}
        rows={input.readinessRows.map((row) => ({
          key: row.rowId,
          title: '#' + row.rowNumber + ' ' + resolveDryRunRowLabel(row),
          pill: formatMasterDataState(row.promotionReadiness, t),
          tone: mapPromotionReadinessTone(row.promotionReadiness),
          chips: [
            [t('adminMasterData.storeCode'), row.sourceStoreCode],
            [t('adminMasterData.employeeCode'), row.sourceEmployeeCode],
            [t('adminMasterData.promotedEntity'), row.promotedEntityId],
            [t('adminMasterData.blockReason'), row.blockReason],
          ],
        }))}
      />

      <EvidenceList
        ariaLabel={t('adminMasterData.bootstrapRowEvidenceAria')}
        eyebrow={t('adminMasterData.rowEvidence')}
        title={t('adminMasterData.rowEvidenceTitle')}
        emptyCopy={t('adminMasterData.rowEvidenceEmpty')}
        rows={input.rows.map((row) => ({
          key: row.rowId,
          title: '#' + row.rowNumber + ' ' + resolveRowName(row),
          pill: formatMasterDataState(row.validationStatus, t),
          tone: mapValidationTone(row.validationStatus),
          copy: row.issueMessage,
          chips: [
            [t('adminMasterData.storeCode'), row.sourceStoreCode],
            [t('adminMasterData.employeeCode'), row.sourceEmployeeCode],
            [t('adminMasterData.resolvedStore'), row.resolvedStoreId],
            [t('adminMasterData.resolvedEmployee'), row.resolvedEmployeeId],
            [t('adminMasterData.resolvedPosition'), row.resolvedPositionId],
            [t('adminMasterData.promotedEntity'), row.promotedEntityId],
          ],
        }))}
      />
    </div>
  )
}

function EvidenceList(input: {
  ariaLabel: string
  eyebrow: string
  title: string
  copy?: string
  emptyCopy: string
  rows: Array<{
    key: string
    title: string
    pill: string
    tone: 'accent' | 'calm' | 'warning' | 'danger' | 'neutral'
    copy?: string | null
    chips: Array<[string, string | null | undefined]>
  }>
}) {
  const { t } = useLocalization()

  return (
    <AdminSurfaceSection
      ariaLabel={input.ariaLabel}
      eyebrow={input.eyebrow}
      title={input.title}
      description={input.copy}
    >
      {input.rows.length === 0 ? (
        <AdminSurfaceEmpty copy={input.emptyCopy} />
      ) : (
        <div className="tw:grid tw:gap-2">
          {input.rows.map((row) => (
            <div className="tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:p-3" key={row.key}>
              <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
                <strong className="tw:text-sm tw:font-medium">{row.title}</strong>
                <MasterDataEvidencePill tone={row.tone}>{row.pill}</MasterDataEvidencePill>
              </div>
              {row.copy ? <p className="tw:mt-2 tw:text-sm tw:text-muted-foreground">{row.copy}</p> : null}
              <div className="tw:mt-3 tw:flex tw:flex-wrap tw:gap-2">
                {row.chips.map(([label, value]) => (
                  <AdminSurfaceBadge tone="neutral" key={row.key + '-' + label}>
                    {label}: <code>{value ?? t('adminMasterData.notResolved')}</code>
                  </AdminSurfaceBadge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminSurfaceSection>
  )
}

function MasterDataEvidencePill(input: {
  children: ReactNode
  tone?: 'accent' | 'calm' | 'warning' | 'danger' | 'neutral'
}) {
  return <AdminSurfaceBadge tone={toMasterDataSurfaceTone(input.tone)}>{input.children}</AdminSurfaceBadge>
}

function toMasterDataSurfaceTone(input?: 'accent' | 'calm' | 'warning' | 'danger' | 'neutral'): AdminSurfaceTone {
  if (input === 'calm') return 'success'
  if (input === 'accent') return 'accent'
  if (input === 'warning') return 'warning'
  if (input === 'danger') return 'danger'
  return 'neutral'
}
