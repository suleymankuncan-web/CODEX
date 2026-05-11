import { use } from 'react'
import { defaultAppLocale } from '../../lib/i18n'
import { translate, type TranslationKey, type TranslationParams } from './dictionary'
import { LocalizationContext, type LocalizationContextValue } from './localization-context'

export function useLocalization(): LocalizationContextValue {
  const context = use(LocalizationContext)

  if (!context) {
    return {
      locale: defaultAppLocale,
      setLocale: () => undefined,
      t: (key: TranslationKey, params?: TranslationParams) =>
        translate(defaultAppLocale, key, params),
    }
  }

  return context
}
