import { FileSpreadsheet, Store } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { FieldGroup } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import {
  IntegrationField,
  IntegrationSelect,
  IntegrationUploadDrop,
  UploadSummaryGrid,
} from './integration-dashboard-surface-controls'
import type {
  IntegrationDispatch,
  IntegrationSource,
  PowerBiPeriodType,
  PowerBiUploadMutationState,
} from './integration-dashboard-surface-types'
import type { ImportOverview } from './api'
import type { TranslateFunction } from '../localization/dictionary'
import { formatNumber, formatOptionalBatch } from './integration-dashboard-list-model'
import {
  AdminActionRow,
  AdminKeyValue,
  AdminKeyValueGrid,
  AdminStatePanel,
  AdminSurfaceBadge,
  AdminSurfaceSection,
} from '../../pages/admin-surface-primitives'

type IntegrationUploadsPanelProps = {
  dispatchPageState: IntegrationDispatch
  isPowerBiUploadDisabled: boolean
  overview: ImportOverview
  personnelFile: File | null
  powerBiPeriodEnd: string
  powerBiPeriodMonth: string
  powerBiPeriodStart: string
  powerBiPeriodType: PowerBiPeriodType
  powerBiSources: IntegrationSource[]
  powerBiUploadBlockers: string[]
  resolvedPowerBiSourceCode: string
  storeFile: File | null
  t: TranslateFunction
  uploadPowerBiMutation: PowerBiUploadMutationState
}

