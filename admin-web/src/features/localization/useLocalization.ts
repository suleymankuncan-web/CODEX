import { useContext } from 'react'
import { defaultAppLocale } from '../../lib/i18n'
import { translate, type TranslationKey } from './dictionary'
import { LocalizationContext, type LocalizationContextValue } from './localization-context'

export function useLocalization(): LocalizationContextValue {
  const context = useContext(LocalizationContext)

  if (!context) {
    return {
      locale: defaultAppLocale,
      setLocale: () => undefined,
      t: (key: TranslationKey) => translate(defaultAppLocale, key),
    }
  }

  return context
}
