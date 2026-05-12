import { LanguageToggle } from '../features/localization/LanguageToggle'
import { useLocalization } from '../features/localization/useLocalization'

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

      <section className="store-command-panel">
        <div className="store-command-panel-head">
          <h3>{t('storeHome.settings.languageTitle')}</h3>
        </div>
        <p className="store-command-panel-note">{t('storeHome.settings.languageCopy')}</p>
        <div className="store-command-settings-control">
          <LanguageToggle />
        </div>
      </section>
    </section>
  )
}
