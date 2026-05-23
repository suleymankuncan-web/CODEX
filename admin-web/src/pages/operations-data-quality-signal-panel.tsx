import { KeyValue, StatusPill } from '../components/dashboard-primitives'
import type { TranslateFunction } from '../features/localization/dictionary'

export type DataQualitySnapshot = {
  blockedBatchCount: number
  errorRowCount: number
  mappingEntityTypes: string[]
  snapshotIssueCount: number
}

export function DataQualitySignalPanel(input: {
  dataQuality: DataQualitySnapshot
  isError: boolean
  t: TranslateFunction
}) {
  const hasDataQualityPressure =
    input.dataQuality.errorRowCount > 0 ||
    input.dataQuality.blockedBatchCount > 0 ||
    input.dataQuality.mappingEntityTypes.length > 0 ||
    input.dataQuality.snapshotIssueCount > 0

  return (
    <article className="panel">
      <div className="panel-heading panel-heading-spread">
        <div>
          <div className="eyebrow">{input.t('adminOperations.dataQualityEyebrow')}</div>
          <h3>{input.t('adminOperations.dataQualityTitle')}</h3>
          <p className="panel-copy">{input.t('adminOperations.dataQualityCopy')}</p>
        </div>
        <StatusPill tone={input.isError ? 'warning' : hasDataQualityPressure ? 'warning' : 'calm'}>
          {input.isError
            ? input.t('adminOperations.unavailable')
            : hasDataQualityPressure
              ? input.t('adminOperations.needsAttention')
              : input.t('adminOperations.ready')}
        </StatusPill>
      </div>
      <div className="key-grid">
        <KeyValue
          label={input.t('adminOperations.previewErrorRows')}
          value={String(input.dataQuality.errorRowCount)}
        />
        <KeyValue
          label={input.t('adminOperations.mappingBlockers')}
          value={formatMappingEntityTypes(input.dataQuality.mappingEntityTypes, input.t)}
        />
        <KeyValue
          label={input.t('adminOperations.blockedImportBatches')}
          value={String(input.dataQuality.blockedBatchCount)}
        />
        <KeyValue
          label={input.t('adminOperations.snapshotIssues')}
          value={String(input.dataQuality.snapshotIssueCount)}
        />
      </div>
      <p className="queue-reason">{input.t('adminOperations.dataQualitySourceCopy')}</p>
    </article>
  )
}

function formatMappingEntityTypes(input: string[], t: TranslateFunction) {
  if (input.length === 0) return t('adminOperations.noMappingBlockers')

  return input.map((entityType) => formatMappingEntityType(entityType, t)).join(', ')
}

function formatMappingEntityType(input: string, t: TranslateFunction) {
  if (input === 'employee' || input === 'personnel') return t('adminOperations.entity.employee')
  if (input === 'store') return t('adminOperations.entity.store')
  return input.replaceAll('_', ' ')
}
