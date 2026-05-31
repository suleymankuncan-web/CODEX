import type { TranslateFunction } from '../features/localization/dictionary'
import {
  OperationsKeyValue,
  OperationsKeyValueGrid,
  OperationsPanel,
  OperationsStatusBadge,
} from './operations-surface-primitives'

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
    <OperationsPanel
      eyebrow={input.t('adminOperations.dataQualityEyebrow')}
      title={input.t('adminOperations.dataQualityTitle')}
      description={input.t('adminOperations.dataQualityCopy')}
      testId="operations-data-quality"
      badge={
        <OperationsStatusBadge tone={input.isError ? 'warning' : hasDataQualityPressure ? 'warning' : 'calm'}>
          {input.isError
            ? input.t('adminOperations.unavailable')
            : hasDataQualityPressure
              ? input.t('adminOperations.needsAttention')
              : input.t('adminOperations.ready')}
        </OperationsStatusBadge>
      }
    >
      <OperationsKeyValueGrid>
        <OperationsKeyValue
          label={input.t('adminOperations.previewErrorRows')}
          value={String(input.dataQuality.errorRowCount)}
        />
        <OperationsKeyValue
          label={input.t('adminOperations.mappingBlockers')}
          value={formatMappingEntityTypes(input.dataQuality.mappingEntityTypes, input.t)}
        />
        <OperationsKeyValue
          label={input.t('adminOperations.blockedImportBatches')}
          value={String(input.dataQuality.blockedBatchCount)}
        />
        <OperationsKeyValue
          label={input.t('adminOperations.snapshotIssues')}
          value={String(input.dataQuality.snapshotIssueCount)}
        />
      </OperationsKeyValueGrid>
      <p className="tw:m-0 tw:text-sm tw:text-muted-foreground">
        {input.t('adminOperations.dataQualitySourceCopy')}
      </p>
    </OperationsPanel>
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
