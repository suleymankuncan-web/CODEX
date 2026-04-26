import { createContext } from 'react'
import type { AppLocale } from '../../lib/i18n'
import type { TranslationKey } from './dictionary'

export type LocalizationContextValue = {
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
  t: (key: TranslationKey) => string
}

export const LocalizationContext = createContext<LocalizationContextValue | null>(null)
