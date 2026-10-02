export const appLocales = ['tr', 'en'] as const

export type AppLocale = (typeof appLocales)[number]

export const defaultAppLocale: AppLocale = 'tr'
const appLocaleStorageKey = 'store-ops-app-locale'

function isAppLocale(input: unknown): input is AppLocale {
  return typeof input === 'string' && appLocales.includes(input as AppLocale)
}

function normalizeAppLocale(input: unknown): AppLocale {
  return isAppLocale(input) ? input : defaultAppLocale
}

export function readStoredAppLocale(): AppLocale {
  if (typeof window === 'undefined') {
    return defaultAppLocale
  }

  try {
    return normalizeAppLocale(window.localStorage.getItem(appLocaleStorageKey))
  } catch {
    return defaultAppLocale
  }
}

export function writeStoredAppLocale(locale: AppLocale) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(appLocaleStorageKey, locale)
  } catch { /* Locale preferences are optional; blocked storage must not break sign-in. */ }
}

export function getIntlLocale(input: AppLocale = defaultAppLocale) {
  if (input === 'en') {
    return 'en-US'
  }

  return 'tr-TR'
}
