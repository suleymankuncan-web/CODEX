import { CalendarDays } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import type { AppLocale } from '../lib/i18n'

export function StoreKpisPeriodEmpty({ locale, start, end }: { locale: AppLocale; start: string; end?: string | undefined }) {
  const format = (value: string) => new Intl.DateTimeFormat(locale, {
    ...(end ? { day: 'numeric' as const } : {}), month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`))
  const period = start ? `${format(start)}${end ? ` – ${format(end)}` : ''}` : ''
  return <Empty role="status" className="store-kpis-period-empty"><EmptyHeader>
    <EmptyMedia variant="icon"><CalendarDays /></EmptyMedia>
    <EmptyTitle>{locale === 'tr' ? 'Seçilen tarih için veri bulunamadı' : 'No data for the selected dates'}</EmptyTitle>
    <EmptyDescription>{period ? `${period}. ` : ''}{locale === 'tr' ? 'Takvimden başka bir gün veya ay seçebilirsiniz.' : 'Select another day or month from the calendar.'}</EmptyDescription>
  </EmptyHeader></Empty>
}
