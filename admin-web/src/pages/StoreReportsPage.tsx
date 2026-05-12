import { Link } from 'react-router-dom'
import { useLocalization } from '../features/localization/useLocalization'

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

      <section className="store-command-panel">
        <div className="store-command-panel-head">
          <h3>{t('storeHome.reports.workflowTitle')}</h3>
        </div>
        <p className="store-command-panel-note">{t('storeHome.reports.workflowCopy')}</p>
        <Link className="store-command-focus-action store-command-inline-action" to="/admin/reports">
          {t('storeHome.reports.openAdminReports')}
        </Link>
      </section>
    </section>
  )
}