function IntegrationUploadsPanel(input: IntegrationUploadsPanelProps) {
  const {
    dispatchPageState,
    isPowerBiUploadDisabled,
    overview,
    personnelFile,
    powerBiPeriodEnd,
    powerBiPeriodMonth,
    powerBiPeriodStart,
    powerBiPeriodType,
    powerBiSources,
    powerBiUploadBlockers,
    resolvedPowerBiSourceCode,
    storeFile,
    t,
    uploadPowerBiMutation,
  } = input

  return (
    <AdminSurfaceSection
      ariaLabel={t('adminIntegrations.uploadsTabAria')}
      badge={
        <AdminSurfaceBadge tone={powerBiUploadBlockers.length === 0 ? 'success' : 'warning'}>
          {powerBiUploadBlockers.length === 0
            ? t('adminIntegrations.ready')
            : t('adminIntegrations.waiting')}
        </AdminSurfaceBadge>
      }
      description={t('adminIntegrations.uploadPanelCopy')}
      title={t('adminIntegrations.uploadPanelTitle')}
    >
      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="tw:grid tw:gap-4">
          <FieldGroup className="integration-form-fields">
            <IntegrationField label={t('adminIntegrations.powerBiKpiSource')}>
              <IntegrationSelect
                value={resolvedPowerBiSourceCode}
                onValueChange={(value) =>
                  dispatchPageState({
                    type: 'setPowerBiSourceCode',
                    value: value,
                  })
                }
                disabled={powerBiSources.length === 0}
              >
                {powerBiSources.length === 0 ? (
                  <option value="">{t('adminIntegrations.noActiveKpiSource')}</option>
                ) : null}
                {powerBiSources.map((item) => (
                  <option key={item.sourceId} value={item.sourceCode}>
                    {item.sourceCode} - {item.sourceName}
                  </option>
                ))}
              </IntegrationSelect>
            </IntegrationField>

            <IntegrationField label={t('adminIntegrations.periodType')}>
              <IntegrationSelect
                aria-label={t('adminIntegrations.periodType')}
                value={powerBiPeriodType}
                onValueChange={(value) =>
                  dispatchPageState({
                    type: 'setPowerBiPeriodType',
                    value: value as PowerBiPeriodType,
                  })
                }
              >
                <option value="monthly">{t('adminIntegrations.monthlySnapshot')}</option>
                <option value="daily">{t('adminIntegrations.dailyData')}</option>
                <option value="custom">{t('adminIntegrations.customDateRange')}</option>
              </IntegrationSelect>
            </IntegrationField>

            {powerBiPeriodType === 'monthly' ? (
              <IntegrationField label={t('adminIntegrations.periodMonth')}>
                <Input
                  type="month"
                  value={powerBiPeriodMonth}
                  onChange={(event) =>
                    dispatchPageState({
                      type: 'setPowerBiPeriodMonth',
                      value: event.target.value,
                    })
                  }
                />
              </IntegrationField>
            ) : (
              <>
                <IntegrationField label={t('adminIntegrations.start')}>
                  <Input
                    aria-label={t('adminIntegrations.start')}
                    type="date"
                    value={powerBiPeriodStart}
                    onChange={(event) =>
                      dispatchPageState({
                        type: 'setPowerBiPeriodStart',
                        value: event.target.value,
                        syncEnd: powerBiPeriodType === 'daily',
                      })
                    }
                  />
                </IntegrationField>
                <IntegrationField label={t('adminIntegrations.end')}>
                  <Input
                    aria-label={t('adminIntegrations.end')}
                    type="date"
                    value={powerBiPeriodType === 'daily' ? powerBiPeriodStart : powerBiPeriodEnd}
                    disabled={powerBiPeriodType === 'daily'}
                    onChange={(event) =>
                      dispatchPageState({
                        type: 'setPowerBiPeriodEnd',
                        value: event.target.value,
                      })
                    }
                  />
                </IntegrationField>
              </>
            )}
          </FieldGroup>

          <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:md:grid-cols-2">
            <IntegrationUploadDrop
              icon={<FileSpreadsheet size={20} aria-hidden="true" />}
              title={t('adminIntegrations.personnelExport')}
              fileName={personnelFile?.name ?? t('adminIntegrations.noFileSelected')}
              onFileChange={(file) =>
                dispatchPageState({
                  type: 'setPersonnelFile',
                  value: file,
                })
              }
            />
            <IntegrationUploadDrop
              icon={<Store size={20} aria-hidden="true" />}
              title={t('adminIntegrations.storeExport')}
              fileName={storeFile?.name ?? t('adminIntegrations.noFileSelected')}
              onFileChange={(file) =>
                dispatchPageState({
                  type: 'setStoreFile',
                  value: file,
                })
              }
            />
          </div>

          <AdminActionRow>
            <Button
              type="button"
              disabled={isPowerBiUploadDisabled}
              onClick={() =>
                uploadPowerBiMutation.mutate({
                  sourceCode: resolvedPowerBiSourceCode,
                  periodType: powerBiPeriodType,
                  ...(powerBiPeriodType === 'monthly' && powerBiPeriodMonth
                    ? { periodMonth: powerBiPeriodMonth }
                    : {}),
                  ...(powerBiPeriodType !== 'monthly' && powerBiPeriodStart
                    ? { periodStart: powerBiPeriodStart }
                    : {}),
                  ...(powerBiPeriodType !== 'monthly'
                    ? {
                        periodEnd:
                          powerBiPeriodType === 'daily' ? powerBiPeriodStart : powerBiPeriodEnd,
                      }
                    : {}),
                  personnelFile,
                  storeFile,
                })
              }
            >
              {uploadPowerBiMutation.isPending
                ? t('adminIntegrations.uploading')
                : t('adminIntegrations.uploadPowerBiExport')}
            </Button>
          </AdminActionRow>

          {powerBiUploadBlockers.length > 0 ? (
            <AdminStatePanel
              title={t('adminIntegrations.powerBiNotReady')}
              description={powerBiUploadBlockers.join(' ')}
              tone="warning"
            />
          ) : (
            <AdminStatePanel
              title={t('adminIntegrations.powerBiReadyCopy')}
              tone="neutral"
            />
          )}
        </section>

        <aside
          className="integration-upload-summary"
          aria-label={t('adminIntegrations.uploadDecisionEyebrow')}
        >
          <h3 className="tw:mb-3 tw:text-sm tw:font-semibold tw:text-primary">{t('adminIntegrations.uploadDecisionEyebrow')}</h3>
          <AdminKeyValueGrid className="tw:lg:grid-cols-1">
            <AdminKeyValue
              label={t('adminIntegrations.latestCompleted')}
              value={formatOptionalBatch(overview.latest.completedBatchId, t)}
            />
            <AdminKeyValue
              label={t('adminIntegrations.retryReady')}
              value={formatNumber(overview.healthTotals.retryReady)}
            />
            <AdminKeyValue
              label={t('adminIntegrations.blocked')}
              value={formatNumber(overview.healthTotals.blocked)}
            />
          </AdminKeyValueGrid>
        </aside>
      </div>

      {uploadPowerBiMutation.data?.data.summary ? (
        <UploadSummaryGrid summary={uploadPowerBiMutation.data.data.summary} t={t} />
      ) : null}
    </AdminSurfaceSection>
  )
}

export { IntegrationUploadsPanel }
