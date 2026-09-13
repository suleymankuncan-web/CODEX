import type { AppLocale } from '@/lib/i18n'
import { formatIncentiveMoney, formatSignedIncentiveMoney } from './format'
import { sumMoney } from './model'

export function IncentiveFinalAmount(input: { final: string | null; calculated: string | null; locale: AppLocale }) {
  const difference = input.final !== null && input.calculated !== null ? sumMoney([input.final, `-${input.calculated}`]) : null
  const changed = difference !== null && Number(difference) !== 0
  return <span className="incentive-final-amount"><strong>{formatIncentiveMoney(input.final, input.locale)}</strong>{changed ? <small className={Number(difference) > 0 ? 'is-increase' : 'is-decrease'}>{formatSignedIncentiveMoney(difference, input.locale)}</small> : null}</span>
}
