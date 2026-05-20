import { Link } from 'react-router-dom'
import { useLocalization } from '../features/localization/useLocalization'
import { KeyValue, StatusPill } from '../components/dashboard-primitives'

export function StoreTargetsPage() {
  const { t } = useLocalization()

  return (
    <section className="store-command-utility-page" aria-label={t('storeHome.targets.aria')}>
      <div className="store-command-utility-hero">
        <div>
          <span>{t('storeHome.targets.eyebrow')}</span>
          <h1>{t('storeHome.targets.title')}</h1>
          <p>{t('storeHome.targets.copy')}</p>
        </div>
      </div>

      <section className="store-command-panel" aria-label={t('storeHome.targets.workflowAria')}>
        <div className="store-command-panel-head">
          <h3>{t('storeHome.targets.workflowTitle')}</h3>
          <StatusPill tone="accent">{t('storeHome.utility.statusHandoff')}</StatusPill>
        </div>
        <p className="store-command-panel-note">{t('storeHome.targets.workflowCopy')}</p>
        <Link className="store-command-focus-action store-command-inline-action" to="/admin/targets">
          {t('storeHome.targets.openAdminTargets')}
        </Link>
      </section>

      <section className="store-command-panel" aria-label={t('storeHome.targets.boundaryAria')}>
        <div className="store-command-panel-head">
          <h3>{t('storeHome.targets.boundaryTitle')}</h3>
          <StatusPill tone="neutral">{t('storeHome.utility.statusBoundary')}</StatusPill>
        </div>
        <div className="key-grid">
          <KeyValue label={t('storeHome.utility.currentRoute')} value="/store/targets" />
          <KeyValue label={t('storeHome.utility.primaryAction')} value={t('storeHome.targets.primaryActionValue')} />
          <KeyValue label={t('storeHome.utility.dataBoundary')} value={t('storeHome.targets.dataBoundaryValue')} />
          <KeyValue label={t('storeHome.utility.nextStep')} value={t('storeHome.targets.nextStepValue')} />
        </div>
      </section>
    </section>
  )
}
