import { Activity } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusPill, type Tone } from '../components/dashboard-primitives'
import type { TranslateFunction } from '../features/localization/dictionary'

type TranslationKey = Parameters<TranslateFunction>[0]

type MetricCoverageItem = {
  copyKey: TranslationKey
  href?: string
  id: string
  ownerKey: TranslationKey
  sourceKey: TranslationKey
  statusKey: TranslationKey
  titleKey: TranslationKey
  tone: Tone
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
    statusKey: 'adminOperations.coverage.planned',
    tone: 'neutral',
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
    <article className="panel">
      <div className="panel-heading panel-heading-spread">
        <div>
          <div className="eyebrow">{input.t('adminOperations.coverageEyebrow')}</div>
          <h3>{input.t('adminOperations.coverageTitle')}</h3>
          <p className="panel-copy">{input.t('adminOperations.coverageCopy')}</p>
        </div>
        <StatusPill tone="neutral">
          {input.t('adminOperations.coverageCount', { count: metricCoverageItems.length })}
        </StatusPill>
      </div>
      <div className="queue-list">
        {metricCoverageItems.map((item) => {
          const content = (
            <>
              <div className="queue-row-head">
                <div>
                  <div className="queue-title">{input.t(item.titleKey)}</div>
                  <div className="queue-subtitle">
                    {input.t(item.ownerKey)} · {input.t(item.sourceKey)}
                  </div>
                </div>
                <StatusPill tone={item.tone}>{input.t(item.statusKey)}</StatusPill>
              </div>
              <p className="queue-reason">{input.t(item.copyKey)}</p>
              {item.href ? (
                <div className="queue-footer">
                  <span>{input.t('adminOperations.coverageOpenSource')}</span>
                  <Activity size={16} />
                </div>
              ) : null}
            </>
          )

          return item.href ? (
            <Link className="queue-row" key={item.id} to={item.href}>
              {content}
            </Link>
          ) : (
            <div className="queue-row" key={item.id}>
              {content}
            </div>
          )
        })}
      </div>
    </article>
  )
}
