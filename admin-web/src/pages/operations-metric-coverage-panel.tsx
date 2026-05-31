import type { TranslateFunction } from '../features/localization/dictionary'
import {
  type OperationsTone,
  OperationsPanel,
  OperationsQueueList,
  OperationsStatusBadge,
} from './operations-surface-primitives'

type TranslationKey = Parameters<TranslateFunction>[0]

type MetricCoverageItem = {
  copyKey: TranslationKey
  href?: string
  id: string
  ownerKey: TranslationKey
  sourceKey: TranslationKey
  statusKey: TranslationKey
  titleKey: TranslationKey
  tone: OperationsTone
}

const metricCoverageItems: MetricCoverageItem[] = [
  {
    id: 'backend-queue',
    titleKey: 'adminOperations.coverage.backendTitle',
    copyKey: 'adminOperations.coverage.backendCopy',
    ownerKey: 'adminOperations.owner.platform',
    sourceKey: 'adminOperations.coverage.backendSource',
    statusKey: 'adminOperations.coverage.live',
    tone: 'calm',
  },
  {
    href: '/admin/integrations',
    id: 'import-materialization',
    titleKey: 'adminOperations.coverage.importTitle',
    copyKey: 'adminOperations.coverage.importCopy',
    ownerKey: 'adminOperations.owner.integration',
    sourceKey: 'adminOperations.coverage.importSource',
    statusKey: 'adminOperations.coverage.live',
    tone: 'calm',
  },
  {
    href: '/admin/integrations',
    id: 'data-quality',
    titleKey: 'adminOperations.coverage.dataQualityTitle',
    copyKey: 'adminOperations.coverage.dataQualityCopy',
    ownerKey: 'adminOperations.owner.integration',
    sourceKey: 'adminOperations.coverage.dataQualitySource',
    statusKey: 'adminOperations.coverage.partial',
    tone: 'warning',
  },
  {
    href: '/admin/snapshots',
    id: 'snapshot-reporting',
    titleKey: 'adminOperations.coverage.snapshotTitle',
    copyKey: 'adminOperations.coverage.snapshotCopy',
    ownerKey: 'adminOperations.owner.reporting',
    sourceKey: 'adminOperations.coverage.snapshotSource',
    statusKey: 'adminOperations.coverage.live',
    tone: 'calm',
  },
  {
    href: '/admin/auth',
    id: 'auth-scope',
    titleKey: 'adminOperations.coverage.authTitle',
    copyKey: 'adminOperations.coverage.authCopy',
    ownerKey: 'adminOperations.owner.auth',
    sourceKey: 'adminOperations.coverage.authSource',
    statusKey: 'adminOperations.coverage.guarded',
    tone: 'warning',
  },
  {
    href: '/admin/inbox',
    id: 'workforce-requests',
    titleKey: 'adminOperations.coverage.workforceTitle',
    copyKey: 'adminOperations.coverage.workforceCopy',
    ownerKey: 'adminOperations.owner.workforce',
    sourceKey: 'adminOperations.coverage.workforceSource',
    statusKey: 'adminOperations.coverage.live',
    tone: 'calm',
  },
  {
    href: '/admin/inbox',
    id: 'workflow-inbox',
    titleKey: 'adminOperations.coverage.workflowTitle',
    copyKey: 'adminOperations.coverage.workflowCopy',
    ownerKey: 'adminOperations.owner.storeOps',
    sourceKey: 'adminOperations.coverage.workflowSource',
    statusKey: 'adminOperations.coverage.live',
    tone: 'calm',
  },
  {
    href: '/admin/reports',
    id: 'kpi-rankings',
    titleKey: 'adminOperations.coverage.kpiTitle',
    copyKey: 'adminOperations.coverage.kpiCopy',
    ownerKey: 'adminOperations.owner.reporting',
    sourceKey: 'adminOperations.coverage.kpiSource',
    statusKey: 'adminOperations.coverage.live',
    tone: 'calm',
  },
  {
    id: 'release-external-evidence',
    titleKey: 'adminOperations.coverage.releaseTitle',
    copyKey: 'adminOperations.coverage.releaseCopy',
    ownerKey: 'adminOperations.owner.platform',
    sourceKey: 'adminOperations.coverage.releaseSource',
    statusKey: 'adminOperations.coverage.blockedByInput',
    tone: 'warning',
  },
]

export function MetricCoveragePanel(input: { t: TranslateFunction }) {
  return (
    <OperationsPanel
      eyebrow={input.t('adminOperations.coverageEyebrow')}
      title={input.t('adminOperations.coverageTitle')}
      description={input.t('adminOperations.coverageCopy')}
      testId="operations-metric-coverage"
      badge={
        <OperationsStatusBadge tone="neutral">
          {input.t('adminOperations.coverageCount', { count: metricCoverageItems.length })}
        </OperationsStatusBadge>
      }
    >
      <OperationsQueueList
        items={metricCoverageItems.map((item) => ({
          footer: item.href ? input.t('adminOperations.coverageOpenSource') : undefined,
          href: item.href,
          id: item.id,
          meta: `${input.t(item.ownerKey)} - ${input.t(item.sourceKey)}`,
          reason: input.t(item.copyKey),
          status: input.t(item.statusKey),
          title: input.t(item.titleKey),
          tone: item.tone,
        }))}
      />
    </OperationsPanel>
  )
}
