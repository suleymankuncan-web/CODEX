import { createContext } from 'react'
import type { AppLocale } from '../../lib/i18n'
import type { TranslateFunction } from './dictionary'

export type LocalizationContextValue = {
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
  t: TranslateFunction
}

export const LocalizationContext = createContext<LocalizationContextValue | null>(null)
