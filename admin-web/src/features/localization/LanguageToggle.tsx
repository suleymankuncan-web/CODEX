import { appLocales, type AppLocale } from '../../lib/i18n'
import { useLocalization } from './useLocalization'

const localeLabelByLocale: Record<AppLocale, 'language.turkishShort' | 'language.englishShort'> = {
  tr: 'language.turkishShort',
  en: 'language.englishShort',
}

const switchLabelByLocale: Record<AppLocale, 'language.switchToTurkish' | 'language.switchToEnglish'> = {
  tr: 'language.switchToTurkish',
  en: 'language.switchToEnglish',
}

export function LanguageToggle() {
  const { locale, setLocale, t } = useLocalization()

  return (
    <div className="language-toggle" role="group" aria-label={t('language.groupLabel')}>
      {appLocales.map((option) => (
        <button
          aria-label={t(switchLabelByLocale[option])}
          aria-pressed={locale === option}
          className={`language-toggle-button${locale === option ? ' language-toggle-button-active' : ''}`}
          key={option}
          type="button"
          onClick={() => setLocale(option)}
        >
          {t(localeLabelByLocale[option])}
        </button>
      ))}
    </div>
  )
}
