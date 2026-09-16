import type { ChecklistAcknowledgementItem } from '../features/checklists/api'
import type { AppLocale } from '../lib/i18n'
import { getResponseRatio, getStaticCopy } from './store-checklists-logic'

type Response = ChecklistAcknowledgementItem['responses'][number]

export function getChecklistResultItemTone(item: Response) {
  const ratio = getResponseRatio(item)
  if (ratio === null) return 'neutral'
  if (ratio < 70) return 'danger'
  if (ratio < 80) return 'warning'
  return 'success'
}

export function getChecklistResultAnswerLabel(locale: AppLocale, response: Response) {
  const noAnswer = getStaticCopy(locale, 'Yanıt yok', 'No answer')
  if (response.responseValue === 'not_applicable') return 'N/A'
  if (response.responseType.trim().toLowerCase() === 'text') return response.commentText?.trim() || noAnswer
  if (response.scoreValue === null) return noAnswer
  switch (response.responseType.trim().toLowerCase()) {
    case 'compliance':
      switch (response.responseValue) {
        case 'compliant': return getStaticCopy(locale, 'Uygun', 'Compliant')
        case 'partially_compliant': return getStaticCopy(locale, 'Kısmen Uygun', 'Partially compliant')
        case 'non_compliant': return getStaticCopy(locale, 'Uygun Değil', 'Non-compliant')
        default: return noAnswer
      }
    case 'yes_no':
    case 'boolean': return response.scoreValue > 0 ? getStaticCopy(locale, 'Evet', 'Yes') : getStaticCopy(locale, 'Hayır', 'No')
    case 'partial': {
      const ratio = getResponseRatio(response)
      if (ratio === null) return noAnswer
      if (ratio >= 80) return getStaticCopy(locale, 'Uygun', 'Good')
      if (ratio >= 40) return getStaticCopy(locale, 'Takip', 'Watch')
      return getStaticCopy(locale, 'Kritik', 'Critical')
    }
    default: return String(response.scoreValue)
  }
}
