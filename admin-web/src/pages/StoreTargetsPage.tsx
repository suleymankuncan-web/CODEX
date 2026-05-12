import { Link } from 'react-router-dom'
import { useLocalization } from '../features/localization/useLocalization'

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

      <section className="store-command-panel">
        <div className="store-command-panel-head">
          <h3>{t('storeHome.targets.workflowTitle')}</h3>
        </div>
        <p className="store-command-panel-note">{t('storeHome.targets.workflowCopy')}</p>
        <Link className="store-command-focus-action store-command-inline-action" to="/admin/targets">
          {t('storeHome.targets.openAdminTargets')}
        </Link>
      </section>
    </section>
  )
}
