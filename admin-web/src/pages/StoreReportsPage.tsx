import { Link } from 'react-router-dom'
import { useLocalization } from '../features/localization/useLocalization'
import { KeyValue, StatusPill } from '../components/dashboard-primitives'

export function StoreReportsPage() {
  const { t } = useLocalization()

  return (
    <section className="store-command-utility-page" aria-label={t('storeHome.reports.aria')}>
      <div className="store-command-utility-hero">
        <div>
          <span>{t('storeHome.reports.eyebrow')}</span>
          <h1>{t('storeHome.reports.title')}</h1>
          <p>{t('storeHome.reports.copy')}</p>
        </div>
      </div>

      <section className="store-command-panel" aria-label={t('storeHome.reports.workflowAria')}>
        <div className="store-command-panel-head">
          <h3>{t('storeHome.reports.workflowTitle')}</h3>
          <StatusPill tone="accent">{t('storeHome.utility.statusHandoff')}</StatusPill>
        </div>
        <p className="store-command-panel-note">{t('storeHome.reports.workflowCopy')}</p>
        <Link className="store-command-focus-action store-command-inline-action" to="/admin/reports">
          {t('storeHome.reports.openAdminReports')}
        </Link>
      </section>

      <section className="store-command-panel" aria-label={t('storeHome.reports.boundaryAria')}>
        <div className="store-command-panel-head">
          <h3>{t('storeHome.reports.boundaryTitle')}</h3>
          <StatusPill tone="neutral">{t('storeHome.utility.statusBoundary')}</StatusPill>
        </div>
        <div className="key-grid">
          <KeyValue label={t('storeHome.utility.currentRoute')} value="/store/reports" />
          <KeyValue label={t('storeHome.utility.primaryAction')} value={t('storeHome.reports.primaryActionValue')} />
          <KeyValue label={t('storeHome.utility.dataBoundary')} value={t('storeHome.reports.dataBoundaryValue')} />
          <KeyValue label={t('storeHome.utility.nextStep')} value={t('storeHome.reports.nextStepValue')} />
        </div>
      </section>
    </section>
  )
}
