import type { AppLocale } from '@/lib/i18n'
import type { IncentiveStore } from './types'
import { formatIncentiveDay, formatIncentiveMoney } from './format'

export function PositiveSellersInformation({ store, locale }: { store: IncentiveStore; locale: AppLocale }) {
  const unknown = store.positiveSellers?.filter(person => !person.employeeId) ?? []
  if (!unknown.length) return null
  const tr = locale === 'tr'
  return <section className="tw:mt-4 tw:border-t tw:border-border tw:px-4 tw:py-3" aria-label={tr ? 'Personel eşleşmesi bekleyen satışlar' : 'Sales awaiting personnel matching'}>
    <h4 className="tw:m-0 tw:text-sm tw:font-semibold">{tr ? 'Personel eşleşmesi bekleyen satışlar' : 'Sales awaiting personnel matching'}</h4>
    <p className="tw:mt-1 tw:text-xs tw:text-muted-foreground">{tr ? 'Bu kayıtlar bilgilendirme amaçlıdır; personel eşleşmesi tamamlanmadan prim işlemi yapılamaz.' : 'These records are informational; incentives require personnel matching.'}</p>
    <dl className="tw:m-0 tw:divide-y tw:divide-border">{unknown.map((person, index) => <div key={person.personnelCode ?? index} className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:py-2 tw:text-xs"><dt>{person.personnelCode ?? (tr ? 'Sicil yok' : 'No personnel code')}<small className="tw:block tw:text-muted-foreground">{tr ? 'Son pozitif satış' : 'Last positive sale'}: {formatIncentiveDay(person.lastPositiveDate, locale)}</small></dt><dd className="tw:m-0 tw:tabular-nums">{tr ? 'Net satış' : 'Net sales'}: {formatIncentiveMoney(person.netAmount, locale)}</dd></div>)}</dl>
  </section>
}
