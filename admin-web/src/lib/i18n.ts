export const appLocales = ['tr', 'en'] as const

export type AppLocale = (typeof appLocales)[number]

export const defaultAppLocale: AppLocale = 'tr'
export const appLocaleStorageKey = 'store-ops-app-locale'

export function isAppLocale(input: unknown): input is AppLocale {
  return typeof input === 'string' && appLocales.includes(input as AppLocale)
}

export function normalizeAppLocale(input: unknown): AppLocale {
  return isAppLocale(input) ? input : defaultAppLocale
}

export function readStoredAppLocale(): AppLocale {
  if (typeof window === 'undefined') {
    return defaultAppLocale
  }

  return normalizeAppLocale(window.localStorage.getItem(appLocaleStorageKey))
}

export function writeStoredAppLocale(locale: AppLocale) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(appLocaleStorageKey, locale)
}

export function getIntlLocale(input: AppLocale = defaultAppLocale) {
  if (input === 'en') {
    return 'en-US'
  }

  return 'tr-TR'
}
