export const appLocales = ['tr', 'en'] as const

export type AppLocale = (typeof appLocales)[number]

export const defaultAppLocale: AppLocale = 'tr'

export function getIntlLocale(input: AppLocale = defaultAppLocale) {
  if (input === 'en') {
    return 'en-US'
  }

  return 'tr-TR'
}
