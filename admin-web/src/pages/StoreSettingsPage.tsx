import { LanguageToggle } from '../features/localization/LanguageToggle'
import { useLocalization } from '../features/localization/useLocalization'
import { KeyValue, StatusPill } from '../components/dashboard-primitives'

export function StoreSettingsPage() {
  const { t } = useLocalization()

  return (
    <section className="store-command-utility-page" aria-label={t('storeHome.settings.aria')}>
      <div className="store-command-utility-hero">
        <div>
          <span>{t('storeHome.settings.eyebrow')}</span>
          <h1>{t('storeHome.settings.title')}</h1>
          <p>{t('storeHome.settings.copy')}</p>
        </div>
      </div>

      <section className="store-command-panel" aria-label={t('storeHome.settings.languagePanelAria')}>
        <div className="store-command-panel-head">
          <h3>{t('storeHome.settings.languageTitle')}</h3>
          <StatusPill tone="calm">{t('storeHome.utility.statusPreference')}</StatusPill>
        </div>
        <p className="store-command-panel-note">{t('storeHome.settings.languageCopy')}</p>
        <div className="store-command-settings-control">
          <LanguageToggle />
        </div>
      </section>

      <section className="store-command-panel" aria-label={t('storeHome.settings.boundaryAria')}>
        <div className="store-command-panel-head">
          <h3>{t('storeHome.settings.boundaryTitle')}</h3>
          <StatusPill tone="neutral">{t('storeHome.utility.statusBoundary')}</StatusPill>
        </div>
        <div className="key-grid">
          <KeyValue label={t('storeHome.utility.currentRoute')} value="/store/settings" />
          <KeyValue label={t('storeHome.utility.primaryAction')} value={t('storeHome.settings.primaryActionValue')} />
          <KeyValue label={t('storeHome.utility.dataBoundary')} value={t('storeHome.settings.dataBoundaryValue')} />
          <KeyValue label={t('storeHome.utility.nextStep')} value={t('storeHome.settings.nextStepValue')} />
        </div>
      </section>
    </section>
  )
}
