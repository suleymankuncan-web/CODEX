import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  readStoredAppLocale,
  writeStoredAppLocale,
  type AppLocale,
} from '../../lib/i18n'
import { translate, type TranslationKey } from './dictionary'
import { LocalizationContext } from './localization-context'

export function LocalizationProvider(input: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(() => readStoredAppLocale())

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((nextLocale: AppLocale) => {
    setLocaleState(nextLocale)
    writeStoredAppLocale(nextLocale)
  }, [])

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: TranslationKey) => translate(locale, key),
    }),
    [locale, setLocale],
  )

  return <LocalizationContext.Provider value={value}>{input.children}</LocalizationContext.Provider>
}
