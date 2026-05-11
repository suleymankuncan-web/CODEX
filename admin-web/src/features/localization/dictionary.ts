import { defaultAppLocale, type AppLocale } from '../../lib/i18n'
import { messages } from './messages'

type LocaleMessages = (typeof messages)[typeof defaultAppLocale]

export type TranslationKey = keyof LocaleMessages
type TranslationParamValue = string | number
export type TranslationParams = Record<string, TranslationParamValue>
export type TranslateFunction = (key: TranslationKey, params?: TranslationParams) => string

const dictionary: Record<AppLocale, LocaleMessages> = messages

function interpolateTranslation(template: string, params?: TranslationParams) {
  if (!params) {
    return template
  }

  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, key: string) => {
    const value = params[key]
    return value === undefined ? match : String(value)
  })
}

export function translate(
  locale: AppLocale,
  key: TranslationKey,
  params?: TranslationParams,
) {
  const template = dictionary[locale]?.[key] ?? dictionary[defaultAppLocale][key]
  return interpolateTranslation(template, params)
}
